// ============================================================================
// ChatLibrary — one store for every conversation the user has with any AI.
// ============================================================================
// DeskFlow had four independent chat paths (in-app chat, external-AI capture,
// AI Gateway, JSON export) writing to three unrelated places. This module makes
// `ai_chat_threads` + `ai_chat_messages` the single store, and funnels every
// source through `ingestConversation`.
//
// Idempotency is the hard requirement, not an optimisation: the browser
// extension re-captures the same conversation on every poll, so ingest must be
// content-hash deduped or the library fills with duplicates.
//
// FTS5 gives real ranked search. It is attempted at migrate time and falls back
// to LIKE scanning if the build lacks it — better-sqlite3 is compiled per-host,
// so this cannot be assumed at author time.
// ============================================================================

import * as crypto from 'crypto';

export type ChatSource = 'deskflow_chat' | 'external_ai' | 'aigateway' | 'imported_file';

export interface IngestMessage {
  role: string;
  content: string;
  timestamp?: number;
}

export interface IngestInput {
  source: ChatSource;
  provider: string;
  messages: IngestMessage[];
  /** Stable per-conversation id from the caller. Used as the dedup identity. */
  externalId?: string;
  title?: string;
  url?: string;
}

export interface ChatThreadRow {
  threadDate: string;
  title: string | null;
  autoTitle: string | null;
  source: string;
  provider: string | null;
  groupId: string | null;
  pinned: number;
  messageCount: number;
  lastMessageAt: number | null;
  lastAccessedAt: number | null;
  preview: string | null;
  url: string | null;
  brainEpisodeId: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  auto: number;
}

export interface SearchHit {
  threadDate: string;
  title: string | null;
  autoTitle: string | null;
  source: string;
  provider: string | null;
  groupId: string | null;
  pinned: number;
  lastMessageAt: number | null;
  messageCount: number;
  snippet: string | null;
  rank: number;
}

type Db = any;

const FTS_TABLE = 'ai_chat_fts';

// ---------------------------------------------------------------------------
// Migration — additive only, idempotent, never destructive.
// ---------------------------------------------------------------------------

function addColumn(db: Db, table: string, ddl: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch {
    /* column already exists */
  }
}

export function migrateChatLibrary(db: Db): { fts: boolean } {
  addColumn(db, 'ai_chat_threads', "source TEXT DEFAULT 'deskflow_chat'");
  addColumn(db, 'ai_chat_threads', 'provider TEXT');
  addColumn(db, 'ai_chat_threads', 'group_id TEXT');
  addColumn(db, 'ai_chat_threads', 'pinned INTEGER DEFAULT 0');
  addColumn(db, 'ai_chat_threads', 'auto_title TEXT');
  addColumn(db, 'ai_chat_threads', 'url TEXT');
  addColumn(db, 'ai_chat_threads', 'content_hash TEXT');
  addColumn(db, 'ai_chat_threads', 'brain_episode_id TEXT');
  addColumn(db, 'ai_chat_threads', 'last_accessed_at INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'zinc',
      sort_order INTEGER DEFAULT 0,
      auto INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_groups_order ON ai_chat_groups(sort_order)`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_threads_group ON ai_chat_threads(group_id)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_threads_source ON ai_chat_threads(source)`
  );

  seedGroups(db);

  let fts = false;
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE}
      USING fts5(thread_date UNINDEXED, content, tokenize='unicode61')
    `);
    fts = true;
  } catch {
    fts = false;
  }
  return { fts };
}

function seedGroups(db: Db): void {
  const defaults: Array<[string, string, string, number]> = [
    ['unsorted', 'Unsorted', 'zinc', 0],
    ['work', 'Work', 'amber', 1],
    ['learning', 'Learning', 'cyan', 2],
    ['creative', 'Creative', 'pink', 3],
    ['life', 'Life', 'emerald', 4],
    ['reference', 'Reference', 'violet', 5],
  ];
  const count = db.prepare('SELECT COUNT(*) AS n FROM ai_chat_groups').get() as any;
  if ((count?.n ?? 0) > 0) return;
  const ins = db.prepare(
    'INSERT OR IGNORE INTO ai_chat_groups (id, name, color, sort_order, auto) VALUES (?,?,?,?,1)'
  );
  for (const g of defaults) ins.run(...g);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transcriptHash(messages: IngestMessage[]): string {
  const norm = messages
    .map((m) => `${m.role}:${String(m.content || '').trim().replace(/\s+/g, ' ')}`)
    .join('\n');
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 20);
}

function threadDateFor(input: IngestInput, firstTs: number): string {
  if (input.externalId) return input.externalId;
  const d = new Date(firstTs);
  return `${d.toISOString().slice(0, 10)}-${input.source}-${crypto
    .randomBytes(3)
    .toString('hex')}`;
}

/**
 * Titles are derived from the first substantive user turn, not the first turn
 * overall — greetings produce "hi" as a title for every thread.
 */
function deriveAutoTitle(messages: IngestMessage[]): string | null {
  const noise = /^(hi|hey|hello|yo|test|testing|ok|okay|thanks|thank you|continue|go on|next)[.! ]*$/i;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const line = String(m.content || '')
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s.length > 0);
    if (!line) continue;
    if (noise.test(line)) continue;
    const cleaned = line.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim();
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
  }
  return null;
}

const GROUP_KEYWORDS: Record<string, RegExp> = {
  work: /\b(project|client|meeting|deadline|standup|sprint|deploy|bug|issue|stakeholder|roadmap|okr|kpi|contract|invoice|budget)\b/i,
  learning: /\b(learn|study|course|tutorial|lesson|explain|how does|why does|teach|learn\w*|practice|exam|concept|fundament\w*)\b/i,
  creative: /\b(write|draft|story|script|blog|essay|poem|character|plot|scene|narrative|hook|copy|content|episode|video|edit)\b/i,
  life: /\b(health|sleep|diet|workout|gym|habit|goal|feel|anx\w*|stress|family|friend|relation\w*|morning|routine)\b/i,
  reference: /\b(list|compare|vs|versus|checklist|reference|lookup|define|definition|cheat ?sheet|options)\b/i,
};

export function classifyGroup(text: string): string {
  let best = 'unsorted';
  let bestScore = 0;
  for (const [group, re] of Object.entries(GROUP_KEYWORDS)) {
    const hits = (text.match(new RegExp(re.source, 'gi')) || []).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = group;
    }
  }
  return bestScore > 0 ? best : 'unsorted';
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export interface IngestResult {
  threadDate: string;
  status: 'created' | 'updated' | 'duplicate' | 'empty';
  messageCount: number;
}

/**
 * Idempotent. Re-ingesting an unchanged conversation is a no-op, which is what
 * makes the extension's constant re-capture safe.
 */
export function ingestConversation(db: Db, input: IngestInput): IngestResult {
  const messages = (input.messages || []).filter(
    (m) => m && typeof m.content === 'string' && m.content.trim().length > 0
  );
  if (!messages.length) return { threadDate: '', status: 'empty', messageCount: 0 };

  const hash = transcriptHash(messages);
  const now = Date.now();
  const timestamps = messages.map((m) => m.timestamp || 0).filter(Boolean);
  const firstTs = timestamps.length ? Math.min(...timestamps) : now;
  const lastTs = timestamps.length ? Math.max(...timestamps) : now;
  const threadDate = threadDateFor(input, firstTs);

  const existing = db
    .prepare('SELECT thread_date, content_hash FROM ai_chat_threads WHERE thread_date = ?')
    .get(threadDate) as any;

  if (existing && existing.content_hash === hash) {
    db.prepare(
      'UPDATE ai_chat_threads SET last_message_at = ?, updated_at = ? WHERE thread_date = ?'
    ).run(lastTs, now, threadDate);
    return { threadDate, status: 'duplicate', messageCount: messages.length };
  }

  const autoTitle = deriveAutoTitle(messages);
  const previewSource = messages.find((m) => m.role === 'user') || messages[0];
  const preview = String(previewSource.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const searchBlob = messages.map((m) => m.content).join('\n').slice(0, 20000);
  const autoGroup = classifyGroup(`${input.title || ''} ${searchBlob.slice(0, 4000)}`);

  db.prepare(
    `INSERT INTO ai_chat_threads
       (thread_date, title, auto_title, message_count, last_message_at, preview,
        source, provider, url, content_hash, group_id, created_at, updated_at, last_accessed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(thread_date) DO UPDATE SET
       title = COALESCE(excluded.title, ai_chat_threads.title),
       auto_title = excluded.auto_title,
       message_count = excluded.message_count,
       last_message_at = excluded.last_message_at,
       preview = excluded.preview,
       source = excluded.source,
       provider = excluded.provider,
       url = COALESCE(excluded.url, ai_chat_threads.url),
       content_hash = excluded.content_hash,
       group_id = COALESCE(ai_chat_threads.group_id, excluded.group_id),
       updated_at = excluded.updated_at,
       last_accessed_at = excluded.last_accessed_at`
  ).run(
    threadDate,
    input.title || null,
    autoTitle,
    messages.length,
    lastTs,
    preview,
    input.source,
    input.provider || null,
    input.url || null,
    hash,
    autoGroup,
    now,
    now,
    now
  );

  db.prepare('DELETE FROM ai_chat_messages WHERE thread_date = ?').run(threadDate);
  const ins = db.prepare(
    'INSERT INTO ai_chat_messages (thread_date, role, content, parsed_json, created_at) VALUES (?,?,?,?,?)'
  );
  for (const m of messages) {
    ins.run(threadDate, m.role, m.content, null, m.timestamp || lastTs);
  }

  rebuildFtsForThread(db, threadDate, searchBlob);

  return {
    threadDate,
    status: existing ? 'updated' : 'created',
    messageCount: messages.length,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function rebuildFtsForThread(db: Db, threadDate: string, blob: string): void {
  try {
    db.prepare(`DELETE FROM ${FTS_TABLE} WHERE thread_date = ?`).run(threadDate);
    db.prepare(`INSERT INTO ${FTS_TABLE} (thread_date, content) VALUES (?,?)`).run(
      threadDate,
      blob
    );
  } catch {
    /* FTS unavailable — LIKE fallback covers it */
  }
}

function ftsQuery(raw: string): string {
  const terms = raw
    .replace(/["*]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!terms.length) return '';
  return terms.map((t) => `"${t}"*`).join(' AND ');
}

export interface SearchOptions {
  query?: string;
  groupId?: string | null;
  source?: string | null;
  limit?: number;
}

/**
 * Ranked search. When a query is present the ordering is relevance, not
 * recency — a pinned-then-recent ordering would bury the actual match.
 */
export function searchChats(db: Db, opts: SearchOptions = {}): SearchHit[] {
  const limit = Math.min(opts.limit ?? 60, 300);
  const query = (opts.query || '').trim();

  if (query) {
    try {
      const match = ftsQuery(query);
      if (match) {
        const rows = db
          .prepare(
            `SELECT f.thread_date AS threadDate, t.title, t.auto_title AS autoTitle,
                  t.source, t.provider, t.group_id AS groupId, t.pinned,
                  t.last_message_at AS lastMessageAt, t.message_count AS messageCount,
                  snippet(${FTS_TABLE}, 1, '', '', '…', 18) AS snippet,
                  bm25(${FTS_TABLE}) AS rank
             FROM ${FTS_TABLE} f
             JOIN ai_chat_threads t ON t.thread_date = f.thread_date
             WHERE ${FTS_TABLE} MATCH ?
             ORDER BY rank
             LIMIT ?`
          )
          .all(match, limit) as any[];
        if (rows.length) return rows;
      }
    } catch {
      /* fall through to LIKE */
    }

    const like = `%${query.replace(/[%_]/g, '')}%`;
    const rows = db
      .prepare(
        `SELECT t.thread_date AS threadDate, t.title, t.auto_title AS autoTitle,
                t.source, t.provider, t.group_id AS groupId, t.pinned,
                t.last_message_at AS lastMessageAt, t.message_count AS messageCount,
                (SELECT substr(m.content, 1, 160) FROM ai_chat_messages m
                  WHERE m.thread_date = t.thread_date AND m.content LIKE ? LIMIT 1) AS snippet,
                0 AS rank
         FROM ai_chat_threads t
         WHERE t.title LIKE ? OR t.preview LIKE ? OR t.auto_title LIKE ?
            OR EXISTS (SELECT 1 FROM ai_chat_messages m
                       WHERE m.thread_date = t.thread_date AND m.content LIKE ?)
         ORDER BY t.pinned DESC, t.last_message_at DESC
         LIMIT ?`
      )
      .all(like, like, like, like, like, limit) as any[];
    return rows;
  }

  const where: string[] = [];
  const params: any[] = [];
  if (opts.groupId) {
    where.push('group_id = ?');
    params.push(opts.groupId);
  }
  if (opts.source) {
    where.push('source = ?');
    params.push(opts.source);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT thread_date AS threadDate, title, auto_title AS autoTitle, source, provider,
              group_id AS groupId, pinned, last_message_at AS lastMessageAt,
              message_count AS messageCount, preview AS snippet, 0 AS rank
       FROM ai_chat_threads
       ${clause}
       ORDER BY pinned DESC, COALESCE(last_accessed_at, last_message_at, 0) DESC
       LIMIT ?`
    )
    .all(...params, limit) as any[];
  return rows;
}

// ---------------------------------------------------------------------------
// Groups + thread metadata
// ---------------------------------------------------------------------------

export function listGroups(db: Db): Array<GroupRow & { threadCount: number }> {
  return db
    .prepare(
      `SELECT g.id, g.name, g.color, g.sort_order AS sortOrder, g.auto,
              (SELECT COUNT(*) FROM ai_chat_threads t WHERE t.group_id = g.id) AS threadCount
       FROM ai_chat_groups g
       ORDER BY g.sort_order ASC, g.name ASC`
    )
    .all() as any[];
}

export function upsertGroup(
  db: Db,
  input: { id?: string; name: string; color?: string; sortOrder?: number }
): GroupRow {
  const id =
    input.id || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new Error('Group name is required');
  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM ai_chat_groups').get() as any;
  const order = input.sortOrder ?? ((maxOrder?.m ?? 0) + 1);
  db.prepare(
    `INSERT INTO ai_chat_groups (id, name, color, sort_order, auto)
     VALUES (?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`
  ).run(id, input.name.trim(), input.color || 'zinc', order);
  return db.prepare('SELECT * FROM ai_chat_groups WHERE id = ?').get(id) as any;
}

export function deleteGroup(db: Db, id: string): { ok: boolean } {
  if (id === 'unsorted') return { ok: false };
  db.prepare('DELETE FROM ai_chat_groups WHERE id = ?').run(id);
  db.prepare('UPDATE ai_chat_threads SET group_id = ? WHERE group_id = ?').run('unsorted', id);
  return { ok: true };
}

export function setThreadGroup(
  db: Db,
  threadDate: string,
  groupId: string | null
): { ok: boolean } {
  db.prepare('UPDATE ai_chat_threads SET group_id = ? WHERE thread_date = ?').run(
    groupId || 'unsorted',
    threadDate
  );
  return { ok: true };
}

export function setThreadPinned(
  db: Db,
  threadDate: string,
  pinned: boolean
): { ok: boolean } {
  db.prepare('UPDATE ai_chat_threads SET pinned = ? WHERE thread_date = ?').run(
    pinned ? 1 : 0,
    threadDate
  );
  return { ok: true };
}

export function touchThread(db: Db, threadDate: string): { ok: boolean } {
  db.prepare(
    'UPDATE ai_chat_threads SET last_accessed_at = ? WHERE thread_date = ?'
  ).run(Date.now(), threadDate);
  return { ok: true };
}

export function getThreadMessages(
  db: Db,
  threadDate: string
): Array<{ role: string; content: string; createdAt: number }> {
  touchThread(db, threadDate);
  return db
    .prepare(
      'SELECT role, content, created_at AS createdAt FROM ai_chat_messages WHERE thread_date = ? ORDER BY created_at ASC, id ASC'
    )
    .all(threadDate) as any[];
}

export function libraryStats(db: Db): {
  threads: number;
  messages: number;
  bySource: Record<string, number>;
  groups: number;
} {
  const t = db.prepare('SELECT COUNT(*) AS n FROM ai_chat_threads').get() as any;
  const m = db.prepare('SELECT COUNT(*) AS n FROM ai_chat_messages').get() as any;
  const g = db.prepare('SELECT COUNT(*) AS n FROM ai_chat_groups').get() as any;
  const rows = db
    .prepare('SELECT source, COUNT(*) AS n FROM ai_chat_threads GROUP BY source')
    .all() as any[];
  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = r.n;
  return { threads: t?.n ?? 0, messages: m?.n ?? 0, bySource, groups: g?.n ?? 0 };
}
