import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Bold, Italic, Code2, Link2, List, ListOrdered, Quote, Heading1, Heading2,
  Paperclip, Sparkles, Eye, Pencil, Copy, Check, CheckSquare, X, FileText, MessageSquare,
} from 'lucide-react'
import {
  Bold, Italic, Code2, Link2, List, ListOrdered, Quote, Heading1, Heading2,
  Paperclip, Sparkles, Eye, Pencil, Copy, Check, X, FileText, MessageSquare,
} from 'lucide-react';
import { NoteContent } from './NoteContent';
import { buildToken, insertTokenAtCursor, type AttachmentKind } from '@/features/notes/attachments';

/**
 * Premium note body editor.
 *
 * The note body was a bare <Textarea> — a box you type into with no feedback,
 * no structure, and no way to reference the rest of the app. This adds:
 *
 *   1. A formatting toolbar that wraps the selection (works in a textarea, so
 *      there is no contenteditable XSS surface and undo still behaves).
 *   2. Keyboard shortcuts that match what a text editor already does.
 *   3. File-path attachments stored as `file://` links, so they open through the
 *      same Related list as everything else and survive a reload.
 *   4. AI-chat links from the Chat Library (`chat://<threadDate>`), so a note
 *      can point at the conversation that produced it.
 *   5. A live preview toggle for the Markdown body.
 *
 * LAMINAR: one signal hue per surface (var(--page-accent)), no raw hex, no
 * spring, no glassmorphism, transform/opacity transitions only.
 */

import { GoalPicker } from '@/components/goals/GoalPicker';

/* Goal titles via the same getGoalsBatch window GoalPicker reads, so the note
   rail shows the goal's name without adding an IPC channel. */
async function goalTitleFor(goalId: string): Promise<string | null> {
  const api = (window as any).deskflowAPI;
  if (!api?.getGoalsBatch) return null;
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date(d.getTime() + 120 * 864e5);
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const res = await api.getGoalsBatch('2000-01-01', endStr);
  for (const day of (res?.days || []) as any[])
    for (const g of (day.goals || []) as any[])
      if (g?.id === goalId) return g.title ?? null;
  return null;
}

export interface EditorLink { url: string; title?: string; open?: 'external' | 'inapp'; browser?: string }

const INK = {
  text: 'text-zinc-300',
  dim: 'text-zinc-600',
  hover: 'hover:text-zinc-100',
  active: 'text-zinc-100',
  chip: 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border-zinc-800/60',
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  links: EditorLink[];
  onLinksChange: (l: EditorLink[]) => void;
  files: string[];
  onFilesChange: (f: string[]) => void;
  /** The saved note id. Notes connect to goals through the SAME generic
      entity_links table the goal hub uses, so this needs no new IPC. */
  noteId?: string | null;
}

export function PremiumNoteEditor({ value, onChange, links, onLinksChange, files, onFilesChange, noteId }: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [insertMenuPos, setInsertMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [insertQuery, setInsertQuery] = useState('');
  const [todos, setTodos] = useState<{ id: string; text: string; done: number }[]>([]);
  const todoLinks = links.filter(l => l.url.startsWith('todo://'));
  const attachedTodoIds = new Set(todoLinks.map(l => l.url.slice('todo://'.length)));

  /* Tasks attach as todo:// links on the note's existing link list, so this
     needs no schema change and no new IPC. */
  const loadTodos = useCallback(async () => {
    const api = (window as any).deskflowAPI;
    if (!api?.todoList) return;
    try {
      const res = await api.todoList();
      const rows = Array.isArray(res) ? res : (res?.data ?? res?.todos ?? []);
      if (Array.isArray(rows)) setTodos(rows.filter((t: any) => t && t.id));
    } catch { setTodos([]); }
  }, []);

  const attachTodo = useCallback((t: { id: string; text: string }) => {
    const url = `todo://${t.id}`;
    if (links.some(l => l.url === url)) return;
    onLinksChange([...links, { url, title: t.text, open: 'inapp' }]);
  }, [links, onLinksChange]);

  const toggleTodo = useCallback(async (id: string) => {
    const api = (window as any).deskflowAPI;
    if (!api?.todoToggle) return;
    await api.todoToggle(id);
    await loadTodos();
  }, [loadTodos]);
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState<string | null>(null);

  /* Note -> goal connection. entity_links is generic (feature + entity_id), so
     a note is just feature='note'. Reads on open, writes on pick. */
  useEffect(() => {
    let alive = true;
    if (!noteId) { setGoalId(null); setGoalTitle(null); return; }
    const api = (window as any).deskflowAPI;
    if (!api?.entityGetLinks) return;
    api.entityGetLinks('note', noteId)
      .then((r: any) => {
        const id = r?.ok ? (r.data?.[0] ?? null) : (Array.isArray(r) ? r[0] ?? null : null);
        if (!alive) return;
        setGoalId(id || null);
        if (!id) { setGoalTitle(null); return; }
        return goalTitleFor(id).then(t => { if (alive) setGoalTitle(t); });
      })
      .catch(() => { /* no connection is a valid state, not an error */ });
    return () => { alive = false; };
  }, [noteId]);

  const attachGoal = useCallback((id: string | null) => {
    setGoalId(id);
    setGoalTitle(null);
    if (!noteId) return;
    const api = (window as any).deskflowAPI;
    if (!api?.entityLink) return;
    api.entityLink({ feature: 'note', entityId: noteId, goalId: id, label: 'goal' });
    if (id) goalTitleFor(id).then(setGoalTitle);
  }, [noteId]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  /* ── selection wrapping ──
     Applies markdown around the current selection and restores the caret
     inside the wrapper, so typing continues where you expect. */
  const wrap = useCallback((before: string, after = before, placeholder = 'text') => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const sel = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + before.length;
      ta.setSelectionRange(caret, caret + sel.length);
    });
  }, [value, onChange]);

  const prefixLines = useCallback((marker: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const block = value.slice(start, end) || 'List item';
    const next = block.split('\n').map(l => marker + l).join('\n');
    onChange(value.slice(0, start) + next + value.slice(end));
    requestAnimationFrame(() => ta.focus());
  }, [value, onChange]);

  const insertLine = useCallback((prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const atLineStart = pos === 0 || value[pos - 1] === '\n';
    const next = atLineStart ? value.slice(0, pos) + prefix + value.slice(pos)
                              : value.slice(0, pos) + '\n' + prefix + value.slice(pos);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = pos + prefix.length + (atLineStart ? 0 : 1);
      ta.setSelectionRange(caret, caret);
    });
  }, [value, onChange]);

  /* ── shortcuts: the ones a text editor already teaches ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); wrap('**', '**', 'bold'); }
      else if (k === 'i') { e.preventDefault(); wrap('_', '_', 'italic'); }
      else if (k === 'k') { e.preventDefault(); wrap('[', '](https://)', 'link text'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wrap]);

  /* ── attach a file path as a link so it opens like any other reference ── */
  /* showOpenDialog is the real bridge — it returns { canceled, filePaths[] }.
     (The pre-existing button in NotesTab called a `dialogOpenFile` that does
     not exist on the preload, so attachment has never worked.) */
  /* INSERT AN ATTACHMENT INTO THE TEXT, AT THE CARET.
     This is the change that makes an attachment part of the note instead of a
     list beside it. The toolbar already had "attach a file / a task / a chat" —
     every one of them appended to a `links`/`files` array that rendered as a
     separate block UNDER the note, so the thing you were writing about and the
     thing you were pointing at were in two different places on screen.
     The storage stays plain text (`[[file:/a/b.png]]`); only the position
     changes, and the reader renders it inline as a chip. */
  const insertInline = useCallback((kind: AttachmentKind, value: string, label?: string) => {
    const token = buildToken(kind, value, label);
    if (!token) return;
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? value.length;
    const next = insertTokenAtCursor(value, pos, token);
    onChange(next.content);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(next.cursor, next.cursor);
    });
  }, [value, onChange]);

  const handleInsertToken = useCallback((token: string) => {
    const start = taRef.current?.selectionStart ?? 0;
    const end = taRef.current?.selectionEnd ?? 0;
    const before = value.slice(0, start);
    const after = value.slice(end);
    onChange(before + token + after);
    // Move cursor after the inserted token
    setTimeout(() => {
      if (taRef.current) {
        taRef.current.focus();
        taRef.current.setSelectionRange(start + token.length, start + token.length);
      }
    }, 0);
    setInsertMenuOpen(false);
  }, [value, onChange]);

  const openInsertMenu = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    setInsertMenuPos({ x: rect.left, y: rect.bottom + 4 });
    setInsertMenuOpen(true);
    setInsertQuery('');
  }, []);

  const closeInsertMenu = useCallback(() => {
    setInsertMenuOpen(false);
  }, []);

  const filteredInsertItems = useMemo(() => {
    if (!insertQuery.trim()) return INSERT_ITEMS;
    const q = insertQuery.toLowerCase();
    return INSERT_ITEMS.filter(item => item.label.toLowerCase().includes(q) || item.keywords.some(k => k.includes(q)));
  }, [insertQuery]);

  const attachFile = async () => {
    const api = (window as any).deskflowAPI;
    if (!api?.showOpenDialog) return;
    const res = await api.showOpenDialog({ properties: ['openFile'] });
    if (res?.canceled || !Array.isArray(res?.filePaths)) return;
    // Image extensions go in as INLINE image tokens so they render as the picture
    // itself, at the point in the sentence that mentions it. Everything else is a
    // file chip. Both are inserted at the caret rather than appended to a list,
    // so the attachment lands where the author is actually writing.
    const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    for (const path of res.filePaths as string[]) {
      // `value` is the body text prop — checking it stops the same file being
      // attached twice in one note, which would otherwise produce two identical
      // chips (the removal path is offset-based, so both would need removing).
      if (files.includes(path) || value.includes(path)) continue;
      insertInline(IMAGE_RE.test(path) ? 'image' : 'file', path);
    }
  };

  const loadChats = async () => {
    setChatOpen(true);
    if (chats.length) return;
    try {
      const res = await (window as any).deskflowAPI?.chatLibrarySearch?.({ limit: 20 });
      const rows = (res?.hits || []).slice(0, 20);
      setChats(rows.map((r: any) => ({ id: String(r.thread_date ?? r.date ?? r.id), title: r.title || 'Untitled chat' })));
    } catch { setChats([]); }
  };

  const addChatLink = (c: { id: string; title: string }) => {
    if (!links.some(l => l.url === `chat://${c.id}`)) {
      onLinksChange([...links, { url: `chat://${c.id}`, title: c.title, open: 'inapp' }]);
    }
    setChatOpen(false);
  };

  const copyBody = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const fileLinks = links.filter(l => l.url.startsWith('file://'));
  const chatLinks = links.filter(l => l.url.startsWith('chat://'));
  const otherLinks = links.filter(l => !l.url.startsWith('file://') && !l.url.startsWith('chat://'));

  return (
    <div className="relative flex flex-col gap-2 min-h-0 flex-1">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 shrink-0">
        <ToolBtn label="Bold (Ctrl+B)" onClick={() => wrap('**', '**', 'bold')}><Bold size={13} /></ToolBtn>
        <ToolBtn label="Italic (Ctrl+I)" onClick={() => wrap('_', '_', 'italic')}><Italic size={13} /></ToolBtn>
        <ToolBtn label="Heading" onClick={() => insertLine('## ')}><Heading1 size={13} /></ToolBtn>
        <ToolBtn label="Subheading" onClick={() => insertLine('### ')}><Heading2 size={13} /></ToolBtn>
        <ToolSep />
        <ToolBtn label="Bulleted list" onClick={() => prefixLines('- ')}><List size={13} /></ToolBtn>
        <ToolBtn label="Numbered list" onClick={() => prefixLines('1. ')}><ListOrdered size={13} /></ToolBtn>
        <ToolBtn label="Quote" onClick={() => insertLine('> ')}><Quote size={13} /></ToolBtn>
        <ToolBtn label="Code" onClick={() => wrap('`', '`', 'code')}><Code2 size={13} /></ToolBtn>
        <ToolBtn label="Link (Ctrl+K)" onClick={() => wrap('[', '](https://)', 'link text')}><Link2 size={13} /></ToolBtn>
        <ToolSep />
        <ToolBtn label="Attach a file path" onClick={attachFile}><Paperclip size={13} /></ToolBtn>
        <ToolBtn label="Attach a task" onClick={() => { setTodoOpen(v => !v); if (!todoOpen) loadTodos(); }}><CheckSquare size={13} /></ToolBtn>
        <ToolBtn label="Link an AI chat" onClick={loadChats}><MessageSquare size={13} /></ToolBtn>

        <div className="hidden" />
        <ToolBtn label={copied ? 'Copied' : 'Copy note body'} onClick={copyBody}>
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </ToolBtn>
        <ToolBtn
          label={mode === 'write' ? 'Preview' : 'Edit'}
          onClick={() => setMode(m => (m === 'write' ? 'preview' : 'write'))}
          active={mode === 'preview'}
        >
          {mode === 'write' ? <Eye size={13} /> : <Pencil size={13} />}
        </ToolBtn>
      </div>

      {/* Insert menu dropdown */}
      {insertMenuOpen && insertMenuPos && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          style={{ left: insertMenuPos.x, top: insertMenuPos.y }}
          className="absolute z-50 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-1"
          role="menu"
        >
          <input
            type="text"
            value={insertQuery}
            onChange={e => setInsertQuery(e.target.value)}
            placeholder="Search..."
            className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-[var(--page-accent)] mb-1"
            onKeyDown={e => {
              if (e.key === 'Escape') closeInsertMenu();
            }}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto">
            {filteredInsertItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleInsertToken(item.token(''))}
                className="w-full px-2 py-1.5 text-sm text-left text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2"
                onMouseDown={e => e.preventDefault()}
              >
                <span className="text-zinc-500 text-xs uppercase tracking-wider">{item.id}</span>
                <span>{item.label}</span>
              </button>
            ))}
            {filteredInsertItems.length === 0 && (
              <div className="px-2 py-2 text-sm text-zinc-500">No matches</div>
            )}
          </div>
        </motion.div>
      )}

      {/* body */}
      {mode === 'write' ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={e => {
            const next = e.target.value;
            onChange(next);
            /* `[[` is the trigger, and it is the SAME token the reader parses.
               Typing it opens the menu anchored to the CARET — not to the
               toolbar button — so the attachment lands in the sentence you are
               writing rather than wherever the caret happened to be left. That
               is the whole point of "inline, not on the sides". */
            const el = e.target;
            const upto = next.slice(0, el.selectionStart);
            if (upto.endsWith('[[') && !el.value.slice(el.selectionStart).startsWith(']')) {
              const r = el.getBoundingClientRect();
              const line = upto.slice(0, upto.lastIndexOf('\n')).split('\n').length - 1;
              const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
              setInsertMenuPos({
                x: Math.min(r.left + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240),
                y: r.top + (line + 1) * lineHeight + 4,
              });
              setInsertMenuOpen(true);
              setInsertQuery('');
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape' && insertMenuOpen) { setInsertMenuOpen(false); return; }
          }}
          placeholder="Write anything. Markdown works — **bold**, # headings, - lists, > quotes, `code`."
          rows={10}
          aria-label="Note body"
          className="w-full flex-1 min-h-[140px] resize-none overflow-y-auto rounded-lg border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] px-3 py-2.5 text-[13px] leading-[1.7] text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors focus-visible:border-zinc-600"
        />
      ) : (
        <div
          className="w-full flex-1 min-h-[140px] overflow-y-auto rounded-lg border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] px-3 py-2.5 text-[13px] leading-[1.7]"
          aria-label="Note preview"
        >
          {/* The READER's renderer, not MarkdownPreview. If the editor preview
              and the reader disagreed, a token would look like raw text while
              writing and like a chip once saved — which teaches the author that
              the chip is unreliable. One renderer, two call sites. */}
          <NoteContent content={value} className="text-[13px] leading-[1.7]" />
        </div>
      )}

      {/* attached files */}
      {fileLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0 max-h-24 overflow-y-auto">
          {fileLinks.map(l => (
            <span key={l.url} className={`inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md border text-[11px] ${INK.chip} ${INK.text}`}>
              <FileText size={10} className="shrink-0 opacity-70" />
              <span className="truncate">{l.title || l.url.replace('file://', '')}</span>
              <button
                type="button"
                aria-label={`Remove ${l.title || 'file'}`}
                onClick={() => {
                  onLinksChange(links.filter(x => x.url !== l.url));
                  onFilesChange(files.filter(f => `file://${f}` !== l.url));
                }}
                className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* attached tasks */}
      {todoLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {todoLinks.map(l => (
            <span key={l.url} className={`inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md border text-[11px] ${INK.chip} ${INK.text}`}>
              <CheckSquare size={10} className="shrink-0 opacity-70" />
              <span className="truncate">{l.title || 'Task'}</span>
              <button
                type="button"
                aria-label={`Remove ${l.title || 'task'}`}
                onClick={() => onLinksChange(links.filter(x => x.url !== l.url))}
                className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* linked AI chats */}
      {chatLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chatLinks.map(l => (
            <span key={l.url} className={`inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md border text-[11px] ${INK.chip} ${INK.text}`}>
              <Sparkles size={10} className="shrink-0 opacity-70" />
              <span className="truncate">{l.title || 'AI chat'}</span>
              <button
                type="button"
                aria-label={`Remove ${l.title || 'chat link'}`}
                onClick={() => onLinksChange(links.filter(x => x.url !== l.url))}
                className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* non-file / non-chat links keep their existing chips; this is just the count */}
      {otherLinks.length > 0 && (
        <p className="text-[10px] text-zinc-600">{otherLinks.length} other link{otherLinks.length === 1 ? '' : 's'} attached</p>
      )}

      {/* ── Attachments ── goal first: it is the primary reason to connect a note */}
      <div className="shrink-0 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2.5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Attachments</p>
        <div>
          <p className="text-[11px] text-zinc-400 mb-1.5">
            Goal{goalTitle ? <span className="text-zinc-200"> — {goalTitle}</span> : <span className="text-zinc-600">not linked</span>}
          </p>
          {noteId ? (
            <GoalPicker value={goalId} onChange={attachGoal} size="sm" />
          ) : (
            <p className="text-[10px] text-zinc-600">Save the note to link it to a goal.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400">
            Tasks{todoLinks.length > 0 ? <span className="text-zinc-200"> — {todoLinks.length}</span> : <span className="text-zinc-600">none</span>}
          </span>
          <button
            type="button"
            onClick={() => { setTodoOpen(v => !v); if (!todoOpen) loadTodos(); }}
            className="text-[10px] px-2 py-1 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors shrink-0"
          >
            {todoOpen ? 'Done' : 'Attach task'}
          </button>
        </div>
      </div>

      {/* task picker */}
      {todoOpen && (
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900 p-2 max-h-40 shrink-0 overflow-y-auto">
          <p className="text-[10px] text-zinc-500 mb-1.5">Attach a task from your TodoList</p>
          {todos.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No tasks yet.</p>
          ) : (
            todos.map(t => {
              const on = attachedTodoIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (on ? toggleTodo(t.id) : attachTodo(t))}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] text-zinc-300 hover:bg-zinc-800/60"
                >
                  <CheckSquare size={10} className={`shrink-0 ${on ? 'opacity-90 text-emerald-400' : 'opacity-50'}`} />
                  <span className={`truncate ${t.done ? 'line-through text-zinc-600' : ''}`}>{t.text}</span>
                  {on && <span className="ml-auto text-[9px] uppercase tracking-wider text-emerald-400/80 shrink-0">on note</span>}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* chat picker */}
      {chatOpen && (
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900 light:bg-[var(--ws-surface-raised)] p-2 max-h-40 shrink-0 overflow-y-auto">
          <p className="text-[10px] text-zinc-500 mb-1.5">Link a conversation from your AI chat library</p>
          {chats.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No chats found yet.</p>
          ) : (
            chats.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => addChatLink(c)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              >
                <MessageSquare size={10} className="shrink-0 opacity-60" />
                <span className="truncate">{c.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── toolbar button ── */
function ToolBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
    >
      {children}
    </button>
  );
}
function ToolSep() { return <span className="w-px h-4 mx-1 bg-zinc-800" aria-hidden />; }

export default PremiumNoteEditor;
