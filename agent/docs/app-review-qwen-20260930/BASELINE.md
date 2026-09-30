# App-Wide Quality Review — Baseline

> **Purpose of this commit:** this tree is the **review baseline**. An app-wide quality
> review (surface by surface) is to be performed against this exact commit by **Qwen**.
> Start from this state; do not review a moving target.

| Field | Value |
|---|---|
| Review baseline | the commit that adds this file (`feat:` review-baseline commit) |
| Branch | `refactor/architecture-base` |
| Version labelled | README **7.0** / website **v0.2.0** (2026-09-30) |
| Scope | the whole app — every route and surface, not one feature |
| Diff size | 195 files, +75,754 / −10,470 |

---

## 1. What changed in this baseline

Four things landed together. Review them as one state, not as separate patches.

1. **Chat Library** — AI conversations persisted, searchable, pinnable, thread-grouped,
   exportable. New: `src/main/ai/chatLibrary.ts`, `src/components/ai/chat/`.
2. **External AI transport seam** — one prompt pipeline shared by the app and the
   browser extension: `src/services/externalAiTransport.ts`, `aigateway:send-prompt`.
3. **Dashboard rebuilt around a widget registry** — declarative widget registration,
   jump-to-widget navigation, persisted layouts, three visual prototypes.
4. **Assorted fixes** — native find bar rewrite, Penguin Console real/demo mode,
   Linux foreground detection, Settings Colors/Prompts, coordination CLI fix.

---

## 2. Known issues ALREADY present at this baseline

Do not report these as new findings — they are pre-existing and were confirmed
before this commit was cut. Verify, then route them to a backlog rather than
treating them as regressions from the diff.

| # | Finding | Evidence | Status |
|---|---|---|---|
| K1 | `tsc --noEmit` fails with **8 errors in live code** — `src/terminal/index.ts` imports `MCP_RESOURCES`, `MCP_PERIPHERALS`, `TOOL_NAMES`, `DEFAULT_PRESET`, `ANOMALY_LABELS`, `ANOMALY_ACTIONS` from `./lib/data`, which exports none of them | `npx tsc --noEmit --project tsconfig.app.json` | **Pre-existing** — neither file is touched by this changeset |
| K2 | `src/terminal_backup/` is a **tracked backup directory** that is compiled by the typecheck config and produces ~30 further errors (broken imports to `./hooks/useConsoleStore`, `./lib/data`, etc.) | `git ls-files src/terminal_backup` returns tracked files | **Pre-existing** — tracked before this commit; not ignored by `.gitignore` |
| K3 | `src/components/dashboard/WidgetGrid.tsx` (44 KB) is **orphaned dead code** — nothing imports it, yet it still does `import './layout-editor.css'` for a file **deleted in this changeset** | `grep -rn "from '.*dashboard/WidgetGrid'"` → no hits; `layout-editor.css` is `D` in this diff | Landmine, not a build break — Vite never bundles an unreachable file |
| K4 | Two independent version schemes are in use — README uses integers (`6.0` → `7.0`), the website uses `0.x` (`v0.1.0` → `v0.2.0`), and the two are not derived from each other | `README.md` §Version History vs `landing/src/components/rheo/Changelog.tsx` | Intentional for now; flag if it should be unified |

---

## 3. Surfaces to review

Route → owning file is the authority here: read `agent/SURFACES.md` before grepping.
If a word for a surface is missing from `SURFACES.md`, that is a bug in `SURFACES.md`.

| Surface | Route | Where |
|---|---|---|
| Dashboard | `/` | `src/pages/DashboardPage.tsx` + `src/components/dashboard/` |
| Activity | `/activity` | `src/pages/ActivityPage.tsx` |
| AI / Chat Library | `/ai` | `src/pages/AiPage.tsx` + `src/components/ai/chat/` |
| Penguin Console | `/penguin-console` | `src/terminal/App.tsx` |
| Life (phases, habits, schedule) | `/life` | `src/features/warmth/LifePage.tsx` |
| Studio / Content Engine | `/studio` | `src/features/overlay-studio/`, `src/features/content-engine/` |
| Learn / Lyceum | `/learn` | `src/components/learn/LearnPage.tsx` |
| Guide | `/guide` | `src/pages/GuidePage.tsx` |
| Finance | `/finance` | `src/pages/FinancePage.tsx` |
| Settings | `/settings` | `src/pages/SettingsPage.tsx` + `src/pages/settings/` |

---

## 4. How to verify (do not skip the UI layer)

An IPC probe returning data is **not** proof a feature works. Three layers, and
the layer you claim depends on where the feature lives:

1. **IPC** — `window.deskflowAPI.foo()` resolves. Proves the backend answers only.
2. **UI** — real clicks on real controls. Never set a React controlled input
   programmatically; `onChange` will not fire and you will get a false pass.
3. **Runtime** — attach with **Probe MCP** (`probe_discover` → `probe_open` with
   `attach:true`) to the already-running app. Do **not** launch Electron by hand.

Additional repo rules the reviewer must respect:

- The DB has exactly one writer. Do DB work only with the app stopped, via `db-guard.mjs`.
- Never build while the app runs, and never run the app while building.
- `git checkout`/`reset --hard`/`clean`/`stash drop` are forbidden without explicit human approval.

---

## 5. What a good finding looks like

- **Surface + route** and the exact file:line.
- **Reproduction steps** that a human can follow from a cold start.
- **Layer** (IPC / UI / runtime) and the console evidence.
- Whether it is a **regression from this diff** or one of the known issues in §2.

Do not pad the report with style opinions that no user would notice. Rank by
user-visible impact: data loss and crashes first, dead controls second, polish last.
