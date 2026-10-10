interface KnobSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  className?: string;
}

export function KnobSlider({ label, value, min, max, step = 1, onChange, displayValue, className = '' }: KnobSliderProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-[10px] font-mono text-[var(--text-primary)]">{displayValue || value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
