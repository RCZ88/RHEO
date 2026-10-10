import { useState } from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';

interface StyleDescriptionProps {
  value: string;
  onChange: (value: string) => void;
}

interface PresetGroup {
  name: string;
  items: { label: string; desc: string; text: string }[];
}

const PRESET_GROUPS: PresetGroup[] = [
  {
    name: '🌙 Dark',
    items: [
      { label: 'Galaxy Dark', desc: 'Deep zinc bg, pink/rose accent', text: 'Dark theme with deep zinc background (#09090b) and pink/rose accent colors. High contrast white text on dark surfaces. Minimal, modern, slightly playful.' },
      { label: 'Cyberpunk', desc: 'Neon on deep purple', text: 'Cyberpunk aesthetic — deep purple/black background, neon magenta primary, cyan accent. Glowing interactive elements, high energy.' },
      { label: 'Ocean Deep', desc: 'Navy + teal accents', text: 'Dark blue/navy background with teal and blue accent colors. Clean, professional, trustworthy. Good for B2B or productivity apps.' },
      { label: 'Midnight', desc: 'Slate + emerald', text: 'Dark slate background with emerald green accents. Muted, elegant, sophisticated. Good for finance or wellness apps.' },
    ],
  },
  {
    name: '☀️ Light',
    items: [
      { label: 'Minimal Light', desc: 'Clean white + emerald', text: 'Clean white background with subtle gray surfaces and emerald green accent. Minimal, airy, modern. Standard SaaS aesthetic.' },
      { label: 'Warm Earth', desc: 'Terracotta + cream', text: 'Warm terracotta and cream tones with brown text. Editorial, cozy, earthy. Good for content-heavy or lifestyle apps.' },
      { label: 'Soft Pastel', desc: 'Muted pastels, rounded', text: 'Soft pastel backgrounds (lavender, blush, mint) with rounded corners and gentle shadows. Friendly, approachable, casual.' },
    ],
  },
  {
    name: '🎨 Vibrant',
    items: [
      { label: 'Sunset', desc: 'Orange + purple gradient', text: 'Warm sunset gradient background (orange to purple) with dark text. Energetic, bold, creative. Good for media or creative tools.' },
      { label: 'Retro Wave', desc: '80s synthwave aesthetic', text: 'Synthwave / OutRun aesthetic — deep purple/black background, hot pink primary, cyan secondary. Grid backgrounds optional.' },
      { label: 'Playful', desc: 'Multi-color, rounded', text: 'Multiple accent colors (pink, yellow, blue), large rounded corners, playful typography. Casual, fun, consumer-focused.' },
    ],
  },
  {
    name: '🎯 Minimal',
    items: [
      { label: 'Black & White', desc: 'Monochromatic, no color', text: 'True black and white only — no accent colors. Pure typographic hierarchy. Bold, editorial, maximum contrast.' },
      { label: 'GrayScale', desc: 'Zinc grays + one accent', text: 'Zinc/gray palette with a single accent color (your choice). Balanced, professional, design-system-ready.' },
      { label: 'Glassmorphism', desc: 'Frosted glass effects', text: 'Frosted glass surfaces (backdrop blur, semi-transparent backgrounds) on dark base. Depth through layering and blur.' },
    ],
  },
];

export function StyleDescription({ value, onChange }: StyleDescriptionProps) {
  const [showGuidance, setShowGuidance] = useState(false);

  return (
    <div className="p-4 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Style Description</h3>
        <button
          onClick={() => setShowGuidance(!showGuidance)}
          className="px-2 py-1 text-[9px] font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors inline-flex items-center gap-1"
        >
          <Lightbulb className="w-3 h-3" />
          {showGuidance ? 'Hide' : 'Suggestions'}
        </button>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe your design style — colors, mood, inspiration..."
        rows={3}
        className="w-full px-3 py-2 text-[11px] bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-700/50 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 resize-none"
      />

      {/* Guidance / Presets */}
      {showGuidance && (
        <div className="space-y-3 p-3 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg max-h-60 overflow-y-auto">
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            Describe the visual style you want. Include: color palette, mood (professional, playful, minimal), typography feel, and specific UI patterns you like.
          </p>
          {PRESET_GROUPS.map(group => (
            <div key={group.name}>
              <div className="text-[9px] font-medium text-zinc-400 mb-1.5">{group.name}</div>
              <div className="flex flex-wrap gap-1">
                {group.items.map(item => (
                  <button
                    key={item.label}
                    onClick={() => onChange(item.text)}
                    className="group px-2 py-1 text-[8px] text-left rounded bg-zinc-800/40 hover:bg-zinc-700/50 border border-zinc-700/30 hover:border-zinc-600/50 transition-all"
                    title={item.desc}
                  >
                    <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">{item.label}</span>
                    <span className="block text-[7px] text-zinc-600">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!value && !showGuidance && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[8px] text-zinc-600 self-center mr-1">Quick picks:</span>
          {['Dark theme with pink accent', 'Minimal black/white', 'Cyberpunk neon', 'Warm earth tones'].map(ex => (
            <button
              key={ex}
              onClick={() => onChange(ex)}
              className="px-2 py-1 text-[8px] text-zinc-500 bg-zinc-800/50 hover:bg-zinc-800 hover:text-zinc-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
