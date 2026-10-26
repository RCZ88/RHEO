import { type ReactNode, createContext, useContext } from 'react';

interface TabsContext {
  value: string;
  onValueChange: (v: string) => void;
}

const TabsCtx = createContext<TabsContext | null>(null);

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  return (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    // The track is SUNKEN in light (#edeae2) so the selected chip has
    // something to sit *on*. It carried two conflicting light backgrounds
    // (`light:bg-[var(--ws-surface-raised)]` AND `light:bg-zinc-100`) which
    // both resolve to a near-white on near-white card — nothing to see.
    <div className={`inline-flex items-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800 p-0.5 light:bg-[var(--ws-surface-sunken)] light:ring-[var(--ws-border)] ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const ctx = useContext(TabsCtx);
  const active = ctx?.value === value;
  return (
    // Selected = the surface signal hue, in light. It used to be
    // `light:bg-zinc-200` on a `light:bg-zinc-100` track: 1.14:1 — the
    // selection was invisible. `--page-accent-fill`/`--page-accent-on-fill`
    // are the contrast-checked light pair (≥4.5:1 for all 18 pages).
    // Dark keeps its neutral `bg-zinc-800` chip: it was never invisible
    // there, and dark mode is not what is being repaired.
    <button
      onClick={() => ctx?.onValueChange(value)}
      aria-pressed={active}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:z-10 ${
        active
          ? 'bg-zinc-800 text-zinc-200 light:bg-[var(--page-accent-fill)] light:text-[var(--page-accent-on-fill)]'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-surface-raised)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const ctx = useContext(TabsCtx);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
}
