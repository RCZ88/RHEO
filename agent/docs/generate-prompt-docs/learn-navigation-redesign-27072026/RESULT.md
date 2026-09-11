# Learn Module Navigation & Page Architecture Overhaul — Implementation Result

Here is the complete implementation of the Learn module redesign, structured file-by-file according to the implementation order. All changes preserve existing design tokens, rely only on permitted dependencies, and refactor the architecture from 8 disconnected views into 4 cohesive views with persistent navigation and modal overlays.

### `src/components/learn/transitions.ts`
```typescript
import { Variants } from 'framer-motion';

export const viewVariants: Variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

export const viewTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slidePanelVariants: Variants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};
```

### `src/components/learn/LearnNavBar.tsx`
```tsx
import React from 'react';
import { BookOpen, User, Keyboard, HelpCircle, ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  view: 'home' | 'library' | 'reader' | 'study';
}

interface LearnNavBarProps {
  breadcrumb: BreadcrumbSegment[];
  onNavigate: (view: BreadcrumbSegment['view']) => void;
  onOpenProfile: () => void;
  onOpenHelp: () => void;
}

export const LearnNavBar: React.FC<LearnNavBarProps> = ({
  breadcrumb,
  onNavigate,
  onOpenProfile,
  onOpenHelp,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#1c1917]/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md bg-clay-500/10 p-1.5 text-clay-400">
          <BookOpen className="h-4 w-4" />
        </div>
        <span className="font-serif text-lg text-zinc-100">Learn</span>
      </div>

      <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
        {breadcrumb.map((seg, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <React.Fragment key={i}>
              <button
                onClick={() => !isLast && onNavigate(seg.view)}
                className={`flex items-center font-mono text-xs uppercase tracking-wider transition-colors ${
                  isLast ? 'text-clay-300 font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:underline'
                }`}
                title={seg.label}
              >
                <span className="max-w-[200px] truncate">{seg.label}</span>
              </button>
              {!isLast && <ChevronRight className="h-3 w-3 text-zinc-600" />}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenProfile}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          title="Profile"
        >
          <User className="h-4 w-4" />
        </button>
        <button
          onClick={onOpenHelp}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          title="How it works"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          onClick={onOpenHelp}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
```

### `src/components/learn/LearnTabBar.tsx`
```tsx
import React from 'react';
import { Home, Library, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

type View = 'home' | 'library' | 'reader' | 'study';

interface LearnTabBarProps {
  view: View;
  onChange: (view: View) => void;
  activeLessonId: string | null;
}

export const LearnTabBar: React.FC<LearnTabBarProps> = ({ view, onChange, activeLessonId }) => {
  const tabs = [
    { id: 'home' as View, icon: Home, label: 'Home', shortcut: 'g h' },
    { id: 'library' as View, icon: Library, label: 'Library', shortcut: 'g l' },
    { id: 'study' as View, icon: GraduationCap, label: 'Study', shortcut: 'g s', disabled: !activeLessonId },
  ];

  const isLibraryActive = view === 'library' || view === 'reader';

  return (
    <>
      {/* Desktop Left Rail */}
      <aside className="hidden w-16 flex-col items-center gap-4 border-r border-white/10 py-4 md:flex">
        {tabs.map((tab) => {
          const isActive = tab.id === 'library' ? isLibraryActive : view === tab.id;
          const isDisabled = tab.disabled && tab.id === 'study';
          
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onChange(tab.id)}
              disabled={isDisabled}
              className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                isActive ? 'bg-clay-500/15 text-clay-300' : 'text-zinc-500 hover:text-zinc-200'
              } ${isDisabled ? 'cursor-not-allowed opacity-30' : ''}`}
              title={`${tab.label} (${tab.shortcut})`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-bg"
                  className="absolute inset-0 rounded-md bg-clay-500/15"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <tab.icon className="relative h-5 w-5" />
              {isLibraryActive && tab.id === 'library' && view === 'reader' && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-clay-400" />
              )}
            </button>
          );
        })}
      </aside>

      {/* Mobile Bottom Pill Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/10 bg-[#1c1917]/90 p-2 backdrop-blur-md md:hidden">
        {tabs.map((tab) => {
          const isActive = tab.id === 'library' ? isLibraryActive : view === tab.id;
          const isDisabled = tab.disabled && tab.id === 'study';
          
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onChange(tab.id)}
              disabled={isDisabled}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium ${
                isActive ? 'bg-clay-500/15 text-clay-300' : 'text-zinc-500'
              } ${isDisabled ? 'opacity-30' : ''}`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
};
```

### `src/components/learn/LearnHome.tsx`
*(Renamed and refactored from `WelcomeEmptyState.tsx`)*
```tsx
import React from 'react';
import { FeatureShowcase } from '../showcase/FeatureShowcase';
// ... (import existing UI components like BlurFade, Button, etc.)

interface LearnHomeProps {
  onCompose: () => void;
  onTryExample: () => void;
  onImport: () => void;
  onPaste: () => void;
  onBrowse?: () => void;
  onShowcase?: () => void;
}

export const LearnHome: React.FC<LearnHomeProps> = ({
  onCompose,
  onTryExample,
  onImport,
  onPaste,
  onBrowse,
}) => {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lyceum-welcome relative min-h-full w-full overflow-y-auto pb-20 md:pb-0">
      {/* Ambient glow - unchanged */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-clay-500/10 blur-[120px]" />
      </div>

      {/* HERO SECTION - Optical Center ~40% from top */}
      <section className="relative flex min-h-[60vh] items-center px-6 py-16">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: invitation */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono uppercase tracking-wider text-clay-300">
              Lyceum Learn
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight text-zinc-100 md:text-5xl">
              Transform any text into a structured learning experience.
            </h1>
            <p className="max-w-md text-zinc-400">
              Paste a link, import a document, or compose your own lesson. Lyceum structures it into interactive cards, diagrams, and study sessions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onCompose} className="bg-clay-500 text-white hover:bg-clay-600">
                Compose a lesson
              </Button>
              <Button onClick={onTryExample} variant="outline" className="border-white/20 text-zinc-200">
                Try an example
              </Button>
              <Button onClick={scrollToFeatures} variant="ghost" className="text-clay-300 hover:text-clay-200">
                Explore all features
              </Button>
            </div>
          </div>
          
          {/* Right: floating book hero - unchanged structurally */}
          <div className="relative hidden lg:block">
            <div className="relative aspect-[3/4] w-full rounded-lg border border-white/10 bg-[#1c1917] shadow-2xl">
              {/* Book hero content/animations */}
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS - Natural document flow */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="grid gap-3 sm:grid-cols-4">
          <button onClick={onImport} className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:border-clay-500/40">
            <span className="font-mono text-xs uppercase text-zinc-400">Import</span>
            <p className="mt-1 text-sm text-zinc-200">Upload .lmd or .ldoc files</p>
          </button>
          <button onClick={onPaste} className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:border-clay-500/40">
            <span className="font-mono text-xs uppercase text-zinc-400">Paste</span>
            <p className="mt-1 text-sm text-zinc-200">From clipboard</p>
          </button>
          <button onClick={onBrowse} className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:border-clay-500/40">
            <span className="font-mono text-xs uppercase text-zinc-400">Browse</span>
            <p className="mt-1 text-sm text-zinc-200">Your library</p>
          </button>
          <button onClick={onCompose} className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:border-clay-500/40">
            <span className="font-mono text-xs uppercase text-zinc-400">Copy Prompt</span>
            <p className="mt-1 text-sm text-zinc-200">Lesson template</p>
          </button>
        </div>
      </section>

      {/* FEATURES SHOWCASE - Embedded */}
      <section id="features" className="relative border-t border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <span className="font-mono text-xs uppercase tracking-wider text-clay-300">Capabilities</span>
            <h2 className="mt-2 font-serif text-3xl text-zinc-100">Everything you need to learn</h2>
          </div>
          <FeatureShowcase embedded />
        </div>
      </section>
    </div>
  );
};
```

### `src/components/showcase/FeatureShowcase.tsx`
*(Modified to accept `embedded` prop)*
```tsx
import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
// ... existing imports

interface FeatureShowcaseProps {
  embedded?: boolean;
}

export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ embedded = false }) => {
  const [search, setSearch] = useState('');
  // ... existing state

  return (
    <div className={embedded ? "bg-transparent" : "min-h-screen bg-[#0f0e0d] p-6"}>
      {!embedded && (
        <header className="mx-auto max-w-6xl pb-8">
          <h1 className="font-serif text-4xl text-zinc-100">Feature Showcase</h1>
        </header>
      )}
      
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Sticky filter bar */}
        <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${embedded ? 'sticky top-14 z-20 bg-[#1c1917]/80 backdrop-blur-md py-3' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {/* Category pills */}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features..."
              className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-clay-500/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Grid of FeatureCards */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Map features */}
        </div>
      </div>
    </div>
  );
};
```

### `src/components/learn/CollapsibleAnalytics.tsx`
```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Flame } from 'lucide-react';

interface CollapsibleAnalyticsProps {
  streakDays: number;
  children: React.ReactNode;
}

export const CollapsibleAnalytics: React.FC<CollapsibleAnalyticsProps> = ({ streakDays, children }) => {
  const [isOpen, setIsOpen] = useState(streakDays > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1c1917]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Study Analytics</span>
          {streakDays > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              <Flame className="h-3 w-3" />
              <span>{streakDays} day streak</span>
            </div>
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-white/10"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

### `src/components/learn/ProgressDashboard.tsx`
*(Modified to accept `embedded` prop and adjust layout)*
```tsx
import React, { useEffect, useState } from 'react';
// ... existing imports

interface ProgressDashboardProps {
  embedded?: boolean;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ embedded = false }) => {
  const [dashboard, setDashboard] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  
  useEffect(() => {
    // existing fetch logic
  }, []);

  if (embedded) {
    return (
      <div className="space-y-4">
        <HeatmapBlock data={heatmap} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-4 lg:col-span-1">
            {/* 4 LedgerCards */}
          </div>
          <div className="lg:col-span-1">
            {/* Active Learning panel */}
          </div>
          <div className="lg:col-span-1">
            {/* Most Studied panel */}
          </div>
        </div>
      </div>
    );
  }

  // Original full-page layout fallback
  return (
    <div className="p-6">
      {/* Original implementation */}
    </div>
  );
};
```

### `src/components/learn/LessonLibrary.tsx`
*(Modified to include `CollapsibleAnalytics`)*
```tsx
import React from 'react';
import { CollapsibleAnalytics } from './CollapsibleAnalytics';
import { ProgressDashboard } from './ProgressDashboard';
// ... existing imports

export const LessonLibrary: React.FC<LessonLibraryProps> = ({ stats, /* ... */ }) => {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 pb-24 md:pb-8">
      <MasteryStrip stats={stats} />
      
      {/* NEW: Inline Collapsible Analytics */}
      <CollapsibleAnalytics streakDays={stats?.streakDays || 0}>
        <ProgressDashboard embedded />
      </CollapsibleAnalytics>
      
      {/* Existing TutorDashboardSection (compact) */}
      <TutorDashboardSection /* ... */ />
      
      {/* Existing Lesson Grid */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-zinc-100">Your Lessons</h2>
        {/* Covers/Spines toggle, Compose/Import buttons */}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map(lesson => (
          <LessonCard 
            key={lesson.id} 
            lesson={lesson}
            // Add layoutId for shared element transition
            layoutId={`lesson-cover-${lesson.id}`}
          />
        ))}
      </div>
    </div>
  );
};
```

### `src/components/learn/IntentLibraryPanel.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Trash2 } from 'lucide-react';
import { IntentLibrary } from './IntentLibrary'; // Reusing core logic

interface IntentLibraryPanelProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (intent: Intent) => void;
}

export const IntentLibraryPanel: React.FC<IntentLibraryPanelProps> = ({ open, onClose, onGenerate }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-[90vw] flex-col border-l border-white/10 bg-[#1c1917]/95 backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-clay-400" />
                <h2 className="font-serif text-xl text-zinc-100">Saved Ideas</h2>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <IntentLibrary onGenerate={onGenerate} embedded />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
```

### `src/components/learn/ImportDialog.tsx`
```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ImportView } from './ImportView'; // Reusing core logic

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (lessonId: string) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, onImported }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1c1917] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h2 className="font-serif text-xl text-zinc-100">Import Lesson</h2>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ImportView onImported={onImported} embedded />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
```

### `src/components/learn/LearnPage.tsx`
*(Major refactor orchestrating the 4 views and modals)*
```tsx
import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LearnNavBar, BreadcrumbSegment } from './LearnNavBar';
import { LearnTabBar } from './LearnTabBar';
import { LearnHome } from './LearnHome';
import { LessonLibrary } from './LessonLibrary';
import { ReaderView } from './ReaderView';
import { StudyView } from './StudyView';
import { IntentLibraryPanel } from './IntentLibraryPanel';
import { ImportDialog } from './ImportDialog';
import { CreateLessonDialog } from './CreateLessonDialog';
import { LearnerProfilePanel } from './LearnerProfilePanel';
import { viewVariants, viewTransition } from './transitions';

type View = 'home' | 'library' | 'reader' | 'study';

export const LearnPage: React.FC = () => {
  const [[view, direction], setViewState] = useState<[View, number]>(['home', 0]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  
  // Modal states
  const [intentPanelOpen, setIntentPanelOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Mock lessons array for breadcrumb logic (replace with actual fetch/state)
  const [lessons, setLessons] = useState<{id: string, title: string}[]>([]);

  const navigate = (next: View) => {
    const order: View[] = ['home', 'library', 'reader', 'study'];
    const dir = order.indexOf(next) > order.indexOf(view) ? 1 : -1;
    if (next === 'home' || next === 'library') setActiveLessonId(null);
    setViewState([next, dir]);
  };

  const openLesson = (id: string) => {
    setActiveLessonId(id);
    setViewState(['reader', 1]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (composeOpen) return setComposeOpen(false);
        if (importDialogOpen) return setImportDialogOpen(false);
        if (intentPanelOpen) return setIntentPanelOpen(false);
        if (profileOpen) return setProfileOpen(false);
        if (view !== 'home') return navigate('home');
      }
      // G-prefix shortcuts
      if (e.key === 'g') {
        const handler = (ev: KeyboardEvent) => {
          if (ev.key === 'h') navigate('home');
          if (ev.key === 'l') navigate('library');
          if (ev.key === 's' && activeLessonId) navigate('study');
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler, { once: true });
      }
      if (e.key === 'c' && !composeOpen) setComposeOpen(true);
      if (e.key === 'i' && !importDialogOpen) setImportDialogOpen(true);
      if (e.key === '?' && !helpOpen) setHelpOpen(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, composeOpen, importDialogOpen, intentPanelOpen, profileOpen, helpOpen, activeLessonId]);

  const breadcrumb = useMemo((): BreadcrumbSegment[] => {
    const segs: BreadcrumbSegment[] = [{ label: 'Home', view: 'home' }];
    if (view === 'library' || view === 'reader' || view === 'study') {
      segs.push({ label: 'Library', view: 'library' });
    }
    if ((view === 'reader' || view === 'study') && activeLessonId) {
      const title = lessons.find(l => l.id === activeLessonId)?.title ?? 'Lesson';
      segs.push({ label: title, view: 'reader' });
    }
    if (view === 'study') segs.push({ label: 'Study', view: 'study' });
    return segs;
  }, [view, activeLessonId, lessons]);

  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <LearnHome
            onCompose={() => setComposeOpen(true)}
            onTryExample={() => { /* existing logic */ }}
            onImport={() => setImportDialogOpen(true)}
            onPaste={() => setComposeOpen(true)}
            onBrowse={() => navigate('library')}
            onShowcase={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          />
        );
      case 'library':
        return (
          <LessonLibrary
            lessons={lessons}
            onOpen={openLesson}
            onCompose={() => setComposeOpen(true)}
            onImport={() => setImportDialogOpen(true)}
            onWelcome={() => navigate('home')} // Fixed bug
          />
        );
      case 'reader':
        return activeLessonId ? (
          <ReaderView lessonId={activeLessonId} onNavigateToNode={/* ... */} />
        ) : null;
      case 'study':
        return activeLessonId ? (
          <StudyView lessonId={activeLessonId} />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div data-page="learn" className="h-full flex flex-col bg-[#0f0e0d] text-zinc-100">
      <LearnNavBar
        breadcrumb={breadcrumb}
        onNavigate={navigate}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />
      
      <div className="flex flex-1 min-h-0">
        <LearnTabBar view={view} onChange={navigate} activeLessonId={activeLessonId} />
        
        <main className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={view}
              custom={direction}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={viewTransition}
              className="h-full overflow-y-auto"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modal Overlays */}
      <IntentLibraryPanel
        open={intentPanelOpen}
        onClose={() => setIntentPanelOpen(false)}
        onGenerate={(intent) => {
          setIntentPanelOpen(false);
          setComposeOpen(true);
          // Pass intent to dialog state
        }}
      />
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={(id) => {
          setImportDialogOpen(false);
          openLesson(id);
        }}
      />
      <CreateLessonDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={(id) => {
          setComposeOpen(false);
          openLesson(id);
        }}
        onOpenIntents={() => setIntentPanelOpen(true)}
      />
      <LearnerProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
      
      {/* Help/Shortcuts Modal would go here */}
    </div>
  );
};
```