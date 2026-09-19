import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, Check, Edit3, Plus, Minus, Play, X,
  BookOpen, Dumbbell, Activity, Moon, Utensils, Coffee, Bus, Book, Timer, Sun
} from 'lucide-react';
import { BlurFade } from '../../components/ui/blur-fade';

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
    <BlurFade delay={0.05} duration={0.4}>
      <div className="bg-[rgba(24,24,27,0.80)] rounded-xl p-5 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => collapsible ? setPinnedActivitiesExpanded(!pinnedActivitiesExpanded) : null}
            className="flex items-center gap-2 text-left"
          >
            {collapsible && <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${pinnedActivitiesExpanded ? 'rotate-90' : ''}`} />}
            <span className="text-[13px] font-semibold text-zinc-300 light:text-stone-800">Quick Activities</span>
          </button>
          <button
            onClick={() => setPinnedActivitiesEditMode(!pinnedActivitiesEditMode)}
            className={`p-1.5 rounded-lg border transition-colors duration-150 ${
              pinnedActivitiesEditMode
                ? 'bg-emerald-500/20 border-emerald-500/50'
                : 'bg-zinc-800 light:bg-stone-100 border-zinc-700 light:border-[var(--ws-border)] hover:border-zinc-600 hover:light:border-[var(--ws-border-strong)]'
            }`}
          >
            {pinnedActivitiesEditMode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
        </div>

        {/* Horizontal scrollable strip */}
        {pinnedActivitiesExpanded && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {pinnedActivities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.icon] || Timer;
              const isSelected = selectedExternalActivity?.id === activity.id;

              return (
                <BlurFade key={activity.id} delay={0.05 + index * 0.04} duration={0.3}>
                  <motion.div className="relative flex-shrink-0">
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
                      whileHover={{ y: -1, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-[18px] border transition-all duration-150 ${
                        isSelected
                          ? 'border-pink-500/40 bg-pink-500/[0.08] text-pink-400'
                          : 'bg-[#18181b] light:bg-white border-[#27272a] light:border-[var(--ws-border)] text-zinc-400 light:text-stone-600 hover:border-[#3f3f46] hover:light:border-[var(--ws-border-strong)] hover:bg-[#27272a] hover:light:bg-stone-50'
                      }`}
                    >
                      {isSelected && externalSessionRunning && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-500"></span>
                        </span>
                      )}
                      <Icon className={`w-4 h-4 ${
                        isSelected ? 'text-pink-400' : activity.is_productive ? 'text-emerald-500' : 'text-indigo-400'
                      }`} />
                      <span className="text-[12px] font-medium whitespace-nowrap">{activity.name}</span>
                      {isSelected && externalSessionRunning && (
                        <span className="text-[11px] font-mono font-semibold text-pink-400 tabular-nums">
                          {formatDuration(externalElapsedMs)}
                        </span>
                      )}
                      {isSelected && !externalSessionRunning && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartExternalSession(); }}
                          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-pink-500/15 text-pink-400 border border-pink-500/20 hover:bg-pink-500/25 transition-all duration-150 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>
                      )}
                    </motion.button>
                    {isSelected && externalSessionRunning && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(e) => { e.stopPropagation(); handleStopExternalSession(); }}
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-red-500/90 text-white text-[9px] font-semibold uppercase tracking-wider shadow-lg shadow-red-500/20 hover:bg-red-500 transition-colors duration-150 whitespace-nowrap"
                      >
                        Stop
                      </motion.button>
                    )}
                    {pinnedActivitiesEditMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPinnedActivities(prev => prev.filter(a => a.id !== activity.id)); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <Minus className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                  </motion.div>
                </BlurFade>
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
                className="flex-shrink-0 px-3 py-2 rounded-[18px] border border-dashed border-zinc-700 light:border-[var(--ws-border-strong)] hover:border-zinc-600 transition-colors duration-150 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-500">Add</span>
              </motion.button>
            )}
          </div>
        )}

        {/* Add Activity Modal */}
        <AnimatePresence>
          {showAddActivityModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 10 }}
                className="rounded-xl border overflow-hidden w-full max-w-sm bg-[#09090b] light:bg-white border-[#27272a] light:border-[var(--ws-border)] shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#27272a] light:border-[var(--ws-border)]">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100 light:text-stone-900">Pin Activities</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Select activities to add to dashboard</p>
                  </div>
                  <button
                    onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
                    className="p-1.5 hover:bg-zinc-800 light:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>

                <div className="px-2 py-2 max-h-72 overflow-y-auto">
                  {addPinnedPicker.map(activity => {
                    const isSelected = selectedAddActivities.has(activity.id);
                    return (
                      <button
                        key={activity.id}
                        onClick={() => {
                          const next = new Set(selectedAddActivities);
                          if (isSelected) next.delete(activity.id);
                          else next.add(activity.id);
                          setSelectedAddActivities(next);
                        }}
                        className={`w-full px-3 py-3 text-left text-sm rounded-xl flex items-center gap-3 transition-colors duration-150 ${
                          isSelected ? 'bg-pink-500/10' : 'hover:bg-zinc-800 hover:light:bg-stone-100'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                          isSelected ? 'border-pink-500 bg-pink-500' : 'border-zinc-600 light:border-zinc-300 bg-transparent'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: activity.color }} />
                        <span className={`font-medium ${isSelected ? 'text-pink-300' : 'text-zinc-300 light:text-stone-700'}`}>
                          {activity.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#27272a] light:border-[var(--ws-border)]">
                  <button
                    onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
                    className="px-4 py-2 text-sm text-zinc-400 light:text-stone-500 hover:text-zinc-200 hover:light:text-stone-900 hover:bg-zinc-800 hover:light:bg-stone-100 rounded-xl transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const selected = addPinnedPicker.filter(a => selectedAddActivities.has(a.id));
                      setPinnedActivities(prev => [...prev, ...selected]);
                      setShowAddActivityModal(false);
                      setAddPinnedPicker([]);
                      setSelectedAddActivities(new Set());
                    }}
                    disabled={selectedAddActivities.size === 0}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedAddActivities.size > 0
                        ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                        : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500 light:border-zinc-400 light:border-zinc-400/20'
                    }`}
                  >
                    {selectedAddActivities.size > 0 ? `Add (${selectedAddActivities.size})` : 'Select activities'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BlurFade>
  );
}
