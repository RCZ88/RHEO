# Context Bundle: AFK Popup Blocking Pages

## Problem Statement

The RHEO app has an "AfkPromptModal" component that appears when the user has been away (AFK). This modal is `fixed inset-0 z-[9999]` and covers the entire screen with a dark overlay. It is blocking access to several pages:

- Penguin Console (`/penguin-console`)
- Guide (`/guide`)
- Settings (`/settings`)
- Labs (`/labs`)
- Lyceum (`/learn`)

The user reports that the AFK popup is covering these pages and they cannot interact with them. The only way to dismiss the modal is to find the X button or "Discard" button, which may be hard to find.

## AfkPromptModal Component

Location: `src/components/AfkPromptModal.tsx`

Key properties:
- `fixed inset-0 z-[9999]` — covers entire screen
- `bg-black/80` — dark overlay
- Inner div: `onClick={e => e.stopPropagation()}` — prevents click-through
- Outer div: NO onClick handler — clicking outside does NOT close
- Has X button (top right) and "Discard" button (bottom left)
- Has "Save" button (bottom right)
- Has "I wasn't AFK" button

The modal is triggered when the app detects the user has been idle/away. It asks the user to fill in what they were doing during the idle period.

## Issue

1. The modal covers the ENTIRE screen (z-[9999]) — nothing else is accessible
2. Clicking outside the modal does NOT close it (no onClick on outer div)
3. The modal may appear on pages where the user doesn't want to deal with it
4. The modal may appear repeatedly or unexpectedly
5. There's no "minimize" or "remind me later" option

## Design Constraints (LAMINAR)

- Monochrome: zinc surfaces, ONE signal hue per surface
- Radii: 8/12/16 only
- Single easing: cubic-bezier(0.16, 1, 0.3, 1)
- No layout-property animation (transform/opacity only)
- prefers-reduced-motion honored

## Files to Modify

- `src/components/AfkPromptModal.tsx` — the modal itself
- Possibly `src/App.tsx` — where the modal is triggered

## Constraints

- No AI agent builds (only CZ builds)
- All changes must pass `npx tsc --noEmit` scoped to changed files
- All changes must pass `npx esbuild` scoped to changed files
