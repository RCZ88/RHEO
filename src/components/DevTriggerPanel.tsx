import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug, Zap, Clock, Sparkles, PanelLeftOpen, PanelLeftClose, X, Bed, Plus, Trash2, Circle,
} from 'lucide-react';

console.log('%c[DevTriggerPanel] v1.0 dev surface loaded', 'color:#fbbf24; font-weight:bold');

export interface TriggerRow {
  id: string;
  label: string;
  icon: React.ReactNode;
  condition: string;
  fire: () => void;
  prepAndFire?: () => void;
  prepLabel?: string;
}

interface DevTriggerPanelProps {
  open: boolean;
  onClose: () => void;
  detach?: boolean;
  onDetachChange?: (detached: boolean) => void;
  triggers: TriggerRow[];
  onFire: (id: string) => void;
  onPrepAndFire: (id: string) => void;
  hasPrep: (id: string) => boolean;
  prepLabel: (id: string) => string;
  devSleepInject: { bedtime: { hours: number; minutes: number }; waketime: { hours: number; minutes: number }; fellAsleepAt: { hours: number; minutes: number }; wakeUpAt: { hours: number; minutes: number }; date: string };
  setDevSleepInject: React.Dispatch<React.SetStateAction<{ bedtime: { hours: number; minutes: number }; waketime: { hours: number; minutes: number }; fellAsleepAt: { hours: number; minutes: number }; wakeUpAt: { hours: number; minutes: number }; date: string }>>;
  devSleepDetectionResult: { gapMinutes: number; suggestedBedtime: string; suggestedWakeTime: string; adjacentGaps?: any[] } | null;
  devPreviewGaps: any[];
  devDetectedGaps: any[];
  devAfkInject: { idleMinutes: number; defaultNotAfk: boolean };
  setDevAfkInject: React.Dispatch<React.SetStateAction<{ idleMinutes: number; defaultNotAfk: boolean }>>;
  devGapsInject: { period: string; minGapMinutes: number };
  setDevGapsInject: React.Dispatch<React.SetStateAction<{ period: string; minGapMinutes: number }>>;
  devAfkQueueView: any[];
  runSleepDetectionInject: () => void;
  previewAdjacentGapsInject: () => void;
  confirmSleepInject: () => void;
  injectAfkEntry: () => void;
  detectGapsInject: () => void;
  fillSleepGapsInject: () => void;
  fillAfkGapsInject: () => void;
  dismissAllDev: () => void;
}

function fmt(h: number, m: number): string {
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ap}`;
}

export default function DevTriggerPanel({
  open,
  onClose,
  detach = false,
  onDetachChange,
  triggers,
  onFire,
  onPrepAndFire,
  hasPrep,
  prepLabel,
  devSleepInject,
  setDevSleepInject,
  devSleepDetectionResult,
  devPreviewGaps,
  devDetectedGaps,
  devAfkInject,
  setDevAfkInject,
  devGapsInject,
  setDevGapsInject,
  devAfkQueueView,
  runSleepDetectionInject,
  previewAdjacentGapsInject,
  confirmSleepInject,
  injectAfkEntry,
  detectGapsInject,
  fillSleepGapsInject,
  fillAfkGapsInject,
  dismissAllDev,
}: DevTriggerPanelProps) {
  const [activeTab, setActiveTab] = useState<'fire' | 'inject' | 'schedule'>('fire');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[5vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Bug className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">DevTrigger Panel</h2>
                  <p className="text-xs text-zinc-500">Debug & test every auto-popup without waiting</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onDetachChange && (
                  <button
                    onClick={() => onDetachChange(!detach)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      detach
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50'
                    }`}
                  >
                    {detach ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
                    {detach ? 'Detached' : 'Attach'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800/80 px-6">
              {(['fire', 'inject', 'schedule'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === tab
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === 'fire' && <><Zap className="w-4 h-4 inline mr-1.5" />Fire</>}
                  {tab === 'inject' && <><Sparkles className="w-4 h-4 inline mr-1.5" />Inject</>}
                  {tab === 'schedule' && <><Clock className="w-4 h-4 inline mr-1.5" />Schedule + State</>}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 220px)' }}>
              {activeTab === 'fire' && (
                <div className="space-y-2">
                  {triggers.map(trigger => (
                    <div
                      key={trigger.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-600/50 transition"
                    >
                      <div className="p-2 rounded-lg bg-zinc-700/30 text-zinc-400">
                        {trigger.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{trigger.label}</span>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">dev</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{trigger.condition}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasPrep(trigger.id) && (
                          <button
                            onClick={() => onPrepAndFire(trigger.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition"
                          >
                            {prepLabel(trigger.id)}
                          </button>
                        )}
                        <button
                          onClick={() => onFire(trigger.id)}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition"
                        >
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                          Fire
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'inject' && (
                <div className="space-y-6">
                  {/* Sleep Section */}
                  <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/30 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Bed className="w-4 h-4 text-indigo-400" />
                      <span className="font-medium text-white text-sm">Sleep Injector</span>
                      <span className="text-[10px] text-zinc-500 ml-auto">pre-sleep / post-sleep gap fill</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Date</label>
                        <input
                          type="date"
                          value={devSleepInject.date}
                          onChange={e => setDevSleepInject(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Bedtime</label>
                        <div className="flex gap-1 mt-1">
                          <input type="number" min="0" max="23" value={devSleepInject.bedtime.hours}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, bedtime: { ...prev.bedtime, hours: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                          <span className="text-zinc-500 text-xs mt-1.5">:</span>
                          <input type="number" min="0" max="59" value={devSleepInject.bedtime.minutes}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, bedtime: { ...prev.bedtime, minutes: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Waketime</label>
                        <div className="flex gap-1 mt-1">
                          <input type="number" min="0" max="23" value={devSleepInject.waketime.hours}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, waketime: { ...prev.waketime, hours: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                          <span className="text-zinc-500 text-xs mt-1.5">:</span>
                          <input type="number" min="0" max="59" value={devSleepInject.waketime.minutes}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, waketime: { ...prev.waketime, minutes: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Fell Asleep</label>
                        <div className="flex gap-1 mt-1">
                          <input type="number" min="0" max="23" value={devSleepInject.fellAsleepAt.hours}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, fellAsleepAt: { ...prev.fellAsleepAt, hours: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                          <span className="text-zinc-500 text-xs mt-1.5">:</span>
                          <input type="number" min="0" max="59" value={devSleepInject.fellAsleepAt.minutes}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, fellAsleepAt: { ...prev.fellAsleepAt, minutes: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Wake Up</label>
                        <div className="flex gap-1 mt-1">
                          <input type="number" min="0" max="23" value={devSleepInject.wakeUpAt.hours}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, wakeUpAt: { ...prev.wakeUpAt, hours: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                          <span className="text-zinc-500 text-xs mt-1.5">:</span>
                          <input type="number" min="0" max="59" value={devSleepInject.wakeUpAt.minutes}
                            onChange={e => setDevSleepInject(prev => ({ ...prev, wakeUpAt: { ...prev.wakeUpAt, minutes: parseInt(e.target.value) || 0 } }))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm text-center" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <button onClick={runSleepDetectionInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition">
                        Run Detection
                      </button>
                      <button onClick={previewAdjacentGapsInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition">
                        Preview Adjacent Gaps
                      </button>
                      <button onClick={confirmSleepInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition">
                        Confirm + Gaps Step
                      </button>
                    </div>

                    {/* Preview gaps result */}
                    {devPreviewGaps.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-[10px] text-zinc-500 uppercase font-medium">Adjacent Gaps ({devPreviewGaps.length})</div>
                        {devPreviewGaps.map((g: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-700/30">
                            <span className={`w-2 h-2 rounded-full ${g.relation === 'before' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                            <span className="text-xs text-white">{g.relation === 'before' ? 'Pre-sleep' : 'Post-sleep'}</span>
                            <span className="text-xs text-zinc-400 ml-auto font-mono">{fmt(new Date(g.start).getHours(), new Date(g.start).getMinutes())} – {fmt(new Date(g.end).getHours(), new Date(g.end).getMinutes())}</span>
                            <span className="text-xs text-zinc-500">{Math.round(g.durationSeconds / 60)}m</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {devSleepDetectionResult?.adjacentGaps && devSleepDetectionResult.adjacentGaps.length > 0 && (
                      <div className="mt-2 text-[10px] text-zinc-500">
                        Detection has {devSleepDetectionResult.adjacentGaps.length} gap(s) available for fill
                      </div>
                    )}
                  </div>

                  {/* AFK Section */}
                  <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/30 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span className="font-medium text-white text-sm">AFK Injector</span>
                    </div>
                    <div className="flex gap-3 mb-3 items-end">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Idle Minutes</label>
                        <input type="number" value={devAfkInject.idleMinutes}
                          onChange={e => setDevAfkInject(prev => ({ ...prev, idleMinutes: parseInt(e.target.value) || 5 }))}
                          className="w-24 mt-1 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <input type="checkbox" checked={devAfkInject.defaultNotAfk}
                          onChange={e => setDevAfkInject(prev => ({ ...prev, defaultNotAfk: e.target.checked }))} />
                        <span className="text-xs text-zinc-400">Not AFK</span>
                      </div>
                      <button onClick={injectAfkEntry} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Inject AFK
                      </button>
                    </div>
                    {devAfkQueueView.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] text-zinc-500 uppercase">Queue ({devAfkQueueView.length})</div>
                        {devAfkQueueView.map((e: any, i: number) => (
                          <div key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                            <Circle className="w-2 h-2 text-orange-400 fill-orange-400" />
                            {e.duration} · idle {Math.round((e.idleStartMs || 0) / 60000)}m → {new Date(e.returnMs).toLocaleTimeString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gaps Section */}
                  <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/30 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium text-white text-sm">Gaps Injector</span>
                    </div>
                    <div className="flex gap-3 mb-3 items-end">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Period</label>
                        <select value={devGapsInject.period} onChange={e => setDevGapsInject(prev => ({ ...prev, period: e.target.value }))}
                          className="mt-1 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm">
                          <option value="today">Today</option>
                          <option value="week">Week</option>
                          <option value="month">Month</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Min Gap</label>
                        <input type="number" value={devGapsInject.minGapMinutes}
                          onChange={e => setDevGapsInject(prev => ({ ...prev, minGapMinutes: parseInt(e.target.value) || 5 }))}
                          className="w-20 mt-1 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm" />
                      </div>
                      <button onClick={detectGapsInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition">
                        Detect Gaps
                      </button>
                      <button onClick={fillSleepGapsInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition">
                        Fill Sleep Gaps
                      </button>
                      <button onClick={fillAfkGapsInject} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition">
                        Fill AFK Gaps
                      </button>
                    </div>
                    {devDetectedGaps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] text-zinc-500 uppercase">Detected ({devDetectedGaps.length})</div>
                        {devDetectedGaps.map((g: any, i: number) => (
                          <div key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {Math.round(g.duration_seconds / 60)}m gap · {new Date(g.start).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dismiss All */}
                  <button onClick={dismissAllDev} className="w-full py-2 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition flex items-center justify-center gap-2">
                    <Trash2 className="w-3 h-3" /> Dismiss All / Reset
                  </button>
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="text-zinc-500 text-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-medium text-zinc-300">Schedule + State Tab — coming soon</span>
                  </div>
                  <p className="text-zinc-600">One-shot schedule + live armed-state snapshot will go here.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
