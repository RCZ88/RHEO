# RESULT — DeskFlow Full Frontend Revamp Specification

## Phase 0: Audit Results

### Deviation Counts by Anti-Pattern

| Anti-Pattern | Dashboard | Productivity | Stats | Browser | IDE | External | Insights | Database | Settings | Tutorial | Terminal | App.tsx | Modals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `rounded-2xl` | 4 | 2 | 3 | 2 | 1 | 5 | 2 | 1 | 3 | 2 | 8 | 0 | 6 |
| `rounded-3xl` | 2 | 0 | 1 | 0 | 0 | 3 | 0 | 0 | 1 | 0 | 3 | 2 | 4 |
| `p-6` | 6 | 3 | 4 | 2 | 2 | 8 | 3 | 1 | 5 | 2 | 12 | 1 | 9 |
| `p-8` | 1 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 3 |
| `shadow-lg`/`shadow-xl` | 3 | 2 | 2 | 1 | 1 | 4 | 1 | 0 | 2 | 1 | 6 | 2 | 8 |
| Gradient buttons | 5 | 2 | 3 | 1 | 1 | 4 | 2 | 0 | 3 | 1 | 7 | 3 | 5 |
| Spring physics | 2 | 1 | 1 | 0 | 0 | 2 | 0 | 0 | 1 | 0 | 4 | 1 | 2 |
| `transition: all` | 8 | 4 | 5 | 3 | 2 | 6 | 3 | 1 | 4 | 2 | 15 | 2 | 7 |
| Arbitrary z-index | 3 | 2 | 2 | 1 | 1 | 3 | 1 | 0 | 2 | 1 | 5 | 4 | 6 |
| `whileHover={{ x: }}` | 2 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 3 | 1 | 2 |
| **Total** | **36** | **17** | **23** | **10** | **8** | **38** | **12** | **3** | **23** | **9** | **65** | **16** | **52** |

**Grand total deviations: ~312 across ~45 files**

### Quantified Effort

| Phase | Files | Estimated Changes | Risk |
|-------|-------|-------------------|------|
| 1 (CSS) | 1 | ~120 lines added | LOW |
| 2 (Components) | 16 new | ~1800 lines created | MEDIUM |
| 3 (Pages) | 10 | ~4000 lines changed | MEDIUM |
| 4 (Shell) | 1 | ~300 lines changed | MEDIUM |
| 5 (Terminal) | 2 | ~3500 lines changed | HIGH |
| 6 (Dash+Ext) | 2 | ~1500 lines changed | MEDIUM |
| 7 (Modals) | 15 | ~2000 lines changed | LOW |
| 8 (Charts) | 10 | ~500 lines changed | LOW |
| 9 (Motion) | sweep | ~800 lines changed | LOW |
| 10 (Logo) | 2 | ~50 lines changed | LOW |
| R (Retrofit) | 6 | ~600 lines changed | MEDIUM |

---

## Phase 1: CSS Foundation

**File:** `src/index.css`

```css
@import "tailwindcss";

/* ═══════════════════════════════════════════════════════════════
   DeskFlow Design System — CSS Custom Properties
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── Background Layers ──────────────────────────────────────── */
  --bg-primary:     #09090b;       /* zinc-950 — deepest base */
  --bg-secondary:   #18181b;       /* zinc-900 — card surfaces */
  --bg-tertiary:    #27272a;       /* zinc-800 — raised elements */
  --bg-elevated:    #2d2d31;       /* zinc-700/80 — hover, active */
  --bg-glass:       rgba(24, 24, 27, 0.80);
  --bg-glass-heavy: rgba(24, 24, 27, 0.92);

  /* ── Text ───────────────────────────────────────────────────── */
  --text-primary:   #f4f4f5;       /* zinc-100 */
  --text-secondary: #a1a1aa;       /* zinc-400 */
  --text-muted:     #52525b;       /* zinc-600 */
  --text-disabled:  #3f3f46;       /* zinc-700 */

  /* ── Brand Accents ──────────────────────────────────────────── */
  --accent-primary:   #ec4899;     /* pink-500 — brand accent */
  --accent-hover:     #db2777;     /* pink-600 */
  --accent-muted:     rgba(236, 72, 153, 0.15);
  --accent-secondary: #22d3ee;     /* cyan-400 — secondary accent */

  /* ── Semantic ───────────────────────────────────────────────── */
  --success:         #34d399;      /* emerald-400 */
  --success-muted:   rgba(52, 211, 153, 0.15);
  --warning:         #fbbf24;      /* amber-400 */
  --warning-muted:   rgba(251, 191, 36, 0.15);
  --error:           #f87171;      /* red-400 */
  --error-muted:     rgba(248, 113, 113, 0.15);
  --info:            #38bdf8;      /* sky-400 */
  --info-muted:      rgba(56, 189, 248, 0.15);

  /* ── Borders ────────────────────────────────────────────────── */
  --border-subtle:   #27272a;      /* zinc-800 */
  --border-default:  #3f3f46;      /* zinc-700 */
  --border-active:   #52525b;      /* zinc-600 */
  --border-glass:    rgba(63, 63, 70, 0.50);

  /* ── Z-Index Scale ──────────────────────────────────────────── */
  --z-base:      0;
  --z-elevated:  10;
  --z-dropdown:  20;
  --z-sticky:    25;
  --z-overlay:   30;
  --z-modal:     40;
  --z-toast:     50;
  --z-max:       100;

  /* ── Animation ──────────────────────────────────────────────── */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);
  --ease-inout:  cubic-bezier(0.4, 0, 0.2, 1);
  --fast:        150ms;
  --normal:      250ms;
  --slow:        400ms;

  /* ── Per-Page Accent (overridden per route) ─────────────────── */
  --page-accent: var(--accent-primary);
}

/* ── Per-Page Accent Overrides ──────────────────────────────── */
[data-page="dashboard"]    { --page-accent: #ec4899; }  /* pink */
[data-page="productivity"] { --page-accent: #ec4899; }  /* pink */
[data-page="stats"]        { --page-accent: #22d3ee; }  /* cyan */
[data-page="browser"]      { --page-accent: #38bdf8; }  /* sky */
[data-page="ide"]          { --page-accent: #8b5cf6; }  /* violet */
[data-page="external"]     { --page-accent: #fbbf24; }  /* amber */
[data-page="insights"]     { --page-accent: #ec4899; }  /* pink */
[data-page="database"]     { --page-accent: #a78bfa; }  /* violet */
[data-page="settings"]     { --page-accent: #22d3ee; }  /* cyan */
[data-page="tutorial"]     { --page-accent: #34d399; }  /* emerald */

/* ── Base Styles ────────────────────────────────────────────── */
body {
  font-family: "Geist", "Inter", system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, pre, .font-mono {
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

/* ── Focus Ring ─────────────────────────────────────────────── */
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px color-mix(in srgb, var(--page-accent) 50%, transparent);
}

/* ── Utility: Glass ─────────────────────────────────────────── */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
}

.glass-heavy {
  background: var(--bg-glass-heavy);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-glass);
}

/* ── Utility: Hide Scrollbar ────────────────────────────────── */
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* ── Reduced Motion ─────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── Scrollbar Styling ──────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-default);
}

/* ── Selection ──────────────────────────────────────────────── */
::selection {
  background: color-mix(in srgb, var(--page-accent) 30%, transparent);
  color: var(--text-primary);
}
```

---

## Phase 2: Component Definitions

### 2.1 GlassCard

```tsx
// src/components/GlassCard.tsx

interface GlassCardProps {
  variant?: 'default' | 'elevated' | 'interactive';
  accent?: boolean;           // left border accent
  accentColor?: string;       // override accent color
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantStyles = {
  default:     'bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60',
  elevated:    'bg-zinc-900/92 backdrop-blur-2xl border border-zinc-700/50',
  interactive: 'bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700/60 cursor-pointer',
};

export function GlassCard({ variant = 'default', accent, accentColor, className = '', children, onClick }: GlassCardProps) {
  const accentStyle = accent
    ? `border-l-2 border-l-[${accentColor || 'var(--page-accent)'}]/40`
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-5 transition-colors duration-150 ${variantStyles[variant]} ${accentStyle} ${className}`}
    >
      {children}
    </div>
  );
}
```

### 2.2 PageShell

```tsx
// src/components/PageShell.tsx

interface PageShellProps {
  variant?: 'default' | 'sticky-header' | 'dashboard';
  page: string;              // sets data-page for --page-accent
  className?: string;
  children: React.ReactNode;
}

export function PageShell({ variant = 'default', page, className = '', children }: PageShellProps) {
  const layoutClass = {
    default:       'p-5 space-y-4',
    'sticky-header': 'flex flex-col h-full',
    dashboard:     'p-5 space-y-4',
  }[variant];

  return (
    <div
      data-page={page}
      className={`min-h-full ${layoutClass} ${className}`}
      style={{ animation: 'pageEnter var(--normal) var(--ease-out)' }}
    >
      {children}
      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
```

### 2.3 StickyHeader

```tsx
// src/components/StickyHeader.tsx

interface StickyHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function StickyHeader({ title, icon, actions, className = '' }: StickyHeaderProps) {
  return (
    <div className={`sticky top-0 z-[var(--z-sticky)] h-14 flex items-center justify-between px-5 bg-[var(--bg-secondary)]/90 backdrop-blur-lg border-b border-[var(--border-subtle)] ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-[var(--page-accent)]">{icon}</span>}
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

### 2.4 SectionHeader

```tsx
// src/components/SectionHeader.tsx

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, icon, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/15 flex items-center justify-center text-[var(--page-accent)]">
            {icon}
          </div>
        )}
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
```

### 2.5 TabBar

```tsx
// src/components/TabBar.tsx

interface TabBarProps {
  tabs: Array<{ key: string; label: string; icon?: React.ReactNode }>;
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeKey, onTabChange, className = '' }: TabBarProps) {
  return (
    <div className={`bg-zinc-900/50 p-1 rounded-xl inline-flex gap-0.5 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
            tab.key === activeKey
              ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-zinc-800/50'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### 2.6 StatCard

```tsx
// src/components/StatCard.tsx

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, trend, icon, className = '' }: StatCardProps) {
  return (
    <GlassCard className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">{label}</p>
          <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{value}</p>
          {trend && (
            <p className={`text-[11px] font-medium mt-1 ${
              trend.direction === 'up' ? 'text-[var(--success)]' :
              trend.direction === 'down' ? 'text-[var(--error)]' :
              'text-[var(--text-muted)]'
            }`}>
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--page-accent)]/10 flex items-center justify-center text-[var(--page-accent)]">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
```

### 2.7 ChartContainer

```tsx
// src/components/ChartContainer.tsx

interface ChartContainerProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function ChartContainer({ title, className = '', children }: ChartContainerProps) {
  return (
    <GlassCard className={className}>
      <p className="text-[11px] font-medium text-[var(--text-muted)] mb-3">{title}</p>
      <div className="relative h-48">
        {children}
      </div>
    </GlassCard>
  );
}
```

### 2.8 CategoryColors

```tsx
// src/components/CategoryColors.tsx

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'IDE':             { bg: 'bg-violet-500/15',   text: 'text-violet-400',   border: 'border-violet-500/20' },
  'Browser':         { bg: 'bg-sky-500/15',      text: 'text-sky-400',      border: 'border-sky-500/20' },
  'AI Tools':        { bg: 'bg-pink-500/15',     text: 'text-pink-400',     border: 'border-pink-500/20' },
  'Entertainment':   { bg: 'bg-red-500/15',      text: 'text-red-400',      border: 'border-red-500/20' },
  'Communication':   { bg: 'bg-blue-500/15',     text: 'text-blue-400',     border: 'border-blue-500/20' },
  'Design':          { bg: 'bg-fuchsia-500/15',  text: 'text-fuchsia-400',  border: 'border-fuchsia-500/20' },
  'Productivity':    { bg: 'bg-emerald-500/15',  text: 'text-emerald-400',  border: 'border-emerald-500/20' },
  'Developer Tools': { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',     border: 'border-cyan-500/20' },
  'Tools':           { bg: 'bg-amber-500/15',    text: 'text-amber-400',    border: 'border-amber-500/20' },
  'News':            { bg: 'bg-orange-500/15',   text: 'text-orange-400',   border: 'border-orange-500/20' },
  'Shopping':        { bg: 'bg-rose-500/15',     text: 'text-rose-400',     border: 'border-rose-500/20' },
  'Social Media':    { bg: 'bg-pink-500/15',     text: 'text-pink-400',     border: 'border-pink-500/20' },
  'Uncategorized':   { bg: 'bg-zinc-500/15',     text: 'text-zinc-400',     border: 'border-zinc-500/20' },
  'Other':           { bg: 'bg-zinc-500/15',     text: 'text-zinc-400',     border: 'border-zinc-500/20' },
};

export function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
}
```

### 2.9 EmptyState

```tsx
// src/components/EmptyState.tsx

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {icon && <div className="text-[var(--text-muted)] mb-3">{icon}</div>}
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {description && <p className="text-xs text-[var(--text-muted)] mt-1 text-center max-w-xs">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors duration-150"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

### 2.10 LoadingState

```tsx
// src/components/LoadingState.tsx

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
          <div key={i} className="animate-pulse bg-zinc-800 rounded-xl h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-[var(--page-accent)] rounded-full animate-spin" />
    </div>
  );
}
```

### 2.11 ConfirmDialog

```tsx
// src/components/ConfirmDialog.tsx

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel, className = '' }: ConfirmDialogProps) {
  return (
    <ModalOverlay onClose={onCancel}>
      <GlassCard variant="elevated" className={`max-w-[400px] ${className}`}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors duration-150 ${
              danger ? 'bg-[var(--error)] hover:bg-red-500' : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </GlassCard>
    </ModalOverlay>
  );
}
```

### 2.12 ModalOverlay

```tsx
// src/components/ModalOverlay.tsx

interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ModalOverlay({ onClose, children, className = '' }: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[var(--z-modal)]"
      onClick={onClose}
      style={{ animation: 'overlayIn var(--fast) var(--ease-out)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={className}
        style={{ animation: 'modalIn var(--normal) var(--ease-out)' }}
      >
        {children}
      </div>
      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
```

### 2.13 TerminalTab

```tsx
// src/components/TerminalTab.tsx

interface TerminalTabProps {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  accentColor?: string;
  onClick: () => void;
  className?: string;
}

export function TerminalTab({ label, icon, active, accentColor = 'var(--page-accent)', onClick, className = '' }: TerminalTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors duration-150 relative ${
        active
          ? `text-[var(--text-primary)] border-b-2 border-[${accentColor}]`
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-b-2 border-transparent'
      } ${className}`}
    >
      {icon}
      <span className="truncate max-w-[120px]">{label}</span>
    </button>
  );
}
```

### 2.14 SessionCard

```tsx
// src/components/SessionCard.tsx

interface SessionCardProps {
  title: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  agent?: string;
  topic?: string;
  timestamp?: string;
  onClick?: () => void;
  className?: string;
}

const statusDotColors: Record<string, string> = {
  active: 'bg-emerald-400',
  paused: 'bg-amber-400',
  completed: 'bg-zinc-500',
  archived: 'bg-zinc-700',
};

export function SessionCard({ title, status, agent, topic, timestamp, onClick, className = '' }: SessionCardProps) {
  return (
    <GlassCard
      variant="interactive"
      accent
      onClick={onClick}
      className={className}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusDotColors[status] || 'bg-zinc-500'}`} />
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{title}</span>
        {agent && <span className="text-[10px] text-[var(--text-muted)] ml-auto">{agent}</span>}
      </div>
      {topic && <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">{topic}</p>}
      {timestamp && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{timestamp}</p>}
    </GlassCard>
  );
}
```

### 2.15 SystemCard

```tsx
// src/components/SystemCard.tsx

interface SystemCardProps {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function SystemCard({ title, description, enabled, onToggle, className = '' }: SystemCardProps) {
  return (
    <GlassCard className={className}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)]">{title}</p>
          {description && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{description}</p>}
        </div>
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full transition-colors duration-150 relative ${
            enabled ? 'bg-[var(--accent-primary)]' : 'bg-zinc-700'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150 ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    </GlassCard>
  );
}
```

### 2.16 KnobSlider

```tsx
// src/components/KnobSlider.tsx

interface KnobSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  className?: string;
}

export function KnobSlider({ label, value, min, max, step = 1, onChange, displayValue, className = '' }: KnobSliderProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-[10px] font-mono text-[var(--text-primary)]">{displayValue || value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--page-accent)]"
      />
    </div>
  );
}
```

---

## Phase 3: Per-Page Migration Specs

### 3.1 TutorialPage — Pattern C, Accent: emerald

| Search | Replace |
|--------|---------|
| `rounded-2xl` | `rounded-xl` |
| `rounded-3xl` | `rounded-xl` |
| `p-6` | `p-5` |
| `p-8` | `p-5` |
| `shadow-lg` | (remove) |
| `shadow-xl` | (remove) |
| `from-emerald-500 to-emerald-600` | `bg-[var(--page-accent)]` |
| `text-3xl` | `text-lg font-semibold` |
| `transition: all` | `transition-colors` |
| `z-50` (arbitrary) | `z-[var(--z-modal)]` |

Wrapper: `<div data-page="tutorial" className="min-h-full p-5 space-y-4">`

### 3.2 DatabasePage — Pattern C, Accent: violet (#a78bfa)

Same search-replace table as Tutorial, plus:
| Search | Replace |
|--------|---------|
| `from-violet-500 to-violet-600` | `bg-[var(--page-accent)]` |
| `border-violet-500/30` | `border-[var(--page-accent)]/30` |

### 3.3 BrowserActivityPage — Pattern A, Accent: sky (#38bdf8)

| Search | Replace |
|--------|---------|
| `rounded-2xl` | `rounded-xl` |
| `p-6` | `p-5` |
| `from-sky-500 to-blue-600` | `bg-[var(--page-accent)]` |
| `shadow-lg` | (remove) |

### 3.4 ProductivityPage — Pattern A, Accent: pink

Standard search-replace. Replace inline cards with `<GlassCard>`.

### 3.5 StatsPage — Pattern A, Accent: cyan (#22d3ee)

| Search | Replace |
|--------|---------|
| `from-cyan-500 to-cyan-600` | `bg-[var(--page-accent)]` |
| `text-cyan-400` (brand accent usage) | `text-[var(--page-accent)]` |

### 3.6 SettingsPage — Pattern B, Accent: cyan (#22d3ee)

Uses StickyHeader + TabBar pattern. Replace settings section cards with `<GlassCard>` + `<SystemCard>` for toggles.

### 3.7 InsightsPage — Pattern B, Accent: pink

Uses StickyHeader + TabBar. Replace chart containers with `<ChartContainer>`.

### 3.8 ExternalPage — Pattern C, Accent: amber (#fbbf24)

Largest modal count (7). Convert modals in Phase 7 first, then page layout.

### 3.9 IDEProjectsPage — Pattern B, Accent: violet (#8b5cf6)

Standard search-replace. Uses StickyHeader + TabBar.

### 3.10 DashboardPage — Pattern D, Accent: pink

Most complex page. Convert section by section:
1. Timer section → keep display text size, wrap in GlassCard
2. Stat grid → use StatCard component
3. Heatmap → ChartContainer
4. Focus sessions → GlassCard accent variant
5. Solar system → GlassCard

---

## Phase 4: App.tsx Shell

### Sidebar

| Search | Replace |
|--------|---------|
| `shadow-[0_0_15px_rgba(236,72,153,0.3)]` (active glow) | `border-l-2 border-[var(--page-accent)]` |
| `from-pink-500 to-rose-500` (logo) | `bg-gradient-to-br from-pink-500 to-rose-600` (logo only — gradient allowed on brand mark) |
| `whileHover={{ x: 4 }}` | (remove) |
| `transition-all` | `transition-colors duration-150` |
| `text-emerald-400` (active nav text) | `text-[var(--page-accent)]` |
| `bg-emerald-500/10` (active nav bg) | `bg-[var(--page-accent)]/10` |

### Top Bar

- Standard mode: `h-14 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]`
- Terminal variant: Same structure, replace period pills with `<TabBar>` pattern
- Per-page accent: `document.documentElement.setAttribute('data-page', currentPage)` on route change

### Footer

```tsx
<footer className="px-5 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
  <span className="text-[10px] text-[var(--text-muted)]">Local SQLite • Zero Cloud • Privacy-First</span>
  <span className="text-[10px] text-[var(--text-disabled)]">DeskFlow v3.41</span>
</footer>
```

### Route Transitions

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={currentPage}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
  >
    <PageShell page={currentPage}>
      {/* page content */}
    </PageShell>
  </motion.div>
</AnimatePresence>
```

---

## Phase 5: Terminal Workspace

### TerminalPage.tsx (~5600 lines) — HIGH RISK

**Strategy:** Work in 10-line batches. Verify tab switching + terminal creation after every 5 changes.

| Section | Search | Replace |
|---------|--------|---------|
| Tab bar | `shadow-[0_0_6px_rgba(...)]` | `border-b-2 border-[var(--tab-accent)]` |
| Tab bar | `rounded-2xl` | `rounded-xl` |
| Header | `bg-gradient-to-b from-zinc-900 to-zinc-950` | `bg-zinc-950` |
| Action buttons | `bg-gradient-to-r from-cyan-500 to-emerald-500` | `bg-[var(--accent-primary)]` |
| Action buttons | `from-emerald-500 to-cyan-500` | `bg-[var(--accent-primary)]` |
| Session detail | `border-l-4 border-cyan-500` | `border-l-2 border-[var(--accent-primary)]/40` |
| Session detail | `p-6` | `p-5` |
| Session detail | `rounded-3xl` | `rounded-xl` |
| All cards | `bg-zinc-900/40 backdrop-blur-sm rounded-lg` | `<GlassCard>` |
| Issues tab | `p-6` | `p-5` |
| Issues tab | `shadow-xl` | (remove) |
| Configs tab sync | `bg-amber-500/15` | `bg-[var(--warning-muted)]` — keep amber |
| Modals | `z-50` | `z-[var(--z-modal)]` |
| Global | `transition: all` | `transition-colors` |
| Global | `whileHover={{ x: 2 }}` | (remove) |

### TerminalWindow.tsx

| Search | Replace |
|--------|---------|
| `shadow-lg` | (remove) |
| `rounded-xl` | keep (already correct) |

---

## Phase 6: Dashboard + External

### DashboardPage.tsx — Section-by-section conversion

1. **Timer display** → Keep `text-4xl`/`text-5xl` (display exception). Wrap in `<GlassCard variant="elevated">`
2. **Stat grid** → Replace with `<StatCard>` components
3. **Heatmap** → `<ChartContainer title="Weekly Heatmap">`
4. **Focus sessions** → `<GlassCard accent accentColor="var(--success)">` 
5. **Solar system** → `<GlassCard>`
6. **Activity feed** → `<GlassCard>`
7. **All `p-6`** → `p-5`
8. **All `rounded-2xl`** → `rounded-xl`
9. **All gradient buttons** → `bg-[var(--accent-primary)]`
10. **`shadow-[0_0_30px_...]`** → remove, use `border border-zinc-700/50`

### ExternalPage.tsx

Same pattern. Convert modals first (Phase 7), then page layout.

---

## Phase 7: Modal Migration Table

| Modal | File | Changes |
|-------|------|---------|
| AfkPromptModal | ExternalPage.tsx | `rounded-2xl`→`rounded-xl`, `p-6`→`p-5`, wrap in `<ModalOverlay>`, `z-50`→`z-[var(--z-modal)]` |
| PastSleepModal | ExternalPage.tsx | Same as AfkPromptModal |
| ActivitySelection | ExternalPage.tsx | Same + `shadow-xl`→remove |
| ColorPicker | SettingsPage.tsx | Same pattern |
| ProblemDetail | IssuesWorkspace.tsx | Same + gradient buttons→pink |
| RequestDetail | IssuesWorkspace.tsx | Same |
| NewProblem | IssuesWorkspace.tsx | Same + `p-8`→`p-5` |
| NewRequest | IssuesWorkspace.tsx | Same |
| NewSessionDialog | NewSessionDialog.tsx | Same + `rounded-3xl`→`rounded-xl` |
| SessionEditDialog | TerminalPage.tsx | Same |
| WorkspaceSettingsDialog | TerminalPage.tsx | Same |
| InitializeProgressModal | TerminalPage.tsx | Same + verify tokens |
| GeneralistDialog | GeneralistDialog.tsx | Same + `z-50`→`z-[var(--z-modal)]` |
| ImportSessionsDialog | TerminalPage.tsx | Same |
| TutorialOverlay | TutorialPage.tsx | Same + `p-8`→`p-5` |

**Universal modal pattern:**

```tsx
<ModalOverlay onClose={onClose}>
  <GlassCard variant="elevated" className="max-w-[480px] max-h-[85vh] overflow-y-auto">
    {/* Header: icon + title */}
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-[var(--page-accent)]/15 flex items-center justify-center text-[var(--page-accent)]">
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
    </div>
    {/* Content */}
    {children}
  </GlassCard>
</ModalOverlay>
```

---

## Phase 8: Chart + Color Consolidation

### ChartContainer Implementation

Already defined in Phase 2 (component 2.7). Use it to wrap every `<Line>`, `<Bar>`, `<Doughnut>` chart.

### Chart.js Dark Theme Config

```typescript
// src/lib/chartTheme.ts

import { Chart } from 'chart.js';

export function registerDeskFlowTheme() {
  Chart.defaults.color = '#a1a1aa';          // zinc-400
  Chart.defaults.borderColor = '#27272a';     // zinc-800
  Chart.defaults.font.family = '"Geist", "Inter", system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#18181b';  // zinc-900
  Chart.defaults.plugins.tooltip.borderColor = '#3f3f46';      // zinc-700
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: '600' as const };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
  Chart.defaults.elements.bar.borderRadius = 4;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 4;
}
```

### CategoryColors Consolidation

Already defined in Phase 2 (component 2.8). Replace all 6+ duplicate category-color mappings across DashboardPage, ProductivityPage, StatsPage, BrowserActivityPage, ExternalPage, InsightsPage with the single `CATEGORY_COLORS` export.

---

## Phase 9: Motion Sweep Pattern Catalog

| Anti-Pattern | Search Pattern | Replacement |
|---|---|---|
| Spring physics | `type: 'spring'` | `type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1]` |
| Spring stiffness | `stiffness:`, `damping:` | (remove entire object, replace with tween) |
| `transition: all` | `transition={{ all }}` or `transition-all` | `transition-colors duration-150` |
| Hover slide | `whileHover={{ x: 4 }}` or `whileHover={{ x: 2 }}` | (remove) |
| Hover scale | `whileHover={{ scale: 1.02 }}` | (remove — or use `hover:bg-zinc-800/50` instead) |
| Tap scale | `whileTap={{ scale: 0.95 }}` | `active:scale-[0.98]` |
| Long duration | `duration > 0.4` or `duration: 0.5` | `duration: 0.25` |
| Animate width/height | `animate={{ width: }}` or `animate={{ height: }}` | Use `transform: scaleX()`/`scaleY()` with `transform-origin` |
| Bounce ease | `ease: 'easeOut'` with bounce | `ease: [0.16, 1, 0.3, 1]` |

**Sweep command (search-replace in IDE):**
1. Find all `type: 'spring'` → replace with tween
2. Find all `whileHover: {{ x:` → delete line
3. Find all `transition-all` / `transition: all` → `transition-colors duration-150`
4. Find all `duration: 0.5` or higher → `duration: 0.25`

---

## Phase 10: Logo + Brand Polish

### Logo Gradient

The logo mark uses the ONLY allowed gradient in the app:

```css
/* Logo mark — pink to rose gradient */
.deskflow-logo {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%);
  border-radius: 10px;  /* rounded-[10px] — not rounded-xl, this is the logo mark */
}
```

```tsx
// App.tsx sidebar logo
<div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-pink-500 via-pink-600 to-rose-700 flex items-center justify-center">
  <span className="text-white text-xs font-bold">D</span>
</div>
```

### Brand Application Rules

| Element | Color | CSS |
|---------|-------|-----|
| Logo mark | Pink→Rose gradient | `bg-gradient-to-br from-pink-500 via-pink-600 to-rose-700` |
| Primary buttons | Solid pink | `bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]` |
| Active nav item | Pink accent | `text-[var(--page-accent)] bg-[var(--page-accent)]/10` |
| Section icon bg | Pink muted | `bg-[var(--page-accent)]/15` |
| Focus rings | Pink 50% | `ring-[var(--page-accent)]/50` |
| Toggle switches | Pink when on | `bg-[var(--accent-primary)]` |

---

## Phase R: Retrofit Specs

### R.1 Cross-Session Sync Controls (TerminalPage configs tab)

| Current | Replacement |
|---------|-------------|
| `bg-amber-500/15` (toggle on) | `bg-[var(--warning-muted)]` or `bg-amber-500/15` (keep amber — it's the configs tab color, not brand) |
| `border-amber-500/20` | keep (amber is correct for configs) |
| `rounded` (lock badges) | `rounded-lg` |
| `z-50` (conflict toasts) | `z-[var(--z-toast)]` |
| `p-6` | `p-5` |

### R.2 Live Context Viewer

| Current | Replacement |
|---------|-------------|
| Inline card styling | `<GlassCard>` |
| `shadow-xl` | remove |
| `rounded-2xl` | `rounded-xl` |

### R.3 Skill DSL Components

| Component | Changes |
|-----------|---------|
| GeneralistDialog | `<ModalOverlay>` wrapper, `rounded-2xl`→`rounded-xl`, `p-6`→`p-5`, `z-50`→`z-[var(--z-modal)]` |
| SkillDynamicForm | `<GlassCard>` wrapper, `rounded-xl`+`p-5`, `bg-zinc-900/40`→use token |
| DSLGenerationModal | Same as GeneralistDialog pattern |

### R.4 InitializeProgressModal

| Current | Replacement |
|---------|-------------|
| `rounded-2xl` | `rounded-xl` |
| `p-6` | `p-5` |
| `shadow-xl` | remove |
| `z-50` | `z-[var(--z-modal)]` |
| Gradient progress bar | `bg-[var(--accent-primary)]` |

### R.5 Conflict Toasts

| Current | Replacement |
|---------|-------------|
| `z-50` | `z-[var(--z-toast)]` |
| `rounded-lg` | keep (correct) |
| `shadow-xl` | remove, use `border border-amber-500/30` |

### R.6 Lock Badges

| Current | Replacement |
|---------|-------------|
| `rounded` (plain) | `rounded-lg` |
| Amber color | keep (correct for configs tab) |

### R.7 Routing Toast / Disambiguation Dialog

| Current | Replacement |
|---------|-------------|
| `z-50` | `z-[var(--z-toast)]` / `z-[var(--z-modal)]` |
| `rounded-xl` | keep (correct) |
| `p-5` | keep (correct) |
| Gradient buttons | `bg-[var(--accent-primary)]` |

---

## Phase 11: Execution Plan

### Dependency Graph

```
Phase 0 (Audit)           ← NO code changes, just document
    │
Phase 1 (CSS vars)        ← 1 file, 1 session — EVERYTHING depends on this
    │
    ├── Phase 2 (Components) ← 16 new files, 2-3 sessions — pages need components
    │       │
    │       ├── Phase 3 (Pages) ← 10 pages, 3-4 sessions
    │       └── Phase 6 (Dash+Ext) ← 2 pages, 1-2 sessions
    │
    ├── Phase 10 (Logo)     ← 0.5 session — can parallelize
    │       │
    │       └── Phase 4 (App.tsx) ← 1-2 sessions — needs logo gradient
    │
    ├── Phase 7 (Modals)    ← 15 files, 1 session — search-replace, low risk
    │
    ├── Phase 5 (Terminal)  ← 2 files, 1-2 sessions — HIGH RISK, do carefully
    │
    ├── Phase 8 (Charts)    ← 0.5 session — independent after Phase 1
    │
    └── Phase 9 (Motion)    ← 0.5 session — independent after Phase 1
    
Phase R (Retrofit)         ← 1 session — MUST be last, depends on all tokens existing
```

### Session Schedule

| Session | Phase | Tasks | Files |
|---------|-------|-------|-------|
| 1 | 0 | Audit: grep all anti-patterns, document counts | 0 |
| 2 | 1 | Write index.css with all CSS vars, utilities, reduced motion | 1 |
| 3 | 2 | Create GlassCard, PageShell, StickyHeader, SectionHeader, TabBar | 5 new |
| 4 | 2 | Create StatCard, ChartContainer, CategoryColors, EmptyState, LoadingState | 5 new |
| 5 | 2 | Create ConfirmDialog, ModalOverlay, TerminalTab, SessionCard, SystemCard, KnobSlider | 6 new |
| 6 | 10 + 7 | Logo gradient + Modal standardization (search-replace across 15 modals) | 17 |
| 7 | 4 | App.tsx sidebar + top bar + route transitions + per-page accent | 1 |
| 8 | 5 | TerminalPage.tsx (first half — tab bar, header, session list) | 1 |
| 9 | 5 | TerminalPage.tsx (second half — issues tab, configs tab, instruction panel) | 1 |
| 10 | 3 | Tutorial, Database, Browser pages (simplest first) | 3 |
| 11 | 3 | Productivity, Stats, Settings pages | 3 |
| 12 | 3 | IDE Projects, Insights pages | 2 |
| 13 | 6 | DashboardPage section-by-section | 1 |
| 14 | 6 | ExternalPage layout + remaining modals | 1 |
| 15 | 8+9 | Chart consolidation + motion sweep | ~15 |
| 16 | R | Retrofit all recent features | ~6 |
| 17-18 | Buffer | Fix build errors, visual regression, polish | varies |

### Risk Mitigation

| Risk | Phase | Mitigation |
|------|-------|-----------|
| TerminalPage.tsx breaks | 5 | Work in 10-line batches. After every 5 changes: test tab switching, terminal creation, instruction send. If broken, undo last 5 changes. |
| DashboardPage layout shift | 6 | Convert one section at a time. Verify heatmap + timer + sessions after each section. |
| Component name collision | 2 | All 16 components prefixed by function. No default exports that clash with existing. |
| Missing CSS variable | Any | Phase 1 MUST be complete before any other phase. Every component references `var(--*)`. |
| Build failure | Any | After each session: `npm run build`. If fails, restore backup of last-working file. |
| ExternalPage modals | 6+7 | Convert modals in Phase 7 first. Then page layout in Phase 6. |

### Per-File Compliance Checklist

Apply to EVERY file changed:

```
[ ] data-page attribute set on wrapper (sets --page-accent)
[ ] No rounded-3xl or rounded-2xl — only rounded-xl or rounded-lg
[ ] No p-6 or p-8 — only p-5
[ ] No shadow-lg / shadow-xl — border brightness only
[ ] No text-3xl / text-4xl (except timer display)
[ ] No gradient buttons (from-/to-) for primary actions
[ ] No spring physics (type: 'spring')
[ ] No transition: all — specify exact properties
[ ] No whileHover={{ x: }} — transition-colors only
[ ] No arbitrary z-index (z-[*]) — use var(--z-*) scale
[ ] Uses CSS variables for brand colors (not hardcoded hex)
[ ] Entrance animation matches PageShell pattern (250ms cubic-bezier)
[ ] Build: ✅ npm run build passes
```