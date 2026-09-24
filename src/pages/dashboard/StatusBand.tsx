import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Target, Activity, Clock } from 'lucide-react';
import { getCategoryStyle } from '../../lib/CategoryColors';

const LOCKED_IN_LUMEN = false;

function formatTime(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(): string {
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[now.getDay()]} ${monthNames[now.getMonth()]} ${now.getDate()}`;
}

interface StatusBandProps {
  displayTimeMs: number;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  currentAppName: string;
  isReal?: boolean;
  totalFocusedMs: number;
  isInBrowser?: boolean;
  onStartFocus?: () => void;
  isPaused?: boolean;
  websiteTitle?: string;
  websiteCategory?: string;
}

type TierTransition = {
  id: number;
  from: string | null;
  to: string;
  timestamp: number;
};

export function StatusBand({
  displayTimeMs,
  isCurrentlyProductive,
  isDistracting,
  currentAppName,
  isReal,
  totalFocusedMs,
  isInBrowser,
  onStartFocus,
  isPaused,
  websiteTitle,
  websiteCategory,
}: StatusBandProps) {
  const totalMinutes = Math.floor(totalFocusedMs / 1000 / 60);
  const stateKey = isDistracting ? 'distracting' : isCurrentlyProductive ? 'productive' : 'neutral';
  const isActive = !isPaused && (isCurrentlyProductive || isDistracting);
  const timeStr = formatTime(displayTimeMs);

  const dailyFocusTarget = 240;
  const focusPercent = Math.min(100, Math.round((totalMinutes / dailyFocusTarget) * 100));
  const currentTier = isDistracting ? 'distracting' : isCurrentlyProductive ? 'productive' : 'neutral';

  const prevTierRef = useRef<string | null>(null);
  const [transitions, setTransitions] = useState<TierTransition[]>([]);
  const transitionIdRef = useRef(0);
  const [showRecap, setShowRecap] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const prev = prevTierRef.current;
    if (prev !== null && prev !== currentTier) {
      const id = transitionIdRef.current++;
      const newT: TierTransition = { id, from: prev, to: currentTier, timestamp: Date.now() };
      setTransitions(prev => [newT, ...prev].slice(0, 5));
      setShowRecap(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowRecap(false), 5000);
    }
    prevTierRef.current = currentTier;
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [currentTier]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const tierLabel = (t: string | null) => {
    if (!t) return 'Idle';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const recapLines = useMemo(() => {
    if (transitions.length === 0) return [];
    return transitions.slice(0, 3).map(t => ({
      id: t.id,
      text: `${tierLabel(t.from)} → ${tierLabel(t.to)}`,
      ago: Math.floor((now - t.timestamp) / 1000),
    }));
  }, [transitions, now]);

  const isTracking = isReal === true;
  const isWaylandDegraded = process.env.XDG_SESSION_TYPE === 'wayland';

  const catStyle = (() => { try { return getCategoryStyle(websiteCategory || 'Other'); } catch { return { text: 'text-zinc-400', bg: 'bg-zinc-500/15', border: 'border-zinc-500/20' }; } })();
  const stateColor = stateKey === 'productive' ? 'var(--resume-success)' : stateKey === 'distracting' ? 'var(--resume-warning)' : 'var(--text-muted)';

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference * (1 - focusPercent / 100);

const timerColor = isDistracting ? 'var(--error)' : isCurrentlyProductive ? 'var(--success)' : 'var(--text-muted)';
const timerGlow = isDistracting ? 'rgba(239,68,68,0.15)' : isCurrentlyProductive ? 'rgba(34,197,94,0.15)' : 'transparent';
const timerGradient = isDistracting ? 'from-red-500/20 via-red-500/5 to-transparent' : isCurrentlyProductive ? 'from-emerald-500/20 via-emerald-500/5 to-transparent' : 'from-zinc-500/10 via-zinc-500/5 to-transparent';

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 relative rounded-[10px] border-t border-[var(--ws-border)]">
      {/* Depth layer 1: inner highlight top edge */}
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-[10px]" />
      {/* Depth layer 2: bottom shadow for floating feel */}
      <div className="absolute bottom-0 left-[3px] right-[3px] h-px -z-10 bg-gradient-to-r from-black/[0.2] via-black/[0.1] to-transparent rounded-b-[10px]" />
      {/* Glow accent based on tier */}
      {isActive && (
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${timerGradient}`} />
      )}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 50% 0%, ${timerGlow} 0%, transparent 60%)`,
        }} />
      )}
      {/* Depth layer 3: subtle inset shadow for card depth */}
      <div className="absolute inset-0 -z-10 rounded-[10px] pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />
      {/* Status header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ opacity: isActive ? [0.4, 1, 0.4] : 1 }}
            transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stateColor }}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            {isPaused ? 'Paused' : isActive ? (isDistracting ? 'Distracting' : 'Locked In') : 'Idle'}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono tabular-nums">{formatDate()}</span>
      </div>

      {/* Timer + Momentum split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center relative z-10">
        {/* Timer block */}
        <div className="flex flex-col items-center justify-center">
          <div className="font-display text-[28px] font-bold leading-none tracking-tight tabular-nums" style={{
            color: timerColor,
            textShadow: isActive ? `0 0 20px ${timerGlow}, 0 0 40px ${timerGlow}` : 'none',
          }}>
            {timeStr}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">{totalMinutes}m focused</div>
          {onStartFocus && !isPaused && (
            <button
              onClick={onStartFocus}
              className="mt-3 shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)] hover:bg-[var(--page-accent)]/20 hover:border-[var(--page-accent)]/50 transition-all duration-200 text-[12px] font-medium font-sans focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] cursor-pointer"
            >
              <Activity size={12} />
              Focus
            </button>
          )}
        </div>

        {/* Momentum block — separated by hairline */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-px h-0 bg-[var(--ws-border)] hidden md:block" />
          <div className="flex items-center gap-3">
            <svg width="56" height="56" viewBox="0 0 100 100" className="shrink-0">
              <defs>
                <linearGradient id="statusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={stateKey === 'productive' ? '#22c55e' : stateKey === 'distracting' ? '#ef4444' : '#71717a'} />
                  <stop offset="100%" stopColor={stateKey === 'productive' ? '#16a34a' : stateKey === 'distracting' ? '#dc2626' : '#525252'} />
                </linearGradient>
                <filter id="statusGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#statusGrad)"
                strokeWidth="4"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                transform="rotate(-90 50 50)"
                strokeLinecap="round"
                filter={isActive ? 'url(#statusGlow)' : undefined}
                style={{ filter: isActive ? `drop-shadow(0 0 6px ${stateKey === 'productive' ? 'rgba(34,197,94,0.4)' : stateKey === 'distracting' ? 'rgba(239,68,68,0.4)' : 'transparent'})` : undefined }}
              />
              <text x="50" y="46" textAnchor="middle" fill={stateKey === 'productive' ? '#22c55e' : stateKey === 'distracting' ? '#ef4444' : 'var(--text-primary)'} fontSize="16" fontFamily="Space Grotesk, sans-serif" fontWeight="700">
                {focusPercent}
              </text>
              <text x="50" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="7" fontFamily="Inter, sans-serif">
                %
              </text>
            </svg>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Flame size={12} className="text-amber-400" />
                <span className="text-[11px] font-semibold text-zinc-300">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target size={12} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-500">{totalMinutes}m / {dailyFocusTarget}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking info */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--ws-border)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isTracking ? (
            <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-1.5 min-w-0 border border-zinc-700/50">
              {isInBrowser ? <Clock size={11} className="text-zinc-500 shrink-0" /> : <Activity size={11} className="text-zinc-500 shrink-0" />}
              <span className="text-[12px] font-medium text-zinc-300 truncate font-sans">
                {isInBrowser ? (websiteTitle || currentAppName) : currentAppName}
              </span>
              {isInBrowser && websiteCategory && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans ${catStyle.text}`}>{websiteCategory}</span>
              )}
            </div>
          ) : isWaylandDegraded ? (
            <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-1.5 min-w-0 border border-zinc-700/50">
              <Clock size={11} className="text-zinc-600" />
              <span className="text-[11px] text-zinc-500 font-sans">Tracking active on Wayland</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-1.5 border border-zinc-700/50">
              <Clock size={11} className="text-zinc-600" />
              <span className="text-[11px] text-zinc-500 font-sans">No foreground data</span>
            </div>
          )}
        </div>
      </div>

      {/* Tier recap */}
      {showRecap && recapLines.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 bg-zinc-900/60 rounded-lg p-3 border border-zinc-700/50"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Activity size={10} className="text-zinc-500" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Since Last Visit</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recapLines.map((line) => (
              <span key={line.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50 text-[10px]">
                <span className="text-zinc-400 font-mono">{line.text}</span>
                <span className="text-zinc-600">{line.ago}s ago</span>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* R-29 Lumen accent — hidden by default, one boolean flip to reveal */}
      {LOCKED_IN_LUMEN && currentTier === 'productive' && (
        <div className="absolute inset-0 rounded-[10px] pointer-events-none" style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05))',
          border: '1px solid rgba(16,185,129,0.15)',
        }} />
      )}
    </div>
  );
}
