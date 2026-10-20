/**
 * Goal-related IPC handlers extracted from main.ts.
 * Registered via registerGoalHandlers(db, deps).
 */

import { ipcMain, BrowserWindow } from 'electron';

// ── WHY THIS IS A STATIC IMPORT, NOT require() ─────────────────────────────
// These were `require('../../…')` calls. That path is correct for the SOURCE
// file but wrong for the OUTPUT: the build leaves a bare require() in
// dist-electron/main.cjs, where `../../` resolves ABOVE the repo root.
// The aiEval twin of this bug KILLED THE APP AT BOOT:
//     Cannot find module '../../services/aiEval'
// These ones never threw, because each sat inside `catch {}` — which converts a
// crash into a SILENT NO-OP. `airouter` has been quietly failing to configure
// its router this entire time. Silence is strictly worse than a crash.
// A static import is inlined by the bundler, so there is no path to misresolve.
// Verified: none of these modules run code at module scope.
import { weekDays, isoWeekKey, daysActiveInWeek } from '../../lib/week';
import { PATTERN_VOCABULARY, PLAN_SCHEMA_VERSION } from '../../shared/aiPlanSchema';
import Database from 'better-sqlite3';
import { upsertGoalRow } from '../../shared/goalUpsert';
import { publishAutomationEvent } from '../../services/automation/AutomationBus';
import { parseCaptureLine } from '../../shared/captureParse';
import { scheduleCard, dueCards, nextDueHint, type SrsCard, type Rating } from '../../shared/srs';
import { computeWeeklyScore, describeWeeklyScore, type DayMark } from '../../shared/weeklyScore';
import { buildWeeklyReview } from '../../shared/weeklyReview';
import { detectDrift, driftQuestion, phaseLabel, phaseChangeSummary, PHASE_RULES, DRIFT_COOLDOWN_DAYS, type TrainingMode } from '../../shared/phaseRules';
import { evaluatePlanMode, breakWarning, BREAK_PHRASE } from '../../shared/planMode';
import { preparePlanReply } from '../../shared/aiPlanSchema';

// Types (mirrored from main.ts)
interface GoalEntity {
  id: string;
  title: string;
  description: string;
  category: string;
  target: { type: string; targetSeconds: number; matchCategory: boolean };
  period: string;
  created_at: string;
  date: string;
}

export interface GoalHandlerDeps {
  db: Database.Database;
  mainWindow: BrowserWindow | null;
  userPreferences: Record<string, any>;
  getLocalDateStr: (d?: Date) => string;
  toInt: (v: unknown) => number;
  buildChain: (state: any, assistant: string) => any[];
  runWithFallback: (chain: any[], opts: any) => Promise<{ result: any }>;
  GOAL_DUMP_SYSTEM?: string;
  GOAL_FEEDBACK_SYSTEM?: string;
}

/**
 * The `save-goal` behavior, extracted verbatim so automation executors can
 * import the BEHAVIOR rather than re-implement it (RESULT.md §10 clause
 * (behavior unit), class i-b). Lives here, not in main.ts, by design.
 *
 * NOTE: the body below is the original `save-goal` closure body, unchanged
 * except for the addition of the automation emit at the end. If you change
 * the write, change it here and the IPC handler below inherits it.
 */
export function saveGoalEntry(db: Database.Database, date: string, goal: any): { success: boolean; id?: string; error?: string } {
  try {
    const id = ensureGoalId(goal.id);
    // `date` arrives as its own argument and is authoritative for this write.
    const payload = { ...goal, date };
    const action = upsertGoalRow(db, id, payload, {
      date,
      category: goal.category || 'work',
      targetType: goal.target?.type || 'time',
      status: goal.status || 'pending',
      period: goal.period || 'daily',
      source: goal.source || 'manual',
    });

    // ONE discrimination, reused for both the episode write and the event emit:
    // created > completed > updated. Reading it twice would let the two drift.
    const discrimination = action === 'created' ? 'created'
      : (goal.status === 'done' ? 'completed' : 'updated');

    // Capture goal episode into context brain
    try { episodeWriters.writeGoalEpisode({ ...goal, id }, discrimination); } catch {}

    // Automation emit. Fire-and-forget: a broken automation must never fail the
    // goal write that triggered it. Wrapped so it cannot throw out of here.
    try {
      if (discrimination === 'created') {
        publishAutomationEvent('goals.goal.created', {
          id,
          title: String(goal.title || goal.text || ''),
          priority: Number(goal.priority ?? 0),
        }, { kind: 'goal', id });
      } else if (discrimination === 'completed') {
        publishAutomationEvent('goals.goal.completed', {
          id,
          title: String(goal.title || goal.text || ''),
          result: String(goal.title || goal.text || ''),
          completedAt: Date.now(),
        }, { kind: 'goal', id });
      }
    } catch { /* automation is never allowed to break the write */ }

    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function registerGoalHandlers(deps: GoalHandlerDeps) {
  const { db, mainWindow, userPreferences, getLocalDateStr, toInt, buildChain, runWithFallback } = deps;

ipcMain.handle('get-goals', async (_event, date: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date = ? ORDER BY created_at ASC').all(date) as any[];
    const reviewRow = db!.prepare('SELECT review_summary FROM goal_reviews WHERE date = ?').get(date) as any;
    return {
      date,
      reviewSummary: reviewRow?.review_summary,
      goals: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        target: { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category },
        period: r.period,
        status: r.status,
        date: r.date,
        source: r.source,
        links: JSON.parse(r.links || '[]'),
        parentId: r.parent_id,
        parentIds: parseGoalParentIds(r),
        progressSeconds: r.progress_seconds,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
    };
  } catch (err: any) {
    return { date, goals: [], error: err.message };
  }
});

// Batch goals by date range — replaces N+1 sequential get-goals calls
ipcMain.handle('get-goals-batch', async (_event, startDate: string, endDate: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC').all(startDate, endDate) as any[];
    const reviewRows = db!.prepare('SELECT date, review_summary FROM goal_reviews WHERE date BETWEEN ? AND ?').all(startDate, endDate) as any[];
    const reviewsMap: Record<string, string> = {};
    for (const r of reviewRows) { reviewsMap[r.date] = r.review_summary; }
    const days: Record<string, any> = {};
    for (const r of rows) {
      if (!days[r.date]) {
        days[r.date] = { date: r.date, reviewSummary: reviewsMap[r.date] || null, goals: [] };
      }
      days[r.date].goals.push({
        id: r.id, title: r.title, description: r.description,
        category: r.category, target: { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category },
        period: r.period, status: r.status, date: r.date, source: r.source,
        links: JSON.parse(r.links || '[]'), parentId: r.parent_id, parentIds: parseGoalParentIds(r),
        progressSeconds: r.progress_seconds,
        createdAt: r.created_at, completedAt: r.completed_at,
      });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalDateStr(d);
      result.push(days[dateStr] || { date: dateStr, reviewSummary: reviewsMap[dateStr] || null, goals: [] });
    }
    return { success: true, days: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Habits are goals flagged with is_habit = 1. HabitTracker calls this to render
// the weekly habit grid. (Previously unregistered → "No handler registered".)
ipcMain.handle('goal:get-habits', async (_event, startDate: string, endDate: string) => {
  try {
    const rows = db!.prepare(
      'SELECT * FROM goals WHERE date BETWEEN ? AND ? AND is_habit = 1 ORDER BY date ASC, created_at ASC'
    ).all(startDate, endDate) as any[];
    const habits = rows.map((r: any) => ({
      id: r.id, title: r.title, description: r.description,
      category: r.category, period: r.period, status: r.status, date: r.date,
      source: r.source, is_habit: 1,
      target: { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category },
      links: JSON.parse(r.links || '[]'), parentId: r.parent_id, parentIds: parseGoalParentIds(r),
      progressSeconds: r.progress_seconds, createdAt: r.created_at, completedAt: r.completed_at,
    }));
    return { success: true, habits };
  } catch (err: any) {
    return { success: false, error: err.message, habits: [] };
  }
});

/**
 * Mint a goal id when the caller omitted one.
 *
 * `goals.id` is the PRIMARY KEY, so a NULL write is a schema violation that
 * SQLite will happily accept in a legacy DB and that the renderer cannot
 * recover from: `GoldPage.loadGoals` does `if (!g.id) continue`, so the row
 * loads and is then silently dropped with no error. 21 of 27 rows in the live
 * DB are NULL-id orphans written by exactly the two `save-goal*` paths below.
 *
 * Every writer MUST go through this. Format matches the existing
 * sch_/dl_/rem_ id convention used elsewhere in this file.
 */
function ensureGoalId(raw: any): string {
  const id = raw && String(raw).trim();
  return id || ('goal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
}

ipcMain.handle('save-goal', async (_event, date: string, goal: any) => {
  return saveGoalEntry(db!, date, goal);
});

ipcMain.handle('get-longterm-goals', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE period = ? ORDER BY priority ASC, created_at ASC').all('longterm') as any[];
    return {
      success: true,
      goals: rows.map((r: any) => ({
        ...r,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        links: JSON.parse(r.links || '[]'),
        parentId: r.parent_id,
        parentIds: parseGoalParentIds(r),
        target: r.target_type ? { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category } : undefined,
        progress: r.target_type === 'time' && r.target_seconds ? Math.min(100, Math.round(((r.progress_seconds || 0) / r.target_seconds) * 100)) : 0,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, goals: [] };
  }
});

ipcMain.handle('delete-goal', async (_event, goalId: string) => {
  try {
    const goalRow = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    db!.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
    if (goalRow) {
      try { episodeWriters.writeGoalEpisode({ id: goalId, title: goalRow.title || goalId, category: goalRow.category }, 'deleted'); } catch {}
      // Closes the emission hole: goals.goal.deleted was a live-advertised
      // trigger with no emitter. Same fire-and-forget contract as the write path.
      try {
        publishAutomationEvent('goals.goal.deleted', {
          id: goalId,
          title: String(goalRow.title || ''),
          category: String(goalRow.category || 'work'),
        }, { kind: 'goal', id: goalId });
      } catch { /* automation is never allowed to break the delete */ }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-goal-review', async (_event, date: string, reviewSummary: string) => {
  try {
    db!.prepare('INSERT OR REPLACE INTO goal_reviews (date, review_summary, created_at) VALUES (?, ?, datetime(\'now\'))')
      .run(date, reviewSummary);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-goal-review', async (_event, date: string) => {
  try {
    const row = db!.prepare('SELECT review_summary, created_at FROM goal_reviews WHERE date = ?').get(date) as any;
    return { success: true, review: row || null };
  } catch (err: any) {
    return { success: false, error: err.message, review: null };
  }
});

// ----------- Life Phases Timeline (The River of Years) -----------
function mapLifePhaseRow(r: any) {
  const parseArr = (raw: string): any[] => {
    try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const parseObj = (raw: string): any => {
    try { return JSON.parse(raw || 'null'); } catch { return null; }
  };
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    category: r.category || 'growth',
    startMonth: r.start_month,
    startYear: r.start_year,
    endMonth: r.end_month ?? null,
    endYear: r.end_year ?? null,
    magnitude: r.magnitude ?? 50,
    color: r.color || '#fbbf24',
    reflection: r.reflection || '',
    eraTrends: r.era_trends || '',
    impactNotes: r.impact_notes || '',
    milestones: parseArr(r.milestones),
    connections: parseArr(r.connections),
    // New fields
    people: parseArr(r.people),
    moodStart: r.mood_start ?? null,
    moodEnd: r.mood_end ?? null,
    moodTags: parseArr(r.mood_tags),
    feelingsNote: r.feelings_note || null,
    lessonsLearned: r.lessons_learned || null,
    headerImageMemoryId: r.header_image_memory_id || null,
    colorSource: r.color_source || 'category',
    reflectionSource: r.reflection_source || null,
    reflectionGeneratedAt: r.reflection_generated_at || null,
    status: r.status || 'complete',
    scale: r.scale ?? null,
    updatedAt: r.updated_at,
  };
}

const LIFE_PHASE_INSERT = `
  INSERT OR REPLACE INTO life_phases (id, title, description, category, start_month, start_year, end_month, end_year, magnitude, color, reflection, era_trends, impact_notes, milestones, connections, people, mood_start, mood_end, mood_tags, feelings_note, lessons_learned, header_image_memory_id, color_source, reflection_source, reflection_generated_at, status, scale, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`;

function upsertLifePhase(phase: any) {
  db!.prepare(LIFE_PHASE_INSERT).run(
    phase.id, phase.title, phase.description || '', phase.category || 'growth',
    phase.startMonth, phase.startYear, phase.endMonth ?? null, phase.endYear ?? null,
    phase.magnitude ?? 50, phase.color || '#fbbf24', phase.reflection || '',
    phase.eraTrends || '', phase.impactNotes || '',
    JSON.stringify(phase.milestones || []), JSON.stringify(phase.connections || []),
    JSON.stringify(phase.people || []), phase.moodStart ?? null, phase.moodEnd ?? null,
    JSON.stringify(phase.moodTags || []), phase.feelingsNote ?? null,
    phase.lessonsLearned ?? null, phase.headerImageMemoryId ?? null,
    phase.colorSource || 'category', phase.reflectionSource || null,
    phase.reflectionGeneratedAt || null, phase.status || 'complete',
    phase.scale ?? null,
  );
}

// One AI path for all three life-phase endpoints: provider chain, then OpenRouter fallback. No key ever reaches the renderer.
async function runLifePhaseAI(systemPrompt: string, userMsg: string, maxTokens = 400): Promise<string> {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'lifeAssistant') : [];
  if (chain.length > 0) {
    const { result } = await runWithFallback(chain, { systemPrompt, messages: [{ role: 'user', content: userMsg }], maxTokens, temperature: 0.7 });
    return result.content;
  }
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('No AI providers configured');
  const model = p.ai_briefModel || 'google/gemini-2.0-flash-001';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: maxTokens }),
    signal: AbortSignal.timeout(60000),
  });
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

ipcMain.handle('lifePhase:get', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM life_phases ORDER BY start_year ASC, start_month ASC').all() as any[];
    return { ok: true, data: rows.map(mapLifePhaseRow) };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:getSummary', async () => {
  try {
    const row = db!.prepare('SELECT value FROM life_timeline_meta WHERE key = ?').get('summary') as any;
    return { ok: true, data: row?.value || null };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:save', async (_event, phase: any) => {
  try {
    upsertLifePhase(phase);
    // Capture life phase episode into context brain
    try {
      const existing = db!.prepare('SELECT id FROM life_phases WHERE id = ?').get(phase.id) as any;
      episodeWriters.writeLifePhaseEpisode(phase, 'created');
    } catch {}
    const row = db!.prepare('SELECT * FROM life_phases WHERE id = ?').get(phase.id) as any;
    return { ok: true, data: row ? mapLifePhaseRow(row) : null };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:delete', async (_event, phaseId: string) => {
  try {
    db!.prepare('DELETE FROM life_phases WHERE id = ?').run(phaseId);
    const all = db!.prepare('SELECT id, connections FROM life_phases').all() as any[];
    for (const r of all) {
      let conns: string[] = [];
      try { conns = JSON.parse(r.connections || '[]'); } catch { /* keep empty */ }
      if (conns.includes(phaseId)) {
        db!.prepare('UPDATE life_phases SET connections = ? WHERE id = ?').run(JSON.stringify(conns.filter((c: string) => c !== phaseId)), r.id);
      }
    }
    try { episodeWriters.writeLifePhaseEpisode({ id: phaseId, title: `Deleted phase ${phaseId}`, category: 'general' }, 'updated'); } catch {}
    return { ok: true, data: null };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:saveAll', async (_event, phases: any[]) => {
  try {
    const tx = db!.transaction((items: any[]) => { for (const phase of items) upsertLifePhase(phase); });
    tx(Array.isArray(phases) ? phases : []);
    const rows = db!.prepare('SELECT * FROM life_phases ORDER BY start_year ASC, start_month ASC').all() as any[];
    return { ok: true, data: rows.map(mapLifePhaseRow) };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:aiEraTrends', async (_event, params: { startYear: number; endYear: number | null; title: string }) => {
  try {
    const { startYear, endYear, title } = params || {};
    const systemPrompt = 'You are a historian. Return strict JSON: {"world": [2 one-sentence items], "culture": [2], "field": [2]}. One sentence each, well-anchored facts only; if the years exceed your knowledge, say so generically rather than invent.';
    const userMsg = `Era: ${startYear} - ${endYear ?? 'now'} (chapter "${title || ''}").`;
    const content = await runLifePhaseAI(systemPrompt, userMsg, 350);
    return { ok: true, data: content };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('lifePhase:aiSummarize', async (_event, phases: any[]) => {
  try {
    const systemPrompt = 'You are a warm second-person narrator. Write ONE paragraph, at most 80 words, in second person ("you"), naming the current chapter and the direction of flow. Stats (counts/years) are computed in code - never invent numbers.';
    const userMsg = `My life phases: ${(phases || []).map((p: any) => `${p.title} (${p.category}, ${p.startMonth}/${p.startYear} -> ${p.endMonth ? `${p.endMonth}/${p.endYear}` : 'now'})`).join('; ') || '(none yet)'}`;
    const content = await runLifePhaseAI(systemPrompt, userMsg, 250);
    db!.prepare('INSERT OR REPLACE INTO life_timeline_meta (key, value) VALUES (?, ?)').run('summary', content);
    db!.prepare('INSERT OR REPLACE INTO life_timeline_meta (key, value) VALUES (?, ?)').run('summary.updatedAt', new Date().toISOString());
    return { ok: true, data: content };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

// Life Phases Overhaul — lessons framing assist (§10): returns 2–3 open questions, never answers.
ipcMain.handle('lifePhase:aiAssist', async (_event, params: { kind?: string; context?: any }) => {
  try {
    const { kind = 'lessons', context = {} } = params || {};
    const milestoneTxt = (context.milestones || []).map((m: any) => m.label).join('; ');
    const peopleTxt = (context.people || []).map((p: any) => p.name).join(', ');
    const systemPrompt = 'You are a thoughtful interviewer for someone writing their life story. Given a life phase context, generate 2-3 open-ended reflective questions that help the person articulate what this chapter taught them. Do NOT answer the questions. Do NOT invent facts. Each question must reference something specific from the context (a milestone, a person, a feeling). Return strict JSON: {"questions": ["...", "...", "..."]}.';
    const userMsg = `Chapter context — story: ${context.story || '(none)'}. Feelings: ${context.feelingsNote || '(none)'}. Milestones: ${milestoneTxt || '(none)'}. People: ${peopleTxt || '(none)'}.`;
    const content = await runLifePhaseAI(systemPrompt, userMsg, 300);
    let questions: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.questions)) questions = parsed.questions.slice(0, 3).map(String);
    } catch {
      questions = content.split(/\n+/).map(s => s.replace(/^[-•*\d.]+/, '').trim()).filter(Boolean).slice(0, 3);
    }
    return { ok: true, data: { questions } };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

// Life Phases Overhaul — Connection Points PeriodContext (§8.1): date-range aggregates over goals/focus/external/app usage.
ipcMain.handle('lifePhase:getPeriodContext', async (_event, params: { startDate: string; endDate: string }) => {
  try {
    const { startDate, endDate } = params || {};
    if (!startDate) return { ok: false, error: 'startDate is required' };
    const phaseStart = `${String(startDate).slice(0, 10)}`;
    const phaseEnd = endDate ? `${String(endDate).slice(0, 10)}` : new Date().toISOString().slice(0, 10);
    const startTs = `${phaseStart}T00:00:00`;
    const endTs = `${phaseEnd}T23:59:59`;

    // ── App Usage ──
    const appCatRows = db!.prepare(
      `SELECT category, COALESCE(SUM(duration_ms), 0) AS total_ms
       FROM logs WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_browser_tracking, 0) = 0
       GROUP BY category`
    ).all(startTs, endTs) as any[];
    const productiveMs = appCatRows.find((r: any) => r.category === 'productive')?.total_ms || 0;
    const distractingMs = appCatRows.find((r: any) => r.category === 'distracting')?.total_ms || 0;
    const neutralMs = appCatRows.find((r: any) => r.category === 'neutral')?.total_ms || 0;
    const externalMs = appCatRows.find((r: any) => r.category === 'external')?.total_ms || 0;
    const totalAppMs = productiveMs + distractingMs + neutralMs + externalMs;

    const appTopRows = db!.prepare(
      `SELECT app AS name, category, COALESCE(SUM(duration_ms), 0) AS total_ms
       FROM logs WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_browser_tracking, 0) = 0
       GROUP BY app, category ORDER BY total_ms DESC LIMIT 10`
    ).all(startTs, endTs) as any[];
    const topApps = appTopRows.map((r: any) => ({ name: r.name, totalMs: r.total_ms, category: r.category }));

    const hourlyRows = db!.prepare(
      `SELECT CAST(substr(timestamp, 12, 2) AS INTEGER) AS hour, COALESCE(SUM(duration_ms), 0) AS total_ms
       FROM logs WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_browser_tracking, 0) = 0
       GROUP BY hour ORDER BY hour`
    ).all(startTs, endTs) as any[];
    const hourly = hourlyRows.map((r: any) => ({ hour: r.hour, totalMs: r.total_ms }));

    const appUsage = totalAppMs > 0 ? { totalMs: totalAppMs, productiveMs, distractingMs, neutralMs, topApps, hourly } : null;

    // ── Browser Activity ──
    const browserRows = db!.prepare(
      `SELECT domain, COALESCE(SUM(total_sec), 0) AS total_sec, COALESCE(SUM(session_count), 0) AS sessions
       FROM browser_sessions WHERE date >= ? AND date <= ?
       GROUP BY domain ORDER BY total_sec DESC LIMIT 10`
    ).all(phaseStart, phaseEnd) as any[];
    const browserTotalMs = browserRows.reduce((s: number, r: any) => s + r.total_sec * 1000, 0);
    const browser = browserTotalMs > 0 ? {
      totalMs: browserTotalMs,
      topDomains: browserRows.map((r: any) => ({ domain: r.domain, totalMs: r.total_sec * 1000, category: 'unknown' as string }))
    } : null;

    // ── Focus Sessions ──
    const focusSessionRows = db!.prepare(
      `SELECT id, started_at, ended_at, COALESCE(actual_sec, 0) AS actual_sec, strictness
       FROM deep_focus_sessions WHERE started_at >= ? AND started_at <= ? AND status = 'completed'
       ORDER BY started_at`
    ).all(startTs, endTs) as any[];
    const focusTotalMs = focusSessionRows.reduce((s: number, r: any) => s + r.actual_sec * 1000, 0);
    const focusCount = focusSessionRows.length;
    const avgFocusMs = focusCount > 0 ? Math.round(focusTotalMs / focusCount) : 0;

    const strictMap: Record<string, { count: number; totalMs: number }> = {};
    for (const r of focusSessionRows) {
      const k = r.strictness || 'unknown';
      if (!strictMap[k]) strictMap[k] = { count: 0, totalMs: 0 };
      strictMap[k].count++;
      strictMap[k].totalMs += r.actual_sec * 1000;
    }
    const strictness = Object.entries(strictMap).map(([label, v]) => ({ label, count: v.count, totalMs: v.totalMs }));

    const focusGroupRows = db!.prepare(
      `SELECT fg.name, fg.color, COALESCE(SUM(dfs.actual_sec), 0) AS total_sec
       FROM focus_group_usage u
       JOIN deep_focus_sessions dfs ON dfs.id = u.session_id
       JOIN focus_groups fg ON fg.id = u.group_id
       WHERE dfs.started_at >= ? AND dfs.started_at <= ?
       GROUP BY fg.id HAVING total_sec > 0 ORDER BY total_sec DESC`
    ).all(startTs, endTs) as any[];
    const focusGroups = focusGroupRows.map((r: any) => ({ name: r.name, color: r.color, totalMs: r.total_sec * 1000 }));

    const focus = focusTotalMs > 0 ? { totalMs: focusTotalMs, sessionCount: focusCount, averageSessionMs: avgFocusMs, strictness, topApps: [], groups: focusGroups } : null;

    // ── Finance ──
    const finRows = db!.prepare(
      `SELECT type, COALESCE(SUM(amount), 0) AS total
       FROM finance_transactions WHERE date >= ? AND date <= ?
       GROUP BY type`
    ).all(phaseStart, phaseEnd) as any[];
    const incomeTotal = finRows.find((r: any) => r.type === 'income')?.total || 0;
    const expenseTotal = finRows.find((r: any) => r.type === 'expense')?.total || 0;
    const transferTotal = finRows.find((r: any) => r.type === 'transfer')?.total || 0;

    const finCatRows = db!.prepare(
      `SELECT fc.name AS label, ftx.type, COALESCE(SUM(ftx.amount), 0) AS total
       FROM finance_transactions ftx
       LEFT JOIN finance_categories fc ON fc.id = ftx.category_id
       WHERE ftx.date >= ? AND ftx.date <= ? AND ftx.type = 'expense'
       GROUP BY fc.name ORDER BY total DESC LIMIT 8`
    ).all(phaseStart, phaseEnd) as any[];
    const topCategories = finCatRows.map((r: any) => ({ categoryId: null, label: r.label || 'Uncategorized', total: r.total, type: r.type }));

    const finance = (incomeTotal > 0 || expenseTotal > 0) ? {
      incomeTotal, expenseTotal, transferTotal, net: incomeTotal - expenseTotal,
      currency: null as string | null, topCategories, walletDeltas: []
    } : null;

    // ── Subscriptions ──
    const subRows = db!.prepare(
      `SELECT id, name, amount, billing_cycle, category, status
       FROM finance_subscriptions WHERE status = 'active'`
    ).all() as any[];
    const activeSubs = subRows.filter((s: any) => {
      if (!s.amount) return false;
      return true;
    });
    const estimatedMonthlyBurn = activeSubs.reduce((s: number, r: any) => {
      const amt = r.amount || 0;
      if (r.billing_cycle === 'monthly') return s + amt;
      if (r.billing_cycle === 'yearly') return s + amt / 12;
      if (r.billing_cycle === 'weekly') return s + amt * 4.33;
      return s + amt;
    }, 0);
    const subscriptions = activeSubs.length > 0 ? {
      activeDuringPhase: activeSubs.map((r: any) => ({ id: r.id, name: r.name, amount: r.amount, billingCycle: r.billing_cycle, category: r.category, status: r.status })),
      estimatedMonthlyBurn
    } : null;

    // ── Sleep ──
    const sleepRows = db!.prepare(
      `SELECT started_at, ended_at, COALESCE(duration_seconds, 0) AS dur
       FROM external_sessions WHERE type = 'sleep' AND started_at >= ? AND started_at <= ?
       ORDER BY started_at`
    ).all(startTs, endTs) as any[];
    const sleepTotalMin = sleepRows.reduce((s: number, r: any) => s + Math.round(r.dur / 60), 0);
    const sleepCount = sleepRows.length;
    const sleepAvgMin = sleepCount > 0 ? Math.round(sleepTotalMin / sleepCount) : 0;
    const sleep = sleepCount > 0 ? {
      sessionCount: sleepCount, totalMinutes: sleepTotalMin, averageMinutes: sleepAvgMin,
      averageBedtime: null as string | null, averageWakeTime: null as string | null,
      consistencyScore: null as number | null,
      nightly: sleepRows.slice(0, 30).map((r: any) => ({ date: (r.started_at || '').slice(0, 10), startedAt: r.started_at, endedAt: r.ended_at, durationMinutes: Math.round(r.dur / 60) }))
    } : null;

    // ── AI Usage ──
    const aiRows = db!.prepare(
      `SELECT tool, model, COALESCE(SUM(input_tokens), 0) AS tokens_in, COALESCE(SUM(output_tokens), 0) AS tokens_out,
              COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS cnt
       FROM ai_usage WHERE date >= ? AND date <= ?
       GROUP BY tool, model ORDER BY cost DESC`
    ).all(phaseStart, phaseEnd) as any[];
    const aiTotalCost = aiRows.reduce((s: number, r: any) => s + r.cost, 0);
    const aiTotalTokensIn = aiRows.reduce((s: number, r: any) => s + r.tokens_in, 0);
    const aiTotalTokensOut = aiRows.reduce((s: number, r: any) => s + r.tokens_out, 0);
    const aiTotalReqs = aiRows.reduce((s: number, r: any) => s + r.cnt, 0);

    const toolMap: Record<string, { count: number; cost: number }> = {};
    const modelMap: Record<string, { count: number; cost: number }> = {};
    for (const r of aiRows) {
      if (!toolMap[r.tool]) toolMap[r.tool] = { count: 0, cost: 0 };
      toolMap[r.tool].count += r.cnt;
      toolMap[r.tool].cost += r.cost;
      if (r.model) {
        if (!modelMap[r.model]) modelMap[r.model] = { count: 0, cost: 0 };
        modelMap[r.model].count += r.cnt;
        modelMap[r.model].cost += r.cost;
      }
    }
    const ai = aiTotalReqs > 0 ? {
      totalRequests: aiTotalReqs, totalTokensIn: aiTotalTokensIn, totalTokensOut: aiTotalTokensOut, totalCost: aiTotalCost,
      topTools: Object.entries(toolMap).map(([tool, v]) => ({ tool, count: v.count, cost: v.cost })),
      topModels: Object.entries(modelMap).map(([model, v]) => ({ model, count: v.count, cost: v.cost }))
    } : null;

    // ── Code Activity ──
    const codeRows = db!.prepare(
      `SELECT file_path, workspace_path, COALESCE(SUM(lines_added), 0) AS added, COALESCE(SUM(lines_removed), 0) AS removed, COUNT(*) AS events
       FROM code_activity WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY file_path, workspace_path ORDER BY events DESC LIMIT 10`
    ).all(startTs, endTs) as any[];
    const codeTotalAdded = codeRows.reduce((s: number, r: any) => s + r.added, 0);
    const codeTotalRemoved = codeRows.reduce((s: number, r: any) => s + r.removed, 0);
    const codeTotalEvents = codeRows.reduce((s: number, r: any) => s + r.events, 0);
    const code = codeTotalEvents > 0 ? {
      totalEvents: codeTotalEvents, linesAdded: codeTotalAdded, linesRemoved: codeTotalRemoved,
      topFiles: codeRows.map((r: any) => ({ filePath: r.file_path, workspacePath: r.workspace_path, events: r.events, linesAdded: r.added, linesRemoved: r.removed })),
      topWorkspaces: []
    } : null;

    // ── IDE Projects ──
    const projectRows = db!.prepare(
      `SELECT id, name, path, detected_at, last_seen_at FROM projects ORDER BY last_seen_at DESC LIMIT 10`
    ).all() as any[];
    const activeProjects = projectRows.map((r: any) => ({ id: r.id, name: r.name, path: r.path, detectedAt: r.detected_at, lastSeenAt: r.last_seen_at }));
    const projects = activeProjects.length > 0 ? { activeProjects, aiUsageByProject: [] } : null;

    // ── Goals (manual counts) ──
    const goalRow = db!.prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM goals WHERE date >= ? AND date <= ?`
    ).get(phaseStart, phaseEnd) as any;

    return {
      ok: true,
      data: {
        range: { start: phaseStart, end: phaseEnd, isOngoing: !endDate },
        availability: { appUsage: !!appUsage, browser: !!browser, focus: !!focus, finance: !!finance, sleep: !!sleep, ai: !!ai, code: !!code, projects: !!projects, subscriptions: !!subscriptions },
        summary: {
          productiveMs, distractingMs, neutralMs,
          focusMs: focusTotalMs, focusSessionCount: focusCount,
          netFinance: finance?.net || 0, incomeTotal, expenseTotal,
          sleepAvgMinutes: sleepAvgMin, aiCost: aiTotalCost,
          codeLinesAdded: codeTotalAdded, codeLinesRemoved: codeTotalRemoved,
          memoryCount: 0, covenantCompletionCount: 0, goalCount: goalRow?.total || 0
        },
        appUsage, browser, focus, finance, subscriptions, sleep, ai, code, projects,
        goals: { completedCount: Number(goalRow?.done ?? 0), longTermGoalTitles: [] },
      },
    };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

// Life Phases Overhaul — AI reflection (§7): new payload, tone contract, confidence + variation regeneration.
ipcMain.handle('lifePhase:aiReflect', async (_event, params: any) => {
  try {
    const req = params || {};
    // Backward-compat: old shape { phase, answers: string[] }
    const legacy = !req.phaseId && req.phase;
    const phase = legacy ? req.phase : null;
    const answers = legacy ? (req.answers || []) : [];
    const title = legacy ? phase?.title : req.title;
    const category = legacy ? phase?.category : req.category;
    const story = legacy ? phase?.description : req.story;
    const milestones = legacy ? (phase?.milestones || []) : (req.milestones || []);
    const people = legacy ? (phase?.people || []) : (req.people || []);
    const feelingsNote = legacy ? null : req.feelingsNote;
    const lessonsLearned = legacy ? null : req.lessonsLearned;
    const impactNotes = legacy ? null : req.impactNotes;
    const moodStart = legacy ? null : req.moodStart;
    const moodEnd = legacy ? null : req.moodEnd;
    const moodTags = legacy ? [] : (req.moodTags || []);
    const periodContext = legacy ? null : (req.periodContext || null);
    const variation = req.variation || null;

    const milestoneTxt = milestones.map((m: any) => `${m.date || `${m.month}/${m.year}`} - ${m.label}${m.note ? ` (${m.note})` : ''}`).join('; ');
    const peopleTxt = people.map((p: any) => `${p.name}${p.role ? ` (${p.role})` : ''}`).join(', ');
    const contextSummary = periodContext
      ? `What I was doing then: ${periodContext.goals?.completedCount ?? 0} goals completed; focus groups ${(periodContext.focusGroups || []).map((f: any) => `${f.name} (${Math.round((f.totalMs || 0) / 3600000)}h)`).join(', ') || 'none'}; activities ${(periodContext.externalActivities || []).map((a: any) => `${a.label} (${Math.round((a.totalMs || 0) / 3600000)}h)`).join(', ') || 'none'}.`
      : '';
    const variationLine = variation ? `\nVariation request: ${variation}` : '';
    const systemPrompt = 'Write as a perceptive, warm friend who has read this person\'s own words about this chapter — not a corporate summary bot, not a therapist, not a hype machine. Reference specific things they wrote (a milestone, a person, a lesson). One tight paragraph, 60-120 words. Never invent facts, numbers, or events not present in the input. If mood data suggests hardship, acknowledge it honestly before naming what came out of it. First person, no clichés, no self-help tone. End with one sentence pointing toward what this chapter made possible next.' + variationLine;
    const userMsg = `Chapter: "${title || ''}" (${category || 'growth'}). Story: ${story || '(none)'}. Milestones: ${milestoneTxt || '(none)'}. People: ${peopleTxt || '(none)'}. Mood: start ${moodStart ?? 'n/a'}, end ${moodEnd ?? 'n/a'}${moodTags.length ? `, tags: ${moodTags.join(', ')}` : ''}. Feelings: ${feelingsNote || '(none)'}. Lessons: ${lessonsLearned || '(none)'}. Impact: ${impactNotes || '(none)'}.${legacy ? ` My three answers: 1) ${answers[0] || ''} 2) ${answers[1] || ''} 3) ${answers[2] || ''}` : ''} ${contextSummary}`;
    const content = await runLifePhaseAI(systemPrompt, userMsg, 350);

    // Groundedness heuristic: enough concrete input to write specifics.
    const signalLen = (story?.length || 0) + (milestones?.length || 0) * 40 + (people?.length || 0) * 30 + (lessonsLearned?.length || 0) + (feelingsNote?.length || 0);
    const confidence = signalLen >= 120 ? 'grounded' : 'sparse';

    return { ok: true, data: { reflection: content, confidence } };
  } catch (err: any) { return { ok: false, error: err.message }; }
});

ipcMain.handle('get-daily-reflection', async (_event, date: string) => {
  try {
    const productiveCategories = DEFAULT_TIER_ASSIGNMENTS.productive;
    const codingCategories = ['IDE', 'AI Tools'];

    const logRows = db!.prepare('SELECT category, duration_ms FROM logs WHERE date(timestamp) = ?').all(date) as any[];
    let productiveSec = 0;
    let codingSec = 0;
    for (const row of logRows) {
      if (row.duration_ms > 0 && productiveCategories.includes(row.category)) {
        productiveSec += Math.floor(row.duration_ms / 1000);
      }
      if (row.duration_ms > 0 && codingCategories.includes(row.category)) {
        codingSec += Math.floor(row.duration_ms / 1000);
      }
    }

    const goals = db!.prepare('SELECT title, status, is_habit FROM goals WHERE date = ?').all(date) as any[];
    const completedGoals = goals.filter(g => g.status === 'done');
    const habits = goals.filter(g => g.is_habit === 1);
    const completedHabits = habits.filter(g => g.status === 'done');

    const reviewRow = db!.prepare('SELECT review_summary FROM goal_reviews WHERE date = ?').get(date) as any;

    return {
      success: true,
      date,
      productiveSec,
      codingSec,
      goals: { total: goals.length, completed: completedGoals.length },
      habits: { total: habits.length, completed: completedHabits.length },
      reviewSummary: reviewRow?.review_summary || null,
    };
  } catch (err: any) {
    return { success: false, error: err.message, date };
  }
});

ipcMain.handle('save-goal-suggestion', async (_event, data: { title: string; category: string; date: string; source: string; reason?: string }) => {
  try {
    const id = require('crypto').randomUUID();
    db!.prepare('INSERT INTO goals (id, title, category, date, status, source, period, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(id, data.title, data.category, data.date, 'active', 'ai', 'daily');
    return { success: true, goal: { id, title: data.title, category: data.category, date: data.date, status: 'active', period: 'daily', source: 'ai' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ─── Goal Hierarchy IPC (parent_id decomposition) ──────────────────────

// parent_ids: JSON array of long-term goal ids (multi-parent daily goals).
// Falls back to [parent_id] for legacy rows; parent_id stays = first parent
// so get-child-goals / goal-hierarchy queries keep working.
function parseGoalParentIds(r: any): string[] {
  try {
    const p = JSON.parse(r.parent_ids || '[]');
    if (Array.isArray(p) && p.length) return p.map(String);
  } catch {}
  return r.parent_id ? [String(r.parent_id)] : [];
}

function goalParentIdsToColumns(g: any): { parentId: string | null; parentIdsJson: string } {
  const ids = Array.isArray(g.parentIds)
    ? g.parentIds.map(String)
    : (g.parent_id ? [String(g.parent_id)] : []);
  return { parentId: ids[0] || null, parentIdsJson: JSON.stringify(ids) };
}

ipcMain.handle('get-goal', async (_event, goalId: string) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    return {
      success: true,
      goal: {
        id: row.id, title: row.title, description: row.description,
        category: row.category, period: row.period, status: row.status,
        date: row.date, source: row.source, parent_id: row.parent_id,
        parentId: row.parent_id, parentIds: parseGoalParentIds(row),
        priority: row.priority, progressSeconds: row.progress_seconds,
        links: JSON.parse(row.links || '[]'),
        createdAt: row.created_at, completedAt: row.completed_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-child-goals', async (_event, parentId: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE parent_id = ? ORDER BY priority ASC, created_at ASC').all(parentId) as any[];
    return {
      success: true,
      children: rows.map((r: any) => ({
        id: r.id, title: r.title, description: r.description,
        category: r.category, period: r.period, status: r.status,
        date: r.date, source: r.source, parent_id: r.parent_id,
        parentId: r.parent_id, parentIds: parseGoalParentIds(r),
        priority: r.priority, progressSeconds: r.progress_seconds,
        links: JSON.parse(r.links || '[]'),
        createdAt: r.created_at, completedAt: r.completed_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, children: [] };
  }
});

ipcMain.handle('save-goals-batch', async (_event, goals: any[]) => {
  try {
    const txn = db!.transaction((items: any[]) => {
      for (const g of items) {
        // Same INSERT OR REPLACE column-loss defect as the single writer — this
        // one is worse, because the AI-assistant path calls it with partial
        // goal objects, so every batch import silently reset habit/cadence/
        // detection metadata on any row it touched. Now shares one upsert.
        g.id = ensureGoalId(g.id);
        upsertGoalRow(db!, g.id, g, {
          date: g.date || '2000-01-01',
          category: g.category || 'work',
          targetType: g.target?.type || 'custom',
          status: g.status || 'pending',
          period: g.period || 'daily',
          source: g.source || 'ai_assistant',
        });
      }
    });
    txn(goals);
    // Capture goal episodes into context brain (first 5 only to avoid spam)
    try {
      for (const g of (goals || []).slice(0, 5)) {
        episodeWriters.writeGoalEpisode(g, g.status === 'done' ? 'completed' : 'created');
      }
    } catch {}
    return { success: true, count: goals.length, ids: (goals || []).map((g: any) => g.id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('link-goal-to-entity', async (_event, goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    const links = JSON.parse(row.links || '[]');
    links.push(link);
    db!.prepare('UPDATE goals SET links = ? WHERE id = ?').run(JSON.stringify(links), goalId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('unlink-goal-from-entity', async (_event, goalId: string, type: 'problem' | 'request', entityId: string) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    const links = JSON.parse(row.links || '[]').filter((l: any) => !(l.type === type && l.id === entityId));
    db!.prepare('UPDATE goals SET links = ? WHERE id = ?').run(JSON.stringify(links), goalId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// --- Daily Goal Progress & Timeline IPC ---------------------------------------

ipcMain.handle('get-daily-goal-progress', async (_event, date: string, goals: any[]) => {
  try {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD.');
    }
    if (!Array.isArray(goals)) return {};

    const timeBasedGoals = goals.filter(
      (g: any) => g?.target?.type === 'time' && typeof g?.target?.matchCategory === 'string' && g.target.matchCategory.length > 0
    );

    if (timeBasedGoals.length === 0) return {};

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const fgGoals = timeBasedGoals.filter((g: any) => String(g.target?.matchCategory || '').toLowerCase().startsWith('fg:'));
    const logGoals = timeBasedGoals.filter((g: any) => !String(g.target?.matchCategory || '').toLowerCase().startsWith('fg:'));

    // Focus-group goals: sum completed focus sessions attributed to the group (local day).
    const fgSeconds: Record<number, number> = {};
    if (fgGoals.length > 0) {
      for (const goal of fgGoals) {
        const gid = parseInt(String(goal.target?.matchCategory).slice(3), 10);
        if (!gid || fgSeconds[gid] !== undefined) continue;
        try {
          const row = db!.prepare(`
            SELECT COALESCE(SUM(dfs.actual_sec), 0) AS total
            FROM focus_group_usage u
            JOIN deep_focus_sessions dfs ON dfs.id = u.session_id
            WHERE u.group_id = ? AND dfs.outcome = 'completed'
              AND dfs.started_at >= ? AND dfs.started_at <= ?
          `).get(gid, `${date}T00:00:00`, `${date}T23:59:59`) as any;
          fgSeconds[gid] = Number(row?.total) || 0;
        } catch {
          fgSeconds[gid] = 0;
        }
      }
    }

    // App-category goals: sum logs.category seconds (UTC day window, like before).
    const categorySeconds: Record<string, number> = {};
    if (logGoals.length > 0) {
      const rows = db!.prepare(`
        SELECT category, duration_ms
        FROM logs
        WHERE timestamp >= ? AND timestamp <= ?
      `).all(startOfDay, endOfDay) as Array<{ category: string; duration_ms: number }>;
      for (const row of rows) {
        const cat = (row.category || 'uncategorized').toLowerCase();
        const sec = Math.floor((row.duration_ms || 0) / 1000);
        categorySeconds[cat] = (categorySeconds[cat] || 0) + sec;
      }
    }

    const result: Record<string, { goalId: string; progressSeconds: number; targetSeconds: number; percentComplete: number; status: string }> = {};

    for (const goal of timeBasedGoals) {
      const matchCat = (goal.target?.matchCategory || '').toLowerCase();
      let progressSec = 0;
      if (matchCat.startsWith('fg:')) {
        progressSec = fgSeconds[parseInt(matchCat.slice(3), 10)] || 0;
      } else {
        progressSec = categorySeconds[matchCat] || 0;
      }
      const targetSec = Math.min(Math.max(Number(goal.target?.targetSeconds) || 3600, 1), 86400);
      const pct = Math.min(100, Math.round((progressSec / targetSec) * 100));

      result[goal.id] = {
        goalId: goal.id,
        progressSeconds: progressSec,
        targetSeconds: targetSec,
        percentComplete: pct,
        status: pct >= 100 ? 'completed' : progressSec > 0 ? 'active' : 'pending',
      };
    }

    return result;
  } catch (err: any) {
    return {};
  }
});

ipcMain.handle('get-goal-timeline', async (_event, date: string) => {
  try {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD.');
    }

    const dayOfWeek = new Date(date).getDay();
    const schedule = db!.prepare(`
      SELECT id, title, location, day_of_week, start_time, end_time, category, color
      FROM schedule_entries
      WHERE day_of_week = ? AND is_recurring = 1
      ORDER BY start_time
    `).all(dayOfWeek) as Array<{
      id: string; title: string; location: string | null;
      day_of_week: number; start_time: string; end_time: string;
      category: string; color: string;
    }>;

    const goals = db!.prepare(`
      SELECT id, title, category, target_type, target_seconds, match_category, progress_seconds, status
      FROM goals
      WHERE date = ? AND status IN ('pending', 'active', 'completed')
    `).all(date) as Array<{
      id: string; title: string; category: string;
      target_type: string; target_seconds: number | null;
      match_category: string | null; progress_seconds: number | null;
      status: string;
    }>;

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const logRows = db!.prepare(`
      SELECT category, duration_ms
      FROM logs
      WHERE timestamp >= ? AND timestamp <= ?
    `).all(startOfDay, endOfDay) as Array<{ category: string; duration_ms: number }>;

    const categorySeconds: Record<string, number> = {};
    for (const row of logRows) {
      const cat = (row.category || 'uncategorized').toLowerCase();
      const sec = Math.floor((row.duration_ms || 0) / 1000);
      categorySeconds[cat] = (categorySeconds[cat] || 0) + sec;
    }

    // Focus-group goals: completed focus-session seconds per group (local day).
    const fgSeconds: Record<number, number> = {};
    const fgIds = [...new Set(
      goals
        .filter(g => g.target_type === 'time' && (g.match_category || '').toLowerCase().startsWith('fg:'))
        .map(g => parseInt(String(g.match_category).slice(3), 10))
        .filter(Boolean),
    )];
    for (const gid of fgIds) {
      try {
        const row = db!.prepare(`
          SELECT COALESCE(SUM(dfs.actual_sec), 0) AS total
          FROM focus_group_usage u
          JOIN deep_focus_sessions dfs ON dfs.id = u.session_id
          WHERE u.group_id = ? AND dfs.outcome = 'completed'
            AND dfs.started_at >= ? AND dfs.started_at <= ?
        `).get(gid, `${date}T00:00:00`, `${date}T23:59:59`) as any;
        fgSeconds[gid] = Number(row?.total) || 0;
      } catch {
        fgSeconds[gid] = 0;
      }
    }

    const timelineGoals = goals.map(g => {
      const matchCat = (g.match_category || '').toLowerCase();
      let progressSec: number;
      if (g.target_type === 'time') {
        if (matchCat.startsWith('fg:')) {
          progressSec = (fgSeconds[parseInt(matchCat.slice(3), 10)] || 0) + (g.progress_seconds || 0);
        } else {
          progressSec = (categorySeconds[matchCat] || 0) + (g.progress_seconds || 0);
        }
      } else {
        progressSec = (g.progress_seconds || 0);
      }
      const targetSec = Math.min(Math.max(Number(g.target_seconds) || 3600, 1), 86400);
      const pct = g.target_type === 'time'
        ? Math.min(100, Math.round((progressSec / targetSec) * 100))
        : g.status === 'completed' ? 100 : 0;

      return {
        id: g.id, title: g.title, category: g.category,
        targetType: g.target_type, matchCategory: g.match_category,
        progressSeconds: progressSec, targetSeconds: targetSec,
        percentComplete: pct, status: g.status,
      };
    });

    return {
      schedule: schedule.map(s => ({
        id: s.id, title: s.title, location: s.location,
        dayOfWeek: s.day_of_week, startTime: s.start_time,
        endTime: s.end_time, category: s.category, color: s.color,
      })),
      goals: timelineGoals,
    };
  } catch (err: any) {
    return { schedule: [], goals: [] };
  }
});

// --- Reminders IPC -----------------------------------------------------------

// ═══════════════════ habit completions ═══════════════════
//
// THE SPLIT BRAIN THIS REPLACES. A habit's DEFINITION has always lived in
// SQLite (`goals.is_habit = 1`), but the act of completing one lived in the
// `deskflow.covenant.completions.v1` localStorage key
// (src/features/covenant/storage.ts). Two stores, one concept. The
// localStorage half is unsynced, absent from every database backup, and
// destroyed by a Chromium profile reset — while the definition survives, so the
// habit came back empty and the streak silently read zero.
//
// This is the real home. `migrate-legacy-habit-completions` moves the old rows
// across once; until that is called the readers below UNION the two sources, so
// nothing is lost and nothing has to happen in a specific order.

/** The minimum-day threshold that applied on a given day, in minutes. */
const DEFAULT_MINIMUM_MINUTES = 20;

function habitMinimumMinutes(userPreferences: Record<string, any>): number {
  const n = Number(userPreferences?.training_minimum_day_minutes);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MINIMUM_MINUTES;
}

ipcMain.handle('habit-completions:list', async (_event, startDate: string, endDate: string) => {
  try {
    const rows = db!.prepare(
      `SELECT habit_id, date, minutes, met_minimum, source, completed_at
         FROM habit_completions
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC, completed_at ASC`
    ).all(startDate, endDate) as any[];
    return {
      success: true,
      completions: rows.map((r) => ({
        habitId: r.habit_id, date: r.date, minutes: r.minutes,
        metMinimum: !!r.met_minimum, source: r.source, completedAt: r.completed_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, completions: [] };
  }
});

/**
 * Record (or clear) one habit-day.
 *
 * `met_minimum` is DECIDED HERE and stored, not derived at read time: whether a
 * bad day "counted" must be settled against the threshold that was in force on
 * that day, not re-computed later against a threshold that may have changed.
 * That is the whole point of the minimum-day rule — a 10-minute day still keeps
 * the habit alive, and it must keep having kept it alive even if CZ later edits
 * the minimum to 30.
 *
 * Idempotent: re-posting the same habit+date updates in place rather than
 * accumulating rows (the table also enforces UNIQUE(habit_id, date)).
 */
ipcMain.handle('habit-completions:set', async (_event, payload: {
  habitId: string; date: string; minutes?: number; done?: boolean; source?: string;
}) => {
  try {
    const { habitId, date } = payload || ({} as any);
    if (!habitId || !date) return { success: false, error: 'habitId and date are required' };

    if (payload.done === false) {
      db!.prepare('DELETE FROM habit_completions WHERE habit_id = ? AND date = ?').run(habitId, date);
      return { success: true, done: false };
    }

    const minutes = Math.max(0, Math.round(Number(payload.minutes ?? habitMinimumMinutes(userPreferences))));
    const met = minutes >= habitMinimumMinutes(userPreferences) ? 1 : 0;
    db!.prepare(
      `INSERT INTO habit_completions (id, habit_id, date, minutes, met_minimum, source, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET
         minutes      = excluded.minutes,
         met_minimum  = excluded.met_minimum,
         source       = excluded.source,
         completed_at = excluded.completed_at`
    ).run(
      `hc_${habitId}_${date}`, habitId, date, minutes, met,
      payload.source || 'manual', new Date().toISOString()
    );
    return { success: true, done: true, minutes, metMinimum: !!met };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/**
 * The weekly score — feature 4's headline number.
 *
 * Deliberately NOT a streak. A streak is a single bad day from zero, and that is
 * the mechanic that kills trackers. Here the unit is the WEEK: count the days
 * that counted, compare to a threshold (default 5 of 7), and report. A 4/7 week
 * that misses the bar is still visibly a 4, not a zero.
 *
 * Monday-anchored, from src/lib/week.ts — this replaces a third competing anchor.
 */
ipcMain.handle('habit-completions:weekly', async (_event, weekOf: string) => {
  try {
    // `src/infrastructure/ipc/` → `src/lib` is `../../`, not `../../../`. esbuild did
    // not catch the bad path because a dynamic `require()` is left alone at bundle time;
    // the scoped `tsc` run did.
        const days = weekDays(weekOf);
    const start = days[0];
    const end = days[6];

    const rows = db!.prepare(
      `SELECT date, met_minimum FROM habit_completions WHERE date BETWEEN ? AND ?`
    ).all(start, end) as any[];

    // Two counts, because they answer different questions and the plan uses both:
    //  · countedDays — any day with a completion. This is the SCORE.
    //  · qualifiedDays — only days that met the minimum. A 10-minute day keeps
    //    the habit alive (it is in countedDays) but is visibly flagged as a
    //    minimum day rather than a full one.
    const countedDates = rows.map((r) => r.date);
    const qualifiedDates = rows.filter((r) => r.met_minimum).map((r) => r.date);
    const counted = daysActiveInWeek(weekOf, countedDates);
    const qualified = daysActiveInWeek(weekOf, qualifiedDates);

    const target = Number(userPreferences?.training_weekly_win_days);
    const winTarget = Number.isFinite(target) && target > 0 ? Math.min(7, target) : 5;

    return {
      success: true,
      weekOf, weekKey: isoWeekKey(weekOf), start, end, days,
      countedDays: counted,
      qualifiedDays: qualified,
      winTarget,
      isWin: counted >= winTarget,
      minimumMinutes: habitMinimumMinutes(userPreferences),
      completions: rows.map((r) => ({ date: r.date, metMinimum: !!r.met_minimum })),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/**
 * Move legacy localStorage completions into the table, once.
 *
 * Caller passes the raw localStorage payload because the renderer is the only
 * process that can read it. Idempotent via the table's UNIQUE(habit_id, date):
 * running it twice cannot double-count.
 */
ipcMain.handle('habit-completions:migrate-legacy', async (_event, legacy: Array<{
  commitmentId: string; date: string; completedAt?: number; source?: string;
}>) => {
  try {
    const minimum = habitMinimumMinutes(userPreferences);
    let migrated = 0, skipped = 0;
    const stmt = db!.prepare(
      `INSERT INTO habit_completions (id, habit_id, date, minutes, met_minimum, source, completed_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(habit_id, date) DO NOTHING`
    );
    const tx = db!.transaction((items: any[]) => {
      for (const it of items) {
        if (!it?.commitmentId || !it?.date) { skipped++; continue; }
        const res = stmt.run(
          `hc_${it.commitmentId}_${it.date}`, String(it.commitmentId), String(it.date),
          // A legacy completion has no duration. It counted, so it is recorded as
          // meeting the minimum rather than silently demoted to a half-day.
          minimum, it.source === 'detected' ? 'detected' : 'migrated',
          it.completedAt ? new Date(it.completedAt).toISOString() : new Date().toISOString()
        );
        res.changes ? migrated++ : skipped++;
      }
    });
    tx(Array.isArray(legacy) ? legacy : []);
    return { success: true, migrated, skipped };
  } catch (err: any) {
    return { success: false, error: err.message, migrated: 0, skipped: 0 };
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// THE TRAINING LOG — features 1, 3, 5, 6, 7
// ═══════════════════════════════════════════════════════════════════════════
//
// Every handler here follows ONE rule: `parse` never writes, `commit` writes once.
// That split is what makes "show a diff before applying, never apply silently"
// implementable at all — there is no code path from a pasted AI reply to the
// database that skips a review step, because the write lives behind a channel
// the paste path never calls.

// NOTE: today is `getLocalDateStr()`, the dep the main process already injects
// (src/main.ts:635). An earlier revision of this file defined a second,
// byte-identical `trainDateStr` beside it. Two definitions of "today, in the
// user's timezone" is precisely how a UTC bug comes back after someone fixes the
// other one — so the duplicate is gone and every call site uses the injected one.
function shiftDateStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return getLocalDateStr(d);
}
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ── F1 · capture ───────────────────────────────────────────────────────── */

// FEATURE 1, and the one rule that makes the feature true: this handler NEVER
// writes. It returns an interpretation plus the ambiguities the parser could not
// settle. The UI shows those as editable, amber-flagged fields, and the human
// presses Enter. Auto-filling is the promise; auto-saving is the failure mode.
ipcMain.handle('capture:parse', async (_event, payload: {
  text: string;
  nowMinutes?: number;
  /** Passed in by the RENDERER, which already holds the live foreground app from
   *  `getCurrentForeground()` / the tracking heartbeat. An earlier version tried
   *  to read it here and reached for `globalThis.deskflowAPI`, which does not
   *  exist in the main process — so it silently returned null forever. The
   *  renderer is the process that actually knows; asking it costs nothing. */
  foreground?: { app?: string; category?: string } | null;
}) => {
  try {
    const text = String(payload?.text ?? '');
    const now = Number.isFinite(payload?.nowMinutes)
      ? (payload!.nowMinutes as number)
      : new Date().getHours() * 60 + new Date().getMinutes();
    const parsed = parseCaptureLine(text, now);

    // Offered as a default the user can correct, never applied behind their back.
    const fg = payload?.foreground;
    const foreground = fg?.app ? { app: String(fg.app), category: String(fg.category || 'other') } : null;

    return { success: true, parsed, foreground, canCommit: !parsed.empty };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// F1 commit. ONE transaction, and the time row goes into `logs` with
// `source='manual'` rather than a side table — which is deliberate: the two
// `AFTER INSERT` triggers on `logs` feed stats_hourly/stats_daily/app_totals, so
// a captured session shows up in every existing chart with no query change. That
// is the same reasoning the original manual-fill path used.
ipcMain.handle('capture:commit', async (_event, payload: {
  date?: string; count?: number | null; minutes?: number | null; pattern?: string | null;
  result?: string | null; platform?: string; topic?: string; app?: string | null; category?: string | null;
}) => {
  try {
    const date = payload?.date || getLocalDateStr(new Date());
    const minutes = Number.isFinite(payload?.minutes) ? Math.max(0, Math.round(payload!.minutes as number)) : 0;
    const count = Number.isFinite(payload?.count) ? Math.max(0, Math.round(payload!.count as number)) : 1;
    const result = payload?.result || null;
    const title = (payload?.topic || '').trim() || `${count} problem${count === 1 ? '' : 's'}`;

    const tx = db!.transaction(() => {
      let logId: string | null = null;
      if (minutes > 0) {
        logId = uid('cap_log');
        db!.prepare(
          `INSERT INTO logs (timestamp, app, category, duration_ms, title, is_browser_tracking, source)
           VALUES (?, ?, ?, ?, ?, 0, 'manual')`
        ).run(
          `${date} 12:00:00`,
          payload?.app || 'Manual entry',
          payload?.category || 'other',
          minutes * 60_000,
          `Captured: ${title}`,
        );
      }
      const outcomeId = uid('out');
      db!.prepare(
        `INSERT INTO training_outcomes (id, date, kind, title, count, cold, pattern, minutes, app, source)
         VALUES (?, ?, 'problem_solved', ?, ?, ?, ?, ?, ?, 'capture')`
      ).run(outcomeId, date, title, count, result === 'solved' ? 1 : 0, payload?.pattern || null, minutes || null, payload?.app || null);

      // F3: a COLD solve enters the spaced-repetition queue immediately. A
      // partial or stuck solve does NOT — re-reading something you could not
      // finish teaches nothing, and it would flood the queue with exactly the
      // items CZ has least appetite for.
      let cardId: string | null = null;
      if (result === 'solved') {
        cardId = uid('card');
        const next = scheduleCard(
          { id: cardId, pattern: payload?.pattern || '', title, due: null, reps: 0, lapses: 0, scheduledDays: 0 },
          'recalled', date,
        );
        db!.prepare(
          `INSERT INTO training_cards (id, pattern, title, due, reps, lapses, scheduled_days, source_outcome)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?)`
        ).run(cardId, payload?.pattern || null, title, next.due, next.scheduledDays, outcomeId);
      }
      return { logId, outcomeId, cardId };
    });

    const ids = tx();
    // Tell the calendar to refresh so the dot appears on the right day without a
    // manual reload. Previously a todo added in TodoList never reached the wall
    // for exactly this reason.
    try { mainWindow?.webContents?.send('training:changed', { date }); } catch { /* window may be gone */ }
    return { success: true, ...ids };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F3 · outcomes and the queue ────────────────────────────────────────── */

ipcMain.handle('training:outcomes:list', async (_event, startDate: string, endDate: string) => {
  try {
    const rows = db!.prepare(
      `SELECT id, date, kind, title, count, cold, pattern, minutes, app, source, notes, created_at
         FROM training_outcomes WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC LIMIT 500`
    ).all(startDate, endDate) as any[];
    return {
      success: true,
      outcomes: rows.map((r) => ({
        id: r.id, date: r.date, kind: r.kind, title: r.title, count: r.count,
        // `cold` is a tri-state in the UI: solved cold / solved with help / not applicable.
        cold: r.cold === null ? null : !!r.cold,
        pattern: r.pattern, minutes: r.minutes, app: r.app, source: r.source, notes: r.notes,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, outcomes: [] };
  }
});

ipcMain.handle('training:cards:due', async (_event, today?: string) => {
  try {
    const date = today || getLocalDateStr(new Date());
    const rows = db!.prepare('SELECT * FROM training_cards ORDER BY due IS NULL DESC, due ASC').all() as any[];
    const cards: SrsCard[] = rows.map((r) => ({
      id: r.id, pattern: r.pattern || '', title: r.title, due: r.due,
      reps: r.reps, lapses: r.lapses, scheduledDays: r.scheduled_days,
    }));
    const due = dueCards(cards, date, 20);
    return {
      success: true,
      today: date,
      cards: due.map((c) => ({ ...c, hint: nextDueHint(c.due, date) })),
      total: cards.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message, cards: [] };
  }
});

// Every review writes BOTH the derived card state and an immutable log row, so
// the schedule can always be rebuilt from training_reviews alone.
ipcMain.handle('training:cards:review', async (_event, payload: { cardId: string; rating: Rating; today?: string }) => {
  try {
    const date = payload?.today || getLocalDateStr(new Date());
    const row = db!.prepare('SELECT * FROM training_cards WHERE id = ?').get(payload?.cardId) as any;
    if (!row) return { success: false, error: 'That card no longer exists. Refresh the queue.' };

    const card: SrsCard = {
      id: row.id, pattern: row.pattern || '', title: row.title, due: row.due,
      reps: row.reps, lapses: row.lapses, scheduledDays: row.scheduled_days,
    };
    const decision = scheduleCard(card, payload!.rating, date);
    const lapses = card.lapses + (payload!.rating === 'forgotten' ? 1 : 0);

    const tx = db!.transaction(() => {
      db!.prepare(
        'UPDATE training_cards SET due = ?, reps = reps + 1, lapses = ?, scheduled_days = ? WHERE id = ?'
      ).run(decision.due, lapses, decision.scheduledDays, card.id);
      db!.prepare(
        `INSERT INTO training_reviews (card_id, rating, review_date, scheduled_days, elapsed_days, weakened)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        card.id, payload!.rating, date, decision.scheduledDays,
        card.due ? Math.max(0, Math.round((new Date(date + 'T00:00:00').getTime() - new Date(card.due + 'T00:00:00').getTime()) / 86_400_000)) : 0,
        decision.weakened ? 1 : 0,
      );
    });
    tx();
    return { success: true, ...decision };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F4 · the weekly score ──────────────────────────────────────────────── */

ipcMain.handle('training:week:score', async (_event, weekOf: string) => {
  try {
        const days = weekDays(weekOf);
    const rows = db!.prepare(
      'SELECT date, minutes, met_minimum FROM habit_completions WHERE date BETWEEN ? AND ?'
    ).all(days[0], days[6]) as any[];
    const marks: DayMark[] = rows.map((r) => ({ date: r.date, minutes: r.minutes, metMinimum: !!r.met_minimum }));
    const score = computeWeeklyScore(weekOf, marks, {
      minimumMinutes: habitMinimumMinutes(userPreferences),
      winDays: Number(userPreferences?.training_weekly_win_days) || undefined,
    });
    return { success: true, score, copy: describeWeeklyScore(score) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F6 · the Sunday review, cached so it never recomputes on repaint ────── */

ipcMain.handle('training:review:weekly', async (_event, weekOf: string) => {
  try {
        const weekKey = isoWeekKey(weekOf);
    const days = weekDays(weekOf);

    const cached = db!.prepare('SELECT * FROM weekly_reviews WHERE week_key = ?').get(weekKey) as any;
    if (cached) {
      try {
        return { success: true, cached: true, review: JSON.parse(cached.stats_json), accepted: !!cached.proposal_accepted };
      } catch { /* fall through and rebuild */ }
    }

    // One batched read per table, not one per row. The DatabasePage precedent
    // records that the previous fan-out was ~206 serial IPC hops; a weekly
    // digest must not reintroduce that shape inside a single handler.
    const planned = db!.prepare(
      `SELECT id, title, date, status, is_habit FROM goals WHERE date BETWEEN ? AND ?`
    ).all(days[0], days[6]) as any[];

    const habitIds = [...new Set(planned.filter((g) => g.is_habit).map((g) => g.id))];
    const completions = db!.prepare(
      'SELECT habit_id, date FROM habit_completions WHERE date BETWEEN ? AND ?'
    ).all(days[0], days[6]) as any[];

    const habitMisses: Record<string, string[]> = {};
    for (const id of habitIds) {
      const hit = new Set(completions.filter((c) => c.habit_id === id).map((c) => c.date));
      habitMisses[id] = days.filter((d) => !hit.has(d));
    }

    const logs = db!.prepare(
      `SELECT substr(timestamp, 1, 10) AS d, SUM(duration_ms) AS ms
         FROM logs WHERE substr(timestamp, 1, 10) BETWEEN ? AND ? GROUP BY d`
    ).all(days[0], days[6]) as any[];
    const minsByDay = new Map(logs.map((l) => [l.d, Math.round((l.ms || 0) / 60000)]));
    const totalMinutesByDay = days.map((d) => minsByDay.get(d) ?? 0);

    const dueCardsRows = db!.prepare(
      `SELECT COUNT(*) n FROM training_cards WHERE due IS NOT NULL AND due < ? AND due >= ?`
    ).get(weekKey ? days[0] : days[0], days[6]) as any;

    const review = buildWeeklyReview({
      weekOf,
      planned: planned.map((g) => ({ id: g.id, title: g.title, date: g.date, done: g.status === 'done', isHabit: !!g.is_habit })),
      habitIdsTracked: habitIds,
      habitMisses,
      // New-topic minutes are not separately tracked yet; until they are, treat
      // the whole week as review time so the drift proposal cannot fire on an
      // absence of data. Better a missed suggestion than a wrong one.
      newMinutesByDay: days.map(() => 0),
      totalMinutesByDay,
      queueMissed: dueCardsRows?.n || 0,
    });

    db!.prepare(
      `INSERT OR REPLACE INTO weekly_reviews
         (week_key, planned, done, most_skipped_habit, proposal, proposal_why, headline, all_clear, status, stats_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, datetime('now'))`
    ).run(
      review.weekKey, review.planned, review.done, review.mostSkippedHabit?.id || null,
      review.proposal?.text || null, review.proposal?.why || null, review.headline,
      review.allClear ? 1 : 0, JSON.stringify(review),
    );

    return { success: true, cached: false, review, accepted: false };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('training:review:accept', async (_event, payload: { weekKey: string; text?: string }) => {
  try {
    db!.prepare(
      `UPDATE weekly_reviews SET proposal_accepted = 1,
         proposal = COALESCE(?, proposal), created_at = datetime('now')
       WHERE week_key = ?`
    ).run(payload?.text || null, payload?.weekKey);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F5 · phases ────────────────────────────────────────────────────────── */

ipcMain.handle('training:phase:current', async (_event) => {
  try {
        const today = getLocalDateStr(new Date());
    const phase = db!.prepare(
      `SELECT id, title, training_mode, daily_checklist_json, review_floor_minutes, plan_mode_armed
         FROM life_phases
        WHERE COALESCE(start_date, '') <= ? AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
        ORDER BY start_date DESC LIMIT 1`
    ).get(today, today) as any;

    const mode: TrainingMode = phase?.training_mode === 'burn_down' ? 'burn_down' : 'learn';
    const rules = PHASE_RULES[mode];

    // Drift is DETECTED here but ANSWERED in the renderer. The handler returns
    // the question, never an action — that is the feature's requirement, and it
    // is also why this handler cannot flip a phase by itself.
    let question: unknown = null;
    if (phase) {
      const week = weekDays(today);
      const answered = db!.prepare(
        'SELECT answer, ask_again_after FROM phase_drift_answers WHERE week_key = ? ORDER BY id DESC LIMIT 1'
      ).get(isoWeekKey(today)) as any;
      const silenced = answered && (answered.answer === 'no'
        || (answered.ask_again_after && answered.ask_again_after > today));

      if (!silenced) {
        const logs = db!.prepare(
          `SELECT substr(timestamp,1,10) AS d, SUM(duration_ms) AS ms FROM logs
            WHERE substr(timestamp,1,10) BETWEEN ? AND ? GROUP BY d`
        ).all(week[0], week[6]) as any[];
        const byDay = new Map(logs.map((l) => [l.d, Math.round((l.ms || 0) / 60000)]));
        const total = week.map((d) => byDay.get(d) ?? 0);
        const drift = detectDrift({
          days: week,
          newMinutesByDay: week.map(() => 0),
          totalMinutesByDay: total,
          currentMode: mode,
        });
        if (drift.drifting) question = driftQuestion(drift.reason);
      }
    }

    return {
      success: true,
      phase: phase ? {
        id: phase.id, title: phase.title, mode,
        checklist: safeJson(phase.daily_checklist_json, []),
        reviewFloorMinutes: phase.review_floor_minutes ?? rules.reviewFloorMinutes,
        planModeArmed: !!phase.plan_mode_armed,
      } : null,
      rules,
      label: phaseLabel(mode),
      summary: phaseChangeSummary(mode),
      driftQuestion: question,
      cooldownDays: DRIFT_COOLDOWN_DAYS,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('training:phase:set-mode', async (_event, payload: { phaseId: string; mode: TrainingMode; checklist?: unknown[] }) => {
  try {
    const mode = payload?.mode === 'burn_down' ? 'burn_down' : 'learn';
    // The checklist SWAPS with the mode. That is the feature: flipping a phase
    // has to change what the day asks for, or "set the rules" is just a label.
    const checklist = Array.isArray(payload?.checklist) ? payload!.checklist : defaultChecklist(mode);
    db!.prepare('UPDATE life_phases SET training_mode = ?, daily_checklist_json = ? WHERE id = ?')
      .run(mode, JSON.stringify(checklist), payload?.phaseId);
    return { success: true, mode, checklist, summary: phaseChangeSummary(mode) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/** The two default checklists. Deliberately short — a checklist you do not finish
 *  teaches you to ignore it, and the point is to be done, not to be thorough. */
function defaultChecklist(mode: TrainingMode): string[] {
  return mode === 'burn_down'
    ? ['Clear the review queue', 'Finish what is already open', 'No new topics']
    : ['One review pass', 'Up to two new problems', 'Note what you got stuck on'];
}

function safeJson<T>(raw: unknown, fallback: T): T {
  try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return (v ?? fallback) as T; }
  catch { return fallback; }
}

ipcMain.handle('training:phase:answer-drift', async (_event, payload: { answer: 'yes' | 'not_now' | 'no'; reason?: string }) => {
  try {
        const today = getLocalDateStr(new Date());
    const again = payload?.answer === 'no'
      ? '9999-12-31'                                  // never for this phase
      : payload?.answer === 'not_now' ? shiftDateStr(today, DRIFT_COOLDOWN_DAYS) : today;
    db!.prepare(
      'INSERT INTO phase_drift_answers (phase_id, week_key, answer, reason, ask_again_after) VALUES (?, ?, ?, ?, ?)'
    ).run(null, isoWeekKey(today), payload?.answer || 'not_now', payload?.reason || null, again);
    return { success: true, askAgainAfter: again };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F7 · plan mode ─────────────────────────────────────────────────────── */

ipcMain.handle('planmode:status', async (_event, payload: { coreIds?: string[]; doneIds?: string[] }) => {
  try {
    const today = getLocalDateStr(new Date());
    const phase = db!.prepare(
      `SELECT id, plan_mode_armed FROM life_phases
        WHERE COALESCE(start_date,'') <= ? AND (end_date IS NULL OR end_date='' OR end_date >= ?)
        ORDER BY start_date DESC LIMIT 1`
    ).get(today, today) as any;

    const verdict = evaluatePlanMode({
      // Only ever armed if CZ armed it. A guard that activates by itself is
      // indistinguishable from a bug.
      armed: !!phase?.plan_mode_armed,
      coreIds: payload?.coreIds ?? [],
      doneIds: payload?.doneIds ?? [],
    });

    const breaks = db!.prepare(
      `SELECT COUNT(*) n FROM plan_mode_events WHERE date >= date('now','-6 days') AND kind = 'broke'`
    ).get() as any;

    return { success: true, verdict, breaksThisWeek: breaks?.n || 0, warning: breakWarning(breaks?.n || 0) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// The break writes a row. THAT is the feature: the rule exists to make editing
// something you remember doing, and Sunday's review names it. A rule that only
// blocks gets deleted.
ipcMain.handle('planmode:break', async (_event, payload: { phrase: string; outstanding?: number }) => {
  try {
    const accepted = String(payload?.phrase || '').trim().toLowerCase() === BREAK_PHRASE;
    if (!accepted) {
      return { success: false, error: `Type "${BREAK_PHRASE}" exactly to confirm.` };
    }
    const today = getLocalDateStr(new Date());
    const phase = db!.prepare(
      `SELECT id FROM life_phases WHERE COALESCE(start_date,'') <= ? AND (end_date IS NULL OR end_date='' OR end_date >= ?) ORDER BY start_date DESC LIMIT 1`
    ).get(today, today) as any;
    db!.prepare(
      'INSERT INTO plan_mode_events (date, phase_id, kind, outstanding, confirmation_ok) VALUES (?, ?, ?, ?, 1)'
    ).run(today, phase?.id || null, 'broke', payload?.outstanding || 0);
    const n = db!.prepare(
      `SELECT COUNT(*) n FROM plan_mode_events WHERE date >= date('now','-6 days') AND kind='broke'`
    ).get() as any;
    return { success: true, breaksThisWeek: n?.n || 0, warning: breakWarning(n?.n || 0) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/* ── F2 · the AI plan: prepare (never writes) and commit (writes once) ──── */

// `training:plan:prepare` is the DIFF step. It parses, validates and diffs, and
// it has no write path at all — so there is no version of "paste the AI's reply"
// that can reach the database without a human reading the summary first.
ipcMain.handle('training:plan:prepare', async (_event, payload: { raw: string }) => {
  try {
    const prepared = preparePlanReply(String(payload?.raw ?? ''));
    return {
      success: true,
      ok: prepared.report.ok,
      report: prepared.report,
      diff: prepared.diff,
      repairPrompt: prepared.repairPrompt,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// The prompt the user copies OUT. It carries the schema explicitly, because the
// gateway transport is Playwright DOM-scraping of the provider's web UI — there
// is no `response_format` / `json_schema` channel reachable through it, so the
// schema has to live in the prompt text.
ipcMain.handle('training:plan:prompt', async (_event) => {
    return {
    success: true,
    prompt: [
      'Return ONE JSON object and nothing else. No prose, no markdown fence, no commentary.',
      '',
      'Shape:',
      JSON.stringify({
        schemaVersion: PLAN_SCHEMA_VERSION,
        tasks: [{ title: 'string', dueInDays: 0, priority: 'low', pattern: 'string' }],
        outcomes: [{ kind: 'problem_solved', title: 'string', count: 1, cold: true, pattern: 'string' }],
        deadlineMoves: [{ title: 'string', shiftDays: 0 }],
      }, null, 2),
      '',
      `priority: low | medium | high`,
      `kind: problem_solved | pr_opened | pr_merged | contest`,
      `pattern (optional, must be exactly one of): ${PATTERN_VOCABULARY.join(', ')}`,
      'dueInDays and shiftDays are NUMBERS of days, never date strings.',
      'Every array may be empty if you have nothing to add.',
    ].join('\n'),
  };
});

// Commit runs ONLY after the user has read the diff and pressed apply. It is a
// single transaction so a partial plan cannot land.
ipcMain.handle('training:plan:commit', async (_event, payload: { raw: string }) => {
  try {
    const prepared = preparePlanReply(String(payload?.raw ?? ''));
    if (!prepared.report.ok) {
      // Refusing here is the point. An invalid plan must never half-apply.
      return { success: false, error: 'That plan still has errors. Use the repair prompt first.', issues: prepared.report.issues };
    }
    const plan = prepared.report.plan!;
    const today = getLocalDateStr(new Date());
    const tx = db!.transaction(() => {
      let tasks = 0, outcomes = 0, moved = 0;
      for (const t of plan.tasks) {
        if (!t.title?.trim()) continue;
        db!.prepare(
          `INSERT OR REPLACE INTO goals (id, date, title, category, target_type, status, period, source, links, progress_seconds, priority)
           VALUES (?, ?, ?, 'learning', 'completion', 'active', 'daily', 'ai', '[]', 0, ?)`
        ).run(uid('goal'), shiftDateStr(today, Math.max(0, Math.round(t.dueInDays || 0))), t.title.trim(), t.priority === 'high' ? 2 : t.priority === 'medium' ? 1 : 0);
        tasks++;
      }
      for (const o of plan.outcomes) {
        if (!o.title?.trim()) continue;
        db!.prepare(
          `INSERT INTO training_outcomes (id, date, kind, title, count, cold, pattern, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'import')`
        ).run(uid('out'), today, o.kind, o.title.trim(), o.count || 1, typeof o.cold === 'boolean' ? (o.cold ? 1 : 0) : null, o.pattern || null);
        outcomes++;
      }
      for (const m of plan.deadlineMoves) {
        if (!m.title?.trim() || !m.shiftDays) continue;
        const row = db!.prepare(
          `SELECT id FROM deadlines WHERE title = ? ORDER BY due_date ASC LIMIT 1`
        ).get(m.title.trim()) as any;
        if (!row) continue;                        // a move with no match is skipped, not guessed at
        db!.prepare(`UPDATE deadlines SET due_date = ? WHERE id = ?`).run(shiftDateStr(today, m.shiftDays), row.id);
        moved++;
      }
      return { tasks, outcomes, moved };
    });
    const applied = tx();
    try { mainWindow?.webContents?.send('training:changed', { date: today }); } catch { /* ignore */ }
    return { success: true, applied };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-reminders', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM reminders ORDER BY created_at ASC').all() as any[];
    return { success: true, reminders: rows.map(r => ({ ...r, done: !!r.done })) };
  } catch (err: any) {
    return { success: false, error: err.message, reminders: [] };
  }
});

ipcMain.handle('create-reminder', async (_event, data: {
  text: string;
  due_date?: string; dueDate?: string;
  goal_id?: string;  goalId?: string;
  due_time?: string; dueTime?: string;
  reminder_lead_min?: number;
  description?: string;
  links?: string; // JSON array of {label, url}
  location?: string;
}) => {
  try {
    const id = 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    // Accept BOTH casings. This handler has always been declared snake_case,
    // which makes it the only snake_case channel among the goal/todo handlers
    // (every sibling is camelCase). `HabitsPage.tsx:530` therefore calls it
    // with `{ text, dueDate }` and the date was silently dropped — every
    // reminder created from the Habits page landed with a NULL due date and so
    // never appeared on the calendar. Rather than flip this one channel's
    // signature (other callers already send snake_case), read either.
    const rawDueDate = data.due_date ?? data.dueDate;
    const rawGoalId = data.goal_id ?? data.goalId;
    const rawTimeIn = data.due_time ?? data.dueTime;
    // reminder_lead_min: minutes before due date/time to remind. 0 = at event.
    const rawLead = data.reminder_lead_min ?? 0;
    const leadMin = Number.isInteger(rawLead) && rawLead >= 0 ? rawLead : 0;
    // description / links / location
    const description = String(data.description || '').trim();
    let linksJson = '[]';
    if (data.links) {
      try { linksJson = typeof data.links === 'string' ? data.links : JSON.stringify(data.links); } catch { linksJson = '[]'; }
    }
    const location = String(data.location || '').trim();
    // Normalize any ISO timestamp to a YYYY-MM-DD date so the calendar grid
    // (which keys by date) and daysUntil() line up. Raw timestamps previously
    // produced NaN counts and never landed on the calendar.
    const normDate = rawDueDate ? String(rawDueDate).slice(0, 10) : null;
    // due_time is its own HH:mm column rather than being folded into due_date,
    // so the date-keyed calendar grid keeps working while a time-of-day shows.
    const rawTime = String(rawTimeIn || '').trim();
    const normTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime)
      ? rawTime.split(':').map((n: string) => n.padStart(2, '0')).join(':')
      : null;
    db!.prepare('INSERT INTO reminders (id, text, due_date, goal_id, done, due_time, reminder_lead_min, description, links, location) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)').run(
      id, data.text, normDate, rawGoalId || null, normTime, leadMin, description, linksJson, location,
    );
    // Capture deadline episode into context brain
    try {
      episodeWriters.writeDeadlineEpisode({ id, title: data.text, due_date: normDate || 'no date', course: undefined }, 'created');
    } catch {}
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('toggle-reminder', async (_event, id: string, done: boolean) => {
  try {
    db!.prepare('UPDATE reminders SET done = ? WHERE id = ?').run(done ? 1 : 0, id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-reminder', async (_event, id: string) => {
  try {
    db!.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-reminder', async (_event, id: string, data: {
  text?: string;
  due_date?: string; dueDate?: string;
  goal_id?: string; goalId?: string;
  due_time?: string; dueTime?: string;
  reminder_lead_min?: number;
  description?: string;
  links?: string;
  location?: string;
  done?: boolean;
}) => {
  try {
    const row = db!.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    if (!row) return { success: false, error: 'Reminder not found' };

    const updates: string[] = [];
    const params: any[] = [];

    if (data.text !== undefined) { updates.push('text = ?'); params.push(data.text); }
    if (data.due_date !== undefined || data.dueDate !== undefined) {
      const rawDue = data.due_date ?? data.dueDate;
      const normDate = rawDue ? String(rawDue).slice(0, 10) : null;
      updates.push('due_date = ?'); params.push(normDate);
    }
    if (data.goal_id !== undefined || data.goalId !== undefined) {
      const rawGoal = data.goal_id ?? data.goalId;
      updates.push('goal_id = ?'); params.push(rawGoal || null);
    }
    if (data.due_time !== undefined || data.dueTime !== undefined) {
      const rawTimeIn = data.due_time ?? data.dueTime;
      const rawTime = String(rawTimeIn || '').trim();
      const normTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime)
        ? rawTime.split(':').map((n: string) => n.padStart(2, '0')).join(':')
        : null;
      updates.push('due_time = ?'); params.push(normTime);
    }
    if (data.reminder_lead_min !== undefined) {
      const rawLead = data.reminder_lead_min;
      const leadMin = Number.isInteger(rawLead) && rawLead >= 0 ? rawLead : 0;
      updates.push('reminder_lead_min = ?'); params.push(leadMin);
    }
    if (data.description !== undefined) {
      updates.push('description = ?'); params.push(String(data.description || '').trim());
    }
    if (data.links !== undefined) {
      let linksJson = '[]';
      try { linksJson = typeof data.links === 'string' ? data.links : JSON.stringify(data.links); } catch {}
      updates.push('links = ?'); params.push(linksJson);
    }
    if (data.location !== undefined) {
      updates.push('location = ?'); params.push(String(data.location || '').trim());
    }
    if (data.done !== undefined) {
      updates.push('done = ?'); params.push(data.done ? 1 : 0);
    }

    if (updates.length === 0) return { success: true, id };

    params.push(id);
    db!.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// --- Notes IPC -----------------------------------------------------------------------
ipcMain.handle('notes:list', async (_event, params?: { search?: string; tag?: string; group?: string; includeDrafts?: boolean; upcomingDeadlines?: boolean }) => {
  try {
    let sql = 'SELECT * FROM notes';
    const conditions: string[] = [];
    const args: any[] = [];
    if (params?.search) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      args.push(`%${params.search}%`, `%${params.search}%`);
    }
    if (params?.tag) {
      conditions.push('tags LIKE ?');
      args.push(`%"${params.tag}"%`);
    }
    if (params?.group) {
      conditions.push('group_name = ?');
      args.push(params.group);
    }
    if (!params?.includeDrafts) {
      conditions.push('COALESCE(is_draft, 0) = 0');
    }
    if (params?.upcomingDeadlines) {
      conditions.push('deadline IS NOT NULL AND deadline != \'\'');
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    const rows = db!.prepare(sql).all(...args) as any[];
    return {
      success: true,
      notes: rows.map(r => ({
        ...r,
        tags: (() => { try { return JSON.parse(r.tags || '[]'); } catch { return []; } })(),
        tag_colors: (() => { try { return r.tag_colors ? JSON.parse(r.tag_colors) : null; } catch { return null; } })(),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, notes: [] };
  }
});

ipcMain.handle('notes:create', async (_event, data: { title?: string; content: string; tags?: string[]; group_name?: string; group_color?: string | null; tag_colors?: Record<string, string> | null; deadline?: string; deadline_time?: string; reminder?: string; is_draft?: number; links?: string[] }) => {
  try {
    const id = 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    db!.prepare('INSERT INTO notes (id, title, content, tags, group_name, group_color, tag_colors, deadline, deadline_time, reminder, is_draft, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, data.title || '', data.content, JSON.stringify(data.tags || []), data.group_name || '',
      data.group_color || null, data.tag_colors ? JSON.stringify(data.tag_colors) : null,
      data.deadline || null, data.deadline_time || null, data.reminder || 'none', data.is_draft || 0,
      JSON.stringify(data.links || []),
    );
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes:update', async (_event, data: { id: string; title?: string; content?: string; tags?: string[]; group_name?: string; group_color?: string | null; tag_colors?: Record<string, string> | null; deadline?: string | null; deadline_time?: string | null; reminder?: string; is_draft?: number; status?: string; links?: string[] }) => {
  try {
    const sets: string[] = [];
    const args: any[] = [];
    if (data.title !== undefined) { sets.push('title = ?'); args.push(data.title); }
    if (data.content !== undefined) { sets.push('content = ?'); args.push(data.content); }
    if (data.tags !== undefined) { sets.push('tags = ?'); args.push(JSON.stringify(data.tags)); }
    if (data.group_name !== undefined) { sets.push('group_name = ?'); args.push(data.group_name); }
    if (data.group_color !== undefined) { sets.push('group_color = ?'); args.push(data.group_color); }
    if (data.tag_colors !== undefined) { sets.push('tag_colors = ?'); args.push(JSON.stringify(data.tag_colors)); }
    if (data.deadline !== undefined) { sets.push('deadline = ?'); args.push(data.deadline); }
    if (data.deadline_time !== undefined) { sets.push('deadline_time = ?'); args.push(data.deadline_time); }
    if (data.reminder !== undefined) { sets.push('reminder = ?'); args.push(data.reminder); }
    if (data.is_draft !== undefined) { sets.push('is_draft = ?'); args.push(data.is_draft); }
    if (data.status !== undefined) { sets.push('status = ?'); args.push(data.status); }
    if (data.links !== undefined) { sets.push('links = ?'); args.push(JSON.stringify(data.links)); }
    if (sets.length === 0) return { success: true };
    sets.push("updated_at = datetime('now')");
    args.push(data.id);
    db!.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes:delete', async (_event, id: string) => {
  try {
    db!.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes:groups', async () => {
  try {
    const rows = db!.prepare('SELECT DISTINCT group_name FROM notes WHERE group_name != \'\' ORDER BY group_name').all() as any[];
    return { success: true, groups: rows.map(r => r.group_name) };
  } catch (err: any) {
    return { success: false, error: err.message, groups: [] };
  }
});

// --- Schedule Parser IPC -----------------------------------------------------------
ipcMain.handle('parse-schedule', async (_event, input: string) => {
  try {
    const { parseScheduleInput } = require('../lib/scheduleParser');
    return parseScheduleInput(input);
  } catch { return null; }
});

ipcMain.handle('parse-deadline', async (_event, input: string) => {
  try {
    const { parseDeadlineInput } = require('../lib/scheduleParser');
    return parseDeadlineInput(input);
  } catch { return null; }
});

// --- Schedule IPC -----------------------------------------------------------
ipcMain.handle('todo:list', async (_event, opts?: { goalId?: string; deadlineId?: string; scheduleId?: string; parentTodoId?: string; limit?: number }) => {
  try {
    const where: string[] = [];
    const args: any[] = [];
    for (const [key, column] of [['goalId', 'goal_id'], ['deadlineId', 'deadline_id'], ['scheduleId', 'schedule_id'], ['parentTodoId', 'parent_todo_id']] as const) {
      const value = opts?.[key];
      if (value) { where.push(`${column} = ?`); args.push(value); }
    }
    const limit = Math.min(Math.max(Number(opts?.limit) || 500, 1), 1000);
    const rows = db!.prepare(`SELECT * FROM todos ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY done ASC, sort_order ASC, created_at ASC LIMIT ?`).all(...args, limit) as any[];
    return { success: true, todos: rows.map(row => ({
      id: row.id, text: row.text, done: !!row.done, goalId: row.goal_id, scheduleId: row.schedule_id,
      parentTodoId: row.parent_todo_id, deadlineId: row.deadline_id, dueDate: row.due_date,
      reminder: row.reminder || 'none', sortOrder: row.sort_order || 0, createdAt: row.created_at, completedAt: row.completed_at,
      groupId: row.group_id,
      goalTitle: row.goal_id ? (db!.prepare('SELECT title, is_habit FROM goals WHERE id = ?').get(row.goal_id) as any) : null,
      deadlineTitle: row.deadline_id ? (db!.prepare('SELECT title, due_date FROM deadlines WHERE id = ?').get(row.deadline_id) as any) : null,
      scheduleTitle: row.schedule_id ? (db!.prepare('SELECT title, start_time, end_time FROM schedule_entries WHERE id = ?').get(row.schedule_id) as any) : null,
    })) };
  } catch (err: any) { return { success: false, error: String(err?.message || err), todos: [] }; }
});

ipcMain.handle('todo:create', async (_event, data: any) => {
  try {
    const parents = [data.goalId, data.scheduleId, data.parentTodoId].filter(Boolean);
    if (parents.length > 1) return { success: false, error: 'A todo can have only one hierarchy parent' };
    const id = 'todo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    db!.prepare(`INSERT INTO todos (id, text, goal_id, schedule_id, parent_todo_id, deadline_id, due_date, reminder, sort_order, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, String(data.text || '').trim(), data.goalId || null, data.scheduleId || null, data.parentTodoId || null, data.deadlineId || null, data.dueDate || null, data.reminder || 'none', Number(data.sortOrder) || 0, data.groupId || null);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todo:update', async (_event, id: string, patch: any) => {
  try {
    const current = db!.prepare('SELECT goal_id, schedule_id, parent_todo_id FROM todos WHERE id = ?').get(id) as any;
    if (!current) return { success: false, error: 'Todo not found' };
    const next = { ...current, ...patch };
    if ([next.goalId ?? next.goal_id, next.scheduleId ?? next.schedule_id, next.parentTodoId ?? next.parent_todo_id].filter(Boolean).length > 1) return { success: false, error: 'A todo can have only one hierarchy parent' };
    const map: Record<string, string> = { text: 'text', done: 'done', goalId: 'goal_id', scheduleId: 'schedule_id', parentTodoId: 'parent_todo_id', deadlineId: 'deadline_id', dueDate: 'due_date', reminder: 'reminder', sortOrder: 'sort_order', groupId: 'group_id' };
    const fields = Object.keys(patch).filter(key => map[key]);
    if (!fields.length) return { success: true };
    const values = fields.map(key => patch[key] ?? null);
    db!.prepare(`UPDATE todos SET ${fields.map(key => `${map[key]} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todo:toggle', async (_event, id: string, done?: boolean) => {
  try {
    const row = db!.prepare('SELECT done FROM todos WHERE id = ?').get(id) as any;
    if (!row) return { success: false, error: 'Todo not found' };
    const next = typeof done === 'boolean' ? done : !row.done;
    const completedAt = next ? new Date().toISOString() : null;
    db!.prepare('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?').run(next ? 1 : 0, completedAt, id);
    return { success: true, completedAt };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todo:delete', async (_event, id: string) => {
  try {
    const orphaned = (db!.prepare('SELECT COUNT(*) AS c FROM todos WHERE parent_todo_id = ?').get(id) as any)?.c || 0;
    db!.prepare('UPDATE todos SET parent_todo_id = NULL WHERE parent_todo_id = ?').run(id);
    db!.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return { success: true, orphaned: Number(orphaned) };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

/* ── Todo Groups ────────────────────────────────────────────────────────────── */

ipcMain.handle('todoGroup:list', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM todo_groups ORDER BY sort_order ASC, created_at ASC').all() as any[];
    return { success: true, groups: rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
    })) };
  } catch (err: any) { return { success: false, error: String(err?.message || err), groups: [] }; }
});

ipcMain.handle('todoGroup:create', async (_event, data: { name: string; color?: string; sortOrder?: number }) => {
  try {
    const id = 'tg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const maxSort = (db!.prepare('SELECT MAX(sort_order) AS m FROM todo_groups').get() as any)?.m || 0;
    db!.prepare('INSERT INTO todo_groups (id, name, color, sort_order) VALUES (?, ?, ?, ?)')
      .run(id, String(data.name || '').trim(), data.color || null, typeof data.sortOrder === 'number' ? data.sortOrder : maxSort + 1);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todoGroup:update', async (_event, id: string, patch: { name?: string; color?: string; sortOrder?: number }) => {
  try {
    const current = db!.prepare('SELECT * FROM todo_groups WHERE id = ?').get(id) as any;
    if (!current) return { success: false, error: 'Group not found' };
    const fields = [];
    const values = [];
    if (patch.name !== undefined) { fields.push('name = ?'); values.push(String(patch.name).trim()); }
    if (patch.color !== undefined) { fields.push('color = ?'); values.push(patch.color || null); }
    if (patch.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(Number(patch.sortOrder)); }
    if (!fields.length) return { success: true };
    values.push(id);
    db!.prepare(`UPDATE todo_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todoGroup:delete', async (_event, id: string) => {
  try {
    // Clear group_id from todos in this group
    db!.prepare('UPDATE todos SET group_id = NULL WHERE group_id = ?').run(id);
    db!.prepare('DELETE FROM todo_groups WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

/* ── Schedule Activity Series ──────────────────────────────────────────────── */

ipcMain.handle('scheduleActivity:listSeries', async (_event, opts?: { range?: 'month' | 'semester' | 'all'; includeArchived?: boolean; category?: string; semesterStart?: string; semesterEnd?: string }) => {
  try {
    const { range = 'all', includeArchived = false, category, semesterStart, semesterEnd } = opts || {};
    const where: string[] = [];
    const args: any[] = [];

    // Base query for series (distinct series_id)
    if (!includeArchived) {
      where.push('(archived IS NULL OR archived = 0)');
    }
    if (category) {
      where.push('category = ?');
      args.push(category);
    }

    let seriesQuery = `
      SELECT series_id, MAX(id) as sample_id
      FROM schedule_entries
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      AND series_id IS NOT NULL
      GROUP BY series_id
    `;

    const seriesRows = db!.prepare(seriesQuery).all(...args) as any[];

    // For each series, get all sessions
    const series = [];
    for (const s of seriesRows) {
      const sessions = db!.prepare(`
        SELECT * FROM schedule_entries
        WHERE series_id = ?
        ORDER BY day_of_week, start_time
      `).all(s.series_id) as any[];

      if (sessions.length === 0) continue;

      const first = sessions[0];
      const seriesData = {
        seriesId: s.series_id,
        title: first.title,
        category: first.category,
        sessions: sessions.map(row => ({
          id: row.id,
          dayOfWeek: row.day_of_week,
          startTime: row.start_time,
          endTime: row.end_time,
          exceptions: JSON.parse(row.exceptions || '[]'),
          location: row.location,
          instructor: row.instructor,
        })),
        startDate: first.start_date,
        endDate: first.end_date,
        location: first.location,
        instructor: first.instructor,
        linkedPhaseId: first.linked_phase_id,
        linkedGoalIds: JSON.parse(first.linked_goal_ids || '[]'),
        notes: '', // could be added later
        archived: !!first.archived,
        createdAt: first.created_at,
        updatedAt: first.created_at, // no updated_at column yet
      };

      // Filter by range
      let include = true;
      if (range === 'month') {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const hasOccurrence = sessions.some(sess => {
          const sessDate = new Date(sess.start_date || '2000-01-01');
          return sessDate >= monthStart && sessDate <= monthEnd;
        });
        include = hasOccurrence;
      } else if (range === 'semester' && semesterStart && semesterEnd) {
        const semStart = new Date(semesterStart);
        const semEnd = new Date(semesterEnd);
        const hasOccurrence = sessions.some(sess => {
          const sessDate = new Date(sess.start_date || '2000-01-01');
          return sessDate >= semStart && sessDate <= semEnd;
        });
        include = hasOccurrence;
      }

      if (include) {
        series.push(seriesData);
      }
    }

    // Sort by title
    series.sort((a, b) => a.title.localeCompare(b.title));

    return { success: true, series };
  } catch (err: any) { return { success: false, error: String(err?.message || err), series: [] }; }
});

ipcMain.handle('scheduleActivity:getSeries', async (_event, seriesId: string) => {
  try {
    const sessions = db!.prepare(`
      SELECT * FROM schedule_entries
      WHERE series_id = ?
      ORDER BY day_of_week, start_time
    `).all(seriesId) as any[];

    if (sessions.length === 0) {
      return { success: false, error: 'Series not found' };
    }

    const first = sessions[0];
    return {
      success: true,
      series: {
        seriesId,
        title: first.title,
        category: first.category,
        sessions: sessions.map(row => ({
          id: row.id,
          dayOfWeek: row.day_of_week,
          startTime: row.start_time,
          endTime: row.end_time,
          exceptions: JSON.parse(row.exceptions || '[]'),
          location: row.location,
          instructor: row.instructor,
        })),
        startDate: first.start_date,
        endDate: first.end_date,
        location: first.location,
        instructor: first.instructor,
        linkedPhaseId: first.linked_phase_id,
        linkedGoalIds: JSON.parse(first.linked_goal_ids || '[]'),
        archived: !!first.archived,
        createdAt: first.created_at,
        updatedAt: first.created_at,
      }
    };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:createSeries', async (_event, data: any) => {
  try {
    const { title, category, sessions, startDate, endDate, location, instructor, linkedPhaseId, linkedGoalIds } = data;
    if (!title?.trim() || !sessions?.length) {
      return { success: false, error: 'Title and at least one session are required' };
    }

    const seriesId = 'ser_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();

    const insertStmt = db!.prepare(`
      INSERT INTO schedule_entries (id, series_id, title, category, day_of_week, start_time, end_time, location, instructor, start_date, end_date, linked_phase_id, linked_goal_ids, exceptions, archived, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db!.transaction((sessions: any[]) => {
      sessions.forEach(sess => {
        const id = 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        insertStmt.run(
          id,
          seriesId,
          title.trim(),
          category,
          sess.dayOfWeek,
          sess.startTime,
          sess.endTime,
          location || null,
          instructor || null,
          startDate,
          endDate || null,
          linkedPhaseId || null,
          JSON.stringify(linkedGoalIds || []),
          JSON.stringify([]), // exceptions
          0, // archived
          now
        );
      });
    });

    tx(sessions);

    return { success: true, seriesId };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:updateSeries', async (_event, seriesId: string, patch: any) => {
  try {
    const current = db!.prepare('SELECT * FROM schedule_entries WHERE series_id = ?').all(seriesId) as any[];
    if (!current.length) return { success: false, error: 'Series not found' };

    const fields = [];
    const values = [];

    const allowed = {
      title: 'title',
      category: 'category',
      startDate: 'start_date',
      endDate: 'end_date',
      location: 'location',
      instructor: 'instructor',
      linkedPhaseId: 'linked_phase_id',
      linkedGoalIds: 'linked_goal_ids',
    };

    for (const [key, column] of Object.entries(allowed)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(key === 'linkedGoalIds' ? JSON.stringify(patch[key]) : patch[key]);
      }
    }

    // Handle session updates (days/times) - these are per-row, not series-wide
    if (patch.sessions && Array.isArray(patch.sessions)) {
      // For simplicity, delete and re-insert sessions (preserving exceptions)
      const oldSessions = db!.prepare('SELECT id, exceptions FROM schedule_entries WHERE series_id = ?').all(seriesId) as any[];
      const exceptionMap = new Map(oldSessions.map(s => [s.id, s.exceptions]));

      db!.prepare('DELETE FROM schedule_entries WHERE series_id = ?').run(seriesId);

      const insertStmt = db!.prepare(`
        INSERT INTO schedule_entries (id, series_id, title, category, day_of_week, start_time, end_time, location, instructor, start_date, end_date, linked_phase_id, linked_goal_ids, exceptions, archived, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const tx = db!.transaction((sessions: any[]) => {
        sessions.forEach((sess, idx) => {
          const id = 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          const oldId = oldSessions[idx]?.id;
          insertStmt.run(
            id,
            seriesId,
            patch.title?.trim() || current[0].title,
            patch.category || current[0].category,
            sess.dayOfWeek,
            sess.startTime,
            sess.endTime,
            patch.location ?? current[0].location,
            patch.instructor ?? current[0].instructor,
            patch.startDate ?? current[0].start_date,
            patch.endDate ?? current[0].end_date,
            patch.linkedPhaseId ?? current[0].linked_phase_id,
            JSON.stringify(patch.linkedGoalIds ?? JSON.parse(current[0].linked_goal_ids || '[]')),
            exceptionMap.get(oldId) || '[]',
            current[0].archived || 0,
            current[0].created_at
          );
        });
      });
      tx(patch.sessions);
    } else if (fields.length) {
      // Series-wide update
      db!.prepare(`UPDATE schedule_entries SET ${fields.join(', ')} WHERE series_id = ?`).run(...values, seriesId);
    }

    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:deleteSeries', async (_event, seriesId: string, hard = false) => {
  try {
    if (hard) {
      db!.prepare('DELETE FROM schedule_entries WHERE series_id = ?').run(seriesId);
    } else {
      db!.prepare('UPDATE schedule_entries SET archived = 1 WHERE series_id = ?').run(seriesId);
    }
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:skipOccurrence', async (_event, sessionId: string, date: string) => {
  try {
    const row = db!.prepare('SELECT exceptions FROM schedule_entries WHERE id = ?').get(sessionId) as any;
    if (!row) return { success: false, error: 'Session not found' };

    const exceptions = JSON.parse(row.exceptions || '[]');
    if (!exceptions.includes(date)) {
      exceptions.push(date);
      exceptions.sort();
      db!.prepare('UPDATE schedule_entries SET exceptions = ? WHERE id = ?').run(JSON.stringify(exceptions), sessionId);
    }
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:endSeries', async (_event, seriesId: string, endDate: string) => {
  try {
    db!.prepare('UPDATE schedule_entries SET end_date = ?, archived = 1 WHERE series_id = ?').run(endDate, seriesId);
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:setSemester', async (_event, data: { name: string; startDate: string; endDate: string }) => {
  try {
    const api = (global as any).deskflowAPI || {};
    // Use the same settings storage as schedule layout
    await api?.compositionsSettingsSet?.('schedule:semester', JSON.stringify(data));
    return { success: true };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('scheduleActivity:getSemester', async () => {
  try {
    const api = (global as any).deskflowAPI || {};
    const res = await api?.compositionsSettingsGet?.('schedule:semester');
    if (res) return { success: true, semester: JSON.parse(res) };
    return { success: true, semester: null };
  } catch (err: any) { return { success: false, error: String(err?.message || err), semester: null }; }
});

ipcMain.handle('todo:get-connections', async (_event, entityType: string, entityId: string) => {
  try {
    if (entityType === 'goal' || entityType === 'habit') {
      return await getGoalConnections(entityId);
    }
    const todo = db!.prepare('SELECT * FROM todos WHERE id = ?').get(entityId) as any;
    if (!todo) return { success: false, error: 'Entity not found' };
    const parent = todo.goal_id ? db!.prepare('SELECT id, title, is_habit FROM goals WHERE id = ?').get(todo.goal_id) : todo.schedule_id ? db!.prepare('SELECT id, title, start_time, end_time FROM schedule_entries WHERE id = ?').get(todo.schedule_id) : todo.parent_todo_id ? db!.prepare('SELECT id, text FROM todos WHERE id = ?').get(todo.parent_todo_id) : null;
    return { success: true, connections: { parent, deadline: todo.deadline_id ? db!.prepare('SELECT * FROM deadlines WHERE id = ?').get(todo.deadline_id) : null, children: db!.prepare('SELECT * FROM todos WHERE parent_todo_id = ? ORDER BY sort_order, created_at').all(entityId), todos: [] } };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

/* ── Goal hub ──────────────────────────────────────────────────────────────
 *
 * RESPONSE SHAPE — THIS FUNCTION IS THE CONTRACT. ConnectionExplorer used to
 * read `res.connections.parentLTG / linkedGoal / scheduleBlocks`, which never
 * existed, so the hub rendered empty forever. The renderer was wrong, not the
 * query, so the query's keys are now canonical and the explorer is written to
 * match them.
 *
 * Every key is ALWAYS present (empty array rather than undefined) so the panel
 * can distinguish "loaded, none linked" from "failed to load".
 */
async function getGoalConnections(goalId: string) {
  const goal = db!.prepare('SELECT id, title, category, is_habit, parent_id, parent_ids FROM goals WHERE id = ?').get(goalId) as any;
  if (!goal) return { success: false, error: 'Goal not found' };

  const all = (sql: string, ...p: any[]) => { try { return db!.prepare(sql).all(...p) as any[]; } catch { return []; } };

  // Generic links live in entity_links; the four legacy tables carry their own
  // goal_id and are queried directly so existing rows keep working.
  const generic = all('SELECT feature, entity_id, label, meta FROM entity_links WHERE goal_id = ? ORDER BY created_at DESC', goalId);
  const byFeature = (f: string) => generic.filter(r => r.feature === f);

  // Hydrate a generic link row with a human label by looking the entity up.
  const labelFor = (feature: string, entityId: string, fallback?: string | null) => {
    try {
      const q: Record<string, [string, string]> = {
        note: ['SELECT title FROM notes WHERE id = ?', 'title'],
        learn: ['SELECT title FROM learn_decks WHERE id = ?', 'title'],
        finance: ['SELECT name FROM finance_subscriptions WHERE id = ?', 'name'],
        project: ['SELECT name FROM projects WHERE id = ?', 'name'],
        brain: ['SELECT entity FROM brain_memories WHERE id = ?', 'entity'],
        reminder: ['SELECT text FROM reminders WHERE id = ?', 'text'],
      };
      const hit = q[feature];
      if (hit) {
        const row = db!.prepare(hit[0]).get(entityId) as any;
        if (row && row[hit[1]]) return row[hit[1]];
      }
    } catch {}
    return fallback || entityId;
  };

  const shape = (rows: any[], titleKey: string, type: string) =>
    rows.map(r => ({ id: r.id ?? r.entity_id, title: r[titleKey] ?? r.title ?? r.text ?? '', type, done: r.done, meta: r.meta }));

  return {
    success: true,
    goal,
    parentLtgs: goal.parent_id ? all('SELECT id, title, category FROM goals WHERE id = ?', goal.parent_id) : [],
    childGoals: all('SELECT id, title, category, is_habit FROM goals WHERE parent_id = ? OR parent_ids LIKE ?', goalId, `%"${goalId}"%`),
    todos: all('SELECT * FROM todos WHERE goal_id = ? ORDER BY done, sort_order, created_at', goalId),
    schedules: all('SELECT * FROM schedule_entries WHERE goal_id = ? ORDER BY day_of_week, start_time', goalId),
    deadlines: all('SELECT * FROM deadlines WHERE goal_id = ? ORDER BY due_date', goalId),
    reminders: all('SELECT * FROM reminders WHERE goal_id = ? ORDER BY due_date, due_time', goalId),
    notes: byFeature('note').map(r => ({ id: r.entity_id, title: labelFor('note', r.entity_id, r.label), type: 'note', meta: r.meta })),
    learn: byFeature('learn').map(r => ({ id: r.entity_id, title: labelFor('learn', r.entity_id, r.label), type: 'learn', meta: r.meta })),
    finance: byFeature('finance').map(r => ({ id: r.entity_id, title: labelFor('finance', r.entity_id, r.label), type: 'finance', meta: r.meta })),
    ide: byFeature('project').map(r => ({ id: r.entity_id, title: labelFor('project', r.entity_id, r.label), type: 'ide', meta: r.meta })),
    brain: byFeature('brain').map(r => ({ id: r.entity_id, title: labelFor('brain', r.entity_id, r.label), type: 'brain', meta: r.meta })),
  };
}

ipcMain.handle('goal:get-connections', async (_event, goalId: string) => {
  try { return await getGoalConnections(goalId); } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

/** Batch connection counts for many goals at once.
 *
 *  The goal list renders one GoalCard per routine, and each card wants to show
 *  "3 todos · 2 blocks". Calling goal:get-connections per card would be N round
 *  trips on every render, so this does it in 6 queries total.
 */
ipcMain.handle('goal:connections-bulk', async (_event, goalIds: string[]) => {
  try {
    const ids = (goalIds || []).filter(Boolean);
    if (ids.length === 0) return { success: true, counts: {} };
    const marks = ids.map(() => '?').join(',');
    const n = (sql: string) => { try { return db!.prepare(sql).all(...ids) as any[]; } catch { return [] as any[]; } };
    const counts: Record<string, { todos: number; schedules: number; deadlines: number; reminders: number; links: number; total: number }> = {};
    for (const id of ids) counts[id] = { todos: 0, schedules: 0, deadlines: 0, reminders: 0, links: 0, total: 0 };
    const bump = (rows: any[], key: 'todos' | 'schedules' | 'deadlines' | 'reminders' | 'links') => {
      for (const r of rows) { if (counts[r.gid]) counts[r.gid][key] = Number(r.c || 0); }
    };
    bump(n(`SELECT goal_id AS gid, COUNT(*) AS c FROM todos WHERE goal_id IN (${marks}) GROUP BY goal_id`), 'todos');
    bump(n(`SELECT goal_id AS gid, COUNT(*) AS c FROM schedule_entries WHERE goal_id IN (${marks}) GROUP BY goal_id`), 'schedules');
    bump(n(`SELECT goal_id AS gid, COUNT(*) AS c FROM deadlines WHERE goal_id IN (${marks}) GROUP BY goal_id`), 'deadlines');
    bump(n(`SELECT goal_id AS gid, COUNT(*) AS c FROM reminders WHERE goal_id IN (${marks}) GROUP BY goal_id`), 'reminders');
    bump(n(`SELECT goal_id AS gid, COUNT(*) AS c FROM entity_links WHERE goal_id IN (${marks}) GROUP BY goal_id`), 'links');
    for (const id of ids) {
      const c = counts[id];
      c.total = c.todos + c.schedules + c.deadlines + c.reminders + c.links;
    }
    return { success: true, counts };
  } catch (err: any) { return { success: false, error: String(err?.message || err), counts: {} }; }
});

/* ── Generic entity↔goal linking ─────────────────────────────────────────── */

ipcMain.handle('entity:link', async (_event, payload: { feature: string; entityId: string; goalId: string | null; label?: string; meta?: any }) => {
  try {
    const { feature, entityId, goalId } = payload || ({} as any);
    if (!feature || !entityId) return { success: false, error: 'A feature and an entity are required.' };
    if (!goalId) {
      db!.prepare('DELETE FROM entity_links WHERE feature = ? AND entity_id = ?').run(feature, entityId);
      return { success: true, linked: false };
    }
    const id = 'lnk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    db!.prepare(`
      INSERT INTO entity_links (id, feature, entity_id, goal_id, label, meta)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(feature, entity_id, goal_id) DO UPDATE SET label = excluded.label, meta = excluded.meta
    `).run(id, feature, entityId, goalId, payload.label || null, payload.meta ? JSON.stringify(payload.meta) : null);
    return { success: true, linked: true, id };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

/** Which goal (if any) is this entity attached to? Drives the linked/unlinked state
 *  in the pickers, so they render truth rather than guessing. */
ipcMain.handle('entity:get-links', async (_event, feature: string, entityId: string) => {
  try {
    const rows = db!.prepare('SELECT goal_id FROM entity_links WHERE feature = ? AND entity_id = ?').all(feature, entityId) as any[];
    return { success: true, goalIds: rows.map(r => r.goal_id).filter(Boolean) };
  } catch (err: any) { return { success: false, error: String(err?.message || err), goalIds: [] }; }
});

/* Goals and the schedule are two halves of ONE link, and only one half was ever
   written. `schedule_entries.goal_id` says which goal a block serves; the
   reciprocal `goals.linked_schedule_id` is what momentum's "schedule adherence"
   reads (main.ts, 30% of the score). The schedule UI never wrote the reciprocal
   side, so its `linkedGoals` filter was ALWAYS empty and adherence stayed at the
   neutral 50 forever, whatever the user scheduled. These helpers keep both sides
   agreeing on add, edit and delete. */
function linkGoalToSchedule(scheduleId: string, goalId: string | null | undefined) {
  if (!goalId) return;
  try { db!.prepare('UPDATE goals SET linked_schedule_id = ? WHERE id = ?').run(scheduleId, goalId); } catch { /* optional */ }
}

function unlinkGoalFromSchedule(scheduleId: string) {
  try { db!.prepare('UPDATE goals SET linked_schedule_id = NULL WHERE linked_schedule_id = ?').run(scheduleId); } catch { /* optional */ }
}

ipcMain.handle('get-schedule', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM schedule_entries ORDER BY day_of_week, start_time').all();
    return { success: true, entries: rows };
  } catch (err: any) { return { success: false, error: err.message, entries: [] }; }
});

ipcMain.handle('add-schedule-entry', async (_event, entry: any) => {
  try {
    const id = 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    db!.prepare('INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color, goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, entry.title, entry.location || null, entry.day_of_week, entry.start_time, entry.end_time, entry.category || 'class', entry.color || '#22d3ee', entry.goal_id || null);
    linkGoalToSchedule(id, entry.goal_id);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('delete-schedule-entry', async (_event, id: string) => {
  try {
    unlinkGoalFromSchedule(id);
    db!.prepare('DELETE FROM schedule_entries WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('update-schedule-entry', async (_event, id: string, patch: any) => {
  try {
    const fields = Object.keys(patch).filter(k => ['title', 'location', 'day_of_week', 'start_time', 'end_time', 'category', 'color', 'goal_id'].includes(k) && patch[k] !== undefined);
    if (fields.length === 0) return { success: true };
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => patch[f]);
    db!.prepare(`UPDATE schedule_entries SET ${sets} WHERE id = ?`).run(...vals, id);
    /* Re-point the reciprocal link only when the goal actually changed, and
       clear the OLD goal first so a block moved from goal A to goal B cannot
       leave A still claiming this schedule id. */
    if (fields.includes('goal_id')) {
      unlinkGoalFromSchedule(id);
      linkGoalToSchedule(id, patch.goal_id);
    }
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

// --- Deadlines IPC -----------------------------------------------------------
ipcMain.handle('get-deadlines', async (_event, opts?: { days?: number; course?: string }) => {
  try {
    const { days = 30, course } = opts || {};
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    let sql = 'SELECT * FROM deadlines WHERE (due_date <= ? OR (remind_at IS NOT NULL AND remind_at <= ?)) AND status != ? ORDER BY COALESCE(remind_at, due_date) ASC';
    const params: any[] = [cutoff, cutoff, 'done'];
    if (course) { sql += ' AND course = ?'; params.push(course); }
    const rows = db!.prepare(sql).all(...params);
    return { success: true, deadlines: rows };
  } catch (err: any) { return { success: false, error: err.message, deadlines: [] }; }
});

ipcMain.handle('add-deadline', async (_event, dl: any) => {
  try {
    const id = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    // Normalize ISO timestamps to YYYY-MM-DD so the calendar grid (keyed by date)
    // and daysUntil() line up. Raw timestamps previously produced NaN + never landed.
    const normDue = dl.due_date ? dl.due_date.slice(0, 10) : null;
    const normRemind = dl.remind_at ? dl.remind_at.slice(0, 10) : null;
    // due_time is validated to a real HH:mm rather than trusted: an out-of-range
    // value here used to be reachable and would render as garbage in the picker.
    const rawTime = String(dl.due_time || '').trim();
    const normTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime)
      ? rawTime.split(':').map((n: string) => n.padStart(2, '0')).join(':')
      : null;
    db!.prepare('INSERT INTO deadlines (id, title, course, due_date, due_time, priority, description, category, remind_at, goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, dl.title, dl.course || null, normDue, normTime, dl.priority || 'medium', dl.description || null, dl.category || null, normRemind, dl.goal_id || null);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('update-deadline-status', async (_event, id: string, status: string) => {
  try {
    if (status === 'done') {
      const dl = db!.prepare('SELECT * FROM deadlines WHERE id = ?').get(id) as any;
      if (dl?.recurrence) {
        const nextDue = calculateNextDue(dl.due_date, dl.recurrence);
        db!.prepare('UPDATE deadlines SET due_date = ?, notified_at = ? WHERE id = ?').run(nextDue, '{}', id);
        return { success: true, recurring: true };
      }
    }
    db!.prepare('UPDATE deadlines SET status = ? WHERE id = ?').run(status, id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('delete-deadline', async (_event, id: string) => {
  try {
    db!.prepare('DELETE FROM deadlines WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('update-deadline', async (_event, id: string, patch: any) => {
  try {
    const allowed = ['title', 'course', 'due_date', 'priority', 'description', 'category', 'recurrence', 'status', 'remind_at', 'goal_id', 'due_time'];
    const fields = Object.keys(patch).filter(k => allowed.includes(k) && patch[k] !== undefined);
    if (fields.length === 0) return { success: true };
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => patch[f]);
    db!.prepare(`UPDATE deadlines SET ${sets} WHERE id = ?`).run(...vals, id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

/* ── Deadline reminders (many per deadline, relative OR absolute) ───────────── */

const REMINDER_COLS = 'id, deadline_id, mode, lead_min, remind_at, fired, created_at';

ipcMain.handle('get-deadline-reminders', async (_event, deadlineId: string) => {
  try {
    const rows = db!.prepare(
      `SELECT ${REMINDER_COLS} FROM deadline_reminders WHERE deadline_id = ?`,
    ).all(deadlineId) as any[];
    return { success: true, reminders: rows };
  } catch (err: any) {
    return { success: false, error: err.message, reminders: [] };
  }
});

/* ALL reminders for all open deadlines in one call. The firing loop and the
   list view both need the whole set, and calling per-deadline would mean one
   IPC round trip per row to paint a screen. */
ipcMain.handle('get-all-deadline-reminders', async () => {
  try {
    const rows = db!.prepare(
      `SELECT r.* FROM deadline_reminders r
       JOIN deadlines d ON d.id = r.deadline_id
       WHERE d.status != 'done' AND r.fired = 0`,
    ).all() as any[];
    return { success: true, reminders: rows };
  } catch (err: any) {
    return { success: false, error: err.message, reminders: [] };
  }
});

/* The validation that matters lives in `normalizeReminder` (shared, unit
   tested): a reminder after the deadline, or already in the past, is rejected
   with a reason the UI can show. This handler re-derives the deadline row and
   clamps there too, so a caller cannot bypass the rule by posting directly. */
ipcMain.handle('add-deadline-reminder', async (_event, deadlineId: string, input: {
  mode?: string; lead_min?: number; remind_at?: string | null;
}) => {
  try {
    const d = db!.prepare('SELECT id, due_date FROM deadlines WHERE id = ?').get(deadlineId) as any;
    if (!d) return { success: false, error: 'That deadline no longer exists.' };

    const mode = input.mode === 'absolute' ? 'absolute' : 'relative';
    const now = new Date();

    let leadMin = 0;
    let remindAt: string | null = null;

    if (mode === 'relative') {
      leadMin = Math.max(0, Math.trunc(Number(input.lead_min) || 0));
      const dueMs = new Date(String(d.due_date).length > 10 ? d.due_date : d.due_date + 'T09:00:00').getTime();
      if (Number.isFinite(dueMs) && dueMs - leadMin * 60000 <= now.getTime()) {
        return { success: false, error: 'That reminder time has already passed.' };
      }
    } else {
      if (!input.remind_at) return { success: false, error: 'Pick when you want to be reminded.' };
      const t = new Date(input.remind_at);
      if (Number.isNaN(t.getTime())) return { success: false, error: 'That reminder time could not be read.' };
      if (t.getTime() <= now.getTime()) return { success: false, error: 'That reminder time has already passed.' };
      const dueMs = new Date(String(d.due_date).length > 10 ? d.due_date : d.due_date + 'T09:00:00').getTime();
      if (Number.isFinite(dueMs) && t.getTime() > dueMs) {
        return { success: false, error: 'A reminder cannot be after the deadline itself.' };
      }
      remindAt = t.toISOString();
    }

    const id = 'drem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    db!.prepare(
      `INSERT INTO deadline_reminders (id, deadline_id, mode, lead_min, remind_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, deadlineId, mode, leadMin, remindAt);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-all-locations', async () => {
  try {
    const goalLocs = db!.prepare("SELECT DISTINCT location FROM goals WHERE location IS NOT NULL AND location != ''").all() as any[];
    const reminderLocs = db!.prepare("SELECT DISTINCT location FROM deadline_reminders WHERE location IS NOT NULL AND location != ''").all() as any[];
    const all = [...goalLocs.map((r: any) => r.location), ...reminderLocs.map((r: any) => r.location)];
    const unique = [...new Set(all)].sort();
    return { success: true, locations: unique };
  } catch (err: any) {
    return { success: false, error: err.message, locations: [] };
  }
});

ipcMain.handle('delete-deadline-reminder', async (_event, id: string) => {
  try {
    db!.prepare('DELETE FROM deadline_reminders WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('mark-deadline-reminder-fired', async (_event, id: string) => {
  try {
    db!.prepare('UPDATE deadline_reminders SET fired = 1 WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('snooze-deadline', async (_event, id: string, minutes: number) => {
  try {
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    db!.prepare('UPDATE deadlines SET snoozed_until = ? WHERE id = ?').run(until, id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

// --- Schedule Templates IPC -----------------------------------------------------------
ipcMain.handle('get-schedule-templates', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM schedule_templates ORDER BY is_builtin DESC, name ASC').all();
    return { success: true, templates: rows.map(r => ({ ...r, entries: JSON.parse(r.entries_json) })) };
  } catch (err: any) { return { success: false, error: err.message, templates: [] }; }
});

ipcMain.handle('apply-schedule-template', async (_event, templateId: string) => {
  try {
    const tpl = db!.prepare('SELECT entries_json FROM schedule_templates WHERE id = ?').get(templateId) as any;
    if (!tpl) return { success: false, error: 'Template not found' };
    const entries = JSON.parse(tpl.entries_json);
    const tx = db!.transaction(() => {
      for (const e of entries) {
        db!.prepare('INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run('sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), e.title, e.location || null, e.day_of_week, e.start_time, e.end_time, e.category || 'class', e.color || '#22d3ee');
      }
    });
    tx();
    return { success: true, count: entries.length };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('save-schedule-template', async (_event, data: { name: string; entries: any[] }) => {
  try {
    const id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    db!.prepare('INSERT INTO schedule_templates (id, name, entries_json, is_builtin) VALUES (?, ?, ?, 0)')
      .run(id, data.name, JSON.stringify(data.entries));
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
});

function calculateNextDue(currentDue: string, recurrence: string): string {
  const d = new Date(currentDue);
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence?.startsWith('custom:')) {
    const days = parseInt(recurrence.split(':')[1]) || 1;
    d.setDate(d.getDate() + days);
  }
  return d.toISOString();
}

// --- Connectors IPC -----------------------------------------------------------

ipcMain.handle('connectors:list', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM connectors ORDER BY created_at ASC').all() as any[];
    return {
      success: true,
      connectors: rows.map(r => ({
        id: r.id, type: r.type, provider: r.provider,
        displayName: r.display_name, config: JSON.parse(r.config),
        status: r.status, lastSync: r.last_sync, errorMessage: r.error_message,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, connectors: [] };
  }
});

ipcMain.handle('connectors:add', async (_event, connector: { type: string; provider: string; displayName: string; config: any }) => {
  try {
    const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    db!.prepare(`
      INSERT INTO connectors (id, type, provider, display_name, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'disconnected', ?, ?)
    `).run(id, connector.type, connector.provider, connector.displayName, JSON.stringify(connector.config), now, now);
    // Capture connector episode into context brain
    try {
      episodeWriters.writeConnectorEpisode({ id, displayName: connector.displayName, type: connector.type, provider: connector.provider }, [], 'synced');
    } catch {}
    return {
      success: true,
      connector: { id, type: connector.type, provider: connector.provider, displayName: connector.displayName, config: connector.config, status: 'disconnected' as const },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('connectors:remove', async (_event, id: string) => {
  try {
    db!.prepare('DELETE FROM connector_items WHERE connector_id = ?').run(id);
    db!.prepare('DELETE FROM connectors WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// CalDAV URL normalizer — Google and Outlook require the user's email in the URL path.
// If the URL is a known provider endpoint without an email suffix, append the username.
/**
 * Single CalDAV/HTTP request helper used by test / sync / create / update.
 *
 * WHY THIS EXISTS — three real bugs that made calendar connections fail while
 * email worked fine:
 *
 * 1. `require('https')` was hardcoded in every calendar handler. A `http://`
 *    CalDAV URL (self-hosted Nextcloud, Radicale, anything on a LAN, or a local
 *    test server) therefore either threw or dialled port 443 with TLS against a
 *    plaintext server. CalDAV is served over BOTH schemes.
 * 2. NO REDIRECTS WERE FOLLOWED. Google and Microsoft both 301/302 the CalDAV
 *    endpoint (apidata.googleusercontent.com -> a regional host, and the
 *    /.well-known/caldav redirect). A single-hop request that treats anything
 *    non-2xx as a hard failure therefore rejected on a redirect that would
 *    have succeeded on the next hop. This is the single most likely reason
 *    "calendar will not connect" for Google/Outlook.
 * 3. `normalizeCalDavUrl()` was applied in `test` and `sync` but NOT in
 *    `create-event` / `update-event`, so a connection could test green and then
 *    fail to write with a 404 — the URL lost the trailing-slash + email shape.
 *
 * Redirects are followed up to MAX_CALDAV_REDIRECTS. Auth headers are stripped
 * on cross-origin redirect so credentials are never replayed to a host the user
 * did not configure (this would leak an app password).
 */
const MAX_CALDAV_REDIRECTS = 5;

function calDavRequest(
  rawUrl: string,
  options: { method: string; username: string; password: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; redirectsLeft?: number; originSeen?: string }
): Promise<{ status: number; body: string }> {
  const https = require('https');
  const http = require('http');
  const { method, username, password, headers = {}, body, timeoutMs = 15000 } = options;
  const redirectsLeft = options.redirectsLeft ?? MAX_CALDAV_REDIRECTS;

  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      reject(new Error(`Invalid CalDAV URL: ${rawUrl}. It must be a full URL including https:// or http://`));
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      reject(new Error(`Unsupported protocol "${url.protocol}". CalDAV URLs must start with https:// or http://`));
      return;
    }
    if (url.protocol === 'http:') {
      // Plaintext CalDAV is legitimate for self-hosted servers, but the app
      // password is about to go over it in the clear. Say so once, loudly.
      console.warn('[connectors] CalDAV request over plaintext HTTP — credentials are unencrypted:', url.origin);
    }

    const isFirstHop = !options.originSeen;
    const originSeen = options.originSeen ?? url.origin;
    const crossOrigin = url.origin !== originSeen;

    const agent = url.protocol === 'https:' ? https : http;
    const path = url.pathname + (url.search || '');
    const req = agent.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path,
        method,
        headers: {
          ...(isFirstHop || !crossOrigin
            ? { Authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64') }
            : {}),
          ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}),
          ...headers,
        },
        timeout: timeoutMs,
        ...(url.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
      },
      (res: any) => {
        const status = res.statusCode || 0;
        // Redirect: follow it, but only carry auth within the original origin.
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects while contacting the CalDAV server (last hop: ${res.headers.location})`));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          calDavRequest(next, { ...options, redirectsLeft: redirectsLeft - 1, originSeen })
            .then(resolve, reject);
          return;
        }
        let text = '';
        res.on('data', (chunk: any) => { text += chunk.toString(); });
        res.on('end', () => resolve({ status, body: text }));
      }
    );
    req.once('error', (err: any) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

/** Escape a value for use inside an iCalendar TEXT property. */
function icalEscape(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** iCal UTC timestamp: 2026-10-01T09:30:00Z -> 20261001T093000Z */
function icalUtc(iso: string): string {
  const d = new Date(iso);
  const valid = !Number.isNaN(d.getTime());
  if (!valid) throw new Error(`Invalid date "${iso}". Expected an ISO 8601 string.`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function normalizeCalDavUrl(urlStr: string, username: string): string {
  if (!username || !urlStr) return urlStr;
  try {
    const url = new URL(urlStr);
    const hostLower = url.hostname.toLowerCase();
    const path = url.pathname;
    // Known provider patterns that need email appended
    const needsEmail = (
      (hostLower === 'apidata.googleusercontent.com' && /\/caldav\/v2\/?$/.test(path)) ||
      (hostLower === 'outlook.office365.com' && /\/dav\/?$/.test(path))
    );
    if (needsEmail && username.includes('@')) {
      // Ensure trailing slash, then append email
      const base = path.endsWith('/') ? path : path + '/';
      return url.origin + base + username + '/';
    }
  } catch {}
  return urlStr;
}

ipcMain.handle('connectors:test', async (_event, id: string) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(id) as any;
    if (!row) return { success: false, message: 'Connector not found' };
    const config = JSON.parse(row.config);
    const start = Date.now();
    if (row.type === 'email' && row.provider === 'imap') {
      const Imap = require('node-imap');
      await new Promise<void>((resolve, reject) => {
        const imap = new Imap({
          user: config.username, password: config.password,
          host: config.host, port: config.port, tls: config.tls,
          tlsOptions: { rejectUnauthorized: false }, connTimeout: 10000,
        });
        imap.once('ready', () => { imap.end(); resolve(); });
        imap.once('error', (err: any) => reject(err));
        imap.connect();
      });
      db!.prepare("UPDATE connectors SET status = 'connected', error_message = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      return { success: true, message: 'Connected successfully', latencyMs: Date.now() - start };
    } else if (row.type === 'calendar' && row.provider === 'caldav') {
      const { status, body } = await calDavRequest(normalizeCalDavUrl(config.url, config.username), {
        method: 'PROPFIND',
        username: config.username,
        password: config.password,
        headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
        body: '<?xml version="1.0" encoding="utf-8" ?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
        timeoutMs: 15000,
      });
      if (status === 207 || status === 200) {
        db!.prepare("UPDATE connectors SET status = 'connected', error_message = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
        return { success: true, message: 'Connected successfully', latencyMs: Date.now() - start };
      }
      let hint = '';
      if (status === 401) hint = ' — Authentication failed. For Google CalDAV: (1) Generate an App Password at myaccount.google.com/apppasswords, (2) Use your full Gmail address as username, (3) URL must include your email like /caldav/v2/you@gmail.com/. For Outlook, use an app password.';
      else if (status === 403) hint = ' — Access denied. Check that CalDAV is enabled for this account and the URL is correct.';
      else if (status === 404) hint = ' — Calendar not found. Check the CalDAV URL — it should point to your calendar root, not a specific calendar.';
      else if (status === 405) hint = ' — Method not allowed. The server may not support CalDAV. Try a different URL.';
      else if (status >= 500) hint = ' — The calendar server errored. It may be temporarily unavailable.';
      const detail = body.length < 200 ? body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
      throw new Error(`HTTP ${status}${hint}${detail ? ' — ' + detail : ''}`);
    }
    return { success: false, message: `Unsupported connector: ${row.type}/${row.provider}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});
ipcMain.handle('connectors:sync', async (_event, id: string) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(id) as any;
    if (!row) return { success: false, error: 'Connector not found', itemsAdded: 0, itemsUpdated: 0 };
    let itemsAdded = 0;
    let itemsUpdated = 0;
    if (row.type === 'email' && row.provider === 'imap') {
      const { syncImapConnector } = require('../../services/connectors/sync-imap');
      const r = await (syncImapConnector as any)(db!, id, row);
      itemsAdded = r.itemsAdded; itemsUpdated = r.itemsUpdated;
    } else if (row.type === 'calendar' && row.provider === 'caldav') {
      const { syncCalDavConnector } = require('../../services/connectors/sync-caldav');
      const r = await (syncCalDavConnector as any)(db!, id, row);
      itemsAdded = r.itemsAdded; itemsUpdated = r.itemsUpdated;
    } else {
      return { success: false, error: `Unsupported connector: ${row.type}/${row.provider}`, itemsAdded: 0, itemsUpdated: 0 };
    }
    return { success: true, itemsAdded, itemsUpdated };
  } catch (err: any) {
    db!.prepare("UPDATE connectors SET status='error', error_message=? WHERE id = ?").run(err?.message || String(err), id);
    return { success: false, error: err?.message || String(err), itemsAdded: 0, itemsUpdated: 0 };
  }
});

ipcMain.handle('connectors:items', async (_event, id: string, opts?: { type?: string; limit?: number; offset?: number; search?: string; unreadOnly?: boolean }) => {
  try {
    const limit = opts?.limit || 20;
    const offset = opts?.offset || 0;
    let query = 'SELECT * FROM connector_items WHERE connector_id = ?';
    const params: any[] = [id];
    if (opts?.type) { query += ' AND item_type = ?'; params.push(opts.type); }
    if (opts?.search) { query += ' AND (subject LIKE ? OR summary LIKE ?)'; const s = `%${opts.search}%`; params.push(s, s); }
    if (opts?.unreadOnly) { query += ' AND is_read = 0'; }
    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db!.prepare(query).all(...params) as any[];
    return {
      success: true,
      items: rows.map(r => ({
        id: r.id, connectorId: r.connector_id, itemType: r.item_type,
        subject: r.subject, summary: r.summary, date: r.date,
        read: !!r.is_read, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, items: [] };
  }
});

ipcMain.handle('connectors:status', async (_event, id: string) => {
  try {
    const row = db!.prepare('SELECT id, status, last_sync, error_message FROM connectors WHERE id = ?').get(id) as any;
    if (!row) return { success: false, status: 'not_found' };
    return { success: true, status: row.status, lastSync: row.last_sync, errorMessage: row.error_message };
  } catch (err: any) {
    return { success: false, status: 'error', errorMessage: err.message };
  }
});

// Email: Send via SMTP (nodemailer)
ipcMain.handle('connectors:send-email', async (_event, data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const nodemailer = require('nodemailer');
    // Derive SMTP host from IMAP host (imap.gmail.com ? smtp.gmail.com)
    const smtpHost = config.host.replace(/^imap\./, 'smtp.');
    const smtpPort = config.tls ? 465 : 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: config.tls,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
    });
    const info = await transporter.sendMail({
      from: config.username,
      to: data.to,
      subject: data.subject,
      text: data.body,
      inReplyTo: data.inReplyTo,
      references: data.inReplyTo ? [data.inReplyTo] : undefined,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Calendar: Create event
ipcMain.handle('connectors:create-event', async (_event, data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dtStart = icalUtc(data.startTime);
    const dtEnd = data.endTime ? icalUtc(data.endTime) : dtStart;
    // PROPER CRLF + escaping. The old body used bare \n and unescaped commas,
    // semicolons and newlines in the title/description, which produces an
    // invalid VCALENDAR that stricter servers (Google, iOS) reject with 400.
    const vevent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DeskFlow//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icalEscape(data.title)}`,
      `DESCRIPTION:${icalEscape(data.description || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

    // normalizeCalDavUrl was NOT applied here before — a connector could test
    // green and then fail every write with 404. Now both paths agree.
    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const { status, body } = await calDavRequest(
      (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${uid}.ics`),
      {
        method: 'PUT',
        username: config.username,
        password: config.password,
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' },
        body: vevent,
        timeoutMs: 15000,
      }
    );
    if (status >= 200 && status < 300) {
      db!.prepare(`INSERT INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`)
        .run(`ci_${data.connectorId}_${uid}`, data.connectorId, data.title, data.description || data.title, data.startTime, JSON.stringify({ startTime: data.startTime, endTime: data.endTime }));
      return { success: true, eventId: uid };
    }
    const detail = body.length < 200 ? body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
    return { success: false, error: `Calendar rejected the event (HTTP ${status})${detail ? ' — ' + detail : ''}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Calendar: Update event
ipcMain.handle('connectors:update-event', async (_event, data: { connectorId: string; eventId: string; changes: any }) => {
  try {
    const item = db!.prepare('SELECT * FROM connector_items WHERE id = ?').get(`ci_${data.connectorId}_${data.eventId}`) as any;
    if (!item) return { success: false, error: 'Event not found' };

    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    const newTitle = data.changes.title || item.subject;
    const newStart = data.changes.startTime || meta.startTime;
    const newEnd = data.changes.endTime || meta.endTime;
    const newDesc = data.changes.description || item.summary;

    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    const config = JSON.parse(row.config);
    const dtStart = icalUtc(newStart);
    const dtEnd = newEnd ? icalUtc(newEnd) : dtStart;
    const vevent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DeskFlow//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${data.eventId}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icalEscape(newTitle)}`,
      `DESCRIPTION:${icalEscape(newDesc || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const put = await calDavRequest((baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${data.eventId}.ics`), {
      method: 'PUT',
      username: config.username,
      password: config.password,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'If-Match': '*' },
      body: vevent,
      timeoutMs: 15000,
    });
    if (put.status < 200 || put.status >= 300) {
      const detail = put.body.length < 200 ? put.body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
      return { success: false, error: `Calendar rejected the update (HTTP ${put.status})${detail ? ' — ' + detail : ''}` };
    }

    db!.prepare('UPDATE connector_items SET subject = ?, summary = ?, date = ?, metadata = ? WHERE id = ?')
      .run(newTitle, newDesc, newStart, JSON.stringify({ startTime: newStart, endTime: newEnd }), `ci_${data.connectorId}_${data.eventId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Calendar: Delete event
ipcMain.handle('connectors:delete-event', async (_event, data: { connectorId: string; eventId: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const del = await calDavRequest((baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${data.eventId}.ics`), {
      method: 'DELETE',
      username: config.username,
      password: config.password,
      timeoutMs: 15000,
    });
    // 404 means already gone — treat as success so a retry is idempotent.
    if (!((del.status >= 200 && del.status < 300) || del.status === 404)) {
      const detail = del.body.length < 200 ? del.body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
      return { success: false, error: `Calendar rejected the delete (HTTP ${del.status})${detail ? ' — ' + detail : ''}` };
    }

    db!.prepare('DELETE FROM connector_items WHERE id = ?').run(`ci_${data.connectorId}_${data.eventId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Email: Mark read/unread
ipcMain.handle('connectors:mark-read', async (_event, data: { connectorId: string; emailId: string; read: boolean }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const meta = db!.prepare('SELECT metadata FROM connector_items WHERE id = ?').get(data.emailId) as any;
    const metadata = meta?.metadata ? JSON.parse(meta.metadata) : {};
    const seqNo = metadata.sequenceNumber;

    if (seqNo) {
      const Imap = require('node-imap');
      await new Promise<void>((resolve, reject) => {
        const imap = new Imap({
          user: config.username, password: config.password,
          host: config.host, port: config.port, tls: config.tls,
          tlsOptions: { rejectUnauthorized: false },
        });
        imap.once('ready', () => {
          imap.openBox(config.folder || 'INBOX', false, (err: any) => {
            if (err) { imap.end(); reject(err); return; }
            const action = data.read ? '\Seen' : '\Unseen';
            imap.setFlags(seqNo, data.read ? [action] : { remove: [action] }, (err: any) => {
              imap.end();
              if (err) reject(err); else resolve();
            });
          });
        });
        imap.once('error', reject);
        imap.connect();
      });
    }

    db!.prepare('UPDATE connector_items SET is_read = ? WHERE id = ?').run(data.read ? 1 : 0, data.emailId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// --- Planning.md Helpers ---
function planningPath() {
  return path_1.default.join(userDataPath, 'planning.md');
}

interface GoalPromptContext {
  planningContent?: string;
  longtermGoals?: Array<{ title: string; category: string }>;
  unfinished?: Array<{ title: string; category: string; progress?: number }>;
  recentlyCompleted?: string[];
  stats?: Record<string, any>;
}

ipcMain.handle('read-planning-md', async () => {
  try {
    const fpath = planningPath();
    if (!fs_1.default.existsSync(fpath)) return { content: '' };
    return { content: fs_1.default.readFileSync(fpath, 'utf-8') };
  } catch (err: any) {
    return { content: '', error: err.message };
  }
});

ipcMain.handle('write-planning-md', async (_event, content: string) => {
  try {
    const fpath = planningPath();
    const dir = path_1.default.dirname(fpath);
    if (!fs_1.default.existsSync(dir)) fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(fpath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-feature-spec-file', async (_event, content: string) => {
  try {
    const appRoot = electron_1.app.getAppPath();
    const fpath = path_1.default.join(appRoot, 'agent', 'FEATURE_SPECS.md');
    const dir = path_1.default.dirname(fpath);
    if (!fs_1.default.existsSync(dir)) fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(fpath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-goal-context', async (_event, date: string) => {
  try {
    const sevenDaysAgo = formatDateStr(new Date(Date.now() - 7 * 86400000));
    const weekStats = db!.prepare(`SELECT category, SUM(total_sec) as total FROM daily_stats WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC`).all(sevenDaysAgo, date) as any[];
    const yesterday = db!.prepare(`SELECT app as app_name, total_sec as total_seconds, category FROM daily_stats WHERE date = ? ORDER BY total_sec DESC LIMIT 5`).get(formatDateStr(new Date(Date.now() - 86400000))) as any;
    return { success: true, last7dByCategory: weekStats, yesterday: yesterday || null };
  } catch (err: any) {
    return { success: false, error: err.message, last7dByCategory: [], yesterday: null };
  }
});

ipcMain.handle('suggest-goals', async (_event, date: string, ctx?: GoalPromptContext) => {
  try {
    const p = userPreferences || {};
    const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
    const chain = pState ? buildChain(pState, 'goalAssistant') : [];
    let systemPrompt = `You are a daily goal planner. Based on the user's activity data, suggest 3-5 SMART goals for today (${date}). Return ONLY a JSON array of objects with keys: title (string), category ("work"|"personal"|"health"|"learning"|"finance"|"relationships"), target ({type:"time", targetSeconds?: number} or {type:"completion", done: false}), parentId (string, the ID of the long-term goal this serves), linkedScheduleId (string, optional, the ID of the schedule block this goal targets). CRITICAL: Every daily goal MUST link to a long-term goal via parentId. If no long-term goals exist, set parentId to null.`;
    const userParts: string[] = ['Suggest daily goals for today.'];

    // Inject today's schedule context
    try {
      const dayOfWeek = new Date().getDay();
      const scheduleBlocks = db!.prepare('SELECT * FROM schedule_entries WHERE day_of_week = ? ORDER BY start_time').all(dayOfWeek) as any[];
      if (scheduleBlocks.length > 0) {
        systemPrompt += `\n\nToday's schedule blocks:\n${scheduleBlocks.map((b: any) => `- ID: ${b.id}, Title: ${b.title}, Time: ${b.start_time}-${b.end_time}, Category: ${b.category || 'other'}`).join('\n')}\n\nWhen a schedule block exists (e.g., Study 14:00-16:00), generate a goal that targets that block. Set linkedScheduleId to the block's ID and set target to {type:"time", targetSeconds: <block duration in seconds>}. This connects goals to the user's schedule for tracking.`;
      }
    } catch { /* schedule injection is optional */ }

    if (ctx?.planningContent) {
      systemPrompt += `\n\nThe user has the following plan:\n${ctx.planningContent}\n\nPrefer goals that align with their plan.`;
    }
    if (ctx?.longtermGoals?.length) {
      systemPrompt += `\n\nThe user's long-term goals (use these IDs for parentId):\n${ctx.longtermGoals.map((g: any) => `- ID: ${g.id}, Title: ${g.title}, Category: ${g.category}`).join('\n')}\n\nSuggest daily goals that make progress toward these long-term goals. EACH daily goal MUST include parentId matching the long-term goal it serves.`;
    }
    if (ctx?.unfinished?.length) {
      userParts.push(`Unfinished from yesterday: ${ctx.unfinished.map(u => u.title).join(', ')}`);
    }
    if (ctx?.recentlyCompleted?.length) {
      userParts.push(`Already completed recently (do NOT re-suggest): ${ctx.recentlyCompleted.join(', ')}`);
    }
    const userMsg = userParts.join('\n');

    if (chain.length > 0) {
      const { result } = await runWithFallback(chain, { systemPrompt, messages: [{ role: 'user', content: userMsg }], maxTokens: 500, temperature: 0.7 });
      const parsed = JSON.parse(result.content);
      return { success: true, suggestions: Array.isArray(parsed) ? parsed : [] };
    }

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) return { success: false, error: 'No AI providers configured', suggestions: [] };
    const model = p.ai_briefModel || 'google/gemini-2.0-flash-001';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: 700 }),
    });
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '[]');
    return { success: true, suggestions: Array.isArray(parsed) ? parsed : [] };
  } catch (err: any) {
    return { success: false, error: err.message, suggestions: [] };
  }
});

ipcMain.handle('review-goals', async (_event, date: string, ctx?: GoalPromptContext) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date = ? ORDER BY created_at ASC').all(date) as any[];
    const pending = rows.filter((g: any) => g.status !== 'completed' && g.status !== 'dismissed');
    if (pending.length === 0) return { success: true, review: 'All goals completed or dismissed today.' };

    const p = userPreferences || {};
    const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
    const chain = pState ? buildChain(pState, 'goalAssistant') : [];
    let systemPrompt = `You are a goal review assistant. Review these goals for ${date}. For each incomplete goal, suggest: slip (move to tomorrow), dismiss, or reprioritize. Return a JSON object with keys: reviewSummary (string), suggestions (array of {goalId, action: "slip"|"dismiss"|"reprioritize", reason}).`;
    const userMsg = `Pending goals: ${JSON.stringify(pending.map((g: any) => ({ id: g.id, title: g.title, status: g.status })))}`;

    if (ctx?.planningContent) {
      systemPrompt += `\n\nUser's plan context:\n${ctx.planningContent}`;
    }

    if (chain.length > 0) {
      const { result } = await runWithFallback(chain, { systemPrompt, messages: [{ role: 'user', content: userMsg }], maxTokens: 300, temperature: 0.5 });
      const parsed = JSON.parse(result.content);
      const reviewSummary = parsed.reviewSummary || result.content;
      const suggestions = parsed.suggestions || [];
      // Save review
      db!.prepare('INSERT OR REPLACE INTO goal_reviews (date, review_summary, suggestions, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
        .run(date, reviewSummary, JSON.stringify(suggestions));
      return { success: true, review: reviewSummary, suggestions };
    }
    return { success: true, review: 'No AI provider configured for review.', suggestions: [] };
  } catch (err: any) {
    return { success: false, error: err.message, review: '', suggestions: [] };
  }
});

// ─── Parse Goal Feedback ─────────────────────
const GOAL_FEEDBACK_SYSTEM = `You are a goal feedback parser. Given a user's message about their daily goals, extract:
- completed: which goals they finished (match by title or paraphrase)
- note: a short 1-sentence summary of their reflection
Return ONLY JSON: { completed: string[], note: string }`;

ipcMain.handle('parse-goal-feedback', async (_event, params: { message: string; goals: string[] }) => {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'goalAssistant') : [];
  const userMsg = `User says: "${params.message}". Their goals: ${params.goals.join(', ')}`;

  if (chain.length > 0) {
    try {
      const { result } = await runWithFallback(chain, { systemPrompt: GOAL_FEEDBACK_SYSTEM, messages: [{ role: 'user', content: userMsg }], maxTokens: 150 });
      const parsed = JSON.parse(result.content);
      return { completed: parsed.completed || [], added: [], note: parsed.note || '' };
    } catch {
      return { completed: [], added: [], note: '' };
    }
  }

  return { completed: [], added: [], note: '' };
});

// ─── Parse Goal Dump (Bulk Import) ─────────────────────
const GOAL_DUMP_SYSTEM = `You are a goal extractor. Given freeform text from a user, extract actionable long-term goals.
For each goal, provide:
- title: short clear name (required)
- description: 1-sentence detail (optional)
- category: one of: work, personal, health, learning, finance, relationships

Rules:
- Extract ONLY clear, actionable goals. Skip vague wishes.
- If a goal has a deadline, include it in the description.
- Return ONLY a valid JSON array: [{ "title": "...", "description?": "...", "category": "..." }]
- If nothing parseable, return [].`;

ipcMain.handle('parse-goal-dump', async (_event, text: string) => {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'goalAssistant') : [];

  if (chain.length > 0 && text.trim().length > 10) {
    try {
      const { result } = await runWithFallback(chain, {
        systemPrompt: GOAL_DUMP_SYSTEM,
        messages: [{ role: 'user', content: `Extract goals from this text:\n\n${text}` }],
        maxTokens: 800,
        temperature: 0.3,
      });
      const raw = result.content;
      const cleaned = raw.replace(/^```(?:json)?\s*(\[.*?\])\s*```$/s, '$1').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return { success: true, goals: parsed };
      }
      return { success: true, goals: [] };
    } catch (err: any) {
      console.log('[parse-goal-dump] parse error:', err.message);
      return { success: false, error: 'AI could not parse your text. Try being more specific.', goals: [] };
    }
  }

  if (text.trim().length <= 10) {
    return { success: false, error: 'Please provide at least a few sentences describing your goals.', goals: [] };
  }
  return { success: false, error: 'No AI provider configured for goal parsing. Configure one in Settings → AI Providers.', goals: [] };
});
}
