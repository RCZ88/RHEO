import * as React from "react";
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, loading, empty, error, onRetry, children, className = '' }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl p-4 bg-zinc-900/75 backdrop-blur-xl border border-zinc-800/50 min-h-[260px] flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        <BarChart3 className="w-4 h-4 text-zinc-600" />
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <button onClick={onRetry} className="text-xs text-red-400 hover:text-red-300 transition-colors">{error}</button>
          </div>
        ) : empty ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-zinc-600">No data available</span>
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}
