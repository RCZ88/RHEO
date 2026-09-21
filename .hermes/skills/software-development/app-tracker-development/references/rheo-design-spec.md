# RHEO Design System Reference

## Design Tokens (App Default — "RHEO Dark")

The app's base design system uses these tokens, NOT any of the named console themes (tokyo-night, dracula, gruvbox, nord, matrix, rosepine, solar-light).

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#09090b` | Root background (zinc-950) |
| `--bg2` | `#0a0a0a` | Secondary background |
| `--panel` | `#18181b` | Panel/card background (zinc-900) |
| `--panel2` | `#1f1f23` | Secondary panel |
| `--line` | `#27272a` | Border divider (zinc-700) |
| `--line2` | `#3f3f46` | Secondary border |
| `--txt` | `#e4e4e7` | Primary text (zinc-400) |
| `--dim` | `#a1a1aa` | Muted text |
| `--faint` | `#71717a` | Faint text |
| `--accent` | `#ec4899` | RHEO pink (primary accent) |
| `--accent2` | `#8b5cf6` | RHEO violet (secondary accent) |
| `--accent-dim` | `rgba(236,72,153,.12)` | Pink dim background |

## Living Substrate (Background Effect)

Per the design spec at `agent/docs/design-specs/cross-app-living-substrate.md`:
- `COLOR_BG = #09090b` (always)
- Ambient radial gradients in `--accent` and `--accent2`
- CSS animation `substrate-drift` for subtle organic movement
- Glass content at `z-[10]` over substrate at `z-[0]`
- `backdrop-filter: blur()` on glass panels

## Per-Page Accent Map

| Page | `--page-accent` | RD tint |
|------|-----------------|---------|
| Dashboard | `#ec4899` (pink) | Pink coral |
| Activity | `#22d3ee` (cyan) | Cyan coral |
| IDE Projects | `#8b5cf6` (violet) | Violet coral |
| Life | `#fbbf24` (amber) | Amber coral |
| Finance | `#10b981` (emerald) | Emerald coral |
| Settings | `#22d3ee` (cyan) | Cyan coral |
| AI Assistant | `#8b5cf6` (violet) | Violet coral |
| Terminal | per-group dynamic | Dynamic |

## Design Spec Location

The full design spec is at: `agent/docs/design-specs/cross-app-living-substrate.md`

## Handbook/CSS Revamp Rule

When revamping `terminal-handbook.html` or any terminal/console CSS:
1. **ALWAYS read `agent/docs/design-specs/cross-app-living-substrate.md` first**
2. Use the RHEO design tokens above, NOT named console themes
3. The handbook CSS variables in `:root` must match the app tokens exactly
4. Add living substrate background effect, glass cards (`backdrop-filter: blur`), and `z-[10]` layering
5. The handbook is a standalone HTML file — it must self-contain all CSS

## Console Themes (Named) — NOT the RHEO default

These are alternate themes selectable via `Cycle theme` (`Ctrl+Shift+Y`) in the terminal — they are NOT the default RHEO design:

| id | name | bg | accent |
|----|------|----|--------|
| tokyo-night | Tokyo Night | #0b0e17 | #7aa2f7 |
| dracula | Dracula Pro | #0d0f1a | #bd93f9 |
| gruvbox | Gruvbox Dark | #0f0e0c | #fabd2f |
| nord | Nord Frost | #0e1319 | #88c0d0 |
| matrix | Matrix Console | #030a05 | #00ff88 |
| rosepine | Rosé Pine | #0f0d13 | #ebbcba |
| solar-light | Solar Paper | #f6f1e7 | #b45309 |
| **rheo-dark** | **RHEO Dark** | **#09090b** | **#ec4899** |

Note: `rheo-dark` was added as the 8th theme in `src/terminal/lib/data.ts` and is the app's actual default (set in `DEFAULT_APPEARANCE.themeId`).
