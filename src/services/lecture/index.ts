// Lecture module (SlideMind — AI Digest Studio for Students) — IPC handler registration.
// Call registerLectureHandlers(db) from main.ts during startup.
// The renderer talks to this via a single channel `lecture:api` whose payload is
// { method: 'get'|'post'|'put'|'del', path: '/api/slides?deck_id=5', body?: any },
// mirroring the REST surface of the original lecturer-feature Supabase backend.

import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

type Method = 'get' | 'post' | 'put' | 'del';
interface ApiRequest {
  method: Method;
  path: string;
  body?: any;
}

const TABLES = {
  decks: 'sm_decks',
  slides: 'sm_slides',
  'slide-elements': 'sm_slide_elements',
  images: 'sm_images',
  transcripts: 'sm_transcripts',
  'web-sources': 'sm_web_sources',
  prompts: 'sm_prompts',
  research: 'sm_research_items',
  'auth-profiles': 'sm_auth_profiles',
} as const;

/** Parse '/api/slides?deck_id=5' into { route: 'slides', query: { deck_id: '5' } }. */
function parsePath(path: string): { route: string; query: Record<string, string> } {
  const [rawPath, rawQuery] = path.split('?');
  const route = (rawPath || '').replace(/^\/api\//, '').replace(/^\/+|\/+$/g, '');
  const query: Record<string, string> = {};
  if (rawQuery) {
    for (const pair of rawQuery.split('&')) {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { route, query };
}

/** Mirrors the renderer's estimateTokens rule-of-thumb (~4 chars/token) for raw blobs. */
function charsToTokens(chars: number): number {
  if (!chars || chars <= 0) return 0;
  return Math.round(chars / 4);
}

// ── Local AI plumbing (Ollama vision + local speech-to-text) ──────────────────

const OLLAMA_BASE = 'http://127.0.0.1:11434';
const OLLAMA_DOWN = 'Ollama is not running. Start it with `ollama serve`, then pull a vision model (e.g. `ollama pull llama3.2-vision`).';

/**
 * Real Ollama tags that accept images. Note the family is `qwen2.5vl`, NOT
 * `qwen2.5-vl` — the page used to offer `qwen2.5-vl:3b`, a tag that does not
 * exist, so selecting it always 404'd.
 */
const VISION_CANDIDATES = [
  'llama3.2-vision', 'llava-llama3', 'llava', 'moondream', 'minicpm-v',
  'qwen2.5vl', 'granite3.2-vision', 'gemma3', 'mistral-small3.1', 'bakllava',
];

/** OpenAI-compatible local STT servers, most common first. */
const STT_ENDPOINT_CANDIDATES = [
  'http://127.0.0.1:8080/v1',
  'http://127.0.0.1:8000/v1',
  'http://127.0.0.1:9000/v1',
  'http://127.0.0.1:18080/v1',
  'http://127.0.0.1:11434/v1',
];

function clampTimeout(v: any, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return max;
  return Math.min(max, Math.max(min, n));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

type OllamaStatus = { online: boolean; version?: string; models: string[]; visionModels: string[]; error?: string };
let ollamaCache: { at: number; value: OllamaStatus } | null = null;

function looksLikeVisionModel(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes(':')) return VISION_CANDIDATES.some(c => n.startsWith(c + ':') || n.startsWith(c.split(':')[0] + ':'));
  return VISION_CANDIDATES.some(c => n.includes(c));
}

async function probeOllama(force = false): Promise<OllamaStatus> {
  if (!force && ollamaCache && Date.now() - ollamaCache.at < 4000) return ollamaCache.value;
  let value: OllamaStatus;
  try {
    const vres = await fetchWithTimeout(`${OLLAMA_BASE}/api/version`, {}, 2500);
    if (!vres.ok) throw new Error('HTTP ' + vres.status);
    const vjson: any = await vres.json().catch(() => ({}));
    let models: string[] = [];
    try {
      const tres = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`, {}, 4000);
      if (tres.ok) {
        const tjson: any = await tres.json();
        models = (tjson?.models || []).map((m: any) => String(m?.name || m?.model || '')).filter(Boolean);
      }
    } catch { /* tags optional */ }
    value = {
      online: true,
      version: vjson?.version ? String(vjson.version) : undefined,
      models,
      visionModels: models.filter(looksLikeVisionModel),
    };
  } catch (err: any) {
    value = { online: false, models: [], visionModels: [], error: err?.message || String(err) };
  }
  ollamaCache = { at: Date.now(), value };
  return value;
}

/** Prefer an exact install, then a family match, then any installed vision model. */
function pickVisionModel(requested: string, installed: string[]): string | null {
  const want = requested.trim().toLowerCase();
  if (want && installed.some(m => m.toLowerCase() === want)) return installed.find(m => m.toLowerCase() === want)!;
  if (want) {
    const family = VISION_CANDIDATES.find(c => want.includes(c));
    if (family) {
      const hit = installed.find(m => m.toLowerCase().includes(family));
      if (hit) return hit;
    }
  }
  return installed[0] || null;
}

type SttEndpoint = { base: string; models: string[] };
let sttCache: { at: number; value: { endpoints: SttEndpoint[]; cli: string | null } } | null = null;

/** whisper.cpp ships its CLI under several names depending on the build. */
const WHISPER_BINARIES = ['whisper-cli', 'whisper-cpp', 'whisper', 'whisper.cpp'];

function whichBinary(names: string[]): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  return new Promise(resolve => {
    let done = false;
    const finish = (v: string | null) => { if (!done) { done = true; resolve(v); } };
    try {
      execFile(cmd, names, { timeout: 2500, windowsHide: true }, (_err, stdout) => {
        const first = String(stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
        finish(first || null);
      });
    } catch { finish(null); }
  });
}

async function probeSttEndpoints(): Promise<SttEndpoint[]> {
  const found: SttEndpoint[] = [];
  for (const base of STT_ENDPOINT_CANDIDATES) {
    try {
      const res = await fetchWithTimeout(`${base}/models`, {}, 900);
      if (!res.ok) continue;
      const json: any = await res.json().catch(() => null);
      if (!json) continue;
      const models = (json?.data || []).map((m: any) => String(m?.id || '')).filter(Boolean);
      // Ollama speaks the chat API but has no /audio/transcriptions route, so it
      // must not be advertised as a speech backend even though /models answers.
      if (/11434$/.test(base)) continue;
      found.push({ base, models });
    } catch { /* not listening */ }
  }
  return found;
}

async function probeLocalStt(force = false) {
  if (!force && sttCache && Date.now() - sttCache.at < 5000) return sttCache.value;
  const endpoints = await probeSttEndpoints();
  const cli = await whichBinary(WHISPER_BINARIES);
  const value = { endpoints, cli };
  sttCache = { at: Date.now(), value };
  return value;
}

const STT_HELP =
  'No local speech-to-text backend found. Install one of:\n' +
  '  • faster-whisper-server  →  pip install faster-whisper-server && python -m faster_whisper.server  (port 8000)\n' +
  '  • whisper.cpp server     →  ./server -m models/ggml-base.bin --port 8080\n' +
  '  • whisper.cpp CLI        →  put whisper-cli on your PATH (wav input only)\n' +
  '  • Speaches               →  docker run -p 8000:8000 ghcr.io/speaches-ai/speaches\n' +
  'Or set a custom OpenAI-compatible endpoint in the field below. Live mic capture via the Web Speech API keeps working regardless.';

/** Build a multipart/form-data body without pulling in a dependency. */
function buildMultipart(fields: Record<string, string>, file: { name: string; type: string; data: Buffer }): { body: Buffer; boundary: string } {
  const boundary = '----SlideMind' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, 'utf8'));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name.replace(/"/g, '')}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    'utf8'
  ));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
  return { body: Buffer.concat(parts), boundary };
}

/** Accept the several shapes these servers return and pull out plain text. */
function extractTranscript(json: any): string {
  if (!json) return '';
  if (typeof json.text === 'string' && json.text.trim()) return json.text.trim();
  if (Array.isArray(json.text)) {
    const joined = json.text.map((t: any) => (typeof t === 'string' ? t : t?.text || '')).join(' ').trim();
    if (joined) return joined;
  }
  if (Array.isArray(json.segments)) {
    return json.segments.map((s: any) => String(s?.text || '').replace(/^\s*\[[^\]]*\]\s*/, '')).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(json.transcription)) return json.transcription.join(' ').trim();
  if (typeof json.result === 'string') return json.result.trim();
  return '';
}

async function transcribeViaEndpoint(bytes: Buffer, ep: SttEndpoint, opts: { mime: string; filename: string; language: string; model: string }) {
  const model = opts.model && ep.models.includes(opts.model) ? opts.model : (ep.models.find(m => /whisper|parselmouth|wav2vec/i.test(m)) || ep.models[0] || 'whisper-1');
  const ext = (opts.filename.match(/\.([a-z0-9]{2,5})$/i)?.[1] || opts.mime.split('/')[1] || 'webm').toLowerCase();
  const fields: Record<string, string> = { model, response_format: 'json' };
  if (opts.language && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(opts.language)) fields.language = opts.language;
  const { body, boundary } = buildMultipart(fields, {
    name: 'lecture.' + ext,
    type: opts.mime,
    data: bytes,
  });
  const res = await fetchWithTimeout(`${ep.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    // Buffer satisfies BodyInit at runtime; TS's DOM lib does not model Node
    // Buffers as BodyInit, hence the cast.
    body: body as unknown as BodyInit,
  }, 15 * 60_000);
  const raw = await res.text();
  if (!res.ok) throw new Error(`${ep.base} → HTTP ${res.status}: ${raw.slice(0, 240)}`);
  let json: any = null;
  try { json = JSON.parse(raw); } catch { json = null; }
  const text = extractTranscript(json) || (json ? '' : raw.trim());
  if (!text) throw new Error(`${ep.base} returned no transcript field (got ${raw.slice(0, 160) || 'empty body'}).`);
  return { text, model, engine: ep.base };
}

async function transcribeViaWhisperCli(bytes: Buffer, bin: string, opts: { mime: string; filename: string; language: string }) {
  const ext = (opts.filename.match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
  if (ext !== 'wav') {
    return { error: `${path.basename(bin)} is installed but only reads 16-bit WAV. Your file is .${ext || opts.mime.split('/')[1]} — convert it, or start an OpenAI-compatible server (faster-whisper-server on port 8000 handles mp3/m4a/webm).` };
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'slidemind-stt-'));
  const wav = path.join(dir, 'lecture.wav');
  await fs.writeFile(wav, bytes);
  const args = ['-f', wav, '-nt', '-otxt', '-of', path.join(dir, 'out')];
  if (opts.language) args.push('-l', opts.language);
  try {
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      execFile(bin, args, { timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
        (err, so, se) => (err ? reject(new Error(String(se || err.message).slice(0, 300))) : resolve({ stdout: String(so || '') })));
    });
    let out = '';
    try { out = (await fs.readFile(path.join(dir, 'out.txt'), 'utf8')).trim(); } catch { out = ''; }
    if (!out) out = stdout.replace(/\[[^\]]*\]\s*/g, '').trim();
    if (!out) return { error: `${path.basename(bin)} produced no transcript. Check that a ggml model file is available.` };
    return { text: out, model: 'whisper-cli', engine: bin };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function transcribeLocally(bytes: Buffer, opts: { mime: string; filename: string; language: string; model: string; endpoint: string }) {
  const { endpoints, cli } = await probeLocalStt(true);

  // 1. An explicit endpoint always wins.
  if (opts.endpoint.trim()) {
    const base = opts.endpoint.trim().replace(/\/+$/, '');
    const probe = endpoints.find(e => e.base === base);
    const ep: SttEndpoint = probe || { base, models: opts.model.trim() ? [opts.model.trim()] : [] };
    try { return await transcribeViaEndpoint(bytes, ep, opts); }
    catch (err: any) { return { error: 'Custom endpoint failed — ' + (err?.message || String(err)) }; }
  }

  // 2. Any discovered OpenAI-compatible server.
  for (const ep of endpoints) {
    try { return await transcribeViaEndpoint(bytes, ep, opts); }
    catch (err: any) { console.warn('[Lecture] STT endpoint failed:', ep.base, err?.message); }
  }

  // 3. whisper.cpp CLI, for wav input.
  if (cli) {
    try { return await transcribeViaWhisperCli(bytes, cli, opts); }
    catch (err: any) { return { error: 'whisper.cpp CLI failed — ' + (err?.message || String(err)) }; }
  }

  return { error: STT_HELP };
}

export function registerLectureHandlers(db: Database) {
  // ── Generic REST dispatcher over the sm_* tables ──────────────────────────
  ipcMain.handle('lecture:api', async (_event, req: ApiRequest) => {
    try {
      const { route, query } = parsePath(req?.path || '');
      const table = (TABLES as Record<string, string>)[route];

      const method: Method = req?.method || 'get';

      // ── /api/stats — dashboard aggregates (ported from lecturer-feature/api/stats.js)
      if (route === 'stats' && method === 'get') {
        const deckRows = db.prepare('SELECT id, total_tokens, slide_count FROM sm_decks').all() as any[];
        const slidesCount = (db.prepare('SELECT COUNT(*) AS c FROM sm_slides').get() as any).c;
        const promptRows = db.prepare('SELECT id, token_estimate FROM sm_prompts').all() as any[];
        const transcriptsCount = (db.prepare('SELECT COUNT(*) AS c FROM sm_transcripts').get() as any).c;
        const websCount = (db.prepare('SELECT COUNT(*) AS c FROM sm_web_sources').get() as any).c;
        const imagesCount = (db.prepare('SELECT COUNT(*) AS c FROM sm_images').get() as any).c;

        const deckTokens = deckRows.reduce((a, d) => a + (d.total_tokens || 0), 0);
        const promptTokens = promptRows.reduce((a, p) => a + (p.token_estimate || 0), 0);

        // HONEST baseline: "raw" is the token weight of material actually ingested.
        // It used to be `deckTokens * 6 + 42000`, which invented 42,000 phantom
        // tokens on an EMPTY database and rendered the dashboard as "100% saved"
        // before the user had ingested anything. Count only real bytes on disk.
        const transcriptTokens = charsToTokens(
          (db.prepare('SELECT content FROM sm_transcripts').all() as any[]).reduce((a, r) => a + (r.content || '').length, 0)
        );
        const webTokens = charsToTokens(
          (db.prepare('SELECT extracted_text FROM sm_web_sources').all() as any[]).reduce((a, r) => a + (r.extracted_text || '').length, 0)
        );
        const imageTokens = charsToTokens(
          (db.prepare('SELECT ocr_text, caption FROM sm_images').all() as any[]).reduce((a, r) => a + (r.ocr_text || '').length + (r.caption || '').length, 0)
        );
        const rawEstimate = deckTokens + transcriptTokens + webTokens + imageTokens;

        // Savings = raw material avoided, i.e. what you did NOT have to paste.
        // With nothing ingested there is nothing to save, so report 0 — not 100%.
        const saved = Math.max(0, rawEstimate - promptTokens);
        const savingsPct = rawEstimate > 0 ? Math.round((saved / rawEstimate) * 100) : 0;
        return {
          decks: deckRows.length, slides: slidesCount, prompts: promptRows.length,
          transcripts: transcriptsCount, webSources: websCount, images: imagesCount,
          deckTokens, promptTokens, rawEstimate, saved, savingsPct,
          hasData: rawEstimate > 0 || promptTokens > 0,
        };
      }

      if (!table) return { error: `Unknown lecture endpoint: ${route}` };

      if (method === 'get') {
        // Orderings per original api/*.js handlers.
        const orderMap: Record<string, [string, boolean]> = {
          sm_decks: ['uploaded_at', false],
          sm_slides: ['slide_number', true],
          sm_slide_elements: ['id', true],
          sm_images: ['created_at', false],
          sm_transcripts: ['created_at', false],
          sm_web_sources: ['created_at', false],
          sm_prompts: ['created_at', false],
          sm_research_items: ['priority', true],
          sm_auth_profiles: ['id', true],
        };
        const limits: Record<string, number> = {
          sm_images: 100,
          sm_transcripts: 100,
          sm_web_sources: 100,
          sm_prompts: 200,
        };
        let sql = `SELECT * FROM ${table}`;
        const conds: string[] = [];
        const params: any[] = [];
        const fkCols = { sm_slides: 'deck_id', sm_slide_elements: 'slide_id' } as Record<string, string>;
        const fk = fkCols[table];
        if (fk && query[fk] != null) {
          conds.push(`${fk} = ?`);
          params.push(Number(query[fk]));
        }
        if (conds.length) sql += ' WHERE ' + conds.join(' AND ') + ' ORDER BY ';
        else sql += ' ORDER BY ';
        const [col, asc] = orderMap[table];
        sql += `${col} ${asc ? 'ASC' : 'DESC'}`;
        if (limits[table]) sql += ' LIMIT ' + limits[table];
        const rows = db.prepare(sql).all(...params);
        return Array.isArray(rows) ? rows.map(normalizeRow) : rows;
      }

      if (method === 'post') {
        const body = req?.body || {};
        const single = !Array.isArray(body);
        const rows = single ? [body] : body;
        if (rows.length === 0) return { error: 'empty body' };
        const inserted = rows.map((row: any) => insertRow(db, table, row));
        return single ? normalizeRow(inserted[0]) : inserted.map(normalizeRow);
      }

      if (method === 'put') {
        const body = req?.body || {};
        const { id, ...fields } = body;
        if (id == null) return { error: 'id required' };
        const clean = sanitizeFields(table, fields);
        if (!Object.keys(clean).length) return { error: 'no fields to update' };
        const keys = Object.keys(clean);
        db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map(k => clean[k]), Number(id));
        const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
        return row ? normalizeRow(row) : { ok: true };
      }

      if (method === 'del') {
        const body = req?.body || {};
        const { id } = body;
        if (id == null) return { error: 'id required' };
        // Cascade properly. Deleting a deck used to drop its slides but leave every
        // sm_slide_element row orphaned forever (no FK enforcement in SQLite by
        // default), so the slide-element table grew forever and leaked disk.
        if (table === 'sm_decks') {
          const slideIds = (db.prepare('SELECT id FROM sm_slides WHERE deck_id = ?').all(Number(id)) as any[]).map(r => r.id);
          for (const sid of slideIds) db.prepare('DELETE FROM sm_slide_elements WHERE slide_id = ?').run(sid);
          db.prepare('DELETE FROM sm_slides WHERE deck_id = ?').run(Number(id));
        }
        if (table === 'sm_slides') db.prepare('DELETE FROM sm_slide_elements WHERE slide_id = ?').run(Number(id));
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(id));
        return { ok: true };
      }

      return { error: 'Method not allowed' };
    } catch (err: any) {
      console.error('[Lecture] api error:', err);
      return { error: err?.message || String(err) };
    }
  });

  // ── URL digest (ported from lecturer-feature/api/digest.js) ────────────────
  ipcMain.handle('lecture:digest', async (_event, url: string) => {
    if (!url) return { error: 'url query param required' };
    const target = String(url);
    try {
      const isYT = /youtube\.com|youtu\.be/i.test(target);
      let videoId = '';
      if (isYT) {
        const m = target.match(/(?:v=|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (m) videoId = m[1].split('&')[0];
      }
      if (isYT) {
        let title = 'YouTube video ' + (videoId || '');
        let author = 'Unknown channel';
        try {
          const o = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(target) + '&format=json');
          if (o.ok) { const j: any = await o.json(); title = j.title || title; author = j.author_name || author; }
        } catch { /* ignore */ }
        let chapters = '';
        try {
          const page = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const html = await page.text();
          const descM = html.match(/<meta name="description" content="([^"]{0,2000})/);
          if (descM) chapters = descM[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").slice(0, 3000);
          const kwM = html.match(/<meta name="keywords" content="([^"]{0,1000})/);
          if (kwM) chapters += '\n\nKeywords: ' + kwM[1];
        } catch { /* ignore */ }
        const extracted = ('VIDEO: ' + title + '\nChannel: ' + author + '\nURL: ' + target + '\nVideoID: ' + videoId + '\n\nDescription/meta:\n' + (chapters || '(description unavailable — fetch transcript via Playwright authenticated session or YouTube timedtext API)')).slice(0, 8000);
        const summary = 'Lecture/video "' + title + '" by ' + author + '. Digested for token-efficient prompting. Attach transcript chunks (see Playwright recipe) for deep Q&A.';
        const promptPack = '[CONTEXT] YouTube lecture digest\nTitle: ' + title + '\nChannel: ' + author + '\nURL: ' + target + '\n\n[EXTRACTED META]\n' + extracted.slice(0, 2500) + '\n\n[TASK] Explain the key concepts in this lecture as if tutoring a CS/math undergrad. First list 5 key ideas, then deep-dive each with a worked example. Keep answers grounded in the transcript chunks I will paste next.\n\n[FOLLOW-UP QUESTIONS]\n1. Summarize this video in 8 bullet points.\n2. What definitions/theorems appear? Quote them.\n3. Generate 5 exam-style questions with solutions.';
        return { source_type: 'youtube', title, extracted_text: extracted, summary, prompt_pack: promptPack, videoId, author };
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (SlideMind DigestBot)' }, signal: ctrl.signal });
      clearTimeout(t);
      const html = await r.text();
      const getMeta = (re: RegExp) => { const m = html.match(re); return m ? m[1].slice(0, 500) : ''; };
      const title = getMeta(/<title[^>]*>([^<]{1,300})<\/title>/i) || getMeta(/<meta property="og:title" content="([^"]+)"/i) || target;
      const desc = getMeta(/<meta name="description" content="([^"]+)"/i) || getMeta(/<meta property="og:description" content="([^"]+)"/i);
      let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      text = text.slice(0, 8000);
      const extracted = ('PAGE: ' + title + '\nURL: ' + target + (desc ? '\nMeta: ' + desc : '') + '\n\n' + text).slice(0, 8000);
      const summary = 'Article/page "' + title + '" digested (' + text.split(' ').length + ' words sampled). Ready to chunk into prompt packs.';
      const promptPack = '[CONTEXT] Web article digest\nTitle: ' + title + '\nURL: ' + target + '\n\n[EXTRACTED CONTENT — chunk 1]\n' + extracted.slice(0, 2500) + '\n\n[TASK] Act as my study tutor. Summarize the article, extract definitions/formulas, and flag anything that conflicts with my lecture slides. Then ask me 3 retrieval-practice questions.';
      return { source_type: 'website', title, extracted_text: extracted, summary, prompt_pack: promptPack };
    } catch (err: any) {
      console.error('[Lecture] digest error:', err);
      return { error: 'Could not digest URL: ' + (err?.message || String(err)) };
    }
  });

  // ── Local AI (Ollama vision + local speech-to-text) ────────────────────────
  // These live in the MAIN process on purpose. The renderer used to call
  // http://localhost:11434 with a bare `fetch`, which meant every local-AI
  // feature silently failed on CORS preflight / CSP, and the only symptom was
  // an error string pasted into the output textarea. From main there is no
  // origin to reject, no CSP to satisfy, and we can probe for real models.
  ipcMain.handle('lecture:local-ai:status', async () => {
    const ollama = await probeOllama();
    const stt = await probeLocalStt();
    return { ollama, stt, checkedAt: Date.now() };
  });

  ipcMain.handle('lecture:local-ai:vision', async (_event, opts: {
    model?: string; imageBase64?: string; prompt?: string; timeoutMs?: number;
  }) => {
    const model = String(opts?.model || '').trim();
    const imageBase64 = String(opts?.imageBase64 || '').trim();
    const prompt = String(opts?.prompt || 'Extract ALL text from this image. Return every word, label, axis value, legend entry and caption exactly as written.');
    if (!imageBase64) return { error: 'No image supplied.' };

    const status = await probeOllama();
    if (!status.online) return { error: OLLAMA_DOWN };
    const chosen = pickVisionModel(model, status.visionModels);
    if (!chosen) {
      return {
        error: status.visionModels.length
          ? 'None of the requested model(s) are installed. Pull one first: ollama pull ' + (VISION_CANDIDATES[0])
          : 'Ollama is online but has no vision model installed. Run: ollama pull ' + VISION_CANDIDATES[0],
        visionModels: status.visionModels,
      };
    }

    const dataUrl = /^data:/.test(imageBase64)
      ? imageBase64
      : 'data:image/png;base64,' + imageBase64;
    const started = Date.now();
    try {
      const res = await fetchWithTimeout(`${OLLAMA_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosen,
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }],
          }],
          max_tokens: 4000,
          stream: false,
        }),
      }, clampTimeout(opts?.timeoutMs, 30_000, 240_000));

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { error: `Ollama HTTP ${res.status} from "${chosen}": ${body.slice(0, 300) || '(empty body)'}` };
      }
      const data: any = await res.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!text) return { error: `"${chosen}" returned an empty response. Try a smaller region or a different model.`, model: chosen };
      return { text, model: chosen, elapsedMs: Date.now() - started };
    } catch (err: any) {
      return { error: 'Local vision request failed: ' + (err?.message || String(err)), model: chosen };
    }
  });

  ipcMain.handle('lecture:local-ai:stt', async (_event, opts: {
    audioBase64?: string; mime?: string; filename?: string; language?: string; model?: string; endpoint?: string;
  }) => {
    const b64 = String(opts?.audioBase64 || '').trim();
    if (!b64) return { error: 'No audio supplied.' };
    let bytes: Buffer;
    try {
      bytes = Buffer.from(b64, 'base64');
    } catch {
      return { error: 'Audio payload was not valid base64.' };
    }
    if (bytes.length < 1024) return { error: 'Audio file is empty or truncated (' + bytes.length + ' bytes).' };

    const started = Date.now();
    const result = await transcribeLocally(bytes, {
      mime: String(opts?.mime || 'audio/webm'),
      filename: String(opts?.filename || 'lecture.webm'),
      language: String(opts?.language || ''),
      model: String(opts?.model || ''),
      endpoint: String(opts?.endpoint || ''),
    }) as { error?: string; text: string; model?: string; engine?: string };
    if (result.error || !result.text) return { error: result.error || 'The backend returned an empty transcript.' };
    return { ...result, elapsedMs: Date.now() - started, bytes: bytes.length };
  });
}

function sanitizeFields(table: string, fields: Record<string, any>): Record<string, any> {
  const allowed = idColsFor(table);
  const clean: Record<string, any> = {};
  for (const key of Object.keys(fields)) {
    if (['id', 'created_at'].includes(key)) continue;
    if (allowed.includes(key)) clean[key] = fields[key];
  }
  return clean;
}

const BASE_COLS = ['title', 'filename', 'slide_count', 'status', 'total_tokens', 'language', 'uploaded_at'];
const SLIDE_COLS = ['deck_id', 'slide_number', 'title', 'text_content', 'shapes_json', 'notes', 'token_estimate'];
const ELEMENT_COLS = ['slide_id', 'element_type', 'content', 'position_json', 'token_estimate'];
const IMAGE_COLS = ['filename', 'ocr_text', 'caption', 'region_json', 'token_estimate', 'image_url'];
const TRANSCRIPT_COLS = ['title', 'source_type', 'language', 'detected_language', 'content', 'duration_sec'];
const WEBSOURCE_COLS = ['url', 'source_type', 'title', 'extracted_text', 'summary', 'prompt_pack', 'status'];
const PROMPT_COLS = ['title', 'prompt_type', 'source_ref', 'content', 'token_estimate', 'target_ai'];
const RESEARCH_COLS = ['category', 'title', 'description', 'tools', 'status', 'priority'];
const AUTHPROFILE_COLS = ['service_name', 'username_label', 'status', 'session_expires', 'script', 'notes'];

const TABLE_COLS: Record<string, string[]> = {
  sm_decks: BASE_COLS,
  sm_slides: SLIDE_COLS,
  sm_slide_elements: ELEMENT_COLS,
  sm_images: IMAGE_COLS,
  sm_transcripts: TRANSCRIPT_COLS,
  sm_web_sources: WEBSOURCE_COLS,
  sm_prompts: PROMPT_COLS,
  sm_research_items: RESEARCH_COLS,
  sm_auth_profiles: AUTHPROFILE_COLS,
};

function idColsFor(table: string): string[] {
  return TABLE_COLS[table] || BASE_COLS;
}

function insertRow(db: Database, table: string, row: Record<string, any>): any {
  const allowed = idColsFor(table);
  const clean: Record<string, any> = {};
  for (const key of Object.keys(row || {})) {
    if (!allowed.includes(key)) continue;
    let v = row[key];
    if (v === undefined) v = null;
    else if (v !== null && typeof v === 'object') v = JSON.stringify(v);
    else if (typeof v === 'boolean') v = v ? 1 : 0;
    else if (typeof v === 'number' && !Number.isFinite(v)) v = null;
    clean[key] = v;
  }
  // Defaults mirror the original api/*.js POST handlers.
  const defaults: Record<string, any> = {
    sm_decks: { slide_count: 0, status: 'ready', total_tokens: 0, language: 'en' },
    sm_slides: { slide_number: 1, token_estimate: 0 },
    sm_slide_elements: { element_type: 'text', token_estimate: 0 },
    sm_images: { filename: '', ocr_text: '', caption: '', region_json: null, token_estimate: 0, image_url: '' },
    sm_transcripts: { source_type: 'mic', language: 'auto', detected_language: 'en', content: '', duration_sec: 0 },
    sm_web_sources: { source_type: 'website', title: '', extracted_text: '', summary: '', prompt_pack: '', status: 'ready' },
    sm_prompts: { prompt_type: 'slide_qa', source_ref: '', content: '', token_estimate: 0, target_ai: 'chatgpt' },
    sm_research_items: { category: 'stack', description: '', tools: '', status: 'planned', priority: 5 },
    sm_auth_profiles: { username_label: '', status: 'not_connected', session_expires: null, script: '', notes: '' },
  };
  for (const [k, v] of Object.entries(defaults[table] || {})) {
    if (!(k in clean)) clean[k] = v;
  }
  const keys = Object.keys(clean);
  const info = db
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(...keys.map(k => clean[k]));
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

/** Supabase rows carry snake_case already; keep them as-is, but strip nothing. */
function normalizeRow(row: any): any {
  return row;
}