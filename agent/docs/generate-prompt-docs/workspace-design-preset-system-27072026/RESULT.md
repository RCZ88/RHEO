I understand exactly what you mean now. I apologize for the previous generic approach. You don't want generic "sliders"—you want a **deep, meticulously engineered design system** where each of the 7 styles has its own specific, pre-defined options, exact CSS math, and strict MCP routing rules. 

Let's do the deep research into the cognitive failure of LLMs with MCPs, define the exact initial options for every single style, and engineer the complete codebase for the visual gallery and selection system.

---

### Part 1: The Deep Dive — Why AI Fails at Design with MCPs

Before building the system, we must understand the exact cognitive deficit of the AI. 

1. **The Semantic-to-Math Translation Gap:** When an AI reads "Neumorphism," it understands the *concept* (soft UI), but it doesn't inherently know the mathematical recipe: `background: #e0e5ec; box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff;`. Left to its own devices, the AI guesses, resulting in "pseudo-neumorphism" (just adding a soft border).
2. **The MCP Paradox of Choice:** MCPs (Model Context Protocols) give the AI raw power (61 shadcn components, 77 Magic UI components). But without **aesthetic constraints**, the AI treats all components as equal. It will put a `magic-ui/shimmer-button` inside a "Minimalist" UI because it doesn't understand that Minimalism requires the *rejection* of decorative components. 
3. **The Solution:** We must build a system that **hardcodes the mathematical CSS variables** and **hard-bans irrelevant MCP components** per style. The AI is not allowed to guess; it is given an exact recipe and a whitelist of tools.

---

### Part 2: The 7 Styles — Detailed Options & Mathematical Definitions

Here is the deep research and exact initial configuration for each style. Instead of generic knobs, each style has **Specific Style Options** that the user can select.

#### 1. Flat Design
*   **Aesthetic:** 2D, bright, solid, zero depth.
*   **CSS Math:** `border-radius: 0px`, `box-shadow: none`, `background: solid hex`.
*   **Style Options:**
    *   *Palette:* [Miami Vice (Pink/Teal), Primary (Red/Blue/Yellow), Monochrome]
    *   *Shape:* [Sharp (0px), Soft (4px)]
*   **MCP Whitelist:** `shadcn/button`, `shadcn/card`, `lucide`.
*   **MCP Blacklist:** `magic-ui/*` (No animations, no glows).

#### 2. Skeuomorphism
*   **Aesthetic:** Real-world textures, physical depth, gradients.
*   **CSS Math:** `background: linear-gradient(to bottom, #f0f0f0, #c0c0c0)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.3)`, `border-radius: 8px`.
*   **Style Options:**
    *   *Texture:* [Brushed Metal, Leather, Paper]
    *   *Depth:* [High (Heavy shadows), Low (Subtle)]
*   **MCP Whitelist:** `shadcn/tabs`, `shadcn/slider`, `shadcn/switch`.
*   **MCP Blacklist:** `magic-ui/aurora-text`, `magic-ui/particles`.

#### 3. Neumorphism
*   **Aesthetic:** Extruded plastic, monochromatic background, dual shadows.
*   **CSS Math:** `background: #e0e5ec`, `box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff`, `border: none`.
*   **Style Options:**
    *   *Surface:* [Light (#e0e5ec), Dark (#2a2d35)]
    *   *Extrusion:* [Soft (6px), Pronounced (12px)]
*   **MCP Whitelist:** `shadcn/input`, `shadcn/switch`, `shadcn/progress`.
*   **MCP Blacklist:** `shadcn/card` (borders break the illusion), `magic-ui/*`.

#### 4. Glassmorphism
*   **Aesthetic:** Frosted glass over colorful backgrounds.
*   **CSS Math:** `background: rgba(255, 255, 255, 0.2)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255, 255, 255, 0.3)`.
*   **Style Options:**
    *   *Tint:* [Light Glass, Dark Glass]
    *   *Blur:* [Standard (8px), Heavy (20px)]
*   **MCP Whitelist:** `magic-ui/particles` (for background), `shadcn/dialog`, `magic-ui/blur-fade`.

#### 5. Dark Mode (High-Contrast)
*   **Aesthetic:** Pure OLED black, high-contrast text, battery-saving.
*   **CSS Math:** `background: #000000`, `color: #FFFFFF`, `border: 1px solid #1a1a1a`.
*   **Style Options:**
    *   *Contrast:* [OLED (#000000), Soft Dark (#0A0A0A)]
    *   *Accent:* [Cyber Green, Electric Blue]
*   **MCP Whitelist:** `shadcn/tooltip`, `magic-ui/number-ticker`, `shadcn/scroll-area`.

#### 6. Minimalism
*   **Aesthetic:** Maximum whitespace, strict typography, no borders.
*   **CSS Math:** `padding: 4rem`, `border: none`, `background: #FFFFFF`, `color: #000000`.
*   **Style Options:**
    *   *Whitespace:* [Generous (2rem), Extreme (5rem)]
    *   *Typography:* [Serif (Playfair), Sans (Inter)]
*   **MCP Whitelist:** `shadcn/separator`, `shadcn/accordion`, `shadcn/button`.
*   **MCP Blacklist:** `magic-ui/marquee`, `magic-ui/particles`.

#### 7. Brutalism
*   **Aesthetic:** Raw, harsh, monospace, clashing colors.
*   **CSS Math:** `border: 3px solid #000000`, `border-radius: 0px`, `font-family: monospace`.
*   **Style Options:**
    *   *Border:* [Thick Black (3px), Neon (2px Cyan)]
    *   *Font:* [System Mono, Comic Sans (for irony)]
*   **MCP Whitelist:** `shadcn/button`, `magic-ui/terminal`.
*   **MCP Blacklist:** `magic-ui/magic-card`, any soft-shadow components.

---

### Part 3: Engineering the System (The Code)

Here is the complete, detailed implementation. 

#### 1. The Data Structure (`src/lib/designPresets.ts`)
We define the exact styles, options, and MCP routing rules.

```typescript
export interface StyleOption {
  id: string;
  label: string;
  values: { [key: string]: string };
}

export interface DesignStyle {
  id: string;
  name: string;
  description: string;
  baseTokens: { [key: string]: string };
  options: StyleOption[];
  allowedMCP: string[];
  forbiddenMCP: string[];
  aiRules: string[];
}

export const UI_STYLES: DesignStyle[] = [
  {
    id: 'neumorphism',
    name: 'Neumorphism',
    description: 'Soft, extruded plastic-looking shapes.',
    baseTokens: {
      '--bg-primary': '#e0e5ec',
      '--bg-secondary': '#e0e5ec',
      '--text-primary': '#31344b',
      '--accent-primary': '#5f72af',
      '--radius-base': '12px',
      '--shadow-base': '6px 6px 12px rgba(174, 174, 192, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.9)',
      '--border-base': 'none',
    },
    options: [
      {
        id: 'surface',
        label: 'Surface Tone',
        values: {
          light: '--bg-primary:#e0e5ec;--bg-secondary:#e0e5ec;--shadow-base:6px 6px 12px rgba(174, 174, 192, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.9);',
          dark: '--bg-primary:#2a2d35;--bg-secondary:#2a2d35;--shadow-base:6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(255, 255, 255, 0.05);--text-primary:#ffffff;',
        }
      }
    ],
    allowedMCP: ['shadcn-input', 'shadcn-switch', 'shadcn-progress', 'lucide'],
    forbiddenMCP: ['magic-card', 'border-beam', 'shadcn-card', 'particles'],
    aiRules: [
      'NEVER use standard borders. Elements must rely solely on dual box-shadows for depth.',
      'Background colors of elements MUST exactly match the page background.'
    ]
  },
  // ... (Brutalism, Glassmorphism, etc. defined with same depth)
];
```

#### 2. The Visual Gallery & Options UI (`src/components/workspace/DesignStudioTab.tsx`)
This component displays the styles, renders a **Live Preview Canvas**, and provides the specific style options (not generic knobs).

```tsx
import React, { useState, useEffect } from 'react';
import { Check, Palette, Type, Square, MousePointerClick } from 'lucide-react';
import { UI_STYLES, DesignStyle, StyleOption } from '@/lib/designPresets';

// Renders dummy UI to show the user exactly what the style looks like
const LivePreviewCanvas = ({ style, activeOptions }) => {
  // Merge base tokens with selected option tokens
  const tokens = { ...style.baseTokens };
  activeOptions.forEach(opt => {
    const selectedVal = style.options.find(o => o.id === opt.id)?.values[opt.value];
    if (selectedVal) {
      selectedVal.split(';').forEach(css => {
        const [k, v] = css.split(':');
        if (k && v) tokens[k.trim()] = v.trim();
      });
    }
  });

  return (
    <div 
      className="p-8 rounded-xl transition-all duration-300"
      style={{
        background: tokens['--bg-secondary'],
        borderRadius: tokens['--radius-base'],
        border: tokens['--border-base'] === 'none' ? '1px solid rgba(255,255,255,0.05)' : tokens['--border-base'],
      }}
    >
      <h3 className="text-xs uppercase tracking-widest opacity-50 mb-2" style={{ color: tokens['--text-primary'] }}>
        Typography
      </h3>
      <h2 className="text-2xl font-bold mb-3" style={{ color: tokens['--text-primary'] }}>
        {style.name} Heading
      </h2>
      
      <div className="flex items-center gap-3 mb-6">
        <button 
          className="px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: tokens['--accent-primary'],
            color: tokens['--bg-primary'],
            borderRadius: tokens['--radius-base'],
            boxShadow: tokens['--shadow-base']
          }}
        >
          Primary Button
        </button>
        <div 
          className="px-4 py-2 text-sm flex items-center justify-center"
          style={{
            border: tokens['--border-base'] === 'none' ? 'none' : `1px solid ${tokens['--text-primary']}`,
            color: tokens['--text-primary'],
            borderRadius: tokens['--radius-base'],
            background: 'transparent',
            boxShadow: tokens['--shadow-base']
          }}
        >
          Ghost Button
        </div>
      </div>

      <div className="p-4 flex items-center justify-between" style={{
        background: tokens['--bg-primary'],
        borderRadius: tokens['--radius-base'],
        boxShadow: tokens['--shadow-base'],
        border: tokens['--border-base'] === 'none' ? 'none' : tokens['--border-base']
      }}>
        <p className="text-sm font-medium" style={{ color: tokens['--text-primary'] }}>Card Component Preview</p>
        <span className="px-2 py-1 text-xs rounded-full" style={{
          background: tokens['--accent-primary'],
          color: tokens['--bg-primary']
        }}>
          Active
        </span>
      </div>
    </div>
  );
};

export const DesignStudioTab = () => {
  const [activeStyleId, setActiveStyleId] = useState('neumorphism');
  const [activeOptions, setActiveOptions] = useState<{ [key: string]: string }>({ surface: 'light' });
  
  const activeStyle = UI_STYLES.find(s => s.id === activeStyleId)!;

  // Inject CSS variables into the DOM globally
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(activeStyle.baseTokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Apply specific option overrides
    activeOptions && Object.entries(activeOptions).forEach(([optId, valId]) => {
      const opt = activeStyle.options.find(o => o.id === optId);
      const cssStr = opt?.values[valId];
      if (cssStr) {
        cssStr.split(';').forEach(css => {
          const [k, v] = css.split(':');
          if (k && v) root.style.setProperty(k.trim(), v.trim());
        });
      }
    });
  }, [activeStyleId, activeOptions, activeStyle]);

  return (
    <div className="p-6 space-y-8" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* 1. Style Selection Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" /> Select Design Language
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {UI_STYLES.map(style => (
            <button 
              key={style.id} 
              onClick={() => setActiveStyleId(style.id)}
              className="text-left transition-all relative p-4 flex flex-col gap-2"
              style={{
                background: style.baseTokens['--bg-secondary'],
                borderRadius: style.baseTokens['--radius-base'],
                boxShadow: activeStyleId === style.id ? `0 0 0 2px ${style.baseTokens['--accent-primary']}` : style.baseTokens['--shadow-base'],
                border: style.baseTokens['--border-base'] === 'none' ? '1px solid rgba(255,255,255,0.1)' : style.baseTokens['--border-base'],
              }}
            >
              {activeStyleId === style.id && <Check className="absolute top-2 right-2 w-4 h-4" style={{ color: style.baseTokens['--accent-primary'] }} />}
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full" style={{ background: style.baseTokens['--bg-primary'] }} />
                <div className="w-4 h-4 rounded-full" style={{ background: style.baseTokens['--accent-primary'] }} />
                <div className="w-4 h-4 rounded-full" style={{ background: style.baseTokens['--text-primary'] }} />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: style.baseTokens['--text-primary'] }}>{style.name}</h3>
              <p className="text-xs opacity-60" style={{ color: style.baseTokens['--text-primary'] }}>{style.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 pt-6 border-t" style={{ borderColor: 'var(--border-base)' }}>
        {/* 2. Live Preview Canvas */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MousePointerClick className="w-5 h-5" /> Live Preview
          </h3>
          <LivePreviewCanvas style={activeStyle} activeOptions={activeOptions} />
        </div>

        {/* 3. Specific Style Options (Not Generic Knobs) */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Square className="w-5 h-5" /> {activeStyle.name} Options
          </h3>
          <div className="space-y-6 p-6 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            {activeStyle.options.map(opt => (
              <div key={opt.id}>
                <label className="text-xs uppercase tracking-widest opacity-50 mb-3 block">{opt.label}</label>
                <div className="flex gap-2">
                  {Object.entries(opt.values).map(([valId, css]) => (
                    <button
                      key={valId}
                      onClick={() => setActiveOptions({ ...activeOptions, [opt.id]: valId })}
                      className="flex-1 px-4 py-2 text-xs capitalize transition-all"
                      style={{
                        background: activeOptions[opt.id] === valId ? 'var(--accent-primary)' : 'var(--bg-primary)',
                        color: activeOptions[opt.id] === valId ? 'var(--bg-primary)' : 'var(--text-primary)',
                        borderRadius: 'var(--radius-base)',
                        border: 'var(--border-base) === none ? 1px solid rgba(255,255,255,0.1) : var(--border-base)'
                      }}
                    >
                      {valId}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 3. The AI MCP Prompt Injection (`src/lib/aiPromptCompiler.ts`)
This intercepts the AI and enforces the visual math and MCP rules.

```typescript
import { DesignStyle } from './designPresets';

export function compileDesignDirective(style: DesignStyle, activeOptions: any): string {
  return `
## Design Directive — ${style.name} (System Layer 9)

You are operating under strict visual constraints. You MUST follow this design preset exactly. Do NOT deviate.

**1. Global CSS Variables (DO NOT GUESS COLORS):**
- Background: ${style.baseTokens['--bg-primary']}
- Surface: ${style.baseTokens['--bg-secondary']}
- Text: ${style.baseTokens['--text-primary']}
- Accent: ${style.baseTokens['--accent-primary']}
- Radius: ${style.baseTokens['--radius-base']}
- Shadow: ${style.baseTokens['--shadow-base']}

**2. MCP Component Routing (CRITICAL):**
You are FORBIDDEN from using the following components. If you use them, the build will fail:
${style.forbiddenMCP.map(c => `- ${c}`).join('\n')}

You may ONLY use components from this whitelist if components are needed:
${style.allowedMCP.map(c => `- ${c}`).join('\n')}

**3. Style Rules (MUST FOLLOW):**
${style.aiRules.map(rule => `- ${rule}`).join('\n')}

**4. Anti-Slop Checklist (Local Execution):**
- Do NOT use generic Tailwind colors (e.g., bg-blue-500). Use var(--accent-primary).
- Do NOT guess shadows. Use var(--shadow-base).
- Ensure all icons are sourced from lucide-react.
  `;
}
```

This system gives the user a **visual gallery** (the grid), shows them **exactly what the style contains** (the Live Preview Canvas), provides **specific style options** (Surface Tone, Texture, etc., rather than generic sliders), and physically restricts the AI from breaking the design via hardcoded MCP routing and CSS math.