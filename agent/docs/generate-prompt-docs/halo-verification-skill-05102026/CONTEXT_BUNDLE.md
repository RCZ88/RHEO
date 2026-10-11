# CONTEXT_BUNDLE — Design a new RHEO skill

> Self-contained. The receiving AI has no access to this codebase. Everything is quoted from real
> files. Use it to design ONE new skill for `agent/skills/`.

---

## 0. WHAT IS BEING ASKED FOR

Design **one new skill** for this repository's agent skillset. It must be a *file* the team loads
before doing a specific kind of work, in the same format as the 45 existing skills.

**Recommended subject (state your own if you disagree, and justify it):** a skill that prevents
the class of failure that dominated the Halo Island build — *claiming something works when it was
never executed, and shipping a fix that no gate can see.*

The evidence for why this skill should exist is in §5. Every item there is a real defect that
reached a running application or a cycle report in this session. A skill that prevents even half
of them pays for itself immediately.

---

## 1. THE SKILL FORMAT (copy this exactly)

45 skills exist at `agent/skills/<name>/SKILL.md`. Frontmatter fields actually in use:

```markdown
---
id: paint
name: PAINT — Design Orchestrator
version: 1.0.0
category: design
description: >-
  THE entry point for ALL UI/design work. Conducts 12 design skills + 15 MCP servers in a
  fixed pipeline so they never contradict each other. Load THIS INSTEAD of loading design
  skills individually. Use whenever the task touches a pixel, component, page, chart, color,
  font, radius, hover state, animation, or even one user-facing string. Not for backend-only work.
metadata:
  role: design
  visibility: computer
  role_note: >-
    PAINT is the conductor. skill-router's DESIGN category points here; the 12 sub-skills are
    loaded BY PAINT, in PAINT's order, because they conflict when loaded in arbitrary order.
requires:
  - frontend-external-infra
  - ui-and-charts
  ...
---
```

**Observed conventions**
- `id` is kebab-case and must match the directory name. Some legacy skills have empty or broken
  `id`/`category` values — do not copy that.
- `description` is written **to be matched against a task**. It enumerates concrete trigger
  surfaces, not virtues. "Use whenever the task touches a pixel, component, chart, colour,
  animation" — not "provides design guidance".
- `requires:` lists sibling skills that must be loaded, and this is **load-bearing**: `PAINT`'s own
  header says the 12 sub-skills are loaded *by PAINT, in PAINT's order, because they conflict when
  loaded in arbitrary order.*
- `category` values observed: `design`, `debugging`, `research`, `git`, `capture`, `layout`,
  `meta`, `maintenance`, and empty.
- Progressive disclosure is the norm: `SKILL.md` stays a coordinator, and long reference material
  lives in `references/*.md` loaded on demand. `paint/` has `references/conflict-resolution.md`,
  `references/skill-playbooks.md`, `references/mcp-routing.md`.

**Self-maintenance is mandatory in this repo.** Two real skills state it in their own bodies:

> `paint/SKILL.md` §LAYER 3: *"PAINT is a **living** document. Same rule as the Router: a stale
> orchestrator is worse than none, because every agent trusts it."* — and requires a `version:`
> bump on every sync, plus a conflict log for every conflict resolved by judgment rather than by a
> table row.

> `agent/skills/skill-router/SKILL.md` is named as the routing target for the DESIGN category.
> **A new design/debugging skill must be added to it in the same cycle, or it will never load.**

### Existing skills it could collide with

`paint` (design orchestrator) · `impeccable` · `frontend-design` · `humancentred-UIUX` ·
`motion-alive` · `animation-stack` · `frontend-external-infra` · `fix-problems-recursive` ·
`multi-agent-coordination` · `generate-prompt` · `commit`.

**If your new skill overlaps one of these, say so and either extend that skill instead or state
explicitly why a separate one is justified.** A duplicate is worse than a gap.

---

## 2. THE REGISTRY — real MCP inventory (queried, not assumed)

`components.json` configures four registries. `opencode.json` spawns 14+ MCP servers.

| Registry | Mandate | Verified finding |
|---|---|---|
| `@kokonutui` | general app UI (cards, buttons, inputs, AI-chat surfaces) | no charts |
| `@shadcn` | general app UI core | has `progress`, `card`, `dialog`, `switch`… |
| `@bklit` | **charts and data-viz ONLY** — never hand-rolled Recharts | has `ring-chart`, but it pulls `@visx/group` + `@visx/responsive` + `@visx/shape` + `@number-flow/react` |
| `@react-bits` | animated effects | 135+ components |

**MEASURED registry-quality finding, from querying `shadcn` MCP for a radial progress/ring
component twice:** both queries returned **irrelevant items** (`FlipCard-JS-TW`, `FlipCard-TS-CSS`,
`AnimatedContent-TS-CSS`) for a query that plainly asked for a ring/gauge. A third query with the
word `progress` returned `ring-chart` and `Stepper` buried at positions 6–10.

**Implication for your skill:** *"call the MCP"* is not a sufficient instruction. A skill must tell
the agent **how to judge a registry hit** (does it match the need, how many deps does it drag in, is
there already an in-repo component doing this) and must permit declining. The strongest example in
this codebase: the ring the Halo Island actually uses was **ported from the app's own dashboard**
(`src/pages/dashboard/StatusBand.tsx:338-372`) rather than pulled, because an in-repo production
component outranks a registry hit.

---

## 3. THE DESIGN CONSTITUTION the new skill must respect

`design/design.md` (LAMINAR) is an **enforceable contract**, not advice. Any skill touching UI must
cite it. Selected clauses:

| Clause | Value |
|---|---|
| §2 | one signal hue per surface. amber = time-domain · pink/clay = Focus/brand · emerald = success only · rose = destructive only |
| §3 | Inter + JetBrains Mono + Space Grotesk, **max 2 families per view** |
| §4 | radii `8px` · `12px` (max) · `9999px` (pill). `rounded-2xl`/`rounded-3xl` BANNED |
| §6 | duration easing only; no spring overshoot; no decorative infinite loops; honour `prefers-reduced-motion` |
| §7 | hard-gate blacklist: no raw hex in `.tsx`, no `backdrop-blur` on chrome, no emoji as icons, no neon glow, no `transition-all` |

**Precedence, which must be stated in your skill because sub-skills disagree:**
`design/design.md` → live tokens in `src/index.css` → registry component conventions → pipeline
phase order → sub-skill guidance.

A worked example of that rule changing an outcome: the Halo spec mandates springs; LAMINAR §7.4
bans them; therefore duration easing. The same spec asks for a 24px radius; LAMINAR §4 caps at
12px; therefore 12px.

---

## 4. AGENT RULES A NEW SKILL MUST NOT CONTRADICT

`AGENTS.md` is loaded into every prompt. A skill that contradicts it is worse than no skill.

- **§0-0 / §0-0a — an agent NEVER runs a build.** CZ builds. `dist/` and `dist-electron/` **ARE the
  running application**; a failed or partial build leaves the app bricked. A skill must never
  suggest `npm run build`, `vite build`, `rm -rf dist`, `git clean` on `dist/`, or
  `RHEO_CZ_OVERRIDE=1`.
- **§0.5 — zero destruction.** No `git checkout`/`restore`/`reset --hard`/`clean -fd`; ask before
  removing anything; back up physically before replacing.
- **§0.6 — process teardown.** Every `probe_open` needs a `probe_close`; every backgrounded
  process needs a recorded PID. Match process PIDs with `awk`, **never `pkill -f <pattern>`** — it
  matches the tool's own shell.
- **§0a — multi-agent.** `coord.mjs register` → `status` → `claim`; a DENIED claim is a hard stop;
  never `git add -A`; scope every check to your own files.
- **§0a / §5e — scope discipline.** ~7,700 pre-existing `tsc` errors. A repo-wide error *count* is
  not a signal. Use a `files`-based tsconfig, never `include: ["src"]`.

---

## 5. WHY A VERIFICATION SKILL IS NEEDED — measured evidence

Every item below happened in a single session. None was caught by an existing gate.

| # | Failure | Why every existing gate passed |
|---|---|---|
| 1 | **`useRef` called inside a `useEffect`** → React error #321, entire app screen dead | `tsc` **and** `esbuild` both reported CLEAN. Neither can see an undefined/misplaced binding. Only a browser console revealed it. |
| 2 | **Shipped a "feature" mounted by nothing** — an activity router nothing published into, two components with **0 importers** | Compiles clean, typechecks clean, probes green. It was structurally identical to dead code this repo has been bitten by repeatedly (`SURFACES.md` documents `WorkforcePanel` and `STTFloatingOverlay` as "right code, zero effect"). |
| 3 | **Claimed "connected to the stopwatch" while sending `stopwatch: null`**, with a hardcoded `3*3600_000 + 47*60_000` placeholder that read as a real measurement | Every check green. A *plausible* fixture is worse than an obviously-fake one. |
| 4 | **Used the wrong precedent** — took `transparent: !isLinux` from a *fullscreen* overlay and shipped an opaque black rectangle over the user's screen | The deleted dictation panel used `transparent: true` and worked on the same machine. Precedent must match the *shape* of the thing being built, not just its domain. |
| 5 | **Fixed a platform setting in the wrong place** — `process.env.ELECTRON_OZONE_PLATFORM_HINT` assigned inside `main.ts`, long after Electron had chosen its backend | No error, no warning, no log. The feature simply never worked, and nothing said why. |
| 6 | **A patch that reported success while breaking the file** — a Python slice meant to remove a duplicate type also deleted a hook and a module-scope const | The script ran, printed success, and the file was corrupt. Only a runtime `ReferenceError` caught it. |
| 7 | **Vite bound `[::1]` while Chromium resolved `localhost` to IPv4** → a 45-second navigation timeout that read as an application bug | The app was fine. The failure was entirely environmental. |
| 8 | **Phantom test failure from editing a source file mid-run** — HMR reloaded the page between assertions | 4 of 17 assertions "failed" against correct code. |
| 9 | **Asserted a feature was fixed when the running artifact predated the fix** — the same bundle hash appeared in two consecutive bug reports | The source was correct and the claim was still false, because nobody checked whether the running code contained the fix. |
| 10 | **`pkill -f "<pattern>"` killed the tool's own shell**, because the pattern was present in the command line invoking it | Textbook self-match. Cost a whole tool call. |

**The pattern across all ten:** every one is a gap between *a check passing* and *the thing actually
working*. None is a coding error. That is precisely the gap a verification skill should close.

---

## 6. WHAT THE REPO ALREADY PROVIDES (do not reinvent; reference it)

| Asset | Use it for |
|---|---|
| `agent/probes/halo-core.probe.mts` | 33 assertions, 0 deps, prints numbers. Run: `npx esbuild agent/probes/halo-core.probe.mts --bundle --platform=node --format=esm --outfile=/tmp/p.mjs && node /tmp/p.mjs` |
| `agent/probes/halo-verify.mjs` | 17 Playwright assertions against `npm run dev` |
| `agent/probes/halo-anim.mjs` | Proves animation by counting **intermediate** frames — an instant snap only yields endpoints |
| `tsconfig.halo.json` | `files`-based scoped typecheck, 12 files, 0 diagnostics |
| `npm run validate:pages` | Fails when a `data-section` has no matching element — a real, already-built gate |
| `design/design.md` §7 grep gate | `grep -rEoh "#[0-9a-fA-F]{3,8}" src/` — every survivor must be a token or pure black/white |
| `coord.mjs` | multi-agent register/claim/done |

**There is NO test runner.** No jest, no vitest. Verification is scoped `tsc`, `esbuild`, a
numbers-printing probe, and Playwright. A new skill must not assume `npm test` exists.

---

## 7. DELIVERABLE

One skill, ready to drop in at `agent/skills/<name>/`:

- `SKILL.md` — frontmatter exactly per §1, body as a coordinator, with a numbered procedure whose
  steps are each independently checkable.
- `references/*.md` — as many as the content genuinely needs. Do not pad.
- A one-line diff describing the **required same-cycle edits** outside the new directory: the
  `skill-router` entry (or it never loads) and, if it is a design skill, the `paint` `requires:`
  list and pipeline table per `paint` §LAYER 3.

State the skill's `id`, `name`, `category`, and the exact `description` trigger text you chose, and
justify the description against at least three concrete task phrasings it must match.
