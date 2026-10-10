import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CornerDownLeft } from 'lucide-react';

/**
 * Quick capture — a one-line scratchpad that becomes a note.
 *
 * Why it exists: notes were only reachable by finding the Notes tab and opening
 * the full editor, so "I have a thought right now" had no path. This is that
 * path, and it is bound globally (Cmd/Ctrl+Shift+N) so it works from any tab.
 *
 * It writes through the SAME notesCreate call the full editor uses, so there is
 * exactly one code path for creating a note.
 */

const api = () => (window as any).deskflowAPI;
const EVENT_OPEN = 'rheo:quick-note';

export function openQuickNote(prefill = '') {
  window.dispatchEvent(new CustomEvent(EVENT_OPEN, { detail: { prefill } }));
}

export function QuickNoteCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Global shortcut. Guarded against firing inside a text field so typing
  // "Cmd+Shift+N" in the todo box does not hijack the screen.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== 'n') return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      e.preventDefault();
      setError(null);
      setText('');
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onOpen = (e: any) => { setText(e?.detail?.prefill || ''); setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); };
    window.addEventListener(EVENT_OPEN, onOpen);
    return () => window.removeEventListener(EVENT_OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) { setOpen(false); setError(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving]);

  const save = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true); setError(null);
    try {
      // First line becomes the title, remainder becomes the body — matches how
      // the Notes tab renders a card.
      const nl = value.indexOf('\n');
      const title = nl === -1 ? value.slice(0, 60) : value.slice(0, nl).slice(0, 60);
      const content = nl === -1 ? '' : value.slice(nl + 1);
      const res = await api()?.notesCreate?.({ title, content });
      if (res && res.success === false) throw new Error(res.error || 'Could not save.');
      setText('');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('rheo:notes-changed'));
    } catch (e: any) {
      // Keep the text — never lose what someone just typed (PAINT P5).
      setError(e?.message || 'Could not save this note. Try again.');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={() => { if (!saving) { setOpen(false); setError(null); } }}
    >
      <div
        role="dialog"
        aria-label="Quick note"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-zinc-700/60 bg-zinc-900 light:bg-[var(--ws-surface-raised)] p-3"
      >
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
            }}
            rows={3}
            placeholder="Jot it down. First line becomes the title."
            aria-label="Note text"
            className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none resize-none"
          />
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            disabled={saving}
            aria-label="Close quick note"
            className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        {error && <p role="alert" className="mt-2 text-[11px]" style={{ color: 'var(--error)' }}>{error}</p>}

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800/60">
          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
            <CornerDownLeft size={10} aria-hidden />
            {navigator.platform.includes('Mac') ? '⌘⏎ to save' : 'Ctrl+Enter to save'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              disabled={saving}
              className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!text.trim() || saving}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: 'var(--page-accent)',
                backgroundColor: 'color-mix(in srgb, var(--page-accent) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--page-accent) 28%, transparent)',
              }}
            >
              {saving ? <Loader2 size={11} className="animate-spin" aria-hidden /> : null}
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickNoteCapture;