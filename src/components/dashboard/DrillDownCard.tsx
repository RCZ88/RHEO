import { motion } from 'framer-motion';
import { BarChart3, Orbit } from 'lucide-react';

interface DrillDownCardProps {
  kind: 'heatmap' | 'ecosystem';
  title: string;
  subtitle: string;
  preview?: React.ReactNode;
  onView: () => void;
}

export function DrillDownCard({ kind, title, subtitle, preview, onView }: DrillDownCardProps) {
  const isHeatmap = kind === 'heatmap';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: isHeatmap ? 0.23 : 0.25 }}
      className="rounded-xl p-5 border backdrop-blur-sm transition-colors bg-zinc-950/80 border-zinc-500/20"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
            <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors border border-zinc-700 hover:border-zinc-600"
          >
            View
          </button>
        </div>

        {preview && (
          <div className="h-48 rounded-lg bg-zinc-900/50 border border-zinc-800/30 flex items-center justify-center">
            {preview}
          </div>
        )}
      </div>
    </motion.div>
  );
}