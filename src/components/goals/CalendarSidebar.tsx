// src/components/goals/CalendarSidebar.tsx
// RHEO Gold page — sticky calendar sidebar (GOLD-LAYOUT, R-59…R-64).
// Composition: header strip (label + side toggle) → 3D scene (MonthWall) → day strip (CalendarStrip).
// MonthWall is FROZEN (R-60): this file never edits it; the scene wrapper supplies perspective
// and the entrance choreography. MonthWall's own container composes underneath.

import { useState, useEffect, useRef } from 'react';
import { MonthWall } from '../MonthWall/MonthWall';
import { CalendarStrip } from './CalendarStrip';
import { PanelLeft, PanelRight, CalendarDays } from 'lucide-react';

// Session-scope one-shot flag: app relaunch replays the entrance; tab flips do not.
let entrancePlayedThisSession = false;

type CalendarSide = "left" | "right";

export interface CalendarSidebarProps {
  side: CalendarSide;
  onToggleSide: () => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  weekGoals: Record<string, any[]>;
  marks: Map<string, { color: string; label: string }[]>;
  goalDates: Set<string>;
  goals: any[];
  deadlines: any[];
  reminders: any[];
  schedule: any[];
  longTermGoals: any[];
}

export function CalendarSidebar({
  side, onToggleSide,
  selectedDate, onDateChange,
  weekGoals, marks, goalDates,
  goals, deadlines, reminders, schedule, longTermGoals,
}: CalendarSidebarProps) {
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [entering, setEntering] = useState(true);
  // Retained for the sheen + floor-reflection timing below, which still key off
  // the entrance. The tilt state is gone: pointer-driven tilt was what forced a
  // re-rasterise per frame.
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // Entrance: mount flat → 80ms hold → 520ms turn to pose → lock.
  // Driven by a CSS class swap on the scene wrapper; transform/opacity only; one-shot per session.
  useEffect(() => {
    if (reduce || entrancePlayedThisSession) { setEntering(false); return; }
    entrancePlayedThisSession = true;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.classList.add('calendar-scene', 'is-entrancing');
    const t = setTimeout(() => { scene.classList.remove('is-entrancing'); setEntering(false); }, 600);
    return () => clearTimeout(t);
  }, [reduce]);

  // The pose class must be on the element from the FIRST paint, not only after
  // the entrance effect runs. It used to be added inside that effect, which means
  // (a) the resting 3D pose never existed on first render, (b) reduced-motion and
  // already-played-session paths returned before adding it, and (c) the CSS below
  // matched nothing at all — `.calendar-scene` was declared and never applied, so
  // the wall rendered dead flat and nothing looked 3D. Declared unconditionally on
  // the wrapper; the effect only manages the transient `is-entrancing` half.
  const sceneClassName = 'calendar-scene relative overflow-visible rounded-lg';

  // Cursor tilt ±4°. DISABLED for now.
  //
  // WHY THIS IS OFF. Making `.calendar-scene` actually apply (it was declared for
  // years and matched no element, so the wall rendered dead flat) meant the
  // scene wrapper suddenly had a REAL transform plus `perspective: 1100px`,
  // `transformStyle: 'preserve-3d'` and `will-change: transform` around ~73
  // elements — 42 MonthWall cells and 31 CalendarStrip buttons. Chromium has to
  // allocate and re-rasterise a composited 3D layer for that subtree, and with
  // a transform changing on every pointermove it re-does that continuously.
  // On this machine (native Wayland + XWayland, ~4 GB free, full zram, and a
  // documented 12-OOM-event history) that tipped the box into a freeze the
  // moment the Life tab loaded.
  //
  // The 3D itself is kept — it is the page's whole point — but made STATIC:
  // one transform, allocated once, never re-driven. The tilt is the part that
  // forces continuous re-rasterisation, so it is what goes. Re-enable with
  // `will-change` and the transition only if the scene is ever narrowed well
  // below its current width.
  const onPointerMove = (_e: React.PointerEvent) => { /* intentionally inert */ };
  const onPointerLeave = () => { /* intentionally inert */ };

  // Pose angles mirror the side preference: the near edge always faces the content.
  const poseY = side === 'left' ? -7 : 7;

  // All transform lives in CSS classes (inline style would win via specificity).
  // CSS custom properties carry the dynamic values (pose-y side).
  const sceneStyle: React.CSSProperties = {
    perspective: '1100px',
    perspectiveOrigin: '50% 40%',
    transformStyle: 'preserve-3d',
    contain: 'layout paint',
    '--pose-y': `${poseY}deg`,
  } as React.CSSProperties;

  return (
    <aside
      /* Stage width is set here because this file's only consumer is the Schedule
         tab, and the depth cue is geometric: MonthWall's day tiles are `h-11`
         (44px) tall, so a tile only reads as a raised slab when it is roughly
         square. At the previous 380px the grid left each tile ~37x44 — narrower
         than tall — which read as a squashed flat grid, not a relief.
         560px -> (560 - 40 wall padding - 20 grid padding - 60 gaps) / 7 = 63px
         tiles, i.e. square. That single change is what makes the 3D legible;
         the rotateX/rotateY below only tilt a stage that is already proportioned
         for it. */
      className="lg:flex-1 min-w-[420px] max-w-[560px] lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto"
      aria-label="Calendar"
    >
      {/* Header strip: label + side toggle. Flat chrome, never 3D. */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-300">
          <CalendarDays size={13} className="text-zinc-500" />Calendar
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Calendar side">
          <button type="button" onClick={onToggleSide} aria-pressed={side === 'left'}
            title="Move calendar to the left"
            className={`h-7 w-7 rounded-[6px] border flex items-center justify-center transition-colors duration-150 ${
              side === 'left' ? 'bg-zinc-800/60 border-zinc-700/60 text-zinc-100' : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
            }`}><PanelLeft size={14} /></button>
          <button type="button" onClick={onToggleSide} aria-pressed={side === 'right'}
            title="Move calendar to the right"
            className={`h-7 w-7 rounded-[6px] border flex items-center justify-center transition-colors duration-150 ${
              side === 'right' ? 'bg-zinc-800/60 border-zinc-700/60 text-zinc-100' : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
            }`}><PanelRight size={14} /></button>
        </div>
      </div>

      {/* 3D scene. The sidebar's overflow-y-auto is the PARENT of this scene (never between
          scene and wall), so MonthWall's preserve-3d subtree is never flattened. The inset
          padding reserves room for projected overflow (break-out is visual, never a scrollbar). */}
      <div ref={sceneRef} style={sceneStyle} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
        className={sceneClassName}>
        {/* One-shot specular sweep during the turn (translate only, ≤8% alpha band). */}
        <div className="pointer-events-none absolute inset-0 rounded-lg" style={{
          background: 'linear-gradient(105deg, transparent 30%, rgba(250,250,250,0.08) 50%, transparent 70%)',
          animation: entering ? 'df-sheen 600ms cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        }} />
        {/* Floor reflection: gradient paint ≤6%, fades with the turn. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg" style={{
          opacity: entering ? 0.06 : (reduce ? 0.06 : 0),
          background: 'radial-gradient(ellipse 100% 40% at 50% 100%, rgba(120,120,125,0.06), transparent 70%)',
          transition: 'opacity 520ms cubic-bezier(0.16,1,0.3,1) 80ms',
        }} />
        {/* MonthWall: frozen, byte-identical props (R-60). */}
        <MonthWall goals={goals} deadlines={deadlines} reminders={reminders} schedule={schedule} longTermGoals={longTermGoals} selectedDate={selectedDate} />
        {/* Day strip below the wall — props byte-identical, wiring intact. */}
        <div className="mt-3">
          <CalendarStrip selectedDate={selectedDate} onDateChange={onDateChange} goalDates={goalDates} marks={marks} weekGoals={weekGoals} />
        </div>
      </div>

      <style>{`
        @keyframes df-sheen {
          0%   { opacity: 0; transform: translateX(-20%); }
          20%  { opacity: 0.08; }
          80%  { opacity: 0.08; }
          100% { opacity: 0; transform: translateX(120%); }
        }
        /* STATIC 3D. No \`transition\`, no \`will-change\`.
           The transition is what made a transform change re-rasterise the whole
           3D layer on every frame; \`will-change\` pinned that layer in memory
           permanently. With both removed, this transform is computed once and
           the compositor reuses the same texture. See the note on the pointer
           handlers above before re-adding either. */
        .calendar-scene {
          transform: rotateX(9deg) rotateY(var(--pose-y, 7deg));
        }
        .calendar-scene.is-entrancing {
          transform: rotateX(9deg) rotateY(var(--pose-y, 7deg)) scale(0.99);
          transition: transform 520ms cubic-bezier(0.16,1,0.3,1) 80ms;
        }
        @media (prefers-reduced-motion: reduce) {
          .calendar-scene, .calendar-scene.is-entrancing {
            transform: rotateX(9deg) rotateY(var(--pose-y, 7deg)) !important;
            transition: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
