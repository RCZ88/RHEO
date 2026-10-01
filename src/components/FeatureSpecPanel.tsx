import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Copy, Check, Download, ChevronDown, ChevronRight,
  Search, Bot, Code2, ExternalLink, Layers, Home,
  BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  Clock4, Zap, Sliders, Target, PieChart, Cpu, HelpCircle,
} from 'lucide-react';
import {
  FEATURE_SPECS,
  FEATURE_CATEGORIES,
  SIDEBAR_NAV,
  TOP_NAV_FEATURES,
  GLOBAL_COMPONENTS,
  generateAllSpecsMarkdown,
  type FeatureSpec,
  type NavItemSpec,
} from '../data/feature-specs';

const FEATURE_ICONS: Record<string, any> = {
  Home, BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  Code2, Clock4, Zap, FileText, Sliders, Target, PieChart,
  HelpCircle, Layers, Cpu,
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

const STATUS_COLORS: Record<string, string> = {
  released: 'text-emerald-400 bg-emerald-500/10',
  beta: 'text-amber-400 bg-amber-500/10',
  planned: 'text-zinc-400 bg-zinc-500/10',
  deprecated: 'text-red-400 bg-red-500/10',
};

function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const Icon = FEATURE_ICONS[name] || FileText;
  return <Icon className={className} />;
}

function generateAIPrompt(): string {
  const lines: string[] = [];
  lines.push('# App Tracker — AI Feature & Component Reference');
  lines.push('');
  lines.push('This document describes every feature, component, IPC endpoint, and data flow in the App Tracker application. Use it to understand what exists and where changes need to be made.');
  lines.push('');

  lines.push('## Navigation Structure');
  lines.push('');
  lines.push('### Sidebar');
  lines.push('| Label | Path | Group |');
  lines.push('|-------|------|-------|');
  for (const nav of SIDEBAR_NAV) {
    lines.push(`| ${nav.label} | ${nav.path} | ${nav.group} |`);
  }
  lines.push('');
  lines.push('### Top Nav');
  for (const f of TOP_NAV_FEATURES) {
    lines.push(`- **${f.name}**: ${f.description} (${f.location})`);
  }
  lines.push('');

  lines.push('## Global Components');
  lines.push('');
  for (const c of GLOBAL_COMPONENTS) {
    lines.push(`- **${c.name}**: ${c.description} — \`${c.location}\``);
  }
  lines.push('');

  lines.push('## Features by Category');
  lines.push('');
  for (const cat of FEATURE_CATEGORIES) {
    const specs = FEATURE_SPECS.filter((s) => s.category === cat);
    if (specs.length === 0) continue;
    lines.push(`### ${cat}`);
    lines.push('');
    for (const spec of specs) {
      lines.push(`#### ${spec.name} (\`${spec.route}\`) — *${spec.status}*`);
      lines.push(`> ${spec.description}`);
      lines.push(`> File: \`${spec.filePath}\``);
      lines.push('');
      if (spec.whatYoullFind.length > 0) {
        lines.push('**What You\'ll Find:**');
        for (const item of spec.whatYoullFind) lines.push(`- ${item}`);
        lines.push('');
      }
      if (spec.whatYouCanDo.length > 0) {
        lines.push('**What You Can Do:**');
        for (const item of spec.whatYouCanDo) lines.push(`- ${item}`);
        lines.push('');
      }
      if (spec.sections.length > 0) {
        lines.push('**Sections & Components:**');
        lines.push('');
        for (const section of spec.sections) {
          lines.push(`- **${section.name}**${section.selector ? ` (\`${section.selector}\`)` : ''}: ${section.description}`);
          for (const comp of section.components) {
            lines.push(`  - \`${comp.name}\` — \`${comp.file}\`: ${comp.description}`);
          }
        }
        lines.push('');
      }
      if (spec.ipcEndpoints.length > 0) {
        lines.push('**IPC Endpoints:**');
        lines.push('| Method | Params | Returns | Description |');
        lines.push('|--------|--------|---------|-------------|');
        for (const ipc of spec.ipcEndpoints) {
          lines.push(`| \`${ipc.method}\` | ${ipc.params} | ${ipc.returns} | ${ipc.description} |`);
        }
        lines.push('');
      }
      if (spec.dataFlows.length > 0) {
        lines.push('**Data Flows:**');
        for (const flow of spec.dataFlows) {
          lines.push(`- \`${flow.from}\` → \`${flow.to}\` : ${flow.data} — ${flow.description}`);
        }
        lines.push('');
      }
      if (spec.connectedPages.length > 0) {
        lines.push(`**Connected Pages:** ${spec.connectedPages.join(', ')}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function FeatureCard({ spec, defaultExpanded }: { spec: FeatureSpec; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded || false);
  const catMeta = CATEGORY_META[spec.category] || CATEGORY_META.Core;
  const statusClass = STATUS_COLORS[spec.status] || '';

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${catMeta.gradient} flex items-center justify-center shrink-0`}>
          <FeatureIcon name={spec.icon} className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">{spec.name}</span>
            {spec.status !== 'released' && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>
                {spec.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <Code2 className="w-2.5 h-2.5" />
            {spec.route}
            <span className="text-zinc-700">·</span>
            {spec.sections.length} sections
            <span className="text-zinc-700">·</span>
            {spec.sections.reduce((n, s) => n + s.components.length, 0)} components
          </div>
        </div>
        <div className="text-zinc-500 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-800/40"
          >
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">{spec.description}</p>

              {spec.sections.length > 0 && (
                <div className="space-y-2">
                  {spec.sections.map((section, si) => (
                    <div key={si} className="rounded-lg bg-zinc-800/20 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-1 h-4 rounded-full bg-gradient-to-b ${catMeta.gradient}`} />
                        <span className="text-xs font-medium text-zinc-300">{section.name}</span>
                        {section.selector && (
                          <code className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded">{section.selector}</code>
                        )}
                      </div>
                      {section.description && (
                        <p className="text-[10px] text-zinc-500 mb-2 ml-3">{section.description}</p>
                      )}
                      <div className="space-y-1 ml-3">
                        {section.components.map((comp, ci) => (
                          <div key={ci} className="flex items-start gap-2 py-1 px-2 rounded bg-zinc-800/30">
                            <div className="w-1 h-1 rounded-full mt-1.5 bg-zinc-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[11px] text-zinc-300 font-medium">{comp.name}</span>
                              <code className="text-[9px] text-zinc-600 ml-1.5">{comp.file}</code>
                              <p className="text-[9px] text-zinc-600">{comp.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {spec.ipcEndpoints.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1 mb-1">
                    <Code2 className="w-3 h-3" /> IPC Endpoints ({spec.ipcEndpoints.length})
                  </span>
                  <div className="overflow-x-auto rounded-lg bg-zinc-800/20">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="text-left py-1.5 px-2 text-zinc-600 font-medium">Method</th>
                          <th className="text-left py-1.5 px-2 text-zinc-600 font-medium">Returns</th>
                          <th className="text-left py-1.5 px-2 text-zinc-600 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spec.ipcEndpoints.map((ipc, i) => (
                          <tr key={i} className="border-b border-zinc-800/30">
                            <td className="py-1.5 px-2"><code className="text-emerald-400 text-[9px]">{ipc.method}</code></td>
                            <td className="py-1.5 px-2 text-zinc-400">{ipc.returns}</td>
                            <td className="py-1.5 px-2 text-zinc-500">{ipc.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {spec.connectedPages.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Connected:
                  </span>
                  {spec.connectedPages.map((cp) => (
                    <span key={cp} className="text-[9px] text-zinc-600 bg-zinc-800/40 px-1.5 py-0.5 rounded-full">{cp}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StructureCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        <div className="ml-auto text-zinc-500">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-800/40"
          >
            <div className="px-4 py-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FeatureSpecPanel({ projectPath }: { projectPath?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMarkdown, setCopiedMarkdown] = useState<'idle' | 'markdown' | 'prompt'>('idle');
  const [saving, setSaving] = useState(false);
  const [projectSpecs, setProjectSpecs] = useState<string | null>(null);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  // Read project-specific specs from on-disk files
  useEffect(() => {
    if (!projectPath) return;
    setLoadingSpecs(true);
    window.deskflowAPI?.readProjectFile?.('agent/FEATURE_SPECS.md', projectPath)
      .then((result: any) => {
        if (result?.success && result?.content) {
          setProjectSpecs(result.content);
        } else {
          setProjectSpecs(null);
        }
      })
      .catch(() => setProjectSpecs(null))
      .finally(() => setLoadingSpecs(false));
  }, [projectPath]);

  const filteredSpecs = useMemo(() => {
    if (!searchQuery) return FEATURE_SPECS;
    const q = searchQuery.toLowerCase();
    return FEATURE_SPECS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.route.toLowerCase().includes(q) ||
        s.sections.some((sec) => sec.name.toLowerCase().includes(q)) ||
        s.sections.some((sec) => sec.components.some((c) => c.name.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

  const groupedSpecs = useMemo(() => {
    const map: Record<string, FeatureSpec[]> = {};
    for (const s of filteredSpecs) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [filteredSpecs]);

  const handleCopy = useCallback(async (text: string, type: 'markdown' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMarkdown(type);
      setTimeout(() => setCopiedMarkdown('idle'), 2000);
    } catch {}
  }, []);

  const handleSaveToFile = useCallback(async () => {
    setSaving(true);
    try {
      const markdown = generateAllSpecsMarkdown();
      const result = await window.deskflowAPI!.writeFeatureSpecFile(markdown);
      if (result.success) {
        setCopiedMarkdown('markdown');
        setTimeout(() => setCopiedMarkdown('idle'), 2000);
      }
    } catch (err) {
      console.error('Failed to save spec file:', err);
    }
    setSaving(false);
  }, []);

  const allMarkdown = useMemo(() => generateAllSpecsMarkdown(), []);
  const aiPrompt = useMemo(() => generateAIPrompt(), []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Feature Specs</h2>
            <p className="text-[10px] text-zinc-600">
              {projectPath
                ? (projectSpecs ? 'Project specs loaded' : (loadingSpecs ? 'Loading...' : 'No specs yet'))
                : `${FEATURE_SPECS.length} features · ${GLOBAL_COMPONENTS.length} global components · ${SIDEBAR_NAV.length} routes`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {projectPath && projectSpecs && (
            <button
              onClick={() => handleCopy(projectSpecs, 'markdown')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all"
            >
              {copiedMarkdown === 'markdown' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedMarkdown === 'markdown' ? 'Copied!' : 'Copy MD'}
            </button>
          )}
          {!projectPath && (
            <>
              <button
                onClick={() => handleCopy(aiPrompt, 'prompt')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all"
                title="Copy AI context prompt"
              >
                {copiedMarkdown === 'prompt' ? <Check className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                {copiedMarkdown === 'prompt' ? 'Copied!' : 'Copy AI Prompt'}
              </button>
              <button
                onClick={() => handleCopy(allMarkdown, 'markdown')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all"
                title="Copy all specs as markdown"
              >
                {copiedMarkdown === 'markdown' ? 'Copied!' : 'Copy MD'}
              </button>
              <button
                onClick={handleSaveToFile}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                title="Save to agent/FEATURE_SPECS.md"
              >
                <Download className={`w-3 h-3 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Saving...' : 'Save to File'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project-scoped empty state */}
      {projectPath && !loadingSpecs && !projectSpecs && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">No specs yet</h3>
          <p className="text-xs text-zinc-500 mb-4 max-w-xs">
            This project doesn't have feature specs yet. Generate them to document the project's UI and functionality.
          </p>
          <button
            onClick={() => {
              // Trigger spec generation via terminal agent
              window.dispatchEvent(new CustomEvent('create-terminal', {
                detail: {
                  terminalId: `spec-gen-${Date.now()}`,
                  cwd: projectPath,
                  agent: localStorage.getItem('terminal-defaultAgent') || 'opencode',
                  sessionName: 'Spec Generator',
                }
              }));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate specs
          </button>
        </div>
      )}

      {/* Project-scrolled loading state */}
      {projectPath && loadingSpecs && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xs text-zinc-500">Loading project specs...</div>
        </div>
      )}

      {/* Project specs content (raw markdown) */}
      {projectPath && !loadingSpecs && projectSpecs && (
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
            {projectSpecs}
          </pre>
        </div>
      )}

      {/* Static FEATURE_SPECS (no project path = GuidePage) */}
      {!projectPath && (

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features, components..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <StructureCard title="Navigation Structure" icon={Layers}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-medium text-zinc-500 mb-2 uppercase tracking-wider">Sidebar</h4>
              <div className="space-y-1">
                {SIDEBAR_NAV.map((nav) => (
                  <div key={nav.path} className="flex items-center gap-2 text-[11px]">
                    <FeatureIcon name={nav.icon} className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-300">{nav.label}</span>
                    <code className="text-[9px] text-zinc-600">{nav.path}</code>
                    <span className={`text-[8px] px-1 py-0.5 rounded-full ${nav.group === 'primary' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {nav.group}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-medium text-zinc-500 mb-2 uppercase tracking-wider">Top Nav</h4>
              <div className="space-y-1.5">
                {TOP_NAV_FEATURES.map((f) => (
                  <div key={f.name} className="text-[11px]">
                    <span className="text-zinc-300 font-medium">{f.name}</span>
                    <p className="text-[9px] text-zinc-600">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StructureCard>

        <StructureCard title="Global Components" icon={Layers}>
          <div className="grid grid-cols-2 gap-2">
            {GLOBAL_COMPONENTS.map((c) => (
              <div key={c.name} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800/20">
                <div className="w-1 h-1 rounded-full mt-1.5 bg-blue-500 shrink-0" />
                <div>
                  <span className="text-[11px] text-zinc-300 font-medium">{c.name}</span>
                  <p className="text-[9px] text-zinc-600">{c.description}</p>
                  <code className="text-[8px] text-zinc-700">{c.location}</code>
                </div>
              </div>
            ))}
          </div>
        </StructureCard>

        {Object.entries(groupedSpecs).map(([cat, specs]) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.Core;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${meta.bg}`} />
                <h3 className="text-xs font-semibold text-zinc-300">{cat}</h3>
                <span className="text-[10px] text-zinc-600">{specs.length} features</span>
              </div>
              <div className="space-y-2">
                {specs.map((spec) => (
                  <FeatureCard key={spec.id} spec={spec} />
                ))}
              </div>
            </div>
          );
        })}

        {filteredSpecs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No features match your search</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
