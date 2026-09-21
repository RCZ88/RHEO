import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText, Route, Code2, Table2, GitBranch, AlertTriangle, Lightbulb,
  Network, Search, BookOpen, RefreshCw, ChevronDown, ChevronRight,
  ExternalLink, PanelRightClose, Loader2, Layers
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { GlassCard } from './GlassCard';

interface PageEntry {
  title: string;
  sections: PageSection[];
}

interface PageSection {
  heading: string;
  content: string;
  type: 'identity' | 'component-tree' | 'ipc-endpoints' | 'data-flow' | 'connections' | 'conventions' | 'pitfalls' | 'other';
}

function parsePageContext(markdown: string): PageEntry[] {
  const blocks = markdown.split(/(?=^## Page: )/m);
  const entries: PageEntry[] = [];

  for (const block of blocks) {
    const titleMatch = block.match(/^## Page: (.+)$/m);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    const sections: PageSection[] = [];
    const sectionBlocks = block.split(/(?=^### )/m);

    for (const sb of sectionBlocks) {
      const headingMatch = sb.match(/^### (.+)$/m);
      if (!headingMatch) continue;
      const heading = headingMatch[1].trim();
      const content = sb.replace(/^### .+\n*/m, '').trim();

      let type: PageSection['type'];
      const h = heading.toLowerCase();
      if (h === 'identity') type = 'identity';
      else if (h.includes('component tree')) type = 'component-tree';
      else if (h.includes('ipc')) type = 'ipc-endpoints';
      else if (h === 'data flow') type = 'data-flow';
      else if (h.includes('connection')) type = 'connections';
      else if (h.includes('convention') || h.includes('update')) type = 'conventions';
      else if (h.includes('pitfall') || h.includes('known')) type = 'pitfalls';
      else type = 'other';

      sections.push({ heading, content, type });
    }

    entries.push({ title, sections });
  }

  return entries;
}

function IdentitySection({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim().startsWith('- **'));
  const items = lines.map(l => {
    const match = l.match(/- \*\*(.+?):\*\*\s*(.+)/);
    return match ? { key: match[1], value: match[2].replace(/`([^`]+)`/g, '<code>$1</code>') } : null;
  }).filter(Boolean);

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5 bg-zinc-800/30 rounded-lg px-3 py-2 border border-zinc-700/30">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{item!.key}</span>
          <span className="text-[11px] text-zinc-200 font-mono" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item!.value) }} />
        </div>
      ))}
    </div>
  );
}

function ComponentTreeSection({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  const treeLines = lines.filter(l => !l.startsWith('```'));

  return (
    <div className="bg-zinc-950/60 rounded-lg p-3 font-mono text-[11px] leading-relaxed overflow-x-auto border border-zinc-800/40">
      {treeLines.map((line, i) => {
        const indent = line.search(/\S/);
        const depth = Math.floor(indent / 2);
        const text = line.trim();
        const isBranch = text.startsWith('├──') || text.startsWith('└──') || text.startsWith('│');
        const isComponent = text.includes('(');

        if (isComponent) {
          const prefix = text.match(/^[├─└│\s]*/)?.[0] || '';
          const main = text.replace(/^[├─└│\s]*/, '').replace(/\(.*\)/, '');
          const desc = text.match(/\(.*\)/)?.[0] || '';
          return (
            <div key={i} className="whitespace-pre" style={{ paddingLeft: `${depth * 16}px` }}>
              <span className="text-zinc-600">{prefix}</span>
              <span className="text-emerald-300">{main}</span>
              <span className="text-zinc-500">{desc}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ paddingLeft: `${depth * 16}px` }}
            className={`whitespace-pre ${depth === 0 ? 'text-cyan-300 font-semibold' : isBranch ? 'text-zinc-300' : 'text-zinc-500'}`}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

function IPCEndpointsSection({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  const tableLines = lines.filter(l => l.includes('|') && !l.includes('---') && !l.includes('Channel'));
  const endpoints = tableLines.map(l => {
    const parts = l.split('|').filter(p => p.trim());
    if (parts.length >= 3) {
      return { channel: parts[0].trim(), direction: parts[1].trim(), purpose: parts[2].trim() };
    }
    return null;
  }).filter(Boolean);

  if (endpoints.length === 0) {
    return <p className="text-[11px] text-zinc-500 italic">No IPC endpoints</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="text-zinc-500 uppercase tracking-wider">
            <th className="text-left py-1.5 px-2 font-semibold border-b border-zinc-700/30">Channel</th>
            <th className="text-left py-1.5 px-2 font-semibold border-b border-zinc-700/30 w-[52px]">Dir</th>
            <th className="text-left py-1.5 px-2 font-semibold border-b border-zinc-700/30">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep, i) => (
            <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors duration-100">
              <td className="py-1.5 px-2 font-mono text-cyan-300 text-[10px]">{ep!.channel}</td>
              <td className="py-1.5 px-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider ${ep!.direction === 'read' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {ep!.direction}
                </span>
              </td>
              <td className="py-1.5 px-2 text-zinc-400 text-[10px]">{ep!.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletSection({ content, icon: Icon, color }: { content: string; icon?: any; color?: string }) {
  const bullets = content.split('\n').filter(l => l.trim().startsWith('-'));
  if (bullets.length === 0) {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('```'));
    if (lines.length === 0) return <p className="text-[11px] text-zinc-500 italic">No details</p>;
    return (
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-[11px] text-zinc-400 leading-relaxed">{line.replace(/^\*\*.*?\*\*\s*/, '')}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, i) => {
        const text = bullet.replace(/^-\s*/, '');
        const boldMatch = text.match(/^\*\*(.+?)\*\*:\s*(.*)/);
        return (
          <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
            {Icon && <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${color || 'text-zinc-500'}`} />}
            <div>
              {boldMatch ? (
                <>
                  <span className="font-semibold text-zinc-200">{boldMatch[1]}:</span>{' '}
                  <span className="text-zinc-400">{boldMatch[2]}</span>
                </>
              ) : (
                <span className="text-zinc-400">{text}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionRenderer({ section }: { section: PageSection }) {
  switch (section.type) {
    case 'identity':
      return <IdentitySection content={section.content} />;
    case 'component-tree':
      return <ComponentTreeSection content={section.content} />;
    case 'ipc-endpoints':
      return <IPCEndpointsSection content={section.content} />;
    case 'data-flow':
      return <BulletSection content={section.content} icon={Network} color="text-blue-400" />;
    case 'connections':
      return <BulletSection content={section.content} icon={GitBranch} color="text-purple-400" />;
    case 'conventions':
      return <BulletSection content={section.content} icon={Lightbulb} color="text-amber-400" />;
    case 'pitfalls':
      return <BulletSection content={section.content} icon={AlertTriangle} color="text-red-400" />;
    default:
      return (
        <div className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {section.content.split('\n').filter(l => l.trim() && !l.startsWith('```')).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      );
  }
}

const SECTION_META: Record<string, { icon: any; border: string }> = {
  'identity': { icon: FileText, border: 'border-l-blue-500' },
  'component-tree': { icon: Code2, border: 'border-l-emerald-500' },
  'ipc-endpoints': { icon: Table2, border: 'border-l-cyan-500' },
  'data-flow': { icon: Network, border: 'border-l-blue-400' },
  'connections': { icon: GitBranch, border: 'border-l-purple-500' },
  'conventions': { icon: Lightbulb, border: 'border-l-amber-500' },
  'pitfalls': { icon: AlertTriangle, border: 'border-l-red-500' },
  'other': { icon: BookOpen, border: 'border-l-zinc-500' },
};

function PageCard({ entry, defaultOpen }: { entry: PageEntry; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false);

  return (
    <GlassCard variant="interactive">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-zinc-200 truncate">{entry.title}</span>
          <span className="text-[9px] text-zinc-500 shrink-0 font-mono">
            {entry.sections.length}§
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2.5">
              {entry.sections.map((section, i) => {
                const meta = SECTION_META[section.type] || SECTION_META.other;
                return (
                  <div key={i} className={`border-l-2 ${meta.border} bg-zinc-800/20 rounded-r-lg py-2.5 px-3`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <meta.icon className="w-3 h-3 text-zinc-500" />
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{section.heading}</span>
                    </div>
                    <SectionRenderer section={section} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function SharedStateMap({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('```') && !l.startsWith('#'));
  const entries: { state: string; pages: string[] }[] = [];

  for (const line of lines) {
    const match = line.match(/├── (.+?) .*─[─>]+ (.+)/);
    if (match) {
      const stateVar = match[1].trim();
      const pagesStr = match[2].trim();
      entries.push({ state: stateVar, pages: pagesStr.split(',').map(p => p.trim()) });
    }
  }

  if (entries.length === 0) {
    return <p className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono">{content}</p>;
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start gap-2 bg-zinc-800/20 rounded-lg px-3 py-2 border border-zinc-700/30">
          <code className="text-[10px] font-mono text-cyan-300 shrink-0 mt-0.5 min-w-[140px]">{entry.state}</code>
          <div className="flex flex-wrap gap-1">
            {entry.pages.map((page, j) => (
              <span key={j} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-700/40 text-zinc-300">
                {page.trim()}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-10 bg-zinc-800/60 rounded-xl" />
      <div className="h-10 bg-zinc-800/60 rounded-xl" />
      <div className="h-10 bg-zinc-800/60 rounded-xl" />
      <div className="h-10 bg-zinc-800/60 rounded-xl" />
      <div className="h-10 bg-zinc-800/60 rounded-xl" />
    </div>
  );
}

export default function PageContextPanel({ projectPath }: { projectPath?: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAll, setExpandedAll] = useState(false);
  const [showSharedState, setShowSharedState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!window.deskflowAPI || !projectPath) {
      setLoading(false);
      setError(null);
      setMarkdown(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.deskflowAPI.readAgentFileContent('PAGE_CONTEXT.md', projectPath);
      if (result?.success && result.data) {
        setMarkdown(result.data);
      } else {
        setError(result?.error || 'PAGE_CONTEXT.md not found in this workspace');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load page context');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    load();
  }, [load]);

  const allEntries = useMemo(() => {
    if (!markdown) return [];
    return parsePageContext(markdown);
  }, [markdown]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return allEntries;
    const q = searchQuery.toLowerCase();
    return allEntries.filter(e => {
      if (e.title.toLowerCase().includes(q)) return true;
      return e.sections.some(s => s.content.toLowerCase().includes(q));
    });
  }, [allEntries, searchQuery]);

  const sharedStateBlock = useMemo(() => {
    if (!markdown) return '';
    const match = markdown.match(/## Shared State Map\n+```[\s\S]*?```/);
    return match ? match[0] : '';
  }, [markdown]);

  const crossPageBlock = useMemo(() => {
    if (!markdown) return '';
    const match = markdown.match(/## Cross-Page Interaction Patterns[\s\S]*$/);
    return match ? match[0].replace(/^## Cross-Page Interaction Patterns\n+/, '') : '';
  }, [markdown]);

  const crossPageItems = useMemo(() => {
    if (!crossPageBlock) return [];
    return crossPageBlock.split('\n').filter(l => /^\d+\./.test(l.trim()));
  }, [crossPageBlock]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error && !markdown) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm font-medium text-zinc-300 mb-1">Could not load page context</p>
        <p className="text-[11px] text-zinc-500 text-center mb-5 max-w-[260px] leading-relaxed">{error}</p>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all duration-150 active:scale-[0.98] border border-zinc-700/50">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center mb-4">
          <BookOpen className="w-6 h-6 text-zinc-500" />
        </div>
        <p className="text-sm font-medium text-zinc-400 mb-1">No project selected</p>
        <p className="text-[11px] text-zinc-500 text-center max-w-[220px] leading-relaxed">
          Open or select a project from the header to view its page context.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Header + Search */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-150"
          />
        </div>
        <button
          onClick={() => setExpandedAll(!expandedAll)}
          className={`h-8 px-2.5 rounded-lg text-[10px] font-medium transition-all duration-150 active:scale-[0.97] border ${
            expandedAll
              ? 'bg-cyan-600/15 border-cyan-500/30 text-cyan-300'
              : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
          }`}
        >
          {expandedAll ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Cross-Page Patterns Summary */}
      {crossPageItems.length > 0 && (
        <div className="border-l-2 border-l-amber-500 bg-amber-500/5 rounded-r-lg p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Network className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-400">Cross-Page Patterns</span>
          </div>
          <div className="space-y-1">
            {crossPageItems.map((item, i) => (
              <p key={i} className="text-[11px] text-zinc-300 leading-relaxed">{item}</p>
            ))}
          </div>
        </div>
      )}

      {/* Page List */}
      <div className="flex-1 overflow-y-auto ws-scroll space-y-2 pr-0.5">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500">
              {searchQuery ? `No pages matching "${searchQuery}"` : 'No page entries found'}
            </p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="mt-3 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors duration-150">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredEntries.map((entry, i) => (
              <PageCard key={i} entry={entry} defaultOpen={filteredEntries.length === 1 || expandedAll} />
            ))}
            {/* Shared State Map */}
            {sharedStateBlock && (
              <GlassCard variant="interactive">
                <button
                  onClick={() => setShowSharedState(!showSharedState)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Network className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-zinc-200">Shared State Map</span>
                  </div>
                  <motion.div animate={{ rotate: showSharedState ? 0 : -90 }} transition={{ duration: 0.15 }}>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showSharedState && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3">
                        <SharedStateMap content={sharedStateBlock} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            )}
          </>
        )}
      </div>

      {/* Footer metadata */}
      {allEntries.length > 0 && (
        <div className="pt-2 mt-2 border-t border-zinc-800/40">
          <p className="text-[9px] text-zinc-600 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {allEntries.length} page{allEntries.length !== 1 ? 's' : ''} · {searchQuery && `${filteredEntries.length} filtered`}
          </p>
        </div>
      )}
    </div>
  );
}
