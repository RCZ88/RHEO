# Light Mode Full Redesign — Context Bundle
**Date:** 08092026
**Task:** Full light mode redesign of every UI element, section card, page, subpage — per-element/per-card/per-page customization.

---

## 1. Design Tokens (src/index.css — @theme block, lines 8-43)

```css
@theme {
	--ws-surface: #09090b;
	--ws-surface-raised: #18181b;
	--ws-border: rgb(39 39 42 / 0.6);
	--ws-border-strong: rgb(63 63 70 / 0.6);
	--ws-accent: #06b6d4;
	--ws-radius-card: 0.5rem;
	--ws-dur: 150ms;
	--ws-ease: cubic-bezier(0.2, 0, 0, 1);

	--color-clay-300: #f0a892;
	--color-clay-400: #e8866b;
	--color-clay-500: #d96846;
	--color-clay-600: #c2553a;
	--color-sage-400: #6fb38f;
	--color-amber-400: #fbbf24;
	--color-sky-400: #5ab0c9;
	--color-glow: #f7f3ee;

	--font-serif: "Source Serif 4", Georgia, serif;
	--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	--font-mono: "JetBrains Mono", "Fira Code", monospace;
	--font-display: "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	--font-caslon: "Libre Caslon Text", Georgia, "Times New Roman", serif;

	--resume-success: #22c55e;
	--resume-warning: #f59e0b;
	--resume-danger: #ef4444;
	--resume-info: #3b82f6;
	--resume-score-high: #16a34a;
	--resume-score-mid: #ca8a04;
	--resume-score-low: #dc2626;
	--resume-preview-bg: #ffffff;
	--resume-preview-text: #1a1a2e;
	--resume-highlight: #fef3c7;
	--resume-accent: #6366f1;
}
```

## 2. Theme Toggle Component (src/components/ThemeToggle.tsx)

```tsx
import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { type ThemePref, THEME_EVENT } from '../lib/theme';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem('df-theme');
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const h = (e: CustomEvent) => {
      const p = e.detail?.pref;
      if (p === 'light' || p === 'dark' || p === 'system') setPref(p);
    };
    window.addEventListener(THEME_EVENT, h as EventListener);
    return () => window.removeEventListener(THEME_EVENT, h as EventListener);
  }, []);

  const cycle = () => {
    setPref(current => {
      const next: ThemePref = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
      import('../lib/theme').then(m => m.setTheme(next));
      return next;
    });
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;
  const padClass = size === 'sm' ? 'p-1.5' : size === 'md' ? 'p-2' : 'p-2.5';

  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycle}
      className={`group relative inline-flex items-center justify-center rounded-xl transition-all duration-200 ${padClass} ${
        pref === 'light'
          ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 light:bg-amber-50 light:text-amber-700 light:hover:bg-amber-100'
          : pref === 'dark'
          ? 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
          : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 light:bg-violet-50 light:text-violet-600 light:hover:bg-violet-100'
      } ${className}`}
      title={`Theme: ${pref.charAt(0).toUpperCase() + pref.slice(1)} (click to cycle)`}
    >
      <Icon size={iconSize} className="transition-transform duration-200 group-hover:scale-110" />
    </button>
  );
}
```

## 3. Sidebar Component (src/components/Sidebar.tsx) — key excerpts

**GROUP_ORDER** (line ~100):
```ts
const GROUP_ORDER = ['OVERVIEW', 'RECORD', 'INTELLIGENCE', 'CREATE', 'LIFE', 'SYSTEM'];
```

**NodeDot** (collapsed hover — lines ~420-480): Collapsed sidebar nav items reveal icons on hover with circle-to-icon animation using framer-motion `whileHover`.

**Expanded sidebar Row 2** (lines ~520-540): ThemeToggle + Pair Phone button.

## 4. GlassCard Component (src/components/GlassCard.tsx)

```tsx
type Accent = 'pink' | 'amber' | 'emerald' | 'none';

const accentConfig: Record<string, { rail: string; border: string; bg: string; edge: string, railLight: string; borderLight: string; bgLight: string }> = {
  pink:  { rail: 'bg-pink-500/60',     border: 'border-l-pink-500/20 hover:border-l-pink-500/30',   bg: 'bg-pink-500/[0.02]',  edge: 'border-pink-500/30', railLight: 'bg-pink-500/40', borderLight: 'border-l-pink-400/30', bgLight: 'bg-pink-500/[0.04]' },
  amber: { rail: 'bg-amber-500/60',    border: 'border-l-amber-500/20 hover:border-l-amber-500/30', bg: 'bg-amber-500/[0.02]', edge: 'border-amber-500/30', railLight: 'bg-amber-500/40', borderLight: 'border-l-amber-400/30', bgLight: 'bg-amber-500/[0.04]' },
  emerald: { rail: 'bg-emerald-500/60',border: 'border-l-emerald-500/20 hover:border-l-emerald-500/30', bg: 'bg-emerald-500/[0.02]', edge: 'border-emerald-500/30', railLight: 'bg-emerald-500/40', borderLight: 'border-l-emerald-400/30', bgLight: 'bg-emerald-500/[0.04]' },
};

interface GlassCardProps {
  variant?: 'default' | 'compact' | 'subtle' | 'notebook' | 'bordered' | 'elevated' | 'interactive';
  accent?: Accent;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantStyles: Record<string, string> = {
  default:   'bg-[var(--color-card)] border border-zinc-800/50 light:bg-white/80 light:border-zinc-200/40',
  compact:   'bg-[var(--color-card)] border border-zinc-800/40 p-3 light:bg-white/70 light:border-zinc-200/30',
  subtle:    'bg-[var(--color-card)] border border-zinc-800/30 light:bg-white/60 light:border-zinc-200/20',
  notebook:  'bg-[var(--color-card)] border-l-2 light:bg-white/80 light:border-l-2 light:border-zinc-300',
  bordered:  'bg-transparent border-[1.5px] light:border-zinc-300',
  elevated:  'bg-[var(--color-card)] border border-zinc-600/40 light:bg-zinc-50/80 light:border-zinc-200/50',
  interactive: 'bg-[var(--color-card)] border cursor-pointer hover:-translate-y-0.5 transition-all duration-200 light:bg-white/70 light:border-zinc-200/40',
};
```

## 5. EmptyState Component (src/components/EmptyState.tsx)

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  iconComponent?: React.ComponentType<any>;
  title: string;
  description?: string;
  hint?: string;
  action?: { label: string; onClick: () => void } | React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, iconComponent: IconComp, title, description, hint, action, className = '' }: EmptyStateProps) {
  const iconEl = icon || (IconComp ? (
    <div className="w-9 h-9 rounded-lg border border-zinc-800/60 bg-zinc-900 flex items-center justify-center light:border-zinc-200/60 light:bg-white">
      <IconComp className="w-4 h-4 text-zinc-600 light:text-zinc-400" />
    </div>
  ) : null);

  const descEl = description || hint;

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {iconEl && <div className="text-[var(--text-muted)] mb-3">{iconEl}</div>}
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {descEl && <p className="text-xs text-[var(--text-muted)] mt-1 text-center max-w-xs">{descEl}</p>}
      {action && (
        'onClick' in (action as any) ? (
          <button
            onClick={(action as { label: string; onClick: () => void }).onClick}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors duration-150 light:bg-[var(--color-primary)] light:text-[var(--color-primary-foreground)]"
          >
            {(action as { label: string; onClick: () => void }).label}
          </button>
        ) : (
          <div className="mt-3">{action as React.ReactNode}</div>
        )
      )}
    </div>
  );
}
```

## 6. LoadingState Component (src/components/LoadingState.tsx)

```tsx
interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton';
  rows?: number;
  className?: string;
}

export function LoadingState({ variant = 'spinner', rows = 3, className = '' }: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="animate-pulse bg-zinc-800 rounded-xl h-16 light:bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-5 h-5 border-2 border-zinc-700 rounded-full animate-spin" style={{ borderTopColor: 'var(--page-accent, #ec4899)' }} />
    </div>
  );
}
```

## 7. SectionHeader Component (src/components/SectionHeader.tsx)

```tsx
interface SectionHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

export function SectionHeader({ title, icon, action, className = '', titleClassName = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/10 border border-[var(--page-accent)]/20 flex items-center justify-center text-[var(--page-accent)] light:bg-[var(--page-accent)]/15 light:border-[var(--page-accent)]/30">
            {icon}
          </div>
        )}
        <h2 className="text-[15px] font-semibold text-zinc-100 light:text-zinc-900 ${titleClassName}">{title}</h2>
      </div>
      {action}
    </div>
  );
}
```

## 8. PageShell Component (src/components/PageShell.tsx)

```tsx
interface PageShellProps {
  variant?: 'default' | 'sticky-header' | 'dashboard';
  page: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function PageShell({ variant = 'default', page, className = '', style, children }: PageShellProps) {
  const layoutClass = {
    default:       'p-5 space-y-4',
    'sticky-header': 'flex flex-col h-full',
    dashboard:     'p-5 space-y-4',
  }[variant];

  return (
    <div
      data-page={page}
      className={`relative ${page === 'terminal' ? 'h-full min-h-0' : 'min-h-full'} ${layoutClass} ${className}`}
      style={{ animation: 'pageEnter var(--normal) var(--ease-out)', ...style }}
    >
      {children}
    </div>
  );
}
```

## 9. ErrorBoundary Component (src/components/ErrorBoundary.tsx) — key dark-only elements

- `bg-[#0a0a0a]` on line 147 — fixed dark background, no light override
- `bg-zinc-900` on line 158 — dark card bg
- `bg-zinc-800` / `bg-zinc-700` buttons — lines 181, 189, 195, 201, 207, 213
- `text-zinc-500`, `text-zinc-400`, `text-zinc-300` — various text colors
- `border-zinc-800`, `border-zinc-700` — borders

## 10. DashboardPage (src/pages/DashboardPage.tsx) — 2922 lines

**Props interface** (lines 73-103): `DashboardPageProps` with `appColors`, `categoryOverrides`, `timerBehavior`, `selectedPeriod`, `dateOffset`, `trackingBrowser`, `tierAssignments`, `timerState`, `activityFeed`.

**Key sub-components imported:**
- `HeroBand` from `./dashboard/HeroBand`
- `SummaryStrip` from `./dashboard/SummaryStrip`
- `PinnedActivities` from `./dashboard/PinnedActivities`
- `ScheduleCard` from `./dashboard/ScheduleCard`
- `StatusBand` from `./dashboard/StatusBand`
- `GoalsCard` from `../components/dashboard/GoalsCard`
- `DeadlinesCard` from `../components/dashboard/DeadlinesCard`
- `LongestFocusCard` from `../components/dashboard/LongestFocusCard`
- `WidgetGrid` from `../components/dashboard/WidgetGrid`
- `InsightStrip` from `./dashboard/InsightStrip`
- `MomentumHero` from `../components/dashboard/MomentumHero`
- `TierBreakdownStrip` from `./dashboard/TierBreakdownStrip`

**Hardcoded dark values found (grep results):**
- `bg-zinc-900` / `bg-zinc-900/60` — card backgrounds, heatmap container
- `bg-zinc-800` / `bg-zinc-800/50` — stop buttons, mode toggle, skeleton
- `text-zinc-400`, `text-zinc-500`, `text-zinc-300` — labels, secondary text
- `border-zinc-800`, `border-zinc-700` — borders on cards and buttons
- `bg-[#0a0a0a]` — ErrorBoundary fixed background (no light override)
- `bg-zinc-950` — AI summary modal background

## 11. Dashboard Sub-Components (src/pages/dashboard/)

| File | Purpose |
|------|---------|
| `HeroBand.tsx` | Top hero section of dashboard |
| `SummaryStrip.tsx` | Summary metrics strip |
| `PinnedActivities.tsx` | Pinned external activities |
| `ScheduleCard.tsx` | Schedule/calendar card |
| `StatusBand.tsx` | Status indicator band |
| `InsightStrip.tsx` | AI insight strip |
| `MomentumHero.tsx` | Momentum score hero (in `src/components/dashboard/`) |
| `WidgetGrid.tsx` | Dynamic widget layout engine (322 lines) |
| `GoalsCard.tsx` | Goals card (673 lines, in `src/components/dashboard/`) |
| `DeadlinesCard.tsx` | Deadlines + reminders card (842 lines, in `src/components/dashboard/`) |
| `LongestFocusCard.tsx` | Longest focus session card (196 lines, in `src/components/dashboard/`) |

## 12. WidgetGrid (src/components/dashboard/WidgetGrid.tsx) — 322 lines

```tsx
// Key dark-only values:
// - bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/50 (heatmap container)
// - bg-zinc-800 rounded-lg p-1 gap-1 (mode toggle)
// - text-zinc-400 hover:text-white / text-zinc-500 (labels)
// - bg-zinc-700 text-white (active mode toggle button)
// - bg-zinc-800 text-white (widget card backgrounds)
```

## 13. MomentumHero (src/components/dashboard/MomentumHero.tsx) — 193 lines

```tsx
// Key dark-only values:
// - bg-[rgba(24,24,27,0.60)] (card background)
// - border-zinc-800/50 (border)
// - bg-zinc-800 rounded w-* (skeleton elements)
// - text-zinc-400, text-zinc-500, text-zinc-600 (all labels)
// - border-zinc-800/50 (dividers)
// - No light overrides anywhere
```

## 14. GoalsCard (src/components/dashboard/GoalsCard.tsx) — 673 lines

```tsx
// Key dark-only values:
// - bg-zinc-900/60, bg-zinc-800/50 (card backgrounds)
// - border-zinc-800, border-zinc-700 (borders)
// - text-zinc-400, text-zinc-500 (labels)
// - bg-zinc-800 rounded-lg (skeleton, inputs)
// - No light overrides in most places
```

## 15. DeadlinesCard (src/components/dashboard/DeadlinesCard.tsx) — 842 lines

```tsx
// Key dark-only values:
// - bg-zinc-900/60, bg-zinc-800 (card backgrounds)
// - border-zinc-800, border-zinc-700 (borders)
// - text-zinc-400, text-zinc-500 (labels)
// - bg-zinc-800/60 (modal backgrounds)
// - text-zinc-300 (primary text on dark)
```

## 16. LongestFocusCard (src/components/dashboard/LongestFocusCard.tsx) — 196 lines

```tsx
// Key dark-only values:
// - bg-[rgba(24,24,27,0.60)] (card background)
// - border-zinc-800/60 (border)
// - text-white, text-white/70, text-white/80, text-white/40, text-white/50, text-white/60 (all text)
// - bg-white/5, bg-white/10 (subtle backgrounds)
// - border-white/5, border-white/10 (borders)
// - bg-black/30 (toggle background)
// - No light overrides — everything is white-on-dark
```

## 17. Theme Infrastructure (src/lib/theme.ts)

```ts
export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_EVENT = 'df-theme-change';

export function setTheme(pref: ThemePref) {
  localStorage.setItem('df-theme', pref);
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  if (pref === 'system') {
    const osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.add(osDark ? 'dark' : 'light');
  } else {
    html.classList.add(pref);
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { pref } }));
}
```

## 18. Page Inventory — All Pages in src/pages/

```
ActivityPage.tsx
AgenticSystemPage.tsx
AiPage.tsx
BackupCenterPage.tsx
BrowserActivityPage.tsx
CompositionPage.tsx
ConductorPage.tsx
dashboard/
  HeroBand.tsx
  InsightStrip.tsx
  PinnedActivities.tsx
  ProductivityFocusZone.tsx
  ScheduleCard.tsx
  Sparkline.tsx
  StatusBand.tsx
  StopwatchTimer.tsx
  SummaryStrip.tsx
  TierBreakdownStrip.tsx
DashboardPage.tsx
DatabasePage.tsx
DesignWorkspacePage.tsx
ExternalPage.tsx
FeatureStudioPage.tsx
FinancePage.tsx
FocusPage.tsx
GoalsPage.tsx
GuidePage.tsx
IDEHelpPage.tsx
IDEProjectsPage.tsx
InsightsPage.tsx
NotFoundPage.tsx
ProductivityPage.tsx
RankingsPage.tsx
ResumeBuilderPage.tsx
ResumeExportPage.tsx
ResumeImportPage.tsx
ResumePage.tsx
ResumePreviewPage.tsx
SettingsPage.tsx
SimpleTerminalPage.tsx
StatsPage.tsx
SubscriptionsPage.tsx
TerminalPage.tsx
TutorialPage.tsx
WorkspacesPage.tsx
```

## 19. IPC Endpoints for Mobile Pairing (src/preload.ts, src/main.ts, sync-server/)

### IPC Channels (src/preload.ts lines 1601+):
- `pair:generate-code` — generate QR pair code (NO auth needed, local relay fallback)
- `pair:revoke` — revoke a device
- `pair:list-active` — list active paired devices
- `pair:revoke-all` — revoke all devices
- `device-sync-status` — one-shot device sync status

### Main Process Handlers (src/main.ts lines 9109+):
- `pair:generate-code` → `terminalRelay.generatePairCode(terminalId)` → returns `{ code, syncUrl }`
- `pair:revoke` → `terminalRelay.revokeDevice({ deviceId, terminalId })`
- `pair:list-active` → `terminalRelay.listActiveDevices(terminalId)`
- `pair:revoke-all` → `terminalRelay.revokeAllDevices(terminalId)`

### Sync Server Routes (sync-server/src/routes/):
- `pairing.ts` — POST `/v1/auth/pair/generate` (creates ephemeral account + code + token, requires auth)
- `devices.ts` — GET `/v1/devices` (lists paired devices, requires auth; DELETE revokes)
- `phone.ts` — GET `/v1/phone/redeem` (redeems pair code, returns token + deviceId, requires auth)

### Key insight:
- `PairPhoneModal` (sidebar "Pair Phone" button) → `pairGenerateCode(terminalId)` → **works without auth** (local relay fallback). This is the functional QR flow.
- `SyncPairModal` (DevicesPanel "Pair New Device") → `authPairGenerate()` → **requires auth**. This is the one that fails without login.

## 20. Current State Management

- Theme: `localStorage['df-theme']` — `'light' | 'dark' | 'system'`, default `'dark'`
- Theme applied via `document.documentElement.classList` — `.light` or `.dark`
- Custom event `df-theme-change` broadcasts theme changes
- CSS custom properties (`var(--color-card)`, `var(--text-primary)`, etc.) are the design token mechanism
- Pages use `data-page` attribute on root div for page-specific accent colors

---

## What Needs To Change

### Foundation: index.css
- CSS `@theme` block has NO light mode values — only dark mode values exist
- Every `--color-*` variable is dark-only
- Components use `var(--color-card)`, `var(--text-primary)`, etc. which resolve to dark values only
- Need: comprehensive light mode CSS variable set in `@theme` block

### Components: Per-element light mode customization needed on:
- **GlassCard** — already has `light:` variants for some variants, but needs full per-variant light mode design
- **EmptyState** — already has `light:` on icon container, needs full light mode
- **LoadingState** — skeleton has `light:bg-zinc-100`, spinner has none
- **SectionHeader** — title has `light:text-zinc-900`, icon container has `light:` variants, needs full light mode
- **PageShell** — page enter animation, needs light mode consideration
- **ErrorBoundary** — FULLY dark-only, needs complete light mode redesign
- **ThemeToggle** — already has `light:` variants, needs polished light mode
- **DashboardPage** — 2922 lines, many hardcoded dark values
- **WidgetGrid** — hardcoded dark values throughout
- **MomentumHero** — hardcoded dark values throughout
- **GoalsCard** — hardcoded dark values throughout
- **DeadlinesCard** — hardcoded dark values throughout
- **LongestFocusCard** — hardcoded dark values throughout (white-on-dark, no light overrides)
- **All other pages** — same pattern

### Design Principle
- Light mode is NOT just inverting dark mode — it needs its own tailored design
- White/light backgrounds with proper contrast
- Reduced saturation for accents on light backgrounds
- Proper typography hierarchy for light mode
- Cards should feel light and airy, not like dark cards inverted
