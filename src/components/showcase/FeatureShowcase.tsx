import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, Layers, Eye } from 'lucide-react';
import { features } from '../../data/features';
import { CATEGORY_META, type Category } from '../../types/showcase';

const categories: Array<Category | 'all'> = ['all', 'text', 'diagrams', 'interactive', 'visualization', 'ai', 'structure'];

function FeatureCard({ feature, expanded, onToggle }: { feature: typeof features[0]; expanded: boolean; onToggle: () => void }) {
  const catMeta = CATEGORY_META[feature.category];

  return (
    <motion.div
      layout
      className="rounded-xl border border-white/10 bg-[#1c1917]/60 backdrop-blur-sm overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition"
        aria-expanded={expanded}
      >
        <span className="text-xl shrink-0">{feature.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100 font-serif">{feature.name}</span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${catMeta.color}`}>{catMeta.label}</span>
          </div>
          <p className="text-[11px] text-zinc-500 truncate">{feature.description}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">When the AI uses it</p>
                <p className="text-xs text-zinc-400">{feature.whenUsed}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Live Demo</p>
                <div className="rounded-lg bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 p-3">
                  {feature.demo}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">.lmd Syntax</p>
                <pre className="text-[11px] text-zinc-400 bg-black/40 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">{feature.syntax}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface FeatureShowcaseProps {
  embedded?: boolean;
}

export function FeatureShowcase({ embedded = false }: FeatureShowcaseProps) {
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const filtered = useMemo(() => {
    return features.filter(f => {
      const matchCat = activeCategory === 'all' || f.category === activeCategory;
      const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCards(new Set());
    } else {
      setExpandedCards(new Set(filtered.map(f => f.id)));
    }
    setAllExpanded(!allExpanded);
  };

  return (
    <div className={embedded ? '' : 'min-h-screen bg-[#0f0e0d]'}>
      {/* Hero — only when standalone */}
      {!embedded && (
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-clay-400" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-clay-300">Lyceum</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#fafaf9] mb-3">Feature Showcase</h1>
            <p className="text-zinc-400 max-w-xl mx-auto text-sm">
              Every block type the AI can generate and the system can parse.
              <br />
              <span className="text-zinc-500">{features.length} features • Interactive demos • .lmd syntax</span>
            </p>
          </motion.div>
        </div>
      )}

      {/* Controls */}
      <div className={`sticky top-0 z-40 border-b border-white/5 ${embedded ? 'bg-[#1c1917]/80 backdrop-blur-md' : 'bg-[#0f0e0d]/80 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          {/* Category pills */}
          <div className="flex gap-1 flex-wrap">
            {categories.map(cat => {
              const meta = cat === 'all' ? { label: 'All', color: 'text-zinc-300' } : CATEGORY_META[cat];
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setAllExpanded(false); setExpandedCards(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
                    isActive ? 'bg-clay-500/20 text-clay-300 border border-clay-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-xs w-48 focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600"
            />
          </div>

          {/* Expand all */}
          <button onClick={toggleAll} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 transition">
            <Eye className="w-3 h-3" />
            {allExpanded ? 'Collapse' : 'Expand'}
          </button>

          {/* Count */}
          <span className="text-[10px] text-zinc-600 font-mono">{filtered.length}/{features.length}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(feature => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              expanded={expandedCards.has(feature.id)}
              onToggle={() => toggleCard(feature.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">No features match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
