# Round 01: Context Response to GLM's Analysis

## RESPONSE TO REQUESTS

### REQUEST 1: ActRecord.tsx (full source)
[Full source provided in CONTEXT_BUNDLE.md — see above. Key facts:]

- **Container width**: `max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16` → inner content width = 1280 - 2×64 = 1152px on lg screens
- **SampleDayTimeline container**: `width: "min(440px, 80vw)"` — centered in the middle column. This is the "empty gap" source: the timeline is only 440px wide while the section is 1280px wide.
- **Vertical timeline rail**: `width: 96` on the right side
- **Left text block**: `maxWidth: 300`, `top: 320`
- **Scroll-scrub**: 300vh section height, sticky 100dvh
- **Reduced motion**: static stacked layout, full width
- **The `useSpring` is gated** by `shouldAnimate` — replaced with raw scroll progress under reduced motion

### REQUEST 2: Download.tsx (full source)
[Full source provided in CONTEXT_BUNDLE.md — see above. Key facts:]

- **Ledger** (3 sourced claims) sits at `mt-14`, full width within `max-w-[760px]`
- **Vault + Exploded**: flex row, `gap-8`, `mt-10`, each centered in a flex column
  - Vault: opacity 0.4, maxWidth 280 (hairline figure, ~224px tall at 5:4)
  - Exploded: opacity 0.45, maxWidth 320 (hairline figure, ~256px tall at 5:4)
  - Each has a 9px caption label below
- **Proof link**: `mt-6`, `fontSize: 12`
- **"Not released yet"**: `marginTop: 8`, `fontSize: 11`
- **Mailto**: `mt-5`, `fontSize: 16`
- **OS cards**: `mt-14`, `maxWidth: 960`, 3 cards in a row with `gap-5`
- **Divider**: `width: min(120px, 40vw)`, `height: 1`, `margin: 32px auto`
- **Radial bloom**: 620×620px, 8% white, centered

### REQUEST 3: Hairline figure source
The Vault and Exploded components come from `@lucasmarkes/hairline/react`. The library is minified in node_modules. Key facts:

- **API**: `make(name, mount)` where mount takes `(el, options)` and returns `{ set, destroy }`
- **Props**: `intensity`, `theme`, `label`, `onRead`, `play`, `style`
- **Vault**: "Locked by default; the combination is yours" — a dial with bolts. Pointer-reactive (parallax on hover). Themes via CSS variables (`--hairline-plate`, `--hairline-hi`, etc.)
- **Exploded**: "The four layers: renderer, main, SQLite file, your disk" — an app window in four layers. Moving across opens the gap; moving down picks a layer. Pointer-reactive.
- **No data binding**: The hairline library's figures are purely pointer-driven. They do NOT accept data props. The `intensity` prop widens the pointer response area.
- **`onRead` callback**: Fires text descriptions of what's under the pointer. This is the only "data" output — it's a string, not structured data.

**What Vault depicts in RHEO's real architecture:**
- Vault = privacy/local-first. Your data is locked by default. The combination (encryption key) is yours. No server holds it. The figure shows a vault dial — you control access.

**What Exploded (four layers) depicts:**
- Layer 1 (top): Renderer (React UI, the window you see)
- Layer 2: Main process (Electron main, IPC handlers)
- Layer 3: SQLite file (deskflow-data.db on disk)
- Layer 4 (bottom): Your disk (local storage, no cloud)
- "No server" is the key message — all four layers are on your machine

### REQUEST 4: ActUnderstand.tsx tablist pattern
[Full tablist block provided above. Key facts:]

```tsx
<div role="tablist" aria-label="Example questions" style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
  {SCENARIOS.map((sc, i) => {
    const active = i === idx;
    return (
      <button
        key={sc.id}
        role="tab"
        type="button"
        id={`console-tab-${sc.id}`}
        aria-selected={active}
        aria-controls="console-panel"
        tabIndex={active ? 0 : -1}
        data-scenario={sc.id}
        onClick={() => setIdx(i)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const next = e.key === "ArrowRight"
              ? Math.min(SCENARIOS.length - 1, i + 1)
              : Math.max(0, i - 1);
            setIdx(next);
            document.getElementById(`console-tab-${SCENARIOS[next].id}`)?.focus();
          }
        }}
        className="mono"
        style={{
          fontSize: 11,
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          background: active ? "#ffffff" : "transparent",
          color: active ? "#050506" : "#a1a1aa",
          border: `1px solid ${active ? "#ffffff" : "rgba(255,255,255,0.12)"}`,
          transition: "background 0.3s cubic-bezier(0.16,1,0.3,1), color 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {sc.label}
      </button>
    );
  })}
</div>
```

Key patterns:
- Roving tabindex: active tab has tabIndex=0, others -1
- Arrow keys move between tabs
- Active tab: white background, black text
- Inactive: transparent background, gray text
- `role="tablist"` on container, `role="tab"` on buttons
- `aria-selected` tracks active state
- `aria-controls` links to panel

### REQUEST 5: Facts about Vault and four layers

**Vault (privacy/local-first):**
- RHEO stores all data in a single SQLite database on the user's disk
- No account required, no cloud sync by default
- The "combination" is the user's encryption key (stored in `deskflow-audit-key.bin`)
- "Locked by default" = your data is not accessible to anyone else
- Real fact: "One database, three files (db, -wal, -shm). Close RHEO before copying."

**Four layers (local stack):**
- Layer 1 (Renderer): React UI running in Electron's renderer process
- Layer 2 (Main): Electron main process, handles IPC, tracking, DB access
- Layer 3 (SQLite file): `deskflow-data.db` + `-wal` + `-shm` on disk
- Layer 4 (Disk): Local filesystem, no cloud, no server
- Real fact: "Every outbound call is listed at /docs/network — only api.github.com and api.exchangerate-api.com"

## ADDITIONAL CONTEXT: ActRecord Layout Details

From ActRecord.tsx, the animated layout uses:
- Section: `height: 300vh` (scroll-scrub container)
- Sticky inner: `height: 100dvh`
- Content area: `max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16 pt-20 pb-20`
- Left text block: `absolute top-16 left-5 sm:left-10 lg:left-16 max-w-[340px]`
- Phase text block: `absolute left-5 sm:left-10 lg:left-16` at `top: 320`, `maxWidth: 300`
- Dashboard card (center): `absolute left:50% top:50% translate(-50%,-50%)` width `min(440px, 80vw)`
- Vertical timeline rail (right): `absolute right-4 lg:right-10` at `top:50% translateY(-50%)`, height `min(62vh, 540px)`, width `96`
- SampleDayTimeline: rendered inside the center dashboard card container, width `min(440px, 80vw)`

**The empty gap**: The SampleDayTimeline is inside a 440px-wide container. The 1,440 minute bars render at 440/1440 = 0.306px per minute — sub-pixel. This is why the timeline looks "vague" and "blurry."

## ADDITIONAL CONTEXT: CSS Tokens

From globals.css (key values):
```css
--color-bg: #050506;
--color-surface: #0a0a0c;
--color-border: rgba(255, 255, 255, 0.08);
--color-text-hi: #f4f4f5;
--color-text-mid: #a1a1aa;
--color-text-lo: #8a8a94;
--color-text-dim: #63636b;
--color-signal: #ffffff;
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--ease: cubic-bezier(0.16, 1, 0.3, 1);
--duration-micro: 160ms;
```

Section spacing: `pt-24 sm:pt-32` (96px/128px top padding)
Card padding: `p-5` (20px) or `px-8 pt-7 pb-0` (32px horizontal)
Gaps: `gap-3` (12px), `gap-5` (20px), `gap-8` (32px)
Max content width: `max-w-[1280px]` with `px-5 sm:px-10 lg:px-16` (20/40/64px horizontal padding)