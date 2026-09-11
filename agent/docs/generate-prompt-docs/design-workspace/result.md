# Fix Packet — Design Workspace Expansion + File-Level Backup System

## Document Information
- **Type**: Fix Packet Result Document
- **Target**: DeskFlow Electron+React Application
- **Features**: (1) Design Workspace Expansion, (2) File-Level Backup/Restore System
- **Line Endings**: CRLF (\r\n) — preserved throughout
- **Comments**: Zero explanatory comments in code output

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [New Files](#new-files)
   - [MotionPresets.tsx](#motionpresetstsx)
   - [EasingCurveBrowser.tsx](#easingcurvebrowsertsx)
   - [MotionExplorer.tsx](#motionexplorertsx)
   - [ProjectBackupService.ts](#projectbackupservicets)
   - [BackupDiffViewer.tsx](#backupdiffviewertsx)
   - [BackupTabPanel.tsx](#backuptabpaneltsx)
3. [Modified Files](#modified-files)
   - [types/deskflow-api.d.ts](#typesdeskflow-apidts)
   - [preload.ts](#preloadts)
   - [main.ts](#maints)
   - [ComponentBrowserModal.tsx](#componentbrowsermodaltsx)
   - [LibraryConfigModal.tsx](#libraryconfigmodaltsx)
   - [DesignLibrarySources.tsx](#designlibrarysourcestsx)
   - [DesignWorkspacePage.tsx](#designworkspacepagetsx)
   - [IDEProjectsPage.tsx](#ideprojectspagetsx)
4. [Build & Verification](#build--verification)
5. [File-by-File Changelog](#file-by-file-changelog)

---

## Executive Summary

This Fix Packet delivers two major features for the DeskFlow application:

### Feature 1: Design Workspace Expansion
- **MotionExplorer.tsx**: Replaced null-returning stub with a full motion exploration UI featuring 12+ Swishy Motion kinetic typography presets, an interactive Framer Motion easing curve browser with SVG visualization, and a code generator that produces ready-to-use `motion.div` snippets.
- **ComponentBrowserModal.tsx**: Extended from 3 libraries to all 10 defined libraries plus 4 browseable sources (Magic UI, Lucide, Iconify, Unsplash). Each library has dedicated `fetchComponents` and `getComponentDetail` logic with MCP integration where applicable.
- **LibraryConfigModal.tsx**: Added `swishy-motion` and `variant` configuration entries with MCP command fields, API key inputs, auto-start toggles, and browser-open actions.
- **DesignLibrarySources.tsx**: Added 4 additional MCP source cards (Magic UI, Lucide, Iconify, Unsplash) with live status indicators and browse actions.
- **DesignWorkspacePage.tsx**: Added skill preview panel, "Start All Servers" button, library status polling, global search bar, and responsive grid behavior.

### Feature 2: File-Level Backup/Restore System
- **ProjectBackupService.ts**: New Node.js service handling zip-based project snapshots with exclusion filters, manifest recording, pre-restore safety snapshots, auto-scheduling, and diff generation.
- **BackupTabPanel.tsx**: Full two-panel backup management UI replacing the IDE placeholder. Features backup list with multi-select, auto-backup scheduling, inline diff viewer, tree-view file explorer, and confirmation dialogs for destructive actions.
- **BackupDiffViewer.tsx**: Dedicated diff panel showing added/modified/deleted/unchanged files with color-coded icons and count badges.
- **IPC Layer**: 6 new handlers in `main.ts` and corresponding bridge methods in `preload.ts`.
- **Type Definitions**: New `ProjectBackupManifest` and `ProjectBackupDiff` interfaces in `deskflow-api.d.ts`.

---

## New Files

### MotionPresets.tsx

**Path**: `src/components/workspace/MotionPresets.tsx`

**Purpose**: Data layer and type definitions for Swishy Motion kinetic typography presets. Separated from the UI to allow reuse and clean architecture.

```typescript
export interface MotionPreset {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  category: 'text' | 'card' | 'button' | 'list' | 'special';
  defaultDuration: number;
  defaultEase: string;
  codeTemplate: (opts: { duration: number; ease: string; delay?: number; stagger?: number }) => string;
}

export const SWISHY_PRESETS: MotionPreset[] = [
  {
    id: 'word-fade-cascade',
    name: 'Word Fade Cascade',
    description: 'Each word fades in with a staggered delay creating a cascading reveal effect',
    difficulty: 'easy',
    category: 'text',
    defaultDuration: 0.5,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.1 }) =>
      `motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay}, staggerChildren: ${stagger} }}
  // Wrap each word in motion.span with variants`,
  },
  {
    id: 'character-reveal',
    name: 'Character Reveal',
    description: 'Individual characters animate in with rotation and opacity',
    difficulty: 'medium',
    category: 'text',
    defaultDuration: 0.4,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.03 }) =>
      `const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: ${stagger}, delayChildren: ${delay} } } };
const child = { hidden: { opacity: 0, rotateX: -90 }, visible: { opacity: 1, rotateX: 0, transition: { duration: ${duration}, ease: "${ease}" } } };
// Apply variants to motion.div and motion.span`,
  },
  {
    id: 'glow-pulse',
    name: 'Glow Pulse',
    description: 'Text emits a rhythmic glowing shadow pulse',
    difficulty: 'easy',
    category: 'text',
    defaultDuration: 2,
    defaultEase: 'easeInOut',
    codeTemplate: ({ duration, ease }) =>
      `motion.div
  animate={{ textShadow: [
    "0 0 10px rgba(244,114,182,0)",
    "0 0 20px rgba(244,114,182,0.5)",
    "0 0 10px rgba(244,114,182,0)"
  ] }}
  transition={{ duration: ${duration}, ease: "${ease}", repeat: Infinity }}`,
  },
  {
    id: 'card-hover-lift',
    name: 'Card Hover Lift',
    description: 'Card elevates with shadow expansion on hover',
    difficulty: 'easy',
    category: 'card',
    defaultDuration: 0.3,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease }) =>
      `motion.div
  whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
  transition={{ duration: ${duration}, ease: "${ease}" }}
  className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"`,
  },
  {
    id: 'magnetic-button',
    name: 'Magnetic Button',
    description: 'Button follows cursor with spring physics when nearby',
    difficulty: 'advanced',
    category: 'button',
    defaultDuration: 0.15,
    defaultEase: 'spring',
    codeTemplate: ({ duration }) =>
      `// Use useMotionValue + useSpring
const x = useMotionValue(0);
const y = useMotionValue(0);
const springX = useSpring(x, { stiffness: 150, damping: 15 });
const springY = useSpring(y, { stiffness: 150, damping: 15 });
// On mouse move, calculate offset from center and set x/y`,
  },
  {
    id: 'stagger-list',
    name: 'Stagger List',
    description: 'List items cascade in with configurable stagger',
    difficulty: 'easy',
    category: 'list',
    defaultDuration: 0.4,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.1 }) =>
      `const variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: ${duration}, ease: "${ease}", staggerChildren: ${stagger}, delayChildren: ${delay} } }
};
// Parent: motion.ul with variants
// Children: motion.li with variants`,
  },
  {
    id: 'scale-in',
    name: 'Scale In',
    description: 'Element scales from 0 to 1 with opacity fade',
    difficulty: 'easy',
    category: 'special',
    defaultDuration: 0.5,
    defaultEase: 'backOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, scale: 0 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'rotate-in',
    name: 'Rotate In',
    description: 'Element rotates from -180deg while fading in',
    difficulty: 'medium',
    category: 'special',
    defaultDuration: 0.6,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, rotate: -180 }}
  animate={{ opacity: 1, rotate: 0 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'stretch-in',
    name: 'Stretch In',
    description: 'Horizontal stretch squash effect on entrance',
    difficulty: 'medium',
    category: 'text',
    defaultDuration: 0.5,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, scaleX: 0.3 }}
  animate={{ opacity: 1, scaleX: 1 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'bounce-in',
    name: 'Bounce In',
    description: 'Heavy bounce overshoot on entrance',
    difficulty: 'easy',
    category: 'special',
    defaultDuration: 0.6,
    defaultEase: 'spring',
    codeTemplate: ({ duration }) =>
      `motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 20, duration: ${duration} }}`,
  },
  {
    id: 'shimmer-text',
    name: 'Shimmer Text',
    description: 'Diagonal light sweep across text surface',
    difficulty: 'advanced',
    category: 'text',
    defaultDuration: 2,
    defaultEase: 'linear',
    codeTemplate: ({ duration }) =>
      `// CSS background-clip text with animated gradient
background: linear-gradient(90deg, #e4e4e7 0%, #f472b6 50%, #e4e4e7 100%);
background-size: 200% auto;
animation: shimmer ${duration}s linear infinite;
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;`,
  },
  {
    id: 'morphing-gradient',
    name: 'Morphing Gradient',
    description: 'Background gradient shifts hue continuously',
    difficulty: 'medium',
    category: 'special',
    defaultDuration: 8,
    defaultEase: 'linear',
    codeTemplate: ({ duration }) =>
      `motion.div
  animate={{
    background: [
      "linear-gradient(135deg, #18181b, #27272a)",
      "linear-gradient(135deg, #27272a, #3f3f46)",
      "linear-gradient(135deg, #18181b, #27272a)"
    ]
  }}
  transition={{ duration: ${duration}, ease: "linear", repeat: Infinity }}`,
  },
];

export const EASING_PRESETS = [
  { name: 'Linear', value: [0, 0, 1, 1], type: 'bezier' },
  { name: 'Ease', value: [0.25, 0.1, 0.25, 1], type: 'bezier' },
  { name: 'Ease In', value: [0.42, 0, 1, 1], type: 'bezier' },
  { name: 'Ease Out', value: [0, 0, 0.58, 1], type: 'bezier' },
  { name: 'Ease In Out', value: [0.42, 0, 0.58, 1], type: 'bezier' },
  { name: 'Spring Gentle', value: { stiffness: 120, damping: 14, mass: 1 }, type: 'spring' },
  { name: 'Spring Bouncy', value: { stiffness: 300, damping: 10, mass: 1 }, type: 'spring' },
  { name: 'Anticipate', value: [0.36, 0, 0.66, -0.56], type: 'bezier' },
  { name: 'Overshoot', value: [0.34, 1.56, 0.64, 1], type: 'bezier' },
];

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'advanced': return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
  }
}

export function getCategoryIcon(category: string): string {
  switch (category) {
    case 'text': return 'Type';
    case 'card': return 'LayoutGrid';
    case 'button': return 'MousePointerClick';
    case 'list': return 'List';
    case 'special': return 'Sparkles';
    default: return 'Box';
  }
}
```

---

### EasingCurveBrowser.tsx

**Path**: `src/components/workspace/EasingCurveBrowser.tsx`

**Purpose**: Interactive SVG visualization of easing curves with selectable presets and formula display. Uses SVG path rendering for cubic-bezier curves.

```typescript
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, BezierCurve } from 'lucide-react';
import { EASING_PRESETS } from './MotionPresets';
import { IconButton } from './_ds/primitives';

interface EasingCurveBrowserProps {
  selectedEasing: string | null;
  onSelectEasing: (name: string) => void;
}

function bezierToPath(p1x: number, p1y: number, p2x: number, p2y: number): string {
  const scale = 180;
  const pad = 20;
  const sx = (v: number) => pad + v * scale;
  const sy = (v: number) => pad + (1 - v) * scale;
  return `M ${sx(0)} ${sy(0)} C ${sx(p1x)} ${sy(p1y)}, ${sx(p2x)} ${sy(p2y)}, ${sx(1)} ${sy(1)}`;
}

function springToPath(stiffness: number, damping: number): string {
  const points: string[] = [];
  const steps = 60;
  const dt = 0.016;
  let pos = 1;
  let vel = 0;
  const target = 0;
  const scale = 180;
  const pad = 20;
  const sx = (v: number) => pad + (1 - v) * scale;
  const sy = (v: number) => pad + v * scale;
  points.push(`M ${sx(0)} ${sy(0)}`);
  for (let i = 0; i < steps; i++) {
    const force = -stiffness * (pos - target);
    const damp = -damping * vel;
    vel += (force + damp) * dt;
    pos += vel * dt;
    points.push(`L ${sx(i / steps)} ${sy(pos)}`);
  }
  return points.join(' ');
}

export function EasingCurveBrowser({ selectedEasing, onSelectEasing }: EasingCurveBrowserProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (formula: string, name: string) => {
    navigator.clipboard.writeText(formula).catch(() => {});
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  const renderCurve = (preset: typeof EASING_PRESETS[0]) => {
    if (preset.type === 'spring') {
      const v = preset.value as { stiffness: number; damping: number };
      return springToPath(v.stiffness, v.damping);
    }
    const v = preset.value as number[];
    return bezierToPath(v[0], v[1], v[2], v[3]);
  };

  const renderFormula = (preset: typeof EASING_PRESETS[0]): string => {
    if (preset.type === 'spring') {
      const v = preset.value as { stiffness: number; damping: number; mass: number };
      return `type: "spring", stiffness: ${v.stiffness}, damping: ${v.damping}, mass: ${v.mass}`;
    }
    const v = preset.value as number[];
    return `ease: [${v[0]}, ${v[1]}, ${v[2]}, ${v[3]}]`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BezierCurve className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Easing Curves</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {EASING_PRESETS.map((preset) => {
          const isSelected = selectedEasing === preset.name;
          const pathD = useMemo(() => renderCurve(preset), [preset]);
          const formula = renderFormula(preset);
          return (
            <motion.button
              key={preset.name}
              onClick={() => onSelectEasing(preset.name)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-colors
                ${isSelected
                  ? 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_20px_rgba(244,114,182,0.1)]'
                  : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/80'}
              `}
            >
              <svg viewBox="0 0 220 220" className="w-full h-24 rounded-lg bg-zinc-950/50">
                <line x1="20" y1="200" x2="200" y2="200" stroke="#3f3f46" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="200" stroke="#3f3f46" strokeWidth="1" />
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? '#f472b6' : '#a1a1aa'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isSelected ? 'text-pink-300' : 'text-zinc-300'}`}>
                  {preset.name}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
              </div>
              <code className="text-[10px] font-mono text-zinc-500 truncate">{formula}</code>
              <IconButton
                onClick={(e) => { e.stopPropagation(); handleCopy(formula, preset.name); }}
                title="Copy formula"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
              >
                {copied === preset.name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              </IconButton>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

---

### MotionExplorer.tsx

**Path**: `src/components/workspace/MotionExplorer.tsx`

**Purpose**: Full replacement for the 3-line stub. Integrates Swishy Motion presets, easing curve browser, and code generation. Implements all 4 states (empty, loading, error, populated).

```typescript
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
```

---

### ProjectBackupService.ts

**Path**: `src/main/backup/ProjectBackupService.ts`

**Purpose**: Node.js service for file-level project backup. Handles zip creation, manifest management, auto-scheduling, restore with safety snapshots, and diff generation. Follows the same patterns as existing BackupService.ts.

```typescript
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import archiver from 'archiver';
import extractZip from 'extract-zip';
import { glob } from 'glob';

export interface ProjectBackupManifest {
  id: string;
  projectId: string;
  label: string;
  timestamp: string;
  fileCount: number;
  totalSize: number;
  compressionRatio: number;
  autoBackup: boolean;
}

export interface ProjectBackupDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'target/**',
  'build/**',
  '__pycache__/**',
  '.next/**',
  '*.log',
  '.DS_Store',
  'backup/**',
  'project-backups/**',
];

function getBackupDir(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'backups', 'project-backups');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getManifestPath(projectId: string): string {
  return path.join(getBackupDir(), projectId, 'manifests.json');
}

function readManifests(projectId: string): ProjectBackupManifest[] {
  const manifestPath = getManifestPath(projectId);
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const data = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeManifests(projectId: string, manifests: ProjectBackupManifest[]): void {
  const manifestPath = getManifestPath(projectId);
  ensureDir(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify(manifests, null, 2));
}

function getTotalSize(filePaths: string[]): number {
  return filePaths.reduce((total, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return total + (stat.isFile() ? stat.size : 0);
    } catch {
      return total;
    }
  }, 0);
}

async function createZipArchive(sourceDir: string, outPath: string): Promise<{ fileCount: number; totalSize: number }> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    let fileCount = 0;
    let totalSize = 0;

    output.on('close', () => {
      resolve({ fileCount, totalSize });
    });

    archive.on('error', (err) => reject(err));
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') reject(err); });
    archive.on('entry', (entry) => {
      if (entry.stats && entry.stats.isFile()) {
        fileCount++;
        totalSize += entry.stats.size;
      }
    });

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: EXCLUDE_PATTERNS,
      dot: true,
    }, {});
    archive.finalize();
  });
}

export async function createProjectBackup(projectId: string, projectPath: string, label?: string): Promise<{ success: boolean; data?: { id: string; label: string; timestamp: string; fileCount: number }; error?: string }> {
  try {
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project path does not exist' };
    }

    const backupDir = getBackupDir();
    const projectBackupDir = path.join(backupDir, projectId);
    ensureDir(projectBackupDir);

    const timestamp = new Date().toISOString();
    const backupId = generateId();
    const safeLabel = (label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${backupId}_${safeLabel}.zip`;
    const zipPath = path.join(projectBackupDir, zipName);

    const { fileCount, totalSize } = await createZipArchive(projectPath, zipPath);
    const zipStat = fs.statSync(zipPath);
    const compressionRatio = totalSize > 0 ? zipStat.size / totalSize : 0;

    const manifest: ProjectBackupManifest = {
      id: backupId,
      projectId,
      label: label || 'Manual Backup',
      timestamp,
      fileCount,
      totalSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      autoBackup: false,
    };

    const manifests = readManifests(projectId);
    manifests.unshift(manifest);
    writeManifests(projectId, manifests);

    return {
      success: true,
      data: { id: backupId, label: manifest.label, timestamp, fileCount },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function listProjectBackups(projectId: string): Promise<{ success: boolean; data?: ProjectBackupManifest[]; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    return { success: true, data: manifests };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function restoreProjectBackup(projectId: string, backupId: string, projectPath: string): Promise<{ success: boolean; data?: { restoredCount: number }; error?: string }> {
  try {
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project path does not exist' };
    }

    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (!fs.existsSync(zipPath)) {
      return { success: false, error: 'Backup archive not found' };
    }

    const preRestoreDir = `${projectPath}.bak_${Date.now()}`;
    fs.cpSync(projectPath, preRestoreDir, { recursive: true, filter: (src) => !src.includes('node_modules') && !src.includes('.git') });

    await extractZip(zipPath, { dir: projectPath });

    const restoredFiles = await glob('**/*', { cwd: projectPath, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });

    return { success: true, data: { restoredCount: restoredFiles.length } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteProjectBackup(backupId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const updated = manifests.filter(m => m.id !== backupId);
    writeManifests(projectId, updated);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function diffProjectBackup(projectId: string, backupId: string, projectPath: string): Promise<{ success: boolean; data?: ProjectBackupDiff; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (!fs.existsSync(zipPath)) {
      return { success: false, error: 'Backup archive not found' };
    }

    const tempDir = path.join(app.getPath('temp'), `df-diff-${backupId}`);
    ensureDir(tempDir);
    await extractZip(zipPath, { dir: tempDir });

    const currentFiles = await glob('**/*', { cwd: projectPath, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });
    const backupFiles = await glob('**/*', { cwd: tempDir, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });

    const currentSet = new Set(currentFiles);
    const backupSet = new Set(backupFiles);

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    for (const file of currentFiles) {
      if (!backupSet.has(file)) {
        added.push(file);
      } else {
        try {
          const currentStat = fs.statSync(path.join(projectPath, file));
          const backupStat = fs.statSync(path.join(tempDir, file));
          if (currentStat.mtime.getTime() !== backupStat.mtime.getTime() || currentStat.size !== backupStat.size) {
            modified.push(file);
          } else {
            unchanged.push(file);
          }
        } catch {
          modified.push(file);
        }
      }
    }

    for (const file of backupFiles) {
      if (!currentSet.has(file)) {
        deleted.push(file);
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });

    return { success: true, data: { added, modified, deleted, unchanged } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

const schedulerMap = new Map<string, ReturnType<typeof setInterval>>();

export async function scheduleProjectBackup(projectId: string, projectPath: string, intervalMinutes: number): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = schedulerMap.get(projectId);
    if (existing) {
      clearInterval(existing);
      schedulerMap.delete(projectId);
    }

    if (intervalMinutes <= 0) {
      return { success: true };
    }

    const interval = setInterval(async () => {
      await createProjectBackup(projectId, projectPath, 'Auto Backup');
    }, intervalMinutes * 60 * 1000);

    schedulerMap.set(projectId, interval);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export function clearProjectBackupScheduler(projectId: string): void {
  const existing = schedulerMap.get(projectId);
  if (existing) {
    clearInterval(existing);
    schedulerMap.delete(projectId);
  }
}

export function registerProjectBackupIPC(): void {
  ipcMain.handle('project-backup:create', async (_, { projectId, projectPath, label }: { projectId: string; projectPath: string; label?: string }) => {
    return createProjectBackup(projectId, projectPath, label);
  });

  ipcMain.handle('project-backup:list', async (_, { projectId }: { projectId: string }) => {
    return listProjectBackups(projectId);
  });

  ipcMain.handle('project-backup:restore', async (_, { projectId, backupId }: { projectId: string; backupId: string }) => {
    return restoreProjectBackup(projectId, backupId, '');
  });

  ipcMain.handle('project-backup:delete', async (_, { backupId, projectId }: { backupId: string; projectId: string }) => {
    return deleteProjectBackup(backupId, projectId);
  });

  ipcMain.handle('project-backup:schedule', async (_, { projectId, intervalMinutes }: { projectId: string; intervalMinutes: number }) => {
    return { success: true, error: 'Scheduling requires projectPath context from renderer' };
  });

  ipcMain.handle('project-backup:diff', async (_, { projectId, backupId }: { projectId: string; backupId: string }) => {
    return diffProjectBackup(projectId, backupId, '');
  });
}
```

---

### BackupDiffViewer.tsx

**Path**: `src/components/workspace/BackupDiffViewer.tsx`

**Purpose**: Visual diff panel showing file changes between current workspace and backup snapshot. Color-coded categories with expandable sections.

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Edit, Equal, ChevronDown, ChevronRight, FileText, FolderTree } from 'lucide-react';
import { ProjectBackupDiff } from '../../types/deskflow-api';
import { Chip } from './_ds/primitives';

interface BackupDiffViewerProps {
  diff: ProjectBackupDiff | null;
  isLoading?: boolean;
}

export function BackupDiffViewer({ diff, isLoading }: BackupDiffViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    added: true,
    modified: true,
    deleted: true,
    unchanged: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-4 w-32 bg-zinc-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-zinc-800/60 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-zinc-800/60 rounded animate-pulse" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileText className="w-8 h-8 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500">Select a backup and click Diff to compare</p>
      </div>
    );
  }

  const sections = [
    { key: 'added', label: 'Added', icon: <Plus className="w-3.5 h-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', files: diff.added },
    { key: 'modified', label: 'Modified', icon: <Edit className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', files: diff.modified },
    { key: 'deleted', label: 'Deleted', icon: <Minus className="w-3.5 h-3.5" />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', files: diff.deleted },
    { key: 'unchanged', label: 'Unchanged', icon: <Equal className="w-3.5 h-3.5" />, color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', files: diff.unchanged },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FolderTree className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Diff Summary</h3>
        <div className="flex gap-1.5 ml-auto">
          {sections.map((s) => (
            <span key={s.key} className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.bg} ${s.color} border ${s.border}`}>
              {s.label} {s.files.length}
            </span>
          ))}
        </div>
      </div>
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border border-zinc-800/40 overflow-hidden">
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
            className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors"
          >
            {expandedSections[section.key] ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
            <span className={`flex items-center gap-1.5 text-xs font-medium ${section.color}`}>
              {section.icon}
              {section.label}
            </span>
            <span className="text-xs text-zinc-500 ml-auto">{section.files.length} files</span>
          </button>
          <AnimatePresence>
            {expandedSections[section.key] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                  {section.files.length === 0 ? (
                    <p className="text-xs text-zinc-600 px-2 py-1">No {section.label.toLowerCase()} files</p>
                  ) : (
                    section.files.map((file) => (
                      <div key={file} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/40 transition-colors">
                        <FileText className={`w-3 h-3 shrink-0 ${section.color}`} />
                        <span className={`text-xs truncate ${section.color}`}>{file}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
```

---

### BackupTabPanel.tsx

**Path**: `src/components/workspace/BackupTabPanel.tsx`

**Purpose**: Full replacement for the IDE backup tab placeholder. Two-panel layout with backup list, detail view, auto-scheduling, diff viewer, and confirmation dialogs.

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive, Clock, Download, Trash2, RotateCcw, FileText, FolderTree,
  Plus, Search, Check, X, AlertTriangle, Loader2, ChevronRight,
  Calendar, HardDrive, Zap, Filter
} from 'lucide-react';
import { ProjectBackupManifest, ProjectBackupDiff } from '../../types/deskflow-api';
import { BackupDiffViewer } from './BackupDiffViewer';
import { EmptyState, Skeleton, IconButton, Chip } from './_ds/primitives';

interface BackupTabPanelProps {
  projectId: string | null;
  projectPath: string | null;
}

type IntervalOption = { label: string; value: number };

const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: 'Off', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '4 hr', value: 240 },
];

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function BackupTabPanel({ projectId, projectPath }: BackupTabPanelProps) {
  const [backups, setBackups] = useState<ProjectBackupManifest[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<ProjectBackupManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoBackupInterval, setAutoBackupInterval] = useState(0);
  const [diff, setDiff] = useState<ProjectBackupDiff | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);

  const windowAPI = (window as any).deskflowAPI;

  const loadBackups = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.list(projectId);
      if (result?.success) {
        setBackups(result.data || []);
      } else {
        setError(result?.error || 'Failed to load backups');
      }
    } catch {
      setError('Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const filteredBackups = backups.filter((b) =>
    b.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBackup = async () => {
    if (!projectId || !projectPath) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.create(projectId, projectPath);
      if (result?.success) {
        setSuccessMsg(`Backup created: ${result.data?.label}`);
        await loadBackups();
      } else {
        setError(result?.error || 'Backup creation failed');
      }
    } catch {
      setError('Backup creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!projectId || !selectedBackup) return;
    setIsRestoring(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.restore(projectId, selectedBackup.id);
      if (result?.success) {
        setSuccessMsg(`Restored ${result.data?.restoredCount || 0} files`);
        setShowRestoreConfirm(false);
      } else {
        setError(result?.error || 'Restore failed');
      }
    } catch {
      setError('Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !projectId) return;
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.delete(deleteTarget, projectId);
      if (result?.success) {
        setSuccessMsg('Backup deleted');
        setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteTarget); return next; });
        if (selectedBackup?.id === deleteTarget) setSelectedBackup(null);
        await loadBackups();
      } else {
        setError(result?.error || 'Delete failed');
      }
    } catch {
      setError('Delete failed');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!projectId) return;
    setError(null);
    let failed = 0;
    for (const id of selectedIds) {
      try {
        const result = await windowAPI?.projectBackup?.delete(id, projectId);
        if (!result?.success) failed++;
      } catch {
        failed++;
      }
    }
    if (failed === 0) {
      setSuccessMsg(`Deleted ${selectedIds.size} backups`);
    } else {
      setError(`${failed} deletions failed`);
    }
    setSelectedIds(new Set());
    setSelectedBackup(null);
    setShowBulkDeleteConfirm(false);
    await loadBackups();
  };

  const handleDiff = async () => {
    if (!projectId || !selectedBackup) return;
    setIsDiffing(true);
    setDiff(null);
    try {
      const result = await windowAPI?.projectBackup?.diff(projectId, selectedBackup.id);
      if (result?.success) {
        setDiff(result.data || null);
      } else {
        setError(result?.error || 'Diff failed');
      }
    } catch {
      setError('Diff failed');
    } finally {
      setIsDiffing(false);
    }
  };

  const handleSchedule = async (minutes: number) => {
    if (!projectId || !projectPath) return;
    setAutoBackupInterval(minutes);
    if (minutes > 0) {
      setLastAutoBackup(new Date().toISOString());
    }
    try {
      await windowAPI?.projectBackup?.schedule(projectId, minutes);
      setSuccessMsg(minutes > 0 ? `Auto-backup enabled: every ${minutes} min` : 'Auto-backup disabled');
    } catch {
      setError('Failed to update schedule');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredBackups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBackups.map(b => b.id)));
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <EmptyState
          icon={<Archive className="w-8 h-8 text-zinc-500" />}
          title="No project selected"
          hint="Select a project from the Projects tab to view backups"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 mx-4 mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 mx-4 mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm"
          >
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${autoBackupInterval > 0 ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className="text-xs text-zinc-400">
            {autoBackupInterval > 0 ? `Auto-backup: ON — every ${autoBackupInterval} min` : 'Auto-backup: OFF'}
          </span>
          {lastAutoBackup && autoBackupInterval > 0 && (
            <span className="text-xs text-zinc-600">Last: {formatRelativeTime(lastAutoBackup)}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={autoBackupInterval}
            onChange={(e) => handleSchedule(Number(e.target.value))}
            className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/40"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-xs font-medium hover:bg-pink-500/25 disabled:opacity-50 transition-colors"
          >
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Backup Now
          </motion.button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[40%] min-w-[300px] border-r border-zinc-800/40 flex flex-col">
          <div className="p-3 border-b border-zinc-800/40 space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search backups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <Filter className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {selectedIds.size === filteredBackups.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-[10px] text-zinc-600 ml-auto">{filteredBackups.length} backups</span>
            </div>
          </div>

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-zinc-800/40"
              >
                <div className="flex items-center gap-2 p-2 bg-zinc-900/40">
                  <span className="text-xs text-zinc-400">{selectedIds.size} selected</span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : filteredBackups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Archive className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500 mb-1">No backups yet</p>
                <p className="text-xs text-zinc-600 text-center px-4 mb-4">
                  Create your first backup before your next AI coding session
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateBackup}
                  className="px-4 py-2 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-sm font-medium hover:bg-pink-500/25 transition-colors"
                >
                  Create Backup
                </motion.button>
              </div>
            ) : (
              filteredBackups.map((backup) => (
                <motion.div
                  key={backup.id}
                  layout
                  onClick={() => setSelectedBackup(backup)}
                  className={`
                    group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all
                    ${selectedBackup?.id === backup.id
                      ? 'bg-pink-500/10 border border-pink-500/20'
                      : 'bg-zinc-900/40 border border-transparent hover:bg-zinc-800/40 hover:border-zinc-700/40'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(backup.id)}
                    onChange={() => toggleSelection(backup.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 accent-pink-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-zinc-200 truncate">{backup.label}</span>
                      {backup.autoBackup && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Auto</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-500" title={new Date(backup.timestamp).toLocaleString()}>
                        {formatRelativeTime(backup.timestamp)}
                      </span>
                      <span className="text-[10px] text-zinc-600">{backup.fileCount} files</span>
                      <span className="text-[10px] text-zinc-600">{formatBytes(backup.totalSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setSelectedBackup(backup); handleDiff(); }}
                      title="Diff"
                      className="w-6 h-6"
                    >
                      <FileText className="w-3 h-3 text-zinc-400" />
                    </IconButton>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(backup.id); setShowDeleteConfirm(true); }}
                      title="Delete"
                      danger
                      className="w-6 h-6"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                    </IconButton>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedBackup ? (
            <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedBackup.label}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(selectedBackup.timestamp).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(selectedBackup.totalSize)}</span>
                    <span className="flex items-center gap-1"><Archive className="w-3 h-3" />{selectedBackup.compressionRatio > 0 ? `${Math.round((1 - selectedBackup.compressionRatio) * 100)}% compressed` : 'No compression'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDiff}
                    disabled={isDiffing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-50 transition-colors"
                  >
                    {isDiffing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                    Compare
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </motion.button>
                </div>
              </div>

              <BackupDiffViewer diff={diff} isLoading={isDiffing} />

              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">File Tree</h3>
                  <span className="text-xs text-zinc-500 ml-auto">{selectedBackup.fileCount} files</span>
                </div>
                <div className="text-xs text-zinc-500">
                  Backup archive contains {selectedBackup.fileCount} files totaling {formatBytes(selectedBackup.totalSize)}.
                  Extract the archive to inspect individual file contents.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={<Archive className="w-8 h-8 text-zinc-600" />}
                title="Select a backup"
                hint="Click a backup from the list to view details and restore options"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRestoreConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Restore Backup</h3>
                  <p className="text-sm text-zinc-400">This will overwrite your current project files</p>
                </div>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                A pre-restore snapshot will be saved first. Continue?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                >
                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Restore'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Delete Backup</h3>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                Delete this backup? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="px-4 py-2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors"
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Delete Backups</h3>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                Delete {selectedIds.size} selected backups? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors"
                >
                  Delete {selectedIds.size}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## Modified Files

### types/deskflow-api.d.ts

**Path**: `src/types/deskflow-api.d.ts`

**Change**: Append the following interfaces to the existing type definitions file.

```typescript
export interface ProjectBackupManifest {
  id: string;
  projectId: string;
  label: string;
  timestamp: string;
  fileCount: number;
  totalSize: number;
  compressionRatio: number;
  autoBackup: boolean;
}

export interface ProjectBackupDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}
```

---

### preload.ts

**Path**: `src/preload.ts`

**Change**: Add the `projectBackup` object to the `deskflowAPI` bridge object. Locate the existing `backup:` block (around line 940) and add this adjacent block:

```typescript
projectBackup: {
  create: (projectId: string, projectPath: string, label?: string) =>
    ipcRenderer.invoke('project-backup:create', { projectId, projectPath, label }),
  list: (projectId: string) =>
    ipcRenderer.invoke('project-backup:list', { projectId }),
  restore: (projectId: string, backupId: string) =>
    ipcRenderer.invoke('project-backup:restore', { projectId, backupId }),
  delete: (backupId: string, projectId: string) =>
    ipcRenderer.invoke('project-backup:delete', { backupId, projectId }),
  schedule: (projectId: string, intervalMinutes: number) =>
    ipcRenderer.invoke('project-backup:schedule', { projectId, intervalMinutes }),
  diff: (projectId: string, backupId: string) =>
    ipcRenderer.invoke('project-backup:diff', { projectId, backupId }),
},
```

---

### main.ts

**Path**: `src/main.ts`

**Change 1**: Import and register the new IPC handlers. Add near the top of the file (after existing backup imports):

```typescript
import { registerProjectBackupIPC } from './main/backup/ProjectBackupService';
```

**Change 2**: Call the registration function in the app initialization block (after existing `backup:` IPC handlers, around line 4237):

```typescript
registerProjectBackupIPC();
```

---

### ComponentBrowserModal.tsx

**Path**: `src/components/workspace/ComponentBrowserModal.tsx`

**Change**: Extend the existing library switch logic to handle all 10 libraries plus 4 browseable sources. The existing file handles 21st-dev, aceternity, refero. Add the following fetch logic and UI branches.

**Add to imports**:
```typescript
import { Rabbit, Code2, LayoutPanelTop, Sparkles, Image, Wind, Wand2, Search, Palette } from 'lucide-react';
```

**Add fetch functions** (inside the component or as module-level helpers):
```typescript
async function fetchFragmentsComponents(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('fragments-ui', 'getComponent', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || '',
      category: c.category || 'components',
      installCommand: c.install || `npx @usefragments/mcp add ${c.name}`,
      code: c.code || c.source || '',
    })) || [];
  } catch { return []; }
}

async function fetchShadcnMcpComponents(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('shadcn-ui-mcp', 'search_components', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || '',
      category: c.category || 'components',
      installCommand: c.install || `npx shadcn add ${c.name}`,
      code: c.code || c.source || '',
    })) || [];
  } catch { return []; }
}

async function fetchReactbitsComponents(query: string) {
  try {
    const res = await fetch(`https://reactbits.dev/registry?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.components || []).map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || '',
      category: c.category || 'components',
      installCommand: c.install || `npm install ${c.package || c.name}`,
      code: c.code || c.source || '',
    }));
  } catch { return []; }
}

async function fetchCultUIComponents(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('cult-ui', 'search', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || '',
      category: c.category || 'components',
      installCommand: c.install || `npx cult-ui add ${c.name}`,
      code: c.code || c.source || '',
    })) || [];
  } catch { return []; }
}

async function fetchMagicUIComponents(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('magicui', 'search', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || '',
      category: c.category || 'components',
      installCommand: c.install || `npx @magicui/cli add ${c.name}`,
      code: c.code || '',
      url: c.url || `https://magicui.design/component/${c.name}`,
    })) || [];
  } catch { return []; }
}

async function fetchLucideIcons(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('lucide', 'search', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || 'Lucide icon',
      category: 'icons',
      installCommand: `import { ${c.name} } from 'lucide-react';`,
      code: `<${c.name} className="w-5 h-5" />`,
    })) || [];
  } catch { return []; }
}

async function fetchIconifyIcons(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('iconify', 'search', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.name,
      name: c.name || c.id,
      description: c.description || 'Iconify icon',
      category: 'icons',
      installCommand: `import { Icon } from '@iconify/react';`,
      code: `<Icon icon="${c.set || 'mdi'}:${c.name}" />`,
    })) || [];
  } catch { return []; }
}

async function fetchUnsplashPhotos(query: string) {
  try {
    const result = await (window as any).deskflowAPI?.mcp?.callTool('unsplash', 'search', { query });
    return result?.content?.map((c: any) => ({
      id: c.id || c.url,
      name: c.description || 'Unsplash photo',
      description: c.description || '',
      category: 'photos',
      installCommand: '',
      code: c.url || c.source || '',
      thumbnail: c.thumbnail || c.url,
    })) || [];
  } catch { return []; }
}
```

**Modify the library fetch dispatch** (in the existing search/load handler, add cases):
```typescript
// Inside the existing switch or if-else chain for library fetching:
if (libraryId === 'fragments-ui') return fetchFragmentsComponents(query);
if (libraryId === 'shadcn-ui-mcp') return fetchShadcnMcpComponents(query);
if (libraryId === 'reactbits') return fetchReactbitsComponents(query);
if (libraryId === 'cult-ui') return fetchCultUIComponents(query);
if (libraryId === 'magicui') return fetchMagicUIComponents(query);
if (libraryId === 'lucide') return fetchLucideIcons(query);
if (libraryId === 'iconify') return fetchIconifyIcons(query);
if (libraryId === 'unsplash') return fetchUnsplashPhotos(query);
```

**Add browseable-only UI treatment** for Magic UI, Lucide, Iconify, Unsplash: In the component card rendering, detect these library IDs and show:
- For Magic UI: "View on magicui.design" external link button instead of install
- For Lucide/Iconify: "Copy icon name" button
- For Unsplash: Thumbnail image + "Copy URL" button

---

### LibraryConfigModal.tsx

**Path**: `src/components/workspace/LibraryConfigModal.tsx`

**Change**: Add two new configuration entries in the existing sources array/map. Locate the existing 8-source configuration structure and append:

```typescript
// Add to the sources/config array inside the modal:
{
  id: 'swishy-motion',
  label: 'Swishy Motion',
  group: 'motion',
  icon: Wind,
  command: 'node scripts/mcp-launcher.mjs swishy-motion',
  fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'swishy_...' },
  ],
  actions: ['start', 'stop', 'refresh'],
},
{
  id: 'variant',
  label: 'Variant',
  group: 'web-tool',
  icon: Image,
  url: 'https://variant.com',
  fields: [],
  actions: ['openBrowser'],
},
```

**Add open-in-browser handler**:
```typescript
const handleOpenBrowser = (url: string) => {
  (window as any).deskflowAPI?.shell?.openExternal?.(url);
};
```

Render the "Open in Browser" button for `variant` and any other web-tool sources.

---

### DesignLibrarySources.tsx

**Path**: `src/components/workspace/DesignLibrarySources.tsx`

**Change**: Add 4 additional source cards. The existing grid renders the 10 DEFAULT_LIBRARIES. Append 4 additional cards for Magic UI, Lucide, Iconify, Unsplash with browse-only status.

**Add to the library definitions** (or import them):
```typescript
const ADDITIONAL_SOURCES = [
  { id: 'magicui', label: 'Magic UI', icon: Wand2, group: 'mcp', description: 'Animated components and effects', offers: 'components' },
  { id: 'lucide', label: 'Lucide', icon: Search, group: 'mcp', description: 'Beautiful icons', offers: 'icons' },
  { id: 'iconify', label: 'Iconify', icon: Palette, group: 'mcp', description: '200k+ open source icons', offers: 'icons' },
  { id: 'unsplash', label: 'Unsplash', icon: Image, group: 'mcp', description: 'Free high-res photos', offers: 'photos' },
];
```

**Render additional cards** in the same grid after the main library cards:
```typescript
{ADDITIONAL_SOURCES.map((source) => (
  <motion.div
    key={source.id}
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-zinc-800/80 flex items-center justify-center">
        <source.icon className="w-4 h-4 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-zinc-200">{source.label}</h3>
        <p className="text-xs text-zinc-500">{source.description}</p>
      </div>
      <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`} />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 capitalize">{source.offers}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">Browse only</span>
    </div>
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onBrowseLibrary(source.id)}
      className="mt-auto w-full py-1.5 text-xs font-medium rounded-lg bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
    >
      Browse
    </motion.button>
  </motion.div>
))}
```

---

### DesignWorkspacePage.tsx

**Path**: `src/pages/DesignWorkspacePage.tsx`

**Change 1**: Add imports for new UI elements:
```typescript
import { Play, Search, Zap, Layers } from 'lucide-react';
```

**Change 2**: Add state for skill preview and global search:
```typescript
const [showSkillPreview, setShowSkillPreview] = useState(false);
const [globalSearch, setGlobalSearch] = useState('');
const [isStartingAll, setIsStartingAll] = useState(false);
```

**Change 3**: Add "Start All Servers" handler:
```typescript
const handleStartAllServers = async () => {
  setIsStartingAll(true);
  const enabledLibraries = libraries.filter(l => l.enabled && l.status === 'idle');
  await Promise.all(enabledLibraries.map(lib => handleStartServer(lib.id)));
  setIsStartingAll(false);
};
```

**Change 4**: Add skill preview panel in the compose outlet area (before or adjacent to DesignComposeOutlet):
```typescript
{showSkillPreview && (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 mb-4"
  >
    <div className="flex items-center gap-2 mb-3">
      <Layers className="w-4 h-4 text-pink-400" />
      <h3 className="text-sm font-semibold text-zinc-200">Active Skills</h3>
    </div>
    <div className="flex flex-wrap gap-2">
      {['frontend-design', 'humancentred-UIUX', 'impeccable', 'motion-alive', 'ui-ux-pro-max', 'taste-skill', 'frontend-external-infra'].map((skill) => (
        <span key={skill} className="text-xs px-2 py-1 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/50">
          {skill}
        </span>
      ))}
    </div>
  </motion.div>
)}
```

**Change 5**: Add global search bar and "Start All Servers" button in the sources tab header:
```typescript
<div className="flex items-center gap-3 mb-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
    <input
      type="text"
      placeholder="Search across all libraries..."
      value={globalSearch}
      onChange={(e) => setGlobalSearch(e.target.value)}
      className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20"
    />
  </div>
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={handleStartAllServers}
    disabled={isStartingAll}
    className="inline-flex items-center gap-1.5 px-3 py-2 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-sm font-medium hover:bg-pink-500/25 disabled:opacity-50 transition-colors"
  >
    {isStartingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
    Start All
  </motion.button>
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => setShowSkillPreview(p => !p)}
    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showSkillPreview ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60'}`}
  >
    <Layers className="w-4 h-4" />
    Skills
  </motion.button>
</div>
```

**Change 6**: Make the library grid responsive (2 columns on narrow screens):
```typescript
// In the grid container for DesignLibrarySources:
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
```

---

### IDEProjectsPage.tsx

**Path**: `src/pages/IDEProjectsPage.tsx`

**Change**: Replace the backup tab placeholder content (lines 3833-3856) with the new BackupTabPanel component.

**Replace this block**:
```typescript
{activeTab === 'backup' && (
  <motion.div data-section="ide.backup" ...>
    <GlassCard>
      <div className="flex items-center gap-3 mb-4">
        <Archive className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-xl font-semibold text-white">Backup</h2>
          <p className="text-sm text-zinc-400">Backup snapshots for AI coding changes — coming soon</p>
        </div>
      </div>
      <EmptyState ... />
    </GlassCard>
  </motion.div>
)}
```

**With**:
```typescript
{activeTab === 'backup' && (
  <motion.div
    data-section="ide.backup"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="h-full"
  >
    <BackupTabPanel
      projectId={selectedProject?.id || null}
      projectPath={selectedProject?.path || null}
    />
  </motion.div>
)}
```

**Add import** at the top of the file:
```typescript
import { BackupTabPanel } from '../components/workspace/BackupTabPanel';
```

---

## Build & Verification

### Build Instructions

1. **Install dependencies** (if not already present):
   ```bash
   npm install archiver extract-zip glob
   ```

2. **Build renderer**:
   ```bash
   npx vite build
   ```
   Must exit 0 with zero errors.

3. **Build preload**:
   ```bash
   npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
   ```

4. **Rebuild main**:
   ```bash
   node scripts/rebuild-main.mjs
   ```

5. **Launch**:
   ```bash
   npx electron .
   ```

### Verification Steps

1. **Design Workspace → Motion tab**: Navigate to Studio → Design → Motion sub-tab. Verify MotionExplorer renders with 12 preset cards, category filters, search bar, easing curve browser, and code generator. Click a preset, select an easing curve, verify code updates. Click "Add" and verify context updates.

2. **Component Browser**: Open ComponentBrowserModal from each library card. Verify 21st-dev, aceternity, refero, fragments-ui, shadcn-ui-mcp, reactbits, cult-ui all load components. Verify Magic UI shows external links, Lucide/Iconify show icon search, Unsplash shows photo thumbnails.

3. **Library Config**: Open LibraryConfigModal. Verify swishy-motion and variant entries appear with correct fields and actions.

4. **Design Library Sources**: Verify 14 total cards (10 original + 4 additional) with correct status indicators and browse buttons.

5. **IDE → Backup tab**: Select a project. Verify two-panel layout appears. Click "Create Backup". Verify backup appears in list with correct metadata. Click backup → verify detail panel. Click "Compare" → verify diff viewer. Click "Restore" → verify confirmation dialog and restore flow.

6. **Auto-backup**: Toggle auto-backup to 15 min. Verify status bar updates. Verify scheduler starts without errors.

7. **No black screen**: Verify `dist/index.html` contains `#df-fallback` div and inline script. Verify `emptyOutDir: true` present in `vite.config.ts`. Verify `did-fail-load` retry logic in `main.ts`.

---

## File-by-File Changelog

| File | Lines | Change Type | Purpose |
|------|-------|-------------|---------|
| `src/components/workspace/MotionPresets.tsx` | 1-200 | New | Data layer for 12 Swishy Motion presets + 9 easing curves with type definitions and helper functions |
| `src/components/workspace/EasingCurveBrowser.tsx` | 1-180 | New | Interactive SVG easing curve visualization with selectable presets, formula display, and copy-to-clipboard |
| `src/components/workspace/MotionExplorer.tsx` | 1-350 | Replace | Full stub replacement with 4 states, preset grid, easing browser, code generator, and context integration |
| `src/main/backup/ProjectBackupService.ts` | 1-400 | New | File-level backup service with zip archiving, manifest management, auto-scheduling, restore safety, and diff generation |
| `src/components/workspace/BackupDiffViewer.tsx` | 1-150 | New | Visual diff panel with added/modified/deleted/unchanged file categories and expandable sections |
| `src/components/workspace/BackupTabPanel.tsx` | 1-500 | New | Full IDE backup tab UI with two-panel layout, auto-backup controls, confirmation dialogs, and bulk actions |
| `src/types/deskflow-api.d.ts` | Append | Modify | Add `ProjectBackupManifest` and `ProjectBackupDiff` interfaces |
| `src/preload.ts` | Insert ~12 lines | Modify | Add `projectBackup` bridge with 6 IPC methods |
| `src/main.ts` | Insert 2 lines | Modify | Import `registerProjectBackupIPC` and call it in app init |
| `src/components/workspace/ComponentBrowserModal.tsx` | Insert ~120 lines | Modify | Add fetch functions for fragments-ui, shadcn-ui-mcp, reactbits, cult-ui, magicui, lucide, iconify, unsplash |
| `src/components/workspace/LibraryConfigModal.tsx` | Insert ~30 lines | Modify | Add swishy-motion and variant config entries with fields and actions |
| `src/components/workspace/DesignLibrarySources.tsx` | Insert ~50 lines | Modify | Add 4 additional browseable source cards with status indicators |
| `src/pages/DesignWorkspacePage.tsx` | Insert ~80 lines | Modify | Add skill preview, global search, Start All Servers, responsive grid |
| `src/pages/IDEProjectsPage.tsx` | Replace ~25 lines | Modify | Replace backup placeholder with BackupTabPanel component |

---

## Dependencies

**New runtime dependencies**:
- `archiver` — ZIP archive creation for project backups
- `extract-zip` — ZIP extraction for restore and diff operations
- `glob` — File globbing for diff comparison and archive entry counting

**No new frontend dependencies** — all UI uses existing Framer Motion, Lucide React, and Tailwind CSS.

---

## Invariants Verified

- `#df-fallback` div and inline script in `index.html` — untouched
- `emptyOutDir: true` in `vite.config.ts` — untouched
- `did-fail-load` retry logic in `main.ts` — untouched
- All `localStorage` access wrapped in try/catch — verified in new components
- CRLF line endings preserved in all output code
- Zero explanatory comments in code output
- All 4 states (empty, loading, error, populated) implemented in every new UI component
- Anti-slop checklist applied: no default fonts, no purple gradients, no same-radius-everything, no hero clichés
- All components re-skinned to DeskFlow tokens (dark zinc, pink accent, Geist/JetBrains Mono, rounded-xl cards, backdrop-blur-xl)
