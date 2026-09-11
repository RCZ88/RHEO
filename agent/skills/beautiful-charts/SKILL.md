# Reusable Skill Prompt: Modern UI Chart & Data Viz System (Dribbble & Hyper Charts Edition)

```markdown
# SKILL: Modern UI & Futuristic Data Visualization System

## OBJECTIVE
Generate, design, and specify modern, production-grade chart components based on modern Dribbble trends and dark-mode "Hyper Charts" aesthetics. Covers dark neon, light SaaS, bento grid structures, striped textures, glowing nodes, and glassmorphic micro-interactions.

---

## 1. LAYOUT ARCHITECTURE & CONTAINERS

### A. Bento Grid Structure (Dribbble Standard)
* **Corner Radius**: `16px` to `24px` for high-end SaaS feel.
* **Padding**: Internal padding `20px`–`24px`.
* **Surface Background**:
  * *Dark Mode*: Matte dark (`#0B0C10` canvas, `#14161E` card fill) with `1px` stroke (`rgba(255, 255, 255, 0.08)`).
  * *Light Mode*: Pure white (`#FFFFFF`) or subtle off-white (`#F8FAFC`) with border (`#E2E8F0`).
* **Shadows**:
  * *Elevated*: `0px 20px 40px -10px rgba(0, 0, 0, 0.5)` (Dark) or `0px 10px 30px rgba(15, 23, 42, 0.06)` (Light).

### B. Standard Header Component
1. **Primary Metric Header**:
   * Category Label: Uppercase tracking (`letter-spacing: 0.05em`, `11px`, `#8E95A5`).
   * Primary Value: Large bold display (`24px`–`32px`, `font-weight: 700`).
2. **Trend & Comparison Pills**:
   * Positive Delta: `#00FF66` text on `rgba(0, 255, 102, 0.12)` rounded pill (`border-radius: 99px`) with upward arrow `↑`.
   * Negative Delta: `#FF2A4B` text on `rgba(255, 42, 75, 0.12)` pill with downward arrow `↓`.
   * Subtext: Muted reference text (`"vs. last 30 days"`).
3. **Controls**: Top-right corner action group (Timeframe tabs: `1D | 1W | 1M | 1Y` or circular icon menu).

---

## 2. CHART VARIANT LIBRARIES

### Variant 1: Striped Fill Vertical & Horizontal Bars (Hatched Texture)
* **Visual Style**: Bars filled with high-density vertical or 45-degree diagonal striped hatch textures rather than solid color fills.
* **Execution**:
  * CSS: `repeating-linear-gradient(45deg, #00FF66 0px, #00FF66 2px, transparent 2px, transparent 6px)`.
  * Highlight Cap: `2px` solid neon stroke on top edge with `box-shadow: 0 0 10px #00FF66`.

### Variant 2: Segmented Stacked Capsule Pill Matrix
* **Visual Style**: Columns/bars built from stacked, rounded individual capsule pills separated by dark air gaps (`2px`).
* **Geometry**: Segment Pill Height `6px`, Radius `3px`.
* **State Behavior**: Active segments receive gradient color fills; empty top-fill segments are rendered in dark muted wireframe (`rgba(255, 255, 255, 0.05)`).

### Variant 3: Floating Glow Capsules on Track Guides
* **Visual Style**: Isolated rounded pills (`border-radius: 999px`) floating along vertical axis guide lines.
* **Lighting FX**: Soft ambient drop-shadow (`drop-shadow(0 0 12px rgba(0, 240, 255, 0.6))`).
* **Guide Lines**: Faint vertical tracks (`1px` width, `rgba(255, 255, 255, 0.06)`).

### Variant 4: Multi-Layer Smooth Area Chart with Soft Gradient Fills
* **Visual Style**: Curved Bézier line path (`tension: 0.4`) with a fading vertical gradient fill underneath.
* **Fill Style**: Gradient from `rgba(0, 240, 255, 0.35)` at the line top fading down to `rgba(0, 240, 255, 0.0)` at the X-axis.
* **Data Point Nodes**: Double-ring pulsing dots at key data vertices (Outer ring: `rgba(0, 240, 255, 0.2)` pulsing ring; Inner core: `#FFFFFF` solid circle).

### Variant 5: Modern Candlestick / Crypto Trading Chart
* **Visual Style**: High/low vertical wick lines (`1px`) with solid rounded rectangle bodies.
* **Bullish (Up)**: Neon Lime Green (`#00FF66`) or Cyan (`#00F0FF`).
* **Bearish (Down)**: Cyber Magenta (`#FF007A`) or Crimson Red (`#FF2A4B`).
* **Glow State**: Hovered candle glows brightly against muted neighboring candles.

### Variant 6: Concentric Donut & Radial Progress Rings
* **Visual Style**: Multiple nested circular progress arcs on a dark background.
* **Cap Style**: Round stroke caps (`stroke-linecap="round"`).
* **Track Layer**: Faint background track (`rgba(255, 255, 255, 0.06)`).
* **Center Metric**: Large bold metric displayed inside the center core.

### Variant 7: Funnel & Step Conversion Charts
* **Visual Style**: Trapezoidal or stepped horizontal bars that taper down across stage conversion funnels.
* **Connector Visuals**: Gradient drop-down connectors between stages showing `% retention / drop-off rate`.

---

## 3. INTERACTIVE STATES & GLASSMORPHIC TOOLTIPS

### Floating Glass Tooltip Spec
* **Background**: `rgba(20, 22, 30, 0.75)` with `backdrop-filter: blur(16px)`.
* **Border**: `1px` stroke (`rgba(255, 255, 255, 0.15)`).
* **Shadow**: `0px 12px 32px rgba(0, 0, 0, 0.5)`.
* **Crosshair Indicator**: Dashed vertical guide line (`stroke-dasharray: 4 4`, `rgba(255, 255, 255, 0.2)`) snapping to active data node.

---

## 4. COLOR PALETTE & LIGHTING SYSTEM

| Theme/Role | Accent Color | Hex Code | Glow / Drop-Shadow Spec |
| :--- | :--- | :--- | :--- |
| **Neon Lime** | Primary Metric | `#00FF66` | `0px 0px 16px rgba(0, 255, 102, 0.5)` |
| **Electric Cyan** | Secondary Metric | `#00F0FF` | `0px 0px 16px rgba(0, 240, 255, 0.5)` |
| **Cyber Magenta** | Alert/Highlight | `#FF007A` | `0px 0px 14px rgba(255, 0, 122, 0.4)` |
| **Aura Crimson** | Warning/Down | `#FF2A4B` | `0px 0px 20px rgba(255, 42, 75, 0.6)` |
| **Dark Base** | Surface Card | `#14161D` | `0px 20px 40px rgba(0, 0, 0, 0.6)` |

---

## 5. CODE SPECIFICATIONS & SNIPPETS

### CSS Stripe Hatch Fill
```css
.chart-bar-striped {
  background: repeating-linear-gradient(
    0deg,
    #00FF66 0px,
    #00FF66 2px,
    transparent 2px,
    transparent 6px
  );
  border-top: 2px solid #00FF66;
  filter: drop-shadow(0px -2px 8px rgba(0, 255, 102, 0.5));
}

```

### CSS Glassmorphic Tooltip

```css
.chart-tooltip-glass {
  background: rgba(20, 22, 30, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  color: #FFFFFF;
}

```

---

## 6. QUALITY CHECKLIST

* [ ] Is typography set with clear hierarchy (muted labels vs bold high-contrast values)?
* [ ] Do bar charts include top accent strokes or striped textures to prevent plain flat fills?
* [ ] Are hover crosshairs and floating glassmorphic tooltips specified for data detail?
* [ ] Is the color contrast ratio compliant with WCAG standards for dark mode visibility?
* [ ] Are multi-series colors distinct and paired with matching glowing shadows?

```

```