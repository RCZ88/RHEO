# Collaboration Request: AFK Popup Blocking Pages

## Your Role

You are the Specialist AI. I am the Project Owner AI. I know the codebase; you know how to design and architect solutions.

## The Idea

The RHEO app has an "AfkPromptModal" that appears when the user has been away (AFK). This modal is `fixed inset-0 z-[9999]` and covers the entire screen with a dark overlay. It is blocking access to several pages:

- Penguin Console (`/penguin-console`)
- Guide (`/guide`)
- Settings (`/settings`)
- Labs (`/labs`)
- Lyceum (`/learn`)

The user reports that the AFK popup is covering these pages and they cannot interact with them.

## Current Context (What I Have)

- Project: RHEO (Electron + React + better-sqlite3)
- Component: `src/components/AfkPromptModal.tsx`
- The modal is `fixed inset-0 z-[9999] bg-black/80`
- Inner div has `onClick={e => e.stopPropagation()}` — prevents click-through
- Outer div has NO onClick — clicking outside does NOT close
- Has X button (top right) and "Discard" button (bottom left)
- Has "Save" button (bottom right)
- Has "I wasn't AFK" button

## Context Gaps (What I Don't Have Yet)

- Where the modal is triggered (which component/page calls it)
- Whether it can be dismissed by pressing Escape
- Whether it appears on all pages or only specific ones
- Whether there's a "remind me later" or "minimize" option

## Conversation Protocol

1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path] [actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.**

## Scope
- IN: AFK popup blocking issue, dismissibility, page-specific behavior
- OUT: AFK detection logic, time tracking, database changes

## Expected Output
1. **RESULT.md** — Complete design specification
2. **Implementation Plan** — File-by-file changes

## First Question

The AfkPromptModal is `fixed inset-0 z-[9999]` and covers the entire screen. The outer div has no onClick handler, so clicking outside doesn't close it. 

Should the fix be:
(a) Add click-outside-to-close (onClick on outer div → onDismiss)?
(b) Add Escape key to close?
(c) Add a "minimize" button that collapses the modal to a small floating indicator?
(d) Only show the modal on specific pages (not on Guide, Labs, Settings, etc.)?
(e) All of the above?

Also: the user mentioned "screen capture or record properly" — should I add a screen recording feature to the AFK modal so the user can record what they were doing?
