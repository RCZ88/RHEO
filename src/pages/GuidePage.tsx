import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import TutorialPage from './TutorialPage';
import FeatureSpecViewer from '../components/FeatureSpecViewer';
import { HelpCircle, FileText, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GuideTab = 'tutorial' | 'specs';

export default function GuidePage() {
  const location = useLocation();
  // The Feature Specs tutorial and the ⌘K palette both deep-link to a specific tab.
  // Honour it on arrival, otherwise "Guide — Feature Specs" silently opens Tutorial.
  const [activeTab, setActiveTab] = useState<GuideTab>(() => {
    const stateTab = (location.state as { guideTab?: GuideTab } | null)?.guideTab;
    if (stateTab === 'tutorial' || stateTab === 'specs') return stateTab;
    try {
      if (localStorage.getItem('guide-activeTab') === 'specs') return 'specs';
    } catch {
      // storage unavailable — fall through to the default tab
    }
    return 'tutorial';
  });

  useEffect(() => {
    const stateTab = (location.state as { guideTab?: GuideTab } | null)?.guideTab;
    if (stateTab === 'tutorial' || stateTab === 'specs') setActiveTab(stateTab);
  }, [location.state]);

  const switchTab = (tab: GuideTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('guide-activeTab', tab);
    } catch {
      // storage unavailable — the tab still switches for this session
    }
  };

  return (
    <PageShell page="guide" variant="sticky-header">
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        {/* Tab Switcher Header */}
        <div className="flex items-center gap-1 p-2 bg-zinc-900/30 border-b border-zinc-800/60 shrink-0">
          <button
            onClick={() => switchTab('tutorial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'tutorial'
                ? 'bg-zinc-800 text-white shadow-lg shadow-black/40 border border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            <HelpCircle className={`w-4 h-4 ${activeTab === 'tutorial' ? 'text-emerald-400' : ''}`} />
            Tutorial
          </button>
          <button
            onClick={() => switchTab('specs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'specs'
                ? 'bg-zinc-800 text-white shadow-lg shadow-black/40 border border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'specs' ? 'text-blue-400' : ''}`} />
            Feature Specs
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'tutorial' ? (
              <motion.div
                key="tutorial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col"
              >
                <TutorialPage noShell />
              </motion.div>
            ) : (
              <motion.div
                key="specs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col"
              >
                <FeatureSpecViewer noShell />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
