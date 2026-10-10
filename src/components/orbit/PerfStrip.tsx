/**
 * Stage 0 HUD — the measurement strip from §2.4 of the performance RESULT.md.
 *
 * Extends the EXISTING `FPSCounter` overlay rather than adding a second one, so
 * there is exactly one display layer and exactly one decision-maker (anti-slop
 * rule 4: no competing sources of truth).
 *
 * It subscribes to `perfProbe` at 2 Hz and is the ONLY React tree in the scene
 * that re-renders on performance data. Everything else writes to refs.
 *
 * Why every field is here: the plan's Stage 0 exists to turn each `[M]`
 * hypothesis into a number, and a number nobody can read is not a measurement.
 */

import { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { perfProbe, type PerfSnapshot } from './perfProbe';

/**
 * Priority-0 sampler. Runs BEFORE the EffectComposer's priority-1 render, so it
 * reads the previous frame's complete totals. This is the only reader of
 * `renderer.info` in the app.
 */
export function PerfSampler() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    perfProbe.sampleFrame(gl as never);
  }, 0);
  return null;
}

/**
 * The 2 Hz flush. Lives inside the Canvas only because it needs `useThree` for
 * the renderer; it pushes numbers out to the DOM overlay via a ref, so the
 * React tree above the Canvas never re-renders.
 */
export function PerfFlush({ onSnapshot }: { onSnapshot?: (s: PerfSnapshot) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const id = setInterval(() => {
      const snap = perfProbe.flush(gl as never);
      onSnapshot?.(snap);
    }, 500);
    return () => clearInterval(id);
  }, [gl, onSnapshot]);
  return null;
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span
        className={`font-mono tabular-nums text-[11px] ${warn ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The strip. Rendered by `OrbitScene` next to the existing FPS readout.
 * Deliberately dense and monospace: this is an instrument, not a widget.
 */
export function PerfStrip({
  open,
  onToggle,
  tier,
  autoStepped,
}: {
  open: boolean;
  onToggle: () => void;
  tier: string;
  autoStepped?: boolean;
}) {
  const [s, setS] = useState<PerfSnapshot | null>(null);

  useEffect(() => perfProbe.subscribe(setS), []);

  return (
    <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-primary)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--bg-secondary)]"
        aria-expanded={open}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Perf
        </span>
        {s && (
          <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
            {(1000 / Math.max(s.p50, 0.01)).toFixed(0)} fps · {s.p50.toFixed(1)}ms
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          {tier}
          {autoStepped && <span className="text-[var(--warning)]">· auto</span>}
          {open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </span>
      </button>

      {open && s && (
        <div className="space-y-1 border-t border-[var(--ws-border)] px-2.5 py-2">
          <Row label="frame p50" value={`${s.p50.toFixed(2)} ms`} warn={s.p50 > 16.6} />
          <Row label="frame p95" value={`${s.p95.toFixed(2)} ms`} warn={s.p95 > 22} />
          <Row label="scene js" value={`${s.sceneJsMs.toFixed(2)} ms`} warn={s.sceneJsMs > 4} />
          <Row label="calls" value={fmt(s.calls)} warn={s.calls > 250} />
          <Row label="points" value={fmt(s.points)} warn={s.points > 5500} />
          <Row label="triangles" value={fmt(s.triangles)} />
          <Row label="lines" value={fmt(s.lines)} />
          <Row label="textures" value={String(s.textures)} />
          <Row label="geometries" value={String(s.geometries)} />
          <Row label="programs" value={String(s.programs)} />
          <Row label="react commits" value={`${s.commitsPerSec.toFixed(1)}/s`} />
          <Row label="render frame" value={String(s.renderFrame)} />

          {/* The interpretation rule from §2.3, made visible instead of implicit.
              High frame time with low calls and low JS means the GPU is the
              bottleneck, which is the one conclusion a frame counter alone
              cannot give you. */}
          <p className="pt-1 text-[10px] leading-tight text-[var(--text-muted)]">
            {s.p50 > 22 && s.sceneJsMs < 2 && s.calls < 250
              ? 'GPU-bound: JS and draw calls are low. Try lowering bloom or dpr.'
              : s.p50 > 22 && s.sceneJsMs > 4
                ? 'JS-bound: per-frame callbacks dominate.'
                : s.p50 > 22
                  ? 'Draw-call bound: too many objects submitted.'
                  : 'Within budget.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default PerfStrip;