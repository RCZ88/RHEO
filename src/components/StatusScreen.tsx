import { type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Home, Activity, Terminal, Code2, Settings } from 'lucide-react';

// ── STATUS SCREEN — the ONE fault/absence surface in RHEO ────────────────────
// Used by ErrorBoundary (crash), NotFoundPage (404), SelfErrorBoundary (panel).
// There is deliberately no second error-page style in this codebase.
//
// Design thesis: a fault is a READOUT, not a decoration. Mono uppercase eyebrow =
// telemetry line; 18px Inter title = the headline; one plain sentence = the cause;
// raw internals collapse behind a disclosure instead of shouting.
//
// LAMINAR: one signal hue per surface (§2 — rose is error-only, amber is
// absence/warning, zinc is neutral); radii 8/12/pill only (§4); no emoji (§7.5);
// no raw hex (§7.7); no backdrop-blur on chrome (§7.3); Inter + JetBrains Mono = the
// 2-font ceiling (§3). Motion is L1 Composed: 150ms colour only, nothing moves
// except the pressed button (motion-alive).

export type StatusTone = 'error' | 'warning' | 'neutral';

export interface StatusAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  /** Primary = the single filled action. Exactly one per screen. */
  primary?: boolean;
  disabled?: boolean;
}

export interface StatusDestination {
  label: string;
  path: string;
  icon: ReactNode;
}

/** The single shared escape route list — identical order in every fault surface. */
export const STATUS_DESTINATIONS: StatusDestination[] = [
  { label: 'Dashboard', path: '/', icon: <Home className="h-3.5 w-3.5" /> },
  { label: 'Activity', path: '/activity', icon: <Activity className="h-3.5 w-3.5" /> },
  { label: 'Terminal', path: '/terminal', icon: <Terminal className="h-3.5 w-3.5" /> },
  { label: 'IDE', path: '/ide', icon: <Code2 className="h-3.5 w-3.5" /> },
  { label: 'Settings', path: '/settings', icon: <Settings className="h-3.5 w-3.5" /> },
];

const TONE: Record<StatusTone, { text: string; tile: string; hairline: string }> = {
  error: { text: 'text-rose-400', tile: 'border-rose-500/30 bg-rose-500/10', hairline: 'border-rose-500/30' },
  warning: { text: 'text-amber-400', tile: 'border-amber-500/30 bg-amber-500/10', hairline: 'border-amber-500/30' },
  neutral: { text: 'text-zinc-400', tile: 'border-white/10 bg-zinc-800/60', hairline: 'border-white/10' },
};

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-medium ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-surface)] disabled:opacity-40 disabled:cursor-not-allowed';

export function StatusButton({
  label,
  onClick,
  icon,
  primary = false,
  disabled = false,
  tone = 'error',
}: StatusAction & { tone?: StatusTone }) {
  const ring = tone === 'error' ? 'focus-visible:ring-rose-500/50' : tone === 'warning' ? 'focus-visible:ring-amber-500/50' : 'focus-visible:ring-zinc-500/50';
  const cls = primary
    ? 'bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.98] ' + ring
    : 'border border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.98] ' + ring;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${btnBase} h-11 ${cls}`}>
      {icon}
      {label}
    </button>
  );
}

export function StatusScreen({
  tone = 'error',
  eyebrow,
  title,
  description,
  detail,
  detailLabel = 'Technical detail',
  actions = [],
  destinations = [],
  onNavigate,
  copied = false,
  onCopy,
  className = '',
}: {
  tone?: StatusTone;
  eyebrow: string;
  title: string;
  description: string;
  detail?: string | null;
  detailLabel?: string;
  actions?: StatusAction[];
  destinations?: StatusDestination[];
  onNavigate?: (path: string) => void;
  copied?: boolean;
  onCopy?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  const Icon = tone === 'error' ? AlertTriangle : tone === 'warning' ? AlertTriangle : RefreshCw;

  return (
    <section
      role="alert"
      aria-live="polite"
      className={`flex min-h-full w-full flex-col items-center justify-center bg-[var(--ws-surface)] px-6 py-10 ${className}`}
    >
      <div className="w-full max-w-[520px]">
        {/* ── Hero: the status line + the headline, side by side ─────────── */}
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${t.tile} ${t.text}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">{eyebrow}</p>
            <h1 className="mt-1 text-[18px] font-semibold leading-tight text-zinc-100">{title}</h1>
          </div>
        </div>

        {/* ── Cause: one plain sentence. No jargon, no "please try again". ── */}
        <p className="mt-4 max-w-[60ch] text-[13px] leading-relaxed text-zinc-400">{description}</p>

        {/* ── Detail: collapsed by default. Internals must not shout. ─────── */}
        {detail && (
          <div className={`mt-5 rounded-xl border border-white/10 bg-zinc-900/60`}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">{detailLabel}</span>
              {onCopy && (
                <button
                  type="button"
                  onClick={onCopy}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ${t.text} focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-surface)] hover:bg-zinc-800`}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <details className="group px-3 py-2">
              <summary className="cursor-pointer list-none font-mono text-[11px] text-zinc-500 transition-colors duration-150 hover:text-zinc-300">
                Show message
              </summary>
              <p className={`mt-2 break-words font-mono text-[11px] leading-relaxed ${t.text}`}>{detail}</p>
            </details>
          </div>
        )}

        {/* ── Actions: exactly one primary, ghosts are demoted ───────────── */}
        {actions.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <StatusButton key={a.label} {...a} tone={tone} />
            ))}
          </div>
        )}

        {/* ── Escape routes: the same five, in the same order, everywhere ── */}
        {onNavigate && destinations.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Go to</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {destinations.map((d) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => onNavigate(d.path)}
                  className={`${btnBase} h-9 border border-white/10 bg-transparent px-3 text-[12px] text-zinc-400 hover:border-white/20 hover:bg-zinc-900 hover:text-zinc-200 focus-visible:ring-zinc-500/50`}
                >
                  {d.icon}
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default StatusScreen;
