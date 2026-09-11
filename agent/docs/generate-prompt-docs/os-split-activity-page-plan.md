# OS Split Feature Plan — Activity Page

## Problem
User has tracking on Windows AND Linux under one account. The Activity page shows everything merged — no way to see which OS contributed what, compare OS usage, or filter by platform.

## Solution

### Architecture
- **Platform filter state lives in App.tsx** (single source of truth)
- **App.tsx computes `platformFilteredLogs`** via useMemo
- **ActivityPage receives filter + setFilter** as props
- **Sub-tabs (StatsPage, ProductivityPage, BrowserActivityPage) receive `platformFilter`** and filter their own data
- **OS split summary card** — donut chart + key metrics, shown at top of ActivityPage
- **Compare mode** — side-by-side OS comparison (toggle in ActivityPage header)

---

## 1. App.tsx Changes

### New state
```tsx
const [platformFilter, setPlatformFilter] = useState<string>('all');
const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
```

### Fetch platforms (useEffect)
```tsx
useEffect(() => {
  (async () => {
    try {
      const api = (window as any).deskflowAPI;
      const platforms = await api?.getPlatforms?.();
      if (platforms && platforms.length > 0) {
        setAvailablePlatforms(platforms);
      }
    } catch (_e) { /* platforms not available */ }
  })();
}, []);
```

### Compute filtered logs (useMemo)
```tsx
const platformFilteredLogs = useMemo(() => {
  if (platformFilter === 'all') return filteredLogs;
  return filteredLogs.filter(l => l.platform === platformFilter);
}, [filteredLogs, platformFilter]);
```

### Pass to ActivityPage Route
```tsx
<Route path="/activity" element={<ActivityPage
  appStats={appStats}
  logs={platformFilteredLogs}
  allLogs={allLogs}
  browserLogs={browserLogs}
  selectedPeriod={selectedPeriod}
  dateOffset={dateOffset}
  onDateOffsetChange={setDateOffset}
  timeMode={timeMode}
  tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS}
  liveActivityLogs={liveActivityLogs}
  domainKeywordRules={domainKeywordRules}
  externalActivities={externalActivities}
  externalActivityTiers={externalActivityTiers}
  platformFilter={platformFilter}
  availablePlatforms={availablePlatforms}
  onPlatformFilterChange={setPlatformFilter}
/>} />
```

---

## 2. ActivityPage Changes

### New props
```tsx
interface ActivityPageProps {
  // ... existing props
  platformFilter: string;
  availablePlatforms: string[];
  onPlatformFilterChange: (platform: string) => void;
}
```

### OS Filter Bar (above tabs, inside sticky header)
- Same style as DashboardPage: "OS" label + pill buttons
- All | Windows | Linux | macOS (dynamic from availablePlatforms)
- Compare toggle button on right side

### OS Split Summary Card
Shown when `availablePlatforms.length > 0`:
- Donut chart: % time per OS
- Total hours per OS
- Top app per OS
- Sessions count per OS
- Card spans full width, above tab content

### Compare Mode
When toggled on:
- Tab content area splits into N columns (one per OS)
- Each column shows that OS's stats for the active tab
- Side-by-side comparison of apps, productivity, categories

---

## 3. StatsPage Changes

### New prop
```tsx
platformFilter: string;
```

### Filtering
- Filter `logs` by `platformFilter` when not 'all'
- All downstream computations (appStats, pie chart, daily usage) already derive from filtered logs

---

## 4. ProductivityPage Changes

### New prop
```tsx
platformFilter: string;
```

### Filtering
- Same pattern as StatsPage

---

## 5. BrowserActivityPage Changes

### New prop
```tsx
platformFilter: string;
```

### Filtering
- Filter browser logs by platform

---

## Design Spec

### OS Filter Bar
```
[OS] [All] [Windows] [Linux] [macOS] ............ [⇄ Compare]
```
- Active pill: `border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]`
- Inactive: `border-[var(--border-subtle)] text-[var(--text-secondary)]`
- Font: 11px, uppercase tracking-wider for label

### OS Split Summary Card
- GlassCard with grid layout
- Donut chart center: total hours
- Legend: colored dot + OS name + hours + percentage
- Trend pill: "+12% vs last period" if data exists

### Compare Mode
- Full-width split view
- Each OS column: header with OS name + total hours
- Sync period/dateOffset across columns
- Scrollable independently

---

## Files to Modify
1. `src/App.tsx` — add platform state, filtering, prop passing
2. `src/pages/ActivityPage.tsx` — OS filter bar, summary card, compare mode
3. `src/pages/StatsPage.tsx` — accept platformFilter, filter logs
4. `src/pages/ProductivityPage.tsx` — accept platformFilter, filter logs
5. `src/pages/BrowserActivityPage.tsx` — accept platformFilter, filter logs

---

## Verification
1. Build: `node scripts/build.mjs` exits 0
2. Source: grep for `platformFilter` in modified files
3. Verify DB has platform data: `SELECT DISTINCT platform FROM logs`
4. Runtime: toggle OS filter, verify data changes
5. Runtime: toggle compare mode, verify split view renders
