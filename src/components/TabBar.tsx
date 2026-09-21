import * as React from "react";
import { motion } from 'framer-motion';

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
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
            tab.key === activeKey
              ? 'text-emerald-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {tab.key === activeKey && (
            <motion.div
              layoutId="tabPill"
              className="absolute inset-0 rounded-lg bg-emerald-500/15"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
