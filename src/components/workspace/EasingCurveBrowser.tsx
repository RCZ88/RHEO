import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, TrendingUp as BezierCurve } from 'lucide-react';
import { EASING_PRESETS } from './MotionPresets';
import { IconButton } from './_ds/primitives';

interface EasingCurveBrowserProps {
  selectedEasing: string | null;
  onSelectEasing: (name: string) => void;
}

function bezierToPath(p1x: number, p1y: number, p2x: number, p2y: number): string {
  const scale = 180;
  const pad = 20;
  const sx = (v: number) => pad + v * scale;
  const sy = (v: number) => pad + (1 - v) * scale;
  return `M ${sx(0)} ${sy(0)} C ${sx(p1x)} ${sy(p1y)}, ${sx(p2x)} ${sy(p2y)}, ${sx(1)} ${sy(1)}`;
}

function springToPath(stiffness: number, damping: number): string {
  const points: string[] = [];
  const steps = 60;
  const dt = 0.016;
  let pos = 1;
  let vel = 0;
  const target = 0;
  const scale = 180;
  const pad = 20;
  const sx = (v: number) => pad + (1 - v) * scale;
  const sy = (v: number) => pad + v * scale;
  points.push(`M ${sx(0)} ${sy(0)}`);
  for (let i = 0; i < steps; i++) {
    const force = -stiffness * (pos - target);
    const damp = -damping * vel;
    vel += (force + damp) * dt;
    pos += vel * dt;
    points.push(`L ${sx(i / steps)} ${sy(pos)}`);
  }
  return points.join(' ');
}

export function EasingCurveBrowser({ selectedEasing, onSelectEasing }: EasingCurveBrowserProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (formula: string, name: string) => {
    navigator.clipboard.writeText(formula).catch(() => {});
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  const renderCurve = (preset: typeof EASING_PRESETS[0]) => {
    if (preset.type === 'spring') {
      const v = preset.value as { stiffness: number; damping: number };
      return springToPath(v.stiffness, v.damping);
    }
    const v = preset.value as number[];
    return bezierToPath(v[0], v[1], v[2], v[3]);
  };

  const renderFormula = (preset: typeof EASING_PRESETS[0]): string => {
    if (preset.type === 'spring') {
      const v = preset.value as { stiffness: number; damping: number; mass: number };
      return `type: "spring", stiffness: ${v.stiffness}, damping: ${v.damping}, mass: ${v.mass}`;
    }
    const v = preset.value as number[];
    return `ease: [${v[0]}, ${v[1]}, ${v[2]}, ${v[3]}]`;
  };

  // Curve geometry is derived from a MODULE CONSTANT list, so it is computed once
  // for the whole component — never inside the .map() below. A hook inside a map
  // callback is a hook whose COUNT depends on the array length; that is React's
  // "rendered more/fewer hooks than expected" crash waiting for the list to change.
  const CURVES = useMemo(
    () => EASING_PRESETS.map((preset) => ({
      preset,
      pathD: renderCurve(preset),
      formula: renderFormula(preset),
    })),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BezierCurve className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Easing Curves</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CURVES.map(({ preset, pathD, formula }) => {
          const isSelected = selectedEasing === preset.name;
          return (
            <motion.button
              key={preset.name}
              onClick={() => onSelectEasing(preset.name)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-colors
                ${isSelected
                  ? 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_20px_rgba(244,114,182,0.1)]'
                  : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border-zinc-800/60 hover:border-zinc-700/80'}
              `}
            >
              <svg viewBox="0 0 220 220" className="w-full h-24 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/50">
                <line x1="20" y1="200" x2="200" y2="200" stroke="#3f3f46" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="200" stroke="#3f3f46" strokeWidth="1" />
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? '#f472b6' : '#a1a1aa'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isSelected ? 'text-pink-300' : 'text-zinc-300'}`}>
                  {preset.name}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
              </div>
              <code className="text-[10px] font-mono text-zinc-500 truncate">{formula}</code>
              <IconButton
                onClick={(e) => { e.stopPropagation(); handleCopy(formula, preset.name); }}
                title="Copy formula"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
              >
                {copied === preset.name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              </IconButton>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
