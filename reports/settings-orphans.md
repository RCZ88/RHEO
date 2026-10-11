# `src/pages/settings/` — hand-verified orphan census

Verified by direct grep of every reference (NOT by the regex audit — see the note
in `scripts/audit-silent-failures.mjs`).

## Live

| File | Evidence |
|---|---|
| `shared/` (`SearchableSection`, `ColorPicker`, `TierContainer`, `SortableChip`) | `SettingsPage.tsx:22` |
| `registry/` (`searchSettings`, `SettingsTabId`) | `SettingsPage.tsx:55-56` |

## Dead — exported, never mounted

`AdvancedSection` · `AppearanceSection` · `ColorsSection` · `IntegrationSection` ·
`NotificationSection` · `PrivacySection` · `ProfileSection` · `PromptsSection` ·
`ShortcutSection` · `types.ts`

- `SettingsPage.tsx` imports **only** `shared/` and `registry/`.
- `ColorsSection` and `PromptsSection`: **0 references anywhere.**
- The other seven matched exactly **one** line each — their own
  `*SectionProps` interface in `types.ts`, never an import.
- `/compositions` → `/ai` is a deliberate legacy redirect (`App.tsx:3513`).

## Consequence

The live Settings UI is the **6,496-line `SettingsPage.tsx` monolith**. Every
extracted `*Section.tsx` is a ghost that still contains plausible-looking
implementations. Anyone reading or editing a `*Section.tsx` believes they have
changed Settings; the running app never renders it.

Live `SettingsPage` has **no** `sttPanel` reference — so the STT entry point that
`ColorsSection` implements does not exist in the shipped Settings at all.
