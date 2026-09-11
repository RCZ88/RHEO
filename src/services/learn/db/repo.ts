// Typed query layer for the Lyceum Learn module
// All SQL goes through here — services call repo functions, never raw SQL

import type Database from 'better-sqlite3';

export function runMigration(db: Database) {
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      db.exec(sql);
    } catch (e: any) {
      // Ignore "duplicate column name" errors from ALTER TABLE ADD COLUMN
      // (column already added in a previous run)
      if (e.message?.includes('duplicate column')) {
        console.warn(`[Learn] Migration ${file}: column already exists, skipping`);
        continue;
      }
      throw e;
    }
  }
}

// ── Lessons ──

export function upsertLesson(db: Database, lesson: {
  id: string; title: string; part: number; version: string;
  summary?: string; authored_by?: string; doc_json: string;
  status?: string; created_at: string; updated_at: string;
  chapter?: string; original_prompt?: string;
  branch_id?: string; subtopic?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO learn_lessons (id, title, part, version, summary, authored_by, doc_json, status, created_at, updated_at, chapter, original_prompt, branch_id, subtopic)
    VALUES (@id, @title, @part, @version, @summary, @authored_by, @doc_json, @status, @created_at, @updated_at, @chapter, @original_prompt, @branch_id, @subtopic)
    ON CONFLICT(id) DO UPDATE SET
      title = @title, part = @part, version = @version, summary = @summary,
      authored_by = @authored_by, doc_json = @doc_json, status = @status, updated_at = @updated_at,
      chapter = @chapter, original_prompt = @original_prompt,
      branch_id = @branch_id, subtopic = @subtopic
  `);
  stmt.run({
    id: lesson.id, title: lesson.title, part: lesson.part, version: lesson.version,
    summary: lesson.summary || null, authored_by: lesson.authored_by || null,
    doc_json: lesson.doc_json, status: lesson.status || 'draft',
    created_at: lesson.created_at, updated_at: lesson.updated_at,
    chapter: lesson.chapter || '', original_prompt: lesson.original_prompt || '',
    branch_id: lesson.branch_id || 'cs-ai', subtopic: lesson.subtopic || '',
  });
}

export interface LessonFilters {
  branchId?: string | null;
  part?: number | null;
  chapter?: string | null;
  subtopic?: string | null;
}

export function listLessons(db: Database, opts: LessonFilters = {}) {
  const branchId = opts.branchId != null ? opts.branchId : (opts.part != null ? null : 'cs-ai');
  const where: string[] = [];
  const params: any[] = [];
  if (branchId != null) { where.push('branch_id = ?'); params.push(branchId); }
  if (opts.part != null) { where.push('part = ?'); params.push(opts.part); }
  if (opts.chapter != null && opts.chapter !== '') { where.push('chapter = ?'); params.push(opts.chapter); }
  if (opts.subtopic != null && opts.subtopic !== '') { where.push('subtopic = ?'); params.push(opts.subtopic); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`SELECT id, title, part, version, status, chapter, subtopic, branch_id, original_prompt, created_at, updated_at FROM learn_lessons${whereSql} ORDER BY part ASC, created_at DESC`).all(...params);
}

export function listBranches(db: Database) {
  return db.prepare('SELECT id, emoji, title, description, color, ord FROM learn_branches ORDER BY ord ASC').all();
}

export function listGroups(db: Database, opts: LessonFilters = {}) {
  const branchId = opts.branchId != null ? opts.branchId : (opts.part != null ? null : 'cs-ai');
  const where: string[] = ["chapter != ''"];
  const params: any[] = [];
  if (branchId != null) { where.push('branch_id = ?'); params.push(branchId); }
  if (opts.part != null) { where.push('part = ?'); params.push(opts.part); }
  const whereSql = ` WHERE ${where.join(' AND ')}`;
  const orderSql = opts.part != null ? 'ORDER BY chapter' : 'ORDER BY part, chapter';
  return db.prepare(`SELECT DISTINCT chapter, part FROM learn_lessons${whereSql} ${orderSql}`).all(...params);
}

export function getLesson(db: Database, lessonId: string) {
  return db.prepare('SELECT * FROM learn_lessons WHERE id = ?').get(lessonId);
}

// ── Nodes ──

export function insertNode(db: Database, node: {
  id: string; lesson_id: string; title: string; mastery_target: string;
  content_hash: string; ord: number; blocks_json: string; grounding_json: string;
}) {
  db.prepare(`
    INSERT INTO learn_nodes (id, lesson_id, title, mastery_target, content_hash, ord, blocks_json, grounding_json)
    VALUES (@id, @lesson_id, @title, @mastery_target, @content_hash, @ord, @blocks_json, @grounding_json)
    ON CONFLICT(id) DO UPDATE SET
      lesson_id = @lesson_id, title = @title, mastery_target = @mastery_target,
      content_hash = @content_hash, ord = @ord, blocks_json = @blocks_json, grounding_json = @grounding_json
  `).run(node);
}

export function getNodesByLesson(db: Database, lessonId: string) {
  return db.prepare('SELECT * FROM learn_nodes WHERE lesson_id = ? ORDER BY ord ASC').all(lessonId);
}

export function getNode(db: Database, nodeId: string) {
  return db.prepare('SELECT * FROM learn_nodes WHERE id = ?').get(nodeId);
}

// ── Prereqs ──

export function insertPrereq(db: Database, nodeId: string, prereqId: string) {
  db.prepare('INSERT OR IGNORE INTO learn_node_prereqs (node_id, prereq_id) VALUES (?, ?)').run(nodeId, prereqId);
}

export function deletePrereqsForNode(db: Database, nodeId: string) {
  db.prepare('DELETE FROM learn_node_prereqs WHERE node_id = ?').run(nodeId);
}

// ── Sources ──

export function insertSource(db: Database, source: {
  id: string; node_id: string; url: string; title?: string;
  kind?: string; license?: string; retrieved?: string;
}) {
  db.prepare(`
    INSERT OR REPLACE INTO learn_sources (id, node_id, url, title, kind, license, retrieved)
    VALUES (@id, @node_id, @url, @title, @kind, @license, @retrieved)
  `).run(source);
}

// ── Chunks ──

export function deleteChunksForNode(db: Database, nodeId: string) {
  db.prepare('DELETE FROM learn_chunks WHERE node_id = ?').run(nodeId);
}

export function insertChunk(db: Database, chunk: {
  node_id: string; block_id?: string; kind: string; text: string; source_id?: string;
}) {
  const cols = ['node_id', 'kind', 'text'];
  const vals = ['@node_id', '@kind', '@text'];
  const params: Record<string, any> = { node_id: chunk.node_id, kind: chunk.kind, text: chunk.text };
  if (chunk.block_id != null) { cols.push('block_id'); vals.push('@block_id'); params.block_id = chunk.block_id; }
  if (chunk.source_id != null) { cols.push('source_id'); vals.push('@source_id'); params.source_id = chunk.source_id; }
  db.prepare(`INSERT INTO learn_chunks (${cols.join(', ')}) VALUES (${vals.join(', ')})`).run(params);
}

// ── Progress ──

export function getProgress(db: Database, nodeId: string) {
  return db.prepare('SELECT * FROM learn_progress WHERE node_id = ?').get(nodeId);
}

export function getAllProgress(db: Database) {
  return db.prepare('SELECT * FROM learn_progress').all();
}

export function upsertProgress(db: Database, data: {
  node_id: string; level: string; belief_json: string;
  stability: number; last_seen?: string; due_at?: string;
}) {
  db.prepare(`
    INSERT INTO learn_progress (node_id, level, belief_json, stability, last_seen, due_at)
    VALUES (@node_id, @level, @belief_json, @stability, @last_seen, @due_at)
    ON CONFLICT(node_id) DO UPDATE SET
      level = @level, belief_json = @belief_json, stability = @stability,
      last_seen = @last_seen, due_at = @due_at
  `).run(data);
}

// ── Evidence ──

export function insertEvidence(db: Database, evidence: {
  node_id: string; ts: string; source: string; target_level: string;
  outcome: string; detail_json?: string;
}) {
  return db.prepare(`
    INSERT INTO learn_evidence (node_id, ts, source, target_level, outcome, detail_json)
    VALUES (@node_id, @ts, @source, @target_level, @outcome, @detail_json)
  `).run(evidence);
}

export function getEvidenceForNode(db: Database, nodeId: string) {
  return db.prepare('SELECT * FROM learn_evidence WHERE node_id = ? ORDER BY ts DESC').all(nodeId);
}

// ── Tutor Cache ──

export function getTutorCache(db: Database, key: string) {
  return db.prepare('SELECT * FROM learn_tutor_cache WHERE key = ?').get(key);
}

export function setTutorCache(db: Database, data: {
  key: string; node_id: string; answer_json: string; model: string; created_at: string;
}) {
  db.prepare(`
    INSERT OR REPLACE INTO learn_tutor_cache (key, node_id, answer_json, model, created_at)
    VALUES (@key, @node_id, @answer_json, @model, @created_at)
  `).run(data);
}

// ── Graph (prereq DAG) ──

export function getGraph(db: Database, opts: LessonFilters = {}) {
  const branchId = opts.branchId != null ? opts.branchId : (opts.part != null ? null : 'cs-ai');
  const where: string[] = [];
  const params: any[] = [];
  if (branchId != null) { where.push('l.branch_id = ?'); params.push(branchId); }
  if (opts.part != null) { where.push('l.part = ?'); params.push(opts.part); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const nodes = params.length
    ? db.prepare(`SELECT n.id, n.title, n.mastery_target, l.part FROM learn_nodes n JOIN learn_lessons l ON n.lesson_id = l.id${whereSql}`).all(...params)
    : db.prepare(`SELECT n.id, n.title, n.mastery_target, l.part FROM learn_nodes n JOIN learn_lessons l ON n.lesson_id = l.id`).all();

  const edges = db.prepare(`
    SELECT np.node_id as "to", np.prereq_id as "from"
    FROM learn_node_prereqs np
    JOIN learn_nodes n ON np.node_id = n.id
    JOIN learn_lessons l ON n.lesson_id = l.id
    ${whereSql}
  `).all(...params);

  return { nodes, edges };
}

// ── Due reviews ──

export function getDueReviews(db: Database) {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT np.node_id as id, nn.title, nn.lesson_id, np.due_at
    FROM learn_progress np
    JOIN learn_nodes nn ON np.node_id = nn.id
    WHERE np.due_at IS NOT NULL AND np.due_at <= ?
    ORDER BY np.due_at ASC
  `).all(now);
}

// ── Learner Profile (key-value store, replaces localStorage) ──

export function getProfileValue(db: Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM learn_profile WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setProfileValue(db: Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO learn_profile (key, value) VALUES (?, ?)').run(key, value);
}

export function deleteProfileValue(db: Database, key: string): void {
  db.prepare('DELETE FROM learn_profile WHERE key = ?').run(key);
}

export function getAllProfileValues(db: Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM learn_profile').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ── Notes ──

export function insertNote(db: Database, note: {
  id: string; node_id: string; ts: string; text: string;
  tags?: string[]; pinned?: number; block_ref?: string;
}) {
  db.prepare(`
    INSERT INTO learn_notes (id, node_id, ts, text, tags_json, pinned, block_ref)
    VALUES (@id, @node_id, @ts, @text, @tags_json, @pinned, @block_ref)
  `).run({
    id: note.id, node_id: note.node_id, ts: note.ts, text: note.text,
    tags_json: note.tags ? JSON.stringify(note.tags) : null,
    pinned: note.pinned ?? 0, block_ref: note.block_ref ?? null,
  });
}

export function getNotesForNode(db: Database, nodeId: string) {
  return db.prepare('SELECT * FROM learn_notes WHERE node_id = ? ORDER BY ts DESC').all(nodeId);
}

export function getAllNotes(db: Database, limit = 20) {
  return db.prepare('SELECT * FROM learn_notes ORDER BY ts DESC LIMIT ?').all(limit);
}

export function deleteNote(db: Database, noteId: string) {
  db.prepare('DELETE FROM learn_notes WHERE id = ?').run(noteId);
}

export function toggleNotePin(db: Database, noteId: string, pinned: number) {
  db.prepare('UPDATE learn_notes SET pinned = ? WHERE id = ?').run(pinned, noteId);
}

// ── Actions (conversation messages) ──

export function insertAction(db: Database, action: {
  node_id: string; block_id?: string; role: string; ts: string;
  text: string; meta?: Record<string, unknown>;
}) {
  return db.prepare(`
    INSERT INTO learn_actions (node_id, block_id, role, ts, text, meta_json)
    VALUES (@node_id, @block_id, @role, @ts, @text, @meta_json)
  `).run({
    node_id: action.node_id, block_id: action.block_id ?? null,
    role: action.role, ts: action.ts, text: action.text,
    meta_json: action.meta ? JSON.stringify(action.meta) : null,
  });
}

export function getActionsForNode(db: Database, nodeId: string, limit = 50) {
  return db.prepare('SELECT * FROM learn_actions WHERE node_id = ? ORDER BY ts DESC LIMIT ?').all(nodeId, limit);
}

export function getActionsForBlock(db: Database, blockId: string) {
  return db.prepare('SELECT * FROM learn_actions WHERE block_id = ? ORDER BY ts ASC').all(blockId);
}

// ── Conversations ──

export function insertConversation(db: Database, conv: {
  id: string; node_id: string; block_id: string;
  status?: string; created_at: string; updated_at: string;
}) {
  db.prepare(`
    INSERT INTO learn_conversations (id, node_id, block_id, status, created_at, updated_at)
    VALUES (@id, @node_id, @block_id, @status, @created_at, @updated_at)
  `).run(conv);
}

export function getConversation(db: Database, convId: string) {
  return db.prepare('SELECT * FROM learn_conversations WHERE id = ?').get(convId);
}

export function getConversationsForNode(db: Database, nodeId: string) {
  return db.prepare('SELECT * FROM learn_conversations WHERE node_id = ? ORDER BY updated_at DESC').all(nodeId);
}

export function updateConversationStatus(db: Database, convId: string, status: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE learn_conversations SET status = ?, updated_at = ? WHERE id = ?').run(status, now, convId);
}

export function countActiveConversations(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM learn_conversations WHERE status = 'active'").get() as { cnt: number };
  return row.cnt;
}

// ── Permissions ──

export function getPermission(db: Database, key: string) {
  return db.prepare('SELECT * FROM learn_permissions WHERE key = ?').get(key);
}

export function getAllPermissions(db: Database) {
  return db.prepare('SELECT * FROM learn_permissions').all();
}

export function upsertPermission(db: Database, perm: {
  key: string; resource: string; grant: string; rationale?: string;
}) {
  db.prepare(`
    INSERT INTO learn_permissions (key, resource, grant, rationale)
    VALUES (@key, @resource, @grant, @rationale)
    ON CONFLICT(key) DO UPDATE SET grant = @grant, rationale = @rationale
  `).run(perm);
}

// ── Dashboard ──

export function getTotalTutorAnswers(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM learn_actions WHERE role = 'ai'").get() as { cnt: number };
  return row.cnt;
}

export function getTotalQuestions(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM learn_actions WHERE role = 'user'").get() as { cnt: number };
  return row.cnt;
}

export function getTopTutorNodes(db: Database, limit = 5) {
  return db.prepare(`
    SELECT a.node_id, n.title, COUNT(*) as count
    FROM learn_actions a
    JOIN learn_nodes n ON a.node_id = n.id
    WHERE a.role = 'user'
    GROUP BY a.node_id
    ORDER BY count DESC
    LIMIT ?
  `).all(limit);
}

export function countOpenProposals(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM learn_actions WHERE role = 'proposal' AND meta_json LIKE '%\"status\":\"pending\"%'").get() as { cnt: number };
  return row.cnt;
}
