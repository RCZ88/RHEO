import { FunFactHero } from '../../components/insights/FunFactHero';
import { StopwatchTimer } from './StopwatchTimer';

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

interface HeroBandProps {
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
  goalCurrent: number;
  goalMax?: number;
  /** Deep Focus session active -> the GoalRing ember roars. */
  focusActive?: boolean;
}

export function HeroBand({
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
  goalCurrent,
  goalMax = 120,
  focusActive = false,
}: HeroBandProps) {
  return (
    <div className="flex flex-col w-full gap-4">
      {/* Daily insight — full width, above stopwatch */}
      <FunFactHero />
      {/* Stopwatch */}
      <div className="flex w-full">
        <StopwatchTimer
          displayTime={displayTime}
          isPaused={isPaused}
          isCurrentlyProductive={isCurrentlyProductive}
          isDistracting={isDistracting}
          externalSessionRunning={externalSessionRunning}
          selectedExternalActivity={selectedExternalActivity}
          hasRealApp={hasRealApp}
          currentApp={currentApp}
          currentWebsite={currentWebsite}
          isInBrowser={isInBrowser}
          lastTier={lastTier}
          borderColor={borderColor}
        />
      </div>
    </div>
  );
}
