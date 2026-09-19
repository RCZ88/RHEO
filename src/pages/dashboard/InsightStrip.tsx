// ============================================================
// RHEO Dashboard — InsightStrip (de-slopped 2026-09-12)
// L1 COMPOSED: flat cards, single accent, no stagger, no
// BlurFade, no rainbow, no hover lift.
// ============================================================

import { Sparkles } from 'lucide-react';

interface InsightAtom {
  id: string;
  kind: string;
  domain: string;
  value?: number;
  unit?: string;
  copy: { headline: string; subtext: string };
}

interface InsightStripProps {
  insights?: InsightAtom[];
}

export function InsightStrip({ insights = [] }: InsightStripProps) {
  if (insights.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-[var(--page-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">AI Insights</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="relative flex-shrink-0 w-[280px] rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-[var(--accent-muted)] text-[var(--page-accent)]"
              >
                <Sparkles size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {insight.copy.headline}
                </h4>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                  {insight.copy.subtext}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-medium">
                {insight.domain}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
