import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
export default function StatCard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string | number; sub: string; accent: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className={'w-9 h-9 rounded-xl grid place-items-center ' + accent}><Icon className="w-4 h-4 text-white" /></div>
      </div>
      <div className="mt-3 text-2xl font-display font-bold text-white">{value}</div>
      <div className="text-xs font-medium text-white/70 mt-0.5">{label}</div>
      <div className="text-[11px] text-white/40 mt-1">{sub}</div>
    </motion.div>
  );
}
