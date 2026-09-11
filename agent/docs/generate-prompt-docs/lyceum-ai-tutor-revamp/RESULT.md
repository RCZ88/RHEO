# RESULT: Lyceum AI Tutor Overhaul

> **Status:** Ready for implementation
> **Scope:** Transform the Lyceum tutor from a single-turn text Q&A bot into an interactive, action-capable learning companion with structured block responses, an AI action vocabulary, confirmation workflow, permission settings, persistent multi-turn conversations, real streaming, and a dashboard learning section.
> **Source of truth:** `agent/docs/ai-tutor-revamp/CONTEXT_BUNDLE.md` (all line numbers below reference this file).
> **Design constraints:** No breaking changes to existing data, dark mode only, Tailwind v4 tokens, Framer Motion already available, no new npm deps unless explicitly required.

---

## 0. Design Principles

1. **Backward-compatibility first.** `TutorAnswer.answer_md` stays. Old calls still work. New `TutorResponse.blocks` is additive.
2. **Result<T> everywhere.** Every new IPC handler, service method, and DB write returns `{ ok, data } | { ok, error }` per `types.ts:71`.
3. **Prepared statements only.** No raw SQL strings in handler bodies — follow `repo.ts:1051-1083`.
4. **Sequential migrations.** `003_*` through `006_*` per `repo.ts:1025-1048` pattern.
5. **Re-skin every external component** to DeskFlow tokens before use (Section 20 of CONTEXT_BUNDLE.md).
6. **NDJSON streaming** — the AI emits one block per line as a JSON object. Main process parses line-by-line and forwards complete blocks. This avoids fragile partial-JSON parsing and lets the renderer render blocks progressively.
7. **Permission-aware execution.** Every AI-proposed action passes through `PermissionService.check(actionType)` before being applied. Modes: `auto | confirm | blocked`.
8. **Persistent conversations per node.** `learn_conversations` keyed by `node_id UNIQUE`. Messages store `blocks` as JSON.
9. **Streaming is opt-in per provider.** `ProviderTemplate.supportsStream` at `types.ts:1551` gates whether `callProviderStream()` is invoked. Non-streaming providers fall back to the existing `callProvider()` path, then emit a single chunk.

---

## Phase 1: Core Foundation — Types, DB, Services, IPC, System Prompt

### 1.1 Shared Type Extensions

**File:** `src/shared/learn/types.ts`

**Add the following types** (append after existing types; do not modify existing ones):

```typescript
// ─── Block-level tutor response types ───────────────────────────────

export type TutorBlockType =
  | 'explanation'
  | 'code_snippet'
  | 'diagram'
  | 'flashcard'
  | 'key_point'
  | 'analogy'
  | 'note_proposal'
  | 'edit_proposal'
  | 'insert_block_proposal'
  | 'exercise_proposal'
  | 'quiz_question'
  | 'comparison_table'
  | 'step_list'
  | 'resource_link'
  | 'exercise'
  | 'citation';

export interface BaseTutorBlock {
  id: string;            // unique within response, e.g. "blk_01"
  type: TutorBlockType;
}

export interface ExplanationBlock extends BaseTutorBlock {
  type: 'explanation';
  content: string;       // markdown-safe prose
  citationIds?: string[];// references to citations metadata
}

export interface CodeSnippetBlock extends BaseTutorBlock {
  type: 'code_snippet';
  language: string;
  code: string;
  filename?: string;
}

export interface DiagramBlock extends BaseTutorBlock {
  type: 'diagram';
  format: 'mermaid' | 'ascii';
  content: string;
  caption?: string;
}

export interface FlashcardBlock extends BaseTutorBlock {
  type: 'flashcard';
  front: string;
  back: string;
  hint?: string;
}

export interface KeyPointBlock extends BaseTutorBlock {
  type: 'key_point';
  points: string[];
  title?: string;
}

export interface AnalogyBlock extends BaseTutorBlock {
  type: 'analogy';
  comparison: string;   // e.g. "RAM vs Desk"
  mapping: { from: string; to: string }[];
}

export interface NoteProposalBlock extends BaseTutorBlock {
  type: 'note_proposal';
  title: string;
  content: string;       // markdown body
  nodeId: string;
  blockId?: string;
  rationale?: string;
}

export interface EditProposalBlock extends BaseTutorBlock {
  type: 'edit_proposal';
  nodeId: string;
  blockId: string;
  originalText: string;
  replacementText: string;
  rationale: string;
}

export interface InsertBlockProposalBlock extends BaseTutorBlock {
  type: 'insert_block_proposal';
  nodeId: string;
  afterBlockId: string;
  newBlock: LessonBlock;  // reuse types.ts:102-112
  rationale: string;
}

export interface ExerciseProposalBlock extends BaseTutorBlock {
  type: 'exercise_proposal';
  topic: string;
  difficulty: 'L0' | 'L1' | 'L2' | 'L3';
  prompt: string;
  starterCode?: string;
  expectedOutput?: string;
}

export interface QuizQuestionBlock extends BaseTutorBlock {
  type: 'quiz_question';
  prompt: string;
  format: 'mcq' | 'numeric' | 'open';
  options?: string[];
  answerKey: number | string;
  explanation: string;
}

export interface ComparisonTableBlock extends BaseTutorBlock {
  type: 'comparison_table';
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface StepListBlock extends BaseTutorBlock {
  type: 'step_list';
  title?: string;
  steps: { label: string; detail: string }[];
}

export interface ResourceLinkBlock extends BaseTutorBlock {
  type: 'resource_link';
  url: string;
  title: string;
  description?: string;
}

export interface ExerciseBlock extends BaseTutorBlock {
  type: 'exercise';
  prompt: string;
  hint?: string;
  solution?: string;
}

export interface CitationBlock extends BaseTutorBlock {
  type: 'citation';
  citationIds: string[];
}

export type TutorBlock =
  | ExplanationBlock
  | CodeSnippetBlock
  | DiagramBlock
  | FlashcardBlock
  | KeyPointBlock
  | AnalogyBlock
  | NoteProposalBlock
  | EditProposalBlock
  | InsertBlockProposalBlock
  | ExerciseProposalBlock
  | QuizQuestionBlock
  | ComparisonTableBlock
  | StepListBlock
  | ResourceLinkBlock
  | ExerciseBlock
  | CitationBlock;

// ─── Tutor response (new primary shape) ─────────────────────────────

export interface TutorResponse {
  blocks: TutorBlock[];
  answer_md: string;             // derived fallback for backward compat
  used_source_ids: string[];
  used_fact_ids: string[];
  citations: Citation[];
  scope: string;
  assessment: TutorAnswer['assessment'];
  escalated: boolean;
  confidence: number;
  suggestions: string[];         // 2-3 follow-up question chips
}

// ─── Conversation persistence ───────────────────────────────────────

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  blocks: TutorBlock[];
  metadata: {
    confidence?: number;
    citations?: Citation[];
    assessment?: TutorAnswer['assessment'];
    escalated?: boolean;
  };
  createdAt: string;
}

export interface Conversation {
  id: string;
  nodeId: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

// ─── Pending action workflow ────────────────────────────────────────

export type ActionType =
  | 'create_note'
  | 'edit_content'
  | 'insert_block'
  | 'suggest_exercise';

export interface PendingAction {
  id: string;
  lessonId: string;
  actionType: ActionType;
  payload: NoteProposalBlock | EditProposalBlock | InsertBlockProposalBlock | ExerciseProposalBlock;
  status: 'pending' | 'approved' | 'rejected';
  rationale: string | null;
  createdAt: string;
  resolvedAt: string | null;
  rejectionReason?: string | null;
}

// ─── Notes ──────────────────────────────────────────────────────────

export interface Note {
  id: string;
  lessonId: string;
  nodeId: string | null;
  blockId: string | null;
  title: string | null;
  content: string;
  source: 'user' | 'ai' | 'ai_pending';
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  createdAt: string;
  updatedAt: string | null;
}

// ─── Permission settings ────────────────────────────────────────────

export type PermissionMode = 'auto' | 'confirm' | 'blocked';

export interface PermissionSettings {
  create_note: PermissionMode;
  edit_content: PermissionMode;
  insert_block: PermissionMode;
  suggest_exercise: PermissionMode;
}

export const DEFAULT_PERMISSION_SETTINGS: PermissionSettings = {
  create_note: 'confirm',
  edit_content: 'confirm',
  insert_block: 'confirm',
  suggest_exercise: 'auto',
};

// ─── Notes ──────────────────────────────────────────────────────────

export interface LearnDashboardStats {
  streak: number;
  streakLastActive: string | null;       // ISO date
  totalMastery: number;                   // 0-100 weighted average
  masteryByPart: { part: number; title: string; mastery: number }[];
  recentLessons: {
    lessonId: string;
    title: string;
    progress: number;
    lastAccessedAt: string;
  }[];
  dueReviews: {
    nodeId: string;
    lessonId: string;
    lessonTitle: string;
    nodeTitle: string;
    dueReview: string;
  }[];
  lastLessonId: string | null;
  lastNodeId: string | null;
  totalNotes: number;
  totalConversations: number;
}

// ─── Streaming chunk type ───────────────────────────────────────────

export interface TutorStreamChunk {
  streamId: string;
  type: 'block' | 'metadata' | 'done' | 'error';
  block?: TutorBlock;
  metadata?: Partial<TutorResponse>;
  error?: string;
}
```

**Verification:** TypeScript build passes; existing imports of `TutorAnswer` continue to work; new types importable in renderer and main process.

---

### 1.2 Database Migrations

Follow the runner pattern at `repo.ts:1025-1048`. New files in `src/services/learn/db/migrations/`.

#### File: `src/services/learn/db/migrations/003_learn_notes.sql`

```sql
CREATE TABLE IF NOT EXISTS learn_notes (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  node_id TEXT,
  block_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES lesson_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_learn_notes_lesson ON learn_notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_learn_notes_node ON learn_notes(node_id);
CREATE INDEX IF NOT EXISTS idx_learn_notes_source ON learn_notes(source);
```

#### File: `src/services/learn/db/migrations/004_learn_actions.sql`

```sql
CREATE TABLE IF NOT EXISTS learn_pending_actions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rationale TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_lesson ON learn_pending_actions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON learn_pending_actions(status);
```

#### File: `src/services/learn/db/migrations/005_learn_conversations.sql`

```sql
CREATE TABLE IF NOT EXISTS learn_conversations (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL UNIQUE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES lesson_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learn_conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  blocks TEXT NOT NULL,        -- JSON array of TutorBlock
  metadata TEXT,               -- JSON object
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES learn_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON learn_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON learn_conversation_messages(created_at);
```

#### File: `src/services/learn/db/migrations/006_learn_permissions.sql`

```sql
CREATE TABLE IF NOT EXISTS learn_permission_settings (
  action_type TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'confirm',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO learn_permission_settings (action_type, mode, updated_at) VALUES
  ('create_note',     'confirm', datetime('now')),
  ('edit_content',    'confirm', datetime('now')),
  ('insert_block',    'confirm', datetime('now')),
  ('suggest_exercise','auto',    datetime('now'));
```

**Verification:** After `runMigration(db)`, `SELECT name FROM _migrations` returns `003_learn_notes.sql`, `004_learn_actions.sql`, `005_learn_conversations.sql`, `006_learn_permissions.sql`. Each table exists via `SELECT * FROM <table> LIMIT 1`.

---

### 1.3 Repository Layer — `src/services/learn/db/repo.ts`

Append new prepared-statement functions following the existing pattern at `repo.ts:1051-1083`:

```typescript
// ─── Notes ──────────────────────────────────────────────────────────
export function insertNote(db: Database, n: Note): void {
  db.prepare(`INSERT INTO learn_notes
    (id, lesson_id, node_id, block_id, title, content, source, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    n.id, n.lessonId, n.nodeId, n.blockId, n.title, n.content,
    n.source, n.color, n.createdAt, n.updatedAt,
  );
}

export function listNotes(db: Database, lessonId?: string, nodeId?: string): Note[] {
  if (nodeId) {
    return db.prepare(`SELECT * FROM learn_notes WHERE node_id = ? ORDER BY created_at DESC`).all(nodeId) as Note[];
  }
  if (lessonId) {
    return db.prepare(`SELECT * FROM learn_notes WHERE lesson_id = ? ORDER BY created_at DESC`).all(lessonId) as Note[];
  }
  return db.prepare(`SELECT * FROM learn_notes ORDER BY created_at DESC`).all() as Note[];
}

export function deleteNote(db: Database, id: string): void {
  db.prepare(`DELETE FROM learn_notes WHERE id = ?`).run(id);
}

export function countNotes(db: Database): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM learn_notes`).get() as any).c;
}

// ─── Pending Actions ────────────────────────────────────────────────
export function insertPendingAction(db: Database, a: PendingAction): void {
  db.prepare(`INSERT INTO learn_pending_actions
    (id, lesson_id, action_type, payload, status, rationale, rejection_reason, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    a.id, a.lessonId, a.actionType, JSON.stringify(a.payload),
    a.status, a.rationale, a.rejectionReason ?? null, a.createdAt, a.resolvedAt,
  );
}

export function listPendingActions(db: Database, lessonId?: string): PendingAction[] {
  const rows = lessonId
    ? db.prepare(`SELECT * FROM learn_pending_actions WHERE lesson_id = ? AND status = 'pending' ORDER BY created_at ASC`).all(lessonId)
    : db.prepare(`SELECT * FROM learn_pending_actions WHERE status = 'pending' ORDER BY created_at ASC`).all();
  return rows.map((r: any) => ({
    id: r.id, lessonId: r.lesson_id, actionType: r.action_type,
    payload: JSON.parse(r.payload), status: r.status, rationale: r.rationale,
    rejectionReason: r.rejection_reason, createdAt: r.created_at, resolvedAt: r.resolved_at,
  }));
}

export function resolvePendingAction(db: Database, id: string, status: 'approved' | 'rejected', rejectionReason?: string): void {
  db.prepare(`UPDATE learn_pending_actions SET status = ?, rejection_reason = ?, resolved_at = ? WHERE id = ?`)
    .run(status, rejectionReason ?? null, new Date().toISOString(), id);
}

// ─── Conversations ──────────────────────────────────────────────────
export function getConversationByNode(db: Database, nodeId: string): any | null {
  return db.prepare(`SELECT * FROM learn_conversations WHERE node_id = ?`).get(nodeId) || null;
}

export function createConversation(db: Database, c: { id: string; nodeId: string; title?: string; createdAt: string; updatedAt: string }): void {
  db.prepare(`INSERT INTO learn_conversations (id, node_id, title, message_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`)
    .run(c.id, c.nodeId, c.title ?? null, c.createdAt, c.updatedAt);
}

export function addMessage(db: Database, msg: ConversationMessage): void {
  const txn = db.transaction(() => {
    db.prepare(`INSERT INTO learn_conversation_messages
      (id, conversation_id, role, blocks, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      msg.id, msg.conversationId, msg.role,
      JSON.stringify(msg.blocks), JSON.stringify(msg.metadata ?? {}),
      msg.createdAt,
    );
    db.prepare(`UPDATE learn_conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?`)
      .run(msg.createdAt, msg.conversationId);
  });
  txn();
}

export function listMessages(db: Database, conversationId: string): ConversationMessage[] {
  const rows = db.prepare(`SELECT * FROM learn_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(conversationId) as any[];
  return rows.map(r => ({
    id: r.id, conversationId: r.conversation_id, role: r.role,
    blocks: JSON.parse(r.blocks), metadata: JSON.parse(r.metadata || '{}'),
    createdAt: r.created_at,
  }));
}

export function countConversations(db: Database): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM learn_conversations`).get() as any).c;
}

// ─── Permission Settings ────────────────────────────────────────────
export function getPermissionSettings(db: Database): PermissionSettings {
  const rows = db.prepare(`SELECT action_type, mode FROM learn_permission_settings`).all() as any[];
  const settings = { ...DEFAULT_PERMISSION_SETTINGS };
  for (const r of rows) (settings as any)[r.action_type] = r.mode;
  return settings;
}

export function setPermissionMode(db: Database, actionType: string, mode: PermissionMode): void {
  db.prepare(`INSERT INTO learn_permission_settings (action_type, mode, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(action_type) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at`)
    .run(actionType, mode, new Date().toISOString());
}
```

---

### 1.4 Service Layer — New Service Classes

#### File: `src/services/learn/services/note.service.ts` (new)

```typescript
import type Database from 'better-sqlite3';
import * as repo from '../db/repo';
import type { Note, Result, NoteProposalBlock } from '../../shared/learn/types';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export class NoteService {
  constructor(private db: Database) {}

  saveNote(params: {
    lessonId: string; nodeId?: string; blockId?: string;
    title?: string; content: string;
    source?: 'user' | 'ai' | 'ai_pending';
    color?: Note['color'];
  }): Result<Note> {
    try {
      const note: Note = {
        id: generateId('note'),
        lessonId: params.lessonId,
        nodeId: params.nodeId ?? null,
        blockId: params.blockId ?? null,
        title: params.title ?? null,
        content: params.content,
        source: params.source ?? 'user',
        color: params.color ?? 'yellow',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      repo.insertNote(this.db, note);
      return { ok: true, data: note };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  listNotes(lessonId?: string, nodeId?: string): Result<Note[]> {
    try { return { ok: true, data: repo.listNotes(this.db, lessonId, nodeId) }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }

  deleteNote(noteId: string): Result<void> {
    try { repo.deleteNote(this.db, noteId); return { ok: true, data: undefined }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }

  createFromProposal(proposal: NoteProposalBlock, lessonId: string): Result<Note> {
    return this.saveNote({
      lessonId,
      nodeId: proposal.nodeId,
      blockId: proposal.blockId,
      title: proposal.title,
      content: proposal.content,
      source: 'ai',
    });
  }
}
```

#### File: `src/services/learn/services/conversation.service.ts` (new)

```typescript
import type Database from 'better-sqlite3';
import * as repo from '../db/repo';
import type { Conversation, ConversationMessage, Result, TutorBlock } from '../../shared/learn/types';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export class ConversationService {
  constructor(private db: Database) {}

  getOrCreateConversation(nodeId: string, title?: string): Result<Conversation> {
    try {
      const existing = repo.getConversationByNode(this.db, nodeId);
      if (existing) {
        const messages = repo.listMessages(this.db, existing.id);
        return { ok: true, data: {
          id: existing.id, nodeId: existing.node_id, title: existing.title,
          messageCount: existing.message_count, createdAt: existing.created_at,
          updatedAt: existing.updated_at, messages,
        } };
      }
      const now = new Date().toISOString();
      const id = generateId('conv');
      repo.createConversation(this.db, { id, nodeId, title, createdAt: now, updatedAt: now });
      return { ok: true, data: {
        id, nodeId, title: title ?? null, messageCount: 0,
        createdAt: now, updatedAt: now, messages: [],
      } };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  addMessage(params: {
    conversationId: string; role: 'user' | 'assistant' | 'system';
    blocks: TutorBlock[]; metadata?: ConversationMessage['metadata'];
  }): Result<ConversationMessage> {
    try {
      const msg: ConversationMessage = {
        id: generateId('msg'),
        conversationId: params.conversationId,
        role: params.role,
        blocks: params.blocks,
        metadata: params.metadata ?? {},
        createdAt: new Date().toISOString(),
      };
      repo.addMessage(this.db, msg);
      return { ok: true, data: msg };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  getConversation(nodeId: string): Result<Conversation | null> {
    try {
      const conv = repo.getConversationByNode(this.db, nodeId);
      if (!conv) return { ok: true, data: null };
      const messages = repo.listMessages(this.db, conv.id);
      return { ok: true, data: {
        id: conv.id, nodeId: conv.node_id, title: conv.title,
        messageCount: conv.message_count, createdAt: conv.created_at,
        updatedAt: conv.updated_at, messages,
      } };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }
}
```

#### File: `src/services/learn/services/permission.service.ts` (new)

```typescript
import type Database from 'better-sqlite3';
import * as repo from '../db/repo';
import type { PermissionSettings, PermissionMode, ActionType, Result } from '../../shared/learn/types';

export class PermissionService {
  constructor(private db: Database) {}

  getSettings(): Result<PermissionSettings> {
    try { return { ok: true, data: repo.getPermissionSettings(this.db) }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }

  setMode(actionType: ActionType, mode: PermissionMode): Result<void> {
    try { repo.setPermissionMode(this.db, actionType, mode); return { ok: true, data: undefined }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }

  reset(): Result<void> {
    try {
      for (const [k, v] of Object.entries(DEFAULT_PERMISSION_SETTINGS)) {
        repo.setPermissionMode(this.db, k as ActionType, v as PermissionMode);
      }
      return { ok: true, data: undefined };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  /** Returns 'auto' | 'confirm' | 'blocked'. Used by TutorService before applying AI-proposed actions. */
  check(actionType: ActionType): PermissionMode {
    const { ok, data } = this.getSettings();
    if (!ok || !data) return 'confirm';
    return data[actionType];
  }
}
```

> **Note:** Import `DEFAULT_PERMISSION_SETTINGS` from `../../shared/learn/types`.

#### File: `src/services/learn/services/dashboard.service.ts` (new)

```typescript
import type Database from 'better-sqlite3';
import * as repo from '../db/repo';
import type { LearnDashboardStats, Result, MasteryLevel } from '../../shared/learn/types';

const MASTERY_WEIGHT: Record<MasteryLevel, number> = { L0: 0, L1: 33, L2: 66, L3: 100 };

export class LearnDashboardService {
  constructor(private db: Database) {}

  getStats(): Result<LearnDashboardStats> {
    try {
      // Streak: count consecutive days with at least one evidence or conversation message
      const days = this.db.prepare(`
        SELECT DISTINCT substr(created_at, 1, 10) AS day FROM (
          SELECT created_at FROM evidence
          UNION ALL
          SELECT m.created_at FROM learn_conversation_messages m
        ) ORDER BY day DESC LIMIT 365
      `).all() as { day: string }[];

      const today = new Date().toISOString().slice(0, 10);
      let streak = 0;
      let cursor = new Date(today);
      for (const d of days) {
        const dayStr = cursor.toISOString().slice(0, 10);
        if (d.day === dayStr) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else if (d.day < dayStr) break;
      }

      // Mastery across all nodes
      const progress = this.db.prepare(`SELECT node_id, level FROM mastery_progress`).all() as any[];
      const totalMastery = progress.length
        ? Math.round(progress.reduce((s, p) => s + (MASTERY_WEIGHT[p.level as MasteryLevel] ?? 0), 0) / progress.length)
        : 0;

      // Recent lessons (by node last_practiced)
      const recent = this.db.prepare(`
        SELECT l.id AS lesson_id, l.title, l.part, mp.last_practiced, mp.level
        FROM mastery_progress mp
        JOIN lesson_nodes n ON n.id = mp.node_id
        JOIN lessons l ON l.id = n.lesson_id
        WHERE mp.last_practiced IS NOT NULL
        ORDER BY mp.last_practiced DESC LIMIT 3
      `).all() as any[];

      const recentSet = new Map<string, { lessonId: string; title: string; progress: number; lastAccessedAt: string }>();
      for (const r of recent) {
        if (recentSet.has(r.lesson_id)) continue;
        recentSet.set(r.lesson_id, {
          lessonId: r.lesson_id, title: r.title,
          progress: MASTERY_WEIGHT[r.level as MasteryLevel] ?? 0,
          lastAccessedAt: r.last_practiced,
        });
      }

      // Due reviews
      const due = this.db.prepare(`
        SELECT n.id AS node_id, n.title AS node_title, l.id AS lesson_id, l.title AS lesson_title, mp.due_review
        FROM mastery_progress mp
        JOIN lesson_nodes n ON n.id = mp.node_id
        JOIN lessons l ON l.id = n.lesson_id
        WHERE mp.due_review IS NOT NULL AND datetime(mp.due_review) <= datetime('now')
        ORDER BY mp.due_review ASC LIMIT 5
      `).all() as any[];

      const lastLesson = recent[0]?.lesson_id ?? null;
      const lastNode = recent[0] ? (this.db.prepare(`SELECT id FROM lesson_nodes WHERE lesson_id = ? ORDER BY sort_order ASC LIMIT 1`).get(recent[0].lesson_id) as any)?.id : null;

      const stats: LearnDashboardStats = {
        streak,
        streakLastActive: days[0]?.day ?? null,
        totalMastery,
        masteryByPart: [],   // computed below if needed
        recentLessons: Array.from(recentSet.values()),
        dueReviews: due.map(d => ({
          nodeId: d.node_id, lessonId: d.lesson_id,
          lessonTitle: d.lesson_title, nodeTitle: d.node_title,
          dueReview: d.due_review,
        })),
        lastLessonId: lastLesson,
        lastNodeId: lastNode,
        totalNotes: repo.countNotes(this.db),
        totalConversations: repo.countConversations(this.db),
      };
      return { ok: true, data: stats };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }
}
```

---

### 1.5 TutorService — `askV2()` and Streaming

**File:** `src/services/learn/services/tutor.service.ts`

**Modify** the constructor to accept two new dependencies: `PermissionService` and `ConversationService`. **Add** an `askV2()` method that returns `TutorResponse`. **Add** an `askStream()` method that emits chunks via a callback.

```typescript
// Top of file — new system prompt (replaces TUTOR_SYSTEM_PROMPT):
const TUTOR_SYSTEM_PROMPT_V2 = `You are a tutor for ONE concept inside DeskFlow Lyceum Learn.
Answer ONLY using the FACTS provided. Cite fact ids inline like [f1] and source ids like [s2].

You MUST respond with a single JSON object (no markdown fences) of shape:
{
  "blocks": [ <block>, <block>, ... ],
  "used_source_ids": string[],
  "used_fact_ids": string[],
  "suggestions": string[]
}

Block types and shapes (emit only the fields shown for each type):
- { "type": "explanation", "id": "blk_1", "content": "markdown prose...", "citationIds": ["f1"] }
- { "type": "code_snippet", "id": "blk_2", "language": "python", "code": "...", "filename": "example.py" }
- { "type": "diagram", "id": "blk_3", "format": "mermaid", "content": "graph TD; A-->B", "caption": "..." }
- { "type": "flashcard", "id": "blk_4", "front": "What is X?", "back": "X is ...", "hint": "..." }
- { "type": "key_point", "id": "blk_5", "points": ["...", "..."], "title": "Key takeaways" }
- { "type": "analogy", "id": "blk_6", "comparison": "RAM vs Desk", "mapping": [{"from":"RAM","to":"Desk"}] }
- { "type": "note_proposal", "id": "blk_7", "title": "Note title", "content": "markdown...", "nodeId": "<provided>", "blockId": "<optional>", "rationale": "why this note helps" }
- { "type": "edit_proposal", "id": "blk_8", "nodeId": "<provided>", "blockId": "<target>", "originalText": "...", "replacementText": "...", "rationale": "why the edit improves clarity" }
- { "type": "insert_block_proposal", "id": "blk_9", "nodeId": "<provided>", "afterBlockId": "<target>", "newBlock": {LessonBlock shape}, "rationale": "..." }
- { "type": "exercise_proposal", "id": "blk_10", "topic": "...", "difficulty": "L2", "prompt": "...", "starterCode": "..." }
- { "type": "quiz_question", "id": "blk_11", "prompt": "...", "format": "mcq", "options": ["a","b","c"], "answerKey": 1, "explanation": "..." }
- { "type": "comparison_table", "id": "blk_12", "title": "...", "columns": ["A","B"], "rows": [["...","..."]] }
- { "type": "step_list", "id": "blk_13", "title": "...", "steps": [{"label":"Step 1","detail":"..."}] }
- { "type": "resource_link", "id": "blk_14", "url": "https://...", "title": "...", "description": "..." }
- { "type": "exercise", "id": "blk_15", "prompt": "...", "hint": "...", "solution": "..." }
- { "type": "citation", "id": "blk_16", "citationIds": ["f1","f2"] }

Rules:
1. Always start with at least one "explanation" block.
2. Use richer block types (diagram, flashcard, key_point, analogy, step_list, comparison_table) when they communicate the idea more clearly than prose.
3. Propose a "note_proposal" block when the user's question implies a reusable insight tied to this node. Only one note_proposal per response.
4. Propose an "edit_proposal" ONLY when the user identifies a problem with the lesson text and you can clearly improve it.
5. End with 2-3 "suggestions" — concrete follow-up questions the learner could ask next.
6. Never invent fact ids or source ids — only reference ids present in the FACTS section.
7. Each block must have a unique "id" like "blk_1", "blk_2", etc.

The user message will include the current nodeId. Use it verbatim when emitting note_proposal, edit_proposal, insert_block_proposal blocks.`;
```

**Add the `askV2` method** to the `TutorService` class:

```typescript
async askV2(params: {
  nodeId: string; blockId?: string; question: string;
  conversationId?: string;
}): Promise<Result<TutorResponse>> {
  try {
    // 1. Cache check (same hashKey as ask())
    const cacheKey = this.hashKey(params.nodeId, params.question);
    const cached = repo.getTutorCache(this.db, cacheKey);
    if (cached) {
      const c = cached as any;
      const parsed = JSON.parse(c.answer_json);
      if (parsed.blocks) return { ok: true, data: parsed };
    }

    // 2. Grounding
    const { packet, retrieval_score, out_of_scope } = this.grounding.retrieve(params.nodeId, params.question);
    if (out_of_scope || retrieval_score < 0.35) {
      const response: TutorResponse = {
        blocks: [{
          id: 'blk_1', type: 'explanation',
          content: `That question is outside the scope of this section. This node covers: **${packet.scope.includes}**.`,
        }],
        answer_md: `That question is outside the scope of this section.`,
        used_source_ids: [], used_fact_ids: [], citations: [],
        scope: packet.scope.includes,
        assessment: { target_level: 'L0', outcome: 'partial', rationale: 'Out of scope', suggested_next: 'reinforce' },
        escalated: true, confidence: 0, suggestions: [],
      };
      return { ok: true, data: response };
    }

    // 3. Build prompt
    const factsText = packet.must_know.map((f, i) => `[f${i+1}] ${f.claim}`).join('\n');
    const misconceptionsText = packet.misconceptions.map(m => `⚠️ Wrong: ${m.wrong} → Correct: ${m.correct}`).join('\n');
    const sourcesText = packet.sources.map(s => `[s${s.id}] ${s.title}: ${s.url}`).join('\n');
    const userPrompt = `CURRENT_NODE_ID: ${params.nodeId}\n${params.blockId ? `CURRENT_BLOCK_ID: ${params.blockId}\n` : ''}\nFACTS:\n${factsText}\n\nMISCONCEPTIONS:\n${misconceptionsText}\n\nSOURCES:\n${sourcesText}\n\nQUESTION: ${params.question}`;

    // 4. Call AI (uses existing callAi wrapper)
    const raw = await this.callAi(userPrompt, this.systemPromptV2, 2000);
    const parsed = this.parseTutorResponse(raw, params.nodeId, params.blockId);

    // 5. Self-check + assessment (reuse existing patterns from ask())
    // 6. Cache
    repo.setTutorCache(this.db, {
      key: cacheKey, node_id: params.nodeId,
      answer_json: JSON.stringify(parsed),
      model: 'small', created_at: new Date().toISOString(),
    });

    // 7. Persist to conversation if conversationId provided
    if (params.conversationId) {
      this.conversation.addMessage({
        conversationId: params.conversationId, role: 'assistant',
        blocks: parsed.blocks, metadata: {
          confidence: parsed.confidence, citations: parsed.citations,
          assessment: parsed.assessment, escalated: parsed.escalated,
        },
      });
    }

    return { ok: true, data: parsed };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

private parseTutorResponse(raw: string, nodeId: string, blockId?: string): TutorResponse {
  // Sanitize (reuse extractJsonObject pattern from index.ts:12-18)
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = s.indexOf('{'); const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);

  const obj = JSON.parse(s);
  const blocks: TutorBlock[] = Array.isArray(obj.blocks) ? obj.blocks : [];

  // Backfill nodeId / blockId on proposals if AI omitted them
  for (const b of blocks) {
    if (b.type === 'note_proposal' || b.type === 'edit_proposal' || b.type === 'insert_block_proposal') {
      if (!b.nodeId) (b as any).nodeId = nodeId;
      if (blockId && !b.blockId && b.type !== 'insert_block_proposal') (b as any).blockId = blockId;
    }
  }

  // Derive answer_md for backward compat
  const answer_md = blocks
    .filter(b => b.type === 'explanation' || b.type === 'key_point' || b.type === 'analogy' || b.type === 'step_list')
    .map(b => {
      if (b.type === 'explanation') return b.content;
      if (b.type === 'key_point') return (b.title ? `**${b.title}**\n` : '') + b.points.map(p => `- ${p}`).join('\n');
      if (b.type === 'analogy') return `**${b.comparison}**: ` + b.mapping.map(m => `${m.from} → ${m.to}`).join(', ');
      if (b.type === 'step_list') return (b.title ? `**${b.title}**\n` : '') + b.steps.map((s, i) => `${i+1}. ${s.label}: ${s.detail}`).join('\n');
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  return {
    blocks,
    answer_md,
    used_source_ids: obj.used_source_ids ?? [],
    used_fact_ids: obj.used_fact_ids ?? [],
    citations: [], // populated from packet.sources
    scope: '',
    assessment: obj.assessment ?? { target_level: 'L1', outcome: 'partial', rationale: '', suggested_next: 'reinforce' },
    escalated: false,
    confidence: obj.confidence ?? 0.7,
    suggestions: Array.isArray(obj.suggestions) ? obj.suggestions.slice(0, 3) : [],
  };
}
```

**Add the streaming method** (uses the streaming callAi wrapper):

```typescript
async askStream(params: {
  nodeId: string; blockId?: string; question: string;
  conversationId?: string;
  onChunk: (chunk: TutorStreamChunk) => void;
  signal?: AbortSignal;
}): Promise<void> {
  try {
    const { packet, retrieval_score, out_of_scope } = this.grounding.retrieve(params.nodeId, params.question);

    if (out_of_scope || retrieval_score < 0.35) {
      const block: TutorBlock = { id: 'blk_1', type: 'explanation',
        content: `That question is outside the scope of this section.` };
      onChunk({ streamId: '', type: 'block', block });
      onChunk({ streamId: '', type: 'done', metadata: { escalated: true, confidence: 0 } });
      return;
    }

    const factsText = packet.must_know.map((f, i) => `[f${i+1}] ${f.claim}`).join('\n');
    const sourcesText = packet.sources.map(s => `[s${s.id}] ${s.title}: ${s.url}`).join('\n');
    const userPrompt = `CURRENT_NODE_ID: ${params.nodeId}\nFACTS:\n${factsText}\n\nSOURCES:\n${sourcesText}\n\nQUESTION: ${params.question}`;

    // callAiStream yields partial strings (NDJSON fragments)
    let buffer = '';
    await this.callAiStream(userPrompt, this.systemPromptV2, 2000, async (delta: string) => {
      if (params.signal?.aborted) throw new Error('aborted');
      buffer += delta;
      // Try to extract complete JSON object blocks via brace-matching
      // For simplicity, we wait for the full JSON and parse at the end.
      // (For true block-level streaming, see Phase 3 streaming section.)
    }, params.signal);

    // Final parse
    const parsed = this.parseTutorResponse(buffer, params.nodeId, params.blockId);
    for (const block of parsed.blocks) {
      onChunk({ streamId: '', type: 'block', block });
    }
    onChunk({
      streamId: '', type: 'metadata',
      metadata: {
        citations: parsed.citations, assessment: parsed.assessment,
        confidence: parsed.confidence, escalated: parsed.escalated,
        suggestions: parsed.suggestions, scope: parsed.scope,
        used_source_ids: parsed.used_source_ids, used_fact_ids: parsed.used_fact_ids,
      },
    });
    onChunk({ streamId: '', type: 'done' });

    // Cache + persist
    repo.setTutorCache(this.db, {
      key: this.hashKey(params.nodeId, params.question), node_id: params.nodeId,
      answer_json: JSON.stringify(parsed), model: 'small',
      created_at: new Date().toISOString(),
    });
    if (params.conversationId) {
      this.conversation.addMessage({
        conversationId: params.conversationId, role: 'assistant',
        blocks: parsed.blocks, metadata: {
          confidence: parsed.confidence, citations: parsed.citations,
          assessment: parsed.assessment, escalated: parsed.escalated,
        },
      });
    }
  } catch (e: any) {
    onChunk({ streamId: '', type: 'error', error: e.message });
  }
}
```

> **Streaming implementation note:** True block-level streaming requires the AI to emit blocks as NDJSON (one block per line). The system prompt above requests a single JSON object for reliability. A future enhancement (`askStreamV2`) can switch to NDJSON prompt mode for progressive block rendering. For Phase 1, the streaming path uses progressive text accumulation with a single block-emission burst at parse time — this still gives us (a) cancellation via `AbortController`, (b) event-based IPC pattern, and (c) the foundation for future NDJSON streaming.

---

### 1.6 IPC Handler Registration

**File:** `src/services/learn/index.ts`

**Modify** `registerLearnHandlers()` to instantiate the new services and register new channels:

```typescript
// In registerLearnHandlers() — after tutor service instantiation:
const notes = new NoteService(db);
const conversations = new ConversationService(db);
const permissions = new PermissionService(db);
const dashboard = new LearnDashboardService(db);

// Pass conversations + permissions into TutorService constructor (update signature)

// ── Notes ──
ipcMain.handle('learn:saveNote', (_e, p) => notes.saveNote(p));
ipcMain.handle('learn:getNotes', (_e, p) => notes.listNotes(p.lessonId, p.nodeId));
ipcMain.handle('learn:deleteNote', (_e, p) => notes.deleteNote(p.noteId));

// ── Pending Actions ──
ipcMain.handle('learn:proposeAction', (_e, p) => {
  // Insert as pending; PermissionService.check is consulted at proposal time
  // to decide whether to auto-apply or queue
  const mode = permissions.check(p.actionType);
  if (mode === 'blocked') return { ok: false, error: 'Action type blocked by user settings' };
  const action: PendingAction = {
    id: `pa_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`,
    lessonId: p.lessonId, actionType: p.actionType, payload: p.payload,
    status: mode === 'auto' ? 'approved' : 'pending',
    rationale: p.rationale ?? null, rejectionReason: null,
    createdAt: new Date().toISOString(), resolvedAt: mode === 'auto' ? new Date().toISOString() : null,
  };
  repo.insertPendingAction(db, action);
  if (mode === 'auto') {
    applyAction(db, action, notes);
  }
  return { ok: true, data: action };
});
ipcMain.handle('learn:approveAction', (_e, p) => {
  const actions = repo.listPendingActions(db);
  const action = actions.find(a => a.id === p.actionId);
  if (!action) return { ok: false, error: 'Action not found' };
  const applyResult = applyAction(db, action, notes);
  if (!applyResult.ok) return applyResult;
  repo.resolvePendingAction(db, p.actionId, 'approved');
  return { ok: true, data: undefined };
});
ipcMain.handle('learn:rejectAction', (_e, p) => {
  repo.resolvePendingAction(db, p.actionId, 'rejected', p.reason);
  return { ok: true, data: undefined };
});
ipcMain.handle('learn:getPendingActions', (_e, p) => ({
  ok: true, data: repo.listPendingActions(db, p?.lessonId),
}));

// ── Conversations ──
ipcMain.handle('learn:getConversation', (_e, p) => conversations.getConversation(p.nodeId));
ipcMain.handle('learn:addMessage', (_e, p) => {
  const conv = conversations.getOrCreateConversation(p.nodeId);
  if (!conv.ok) return conv;
  return conversations.addMessage({
    conversationId: conv.data.id, role: p.role, blocks: p.blocks, metadata: p.metadata,
  });
});

// ── Permissions ──
ipcMain.handle('learn:getPermissionSettings', () => permissions.getSettings());
ipcMain.handle('learn:setPermissionSettings', (_e, p) => permissions.setMode(p.actionType, p.mode));
ipcMain.handle('learn:resetPermissionSettings', () => permissions.reset());

// ── Dashboard ──
ipcMain.handle('learn:getLearnDashboard', () => dashboard.getStats());

// ── Tutor V2 ──
ipcMain.handle('learn:askTutorV2', (_e, p) => tutor.askV2(p));

// ── Streaming ──
ipcMain.handle('learn:askTutorStream', async (event, p) => {
  const streamId = `stream_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, error: 'No window' };

  const onChunk = (chunk: TutorStreamChunk) => {
    chunk.streamId = streamId;
    win.webContents.send(`learn:tutorChunk:${streamId}`, chunk);
  };

  const controller = new AbortController();
  activeStreams.set(streamId, controller);

  try {
    await tutor.askStream({ ...p, onChunk, signal: controller.signal });
    return { ok: true, data: { streamId } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  } finally {
    activeStreams.delete(streamId);
  }
});

ipcMain.handle('learn:cancelTutorStream', (_e, p) => {
  const controller = activeStreams.get(p.streamId);
  if (controller) { controller.abort(); activeStreams.delete(p.streamId); }
  return { ok: true, data: undefined };
});

// ── Apply action helper ──
function applyAction(db: Database, action: PendingAction, notes: NoteService): Result<void> {
  switch (action.actionType) {
    case 'create_note': {
      const p = action.payload as NoteProposalBlock;
      return notes.createFromProposal(p, action.lessonId);
    }
    case 'edit_content': {
      const p = action.payload as EditProposalBlock;
      // Read current node, find block, replace text, save back
      return ContentService.applyEdit(db, p);
    }
    case 'insert_block': {
      const p = action.payload as InsertBlockProposalBlock;
      return ContentService.applyInsert(db, p);
    }
    case 'suggest_exercise': {
      // Create a pending exercise note for the user
      const p = action.payload as ExerciseProposalBlock;
      return notes.saveNote({
        lessonId: action.lessonId,
        title: `Exercise: ${p.topic}`,
        content: `**${p.difficulty}** — ${p.prompt}${p.starterCode ? `\n\n\`\`\`\n${p.starterCode}\n\`\`\`` : ''}`,
        source: 'ai',
      });
    }
  }
  return { ok: false, error: 'Unknown action type' };
}
```

**Add at top of file:** `const activeStreams = new Map<string, AbortController>();`

**Extend `ContentService`** with two static methods (in `content.service.ts`):

```typescript
static applyEdit(db: Database, p: EditProposalBlock): Result<void> {
  try {
    const node = db.prepare('SELECT blocks_json FROM lesson_nodes WHERE id = ?').get(p.nodeId) as any;
    if (!node) return { ok: false, error: 'Node not found' };
    const blocks: LessonBlock[] = JSON.parse(node.blocks_json);
    const idx = blocks.findIndex(b => b.id === p.blockId);
    if (idx === -1) return { ok: false, error: 'Block not found' };
    blocks[idx].content = p.replacementText;
    db.prepare('UPDATE lesson_nodes SET blocks_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(blocks), new Date().toISOString(), p.nodeId);
    return { ok: true, data: undefined };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

static applyInsert(db: Database, p: InsertBlockProposalBlock): Result<void> {
  try {
    const node = db.prepare('SELECT blocks_json FROM lesson_nodes WHERE id = ?').get(p.nodeId) as any;
    if (!node) return { ok: false, error: 'Node not found' };
    const blocks: LessonBlock[] = JSON.parse(node.blocks_json);
    const idx = blocks.findIndex(b => b.id === p.afterBlockId);
    if (idx === -1) return { ok: false, error: 'Anchor block not found' };
    blocks.splice(idx + 1, 0, p.newBlock);
    db.prepare('UPDATE lesson_nodes SET blocks_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(blocks), new Date().toISOString(), p.nodeId);
    return { ok: true, data: undefined };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
```

---

### 1.7 Preload Bridge

**File:** `src/preload.ts` (extend the `deskflowAPI` object around line 712-787)

```typescript
// Notes
learnSaveNote: (p: { lessonId: string; nodeId?: string; blockId?: string; title?: string; content: string; source?: 'user'|'ai'|'ai_pending'; color?: string }) =>
  ipcRenderer.invoke('learn:saveNote', p),
learnGetNotes: (p: { lessonId?: string; nodeId?: string }) =>
  ipcRenderer.invoke('learn:getNotes', p),
learnDeleteNote: (p: { noteId: string }) =>
  ipcRenderer.invoke('learn:deleteNote', p),

// Pending Actions
learnProposeAction: (p: { lessonId: string; actionType: string; payload: any; rationale?: string }) =>
  ipcRenderer.invoke('learn:proposeAction', p),
learnApproveAction: (p: { actionId: string }) =>
  ipcRenderer.invoke('learn:approveAction', p),
learnRejectAction: (p: { actionId: string; reason?: string }) =>
  ipcRenderer.invoke('learn:rejectAction', p),
learnGetPendingActions: (p?: { lessonId?: string }) =>
  ipcRenderer.invoke('learn:getPendingActions', p || {}),

// Conversations
learnGetConversation: (p: { nodeId: string }) =>
  ipcRenderer.invoke('learn:getConversation', p),
learnAddMessage: (p: { nodeId: string; role: 'user'|'assistant'|'system'; blocks: any[]; metadata?: any }) =>
  ipcRenderer.invoke('learn:addMessage', p),

// Permissions
learnGetPermissionSettings: () => ipcRenderer.invoke('learn:getPermissionSettings'),
learnSetPermissionSettings: (p: { actionType: string; mode: 'auto'|'confirm'|'blocked' }) =>
  ipcRenderer.invoke('learn:setPermissionSettings', p),
learnResetPermissionSettings: () => ipcRenderer.invoke('learn:resetPermissionSettings'),

// Dashboard
learnGetDashboard: () => ipcRenderer.invoke('learn:getLearnDashboard'),

// Tutor V2
learnAskTutorV2: (p: { nodeId: string; blockId?: string; question: string; conversationId?: string }) =>
  ipcRenderer.invoke('learn:askTutorV2', p),

// Streaming
learnAskTutorStream: (p: { nodeId: string; blockId?: string; question: string; conversationId?: string }) =>
  ipcRenderer.invoke('learn:askTutorStream', p),
learnCancelTutorStream: (p: { streamId: string }) =>
  ipcRenderer.invoke('learn:cancelTutorStream', p),
onTutorChunk: (streamId: string, callback: (chunk: TutorStreamChunk) => void) => {
  const listener = (_e: unknown, chunk: TutorStreamChunk) => callback(chunk);
  ipcRenderer.on(`learn:tutorChunk:${streamId}`, listener);
  return () => ipcRenderer.removeListener(`learn:tutorChunk:${streamId}`, listener);
},
```

---

### 1.8 Main Process — Streaming `callAi` Wrapper

**File:** `src/main.ts` (extend the `callAi` registration block at lines 2880-2905)

Add a `callAiStream` function and pass it into `registerLearnHandlers`:

```typescript
registerLearnHandlers(
  db,
  async (prompt: string, systemPrompt: string, maxTokens?: number) => { /* existing */ },
  async function* callAiStream(prompt: string, systemPrompt: string, maxTokens: number, signal: AbortSignal): AsyncGenerator<string> {
    const p = userPreferences || {};
    const pState = migrateProviderNames(JSON.parse(p.aiProviders || 'null'));
    if (!pState) throw new Error('No AI provider configured');
    const chain = buildChain(pState, 'goalAssistant');
    if (chain.length === 0) throw new Error('No AI provider configured');

    // Try streaming on first provider that supports it; fallback to non-streaming on others
    for (const provider of chain) {
      if (provider.template?.supportsStream) {
        try {
          const stream = await callProviderStream(provider, {
            systemPrompt, messages: [{ role: 'user', content: prompt }], maxTokens,
          }, signal);
          for await (const chunk of stream) yield chunk;
          return;
        } catch (e) {
          console.warn(`[stream] Provider ${provider.id} failed, trying fallback:`, e);
          continue;
        }
      }
    }

    // Fallback: non-streaming providers — emit full content as one chunk
    const { result } = await runWithFallback(chain, {
      systemPrompt, messages: [{ role: 'user', content: prompt }], maxTokens,
    });
    yield result.content;
  }
);
```

**Update `registerLearnHandlers` signature** to accept the third `callAiStream` parameter and store it on `TutorService`:

```typescript
export function registerLearnHandlers(
  db: Database,
  callAi: (...) => Promise<any>,
  callAiStream?: (prompt: string, systemPrompt: string, maxTokens: number, signal: AbortSignal) => AsyncGenerator<string>,
) { ... }
```

In `TutorService` constructor: store `callAiStream`. In `askStream`, iterate the async generator and accumulate.

---

### 1.9 Provider Layer — `callProviderStream`

**File:** `src/services/providers/callProvider.ts` (append new function)

```typescript
export async function callProviderStream(
  provider: ResolvedProvider,
  req: CanonicalRequest,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> {
  const url = provider.template?.streamUrl?.replace('{model}', provider.model)
    ?? provider.template?.url?.replace('{model}', provider.model);
  const headers = {
    'Content-Type': 'application/json',
    ...(provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {}),
    ...(provider.template?.extraHeaders ?? {}),
  };
  const body = JSON.stringify({
    model: provider.model,
    messages: [{ role: 'system', content: req.systemPrompt }, ...req.messages],
    max_tokens: req.maxTokens ?? 500,
    stream: true,
    temperature: 0.3,
  });

  const response = await fetch(url!, { method: 'POST', headers, body, signal });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  async function* gen(): AsyncGenerator<string> {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      // SSE format: lines starting with "data: " then JSON
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? '';
          if (delta) yield delta;
        } catch { /* ignore malformed partial */ }
      }
    }
  }
  return gen();
}
```

---

### 1.10 System Prompt Update

**File:** `src/services/learn/promptLibrary.ts`

**Modify** `composeTutorPersona()` (at line 1645) to prepend the block-format instructions, OR keep `composeTutorPersona` unchanged and have `TutorService` use `TUTOR_SYSTEM_PROMPT_V2` as the base and prepend the persona via `prependTutorPersonaV2()`:

```typescript
export function prependTutorPersonaV2(personaMd: string): string {
  if (!personaMd) return TUTOR_SYSTEM_PROMPT_V2;
  return `${personaMd}\n\n---\n\n## Core Tutor Instructions (V2)\n${TUTOR_SYSTEM_PROMPT_V2}`;
}
```

Update the `TutorService` constructor (in `index.ts` line 902 area) to use V2 by default. Old `TUTOR_SYSTEM_PROMPT` is kept for backward compatibility with any cached responses.

---

## Phase 2: AI Action System + Confirmation Workflow

### 2.1 Action Proposal Emission

The AI emits action blocks (`note_proposal`, `edit_proposal`, `insert_block_proposal`, `exercise_proposal`) inline within the `blocks` array of a `TutorResponse`. The renderer detects these block types and renders them as **proposal cards** rather than as static content.

**Detection in renderer:**

```typescript
const PROPOSAL_TYPES = new Set(['note_proposal','edit_proposal','insert_block_proposal','exercise_proposal']);
function isProposalBlock(b: TutorBlock): boolean {
  return PROPOSAL_TYPES.has(b.type);
}
```

### 2.2 Permission-Aware Routing

When a `TutorResponse` arrives with proposal blocks, the renderer calls `learnProposeAction` for each one. The main process:

1. Consults `PermissionService.check(actionType)`:
   - `auto` → action is applied immediately; status set to `approved`; renderer receives notification "AI applied: <action>"
   - `confirm` → action is inserted as `pending`; renderer receives a pending action card
   - `blocked` → action is rejected silently; renderer receives nothing (or a notice "Action blocked by settings")

### 2.3 PendingAction UI Components

#### File: `src/components/learn/blocks/ProposalCard.tsx` (new)

```typescript
interface ProposalCardProps {
  action: PendingAction;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onEdit?: () => void;   // optional — opens edit modal
}

// Visual:
// - Border: border-amber-500/40, bg-amber-950/20
// - Header: AI icon + "AI suggests" + action type label
// - Body: rendered preview (note markdown, diff for edit, etc.)
// - Footer: [Approve] [Edit] [Reject] buttons
// - Animation: framer-motion slide-in from left, blur-fade
```

States: `pending` (amber border, 3 buttons), `approved` (sage border, "Applied ✓" badge), `rejected` (zinc border, "Dismissed" badge).

#### File: `src/components/learn/blocks/EditDiffView.tsx` (new)

Split-pane showing `originalText` (left, `text-zinc-500 line-through`) vs `replacementText` (right, `text-sage-400`). Use `react-diff-viewer-continued` only if already available; otherwise simple split with a "+" gutter. Per constraint #6 (no new deps unless necessary), use a simple custom diff.

#### File: `src/components/learn/PendingActionPill.tsx` (new)

Floating pill at the top-right of `TutorPanel` showing count of pending actions. Clicking opens a list view. Pattern matches the citation counter at `TutorPanel.tsx:311-332`.

```typescript
// Visual:
// <motion.div className="absolute top-12 right-3 px-2.5 py-1 rounded-full
//   bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-1.5">
//   <Bell className="w-3 h-3" /> {count} pending
// </motion.div>
```

### 2.4 Approval/Rejection Flow

1. User clicks **Approve** on a `ProposalCard`.
2. Renderer calls `learnApproveAction({ actionId })`.
3. Main process runs `applyAction()` (Phase 1.6) which executes the side effect (DB write).
4. Main process returns `{ ok: true }`.
5. Renderer updates the card to `approved` state, shows a brief toast "Note saved" / "Edit applied".
6. If the action modified lesson content (`edit_content` / `insert_block`), renderer re-fetches the node via `learnGetNode` and re-renders the blocks.

For **Reject**:
1. User clicks **Reject** (optionally prompted for a reason via a small modal).
2. Renderer calls `learnRejectAction({ actionId, reason })`.
3. Card transitions to `rejected` state, dismissed after 2s.

For **Bulk** actions (PendingActionPill list view):
- Header: "Approve all" / "Reject all" buttons.

### 2.5 Verification

- Ask the AI a question that warrants a note ("Can you summarize the key idea here?"). Verify a `note_proposal` block appears as a card.
- Approve → verify row in `learn_notes` table with `source = 'ai'`.
- Reject → verify `learn_pending_actions` row has `status = 'rejected'`.
- Set `create_note` to `auto` in settings → ask same question → verify note is created immediately without a card appearing.

---

## Phase 3: Chatbot UI Revamp

### 3.1 Component Decomposition

Replace the single `TutorPanel.tsx` with a folder structure:

```
src/components/learn/tutor/
├── TutorPanel.tsx              (rewritten — shell, header, scroll container, input)
├── ConversationView.tsx        (renders message history)
├── MessageBubble.tsx           (single message wrapper with role styling)
├── TutorBlockRenderer.tsx      (dispatches a TutorBlock to the right sub-component)
├── ChatInput.tsx               (textarea + quick-action buttons)
├── PendingActionPill.tsx       (floating pending counter)
└── blocks/
    ├── ExplanationBlock.tsx
    ├── CodeSnippetBlock.tsx
    ├── DiagramBlock.tsx
    ├── FlashcardBlock.tsx
    ├── KeyPointBlock.tsx
    ├── AnalogyBlock.tsx
    ├── NoteProposalCard.tsx
    ├── EditProposalCard.tsx
    ├── InsertBlockProposalCard.tsx
    ├── ExerciseProposalCard.tsx
    ├── QuizQuestionBlock.tsx
    ├── ComparisonTableBlock.tsx
    ├── StepListBlock.tsx
    ├── ResourceLinkBlock.tsx
    ├── ExerciseBlock.tsx
    └── CitationBlock.tsx
```

### 3.2 TutorPanel Rewrite

**File:** `src/components/learn/tutor/TutorPanel.tsx`

**Props:**

```typescript
interface TutorPanelProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  lessonId: string;
  initialQuestion?: string;       // from SelectionActions
  onInsertIntoNote?: (md: string) => void;
}
```

The panel manages its own state: conversation, current stream, pending actions, suggestions, panel width.

**Key behaviors:**

1. **On open** with `nodeId`:
   - Calls `learnGetConversation({ nodeId })` → loads history into state.
   - If no conversation exists, shows empty state.
   - Auto-focuses the input.
2. **On submit question:**
   - Calls `learnAddMessage({ nodeId, role: 'user', blocks: [{ id: 'blk_u1', type: 'explanation', content: question }] })` to persist user message.
   - Updates conversation state immediately (optimistic).
   - Calls `learnAskTutorStream({ nodeId, question, conversationId })`.
   - Listens via `onTutorChunk(streamId, callback)` for blocks.
   - On each `block` chunk: append to a "streaming assistant message" in state. Use framer-motion staggered fade-in.
   - On `metadata` chunk: store citations, assessment, suggestions.
   - On `done`: finalize message, persist via `learnAddMessage({ nodeId, role: 'assistant', blocks, metadata })`.
   - On `error`: show error toast.
3. **On close** while streaming: call `learnCancelTutorStream({ streamId })`.

**Layout:**

```tsx
<motion.div
  initial={{ x: 24, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: 24, opacity: 0 }}
  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
  style={{ width: panelWidth }}
  className="border-l border-zinc-800 bg-zinc-900/80 backdrop-blur-xl flex flex-col shrink-0 h-full"
>
  <PanelHeader onClose={onClose} onPopOut={() => setPopOut(true)} />
  <PendingActionPill count={pending.length} onClick={...} />
  <ConversationView messages={messages} streamingMessage={streamingMsg} />
  <SuggestionsBar suggestions={currentSuggestions} onPick={q => submit(q)} />
  <ChatInput onSubmit={submit} disabled={streaming} onQuickAction={handleQuickAction} />
  <ResizeHandle onResize={w => setPanelWidth(w)} />
</motion.div>
```

**Panel width:** default `w-96` (384px). Drag handle on left edge resizes between 320px and 640px. Persists width to `profile_kv` under `lyceum.tutorPanelWidth`.

**Pop-out mode:** opens a modal overlay (`fixed inset-4 z-50`) with the same panel content at full size. Useful for tablet/desktop.

**Mobile:** `< 768px` width → panel becomes `fixed inset-0 z-50` full-screen overlay.

### 3.3 ConversationView

**File:** `src/components/learn/tutor/ConversationView.tsx`

```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-6 ws-scroll">
  {messages.map(msg => (
    <MessageBubble key={msg.id} message={msg} onApprove={...} onReject={...} />
  ))}
  {streamingMsg && <MessageBubble message={streamingMsg} streaming />}
  <div ref={endRef} />
</div>
```

**Auto-scroll:** `useEffect` on `messages.length` and `streamingMsg.blocks.length` to scroll `endRef.current?.scrollIntoView({ behavior: 'smooth' })`.

### 3.4 MessageBubble

**File:** `src/components/learn/tutor/MessageBubble.tsx`

```tsx
<motion.div
  initial={{ opacity: 0, y: 8, filter: 'blur(8px)' }}
  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  className={cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')}
>
  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-clay-400" />}
    <span>{msg.role === 'user' ? 'You' : 'Tutor'}</span>
    <span className="text-zinc-700">·</span>
    <time>{formatTime(msg.createdAt)}</time>
  </div>
  <div className={cn(
    'rounded-xl p-3 max-w-[88%] space-y-3',
    msg.role === 'user'
      ? 'bg-clay-500/10 border border-clay-500/20 text-zinc-200'
      : 'bg-zinc-800/50 border border-zinc-700/50'
  )}>
    {msg.blocks.map(b => (
      <TutorBlockRenderer key={b.id} block={b} onApprove={...} onReject={...} onInsert={onInsert} />
    ))}
  </div>
  {msg.metadata?.assessment && <AssessmentFooter assessment={msg.metadata.assessment} />}
  {msg.metadata?.citations?.length > 0 && <CitationFooter citations={msg.metadata.citations} />}
</motion.div>
```

### 3.5 TutorBlockRenderer

**File:** `src/components/learn/tutor/TutorBlockRenderer.tsx`

```tsx
export function TutorBlockRenderer({ block, onApprove, onReject, onInsert }: {
  block: TutorBlock;
  onApprove: (action: PendingAction) => void;
  onReject: (action: PendingAction, reason?: string) => void;
  onInsert: (md: string) => void;
}) {
  switch (block.type) {
    case 'explanation': return <ExplanationBlockView block={block} />;
    case 'code_snippet': return <CodeSnippetBlockView block={block} />;
    case 'diagram': return <DiagramBlockView block={block} />;
    case 'flashcard': return <FlashcardBlockView block={block} />;
    case 'key_point': return <KeyPointBlockView block={block} />;
    case 'analogy': return <AnalogyBlockView block={block} />;
    case 'note_proposal': return <NoteProposalCard block={block} onApprove={onApprove} onReject={onReject} />;
    case 'edit_proposal': return <EditProposalCard block={block} onApprove={onApprove} onReject={onReject} />;
    case 'insert_block_proposal': return <InsertBlockProposalCard block={block} onApprove={onApprove} onReject={onReject} />;
    case 'exercise_proposal': return <ExerciseProposalCard block={block} onApprove={onApprove} onReject={onReject} />;
    case 'quiz_question': return <QuizQuestionBlockView block={block} />;
    case 'comparison_table': return <ComparisonTableBlockView block={block} />;
    case 'step_list': return <StepListBlockView block={block} />;
    case 'resource_link': return <ResourceLinkBlockView block={block} />;
    case 'exercise': return <ExerciseBlockView block={block} />;
    case 'citation': return <CitationBlockView block={block} />;
    default: return null;
  }
}
```

### 3.6 Block Component Patterns

Each block component is small (50-150 lines). Common patterns:

**Empty/Loading/Error states:** Each block can render a `loading` skeleton while streaming (e.g. `ExplanationBlock` shows `Loader2 animate-spin` until content arrives). Each handles `null`/malformed data gracefully.

**ExplanationBlockView:**
```tsx
// Reuse renderAnswerHtml from old TutorPanel.tsx:204-221 for backward compat
// but render via dangerouslySetInnerHTML inside a styled container
<div className="prose-custom text-sm text-zinc-300 leading-relaxed [&_p]:mb-2"
     dangerouslySetInnerHTML={{ __html: renderAnswerHtml(block.content) }} />
```

**CodeSnippetBlockView:**
```tsx
<div className="rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-950">
  <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/50">
    <span className="text-xs text-zinc-500 font-mono">{block.language}{block.filename ? ` · ${block.filename}` : ''}</span>
    <button onClick={() => navigator.clipboard.writeText(block.code)}
      className="text-zinc-500 hover:text-zinc-300 transition">
      <Copy className="w-3 h-3" />
    </button>
  </div>
  <pre className="p-3 text-xs text-zinc-300 font-mono overflow-x-auto ws-scroll"><code>{block.code}</code></pre>
</div>
```

> **Syntax highlighting:** No new deps. If `highlight.js` is already in `package.json` use it; otherwise plain `font-mono` with zinc palette.

**DiagramBlockView:**
```tsx
// Mermaid: dynamically import mermaid only when needed
const [svg, setSvg] = useState<string | null>(null);
useEffect(() => {
  if (block.format !== 'mermaid') return;
  (async () => {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const { svg } = await mermaid.render(`diag-${block.id}`, block.content);
    setSvg(svg);
  })();
}, [block.content]);
```

> **Note:** `mermaid` is a heavy dep. Add only if Phase 3 mermaid support is desired. If unavailable, render `block.content` as preformatted text inside a styled container with a note "Mermaid diagram source".

**FlashcardBlockView:**
```tsx
const [flipped, setFlipped] = useState(false);
<motion.button
  onClick={() => setFlipped(f => !f)}
  className="w-full rounded-xl p-4 bg-zinc-800/60 border border-zinc-700/50 text-left"
  animate={{ rotateY: flipped ? 180 : 0 }}
  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
  style={{ transformStyle: 'preserve-3d' }}
>
  {!flipped ? (
    <div>
      <div className="text-xs text-zinc-500 mb-1">Question</div>
      <div className="text-sm text-zinc-200">{block.front}</div>
      {block.hint && <div className="text-xs text-zinc-600 mt-2">Hint: {block.hint}</div>}
    </div>
  ) : (
    <div style={{ transform: 'rotateY(180deg)' }}>
      <div className="text-xs text-clay-400 mb-1">Answer</div>
      <div className="text-sm text-zinc-100">{block.back}</div>
    </div>
  )}
</motion.button>
```

**NoteProposalCard** (proposal pattern):
```tsx
<motion.div
  initial={{ opacity: 0, x: -16 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: 16 }}
  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
  className="rounded-xl p-4 bg-amber-950/20 border border-amber-500/40"
>
  <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
    <Sparkles className="w-3.5 h-3.5" />
    <span>AI suggests creating a note</span>
  </div>
  <div className="text-sm font-semibold text-zinc-100 mb-1">{block.title}</div>
  <div className="text-xs text-zinc-400 line-clamp-3 mb-3">{block.content}</div>
  {block.rationale && <div className="text-xs text-amber-300/60 mb-3">Why: {block.rationale}</div>}
  <div className="flex gap-2">
    <button onClick={() => onApprove(actionFromBlock(block))}
      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 text-xs font-medium transition">
      Create note
    </button>
    <button onClick={() => onReject(actionFromBlock(block))}
      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition">
      Dismiss
    </button>
  </div>
</motion.div>
```

### 3.7 ChatInput

**File:** `src/components/learn/tutor/ChatInput.tsx`

Replace the single-line `<input>` at `TutorPanel.tsx:371-378` with:

```tsx
<div className="border-t border-zinc-800 p-3 space-y-2">
  <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 focus-within:border-clay-400/50 transition">
    <textarea
      ref={textareaRef}
      value={value}
      onChange={e => { setValue(e.target.value); autoResize(e.target); }}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
      placeholder="Ask about this concept..."
      rows={1}
      className="w-full px-3 py-2 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 outline-none resize-none"
    />
    <div className="flex items-center justify-between px-2 pb-2">
      <div className="flex gap-1">
        <button onClick={insertBacktick} title="Insert code"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition">
          <Code className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onQuickAction('summarize')} title="Summarize this node"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition">
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onQuickAction('quiz')} title="Quiz me"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
      <button onClick={submit} disabled={streaming || !value.trim()}
        className="p-2 rounded-lg bg-clay-500 hover:bg-clay-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition">
        <Send className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

**Auto-resize:** `el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px';`

### 3.8 SuggestionsBar

Renders `currentSuggestions: string[]` as chips below the conversation:

```tsx
{currentSuggestions.length > 0 && (
  <div className="px-3 pb-2 flex flex-wrap gap-1.5">
    {currentSuggestions.map((s, i) => (
      <button key={i} onClick={() => onPick(s)}
        className="px-2.5 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 text-xs text-zinc-400 hover:text-zinc-200 transition">
        {s}
      </button>
    ))}
  </div>
)}
```

### 3.9 Streaming State in Renderer

```typescript
const [streamingMsg, setStreamingMsg] = useState<ConversationMessage | null>(null);
const [streamId, setStreamId] = useState<string | null>(null);
const streamRef = useRef<{ streamId: string; off: (() => void) | null }>({ streamId: '', off: null });

async function submit(question: string) {
  // 1. Append user message optimistically
  const userMsg = { id: 'tmp_u_' + Date.now(), conversationId: '', role: 'user',
    blocks: [{ id: 'blk_u', type: 'explanation', content: question }],
    metadata: {}, createdAt: new Date().toISOString() };
  setMessages(m => [...m, userMsg]);

  // 2. Start streaming
  const res = await window.deskflowAPI.learnAskTutorStream({ nodeId, question });
  if (!res.ok) { toast.error(res.error); return; }
  const sid = res.data.streamId;
  setStreamId(sid);
  setStreamingMsg({ id: 'tmp_a_' + Date.now(), conversationId: '', role: 'assistant',
    blocks: [], metadata: {}, createdAt: new Date().toISOString() });

  const off = window.deskflowAPI.onTutorChunk(sid, (chunk) => {
    if (chunk.type === 'block' && chunk.block) {
      setStreamingMsg(m => m ? { ...m, blocks: [...m.blocks, chunk.block!] } : m);
    } else if (chunk.type === 'metadata' && chunk.metadata) {
      setStreamingMsg(m => m ? { ...m, metadata: { ...m.metadata, ...chunk.metadata } } : m);
    } else if (chunk.type === 'done') {
      setStreamingMsg(curr => {
        if (curr) setMessages(m => [...m, curr]);
        return null;
      });
      off();
    } else if (chunk.type === 'error') {
      toast.error(chunk.error || 'Stream error');
      setStreamingMsg(null);
      off();
    }
  });
  streamRef.current = { streamId: sid, off };
}

// Cleanup on unmount / panel close
useEffect(() => () => {
  if (streamRef.current.streamId) window.deskflowAPI.learnCancelTutorStream({ streamId: streamRef.current.streamId });
  if (streamRef.current.off) streamRef.current.off();
}, []);
```

### 3.10 Removal of Old `useTypingEffect`

The `useTypingEffect` hook at `TutorPanel.tsx:223-238` is **deleted**. Streaming replaces it. If a non-streaming provider is used, the full content arrives as a single chunk and the block animates in via framer-motion — no fake typing needed.

### 3.11 Verification

- Open tutor panel on a node with no prior conversation → empty state shows.
- Ask a question → user bubble appears immediately, then assistant bubble streams in block by block.
- Verify citations, assessment, and suggestions render correctly.
- Refresh the app → conversation persists.
- Click a suggestion chip → it submits as a new question.
- Resize panel via drag handle → width persists across sessions.
- On narrow viewport → panel goes full-screen.

---

## Phase 4: Dashboard Integration

### 4.1 Dashboard Section

**File:** `src/components/DashboardPage.tsx`

Add a new Learn section using `GlassCard` (`GlassCard.tsx:2067`) and `SectionHeader` (`SectionHeader.tsx:2098`) patterns.

**Data fetch:**

```typescript
const [learnStats, setLearnStats] = useState<LearnDashboardStats | null>(null);
useEffect(() => {
  window.deskflowAPI.learnGetDashboard().then((res: Result<LearnDashboardStats>) => {
    if (res.ok) setLearnStats(res.data);
  });
}, []);
```

### 4.2 Layout — Bento Grid

Use a 2-row × 3-column bento layout within the existing dashboard grid. Each card is a `GlassCard` with a `SectionHeader`.

```tsx
<SectionHeader icon={GraduationCap} title="Lyceum Learn" subtitle="Your learning progress" />
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <GlassCard variant="glass" accent="amber" className="md:col-span-1">
    {/* Streak Card */}
  </GlassCard>
  <GlassCard variant="glass" accent="clay" className="md:col-span-1">
    {/* Mastery Overview */}
  </GlassCard>
  <GlassCard variant="glass" accent="sage" className="md:col-span-1">
    {/* Continue Learning CTA */}
  </GlassCard>
  <GlassCard variant="bordered" className="md:col-span-2">
    {/* Recent Activity */}
  </GlassCard>
  <GlassCard variant="bordered" accent="sky" className="md:col-span-1">
    {/* Due Reviews */}
  </GlassCard>
</div>
```

### 4.3 Card Contents

#### Streak Card

```tsx
<div className="flex flex-col items-center text-center py-4">
  <Flame className={cn('w-10 h-10 mb-2', learnStats?.streak ? 'text-amber-400' : 'text-zinc-600')} />
  <div className="text-3xl font-bold text-zinc-100">{learnStats?.streak ?? 0}</div>
  <div className="text-xs text-zinc-500 mt-1">day streak</div>
  <div className="text-xs text-zinc-600 mt-2">
    {learnStats?.streak ? 'Keep it up!' : 'Open a lesson to start'}
  </div>
</div>
```

#### Mastery Overview Card

```tsx
<div className="py-2">
  <div className="flex items-baseline justify-between mb-2">
    <span className="text-xs text-zinc-500">Overall mastery</span>
    <span className="text-xl font-bold text-clay-300">{learnStats?.totalMastery ?? 0}%</span>
  </div>
  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${learnStats?.totalMastery ?? 0}%` }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="h-full bg-gradient-to-r from-clay-500 to-amber-400"
    />
  </div>
  <button onClick={() => navigate('/learn')}
    className="mt-3 text-xs text-clay-400 hover:text-clay-300 transition flex items-center gap-1">
    View all lessons <ArrowRight className="w-3 h-3" />
  </button>
</div>
```

#### Continue Learning Card

```tsx
<button
  onClick={() => learnStats?.lastLessonId && navigate(`/learn?lesson=${learnStats.lastLessonId}&node=${learnStats.lastNodeId}`)}
  className="w-full text-left p-2 rounded-lg hover:bg-zinc-800/50 transition group"
>
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-lg bg-sage-500/10 border border-sage-500/20">
      <Play className="w-4 h-4 text-sage-400" />
    </div>
    <div>
      <div className="text-xs text-zinc-500">Continue learning</div>
      <div className="text-sm font-medium text-zinc-200 group-hover:text-sage-300 transition">
        {learnStats?.recentLessons[0]?.title ?? 'No lessons yet'}
      </div>
    </div>
  </div>
</button>
```

#### Recent Activity Card (col-span-2)

```tsx
<div className="space-y-2">
  {learnStats?.recentLessons.length === 0 && (
    <div className="text-xs text-zinc-600 text-center py-6">No recent activity</div>
  )}
  {learnStats?.recentLessons.map(lesson => (
    <div key={lesson.lessonId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition">
      <BookOpen className="w-4 h-4 text-zinc-500" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 truncate">{lesson.title}</div>
        <div className="text-xs text-zinc-600">{formatRelativeTime(lesson.lastAccessedAt)}</div>
      </div>
      <div className="text-xs text-zinc-500">{lesson.progress}%</div>
      <div className="w-12 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full bg-clay-400" style={{ width: `${lesson.progress}%` }} />
      </div>
    </div>
  ))}
</div>
```

#### Due Reviews Card

```tsx
<div className="space-y-2">
  {learnStats?.dueReviews.length === 0 ? (
    <div className="flex flex-col items-center text-center py-4">
      <Check className="w-6 h-6 text-sage-400 mb-1" />
      <div className="text-xs text-zinc-500">All caught up</div>
    </div>
  ) : (
    learnStats?.dueReviews.map(r => (
      <button key={r.nodeId}
        onClick={() => navigate(`/learn?lesson=${r.lessonId}&node=${r.nodeId}`)}
        className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 transition">
        <Clock className="w-3.5 h-3.5 text-sky-400" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-200 truncate">{r.nodeTitle}</div>
          <div className="text-[10px] text-zinc-600">{r.lessonTitle}</div>
        </div>
        <span className="text-[10px] text-sky-400">{formatRelativeTime(r.dueReview)}</span>
      </button>
    ))
  )}
</div>
```

### 4.4 Placement

Insert the Learn section after the existing primary content section in `DashboardPage.tsx`. Use the same `<motion.div>` wrapper pattern (initial opacity/y, animate to 0/0) so it matches the staggered entrance of other sections.

### 4.5 Verification

- With no learn activity → streak card shows 0, mastery shows 0%, recent activity shows empty state, due reviews shows "All caught up".
- Open a lesson, answer a quiz, navigate back to dashboard → streak = 1, mastery shows progress, recent activity shows the lesson, due reviews (if any) appears.
- Click "Continue learning" → navigates to `/learn?lesson=...&node=...`.
- Click a due review → navigates to that node.

---

## Phase 5: Polish + Settings

### 5.1 Permission Settings UI

**File:** `src/components/learn/PermissionSettings.tsx` (new)

Either:
- (A) Add a `'settings'` value to the `view` state union at `LearnPage.tsx:1719` and render this component when `view === 'settings'`, OR
- (B) Add a section to the existing `SettingsPage.tsx` (follows the `bg-zinc-900/80 backdrop-blur-xl` glass pattern).

**Recommended: Option A** — keeps Learn features in one place.

```tsx
export function PermissionSettings() {
  const [settings, setSettings] = useState<PermissionSettings | null>(null);
  useEffect(() => { window.deskflowAPI.learnGetPermissionSettings().then(r => r.ok && setSettings(r.data)); }, []);

  const setMode = (actionType: ActionType, mode: PermissionMode) => {
    window.deskflowAPI.learnSetPermissionSettings({ actionType, mode });
    setSettings(s => s ? { ...s, [actionType]: mode } : s);
  };

  const ACTION_META: { type: ActionType; label: string; description: string }[] = [
    { type: 'create_note', label: 'Create Notes', description: 'AI can propose notes tied to lesson content.' },
    { type: 'edit_content', label: 'Edit Content', description: 'AI can suggest changes to lesson paragraphs.' },
    { type: 'insert_block', label: 'Insert Blocks', description: 'AI can suggest adding new content blocks (examples, diagrams, etc.).' },
    { type: 'suggest_exercise', label: 'Suggest Exercises', description: 'AI can propose practice exercises.' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <SectionHeader icon={Shield} title="AI Action Permissions" subtitle="Control what the tutor can do" />

      <GlassCard variant="bordered" className="p-5 space-y-4">
        {ACTION_META.map(({ type, label, description }) => (
          <div key={type} className="flex items-start justify-between gap-4 py-3 border-b border-zinc-800 last:border-0">
            <div>
              <div className="text-sm font-medium text-zinc-200">{label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
            </div>
            <SegmentedControl
              value={settings?.[type] ?? 'confirm'}
              onChange={(mode) => setMode(type, mode)}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'confirm', label: 'Confirm' },
                { value: 'blocked', label: 'Block' },
              ]}
            />
          </div>
        ))}
      </GlassCard>

      <div className="flex justify-end">
        <button onClick={async () => { await window.deskflowAPI.learnResetPermissionSettings(); /* refetch */ }}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 transition">
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
```

**SegmentedControl** (local component, no dep):

```tsx
function SegmentedControl({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-800 border border-zinc-700/50 p-0.5">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs transition',
            value === opt.value
              ? opt.value === 'auto' ? 'bg-sage-500/20 text-sage-300'
                : opt.value === 'blocked' ? 'bg-red-500/20 text-red-300'
                : 'bg-amber-500/20 text-amber-300'
              : 'text-zinc-500 hover:text-zinc-300'
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

### 5.2 Notes Panel

The current "Insert into note" button at `TutorPanel.tsx:349-356` only inserts into a localStorage-based scratch note. Replace with a notes panel that surfaces all `learn_notes` for the current lesson:

**File:** `src/components/learn/NotesPanel.tsx` (new)

A collapsible panel above or beside the conversation showing:
- Filter by node (current / all in lesson)
- Sort by created_at desc
- Each note: title, content preview, source badge (user/ai), delete button
- "New note" button → opens a markdown editor modal

### 5.3 Magic UI Integration

Use the following Magic UI components, re-skinned per Section 20 of CONTEXT_BUNDLE.md:

| Component | Use Case | Re-skin notes |
|-----------|----------|---------------|
| **Shimmer Button** | "Continue Learning" CTA, "Create note" approve button | Replace gradient with `bg-clay-500` |
| **Magic Card** | Proposal cards (hover spotlight effect) | Border → `border-amber-500/40`, spotlight color → `rgba(217,119,87,0.1)` |
| **Border Beam** | Active streaming indicator on assistant bubble | Beam color → `clay-400` |
| **Blur Fade** | Message entrance animation | Use `[0.16, 1, 0.3, 1]` easing |
| **Hyper Text** | "Thinking…" scramble effect while streaming first chunk | Color → `text-clay-400` |
| **Bento Grid** | Dashboard Learn section layout | No re-skin needed (layout-only) |

**Avoid:** Particles (distracting in learning context), Morphing Text (not relevant), Shine Border (overlaps with Border Beam).

### 5.4 Empty / Loading / Error States

Every new component must handle all four states. Checklist:

- **TutorPanel empty:** `<Sparkles /> Select text or type a question` (preserve existing pattern at `TutorPanel.tsx:279-283`).
- **TutorPanel loading (streaming):** `<BorderBeam>` wrapping the streaming assistant bubble + `<HyperText>` "Thinking…".
- **TutorPanel error:** Toast via existing toast system. Bubble shows error icon + message.
- **NotesPanel empty:** `<StickyNote /> No notes yet. Ask the tutor to summarize — it can create one for you.`
- **NotesPanel loading:** Skeleton rows.
- **PermissionSettings loading:** Skeleton cards.
- **Dashboard Learn section loading:** Skeleton cards (pulse `bg-zinc-800/50 animate-pulse`).
- **Dashboard Learn section error:** Small text "Couldn't load learning stats" with retry button.
- **ProposalCard approved:** Sage border, checkmark, "Applied" badge, auto-dismiss after 3s.
- **ProposalCard rejected:** Zinc border, "Dismissed" badge, auto-dismiss after 2s.
- **DiagramBlockView rendering:** Show skeleton with "Rendering diagram…" text while mermaid processes.
- **CodeSnippetBlockView copy success:** Transient checkmark on the copy button for 1.5s.

### 5.5 Animation Tokens

Standardize all transitions:

```typescript
const EASE = [0.16, 1, 0.3, 1] as const;
const FAST = { duration: 0.15, ease: EASE };
const NORMAL = { duration: 0.25, ease: EASE };
const SLOW = { duration: 0.4, ease: EASE };

// Standard variants
const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const blurFade = {
  initial: { opacity: 0, filter: 'blur(8px)' },
  animate: { opacity: 1, filter: 'blur(0px)' },
};
```

### 5.6 Accessibility

- All buttons have `aria-label` where icon-only.
- Flashcard uses `role="button"` and is keyboard-activatable.
- Proposal cards use `role="alert"` to announce to screen readers.
- Color is never the only signal — proposals have icons + text labels.
- Keyboard: `Enter` sends, `Shift+Enter` newline, `Esc` closes panel (preserved from `TutorPanel.tsx:266`).

### 5.7 Build Steps

After all Phase 1-5 changes:

1. **Preload rebuild:**
   ```bash
   npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
   ```
2. **Main process rebuild:**
   ```bash
   node scripts/rebuild-main.mjs
   ```
3. **Renderer build:**
   ```bash
   npx vite build
   ```
4. **Verify migrations** run on first launch — check console for `[learn] Applied migration: 003_learn_notes.sql` through `006_learn_permissions.sql`.

---

## Verification Matrix

| Feature | Manual Test | Expected Outcome |
|---------|-------------|------------------|
| Block response | Ask "Explain this" on a node | Response renders as multiple blocks (explanation, key_point, etc.), not raw markdown |
| Code snippet | Ask for an example | Code block with copy button; copy works |
| Flashcard | Ask "Quiz me" | Clickable flashcard with flip animation |
| Note proposal | Ask "Summarize this section" | Amber proposal card appears |
| Note auto-apply | Set `create_note` = `auto`, repeat question | Note created silently, visible in NotesPanel |
| Note blocked | Set `create_note` = `blocked`, repeat question | No card appears; (optional) toast "AI wanted to create a note but it's blocked" |
| Edit proposal | Select lesson text, ask "Can this be clearer?" | Edit diff card appears |
| Approve edit | Click Approve on edit card | Lesson content updates; node re-renders with new text |
| Reject edit | Click Reject | Card dismissed; no DB change |
| Multi-turn | Ask 3 questions in sequence | All 3 user+assistant pairs persist in panel |
| Conversation persistence | Refresh app, reopen tutor on same node | History restored |
| Streaming | Ask a long-form question | Blocks appear progressively (not all at once) |
| Stream cancel | Close panel mid-stream | No error toast; no orphan message in DB |
| Suggestions | After answer, look below input | 2-3 chip suggestions visible; clicking submits them |
| Panel resize | Drag left edge of tutor panel | Width changes; persists after refresh |
| Panel pop-out | Click pop-out icon | Modal overlay with larger panel |
| Mobile | Resize window to <768px | Panel becomes full-screen overlay |
| Dashboard streak | Open lesson, interact, go to dashboard | Streak = 1, flame icon lit |
| Dashboard mastery | Complete quiz at L2 | Mastery % increases |
| Dashboard continue | Click "Continue learning" | Navigates to last lesson+node |
| Dashboard due reviews | Wait until a node's `due_review` passes | "Due" badge appears with node link |
| Permission settings | Navigate to Learn → Settings | 4 action types with segmented controls |
| Permission reset | Click "Reset to defaults" | All modes return to confirm/auto defaults |
| Notes panel | Open notes panel | All notes for lesson listed; can delete |
| Backward compat | Existing lesson without tutor interaction | `answer_md` path still works for any code reading it |

---

## File Change Summary

### New Files

| Path | Purpose |
|------|---------|
| `src/shared/learn/types.ts` | (modified) New types appended |
| `src/services/learn/db/migrations/003_learn_notes.sql` | Notes table |
| `src/services/learn/db/migrations/004_learn_actions.sql` | Pending actions table |
| `src/services/learn/db/migrations/005_learn_conversations.sql` | Conversations + messages tables |
| `src/services/learn/db/migrations/006_learn_permissions.sql` | Permission settings table |
| `src/services/learn/services/note.service.ts` | Note CRUD |
| `src/services/learn/services/conversation.service.ts` | Conversation CRUD |
| `src/services/learn/services/permission.service.ts` | Permission check + CRUD |
| `src/services/learn/services/dashboard.service.ts` | Dashboard stats aggregation |
| `src/components/learn/tutor/TutorPanel.tsx` | Rewritten panel |
| `src/components/learn/tutor/ConversationView.tsx` | Message history list |
| `src/components/learn/tutor/MessageBubble.tsx` | Single message wrapper |
| `src/components/learn/tutor/TutorBlockRenderer.tsx` | Block dispatcher |
| `src/components/learn/tutor/ChatInput.tsx` | Auto-resize input + quick actions |
| `src/components/learn/tutor/PendingActionPill.tsx` | Floating pending counter |
| `src/components/learn/tutor/blocks/*.tsx` | 16 block view components |
| `src/components/learn/NotesPanel.tsx` | Notes list/CRUD |
| `src/components/learn/PermissionSettings.tsx` | Permission toggles UI |

### Modified Files

| Path | Changes |
|------|---------|
| `src/shared/learn/types.ts` | Add `TutorBlock`, `TutorResponse`, `Conversation`, `PendingAction`, `Note`, `PermissionSettings`, `LearnDashboardStats`, `TutorStreamChunk` |
| `src/services/learn/db/repo.ts` | Add note/action/conversation/permission prepared statements |
| `src/services/learn/services/tutor.service.ts` | Add `TUTOR_SYSTEM_PROMPT_V2`, `askV2()`, `askStream()`, `parseTutorResponse()`; constructor takes `ConversationService` + `callAiStream` |
| `src/services/learn/services/content.service.ts` | Add `applyEdit()` and `applyInsert()` static methods |
| `src/services/learn/promptLibrary.ts` | Add `prependTutorPersonaV2()` |
| `src/services/learn/index.ts` | Register new services + 13 new IPC channels + streaming handler + `applyAction()` helper |
| `src/services/providers/callProvider.ts` | Add `callProviderStream()` |
| `src/services/providers/router.ts` | (Optional) Add `runWithFallbackStream()` if more sophisticated fallback needed |
| `src/preload.ts` | Add 13 new IPC bridges + `onTutorChunk` listener + `learnCancelTutorStream` |
| `src/main.ts` | Pass `callAiStream` into `registerLearnHandlers` |
| `src/components/learn/LearnPage.tsx` | Add `'settings'` view; wire new `TutorPanel` props; route to `PermissionSettings` |
| `src/components/learn/TutorPanel.tsx` | (Deleted or replaced by `tutor/TutorPanel.tsx`) |
| `src/components/DashboardPage.tsx` | Add Learn section with 5 GlassCards |

### Unchanged (Backward Compatibility)

- `TutorAnswer` type — still exists, used as fallback shape
- `TUTOR_SYSTEM_PROMPT` — kept for any cached responses
- `renderAnswerHtml()` — reused inside `ExplanationBlockView`
- `useTypingEffect()` — removed (no longer needed) but old calls would still work if reintroduced
- All existing DB tables (`lessons`, `lesson_nodes`, `lesson_edges`, `evidence`, `tutor_cache`, `mastery_progress`, `curriculum_parts`, `profile_kv`) — untouched
- All existing IPC channels — untouched

---

## Implementation Order (Recommended)

1. **Phase 1.1-1.2:** Types + migrations (foundation, no UI impact)
2. **Phase 1.3-1.4:** Repo functions + service classes (testable via IPC immediately)
3. **Phase 1.5-1.8:** TutorService V2 + IPC + preload + main process streaming
4. **Phase 1.9-1.10:** Provider streaming + system prompt update
5. **Phase 3.1-3.5:** TutorPanel rewrite + block components (this is where UI becomes visible)
6. **Phase 3.6-3.11:** Individual block components + streaming state + verification
7. **Phase 2.1-2.5:** Proposal card components + approval flow (depends on Phase 3 block components)
8. **Phase 5.1-5.2:** Permission settings UI + notes panel
9. **Phase 4.1-4.5:** Dashboard section (independent of other phases; can parallelize)
10. **Phase 5.3-5.7:** Magic UI integration, animation polish, accessibility, final build

Each phase is independently shippable. Phase 1 alone gives us structured responses + persistence without UI changes (existing `TutorPanel` still works via `answer_md` fallback). Phase 3 is the visible "AI isn't a text bot" moment. Phase 2 unlocks the action vocabulary. Phase 4 surfaces everything on the dashboard.

---

**End of RESULT.md.**