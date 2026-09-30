import { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Globe, Target, Activity, Focus as FocusIcon, Clock, ArrowLeftRight } from 'lucide-react';
import { LoadingState } from '../components/LoadingState';
import { ManualAssignModal } from '../components/external/ManualAssignModal';
import type { Period } from '../lib/dateRange';

const StatsPage = lazy(() => import('./StatsPage'));
const BrowserActivityPage = lazy(() => import('./BrowserActivityPage'));
const ProductivityPage = lazy(() => import('./ProductivityPage'));
const FocusTab = lazy(() => import('../features/focus/FocusSection').then(m => ({ default: m.FocusSection })));
const ExternalPage = lazy(() => import('./ExternalPage'));

interface ActivityPageProps {
  appStats: any[];
  logs: unknown[];
  allLogs?: unknown[];
  browserLogs?: unknown[];
  dailyStats?: unknown[];
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  timeMode?: 'focus' | 'total';
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
  liveActivityLogs?: Array<{ id: string; timestamp: number; type: 'app' | 'browser' | 'ide'; name: string; category?: string; title?: string; url?: string }>;
  domainKeywordRules?: any[];
  externalActivities?: any[];
  externalActivityTiers?: any[];
  platformFilter?: string;
  availablePlatforms?: string[];
  onPlatformFilterChange?: (platform: string) => void;
}

const TABS = [
  { key: 'apps', label: 'Applications', icon: Monitor, accent: '#6366f1' },
  { key: 'websites', label: 'Websites', icon: Globe, accent: '#3b82f6' },
  { key: 'productivity', label: 'Productivity', icon: Target, accent: '#10b981' },
  { key: 'focus', label: 'Focus', icon: FocusIcon, accent: '#ec4899' },
  { key: 'external', label: 'External', icon: Clock, accent: '#a855f7' },
] as const;

type TabKey = typeof TABS[number]['key'];

const crossfadeInitial = { opacity: 0, y: 8 };
const crossfadeAnimate = { opacity: 1, y: 0 };
const crossfadeExit = { opacity: 0, y: -8 };
const crossfadeTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };
const pillTransition = { type: 'spring' as const, stiffness: 400, damping: 32 };

export default function ActivityPage(props: ActivityPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const valid = ['websites', 'productivity', 'focus', 'external'] as TabKey[]
    // 1) ?tab= in the URL (the page's own effect writes it back on mount)
    try {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (tab && valid.includes(tab as TabKey)) return tab as TabKey
    } catch {}
    // 2) the deepNav hint key navigateTo() writes: '/activity-activeTab'.
    //    The dashboard widget jump buttons rely on this — without it every
    //    widget deep-linked to /activity landed on the default 'apps' tab.
    try {
      const hint = localStorage.getItem('/activity-activeTab')
      if (hint && valid.includes(hint as TabKey)) {
        localStorage.removeItem('/activity-activeTab')
        return hint as TabKey
      }
    } catch {}
    return 'apps';
  });

  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeTab]);

  const [showManualAssign, setShowManualAssign] = useState(false);
  const [manualAssignGap, setManualAssignGap] = useState<{ start: Date; end: Date } | null>(null);
  const [manualAssignDate, setManualAssignDate] = useState<Date | null>(null);
  const [manualVersion, setManualVersion] = useState(0);

  const activeConfig = TABS.find(t => t.key === activeTab) || TABS[0];
  const activeIconWrapStyle = { background: `${activeConfig.accent}22` };
  const activeIconStyle = { color: activeConfig.accent };

  // Compute OS split stats for the summary card
  const osStats = useMemo(() => {
    const logs = (props.allLogs as any[]) || [];
    if (logs.length === 0) return [];
    const byPlatform: Record<string, number> = {};
    let total = 0;
    for (const log of logs) {
      const p = log.platform || 'unknown';
      byPlatform[p] = (byPlatform[p] || 0) + (log.duration || 0);
      total += log.duration || 0;
    }
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
    return Object.entries(byPlatform)
      .map(([platform, seconds], i) => ({
        platform,
        seconds,
        pct: total > 0 ? (seconds / total) * 100 : 0,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [props.allLogs]);

  const platformLabel = (p: string) => {
    if (p === 'win32') return 'Windows';
    if (p === 'darwin') return 'macOS';
    if (p === 'linux') return 'Linux';
    return p;
  };

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation Bar */}
      <div className="sticky top-0 z-30 -mx-5 px-5 bg-zinc-900 light:bg-white/20 backdrop-blur-md border-b border-zinc-800 light:border-zinc-200/50">
        <div className="flex items-center gap-1 py-2">
          <div className="h-9 w-9 rounded-xl grid place-items-center mr-2" style={activeIconWrapStyle}>
            <Activity className="w-5 h-5" style={activeIconStyle} />
          </div>
          
          <div className="flex gap-1 bg-zinc-800 light:bg-zinc-100/50 p-0.5 rounded-lg" data-tutorial="activity.tabs">
            {TABS.map(tab => {
              const pillStyle = { background: `${tab.accent}22`, border: `1px solid ${tab.accent}40` };
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    activeTab === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activity-tab-pill"
                      className="absolute inset-0 rounded-md"
                      style={pillStyle}
                      transition={pillTransition}
                    />
                  )}
                  <tab.icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10 font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* OS Filter Bar */}
          {((props.availablePlatforms || []).length > 0) && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">OS</span>
              <button
                onClick={() => props.onPlatformFilterChange?.('all')}
                disabled={!props.onPlatformFilterChange}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${props.onPlatformFilterChange
                  ? props.platformFilter === 'all'
                    ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                All
              </button>
              {(props.availablePlatforms || []).map(p => (
                <button
                  key={p}
                  onClick={() => props.onPlatformFilterChange?. (p)}
                  disabled={!props.onPlatformFilterChange}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${props.onPlatformFilterChange
                    ? props.platformFilter === p
                      ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {platformLabel(p)}
                </button>
              ))}
            </div>
          )}

          {/* Compare Mode Toggle */}
          {((props.availablePlatforms || []).length > 1) && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                compareMode
                  ? 'border border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare
            </button>
          )}

          <button
            onClick={() => {
              setManualAssignGap(null);
              setManualAssignDate(null);
              setShowManualAssign(true);
            }}
            title="Assign manual time into empty spans (random or custom)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-violet-400 hover:text-violet-300 transition"
          >
            <Clock className="h-3.5 w-3.5" />
            Manual time
          </button>
        </div>
      </div>

      {/* OS Split Summary Card */}
      {osStats.length > 1 && props.platformFilter === 'all' && (
        <div className="p-5 pb-0">
          <div className="rounded-xl border border-zinc-800/50 bg-[var(--color-card)] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-[var(--page-accent)]/15 grid place-items-center">
                <Activity className="w-4.5 h-4.5 text-[var(--page-accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">OS Usage Split</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">Time distribution across operating systems</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {osStats.map(os => (
                <div key={os.platform} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/30">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: os.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{platformLabel(os.platform)}</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">{os.pct.toFixed(1)}%</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">{formatHours(os.seconds)}</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${os.pct}%`, backgroundColor: os.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto relative">
        <div className="relative z-10">
          <Suspense fallback={<LoadingState variant="spinner" className="py-24" />}>
            <AnimatePresence mode="wait">
              {activeTab === 'apps' && (
                <motion.div
                  key="apps"
                  initial={crossfadeInitial}
                  animate={crossfadeAnimate}
                  exit={crossfadeExit}
                  transition={crossfadeTransition}
                  className="p-5"
                  data-section="activity.apps"
                >
                  <StatsPage
                    embedded
                    appStats={props.appStats}
                    logs={props.logs}
                    allLogs={props.allLogs}
                    selectedPeriod={props.selectedPeriod}
                    dateOffset={props.dateOffset}
                    onDateOffsetChange={props.onDateOffsetChange}
                    timeMode={props.timeMode}
                    tierAssignments={props.tierAssignments}
                    liveActivityLogs={props.liveActivityLogs}
                    platformFilter={props.platformFilter}
                    compareMode={compareMode}
                    availablePlatforms={props.availablePlatforms}
                  />
                </motion.div>
              )}
              {activeTab === 'websites' && (
                <motion.div
                  key="websites"
                  initial={crossfadeInitial}
                  animate={crossfadeAnimate}
                  exit={crossfadeExit}
                  transition={crossfadeTransition}
                  className="p-5"
                  data-section="activity.websites"
                >
                  <BrowserActivityPage
                    embedded
                    selectedPeriod={props.selectedPeriod}
                    dateOffset={props.dateOffset}
                    onDateOffsetChange={props.onDateOffsetChange}
                    timeMode={props.timeMode}
                    tierAssignments={props.tierAssignments}
                    allLogs={props.allLogs}
                    platformFilter={props.platformFilter}
                    compareMode={compareMode}
                    availablePlatforms={props.availablePlatforms}
                  />
                </motion.div>
              )}
              {activeTab === 'productivity' && (
                <motion.div
                  key="productivity"
                  initial={crossfadeInitial}
                  animate={crossfadeAnimate}
                  exit={crossfadeExit}
                  transition={crossfadeTransition}
                  className="p-5"
                  data-section="activity.productivity"
                >
                  <ProductivityPage
                    embedded
                    logs={props.allLogs}
                    browserLogs={props.browserLogs}
                    appStats={props.appStats}
                    selectedPeriod={props.selectedPeriod}
                    dateOffset={props.dateOffset}
                    onDateOffsetChange={props.onDateOffsetChange}
                    tierAssignments={props.tierAssignments}
                    domainKeywordRules={props.domainKeywordRules}
                    timeMode={props.timeMode}
                    externalActivities={props.externalActivities}
                    externalActivityTiers={props.externalActivityTiers}
                    platformFilter={props.platformFilter}
                    compareMode={compareMode}
                    availablePlatforms={props.availablePlatforms}
                  />
                </motion.div>
              )}
              {activeTab === 'focus' && (
                <motion.div
                  key="focus"
                  initial={crossfadeInitial}
                  animate={crossfadeAnimate}
                  exit={crossfadeExit}
                  transition={crossfadeTransition}
                  className="p-5"
                  data-section="activity.focus"
                >
                  <FocusTab />
                </motion.div>
              )}
              {activeTab === 'external' && (
                <motion.div
                  key="external"
                  initial={crossfadeInitial}
                  animate={crossfadeAnimate}
                  exit={crossfadeExit}
                  transition={crossfadeTransition}
                  className="p-5"
                  data-section="activity.external"
                >
                  <ExternalPage
                    selectedPeriod={props.selectedPeriod}
                    dateOffset={props.dateOffset}
                    onDateOffsetChange={props.onDateOffsetChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </div>
      </div>

      {/* Manual Time Assignment */}
      <ManualAssignModal
        open={showManualAssign}
        initialDate={manualAssignDate ?? undefined}
        initialGap={manualAssignGap}
        onClose={() => {
          setShowManualAssign(false);
          setManualAssignGap(null);
        }}
        onChanged={() => setManualVersion((v) => v + 1)}
      />
    </div>
  );
}
