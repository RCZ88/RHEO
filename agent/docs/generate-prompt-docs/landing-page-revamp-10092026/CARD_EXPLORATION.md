# Card Design Exploration — RHEO Landing
Date: 2026-09-10

## Current Card Problems
1. ModuleStore uses amber (`#fbbf24`, `text-amber`, `border-amber/20`) — violates LAMINAR monochrome
2. Cards are basic `surface-panel` with minimal hover feedback
3. No visual hierarchy between card types (bento vs module vs download)

## Available Card Options

### shadcn/ui components (installed)
| Component | Use for | RHEO Adaptation |
|-----------|---------|-----------------|
| `card` | Base card container | Re-skin to `--card: #101014`, border `--hairline` |
| `hover-card` | Preview on hover | For module cards — show desc on hover |
| `badge` | Kicker labels | Replace amber tags with mono `--low` |
| `button` | CTAs | White fill + `--page` text |
| `skeleton` | Loading states | For footage placeholders |
| `separator` | Divisions | Hairline variant |
| `tooltip` | Definition tooltips | Already in use (Def.tsx) |

### React Bits components (available)
| Component | Use for | RHEO Adaptation |
|-----------|---------|-----------------|
| `TiltedCard` | 3D hover tilt | ModuleStore cards — subtle 2deg max |
| `GlareHover` | Sheen effect | Capabilities demo cards |
| `FluidGlass` | Glass surface | Footage container cards |
| `GlassSurface` | Background layer | Hero caption boxes |

### Magic UI components (available via MCP)
| Component | Use for | RHEO Adaptation |
|-----------|---------|-----------------|
| `AnimatedBeam` | Connecting lines | Between capability cards |
| `BorderBeam` | Hover border animation | ModuleStore card borders |
| `NumberTicker` | Counter animations | ActRecord stat chips |
| `Particles` | Ambient background | Hero section only |
| `GridPattern` | Background texture | Section backgrounds |

## Recommended Card System for RHEO

### A. Capabilities Bento Cards
- Use: shadcn `card` + `LaminarSpotlight` (existing)
- Hover: `card-lift` + `sheen-top` (existing)
- Border: `rgba(255,255,255,0.12)` on hover (up from 0.08)
- Min-height: 292px
- Grid: lg:grid-cols-6, sm:grid-cols-2, 1-col mobile

### B. ModuleStore Cards
- Use: shadcn `card` + `TiltedCard` from React Bits (subtle tilt)
- Replace amber border-beam with white hairline + `sheen-top`
- Mascot area: 84x46px, grayscale, hover scale 110%
- Label: mono 11px `--hi` not amber
- Hover: border brightens to `rgba(255,255,255,0.16)`, lift 3px

### C. Download OS Cards
- Use: shadcn `card` (already implemented)
- Hover: border `rgba(255,255,255,0.22)` for detected OS
- Keep "detected" badge

### D. Footage/Feature Preview Cards
- Use: `FluidGlass` or `GlassSurface` from React Bits
- Aspect: 16:9 for screen recordings
- Border: `rgba(255,255,255,0.08)`, hover `rgba(255,255,255,0.16)`
- Overlay: play button + duration badge

## LAMINAR Token Mapping
- Background: `--color-page: #050506`, `--color-panel: #0a0a0c`, `--color-card: #101014`
- Text: `--hi: #f4f4f5`, `--mid: #a1a1aa`, `--low: #8a8a94` (FIXED from #63636b)
- Hairline: `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.12)` on hover
- Accent: `--accent: #ffffff` only
- Radii: 6/10/16px only
