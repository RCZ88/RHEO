import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type, LayoutGrid, MousePointerClick, List, Sparkles, Box,
  Wind, Copy, Plus, X, ChevronRight, Play, AlertCircle, Loader2
} from 'lucide-react';
import { SWISHY_PRESETS, EASING_PRESETS, getDifficultyColor, getCategoryIcon, MotionPreset } from './MotionPresets';
import { EasingCurveBrowser } from './EasingCurveBrowser';
import { EmptyState, Skeleton, IconButton, Chip } from './_ds/primitives';

interface MotionExplorerProps {
  onAddMotionSnippet: (snippet: { name: string; code: string }) => void;
  onClose?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  text: <Type className="w-3.5 h-3.5" />,
  card: <LayoutGrid className="w-3.5 h-3.5" />,
  button: <MousePointerClick className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
  special: <Sparkles className="w-3.5 h-3.5" />,
};

const DIFFICULTY_ORDER = { easy: 0, medium: 1, advanced: 2 };

export function MotionExplorer({ onAddMotionSnippet, onClose }: MotionExplorerProps) {
  const [selectedPreset, setSelectedPreset] = useState<MotionPreset | null>(null);
  const [selectedEasing, setSelectedEasing] = useState<string>('Ease Out');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [duration, setDuration] = useState(0.5);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const categories = ['all', 'text', 'card', 'button', 'list', 'special'];

  const filteredPresets = SWISHY_PRESETS.filter((preset) => {
    const matchesCategory = activeCategory === 'all' || preset.category === activeCategory;
    const matchesSearch = preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);

  const generateCode = useCallback((preset: MotionPreset, easingName: string, dur: number) => {
    const easing = EASING_PRESETS.find(e => e.name === easingName);
    const easeStr = easing?.type === 'spring'
      ? `type: "spring", stiffness: ${(easing.value as { stiffness: number }).stiffness}, damping: ${(easing.value as { damping: number }).damping}`
      : `ease: "${easingName.toLowerCase().replace(/\s+/g, '-')}"`;
    try {
      return preset.codeTemplate({ duration: dur, ease: easeStr, delay: 0, stagger: 0.1 });
    } catch {
      setError('Failed to generate motion snippet');
      return '';
    }
  }, []);

  useEffect(() => {
    if (selectedPreset) {
      setError(null);
      const code = generateCode(selectedPreset, selectedEasing, duration);
      setGeneratedCode(code);
    }
  }, [selectedPreset, selectedEasing, duration, generateCode]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAddToContext = (preset: MotionPreset) => {
    if (!generatedCode) return;
    onAddMotionSnippet({ name: preset.name, code: generatedCode });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-48 h-5 rounded-md" />
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-20 h-8 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasInteracted && !selectedPreset) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-6">
            <Wind className="w-8 h-8 text-pink-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Motion Explorer</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Select a motion preset to preview animations, explore easing curves, and generate ready-to-use Framer Motion code snippets.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHasInteracted(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-sm font-medium hover:bg-pink-500/25 transition-colors"
          >
            <Play className="w-4 h-4" />
            Explore Presets
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="w-5 h-5 text-pink-400" />
          <h2 className="text-lg font-semibold text-white">Swishy Motion Presets</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-56 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20"
          />
          {onClose && (
            <IconButton onClick={onClose} title="Close" className="shrink-0">
              <X className="w-4 h-4 text-zinc-400" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Chip
            key={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            title={cat === 'all' ? 'All presets' : `${cat} presets`}
          >
            <span className="flex items-center gap-1.5 capitalize">
              {cat === 'all' ? <Box className="w-3.5 h-3.5" /> : CATEGORY_ICONS[cat]}
              {cat}
            </span>
          </Chip>
        ))}
      </div>

      {filteredPresets.length === 0 ? (
        <EmptyState
          icon={<Wind className="w-8 h-8 text-zinc-500" />}
          title="No presets found"
          hint="Try adjusting your search or category filter"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredPresets.map((preset) => (
              <motion.div
                key={preset.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedPreset(preset)}
                className={`
                  group relative flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all
                  ${selectedPreset?.id === preset.id
                    ? 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_24px_rgba(244,114,182,0.12)]'
                    : 'bg-zinc-900/80 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-800/60'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    ${selectedPreset?.id === preset.id ? 'bg-pink-500/20 text-pink-400' : 'bg-zinc-800/80 text-zinc-400'}
                  `}>
                    {CATEGORY_ICONS[preset.category] || <Box className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getDifficultyColor(preset.difficulty)}`}>
                    {preset.difficulty}
                  </span>
                </div>
                <div>
                  <h3 className={`text-sm font-medium ${selectedPreset?.id === preset.id ? 'text-pink-300' : 'text-zinc-200'}`}>
                    {preset.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{preset.description}</p>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-800/60 flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); handleCopy(preset.codeTemplate({ duration: preset.defaultDuration, ease: preset.defaultEase }), preset.id); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
                  >
                    {copiedId === preset.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedId === preset.id ? 'Copied' : 'Copy'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); handleAddToContext(preset); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/20 hover:bg-pink-500/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <EasingCurveBrowser selectedEasing={selectedEasing} onSelectEasing={setSelectedEasing} />

      <AnimatePresence>
        {selectedPreset && generatedCode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-medium text-zinc-200">Generated Code</span>
                  <span className="text-xs text-zinc-500">{selectedPreset.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Duration</label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value))}
                    className="w-24 accent-pink-500"
                  />
                  <span className="text-xs text-zinc-400 w-10 text-right">{duration}s</span>
                </div>
              </div>
              <div className="relative">
                <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {generatedCode}
                </pre>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopy(generatedCode, 'generated')}
                  className="absolute top-3 right-3 p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {copiedId === 'generated' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
