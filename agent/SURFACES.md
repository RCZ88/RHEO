# SURFACES.md — what you call it → where it actually lives

> **This file is FORCE-LOADED into every agent prompt** (see `opencode.json` → `instructions`).
> **RULE: before you grep, read this file.** If the word you need is not here, ADD IT — do not
> spend a turn grepping for a word the user already told you.
> Format per row: **you say** → **route** → **the file that owns it**.
> Colloquial words are expected and encouraged. Keep every row to one line.

---

## 🔴 Confused pairs — these have burned us before

| You say | Actually is | Owning file |
|---|---|---|
| "the guide" / "guides" / "a guide" | `/guide` → tab shell with **Tutorial** + **Feature Specs**. Static `FEATURES` (21) + `FEATURE_SPECS` (17) arrays. **No DB, no create UI, no prompts.** | `src/pages/GuidePage.tsx` |
| "content engine" / "the engine" / "frameworks" / "the guide with explanations" | `/studio` → Overlay Studio page → **mode switcher** (`studio`\|`engine`\|`presentation`) → `ContentEngineWorkspace` → **8-stage pipeline nav** → `FrameworksView` (stage 7). DB table `content_frameworks`. | `src/features/overlay-studio/OverlayStudioPage.tsx` → `src/features/content-engine/ContentEngineWorkspace.tsx` → `src/features/content-engine/components/FrameworksView.tsx` |
| "the terminal handbook" / "handbook" / "learn AI commands" | **Right panel** of Penguin Console, tab `Handbook` (also the `Notes` tab). Has the ✦ **Generate** button + what/when/gotcha/params/safety/related detail tabs. | `src/terminal/components/CommandNotesPanel.tsx` |
| "the big handbook" / "the 51 KB one" / "Sections" / "Practice" | `HandbookWorkspace` — the full Learn handbook (sections + practice) and `HandbookReference` (cheat sheet). **NOT dead code** — this row used to claim it was "IMPORTED NOWHERE", which was FALSE and cost an agent real time. It was mounted on `/terminal`, and as of 2026-10-05 lives in **Penguin Console** under the inspector's **Reference** section (`handbook-part` / `handbook-ref`). **Distinct from `CommandNotesPanel`**, which is the separate per-session AI command-notes tab (`handbook`). | `src/components/learn/HandbookWorkspace.tsx` + `HandbookReference.tsx` |
| "lyceum" / "learn" / "the learning stuff" / "lessons" / "tutor" | `/learn` | `src/components/learn/LearnPage.tsx` (+ `src/components/learn/*`, `src/services/learn/`) |
| "lecture" | `/lecture` | `src/features/lecture/` |
| "the terminal" / "the console" / "penguin" | `/penguin-console` — the whole multi-pane terminal app | `src/terminal/App.tsx` |
| "app sidebar" / "the nav rail" / "navigation" | the left router rail in `Sidebar.tsx` | `src/components/Sidebar.tsx` |
| "console sidebar" / "left panel of the console" | tab/group tree, drag-to-resize | `src/terminal/components/Chrome.tsx` (`LeftSidebar`) |
| "inspector" / "right panel" / "the panel on the right" | tabbed inspector (inspect/layout/cmds/history/stats/keys/mcp/theme/system/notes/handbook) | `src/terminal/components/Panels.tsx` |
| "the workforce inspector" | the NEW isometric scene's inspector pane — **not** the row above. Unmounted, like its whole cluster (see the RHEO Workforce table below). | `src/components/terminal/workforce/WorkforceInspector.tsx` |
| "the old workforce strip" / "ambient animation" / "the flat 2D scene" | the OLDER flat DOM scene — **the only workforce visual actually mounted.** `TerminalPage.tsx:62` imports it and it renders `WorkforceScene`. The isometric scene below is a separate, currently unmounted cluster. | `src/components/terminal/AgentAmbientAnimation.tsx` → `src/components/terminal/workforce/WorkforceScene.tsx` |
| "workspace" | ⚠️ **AMBIGUOUS** — see `agent/dictionary.md`. Not the app sidebar. | — |

| "the halo spec" / "the guide for the island" / "the 4195-line spec" | **THE GOVERNING SPEC** — 4,195 lines, 193 sections, Electron+TS+React cross-platform island. Canonical copy: `agent/docs/HALO_CROSS_PLATFORM_SPEC.md`. Original filename: `agent/docs/halo_cross_platform_agent_spec_compact(1).md`. Older, DIFFERENT geometry (`520x300` hard canvas, `232x40` compact) lives in `agent/docs/generate-prompt-docs/halo-widget-curation-05102026/RESULT.md` — that one is NOT the current spec. | — |
| "the tracking migration" / "the tracker" / "the background tracker" / "rheo-tracker" / "why does tracking stop" / "continue the tracking work" / "sync windows and linux" / "rheo-sync" / "the profile migration" / "which db is live" / "is the ntfs mount needed" | **THE CANONICAL HANDOFF** — `agent/docs/RHEO_TRACKING_MIGRATION.md`. Covers the always-on systemd user tracker (`rheo-tracker/`), the app profile move off the NTFS mount, the Windows⇄Linux merger (`rheo-sync`), backups + rollback, and the 8 bugs found. **READ THIS INSTEAD OF GUESSING** — `~/.config/RHEO` is live and `.../Application Data/RHEO` is the Windows copy; `logs.id` is not a valid merge key. | `rheo-tracker/` (daemon) + `agent/docs/RHEO_TRACKING_MIGRATION.md` (context) |

---

## App routes (source of truth: `src/components/Sidebar.tsx`)

| You say | Route | Owning file |
|---|---|---|
| dashboard / home | `/` | `src/pages/DashboardPage.tsx` |
| activity / logs | `/activity` | `src/pages/ActivityPage.tsx` |
| ide / projects | `/ide` | `src/pages/IDEProjectsPage.tsx` |
| ai / assistant / deck | `/ai` | `src/components/ai/deck/AiPageDeck.tsx` |
| insights / reports | `/reports` | `src/pages/InsightsPage.tsx` |
| life | `/life` | `src/features/warmth/LifePage.tsx` |
| finance / money | `/finance` | `src/pages/FinancePage.tsx` |
| resume / cv | `/resume` | `src/pages/ResumePage.tsx` |
| settings / config | `/settings` | `src/pages/SettingsPage.tsx` |
| studio / overlay / content engine | `/studio` | `src/features/overlay-studio/OverlayStudioPage.tsx` |

---

## RHEO Workforce — the isometric agent-office scene (lives at `/terminal`)

> ⚠️ **BUILT BUT NOT MOUNTED.** `TerminalPage.tsx:62` imports `AgentAmbientAnimation` — the **old
> flat scene** — and *not* `WorkforcePanel`. Nothing in `src/` imports `WorkforcePanel`, so editing
> any renderer file below changes **nothing visible**. This is the same trap as
> `HandbookWorkspace.tsx` in the confused-pairs table above: right code, zero effect. To wire it
> up, mount `WorkforcePanel` from `TerminalPage`.

| You say | Is | Owning file |
|---|---|---|
| "workforce" / "the workforce scene" / "the office" | the NEW isometric SVG scene — unmounted | `src/components/terminal/workforce/IsometricWorkforceScene.tsx` |
| "workforce panel" / "the panel with the scene and the inspector" | the intended `/terminal` mount point (scene + inspector side by side). Imports everything below; imported by **nothing**. | `src/components/terminal/workforce/WorkforcePanel.tsx` |
| "workforce event contract" / "ActionEvent" / "classifyAction" | shared types + action classifier (`ActionEvent`:65, `classifyAction`:318). The one genuinely cross-process file — imported by both `src/main.ts` and the renderer. | `src/shared/workforceActivity.ts` |
| "workforce adapters" / "the PTY adapter" | main-process PTY→event adapter, batcher, recorder. Wired at `src/main.ts:90`. | `src/main/workforceAdapters.ts` |
| "workforce store" / "the reducer" | pure reducer: `workforce:event` IPC → scene state | `src/components/terminal/workforce/workforceStore.ts` |
| "workforce feed hook" | IPC subscription → store → scene model | `src/components/terminal/workforce/useWorkforceFeed.ts` |
| "workforce scene model" / "stations" / "pathfinding" | station/worker animation model + projection math | `src/components/terminal/workforce/workforceSceneModel.ts` |
| "the stations" / "station components" | the per-station SVG components the scene composes | `src/components/terminal/workforce/WorkforceStations.tsx` |

---

## Cross-cutting migrations

| You say | Is | Note |
|---|---|---|
| "the tracking migration" / "rheo-sync" / "the background tracker" | `agent/docs/RHEO_TRACKING_MIGRATION.md` | The always-on `rheo-tracker` systemd service, the app profile moved off the NTFS mount, and the Windows⇄Linux DB merger. Contains the measured facts (`logs.id` is not a merge key; two profiles are intentional), the backup/rollback paths, and the 8 bugs found. |
| "backup" / "autosave" / "restore" / "lost my work" / "files reverted" / "stash" | **GIT SAFETY** — autosave refs, bundles, source tars, and the git guard | `scripts/safety/` + **`agent/docs/GIT_SAFETY.md`** (AGENTS.md §0.7). Agents may run `rheo-safety.sh status` / `list` only; `autosave`/`backup`/`restore`/`install` are CZ's unless he says so in that message. Files reverted or gone → the **`git-trauma`** skill, never self-repair. Database backups are a *different* system — `db-guard.mjs` / `rheo-sync`, not this one. |

---

## Design reference (the "HTML")

| You say | Is | Note |
|---|---|---|
| "the handbook html" / "follow the html" / "the design from the html" | **`terminal-handbook.html`** at the **repo root** (not in agent/docs) | Canonical palette + component CSS for the Terminal Handbook. Tokens at lines 7–30, components 32–244. Ported to `src/styles/terminal-handbook.css` as `--hb-*` tokens. |

---

## Add-a-row rule

When the user names a surface with a word that is **not** in this file, that is a **bug in this
file**, not a reason to grep. Add the row (word → route → file) and carry on. Keep it one line.
