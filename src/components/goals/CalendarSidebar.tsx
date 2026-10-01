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
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // Entrance: mount flat → 80ms hold → 520ms turn to pose → lock.
  // Driven by a CSS class swap on the scene wrapper; transform/opacity only; one-shot per session.
  useEffect(() => {
    if (reduce || entrancePlayedThisSession) { setEntering(false); return; }
    entrancePlayedThisSession = true;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.classList.add('is-entrancing');
    const t = setTimeout(() => { scene.classList.remove('is-entrancing'); setEntering(false); }, 600);
    return () => clearTimeout(t);
  }, [reduce]);

  // Cursor tilt ±4°: x from pointer-y, y from pointer-x. Disabled during entrance.
  const onPointerMove = (e: React.PointerEvent) => {
    if (entering) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const py = (e.clientY - rect.top) / rect.height;
    const px = (e.clientX - rect.left) / rect.width;
    setTilt({ x: Math.max(-4, Math.min(4, (py - 0.5) * 8)), y: Math.max(-4, Math.min(4, (px - 0.5) * 8)) });
  };
  const onPointerLeave = () => setTilt({ x: 0, y: 0 });

  // Pose angles mirror the side preference: the near edge always faces the content.
    const poseY = side === 'left' ? -7 : 7;

  // All transform lives in CSS classes (inline style would win via specificity).
  // CSS custom properties carry the dynamic values (tilt, pose-y side).
  const sceneStyle: React.CSSProperties = {
    perspective: '1100px',
    perspectiveOrigin: '50% 40%',
    transformStyle: 'preserve-3d',
    contain: 'layout paint',
    willChange: entering ? 'transform' : 'auto',
    '--tilt-x': `${tilt.x}deg`,
    '--tilt-y': `${tilt.y}deg`,
    '--pose-y': `${poseY}deg`,
  } as React.CSSProperties;

  return (
    <aside
      className="lg:flex-1 min-w-[320px] max-w-[480px] lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto"
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
              side === 'left' ? 'bg-zinc-800/60 border-zinc-700/60 text-zinc-100' : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
            }`}><PanelLeft size={14} /></button>
          <button type="button" onClick={onToggleSide} aria-pressed={side === 'right'}
            title="Move calendar to the right"
            className={`h-7 w-7 rounded-[6px] border flex items-center justify-center transition-colors duration-150 ${
              side === 'right' ? 'bg-zinc-800/60 border-zinc-700/60 text-zinc-100' : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
            }`}><PanelRight size={14} /></button>
        </div>
      </div>

      {/* 3D scene. The sidebar's overflow-y-auto is the PARENT of this scene (never between
          scene and wall), so MonthWall's preserve-3d subtree is never flattened. The inset
          padding reserves room for projected overflow (break-out is visual, never a scrollbar). */}
      <div ref={sceneRef} style={sceneStyle} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
        className="relative overflow-visible rounded-lg">
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
        .calendar-scene {
          transform: rotateX(9deg) rotateY(calc(var(--pose-y, 7deg) + var(--tilt-y, 0deg))) scale(1);
          transition: transform 150ms ease-out;
          will-change: transform;
        }
        .calendar-scene.is-entrancing {
          transform: rotateX(9deg) rotateY(calc(var(--pose-y, 7deg) + var(--tilt-y, 0deg))) scale(0.99);
          transition: transform 520ms cubic-bezier(0.16,1,0.3,1) 80ms;
        }
        @media (prefers-reduced-motion: reduce) {
          .calendar-scene, .calendar-scene.is-entrancing {
            transform: rotateX(9deg) rotateY(7deg) scale(1) !important;
            transition: none !important;
            will-change: auto !important;
          }
        }
      `}</style>
    </aside>
  );
}
