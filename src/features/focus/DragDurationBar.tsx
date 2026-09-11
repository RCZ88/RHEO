import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { useDragDuration } from '../../hooks/useDragDuration';
import { fmtClock } from './focusHelpers';

const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

interface DragDurationBarProps {
  valueSec: number;
  onChange: (sec: number) => void;
  disabled?: boolean;
}

export function DragDurationBar({ valueSec, onChange, disabled }: DragDurationBarProps) {
  const [local, setLocal] = useState(valueSec);
  const { dragging, onPointerDown, onPointerMove, onPointerUp, reset } = useDragDuration(valueSec, setLocal);

  useEffect(() => { setLocal(valueSec); reset(valueSec); }, [valueSec, reset]);

  const min = Math.round(MIN_MINUTES * 60);
  const max = Math.round(MAX_MINUTES * 60);
  const pct = Math.max(0, Math.min(100, ((local - min) / (max - min)) * 100));

  return (
    <div className="mb-3 select-none">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Drag duration</span>
        <span className="text-[11px] font-mono tabular-nums text-pink-300">{fmtClock(local)}</span>
      </div>
      <div
        onPointerDown={disabled ? undefined : onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative flex items-center h-8 rounded-lg bg-zinc-800/50 border border-zinc-800/50 overflow-hidden ${
          disabled ? 'opacity-40 cursor-not-allowed' : dragging ? 'border-pink-500/50 cursor-grabbing' : 'cursor-grab hover:border-pink-500/30'
        }`}
        title={dragging ? 'Release to set duration' : 'Drag left/right to set session length'}
      >
        <div
          className="absolute inset-y-0 left-0 bg-pink-500/15 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
        <GripVertical className="relative z-10 w-3.5 h-3.5 mx-2 text-zinc-500" />
        <span className="relative z-10 text-[10px] text-zinc-500">
          {dragging ? `${Math.round(local / 60)} min` : 'drag to adjust'}
        </span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-zinc-600">{MIN_MINUTES}m</span>
        <span className="text-[9px] text-zinc-600">{MAX_MINUTES}m</span>
      </div>
    </div>
  );
}
