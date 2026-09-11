import { useCallback, useRef, useState } from 'react';

const MAX_DURATION_MIN = 180; // 3 hours hard cap

export function useDragDuration(initialSec: number, onChange: (sec: number) => void) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const startSecRef = useRef<number>(initialSec);
  const lastSecRef = useRef<number>(initialSec);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      startXRef.current = e.clientX;
      startSecRef.current = lastSecRef.current;
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      // 8px per minute → 60s per 8px feels right; 1px ≈ 7.5s
      const deltaSec = Math.round((dx / 8) * 60);
      const next = Math.max(0, Math.min(MAX_DURATION_MIN * 60, startSecRef.current + deltaSec));
      lastSecRef.current = next;
      onChange(next);
    },
    [dragging, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [dragging],
  );

  const reset = useCallback((sec: number) => {
    lastSecRef.current = sec;
  }, []);

  return { dragging, onPointerDown, onPointerMove, onPointerUp, reset };
}
