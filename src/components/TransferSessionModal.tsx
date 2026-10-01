import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, X, Search, Check } from 'lucide-react';

interface ExternalActivity {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface TransferSessionModalProps {
  open: boolean;
  session: {
    id: number;
    activity_id: number;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    activity_name: string;
  };
  activities: ExternalActivity[];
  onClose: () => void;
  onTransferred: () => void;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

const iconMap: Record<string, string> = {
  BookOpen: '📖', Dumbbell: '🏋️', Activity: '💪', Bus: '🚌', Book: '📚',
  Moon: '🌙', Utensils: '🍽️', Coffee: '☕', Clock: '⏰', Zap: '⚡',
  Heart: '❤️', Brain: '🧠', Code: '💻', Laptop: '💻', Wrench: '🔧',
  Cog: '⚙️', Music: '🎵', Gamepad2: '🎮', Footprints: '👣', Droplets: '💧',
  Wind: '🌬️', Flame: '🔥', Backpack: '🎒', Palette: '🎨', Target: '🎯',
  Star: '⭐', Leaf: '🍃', Sun: '☀️', Bike: '🚴', Car: '🚗',
};

function getActivityEmoji(icon: string): string {
  return iconMap[icon] || '📌';
}

export default function TransferSessionModal({
  open,
  session,
  activities,
  onClose,
  onTransferred,
}: TransferSessionModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredActivities = useMemo(() => {
    const q = search.toLowerCase();
    return activities
      .filter(a => a.id !== session.activity_id)
      .filter(a => !q || a.name.toLowerCase().includes(q));
  }, [activities, session.activity_id, search]);

  const selectedActivity = activities.find(a => a.id === selectedId);

  const startDate = new Date(session.started_at);
  const endDate = session.ended_at ? new Date(session.ended_at) : null;

  const handleTransfer = async () => {
    if (!selectedId || !window.deskflowAPI?.updateExternalSession) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.deskflowAPI.updateExternalSession(session.id, {
        activity_id: selectedId,
      });
      if (result?.success) {
        onTransferred();
        onClose();
      } else {
        setError('Transfer failed');
      }
    } catch (err) {
      setError('Transfer failed');
    }
    setBusy(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-2xl overflow-hidden"
          >
            {/* Gradient accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-amber-500/40 via-emerald-500/40 to-amber-500/40" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <ArrowRightLeft className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-100">Transfer Session</div>
                  <div className="text-xs text-zinc-500">Move this time to a different activity</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Session info */}
            <div className="px-5 pb-3">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm" style={{ color: session.color || '#a1a1aa' }}>
                    {session.activity_name}
                  </span>
                  <span className="text-xs text-zinc-600">→</span>
                  <span className="text-xs text-zinc-400">new activity</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="text-zinc-300 font-medium">{formatTime(startDate.getTime())}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-300 font-medium">{endDate ? formatTime(endDate.getTime()) : 'now'}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-300">{formatElapsed(session.duration_seconds)}</span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activities..."
                  className="w-full bg-zinc-800/50 border border-zinc-700/30 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Activity list */}
            <div className="px-5 pb-3 max-h-52 overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-6 text-sm text-zinc-600">No other activities</div>
              ) : (
                <div className="space-y-1">
                  {filteredActivities.map(a => {
                    const isSelected = selectedId === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                            : 'hover:bg-zinc-800/50 text-zinc-300 border border-transparent'
                        }`}
                      >
                        <span className="text-base">{getActivityEmoji(a.icon)}</span>
                        <span className="flex-1 text-left truncate">{a.name}</span>
                        <span className="text-[10px] uppercase text-zinc-500">{a.type}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-5 pb-2">
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedId || busy}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {busy ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                {selectedActivity ? `Transfer to ${selectedActivity.name}` : 'Transfer'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
