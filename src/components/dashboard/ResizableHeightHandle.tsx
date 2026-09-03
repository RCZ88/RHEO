// ============================================================
// DeskFlow Dashboard — ResizableHeightHandle
// Draggable handle that adjusts the max-height of a card's
// list container in real-time. Uses Framer Motion drag constraints
// for y-axis-only resizing.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface ResizableHeightHandleProps {
  cardId: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
}

export function ResizableHeightHandle({
  cardId,
  defaultHeight = 96,
  minHeight = 48,
  maxHeight = 300,
  onHeightChange,
}: ResizableHeightHandleProps) {
  const [height, setHeight] = useState(defaultHeight);
  const startYRef = useRef(0);
  const startHeightRef = useRef(defaultHeight);
  const draggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('cursor-row-resize', 'select-none');
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const delta = startYRef.current - e.clientY;
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + delta));
    setHeight(newHeight);
    onHeightChange?.(newHeight);

    // Apply to the target list container
    const target = document.querySelector(`[data-card-list="${cardId}"]`);
    if (target) {
      (target as HTMLElement).style.maxHeight = newHeight + 'px';
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.classList.remove('cursor-row-resize', 'select-none');
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('cursor-row-resize', 'select-none');
    };
  }, []);

  return (
    <motion.div
      className="shrink-0 flex items-center justify-center py-1 cursor-row-resize group"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => document.body.classList.add('cursor-row-resize')}
      onMouseLeave={() => document.body.classList.remove('cursor-row-resize')}
      whileHover={{ opacity: 1 }}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/30 border border-zinc-700/30 group-hover:border-zinc-600/50 group-hover:bg-zinc-800/50 transition-all text-zinc-500 group-hover:text-zinc-400"
        style={{ fontSize: '10px' }}
      >
        <ChevronUp size={10} />
        <span>{height}px</span>
        <ChevronDown size={10} />
      </motion.div>
    </motion.div>
  );
}
