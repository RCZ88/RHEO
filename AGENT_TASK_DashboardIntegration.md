# RHEO Dashboard Cards Integration — Agent Task

## Context
You're working on the RHEO Electron+React+Vite app at:
`/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`

DO NOT work on `/home/clementzhao/dev/rheo/` — that's a separate project.

Build: `node scripts/build.mjs`

## Task Split
Another agent already completed:
- Created `src/components/dashboard/FeatureCard.tsx` (the FeatureCard component)
- Updated `src/components/learn/blocks/ProseBlock.tsx` (added prose-invert classes)

YOUR JOB: Complete the remaining 3 integration tasks.

---

## Task 1: Update DashboardPage.tsx to use FeatureCard

**File**: `src/pages/DashboardPage.tsx` (3347 lines, already heavily modified)

**Current state**: Has `customCards` state, `isEditMode` state, `rheo:tool-result` listener, `rheo:add-dashboard-card` listener, `rheo:navigate` listener, edit mode toolbar with quick action buttons, and Quick Access card grid (lines 3287-3347).

**What to do**:
1. Add import: `import { FeatureCard } from '../components/dashboard/FeatureCard';`
2. Add import: `import { useHubState } from '../contexts/HubContext';` — BUT this hook doesn't exist yet. Create a minimal `HubContext` at `src/contexts/HubContext.tsx` with a `useHubState` hook that returns `{ spokes: { finance: { data: null }, tracking: { data: null }, goals: { data: null }, schedule: { data: null } }, broadcast: (action: any) => window.dispatchEvent(new CustomEvent('rheo:hub-update', { detail: action })) }`.
3. In the DashboardPage component, add: `const { spokes, broadcast } = useHubState();`
4. Add a `cards` state with default 7 FeatureCard entries:
```tsx
const [cards, setCards] = useState([
  { id: 'finance', type: 'finance' as const, title: 'Finance Overview' },
  { id: 'ide', type: 'ide' as const, title: 'IDE Projects' },
  { id: 'learn', type: 'learn' as const, title: 'Learning Path' },
  { id: 'activity', type: 'activity' as const, title: 'Activity Tracking' },
  { id: 'schedule', type: 'schedule' as const, title: 'Schedule' },
  { id: 'goals', type: 'goal' as const, title: 'Life Goals' },
  { id: 'terminal', type: 'terminal' as const, title: 'Terminal Workspace' },
]);
```
5. Keep the EXISTING `customCards` state and its rendering (lines 3287-3347). But ALSO add a new section above it that renders the `FeatureCard` grid:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
  {cards.map((card) => (
    <FeatureCard
      key={card.id}
      id={card.id}
      type={card.type}
      title={card.title}
      data={getLiveData(card.type)}
      onQuickAction={() => handleQuickAction(card.type)}
    />
  ))}
</div>
```
6. Add `getLiveData` helper:
```tsx
const getLiveData = (type: string) => {
  switch (type) {
    case 'finance': return spokes.finance?.data;
    case 'activity': return spokes.tracking?.data;
    case 'goal': return spokes.goals?.data;
    case 'schedule': return spokes.schedule?.data;
    default: return null;
  }
};
```
7. Add `handleQuickAction` function:
```tsx
const handleQuickAction = (type: string) => {
  if (type === 'finance') broadcast({ type: 'OPEN_MODAL', payload: 'add_transaction' });
  if (type === 'terminal') broadcast({ type: 'NEW_SESSION' });
};
```
8. Add `useEffect` to listen for `rheo:hub-update` events and add cards:
```tsx
useEffect(() => {
  const handleCardUpdate = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail.type === 'ADD_DASHBOARD_CARD') {
      setCards(prev => {
        if (prev.some(c => c.id === detail.card.id)) return prev;
        return [...prev, detail.card];
      });
    }
  };
  window.addEventListener('rheo:hub-update', handleCardUpdate as EventListener);
  return () => window.removeEventListener('rheo:hub-update', handleCardUpdate as EventListener);
}, []);
```

**IMPORTANT**: Do NOT remove existing functionality (StatusBand, MomentumHero, PinnedActivities, SummaryStrip, etc.). ADD FeatureCard grid ABOVE the existing Quick Access section. Keep all existing imports and components.

---

## Task 2: Create dashboard-tools.ts and integrate with toolRegistry.ts

**File to create**: `src/lib/ai/tools/dashboard-tools.ts`

Create a new file with:
```typescript
import { toolRegistry } from '../services/toolRegistry';

export function registerDashboardTools() {
  // Add a tool that dispatches rheo:hub-update events
  // This integrates with the existing toolRegistry.ts at src/services/ai/toolRegistry.ts
  // The tool should be registered using the existing r() function pattern
}
```

**File to modify**: `src/services/ai/toolRegistry.ts`

Add a new `create_feature_card` tool in the `registerAll()` function (after existing tools):
```typescript
r('create_feature_card', 'Add a feature card to the user dashboard', {
  id: p('string', 'Unique ID for the card', { required: true }),
  type: p('string', 'Card type', { enum: ['finance', 'ide', 'learn', 'activity', 'schedule', 'goal', 'terminal'], required: true }),
  title: p('string', 'Display title for the card', { required: true }),
}, 'confirm', 'dashboard', async (params) => {
  const gate = await checkAccess('dashboard');
  if (!gate.allowed) return { _privacy: true, message: gate.message };

  // Dispatch via Hub Protocol
  window.dispatchEvent(new CustomEvent('rheo:hub-update', {
    detail: {
      type: 'ADD_DASHBOARD_CARD',
      card: { id: params.id, type: params.type, title: params.title }
    }
  }));

  return {
    success: true,
    data: { message: `Added ${params.type} card to dashboard`, cardId: params.id }
  };
});
```

Also check that `p()` and `r()` and `checkAccess()` are available in the file scope (they should be based on existing patterns).

---

## Task 3: Update terminal component with RHEO Dark theme

**File**: `src/terminal/components/Terminal.tsx` (this is the actual terminal component)

Find the terminal initialization `useEffect` and apply RHEO Dark theme colors:

```typescript
// Apply RHEO Dark theme
const rheoTheme = {
  background: '#09090b', // zinc-950
  foreground: '#e4e4e7', // zinc-200
  cursor: '#ec4899',     // pink-500
  selection: '#ec489930',
  black: '#27272a',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#d946ef',
  cyan: '#06b6d4',
  white: '#fafafa',
  brightBlack: '#3f3f46',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#e879f9',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};
```

Also add input sanitization: strip dangerous shell operators `[;&|`$(){}`\\]` from user input before writing to terminal.

**IMPORTANT**: The terminal already has a theme system (`ThemeDef` type). Apply the RHEO Dark theme by mapping the colors to the existing theme structure. Check how `theme` objects are constructed in `src/terminal/lib/types.ts` or wherever `ThemeDef` is defined.

---

## Verification

After completing all 3 tasks:
1. Run `node scripts/build.mjs` to verify no build errors
2. Run `npx tsc --noEmit --project tsconfig.app.json` and filter for errors in your modified files only
3. Ensure all existing functionality is preserved (no deletions)
4. Ensure brace balance on all modified files: `node -e "const fs=require('fs');const c=fs.readFileSync(file,'utf8');console.log((c.match(/{/g)||[]).length - (c.match(/}/g)||[]).length)"` should output 0

## Design Principles
- Dark Glass style: zinc-950/zinc-900 base, pink-500 accent
- L2 Responsive motion level
- z-index scale: 0/10/20/30/40/50
- Touch targets ≥ 44×44px
- prefers-reduced-motion respected
- Anti-patterns to avoid: arbitrary z-index, animating layout properties, opacity on text
