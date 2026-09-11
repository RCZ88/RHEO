# LANDING_DESIGN_SPEC.md — RHEO marketing landing

> Single-source spec for the RHEO marketing landing page (`landing/`).
> Living document — update it when the page changes materially.

## 1. Style contract — LAMINAR

### 1.1 Surfaces

| Token | Hex | Use |
|---|---|---|
| `--surface-page` | `#050506` | Page background |
| `--surface-panel` | `#0a0a0c` | Cards, modals, inputs |
| `--surface-raised` | `#101014` | Hover/elevated surfaces |

### 1.2 Text

| Token | Hex | Use |
|---|---|---|
| `--text-primary` | `#f4f4f5` | Headlines, body |
| `--text-secondary` | `#a1a1aa` | Secondary copy, captions |
| `--text-tertiary` | `#63636b` | Mono labels, metadata, hashes |
| `--text-inverse` | `#ffffff` | On white buttons |

### 1.3 Accents

| Token | Value | Use |
|---|---|---|
| `--accent` | `#ffffff` (pure white) | CTA buttons, active states |
| `--hairline` | `rgba(255,255,255,0.08)` | Default borders |
| `--hairline-strong` | `rgba(255,255,255,0.16)` | Hover borders, panel tops |

### 1.4 Shape

- Border radius: **6px** (small), **10px** (medium), **16px** (panels/modal)
- No rounded buttons >6px
- No sharp corners on panels <16px

### 1.5 Motion

- Easing: **`cubic-bezier(0.16, 1, 0.3, 1)`** — the single easing token. All motion uses exactly this.
- Duration ceiling: **700ms** for entrances; **350ms** for interactions; **250ms** for modals
- No `transition: all` — always property-list
- No layout properties animated (width/height/top/left/margin/padding)
- Scroll-scrubbed motion = pure function of progress → fully reversible
- One-time reveals only for small cards/connectors

### 1.6 Typography

- Display: **Space Grotesk** (500/700) — `var(--font-display)`
- Mono: **JetBrains Mono** (400/500) — `var(--font-mono)`
- Body: 16px, line-height 1.6
- Headlines: clamp(32px, 5vw, 64px), weight 500, letter-spacing -0.02em

### 1.7 Reduced motion

When `prefers-reduced-motion: reduce`:
- All scroll-scrubbed sections render as static stacked panels
- All one-time reveals fire instantly (no animation)
- rAF loops pause
- Counters render final value

## 2. Sections

### 2.1 Order (as of v0.1.0)

| # | Section | File |
|---|---|---|
| 1 | Hero | `Hero.tsx` |
| 2 | Manifesto | `Manifesto.tsx` |
| 3 | ActRecord | `ActRecord.tsx` |
| 4 | Capabilities | `Capabilities.tsx` |
| 5 | ActUnderstand | `ActUnderstand.tsx` |
| 6 | LearnVignette | `LearnVignette.tsx` |
| 7 | Atlas | `AtlasSection.tsx` |
| 8 | ActFlow | `ActFlow.tsx` |
| 9 | Download | `Download.tsx` |

### 2.2 Atlas (S5)

- 16 instruments, responsive grid: 1-col <768px, 2-col 768–1279px, 3-col ≥1280px
- Free scroll: normal document flow, content height, no pin/rail/sticky
- Reveal: IntersectionObserver threshold 0.15, once:true, batch-staggered cascade
- RM: all cards visible, no entrance
- Each card: glyph SVG + name + one-liner + status chip → modal on click

## 3. OS downloads

- Auto-detect: macOS / Windows / Linux via `use-detected-os.ts` (UA)
- All three listed; click to switch the download card
- Each card shows: OS logo (SVG), architecture, minimum version, size, SHA-256
- SHA-256 copyable; "copy" button
- Linux logo = Tux penguin SVG (`OSLogo.tsx`)

## 4. Version history

- Visible in Download section as collapsible panel
- Versions listed newest-first: v0.1.0 → v0.0.7
- Each entry: version, date, kind badge (NEW/FIX/CHG), bullet notes
- No separate changelog route — lives inline

## 5. Motion preference (dev mode)

- Exposed via nav chip: `MOTION {AUTO|ON|OFF}`
- AUTO = respects OS `prefers-reduced-motion` (default)
- ON = all animations regardless of OS
- OFF = all animations static
- Persisted to `localStorage` under `rheo-motion`
- Cross-tab synced via `storage` events
- System RM listener only applies transient mode when user explicitly chose AUTO

## 6. Changelog

Superseded by inline version history in Download section. The `Changelog.tsx` modal
component is kept for backward compatibility with the "Read the changelog →" link
but the canonical history is the inline panel.

## 7. Platform support

| Platform | Architecture | Minimum | Archive |
|---|---|---|---|
| macOS | Apple Silicon + Intel | macOS 12+ | `.dmg` |
| Windows | x64 | Windows 10+ | `.exe` |
| Linux | x64 (glibc 2.31+) | x86_64 | `.tar.gz` |

All three are first-class. Linux is not secondary.
