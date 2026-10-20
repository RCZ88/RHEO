// src/components/goals/CalendarSidebar.tsx
// RHEO Gold page — sticky calendar sidebar (GOLD-LAYOUT, R-59…R-64).
// Composition: header (label + side toggle) → flat month wall (MonthWall).
// MonthWall is FROZEN (R-60): this file never edits it; the scene wrapper supplies perspective
// and the entrance choreography. MonthWall's own container composes underneath.

import { useState, useEffect, useRef } from 'react';
import { MonthWall } from '../MonthWall/MonthWall';
import { PanelLeft, PanelRight } from 'lucide-react';

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
  /* `min-h-0 flex-1` is what lets the wall FIT the panel. Without it the scene
     is as tall as its content, the wall never receives a bounded height, and the
     month keeps laying itself out at ~700px inside a 403px panel. */
  const sceneClassName = 'calendar-scene relative min-h-0 flex-1 overflow-visible rounded-lg';

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

  /* FLAT. No perspective, no preserve-3d, no rotate.
     The tilt lived in this wrapper, not in MonthWall — MonthWall's grid was
     already flattened, but as long as the WRAPPER still rotated the scene by
     9deg/7deg the two failure modes that produced "the calendar doesn't take
     clicks" were both still live: the surface was skewed, and it still sat
     inside a preserve-3d context. Removing only the cells' translateZ fixed
     sibling hit-testing and left the skew. Both had to go.

     `contain: layout paint` stays — it is a perf win and has nothing to do
     with 3D. */
  const sceneStyle: React.CSSProperties = {
    contain: 'layout paint',
  } as React.CSSProperties;

  return (
    <aside
      /* WIDTH IS A RANGE, NOT A FIXTURE — and the tiles are SQUARE so the range
         cannot change the calendar's proportions.

         The tiles used to be pinned at `h-11` (44px) while this column ranged
         420–560px, so the same month rendered ~48x44 tiles at the narrow end
         and ~63x44 at the wide end: a different-looking calendar at every
         width, plus slack piled up underneath because six fixed-height rows
         never filled the column. `aspect-square` on the tiles makes height a
         function of width instead of a constant, so one rule holds at every
         size and the grid ends exactly where the last row ends.

         Both sides share this element — the toggle only flips its ORDER in the
         parent's flex row — so square tiles are the same proportion on the left
         and on the right by construction, not by two rules kept in sync. */

      /* FILLS ITS PANEL, WHATEVER THE PANEL IS. This element was written for
         the Gold page, where it was a sidebar in a flex row and `min-w-[420px]
         max-w-[560px]` was the contract that stopped it swallowing the page.
         In the schedule shell it is a PANEL whose width comes from the layout
         preset — 318px in a narrow today-first, 945px in calendar-first. The
         fixed band then did the two things a band does: at the narrow end it
         forced 420px into a 318px cell, so the right of the month was clipped;
         at the wide end it capped at 560px and left ~385px of the panel's own
         background showing behind it. Width belongs to the container now.

         `overflow-hidden` here, NOT `overflow-y-auto`: a scrolling flex parent
         sizes its `flex-1` child to CONTENT rather than to the space that is
         left, so the scene grew to the month's full height and the wall was
         laid out 49px past the panel's own bottom edge. The cell clipped it, so
         the last week (25-31) was simply missing — 24 of 31 tiles. The wall
         itself is the scroller; this box must only bound it. */
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      aria-label="Calendar"
    >
      {/* Header strip: side toggle only. The panel chrome above already prints
          "Calendar", so repeating it here stacked the same label twice on one
          panel — two identical headings 20px apart read as a rendering bug. */}
      <div className="flex items-center justify-end mb-2 px-1">
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

      {/* Month wall. The sidebar's overflow-y-auto is the PARENT of this scene (never between
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
        {/* THE ONE DATE CONTROL IN THIS SIDEBAR.

            MonthWall takes `selectedDate` but was never given `onDateChange`,
            so it could DISPLAY the selection and never REPORT one — clicking a
            day moved nothing. That is the same class of bug as the 3D one: the
            affordance looked live, and the handler simply was not connected.

            So the wall is now both the reader and the writer of the selection,
            and the selected day drives the week board on the page beside it.
            One source of truth, one click, and the two views can never disagree
            about which day "today" is.

            CalendarStrip used to sit below this wall as well. Two date pickers
            stacked in one column is a duplicate control, and worse, they were
            kept in sync by hand. It is removed from HERE; GoalsPage still
            mounts its own, because there the strip is the only date nav on the
            page. */}
        <MonthWall
          goals={goals}
          deadlines={deadlines}
          reminders={reminders}
          schedule={schedule}
          longTermGoals={longTermGoals}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
        />
      </div>

      <style>{`
        @keyframes df-sheen {
          0%   { opacity: 0; transform: translateX(-20%); }
          20%  { opacity: 0.08; }
          80%  { opacity: 0.08; }
          100% { opacity: 0; transform: translateX(120%); }
        }
        /* The entrance is opacity + a few pixels, never a 3D transform.
           Scaling a scene under perspective is what made the entrance change the
           hit geometry: a transform means the element's rendered position and
           its layout box disagree while it animates, so the first click of an
           entrance could land on the wrong cell. Opacity does not move anything,
           so the two never diverge. */
        .calendar-scene.is-entrancing {
          animation: df-cal-enter 320ms cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes df-cal-enter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .calendar-scene.is-entrancing { animation: none !important; }
        }
      `}</style>
    </aside>
  );
}
