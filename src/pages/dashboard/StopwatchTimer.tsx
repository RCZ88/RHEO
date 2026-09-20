import { motion, AnimatePresence } from 'motion/react';
import { Pause, Ban, Target, Timer } from 'lucide-react';

function formatDuration(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getTimerColor(
  isDistracting: boolean,
  isCurrentlyProductive: boolean,
  isExternal: boolean,
): string {
  if (isExternal) return 'var(--page-accent)';
  if (isDistracting) return 'var(--error)';
  if (isCurrentlyProductive) return 'var(--success)';
  return 'var(--text-muted)';
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
}: StopwatchTimerProps) {
  const isActive = isCurrentlyProductive || externalSessionRunning || isDistracting;
  const timerColor = getTimerColor(isDistracting, isCurrentlyProductive, displayTime.label.includes('External'));
  const isExternal = displayTime.label.includes('External');

  return (
    <div className="flex-1 min-w-0">
      <div className="rounded-[10px] h-full p-5 sm:p-12 relative overflow-hidden bg-[var(--color-card)] border-t border-[var(--ws-border)]">
        <div className="text-center space-y-6 relative">
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2">
            <AnimatePresence mode="wait">
              {isPaused ? (
                <motion.div
                  key="paused"
                  className="flex items-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.14 }}
                >
                  <span className="inline-flex">
                    <span className="w-[3px] h-3 rounded-full bg-zinc-500 inline-block" />
                    <span className="w-[3px] h-3 rounded-full bg-zinc-500 inline-block ml-1" />
                  </span>
                  Paused
                </motion.div>
              ) : isExternal ? (
                <motion.div
                  key="external"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.14 }}
                >
                  {displayTime.label}
                </motion.div>
              ) : isDistracting ? (
                <motion.div
                  key="distracting"
                  className="flex items-center gap-1.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.14 }}
                >
                  <Ban size={11} />
                  Distracting — {currentApp?.app || currentApp?.title || currentWebsite?.title || currentWebsite?.domain || 'Unknown App'}
                </motion.div>
              ) : isCurrentlyProductive ? (
                <motion.div
                  key="locked"
                  className="flex items-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.14 }}
                >
                  <Target size={11} />
                  Locked In
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="flex items-center gap-1.5"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.14 }}
                >
                  <Timer size={11} />
                  Idle
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Timer */}
          <motion.div
            key={isExternal ? 'external' : 'main'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.14 }}
            className="font-mono font-bold text-5xl lg:text-7xl xl:text-8xl truncate"
            style={{ lineHeight: '1', letterSpacing: '-0.02em', color: timerColor }}
          >
            {formatDuration(displayTime.ms)}
          </motion.div>

          {externalSessionRunning && selectedExternalActivity && (
            <div className="space-y-3">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">External Activity</div>
              <div className="flex items-center justify-center gap-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-mono font-medium"
                  style={{
                    backgroundColor: 'rgba(var(--page-accent), 0.1)',
                    color: 'var(--page-accent)',
                    border: '1px solid rgba(var(--page-accent), 0.15)',
                  }}
                >
                  {selectedExternalActivity.name}
                </span>
              </div>
            </div>
          )}

          {!externalSessionRunning && (
            <div className="space-y-3">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">
                {hasRealApp ? 'Currently tracking' : 'Waiting for app'}
              </div>
              <div className="flex items-center justify-center gap-2">
                {hasRealApp ? (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-mono font-medium"
                    style={{
                      backgroundColor: isDistracting
                        ? 'rgba(var(--resume-danger), 0.08)'
                        : isCurrentlyProductive
                          ? 'rgba(var(--resume-success), 0.08)'
                          : 'rgba(var(--muted-foreground), 0.08)',
                      color: isDistracting
                        ? 'var(--resume-danger)'
                        : isCurrentlyProductive
                          ? 'var(--resume-success)'
                          : 'var(--muted-foreground)',
                      border: `1px solid ${isDistracting ? 'rgba(var(--resume-danger),0.12)' : isCurrentlyProductive ? 'rgba(var(--resume-success),0.12)' : 'rgba(var(--muted-foreground),0.12)'}`,
                    }}
                  >
                    {currentWebsite
                      ? currentWebsite.category
                      : (currentApp?.category || (isInBrowser ? 'Browser' : (lastTier ? lastTier.charAt(0).toUpperCase() + lastTier.slice(1) : 'Unknown')))}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-800 light:bg-zinc-100/50 text-zinc-500 border border-zinc-700 light:border-zinc-300/30">
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
                        currentWebsite.browserName === 'chrome' ? 'var(--info)' :
                        currentWebsite.browserName === 'firefox' ? 'var(--color-amber-400)' :
                        currentWebsite.browserName === 'edge' ? 'var(--resume-info)' :
                        currentWebsite.browserName === 'brave' ? 'var(--color-amber-400)' :
                        currentWebsite.browserName === 'opera' ? 'var(--resume-danger)' :
                        currentWebsite.browserName === 'comet' ? 'var(--page-accent)' : 'var(--muted-foreground)',
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
            </div>
          )}

          <div className="text-[10px] text-zinc-600 pt-4 border-t border-zinc-800 light:border-zinc-200/50">
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
  );
}
