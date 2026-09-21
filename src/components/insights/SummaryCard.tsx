import * as React from "react";
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  accentHex: string;
  onClick?: () => void;
  masked?: boolean;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  sparkline?: React.ReactNode;
}

export function SummaryCard({ title, value, subtitle, icon, accentColor, accentHex, onClick, masked, trend, sparkline }: SummaryCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-md p-4 text-left w-full overflow-hidden group transition-all duration-200 hover:border-zinc-500/60 light:bg-[var(--color-card)] light:border-[var(--ws-border)]"
      style={{
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.02)`,
      }}
    >
      {/* Gradient glow background */}
      <div
        className="absolute inset-0 opacity-[0.12] group-hover:opacity-[0.20] transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${accentHex}18, transparent 60%)`,
        }}
      />
      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${accentHex}60, transparent)` }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${accentHex}15` }}
            >
              {icon}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors duration-200" />
        </div>
        {masked ? (
          <div className="text-xl font-bold text-zinc-600 tracking-widest">••••</div>
        ) : (
          <div className="text-xl font-bold text-zinc-50 tabular-nums">{value}</div>
        )}
        {sparkline && (
          <div className="mt-2 flex items-center justify-start">{sparkline}</div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-zinc-400">{subtitle}</span>
          {trend && trend.direction !== 'flat' && (
            <span className={`text-[10px] font-semibold ${trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
