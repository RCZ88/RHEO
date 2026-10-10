import { useMemo } from "react";
import { motion } from "framer-motion";
import { Handshake, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export interface FollowThroughBreakdown {
  label: string;
  total: number;
  count: number;
}

export interface FollowThroughCardProps {
  currency: string;
  totalThisMonth: number;
  momChangePct: number | null;
  receivable: number;
  breakdown: FollowThroughBreakdown[];
  trend: number[];
  onViewDetails?: () => void;
  ftPersons?: { id: number; name: string; balance?: number; wallet_id?: number | null }[];
}

const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

export function FollowThroughCard({
  currency,
  totalThisMonth,
  momChangePct,
  receivable,
  breakdown,
  trend,
  onViewDetails,
  ftPersons = [],
}: FollowThroughCardProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  const max = Math.max(1, ...trend);
  const up = (momChangePct ?? 0) >= 0;
  const hasData = totalThisMonth > 0 || receivable > 0;

  return (
    <motion.section
      {...fadeIn}
      className="relative rounded-xl border border-zinc-800/60 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 overflow-hidden"
    >
      {/* Gradient glow background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ background: 'linear-gradient(135deg, #f59e0b, transparent 60%)' }}
      />
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Handshake className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Follow Through</h3>
            <p className="text-[11px] text-zinc-500">Money you fronted for others</p>
          </div>
        </div>
        {momChangePct !== null && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              up
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(momChangePct).toFixed(0)}%
          </motion.span>
        )}
      </div>

      {!hasData ? (
        /* Empty state */
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
            <Handshake className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-400 max-w-[280px]">
            No money fronted for others yet. When you pay for someone who&apos;ll pay you back,
            mark it &ldquo;Follow Through&rdquo; and it appears here.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-4 mb-4"
          >
            <motion.div variants={staggerItem} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
              <p className="text-[11px] text-zinc-500 mb-1">This Month</p>
              <p className="text-xl font-bold tabular-nums text-amber-300">{fmt(totalThisMonth)}</p>
            </motion.div>
            <motion.div variants={staggerItem} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
              <p className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                <Handshake className="w-3 h-3" /> You&apos;ll be repaid
              </p>
              <p className="text-xl font-bold tabular-nums text-emerald-300">{fmt(receivable)}</p>
            </motion.div>
          </motion.div>

          {/* Mini trend bar */}
          {trend.length > 0 && (
            <div className="flex items-end gap-1 h-10 mb-4" aria-hidden>
              {trend.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (v / max) * 40)}px` }}
                  transition={{ duration: 0.4, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 rounded-t bg-amber-400/40"
                />
              ))}
            </div>
          )}

          {/* Per-person breakdown */}
          {breakdown.length > 0 && (
            <div className="border-t border-zinc-800/50 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Owed by</p>
              <div className="space-y-1.5">
                {breakdown.map((b) => {
                  const person = ftPersons.find(p => p.name === b.label);
                  const storedBalance = person?.balance ?? 0;
                  return (
                    <div key={b.label} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-zinc-800/30 transition-colors duration-150">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-amber-400">{b.label[0]?.toUpperCase()}</span>
                        </div>
                        <span className="text-sm text-zinc-300 truncate">{b.label}</span>
                        <span className="text-[10px] text-zinc-600">({b.count})</span>
                        {storedBalance > 0 && (
                          <span className="inline-flex items-center rounded-md bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                            bal: {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(storedBalance)}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium tabular-nums text-zinc-200">{fmt(b.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* View details link */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
        >
          View all details <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </motion.section>
  );
}
