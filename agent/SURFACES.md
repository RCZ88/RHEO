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
| ~~"the handbook"~~ (the 51 KB one) | `src/components/learn/HandbookWorkspace.tsx` — **DEAD CODE, IMPORTED NOWHERE.** Do not edit it expecting a visible change. | (dead) |
| "lyceum" / "learn" / "the learning stuff" / "lessons" / "tutor" | `/learn` | `src/components/learn/LearnPage.tsx` (+ `src/components/learn/*`, `src/services/learn/`) |
| "lecture" | `/lecture` | `src/features/lecture/` |
| "the terminal" / "the console" / "penguin" | `/penguin-console` — the whole multi-pane terminal app | `src/terminal/App.tsx` |
| "app sidebar" / "the nav rail" / "navigation" | the left router rail in `Sidebar.tsx` | `src/components/Sidebar.tsx` |
| "console sidebar" / "left panel of the console" | tab/group tree, drag-to-resize | `src/terminal/components/Chrome.tsx` (`LeftSidebar`) |
| "inspector" / "right panel" / "the panel on the right" | tabbed inspector (inspect/layout/cmds/history/stats/keys/mcp/theme/system/notes/handbook) | `src/terminal/components/Panels.tsx` |
| "workspace" | ⚠️ **AMBIGUOUS** — see `agent/dictionary.md`. Not the app sidebar. | — |

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

## Design reference (the "HTML")

| You say | Is | Note |
|---|---|---|
| "the handbook html" / "follow the html" / "the design from the html" | **`terminal-handbook.html`** at the **repo root** (not in agent/docs) | Canonical palette + component CSS for the Terminal Handbook. Tokens at lines 7–30, components 32–244. Ported to `src/styles/terminal-handbook.css` as `--hb-*` tokens. |

---

## Add-a-row rule

When the user names a surface with a word that is **not** in this file, that is a **bug in this
file**, not a reason to grep. Add the row (word → route → file) and carry on. Keep it one line.
