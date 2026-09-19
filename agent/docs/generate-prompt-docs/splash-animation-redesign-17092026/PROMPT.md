# PROMPT.md — Splash Animation Redesign for DeskFlow (RHEO)

> **Prompt Type:** design
> **Target AI:** claude
> **Detail Level:** 9
> **Creativity:** 30
> **Response Format:** markdown

---

## Raw Request (verbatim from user)

> "there are a few exisitng problem with hte opening animation of the app. mainly it being htat hteeres not enough time for hte animatinos to dislay properly and its then jut gone. and i found the animation thing to be sort of lie seperated from the app itself where when i click on the background 9the app) the naimation disapear. can you make sure that the animatino is proper and good and working and is integrated INTO the app and not seperate and theres enough time to show those. and like if possible. dont have a black bakground behind the animtion when loding. so the loading animation card thing only. i need you to use the @agent/skills/generate-prompt/ skill to ask another ia to design the popup and like orchestration of what ai tools or stuff to use"

---

## Context

### The Problem

DeskFlow (RHEO) is an Electron + React + TypeScript desktop productivity tracker. Currently, the boot loading animation runs in a **completely separate BrowserWindow** (520×320, frameless, transparent) that is created before the main app window. This causes several problems:

1. **Animation too short** — The current "Meridian Wake" animation runs for only ~1250ms (1.25 seconds), and the splash closes after 1400ms minimum. The animation barely has time to display before it disappears.
2. **Separate from the app** — The animation is a completely separate BrowserWindow, not integrated into the main app. When the user clicks on the app window, the splash closes (due to `mouse-down` and `focus` event handlers).
3. **Black background** — The splash window has `backgroundColor: '#09090b'` (near-black), creating an unwanted black screen behind the animation.
4. **Click dismissal** — `splashWindow.on('keydown')` and `splashWindow.webContents.on('mouse-down')` close the splash after only 400ms of user interaction, making it impossible to actually see the animation.

### The Desired Outcome

The loading animation should be:
- **Integrated INTO the main app** (rendered as a React component inside the app's `#root` div, not a separate window)
- **Persistent** — it does NOT close when the user clicks on the app or any part of the UI
- **Long enough** — at least 2-3 seconds of visible animation time
- **No black background** — the app background should be visible behind the loading animation, with only the loading card/card element being the visual focus
- **A polished loading card** — not just a terminal-style ticker, but a beautiful, modern loading card with progress indication

### Reference Files

- `CONTEXT_BUNDLE.md` — full source code context for every affected file
- `src/splash.html` — current animation HTML (the "Meridian Wake" concept)
- `src/splash.css` — current animation CSS
- `src/main.ts` lines 5205-5276 — splash window creation and dismissal logic
- `src/main.ts` lines 5290-5308 — main window creation
- `src/preload/splashPreload.ts` — IPC bridge
- `src/tokens.css` — design tokens
- `src/index.html` — main HTML template

---

## The Mandate

Design a **comprehensive loading animation system** for DeskFlow that replaces the current separate-window splash with an **integrated React component** rendered inside the main app.

### What the Target AI Must Deliver

#### 1. Loading Animation Card Design
Design a beautiful, modern loading card that appears when the app starts. It should:
- Be centered on the screen
- Have a glassmorphism appearance (using DeskFlow tokens: `bg-zinc-900/80 backdrop-blur-xl`, `border-zinc-700/40`)
- Contain a compelling loading animation (not just a spinner — think creative, atmospheric)
- Show progress or status text
- NOT have a black background behind it — the app background should show through
- Use DeskFlow design tokens exclusively

The loading card should incorporate elements inspired by the current "Meridian Wake" animation (the tick marks, sweep line, and RHEO wordmark) but reimagined as a modern glass card component.

#### 2. Animation Orchestration
Design the timing and sequence of the loading animation:
- Total duration: **3-4 seconds minimum** (the user wants enough time to see the animation)
- Staggered entrance of elements
- Smooth easing using `cubic-bezier(0.19, 1, 0.22, 1)` (the `--ease-out-expo` token)
- The animation should feel complete and satisfying before transitioning to the main app
- Must NOT dismiss on user interaction (click, focus, keydown)

#### 3. Integration Architecture
Design how the loading animation integrates into the existing app architecture:
- A React component that wraps the app during loading
- Should use the existing `BootAnimationConfig` (`enabled`, `variant`, `warmStart`) from `prefService`
- Must maintain the `splash-complete` IPC flow so the main process knows when animation ends
- Should work with the existing `createWindow()` flow
- The loading component should mount inside the main `#root` div
- Must not break any existing functionality

#### 4. Technical Implementation Plan
Provide specific code changes needed:
- Which files to create/modify
- How to modify `src/main.ts` to remove the separate splash window
- How to modify `src/App.tsx` or `src/main.tsx` to add the loading state
- How to maintain IPC communication (`splash-complete`, `boot-animation-config`, `replay-splash`)
- How to handle the `dist/` build pipeline (the splash.html needs to be removed or repurposed)

#### 5. MCP Component Recommendations
Recommend specific MCP-sourced components for the loading card:
- Query shadcn, Magic UI, Lucide, React Bits for relevant components
- List actual component names with their use cases
- Include the anti-slop checklist (re-skin to DeskFlow tokens)

---

## Requirement Checklist

### Engineering Tasks
- [ ] Replace separate-window splash with integrated React loading component
- [ ] Remove `splashWindow` creation and dismissal logic from `src/main.ts`
- [ ] Add loading state to the main app's React component tree
- [ ] Maintain IPC channels (`boot-animation-config`, `splash-complete`, `replay-splash`) for backward compatibility
- [ ] Ensure the loading animation does NOT dismiss on user interaction
- [ ] Ensure the animation runs for 3-4 seconds minimum
- [ ] Remove black background — app background visible behind loading card
- [ ] Update `index.html` if needed (remove splash.html dependency)
- [ ] Update `vite.config.ts` build pipeline if needed
- [ ] Ensure the loading card uses DeskFlow design tokens

### Design Tasks
- [ ] Design a beautiful loading card (glassmorphism, centered)
- [ ] Design the animation sequence (3-4 seconds, staggered entrance)
- [ ] Use DeskFlow tokens: `--bg-0: #050506`, `--surface-1/2/3`, `--hairline`, `--text-hi`, `--ws-accent: #06b6d4`
- [ ] Use fonts: Space Grotesk (display), JetBrains Mono (mono labels)
- [ ] Apply anti-slop checklist (glass, rounded-xl, dark mode only)
- [ ] No black background behind the loading card

### UX Tasks
- [ ] Loading card must be centered and visible at all times during loading
- [ ] Must NOT close on click, focus, or keydown
- [ ] Must show clear loading progress/status
- [ ] Smooth transition from loading card to the main app content
- [ ] Must handle `prefers-reduced-motion` gracefully
- [ ] The animation should feel satisfying and not rushed

### Constraints
- [ ] Keep all existing TypeScript types and interfaces unchanged
- [ ] Keep all existing IPC handlers and data flow unchanged
- [ ] Keep the `--dk-*` and `--ws-*` token naming convention
- [ ] Keep the existing `BootAnimationConfig` interface
- [ ] Do NOT add new npm dependencies (use only what's already installed: React, framer-motion, lucide-react, tailwind, shadcn)
- [ ] The app must still boot correctly with the loading animation
- [ ] The `dist/` build must still work

---

## Output Format

Return your response as:

1. **A summary** (3-5 sentences) describing the design direction and why
2. **The complete React component code** for the loading animation (full, ready to paste)
3. **The modified `src/main.ts` changes** (what to remove/add for the splash window)
4. **The modified `src/App.tsx` or `src/main.tsx` changes** (how to integrate the loading state)
5. **The modified `src/preload.ts` IPC changes** (maintaining compatibility)
6. **A list of MCP components** to use with their source and purpose
7. **A list of new CSS/Tailwind classes** you introduce and what they do
8. **Animation timing specification** (exact durations, delays, easing curves)

Be bold. Make it beautiful. The goal is "I can't wait to see the app after this loading screen."

---

## Inspiration (optional reference points)

- **Linear.app** — clean loading states, subtle depth, premium feel
- **Raycast** — command palette UX, elegant loading transitions
- **Arc Browser** — playful but precise, spatial loading indicators
- **Vercel Dashboard** — clean skeleton screens and progress indicators
- **Apple boot screens** — minimal, elegant, purposeful animation

Don't copy any of these wholesale. Use them as mood references. The DeskFlow aesthetic is dark, glassmorphic, monochrome with subtle cyan accent.
