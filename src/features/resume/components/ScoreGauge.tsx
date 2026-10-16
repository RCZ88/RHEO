import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../../../components/ui/number-ticker';

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export function ScoreGauge({ score, size = 120 }: ScoreGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 75) return '#16a34a';
    if (s >= 50) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <AnimatedCircularProgressBar
        value={score}
        size={size}
        strokeWidth={10}
        gaugePrimaryColor={getColor(score)}
        gaugeSecondaryColor="color-mix(in srgb, var(--color-foreground) 14%, transparent)"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumberTicker
          value={score}
          className="text-2xl font-bold text-[var(--color-foreground)] tabular-nums"
        />
        <span className="text-[10px] text-[var(--color-muted-foreground)] font-medium">/ 100</span>
      </div>
    </div>
  );
}
