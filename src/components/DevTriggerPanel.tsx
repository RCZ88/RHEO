import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug, Zap, Clock, Sparkles, PanelLeftOpen, PanelLeftClose, X,
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
            className="bg-zinc-900/95 border border-zinc-700/50 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl"
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
                <div className="text-zinc-500 text-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-medium text-zinc-300">Inject Tab — coming soon</span>
                  </div>
                  <p className="text-zinc-600">Data injectors for sleep, AFK, and gaps will go here.</p>
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

