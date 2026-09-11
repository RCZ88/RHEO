# RESULT.md — Life Page: Visible Living Art & Self Tab Architecture

## 1. Concept Essence

**Feature A: The Living River (Hero: The Aether)**
The reaction-diffusion substrate is no longer a "petri dish" trapped in a card; it is the **Aether** — the glowing, breathing, bioluminescent medium through which the user's life flows. The Vital Thread is the current; the tree rings are the cross-sections of growth within this living medium.
*   *Signature-Design Fit Rubric:*
    *   **On-Concept (10/10):** Perfectly embodies "life growing" and the "river" metaphor.
    *   **Complements (9/10):** Enhances the data-viz without obscuring it, provided glass opacity is tuned.
    *   **Usability-Safe (8/10):** Requires strict alpha-capping and CSS vignetting to maintain WCAG contrast for text.
    *   **Data-Alive (10/10):** Continuous, emergent motion that reacts to time (hidden pause) and user preference (reduced motion).

**Feature B: The Contextual Self (Hero: The Constellation Strip)**
The Self tab transitions from a "database dump" to a **Cohesive Mind**. The hero is not a massive banner, but a unified, glowing Stat Strip that anchors the three disparate systems (Identity, Graph, Memory) into a single violet-themed glass hierarchy.
*   *Signature-Design Fit Rubric:*
    *   **On-Concept (10/10):** Unifies the "Self" as a network of traits, connections, and memories.
    *   **Clarity (10/10):** Establishes immediate hierarchy (Stats -> Identity -> Network -> Raw Memory).
    *   **Restraint (9/10):** Uses a single accent family and consistent geometry to calm the visual noise.

---

## 2. Feature A — Living River (Engineering & Visual Spec)

### 2.1 Placement & Z-Order
The substrate must be **full-bleed** across the entire River view container.
*   **Location:** Move `<LivingSubstrate />` OUT of `CoreSample.tsx` and INTO `LifePage.tsx` as the **first child** of the River Mode container (`<div className="flex flex-1 min-h-0 relative gap-6" ref={feedRef}>`).
*   **Z-Map Update:**
    *   `z-0`: `<LivingSubstrate />` (Absolute, inset-0, pointer-events-none)
    *   `z-[1]`: Vital Thread (Absolute, left-1/2, pointer-events-none) — *The thread now glows OVER the coral.*
    *   `z-[5]`: Left Sticky Column (CoreSample, Timeline, RiverMap)
    *   `z-10`: Right Feed Column (PhaseCards, TodayTributary)
*   **CoreSample Cleanup:** Remove `<LivingSubstrate />` from `CoreSample.tsx`. Keep the existing CSS `radial-gradient` amber glow. The tree rings will now float elegantly over the full-bleed river coral.

### 2.2 Legibility Layer (CSS & Glass Tuning)
To prevent the bright amber coral from washing out text, we must increase the opacity of the glass cards and add a vignette to the substrate.
*   **Vignette Overlay:** Add a CSS radial gradient overlay inside the `LivingSubstrate` wrapper to darken the edges and focus the eye on the center thread.
    ```tsx
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
      <SubstrateCanvas />
      {/* Vignette for legibility */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(9,9,11,0.85)_100%)]" />
    </div>
    ```
*   **Glass Card Opacity Bump:** In `LifePage.tsx` and `CoreSample.tsx`, increase glass background opacity from `bg-zinc-900/30` to `bg-zinc-900/75` and ensure `backdrop-blur-xl` is present. This creates a "frosted glass" effect that blocks the bright coral while letting the amber glow bleed through the edges.

### 2.3 Shader Evolution (GLSL Diffs)

**A. Simulation (`rd-simulation.glsl`) — Adding "River Flow"**
We will add a subtle advection term to make the coral "flow" downwards, aligning with the Vital Thread metaphor.
*   *Add Uniform:* `uniform float flowSpeed;` (Set to `0.0015` in TS).
*   *Diff:*
    ```glsl
    // Inside main(), after getting A and B:
    float B_up = texture2D(previousIterationTexture, v_uvs[1]).g;   // top neighbor
    float B_down = texture2D(previousIterationTexture, v_uvs[3]).g; // bottom neighbor

    // Advection: moves B chemical downwards (simulating river current)
    float advection = (B_up - B_down) * flowSpeed;

    // Update gl_FragColor calculation for B channel:
    gl_FragColor = vec4(
      A + ((dA * laplacian[0] - reactionTerm + f * (1.0 - A)) * timestep),
      B + ((dB * laplacian[1] + reactionTerm - (k + f) * B + advection) * timestep),
      centerTexel.b,
      1.0
    );
    ```
*   *Preset Tuning:* Change `f` to `0.058` and `k` to `0.065` in TS. This creates larger, softer, more "lush" coral blobs that look better at low opacity across a large screen.

**B. Display (`rd-display.glsl`) — v3 Ambient Ramp**
The v2 ramp peaks at 0.95 alpha, which is blinding on a full screen. We cap it at 0.55 for ambient background use.
*   *Diff:* Replace the color constants and alpha logic:
    ```glsl
    const vec3 COLOR_BG  = vec3(0.0353, 0.0353, 0.0431);  // #09090b (bg-primary)
    const vec3 COLOR_LOW = vec3(0.4706, 0.2078, 0.0588);  // #78350f (amber-900)
    const vec3 COLOR_MID = vec3(0.8510, 0.4667, 0.0235);  // #d97706 (amber-600)
    const vec3 COLOR_HI  = vec3(0.9608, 0.6196, 0.0431);  // #f59e0b (amber-500)

    void main() {
      vec4 pixel = texture2D(textureToDisplay, v_uv);
      float B = pixel.g;

      float aLow  = smoothstep(0.0, 0.4, B);
      float aMid  = smoothstep(0.3, 0.7, B);
      float aHigh = smoothstep(0.6, 1.0, B);

      // Max alpha capped at 0.55 to preserve text contrast
      float alpha = mix(0.0, 0.15, aLow) + mix(0.0, 0.20, aMid) + mix(0.0, 0.20, aHigh);

      vec3 color = mix(COLOR_BG, COLOR_LOW, aLow);
      color = mix(color, COLOR_MID, aMid);
      color = mix(color, COLOR_HI, aHigh);

      gl_FragColor = vec4(color * alpha, alpha);
    }
    ```

### 2.4 Performance & Pages Mode Decision
*   **Performance Guards:** Keep 256² buffer (384² on DPR>1.5). Keep `document.hidden` pause. Keep `prefers-reduced-motion` unmount.
*   **Pages Mode Decision:** **EXCLUDE** the living substrate from the `pages` mode (including the Self tab).
    *   *Justification:* The substrate is the hero of the *River* metaphor. In `pages` mode, the user is performing focused management tasks (editing facts, viewing graphs). A full-bleed animated WebGL background behind dense tables and forms is distracting, harms readability, and wastes GPU cycles.
    *   *Alternative:* The Self tab in `pages` mode will use a static, elegant `<DotPattern />` or `<AnimatedGridPattern />` (Magic UI) tinted with violet `#8b5cf6` at 5% opacity to give it identity without the visual noise.

---

## 3. Feature B — Self Tab Architecture

### 3.1 Layout & Hierarchy
The Self tab (`pageTab === 'self'`) will be restructured into a cohesive vertical flow.
1.  **Hero Header:** Clean serif title "Contextual Self" with a subtle violet gradient text effect. NO uppercase eyebrow pills.
2.  **Stat Strip (The Anchor):** A unified flex-row of 3 glass cards displaying: `Episodes` (Brain), `Entities` (Graph), `Current Facts` (Brain). Data fetched once via `api.brainStats()`.
3.  **Identity (ProfileTab):** The "Who". Wrapped in standard glass card.
4.  **Knowledge (ContextGraphView):** The "Connections". Canvas wrapped in rounded border.
5.  **Memory (BrainManagementView):** The "Raw Data". Sub-tabs and lists.

### 3.2 Card System & Accent Reconciliation
We unify the clashing accents into a single **Violet Family (`#8b5cf6`)**, using functional tints only where necessary for data-viz.

| View | Current Accent | New Accent Strategy | Action Required |
| :--- | :--- | :--- | :--- |
| **LifePage (Tab)** | `#8b5cf6` (Violet) | **Base.** Sets `--page-accent: #8b5cf6`. | None. |
| **ProfileTab** | Amber/Pink Gradients | **Violet-400 (`#a78bfa`).** Warmth shifted to violet. | Replace `AnimatedGradientText` amber stops with violet stops. |
| **ContextGraphView** | Cyan (`#06b6d4`) | **Violet-500 (`#8b5cf6`).** UI elements only. | Change button/hover colors. **Keep** `TYPE_COLORS` for nodes (functional). |
| **BrainManagement** | Purple (`#a855f7`) | **Violet-500 (`#8b5cf6`).** Unified with tab. | Change `ACCENT` constant to `#8b5cf6`. |

**Unified Card Class:**
```tsx
const SELF_CARD_CLASS = "rounded-xl border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-2xl shadow-black/20";
```

### 3.3 Header System & Graph Canvas Fix
*   **Headers:** Replace raw `<h2 className="uppercase...">` with the shared `<SectionHeader />` component from `src/components/SectionHeader.tsx`.
    ```tsx
    <SectionHeader title="Identity & Profile" icon={<User className="w-4 h-4" />} />
    ```
*   **Graph Canvas Fix:** The R3F canvas currently has a solid `#0a0a0c` background and square corners, looking like a hole in the page.
    *   *Fix:* Wrap the `<Canvas>` in a `div` with `className="rounded-xl overflow-hidden border border-zinc-800/50"`.
    *   *Fix:* Change the Canvas `style` or `gl.setClearColor` to `transparent` or match the card bg (`#18181b`), so the glass card border frames the 3D space elegantly.

### 3.4 UX & States (Empty/Loading/Error)
*   **Stat Strip:**
    *   *Loading:* 3 `<Skeleton className="h-24 w-full" />` blocks.
    *   *Populated:* `<NumberTicker>` for values, violet icon, subtle `DotPattern` background inside the card.
*   **Graph:**
    *   *Empty:* "No entities mapped yet." with a centered `Network` icon and a "Refresh" button.
    *   *Error:* Inline `<Alert>` component (shadcn) with `AlertCircle`.
*   **Micro-interactions:** All hovers use `transition-all duration-200 ease-out`. Cards lift slightly on hover (`hover:-translate-y-0.5 hover:border-zinc-700/50`). Reduced motion disables lift and ticker animations.

---

## 4. Implementation Plan

**Step 1: Substrate Relocation & Shader Update (Feature A)**
1.  **File:** `src/components/life-river/CoreSample.tsx`
    *   *Action:* Remove `<LivingSubstrate />` import and JSX. Keep the CSS radial glow.
2.  **File:** `src/shaders/rd-simulation.glsl`
    *   *Action:* Add `uniform float flowSpeed;` and advection logic.
3.  **File:** `src/shaders/rd-display.glsl`
    *   *Action:* Replace color constants and alpha logic with v3 Ambient Ramp.
4.  **File:** `src/components/life-river/LivingSubstrate.tsx`
    *   *Action:* Update `simMaterial.uniforms` to include `flowSpeed: { value: 0.0015 }`. Update `f` to `0.058`, `k` to `0.065`.
5.  **File:** `src/features/warmth/LifePage.tsx` (River Mode block ~L517)
    *   *Action:* Import `LivingSubstrate`. Add as first child of river container. Add vignette overlay div. Update Vital Thread z-index to `z-[1]`.
    *   *Action:* Update glass card classes in river view to `bg-zinc-900/75`.

**Step 2: Self Tab Architecture (Feature B)**
1.  **File:** `src/features/warmth/LifePage.tsx` (Self Tab block ~L499)
    *   *Action:* Rewrite the `pageTab === 'self'` block.
    *   *Add:* Hero header, `<SelfStatStrip />` (new internal component fetching `brainStats`), and unified `<SectionHeader>` wrappers for the 3 views.
    *   *Add:* `<AnimatedGridPattern />` background for the pages-mode container (static, low opacity).
2.  **File:** `src/components/life/ProfileTab.tsx`
    *   *Action:* Replace internal headers with `<SectionHeader>`. Update gradient colors to violet. Wrap content in `SELF_CARD_CLASS`.
3.  **File:** `src/features/warmth/ContextGraphView.tsx`
    *   *Action:* Remove internal header (now in LifePage). Wrap `<Canvas>` in rounded border div. Update UI accent to `#8b5cf6`.
4.  **File:** `src/features/warmth/context-brain/BrainManagementView.tsx`
    *   *Action:* Change `ACCENT` constant to `#8b5cf6`. Update sub-tabs to use shadcn `<Tabs>`.

**Step 3: Verification & Build**
1.  Run `npx tsc -p tsconfig.app.json` to ensure no type errors from prop changes.
2.  Run `npx vite build` to verify GLSL raw imports and chunking.
3.  **CRITICAL:** Fully close and relaunch `RHEO.exe` to clear the stale renderer cache.
4.  **Visual Check:** Verify coral is visible but text is readable. Verify Self tab looks like one cohesive page, not three stacked apps.

---

## 5. Risks & Ripple Effects

1.  **WebGL Context Limits:** Moving to a single full-bleed canvas actually *saves* WebGL contexts compared to having one in CoreSample and potentially one in the Graph. No risk of context loss.
2.  **Glass Opacity vs. Contrast:** Bumping glass to `bg-zinc-900/75` might make some secondary text (`text-zinc-400`) hard to read.
    *   *Mitigation:* Audit all text inside river cards. Upgrade `text-zinc-400` to `text-zinc-300` and `text-zinc-500` to `text-zinc-400` where necessary to maintain WCAG AA contrast against the darker glass + bright coral background.
3.  **Staggered AnimatePresence:** The Self tab uses `AnimatePresence mode="wait"` with `crossfade`. If the stat strip fetches data asynchronously, it might cause a layout shift.
    *   *Mitigation:* Reserve space for the Stat Strip using `min-h-[120px]` and show `<Skeleton>` immediately to prevent jumpiness.
4.  **Advection Seams:** The `flowSpeed` advection in the shader wraps UVs. If not careful, this can cause a visible "seam" at the top/bottom of the texture.
    *   *Mitigation:* The simulation uses `RepeatWrapping` on the render targets. Gray-Scott patterns are generally organic enough that the seam is invisible, but if it appears, we can clamp the advection to the center 80% of the screen using a `smoothstep` on the Y coordinate in the shader.

---
**Backend Audit:** ✅ All features are strictly UI/Shader/CSS. No new IPC channels, no DB schema changes, no main-process edits required.