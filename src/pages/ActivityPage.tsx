import { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Globe, Target, Focus as FocusIcon, Clock, ArrowLeftRight, Sparkles } from 'lucide-react';
import { LoadingState } from '../components/LoadingState';
import { ManualAssignModal } from '../components/external/ManualAssignModal';
import ManualFillModal from '../components/external/ManualFillModal';
import TrackingCoverage from '../components/external/TrackingCoverage';
import type { Period } from '../lib/dateRange';
import { MONO_STEPS, formatClock, monoStep, platformLabel } from '../lib/usageScale';

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

// No per-tab accent. Five hues in one tab strip was a LAMINAR §2 breach
// (one signal hue per surface) and it made every tab look like a different
// app. Identity now comes from the icon + label; the single signal hue is
// the surface accent, carried by the active pill.
const TABS = [
  { key: 'apps', label: 'Applications', icon: Monitor },
  { key: 'websites', label: 'Websites', icon: Globe },
  { key: 'productivity', label: 'Productivity', icon: Target },
  { key: 'focus', label: 'Focus', icon: FocusIcon },
  { key: 'external', label: 'External', icon: Clock },
] as const;

type TabKey = typeof TABS[number]['key'];

const crossfadeInitial = { opacity: 0, y: 8 };
const crossfadeAnimate = { opacity: 1, y: 0 };
const crossfadeExit = { opacity: 0, y: -8 };
const crossfadeTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };
// LAMINAR §6 bans spring overshoot on app surfaces, so the shared pill
// slide is an eased transition rather than a spring.
const pillTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

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
  const [showManualFill, setShowManualFill] = useState(false);
  const [manualAssignGap, setManualAssignGap] = useState<{ start: Date; end: Date } | null>(null);
  const [manualAssignDate, setManualAssignDate] = useState<Date | null>(null);
  const [manualVersion, setManualVersion] = useState(0);

  const activeConfig = TABS.find(t => t.key === activeTab) || TABS[0];

  // OS split. Three things were wrong with the previous version:
  //   • colour was assigned by Object.entries index BEFORE the sort, so a
  //     platform's hue depended on the order rows happened to arrive in
  //     (the newest log decided it) — the same machine could come back a
  //     different colour on a different day;
  //   • six hardcoded hues were spent on what is realistically 1–3 rows,
  //     which is how a two-row card ended up looking like a paint chart;
  //   • zero-duration platforms produced a visible 0% row.
  // Now: rank-ordered, capped at MONO_STEPS.length with the tail folded
  // into "Other", one luminance ramp, no hue per row.
  const osStats = useMemo(() => {
    const logs = (props.allLogs as any[]) || [];
    const byPlatform: Record<string, number> = {};
    for (const log of logs) {
      const key = platformLabel(log.platform || 'unknown');
      const seconds = Number(log.duration) || 0;
      if (seconds <= 0) continue;
      byPlatform[key] = (byPlatform[key] || 0) + seconds;
    }
    const ranked = Object.entries(byPlatform)
      .map(([platform, seconds]) => ({ platform, seconds }))
      .sort((a, b) => b.seconds - a.seconds);

    // Fold the tail so the ramp never exceeds the number of steps a reader
    // can actually tell apart.
    const kept = ranked.slice(0, MONO_STEPS.length);
    const tail = ranked.slice(MONO_STEPS.length);
    if (tail.length > 0) {
      kept.push({ platform: 'Other', seconds: tail.reduce((s, o) => s + o.seconds, 0) });
    }

    const total = kept.reduce((sum, o) => sum + o.seconds, 0);
    return kept.map(o => ({ ...o, pct: total > 0 ? (o.seconds / total) * 100 : 0 }));
  }, [props.allLogs]);

  const osTotalSeconds = useMemo(
    () => osStats.reduce((sum, o) => sum + o.seconds, 0),
    [osStats]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sticky chrome. Flat surface + hairline: LAMINAR §7 bans
          backdrop-blur glassmorphism on chrome, and the blur also made the
          tab strip unreadable wherever a saturated card scrolled under it. */}
      {/* Coverage summary. It used to exist only inside the transient
          "While you were away" prompt, so the one screen that answers "how much
          of my day is actually accounted for" was gone the moment that prompt
          closed — and unreachable entirely if the prompt never appeared.
          Period follows the page, so it honours the date the user is viewing. */}
      <div className="px-5 pt-2.5">
          <TrackingCoverage
            period={props.selectedPeriod === 'today' ? 'today' : props.selectedPeriod === 'week' ? 'week' : 'month'}
            dateOffset={props.dateOffset ?? 0}
            onFillNow={() => setShowManualFill(true)}
          />
      </div>

      <div className="sticky top-0 z-30 -mx-5 px-5 bg-[var(--color-background)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1 py-2">
          <div className="h-9 w-9 rounded-lg grid place-items-center mr-2 bg-[var(--page-accent-12)] border border-[var(--page-accent)]/25">
            <activeConfig.icon className="w-4.5 h-4.5 text-[var(--page-accent)]" />
          </div>
          
          <div className="flex gap-1 bg-[var(--color-muted)] light:bg-[var(--color-secondary)] p-0.5 rounded-lg" data-tutorial="activity.tabs">
            {TABS.map(tab => {
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={activeTab === tab.key ? 'page' : undefined}
                  className={`relative px-3 py-1.5 text-xs rounded-md transition-colors duration-150 min-h-[36px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background)] ${
                    activeTab === tab.key
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activity-tab-pill"
                      className="absolute inset-0 rounded-md bg-[var(--page-accent-14)] border border-[var(--page-accent)]/35"
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
              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)] ${props.onPlatformFilterChange
                ? props.platformFilter === 'all'
                  ? 'border-[var(--btn-selected-border)] bg-[var(--btn-selected-fill)] text-[var(--btn-selected-on)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-muted)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              All
            </button>
            {(props.availablePlatforms || []).map(p => (
              <button
                key={p}
                onClick={() => props.onPlatformFilterChange?.(p)}
                disabled={!props.onPlatformFilterChange}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)] ${props.onPlatformFilterChange
                  ? props.platformFilter === p
                    ? 'border-[var(--btn-selected-border)] bg-[var(--btn-selected-fill)] text-[var(--btn-selected-on)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-muted)]'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)] ${
                compareMode
                  ? 'border border-[var(--btn-selected-border)] bg-[var(--btn-selected-fill)] text-[var(--btn-selected-on)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-muted)]'
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)]"
          >
            <Clock className="h-3.5 w-3.5" />
            Manual time
          </button>

          <button
            onClick={() => setShowManualFill(true)}
            title="Describe a period and the app generates the usage from your specification"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Fill a range
          </button>
        </div>
      </div>

      {/* OS Usage Split — ONE bar for the whole machine, not N unrelated
          cards. The old version spent a six-colour array on three rows and
          read as three unrelated stats; the split only becomes legible as
          one continuous proportion. Segments step down in luminance by
          rank, so the dominant machine leads without any hue doing work. */}
      {osStats.length > 1 && props.platformFilter === 'all' && (
        <div className="px-5 pt-5">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--page-accent-10)] border border-[var(--page-accent)]/20 grid place-items-center">
                <Monitor className="w-4.5 h-4.5 text-[var(--page-accent)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">OS Usage Split</h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Share of tracked time by operating system
                </p>
              </div>
              <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {formatClock(osTotalSeconds)}
              </span>
            </div>

            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
              role="img"
              aria-label={osStats
                .map(o => `${o.platform} ${o.pct.toFixed(1)}%`)
                .join(', ')}
            >
              {osStats.map((os, i) => (
                <div
                  key={os.platform}
                  className="h-full motion-safe:transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${os.pct}%`, background: monoStep(i) }}
                  title={`${os.platform} — ${formatClock(os.seconds)} (${os.pct.toFixed(1)}%)`}
                />
              ))}
            </div>

            {/* Legend. Every segment carries a text label AND a number, so
                the split is never read by colour alone (Gate D). */}
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-2">
              {osStats.map((os, i) => (
                <li key={os.platform} className="flex items-baseline gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full flex-shrink-0 translate-y-px"
                    style={{ background: monoStep(i) }}
                  />
                  <span className="text-[var(--text-primary)] font-medium truncate">
                    {os.platform}
                  </span>
                  <span className="ml-auto shrink-0 font-mono tabular-nums text-[var(--text-muted)]">
                    {formatClock(os.seconds)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {os.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
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

      {/* Manual Range Backfill — user specifies, app generates */}
      <ManualFillModal
        open={showManualFill}
        onClose={() => setShowManualFill(false)}
        onChanged={() => setManualVersion((v) => v + 1)}
        logs={props.allLogs}
      />
    </div>
  );
}
