/**
 * Goal-related IPC handlers extracted from main.ts.
 * Registered via registerGoalHandlers(db, deps).
 */

import { ipcMain, BrowserWindow } from 'electron';
import Database from 'better-sqlite3';

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
  try {
    const { parentId, parentIdsJson } = goalParentIdsToColumns(goal);
    const id = ensureGoalId(goal.id);
    db!.prepare(`
      INSERT OR REPLACE INTO goals (id, date, title, description, category, target_type, target_seconds, match_category, status, period, source, links, progress_seconds, completed_at, priority, parent_id, parent_ids, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, date, goal.title, goal.description || null,
      goal.category || 'work', goal.target?.type || 'time', goal.target?.targetSeconds || null, goal.target?.matchCategory || null,
      goal.status || 'pending', goal.period || 'daily', goal.source || 'manual',
      JSON.stringify(goal.links || []), goal.progressSeconds || 0, goal.completedAt || null,
      goal.priority ?? 0, parentId, parentIdsJson, goal.deadline || null,
    );
    // Capture goal episode into context brain
    try {
      const existing = db!.prepare('SELECT status FROM goals WHERE id = ?').get(id) as any;
      const action = goal.status === 'done' ? 'completed' : (!existing ? 'created' : 'updated');
      episodeWriters.writeGoalEpisode({ ...goal, id }, action);
    } catch {}
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
    updatedAt: r.updated_at,
  };
}

const LIFE_PHASE_INSERT = `
  INSERT OR REPLACE INTO life_phases (id, title, description, category, start_month, start_year, end_month, end_year, magnitude, color, reflection, era_trends, impact_notes, milestones, connections, people, mood_start, mood_end, mood_tags, feelings_note, lessons_learned, header_image_memory_id, color_source, reflection_source, reflection_generated_at, status, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`;

function upsertLifePhase(phase: any) {
  db!.prepare(LIFE_PHASE_INSERT).run(
    phase.id, phase.title, phase.description || '', phase.category || 'growth',
    phase.startMonth, phase.startYear, phase.endMonth ?? null, phase.endYear ?? null,
    phase.magnitude ?? 50, phase.color || '#fbbf24', phase.reflection || '',
    phase.eraTrends || '', phase.impactNotes || '',
    JSON.stringify(phase.milestones || []), JSON.stringify(phase.connections || []),
    JSON.stringify(phase.people || []), phase.moodStart ?? null, phase.moodEnd ?? null,
    JSON.stringify(phase.moodTags || []), phase.feelingsNote || null,
    phase.lessonsLearned || null, phase.headerImageMemoryId || null,
    phase.colorSource || 'category', phase.reflectionSource || null,
    phase.reflectionGeneratedAt || null, phase.status || 'complete',
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
    const insert = db!.prepare(`
      INSERT OR REPLACE INTO goals (id, date, title, description, category, target_type, target_seconds, match_category, status, period, source, links, progress_seconds, completed_at, parent_id, parent_ids, priority, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db!.transaction((items: any[]) => {
      for (const g of items) {
        const { parentId, parentIdsJson } = goalParentIdsToColumns(g);
        // This is the writer that produced the 9 NULL-id rows in the live DB:
        // its default source is 'ai_assistant', and g.id was inserted raw.
        // Report the minted ids back so the caller can reconcile its own state.
        g.id = ensureGoalId(g.id);
        insert.run(
          g.id, g.date || '2000-01-01', g.title, g.description || null,
          g.category || 'work', g.target?.type || 'custom', g.target?.targetSeconds || null, g.target?.matchCategory || null,
          g.status || 'pending', g.period || 'daily', g.source || 'ai_assistant',
          JSON.stringify(g.links || []), g.progressSeconds || 0, g.completedAt || null,
          parentId, parentIdsJson, g.priority ?? 0, g.deadline || null,
        );
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

ipcMain.handle('get-reminders', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM reminders ORDER BY created_at ASC').all() as any[];
    return { success: true, reminders: rows.map(r => ({ ...r, done: !!r.done })) };
  } catch (err: any) {
    return { success: false, error: err.message, reminders: [] };
  }
});

ipcMain.handle('create-reminder', async (_event, data: { text: string; due_date?: string; goal_id?: string; due_time?: string }) => {
  try {
    const id = 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    // Normalize any ISO timestamp to a YYYY-MM-DD date so the calendar grid
    // (which keys by date) and daysUntil() line up. Raw timestamps previously
    // produced NaN counts and never landed on the calendar.
    const normDate = data.due_date ? data.due_date.slice(0, 10) : null;
    // due_time is its own HH:mm column rather than being folded into due_date,
    // so the date-keyed calendar grid keeps working while a time-of-day shows.
    const rawTime = String(data.due_time || '').trim();
    const normTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime)
      ? rawTime.split(':').map((n: string) => n.padStart(2, '0')).join(':')
      : null;
    db!.prepare('INSERT INTO reminders (id, text, due_date, goal_id, done, due_time) VALUES (?, ?, ?, ?, 0, ?)').run(
      id, data.text, normDate, data.goal_id || null, normTime,
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
    db!.prepare(`INSERT INTO todos (id, text, goal_id, schedule_id, parent_todo_id, deadline_id, due_date, reminder, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, String(data.text || '').trim(), data.goalId || null, data.scheduleId || null, data.parentTodoId || null, data.deadlineId || null, data.dueDate || null, data.reminder || 'none', Number(data.sortOrder) || 0);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

ipcMain.handle('todo:update', async (_event, id: string, patch: any) => {
  try {
    const current = db!.prepare('SELECT goal_id, schedule_id, parent_todo_id FROM todos WHERE id = ?').get(id) as any;
    if (!current) return { success: false, error: 'Todo not found' };
    const next = { ...current, ...patch };
    if ([next.goalId ?? next.goal_id, next.scheduleId ?? next.schedule_id, next.parentTodoId ?? next.parent_todo_id].filter(Boolean).length > 1) return { success: false, error: 'A todo can have only one hierarchy parent' };
    const map: Record<string, string> = { text: 'text', done: 'done', goalId: 'goal_id', scheduleId: 'schedule_id', parentTodoId: 'parent_todo_id', deadlineId: 'deadline_id', dueDate: 'due_date', reminder: 'reminder', sortOrder: 'sort_order' };
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

function getGoalConnections(goalId: string) {
  const goal = db!.prepare('SELECT id, title, category, is_habit, parent_id, parent_ids FROM goals WHERE id = ?').get(goalId) as any;
  if (!goal) return { success: false, error: 'Goal not found' };
  return { success: true, goal, parentLtgs: goal.parent_id ? db!.prepare('SELECT id, title, category FROM goals WHERE id = ?').all(goal.parent_id) : [], childGoals: db!.prepare('SELECT id, title, category, is_habit FROM goals WHERE parent_id = ? OR parent_ids LIKE ?').all(goalId, `%"${goalId}"%`), todos: db!.prepare('SELECT * FROM todos WHERE goal_id = ? ORDER BY done, sort_order, created_at').all(goalId), schedules: db!.prepare('SELECT * FROM schedule_entries WHERE goal_id = ? ORDER BY day_of_week, start_time').all(goalId), deadlines: db!.prepare('SELECT * FROM deadlines WHERE goal_id = ? ORDER BY due_date').all(goalId), notes: [], brainEntities: [] };
}

ipcMain.handle('goal:get-connections', async (_event, goalId: string) => {
  try { return getGoalConnections(goalId); } catch (err: any) { return { success: false, error: String(err?.message || err) }; }
});

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
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('delete-schedule-entry', async (_event, id: string) => {
  try {
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
    db!.prepare('INSERT INTO deadlines (id, title, course, due_date, priority, description, category, remind_at, goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, dl.title, dl.course || null, normDue, dl.priority || 'medium', dl.description || null, dl.category || null, normRemind, dl.goal_id || null);
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
    const allowed = ['title', 'course', 'due_date', 'priority', 'description', 'category', 'recurrence', 'status', 'remind_at', 'goal_id'];
    const fields = Object.keys(patch).filter(k => allowed.includes(k) && patch[k] !== undefined);
    if (fields.length === 0) return { success: true };
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => patch[f]);
    db!.prepare(`UPDATE deadlines SET ${sets} WHERE id = ?`).run(...vals, id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
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
    const config = JSON.parse(row.config);
    let itemsAdded = 0;
    if (row.type === 'email' && row.provider === 'imap') {
      const Imap = require('node-imap');
      const { simpleParser } = require('mailparser');
      const imapCfg = {
        user: config.username, password: config.password,
        host: config.host, port: config.port, tls: config.tls,
        tlsOptions: { rejectUnauthorized: false },
      };
      const rawItems: any[] = await new Promise((resolve, reject) => {
        const imap = new Imap(imapCfg);
        const results: any[] = [];
        imap.once('ready', () => {
          imap.openBox(config.folder || 'INBOX', true, (err: any, box: any) => {
            if (err) { imap.end(); reject(err); return; }
            const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 19)}:*`, { bodies: '', markSeen: false });
            fetch.on('message', (msg: any, seqno: number) => {
              let raw = '';
              msg.on('body', (stream: any) => { stream.on('data', (chunk: any) => { raw += chunk.toString('utf8'); }); });
              msg.on('attributes', (attrs: any) => { msg._attrs = attrs; });
              msg.on('end', () => { results.push({ seqno, raw, attrs: msg._attrs }); });
            });
            fetch.once('error', (e: any) => { imap.end(); reject(e); });
            fetch.once('end', () => { imap.end(); resolve(results); });
          });
        });
        imap.once('error', reject);
        imap.connect();
      });
      const ins = db!.prepare(`INSERT OR REPLACE INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'email', ?, ?, ?, ?, ?)`);
      for (const item of rawItems) {
        try {
          const parsed = await simpleParser(item.raw);
          const itemId = `ci_${id}_${item.seqno}`;
          const dateStr = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const fromAddr = parsed.from?.text || '';
          const subject = parsed.subject || '(no subject)';
          const snippet = (parsed.text || '').slice(0, 200).replace(/\s+/g, ' ').trim();
          const isRead = item.attrs?.flags?.includes('\\Seen') ? 1 : 0;
          ins.run(itemId, id, subject, snippet, dateStr, isRead, JSON.stringify({ from: fromAddr, sequenceNumber: item.seqno }));
          itemsAdded++;
        } catch {}
      }
    } else if (row.type === 'calendar' && row.provider === 'caldav') {
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fmtDt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const calBody = `<?xml version="1.0" encoding="utf-8"?><C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:getetag/><C:calendar-data/></D:prop><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:time-range start="${fmtDt(now)}" end="${fmtDt(weekLater)}"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>`;
      // Same helper as test/create/update: http:// supported, redirects followed.
      const report = await calDavRequest(normalizeCalDavUrl(config.url, config.username), {
        method: 'REPORT',
        username: config.username,
        password: config.password,
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: calBody,
        timeoutMs: 15000,
      });
      if (report.status < 200 || report.status >= 300) {
        const detail = report.body.length < 200 ? report.body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
        throw new Error(`Calendar sync failed (HTTP ${report.status})${detail ? ' — ' + detail : ''}`);
      }
      const body = report.body;
      // iCalendar folds long lines and escapes text; unfold (CRLF + space/tab)
      // before matching, otherwise SUMMARY/DESCRIPTION spanning a fold boundary
      // is silently truncated and the event shows half a title.
      const unfolded = body.replace(/\r?\n[ \t]/g, '');
      const icalUnescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_m, c) => (c === 'n' || c === 'N' ? '\n' : c));
      const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
      const matches = unfolded.match(veventRegex) || [];
      const ins = db!.prepare(`INSERT OR REPLACE INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`);
      for (const ve of matches) {
        const uidMatch = ve.match(/UID:(.*)/);
        const summaryMatch = ve.match(/SUMMARY[^:]*:(.*)/);
        const dtStartMatch = ve.match(/DTSTART[^:]*:(.*)/);
        const dtEndMatch = ve.match(/DTEND[^:]*:(.*)/);
        if (summaryMatch && dtStartMatch) {
          const summary = icalUnescape(summaryMatch[1].trim());
          ins.run(`ci_${id}_${uidMatch?.[1]?.trim() || Date.now()}`, id, summary, summary, dtStartMatch[1].trim(), JSON.stringify({ startTime: dtStartMatch[1]?.trim(), endTime: dtEndMatch?.[1]?.trim() }));
          itemsAdded++;
        }
      }
    }
    db!.prepare("UPDATE connectors SET last_sync = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    // Capture connector sync episode into context brain
    try {
      episodeWriters.writeConnectorEpisode(row, Array.from({ length: Math.min(itemsAdded, 5) }), itemsAdded > 0 ? 'synced' : 'new_items');
    } catch {}
    // Detect new unread emails and notify renderer
    if (row.type === 'email' && itemsAdded > 0) {
      const unreadCount = db!.prepare('SELECT COUNT(*) as cnt FROM connector_items WHERE connector_id = ? AND item_type = ? AND is_read = 0').get(id, 'email') as any;
      if (unreadCount?.cnt > 0) {
        const latestItems = db!.prepare('SELECT id, subject, summary, date, metadata FROM connector_items WHERE connector_id = ? AND item_type = ? AND is_read = 0 ORDER BY date DESC LIMIT 5').all(id, 'email');
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach((win: any) => {
          win.webContents.send('connectors:new-emails', {
            connectorId: id,
            connectorName: row.display_name,
            unreadCount: unreadCount.cnt,
            newItems: latestItems,
          });
        });
      }
    }
    return { success: true, itemsAdded, itemsUpdated: 0 };
  } catch (err: any) {
    return { success: false, error: err.message, itemsAdded: 0, itemsUpdated: 0 };
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
