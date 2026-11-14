import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BOOT_TIMINGS as T, getSplashApi, type BootAnimationConfig } from './bootTimings';
import '../../styles/boot.css';

/* ── C · DEPARTURES — Stage 2 ────────────────────────────────────────────────
 * The overlay IS the departures board: split-flap RHEO drums forward through
 * the charset (never crossfades), four stage rows advance on the stage ladder,
 * the lamp lattice waves once per stage advance, and the last row — the ready
 * row — completes ONLY on `rheo:boot-ready`, so the board can never claim a
 * readiness the app hasn't reported. Everything rests at ready; the clock is
 * the one surviving loop (functional).
 *
 * The flap drums and the lattice are imperative by design: the flap step needs
 * transform resets + a forced reflow per half-rotation (that IS the mechanic —
 * kokonutui split-flap-text, FLIP/STAGGER verbatim), and the lattice is a
 * rAF canvas loop. React owns the structure and the state machine; the
 * mechanics own their own DOM. */

const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/&!?';
const WORD = 'RHEO';
const STAGE_LABELS = [
  'opening the ledger',
  'restoring sessions',
  'waking surfaces',
  'ready — your day is being recorded',
] as const;
const META_BLANK = ['—', '—', '—', '—'] as const;
const EASE_EXPO = [0.19, 1, 0.22, 1] as const;

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const fmtClock = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const fmtSec = (sec: number) => `${sec.toFixed(1)}s`;

/* ── split-flap mechanics ── */

type FlapTile = {
  top: HTMLSpanElement;
  bot: HTMLSpanElement;
  fTop: HTMLDivElement;
  fBot: HTMLDivElement;
  fTopS: HTMLSpanElement;
  fBotS: HTMLSpanElement;
  cur: string;
};

function buildFlapTiles(container: HTMLElement): FlapTile[] {
  container.innerHTML = '';
  const tiles: FlapTile[] = [];
  for (let i = 0; i < WORD.length; i++) {
    const tile = document.createElement('div');
    tile.className = 'boot-tile';
    tile.innerHTML =
      '<div class="boot-half boot-half--top"><span></span></div>' +
      '<div class="boot-half boot-half--bot"><span></span></div>' +
      '<div class="boot-flap boot-flap--top"><span></span></div>' +
      '<div class="boot-flap boot-flap--bot"><span></span></div>' +
      '<div class="boot-seam"></div>';
    container.appendChild(tile);
    const span = (sel: string) => tile.querySelector(sel) as HTMLSpanElement;
    const div = (sel: string) => tile.querySelector(sel) as HTMLDivElement;
    tiles.push({
      top: span('.boot-half--top span'),
      bot: span('.boot-half--bot span'),
      fTop: div('.boot-flap--top'),
      fBot: div('.boot-flap--bot'),
      fTopS: span('.boot-flap--top span'),
      fBotS: span('.boot-flap--bot span'),
      cur: ' ',
    });
  }
  return tiles;
}

function setStaticFlap(t: FlapTile, ch: string) {
  t.top.textContent = ch;
  t.bot.textContent = ch;
  t.cur = ch;
}

/* one mechanically honest step: the current flap falls, the next flap rises */
function stepFlap(
  t: FlapTile,
  done: { target: string; steps: number },
  at: (ms: number, fn: () => void) => void,
) {
  const next = CHARSET[(CHARSET.indexOf(t.cur) + 1) % CHARSET.length];
  t.fTopS.textContent = t.cur;
  t.fBotS.textContent = next;
  t.fTop.style.transition = 'none';
  t.fTop.style.transform = 'rotateX(0deg)';
  t.fBot.style.transition = 'none';
  t.fBot.style.transform = 'rotateX(90deg)';
  void t.fTop.offsetWidth; // commit the reset before the fall
  t.fTop.style.transition = `transform ${T.FLIP_HALF}ms linear`;
  t.fTop.style.transform = 'rotateX(-90deg)';
  t.fBot.style.transition = `transform ${T.FLIP_HALF}ms linear`;
  t.fBot.style.transform = 'rotateX(0deg)';
  at(T.FLIP_HALF, () => {
    setStaticFlap(t, next);
    t.fTop.style.display = 'none';
    t.fBot.style.display = 'none';
    if (t.cur !== done.target && done.steps > 1) {
      done.steps -= 1;
      at(T.FLIP - T.FLIP_HALF, () => stepFlap(t, done, at));
    }
  });
}

function runDrums(container: HTMLElement, at: (ms: number, fn: () => void) => void) {
  const tiles = buildFlapTiles(container);
  for (let i = 0; i < WORD.length; i++) {
    const t = tiles[i];
    const target = WORD[i];
    const idx = CHARSET.indexOf(target);
    const start = Math.max(0, idx - (6 + ((i * 2) % 5))); // start a few chars before target
    setStaticFlap(t, CHARSET[start]);
    const steps = idx - start;
    if (steps <= 0) {
      setStaticFlap(t, target);
      continue;
    }
    at(T.FLAPS_AT + i * T.STAGGER, () => {
      t.fTop.style.display = 'block';
      t.fBot.style.display = 'block';
      stepFlap(t, { target, steps }, at);
    });
  }
}

function finishFlapsStatic(container: HTMLElement) {
  const tiles = buildFlapTiles(container);
  tiles.forEach((t, i) => setStaticFlap(t, WORD[i]));
  tiles.forEach((t) => {
    t.fTop.style.display = 'none';
    t.fBot.style.display = 'none';
  });
}

/* ── lattice lamp field ── */

type LatticeController = { wave(): void; rest(): void; destroy(): void };

function parseHexRgb(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (!m) return null;
  const h = m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function createLattice(canvas: HTMLCanvasElement, opts: { waves: boolean }): LatticeController {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.round(520 * dpr);
  canvas.height = Math.round(320 * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { wave() {}, rest() {}, destroy() {} };
  ctx.scale(dpr, dpr);

  /* ONE hue — read the app's accent so a custom accent recolours the field
   * along with the dots in CSS. Fallback is the workspace cyan. */
  const raw = (getComputedStyle(document.documentElement).getPropertyValue('--ws-accent') || '').trim();
  const rgb = parseHexRgb(raw) ?? [6, 182, 212];
  const FILL = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const GLOW = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.8)`;

  const COLS = 40;
  const ROWS = 24;
  const PITCH = 13;
  const CELL = 6;
  const OFF = 3.5;

  let idle: number[] = [];
  const waves: Array<{ t0: number }> = [];
  let rafId = 0;
  let running = false;
  let destroyed = false;

  const buildIdle = () => {
    idle = [];
    for (let i = 0; i < COLS * ROWS; i++) idle.push(0.05 + Math.random() * 0.05);
  };

  const drawField = (now: number) => {
    if (destroyed) return;
    ctx.clearRect(0, 0, 520, 320);
    const fronts: number[] = [];
    for (let w = waves.length - 1; w >= 0; w--) {
      const k = (now - waves[w].t0) / T.WAVE_MS; // lattice wave cycle
      if (k >= 1) {
        waves.splice(w, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3); // expo-out
      fronts.push(-20 + e * 560);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * PITCH + OFF;
        const y = r * PITCH + OFF;
        let a = idle[r * COLS + c]; // seeded — globalAlpha must never be unset
        for (const f of fronts) {
          const d = f - x;
          if (d > -16 && d < 260) {
            a += 0.55 * Math.exp(-Math.pow(d - 6, 2) / 648) // leading crest
              + 0.2 * Math.exp(-Math.max(0, d) / 90); // trailing decay
          }
        }
        a = Math.min(0.85, a);
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        if (a > 0.32) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = GLOW;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = FILL;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (waves.length) {
      rafId = requestAnimationFrame(drawField);
    } else {
      running = false;
    }
  };

  const rest = () => {
    if (destroyed) return;
    cancelAnimationFrame(rafId);
    buildIdle();
    waves.length = 0;
    running = false;
    drawField(performance.now());
  };

  const wave = () => {
    if (destroyed || !opts.waves) return;
    waves.push({ t0: performance.now() });
    if (!running) {
      running = true;
      rafId = requestAnimationFrame(drawField);
    }
  };

  const destroy = () => {
    destroyed = true;
    cancelAnimationFrame(rafId);
  };

  rest();
  return { wave, rest, destroy };
}

/* ── component ── */

export interface BootOverlayProps {
  config: BootAnimationConfig;
  onDone: () => void;
}

export function BootOverlay({ config, onDone }: BootOverlayProps) {
  const reduced = useReducedMotion();
  const warm = config.warmStart;
  const staticRun = reduced === true || warm; // no drums, no waves — final state

  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [doneCount, setDoneCount] = useState(0);
  const [rowsIn, setRowsIn] = useState(0);
  const [pct, setPct] = useState(0);
  const [metas, setMetas] = useState<string[]>([...META_BLANK]);
  const [clock, setClock] = useState(fmtClock);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flapsRef = useRef<HTMLDivElement | null>(null);
  const latticeRef = useRef<LatticeController | null>(null);
  const readyRef = useRef(document.documentElement.dataset.bootReady === 'true');
  const exitingRef = useRef(false);
  const mountAtRef = useRef(performance.now());
  const runIdRef = useRef(0);
  const wavesOnRef = useRef(true);

  const elapsedSec = () => (performance.now() - mountAtRef.current) / 1000;

  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  useEffect(() => {
    const onReady = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      setDoneCount((d) => Math.max(d, 3)); // rows 0..2 done, ready row active
      setPct((p) => Math.max(p, 100));
      const sec = fmtSec(elapsedSec());
      setMetas((m) => m.map((v) => (v === '—' ? sec : v)));
      const lat = latticeRef.current;
      if (lat && wavesOnRef.current) {
        lat.wave(); // the final wave — then the field rests
        const run = runIdRef.current;
        window.setTimeout(() => {
          if (runIdRef.current === run) lat.rest();
        }, T.WAVE_MS + 60);
      }
    };
    window.addEventListener('rheo:boot-ready', onReady);
    return () => window.removeEventListener('rheo:boot-ready', onReady);
  }, []);

  // Boot-ready may have pre-fired before this overlay mounted (dataset flag).
  useEffect(() => {
    if (readyRef.current) {
      setDoneCount((d) => Math.max(d, 3));
      setPct((p) => Math.max(p, 100));
    }
  }, [runId]);

  useEffect(() => {
    const api = getSplashApi();
    api?.onReplay(() => {
      readyRef.current = false;
      exitingRef.current = false;
      mountAtRef.current = performance.now();
      setPct(0);
      setDoneCount(0);
      setRowsIn(0);
      setMetas([...META_BLANK]);
      setPhase('enter');
      setRunId((r) => r + 1);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lat = createLattice(canvas, { waves: !staticRun });
    wavesOnRef.current = !staticRun;
    latticeRef.current = lat;
    return () => {
      lat.destroy();
      if (latticeRef.current === lat) latticeRef.current = null;
    };
  }, [runId, staticRun]);

  useEffect(() => {
    const container = flapsRef.current;
    if (!container) return;
    if (staticRun) {
      finishFlapsStatic(container);
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    runDrums(container, at);
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [runId, staticRun]);

  /* stage ladder — rows advance on timed stages; the ready row completes on
   * `rheo:boot-ready` only. Guards are monotonic so a late timer can never
   * un-complete a stage the app already reported. */
  useEffect(() => {
    if (staticRun) {
      setRowsIn(STAGE_LABELS.length);
      setDoneCount((d) => Math.max(d, STAGE_LABELS.length));
      setPct((p) => Math.max(p, 100));
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    STAGE_LABELS.forEach((_, i) => {
      at(T.ROWS_AT + i * T.ROW_STAGGER, () => setRowsIn((r) => Math.max(r, i + 1)));
    });
    at(T.STAGE_AT[0], () => {
      setDoneCount((d) => Math.max(d, 1));
      setPct((p) => Math.max(p, T.STAGE_PCT[0]));
      setMetas((m) => {
        const n = [...m];
        if (n[0] === '—') n[0] = fmtSec(elapsedSec());
        return n;
      });
      latticeRef.current?.wave();
    });
    at(T.STAGE_AT[1], () => {
      setDoneCount((d) => Math.max(d, 2));
      setPct((p) => Math.max(p, T.STAGE_PCT[1]));
      setMetas((m) => {
        const n = [...m];
        if (n[1] === '—') n[1] = fmtSec(elapsedSec());
        return n;
      });
      latticeRef.current?.wave();
    });
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, staticRun]);

  /* the board's clock — functional, ticks even under reduced motion */
  useEffect(() => {
    setClock(fmtClock());
    const id = window.setInterval(() => setClock(fmtClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* exit: the app reported ready — hand over. This loop is the same contract
   * the previous overlay ran (dataset flag OR live event), unchanged. */
  useEffect(() => {
    let raf = 0;
    let exitTimer = 0;
    const tick = () => {
      if (
        !exitingRef.current &&
        (readyRef.current || document.documentElement.dataset.bootReady === 'true')
      ) {
        exitingRef.current = true;
        setPct(100);
        void getSplashApi()
          ?.sendComplete()
          .catch(() => {});
        setPhase('exit');
        exitTimer = window.setTimeout(onDone, reduced ? 0 : 150);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(exitTimer);
    };
  }, [onDone, reduced, runId]);

  const rowClass = (i: number) => {
    let cls = 'boot-row';
    if (i < rowsIn) cls += ' boot-row--in';
    if (i < doneCount) cls += ' boot-row--done';
    else if (i === doneCount) cls += ' boot-row--active';
    return cls;
  };

  return (
    <motion.div
      className="boot-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: reduced ? 0 : 0.15, ease: 'easeOut' }}
      data-warm={warm || undefined}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <motion.section
        key={runId}
        className="boot-board"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: T.CARD_IN / 1000, ease: EASE_EXPO }}
      >
        <canvas ref={canvasRef} className="boot-lattice" aria-hidden="true" />

        <div ref={flapsRef} className="boot-flaps" aria-hidden="true" />

        <div className="boot-clock" aria-hidden="true">
          <span>{clock}</span>
          <small>local</small>
        </div>

        <div className="boot-rows" aria-hidden="true">
          {STAGE_LABELS.map((label, i) => (
            <div key={label} className={rowClass(i)}>
              <span className="boot-row-dot" />
              <span>{label}</span>
              <span className="boot-row-meta">{metas[i]}</span>
            </div>
          ))}
        </div>

        {/* the live line the rows shadow — rows are decorative to AT */}
        <span className="boot-live">{STAGE_LABELS[Math.min(doneCount, STAGE_LABELS.length - 1)]}</span>

        <div className="boot-pct" aria-hidden="true">
          {pct}%
        </div>
        <div className="boot-track" aria-hidden="true">
          <span className="boot-tfill" style={{ width: `${pct}%` }} />
        </div>
      </motion.section>
    </motion.div>
  );
}
