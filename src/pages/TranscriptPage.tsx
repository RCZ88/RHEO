import * as React from 'react';
import { usePageSurface } from './registry/usePageSurface';
import transcriptsManifest from './registry/pages/transcripts';
import { PageShell } from '@/components/PageShell';
import { getStore, SttCategoryColors, type SttTranscript } from '@/lib/sttStore';
import { cn } from '@/lib/utils';
import {
  CircleHelp,
  Copy,
  FileText,
  HardDrive,
  Mic,
  Search,
  Trash2,
} from 'lucide-react';

console.log(
  '%c[TranscriptPage] v1.0 loaded',
  'color: #fbbf24; font-weight: bold',
);
console.log('[TranscriptPage] categories:', Object.keys(SttCategoryColors).join(', '));

/**
 * TranscriptPage — everything the dictation widget has captured.
 *
 * `/transcripts` is LB-04 in `src/components/labs/labRegistry.ts`. The widget
 * saves every finished recording to the `stt_transcripts` table and copies it to
 * the clipboard; this page is the read surface for what it writes, and the only
 * place a saved transcript can be found again after the widget's own transient
 * message is gone.
 *
 * `data-page="stt"` is not decoration: index.css already declares
 * `[data-page="stt"] { --page-accent: #8b5cf6 }`, so the signal hue is the same
 * token the floating widget uses, and the lab card's `entry.accent` matches it.
 *
 * LAMINAR: one signal hue, radii 8/12/pill, two font families (sans + mono for
 * timestamps), no raw hex in this file, no spring, `prefers-reduced-motion`
 * honoured via the shared motion tokens rather than a local keyframe.
 */

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; reason: string }
  | { kind: 'ready'; items: SttTranscript[] };

function clockTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

function relative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return '';
  }
}

function duration(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function excerpt(text: string, max = 240): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default function TranscriptPage() {
  usePageSurface(transcriptsManifest);
  const [load, setLoad] = React.useState<Load>({ kind: 'loading' });
  const [query, setQuery] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [widgetOpen, setWidgetOpen] = React.useState(false);
  const [engine, setEngine] = React.useState<{
    label: string;
    localAvailable: boolean;
    localReason: string;
    localInstall: string;
    localVersion: string | null;
  } | null>(null);

  const reload = React.useCallback(async () => {
    setLoad({ kind: 'loading' });
    try {
      const store = await getStore();
      setLoad({ kind: 'ready', items: await store.list() });
    } catch (err) {
      setLoad({
        kind: 'error',
        reason: err instanceof Error ? err.message : 'Could not read saved transcripts.',
      });
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await window.haloBridge?.getSnapshot?.();
        if (!cancelled && s) setWidgetOpen(!!s.open);
      } catch { /* cosmetic */ }
    })();
    const off = window.haloBridge?.onHover?.((s) => {
      if (!cancelled) setWidgetOpen(!!s.open);
    });
    return () => {
      cancelled = true;
      if (typeof off === 'function') off();
    };
  }, []);

  const toggleWidget = async () => {
    try {
      const s = await window.haloBridge?.open?.();
      if (s && typeof s.open === 'boolean') setWidgetOpen(s.open);
    } catch {
      setWidgetOpen(false);
    }
  };

  React.useEffect(() => {
    void reload();
    let cancelled = false;
    void (async () => {
      try {
        const s = await window.deskflowAPI?.sttGetStatus?.();
        if (!cancelled && s) setEngine(s as never);
      } catch {
        if (!cancelled) setEngine(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const copy = React.useCallback(async (t: SttTranscript) => {
    try {
      await navigator.clipboard.writeText(t.text);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId((id) => (id === t.id ? null : id)), 1800);
    } catch {
      setCopiedId(null);
    }
  }, []);

  const remove = React.useCallback(
    async (t: SttTranscript) => {
      try {
        const store = await getStore();
        await store.remove(t.id);
        setLoad((prev) =>
          prev.kind === 'ready'
            ? { kind: 'ready', items: prev.items.filter((i) => i.id !== t.id) }
            : prev,
        );
      } catch {
        void reload();
      }
    },
    [reload],
  );

  const items = load.kind === 'ready' ? load.items : [];
  const needle = query.trim().toLowerCase();
  const shown = needle ? items.filter((t) => (t.text || '').toLowerCase().includes(needle)) : items;
  const words = items.reduce((n, t) => n + (t.text || '').trim().split(/\s+/).filter(Boolean).length, 0);

  return (
    <PageShell page="stt" variant="default" className="p-6 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Lab LB-04 · Transcripts
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Dictation library
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Everything the floating dictation widget has spoken, kept in one place.
          Each finished recording is transcribed on this machine and written to the
          library, and is also placed on your clipboard.
        </p>
        <button
          type="button"
          onClick={() => void toggleWidget()}
          className="mt-1 inline-flex items-center gap-2 self-start rounded-lg border border-[var(--border-default)] px-3 py-2 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          <Mic size={13} className="text-[var(--page-accent)]" />
          {widgetOpen ? 'Hide dictation widget' : 'Show dictation widget'}
        </button>
      </header>

      {/* ── Engine status ─────────────────────────────────────────── */}
      <div
        data-section="transcripts.how"
        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2"
      >
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-[var(--page-accent)]" />
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
            Where transcription runs
          </h2>
        </div>
        {engine ? (
          <>
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
              Engine:{' '}
              <span className="font-mono text-[var(--text-primary)]">{engine.label}</span>
              {engine.localVersion && (
                <span className="text-[var(--text-muted)]"> · faster-whisper {engine.localVersion}</span>
              )}
            </p>
            {engine.localAvailable ? (
              <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                Audio is decoded and transcribed locally with int8 quantisation on the CPU.
                Nothing is uploaded, and no account or API key is involved.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-[var(--error)]">
                On-device transcription is not available: {engine.localReason}
                {engine.localInstall && (
                  <>
                    {' '}
                    Run <span className="font-mono">{engine.localInstall}</span> and restart RHEO.
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-[var(--text-muted)]">Checking the speech engine…</p>
        )}
        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
          Press{' '}
          <span className="font-mono text-[var(--text-secondary)]">Ctrl+Shift+R</span> to start
          and stop dictating from anywhere in the app, or{' '}
          <span className="font-mono text-[var(--text-secondary)]">Ctrl+Shift+V</span> to show or
          hide the floating widget.
        </p>
      </div>

      {/* ── Search ────────────────────────────────────────────────── */}
      <div data-section="transcripts.search" className="space-y-2">
        <div className="relative">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts"
            aria-label="Search transcripts"
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] py-2.5 pl-9 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus-visible:border-[var(--page-accent)]"
          />
        </div>
        <p className="font-mono text-[11px] text-[var(--text-muted)]">
          {load.kind === 'ready'
            ? `${items.length} transcript${items.length === 1 ? '' : 's'} · ${words} words${needle ? ` · ${shown.length} matching` : ''}`
            : ' '}
        </p>
      </div>

      {/* ── List ──────────────────────────────────────────────────── */}
      <section data-section="transcripts.all" aria-label="Saved transcripts" className="space-y-2">
        {load.kind === 'loading' && (
          <ul className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-20 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                style={{ opacity: 0.65 - i * 0.13 }}
              />
            ))}
          </ul>
        )}

        {load.kind === 'error' && (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2">
            <p className="text-[13px] text-[var(--error)]">{load.reason}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Try again
            </button>
          </div>
        )}

        {load.kind === 'ready' && items.length === 0 && (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-6 py-10 text-center space-y-2">
            <FileText size={20} className="mx-auto text-[var(--text-muted)]" />
            <p className="text-[13px] text-[var(--text-primary)]">No transcripts yet</p>
            <p className="mx-auto max-w-md text-[12px] leading-relaxed text-[var(--text-muted)]">
              Dictate with <span className="font-mono">Ctrl+Shift+R</span> and press Stop. The
              words land here and on your clipboard.
            </p>
          </div>
        )}

        {load.kind === 'ready' && items.length > 0 && shown.length === 0 && (
          <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-5 text-center text-[12px] text-[var(--text-muted)]">
            Nothing matches “{query.trim()}”.
          </p>
        )}

        {shown.length > 0 && (
          <ul className="space-y-2">
            {shown.map((t) => {
              const copied = copiedId === t.id;
              const dur = duration(t.durationMs);
              return (
                <li
                  key={t.id}
                  className={cn(
                    'flex items-start gap-4 rounded-xl border border-[var(--border-default)]',
                    'bg-[var(--bg-secondary)] p-4 transition-colors',
                    'hover:border-[var(--border-strong)]',
                  )}
                >
                  <div className="flex w-16 shrink-0 flex-col gap-0.5">
                    <span className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">
                      {clockTime(t.createdAt)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {relative(t.createdAt)}
                    </span>
                    {dur && (
                      <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                        {dur}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                      {excerpt(t.text)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        {t.category || 'note'}
                      </span>
                      {t.source && (
                        <span className="text-[10px] text-[var(--text-muted)]">{t.source}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copy(t)}
                      title="Copy transcript"
                      aria-label={`Copy transcript from ${relative(t.createdAt)}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--page-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(t)}
                      title="Delete transcript"
                      aria-label={`Delete transcript from ${relative(t.createdAt)}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                    >
                      <Trash2 size={14} />
                    </button>
                    {copied && (
                      <span
                        role="status"
                        className="ml-1 text-[11px] text-[var(--success)]"
                        aria-live="polite"
                      >
                        Copied
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="flex items-start gap-2 border-t border-[var(--border-default)] pt-4">
        <CircleHelp size={13} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        <p className="max-w-2xl text-[12px] leading-relaxed text-[var(--text-muted)]">
          Counts on this page are read from the library at load time, so they cannot drift from
          the stored data. {Object.keys(SttCategoryColors).length} categories are available; the
          dictation widget writes to the <span className="font-mono">note</span> category.
        </p>
      </footer>
    </PageShell>
  );
}