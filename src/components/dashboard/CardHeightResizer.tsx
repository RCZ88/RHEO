// ============================================================
// DeskFlow Dashboard — CardHeightResizer
// Draggable handle to adjust the max-height of card list containers
// in real-time by updating CSS custom properties on the card element
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import type { CSSProperties } from 'react';

interface CardHeightResizerProps {
  /** CSS variable name to adjust, e.g. "--dashboard-card-list-max-height" */
  cssVar: string;
  /** Default pixel value for the variable */
  defaultPx?: number;
  /** Minimum pixel value */
  minPx?: number;
  /** Maximum pixel value */
  maxPx?: number;
  /** Optional label shown on the handle */
  label?: string;
}

export function CardHeightResizer({
  cssVar,
  defaultPx = 96,
  minPx = 60,
  maxPx = 300,
  label = 'Resize',
}: CardHeightResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentHeightRef = useRef(defaultPx);

  // Initialize the CSS variable on mount
  useEffect(() => {
    const root = document.documentElement;
    const currentValue = getComputedStyle(root).getPropertyValue(cssVar).trim();
    if (currentValue) {
      currentHeightRef.current = parseInt(currentValue) || defaultPx;
    }
    root.style.setProperty(cssVar, `${defaultPx}px`);
  }, [cssVar, defaultPx]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentHeightRef.current = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(cssVar) || `${defaultPx}`
    ) || defaultPx;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY; // dragging up = bigger
      const newHeight = Math.max(minPx, Math.min(maxPx, currentHeightRef.current + deltaY));
      document.documentElement.style.setProperty(cssVar, `${newHeight}px`);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, cssVar, minPx, maxPx, defaultPx]);

  const toggleCollapse = () => {
    const root = document.documentElement;
    if (isCollapsed) {
      root.style.setProperty(cssVar, `${currentHeightRef.current}px`);
    } else {
      root.style.setProperty(cssVar, '0px');
    }
    setIsCollapsed(!isCollapsed);
  };

  if (isCollapsed) return null;

  return (
    <div
      className="flex items-center gap-1 cursor-ns-resize opacity-40 hover:opacity-80 transition-opacity py-1"
      onMouseDown={startDrag}
      title={`Drag to adjust ${label} height`}
    >
      <motion.div
        className="flex items-center gap-1 text-[9px] text-zinc-500"
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      >
        <Maximize2 size={10} />
        <span>{label}</span>
        <ChevronUp size={10} />
      </motion.div>
    </div>
  );
}

interface CardHeightToggleProps {
  cssVar: string;
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
  label?: string;
}

export function CardHeightToggle({
  cssVar,
  defaultPx = 96,
  minPx = 60,
  maxPx = 300,
  label = 'Height',
}: CardHeightToggleProps) {
  const [level, setLevel] = useState<'compact' | 'medium' | 'tall'>('medium');

  const levels = [
    { key: 'compact' as const, px: 60, label: 'Compact' },
    { key: 'medium' as const, px: 96, label: 'Medium' },
    { key: 'tall' as const, px: 160, label: 'Tall' },
  ];

  const setHeight = (px: number) => {
    document.documentElement.style.setProperty(cssVar, `${px}px`);
  };

  const cycle = () => {
    const next = levels[(levels.findIndex(l => l.key === level) + 1) % levels.length];
    setLevel(next.key);
    setHeight(next.px);
  };

  const current = levels.find(l => l.key === level) || levels[1];

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
      title={`${label}: ${current.label} (${current.px}px) — click to cycle`}
    >
      <ChevronDown size={10} />
      <span>{current.label}</span>
    </button>
  );
}
