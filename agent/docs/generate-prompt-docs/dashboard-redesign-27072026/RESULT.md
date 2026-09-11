 Here are the complete replacement files for the dashboard redesign.

---

### 1. `src/pages/dashboard/StatusBand.tsx`

```tsx
import { motion } from 'framer-motion';
import { AuroraText } from '../../components/ui/aurora-text';

function formatTime(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDurationShort(ms: number): string {
  if (!ms || !isFinite(ms)) return '0h 0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

interface StatusBandProps {
  displayTimeMs: number;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  currentAppName: string;
  totalFocusedMs: number;
}

export function StatusBand({
  displayTimeMs,
  isCurrentlyProductive,
  isDistracting,
  currentAppName,
  totalFocusedMs,
}: StatusBandProps) {
  const isActive = isCurrentlyProductive || isDistracting;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-xl overflow-hidden mb-4
        bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
        border border-[rgba(63,63,70,0.50)]
        hover:border-[rgba(82,82,91,0.80)]
        transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-20
        bg-pink-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="absolute top-0 left-4 right-4 h-px
        bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />

      <div className="relative p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* LEFT: Mini Timer */}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            isCurrentlyProductive ? 'bg-emerald-400' :
            isDistracting ? 'bg-rose-400' :
            'bg-zinc-500'
          } ${isActive ? 'animate-pulse' : ''}`} />
          <div className="flex items-baseline gap-2">
            <AuroraText
              colors={
                isDistracting
                  ? ['#ef4444', '#f87171', '#dc2626', '#ef4444']
                  : isCurrentlyProductive
                    ? ['#10b981', '#34d399', '#059669', '#10b981']
                    : ['#3b82f6', '#60a5fa', '#2563eb', '#3b82f6']
              }
              speed={0.5}
            >
              <span className="text-2xl font-mono font-semibold tracking-tight">
                {formatTime(displayTimeMs)}
              </span>
            </AuroraText>
            {currentAppName && (
              <span className="text-[11px] text-zinc-500 hidden sm:inline truncate max-w-[120px]">
                {currentAppName}
              </span>
            )}
          </div>
        </div>

        {/* CENTER: Total Focused Today */}
        <div className="text-[13px] text-zinc-400">
          <span className="font-mono text-zinc-300">{formatDurationShort(totalFocusedMs)}</span>
          <span className="ml-1">focused today</span>
        </div>

        {/* RIGHT: Current Date */}
        <div className="text-[11px] text-zinc-500 font-mono">
          {dateStr}
        </div>
      </div>
    </motion.div>
  );
}
```

---

### 2. `src/pages/dashboard/TierBreakdownStrip.tsx`

```tsx
import { motion } from 'framer-motion';
import { CheckCircle2, MinusCircle, XCircle, Clock } from 'lucide-react';

interface TierStat {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  showBar?: boolean;
}

interface TierBreakdownStripProps {
  productiveHours: number;
  neutralHours: number;
  distractingHours: number;
  totalHours: number;
}

export function TierBreakdownStrip({
  productiveHours,
  neutralHours,
  distractingHours,
  totalHours,
}: TierBreakdownStripProps) {
  const stats: TierStat[] = [
    { label: 'Productive', value: productiveHours, color: '#34d399', icon: <CheckCircle2 size={14} />, showBar: true },
    { label: 'Neutral', value: neutralHours, color: '#fbbf24', icon: <MinusCircle size={14} />, showBar: true },
    { label: 'Distracting', value: distractingHours, color: '#f87171', icon: <XCircle size={14} />, showBar: true },
    { label: 'Total', value: totalHours, color: '#a1a1aa', icon: <Clock size={14} />, showBar: false },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-xl p-3
            bg-[rgba(24,24,27,0.60)] backdrop-blur-xl
            border border-zinc-800/40
            hover:border-[rgba(255,255,255,0.08)]
            hover:-translate-y-0.5 transition-all duration-250">
          <div className="absolute top-0 left-3 right-3 h-px opacity-40 pointer-events-none"
            style={{ background: `linear-gradient(to right, transparent, ${stat.color}, transparent)` }} />
          <div className="flex items-center gap-1.5 mb-2">
            <span style={{ color: stat.color }}>{stat.icon}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              {stat.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-mono font-bold text-white">
              {stat.value.toFixed(1)}
            </span>
            <span className="text-[11px] text-zinc-600">h</span>
          </div>
          {stat.showBar && (
            <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: stat.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(stat.value / Math.max(totalHours, 1)) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
```

---

### 3. `src/components/dashboard/SleepBarMini.tsx`

```tsx
import { motion } from 'framer-motion';
import { Moon } from 'lucide-react';
import { SectionHeader } from '../SectionHeader';

interface SleepDay {
  label: string;
  hours: number;
}

interface SleepBarMiniProps {
  sleepData?: SleepDay[];
  avgSleep?: number;
  sleepDebt?: number;
  avgBedtime?: string;
  avgWakeTime?: string;
}

export function SleepBarMini({ sleepData = [], avgSleep = 0, sleepDebt = 0, avgBedtime, avgWakeTime }: SleepBarMiniProps) {
  const hasData = sleepData.length > 0;

  return (
    <div className="relative rounded-xl overflow-hidden
      bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
      border border-[rgba(63,63,70,0.50)] p-5
      hover:border-[rgba(82,82,91,0.80)] transition-all duration-250 h-full">

      <div className="absolute top-0 left-4 right-4 h-px
        bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-60 pointer-events-none" />

      <SectionHeader title="Sleep" icon={<Moon size={14} />} />

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 mt-2">
          <Moon className="w-6 h-6 text-zinc-600" />
          <div className="text-[13px] text-zinc-400">No sleep data yet</div>
          <div className="text-[11px] text-zinc-600">Connect tracker or log manually</div>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-20 mt-3">
            {sleepData.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.hours / 10) * 100}%` }}
                  transition={{ delay: 0.48 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-full rounded-t-sm min-h-[4px] ${
                    day.hours >= 7 ? 'bg-indigo-400/70' : 'bg-indigo-400/30'
                  }`}
                />
                <span className="text-[10px] text-zinc-600 font-medium">{day.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">
              Avg: <span className="text-zinc-300 font-mono">{avgSleep.toFixed(1)}h</span>
            </span>
            {sleepDebt > 0 && (
              <span className="text-rose-400 font-medium">-{sleepDebt.toFixed(1)}h debt</span>
            )}
          </div>

          {(avgBedtime || avgWakeTime) && (
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {avgBedtime && (
                <span className="text-zinc-500">
                  Bedtime: <span className="text-zinc-300 font-mono">{avgBedtime}</span>
                </span>
              )}
              {avgWakeTime && (
                <span className="text-zinc-500">
                  Wake: <span className="text-zinc-300 font-mono">{avgWakeTime}</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

---

### 4. `src/pages/dashboard/PinnedActivities.tsx`

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, Check, Edit3, Plus, Minus, Play, X,
  BookOpen, Dumbbell, Activity, Moon, Utensils, Coffee, Bus, Book, Timer, Sun
} from 'lucide-react';
import { BorderBeam } from '../../components/ui/border-beam';

interface ExternalActivity {
  id: number;
  name: string;
  type: 'stopwatch' | 'sleep' | 'checkin';
  color: string;
  icon: string;
  is_productive: boolean;
}

const ACTIVITY_ICONS: Record<string, any> = {
  BookOpen, Dumbbell, Activity, Moon, Utensils, Coffee, Bus, Book, Sun, Timer
};

interface PinnedActivitiesProps {
  pinnedActivities: ExternalActivity[];
  setPinnedActivities: React.Dispatch<React.SetStateAction<ExternalActivity[]>>;
  activities: ExternalActivity[];
  selectedExternalActivity: ExternalActivity | null;
  setSelectedExternalActivity: React.Dispatch<React.SetStateAction<ExternalActivity | null>>;
  handleSelectExternalActivity: (activity: ExternalActivity) => void;
  externalSessionRunning: boolean;
  formatDuration: (ms: number) => string;
  externalElapsedMs: number;
  handleStartExternalSession: () => void;
  handleStopExternalSession: () => void;
  collapsible?: boolean;
}

export function PinnedActivities({
  pinnedActivities,
  setPinnedActivities,
  activities,
  selectedExternalActivity,
  setSelectedExternalActivity,
  handleSelectExternalActivity,
  externalSessionRunning,
  formatDuration,
  externalElapsedMs,
  handleStartExternalSession,
  handleStopExternalSession,
  collapsible = false,
}: PinnedActivitiesProps) {
  const [pinnedActivitiesExpanded, setPinnedActivitiesExpanded] = useState(true);
  const [pinnedActivitiesEditMode, setPinnedActivitiesEditMode] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [addPinnedPicker, setAddPinnedPicker] = useState<ExternalActivity[]>([]);
  const [selectedAddActivities, setSelectedAddActivities] = useState<Set<number>>(new Set());

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => collapsible ? setPinnedActivitiesExpanded(!pinnedActivitiesExpanded) : null}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {collapsible && <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${pinnedActivitiesExpanded ? 'rotate-90' : ''}`} />}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Pinned Activities</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Quick manual tracking</p>
          </div>
        </button>
        <button
          onClick={() => setPinnedActivitiesEditMode(!pinnedActivitiesEditMode)}
          className={`p-2 rounded-lg border transition-colors duration-150 ${
            pinnedActivitiesEditMode
              ? 'bg-emerald-500/20 border-emerald-500/50'
              : 'bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/30'
          }`}
        >
          {pinnedActivitiesEditMode ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Edit3 className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>

      {pinnedActivitiesExpanded && (
        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
          {pinnedActivities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.icon] || Timer;
            const isSelected = selectedExternalActivity?.id === activity.id;
            
            return (
              <motion.div key={activity.id} className="relative shrink-0">
                {isSelected && (
                  <BorderBeam
                    size={50}
                    duration={6}
                    colorFrom="#10b981"
                    colorTo="#34d399"
                    borderWidth={1.5}
                  />
                )}
                <motion.button
                  onClick={() => {
                    if (pinnedActivitiesEditMode) {
                      setPinnedActivities(prev => prev.filter(a => a.id !== activity.id));
                    } else if (isSelected) {
                      setSelectedExternalActivity(null);
                    } else {
                      handleSelectExternalActivity(activity);
                    }
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative rounded-xl border transition-all duration-200 text-center overflow-hidden shrink-0 ${
                    isSelected
                      ? 'border-emerald-500/50'
                      : 'bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/40 hover:bg-zinc-500/15'
                  }`}
                  style={{
                    minWidth: isSelected && externalSessionRunning ? '120px' : '100px',
                    padding: isSelected && externalSessionRunning ? '10px 12px 8px' : '12px 16px',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,95,70,0.10))'
                      : undefined,
                    boxShadow: isSelected
                      ? '0 0 24px rgba(16,185,129,0.12), inset 0 1px 0 rgba(16,185,129,0.20)'
                      : undefined,
                  }}
                >
                  {isSelected && externalSessionRunning && (
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Tracking</span>
                    </div>
                  )}
                  <Icon
                    className={`w-5 h-5 mx-auto mb-1 transition-colors duration-200 ${
                      isSelected
                        ? 'text-emerald-400'
                        : activity.is_productive ? 'text-emerald-500' : 'text-indigo-500'
                    }`}
                  />
                  <div className="text-[11px] font-semibold transition-colors duration-200 text-white whitespace-nowrap">
                    {activity.name}
                  </div>
                  {isSelected && externalSessionRunning && (
                    <div className="text-base font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                      {formatDuration(externalElapsedMs)}
                    </div>
                  )}
                  {isSelected && !externalSessionRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartExternalSession();
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all duration-150 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Start
                    </button>
                  )}
                </motion.button>
                {isSelected && externalSessionRunning && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStopExternalSession();
                    }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-semibold uppercase tracking-wider shadow-lg shadow-red-500/20 hover:bg-red-500 transition-colors duration-150 whitespace-nowrap"
                  >
                    Stop
                  </motion.button>
                )}
                {pinnedActivitiesEditMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedActivities(prev => prev.filter(a => a.id !== activity.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center z-10"
                  >
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                )}
              </motion.div>
            );
          })}
          
          {pinnedActivitiesEditMode && pinnedActivities.length < 6 && (
            <motion.button
              onClick={() => {
                const available = activities.filter(a => !pinnedActivities.find(p => p.id === a.id));
                if (available.length === 0) return;
                if (available.length === 1) {
                  setPinnedActivities(prev => [...prev, available[0]]);
                } else {
                  setAddPinnedPicker(available);
                  setSelectedAddActivities(new Set());
                  setShowAddActivityModal(true);
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 w-[100px] p-3 rounded-xl border border-dashed transition-colors duration-150 text-center flex flex-col items-center justify-center"
              style={{
                backgroundColor: 'rgba(107, 114, 128, 0.05)',
                borderColor: 'rgba(107, 114, 128, 0.3)'
              }}
            >
              <Plus className="w-5 h-5 mb-1 text-zinc-500" />
              <div className="text-[11px] font-semibold text-zinc-500">Add</div>
            </motion.button>
          )}
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddActivityModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border border-zinc-700/50 p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-300">Add Pinned Activity</h3>
              <button onClick={() => setShowAddActivityModal(false)} className="p-1 rounded-lg hover:bg-zinc-800/50">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {addPinnedPicker.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.icon] || Timer;
                const isSelected = selectedAddActivities.has(activity.id);
                return (
                  <button
                    key={activity.id}
                    onClick={() => {
                      setSelectedAddActivities(prev => {
                        const next = new Set(prev);
                        if (next.has(activity.id)) next.delete(activity.id);
                        else next.add(activity.id);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activity.is_productive ? 'text-emerald-400' : 'text-indigo-400'}`} />
                    <span className="text-xs text-zinc-300">{activity.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowAddActivityModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selected = addPinnedPicker.filter(a => selectedAddActivities.has(a.id));
                  setPinnedActivities(prev => [...prev, ...selected]);
                  setShowAddActivityModal(false);
                }}
                disabled={selectedAddActivities.size === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Add ({selectedAddActivities.size})
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
```

---

### 5. `src/pages/DashboardPage.tsx` — State + Render Section

**Add this state near your other `useState` declarations (around line 120):**

```tsx
const [totalFocusedMs, setTotalFocusedMs] = useState(0);
```

**Add this computation inside your data fetch callback (around line 580, inside the `if (data?.overview)` block):**

```tsx
          setTotalFocusedMs((data.overview.productiveSeconds || 0) * 1000);
```

**Replace the entire render section (lines ~2390–2595) with this new row order:**

```tsx
      <div className="relative z-10">
        <div className="mx-auto px-5" style={{ maxWidth: '1400px' }}>

          {/* Row 1: Status Band */}
          <StatusBand
            displayTimeMs={displayTime.ms}
            isCurrentlyProductive={isCurrentlyProductive}
            isDistracting={isDistracting}
            currentAppName={currentApp?.app || currentApp?.title || ''}
            totalFocusedMs={totalFocusedMs}
          />

          {/* Row 2: Pinned Activities */}
          <PinnedActivities
            pinnedActivities={pinnedActivities}
            setPinnedActivities={setPinnedActivities}
            activities={activities}
            selectedExternalActivity={selectedExternalActivity}
            setSelectedExternalActivity={setSelectedExternalActivity}
            handleSelectExternalActivity={handleSelectExternalActivity}
            externalSessionRunning={externalSessionRunning}
            formatDuration={formatDuration}
            externalElapsedMs={externalElapsedMs}
            handleStartExternalSession={handleStartExternalSession}
            handleStopExternalSession={handleStopExternalSession}
            collapsible
          />

          {/* Row 3: Schedule Hero */}
          <div className="mb-4">
            <ScheduleCard />
          </div>

          {/* Row 4: Triple Column — Goals + Deadlines + Focus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <GoalsCard goals={goals} />
            <DeadlinesCard deadlines={deadlines} />
            <QuickFocusCard
              state={deepFocus.state}
              onStart={deepFocus.start}
              onEnd={deepFocus.end}
            />
          </div>

          {/* Row 5: Insight Strip */}
          <InsightStrip insights={insights} />

          {/* Row 6: Tier Breakdown Strip */}
          <TierBreakdownStrip
            productiveHours={dashboardData?.overview?.productiveSeconds ? Math.round(dashboardData.overview.productiveSeconds / 3600 * 10) / 10 : 0}
            neutralHours={dashboardData?.overview?.neutralSeconds ? Math.round(dashboardData.overview.neutralSeconds / 3600 * 10) / 10 : 0}
            distractingHours={dashboardData?.overview?.distractingSeconds ? Math.round(dashboardData.overview.distractingSeconds / 3600 * 10) / 10 : 0}
            totalHours={dashboardData?.overview?.totalSeconds ? Math.round(dashboardData.overview.totalSeconds / 3600 * 10) / 10 : 0}
          />

          {/* Row 7: Productivity Chart */}
          <motion.div
            className="relative rounded-xl overflow-hidden
              bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
              border border-[rgba(63,63,70,0.50)] p-5 mb-4
              hover:border-[rgba(82,82,91,0.80)] transition-all duration-250"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <div className="absolute top-0 left-4 right-4 h-px
              bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-60 pointer-events-none" />
            <SectionHeader title="Productivity" icon={<BarChart3 size={14} />} />
            <div className="h-52 mt-2">
              {chartBarsResult.chartBars.length === 0 ? (
                <EmptyState icon={<BarChart3 className="w-8 h-8 opacity-30" />} title="No data yet" description="Start tracking to see productivity" />
              ) : (
                <Bar data={{
                  labels: chartBarsResult.chartBars.map(b => b.label),
                  datasets: [
                    { label: 'Productive', data: chartBarsResult.chartBars.map(b => Math.round(b.productiveSeconds / 3600 * 100) / 100), backgroundColor: '#34d399', borderRadius: 4, borderSkipped: false },
                    { label: 'Other', data: chartBarsResult.chartBars.map(b => Math.round(b.nonProductiveSeconds / 3600 * 100) / 100), backgroundColor: '#fbbf24', borderRadius: 4, borderSkipped: false },
                    { label: 'External', data: chartBarsResult.chartBars.map(b => Math.round(b.externalSeconds / 3600 * 100) / 100), backgroundColor: '#818cf8', borderRadius: 4, borderSkipped: false },
                  ],
                }} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(24,24,27,0.95)', titleColor: '#f4f4f5', bodyColor: '#a1a1aa', borderColor: 'rgba(63,63,70,0.50)', borderWidth: 1, cornerRadius: 8, padding: 10 } },
                  scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#52525b', font: { size: 11 } } }, y: { stacked: true, grid: { color: 'rgba(63,63,70,0.20)' }, ticks: { color: '#52525b', font: { size: 11 } } } },
                }} />
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setExpandedModal('heatmap')}
                className="flex-1 py-2 rounded-lg text-[12px] font-medium bg-zinc-900/40 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50 transition-all duration-200">
                View Heatmap
              </button>
              <button onClick={() => setExpandedModal('solar')}
                className="flex-1 py-2 rounded-lg text-[12px] font-medium bg-zinc-900/40 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50 transition-all duration-200">
                View Solar System
              </button>
            </div>
          </motion.div>

          {/* Row 8: Sleep */}
          <div className="mb-4">
            <SleepBarMini sleepData={sleepData} avgSleep={avgSleep} sleepDebt={sleepDebt} />
          </div>

          {/* Row 9: Activity Feed */}
          <motion.div
            className="relative rounded-xl overflow-hidden
              bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
              border border-[rgba(63,63,70,0.50)] p-5 mb-4
              hover:border-[rgba(82,82,91,0.80)] transition-all duration-250"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.64, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <div className="absolute top-0 left-4 right-4 h-px
              bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent opacity-60 pointer-events-none" />
            <SectionHeader title="Recent Sessions" icon={<Clock size={14} />} />
            <div className="space-y-0.5 mt-3">
              {activityFeedWithElapsed.length === 0 ? (
                <EmptyState icon={<Clock size={20} className="text-zinc-600" />} title="No sessions yet" description="Start an activity to see it here" />
              ) : (
                [...activityFeedWithElapsed].reverse().slice(0, 10).map((item) => {
                  const isActive = item.isActive;
                  const durationStr = isActive ? getElapsedDuration(item) : item.elapsedStr;
                  return (
                    <div key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/20 border border-transparent hover:bg-zinc-900/40 hover:border-zinc-800/30 transition-all duration-200 group cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.tier === 'productive' ? 'bg-emerald-400' : item.tier === 'distracting' ? 'bg-rose-400' : 'bg-amber-400'} ${isActive ? 'animate-pulse' : ''}`} />
                        <div className="min-w-0">
                          <div className="text-[13px] text-zinc-300 group-hover:text-white transition-colors truncate">{item.name}</div>
                          <div className="text-[11px] text-zinc-600 truncate">{item.category} &bull; {item.timestamp.toLocaleTimeString()}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-[13px] font-mono text-zinc-400">{isActive && durationStr ? durationStr : item.elapsedStr}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.tier === 'productive' ? 'bg-emerald-500/10 text-emerald-400' : item.tier === 'distracting' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {item.tier}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

        </div>
      </div>
```

---

### What Changed & Why

| Problem | Fix |
|--------|-----|
| Redundant score/100 + streak in StatusBand | Removed entirely. StatusBand now shows **current session timer** + **total focused today** + **current date** |
| Unclear "Focus up" / Trophy "Mon" / streak meaning | Removed all badges. The daily total focused time is self-explanatory |
| Missing "time focused today" | Added `totalFocusedMs` computed from `productiveSeconds × 1000`, formatted as `Xh Ym focused today` |
| Pinned Activities buried at Row 7 | Moved to **Row 2**, converted to horizontal scrollable strip directly under StatusBand |
| Sleep card empty / broken | Added empty state (Moon icon + copy). Kept indigo palette. Added optional `avgBedtime` / `avgWakeTime` props |
| Heatmap button missing | Added **"View Heatmap"** button next to **"View Solar System"** below the productivity chart |
| Solar preview overlapping button | Removed inline solar preview entirely. Solar System is now modal-only |
| Follow Through irrelevant on dashboard | Removed `FollowThroughCard` from render |
| MasteryRingMini irrelevant | Removed from health stack (and removed the 2-column grid, making Productivity Chart full-width) |
| TierBreakdownStrip had 6 confusing columns | Slimmed to 4 columns (Productive, Neutral, Distracting, Total). Removed Score & Trend |

