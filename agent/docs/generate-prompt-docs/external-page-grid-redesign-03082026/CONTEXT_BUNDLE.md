# Context Bundle — External Page Grid & Gap Fill Redesign

## Current File
- `src/pages/ExternalPage.tsx` — 3560 lines, monolithic component

## Current Grid Algorithm (treemapData)
```tsx
const treemapData = useMemo(() => {
  const GRID_COLS = 4;
  const allNonSleep = orderedActivities.filter(a => a.type !== 'sleep');
  const sleepActivities = orderedActivities.filter(a => a.type === 'sleep');

  const withTime = allNonSleep
    .map(a => ({ activity: a, seconds: stats.byActivity[a.name]?.total_seconds || 0 }))
    .filter(i => i.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  const zeroTime = allNonSleep.filter(a => (stats.byActivity[a.name]?.total_seconds || 0) === 0);
  const totalSeconds = withTime.reduce((s, i) => s + i.seconds, 0);

  // Row-based packing: each row fills exactly 4 columns
  const packedCells = [];
  let rowItems = [];
  let rowSeconds = 0;

  const flushRow = () => {
    let assigned = 0;
    for (let j = 0; j < rowItems.length; j++) {
      const r = rowItems[j];
      const isLast = j === rowItems.length - 1;
      let cols;
      if (isLast) {
        cols = GRID_COLS - assigned;
      } else {
        cols = Math.max(1, Math.round((r.seconds / rowSeconds) * GRID_COLS));
        cols = Math.min(cols, GRID_COLS - assigned - (rowItems.length - j - 1));
      }
      cols = Math.max(1, Math.min(3, cols)); // cap at 3
      assigned += cols;
      const fraction = r.seconds / totalSeconds;
      const rowSpan = fraction > 0.25 ? 2 : 1;
      packedCells.push({ activity: r.activity, colSpan: cols, rowSpan });
    }
    rowItems = [];
    rowSeconds = 0;
  };

  // ... packing loop ...
  return { cells, totalCols: GRID_COLS };
}, [orderedActivities, stats]);
```

## Grid CSS
```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${treemapData.totalCols}, minmax(0, 1fr))` }}>
  {treemapData.cells.map((cell, idx) => (
    <div style={{ gridColumn: `span ${cell.colSpan}`, gridRow: `span ${cell.rowSpan}` }}>
      {/* card content */}
    </div>
  ))}
</div>
```

## Card Rendering (simplified)
```tsx
const isLarge = cell.colSpan >= 2 || cell.rowSpan >= 2;

<motion.button
  className={`rounded-xl flex flex-col items-center justify-center gap-2 ${isLarge ? 'p-5' : 'p-3'}`}
  style={{
    minHeight: isLarge ? '160px' : '130px',
    backgroundColor: activity.color + '20',
  }}
>
  <div className={isLarge ? 'w-14 h-14' : 'w-10 h-10'} style={{ backgroundColor: activity.color }}>
    <Icon className={isLarge ? 'w-7 h-7' : 'w-5 h-5'} />
  </div>
  <div className={isLarge ? 'text-base' : 'text-sm'}>{activity.name}</div>
  <div className={isLarge ? 'text-sm' : 'text-xs'}>{formatHours(totalSeconds)}</div>
  {/* sparkline chart */}
</motion.button>
```

## Data Available
- `stats.byActivity[name].total_seconds` — total time per activity for selected period
- `allSessions` — all sessions with `started_at`, `ended_at`, `duration_seconds`, `activity_name`, `color`
- `orderedActivities` — user's drag-reordered activity list
- `selectedPeriod` — 'today' | 'week' | '7day' | 'month' | '30day' | 'all'
- `dateOffset` — navigational offset

## IPC Endpoints Used
- `getExternalStats(period)` → `{ byActivity: Record<string, { total_seconds, session_count }>, total_seconds, ... }`
- `getExternalSessions('all')` → `ExternalSession[]`
- `getExternalActivities()` → `ExternalActivity[]`
- `detectUsageGaps({ period, minGapMinutes })` → `Gap[]`
- `addExternalTime(activityId, minutes, start, end)` → fills a gap

## Design Tokens (from index.css)
- Dark mode only, glass aesthetic
- `bg-zinc-900/60 backdrop-blur-xl` for cards
- `rounded-xl` max, `p-5` padding
- Fonts: Geist (body), JetBrains Mono (code)
- Activity colors: hex stored per activity

## What the User Wants
1. **Grid**: Each card size should be UNIQUE and proportional to duration. The dominant activity should be dramatically larger. The collage should fit together tightly without weird gaps.
2. **Gap Fill**: A modal that opens from the "Gaps" button, showing gap time ranges, activity picker, duration selector, segment splitting (drag to reorder segments), auto-fill.
3. **Daily/Weekly/Monthly views**: Show activity timelines for each period. Update properly when navigating between periods.
