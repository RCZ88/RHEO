# CONTEXT: Round 2b answers — six REQUESTs, real source, line-anchored

> Paths corrected/flagged by the Project Owner before you design M6:
> 1. `ContextGraphView.tsx` lives at `src/features/warmth/ContextGraphView.tsx` (NOT in `context-brain/`).
> 2. **The MCP server already exists**: `src/main/ai/contextBrainMCP.ts` (544 lines) — do not design a new one; extend it.
> 3. **A backfill service already exists and is wired**: `src/main/ai/contextBackfill.ts` (182 lines), called at `src/main.ts:17983` (`const { setContextDb, runContextBackfill } = require('./main/ai/contextBackfill')`). Your M2 `brain:backfill` design MUST reconcile with this or replace it explicitly (replacement = removal-list item for CZ).
> 4. Also present in `src/main/ai/`: `memoryCapture.ts`, `memoryCompaction.ts`, `memoryExtractor.ts`, `memoryRetrieval.ts`, `memoryStore.ts`, `chatLibrary.ts`, `contextFormatter.ts`, `contextScheduler.ts`, `providers/` (googleAiStudio.ts) — none were in your Round-0 map. Ask if you need them.
> 5. The chat send path is the `ai-chat:send` IPC handler at `src/main.ts:22855` (ends ~23010, next handler `ai-debug:log` at 23011). The LLM call is `callProvider` from `src/services/providers/callProvider` — the brain-enrichment insertion point is step 3/4 of that handler.


## REQUEST 1: src/main/ai/userContextService.ts (FULL, 419 lines)
   1: /**
   2:  * UserContextService — Unified context management system (Auto-Context Engine)
   3:  * 
   4:  * Aggregates user data from all sources into a living, read-derived profile.
   5:  * - Signal ingestion (explicit + regex-extracted)
   6:  * - Confidence scoring (source weight × explicitness × recency decay × occurrence boost)
   7:  * - Conflict resolution / supersession (explicit beats inferred)
   8:  * - Profile projection (traits, habits, preferences, interests, communication style,
   9:  *   activity patterns, growth markers, memory highlights, summary)
  10:  */
  11: 
  12: let dbRef: any = null;
  13: 
  14: export function setContextDb(db: any) { dbRef = db; }
  15: 
  16: export interface UserProfile {
  17:   id: string
  18:   traits: Record<string, any>
  19:   habits: Record<string, any>
  20:   preferences: Record<string, any>
  21:   goalsPattern: Record<string, any>
  22:   activityPattern: Record<string, any>
  23:   growthMarkers: Array<{ date: string; label: string; source: string; type: string }>
  24:   communicationStyle: Record<string, any>
  25:   interests: Record<string, any>
  26:   memoryHighlights: Array<{ content: string; source: string; importance: number }>
  27:   summary: string
  28:   contextVersion: number
  29:   lastUpdatedAt: number
  30:   createdAt: number
  31: }
  32: 
  33: export interface ContextSignal {
  34:   id: string
  35:   signalType: string
  36:   content: string
  37:   source: string
  38:   sourceRef?: string
  39:   category?: string
  40:   confidence: number
  41:   firstSeenAt: number
  42:   lastSeenAt: number
  43:   occurrenceCount: number
  44:   supersededBy?: string
  45:   active: number
  46: }
  47: 
  48: const DEFAULT_PROFILE: UserProfile = {
  49:   id: 'main',
  50:   traits: {},
  51:   habits: {},
  52:   preferences: {},
  53:   goalsPattern: {},
  54:   activityPattern: {},
  55:   growthMarkers: [],
  56:   communicationStyle: {},
  57:   interests: {},
  58:   memoryHighlights: [],
  59:   summary: '',
  60:   contextVersion: 1,
  61:   lastUpdatedAt: Date.now(),
  62:   createdAt: Date.now(),
  63: };
  64: 
  65: // ═══ Source weights (spec §8.2) ═══
  66: const SOURCE_WEIGHTS: Record<string, number> = {
  67:   correction: 1.0,
  68:   explicit_statement: 0.9,
  69:   milestone: 0.85,
  70:   reflection: 0.75,
  71:   memory: 0.7,
  72:   goal: 0.65,
  73:   llm_extraction: 0.55,
  74:   regex_extraction: 0.4,
  75:   app_usage: 0.35,
  76:   chat: 0.4,
  77:   manual: 0.8,
  78: };
  79: 
  80: // ═══ Signal type half-lives in days (spec §8.3) ═══
  81: const HALF_LIVES: Record<string, number> = {
  82:   correction: 365,
  83:   preference: 180,
  84:   communication: 180,
  85:   habit: 60,
  86:   interest: 90,
  87:   mood_pattern: 30,
  88:   milestone: Infinity,
  89:   goal_pattern: 90,
  90:   trait: 120,
  91:   rule: 365,
  92: };
  93: 
  94: function rowToProfile(row: any): UserProfile {
  95:   return {
  96:     id: row.id,
  97:     traits: JSON.parse(row.traits || '{}'),
  98:     habits: JSON.parse(row.habits || '{}'),
  99:     preferences: JSON.parse(row.preferences || '{}'),
 100:     goalsPattern: JSON.parse(row.goals_pattern || '{}'),
 101:     activityPattern: JSON.parse(row.activity_pattern || '{}'),
 102:     growthMarkers: JSON.parse(row.growth_markers || '[]'),
 103:     communicationStyle: JSON.parse(row.communication_style || '{}'),
 104:     interests: JSON.parse(row.interests || '{}'),
 105:     memoryHighlights: JSON.parse(row.memory_highlights || '[]'),
 106:     summary: row.summary || '',
 107:     contextVersion: row.context_version || 1,
 108:     lastUpdatedAt: row.last_updated_at || Date.now(),
 109:     createdAt: row.created_at || Date.now(),
 110:   };
 111: }
 112: 
 113: function rowToSignal(row: any): ContextSignal {
 114:   return {
 115:     id: row.id,
 116:     signalType: row.signal_type,
 117:     content: row.content,
 118:     source: row.source,
 119:     sourceRef: row.source_ref || undefined,
 120:     category: row.category || undefined,
 121:     confidence: row.confidence || 0.5,
 122:     firstSeenAt: row.first_seen_at || Date.now(),
 123:     lastSeenAt: row.last_seen_at || Date.now(),
 124:     occurrenceCount: row.occurrence_count || 1,
 125:     supersededBy: row.superseded_by || undefined,
 126:     active: row.active ?? 1,
 127:   };
 128: }
 129: 
 130: export function getProfile(): UserProfile {
 131:   if (!dbRef) return { ...DEFAULT_PROFILE };
 132:   const row = dbRef.prepare('SELECT * FROM user_context_profile WHERE id = ?').get('main');
 133:   return row ? rowToProfile(row) : { ...DEFAULT_PROFILE };
 134: }
 135: 
 136: export function updateProfile(patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): void {
 137:   if (!dbRef) return;
 138:   const existing = getProfile();
 139:   const merged = {
 140:     traits: JSON.stringify({ ...existing.traits, ...patch.traits }),
 141:     habits: JSON.stringify({ ...existing.habits, ...patch.habits }),
 142:     preferences: JSON.stringify({ ...existing.preferences, ...patch.preferences }),
 143:     goals_pattern: JSON.stringify({ ...existing.goalsPattern, ...patch.goalsPattern }),
 144:     activity_pattern: JSON.stringify({ ...existing.activityPattern, ...patch.activityPattern }),
 145:     growth_markers: JSON.stringify(patch.growthMarkers || existing.growthMarkers),
 146:     communication_style: JSON.stringify({ ...existing.communicationStyle, ...patch.communicationStyle }),
 147:     interests: JSON.stringify({ ...existing.interests, ...patch.interests }),
 148:     memory_highlights: JSON.stringify(patch.memoryHighlights || existing.memoryHighlights),
 149:     summary: patch.summary ?? existing.summary,
 150:     context_version: (existing.contextVersion || 0) + 1,
 151:     last_updated_at: Date.now(),
 152:   };
 153: 
 154:   const existingRow = dbRef.prepare('SELECT id FROM user_context_profile WHERE id = ?').get('main');
 155:   if (existingRow) {
 156:     dbRef.prepare(`
 157:       UPDATE user_context_profile SET traits=?, habits=?, preferences=?, goals_pattern=?,
 158:       activity_pattern=?, growth_markers=?, communication_style=?, interests=?,
 159:       memory_highlights=?, summary=?, context_version=?, last_updated_at=? WHERE id=?
 160:     `).run(merged.traits, merged.habits, merged.preferences, merged.goals_pattern,
 161:       merged.activity_pattern, merged.growth_markers, merged.communication_style,
 162:       merged.interests, merged.memory_highlights, merged.summary,
 163:       merged.context_version, merged.last_updated_at, 'main');
 164:   } else {
 165:     dbRef.prepare(`
 166:       INSERT INTO user_context_profile (id, traits, habits, preferences, goals_pattern,
 167:       activity_pattern, growth_markers, communication_style, interests, memory_highlights,
 168:       summary, context_version, last_updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 169:     `).run('main', merged.traits, merged.habits, merged.preferences, merged.goals_pattern,
 170:       merged.activity_pattern, merged.growth_markers, merged.communication_style,
 171:       merged.interests, merged.memory_highlights, merged.summary,
 172:       merged.context_version, merged.last_updated_at, Date.now());
 173:   }
 174: }
 175: 
 176: // ═══ Confidence scoring (spec §8) ═══
 177: 
 178: export function computeConfidence(signalType: string, source: string, ageInDays: number, occurrenceCount: number): number {
 179:   const sourceWeight = SOURCE_WEIGHTS[source] ?? 0.4;
 180:   const halfLife = HALF_LIVES[signalType] ?? 90;
 181:   const recencyDecay = halfLife === Infinity ? 1 : Math.exp(-ageInDays / halfLife);
 182:   const occurrenceBoost = 1 + Math.log(Math.max(1, occurrenceCount));
 183:   return Math.min(1.0, sourceWeight * recencyDecay * occurrenceBoost);
 184: }
 185: 
 186: // ═══ Signal ingestion (spec §9 conflict resolution) ═══
 187: 
 188: export function addSignal(
 189:   signalType: string,
 190:   content: string,
 191:   source: string,
 192:   confidence: number = 0.5,
 193:   opts: { sourceRef?: string; category?: string; supersedes?: string } = {}
 194: ): void {
 195:   if (!dbRef) return;
 196:   const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
 197:   const now = Date.now();
 198: 
 199:   // Dedup: same type + same normalized content (first 80 chars)
 200:   const existing = dbRef.prepare(
 201:     'SELECT * FROM user_context_signals WHERE signal_type = ? AND content LIKE ? AND superseded_by IS NULL'
 202:   ).get(signalType, content.slice(0, 80) + '%');
 203: 
 204:   if (existing) {
 205:     const ageDays = (now - (existing.first_seen_at || now)) / 86400000;
 206:     const recalc = computeConfidence(signalType, source, ageDays, (existing.occurrence_count || 0) + 1);
 207:     const newConfidence = Math.max(existing.confidence || 0.5, recalc, confidence);
 208:     dbRef.prepare(`
 209:       UPDATE user_context_signals SET occurrence_count = occurrence_count + 1,
 210:       confidence = ?, last_seen_at = ?, source = CASE WHEN ? = 1 THEN source ELSE ? END WHERE id = ?
 211:     `).run(Math.min(1.0, newConfidence), now, confidence > (existing.confidence || 0) ? 1 : 0, source, existing.id);
 212:   } else {
 213:     // Conflict resolution: explicit supersedes inferred with same type+subject
 214:     if (opts.supersedes) {
 215:       dbRef.prepare('UPDATE user_context_signals SET active = 0, superseded_by = ? WHERE id = ?')
 216:         .run(id, opts.supersedes);
 217:     }
 218:     dbRef.prepare(`
 219:       INSERT INTO user_context_signals (id, signal_type, content, source, source_ref, category, confidence, first_seen_at, last_seen_at, occurrence_count, active)
 220:       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
 221:     `).run(id, signalType, content, source, opts.sourceRef || null, opts.category || null,
 222:       Math.min(1.0, Math.max(confidence, computeConfidence(signalType, source, 0, 1))), now, now);
 223:   }
 224: }
 225: 
 226: export function getSignals(signalType?: string, source?: string, limit: number = 50, includeSuperseded: boolean = false): ContextSignal[] {
 227:   if (!dbRef) return [];
 228:   let query = 'SELECT * FROM user_context_signals WHERE 1=1';
 229:   const params: any[] = [];
 230:   if (!includeSuperseded) query += ' AND superseded_by IS NULL';
 231:   if (signalType) { query += ' AND signal_type = ?'; params.push(signalType); }
 232:   if (source) { query += ' AND source = ?'; params.push(source); }
 233:   query += ' ORDER BY confidence DESC, last_seen_at DESC LIMIT ?';
 234:   params.push(limit);
 235:   return dbRef.prepare(query).all(...params).map(rowToSignal);
 236: }
 237: 
 238: export function setSignalConfidence(signalId: string, confidence: number): void {
 239:   if (!dbRef) return;
 240:   dbRef.prepare('UPDATE user_context_signals SET confidence = ? WHERE id = ?')
 241:     .run(Math.min(1, Math.max(0, confidence)), signalId);
 242: }
 243: 
 244: // ═══ Regex heuristic extraction (spec §7.4) — from episode text ═══
 245: 
 246: const PREFERENCE_RE = /(?:i|user)\s+(?:prefer|like|want|love|hate|dislike|always use|never use|prefers)\s+(.+)/i;
 247: const CORRECTION_RE = /(?:don't|do not|stop|avoid|never|please don't)\s+(.+)/i;
 248: const FOCUS_RE = /(?:i am|i'm|currently|right now)\s+(?:working on|focused on|building|implementing)\s+(.+)/i;
 249: const GOAL_RE = /(?:my goal|milestone|finished|completed|achieved)\s+(.+)/i;
 250: const TONE_RE = /(?:be|keep it|answer|respond)\s+(?:concise|brief|short|detailed|thorough|direct|casual|formal)/i;
 251: 
 252: export function extractSignalsFromText(text: string, source: string): Array<{ signalType: string; content: string; confidence: number }> {
 253:   const signals: Array<{ signalType: string; content: string; confidence: number }> = [];
 254:   const lower = text.toLowerCase();
 255: 
 256:   const m1 = PREFERENCE_RE.exec(lower);
 257:   if (m1) signals.push({ signalType: 'preference', content: `User prefers ${m1[1].trim().slice(0, 120)}`, confidence: 0.42 });
 258: 
 259:   const m2 = CORRECTION_RE.exec(lower);
 260:   if (m2) signals.push({ signalType: 'correction', content: `User asked to avoid: ${m2[1].trim().slice(0, 120)}`, confidence: 0.55 });
 261: 
 262:   const m3 = FOCUS_RE.exec(lower);
 263:   if (m3) signals.push({ signalType: 'interest', content: `Current focus: ${m3[1].trim().slice(0, 120)}`, confidence: 0.4 });
 264: 
 265:   const m4 = GOAL_RE.exec(lower);
 266:   if (m4) signals.push({ signalType: 'goal_pattern', content: `Goal/milestone: ${m4[1].trim().slice(0, 120)}`, confidence: 0.45 });
 267: 
 268:   const m5 = TONE_RE.exec(lower);
 269:   if (m5) signals.push({ signalType: 'communication', content: `Prefers ${m5[1].toLowerCase()} responses`, confidence: 0.5 });
 270: 
 271:   // Keyword interest detection
 272:   const keywords = text.match(/\b(AI|LLM|context|graph|MCP|SQLite|Electron|React|TypeScript|design|finance|tracking|terminal|automation)\b/gi) || [];
 273:   const counted = new Map<string, number>();
 274:   for (const kw of keywords) counted.set(kw.toLowerCase(), (counted.get(kw.toLowerCase()) || 0) + 1);
 275:   for (const [kw, count] of counted) {
 276:     if (count >= 2) signals.push({ signalType: 'interest', content: `Engages with ${kw} topics`, confidence: 0.3 });
 277:   }
 278: 
 279:   return signals;
 280: }
 281: 
 282: // ═══ Profile projection ═══
 283: 
 284: export function rebuildProfile(): void {
 285:   if (!dbRef) return;
 286: 
 287:   // 1. Gather active signals
 288:   const signals = dbRef.prepare(
 289:     'SELECT * FROM user_context_signals WHERE superseded_by IS NULL ORDER BY confidence DESC'
 290:   ).all().map(rowToSignal);
 291: 
 292:   const traits: Record<string, any> = {};
 293:   const habits: Record<string, any> = {};
 294:   const preferences: Record<string, any> = {};
 295:   const interests: Record<string, any> = {};
 296:   const communicationStyle: Record<string, any> = {};
 297:   const rules: Record<string, any> = {};
 298: 
 299:   for (const s of signals) {
 300:     const bucket = s.signalType === 'trait' ? traits
 301:       : s.signalType === 'habit' ? habits
 302:       : s.signalType === 'preference' ? preferences
 303:       : s.signalType === 'interest' ? interests
 304:       : s.signalType === 'communication' ? communicationStyle
 305:       : s.signalType === 'rule' ? rules
 306:       : null;
 307:     if (bucket) {
 308:       const key = s.content.slice(0, 40).toLowerCase().replace(/[^a-z0-9]/g, '_');
 309:       bucket[key] = { content: s.content, confidence: s.confidence, occurrences: s.occurrenceCount, source: s.source };
 310:     }
 311:   }
 312: 
 313:   // 2. Growth markers from life phases + goals
 314:   const growthMarkers: Array<{ date: string; label: string; source: string; type: string }> = [];
 315:   try {
 316:     const phases = dbRef.prepare('SELECT id, title, start_year, start_month, category FROM life_phases ORDER BY start_year, start_month').all();
 317:     for (const p of phases) {
 318:       growthMarkers.push({
 319:         date: `${p.start_year}-${String(p.start_month).padStart(2, '0')}`,
 320:         label: p.title,
 321:         source: 'life_phase',
 322:         type: p.category || 'general',
 323:       });
 324:     }
 325:   } catch { /* no life_phases table */ }
 326: 
 327:   try {
 328:     const goals = dbRef.prepare("SELECT title, category, completed_at FROM goals WHERE status = 'done' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 20").all();
 329:     for (const g of goals) {
 330:       growthMarkers.push({
 331:         date: g.completed_at,
 332:         label: `Completed: ${g.title}`,
 333:         source: 'goal',
 334:         type: g.category || 'general',
 335:       });
 336:     }
 337:   } catch { /* no goals table */ }
 338: 
 339:   // 3. Activity pattern from app usage logs (hour-by-day grid)
 340:   const activityPattern: Record<string, any> = {};
 341:   try {
 342:     const hasLogs = dbRef.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='logs'").get();
 343:     if (hasLogs) {
 344:       const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
 345:       const rows = dbRef.prepare(`
 346:         SELECT CAST(strftime('%w', started_at) AS INTEGER) AS day, CAST(strftime('%H', started_at) AS INTEGER) AS hour, COUNT(*) as c
 347:         FROM logs WHERE started_at IS NOT NULL GROUP BY day, hour
 348:       `).all();
 349:       for (const r of rows) grid[r.day][r.hour] = r.c;
 350:       const max = Math.max(1, ...grid.flat());
 351:       activityPattern.hour_by_day_grid = grid.map(row => row.map(v => Math.round((v / max) * 5)));
 352:       // Primary work window
 353:       const hourTotals = Array(24).fill(0);
 354:       for (const r of rows) hourTotals[r.hour] += r.c;
 355:       const sorted = hourTotals.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v);
 356:       if (sorted[0].v > 0) {
 357:         activityPattern.primary_work_window = `${String(sorted[0].h).padStart(2, '0')}:00`;
 358:         const second = sorted[1] && sorted[1].v > 0 ? sorted[1].h : -1;
 359:         if (second >= 0) activityPattern.secondary_work_window = `${String(second).padStart(2, '0')}:00`;
 360:         activityPattern.focus_pattern = sorted[0].h >= 20 || sorted[0].h <= 4 ? 'late-night deep work' : 'daytime focus';
 361:       }
 362:     }
 363:   } catch { /* no logs table */ }
 364: 
 365:   // 4. Memory highlights from agent_memories + ai_chat_memories + high-confidence signals
 366:   const memoryHighlights: Array<{ content: string; source: string; importance: number }> = [];
 367:   try {
 368:     const mems = dbRef.prepare('SELECT content, importance FROM agent_memories ORDER BY importance DESC LIMIT 5').all();
 369:     for (const m of mems) memoryHighlights.push({ content: m.content.slice(0, 200), source: 'agent_memory', importance: m.importance || 0.5 });
 370:   } catch { /* no agent_memories */ }
 371:   try {
 372:     const chatMems = dbRef.prepare('SELECT content FROM ai_chat_memories ORDER BY created_at DESC LIMIT 5').all();
 373:     for (const m of chatMems) memoryHighlights.push({ content: m.content.slice(0, 200), source: 'ai_chat', importance: 0.5 });
 374:   } catch { /* no ai_chat_memories */ }
 375:   for (const s of signals) {
 376:     if ((s.signalType === 'correction' || s.signalType === 'rule') && s.confidence > 0.6) {
 377:       memoryHighlights.push({ content: s.content, source: 'signal', importance: s.confidence });
 378:     }
 379:   }
 380: 
 381:   // 5. Generate summary
 382:   const summary = generateSummary({ traits, interests, communicationStyle, habits: activityPattern, growthMarkers });
 383: 
 384:   updateProfile({ traits, habits, preferences, interests, communicationStyle, growthMarkers, activityPattern, memoryHighlights, summary });
 385: }
 386: 
 387: function generateSummary(ctx: { traits: any; interests: any; communicationStyle: any; habits: any; growthMarkers: any[] }): string {
 388:   const parts: string[] = [];
 389:   const traitVals = Object.values(ctx.traits || {}).map((t: any) => t.content).slice(0, 3);
 390:   if (traitVals.length) parts.push(`The user is ${traitVals.join(', ').toLowerCase()}.`);
 391:   const intVals = Object.values(ctx.interests || {}).map((i: any) => i.content).slice(0, 3);
 392:   if (intVals.length) parts.push(`Actively engaged with ${intVals.join('; ').toLowerCase()}.`);
 393:   const commVals = Object.values(ctx.communicationStyle || {}).map((c: any) => c.content).slice(0, 3);
 394:   if (commVals.length) parts.push(`Communication: ${commVals.join('; ').toLowerCase()}.`);
 395:   if (ctx.habits?.primary_work_window) parts.push(`Most active around ${ctx.habits.primary_work_window}.`);
 396:   if (ctx.growthMarkers?.length) parts.push(`${ctx.growthMarkers.length} growth milestones recorded.`);
 397:   return parts.length ? parts.join(' ') : 'Profile is being generated from DeskFlow activity.';
 398: }
 399: 
 400: // ═══ Memory highlights IPC support ═══
 401: 
 402: export function getMemoryHighlights(): Array<{ content: string; source: string; importance: number }> {
 403:   return getProfile().memoryHighlights || [];
 404: }
 405: 
 406: // ═══ Debug status ═══
 407: 
 408: export function getContextDebug(): any {
 409:   if (!dbRef) return { profileVersion: 1, signalCount: 0, sources: [] };
 410:   const signalCount = dbRef.prepare('SELECT COUNT(*) as c FROM user_context_signals').get().c;
 411:   const profile = getProfile();
 412:   return {
 413:     profileVersion: profile.contextVersion,
 414:     signalCount,
 415:     sources: ['context_episodes', 'context_entities', 'context_facts', 'user_context_signals', 'agent_memories', 'ai_chat_memories', 'life_phases', 'goals', 'logs'],
 416:     lastUpdatedAt: profile.lastUpdatedAt,
 417:     summary: profile.summary,
 418:   };
 419: }

## REQUEST 2: src/main/ai/embeddingService.ts (FULL, 155 lines)
   1: /**
   2:  * EmbeddingService — local embedding generation + cosine similarity search
   3:  * 
   4:  * Primary: hashed term-vector (bag-of-words with hashing to a fixed
   5:  * dimension, L2-normalized) — zero native dependencies, works offline.
   6:  * Optional: lazy-loads transformers.js ONNX/WASM model when available
   7:  * (NOT installed by default — the fallback keeps everything functional).
   8:  * 
   9:  * Embeddings are stored as Float32Array BLOBs in context_embeddings.
  10:  */
  11: 
  12: import * as brain from './contextBrain'
  13: 
  14: const DIM = 256
  15: 
  16: // ═══ Hashing ═══
  17: function hashString(str: string): number {
  18:   let h = 2166136261
  19:   for (let i = 0; i < str.length; i++) {
  20:     h ^= str.charCodeAt(i)
  21:     h = Math.imul(h, 16777619)
  22:   }
  23:   return h >>> 0
  24: }
  25: 
  26: const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  27:   'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'i', 'you', 'he', 'she', 'it', 'we',
  28:   'they', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their', 'have', 'has', 'had', 'do',
  29:   'does', 'did', 'will', 'would', 'can', 'could', 'should', 'not', 'no', 'so', 'if', 'then', 'than',
  30:   'too', 'very', 'just', 'about', 'into', 'over', 'after', 'before', 'again', 'once', 'here', 'there'])
  31: 
  32: function tokenize(text: string): string[] {
  33:   return text.toLowerCase()
  34:     .replace(/[^a-z0-9\s-]/g, ' ')
  35:     .split(/\s+/)
  36:     .filter(t => t.length > 1 && !STOPWORDS.has(t))
  37: }
  38: 
  39: export function embedText(text: string): number[] {
  40:   const vec = new Array(DIM).fill(0)
  41:   const tokens = tokenize(text)
  42:   // TF weighting with hashing trick
  43:   const counts = new Map<string, number>()
  44:   for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1)
  45:   for (const [t, c] of counts) {
  46:     const idx = hashString(t) % DIM
  47:     vec[idx] += 1 + Math.log(c)
  48:   }
  49:   // L2 normalize
  50:   let norm = 0
  51:   for (const v of vec) norm += v * v
  52:   norm = Math.sqrt(norm)
  53:   if (norm === 0) return vec
  54:   return vec.map(v => v / norm)
  55: }
  56: 
  57: export function cosineSimilarity(a: number[], b: number[]): number {
  58:   if (a.length !== b.length || a.length === 0) return 0
  59:   let dot = 0
  60:   for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  61:   return dot // both normalized → dot = cosine
  62: }
  63: 
  64: // ═══ Embedding storage ═══
  65: 
  66: export function embedEpisode(episodeId: string, content: string): void {
  67:   const vec = embedText(content)
  68:   brain.storeEmbedding(episodeId, 'episode', vec)
  69: }
  70: 
  71: export function embedSignal(signalId: string, content: string): void {
  72:   const vec = embedText(content)
  73:   brain.storeEmbedding(signalId, 'signal', vec)
  74: }
  75: 
  76: // ═══ Search ═══
  77: 
  78: export function searchEmbeddings(query: string, limit: number = 10): Array<{ refId: string; refType: string; score: number }> {
  79:   const queryVec = embedText(query)
  80:   const all = getRawEmbeddings()
  81:   const scored = all
  82:     .map(({ refId, refType, vec }) => ({ refId, refType, score: cosineSimilarity(queryVec, vec) }))
  83:     .filter(r => r.score > 0.05)
  84:     .sort((a, b) => b.score - a.score)
  85:     .slice(0, limit)
  86:   return scored
  87: }
  88: 
  89: function getRawEmbeddings(): Array<{ refId: string; refType: string; vec: number[] }> {
  90:   // Reached via brain's db — export a helper from contextBrain
  91:   return brain.getAllEmbeddings()
  92: }
  93: 
  94: // ═══ Reindex ═══
  95: 
  96: export function reindexEpisodes(): { processed: number; skipped: number } {
  97:   const episodes = brain.getEpisodes(undefined, 2000)
  98:   let processed = 0
  99:   let skipped = 0
 100:   for (const ep of episodes) {
 101:     const existing = brain.getEmbedding(ep.id)
 102:     if (existing) { skipped++; continue }
 103:     embedEpisode(ep.id, ep.content)
 104:     processed++
 105:   }
 106:   return { processed, skipped }
 107: }
 108: 
 109: // ═══ Optional transformers.js lazy load (NOT installed by default) ═══
 110: 
 111: let semanticModel: any = null
 112: let semanticAttempted = false
 113: 
 114: export async function tryLoadSemanticModel(): Promise<boolean> {
 115:   if (semanticModel) return true
 116:   if (semanticAttempted) return false
 117:   semanticAttempted = true
 118:   try {
 119:     const mod = await import('@xenova/transformers')
 120:     const { pipeline } = mod as any
 121:     semanticModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
 122:     return true
 123:   } catch {
 124:     return false
 125:   }
 126: }
 127: 
 128: export async function semanticEmbed(text: string): Promise<number[] | null> {
 129:   if (!semanticModel) return null
 130:   try {
 131:     const out = await semanticModel(text, { pooling: 'mean', normalize: true })
 132:     return Array.from(out.data as Float32Array)
 133:   } catch {
 134:     return null
 135:   }
 136: }
 137: 
 138: // ═══ Hybrid retrieval (keyword + embedding) ═══
 139: 
 140: export function hybridSearch(query: string, limit: number = 15): Array<{ type: string; id: string; score: number }> {
 141:   const keyword = brain.keywordSearch(query, limit)
 142:   const semantic = searchEmbeddings(query, limit)
 143:   const merged = new Map<string, { type: string; id: string; score: number }>()
 144: 
 145:   for (const k of keyword) {
 146:     merged.set(`${k.type}:${k.id}`, { type: k.type, id: k.id, score: k.score * 0.55 })
 147:   }
 148:   for (const s of semantic) {
 149:     const type = s.refType === 'episode' ? 'episode' : 'signal'
 150:     const existing = merged.get(`${type}:${s.refId}`)
 151:     if (existing) existing.score = Math.min(1, existing.score + s.score * 0.3)
 152:     else merged.set(`${type}:${s.refId}`, { type, id: s.refId, score: s.score * 0.3 })
 153:   }
 154:   return Array.from(merged.values()).sort((a, b) => b.score - a.score).slice(0, limit)
 155: }

## REQUEST 3: MCP server entry = src/main/ai/contextBrainMCP.ts (FULL, 545 lines; exported registration fn = startMcpServer)
   1: /**
   2:  * ContextBrainMCP — MCP Server for DeskFlow Context System
   3:  * 
   4:  * Exposes context brain as an MCP server so any MCP-compatible AI
   5:  * (Claude, ChatGPT desktop, Cursor, etc.) can query the user's context.
   6:  * 
   7:  * Runs on HTTP (stateless per MCP 2026-07-28 spec).
   8:  * Hardened: localhost-only bind, optional token auth, rate limiting.
   9:  */
  10: 
  11: import * as http from 'http'
  12: import * as brain from './contextBrain'
  13: import * as userContext from './userContextService'
  14: 
  15: const PORT = 54322
  16: 
  17: // ═══ Security ═══
  18: const RATE_LIMIT_PER_MIN = 60
  19: let rateBuckets: Map<string, number[]> = new Map()
  20: 
  21: function isRateLimited(ip: string): boolean {
  22:   const now = Date.now()
  23:   const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < 60000)
  24:   if (bucket.length >= RATE_LIMIT_PER_MIN) {
  25:     rateBuckets.set(ip, bucket)
  26:     return true
  27:   }
  28:   bucket.push(now)
  29:   rateBuckets.set(ip, bucket)
  30:   return false
  31: }
  32: 
  33: function checkToken(req: http.IncomingMessage): boolean {
  34:   // Optional token: set env DESKFLOW_MCP_TOKEN to require it
  35:   const expected = process.env.DESKFLOW_MCP_TOKEN
  36:   if (!expected) return true
  37:   const provided = req.headers['x-deskflow-mcp-token']
  38:   return provided === expected
  39: }
  40: 
  41: // ═══ MCP Protocol Handlers ═══
  42: 
  43: function handleInitialize(): any {
  44:   return {
  45:     jsonrpc: '2.0',
  46:     result: {
  47:       protocolVersion: '2026-07-28',
  48:       capabilities: {
  49:         tools: { listChanged: false },
  50:         resources: { subscribe: false, listChanged: false },
  51:       },
  52:       serverInfo: { name: 'deskflow-context-brain', version: '1.1.0' },
  53:     },
  54:   }
  55: }
  56: 
  57: function handleToolsList(): any {
  58:   return {
  59:     jsonrpc: '2.0',
  60:     result: {
  61:       tools: [
  62:         {
  63:           name: 'search_context',
  64:           description: 'Search the user\'s context memory using keyword, graph, or hybrid strategies. Returns ranked facts, episodes, and related entities.',
  65:           inputSchema: {
  66:             type: 'object',
  67:             properties: {
  68:               query: { type: 'string', description: 'Search query' },
  69:               strategy: { type: 'string', enum: ['keyword', 'graph', 'hybrid', 'all'], default: 'keyword', description: 'Retrieval strategy' },
  70:               limit: { type: 'number', default: 20, description: 'Max results' },
  71:             },
  72:             required: ['query'],
  73:           },
  74:         },
  75:         {
  76:           name: 'get_entity',
  77:           description: 'Get the full current state of an entity (all current facts, no history).',
  78:           inputSchema: {
  79:             type: 'object',
  80:             properties: {
  81:               name: { type: 'string', description: 'Entity name to look up' },
  82:             },
  83:             required: ['name'],
  84:           },
  85:         },
  86:         {
  87:           name: 'get_entity_history',
  88:           description: 'Get the bitemporal history of an entity\'s facts (when things changed).',
  89:           inputSchema: {
  90:             type: 'object',
  91:             properties: {
  92:               name: { type: 'string', description: 'Entity name' },
  93:             },
  94:             required: ['name'],
  95:           },
  96:         },
  97:         {
  98:           name: 'log_episode',
  99:           description: 'Write a new episode into the context system (e.g. "remember that I decided X"). Also queues LLM enrichment.',
 100:           inputSchema: {
 101:             type: 'object',
 102:             properties: {
 103:               source: { type: 'string', description: 'Source: external_ai, voice_note, manual' },
 104:               content: { type: 'string', description: 'The content to remember' },
 105:             },
 106:             required: ['source', 'content'],
 107:           },
 108:         },
 109:         {
 110:           name: 'get_stats',
 111:           description: 'Get statistics about the context brain (episode count, entity count, fact count).',
 112:           inputSchema: { type: 'object', properties: {} },
 113:         },
 114:         {
 115:           name: 'get_user_profile_summary',
 116:           description: 'Get a compact summary of the user\'s derived context profile (traits, interests, communication style, focus). Does not expose raw private signals.',
 117:           inputSchema: { type: 'object', properties: {} },
 118:         },
 119:         {
 120:           name: 'get_active_facts',
 121:           description: 'Get all current (non-expired) facts in the knowledge graph.',
 122:           inputSchema: { type: 'object', properties: {} },
 123:         },
 124:         {
 125:           name: 'get_recent_signals',
 126:           description: 'Get the most recent high-confidence context signals (preferences, corrections, habits).',
 127:           inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 10 } } },
 128:         },
 129:         {
 130:           name: 'add_memory',
 131:           description: 'Write a fact the agent has learned into the context brain (persisted, queued for LLM extraction). Use this to remember decisions, preferences, and corrections discovered during a session.',
 132:           inputSchema: {
 133:             type: 'object',
 134:             properties: {
 135:               content: { type: 'string', description: 'What to remember' },
 136:               source: { type: 'string', description: 'Source tag, e.g. external_ai, in_terminal_agent', default: 'external_ai' },
 137:             },
 138:             required: ['content'],
 139:           },
 140:         },
 141:         {
 142:           name: 'add_reflection',
 143:           description: 'Log a self-improvement reflection / mistake / correction to the agent-reflect logs. Persisted as markdown and re-injected into future agent context so the same mistake is not repeated.',
 144:           inputSchema: {
 145:             type: 'object',
 146:             properties: {
 147:               title: { type: 'string', description: 'Short title, e.g. "never use git reset --hard"' },
 148:               content: { type: 'string', description: 'Full reflection / lesson text' },
 149:               severity: { type: 'string', enum: ['info', 'warn', 'critical'], default: 'warn' },
 150:             },
 151:             required: ['title', 'content'],
 152:           },
 153:         },
 154:       ],
 155:     },
 156:   }
 157: }
 158: 
 159: function handleToolsCall(name: string, args: any): any {
 160:   switch (name) {
 161:     case 'search_context': {
 162:       let strategies = ['keyword']
 163:       if (args.strategy === 'all' || args.strategy === 'hybrid') strategies = ['keyword', 'graph']
 164:       else if (args.strategy === 'graph') strategies = ['graph']
 165:       const result = brain.retrieve(args.query, strategies)
 166:       return {
 167:         jsonrpc: '2.0',
 168:         result: {
 169:           content: [{
 170:             type: 'text',
 171:             text: JSON.stringify({
 172:               query: args.query,
 173:               strategy: result.strategy,
 174:               facts: result.facts.slice(0, args.limit || 20).map(f => ({
 175:                 predicate: f.predicate,
 176:                 value: f.objectLiteral || f.objectId,
 177:                 confidence: f.confidence,
 178:                 current: !f.validTo,
 179:               })),
 180:               entities: result.entities.map(e => ({ name: e.name, type: e.type })),
 181:               episodes: result.episodes.slice(0, 5).map(e => ({
 182:                 source: e.source,
 183:                 content: e.content.slice(0, 300),
 184:                 when: e.occurredAt,
 185:               })),
 186:             }, null, 2),
 187:           }],
 188:         },
 189:       }
 190:     }
 191:     case 'get_entity': {
 192:       const entities = brain.findEntities(args.name)
 193:       if (entities.length === 0) {
 194:         return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `No entity found matching "${args.name}"` }] } }
 195:       }
 196:       const entity = entities[0]
 197:       const facts = brain.getCurrentFacts(entity.id)
 198:       return {
 199:         jsonrpc: '2.0',
 200:         result: {
 201:           content: [{
 202:             type: 'text',
 203:             text: JSON.stringify({
 204:               entity: { name: entity.name, type: entity.type, aliases: entity.aliases },
 205:               currentFacts: facts.map(f => ({ predicate: f.predicate, value: f.objectLiteral || f.objectId, confidence: f.confidence })),
 206:               firstSeen: entity.firstSeen,
 207:               lastSeen: entity.lastSeen,
 208:             }, null, 2),
 209:           }],
 210:         },
 211:       }
 212:     }
 213:     case 'get_entity_history': {
 214:       const entities = brain.findEntities(args.name)
 215:       if (entities.length === 0) {
 216:         return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `No entity found matching "${args.name}"` }] } }
 217:       }
 218:       const history = brain.getFactHistory(entities[0].id)
 219:       return {
 220:         jsonrpc: '2.0',
 221:         result: {
 222:           content: [{
 223:             type: 'text',
 224:             text: JSON.stringify({
 225:               entity: entities[0].name,
 226:               history: history.map(f => ({
 227:                 predicate: f.predicate,
 228:                 value: f.objectLiteral || f.objectId,
 229:                 validFrom: f.validFrom,
 230:                 validTo: f.validTo || '(current)',
 231:                 confidence: f.confidence,
 232:               })),
 233:             }, null, 2),
 234:           }],
 235:         },
 236:       }
 237:     }
 238:     case 'log_episode': {
 239:       const epId = brain.logEpisode(args.source || 'external_ai', args.content)
 240:       if (epId && (args.content || '').length >= 40) brain.createExtractionJob(epId)
 241:       return {
 242:         jsonrpc: '2.0',
 243:         result: {
 244:           content: [{ type: 'text', text: `Episode logged: ${epId}` }],
 245:         },
 246:       }
 247:     }
 248:     case 'add_memory': {
 249:       const content = (args.content || '').trim()
 250:       if (!content) return { jsonrpc: '2.0', error: { code: -32602, message: 'content is required' } }
 251:       const epId = brain.logEpisode(args.source || 'external_ai', content)
 252:       if (epId && content.length >= 40) brain.createExtractionJob(epId)
 253:       return {
 254:         jsonrpc: '2.0',
 255:         result: { content: [{ type: 'text', text: `Memory stored: ${epId}` }] },
 256:       }
 257:     }
 258:     case 'add_reflection': {
 259:       const title = (args.title || '').trim()
 260:       const content = (args.content || '').trim()
 261:       const severity = args.severity || 'warn'
 262:       if (!title || !content) return { jsonrpc: '2.0', error: { code: -32602, message: 'title and content are required' } }
 263:       try {
 264:         const fs = require('fs')
 265:         const path = require('path')
 266:         // Locate repo root: walk up from this file to find package.json / agent dir.
 267:         let root = __dirname
 268:         for (let i = 0; i < 6; i++) {
 269:           if (fs.existsSync(path.join(root, 'agent', 'skills', 'agent-reflect', 'logs'))) break
 270:           const parent = path.dirname(root)
 271:           if (parent === root) break
 272:           root = parent
 273:         }
 274:         const logDir = path.join(root, 'agent', 'skills', 'agent-reflect', 'logs')
 275:         fs.mkdirSync(logDir, { recursive: true })
 276:         const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
 277:         const safeTitle = title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
 278:         const file = path.join(logDir, `${stamp}_${safeTitle}.md`)
 279:         const header = `<!-- agent-reflection | severity: ${severity} | source: in_terminal_agent | ${stamp} -->\n# ${title}\n\n`
 280:         fs.writeFileSync(file, header + content + '\n', 'utf-8')
 281:         return {
 282:           jsonrpc: '2.0',
 283:           result: { content: [{ type: 'text', text: `Reflection logged: ${path.basename(file)}` }] },
 284:         }
 285:       } catch (e: any) {
 286:         return { jsonrpc: '2.0', error: { code: -32603, message: `Failed to write reflection: ${e.message}` } }
 287:       }
 288:     }
 289:     case 'get_stats': {
 290:       const stats = brain.getBrainStats()
 291:       const jobStats = brain.getJobStats()
 292:       return {
 293:         jsonrpc: '2.0',
 294:         result: {
 295:           content: [{ type: 'text', text: JSON.stringify({ ...stats, jobs: jobStats }, null, 2) }],
 296:         },
 297:       }
 298:     }
 299:     case 'get_user_profile_summary': {
 300:       const profile = userContext.getProfile()
 301:       const interests = Object.values(profile.interests || {})
 302:         .sort((a: any, b: any) => b.confidence - a.confidence)
 303:         .slice(0, 5)
 304:         .map((i: any) => i.content)
 305:       return {
 306:         jsonrpc: '2.0',
 307:         result: {
 308:           content: [{
 309:             type: 'text',
 310:             text: JSON.stringify({
 311:               summary: profile.summary,
 312:               communication_style: Object.values(profile.communicationStyle || {}).map((c: any) => c.content),
 313:               top_interests: interests,
 314:               active_focus: interests[0] || null,
 315:               growth_markers: (profile.growthMarkers || []).slice(-3).map((m: any) => m.label),
 316:               context_version: profile.contextVersion,
 317:             }, null, 2),
 318:           }],
 319:         },
 320:       }
 321:     }
 322:     case 'get_active_facts': {
 323:       const facts = brain.getAllCurrentFacts()
 324:       return {
 325:         jsonrpc: '2.0',
 326:         result: {
 327:           content: [{
 328:             type: 'text',
 329:             text: JSON.stringify(facts.slice(0, 50).map(f => ({
 330:               predicate: f.predicate,
 331:               value: f.objectLiteral || f.objectId,
 332:               confidence: f.confidence,
 333:               since: f.validFrom,
 334:             })), null, 2),
 335:           }],
 336:         },
 337:       }
 338:     }
 339:     case 'get_recent_signals': {
 340:       const signals = userContext.getSignals(undefined, undefined, args.limit || 10)
 341:       return {
 342:         jsonrpc: '2.0',
 343:         result: {
 344:           content: [{
 345:             type: 'text',
 346:             text: JSON.stringify(signals.map(s => ({
 347:               signal_type: s.signalType,
 348:               content: s.content,
 349:               confidence: s.confidence,
 350:               occurrences: s.occurrenceCount,
 351:               last_seen_at: new Date(s.lastSeenAt).toISOString(),
 352:             })), null, 2),
 353:           }],
 354:         },
 355:       }
 356:     }
 357:     default:
 358:       return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown tool: ${name}` } }
 359:   }
 360: }
 361: 
 362: function handleResourcesList(): any {
 363:   return {
 364:     jsonrpc: '2.0',
 365:     result: {
 366:       resources: [
 367:         { uri: 'context://recent-episodes', name: 'Recent Episodes', description: 'Last 20 episodes from all sources', mimeType: 'application/json' },
 368:         { uri: 'context://active-facts', name: 'Active Facts', description: 'All current (non-expired) facts', mimeType: 'application/json' },
 369:         { uri: 'context://stats', name: 'Brain Stats', description: 'Episode/entity/fact counts', mimeType: 'application/json' },
 370:         { uri: 'context://user-profile-summary', name: 'User Profile Summary', description: 'Compact derived profile summary', mimeType: 'application/json' },
 371:         { uri: 'context://recent-signals', name: 'Recent Signals', description: 'Latest high-confidence context signals', mimeType: 'application/json' },
 372:       ],
 373:     },
 374:   }
 375: }
 376: 
 377: function handleResourcesRead(uri: string): any {
 378:   switch (uri) {
 379:     case 'context://recent-episodes': {
 380:       const episodes = brain.getEpisodes(undefined, 20)
 381:       return {
 382:         jsonrpc: '2.0',
 383:         result: {
 384:           contents: [{
 385:             uri,
 386:             mimeType: 'application/json',
 387:             text: JSON.stringify(episodes.map(e => ({
 388:               source: e.source,
 389:               content: e.content.slice(0, 500),
 390:               when: e.occurredAt,
 391:             })), null, 2),
 392:           }],
 393:         },
 394:       }
 395:     }
 396:     case 'context://active-facts': {
 397:       const facts = brain.getAllCurrentFacts()
 398:       return {
 399:         jsonrpc: '2.0',
 400:         result: {
 401:           contents: [{
 402:             uri,
 403:             mimeType: 'application/json',
 404:             text: JSON.stringify(facts.map(f => ({
 405:               predicate: f.predicate,
 406:               value: f.objectLiteral || f.objectId,
 407:               confidence: f.confidence,
 408:             })), null, 2),
 409:           }],
 410:         },
 411:       }
 412:     }
 413:     case 'context://stats': {
 414:       const stats = brain.getBrainStats()
 415:       return {
 416:         jsonrpc: '2.0',
 417:         result: {
 418:           contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(stats, null, 2) }],
 419:         },
 420:       }
 421:     }
 422:     case 'context://user-profile-summary': {
 423:       const profile = userContext.getProfile()
 424:       const interests = Object.values(profile.interests || {})
 425:         .sort((a: any, b: any) => b.confidence - a.confidence)
 426:         .slice(0, 5)
 427:         .map((i: any) => i.content)
 428:       return {
 429:         jsonrpc: '2.0',
 430:         result: {
 431:           contents: [{
 432:             uri,
 433:             mimeType: 'application/json',
 434:             text: JSON.stringify({
 435:               summary: profile.summary,
 436:               communication_style: Object.values(profile.communicationStyle || {}).map((c: any) => c.content),
 437:               top_interests: interests,
 438:             }, null, 2),
 439:           }],
 440:         },
 441:       }
 442:     }
 443:     case 'context://recent-signals': {
 444:       const signals = userContext.getSignals(undefined, undefined, 10)
 445:       return {
 446:         jsonrpc: '2.0',
 447:         result: {
 448:           contents: [{
 449:             uri,
 450:             mimeType: 'application/json',
 451:             text: JSON.stringify(signals.map(s => ({
 452:               signal_type: s.signalType,
 453:               content: s.content,
 454:               confidence: s.confidence,
 455:             })), null, 2),
 456:           }],
 457:         },
 458:       }
 459:     }
 460:     default:
 461:       return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown resource: ${uri}` } }
 462:   }
 463: }
 464: 
 465: // ═══ HTTP Server ═══
 466: 
 467: export function startMcpServer(): http.Server | null {
 468:   const server = http.createServer((req, res) => {
 469:     const ip = (req.socket.remoteAddress || 'local').replace('::ffff:', '')
 470: 
 471:     // Token auth
 472:     if (!checkToken(req)) {
 473:       res.writeHead(401, { 'Content-Type': 'application/json' })
 474:       res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' } }))
 475:       return
 476:     }
 477: 
 478:     // Rate limiting
 479:     if (isRateLimited(ip)) {
 480:       res.writeHead(429, { 'Content-Type': 'application/json' })
 481:       res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32005, message: 'Rate limit exceeded (60 req/min)' } }))
 482:       return
 483:     }
 484: 
 485:     if (req.method !== 'POST') {
 486:       res.writeHead(405)
 487:       res.end('Method not allowed')
 488:       return
 489:     }
 490: 
 491:     let body = ''
 492:     let tooLarge = false
 493:     req.on('data', chunk => {
 494:       body += chunk
 495:       if (body.length > 100000) { tooLarge = true; req.destroy() }
 496:     })
 497:     req.on('end', () => {
 498:       try {
 499:         if (tooLarge) {
 500:           res.writeHead(413)
 501:           res.end('Payload too large')
 502:           return
 503:         }
 504:         const msg = JSON.parse(body)
 505:         let response: any
 506: 
 507:         switch (msg.method) {
 508:           case 'initialize': response = handleInitialize(); break
 509:           case 'tools/list': response = handleToolsList(); break
 510:           case 'tools/call': response = handleToolsCall(msg.params?.name, msg.params?.arguments || {}); break
 511:           case 'resources/list': response = handleResourcesList(); break
 512:           case 'resources/read': response = handleResourcesRead(msg.params?.uri); break
 513:           case 'notifications/initialized': response = null; break
 514:           default: response = { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${msg.method}` } }
 515:         }
 516: 
 517:         if (response) {
 518:           response.id = msg.id
 519:           res.writeHead(200, { 'Content-Type': 'application/json' })
 520:           res.end(JSON.stringify(response))
 521:         } else {
 522:           res.writeHead(204)
 523:           res.end()
 524:         }
 525:       } catch (e) {
 526:         res.writeHead(400, { 'Content-Type': 'application/json' })
 527:         res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }))
 528:       }
 529:     })
 530:   })
 531: 
 532:   server.on('error', (err: any) => {
 533:     if (err?.code === 'EADDRINUSE') {
 534:       console.warn(`[ContextBrain] MCP port ${PORT} already in use — MCP server not started`)
 535:     } else {
 536:       console.error('[ContextBrain] MCP server error:', err?.message)
 537:     }
 538:   })
 539: 
 540:   server.listen(PORT, '127.0.0.1', () => {
 541:     console.log(`[ContextBrain] MCP server running on http://127.0.0.1:${PORT}`)
 542:   })
 543: 
 544:   return server
 545: }

## REQUEST 4: chat send path = ai-chat:send handler, src/main.ts lines 22855-23010
22855: electron_1.ipcMain.handle('ai-chat:send', async (event, data: { threadDate: string; message: string; providerId?: string }) => {
22856:   try {
22857:     const { threadDate, message, providerId } = data;
22858:     if (!message || !message.trim()) return { success: false, error: 'Empty message' };
22859: 
22860:     // 1. Load chat history (last 50 messages)
22861:     const history = db.prepare('SELECT id, role, content, parsed_json, created_at FROM ai_chat_messages WHERE thread_date = ? ORDER BY created_at ASC LIMIT 50').all(threadDate) as any[];
22862: 
22863:     // 2. Gather app context
22864:     const today = todayStr();
22865:     const lastWeek = toLocalDateStr(new Date(Date.now() - 7 * 86400000));
22866: 
22867:     let goalsContext = '', longtermContext = '', statsContext = '', planningContext = '', projectContext = '', aiUsageContext = '';
22868:     try {
22869:       const goalRows = db.prepare('SELECT * FROM goals WHERE date = ? ORDER BY created_at ASC').all(today) as any[];
22870:       goalsContext = goalRows.map((g: any) => `- ${g.title} (${g.status || 'active'}, ${g.category || 'uncategorized'})`).join('\n') || 'No goals set today.';
22871:     } catch {}
22872:     try {
22873:       const ltRows = db.prepare('SELECT * FROM goals WHERE period = ? ORDER BY priority ASC').all('longterm') as any[];
22874:       longtermContext = ltRows.filter((g: any) => g.status !== 'completed').map((g: any) => `- ${g.title} (P${g.priority || 3}, ${g.category || 'uncategorized'})`).join('\n') || 'No long-term goals.';
22875:     } catch {}
22876:     try {
22877:       const aggRows = db.prepare("SELECT category, SUM(total_sec) as total_sec FROM daily_stats WHERE date = ? GROUP BY category").all(today) as any[];
22878:       statsContext = aggRows.map((r: any) => `- ${r.category || 'uncategorized'}: ${Math.round(r.total_sec / 60)}m`).join('\n') || 'No tracked time today yet.';
22879:     } catch {}
22880:     try {
22881:       const planRow = db.prepare("SELECT content FROM planning_md ORDER BY id DESC LIMIT 1").get() as any;
22882:       planningContext = planRow?.content?.slice(0, 1000) || 'No planning notes.';
22883:     } catch { planningContext = 'No planning notes.'; }
22884:     try {
22885:       const projRows = db.prepare('SELECT name, primary_language FROM projects WHERE deleted_at IS NULL ORDER BY last_activity_at DESC LIMIT 5').all() as any[];
22886:       projectContext = projRows.map((p: any) => `- ${p.name}${p.primary_language ? ' (' + p.primary_language + ')' : ''}`).join('\n') || 'No active projects.';
22887:     } catch {}
22888:     try {
22889:       const usageRow = db.prepare("SELECT SUM(input_tokens) as in_tokens, SUM(output_tokens) as out_tokens, SUM(cost_usd) as cost FROM ai_usage WHERE date = ?").get(today) as any;
22890:       if (usageRow) aiUsageContext = `${usageRow.in_tokens || 0} input tokens, ${usageRow.out_tokens || 0} output tokens, $${(usageRow.cost || 0).toFixed(4)} cost`;
22891:       else aiUsageContext = 'No AI usage today.';
22892:     } catch { aiUsageContext = 'No AI usage data.'; }
22893: 
22894:     // 3. Build system prompt with context
22895:     const systemPrompt = `You are DeskFlow AI, an assistant integrated into the user's productivity tracker. You help them plan, review, and understand their productivity data.
22896: 
22897: ## Current App State (${today})
22898: **Goals today:**
22899: ${goalsContext}
22900: 
22901: **Long-term goals:**
22902: ${longtermContext}
22903: 
22904: **Today's tracked time:**
22905: ${statsContext}
22906: 
22907: **Active projects:**
22908: ${projectContext}
22909: 
22910: **AI usage today:**
22911: ${aiUsageContext}
22912: 
22913: **Planning notes:**
22914: ${planningContext}
22915: 
22916: ## Your Output Format
22917: You MUST respond with a JSON object on the first line, then your natural language response on subsequent lines.
22918: The JSON must follow this schema:
22919: {"type": "general_chat"|"goal_suggestion"|"plan_update"|"stats_summary"|"action_list"|"digest_item"|"connector_status"|"form_fill"|"chart_data"|"error", "data": {...}}
22920: 
22921: For type "general_chat": data is empty object {}.
22922: For type "goal_suggestion": data = { goals: [{ title: string, category: string, reason: string }] }
22923: For type "plan_update": data = { changes: [{ action: "add"|"modify"|"complete", goal: { title: string, priority?: number, category: string } }] }
22924: For type "stats_summary": data = { metrics: [{ label: string, value: number, change?: string, icon?: string }], period: string }
22925: For type "action_list": data = { actions: [{ label: string, description: string, priority: string }] }
22926: For type "chart_data": data = { chartType: "bar"|"line"|"pie", labels: string[], datasets: [{ label: string, data: number[], color?: string }] }
22927: For type "error": data = { message: string, recovery?: string }`;
22928: 
22929:     // 4. Prepare messages for AI
22930:     const pState = JSON.parse((userPreferences?.aiProviders) || 'null') || { providers: [] };
22931:     const cfg = providerId ? pState.providers.find((pr: any) => pr.id === providerId) : pState.providers.find((pr: any) => pr.id === pState.routing?.default?.providerId) || pState.providers[0];
22932:     if (!cfg) return { success: false, error: 'No AI provider configured' };
22933: 
22934:     const historyMessages = history.map((m: any) => ({ role: m.role, content: m.content }));
22935:     const messages = [
22936:       { role: 'system', content: systemPrompt },
22937:       ...historyMessages.slice(-40),
22938:       { role: 'user', content: message },
22939:     ];
22940: 
22941:     // 5. Call AI provider (non-streaming)
22942:     const { PROVIDER_TEMPLATES: PT } = require('./services/providers/templates');
22943:     const { callProvider: call } = require('./services/providers/callProvider');
22944:     const template = PT[cfg.templateId];
22945:     if (!template) return { success: false, error: `Unknown provider template: ${cfg.templateId}` };
22946:     const resolvedProvider = { config: cfg, template };
22947:     const result = await call(
22948:       resolvedProvider,
22949:       { model: cfg.models?.[0] || 'gpt-4o-mini', messages, maxTokens: 4096, temperature: 0.7 },
22950:     );
22951: 
22952:     const finalContent = result.content || '';
22953:     vaultLogSafe({ source: 'ai-chat', event: 'prompt', provider: cfg.id, model: cfg.models?.[0], contextId: threadDate, role: 'system', payload: { messages } });
22954:     vaultLogSafe({ source: 'ai-chat', event: 'output', provider: cfg.id, model: cfg.models?.[0], contextId: threadDate, payload: finalContent, tokensIn: result.usage?.prompt_tokens, tokensOut: result.usage?.completion_tokens });
22955: 
22956:     event.sender.send('provider-chunk', { delta: null, done: true, providerId: cfg.id, full: finalContent, threadDate });
22957: 
22958:     // 6. Parse response for JSON
22959:     let parsedJson: any = null;
22960:     try {
22961:       const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
22962:       if (jsonMatch) {
22963:         parsedJson = JSON.parse(jsonMatch[0]);
22964:         vaultLogSafe({ source: 'ai-chat', event: 'parsed', provider: cfg.id, model: cfg.models?.[0], contextId: threadDate, payload: parsedJson });
22965:       }
22966:     } catch {}
22967: 
22968:     // 7. Save all messages + upsert thread metadata
22969:     const preview = message.slice(0, 80);
22970:     const now = Date.now();
22971:     const tx = db.transaction(() => {
22972:       // Upsert thread metadata
22973:       db.prepare(`
22974:         INSERT INTO ai_chat_threads (thread_date, message_count, last_message_at, preview, updated_at)
22975:         VALUES (?, ?, ?, ?, ?)
22976:         ON CONFLICT(thread_date) DO UPDATE SET
22977:           message_count = excluded.message_count,
22978:           last_message_at = excluded.last_message_at,
22979:           preview = excluded.preview,
22980:           updated_at = excluded.updated_at
22981:       `).run(threadDate, history.length + 2, now, preview, now);
22982: 
22983:       // Save messages
22984:       db.prepare('DELETE FROM ai_chat_messages WHERE thread_date = ?').run(threadDate);
22985:       const insert = db.prepare('INSERT INTO ai_chat_messages (thread_date, role, content, parsed_json, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))');
22986:       for (const histMsg of history) {
22987:         insert.run(threadDate, histMsg.role, histMsg.content, histMsg.parsed_json);
22988:       }
22989:       insert.run(threadDate, 'user', message, null);
22990:       insert.run(threadDate, 'assistant', finalContent, parsedJson ? JSON.stringify(parsedJson) : null);
22991:     });
22992:     tx();
22993: 
22994:     return {
22995:       success: true,
22996:       message: {
22997:         role: 'assistant',
22998:         content: finalContent,
22999:         parsed_json: parsedJson,
23000:         created_at: new Date().toISOString(),
23001:       },
23002:     };
23003:   } catch (err: any) {
23004:     event.sender.send('provider-chunk', { delta: null, error: err.message, done: true });
23005:     vaultLogSafe({ source: 'ai-chat', event: 'error', contextId: (data as any)?.threadDate, payload: err.message });
23006:     return { success: false, error: err.message };
23007:   }
23008: });
23009: 
23010: // ========== AI Debug Vault ==========

## REQUEST 5: src/main/ai/episodeWriters.ts (FULL, 247 lines — includes my uncommitted capture-time concept linking)
   1: /**
   2:  * EpisodeWriters — Capture episodes from existing DeskFlow features
   3:  * 
   4:  * Each writer converts a feature event into an episode + entity/fact extraction.
   5:  */
   6: 
   7: import * as brain from './contextBrain'
   8: 
   9: // Sources worth LLM enrichment (sparse + descriptive). Routine sources
  10: // (finance transactions, chat turns, terminal) are covered by regex signals.
  11: const EXTRACTION_SOURCES = new Set(['goals', 'life_phase', 'deadlines', 'connector', 'manual', 'external_ai', 'voice_note', 'reflection'])
  12: 
  13: function logAndQueue(source: string, content: string, sourceRef?: string, metadata?: Record<string, any>): string {
  14:   const epId = brain.logEpisode(source, content, sourceRef, metadata)
  15:   if (epId && EXTRACTION_SOURCES.has(source) && content.length >= 40) {
  16:     brain.createExtractionJob(epId)
  17:   }
  18:   return epId
  19: }
  20: 
  21: // ═══ Goal Episode Writer ═══
  22: // NOTE: goal saves are a manual/user action and must NOT auto-trigger the LLM
  23: // extraction worker. We still capture the episode + entity/fact for history, but
  24: // we deliberately skip createExtractionJob so no AI call fires on goal create /
  25: // update / delete / complete (unless the user explicitly asks for AI via the
  26: // Goal Coach / AI Health Check buttons, which go through a different path).
  27: export function writeGoalEpisode(goal: any, action: 'created' | 'completed' | 'updated' | 'deleted') {
  28:   const content = `Goal ${action}: "${goal.title}" (${goal.category || 'general'}) — status: ${goal.status || 'pending'}${goal.description ? ` — ${goal.description}` : ''}`
  29:   const epId = brain.logEpisode('goals', content, goal.id, { goalId: goal.id, action, category: goal.category })
  30: 
  31:   // Extract entity
  32:   const entityId = brain.upsertEntity('goal', goal.title, [goal.category].filter(Boolean))
  33: 
  34:   // Extract fact
  35:   brain.addFact(entityId, 'has_status', goal.status || 'pending', epId)
  36:   if (goal.category) brain.addFact(entityId, 'in_category', goal.category, epId)
  37:   if (action === 'completed') brain.addFact(entityId, 'completed_at', new Date().toISOString(), epId)
  38: }
  39: 
  40: // ═══ Finance Episode Writer ═══
  41: export function writeFinanceEpisode(type: 'transaction' | 'budget' | 'wallet' | 'subscription', data: any, action: string) {
  42:   let content = ''
  43:   switch (type) {
  44:     case 'transaction':
  45:       content = `Transaction: ${data.description || data.category} — ${data.amount} ${data.currency || 'IDR'} (${data.type || 'expense'})`
  46:       break
  47:     case 'budget':
  48:       content = `Budget ${action}: ${data.category} — limit ${data.limit_amount} / spent ${data.spent_amount}`
  49:       break
  50:     case 'wallet':
  51:       content = `Wallet ${action}: ${data.name} — balance ${data.balance} ${data.currency || 'IDR'}`
  52:       break
  53:     case 'subscription':
  54:       content = `Subscription ${action}: ${data.name} — ${data.price} ${data.currency || 'IDR'}/${data.billing_cycle || 'monthly'}`
  55:       break
  56:   }
  57:   const epId = brain.logEpisode('finance', content, data.id, { type, action })
  58:   if (epId && content.length >= 20) {
  59:     try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
  60:   }
  61: 
  62:   if (type === 'wallet') {
  63:     const entityId = brain.upsertEntity('tool', data.name, ['wallet', 'finance'])
  64:     brain.addFact(entityId, 'has_balance', `${data.balance} ${data.currency || 'IDR'}`, epId)
  65:   }
  66: }
  67: 
  68: // ═══ Deadline Episode Writer ═══
  69: export function writeDeadlineEpisode(deadline: any, action: 'created' | 'updated' | 'completed') {
  70:   const content = `Deadline ${action}: "${deadline.title}" — due ${deadline.due_date}${deadline.course ? ` (${deadline.course})` : ''}`
  71:   const epId = logAndQueue('deadlines', content, deadline.id)
  72: 
  73:   const entityId = brain.upsertEntity('deadline', deadline.title, [deadline.course].filter(Boolean))
  74:   brain.addFact(entityId, 'due_date', deadline.due_date, epId)
  75:   if (deadline.course) brain.addFact(entityId, 'in_course', deadline.course, epId)
  76: }
  77: 
  78: // ═══ Terminal Session Episode Writer ═══
  79: export function writeTerminalEpisode(session: any, message: string, role: 'user' | 'agent') {
  80:   const content = `[Terminal ${role}] ${message.slice(0, 500)}`
  81:   const epId = brain.logEpisode('terminal', content, session.id, {
  82:     sessionId: session.id,
  83:     agentType: session.agent_type,
  84:     topic: session.topic,
  85:   })
  86:   if (epId && content.length >= 20) {
  87:     try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
  88:   }
  89: 
  90:   // Only extract entities from agent messages (more structured)
  91:   if (role === 'agent' && session.topic) {
  92:     const entityId = brain.upsertEntity('project', session.topic, [])
  93:     brain.addFact(entityId, 'discussed_in', 'terminal session', epId)
  94:   }
  95: }
  96: 
  97: // ═══ AI Chat Episode Writer ═══
  98: export function writeAiChatEpisode(messages: Array<{ role: string; content: string }>, threadDate: string) {
  99:   for (const msg of messages) {
 100:     if (!msg.content || msg.content.length < 10) continue
 101:     const content = `[AI Chat ${msg.role}] ${msg.content.slice(0, 1000)}`
 102:     const epId = brain.logEpisode('deskflow_ai', content, threadDate, { threadDate, role: msg.role })
 103:     if (epId && content.length >= 20) {
 104:       try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
 105:     }
 106:   }
 107: }
 108: 
 109: // ═══ Life Phase Episode Writer ═══
 110: export function writeLifePhaseEpisode(phase: any, action: 'created' | 'updated' | 'reflected') {
 111:   const content = `Life phase ${action}: "${phase.title}" (${phase.category || 'general'}) — ${phase.start_year}/${phase.start_month} to ${phase.end_year || 'ongoing'}/${phase.end_month || '?'}`
 112:   const epId = logAndQueue('life_phase', content, phase.id)
 113: 
 114:   const entityId = brain.upsertEntity('concept', phase.title, [phase.category].filter(Boolean))
 115:   if (phase.reflection) brain.addFact(entityId, 'has_reflection', phase.reflection.slice(0, 200), epId)
 116:   if (phase.milestones) {
 117:     try {
 118:       const milestones = JSON.parse(phase.milestones)
 119:       for (const m of milestones.slice(0, 5)) {
 120:         brain.addFact(entityId, 'milestone', m.title || m, epId)
 121:       }
 122:     } catch {}
 123:   }
 124: }
 125: 
 126: // ═══ Connector Episode Writer ═══
 127: export function writeConnectorEpisode(connector: any, items: any[], action: 'synced' | 'new_items') {
 128:   const content = `Connector ${action}: ${connector.displayName || connector.name} — ${items.length} items`
 129:   logAndQueue('connector', content, connector.id, {
 130:     connectorType: connector.type,
 131:     provider: connector.provider,
 132:     itemCount: items.length,
 133:   })
 134: }
 135: 
 136: // ═══ AI Context Capture Episode Writer (external AI conversations) ═══
 137: const PROVIDER_ALIASES: Record<string, string[]> = {
 138:   chatgpt: ['chatgpt', 'openai'],
 139:   claude: ['claude', 'anthropic'],
 140:   perplexity: ['perplexity'],
 141:   you: ['you', 'you.com'],
 142:   gemini: ['gemini', 'bard', 'google gemini'],
 143: };
 144: 
 145: export function writeAiContextEpisode(capture: { id?: number; provider: string; messages: Array<{ role: string; content: string }>; url?: string; title?: string; source?: string; timestamp?: string }) {
 146:   const providerName = capture.provider || 'unknown';
 147:   const aliases = PROVIDER_ALIASES[providerName] || [providerName];
 148:   const summary = capture.messages.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
 149:   const content = `External AI conversation on ${providerName}${capture.title ? ` (${capture.title})` : ''}${capture.url ? `\nURL: ${capture.url}` : ''}\nMessages: ${capture.messages.length}\n\n${summary.slice(0, 1500)}`;
 150:   const sourceRef = capture.id ? `ai_context_capture:${capture.id}` : (capture.url || providerName);
 151:   const epId = brain.logEpisode('external_ai', content, sourceRef, {
 152:     provider: providerName,
 153:     messageCount: capture.messages.length,
 154:     url: capture.url,
 155:     title: capture.title,
 156:   });
 157:   if (epId && content.length >= 40) {
 158:     brain.createExtractionJob(epId);
 159:   }
 160:   // Upsert provider entity with aliases
 161:   const entityId = brain.upsertEntity('ai_provider', providerName.charAt(0).toUpperCase() + providerName.slice(1), aliases);
 162:   if (entityId && epId) {
 163:     brain.addFact(entityId, 'has_conversation', `External AI conversation (${capture.messages.length} messages)`, epId);
 164:   }
 165: 
 166:   // Lightweight concept extraction so the graph shows real structure even before
 167:   // the (optional) LLM extraction worker runs. Pulls capitalized phrases and a
 168:   // small set of common technical terms from the message text, upserts them as
 169:   // `concept` entities, and links them to the provider with a real objectId so
 170:   // the graph renders connections instead of isolated dots.
 171:   try {
 172:     const fullText = (capture.messages || []).map((m: any) => m.content || '').join(' ').slice(0, 4000)
 173:     const seen = new Set<string>()
 174:     const concepts: string[] = []
 175:     const capRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)\b/g
 176:     let mm: RegExpExecArray | null
 177:     while ((mm = capRe.exec(fullText)) !== null) {
 178:       const name = mm[1].trim()
 179:       if (name.length < 3 || name.length > 40) continue
 180:       if (/^(The|This|That|These|Those|What|When|Where|How|Why|Who)\s/.test(name)) continue
 181:       const key = name.toLowerCase()
 182:       if (seen.has(key)) continue
 183:       seen.add(key)
 184:       concepts.push(name)
 185:       if (concepts.length >= 8) break
 186:     }
 187:     const techTokens = ['react', 'typescript', 'python', 'rust', 'electron', 'sqlite', 'vite', 'node', 'docker', 'git', 'tailwind', 'framer']
 188:     const lower = fullText.toLowerCase()
 189:     for (const tok of techTokens) {
 190:       if (concepts.length >= 12) break
 191:       if (lower.includes(tok) && !seen.has(tok)) {
 192:         seen.add(tok)
 193:         concepts.push(tok.charAt(0).toUpperCase() + tok.slice(1))
 194:       }
 195:     }
 196:     for (const c of concepts) {
 197:       const cid = brain.upsertEntity('concept', c, [])
 198:       if (cid && entityId && epId) {
 199:         brain.addFact(entityId, 'discussed', c, epId, cid)
 200:       }
 201:     }
 202:   } catch (e) { /* never let extraction break capture */ }
 203: }
 204: 
 205: // ── Content Engine → Context Brain ──────────────────────────
 206: // Every committed Content Engine asset (idea / episode / lesson / framework /
 207: // reflection) becomes an episode + a `content_asset` entity so the Knowledge
 208: // Graph auto-populates from AI feature usage. Extraction jobs then derive
 209: // finer `concept` nodes from the content.
 210: export function writeContentEngineEpisode(p: {
 211:   kind: 'idea' | 'episode' | 'lesson' | 'framework' | 'reflection';
 212:   title: string;
 213:   detail?: string;
 214:   refId?: string | number;
 215:   extra?: Record<string, any>;
 216: }): string {
 217:   const source = 'content_engine';
 218:   const content = `[${p.kind}] ${p.title}\n${p.detail || ''}`.slice(0, 1500);
 219:   const sourceRef = p.refId != null ? `content:${p.kind}:${p.refId}` : undefined;
 220:   const epId = brain.logEpisode(source, content, sourceRef, { kind: p.kind, ...(p.extra || {}) });
 221:   if (epId && content.length >= 40) brain.createExtractionJob(epId);
 222:   const entityId = brain.upsertEntity('content_asset', p.title.slice(0, 80), [p.kind, 'content_engine']);
 223:   if (entityId && epId) {
 224:     brain.addFact(entityId, 'asset_kind', p.kind, epId);
 225:     if (sourceRef) brain.addFact(entityId, 'source_ref', sourceRef, epId);
 226:   }
 227:   return epId;
 228: }
 229: 
 230: // ── Learn (Lyceum) → Context Brain ──────────────────────────
 231: // Authored lessons become episodes + `lesson` entities so studying/writing in
 232: // the Learn OS feeds the same graph as everything else.
 233: export function writeLearnLessonEpisode(p: {
 234:   lessonId: string;
 235:   title: string;
 236:   summary?: string;
 237:   topic?: string;
 238: }): string {
 239:   const source = 'learn_lesson';
 240:   const content = `[learn] ${p.title}${p.topic ? ` (topic: ${p.topic})` : ''}\n${p.summary || ''}`.slice(0, 1500);
 241:   const sourceRef = `learn:lesson:${p.lessonId}`;
 242:   const epId = brain.logEpisode(source, content, sourceRef, { lessonId: p.lessonId, topic: p.topic });
 243:   if (epId && content.length >= 40) brain.createExtractionJob(epId);
 244:   const entityId = brain.upsertEntity('lesson', p.title.slice(0, 80), [p.topic || 'learn', 'lyceum']);
 245:   if (entityId && epId) brain.addFact(entityId, 'taught_in', p.topic || 'learn', epId);
 246:   return epId;
 247: }

## REQUEST 6: src/features/warmth/ContextGraphView.tsx (FULL, 409 lines — the to-be-slimmed second surface)
   1: import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
   2: import { RefreshCw, Search, X, Network, Wifi } from 'lucide-react'
   3: import { BrainVisualization } from './context-brain/BrainVisualization'
   4: import { EntityDetailPanel } from './context-graph/EntityDetailPanel'
   5: import { NumberTicker } from '../../components/ui/number-ticker'
   6: import type { GraphNode, GraphLink } from './context-graph/types'
   7: import { BrainManagementView } from './context-brain/BrainManagementView'
   8: import { DotPattern } from '../../components/ui/dot-pattern'
   9: import { Skeleton } from '../../components/ui/skeleton'
  10: import { ExternalAITrail } from './context-brain/ExternalAITrail'
  11: 
  12: // ── Shared accent palette (single source of truth) ──
  13: export const ACCENTS = {
  14:   purple:  '#8b5cf6',
  15:   green:   '#22c55e',
  16:   amber:   '#f59e0b',
  17:   cyan:    '#06b6d4',
  18:   rose:    '#f43f5e',
  19:   slate:   '#71717a',
  20:   surface: 'rgba(24,24,27,0.65)',
  21:   border:  'rgba(255,255,255,0.06)',
  22: }
  23: 
  24: // ── Loading skeleton ──
  25: function LoadingGraph() {
  26:   return (
  27:     <div className="flex items-center justify-center h-72 rounded-xl" style={{ background: ACCENTS.surface, border: ACCENTS.border }}>
  28:       <div className="flex flex-col items-center gap-3">
  29:         <div className="w-10 h-10 border-2 border-zinc-700 border-t-zinc-500 rounded-full animate-spin" />
  30:         <span className="text-xs text-zinc-500 font-mono">Building knowledge graph…</span>
  31:       </div>
  32:     </div>
  33:   )
  34: }
  35: 
  36: // ── Type legend ──
  37: function TypeLegend({ entityTypes, typeCounts, hiddenTypes, onToggle }: {
  38:   entityTypes: string[]
  39:   typeCounts: Record<string, number>
  40:   hiddenTypes: Set<string>
  41:   onToggle: (type: string) => void
  42: }) {
  43:   return (
  44:     <div className="flex flex-wrap gap-2">
  45:       {entityTypes.map(type => {
  46:         const color = TYPE_COLORS[type] || TYPE_COLORS.default
  47:         const hidden = hiddenTypes.has(type)
  48:         return (
  49:           <button
  50:             key={type}
  51:             onClick={() => onToggle(type)}
  52:             className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-colors ${
  53:               hidden ? 'opacity-30' : 'hover:opacity-80'
  54:             }`}
  55:             style={{
  56:               background: hidden ? 'transparent' : `${color}10`,
  57:               border: `1px solid ${color}25`,
  58:               color: hidden ? '#52525b' : color,
  59:             }}
  60:           >
  61:             <span
  62:               className="w-2 h-2 rounded-full shrink-0"
  63:               style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
  64:             />
  65:             {type}
  66:             <span className="text-zinc-600" style={{ marginLeft: 2 }}>{typeCounts[type] || 0}</span>
  67:             {hidden && <X size={9} className="ml-0.5" style={{ color: '#52525b' }} />}
  68:           </button>
  69:         )
  70:       })}
  71:     </div>
  72:   )
  73: }
  74: 
  75: // ── Stats bar ──
  76: function StatsBar({ stats, filteredNodes, filteredLinks }: {
  77:   stats: { episodes: number; entities: number; facts: number; currentFacts: number } | null
  78:   filteredNodes: GraphNode[]
  79:   filteredLinks: GraphLink[]
  80: }) {
  81:   return (
  82:     <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] font-mono" style={{ background: ACCENTS.surface, border: ACCENTS.border }}>
  83:       {stats && (
  84:         <>
  85:           <span className="text-zinc-500">
  86:             <NumberTicker value={filteredNodes.length} /> nodes
  87:           </span>
  88:           <span className="text-zinc-600 mx-1">|</span>
  89:           <span className="text-zinc-500">
  90:             <NumberTicker value={filteredLinks.length} /> edges
  91:           </span>
  92:           <span className="text-zinc-600 mx-1">|</span>
  93:           <span className="text-zinc-500">
  94:             <NumberTicker value={stats.episodes} /> episodes
  95:           </span>
  96:           <span className="text-zinc-600 mx-1">|</span>
  97:           <span style={{ color: ACCENTS.purple }}>
  98:             <NumberTicker value={stats.currentFacts} /> facts
  99:           </span>
 100:         </>
 101:       )}
 102:       {(!stats) && (
 103:         <span className="text-zinc-600">loading…</span>
 104:       )}
 105:     </div>
 106:   )
 107: }
 108: 
 109: // ── Main View ──
 110: export function ContextGraphView() {
 111:   const [width, setWidth] = useState(800)
 112:   const [height, setHeight] = useState(500)
 113:   const containerRef = useRef<HTMLDivElement>(null)
 114: 
 115:   // ── Graph data state ──
 116:   const [loading, setLoading] = useState(true)
 117:   const [nodes, setNodes] = useState<(GraphNode & { x: number; y: number; vx?: number; vy?: number })[]>([])
 118:   const [links, setLinks] = useState<GraphLink[]>([])
 119:   const [stats, setStats] = useState<{ episodes: number; entities: number; facts: number; currentFacts: number } | null>(null)
 120: 
 121:   // ── Interaction state ──
 122:   const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
 123:   const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
 124:   const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
 125:   const [searchQuery, setSearchQuery] = useState('')
 126:   const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
 127: 
 128:   // ── Container resize observer ──
 129:   useEffect(() => {
 130:     const container = containerRef.current
 131:     if (!container) return
 132:     const ro = new ResizeObserver(entries => {
 133:       for (const entry of entries) {
 134:         const { width: w, height: h } = entry.contentRect
 135:         setWidth(Math.floor(w))
 136:         setHeight(Math.floor(h))
 137:       }
 138:     })
 139:     ro.observe(container)
 140:     return () => ro.disconnect()
 141:   }, [])
 142: 
 143:   // ── Load graph data ──
 144:   const loadGraphData = useCallback(async () => {
 145:     try {
 146:       setLoading(true)
 147:       const api = (window as any).deskflowAPI
 148:       if (!api) return
 149: 
 150:       const brainStats = await api.brainStats()
 151:       setStats(brainStats)
 152: 
 153:       const nodeMap = new Map<string, GraphNode & { x: number; y: number }>()
 154:       const edgeList: GraphLink[] = []
 155: 
 156:       // Load entities
 157:       const entityResult = await api.brainGetEntities({ limit: 300 })
 158:       const entityItems = entityResult?.items || entityResult || []
 159:       for (const entity of entityItems) {
 160:         if (!nodeMap.has(entity.id)) {
 161:           nodeMap.set(entity.id, {
 162:             id: entity.id,
 163:             name: entity.name,
 164:             type: entity.type,
 165:             state: 'neutral',
 166:             degree: 0,
 167:             facts: [],
 168:             source: entity.source || 'brain',
 169:             x: width / 2 + (Math.random() - 0.5) * width * 0.6,
 170:             y: height / 2 + (Math.random() - 0.5) * height * 0.6,
 171:           })
 172:         }
 173:       }
 174: 
 175:       // Load facts and build edges
 176:       const factsResult = await api.brainGetFacts({ currentOnly: true, limit: 500 })
 177:       const factItems = factsResult?.items || factsResult || []
 178:       for (const fact of factItems) {
 179:         const subjectId = fact.subjectId
 180:         if (!nodeMap.has(subjectId)) {
 181:           nodeMap.set(subjectId, {
 182:             id: subjectId,
 183:             name: subjectId.replace('ent_', '').replace(/_/g, ' '),
 184:             type: 'concept',
 185:             state: fact.validTo ? 'neutral' : 'active',
 186:             degree: 0,
 187:             facts: [],
 188:             x: width / 2 + (Math.random() - 0.5) * width * 0.6,
 189:             y: height / 2 + (Math.random() - 0.5) * height * 0.6,
 190:           })
 191:         }
 192:         const node = nodeMap.get(subjectId)!
 193:         node.facts.push({ predicate: fact.predicate, value: fact.objectLiteral || '' })
 194:         if (!fact.validTo) node.state = 'active'
 195: 
 196:         if (fact.objectId && !nodeMap.has(fact.objectId)) {
 197:           nodeMap.set(fact.objectId, {
 198:             id: fact.objectId,
 199:             name: fact.objectId.replace('ent_', '').replace(/_/g, ' '),
 200:             type: 'concept',
 201:             state: 'neutral',
 202:             degree: 0,
 203:             facts: [],
 204:             x: width / 2 + (Math.random() - 0.5) * width * 0.6,
 205:             y: height / 2 + (Math.random() - 0.5) * height * 0.6,
 206:           })
 207:         }
 208:         if (fact.objectId) {
 209:           edgeList.push({ source: subjectId, target: fact.objectId, predicate: fact.predicate })
 210:         }
 211:       }
 212: 
 213:       // Add learn nodes
 214:       try {
 215:         const learnNodes = await api.learnGetNodes?.()
 216:         if (learnNodes && Array.isArray(learnNodes)) {
 217:           for (const ln of learnNodes.slice(0, 30)) {
 218:             const id = `learn_${ln.id || ln.slug}`
 219:             if (!nodeMap.has(id)) {
 220:               nodeMap.set(id, {
 221:                 id,
 222:                 name: ln.title || ln.name || ln.slug || 'Lesson',
 223:                 type: 'concept',
 224:                 state: 'neutral',
 225:                 degree: 0,
 226:                 facts: [{ predicate: 'is_lesson', value: ln.part || 'general' }],
 227:                 source: 'workspace',
 228:                 x: width / 2 + (Math.random() - 0.5) * width * 0.6,
 229:                 y: height / 2 + (Math.random() - 0.5) * height * 0.6,
 230:               })
 231:             }
 232:           }
 233:         }
 234:       } catch { /* learn nodes not available */ }
 235: 
 236:       const nodeList = Array.from(nodeMap.values())
 237:       console.log(`[ContextGraph] Loaded ${nodeList.length} nodes, ${edgeList.length} edges`)
 238:       setNodes(nodeList)
 239:       setLinks(edgeList)
 240:     } catch (e) {
 241:       console.error('[ContextGraph] Load failed:', e)
 242:     } finally {
 243:       setLoading(false)
 244:     }
 245:   }, [width, height])
 246: 
 247:   useEffect(() => { loadGraphData() }, [loadGraphData])
 248: 
 249:   // ── Filtered nodes/links ──
 250:   const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
 251:   const filteredNodes = useMemo(() =>
 252:     nodes.filter(n =>
 253:       !hiddenTypes.has(n.type) &&
 254:       (!searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()))
 255:     ), [nodes, hiddenTypes, searchQuery])
 256:   const filteredLinks = useMemo(() =>
 257:     links.filter(l => {
 258:       const s = nodeMap.get(l.source as string)
 259:       const t = nodeMap.get(l.target as string)
 260:       return s && t &&
 261:         !hiddenTypes.has(s.type) &&
 262:         !hiddenTypes.has(t.type) &&
 263:         (!searchQuery ||
 264:           s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 265:           t.name.toLowerCase().includes(searchQuery.toLowerCase()))
 266:     }), [links, nodeMap, hiddenTypes, searchQuery])
 267: 
 268:   // ── Entity types for legend ──
 269:   const entityTypes = useMemo(() => Array.from(new Set(nodes.map(n => n.type))).sort(), [nodes])
 270:   const typeCounts = useMemo(() => {
 271:     const c: Record<string, number> = {}
 272:     for (const n of nodes) c[n.type] = (c[n.type] || 0) + 1
 273:     return c
 274:   }, [nodes])
 275: 
 276:   // ── Node hover handler ──
 277:   const handleNodeHover = useCallback((node: GraphNode | null) => {
 278:     setHoveredNode(node)
 279:   }, [])
 280: 
 281:   // ── Node click handler ──
 282:   const handleNodeClick = useCallback((node: GraphNode | null) => {
 283:     if (!node) {
 284:       setSelectedNode(null)
 285:       setSelectedNodeIds(new Set())
 286:       return
 287:     }
 288:     if (selectedNode?.id === node.id) {
 289:       setSelectedNode(null)
 290:       setSelectedNodeIds(new Set())
 291:     } else {
 292:       setSelectedNode(node)
 293:       setSelectedNodeIds(new Set([node.id]))
 294:     }
 295:   }, [selectedNode])
 296: 
 297:   // ── No data state ──
 298:   if (loading && nodes.length === 0) {
 299:     return <LoadingGraph />
 300:   }
 301: 
 302:   if (nodes.length === 0 && !loading) {
 303:     return (
 304:       <div className="flex flex-col items-center py-12 rounded-xl" style={{ background: ACCENTS.surface, border: ACCENTS.border, gap: 12 }}>
 305:         <Network size={32} style={{ color: '#3f3f46' }} />
 306:         <p className="text-sm font-medium text-zinc-400">No entities yet</p>
 307:         <p className="text-xs text-zinc-600 text-center max-w-xs">
 308:           Chat with the AI, complete goals, or update life phases — entities appear here automatically.
 309:         </p>
 310:       </div>
 311:     )
 312:   }
 313: 
 314:   return (
 315:     <div className="relative">
 316:       {/* ── Graph canvas ── */}
 317:       <div
 318:         ref={containerRef}
 319:         className="relative z-10 w-full h-full rounded-xl overflow-hidden"
 320:         style={{ background: 'var(--ws-surface-sunken)', border: ACCENTS.border }}
 321:       >
 322:         {/* Subtle dot pattern overlay */}
 323:         <div className="absolute inset-0 pointer-events-none z-0">
 324:           <DotPattern opacity={0.015} radius={0.6} gap={28} className="text-[#8b5cf6]" />
 325:         </div>
 326: 
 327:         {/* One generative system, two windows (spec §1). BrainVisualization
 328:             owns the shared noise field AND the graph, so this is not a
 329:             second CanvasGraph running beside a decorative background. */}
 330:         <BrainVisualization
 331:           nodes={filteredNodes as GraphNode[]}
 332:           links={filteredLinks as GraphLink[]}
 333:           width={width}
 334:           height={height}
 335:           state={loading ? 'loading' : filteredNodes.length ? 'populated' : 'empty'}
 336:           onNodeHover={handleNodeHover}
 337:           onNodeClick={handleNodeClick}
 338:           hoveredNode={hoveredNode}
 339:           selectedNode={selectedNode}
 340:           selectionSet={selectedNodeIds}
 341:           hideChrome
 342:         />
 343: 
 344:         {/* ── Search bar ── */}
 345:         <div className="absolute top-3 left-3 z-20">
 346:           <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: ACCENTS.surface, border: ACCENTS.border, backdropFilter: 'blur(12px)' }}>
 347:             <Search size={11} className="shrink-0" style={{ color: '#52525b' }} />
 348:             <input
 349:               value={searchQuery}
 350:               onChange={e => setSearchQuery(e.target.value)}
 351:               placeholder="Search…"
 352:               className="flex-1 bg-transparent outline-none text-zinc-300 placeholder-zinc-600 font-mono text-[11px]"
 353:             />
 354:             {searchQuery && (
 355:               <button onClick={() => setSearchQuery('')} className="shrink-0 text-zinc-600 hover:text-zinc-400">
 356:                 <X size={10} />
 357:               </button>
 358:             )}
 359:           </div>
 360:         </div>
 361: 
 362:         {/* ── Stats bar ── */}
 363:         <div className="absolute top-3 right-3 z-20">
 364:           <StatsBar stats={stats} filteredNodes={filteredNodes} filteredLinks={filteredLinks} />
 365:         </div>
 366: 
 367:         {/* ── Type legend ── */}
 368:         <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5">
 369:           <TypeLegend
 370:             entityTypes={entityTypes}
 371:             typeCounts={typeCounts}
 372:             hiddenTypes={hiddenTypes}
 373:         onToggle={(type) => setHiddenTypes(prev => {
 374:               const next = new Set(prev)
 375:               if (next.has(type)) next.delete(type); else next.add(type)
 376:               return next
 377:             })}
 378:           />
 379:         </div>
 380: 
 381:         {/* ── Empty hint ── */}
 382:         {nodes.length > 0 && !selectedNode && !hoveredNode && (
 383:           <div className="absolute bottom-3 right-3 z-20 text-[10px] text-zinc-600 font-mono">
 384:             Click a node to inspect · drag to rearrange
 385:           </div>
 386:         )}
 387: 
 388:         {/* ── External AI Trail chip ── */}
 389:         <div className="absolute bottom-3 z-20 flex items-center gap-2 px-2 py-1 rounded-md text-[10px]" style={{ background: 'rgba(9,9,11,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.04)' }}>
 390:           <Wifi size={10} style={{ color: ACCENTS.cyan }} />
 391:           <span className="text-zinc-500">AI Bridge</span>
 392:           <span className="text-zinc-600 mx-1">·</span>
 393:           <span className="text-zinc-500">External sessions feed the brain</span>
 394:         </div>
 395:       </div>
 396: 
 397:       {/* ── Detail panel for selected node ── */}
 398:       {selectedNode && (
 399:         <EntityDetailPanel node={selectedNode} onClose={() => { setSelectedNode(null); setSelectedNodeIds(new Set()) }} />
 400:       )}
 401: 
 402:       {/* ── Side panel: External AI trail + management ── */}
 403:       <div className="flex flex-col gap-4 mt-4">
 404:         <ExternalAITrail />
 405:         <BrainManagementView />
 406:       </div>
 407:     </div>
 408:   )
 409: }

## BONUS (relevant to M2 — discovered during fetch): src/main/ai/contextBackfill.ts (FULL, 182 lines, wired at main.ts:17983)
   1: /**
   2:  * ContextBackfill — history catch-up for the Context Brain
   3:  *
   4:  * The Context Brain is a NEW system: without this pass it only ever sees
   5:  * events that happen AFTER install, so the profile/graph start empty even
   6:  * though months of real data exist. This miner replays EXISTING DeskFlow
   7:  * data into episodes + signals so the brain catches up on day one.
   8:  *
   9:  * Idempotency: a `context_backfill_meta` table stores the last-processed
  10:  * watermark per source. New rows created after the first run are captured
  11:  * by the live episode writers (episodeWriters.ts) — the two paths do not
  12:  * double-write.
  13:  */
  14: 
  15: import * as fs from 'fs'
  16: import * as path from 'path'
  17: import * as brain from './contextBrain'
  18: import * as userContext from './userContextService'
  19: import { writeGoalEpisode, writeLifePhaseEpisode, writeDeadlineEpisode } from './episodeWriters'
  20: 
  21: let dbRef: any = null
  22: export function setContextDb(db: any) { dbRef = db }
  23: 
  24: const BATCH_SIZE = 250
  25: const TEXT_PK_SOURCES = ['terminal_sessions', 'goals', 'life_phases', 'deadlines']
  26: 
  27: function ensureMeta() {
  28:   dbRef.exec(`CREATE TABLE IF NOT EXISTS context_backfill_meta (
  29:     source TEXT PRIMARY KEY,
  30:     last_id TEXT,
  31:     run_at TEXT
  32:   )`)
  33: }
  34: 
  35: function getWatermark(source: string): string | null {
  36:   const row = dbRef.prepare('SELECT last_id FROM context_backfill_meta WHERE source = ?').get(source)
  37:   return row ? row.last_id : null
  38: }
  39: 
  40: function setWatermark(source: string, lastId: string) {
  41:   dbRef.prepare(`INSERT INTO context_backfill_meta (source, last_id, run_at) VALUES (?, ?, ?)
  42:     ON CONFLICT(source) DO UPDATE SET last_id = excluded.last_id, run_at = excluded.run_at`)
  43:     .run(source, String(lastId), new Date().toISOString())
  44: }
  45: 
  46: function rowId(row: any): string {
  47:   return String(row.id)
  48: }
  49: 
  50: // ═══ Terminal sessions — topic + agent type as interest signals + episodes ═══
  51: function mineTerminalSessions(): number {
  52:   const wm = getWatermark('terminal_sessions')
  53:   const rows = wm
  54:     ? dbRef.prepare('SELECT * FROM terminal_sessions WHERE id > ? AND topic IS NOT NULL AND topic != ? ORDER BY id ASC LIMIT ?')
  55:         .all(wm, '', BATCH_SIZE)
  56:     : dbRef.prepare('SELECT * FROM terminal_sessions WHERE topic IS NOT NULL AND topic != ? ORDER BY id ASC LIMIT ?')
  57:         .all('', BATCH_SIZE)
  58:   for (const row of rows) {
  59:     const content = `[Terminal session] "${row.topic}" (agent: ${row.agent || 'unknown'})${row.total_tokens ? ` — ${row.total_tokens} tokens` : ''}`
  60:     brain.logEpisode('terminal', content.slice(0, 600), row.id, {
  61:       sessionId: row.id,
  62:       agentType: row.agent,
  63:       topic: row.topic,
  64:       backfilled: true,
  65:     })
  66:     const signals = userContext.extractSignalsFromText(`I am working on ${row.topic}`, 'terminal')
  67:     for (const s of signals) userContext.addSignal(s.signalType, s.content, 'terminal', s.confidence, { sourceRef: `terminal_session:${row.id}` })
  68:     setWatermark('terminal_sessions', rowId(row))
  69:   }
  70:   return rows.length
  71: }
  72: 
  73: // ═══ Terminal messages — user prompts → interest/topic signals ═══
  74: function mineTerminalMessages(): number {
  75:   const wm = getWatermark('terminal_messages')
  76:   const rows = wm
  77:     ? dbRef.prepare('SELECT id, session_id, role, content FROM terminal_messages WHERE id > ? AND role = ? ORDER BY id ASC LIMIT ?')
  78:         .all(Number(wm), 'user', BATCH_SIZE)
  79:     : dbRef.prepare('SELECT id, session_id, role, content FROM terminal_messages WHERE role = ? ORDER BY id ASC LIMIT ?')
  80:         .all('user', BATCH_SIZE)
  81:   for (const row of rows) {
  82:     const text = String(row.content || '').slice(0, 500)
  83:     if (text.length < 20) { setWatermark('terminal_messages', rowId(row)); continue }
  84:     const signals = userContext.extractSignalsFromText(text, 'terminal')
  85:     for (const s of signals) userContext.addSignal(s.signalType, s.content, 'terminal', s.confidence, { sourceRef: `terminal_msg:${row.id}` })
  86:     setWatermark('terminal_messages', rowId(row))
  87:   }
  88:   return rows.length
  89: }
  90: 
  91: // ═══ Goals — reuse the live writer so the graph stays consistent ═══
  92: function mineGoals(): number {
  93:   const wm = getWatermark('goals')
  94:   const rows = wm
  95:     ? dbRef.prepare('SELECT * FROM goals WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
  96:     : dbRef.prepare('SELECT * FROM goals ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
  97:   for (const row of rows) {
  98:     try { writeGoalEpisode(row, 'created') } catch {}
  99:     setWatermark('goals', rowId(row))
 100:   }
 101:   return rows.length
 102: }
 103: 
 104: // ═══ Life phases — milestones/reflections are high-value context ═══
 105: function mineLifePhases(): number {
 106:   const wm = getWatermark('life_phases')
 107:   const rows = wm
 108:     ? dbRef.prepare('SELECT * FROM life_phases WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
 109:     : dbRef.prepare('SELECT * FROM life_phases ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
 110:   for (const row of rows) {
 111:     try { writeLifePhaseEpisode(row, 'created') } catch {}
 112:     setWatermark('life_phases', rowId(row))
 113:   }
 114:   return rows.length
 115: }
 116: 
 117: // ═══ Deadlines — due dates/courses as goal_pattern signals ═══
 118: function mineDeadlines(): number {
 119:   const wm = getWatermark('deadlines')
 120:   const rows = wm
 121:     ? dbRef.prepare('SELECT * FROM deadlines WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
 122:     : dbRef.prepare('SELECT * FROM deadlines ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
 123:   for (const row of rows) {
 124:     try { writeDeadlineEpisode(row, 'created') } catch {}
 125:     setWatermark('deadlines', rowId(row))
 126:   }
 127:   return rows.length
 128: }
 129: 
 130: // ═══ Problems & requests (agent/ JSON store) — user priorities as signals ═══
 131: function mineProblemFiles(): number {
 132:   let mined = 0
 133:   const projectRoot = process.cwd()
 134:   const candidates = [
 135:     path.join(projectRoot, 'agent', 'problems.json'),
 136:     path.join(projectRoot, 'agent', 'requests.json'),
 137:   ]
 138:   for (const file of candidates) {
 139:     const source = file.endsWith('problems.json') ? 'problems' : 'requests'
 140:     let items: any[] = []
 141:     try { items = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { continue }
 142:     if (!Array.isArray(items)) continue
 143:     for (const item of items) {
 144:       const title = item.title || item.name
 145:       const desc = item.description || item.details || ''
 146:       const text = `${title}${desc ? ` — ${desc}` : ''}`.slice(0, 400)
 147:       if (text.length < 15) continue
 148:       const signals = userContext.extractSignalsFromText(`My priority: ${text}`, source)
 149:       for (const s of signals) userContext.addSignal(s.signalType, s.content, source, s.confidence, { sourceRef: `${source}:${item.id || item.title}` })
 150:       mined++
 151:     }
 152:   }
 153:   return mined
 154: }
 155: 
 156: export function runContextBackfill(): { ok: boolean; sources: Record<string, number>; total: number } {
 157:   const results: Record<string, number> = {}
 158:   let total = 0
 159:   if (!dbRef) return { ok: false, sources: results, total: 0 }
 160:   try { ensureMeta() } catch (e: any) { console.warn('[ContextBackfill] meta init failed:', e?.message); return { ok: false, sources: results, total: 0 } }
 161: 
 162:   const miners: Array<[string, () => number]> = [
 163:     ['terminal_sessions', mineTerminalSessions],
 164:     ['terminal_messages', mineTerminalMessages],
 165:     ['goals', mineGoals],
 166:     ['life_phases', mineLifePhases],
 167:     ['deadlines', mineDeadlines],
 168:     ['problems', mineProblemFiles],
 169:   ]
 170:   for (const [name, fn] of miners) {
 171:     try {
 172:       const n = fn()
 173:       results[name] = n
 174:       total += n
 175:     } catch (e: any) {
 176:       console.warn(`[ContextBackfill] ${name} failed:`, e?.message)
 177:       results[name] = -1
 178:     }
 179:   }
 180:   if (total > 0) console.log(`[ContextBackfill] processed ${total} existing record(s) into the context brain`, results)
 181:   else console.log('[ContextBackfill] nothing to backfill — all sources already caught up')
 182:   return { ok: true, sources: results, total }
 183: }
