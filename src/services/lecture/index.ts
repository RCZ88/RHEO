// Lecture module (SlideMind — AI Digest Studio for Students) — IPC handler registration.
// Call registerLectureHandlers(db) from main.ts during startup.
// The renderer talks to this via a single channel `lecture:api` whose payload is
// { method: 'get'|'post'|'put'|'del', path: '/api/slides?deck_id=5', body?: any },
// mirroring the REST surface of the original lecturer-feature Supabase backend.

import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';

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
        const rawEstimate = deckTokens * 6 + 42000;
        const saved = Math.max(0, rawEstimate - promptTokens - deckTokens);
        const savingsPct = rawEstimate > 0 ? Math.round((saved / rawEstimate) * 100) : 0;
        return {
          decks: deckRows.length, slides: slidesCount, prompts: promptRows.length,
          transcripts: transcriptsCount, webSources: websCount, images: imagesCount,
          deckTokens, promptTokens, rawEstimate, saved, savingsPct,
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
        if (table === 'sm_decks') db.prepare('DELETE FROM sm_slides WHERE deck_id = ?').run(Number(id));
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