import { motion } from 'framer-motion';
import { Keyboard, RefreshCw, List, Film } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';
import { useRewindSetting, effectiveMotion } from '@/features/rewind-nav/useRewindSetting';
import type { RewindMode, RewindMotion } from '@/features/rewind-nav/useRewindSetting';

interface ShortcutSectionProps {
  shortcuts: Record<string, string>;
  setShortcuts: (v: Record<string, string>) => void;
  recordingKey: string | null;
  setRecordingKey: (v: string | null) => void;
  SHORTCUT_CONFIG: Record<string, string>;
  restoreDefaults: () => void;
  settingsSearch: string;
}

/**
 * DESIGN INTENT (AGENTS.md §5b)
 *
 * 1. Idea — the setting IS the choice, so the control shows the two modes as what
 *    they actually look like. A radio pair labelled "Classic / Film" makes you
 *    read; two miniature diagrams make you recognise.
 * 2. Meaning — you pick by seeing the shape, so each card carries a real diagram:
 *    stacked rows for the list, a reel plus a sprocket strip for the film. The
 *    diagrams are drawn from the real component proportions, not decorative icons.
 * 3. Hierarchy — the SELECTED card is the only amber thing on screen. Nothing else
 *    competes, so "which one am I on" needs no reading.
 * 4. Fits — matte card, hairline border, same surface as every other Settings
 *    block. The novelty is the mode, not the control.
 *
 * No empty/loading/error states here, and that is deliberate: this is a static
 * two-value preference with no data behind it. Inventing a spinner for a value
 * that is always present would be the AI-slop instinct, not correctness.
 */
export function ShortcutSection(props: ShortcutSectionProps) {
  const { settingsSearch } = props;
  const { prefs, setMode, setMotion } = useRewindSetting();
  const motion = effectiveMotion(prefs);

  const q = settingsSearch.trim().toLowerCase();
  const relevant = !q || /nav|navigation|ctrl|command|palette|rewind|film|classic|search|mode/.test(q);

  if (!relevant) return null;

  return (
    <div className="space-y-6">
      {/* ── Navigation mode ───────────────────────────────────────────── */}
      <GlassCard className="space-y-4">
        <SectionHeader title="Navigation" icon={<Keyboard className="w-5 h-5" />} />
        <p className="text-xs text-zinc-500">
          How Ctrl K opens. Both modes search every page and sub page, and both can
          travel instantly with Shift Enter.
        </p>

        <div className="grid gap-3 pt-2 sm:grid-cols-2" role="radiogroup" aria-label="Navigation mode">
          <ModeCard
            mode="classic"
            selected={prefs.mode === 'classic'}
            onSelect={() => setMode('classic')}
            title="List"
            icon={<List className="w-3.5 h-3.5" aria-hidden />}
            blurb="Ranked rows. No animation. Fastest."
          >
            <ListDiagram />
          </ModeCard>

          <ModeCard
            mode="film"
            selected={prefs.mode === 'film'}
            onSelect={() => setMode('film')}
            title="Rewind film"
            icon={<Film className="w-3.5 h-3.5" aria-hidden />}
            blurb="Reels and a film strip, with a rewind on travel."
          >
            <FilmDiagram />
          </ModeCard>
        </div>
      </GlassCard>

      {/* ── Travel animation, only meaningful in film mode ────────────── */}
      {prefs.mode === 'film' && (
        <GlassCard className="space-y-4">
          <SectionHeader title="Rewind animation" icon={<Film className="w-5 h-5" />} />
          <p className="text-xs text-zinc-500">
            How long the travel takes. If you travel more than three times in twenty
            seconds it drops to Quick on its own.
          </p>
          <div className="flex gap-1 pt-2" role="radiogroup" aria-label="Rewind animation">
            {(['full', 'quick', 'off'] as RewindMotion[]).map(m => (
              <button
                key={m}
                role="radio"
                aria-checked={prefs.motion === m}
                onClick={() => setMotion(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  prefs.motion === m
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {motion !== prefs.motion && (
            <p className="text-[11px] text-amber-400/80">
              Your system asks for reduced motion, so travel is currently {motion}.
            </p>
          )}
        </GlassCard>
      )}

      {/* ── Existing shortcut config, unchanged ───────────────────────── */}
      <GlassCard className="space-y-4">
        <SectionHeader title="Keyboard Shortcuts" icon={<Keyboard className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div className="text-sm text-zinc-400">Keyboard shortcut settings content</div>
      </GlassCard>
    </div>
  );
}

function ModeCard({
  mode, selected, onSelect, title, icon, blurb, children,
}: {
  mode: RewindMode;
  selected: boolean;
  onSelect: () => void;
  title: string;
  icon: React.ReactNode;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-zinc-700/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:border-zinc-600/60 hover:bg-zinc-900/70 light:bg-[var(--ws-surface-raised)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={selected ? 'text-amber-400' : 'text-zinc-500'}>{icon}</span>
        <span className={`text-sm font-medium ${selected ? 'text-amber-200' : 'text-zinc-200'}`}>
          {title}
        </span>
        {selected && <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400">On</span>}
      </div>
      <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-60)] p-2" aria-hidden>{children}</div>
      <p className="text-[11px] leading-snug text-zinc-500">{blurb}</p>
    </motion.button>
  );
}

/** Stacked rows, one highlighted — the literal shape of classic mode. */
function ListDiagram() {
  return (
    <svg viewBox="0 0 120 52" className="h-14 w-full">
      {[6, 18, 30, 42].map((y, i) => (
        <g key={y}>
          <rect x="4" y={y} width={112} height="9" rx="2"
            fill={i === 1 ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.04)'} />
          <rect x="8" y={y + 3} width={i === 1 ? 42 : 30} height="3" rx="1.5"
            fill={i === 1 ? '#f59e0b' : '#52525b'} />
          <rect x="86" y={y + 3} width="26" height="3" rx="1.5" fill="#3f3f46" />
        </g>
      ))}
    </svg>
  );
}

/** A reel plus a sprocket strip with one lit frame — the literal shape of film mode. */
function FilmDiagram() {
  return (
    <svg viewBox="0 0 120 52" className="h-14 w-full">
      {/* reel */}
      <circle cx="18" cy="18" r="13" fill="#27272a" stroke="#52525b" strokeWidth="0.75" />
      {[0, 60, 120, 180, 240, 300].map(a => (
        <ellipse key={a} cx="18" cy="9.5" rx="2.4" ry="3.4" fill="#0b0b0d" transform={`rotate(${a} 18 18)`} />
      ))}
      <circle cx="18" cy="18" r="3" fill="#0b0b0d" />
      {/* strip with sprockets */}
      <g>
        <rect x="40" y="14" width="76" height="20" rx="2" fill="#08080a" />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={`t${i}`} x={43 + i * 12.5} y="15.5" width="6" height="2.5" rx="0.8" fill="rgba(255,255,255,0.10)" />
        ))}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={`b${i}`} x={43 + i * 12.5} y="30" width="6" height="2.5" rx="0.8" fill="rgba(255,255,255,0.10)" />
        ))}
        {/* selected frame, amber */}
        <rect x="67" y="18" width="11" height="12" rx="1.5" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth="0.75" />
      </g>
    </svg>
  );
}