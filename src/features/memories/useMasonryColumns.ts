import { useMemo } from 'react';

const GAP = 0.06;
const MIN_ASPECT = 0.35;
const MAX_ASPECT = 2.6;

export function useMasonryColumns<T>(
  items: T[],
  aspectOf: (item: T) => number,
  columns: number,
): T[][] {
  return useMemo(() => {
    const cols: T[][] = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    for (const item of items) {
      const target = heights.indexOf(Math.min(...heights));
      cols[target].push(item);
      const aspect = Math.min(Math.max(aspectOf(item) || 1, MIN_ASPECT), MAX_ASPECT);
      heights[target] += 1 / aspect + GAP;
    }
    return cols;
  }, [items, columns]);
}

export function useColumnCount(_containerRef: React.RefObject<HTMLElement | null>): number {
  // Returns column count based on container width
  // < 640px → 2 · < 1080px → 3 · < 1560px → 4 · else 5
  // This is a simplified version; in practice, use ResizeObserver
  return 4; // default
}