// RHEO Dashboard — AI Usage Widget
// 4×2 widget showing AI session stats from AiPage
// LAMINAR: solid token surface, hairline, radius 10, motion/react only

import { motion } from 'motion/react';
import { Bot } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';
import type { WidgetConfig } from './WidgetRegistry';

interface AIUsageWidgetProps {
  usage?: {
    tokensToday: number;
    sessionCount: number;
    models: { name: string; tokens: number }[];
  };
  loading?: boolean;
  error?: string | null;
}

export function AiUsageWidget({ usage, loading, error }: AIUsageWidgetProps) {
  const tokensToday = usage?.tokensToday ?? 0;
  const sessionCount = usage?.sessionCount ?? 0;
  const models = usage?.models ?? [];

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-zinc-800" />
          <div className="h-10 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Bot size={14} />
          <span>AI Usage</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[12px] text-zinc-500 text-center">{error}</div>
        </div>
      </div>
    );
  }

  const modelBreakdown = models.slice(0, 5);

  return (
    <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full relative">
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-[10px]" />
      <div className="absolute inset-0 -z-10 rounded-[10px] pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Bot size={14} className="text-violet-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">AI Usage</span>
        </div>
        <WidgetJumpButton widgetId="ai-usage" iconOnly />
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Tokens Today</div>
          <div className="text-lg font-display font-bold text-zinc-100 tabular-nums">{tokensToday.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Sessions</div>
          <div className="text-lg font-display font-bold text-zinc-100 tabular-nums">{sessionCount}</div>
        </div>
      </div>

      {models.length > 0 && (
        <div className="pt-2 border-t border-[var(--ws-border)]">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Top Models</div>
          <div className="space-y-1.5">
            {modelBreakdown.map((m) => {
              const maxTokens = models[0]?.tokens ?? 1;
              const pct = (m.tokens / maxTokens) * 100;
              return (
                <div key={m.name} className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 w-16 truncate shrink-0">{m.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums w-12 text-right">{(m.tokens / 1000).toFixed(1)}k</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
