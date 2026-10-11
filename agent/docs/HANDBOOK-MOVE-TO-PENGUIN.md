# FIX PACKET — Move the Handbook out of the Terminal Workspace into Penguin Console

**To:** the agent working on Penguin Console
**From:** CZ
**Priority:** high (Penguin Console currently shows the wrong UI, and several things are not implemented)

---

## 0. The one rule

The big Learn **Handbook does not belong to the Terminal Workspace**. It belongs to
**Penguin Console**. Do not "fix" this by editing Penguin Console's styling — the
content is in the wrong app entirely.

---

## 1. What is wrong right now

### 1a. The handbook is mounted on the Terminal Workspace

`src/pages/TerminalPage.tsx` — route `/terminal` — renders a handbook group with
**three sub-tabs**:

| Sub-tab id | Label | Renders | Line |
|---|---|---|---|
| `handbook-sections` | Sections | `<HandbookWorkspace />` | 4596 |
| `handbook-reference` | Reference | `<HandbookReference />` | 4606 |
| `handbook-practice` | Practice | `<HandbookWorkspace />` | (same block) |

- Import: `src/pages/TerminalPage.tsx:56` → `import { HandbookWorkspace } from '../components/learn/HandbookWorkspace';`
- Components: `src/components/learn/HandbookWorkspace.tsx` (53,318 B) and
  `src/components/learn/HandbookReference.tsx` (5,371 B)

### 1b. CRITICAL — these are TWO DIFFERENT components. Do not merge them.

Penguin Console **already has** a tab labelled `Handbook`, and it is **NOT** the
component above:

| | Terminal Workspace | Penguin Console (existing) |
|---|---|---|
| Component | `HandbookWorkspace` | `CommandNotesPanel` |
| File | `src/components/learn/HandbookWorkspace.tsx` | `src/terminal/components/CommandNotesPanel.tsx` |
| Content | The big Learn handbook: sections / reference / practice | Per-session AI **command notes**: what / when / gotcha / params / safety / related, plus a ✦ Generate button |

`CommandNotesPanel` is **correct where it is and must not be deleted or replaced.**
You are moving `HandbookWorkspace` + `HandbookReference` next to it — not on top of it.

### 1c. `HandbookWorkspace` is documented as dead code but is not

`agent/SURFACES.md` states:

> ~~"the handbook"~~ (the 51 KB one) — `src/components/learn/HandbookWorkspace.tsx` —
> **DEAD CODE, IMPORTED NOWHERE.** Do not edit it expecting a visible change.

It **is** imported (`TerminalPage.tsx:56`). **Update that row in `SURFACES.md`** to
match reality once this packet lands, otherwise the next agent will trust the lie.

### 1d. Penguin Console has zero `learn/` wiring

```
grep -rn "components/learn" src/terminal/   →   (no matches)
```

Nothing has been moved yet. This is net-new work in that app.

---

## 2. Existing insertion point in Penguin Console

`src/terminal/components/Panels.tsx`, the inspector section/tab array, around line 824:

```jsx
{
  title: "Reference",
  tabs: [{ id: "handbook", label: "Handbook", icon: <BookOpen size={13} /> }],
},
```

That `handbook` id is **`CommandNotesPanel`**. Add the moved content as **additional
tabs in the same `Reference` section**, e.g.:

```jsx
{
  title: "Reference",
  tabs: [
    { id: "handbook",     label: "Handbook",  icon: <BookOpen size={13} /> },   // CommandNotesPanel — KEEP
    { id: "handbook-ref", label: "Reference", icon: <FileText  size={13} /> },  // HandbookReference  — MOVED
    { id: "handbook-part",label: "Practice",  icon: <TerminalIcon size={13}/> },// HandbookWorkspace  — MOVED
  ],
},
```

Reuse the **same icons and sizing convention** as the neighbouring tabs. Match the
panel's existing visual language exactly — do not introduce a new one.

### 2a. What is NOT yet implemented on Penguin Console (CZ reports the UI is wrong)

Treat this as part of the same job. Confirm each against the real running app, not the source:

- The `Handbook` / `CommandNotesPanel` tab renders, and its detail tabs (what / when /
  gotcha / params / safety / related) actually switch content.
- The ✦ **Generate** button works end to end and surfaces failures instead of silently
  doing nothing.
- No dead/broken tabs remain in the `Reference` section.
- The panel scrolls correctly when the handbook body is tall (the inspector is a
  `flex flex-col min-h-0` column — a long handbook will overflow it unless handled).

Report honestly which of these were already fine. Do not claim a pass you did not click.

---

## 3. Deliverables

1. **Add** the two moved surfaces to Penguin Console's `Reference` section as tabs.
2. **Remove** the handbook group from `src/pages/TerminalPage.tsx` — the three
   sub-tabs **and** the now-unused `HandbookWorkspace` import at line 56.
   Check whether `HandbookReference` has its own import there and remove it too.
3. **Keep** `CommandNotesPanel` and its `handbook` tab exactly as they are.
4. **Fix the `SURFACES.md` row** described in §1c.
5. **Verify the whole Learn surface** — if `HandbookWorkspace` is reachable *only* from
   the Terminal Workspace, removing it there may orphan other entries. Grep for every
   importer before you delete anything.

---

## 4. Hard constraints

- **Do not delete `HandbookWorkspace.tsx` or `HandbookReference.tsx`.** Move the usage.
- **Do not merge, rename, or overwrite `CommandNotesPanel`.**
- **Do not delete `TerminalPage`'s other group tabs.** Only the handbook group goes.
- **Preserve the components' behaviour.** They have their own storage keys
  (`storageKey="handbook"` on the Terminal side). Decide deliberately what the new
  keys are on the Penguin side — do not let two surfaces silently share one key.
- **Do not run a build.** Only CZ builds (`AGENTS.md` §0-0). Verify with scoped
  `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "<your paths>"`,
  writing full output to a file and never piping it through `head`.
- **Never delete `dist/` or `dist-electron/`.** They are the running app (§0-0a).

---

## 5. Test before claiming it works

- `/terminal` → the handbook group is **gone**, and nothing else in that page broke.
- `/penguin-console` → `Reference` section shows the moved tabs, each renders content.
- `CommandNotesPanel`'s handbook tab still works, Generate included.
- Scoped `tsc` shows **0 errors in the files you touched**. Grep the diff for your own
  markers; another agent is live-editing these files.
- Confirm no console errors and no black screen.

If any of the above is untested, say **NOT TESTED** and name who must run it.
An honest `NOT TESTED` is worth more than a fabricated `PASS`.