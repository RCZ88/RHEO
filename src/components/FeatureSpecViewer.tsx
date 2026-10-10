import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  Code2, Clock4, Zap, FileText, Sliders, Target, PieChart,
  ChevronDown, ChevronRight, Copy, Check, Search, X, ExternalLink,
  Cpu, Grip, Layout, Brain, HelpCircle, Layers,
} from 'lucide-react';
import { PageShell } from './PageShell';
import { GlassCard } from './GlassCard';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import {
  FEATURE_SPECS,
  FEATURE_CATEGORIES,
  SIDEBAR_NAV,
  TOP_NAV_FEATURES,
  GLOBAL_COMPONENTS,
  generateMarkdown,
  generateAllSpecsMarkdown,
  type FeatureSpec,
  type NavItemSpec,
  type GlobalFeature,
} from '../data/feature-specs';

const FEATURE_ICONS: Record<string, any> = {
  Home, BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  Code2, Clock4, Zap, FileText, Sliders, Target, PieChart,
  HelpCircle, Layers,
};

const CATEGORY_META: Record<string, { gradient: string; accent: string; bg: string }> = {
  Core: {
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  'Tracker Mind': {
    gradient: 'from-purple-500/20 to-purple-500/5',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  Data: {
    gradient: 'from-blue-500/20 to-blue-500/5',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  released: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  beta: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  planned: { bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
  deprecated: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

function FeatureIcon({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = FEATURE_ICONS[iconName] || FileText;
  return <Icon className={className} />;
}

function SpecBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${bg} ${text} font-medium`}>
      {label}
    </span>
  );
}

function SidebarTree({
  specs,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: {
  specs: FeatureSpec[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const filteredSpecs = useMemo(() => {
    if (!searchQuery) return specs;
    const q = searchQuery.toLowerCase();
    return specs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.route.toLowerCase().includes(q)
    );
  }, [specs, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, FeatureSpec[]> = {};
    for (const s of filteredSpecs) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [filteredSpecs]);

  return (
    <div className="flex flex-col h-full" data-tutorial="spec.sidebar">
      <div className="relative px-3 pt-3 pb-2">
        <Search className="absolute left-6 top-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search specs..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-5 top-1/2">
            <X className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_META[cat];
          const isCollapsed = collapsedCategories.has(cat);
          return (
            <div key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <div className={`w-1.5 h-1.5 rounded-full ${meta?.bg || 'bg-zinc-600'}`} />
                {cat}
                <span className="text-zinc-700 ml-auto">{items.length}</span>
              </button>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {items.map((spec) => {
                      const isSelected = selectedId === spec.id;
                      const status = STATUS_META[spec.status];
                      return (
                        <button
                          key={spec.id}
                          onClick={() => onSelect(spec.id)}
                          data-tutorial="feature-spec-item"
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
                            isSelected
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-md ${meta?.bg || 'bg-zinc-800'} flex items-center justify-center shrink-0`}>
                            <FeatureIcon iconName={spec.icon} className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{spec.name}</div>
                            <div className="text-[10px] text-zinc-600 truncate">{spec.route}</div>
                          </div>
                          {spec.status !== 'released' && (
                            <span className={`text-[9px] px-1 py-0.5 rounded ${status.bg} ${status.text} shrink-0`}>
                              {spec.status}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {filteredSpecs.length === 0 && (
          <div className="px-3 py-8 text-center">
            <Search className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-600">No specs match your search</p>
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <div className={`w-2 h-2 rounded-full ${STATUS_META.released.bg}`} />
          <span>{specs.filter((s) => s.status === 'released').length} released</span>
          <div className={`w-2 h-2 rounded-full ${STATUS_META.beta.bg}`} />
          <span>{specs.filter((s) => s.status === 'beta').length} beta</span>
        </div>
      </div>
    </div>
  );
}

function SpecDetailPanel({
  feature,
  onCopy,
}: {
  feature: FeatureSpec;
  onCopy: (text: string) => void;
}) {
  const meta = CATEGORY_META[feature.category] || CATEGORY_META.Core;
  const status = STATUS_META[feature.status];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div data-tutorial="spec.detail">
        <div className="flex items-start gap-4 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shrink-0`}>
            <FeatureIcon iconName={feature.icon} className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-semibold text-white">{feature.name}</h2>
              <SpecBadge label={feature.status} bg={status.bg} text={status.text} />
            </div>
            <p className="text-sm text-zinc-400">{feature.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onCopy(generateMarkdown(feature))}
              data-tutorial="spec.copy"
              className="p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all duration-150"
              title="Copy spec as markdown"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Code2 className="w-3 h-3" />
            Route: <code className="text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded">{feature.route}</code>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            <code className="text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded text-[10px]">{feature.filePath}</code>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GlassCard variant="default" className="p-4">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
            <Search className="w-3 h-3 text-zinc-500" />
            What You'll Find
          </h3>
          <ul className="space-y-1.5">
            {feature.whatYoullFind.map((item, i) => (
              <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard variant="default" className="p-4">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-zinc-500" />
            What You Can Do
          </h3>
          <ul className="space-y-1.5">
            {feature.whatYouCanDo.map((item, i) => (
              <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {feature.sections.length > 0 && (
        <div data-tutorial="spec.sections">
          <SectionHeader title="Sections & Components" />
          <div className="space-y-3 mt-3">
            {feature.sections.map((section, si) => (
              <GlassCard key={si} variant="interactive" className="overflow-hidden">
                <div className={`h-0.5 bg-gradient-to-r ${meta.gradient}`} />
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-zinc-200 mb-1">{section.name}</h4>
                  {section.selector && (
                    <code className="text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded mb-2 inline-block">
                      {section.selector}
                    </code>
                  )}
                  <p className="text-xs text-zinc-500 mb-3">{section.description}</p>
                  <div className="space-y-2">
                    {section.components.map((comp, ci) => (
                      <div key={ci} className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/30">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-zinc-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-300">{comp.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mt-0.5">
                            <Code2 className="w-2.5 h-2.5" />
                            {comp.file}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{comp.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {feature.ipcEndpoints.length > 0 && (
        <div data-tutorial="spec.ipc">
          <SectionHeader title={`IPC Endpoints (${feature.ipcEndpoints.length})`} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium">Method</th>
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium">Params</th>
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium">Returns</th>
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {feature.ipcEndpoints.map((ipc, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                    <td className="py-2 px-3"><code className="text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded text-[10px]">{ipc.method}</code></td>
                    <td className="py-2 px-3"><code className="text-zinc-400 text-[10px]">{ipc.params}</code></td>
                    <td className="py-2 px-3"><code className="text-zinc-400 text-[10px]">{ipc.returns}</code></td>
                    <td className="py-2 px-3 text-zinc-500">{ipc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {feature.dataFlows.length > 0 && (
        <div>
          <SectionHeader title={`Data Flows (${feature.dataFlows.length})`} />
          <div className="mt-3 space-y-2">
            {feature.dataFlows.map((flow, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/40">
                <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0 flex-1">
                  <code className="text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded text-[10px]">{flow.from}</code>
                  <span className="text-zinc-600">→</span>
                  <code className="text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded text-[10px]">{flow.to}</code>
                  <span className="text-zinc-600">:</span>
                  <code className="text-zinc-400 text-[10px]">{flow.data}</code>
                </div>
                <p className="text-[10px] text-zinc-600 shrink-0 max-w-[200px] text-right">{flow.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {feature.connectedPages.length > 0 && (
        <div>
          <SectionHeader title="Connected Pages" />
          <div className="mt-2 flex flex-wrap gap-2">
            {feature.connectedPages.map((cp) => {
              const connected = FEATURE_SPECS.find((s) => s.id === cp);
              const connectMeta = connected ? CATEGORY_META[connected.category] : null;
              return (
                <div
                  key={cp}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] ${connectMeta?.bg || 'bg-zinc-800'} ${connectMeta?.accent || 'text-zinc-400'}`}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {connected?.name || cp}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownView({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <GlassCard variant="default" className="p-5">
        <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
          {lines.map((line, i) => {
            if (line.startsWith('# ')) return <div key={i} className="text-base font-bold text-white mb-2 mt-4 first:mt-0">{line.slice(2)}</div>;
            if (line.startsWith('## ')) return <div key={i} className="text-sm font-semibold text-zinc-200 mb-2 mt-4">{line.slice(3)}</div>;
            if (line.startsWith('### ')) return <div key={i} className="text-xs font-semibold text-zinc-300 mb-1 mt-3">{line.slice(4)}</div>;
            if (line.startsWith('|')) {
              const isHeader = lines[i + 1]?.startsWith('|---');
              return (
                <div key={i} className={`flex text-[10px] ${isHeader ? 'text-zinc-500 font-medium' : 'text-zinc-400'} border-b border-zinc-800/30 py-1`}>
                  {line.split('|').filter(Boolean).map((cell, ci) => (
                    <span key={ci} className="flex-1 px-2">{cell.trim()}</span>
                  ))}
                </div>
              );
            }
            if (line.startsWith('---')) return <hr key={i} className="my-4 border-zinc-800" />;
            if (line.startsWith('- ')) return <div key={i} className="text-xs text-zinc-400 ml-3 flex items-start gap-2 py-0.5"><span className="text-zinc-600 mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />{line.slice(2)}</div>;
            if (line.trim() === '') return <div key={i} className="h-2" />;
            return <div key={i} className="text-xs text-zinc-400 py-0.5">{line}</div>;
          })}
        </pre>
      </GlassCard>
    </div>
  );
}

export default function FeatureSpecViewer({ noShell }: { noShell?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedFeature = useMemo(
    () => FEATURE_SPECS.find((s) => s.id === selectedId) || null,
    [selectedId]
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-secure contexts
    }
  }, []);

  const markdownContent = useMemo(() => {
    if (selectedFeature) return generateMarkdown(selectedFeature);
    return '';
  }, [selectedFeature]);

  const content = (
      <div className="flex h-full" data-tutorial="feature-spec-viewer">
        <div className="w-64 shrink-0 border-r border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)]/50 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-white">Feature Specs</h2>
                <p className="text-[9px] text-zinc-600">{FEATURE_SPECS.length} pages</p>
              </div>
            </div>
          </div>
          <SidebarTree
            specs={FEATURE_SPECS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800/60 shrink-0 bg-zinc-950 light:bg-[var(--ws-surface)]/30">
            <div className="text-xs text-zinc-500">
              {selectedFeature && (
                <span>
                  {selectedFeature.category} / <span className="text-zinc-300">{selectedFeature.name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(generateAllSpecsMarkdown())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all duration-150"
                title="Copy all specs as markdown"
                data-tutorial="feature-spec-copy-all"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={() => setShowMarkdown(!showMarkdown)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border transition-all duration-150 ${
                  showMarkdown
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60'
                }`}
                data-tutorial="spec.md"
              >
                <FileText className="w-3 h-3" />
                {showMarkdown ? 'View' : 'MD View'}
              </button>
            </div>
          </div>

          {selectedFeature ? (
            showMarkdown ? (
              <MarkdownView content={markdownContent} />
            ) : (
              <SpecDetailPanel feature={selectedFeature} onCopy={handleCopy} />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<FileText className="w-12 h-12" />}
                title="Select a feature"
                description="Choose a feature from the sidebar to view its specification"
              />
            </div>
          )}
        </div>
      </div>
  );

  if (noShell) return content;

  return (
    <PageShell page="features" variant="sticky-header">
      {content}
    </PageShell>
  );
}
