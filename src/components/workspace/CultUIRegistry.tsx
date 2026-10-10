import { useState, useMemo } from 'react';
import { Search, Copy, Check, Terminal, ChevronDown, ExternalLink, Package } from 'lucide-react';
import { INPUT_CLS, BTN_PRIMARY, BTN_GHOST } from './_ds/controls';
import { EmptyState } from './_ds/primitives';

interface CultComponentDef {
  slug: string;
  name: string;
  description: string;
  category: string;
  registryUrl: string;
}

const CULT_COMPONENTS: CultComponentDef[] = [
  { slug: 'dynamic-island', name: 'Dynamic Island', description: 'Apple-style notch pill that expands into a rich notification card', category: 'Layout', registryUrl: 'https://www.cult-ui.com/r/dynamic-island' },
  { slug: 'family-button', name: 'Family Button', description: 'Animated button group with playful child reveal', category: 'Buttons', registryUrl: 'https://www.cult-ui.com/r/family-button' },
  { slug: 'dock', name: 'Dock', description: 'macOS-style animated dock with magnification on hover', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/dock' },
  { slug: 'sparkles', name: 'Sparkles', description: 'Particle sparkle trail following cursor or centered burst', category: 'Effects', registryUrl: 'https://www.cult-ui.com/r/sparkles' },
  { slug: 'word-rotate', name: 'Word Rotate', description: 'Rotating word carousel with smooth vertical transition', category: 'Typography', registryUrl: 'https://www.cult-ui.com/r/word-rotate' },
  { slug: 'shimmer-button', name: 'Shimmer Button', description: 'Button with a flowing gradient shimmer overlay', category: 'Buttons', registryUrl: 'https://www.cult-ui.com/r/shimmer-button' },
  { slug: 'animated-beam', name: 'Animated Beam', description: 'Connecting beam/cable animation between two elements', category: 'Effects', registryUrl: 'https://www.cult-ui.com/r/animated-beam' },
  { slug: 'avatar-stack', name: 'Avatar Stack', description: 'Overlapping avatar circles with hover reveal', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/avatar-stack' },
  { slug: 'bento-grid', name: 'Bento Grid', description: 'Apple-inspired bento box layout with animated cells', category: 'Layout', registryUrl: 'https://www.cult-ui.com/r/bento-grid' },
  { slug: 'card-pattern', name: 'Card Pattern', description: 'Decorative card with SVG pattern backgrounds', category: 'Cards', registryUrl: 'https://www.cult-ui.com/r/card-pattern' },
  { slug: 'color-picker', name: 'Color Picker', description: 'Custom color picker with recent colors and swatches', category: 'Forms', registryUrl: 'https://www.cult-ui.com/r/color-picker' },
  { slug: 'command', name: 'Command Menu', description: '⌘K-style command palette with search filtering', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/command' },
  { slug: 'confetti', name: 'Confetti', description: 'Celebration confetti burst on action completion', category: 'Effects', registryUrl: 'https://www.cult-ui.com/r/confetti' },
  { slug: 'count-up', name: 'Count Up', description: 'Animated number counter, easing from zero to target', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/count-up' },
  { slug: 'dialog', name: 'Dialog', description: 'Modal dialog with backdrop blur and enter/exit animation', category: 'Overlay', registryUrl: 'https://www.cult-ui.com/r/dialog' },
  { slug: 'dot-pattern', name: 'Dot Pattern', description: 'Generative dot grid background pattern component', category: 'Backgrounds', registryUrl: 'https://www.cult-ui.com/r/dot-pattern' },
  { slug: 'feature-card', name: 'Feature Card', description: 'Hover-reveal feature card with icon and description', category: 'Cards', registryUrl: 'https://www.cult-ui.com/r/feature-card' },
  { slug: 'flicker-grid', name: 'Flicker Grid', description: 'Grid cells that flicker with random opacity animation', category: 'Backgrounds', registryUrl: 'https://www.cult-ui.com/r/flicker-grid' },
  { slug: 'flip-text', name: 'Flip Text', description: 'Text that flips character-by-character on hover', category: 'Typography', registryUrl: 'https://www.cult-ui.com/r/flip-text' },
  { slug: 'globe', name: 'Globe', description: '3D rotating globe via Three.js with marker pins', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/globe' },
  { slug: 'hero-video-dialog', name: 'Hero Video Dialog', description: 'Hero section with a play button that opens a video modal', category: 'Layout', registryUrl: 'https://www.cult-ui.com/r/hero-video-dialog' },
  { slug: 'image-comparison', name: 'Image Comparison', description: 'Before/after slider with draggable divider', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/image-comparison' },
  { slug: 'interactive-hover-button', name: 'Interactive Hover Button', description: 'Button that follows cursor with magnetic effect', category: 'Buttons', registryUrl: 'https://www.cult-ui.com/r/interactive-hover-button' },
  { slug: 'line-pattern', name: 'Line Pattern', description: 'SVG line art pattern background', category: 'Backgrounds', registryUrl: 'https://www.cult-ui.com/r/line-pattern' },
  { slug: 'marquee', name: 'Marquee', description: 'Auto-scrolling horizontal ticker animation', category: 'Layout', registryUrl: 'https://www.cult-ui.com/r/marquee' },
  { slug: 'morphing-dialog', name: 'Morphing Dialog', description: 'Dialog that morphs from the triggering element', category: 'Overlay', registryUrl: 'https://www.cult-ui.com/r/morphing-dialog' },
  { slug: 'neon-gradient-card', name: 'Neon Gradient Card', description: 'Card with animated neon border gradient', category: 'Cards', registryUrl: 'https://www.cult-ui.com/r/neon-gradient-card' },
  { slug: 'number-ticker', name: 'Number Ticker', description: 'Ticker-tape style number animation', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/number-ticker' },
  { slug: 'particles', name: 'Particles', description: 'Configurable particle system with mouse interaction', category: 'Effects', registryUrl: 'https://www.cult-ui.com/r/particles' },
  { slug: 'progress-bar', name: 'Progress Bar', description: 'Animated progress bar with label and variant styles', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/progress-bar' },
  { slug: 'pulsating-button', name: 'Pulsating Button', description: 'Button with a ring pulse animation', category: 'Buttons', registryUrl: 'https://www.cult-ui.com/r/pulsating-button' },
  { slug: 'retro-grid', name: 'Retro Grid', description: '80s-style grid background with scanline overlay', category: 'Backgrounds', registryUrl: 'https://www.cult-ui.com/r/retro-grid' },
  { slug: 'ripple-button', name: 'Ripple Button', description: 'Material-style ripple effect on click', category: 'Buttons', registryUrl: 'https://www.cult-ui.com/r/ripple-button' },
  { slug: 'scroll-progress', name: 'Scroll Progress', description: 'Thin progress bar that fills as user scrolls', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/scroll-progress' },
  { slug: 'sidebar', name: 'Sidebar', description: 'Collapsible sidebar with icon + label navigation', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/sidebar' },
  { slug: 'skeleton', name: 'Skeleton', description: 'Pulse-loading placeholder for async content', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/skeleton' },
  { slug: 'stepper', name: 'Stepper', description: 'Multi-step wizard with progress indicators', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/stepper' },
  { slug: 'tabs', name: 'Tabs', description: 'Animated tab switcher with underline indicator', category: 'Navigation', registryUrl: 'https://www.cult-ui.com/r/tabs' },
  { slug: 'text-animate', name: 'Text Animate', description: 'Character-by-character text reveal animation', category: 'Typography', registryUrl: 'https://www.cult-ui.com/r/text-animate' },
  { slug: 'tilted-sentry', name: 'Tilted Sentry', description: 'Sentry-style tilted badge/indicator', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/tilted-sentry' },
  { slug: 'timeline', name: 'Timeline', description: 'Vertical timeline with animated entries and dots', category: 'Data Display', registryUrl: 'https://www.cult-ui.com/r/timeline' },
  { slug: 'tooltip', name: 'Tooltip', description: 'Animated tooltip with arrow and delay control', category: 'Overlay', registryUrl: 'https://www.cult-ui.com/r/tooltip' },
  { slug: 'tweet-card', name: 'Tweet Card', description: 'Embed tweets as styled cards', category: 'Cards', registryUrl: 'https://www.cult-ui.com/r/tweet-card' },
  { slug: 'video-modal', name: 'Video Modal', description: 'Lightbox modal for video playback', category: 'Overlay', registryUrl: 'https://www.cult-ui.com/r/video-modal' },
  { slug: 'wrap-balance', name: 'Wrap Balance', description: 'Text balance utility — prevents orphaned words', category: 'Typography', registryUrl: 'https://www.cult-ui.com/r/wrap-balance' },
];

const CATEGORIES = Array.from(new Set(CULT_COMPONENTS.map(c => c.category))).sort();

interface CultUIRegistryProps {
  onAddComponent: (component: { slug: string; name: string; source: string; category: string; code?: string }) => void;
  onInstall?: (registryUrl: string) => void;
}

export default function CultUIRegistry({ onAddComponent, onInstall }: CultUIRegistryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedComponent, setCopiedComponent] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(CATEGORIES));

  const filtered = useMemo(() => {
    let list = CULT_COMPONENTS;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      list = list.filter(c => c.category === selectedCategory);
    }
    return list;
  }, [search, selectedCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, CultComponentDef[]> = {};
    for (const comp of filtered) {
      (groups[comp.category] ??= []).push(comp);
    }
    return groups;
  }, [filtered]);

  const toggleSection = (cat: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const buildInstallCommand = (comp: CultComponentDef) => `npx shadcn@latest add https://www.cult-ui.com/r/${comp.slug}`;

  const handleCopy = async (comp: CultComponentDef) => {
    const cmd = buildInstallCommand(comp);
    await navigator.clipboard.writeText(cmd);
    setCopiedComponent(comp.slug);
    setTimeout(() => setCopiedComponent(null), 1500);
  };

  const handleAdd = (comp: CultComponentDef) => {
    onAddComponent({
      slug: comp.slug,
      name: comp.name,
      source: 'cult-ui',
      category: comp.category,
      code: `<!-- Cult UI: ${comp.name} -->\n<!-- Install: ${buildInstallCommand(comp)} -->`,
    });
  };

  const renderComponentCard = (comp: CultComponentDef) => {
    const cmd = buildInstallCommand(comp);
    return (
      <div
        key={comp.slug}
        className="group flex items-start gap-3 p-2.5 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 hover:border-zinc-700/60 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] transition-all"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-zinc-200">{comp.name}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-zinc-800/60 text-zinc-500 text-[9px]">{comp.slug}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">{comp.description}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <code className="text-[9px] font-mono text-zinc-600 bg-zinc-800/40 px-1.5 py-0.5 rounded truncate max-w-[240px]">
              {cmd}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onInstall && (
            <button
              onClick={() => onInstall(comp.registryUrl)}
              className="p-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-colors"
              title="Install component"
            >
              <Terminal className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => handleAdd(comp)}
            className="p-1.5 rounded bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 hover:text-pink-300 transition-colors"
            title="Add to design context"
          >
            <Package className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleCopy(comp)}
            className="p-1.5 rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            title="Copy install command"
          >
            {copiedComponent === comp.slug ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <a
            href={comp.registryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            title="Open in Cult UI"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  };

  const allExpanded = expandedSections.size === CATEGORIES.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Cult UI Registry</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/60 rounded-lg px-2 py-1">
            <Terminal className="w-3 h-3" />
            npx shadcn@latest
          </div>
          <button
            onClick={() => setExpandedSections(allExpanded ? new Set() : new Set(CATEGORIES))}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search components..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${INPUT_CLS} pl-9 text-[12px]`}
        />
      </div>

      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-2 py-1 rounded-full text-[10px] transition-colors ${
            !selectedCategory
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 hover:text-zinc-300'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`px-2 py-1 rounded-full text-[10px] transition-colors ${
              selectedCategory === cat
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 hover:text-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {Object.entries(grouped).length === 0 ? (
          <EmptyState
            icon={<Search className="w-5 h-5" />}
            title="No components found"
            hint="Try a different search term or category"
          />
        ) : (
          Object.entries(grouped).map(([cat, comps]) => (
            <div key={cat} className="rounded-lg border border-zinc-800/30 overflow-hidden">
              <button
                onClick={() => toggleSection(cat)}
                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] transition-colors text-[11px] font-medium text-zinc-400"
              >
                <span>{cat} ({comps.length})</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedSections.has(cat) ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.has(cat) && (
                <div className="p-2 space-y-1.5">
                  {comps.map(renderComponentCard)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/30">
        <span className="text-[10px] text-zinc-600">
          {filtered.length} of {CULT_COMPONENTS.length} components
        </span>
      </div>
    </div>
  );
}
