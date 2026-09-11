import { motion, AnimatePresence } from 'motion/react';
import { Pause, Ban, Target, Timer, RotateCcw } from 'lucide-react';
import { AuroraText } from '../../components/ui/aurora-text';
import { BorderBeam } from '../../components/ui/border-beam';

function formatDuration(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

interface ForegroundData {
  app?: string;
  title?: string;
  category?: string;
  tier?: 'productive' | 'neutral' | 'distracting';
  isReal?: boolean;
}

interface DisplayTime {
  ms: number;
  label: string;
}

interface StopwatchTimerProps {
  displayTime: DisplayTime;
  isPaused: boolean;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  externalSessionRunning: boolean;
  selectedExternalActivity: { id: number; name: string } | null;
  hasRealApp: boolean;
  currentApp: ForegroundData | null;
  currentWebsite: { title?: string; url?: string; category?: string; domain?: string; browserName?: string; profileName?: string; profileId?: string } | null;
  isInBrowser: boolean;
  lastTier: string | null;
  borderColor: string;
}

export function StopwatchTimer({
  displayTime,
  isPaused,
  isCurrentlyProductive,
  isDistracting,
  externalSessionRunning,
  selectedExternalActivity,
  hasRealApp,
  currentApp,
  currentWebsite,
  isInBrowser,
  lastTier,
  borderColor,
}: StopwatchTimerProps) {
  const isActive = isCurrentlyProductive || externalSessionRunning || isDistracting;
  const timerColor = displayTime.label.includes('External')
    ? '#8b5cf6'
    : isDistracting
      ? '#ef4444'
      : isCurrentlyProductive
        ? '#10b981'
        : '#3b82f6';

  const timerColorTo = timerColor === '#10b981' ? '#34d399'
    : timerColor === '#ef4444' ? '#f87171'
    : timerColor === '#8b5cf6' ? '#a78bfa'
    : '#60a5fa';

  const rgb = timerColor === '#10b981' ? '16,185,129'
    : timerColor === '#ef4444' ? '239,68,68'
    : timerColor === '#8b5cf6' ? '139,92,246'
    : '59,130,246';

  // Neon-level glow — always very visible
  const glowA = isActive ? 0.9 : 0.5;
  const glowB = isActive ? 0.6 : 0.3;

  return (
    <div className="flex-1 min-w-0">
      <div
        className="relative rounded-xl h-full"
        style={{
          boxShadow: [
            `0 0 15px 4px rgba(${rgb},${glowA})`,
            `0 0 40px 10px rgba(${rgb},${glowB})`,
            `0 0 80px 25px rgba(${rgb},${glowB * 0.5})`,
            `inset 0 0 20px 2px rgba(${rgb},${glowA * 0.3})`,
          ].join(', '),
        }}
      >
        <BorderBeam
          size={400}
          duration={isActive ? 4 : 8}
          anchor={90}
          borderWidth={4}
          colorFrom={timerColor}
          colorTo={timerColorTo}
        />

        <div
          className="rounded-xl p-5 sm:p-12 h-full relative overflow-hidden bg-[rgba(24,24,27,0.80)] backdrop-blur-xl border-2"
          style={{ borderColor: `rgba(${rgb},${glowA * 0.4})` }}
        >
          {/* Full-card radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, rgba(${rgb},${glowA * 0.5}), transparent 60%)`,
            }}
          />

          <div className="text-center space-y-6 relative">
            {/* Status indicator — animated state icons */}
            <div className="flex items-center justify-center gap-2">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: timerColor, opacity: 0.7 }}
                animate={isActive ? { opacity: [0.7, 0.3, 0.7] } : { opacity: 0.4 }}
                transition={{ duration: 3, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
              />
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 flex items-center gap-1.5">
                <AnimatePresence mode="wait">
                  {isPaused ? (
                    <motion.span
                      key="paused"
                      className="flex items-center gap-1.5"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.span
                        className="w-[3px] h-3 rounded-full bg-zinc-500 inline-block"
                        animate={{ opacity: [0.3, 0.9, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.span
                        className="w-[3px] h-3 rounded-full bg-zinc-500 inline-block"
                        animate={{ opacity: [0.9, 0.3, 0.9] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      Paused
                    </motion.span>
                  ) : displayTime.label.includes('External') ? (
                    <motion.span
                      key="external"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      {displayTime.label}
                    </motion.span>
                  ) : isDistracting ? (
                    <motion.span
                      key="distracting"
                      className="flex items-center gap-1.5"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                    >
                      <motion.span
                        className="inline-flex"
                        animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                      >
                        <Ban className="w-3 h-3" />
                      </motion.span>
                      Distracting
                    </motion.span>
                  ) : isCurrentlyProductive ? (
                    <motion.span
                      key="locked"
                      className="flex items-center gap-1.5"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                    >
                      <motion.span
                        className="inline-flex"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Target className="w-3 h-3" />
                      </motion.span>
                      Locked In
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      className="flex items-center gap-1.5"
                      initial={{ opacity: 0, rotate: -90 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 90 }}
                    >
                      <motion.span
                        className="inline-flex"
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      >
                        <Timer className="w-3 h-3" />
                      </motion.span>
                      Idle
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>

            {/* Timer — elegant gradient text, no heavy background */}
            <motion.div
              key={externalSessionRunning ? 'external' : 'productive'}
              initial={{ scale: 0.97, opacity: 0.9 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-bold text-5xl lg:text-7xl xl:text-8xl truncate"
              style={{ lineHeight: '1', letterSpacing: '-0.02em' }}
            >
              <AuroraText
                colors={
                  displayTime.label.includes('External')
                    ? ['#8b5cf6', '#a78bfa', '#7c3aed', '#8b5cf6']
                    : isDistracting
                      ? ['#ef4444', '#f87171', '#dc2626', '#ef4444']
                      : isCurrentlyProductive
                        ? ['#10b981', '#34d399', '#059669', '#10b981']
                        : ['#3b82f6', '#60a5fa', '#2563eb', '#3b82f6']
                }
                speed={0.5}
              >
                {formatDuration(displayTime.ms)}
              </AuroraText>
            </motion.div>

            {externalSessionRunning && selectedExternalActivity && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <div className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">External Activity</div>
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-mono font-medium"
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.15)',
                    }}
                  >
                    {selectedExternalActivity.name}
                  </span>
                </div>
              </motion.div>
            )}

            {!externalSessionRunning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <div className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">
                  {hasRealApp ? 'Currently tracking' : 'Waiting for app'}
                </div>
                <div className="flex items-center justify-center gap-2">
                  {hasRealApp ? (
                    <span
                      className="px-3 py-1 rounded-full text-xs font-mono font-medium"
                      style={{
                        backgroundColor: isDistracting
                          ? 'rgba(239, 68, 68, 0.08)'
                          : isCurrentlyProductive
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'rgba(107, 114, 128, 0.08)',
                        color: isDistracting
                          ? '#f87171'
                          : isCurrentlyProductive
                            ? '#6ee7b7'
                            : '#9ca3af',
                        border: `1px solid ${isDistracting ? 'rgba(239,68,68,0.12)' : isCurrentlyProductive ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)'}`,
                      }}
                    >
                      {currentWebsite
                        ? currentWebsite.category
                        : (currentApp?.category || (isInBrowser ? 'Browser' : (lastTier ? lastTier.charAt(0).toUpperCase() + lastTier.slice(1) : 'Unknown')))}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 text-zinc-500 border border-zinc-700 light:border-zinc-300/30 light:border-zinc-300/30">
                      No App
                    </span>
                  )}
                </div>
                {isInBrowser && currentWebsite?.browserName && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          currentWebsite.browserName === 'chrome' ? '#3b82f6' :
                          currentWebsite.browserName === 'firefox' ? '#ff6611' :
                          currentWebsite.browserName === 'edge' ? '#0078d4' :
                          currentWebsite.browserName === 'brave' ? '#fb542b' :
                          currentWebsite.browserName === 'opera' ? '#ff1b2d' :
                          currentWebsite.browserName === 'comet' ? '#8b5cf6' : '#6b7280'
                      }}
                    />
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                      {currentWebsite.browserName}
                      {currentWebsite.profileName && (
                        <span className="text-zinc-600 normal-case tracking-normal"> · {currentWebsite.profileName}</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="text-lg font-medium text-zinc-200">
                  {isInBrowser && currentWebsite
                    ? (currentWebsite.title || currentWebsite.domain || 'Browsing...')
                    : currentApp
                      ? (currentApp.app || currentApp.title)
                      : (isInBrowser ? 'Browsing...' : (lastTier && displayTime.ms > 0 ? (lastTier === 'productive' ? 'Productive Session' : lastTier === 'distracting' ? 'Distracting Session' : 'Active Session') : 'Switch to another app to start tracking'))}
                </div>
              </motion.div>
            )}

            <div className="text-[10px] text-zinc-600 pt-4 border-t border-zinc-800 light:border-zinc-200/50 light:border-zinc-200/50">
              {externalSessionRunning
                ? `External activity: ${selectedExternalActivity?.name}. Timer running.`
                : (!hasRealApp
                  ? 'No app detected. Switch to a window to start tracking.'
                  : (isCurrentlyProductive
                    ? 'Productive work detected. Timer running.'
                    : 'No productive activity detected. Open an IDE, editor, or learning tool to start.'))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
