import { useCallback } from 'react';

export interface TasteKnobValues {
  designVariance: number;
  motionIntensity: number;
  visualDensity: number;
}

interface TasteKnobsProps {
  values: TasteKnobValues;
  onChange: (values: TasteKnobValues) => void;
}

const KNOB_LABELS: Record<keyof TasteKnobValues, { label: string; low: string; high: string }> = {
  designVariance: { label: 'Design Variance', low: 'Conservative', high: 'Experimental' },
  motionIntensity: { label: 'Motion Intensity', low: 'Static', high: 'Cinematic' },
  visualDensity: { label: 'Visual Density', low: 'Airy', high: 'Maximal' },
};

const AESTHETIC_MAP: Record<string, string> = {
  '1,1,1': 'Corporate Minimalism — IBM',
  '1,1,7': 'Bloomberg Terminal — dense, no fluff',
  '1,7,1': 'Apple Marketing — sparse, cinematic',
  '1,7,7': 'Cyberpunk HUD — dense data, extreme motion',
  '7,1,1': 'Brutalist Web — bold, static, airy',
  '7,1,7': 'Neo-Brutalist Dashboard — bold, dense, static',
  '7,7,1': 'Experimental Art — sparse, chaotic',
  '7,7,7': 'Maximalist Chaos — everything, everywhere',
  '5,5,5': 'Balanced SaaS — Stripe, Notion, Linear',
};

function getAesthetic(v: TasteKnobValues): string {
  const key = `${v.designVariance <= 3 ? 1 : v.designVariance >= 7 ? 7 : 5},${v.motionIntensity <= 3 ? 1 : v.motionIntensity >= 7 ? 7 : 5},${v.visualDensity <= 3 ? 1 : v.visualDensity >= 7 ? 7 : 5}`;
  return AESTHETIC_MAP[key] || `Variance ${v.designVariance} · Motion ${v.motionIntensity} · Density ${v.visualDensity}`;
}

function SliderRow({ name, value, onChange }: { name: keyof TasteKnobValues; value: number; onChange: (v: number) => void }) {
  const info = KNOB_LABELS[name];
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{info.label}</label>
        <span className="text-[10px] text-zinc-400 font-mono">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] text-zinc-600 w-12 text-right">{info.low}</span>
        <input
          type="range" min="1" max="10" value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-700 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-pink-500/30 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-[8px] text-zinc-600 w-12">{info.high}</span>
      </div>
    </div>
  );
}

export function TasteKnobs({ values, onChange }: TasteKnobsProps) {
  const handleChange = useCallback((name: keyof TasteKnobValues) => (v: number) => {
    onChange({ ...values, [name]: v });
  }, [values, onChange]);

  const aesthetic = getAesthetic(values);

  return (
    <div className="p-4 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 rounded-lg">
      <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Taste Knobs</h3>
      <div className="space-y-3">
        <SliderRow name="designVariance" value={values.designVariance} onChange={handleChange('designVariance')} />
        <SliderRow name="motionIntensity" value={values.motionIntensity} onChange={handleChange('motionIntensity')} />
        <SliderRow name="visualDensity" value={values.visualDensity} onChange={handleChange('visualDensity')} />
      </div>
      <div className="mt-3 px-3 py-2 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-800/30">
        <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Aesthetic: </span>
        <span className="text-[10px] text-pink-400 font-medium">{aesthetic}</span>
      </div>
    </div>
  );
}
