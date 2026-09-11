// Content Engine — full backend module (tables, IPC, AI bridge).
// v2.0.0: 14-criteria rubric + 3 scoring schemes + process timeline +
// human reflection + analytics import + score calibration + learning-loop promotion.
// Registered from main.ts like services/learn. All AI calls go through the
// provider chain via the aiCall closure (buildChain 'contentEngine' + runWithFallback).
import { ipcMain } from 'electron';
import { NON_NEGOTIABLE_IDS, RETENTION_CRITERIA_IDS, RETENTION_RUBRIC } from './rubric';
import { parseAiJson } from './responseParser';
import {
  contentEngineSystem,
  PROMPT_ANALYTICS_IMPORT,
  PROMPT_CLASSIFY_IDEA,
  PROMPT_FRAMEWORK_UPDATE,
  PROMPT_GATE_VALIDATOR,
  PROMPT_HUMAN_REFLECTION,
  PROMPT_LESSON_EXTRACTOR,
  PROMPT_PROCESS_SUMMARY,
  PROMPT_SCORE_CALIBRATION,
  PROMPT_SCRIPT_FRAMES,
  PROMPT_REGENERATE_LINE,
  PROMPT_SEO_INJECTOR,
  PROMPT_SYNTHESIZE_IDEAS,
  PROMPT_THEME_GENERATOR,
  PROMPT_ANALYTICS_INSIGHT,
  PROMPT_VALIDATE_SCRIPT_EVIDENCE,
  PROMPT_VARIABLE_CORRELATION,
} from './prompts';
import { writeContentEngineEpisode } from '../../main/ai/episodeWriters';
import {
  SCORING_SCHEMES,
  computeFrameScore,
  estimateSchemeForEpisode,
  getScheme,
  schemeSummary,
  schemeWeightsForPrompt,
} from './scoringSchemes';
import { transcribeWithWhisper } from './whisper';
import { buildCaptionFromTranscript } from '../../lib/captionBuilder';

// ── Style directive builder (mirrors renderer templates/templateData.ts) ──
const STYLE_PKG: Record<string, { category: string; tone?: string; explanationStyle?: string; visualDirective?: string; depth?: string }> = {
  'punchy-short': { category: 'tone', tone: 'Conversational, punchy, zero filler. Write like you text your smartest friend.', explanationStyle: 'Evidence is a single quoted phrase. No paragraphs.', visualDirective: 'Every frame needs a 5-word visual note.' },
  'storyteller': { category: 'tone', tone: 'Narrative, warm, emotionally engaged. Build tension between beats.', explanationStyle: 'Evidence includes emotional mechanism: "This creates curiosity because..."', visualDirective: 'Each frame includes a visual that supports the emotional arc.' },
  'data-nerd': { category: 'tone', tone: 'Analytical, precise, authority-building. Lead with data.', explanationStyle: 'Evidence is a metric: "This targets completion rate by front-loading payoff at 3s."', visualDirective: 'Each frame includes data visualization notes.' },
  'chaos-creator': { category: 'tone', tone: 'Unpredictable, provocative, pattern-breaking.', explanationStyle: 'Evidence focuses on the pattern interrupt mechanism.', visualDirective: 'Every frame needs a visual surprise.' },
  'cinematic': { category: 'visual', tone: 'Professional, evocative, film-literate.', explanationStyle: 'Evidence links visual choices to retention.', visualDirective: 'Every frame has a full shot description: camera, lighting, color, mood.' },
  'minimal-visual': { category: 'visual', tone: 'Clean, minimal, confident.', explanationStyle: 'Simple visual = less cognitive load = higher completion.', visualDirective: 'One-line visual note per frame.' },
  'deep-dive': { category: 'depth', tone: 'Thorough, expert, every choice justified.', explanationStyle: 'Full evidence chain: criterion → wording → mechanism → impact → confidence.', visualDirective: 'Detailed visual breakdowns with alternatives.' },
  'quick-fire': { category: 'depth', tone: 'Direct, no preamble. Just the output.', explanationStyle: 'Minimal evidence: one sentence per frame.', visualDirective: 'Visual: one word or phrase per frame.' },
  'listicle': { category: 'format', tone: 'Energetic, ranking-focused. Countdown energy.', explanationStyle: 'List format creates completion bias.', visualDirective: 'Each frame gets a number overlay.' },
  'qa-format': { category: 'format', tone: 'Curious, Socratic. Question → pause → answer.', explanationStyle: 'Question → pause → answer creates curiosity gap.', visualDirective: 'Question frames: "?" visual. Answer frames: reveal.' },
};
function buildStyleDirective(ids: string[]): string {
  if (!ids?.length) return '';
  const parts: string[] = [];
  for (const id of ids) {
    const pkg = STYLE_PKG[id];
    if (!pkg) continue;
    if (pkg.tone) parts.push(`TONE: ${pkg.tone}`);
    if (pkg.visualDirective) parts.push(`VISUAL: ${pkg.visualDirective}`);
    if (pkg.explanationStyle) parts.push(`EVIDENCE: ${pkg.explanationStyle}`);
  }
  return parts.join('\n');
}

function findWhisperBin(): string | null {
  const customPath = process.env.WHISPER_PATH || '';
  if (customPath) try { require('fs').accessSync(customPath); return customPath; } catch {}
  const candidates = ['whisper', 'whisper.cpp/main'];
  for (const c of candidates) {
    try { require('child_process').execSync(`where ${c}`, { stdio: 'ignore' }); return c; } catch {}
  }
  return null;
}

export type AiCall = (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<string>;

const JSON_SYSTEM = 'You are a precise JSON generator. You ALWAYS respond with valid JSON only.';

function now() {
  return new Date().toISOString();
}

export function registerContentEngineHandlers(db: any, aiCall: AiCall) {
  try {
    ensureTables(db);
  } catch (e: any) {
    console.error('[ContentEngine] ensureTables failed (handlers will self-heal tables):', e?.message);
  }
  try {
    seedBuiltins(db);
  } catch (e: any) {
    console.error('[ContentEngine] seedBuiltins failed (continuing):', e?.message);
  }

  // ── process timeline (auto-logged on every AI call / user action) ──
  function logEvent(episodeId: number | null | undefined, eventType: string, label?: string, detail?: any) {
    if (!episodeId) return;
    try {
      db.prepare('INSERT INTO process_timeline (episode_id, event_type, label, detail) VALUES (?,?,?,?)').run(
        episodeId,
        eventType,
        label || null,
        detail ? JSON.stringify(detail) : null
      );
    } catch {
      /* timeline logging must never break the flow */
    }
  }

  // ── script input composition: framework rules + lessons + reflection patterns ──
  function buildScriptInput(episodeId?: number | null, idea?: any, ep?: any) {
    const frameworks = db.prepare('SELECT * FROM content_frameworks WHERE is_active=1 ORDER BY is_builtin DESC, name ASC').all();
    const fwRules = frameworks.flatMap((f: any) => {
      const rules = safeJson(f.rules, []);
      return rules.map((r: any) => `[${f.name}] ${r.rule}`);
    });
    const lessons = db
      .prepare('SELECT * FROM content_lessons WHERE status=? ORDER BY confidence DESC LIMIT 10')
      .all('active')
      .map((l: any) => `[${l.applies_to || 'general'}] ${l.lesson} (confidence ${l.confidence})`);
    let reflections: string[] = [];
    if (episodeId) {
      const reflRows = db.prepare('SELECT analysis FROM video_reflections WHERE episode_id=? ORDER BY created_at DESC LIMIT 3').all(episodeId);
      reflections = reflRows.flatMap((r: any) => {
        const a = safeJson(r.analysis, null);
        if (!a) return [];
        return [a.extracted_pattern, a.suggested_lesson?.lesson].filter(Boolean);
      });
    }
    return {
      framework_rules: fwRules.length ? fwRules.join('\n') : '(no framework rules yet — use the 3-Cs and value-loop criteria)',
      lessons: lessons.length ? lessons.join('\n') : '(no proven lessons yet)',
      reflection_patterns: reflections.length ? reflections.join('\n') : '(none yet)',
    };
  }

  // ── Ideas ────────────────────────────────────────────────
  ipcMain.handle('content:ideas:list', async () => {
    const rows = db.prepare('SELECT * FROM content_ideas ORDER BY updated_at DESC').all();
    return rows.map(mapIdea);
  });
  ipcMain.handle('content:ideas:save', async (_, idea: any) => {
    const ts = now();
    const VALID_FORMATS = ['listicle', 'proof_first', 'before_after', 'single_insight', 'concept_explainer', 'hot_take', 'reaction', 'other'];
    if (idea.format_type && !VALID_FORMATS.includes(idea.format_type)) idea.format_type = 'other';
    if (idea.id) {
      db.prepare(
        `UPDATE content_ideas SET title=?, hook=?, format_type=?, status=?, priority=?, series=?, niche=?, frames=?, synthesized_from=?, gates=?, brainstorm_id=?, updated_at=? WHERE id=?`
      ).run(
        idea.title,
        idea.hook || null,
        idea.format_type || 'listicle',
        idea.status || 'raw',
        idea.priority ?? 3,
        idea.series || null,
        idea.niche || null,
        JSON.stringify(idea.frames || []),
        JSON.stringify(idea.synthesized_from || []),
        JSON.stringify(idea.gates || null),
        idea.brainstorm_id || null,
        ts,
        idea.id
      );
      try { writeContentEngineEpisode({ kind: 'idea', title: idea.title || 'Untitled idea', detail: idea.hook || '', refId: idea.id }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
      return { ok: true, id: idea.id };
    }
    const info = db
      .prepare(
        `INSERT INTO content_ideas (title, hook, format_type, status, priority, series, niche, frames, synthesized_from, gates, brainstorm_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        idea.title,
        idea.hook || null,
        idea.format_type || 'listicle',
        idea.status || 'raw',
        idea.priority ?? 3,
        idea.series || null,
        idea.niche || null,
        JSON.stringify(idea.frames || []),
        JSON.stringify(idea.synthesized_from || []),
        JSON.stringify(idea.gates || null),
        idea.brainstorm_id || null,
        ts,
        ts
      );
    try { writeContentEngineEpisode({ kind: 'idea', title: idea.title || 'Untitled idea', detail: idea.hook || '', refId: info.lastInsertRowid }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:ideas:delete', async (_, id: number) => {
    db.prepare('DELETE FROM content_ideas WHERE id=?').run(id);
    return { ok: true };
  });

  // ── Episodes ─────────────────────────────────────────────
  ipcMain.handle('content:episodes:list', async (_, { ideaId }: any = {}) => {
    const rows = ideaId
      ? db.prepare('SELECT * FROM content_episodes WHERE idea_id=? ORDER BY updated_at DESC').all(ideaId)
      : db.prepare('SELECT * FROM content_episodes ORDER BY updated_at DESC').all();
    return rows.map(mapEpisode);
  });
  ipcMain.handle('content:episodes:get', async (_, id: number) => {
    const row = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(id);
    return row ? mapEpisode(row) : null;
  });
  ipcMain.handle('content:episodes:save', async (_, ep: any) => {
    const ts = now();
    if (ep.id) {
      db.prepare(
        `UPDATE content_episodes SET title=?, idea_id=?, theme_id=?, series_id=?, episode_number=?, status=?, niche=?, script=?, seo=?, gates=?, gate_override=?, scheme_id=?, overlay_session_id=?, caption_track=?, published_at=?, updated_at=? WHERE id=?`
      ).run(
        ep.title,
        ep.idea_id || null,
        ep.theme_id || null,
        ep.series_id || null,
        ep.episode_number || null,
        ep.status || 'draft',
        ep.niche || null,
        JSON.stringify(ep.script || []),
        JSON.stringify(ep.seo || null),
        JSON.stringify(ep.gates || null),
        ep.gate_override ? 1 : 0,
        ep.scheme_id || getScheme(ep.scheme_id).id,
        ep.overlay_session_id || null,
        JSON.stringify(ep.caption_track || null),
        ep.published_at || null,
        ts,
        ep.id
      );
      if (ep.status === 'published' && ep.published_at) logEvent(ep.id, 'published', `Published: ${ep.title}`);
      try { writeContentEngineEpisode({ kind: 'episode', title: ep.title || 'Untitled episode', detail: ep.niche || '', refId: ep.id }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
      return { ok: true, id: ep.id };
    }
    const info = db
      .prepare(
        `INSERT INTO content_episodes (title, idea_id, theme_id, series_id, episode_number, status, niche, script, seo, gates, gate_override, scheme_id, overlay_session_id, caption_track, published_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        ep.title,
        ep.idea_id || null,
        ep.theme_id || null,
        ep.series_id || null,
        ep.episode_number || null,
        ep.status || 'draft',
        ep.niche || null,
        JSON.stringify(ep.script || []),
        JSON.stringify(ep.seo || null),
        JSON.stringify(ep.gates || null),
        ep.gate_override ? 1 : 0,
        ep.scheme_id || getScheme(ep.scheme_id).id,
        ep.overlay_session_id || null,
        JSON.stringify(ep.caption_track || null),
        ep.published_at || null,
        ts,
        ts
      );
    const newId = info.lastInsertRowid;
    logEvent(Number(newId), 'episode_created', `Episode created: ${ep.title}${ep.series_id ? ` in series ${ep.series_id}` : ''}`);
    try { writeContentEngineEpisode({ kind: 'episode', title: ep.title || 'Untitled episode', detail: ep.niche || '', refId: newId }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
    return { ok: true, id: newId };
  });
  ipcMain.handle('content:episodes:delete', async (_, id: number) => {
    db.prepare('DELETE FROM content_episodes WHERE id=?').run(id);
    return { ok: true };
  });

  // ── Unified Full Plan generation ──────
  ipcMain.handle('content:episode:plan-full', async (_, { episodeId, elements }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const epAny = ep as any;
    const idea = epAny.idea_id ? db.prepare('SELECT * FROM content_ideas WHERE id=?').get(epAny.idea_id) : null;
    const ideaAny = idea as any;
    const frameworks = db.prepare('SELECT * FROM content_frameworks WHERE is_active=1').all();
    const fwRules = frameworks.flatMap((f: any) => {
      const r = safeJson(f.rules, []);
      return r.map((rule: any) => `[${f.name}] ${rule.rule}`);
    });

    const generateAll = !elements || elements.length === 0 || elements.includes('all');
    const elementList = generateAll
      ? ['script_frames', 'hook_stack', 'curiosity_gaps', 'keywords_seo', 'caption', 'pinned_comment', 'timeline', 'gates']
      : elements;

    let scheme = getScheme(epAny.scheme_id);
    if (!epAny.scheme_id) {
      const stats = db.prepare('SELECT COUNT(*) c, AVG(views) avg_views FROM content_videos').get() as any;
      scheme = estimateSchemeForEpisode({ videoCount: stats?.c || 0, avgViews: stats?.avg_views || 0 });
    }

    const prompt = PROMPT_EPISODE_FULL_PLAN
      .replace('{{elements}}', JSON.stringify(elementList))
      .replace('{{idea}}', JSON.stringify(ideaAny ? { title: ideaAny.title, hook: ideaAny.hook, format_type: ideaAny.format_type } : { title: epAny.title }))
      .replace('{{niche}}', epAny.niche || ideaAny?.niche || 'general')
      .replace('{{format_type}}', ideaAny?.format_type || 'listicle')
      .replace('{{frameworks}}', fwRules.length ? fwRules.join('\n') : '(none yet)');

    const res = await parseAiJson<any>(
      prompt,
      { required: ['script_frames'] },
      (p, s) => aiCall(p, s, 6000),
      contentEngineSystem(scheme)
    );

    if (!res.ok) return { ok: false, error: `Full plan generation failed: ${res.error}` };

    const plan = res.data;
    const frames = Array.isArray(plan.script_frames) ? plan.script_frames.map((f: any, i: number) => ({
      ...f, index: i, timestamp: f.timestamp || fmtTs(i), rejected: false, rejection_reasons: [],
    })) : [];

    // Auto gate check
    const ideaText = ideaAny ? JSON.stringify({ title: ideaAny.title, hook: ideaAny.hook, format_type: ideaAny.format_type }) : '"(full plan)"';
    const gates = plan.gates || await runGateCheck(ideaText, frames);

    db.prepare(`UPDATE content_episodes SET
      script=?, seo=?, gates=?, caption=?, hook_stack=?, curiosity_gaps=?, timeline=?, pinned_comment=?,
      status=?, updated_at=? WHERE id=?`
    ).run(
      JSON.stringify(frames),
      JSON.stringify(plan.keywords_seo || []),
      JSON.stringify(gates),
      plan.caption || null,
      JSON.stringify(plan.hook_stack || null),
      JSON.stringify(plan.curiosity_gaps || []),
      JSON.stringify(plan.timeline || []),
      plan.pinned_comment || null,
      gates.overall === 'pass' ? 'scripted' : 'gated',
      now(),
      episodeId
    );
    logEvent(episodeId, 'full_plan_generated', `Full plan generated (${frames.length} frames, ${elementList.length} elements)`, { elements: elementList });

    return { ok: true, plan: { ...plan, script_frames: frames, gates } };
  });

  // ── Script generation (frames + retention evidence) ──────
  ipcMain.handle('content:script:generate', async (_, { episodeId, ideaId, schemeId }: any) => {
    let idea: any = null;
    let ep: any = null;
    if (episodeId) ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (ideaId || (ep && ep.idea_id)) {
      idea = db.prepare('SELECT * FROM content_ideas WHERE id=?').get(ideaId || ep.idea_id);
    }
    const niche = (idea?.niche || ep?.niche || 'general') as string;
    const format = idea?.format_type || 'listicle';
    const title = idea?.title || ep?.title || 'Untitled idea';
    const hook = idea?.hook || '';
    const framesPlan = idea?.frames || [];
    const ideaText = JSON.stringify({ title, hook, format_type: format, frames_plan: framesPlan });

    // Dynamic scheme: explicit > episode > maturity estimate from published videos.
    let scheme = getScheme(schemeId || ep?.scheme_id);
    if (!schemeId && !ep?.scheme_id) {
      const stats = db.prepare('SELECT COUNT(*) c, AVG(views) avg_views FROM content_videos').get() as any;
      scheme = estimateSchemeForEpisode({ videoCount: stats?.c || 0, avgViews: stats?.avg_views || 0 });
    }
    const composed = buildScriptInput(episodeId || ep?.id, idea, ep);

    const res = await parseAiJson<any>(
      PROMPT_SCRIPT_FRAMES
        .replace('{{format_type}}', format)
        .replace('{{niche}}', niche)
        .replace('{{duration}}', scheme.duration)
        .replace('{{scheme_weights}}', schemeWeightsForPrompt(scheme))
        .replace('{{framework_rules}}', composed.framework_rules)
        .replace('{{lessons}}', composed.lessons)
        .replace('{{reflection_patterns}}', composed.reflection_patterns)
        .replace('{{idea}}', ideaText),
      { required: ['frames'], arrayAt: 'frames' },
      (p, s) => aiCall(p, s, 4000),
      contentEngineSystem(scheme)
    );
    if (!res.ok) return { ok: false, error: `Script generation failed: ${res.error}` };

    const frames = res.data.frames.map((f: any, i: number) => ({
      ...f,
      index: i,
      timestamp: f.timestamp || fmtTs(i),
      rejected: false,
      rejection_reasons: [],
    }));

    // Auto gate-check the generated script
    const gates = await runGateCheck(ideaText, frames);
    const epId = episodeId || ep?.id;
    if (epId) {
      db.prepare('UPDATE content_episodes SET script=?, gates=?, status=?, scheme_id=?, updated_at=? WHERE id=?').run(
        JSON.stringify(frames),
        JSON.stringify(gates),
        gates.overall === 'pass' ? 'scripted' : 'gated',
        scheme.id,
        now(),
        epId
      );
      logEvent(epId, 'script_generated', `Script generated (${scheme.name}, ${frames.length} frames)`, { scheme_id: scheme.id, frames: frames.length });
    }
    return { ok: true, frames, gates, scheme: { id: scheme.id, name: scheme.name, tier: scheme.tier } };
  });

  ipcMain.handle('content:script:regenerate-line', async (_, { episodeId, frameIndex, instruction }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const script = JSON.parse(ep.script || '[]');
    const frame = script[frameIndex];
    if (!frame) return { ok: false, error: 'Frame not found' };

    const retentionRules = `Retention criteria (version ${RETENTION_RUBRIC.version}, threshold ${RETENTION_RUBRIC.threshold}): ${RETENTION_RUBRIC.criteria
      .map((c) => `${c.name} [${c.id}] (NON-NEGOTIABLE: ${c.non_negotiable}) — ${c.definition}`)
      .join('; ')}. Evidence rule: every frame must prove which criteria its exact wording satisfies. ${RETENTION_RUBRIC.nonNegotiableRule}`;
    const res = await parseAiJson<any>(
      PROMPT_REGENERATE_LINE
        .replace('{{score}}', String(frame.retention?.score ?? 0))
        .replace('{{threshold}}', String(RETENTION_RUBRIC.threshold))
        .replace('{{retention_rules}}', retentionRules)
        .replace('{{frame}}', JSON.stringify(frame))
        .replace('{{instruction}}', instruction || 'Make it stronger'),
      { required: ['text', 'retention'] },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Regeneration failed: ${res.error}` };

    const updated = { ...frame, ...res.data, index: frameIndex, timestamp: frame.timestamp, rejected: false, rejection_reasons: [] };
    script[frameIndex] = updated;
    db.prepare('UPDATE content_episodes SET script=?, updated_at=? WHERE id=?').run(JSON.stringify(script), now(), episodeId);
    logEvent(episodeId, 'bullet_regenerated', `Frame ${frameIndex + 1} regenerated`, { instruction: instruction || 'Make it stronger' });
    return { ok: true, frame: updated };
  });

  ipcMain.handle('content:validate-script-evidence', async (_, { episodeId }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const script = JSON.parse(ep.script || '[]');
    if (!script.length) return { ok: false, error: 'No script yet — generate one first' };

    const res = await parseAiJson<any>(
      PROMPT_VALIDATE_SCRIPT_EVIDENCE
        .replace('{{valid_ids}}', RETENTION_CRITERIA_IDS.join(', '))
        .replace('{{threshold}}', String(RETENTION_RUBRIC.threshold))
        .replace('{{non_negotiable}}', NON_NEGOTIABLE_IDS.join(', '))
        .replace('{{frames}}', JSON.stringify(script)),
      { required: ['frames'], arrayAt: 'frames' },
      (p, s) => aiCall(p, s, 3000)
    );
    if (!res.ok) return { ok: false, error: `Evidence validation failed: ${res.error}` };

    const results = res.data.frames;
    let failed = 0;
    for (const r of results) {
      if (r.pass && r.retention && script[r.index]) {
        script[r.index] = { ...script[r.index], retention: r.retention, rejected: false, rejection_reasons: [] };
      } else if (!r.pass && script[r.index]) {
        failed++;
        script[r.index] = {
          ...script[r.index],
          rejected: true,
          rejection_reasons: Array.isArray(script[r.index].rejection_reasons)
            ? [...script[r.index].rejection_reasons, r.reason || 'Evidence validation failed']
            : [r.reason || 'Evidence validation failed'],
        };
      }
    }
    db.prepare('UPDATE content_episodes SET script=?, updated_at=? WHERE id=?').run(JSON.stringify(script), now(), episodeId);
    logEvent(episodeId, 'evidence_validated', `${res.data.summary?.passed ?? 0}/${res.data.summary?.total ?? results.length} frames passed`, { failed });
    return { ok: true, results, script };
  });

  // ── 3-Gate validator + override ──────────────────────────
  async function runGateCheck(ideaText: string, frames: any[] = []) {
    try {
      const res = await parseAiJson<any>(
        PROMPT_GATE_VALIDATOR.replace('{{idea}}', JSON.stringify({ idea: ideaText, frames })),
        { required: ['scroll_stop', 'hard_cut', 'asset_ready', 'overall'] },
        (p, s) => aiCall(p, s, 2000)
      );
      if (res.ok) return { ...res.data, checked_at: now() };
    } catch (e) {
      // fall through to heuristic check
    }
    return {
      scroll_stop: { pass: !!(ideaText && ideaText.length > 0), reason: 'heuristic: hook present' },
      hard_cut: { pass: frames.length >= 1, reason: 'heuristic: frames exist' },
      asset_ready: { pass: true, reason: 'heuristic: assume available' },
      overall: frames.length >= 1 && !!ideaText ? 'pass' : 'fail',
      suggestions: [],
      checked_at: now(),
    };
  }

  ipcMain.handle('content:validate-gates', async (_, { ideaId, episodeId }: any) => {
    let idea: any = null;
    let ep: any = null;
    if (ideaId) idea = db.prepare('SELECT * FROM content_ideas WHERE id=?').get(ideaId);
    if (episodeId) ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    const ideaText = idea ? JSON.stringify({ title: idea.title, hook: idea.hook, frames: idea.frames }) : JSON.stringify({ title: ep?.title, frames: JSON.parse(ep?.script || '[]') });
    const gates = await runGateCheck(ideaText, JSON.parse(ep?.script || '[]'));
    if (idea) {
      db.prepare('UPDATE content_ideas SET gates=?, updated_at=? WHERE id=?').run(JSON.stringify(gates), now(), idea.id);
    }
    if (ep) {
      db.prepare('UPDATE content_episodes SET gates=?, updated_at=? WHERE id=?').run(JSON.stringify(gates), now(), ep.id);
    }
    return { ok: true, gates };
  });
  ipcMain.handle('content:gate-override', async (_, { episodeId, override }: any) => {
    db.prepare('UPDATE content_episodes SET gate_override=?, status=?, updated_at=? WHERE id=?').run(
      override ? 1 : 0,
      override ? 'scripted' : 'gated',
      now(),
      episodeId
    );
    logEvent(episodeId, 'gate_overridden', override ? 'Gates overridden — proceeding' : 'Gate override revoked');
    return { ok: true };
  });

  // ── SEO injector ─────────────────────────────────────────
  ipcMain.handle('content:inject-seo', async (_, { episodeId, niche }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const content = (ep.script ? JSON.parse(ep.script) : []).map((f: any) => f.text).join(' ');
    const res = await parseAiJson<any>(
      PROMPT_SEO_INJECTOR.replace('{{niche}}', niche || ep.niche || 'general').replace('{{content}}', content),
      { required: ['phrases'], arrayAt: 'phrases' },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `SEO generation failed: ${res.error}` };
    db.prepare('UPDATE content_episodes SET seo=?, updated_at=? WHERE id=?').run(JSON.stringify(res.data.phrases), now(), episodeId);
    logEvent(episodeId, 'seo_injected', `${res.data.phrases.length} SEO phrases injected`);
    return { ok: true, phrases: res.data.phrases };
  });

  // ── Idea synthesis ───────────────────────────────────────
  ipcMain.handle('ideas:synthesize', async (_, { note, count = 3 }: any = {}) => {
    const raw = db
      .prepare('SELECT title, hook, niche, series, priority FROM content_ideas WHERE status IN (?, ?) ORDER BY priority ASC LIMIT 30')
      .all('raw', 'refined');
    if (!raw.length) return { ok: true, ideas: [] };
    const res = await parseAiJson<any>(
      PROMPT_SYNTHESIZE_IDEAS
        .replace('{{note}}', note || 'Combine the weakest raw ideas into stronger ones.')
        .replace('{{count}}', String(count))
        .replace('{{ideas}}', JSON.stringify(raw)),
      { required: ['ideas'], arrayAt: 'ideas' },
      (p, s) => aiCall(p, s, 3000)
    );
    if (!res.ok) return { ok: false, error: `Synthesis failed: ${res.error}` };
    const ts = now();
    const saved: any[] = [];
    for (const idea of res.data.ideas) {
      const info = db
        .prepare(
          `INSERT INTO content_ideas (title, hook, format_type, status, priority, series, niche, frames, synthesized_from, gates, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          idea.title,
          idea.hook || '',
          idea.format_type || 'listicle',
          'raw',
          idea.priority ?? 3,
          idea.series || null,
          idea.niche || null,
          JSON.stringify(idea.frames || []),
          JSON.stringify(raw.map((r: any) => r.id)),
          JSON.stringify(idea.gates || null),
          ts,
          ts
        );
      saved.push({ id: info.lastInsertRowid, ...idea });
    }
    return { ok: true, ideas: saved };
  });

  // ── Brainstorm classification ────────────────────────────
  ipcMain.handle('content:brainstorm:classify', async (_, { thought }: any) => {
    if (!thought || !thought.trim()) return { ok: false, error: 'Empty thought' };
    try {
      const res = await parseAiJson<any>(
        PROMPT_CLASSIFY_IDEA.replace('{{thought}}', thought),
        { required: ['category'] },
        (p, s) => aiCall(p, s, 800)
      );
      if (res.ok) return { ok: true, ...res.data };
    } catch {
      /* fall through to local heuristic */
    }
    const heuristic = /^(how|why|what|best|worst|top|never|always|secret|tips|mistake|i tried|i tested)\b/i.test(thought.trim())
      ? 'content_idea'
      : 'general_thought';
    return { ok: true, category: heuristic, reason: 'local heuristic fallback (no AI provider)' };
  });

  // ── Brainstorms (persisted thoughts) ──────────────────────
  ipcMain.handle('content:brainstorms:list', async () => {
    const rows = db.prepare('SELECT * FROM content_brainstorms ORDER BY updated_at DESC').all();
    return rows.map(mapBrainstorm);
  });
  ipcMain.handle('content:brainstorms:save', async (_, b: any) => {
    const ts = now();
    const payload = {
      thought: b.thought || '',
      category: b.category || 'general_thought',
      format_type: b.format_type || null,
      niche_hint: b.niche_hint || null,
      suggested_title: b.suggested_title || null,
      reason: b.reason || null,
      summary: JSON.stringify(b.summary || null),
      idea_id: b.idea_id || null,
      status: b.status || 'draft',
    };
    if (b.id) {
      db.prepare(
        `UPDATE content_brainstorms SET thought=?, category=?, format_type=?, niche_hint=?, suggested_title=?, reason=?, summary=?, idea_id=?, status=?, updated_at=? WHERE id=?`
      ).run(payload.thought, payload.category, payload.format_type, payload.niche_hint, payload.suggested_title, payload.reason, payload.summary, payload.idea_id, payload.status, ts, b.id);
      return { ok: true, id: b.id };
    }
    const info = db
      .prepare(
        `INSERT INTO content_brainstorms (thought, category, format_type, niche_hint, suggested_title, reason, summary, idea_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(payload.thought, payload.category, payload.format_type, payload.niche_hint, payload.suggested_title, payload.reason, payload.summary, payload.idea_id, payload.status, ts, ts);
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:brainstorms:delete', async (_, id: number) => {
    db.prepare('DELETE FROM content_brainstorms WHERE id=?').run(id);
    return { ok: true };
  });

  // ── Series ────────────────────────────────────────────────
  ipcMain.handle('content:series:list', async () => {
    const rows = db.prepare('SELECT * FROM content_series ORDER BY updated_at DESC').all();
    return rows.map((r: any) => ({
      ...r,
      brand_colors: safeJson(r.brand_colors, {}),
      arc_outline: safeJson(r.arc_outline, []),
    }));
  });
  ipcMain.handle('content:series:get', async (_, id: number) => {
    const row = db.prepare('SELECT * FROM content_series WHERE id=?').get(id);
    if (!row) return null;
    const r = row as any;
    // Attach episode count + list
    const episodes = db.prepare('SELECT id, title, status, episode_number FROM content_episodes WHERE series_id=? ORDER BY episode_number ASC').all(id);
    return {
      ...r,
      brand_colors: safeJson(r.brand_colors, {}),
      arc_outline: safeJson(r.arc_outline, []),
      episodes,
    };
  });
  ipcMain.handle('content:series:save', async (_, s: any) => {
    const ts = now();
    if (s.id) {
      db.prepare(
        `UPDATE content_series SET name=?, description=?, niche=?, tone=?, visual_style=?, pacing=?, target_duration=?, brand_colors=?, episode_format=?, frame_mode=?, arc_outline=?, status=?, aspect_ratio=?, updated_at=? WHERE id=?`
      ).run(
        s.name, s.description || null, s.niche || null,
        s.tone || null, s.visual_style || null, s.pacing || null,
        s.target_duration || null, JSON.stringify(s.brand_colors || {}),
        s.episode_format || 'standard', s.frame_mode || 'strict',
        JSON.stringify(s.arc_outline || []), s.status || 'active',
        s.aspect_ratio || '9:16', ts, s.id
      );
      return { ok: true, id: s.id };
    }
    const info = db.prepare(
      `INSERT INTO content_series (name, description, niche, tone, visual_style, pacing, target_duration, brand_colors, episode_format, frame_mode, arc_outline, status, aspect_ratio, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      s.name, s.description || null, s.niche || null,
      s.tone || null, s.visual_style || null, s.pacing || null,
      s.target_duration || null, JSON.stringify(s.brand_colors || {}),
      s.episode_format || 'standard', s.frame_mode || 'strict',
      JSON.stringify(s.arc_outline || []), s.status || 'active',
      s.aspect_ratio || '9:16', ts, ts
    );
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:series:delete', async (_, id: number) => {
    // Unlink episodes but don't delete them
    db.prepare('UPDATE content_episodes SET series_id=NULL WHERE series_id=?').run(id);
    db.prepare('DELETE FROM content_series WHERE id=?').run(id);
    return { ok: true };
  });
  ipcMain.handle('content:series:add-episode', async (_, { seriesId, episodeId }: any) => {
    const maxNum = (db.prepare('SELECT MAX(episode_number) m FROM content_episodes WHERE series_id=?').get(seriesId) as any)?.m || 0;
    db.prepare('UPDATE content_episodes SET series_id=?, episode_number=? WHERE id=?').run(seriesId, maxNum + 1, episodeId);
    return { ok: true, episode_number: maxNum + 1 };
  });
  ipcMain.handle('content:series:remove-episode', async (_, { episodeId }: any) => {
    db.prepare('UPDATE content_episodes SET series_id=NULL, episode_number=NULL WHERE id=?').run(episodeId);
    return { ok: true };
  });
  ipcMain.handle('content:series:reorder', async (_, { seriesId, episodeIds }: any) => {
    for (let i = 0; i < episodeIds.length; i++) {
      db.prepare('UPDATE content_episodes SET episode_number=? WHERE id=? AND series_id=?').run(i + 1, episodeIds[i], seriesId);
    }
    return { ok: true };
  });

  // ── External AI: format-only prompts (user pastes into EXISTING conversation) ──────
  ipcMain.handle('content:external:build-classify-prompt', async (_, { templateIds, frameMode }: any) => {
    const style = buildStyleDirective(templateIds || []);
    const modeDirective = frameMode === 'strict'
      ? 'FRAME MODE: STRICT — Every output field is mandatory. Do not skip any field.'
      : 'FRAME MODE: FLEXIBLE — Follow the schema but creative variation allowed.';
    // Format-only prompt: no thought text, no context. The AI conversation already has that.
    const prompt = `Based on our conversation above, classify my latest thought. Return ONLY this JSON (no explanation, no markdown):

{
  "category": "content_idea" | "framework_update" | "system_improvement" | "analytics" | "general_thought",
  "reason": "one sentence why",
  "suggested_title": "title if content_idea, else null",
  "format_type": "listicle" | "story" | "commentary" | "question" | "vlog" | "other" | null,
  "niche_hint": "niche guess or null"
}
${modeDirective}${style ? '\n' + style : ''}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:build-synthesize-prompt', async (_, { count, templateIds, frameMode }: any) => {
    const style = buildStyleDirective(templateIds || []);
    const modeDirective = frameMode === 'strict'
      ? 'FRAME MODE: STRICT — Every output field is mandatory. Each idea MUST include ALL fields: title, hook, format_type, niche, series, priority (1-5), frames (3-8 strings), gates (a/b/c with pass+reason), retention (criteria+mechanism+evidence+score). Do not skip any field.'
      : 'FRAME MODE: FLEXIBLE — Include all fields but creative variation allowed.';
    const prompt = `Based on our conversation above, generate ${count || 3} content ideas. Return ONLY this JSON (no explanation, no markdown):

{
  "ideas": [
    {
      "title": "string",
      "hook": "exact hook line (0-5s)",
      "format_type": "listicle" | "story" | "commentary" | "question" | "vlog" | "other",
      "niche": "string",
      "series": "string or null",
      "priority": 1-5,
      "frames": ["3-8 frame plan lines as strings"],
      "gates": { "a": {"pass": true, "reason": "..."}, "b": {"pass": true, "reason": "..."}, "c": {"pass": true, "reason": "..."} },
      "retention": { "criteria": ["criterion ids"], "mechanism": "how it works", "evidence": "why it proves it", "score": 0.0-1.0 }
    }
  ]
}
${modeDirective}${style ? '\n' + style : ''}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:build-script-prompt', async (_, { episodeId, templateIds, frameMode, sections }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const series = ep?.series_id ? db.prepare('SELECT * FROM content_series WHERE id=?').get(ep.series_id) : null;
    const style = buildStyleDirective(templateIds || []);
    const aspectRatio = (ep as any)?.aspect_ratio || (series as any)?.aspect_ratio || '9:16';
    const aspectLabel = aspectRatio === '9:16' ? 'vertical/portrait (TikTok, Reels, Shorts)' : aspectRatio === '16:9' ? 'horizontal/landscape (YouTube)' : 'square (Instagram post)';

    // Build series context (short, just the rules)
    let seriesRules = '';
    if (series) {
      const s = series as any;
      const parts: string[] = [];
      if (s.name) parts.push(`SERIES: "${s.name}"`);
      if (s.tone) parts.push(`TONE: ${s.tone}`);
      if (s.visual_style) parts.push(`VISUAL: ${s.visual_style}`);
      if (s.pacing) parts.push(`PACING: ${s.pacing}`);
      if (s.target_duration) parts.push(`DURATION: ${s.target_duration}`);
      if (s.frame_mode) parts.push(`MODE: ${s.frame_mode}`);
      if (s.aspect_ratio) parts.push(`ASPECT: ${s.aspect_ratio}`);
      seriesRules = parts.join(' | ');
    }

    const modeDirective = frameMode === 'strict'
      ? 'FRAME MODE: STRICT — Every frame MUST include ALL fields: text, duration_seconds, frame_type (hook/value/transition/call_to_action/visual_only), visual, retention (criteria+mechanism+evidence+score 0-1). No field may be omitted.'
      : 'FRAME MODE: FLEXIBLE — Include all fields but creative variation allowed.';

    // Determine which sections to include (default: all if no sections param)
    const enabledSections = new Set(sections && Array.isArray(sections) && sections.length > 0
      ? sections
      : ['retention_rules', 'evidence_contract', 'visual_dynamics', 'sound_design', 'hook_frameworks', 'seo_phrases', 'format_rules', 'scoring_weights', 'framework_rules', 'lessons', 'reflection']);

    // Build section blocks
    const sectionBlocks: string[] = [];

    if (enabledSections.has('retention_rules')) {
      sectionBlocks.push(`RETENTION RUBRIC (v${RETENTION_RUBRIC.version}, threshold ${RETENTION_RUBRIC.threshold}):
${RETENTION_RUBRIC.criteria.map(c => `- ${c.name} [${c.id}] (timeline ${c.timeline}, NON-NEGOTIABLE: ${c.non_negotiable}): ${c.definition}`).join('\n')}
RULE: ${RETENTION_RUBRIC.nicheRule}
NON-NEGOTIABLE RULE: ${RETENTION_RUBRIC.nonNegotiableRule}`);
    }

    if (enabledSections.has('evidence_contract')) {
      sectionBlocks.push(`EVIDENCE CONTRACT — every frame MUST have this:
{
  "criteria": ["criterion_ids"],
  "mechanism": "how the wording works — be specific about the psychology",
  "evidence": "QUOTE the exact words that prove the criteria. No hand-waving.",
  "score": 0.0-1.0
}
RULE: Evidence MUST be a direct substring quote from the frame's text. If you can't quote it, the criterion isn't satisfied. Score < ${RETENTION_RUBRIC.threshold} = REJECTED.`);
    }

    if (enabledSections.has('visual_dynamics')) {
      sectionBlocks.push(`VISUAL DYNAMICS (3-Layer Rule — every scene must have at least 2 layers):
- Layer 1: Main content (screen recording, code, diagram)
- Layer 2: Face cam (small, bottom-right 270×360px, 12px radius)
- Layer 3: Text overlay / annotation / animation

SCENE SWITCHING PATTERNS:
- Pattern A (A/B Cut): Face (3s) → Screen (5s) → Face (2s) → Screen (4s)
- Pattern B (Zoom Cascade): Wide (2s) → Medium (3s) → Close (2s) → Wide (2s)
- Pattern C (Split Screen): Left = "Wrong way" (red), Right = "Right way" (green)`);
    }

    if (enabledSections.has('sound_design')) {
      sectionBlocks.push(`SOUND DESIGN:
- Transitions: Whoosh (scene changes), Click (text appearing), Pop (badges), Ding (success)
- Music: Duck to 20% when speaking, ramp to 100% during pauses
- Tempo: 120-140 BPM for fast tutorials, 90-110 BPM for explanations
- Edit notes: acoustic_ducking (-3 to -6 dB under voice), seamless_loop where relevant`);
    }

    if (enabledSections.has('hook_frameworks')) {
      sectionBlocks.push(`HOOK FRAMEWORKS:
- Shock-to-Logic: "Stop doing X. It's the reason you're getting Y."
- Specific Result: "I got [X-result] in [X-time] by doing this."
- Open Loop: "Wait for the last part — this is where everyone gets it wrong."
- Contrarian: "Unpopular opinion: [common advice] is actually holding you back."
- POV: "POV: You [do X]… and [bad outcome] still happens."
- Speed-Run: "How I [achieved X] in [absurdly short time]."
- Proof First: "[Concrete number/broken state]. Here's what that means."

HOOK CONSTRAINTS: Maximum 6 words. Must deliver stakes immediately. Use "you" or "I". No robotic, abstract language.`);
    }

    if (enabledSections.has('seo_phrases')) {
      sectionBlocks.push(`HIDDEN SEO PHRASES (say naturally or flash as text 0.8-1s — algorithm ASR/OCR picks them up):
- "machine learning from scratch" (first 5s, high-save niche)
- "Python tutorial" (flash as text, education bucket)
- "AI engineering" (say naturally, career-intent)
- "build in public" (say at close, community signal)
- "save this for later" (say at end, direct save trigger)
- "repo in bio" (say at end, profile visit signal)

ALGORITHM POISON (NEVER say): "Hey guys", "In this video", "So basically", "Kind of", "Sort of"`);
    }

    if (enabledSections.has('format_rules')) {
      sectionBlocks.push(`3-FONT HIERARCHY:
- Hook: Anton 64pt Yellow, 3px black stroke
- Body: League Spartan 48pt White, 3px black stroke
- Caption: Montserrat Bold 40pt White/Cyan, 3px black stroke

FORMAT RULES:
- Full face centered/upper-third, no small face cam
- Visual asset required every video
- Hard cut every 3-4s, no fades
- Face cam zone: bottom-right 270×360px, 12px radius
- Right 320px and bottom 400px = NO TEXT EVER`);
    }

    if (enabledSections.has('scoring_weights')) {
      const scheme = getScheme((ep as any)?.scheme_id || null);
      sectionBlocks.push(`ACTIVE SCORING SCHEME: ${scheme.name} (tier ${scheme.tier})
${schemeWeightsForPrompt(scheme)}`);
    }

    if (enabledSections.has('framework_rules')) {
      const frameworks = db.prepare('SELECT name, rules FROM content_frameworks WHERE is_active=1 ORDER BY is_builtin DESC').all();
      const allRules: string[] = [];
      for (const fw of frameworks) {
        const rules = safeJson((fw as any).rules, []);
        for (const r of rules) {
          const text = typeof r === 'string' ? r : r.rule || '';
          if (text) allRules.push(`- ${(fw as any).name}: ${text}`);
        }
      }
      if (allRules.length > 0) {
        sectionBlocks.push(`MANDATORY RULES FROM PAST EXPERIENCE (follow every one):
${allRules.join('\n')}`);
      }
    }

    if (enabledSections.has('lessons')) {
      const lessons = db.prepare('SELECT lesson, confidence FROM content_lessons WHERE status IN ("active","confirmed") ORDER BY confidence DESC LIMIT 10').all();
      if (lessons.length > 0) {
        sectionBlocks.push(`ACTIVE LESSONS (proven with real data — respect these):
${lessons.map((l: any) => `- [${(l.confidence ?? 0.5).toFixed(1)}] ${l.lesson}`).join('\n')}`);
      }
    }

    if (enabledSections.has('reflection')) {
      const reflections = db.prepare('SELECT analysis FROM video_reflections ORDER BY created_at DESC LIMIT 3').all();
      const patterns: string[] = [];
      for (const r of reflections) {
        const analysis = safeJson((r as any).analysis, null);
        if (analysis?.extracted_pattern) patterns.push(analysis.extracted_pattern);
      }
      if (patterns.length > 0) {
        sectionBlocks.push(`CREATOR REFLECTION PATTERNS (the creator's own observed truths):
${patterns.map(p => `- ${p}`).join('\n')}`);
      }
    }

    // Assemble final prompt
    const prompt = `Based on our conversation above, write the script as a JSON array of frames. Return ONLY this JSON (no explanation, no markdown):

{
  "frames": [
    {
      "text": "exact words spoken/overlaid — every word counts",
      "duration_seconds": 1-8,
      "frame_type": "hook" | "value" | "transition" | "call_to_action" | "visual_only",
      "visual": "on-screen visual description",
      "retention": {
        "criteria": ["criterion ids this wording satisfies"],
        "mechanism": "how the wording works",
        "evidence": "why these exact words prove it",
        "score": 0.0-1.0
      }
    }
  ]
}

ASPECT RATIO: ${aspectRatio} (${aspectLabel}) — write visuals and text overlays for this format.
Rules: Frame 0 is the scroll-stopper. Hook payoff at 3-4s. Context locks by 3s. 1 call_to_action at end.
Safe zones: IG 820×1270, TT 810×1306 — keep text inside.
${modeDirective}${seriesRules ? '\nSERIES RULES: ' + seriesRules : ''}${style ? '\n' + style : ''}
${sectionBlocks.length > 0 ? '\n' + sectionBlocks.join('\n\n') : ''}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-classify', async (_, { rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found in the response' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON — paste the raw JSON output from the AI' }; }
    const ts = now();
    const thoughtText = parsed.suggested_title || parsed.reason || '(classified from external AI)';
    const info = db.prepare(
      `INSERT INTO content_brainstorms (thought, category, format_type, niche_hint, suggested_title, reason, summary, idea_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      thoughtText,
      parsed.category || 'general_thought',
      parsed.format_type || null,
      parsed.niche_hint || null,
      parsed.suggested_title || null,
      parsed.reason || null,
      null,
      null,
      'classified',
      ts, ts
    );
    return { ok: true, id: info.lastInsertRowid, category: parsed.category, reason: parsed.reason, suggested_title: parsed.suggested_title, format_type: parsed.format_type, niche_hint: parsed.niche_hint };
  });

  ipcMain.handle('content:external:import-synthesize', async (_, { rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found in the response' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON — paste the raw JSON output from the AI' }; }
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : Array.isArray(parsed) ? parsed : [];
    if (!ideas.length) return { ok: false, error: 'No ideas found in the JSON (expected {"ideas": [...]})' };
    const ts = now();
    let count = 0;
    for (const idea of ideas) {
      if (!idea.title) continue;
      db.prepare(
        `INSERT INTO content_ideas (title, hook, format_type, status, priority, series, niche, frames, synthesized_from, gates, brainstorm_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        idea.title,
        idea.hook || null,
        idea.format_type || 'listicle',
        'raw',
        idea.priority ?? 3,
        idea.series || null,
        idea.niche || null,
        JSON.stringify(idea.frames || []),
        JSON.stringify([]),
        JSON.stringify(idea.gates || null),
        null,
        ts, ts
      );
      count++;
    }
    return { ok: true, count };
  });

  ipcMain.handle('content:external:import-script', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found in the response' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON — paste the raw JSON output from the AI' }; }
    const frames = Array.isArray(parsed.frames) ? parsed.frames : Array.isArray(parsed) ? parsed : [];
    if (!frames.length) return { ok: false, error: 'No frames found in the JSON (expected {"frames": [...]})' };
    const ts = now();
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    let scheme = getScheme(ep?.scheme_id);
    if (!ep?.scheme_id) {
      const stats = db.prepare('SELECT COUNT(*) c, AVG(views) avg_views FROM content_videos').get() as any;
      scheme = estimateSchemeForEpisode({ videoCount: stats?.c || 0, avgViews: stats?.avg_views || 0 });
    }
    const indexedFrames = frames.map((f: any, i: number) => ({
      ...f,
      index: i,
      timestamp: f.timestamp || fmtTs(i),
      rejected: false,
      rejection_reasons: [],
    }));
    // Run gate check on imported frames
    const idea = ep?.idea_id ? db.prepare('SELECT * FROM content_ideas WHERE id=?').get(ep.idea_id) : null;
    const ideaText = idea ? JSON.stringify({ title: idea.title, hook: idea.hook, format_type: idea.format_type }) : '"(imported from external AI)"';
    const gates = await runGateCheck(ideaText, indexedFrames);
    if (episodeId) {
      db.prepare('UPDATE content_episodes SET script=?, gates=?, status=?, scheme_id=?, updated_at=? WHERE id=?').run(
        JSON.stringify(indexedFrames),
        JSON.stringify(gates),
        gates.overall === 'pass' ? 'scripted' : 'gated',
        scheme.id,
        ts,
        episodeId
      );
      logEvent(episodeId, 'script_imported', `Script imported from external AI (${indexedFrames.length} frames)`, { frames: indexedFrames.length });
    }
    return { ok: true, frames: indexedFrames, gates };
  });

  // ── External AI: pipeline step prompts + imports ──────
  ipcMain.handle('content:external:build-seo-prompt', async (_, { episodeId, templateIds }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const idea = ep?.idea_id ? db.prepare('SELECT * FROM content_ideas WHERE id=?').get(ep.idea_id) : null;
    const niche = (idea?.niche || ep?.niche || 'general') as string;
    const script = ep?.script ? safeJson(ep.script, []) : [];
    const hookLine = script[0]?.text || idea?.hook || ep?.title || '';
    const style = buildStyleDirective(templateIds || []);
    const prompt = `Based on our conversation above, generate SEO metadata for this video. Return ONLY this JSON:

{
  "title": "search-optimized title (60 chars max, includes primary keyword)",
  "first_line": "opening line optimized for search (includes secondary keyword)",
  "text_overlay": "on-screen text for thumbnail/preview",
  "caption": "social media caption with hashtags",
  "keywords": ["primary", "secondary", "tertiary"],
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

NICHE: ${niche}
HOOK: ${hookLine}
${style}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-seo', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    if (episodeId) {
      db.prepare('UPDATE content_episodes SET seo=?, updated_at=? WHERE id=?').run(JSON.stringify(parsed), now(), episodeId);
      logEvent(episodeId, 'seo_imported', 'SEO imported from external AI');
    }
    return { ok: true, seo: parsed };
  });

  ipcMain.handle('content:external:build-gates-prompt', async (_, { episodeId }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const idea = ep?.idea_id ? db.prepare('SELECT * FROM content_ideas WHERE id=?').get(ep.idea_id) : null;
    const script = ep?.script ? safeJson(ep.script, []) : [];
    const hookLine = script[0]?.text || idea?.hook || '';
    const prompt = `Based on our conversation above, validate this video against 3 gates. Return ONLY this JSON:

{
  "scroll_stop": { "pass": true, "reason": "why a scroller would stop" },
  "hard_cut": { "pass": true, "reason": "topic survives if everything after 5s is deleted" },
  "asset_ready": { "pass": true, "reason": "visual assets are available/obtainable" },
  "overall": "pass" | "fail",
  "suggestions": ["2-3 concrete improvements if any gate fails"]
}

HOOK: ${hookLine}
TITLE: ${idea?.title || ep?.title || 'Untitled'}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-gates', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    if (episodeId) {
      db.prepare('UPDATE content_episodes SET gates=?, status=?, updated_at=? WHERE id=?').run(
        JSON.stringify(parsed), parsed.overall === 'pass' ? 'scripted' : 'gated', now(), episodeId
      );
      logEvent(episodeId, 'gates_imported', `Gates imported: ${parsed.overall}`);
    }
    return { ok: true, gates: parsed };
  });

  ipcMain.handle('content:external:build-analytics-prompt', async (_, { episodeId }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const prompt = `Based on our conversation above, analyze this video's performance data. Return ONLY this JSON:

{
  "insights": [
    {
      "metric": "retention_curve" | "completion_pct" | "saves" | "likes" | "audience" | "dropoff" | "other",
      "observation": "what the data shows",
      "interpretation": "why it happened (link to script elements if possible)",
      "action": "the exact change to make in the NEXT script"
    }
  ],
  "verdict": "what worked and what failed, one short paragraph"
}

EPISODE: ${ep?.title || 'Untitled'}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-analytics', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    if (episodeId) {
      logEvent(episodeId, 'analytics_imported', 'Analytics insights imported from external AI', parsed);
    }
    return { ok: true, insights: parsed.insights || [], verdict: parsed.verdict || '' };
  });

  ipcMain.handle('content:external:build-lessons-prompt', async (_, { episodeId }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const prompt = `Based on our conversation above, extract durable lessons from this video's performance. Return ONLY this JSON:

{
  "lessons": [
    {
      "lesson": "one-sentence rule reusable in future scripts",
      "evidence": [{ "metric": "completion_pct", "value": "78%", "note": "..." }],
      "applies_to": "hook" | "script" | "editing" | "topic" | "audience" | "format",
      "confidence": 0.0-1.0
    }
  ]
}

EPISODE: ${ep?.title || 'Untitled'}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-lessons', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
    let count = 0;
    for (const l of lessons) {
      if (!l.lesson) continue;
      db.prepare(
        `INSERT INTO content_lessons (episode_id, lesson, evidence, applies_to, confidence, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`
      ).run(episodeId || null, l.lesson, JSON.stringify(l.evidence || []), l.applies_to || 'general', l.confidence ?? 0.5, 'active', now(), now());
      count++;
    }
    return { ok: true, count };
  });

  ipcMain.handle('content:external:build-reflection-prompt', async (_, { episodeId }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const prompt = `Based on our conversation above, analyze the creator's reflection about this video. Return ONLY this JSON:

{
  "characteristics": [
    { "name": "hook_style" | "format" | "energy" | "topic" | "delivery", "value": "string" }
  ],
  "intuitions": ["creator's stated beliefs"],
  "contradictions": [
    { "gut": "what creator felt", "data": "what numbers show", "resolution": "one-line verdict" }
  ],
  "format_fit": { "format": "listicle" | "story" | "...", "verdict": "SUITS" | "DOES NOT SUIT", "reasoning": "why" },
  "extracted_pattern": "one reusable pattern sentence",
  "suggested_lesson": { "lesson": "one-sentence rule", "applies_to": "hook" | "script" | "editing", "confidence": 0.0-1.0 }
}

EPISODE: ${ep?.title || 'Untitled'}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-reflection', async (_, { episodeId, rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    if (episodeId) {
      logEvent(episodeId, 'reflection_imported', 'Reflection analysis imported from external AI', parsed);
    }
    return { ok: true, analysis: parsed };
  });

  ipcMain.handle('content:external:build-frameworks-prompt', async (_, {} : any) => {
    const frameworks = db.prepare('SELECT * FROM content_frameworks WHERE is_active=1').all();
    const rules = frameworks.flatMap((f: any) => {
      const r = safeJson(f.rules, []);
      return r.map((rule: any) => `[${f.name}] ${rule.rule}`);
    });
    const prompt = `Based on our conversation above, extract a new framework rule from a confirmed lesson. Return ONLY this JSON:

{
  "rule": { "id": "short-slug", "rule": "one imperative sentence, actionable in script writing" },
  "target_framework": "the framework this belongs to, or 'Learned Rules' if none matches",
  "reasoning": "one sentence linking the rule to the lesson"
}

EXISTING RULES:
${rules.length ? rules.join('\n') : '(no rules yet)'}`;
    return { ok: true, prompt };
  });

  ipcMain.handle('content:external:import-frameworks', async (_, { rawJson }: any) => {
    if (!rawJson?.trim()) return { ok: false, error: 'Paste the AI response first' };
    let parsed: any;
    try {
      const cleaned = rawJson.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false, error: 'No JSON object found' };
      parsed = JSON.parse(jsonMatch[0]);
    } catch { return { ok: false, error: 'Invalid JSON' }; }
    if (parsed.rule) {
      const targetName = parsed.target_framework || 'Learned Rules';
      let fw = db.prepare('SELECT * FROM content_frameworks WHERE name=?').get(targetName) as any;
      if (!fw) {
        const info = db.prepare('INSERT INTO content_frameworks (name, rules, is_active, created_at, updated_at) VALUES (?,?,1,?,?)').run(targetName, JSON.stringify([parsed.rule]), now(), now());
        fw = { id: info.lastInsertRowid };
      } else {
        const existingRules = safeJson(fw.rules, []);
        existingRules.push(parsed.rule);
        db.prepare('UPDATE content_frameworks SET rules=?, updated_at=? WHERE id=?').run(JSON.stringify(existingRules), now(), fw.id);
      }
      logEvent(null, 'framework_imported', `Framework rule imported: ${parsed.rule.rule?.slice(0, 60)}`);
      return { ok: true, rule: parsed.rule, framework: targetName };
    }
    return { ok: false, error: 'No rule found in the JSON' };
  });

  // ── Themes ────────────────────────────────────────────────
  ipcMain.handle('themes:create', async (_, theme: any) => {
    const info = db
      .prepare('INSERT INTO themes (name, description, accent_color, icon, status, font_display, font_body, font_accent, color_bg, color_text, color_accent, color_accent2, color_accent3, headline_case, headline_size, category, use_case, is_builtin, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        theme.name,
        theme.description || '',
        theme.accent_color || theme.color_accent || '#f5c518',
        theme.icon || 'Palette',
        theme.status || 'active',
        theme.font_display || null,
        theme.font_body || null,
        theme.font_accent || null,
        theme.color_bg || null,
        theme.color_text || null,
        theme.color_accent || null,
        theme.color_accent2 || null,
        theme.color_accent3 || null,
        theme.headline_case || 'uppercase',
        theme.headline_size || '27px',
        theme.category || 'general',
        theme.use_case || null,
        theme.is_builtin ? 1 : 0,
        now(),
        now()
      );
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('themes:generate', async (_, { note }: any = {}) => {
    const res = await parseAiJson<any>(
      PROMPT_THEME_GENERATOR.replace('{{note}}', note || ''),
      { required: ['name', 'audience', 'content_hooks'], arrayAt: 'content_hooks' },
      (p, s) => aiCall(p, s, 2500)
    );
    if (!res.ok) return { ok: false, error: `Theme generation failed: ${res.error}` };
    const info = db
      .prepare('INSERT INTO themes (name, description, accent_color, audience, content_hooks, icon, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(
        res.data.name,
        res.data.description || '',
        res.data.suggested_accent_color || '#f5c518',
        JSON.stringify(res.data.audience || null),
        JSON.stringify(res.data.content_hooks || []),
        'Palette',
        'active',
        now(),
        now()
      );
    return { ok: true, id: info.lastInsertRowid, theme: res.data };
  });
  ipcMain.handle('themes:get-all', async () => {
    return db.prepare('SELECT * FROM themes ORDER BY created_at DESC').all().map(mapTheme);
  });
  ipcMain.handle('themes:apply', async (_, { themeId, episodeId }: any) => {
    db.prepare('UPDATE content_episodes SET theme_id=? WHERE id=?').run(themeId, episodeId);
    return { ok: true };
  });
  ipcMain.handle('themes:delete', async (_, id: number) => {
    db.prepare('DELETE FROM themes WHERE id=?').run(id);
    return { ok: true };
  });

  // ── Analytics (video performance + learning loop) ────────
  ipcMain.handle('content:analytics:get', async (_, { episodeId }: any = {}) => {
    const videos = episodeId
      ? db.prepare('SELECT * FROM content_videos WHERE episode_id=? ORDER BY published_at DESC').all(episodeId)
      : db.prepare('SELECT * FROM content_videos ORDER BY published_at DESC').all();
    const mapped = videos.map(mapVideo);
    const lessons = db.prepare('SELECT * FROM content_lessons ORDER BY created_at DESC').all().map(mapLesson);
    const agg = aggregateVideos(mapped);
    return { ok: true, videos: mapped, lessons, aggregate: agg };
  });
  ipcMain.handle('content:analytics:upsert-video', async (_, v: any) => {
    const ts = now();
    if (v.id) {
      db.prepare(
        `UPDATE content_videos SET episode_id=?, platform=?, url=?, title=?, views=?, likes=?, saves=?, shares=?, comments=?, completion_pct=?, retention_curve=?, audience=?, dropoffs=?, published_at=?, fetched_at=? WHERE id=?`
      ).run(
        v.episode_id || null,
        v.platform || 'tiktok',
        v.url || null,
        v.title || '',
        v.views ?? 0,
        v.likes ?? 0,
        v.saves ?? 0,
        v.shares ?? 0,
        v.comments ?? 0,
        v.completion_pct ?? null,
        JSON.stringify(v.retention_curve || []),
        JSON.stringify(v.audience || null),
        JSON.stringify(v.dropoffs || []),
        v.published_at || null,
        ts,
        v.id
      );
      if (v.imported) logEvent(v.episode_id, 'analytics_imported', `Analytics imported for ${v.platform || 'video'}`, { views: v.views });
      return { ok: true, id: v.id };
    }
    const info = db
      .prepare(
        `INSERT INTO content_videos (episode_id, platform, url, title, views, likes, saves, shares, comments, completion_pct, retention_curve, audience, dropoffs, published_at, fetched_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        v.episode_id || null,
        v.platform || 'tiktok',
        v.url || null,
        v.title || '',
        v.views ?? 0,
        v.likes ?? 0,
        v.saves ?? 0,
        v.shares ?? 0,
        v.comments ?? 0,
        v.completion_pct ?? null,
        JSON.stringify(v.retention_curve || []),
        JSON.stringify(v.audience || null),
        JSON.stringify(v.dropoffs || []),
        v.published_at || null,
        ts
      );
    if (v.imported) logEvent(v.episode_id, 'analytics_imported', `Analytics imported for ${v.platform || 'video'}`, { views: v.views });
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:analytics:delete-video', async (_, id: number) => {
    db.prepare('DELETE FROM content_videos WHERE id=?').run(id);
    return { ok: true };
  });
  ipcMain.handle('content:analytics:insight', async (_, { episodeId }: any = {}) => {
    const res = await callAnalytics(episodeId);
    if (!res.ok) return res;
    const { mapped } = res;
    const data = mapped.length
      ? mapped.map((v: any) => ({
          title: v.title,
          views: v.views,
          likes: v.likes,
          saves: v.saves,
          shares: v.shares,
          completion_pct: v.completion_pct,
          audience: v.audience,
          retention_curve: v.retention_curve,
          dropoffs: v.dropoffs,
        }))
      : [{ note: 'no published videos yet' }];
    const out = await parseAiJson<any>(
      PROMPT_ANALYTICS_INSIGHT.replace('{{data}}', JSON.stringify(data)),
      { required: ['insights'], arrayAt: 'insights', allowEmpty: true },
      (p, s) => aiCall(p, s, 3000)
    );
    if (!out.ok) return { ok: false, error: `Insight generation failed: ${out.error}` };
    return { ok: true, insights: out.data.insights, verdict: out.data.verdict || '' };
  });

  // ── Lessons (learning loop) ──────────────────────────────
  ipcMain.handle('content:lessons:list', async () => {
    return db.prepare('SELECT * FROM content_lessons ORDER BY created_at DESC').all().map(mapLesson);
  });
  ipcMain.handle('content:lessons:save', async (_, lesson: any) => {
    const info = db
      .prepare('INSERT INTO content_lessons (video_id, episode_id, lesson, evidence, confidence, applies_to, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(
        lesson.video_id || null,
        lesson.episode_id || null,
        lesson.lesson,
        JSON.stringify(lesson.evidence || []),
        lesson.confidence ?? 0.5,
        lesson.applies_to || null,
        lesson.status || 'active',
        now()
      );
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:lessons:delete', async (_, id: number) => {
    db.prepare('DELETE FROM content_lessons WHERE id=?').run(id);
    return { ok: true };
  });
  ipcMain.handle('content:lessons:extract', async (_, { videoId }: any) => {
    const v = db.prepare('SELECT * FROM content_videos WHERE id=?').get(videoId);
    if (!v) return { ok: false, error: 'Video not found' };
    const data = mapVideo(v);
    const res = await parseAiJson<any>(
      PROMPT_LESSON_EXTRACTOR.replace(
        '{{data}}',
        JSON.stringify({ title: data.title, views: data.views, likes: data.likes, saves: data.saves, completion_pct: data.completion_pct, retention_curve: data.retention_curve, audience: data.audience })
      ),
      { required: ['lessons'], arrayAt: 'lessons', allowEmpty: true },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Lesson extraction failed: ${res.error}` };
    const saved: any[] = [];
    for (const l of res.data.lessons) {
      const info = db
        .prepare('INSERT INTO content_lessons (video_id, episode_id, lesson, evidence, confidence, applies_to, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(videoId, data.episode_id || null, l.lesson, JSON.stringify(l.evidence || []), l.confidence ?? 0.5, l.applies_to || null, 'active', now());
      saved.push({ id: info.lastInsertRowid, ...l });
    }
    logEvent(data.episode_id, 'lesson_extracted', `${saved.length} lessons extracted from video data`, { video_id: videoId });
    return { ok: true, lessons: saved };
  });

  // ── Lesson confirm / dismiss (learning loop) ─────────────
  ipcMain.handle('content:lessons:confirm', async (_, { lessonId, confirm }: any) => {
    const lesson = db.prepare('SELECT * FROM content_lessons WHERE id=?').get(lessonId);
    if (!lesson) return { ok: false, error: 'Lesson not found' };
    if (!confirm) {
      db.prepare('UPDATE content_lessons SET status=? WHERE id=?').run('dismissed', lessonId);
      return { ok: true, promoted: false, status: 'dismissed' };
    }
    db.prepare('UPDATE content_lessons SET status=? WHERE id=?').run('confirmed', lessonId);
    try { writeContentEngineEpisode({ kind: 'lesson', title: (lesson.lesson || 'Confirmed lesson').slice(0, 80), detail: lesson.evidence ? JSON.stringify(lesson.evidence).slice(0, 400) : '', refId: lessonId }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
    // Auto-promotion: a confirmed lesson with confidence >= 0.8 becomes a framework rule.
    if ((lesson.confidence ?? 0.5) >= 0.8) {
      const promoted = await promoteLessonToFramework(lesson);
      if (promoted) {
        logEvent(lesson.episode_id, 'framework_updated', `Lesson promoted to framework rule "${promoted.rule}"`, { lesson_id: lessonId });
        return { ok: true, promoted: true, framework: promoted };
      }
    }
    return { ok: true, promoted: false, status: 'confirmed' };
  });

  async function promoteLessonToFramework(lesson: any): Promise<any | null> {
    try {
      const frameworks = db.prepare('SELECT id, name, rules FROM content_frameworks ORDER BY is_builtin DESC, name ASC').all();
      const res = await parseAiJson<any>(
        PROMPT_FRAMEWORK_UPDATE
          .replace('{{lesson}}', lesson.lesson)
          .replace('{{evidence}}', JSON.stringify(safeJson(lesson.evidence, [])))
          .replace('{{frameworks}}', JSON.stringify(frameworks.map((f: any) => ({ id: f.id, name: f.name, rules: safeJson(f.rules, []) })))),
        { required: ['rule'] },
        (p, s) => aiCall(p, s, 1500)
      );
      if (!res.ok) return null;
      const { rule, target_framework } = res.data;
      const target = frameworks.find((f: any) => f.name === target_framework) || frameworks.find((f: any) => f.name === 'Learned Rules');
      if (target) {
        const existing = db.prepare('SELECT * FROM content_frameworks WHERE id=?').get(target.id);
        const rules = safeJson(existing.rules, []);
        rules.push({ id: rule.id || `lr_${Date.now()}`, rule: rule.rule, reasoning: rule.reasoning || null });
        const history = safeJson(existing.history, []);
        history.push({ version: existing.version, rules: rules.slice(0, -1), saved_at: now() });
        db.prepare('UPDATE content_frameworks SET rules=?, version=version+1, history=?, updated_at=? WHERE id=?').run(
          JSON.stringify(rules),
          JSON.stringify(history),
          now(),
          target.id
        );
        return { rule: rule.rule, target_framework: target.name, version: existing.version + 1 };
      }
      const info = db
        .prepare('INSERT INTO content_frameworks (name, description, rules, version, is_builtin, history, created_at, updated_at) VALUES (?,?,?,1,0,?,?,?)')
        .run(target_framework || 'Learned Rules', `Auto-generated from a confirmed lesson (${lesson.lesson.slice(0, 80)})`, JSON.stringify([{ id: rule.id || `lr_${Date.now()}`, rule: rule.rule }]), JSON.stringify([]), now(), now());
      return { rule: rule.rule, target_framework: target_framework || 'Learned Rules', version: 1, id: info.lastInsertRowid };
    } catch {
      return null;
    }
  }

  // ── Frameworks (versioned script rules) ──────────────────
  ipcMain.handle('content:frameworks:list', async () => {
    return db.prepare('SELECT * FROM content_frameworks ORDER BY is_builtin DESC, name ASC').all().map(mapFramework);
  });
  ipcMain.handle('content:frameworks:save', async (_, fw: any) => {
    const ts = now();
    const existing = fw.id ? db.prepare('SELECT * FROM content_frameworks WHERE id=?').get(fw.id) : null;
    if (existing) {
      const history = JSON.parse(existing.history || '[]');
      history.push({ version: existing.version, rules: JSON.parse(existing.rules || '[]'), saved_at: ts });
      db.prepare('UPDATE content_frameworks SET name=?, description=?, rules=?, version=version+1, history=?, updated_at=? WHERE id=?').run(
        fw.name,
        fw.description || '',
        JSON.stringify(fw.rules || []),
        JSON.stringify(history),
        ts,
        fw.id
      );
      try { writeContentEngineEpisode({ kind: 'framework', title: fw.name || 'Untitled framework', detail: (fw.description || '').slice(0, 400), refId: fw.id }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
      return { ok: true, id: fw.id, version: existing.version + 1 };
    }
    const info = db
      .prepare('INSERT INTO content_frameworks (name, description, rules, version, is_builtin, history, created_at, updated_at) VALUES (?,?,?,1,0,?,?,?)')
      .run(fw.name, fw.description || '', JSON.stringify(fw.rules || []), JSON.stringify([]), ts, ts);
    try { writeContentEngineEpisode({ kind: 'framework', title: fw.name || 'Untitled framework', detail: (fw.description || '').slice(0, 400), refId: info.lastInsertRowid }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
    return { ok: true, id: info.lastInsertRowid, version: 1 };
  });
  ipcMain.handle('content:frameworks:rollback', async (_, { id, version }: any) => {
    const fw = db.prepare('SELECT * FROM content_frameworks WHERE id=?').get(id);
    if (!fw) return { ok: false, error: 'Framework not found' };
    const history = JSON.parse(fw.history || '[]');
    const target = history.find((h: any) => h.version === version);
    if (!target) return { ok: false, error: `Version ${version} not in history` };
    db.prepare('UPDATE content_frameworks SET rules=?, version=?, updated_at=? WHERE id=?').run(
      JSON.stringify(target.rules),
      version,
      now(),
      id
    );
    return { ok: true };
  });

  // ── Brainstorm session summary ───────────────────────────
  ipcMain.handle('content:brainstorm:summary', async (_, { note }: any = {}) => {
    const ideas = db.prepare('SELECT title, hook, niche, priority, status FROM content_ideas ORDER BY updated_at DESC LIMIT 20').all();
    const res = await parseAiJson<any>(
      PROMPT_SYNTHESIZE_IDEAS.replace('{{note}}', `Session summary mode. Synthesize a 3-sentence strategy summary of the session. ${note || ''}`).replace('{{count}}', '2').replace('{{ideas}}', JSON.stringify(ideas)),
      { required: ['ideas'], arrayAt: 'ideas', allowEmpty: true },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Summary failed: ${res.error}` };
    return { ok: true, summary: res.data.ideas };
  });

  // ── Human reflection (Phase 3) ───────────────────────────
  ipcMain.handle('content:reflection:save', async (_, { episodeId, videoId, reflectionText }: any) => {
    if (!reflectionText || !reflectionText.trim()) return { ok: false, error: 'Empty reflection' };
    const info = db
      .prepare('INSERT INTO video_reflections (episode_id, video_id, reflection_text, created_at) VALUES (?,?,?,?)')
      .run(episodeId || null, videoId || null, reflectionText.trim(), now());
    logEvent(episodeId, 'human_reflection_added', 'Creator added a reflection');
    try { writeContentEngineEpisode({ kind: 'reflection', title: 'Reflection', detail: reflectionText.slice(0, 400), refId: info.lastInsertRowid }); } catch (e) { console.error('[ContentEngine] brain sync failed', e); }
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:reflection:get', async (_, { episodeId, videoId }: any = {}) => {
    const rows = episodeId
      ? db.prepare('SELECT * FROM video_reflections WHERE episode_id=? ORDER BY created_at DESC').all(episodeId)
      : videoId
        ? db.prepare('SELECT * FROM video_reflections WHERE video_id=? ORDER BY created_at DESC').all(videoId)
        : db.prepare('SELECT * FROM video_reflections ORDER BY created_at DESC').all();
    return rows.map(mapReflection);
  });
  ipcMain.handle('content:reflection:analyze', async (_, { reflectionId, episodeId }: any) => {
    let refl: any = null;
    if (reflectionId) refl = db.prepare('SELECT * FROM video_reflections WHERE id=?').get(reflectionId);
    if (!refl && episodeId) refl = db.prepare('SELECT * FROM video_reflections WHERE episode_id=? ORDER BY created_at DESC LIMIT 1').get(episodeId);
    if (!refl) return { ok: false, error: 'No reflection found' };

    const videos = db.prepare('SELECT * FROM content_videos WHERE episode_id=? ORDER BY published_at DESC').all(refl.episode_id);
    const data = videos.length
      ? videos.map((v: any) => mapVideo(v)).map((v: any) => ({ title: v.title, views: v.views, completion_pct: v.completion_pct, retention_curve: v.retention_curve, saves: v.saves }))
      : [{ note: 'no published video data yet — analysis is intuition-only' }];

    const res = await parseAiJson<any>(
      PROMPT_HUMAN_REFLECTION
        .replace('{{reflection}}', refl.reflection_text)
        .replace('{{data}}', JSON.stringify(data)),
      { required: ['characteristics'], arrayAt: 'characteristics', allowEmpty: true },
      (p, s) => aiCall(p, s, 2500)
    );
    if (!res.ok) return { ok: false, error: `Reflection analysis failed: ${res.error}` };

    db.prepare('UPDATE video_reflections SET analysis=? WHERE id=?').run(JSON.stringify(res.data), refl.id);
    // Persist extracted characteristics
    if (refl.episode_id) {
      const existing = db.prepare('SELECT * FROM video_characteristics WHERE episode_id=?').get(refl.episode_id);
      const merged = existing ? { ...safeJson(existing.characteristics, {}) } : {};
      for (const c of res.data.characteristics || []) merged[c.name] = c.value;
      if (existing) {
        db.prepare('UPDATE video_characteristics SET characteristics=?, updated_at=? WHERE episode_id=?').run(JSON.stringify(merged), now(), refl.episode_id);
      } else {
        db.prepare('INSERT INTO video_characteristics (episode_id, characteristics, updated_at) VALUES (?,?,?)').run(refl.episode_id, JSON.stringify(merged), now());
      }
    }
    logEvent(refl.episode_id, 'reflection_analyzed', 'Reflection analyzed against objective data', { contradiction_count: res.data.contradictions?.length || 0 });
    return { ok: true, analysis: res.data, id: refl.id };
  });

  // ── Video characteristics (persisted trait tags) ─────────
  ipcMain.handle('content:characteristics:get', async (_, { episodeId }: any) => {
    const row = episodeId ? db.prepare('SELECT * FROM video_characteristics WHERE episode_id=?').get(episodeId) : null;
    return row ? { ok: true, characteristics: safeJson(row.characteristics, {}) } : { ok: true, characteristics: {} };
  });
  ipcMain.handle('content:characteristics:save', async (_, { episodeId, characteristics }: any) => {
    if (!episodeId) return { ok: false, error: 'episodeId required' };
    const existing = db.prepare('SELECT * FROM video_characteristics WHERE episode_id=?').get(episodeId);
    if (existing) {
      db.prepare('UPDATE video_characteristics SET characteristics=?, updated_at=? WHERE episode_id=?').run(JSON.stringify(characteristics || {}), now(), episodeId);
    } else {
      db.prepare('INSERT INTO video_characteristics (episode_id, characteristics, updated_at) VALUES (?,?,?)').run(episodeId, JSON.stringify(characteristics || {}), now());
    }
    return { ok: true };
  });

  // ── Analytics raw import (Phase 4) ───────────────────────
  ipcMain.handle('content:analytics:parse-raw', async (_, { raw }: any) => {
    if (!raw || !raw.trim()) return { ok: false, error: 'Empty analytics text' };
    const res = await parseAiJson<any>(
      PROMPT_ANALYTICS_IMPORT.replace('{{raw}}', raw.trim().slice(0, 8000)),
      { required: ['platform'], allowEmpty: true },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Analytics parse failed: ${res.error}` };
    return { ok: true, candidate: res.data };
  });

  // ── Scoring schemes (Phase 2/4) ──────────────────────────
  ipcMain.handle('content:scoring:schemes', async () => {
    const rows = db.prepare('SELECT * FROM scoring_schemes WHERE is_active=1 ORDER BY tier ASC').all();
    return {
      ok: true,
      schemes: rows.map((r: any) => ({ id: r.scheme_id, name: r.name, tier: r.tier, description: r.description, weights: safeJson(r.weights, {}) })),
      rubric_version: RETENTION_RUBRIC.version,
      threshold: RETENTION_RUBRIC.threshold,
    };
  });
  ipcMain.handle('content:scoring:current', async (_, { episodeId }: any) => {
    const ep = episodeId ? db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) : null;
    const scheme = getScheme(ep?.scheme_id);
    const script = safeJson(ep?.script, []);
    const breakdown = script.map((f: any) => ({
      index: f.index,
      text: f.text,
      score: f.retention?.score ?? 0,
      weighted: computeFrameScore(f, scheme).weighted,
      rejected: !!f.rejected || computeFrameScore(f, scheme).rejected,
      nonNegotiableFails: computeFrameScore(f, scheme).nonNegotiableFails,
      criteria: f.retention?.criteria || [],
    }));
    const avg = breakdown.length ? breakdown.reduce((a: number, b: any) => a + b.weighted, 0) / breakdown.length : 0;
    return {
      ok: true,
      scheme: { id: scheme.id, name: scheme.name, tier: scheme.tier, description: scheme.description, weights: scheme.weights, duration: scheme.duration },
      breakdown,
      average: Math.round(avg * 100) / 100,
      threshold: RETENTION_RUBRIC.threshold,
      version: RETENTION_RUBRIC.version,
    };
  });
  ipcMain.handle('content:scoring:calibrate', async (_, { episodeId }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const videos = db.prepare('SELECT * FROM content_videos WHERE episode_id=? ORDER BY published_at DESC').all(episodeId);
    if (!videos.length) return { ok: false, error: 'No published video data to calibrate against' };
    const scheme = getScheme(ep.scheme_id);
    const script = safeJson(ep.script, []);
    const predictions = script.map((f: any) => ({ index: f.index, criteria: f.retention?.criteria || [], score: f.retention?.score ?? 0 }));
    const actual = videos.map((v: any) => mapVideo(v)).map((v: any) => ({ title: v.title, views: v.views, completion_pct: v.completion_pct, retention_curve: v.retention_curve, saves: v.saves, likes: v.likes }));

    const res = await parseAiJson<any>(
      PROMPT_SCORE_CALIBRATION
        .replace('{{predictions}}', JSON.stringify(predictions))
        .replace('{{actual}}', JSON.stringify(actual)),
      { required: ['accuracy', 'per_criterion'], arrayAt: 'per_criterion', allowEmpty: true },
      (p, s) => aiCall(p, s, 2500)
    );
    if (!res.ok) return { ok: false, error: `Calibration failed: ${res.error}` };

    db.prepare(
      'INSERT INTO score_calibrations (episode_id, scheme_id, accuracy, per_criterion, predictions, actual, recommendations, created_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run(
      episodeId,
      scheme.id,
      res.data.accuracy ?? 0,
      JSON.stringify(res.data.per_criterion || []),
      JSON.stringify(predictions),
      JSON.stringify(actual),
      JSON.stringify(res.data.recommendations || []),
      now()
    );
    logEvent(episodeId, 'calibration_run', `Calibration accuracy ${Math.round((res.data.accuracy ?? 0) * 100)}%`);
    return { ok: true, calibration: res.data };
  });

  // ── Process timeline (Phase 3/5) ─────────────────────────
  ipcMain.handle('content:process:timeline', async (_, { episodeId }: any = {}) => {
    const rows = episodeId
      ? db.prepare('SELECT * FROM process_timeline WHERE episode_id=? ORDER BY created_at ASC, id ASC').all(episodeId)
      : db.prepare('SELECT * FROM process_timeline ORDER BY created_at ASC, id ASC').all();
    return rows.map(mapTimelineEvent);
  });
  ipcMain.handle('content:process:log', async (_, { episodeId, eventType, label, detail }: any) => {
    if (!episodeId || !eventType) return { ok: false, error: 'episodeId and eventType required' };
    logEvent(episodeId, eventType, label, detail);
    return { ok: true };
  });
  ipcMain.handle('content:process:summary', async (_, { episodeId }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId);
    if (!ep) return { ok: false, error: 'Episode not found' };
    const events = db.prepare('SELECT * FROM process_timeline WHERE episode_id=? ORDER BY created_at ASC, id ASC').all(episodeId).map(mapTimelineEvent);
    if (!events.length) return { ok: false, error: 'No process events yet — work on this episode first' };

    const res = await parseAiJson<any>(
      PROMPT_PROCESS_SUMMARY.replace('{{events}}', JSON.stringify(events)),
      { required: ['title', 'narrative'] },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Process summary failed: ${res.error}` };
    logEvent(episodeId, 'process_complete', `Process complete — ${res.data.title}`);
    return { ok: true, summary: res.data, events };
  });
  ipcMain.handle('content:process:gallery', async () => {
    const eps = db.prepare('SELECT * FROM content_episodes ORDER BY updated_at DESC').all();
    const items = eps.map((ep: any) => {
      const events = db.prepare('SELECT * FROM process_timeline WHERE episode_id=? ORDER BY created_at ASC, id ASC').all(ep.id);
      const videos = db.prepare('SELECT * FROM content_videos WHERE episode_id=? ORDER BY published_at DESC').all(ep.id);
      const lessons = db.prepare('SELECT * FROM content_lessons WHERE episode_id=? AND status=?').all(ep.id, 'confirmed');
      const aiCalls = events.filter((e: any) => /script_generated|bullet_regenerated|evidence_validated|seo_injected|lesson_extracted|reflection_analyzed|calibration_run|process_complete/.test(e.event_type)).length;
      const pivots = events.filter((e: any) => /bullet_regenerated|gate_overridden/.test(e.event_type)).length;
      const durationMin = events.length ? Math.max(1, Math.round((Date.now() - new Date(events[0].created_at).getTime()) / 60000)) : 0;
      const score = videos.length ? Math.round((videos.reduce((a: number, v: any) => a + (v.completion_pct || 0), 0) / videos.length) * 100) : null;
      return {
        episode_id: ep.id,
        title: ep.title,
        status: ep.status,
        steps: events.length,
        ai_calls: aiCalls,
        pivots,
        duration_min: durationMin,
        score,
        views: videos.reduce((a: number, v: any) => a + (v.views || 0), 0),
        lessons: lessons.length,
        lesson_text: lessons[0]?.lesson || null,
        updated_at: ep.updated_at,
        scheme_id: ep.scheme_id || 'audience_builder',
      };
    });
    return items;
  });

  // ── takes + segments (Phase 3) ─────────────────────────────
  ipcMain.handle('content:takes:list', async (_, { episodeId }: any) => {
    const rows = db.prepare('SELECT * FROM content_takes WHERE episode_id=? ORDER BY take_number ASC').all(episodeId);
    return rows.map((r: any) => ({ ...r, file_path: r.file_path || null }));
  });
  ipcMain.handle('content:takes:save', async (_, take: any) => {
    if (take.id) {
      db.prepare('UPDATE content_takes SET notes=?, status=?, duration_seconds=?, file_path=? WHERE id=?').run(
        take.notes || null, take.status || 'recorded', take.duration_seconds || null, take.file_path || null, take.id
      );
      return { ok: true, id: take.id };
    }
    const maxNum = (db.prepare('SELECT COALESCE(MAX(take_number),0) m FROM content_takes WHERE episode_id=?').get(take.episode_id) as any).m;
    const info = db.prepare('INSERT INTO content_takes (episode_id, take_number, file_path, duration_seconds, status, notes, created_at) VALUES (?,?,?,?,?,?,?)').run(
      take.episode_id, (maxNum || 0) + 1, take.file_path || null, take.duration_seconds || null, take.status || 'recorded', take.notes || null, now()
    );
    return { ok: true, id: info.lastInsertRowid };
  });
  ipcMain.handle('content:takes:delete', async (_, id: number) => {
    db.prepare('DELETE FROM take_segments WHERE take_id=?').run(id);
    db.prepare('DELETE FROM take_evaluations WHERE take_id=?').run(id);
    db.prepare('DELETE FROM content_takes WHERE id=?').run(id);
    return { ok: true };
  });
  ipcMain.handle('content:takes:import', async (_, { episodeId, filePath, duration }: any) => {
    const maxNum = (db.prepare('SELECT COALESCE(MAX(take_number),0) m FROM content_takes WHERE episode_id=?').get(episodeId) as any).m;
    const info = db.prepare('INSERT INTO content_takes (episode_id, take_number, file_path, duration_seconds, status, created_at) VALUES (?,?,?,?,?,?)').run(
      episodeId, (maxNum || 0) + 1, filePath, duration || null, 'recorded', now()
    );
    logEvent(episodeId, 'take_imported', `Take #${(maxNum || 0) + 1} imported`, { file_path: filePath });
    return { ok: true, id: info.lastInsertRowid, take_number: (maxNum || 0) + 1 };
  });
  ipcMain.handle('content:takes:transcribe', async (_, { takeId }: any) => {
    const take = db.prepare('SELECT * FROM content_takes WHERE id=?').get(takeId) as any;
    if (!take) return { ok: false, error: 'Take not found' };
    if (!take.file_path) return { ok: false, error: 'No file path — import a take first' };
    db.prepare('UPDATE content_takes SET status=? WHERE id=?').run('transcribing', takeId);
    logEvent(take.episode_id, 'transcription_started', `Transcribing Take #${take.take_number}`);

    // Try Whisper first, fall back to AI transcription
    let segments = await transcribeWithWhisper(take.file_path, aiCall, take.duration_seconds);

    if (!segments || segments.length === 0) {
      // AI fallback: generate placeholder segments from duration
      const dur = take.duration_seconds || 30;
      const segmentCount = Math.max(1, Math.ceil(dur / 10));
      segments = [];
      for (let i = 0; i < segmentCount; i++) {
        const start = (i * dur) / segmentCount;
        const end = ((i + 1) * dur) / segmentCount;
        segments.push({
          start_s: Math.round(start * 100) / 100,
          end_s: Math.round(end * 100) / 100,
          text: `[Segment ${i + 1} — awaiting manual transcription or Whisper installation]`,
          seg_type: i === 0 ? 'hook' : 'beat',
        });
      }
    }

    // Save segments
    db.prepare('DELETE FROM take_segments WHERE take_id=?').run(takeId);
    const ins = db.prepare('INSERT INTO take_segments (take_id, seg_index, start_s, end_s, text, seg_type, keep, created_at) VALUES (?,?,?,?,?,?,?,?)');
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      ins.run(takeId, i, s.start_s, s.end_s, s.text, s.seg_type, null, now());
    }
    db.prepare('UPDATE content_takes SET status=? WHERE id=?').run('transcribed', takeId);
    logEvent(take.episode_id, 'transcription_complete', `Take #${take.take_number} — ${segments.length} segments`);

    return { ok: true, count: segments.length, whisper: !!findWhisperBin() };
  });
  ipcMain.handle('content:takes:save-segments', async (_, { takeId, segments }: any) => {
    if (!Array.isArray(segments)) return { ok: false, error: 'segments must be an array' };
    db.prepare('DELETE FROM take_segments WHERE take_id=?').run(takeId);
    const ins = db.prepare('INSERT INTO take_segments (take_id, seg_index, start_s, end_s, text, seg_type, keep, created_at) VALUES (?,?,?,?,?,?,?,?)');
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      ins.run(takeId, i, s.start_s ?? s.start ?? 0, s.end_s ?? s.end ?? 0, s.text || '', s.seg_type || 'beat', s.keep ?? null, now());
    }
    db.prepare('UPDATE content_takes SET status=? WHERE id=?').run('transcribed', takeId);
    const take = db.prepare('SELECT * FROM content_takes WHERE id=?').get(takeId) as any;
    if (take) logEvent(take.episode_id, 'transcription_complete', `Take #${take.take_number} transcribed — ${segments.length} segments`);
    return { ok: true, count: segments.length };
  });
  ipcMain.handle('content:takes:segments', async (_, { takeId }: any) => {
    return db.prepare('SELECT * FROM take_segments WHERE take_id=? ORDER BY seg_index ASC').all(takeId);
  });
  ipcMain.handle('content:takes:select', async (_, { takeId, segments }: any) => {
    if (!Array.isArray(segments)) return { ok: false, error: 'segments must be an array' };
    const upd = db.prepare('UPDATE take_segments SET keep=? WHERE id=?');
    for (const s of segments) upd.run(s.keep ? 1 : 0, s.id);
    db.prepare('UPDATE content_takes SET status=? WHERE id=?').run('selected', takeId);
    const take = db.prepare('SELECT * FROM content_takes WHERE id=?').get(takeId) as any;
    if (take) logEvent(take.episode_id, 'take_selected', `Take #${take.take_number} segments selected`);
    return { ok: true };
  });
  ipcMain.handle('content:takes:evaluate', async (_, { takeId }: any) => {
    const take = db.prepare('SELECT * FROM content_takes WHERE id=?').get(takeId) as any;
    if (!take) return { ok: false, error: 'Take not found' };
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(take.episode_id) as any;
    if (!ep) return { ok: false, error: 'Episode not found' };
    const script = safeJson(ep.script, []);
    const segs = db.prepare('SELECT * FROM take_segments WHERE take_id=? ORDER BY seg_index ASC').all(takeId) as any[];
    const transcript = segs.map((s: any) => s.text).join(' ');
    const res = await parseAiJson<any>(
      `You are evaluating a video take against its blueprint script. Compare the actual transcript against the planned script frames and identify deviations.\n\nBlueprint script: ${JSON.stringify(script.map((f: any) => ({ text: f.text, visual: f.visual, frame_type: f.frame_type })))}\n\nActual transcript: ${transcript}\n\nReturn JSON: { "match_score": 0-1, "deviations": [{ "frame_index": number, "expected": "what was planned", "actual": "what was said", "action": "keep|modify|replace|drop" }], "verdict": "good_match|needs_edit|reshoot" }`,
      { required: ['match_score', 'deviations', 'verdict'] },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Evaluation failed: ${res.error}` };
    db.prepare('INSERT INTO take_evaluations (take_id, episode_id, match_score, deviations, verdict, created_at) VALUES (?,?,?,?,?,?)').run(
      takeId, take.episode_id, res.data.match_score, JSON.stringify(res.data.deviations), res.data.verdict, now()
    );
    db.prepare('UPDATE content_takes SET status=? WHERE id=?').run('evaluated', takeId);
    logEvent(take.episode_id, 'take_evaluated', `Take #${take.take_number} — score ${Math.round((res.data.match_score || 0) * 100)}%`, { verdict: res.data.verdict });
    return { ok: true, evaluation: res.data };
  });

  // ── edit/cutlist + overlay plan (Phase 4) ──────────────────
  ipcMain.handle('content:edit:cutlist', async (_, { episodeId, takeId }: any) => {
    // Resolve the take if not supplied: latest evaluated/selected take for the episode.
    let resolvedTakeId = takeId;
    if (!resolvedTakeId) {
      const auto = db.prepare('SELECT id FROM content_takes WHERE episode_id=? AND status IN (?,?) ORDER BY take_number DESC LIMIT 1').get(episodeId, 'selected', 'evaluated') as any;
      if (auto) resolvedTakeId = auto.id;
    }
    if (!resolvedTakeId) return { ok: false, error: 'No take supplied or found — import and evaluate a take in the Capture phase first' };
    const segs = db.prepare('SELECT * FROM take_segments WHERE take_id=? AND keep=1 ORDER BY seg_index ASC').all(resolvedTakeId) as any[];
    if (!segs.length) return { ok: false, error: 'No kept segments — select segments in Capture phase first' };
    const cutlist = segs.map((s: any, i: number) => ({
      index: i,
      start_s: s.start_s,
      end_s: s.end_s,
      duration_s: s.end_s - s.start_s,
      text: s.text,
      seg_type: s.seg_type,
      source_seg_id: s.id,
    }));
    return { ok: true, cutlist, total_duration: cutlist.reduce((a: number, c: any) => a + c.duration_s, 0) };
  });
  ipcMain.handle('content:edit:overlay-plan', async (_, { episodeId }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) as any;
    if (!ep) return { ok: false, error: 'Episode not found' };
    const script = safeJson(ep.script, []);
    const take = db.prepare('SELECT * FROM content_takes WHERE episode_id=? AND status IN (?,?) ORDER BY take_number DESC LIMIT 1').get(episodeId, 'selected', 'evaluated') as any;
    let transcript = '';
    if (take) {
      const segs = db.prepare('SELECT * FROM take_segments WHERE take_id=? AND keep=1 ORDER BY seg_index ASC').all(take.id) as any[];
      transcript = segs.map((s: any) => s.text).join(' ');
    }
    const theme = ep.theme_id ? db.prepare('SELECT * FROM themes WHERE id=?').get(ep.theme_id) as any : null;
    const res = await parseAiJson<any>(
      `You are generating an overlay plan for a short-form video. Based on the script frames and actual transcript, determine overlay placements.\n\nScript frames: ${JSON.stringify(script.map((f: any) => ({ text: f.text, visual: f.visual, duration_seconds: f.duration_seconds })))}\n\nActual transcript: ${transcript || 'No transcript yet — use script only'}\n\nTheme: ${theme ? JSON.stringify({ name: theme.name, font_display: theme.font_display, color_accent: theme.color_accent }) : 'None'}\n\nSafe zones: right 320px + bottom 400px = no text.\n\nReturn JSON: { "overlays": [{ "start_s": number, "end_s": number, "text": "string", "position": "top-left|top-center|top-right|bottom-left|bottom-center|bottom-right", "style": "hook|value|transition|cta", "font_size": "sm|md|lg|xl" }], "total_overlays": number, "notes": "string" }`,
      { required: ['overlays'] },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Overlay plan failed: ${res.error}` };
    logEvent(episodeId, 'overlay_planned', `${res.data.overlays.length} overlays planned`);
    return { ok: true, plan: res.data };
  });

  // ── episode → overlay studio link (handoff persistence) ─────
  ipcMain.handle('content:episodes:link-overlay', async (_, { episodeId, sessionId }: any) => {
    if (!episodeId) return { ok: false, error: 'episodeId required' };
    db.prepare('UPDATE content_episodes SET overlay_session_id=?, updated_at=? WHERE id=?').run(sessionId || null, now(), episodeId);
    return { ok: true, overlay_session_id: sessionId || null };
  });

  // ── caption track from transcript (deterministic, no AI) ────
  ipcMain.handle('content:edit:caption', async (_, { episodeId }: any) => {
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) as any;
    if (!ep) return { ok: false, error: 'Episode not found' };
    const take = db.prepare('SELECT * FROM content_takes WHERE episode_id=? AND status IN (?,?) ORDER BY take_number DESC LIMIT 1').get(episodeId, 'selected', 'evaluated') as any;
    if (!take) return { ok: false, error: 'No evaluated/selected take — transcribe a take in the Capture phase first' };
    const segs = db.prepare('SELECT * FROM take_segments WHERE take_id=? AND keep=1 ORDER BY seg_index ASC').all(take.id) as any[];
    if (!segs.length) return { ok: false, error: 'No kept segments — select segments in Capture phase first' };
    const transcript = { segments: segs.map((s: any, i: number) => ({ id: i, start: s.start_s, end: s.end_s, text: s.text })) };
    const seo = safeJson(ep.seo, null);
    const seoPhrases: string[] = Array.isArray(seo)
      ? seo.flatMap((k: any) => [k.phrase, k.keyword, k.text].filter(Boolean)).map((s: any) => String(s).toLowerCase())
      : (seo && typeof seo === 'object' && Array.isArray((seo as any).keywords) ? (seo as any).keywords.map((k: any) => String(k).toLowerCase()) : []);
    const sessionId = `ep-${episodeId}`;
    const track = buildCaptionFromTranscript(transcript, sessionId, seoPhrases.length ? seoPhrases : undefined);
    db.prepare('UPDATE content_episodes SET caption_track=?, caption=?, updated_at=? WHERE id=?').run(
      JSON.stringify(track),
      track.lines.map((l: any) => l.text).join('\n'),
      now(),
      episodeId
    );
    logEvent(episodeId, 'caption_generated', `${track.lines.length} caption lines`);
    return { ok: true, captionTrack: track };
  });

  // ── Overlay Sessions (ALWAYS belong to an episode) ──────────
  // Create an overlay session for an episode
  ipcMain.handle('overlay:session:create', async (_, { episodeId, name, sourceVideoPath, sourceVideoName, durationSec }: any) => {
    if (!episodeId) return { ok: false, error: 'episodeId required — overlay sessions always belong to an episode' };
    const ep = db.prepare('SELECT * FROM content_episodes WHERE id=?').get(episodeId) as any;
    if (!ep) return { ok: false, error: 'Episode not found' };
    const id = `ov-${episodeId}-${Date.now().toString(36)}`;
    const sessionName = name || `Overlay — ${ep.title || `Episode ${episodeId}`}`;
    db.prepare(`INSERT INTO overlay_sessions (id, episode_id, name, source_video_path, source_video_name, duration_sec, status, missing_source, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, episodeId, sessionName, sourceVideoPath || null, sourceVideoName || null, durationSec || null, 'linked', sourceVideoPath ? 0 : 1, now(), now());
    // Link back to episode
    db.prepare('UPDATE content_episodes SET overlay_session_id=?, updated_at=? WHERE id=?').run(id, now(), episodeId);
    logEvent(episodeId, 'overlay_session_created', `Overlay session ${id} created`);
    return { ok: true, id, session: { id, episodeId, name: sessionName, status: 'linked' } };
  });

  // Get overlay session by id
  ipcMain.handle('overlay:session:get', async (_, id: string) => {
    const row = db.prepare('SELECT * FROM overlay_sessions WHERE id=?').get(id) as any;
    if (!row) return null;
    return { ...row, transcript: safeJson(row.transcript), cutPlan: safeJson(row.cut_plan), scenePlan: safeJson(row.scene_plan), motionAssets: safeJson(row.motion_assets, []), captionTrack: safeJson(row.caption_track), overlayPlan: safeJson(row.overlay_plan) };
  });

  // List overlay sessions (optionally filtered by episodeId)
  ipcMain.handle('overlay:session:list', async (_, { episodeId }: any = {}) => {
    const rows = episodeId
      ? db.prepare('SELECT * FROM overlay_sessions WHERE episode_id=? ORDER BY updated_at DESC').all(episodeId)
      : db.prepare('SELECT * FROM overlay_sessions ORDER BY updated_at DESC').all();
    return rows.map((r: any) => ({ ...r, transcript: safeJson(r.transcript), cutPlan: safeJson(r.cut_plan), scenePlan: safeJson(r.scene_plan), motionAssets: safeJson(r.motion_assets, []), captionTrack: safeJson(r.caption_track), overlayPlan: safeJson(r.overlay_plan) }));
  });

  // Update overlay session
  ipcMain.handle('overlay:session:update', async (_, id: string, updates: any) => {
    const existing = db.prepare('SELECT * FROM overlay_sessions WHERE id=?').get(id) as any;
    if (!existing) return { ok: false, error: 'Overlay session not found' };
    const fields: string[] = [];
    const values: any[] = [];
    const updatable = ['name', 'source_video_path', 'source_video_name', 'duration_sec', 'status', 'missing_source', 'transcript', 'cut_plan', 'scene_plan', 'motion_assets', 'caption_track', 'theme_id', 'overlay_plan'];
    for (const key of updatable) {
      if (updates[key] !== undefined) {
        fields.push(`${key}=?`);
        values.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
      }
    }
    if (fields.length === 0) return { ok: true, id };
    fields.push('updated_at=?');
    values.push(now());
    values.push(id);
    db.prepare(`UPDATE overlay_sessions SET ${fields.join(', ')} WHERE id=?`).run(...values);
    return { ok: true, id };
  });

  // Delete overlay session
  ipcMain.handle('overlay:session:delete', async (_, id: string) => {
    const existing = db.prepare('SELECT episode_id FROM overlay_sessions WHERE id=?').get(id) as any;
    if (existing) {
      db.prepare('UPDATE content_episodes SET overlay_session_id=NULL WHERE id=? AND overlay_session_id=?').run(existing.episode_id, id);
    }
    db.prepare('DELETE FROM overlay_sessions WHERE id=?').run(id);
    return { ok: true };
  });

  // Get overlay session for an episode
  ipcMain.handle('episode:get-overlay', async (_, episodeId: number) => {
    const row = db.prepare('SELECT * FROM overlay_sessions WHERE episode_id=? ORDER BY updated_at DESC LIMIT 1').get(episodeId) as any;
    if (!row) return null;
    return { ...row, transcript: safeJson(row.transcript), cutPlan: safeJson(row.cut_plan), scenePlan: safeJson(row.scene_plan), motionAssets: safeJson(row.motion_assets, []), captionTrack: safeJson(row.caption_track), overlayPlan: safeJson(row.overlay_plan) };
  });

  // ── analytics correlate (Phase 5) ──────────────────────────
  ipcMain.handle('content:analytics:correlate', async () => {
    const videos = db.prepare('SELECT v.*, e.script FROM content_videos v LEFT JOIN content_episodes e ON v.episode_id=e.id WHERE v.views > 0 ORDER BY v.published_at DESC').all() as any[];
    if (videos.length < 3) return { ok: true, correlations: [], message: 'Need at least 3 published videos for correlation' };
    const data = videos.map((v: any) => {
      const script = safeJson(v.script, []);
      const vars = safeJson(v.variables, {});
      return {
        title: v.title,
        views: v.views,
        likes: v.likes,
        saves: v.saves,
        completion_pct: v.completion_pct,
        variables: {
          hook_type: vars.hook_type || script[0]?.frame_type || 'unknown',
          length_s: v.duration_seconds || script.reduce((a: number, f: any) => a + (f.duration_seconds || 0), 0),
          script_frames: script.length,
          retention_score: script.length ? script.reduce((a: number, f: any) => a + (f.retention?.score || 0), 0) / script.length : null,
          ...vars,
        },
      };
    });
    const res = await parseAiJson<any>(
      PROMPT_VARIABLE_CORRELATION.replace('{{videos}}', JSON.stringify(data)),
      { required: ['correlations'] },
      (p, s) => aiCall(p, s, 2000)
    );
    if (!res.ok) return { ok: false, error: `Correlation failed: ${res.error}` };
    return { ok: true, ...res.data };
  });

  // ── helpers ──────────────────────────────────────────────
  async function callAnalytics(episodeId?: number) {
    const videos = episodeId
      ? db.prepare('SELECT * FROM content_videos WHERE episode_id=? ORDER BY published_at DESC').all(episodeId)
      : db.prepare('SELECT * FROM content_videos ORDER BY published_at DESC').all();
    return { ok: true, mapped: videos.map(mapVideo) };
  }

  console.log(`[ContentEngine] v2.0.0 registered — ${RETENTION_RUBRIC.criteria.length} criteria (${NON_NEGOTIABLE_IDS.length} non-negotiable), ${SCORING_SCHEMES.length} schemes, 5 new tables (timeline/reflections/characteristics/calibrations/schemes)`);
}

// ── schema ─────────────────────────────────────────────────
function ensureTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      niche TEXT,
      tone TEXT,
      visual_style TEXT,
      pacing TEXT,
      target_duration TEXT,
      brand_colors JSON,
      episode_format TEXT DEFAULT 'standard',
      frame_mode TEXT DEFAULT 'strict',
      arc_outline JSON,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      hook TEXT,
      format_type TEXT DEFAULT 'listicle',
      status TEXT DEFAULT 'raw',
      priority INTEGER DEFAULT 3,
      series TEXT,
      niche TEXT,
      frames JSON,
      synthesized_from JSON,
      gates JSON,
      brainstorm_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_brainstorms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thought TEXT NOT NULL,
      category TEXT DEFAULT 'general_thought',
      format_type TEXT,
      niche_hint TEXT,
      suggested_title TEXT,
      reason TEXT,
      summary JSON,
      idea_id INTEGER,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      idea_id INTEGER,
      theme_id INTEGER,
      series_id INTEGER,
      episode_number INTEGER,
      status TEXT DEFAULT 'draft',
      niche TEXT,
      script JSON,
      seo JSON,
      gates JSON,
      gate_override INTEGER DEFAULT 0,
      overlay_session_id TEXT,
      caption_track JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- Overlay sessions — ALWAYS belong to an episode (episode_id NOT NULL)
    CREATE TABLE IF NOT EXISTS overlay_sessions (
      id TEXT PRIMARY KEY,
      episode_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source_video_path TEXT,
      source_video_name TEXT,
      duration_sec REAL,
      status TEXT DEFAULT 'linked',
      missing_source INTEGER DEFAULT 0,
      transcript JSON,
      cut_plan JSON,
      scene_plan JSON,
      motion_assets JSON DEFAULT '[]',
      caption_track JSON,
      theme_id INTEGER,
      overlay_plan JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (episode_id) REFERENCES content_episodes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_overlay_sessions_episode ON overlay_sessions(episode_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_series ON content_episodes(series_id);
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      accent_color TEXT DEFAULT '#f5c518',
      icon TEXT DEFAULT 'Palette',
      status TEXT DEFAULT 'active',
      font_display TEXT,
      font_body TEXT,
      font_accent TEXT,
      color_bg TEXT,
      color_text TEXT,
      color_accent TEXT,
      color_accent2 TEXT,
      color_accent3 TEXT,
      headline_case TEXT DEFAULT 'uppercase',
      headline_size TEXT DEFAULT '27px',
      category TEXT DEFAULT 'general',
      use_case TEXT,
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_frameworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rules JSON,
      version INTEGER DEFAULT 1,
      is_builtin INTEGER DEFAULT 0,
      history JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      platform TEXT DEFAULT 'tiktok',
      url TEXT,
      title TEXT,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      completion_pct REAL,
      retention_curve JSON,
      audience JSON,
      dropoffs JSON,
      published_at DATETIME,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER,
      episode_id INTEGER,
      lesson TEXT NOT NULL,
      evidence JSON,
      confidence REAL DEFAULT 0.5,
      applies_to TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS video_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      video_id INTEGER,
      reflection_text TEXT NOT NULL,
      analysis JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS video_characteristics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      characteristics JSON,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS process_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      event_type TEXT NOT NULL,
      label TEXT,
      detail JSON,
      ai_model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS score_calibrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      scheme_id TEXT,
      accuracy REAL,
      per_criterion JSON,
      predictions JSON,
      actual JSON,
      recommendations JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scoring_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tier TEXT,
      description TEXT,
      weights JSON,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_idea ON content_episodes(idea_id);
  CREATE INDEX IF NOT EXISTS idx_ideas_brainstorm ON content_ideas(brainstorm_id);
  CREATE INDEX IF NOT EXISTS idx_brainstorms_idea ON content_brainstorms(idea_id);
    CREATE INDEX IF NOT EXISTS idx_videos_episode ON content_videos(episode_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_video ON content_lessons(video_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_episode ON process_timeline(episode_id);
    CREATE INDEX IF NOT EXISTS idx_reflections_episode ON video_reflections(episode_id);
    CREATE TABLE IF NOT EXISTS content_takes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      take_number INTEGER DEFAULT 1,
      file_path TEXT,
      duration_seconds REAL,
      status TEXT DEFAULT 'recorded'
        CHECK (status IN ('recorded','transcribing','transcribed','evaluated','selected','discarded')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
    );
    CREATE TABLE IF NOT EXISTS take_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      take_id INTEGER NOT NULL,
      seg_index INTEGER NOT NULL,
      start_s REAL NOT NULL,
      end_s REAL NOT NULL,
      text TEXT NOT NULL,
      seg_type TEXT DEFAULT 'beat'
        CHECK (seg_type IN ('hook','beat','transition','cta','silence','filler')),
      keep BOOLEAN DEFAULT NULL,
      retention_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (take_id) REFERENCES content_takes(id)
    );
    CREATE TABLE IF NOT EXISTS take_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      take_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      match_score REAL,
      deviations JSON,
      verdict TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (take_id) REFERENCES content_takes(id),
      FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_takes_episode ON content_takes(episode_id);
    CREATE INDEX IF NOT EXISTS idx_segments_take ON take_segments(take_id);
  `);
  const cols: Record<string, string[]> = {};
  for (const t of ['content_lessons', 'content_frameworks', 'content_episodes', 'content_ideas']) {
    cols[t] = (db.prepare(`PRAGMA table_info(${t})`).all() as any[]).map((c) => c.name);
  }
  if (!cols.content_ideas.includes('brainstorm_id')) db.exec(`ALTER TABLE content_ideas ADD COLUMN brainstorm_id INTEGER`);
  if (!cols.content_lessons.includes('confidence')) db.exec(`ALTER TABLE content_lessons ADD COLUMN confidence REAL DEFAULT 0.5`);
  if (!cols.content_lessons.includes('applies_to')) db.exec(`ALTER TABLE content_lessons ADD COLUMN applies_to TEXT`);
  if (!cols.content_frameworks.includes('is_active')) db.exec(`ALTER TABLE content_frameworks ADD COLUMN is_active INTEGER DEFAULT 1`);
  if (!cols.content_episodes.includes('scheme_id')) db.exec(`ALTER TABLE content_episodes ADD COLUMN scheme_id TEXT DEFAULT 'audience_builder'`);
  if (!cols.content_episodes.includes('published_at')) db.exec(`ALTER TABLE content_episodes ADD COLUMN published_at DATETIME`);
  if (!cols.content_episodes.includes('process')) db.exec(`ALTER TABLE content_episodes ADD COLUMN process JSON`);
  if (!cols.content_episodes.includes('series_id')) db.exec(`ALTER TABLE content_episodes ADD COLUMN series_id INTEGER`);
  if (!cols.content_episodes.includes('episode_number')) db.exec(`ALTER TABLE content_episodes ADD COLUMN episode_number INTEGER`);
  if (!cols.content_episodes.includes('aspect_ratio')) db.exec(`ALTER TABLE content_episodes ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`);
  if (!cols.content_episodes.includes('phase')) db.exec(`ALTER TABLE content_episodes ADD COLUMN phase TEXT DEFAULT 'idea'`);
  if (!cols.content_episodes.includes('caption')) db.exec(`ALTER TABLE content_episodes ADD COLUMN caption TEXT`);
  if (!cols.content_episodes.includes('hook_stack')) db.exec(`ALTER TABLE content_episodes ADD COLUMN hook_stack JSON`);
  if (!cols.content_episodes.includes('curiosity_gaps')) db.exec(`ALTER TABLE content_episodes ADD COLUMN curiosity_gaps JSON`);
  if (!cols.content_episodes.includes('timeline')) db.exec(`ALTER TABLE content_episodes ADD COLUMN timeline JSON`);
  if (!cols.content_episodes.includes('pinned_comment')) db.exec(`ALTER TABLE content_episodes ADD COLUMN pinned_comment TEXT`);
  if (!cols.content_episodes.includes('overlay_session_id')) db.exec(`ALTER TABLE content_episodes ADD COLUMN overlay_session_id TEXT`);
  if (!cols.content_episodes.includes('caption_track')) db.exec(`ALTER TABLE content_episodes ADD COLUMN caption_track JSON`);

  const vidCols = (db.prepare(`PRAGMA table_info(content_videos)`).all() as any[]).map((c) => c.name);
  if (!vidCols.includes('variables')) db.exec(`ALTER TABLE content_videos ADD COLUMN variables JSON`);

  const themeCols = (db.prepare(`PRAGMA table_info(themes)`).all() as any[]).map((c) => c.name);
  if (!themeCols.includes('font_display')) db.exec(`ALTER TABLE themes ADD COLUMN font_display TEXT`);
  if (!themeCols.includes('font_body')) db.exec(`ALTER TABLE themes ADD COLUMN font_body TEXT`);
  if (!themeCols.includes('font_accent')) db.exec(`ALTER TABLE themes ADD COLUMN font_accent TEXT`);
  if (!themeCols.includes('color_bg')) db.exec(`ALTER TABLE themes ADD COLUMN color_bg TEXT`);
  if (!themeCols.includes('color_text')) db.exec(`ALTER TABLE themes ADD COLUMN color_text TEXT`);
  if (!themeCols.includes('color_accent')) db.exec(`ALTER TABLE themes ADD COLUMN color_accent TEXT`);
  if (!themeCols.includes('color_accent2')) db.exec(`ALTER TABLE themes ADD COLUMN color_accent2 TEXT`);
  if (!themeCols.includes('color_accent3')) db.exec(`ALTER TABLE themes ADD COLUMN color_accent3 TEXT`);
  if (!themeCols.includes('headline_case')) db.exec(`ALTER TABLE themes ADD COLUMN headline_case TEXT DEFAULT 'uppercase'`);
  if (!themeCols.includes('headline_size')) db.exec(`ALTER TABLE themes ADD COLUMN headline_size TEXT DEFAULT '27px'`);
  if (!themeCols.includes('category')) db.exec(`ALTER TABLE themes ADD COLUMN category TEXT DEFAULT 'general'`);
  if (!themeCols.includes('use_case')) db.exec(`ALTER TABLE themes ADD COLUMN use_case TEXT`);
  if (!themeCols.includes('is_builtin')) db.exec(`ALTER TABLE themes ADD COLUMN is_builtin INTEGER DEFAULT 0`);
  if (!themeCols.includes('audience')) db.exec(`ALTER TABLE themes ADD COLUMN audience JSON`);
  if (!themeCols.includes('content_hooks')) db.exec(`ALTER TABLE themes ADD COLUMN content_hooks JSON`);
}

// ── built-in frameworks (v3.0 spec) ────────────────────────
function seedBuiltins(db: any) {
  const count = (db.prepare('SELECT COUNT(*) c FROM content_frameworks WHERE is_builtin=1').get() as any).c;
  if (count > 0) return;
  const builtins = [
    { name: 'Hook-Value Loop', description: 'Open with a hook that promises a payoff, then deliver value beats that each re-hook the viewer for the next segment.', rules: [
      { id: 'hv1', rule: 'Every value segment ends with an unresolved teaser that re-hooks into the next segment' },
      { id: 'hv2', rule: 'The first payoff lands within 8 seconds' },
      { id: 'hv3', rule: 'CTA only after the final payoff' },
    ] },
    { name: 'Contrast Story', description: 'Show the "before" pain, then the "after" transformation — the gap keeps viewers watching for the payoff.', rules: [
      { id: 'cs1', rule: 'Establish the pain concretely in the first 5 seconds' },
      { id: 'cs2', rule: 'Hold back the transformation until at least 40% through' },
      { id: 'cs3', rule: 'Make the transformation measurable (numbers, before/after)' },
    ] },
    { name: 'Problem → Solution Echo', description: 'State the problem, promise a solution, then echo the problem at the end to confirm the solution landed.', rules: [
      { id: 'pe1', rule: 'First line names the exact problem the viewer feels' },
      { id: 'pe2', rule: 'Middle delivers one solution per segment' },
      { id: 'pe3', rule: 'Last segment re-states the problem and confirms the fix' },
    ] },
    { name: 'Listicle Value', description: 'Numbered value list — each item is a self-contained payoff with a mini-hook.', rules: [
      { id: 'lv1', rule: 'Count is stated up front (3-7 items)' },
      { id: 'lv2', rule: 'Each item opens with a mini-hook and pays off within 10 seconds' },
      { id: 'lv3', rule: 'Order items worst → best' },
    ] },
    { name: 'Question-Reveal', description: 'Open with a provocative question, then reveal the answer through the body — the reveal IS the retention engine.', rules: [
      { id: 'qr1', rule: 'The question must have stakes (what happens if you get it wrong)' },
      { id: 'qr2', rule: 'Tease the reveal at 30% and 60% without giving it away' },
      { id: 'qr3', rule: 'Reveal lands in the final 15%' },
    ] },
  ];
  const insert = db.prepare('INSERT INTO content_frameworks (name, description, rules, version, is_builtin, history, created_at, updated_at) VALUES (?,?,?,1,1,?,?,?)');
  const ts = now();
  for (const b of builtins) insert.run(b.name, b.description, JSON.stringify(b.rules), JSON.stringify([]), ts, ts);
  console.log(`[ContentEngine] seeded ${builtins.length} built-in frameworks`);

  const schemeCount = (db.prepare('SELECT COUNT(*) c FROM scoring_schemes').get() as any).c;
  if (schemeCount === 0) {
    const sInsert = db.prepare('INSERT OR IGNORE INTO scoring_schemes (scheme_id, name, tier, description, weights, is_active) VALUES (?,?,?,?,?,1)');
    for (const s of SCORING_SCHEMES) {
      sInsert.run(s.id, s.name, s.tier, s.description, JSON.stringify(s.weights));
    }
    console.log(`[ContentEngine] seeded ${SCORING_SCHEMES.length} scoring schemes`);
  }

  const themeCount = (db.prepare('SELECT COUNT(*) c FROM themes WHERE is_builtin=1').get() as any).c;
  if (themeCount === 0) {
    const tInsert = db.prepare(`INSERT INTO themes (name, description, accent_color, font_display, font_body, font_accent, color_bg, color_text, color_accent, color_accent2, color_accent3, headline_case, headline_size, category, use_case, is_builtin, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const ts = now();
    const themes = [
      { name: 'Iron Headline', desc: 'Maximum-impact hook text. Built for the 0.5-2s window before someone scrolls past.', cat: 'catchy', use: 'Hook openers, hype cuts, scroll-stopping titles', display: 'Anton', body: 'Inter', accent: 'Space Mono', bg: '#0D0221', text: '#FFFFFF', a1: '#FF00E4', a2: '#00F0FF', a3: '#FFF200', hc: 'uppercase', hs: '27px' },
      { name: 'Soft Standard', desc: 'Clean, legible, does not fight the footage. Default choice for straight captioning.', cat: 'general', use: 'Straight captioning, voiceover subtitles, general text overlays', display: 'Poppins', body: 'Poppins', accent: 'Caveat', bg: '#FFFFFF', text: '#111111', a1: '#2D5BFF', a2: '#6E6E6E', a3: '#E5E5E5', hc: 'none', hs: '23px' },
      { name: 'Editorial Calm', desc: 'Serif elegance for slower, reflective voiceover — walkthroughs, lessons learned.', cat: 'general', use: 'Reflective voiceover, walkthroughs, lessons learned', display: 'Playfair Display', body: 'Lora', accent: 'DM Sans', bg: '#FAF7F2', text: '#1C1C1C', a1: '#A88B5B', a2: '#B0342D', a3: '#7A7A7A', hc: 'none', hs: '25px' },
      { name: 'Cartoon Pop', desc: 'Loud and bouncy. Comedic beats, reactions, big reveals.', cat: 'catchy', use: 'Comedic hooks, reaction cuts, big reveals', display: 'Bangers', body: 'Baloo 2', accent: 'Fredoka', bg: '#FFFFFF', text: '#2B2B2B', a1: '#FF6FB5', a2: '#4ADEDE', a3: '#FFD23F', hc: 'uppercase', hs: '26px' },
      { name: 'Street Grit', desc: 'Condensed and punchy. Streetwear / hype-cut energy for openers.', cat: 'catchy', use: 'Hype cuts, streetwear energy, tech/gaming edits', display: 'Bebas Neue', body: 'Space Grotesk', accent: 'Archivo Black', bg: '#1A1A2E', text: '#FFFFFF', a1: '#FF003C', a2: '#00FFA3', a3: '#FFEA00', hc: 'uppercase', hs: '30px' },
      { name: 'Minimal Luxe', desc: 'Quiet and expensive-looking. Slow-paced, aesthetic-forward content.', cat: 'general', use: 'Aesthetic content, slow-paced, luxury feel', display: 'Cormorant Garamond', body: 'Montserrat', accent: 'Cormorant Garamond', bg: '#FAF7F2', text: '#1C1C1C', a1: '#A88B5B', a2: '#B0342D', a3: '#7A7A7A', hc: 'none', hs: '26px' },
      { name: 'Bubble Y2K', desc: 'Rounded, nostalgic, high-energy. Good for playful hook lines.', cat: 'catchy', use: 'Playful hooks, nostalgic energy, kids/bright content', display: 'Titan One', body: 'Baloo 2', accent: 'Chewy', bg: '#FFF7FA', text: '#3A3A3A', a1: '#FF7FB0', a2: '#5AA9D9', a3: '#54B892', hc: 'none', hs: '24px' },
      { name: 'Build in Public', desc: 'Dev-log captions, data call-outs, code-demo UI text.', cat: 'general', use: 'Dev-log, code demos, data call-outs, deskflow build content', display: 'Manrope', body: 'Inter', accent: 'IBM Plex Mono', bg: '#F4F4F5', text: '#18181B', a1: '#3B82F6', a2: '#71717A', a3: '#DC2626', hc: 'none', hs: '23px' },
      { name: 'Handwritten Note', desc: 'Personal, diary-style, warm. Behind-the-scenes or story segments.', cat: 'general', use: 'Behind-the-scenes, personal stories, diary-style beats', display: 'Permanent Marker', body: 'Nunito Sans', accent: 'Kalam', bg: '#EFE3D0', text: '#3F3F3F', a1: '#5C4033', a2: '#A47551', a3: '#D9A566', hc: 'none', hs: '23px' },
      { name: 'Techno Future', desc: 'Sharp, futuristic. Tech-forward hooks, AI/product-reveal moments.', cat: 'catchy', use: 'Tech hooks, AI reveals, product launches, futuristic feel', display: 'Unbounded', body: 'Space Grotesk', accent: 'JetBrains Mono', bg: '#0D0221', text: '#FFFFFF', a1: '#FF00E4', a2: '#00F0FF', a3: '#FFF200', hc: 'none', hs: '22px' },
    ];
    for (const t of themes) {
      tInsert.run(t.name, t.desc, t.a1, t.display, t.body, t.accent, t.bg, t.text, t.a1, t.a2, t.a3, t.hc, t.hs, t.cat, t.use, 1, 'active', ts, ts);
    }
    console.log(`[ContentEngine] seeded ${themes.length} built-in overlay themes`);
  }
}

// ── mappers ────────────────────────────────────────────────
function mapIdea(r: any) {
  return { ...r, frames: safeJson(r.frames), synthesized_from: safeJson(r.synthesized_from), gates: safeJson(r.gates) };
}
function mapBrainstorm(r: any) {
  return { ...r, summary: safeJson(r.summary) };
}
function mapEpisode(r: any) {
  return { ...r, script: safeJson(r.script), seo: safeJson(r.seo), gates: safeJson(r.gates), gate_override: !!r.gate_override, process: safeJson(r.process, {}), phase: r.phase || 'idea', caption_track: safeJson(r.caption_track), series_id: r.series_id || null, episode_number: r.episode_number || null, overlay_session_id: r.overlay_session_id || null };
}
function mapTheme(r: any) {
  return {
    ...r,
    is_builtin: !!r.is_builtin,
    font_display: r.font_display || null,
    font_body: r.font_body || null,
    font_accent: r.font_accent || null,
    color_bg: r.color_bg || null,
    color_text: r.color_text || null,
    color_accent: r.color_accent || r.accent_color || null,
    color_accent2: r.color_accent2 || null,
    color_accent3: r.color_accent3 || null,
    headline_case: r.headline_case || 'uppercase',
    headline_size: r.headline_size || '27px',
    category: r.category || 'general',
    use_case: r.use_case || null,
  };
}
function mapVideo(r: any) {
  return {
    ...r,
    retention_curve: safeJson(r.retention_curve),
    audience: safeJson(r.audience),
    dropoffs: safeJson(r.dropoffs),
  };
}
function mapLesson(r: any) {
  return { ...r, evidence: safeJson(r.evidence) };
}
function mapReflection(r: any) {
  return { ...r, analysis: safeJson(r.analysis) };
}
function mapTimelineEvent(r: any) {
  return { ...r, detail: safeJson(r.detail) };
}
function mapFramework(r: any) {
  return { ...r, rules: safeJson(r.rules), history: safeJson(r.history), is_builtin: !!r.is_builtin, is_active: r.is_active !== 0 };
}
function safeJson(v: any, fallback: any = null) {
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
function fmtTs(index: number) {
  const s = index * 8;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function aggregateVideos(videos: any[]) {
  if (!videos.length) return { count: 0 };
  const sum = (k: string) => videos.reduce((a, v) => a + (v[k] || 0), 0);
  const withRetention = videos.filter((v) => Array.isArray(v.retention_curve) && v.retention_curve.length > 0);
  return {
    count: videos.length,
    views: sum('views'),
    likes: sum('likes'),
    saves: sum('saves'),
    shares: sum('shares'),
    comments: sum('comments'),
    avgCompletion: videos.filter((v) => v.completion_pct != null).length
      ? videos.filter((v) => v.completion_pct != null).reduce((a, v) => a + (v.completion_pct || 0), 0) / videos.filter((v) => v.completion_pct != null).length
      : null,
    avgRetentionCurve: withRetention.length
      ? withRetention[0].retention_curve.map((_: any, i: number) => ({
          t: withRetention[0].retention_curve[i].t,
          pct: withRetention.reduce((a, v) => a + (v.retention_curve[i]?.pct || 0), 0) / withRetention.length,
        }))
      : [],
  };
}
