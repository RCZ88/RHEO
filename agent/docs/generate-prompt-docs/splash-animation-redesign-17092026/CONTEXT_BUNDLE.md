# CONTEXT_BUNDLE.md — Splash Animation Redesign

> **Task:** Fix the opening/loading animation of the DeskFlow (RHEO) Electron app. The animation is too short, separate from the app, closes on click, and has a black background. Redesign it to be integrated, persistent, and visually polished.

---

## Project Context

DeskFlow (RHEO) is an Electron + React + TypeScript desktop productivity tracker. The app uses a separate BrowserWindow for the boot splash animation, which is the source of all the problems.

---

## Problem Statement (User's Verbatim Request)

> "there are a few exisitng problem with hte opening animation of the app. mainly it being htat hteeres not enough time for hte animatinos to dislay properly and its then jut gone. and i found the animation thing to be sort of lie seperated from the app itself where when i click on the background 9the app) the naimation disapear. can you make sure that the animatino is proper and good and working and is integrated INTO the app and not seperate and theres enough time to show those. and like if possible. dont have a black bakground behind the animtion when loding. so the loading animation card thing only. i need you to use the @agent/skills/generate-prompt/ skill to ask another ia to design the popup and like orchestration of what ai tools or stuff to use"

---

## Current Implementation — All Relevant Source Files

### 1. Splash Window Creation (`src/main.ts`, lines 5205-5276)

The splash is created as a **separate** BrowserWindow before the main window:

```typescript
// Lines 5230-5247 — Splash window creation
splashWindow = new electron_1.BrowserWindow({
    width: 520,
    height: 320,
    x: Math.round((electron_1.screen.getPrimaryDisplay().workArea.width - 520) / 2),
    y: Math.round((electron_1.screen.getPrimaryDisplay().workArea.height - 320) / 2),
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#09090b',  // ← BLACK BACKGROUND
    hasShadow: false,
    webPreferences: {
        preload: splashPreloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
    },
});
splashWindow.setIgnoreMouseEvents(false);  // ← Clicking closes it
splashWindow.on('ready-to-show', () => {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.show();
});

// Lines 5262-5268 — DISMISS ON USER INTERACTION (THE PROBLEM)
splashWindow.on('keydown', () => {
    if (performance.now() - splashStartTime >= 400) closeSplash();
});
splashWindow.webContents.on('mouse-down', () => {
    if (performance.now() - splashStartTime >= 400) closeSplash();
});

// Lines 5269-5270 — Timing
setTimeout(closeSplash, 4000); // hard cap
setTimeout(() => { if (!splashClosed) closeSplash(); }, 1400); // min display — full anim completes at 1250ms
```

### 2. Splash HTML (`src/splash.html`)

The splash is a standalone HTML file with a "Meridian Wake" animation concept:
- 24 ruler ticks that cascade in
- Numerals 00/06/12/18/24
- A "now-tick" indicator
- A sweeping line
- Logo (RHEO) reveal
- Total animation duration: ~1250ms (1.25 seconds)
- Background: `#09090b` (near-black)

Key issue: The animation runs in a **separate window**, and clicking anywhere on it (or the app) closes it.

### 3. Splash CSS (`src/splash.css`)

The CSS defines the visual styling with `--splash-field: #09090b` and all the animation keyframes. The `splash-field` div covers the entire screen with `background: var(--splash-field)`.

### 4. Splash Preload (`src/preload/splashPreload.ts` and `src/preload.ts` lines 1779-1784)

```typescript
contextBridge.exposeInMainWorld('splashAPI', {
    getBootAnimationConfig: () => ipcRenderer.invoke('boot-animation-config'),
    onReplay: (cb) => ipcRenderer.on('replay-splash', () => cb()),
    sendComplete: () => ipcRenderer.invoke('splash-complete'),
});
```

### 5. Main Window (`src/main.ts`, lines 5290-5308)

The main window is created AFTER the splash:
```typescript
mainWindow = new electron_1.BrowserWindow({
    // ...
    backgroundColor: '#0a0a0a',  // Also near-black
    titleBarStyle: 'hidden',
    frame: false,
    // ...
});
```

### 6. App Entry Point (`src/main.tsx`)

```typescript
window.__RHEO_LOADED = true;
createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <HashRouter>
            <NumberMaskProvider>
                <App />
            </NumberMaskProvider>
        </HashRouter>
    </ErrorBoundary>
)
```

### 7. Index HTML (`index.html`)

The main HTML has a fallback overlay (`#df-fallback`) that shows when JS fails to load, with `background:#121212`. The `#root` div is empty until React mounts.

### 8. Boot Animation Config (`src/services/prefService.ts`)

```typescript
export interface BootAnimationConfig {
    enabled: boolean;
    variant: 'meridian';
    warmStart: boolean;
}
```

### 9. IPC Handlers (`src/main.ts`, lines 6820-6839)

```typescript
electron_1.ipcMain.on('replay-splash', () => { ... });
electron_1.ipcMain.handle('splash-complete', () => { ...close splash window... });
electron_1.ipcMain.handle('boot-animation-config', () => { ... });
```

### 10. Design Tokens (`src/tokens.css`)

```css
:root {
    --bg-0: #050506;                 /* near-black canvas */
    --text-hi: #f4f4f5;              /* high-contrast foreground */
    --hairline: rgba(255, 255, 255, 0.08);
    --surface-1: rgba(255, 255, 255, 0.03);
    --surface-2: rgba(255, 255, 255, 0.05);
    --surface-3: rgba(255, 255, 255, 0.07);
    --font-display: "Space Grotesk", ...;
    --font-mono: "JetBrains Mono", ...;
    --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
    --dur-fast: 150ms;
    --dur-normal: 250ms;
    --dur-slow: 400ms;
}
```

### 11. App Background Component (`src/App.tsx` line 43)

```tsx
import { AppBackground } from './components/AppBackground';
```

This component is used in the main app and may be relevant for the integrated loading state.

---

## Architecture Notes

### Current Flow
1. `createWindow()` opens a separate `splashWindow` (BrowserWindow)
2. Main window is created
3. Splash animation plays for ~1250ms
4. `splash-complete` IPC message closes the splash
5. OR user clicks/keys → splash closes after 400ms minimum
6. Main window loads the app

### Data Flow
- `boot-animation-config` IPC → `prefService.getBootAnimation()` → returns `{enabled, variant, warmStart}`
- `splash-complete` IPC → closes splash window
- `replay-splash` IPC → replays animation in splash window

### Key Files to Modify
- `src/main.ts` — splash window creation and dismissal logic (lines 5205-5276, 5388-5395, 6820-6839)
- `src/splash.html` — the splash HTML/animation
- `src/splash.css` — splash styling
- `src/preload/splashPreload.ts` — IPC bridge
- `src/App.tsx` — may need a React-based loading state integrated into the app
- `src/main.tsx` — React entry point (may need loading state)

---

## Design Tokens (for the target AI)

### Existing DeskFlow Tokens
- Background: `--bg-0: #050506` / `--ws-surface: #09090b`
- Surface: `rgba(255, 255, 255, 0.03-0.07)`
- Text: `--text-hi: #f4f4f5`, `--text-mid: rgba(244, 244, 245, 0.64)`
- Hairline: `rgba(255, 255, 255, 0.08)` / `--hairline-strong: rgba(255, 255, 255, 0.14)`
- Accent: `--ws-accent: #06b6d4` (cyan)
- Radius: `--radius-card: 12px`
- Fonts: Space Grotesk (display), Inter (sans), JetBrains Mono (mono)
- Motion: `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1)`, `--dur-normal: 250ms`

### Anti-Slop Checklist (MANDATORY for target AI)
1. Re-skin to DeskFlow tokens (colors → `--bg-primary`, `--accent-primary`, etc.)
2. Max `rounded-xl`, `p-5` padding
3. Dark mode only
4. Geist + JetBrains Mono fonts
5. Glass layer (`bg-zinc-900/80 backdrop-blur-xl`)

---

## MCP Inventory (for target AI)

| Component | Source | Use for |
|-----------|--------|---------|
| Card | shadcn | Loading card container |
| Dialog | shadcn | Modal overlay if needed |
| Animated Beam | Magic UI | Connecting lines in loading animation |
| Bot | Lucide | AI icon in loading card |
| Motion (framer-motion) | Existing dependency | Animation orchestration |
| Progress | shadcn | Loading progress indicator |
| Skeleton | shadcn | Loading skeleton states |
| Badge | shadcn | Status badges on loading card |

---

## Available Skills (for target AI)

1. **Frontend Design** — DeskFlow component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels, motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules
6. **Design Taste System** — master dispatcher, aesthetic matrix, anti-repetition rules
7. **Frontend External Infra** — source routing, re-skin rules, anti-slop checklist

---

## Constraints

1. The animation MUST be integrated INTO the main app window (not a separate BrowserWindow)
2. The animation MUST NOT close when the user clicks on the app
3. The animation MUST have enough time to display (minimum 2-3 seconds recommended)
4. NO black background behind the animation — only the loading card/card element
5. Must use DeskFlow design tokens
6. Must support the existing `BootAnimationConfig` (`enabled`, `variant`, `warmStart`)
7. Must maintain the `splash-complete` IPC flow for the main process to know when animation ends
8. Must not break the existing `createWindow()` flow (splash → main window → app)
9. The loading card should be centered on the screen with the app background visible behind it
10. The animation should be a React component rendered inside the main app's `#root` div, not a separate HTML file

---

## Current Animation Sequence (from splash.html)

The "Meridian Wake" animation sequence (1250ms total):
1. 0-500ms: 24 ruler ticks cascade in (staggered, 12ms apart)
2. 350-700ms: Numerals (00/06/12/18/24) rise and fade in
3. 700-900ms: "Now-tick" indicator glows on
4. 850-1250ms: Sweep line expands + Logo (RHEO) scales in
5. At 1250ms: `sendComplete()` fires → splash closes

This animation currently runs in a separate window and must be **ported into the main app** as a React component.
