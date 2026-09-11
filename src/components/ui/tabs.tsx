import { type ReactNode, createContext, useContext, useState, useCallback } from 'react';

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
    <div className={`inline-flex items-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-0.5 light:bg-zinc-100 light:ring-zinc-200 ${className}`}>
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
    <button
      onClick={() => ctx?.onValueChange(value)}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
        active
          ? 'bg-zinc-800 text-zinc-200 light:bg-zinc-200 light:text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-300 light:text-zinc-500 light:hover:text-zinc-700'
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
