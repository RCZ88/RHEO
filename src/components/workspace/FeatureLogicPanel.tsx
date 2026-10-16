import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkspaceCard, WorkspaceSection } from './_ds/containers';
import { listContainer, riseItem, expandPanel, DUR, EASE_OUT } from './_ds/motion';
import { WorkspaceStatusBadge } from './_ds/badges';
import { EmptyState, Skeleton } from './_ds/primitives';

interface FeatureEntry {
  name: string;
  status: 'implemented' | 'partial' | 'broken' | 'planned';
  gaps: { text: string; severity: 'critical' | 'high' | 'medium' | 'low' }[];
  mermaid: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  implemented: { label: 'Implemented', cls: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30' },
  partial:     { label: 'Partial',     cls: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30' },
  broken:      { label: 'Broken',      cls: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30' },
  planned:     { label: 'Planned',     cls: 'text-zinc-400 bg-zinc-500/15 ring-1 ring-zinc-500/30' },
};

const SEVERITY_ICON: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-zinc-500',
};

export default function FeatureLogicPanel() {
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const dapi = (window as any).deskflowAPI;
      const result = await dapi?.readProjectFile?.('agent/features/REGISTRY.md');
      if (result?.success && result.data) {
        setFeatures(parseRegistry(result.data));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadFeatures(); }, [loadFeatures]);

  const parseRegistry = (md: string): FeatureEntry[] => {
    const features: FeatureEntry[] = [];
    const sections = md.split(/^## Feature: /m).slice(1);

    for (const section of sections) {
      const nameMatch = section.match(/^(.+?)$/m);
      const statusMatch = section.match(/### Status:\s*(\w+)/i);
      const gapsSection = section.match(/### Gaps Found\n([\s\S]*?)(?=### Status|$)/);
      const mermaidMatch = section.match(/```mermaid\n([\s\S]*?)```/);

      const gaps: FeatureEntry['gaps'] = [];
      if (gapsSection) {
        const gapLines = gapsSection[1].split('\n').filter(l => l.match(/^- \[[ x]\]/));
        for (const line of gapLines) {
          const done = line.includes('[x]');
          if (!done) {
            const text = line.replace(/^- \[[ x]\]\s*/, '');
            const severity = text.toLowerCase().includes('critical') ? 'critical' :
                           text.toLowerCase().includes('missing') ? 'high' : 'medium';
            gaps.push({ text, severity });
          }
        }
      }

      features.push({
        name: nameMatch?.[1]?.trim() || 'Unknown',
        status: (statusMatch?.[1]?.toLowerCase() as FeatureEntry['status']) || 'planned',
        gaps,
        mermaid: mermaidMatch?.[1]?.trim() || '',
      });
    }
    return features;
  };

  const totalGaps = features.reduce((sum, f) => sum + f.gaps.length, 0);
  const criticalGaps = features.reduce((sum, f) => sum + f.gaps.filter(g => g.severity === 'critical').length, 0);

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto ws-scroll">
      <WorkspaceSection
        title="Feature Logic"
        icon={GitBranch}
        accent="amber"
        action={
          <div className="flex items-center gap-2">
            {criticalGaps > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-red-300 bg-red-500/15 ring-1 ring-red-500/30 font-medium">
                {criticalGaps} critical
              </span>
            )}
            {totalGaps > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30 font-medium">
                {totalGaps} gaps
              </span>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : features.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="w-5 h-5" />}
            title="No features documented yet"
            hint="Feature registry will appear here once documented."
          />
        ) : (
          <motion.div
            className="flex flex-col gap-1"
            variants={listContainer} initial="hidden" animate="show"
          >
            {features.map((f) => {
              const isOpen = expanded === f.name;
              const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.planned;

              return (
                <motion.div key={f.name} variants={riseItem}>
                  <WorkspaceCard variant="inset" className="!p-0 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : f.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-800/30 transition-colors duration-150"
                    >
                      <motion.div
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: DUR.fast, ease: EASE_OUT }}
                      >
                        <ChevronRight size={12} className="text-zinc-500" />
                      </motion.div>
                      <span className="text-[12px] font-medium text-zinc-200 flex-1">{f.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {f.gaps.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-medium">
                          {f.gaps.length}
                        </span>
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          variants={expandPanel} initial="hidden" animate="show" exit="exit"
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-3 border-t border-zinc-800/40">
                            {f.mermaid && (
                              <div className="mt-2">
                                <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Flow</span>
                                <pre className="mt-1 text-[10px] text-zinc-400 bg-zinc-950 light:bg-[var(--ws-surface-60)] rounded-lg p-2.5 overflow-x-auto font-mono whitespace-pre-wrap ring-1 ring-zinc-800/40">
                                  {f.mermaid}
                                </pre>
                              </div>
                            )}

                            {f.gaps.length > 0 ? (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Open Gaps</span>
                                <div className="mt-1 space-y-1">
                                  {f.gaps.map((g, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[11px] py-1">
                                      <AlertTriangle size={11} className={`${SEVERITY_ICON[g.severity]} mt-0.5 shrink-0`} />
                                      <span className="text-zinc-400">{g.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1">
                                <CheckCircle size={11} />
                                <span>No open gaps</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </WorkspaceCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </WorkspaceSection>
    </div>
  );
}
