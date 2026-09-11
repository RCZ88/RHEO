import { AnimatePresence, motion } from "framer-motion";
import { Database, Play, Plus, X } from "lucide-react";
import type { ExternalActivity } from "@/types/external";

export function ActivitySelectionOverlay({
  activity,
  onClose,
  onViewData,
  onStart,
  onAddSession,
}: {
  activity: ExternalActivity | null;
  onClose: () => void;
  onViewData: (activity: ExternalActivity) => void;
  onStart: (activity: ExternalActivity) => void;
  onAddSession: (activity: ExternalActivity) => void;
}) {
  return (
    <AnimatePresence>
      {!!activity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl"
                  style={{ backgroundColor: `${activity.color}22` }}
                >
                  <div
                    className="m-auto mt-3 h-4 w-4 rounded-full"
                    style={{ backgroundColor: activity.color }}
                  />
                </div>
                <div>
                  <div className="text-lg font-medium text-zinc-100">
                    {activity.name}
                  </div>
                  <div className="text-xs text-zinc-500">External activity</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                onClick={() => onViewData(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                View Data
                <Database className="h-4 w-4" />
              </button>

              <button
                onClick={() => onStart(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                Start
                <Play className="h-4 w-4" />
              </button>

              <button
                onClick={() => onAddSession(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                Add Session
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
