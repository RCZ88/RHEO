# Conversation State — Halo Island settings screen

- **Session:** `ses_eeb53879dfferFcd67LnqoqDhV`
- **Authority:** `HALO_HANDOFF.md` + `agent/docs/HALO_STATES.html` (same authorship)
- **Specialist:** Claude (external, no codebase access — all context embedded in INITIAL_PROMPT.md)
- **Project Owner:** opencode (full codebase access, fetches CONTEXT)
- **Relay:** CZ (copy-pastes verbatim, edits nothing)

## Round 1

**CZ's request (verbatim):**
> "settings to be able to select and adjust the size of everything that is included on the island"
> "it should have like UI that is draggable and like change the spot and like size adjust"
> "no i odnt trust u on building all the ui for the sttings urself"

**Decisions made:**
- CZ rejected the first-pass widget UI (up/down buttons). He wants **drag** interaction.
- Escalated to the Specialist because the sizing requirement has a genuine design conflict
  (single global type ramp vs. per-widget override), not because of missing skill.

**Convergence status:** ⏳ awaiting Specialist — INITIAL_PROMPT.md sent, no REQUEST yet.

## Open questions blocking implementation

1. **Size**: per-widget override, or the global S/M/L that already exists at
   `SettingsPage.tsx`? Unanswered — will not guess.
2. **"Change the spot"**: screen placement (built), widget slot order (built), or freeform
   island drag? Handoff §127 "forbids freeform positioning" — so freeform may be spec-blocked.
3. **Drag pattern**: `@dnd-kit/sortable` is available and already used in
   `CanvasGrid.tsx` / `CardLibrary.tsx`; need the house pattern confirmed.

## Facts verified before escalating (not guesses)

- `widgets{visible,compact}`, `order[]`, `maxVisible` all exist in `HALO_DEFAULTS`
  (`HaloPreferences.ts:274`) and `normalizeHaloPrefs` persists them correctly.
- The island reads all of it: `OverlayRoot.tsx:655-694`.
- `HALO_ORDERABLE = ['now','aiUsage','hud','nextDeadline','tierBreakdown','afkGap']`
  (`HaloPreferences.ts:267`). Hero `stopwatch` is deliberately NOT reorderable.
- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2 present.
- My rejected draft parses (0 diagnostics) and would persist correctly — rejected on
  interaction grounds only, not correctness.