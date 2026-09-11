# Floating Canvas Navigation — Stitch Design Brief (05/08/2026)

> Purpose: this is the prompt to paste into **Google Stitch** to design the
> "floating canvas navigation" mode for RHEO/DeskFlow (Electron + React + Tailwind v4).
> The Stitch MCP from opencode CLI consistently timed out, so CZ pastes this directly
> in the Stitch UI.

## Where to design

- Project: **Dynamic Canvas Navigator** (id `876738276259824411`)
- Reuse the existing design system "Clean Glassmorphism" (Deep Obsidian `#020617`,
  noise 2%, `backdrop-filter: blur(20px)`, 1px refraction gradient borders,
  Electric Cyan `#00f0ff` / Emerald `#10b981` / Royal Purple `#8b5cf6`, Geist font,
  Material Symbols Outlined icons, bloom glows instead of shadows).
- Reuse existing screen **"Canvas Navigation Hub"** — ask Stitch to expand it
  (Edit/Regenerate), or create a new screen.

## Feature summary

RHEO is a personal productivity OS. Today it has a traditional left sidebar with 13
pages. The user wants an alternative **canvas navigation mode**: a full-screen,
floating "node universe" where each page is a glass node whose theme previews the
content of that page. The two modes (traditional sidebar ↔ canvas hub) are switched
with a toggle. Dashboard + AI System are the hero nodes.

## The exact Stitch prompt (paste verbatim)

```
Expand the current Canvas Navigation Hub into a full 13-page navigation universe where
EVERY node has its own unique theme that mirrors its page's content. Keep the project
design system exactly: Deep Obsidian glassmorphism, backdrop blur 20px, 1px refraction
borders, Electric Cyan #00f0ff primary, Emerald #10b981 secondary, Royal Purple
#8b5cf6 tertiary, Geist font, bloom glows instead of shadows, noise texture background.

Hard requirements:
(1) AI System and Dashboard are the TWO MAIN HERO NODES. AI System = the largest node,
a big glowing circle emitting a violet→cyan animated gradient ring with pulse, placed
as the visual centerpiece. Dashboard = second-largest hero node with white/silver
gradient icon, placed prominently opposite the AI node.
(2) Every one of the 13 pages must be present as a floating glass node, EACH with its
own unique accent color + Material Symbol icon resembling its page content:
Dashboard (white/silver, dashboard icon), AI System (violet #8b5cf6→cyan gradient,
psychology icon), Finance (emerald #10b981, payments icon), IDE Projects (blue,
terminal icon), Resume (indigo #6366f1, description icon), Life (warm amber/clay,
favorite icon), Activity (sky blue #38bdf8, activity icon), Learn (amber #f59e0b,
graduation_cap icon), External (sky/teal, hourglass icon), Insights (cyan #22d3ee,
bar_chart icon), Database (royal blue, database icon), Settings (zinc/slate, settings
icon), Guide (teal, menu_book icon).
(3) Layout: balanced floating constellation around the two heroes, nodes at varying
sizes (heroes large 128-160px, main pages medium 96-112px, secondary pages small
72-80px), with faint glowing connection lines linking nodes to the AI center. Nodes
must NOT overlap each other or the screen edges.
(4) Keep the "Sidebar Mode" pill toggle button (glass-refraction, cyan text,
toggle_on icon) top-right and the "Aetheris OS" brand top-left.
(5) Background: nebula radial gradients (cyan + purple, very low opacity), static
noise 2%, subtle rotation.
(6) Hover interactions: each node lifts and blooms a glow in ITS OWN accent color;
labels brighten to the node's accent.
(7) Clean, airy, "water transparency" feel — never cluttered, generous 40px+ margins
from screen edges.
```

## Per-page theme table (source of truth)

| # | Page | Route | Theme (accent) | Icon (lucide in-app / Material in Stitch) |
|---|------|-------|----------------|---------------------------------------------|
| 1 | Dashboard | `/` | white/silver | Home / dashboard |
| 2 | AI System | `/ai` | violet→cyan gradient | Brain / psychology |
| 3 | Finance | `/finance` | emerald #10b981 | Wallet / payments |
| 4 | IDE Projects | `/ide` | blue | Code2 / terminal |
| 5 | Resume | `/resume` | indigo #6366f1 | FileText / description |
| 6 | Life | `/life` | warm amber/clay | HeartHandshake / favorite |
| 7 | Activity | `/activity` | sky #38bdf8 | Activity / activity |
| 8 | Learn | `/learn` | amber #f59e0b | GraduationCap / graduation_cap |
| 9 | External | `/external` | sky/teal | Clock4 / hourglass |
| 10 | Insights | `/reports` | cyan #22d3ee | BarChart3 / bar_chart |
| 11 | Database | `/database` | royal blue | Database / database |
| 12 | Settings | `/settings` | zinc/slate | Settings / settings |
| 13 | Guide | `/guide` | teal | BookOpen / menu_book |

## Engineering handoff notes (for later local implementation)

- Two modes: `'sidebar' | 'canvas'`, persisted in localStorage (`df-nav-mode`),
  toggled from: (a) sidebar header button, (b) canvas hub top-right pill.
- Canvas hub reads the SAME `DEFAULT_SIDEBAR_ITEMS` list + `df-sidebar-order`
  (reorderable sidebar feature already shipped) — single source of truth for order.
- Clicking a node → existing `handleSidebarNavigation(path)` (keeps unsaved-changes
  guards on /terminal, /resume, /finance etc.).
- Tech: `framer-motion` (installed) for floating entrance/exit + hover lift;
  `@dnd-kit` (installed) for free-position dragging of nodes; node positions
  persisted in localStorage (`df-canvas-pos`); per-node theme from a
  `NAV_THEMES[path]` map mirroring the existing `--page-accent` system.
- Node hover glow: per-node accent box-shadow bloom; connection lines = SVG paths
  with animated stroke (Magic UI AnimatedBeam pattern) between nodes and AI core.
- Background: fixed nebula gradients + `dot-pattern`/noise (reuse existing
  `dot-pattern.tsx`, useId-fixed) at low opacity.
- When canvas mode is on, hide the app sidebar; show a small floating "Canvas"
  (Grid2X2) button on other pages to reopen the hub.
