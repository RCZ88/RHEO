# PROMPT — Write the rules for adding an experimental feature to `/labs`

> Hand this to the agent who owns the Labs hub. It is a **documentation +
> convention** task. It does **not** authorise them to build a new feature.
> Their live work on the Labs page is not in scope for this prompt.

---

## ROLE

You own the `/labs` hub in the DeskFlow/RHEO Electron+React app
(`/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`).

A request came in: *"there needs to be a procedure — a set of instructions on the
rules to add a new experimental feature, that includes having a button with all
the descriptions like the other 3 features (Lecture, Content Engine, …)."*

Three things are true right now and they are the reason this prompt exists:

1. **There is NO procedure.** `agent/skills/feature-integration/SKILL.md` is the
   closest thing and it says nothing about Labs, nothing about experimentals,
   and nothing about the rail-vs-hub placement decision. It is stale.
2. **There is no visible button.** `LabPlate` in `src/pages/LabsPage.tsx:92-171`
   wraps the entire card in one `<Link>`, so it *is* navigable — but the
   affordance is a plain `<span>Open →</span>` in the footer, visually
   indistinguishable from the two factual `<li>` rows beside it. There is no
   button a user can point at.
3. **Nobody can predict where a new feature should go.** A page can end up in
   the sidebar rail, in `/labs`, or reachable only by raw URL, and the choice is
   currently made by whoever happened to be writing the code.

## TASK 1 — Write the procedure (the deliverable)

Create a skill at **`agent/skills/labs-feature/SKILL.md`** covering the rules for
adding an experimental feature. Follow the conventions of the existing skills
(`agent/skills/*/SKILL.md`): YAML frontmatter with `id` / `name` / `description`
/ `category`, then a prose body that explains *why* each rule exists rather than
just listing rules.

It must cover, at minimum:

### A. Placement — the decision that is currently missing

Give a **decision procedure**, not a vibe. Something equivalent to:

| Signal | Goes to |
|---|---|
| Core daily-driver surface, most users need it | **Sidebar rail** (`src/components/sidebar/items.ts`) |
| Experimental / opt-in / still finding its shape | **`/labs`** (`src/components/labs/labRegistry.ts`) |
| Surface the user never chooses to visit (diagnostics, background) | **Neither** — ⌘K registry only |
| External/derived surface that isn't RHEO-native and needs a home | **`/labs`** |

And state the **exclusion rule explicitly**, because this is the part that keeps
being got wrong: **a feature that was built inside the app's own design system
is not automatically a Labs candidate.** Speech-to-Text is the worked example —
it is native, it has its own floating panel, and it does not belong in Labs
merely because it is new. Labs exists for surfaces that were built *outside* the
design system and need a native hub to be honest about (that is literally what
the `labRegistry.ts` header says). **New ≠ experimental.** Say that plainly.

### B. The mandatory fields — "all the descriptions like the other 3"

A new Lab is **not done** until every field of the `Lab` interface is filled
honestly. Enumerate them with what each one is *for* and the trap in each:

- `id` — mono specimen ID, stable, e.g. `LB-04`. Sequential; check the last one first.
- `name` — the label the rest of the app uses.
- `brand` — optional; only when the product's own name differs from `name`.
- `makes` — ONE line: what it produces. This is the card subtitle.
- `route` — where the user lands. **Must be a real route in `App.tsx`.**
- `icon` — lucide name from the allowed union (`clapperboard` | `file-text` | `presentation`). Never emoji (LAMINAR §7.5).
- `aiPath` — `'on-device' | 'in-app' | 'hybrid'`.
- `aiPathLabel` — human phrase for that path. **Must not contradict `aiPath`.**
- `roundTrip` — `{ input, forge, output }`: what the user puts in, the machinery
  that transforms it (**with a count derived from the real source module, not
  typed by hand** — see the `labRegistry.ts` header, this is the rule that stops
  the hub repeating Content Engine's "8-stage" lie), and the artifact after.
- `backing` — implementation surface, e.g. `SQLite · 18 tables`.
- `facts` — 2–3 **checkable structural** facts. **Never a quality claim.** Not
  "fast", not "beautiful" — "9 pipeline stages", "per-frame retention evidence".

### C. The non-negotiables that are easy to skip

1. **A page manifest is mandatory** (`src/pages/registry/pages/<name>.ts`,
   registered in `manifests.ts`). Adding a card without a manifest makes the ⌘K
   palette and Ctrl+F lie about the app.
2. **`npm run validate:pages` must return to its baseline error count.** Note
   the baseline is currently **exactly 1 pre-existing error**
   (`route "/agentic" has no manifest`) — that is NOT yours. Success is 1, not 0.
3. **Every manifest `sections[].id` needs a matching `data-section` written in
   the page component.** Declaring an anchor nothing renders is the exact rot the
   registry was built to remove — ⌘K navigates and then silently scrolls nowhere.
4. **Route the button.** The Lab's `route` must resolve in `App.tsx`, or the card
   is a dead end.
5. **LAMINAR applies to the feature page**, not just the card: one signal hue,
   radii ∈ {8px, 12px, pill}, max 2 font families, no `backdrop-blur` on chrome,
   no raw hex in a `.tsx`, no spring, `prefers-reduced-motion` honored.
6. **A claim is not exclusivity.** Run the coordination gate
   (`agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs`):
   `register` → `status` → `claim` → `done`. Several files you need already carry
   other agents' uncommitted work — surgical edits only, never a whole-file
   rewrite over someone else's in-flight change.

### D. A worked checklist

End with a copy-pasteable checklist an agent can run top to bottom for a new lab.

## TASK 2 — The button (only if it is yours)

If — and only if — the Labs card is in your current scope: replace the footer
`<span>Open →</span>` affordance with a **real button-looking element** that is
still reachable by keyboard and has a ≥44px target.

**Constraint that matters:** `LabPlate` is currently ONE `<Link>` wrapping the
whole card *precisely so it has no nested interactives* (see the comment at
`LabsPage.tsx:87-91`). **Do not nest a `<button>` inside a `<Link>`** — that is
invalid HTML, it breaks the single-tab-stop keyboard model, and screen readers
announce it twice. The correct shapes are either:

- keep the `<Link>` and make the footer affordance *look* like a button
  (border + background + the accent on hover) while staying a `<span>` inside the
  link, or
- drop the whole-card link and put a real `<Link>`-styled-as-button in the footer.

Pick one, say which and why in the skill. **The whole card must remain
navigable** — that is a feature, not an accident.

## OUT OF SCOPE

- Building any new experimental feature.
- `src/App.tsx`, `src/index.css`, and anything outside the Labs surface.
- The profiler page. It is owned by another agent and is being finished
  separately — do not add it to `labRegistry.ts` yourself; a card for it is
  already requested and will be wired by its owner once the page is correct.

## VERIFY BEFORE YOU REPORT

```
node scripts/validate-page-manifests.mjs          # must be the 1-error baseline
npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "<your paths>"
npx esbuild <your files> --bundle --outfile=/dev/null \
  --alias:@=./src --external:react --external:lucide-react --log-level=warning
grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" <your files> | sort | uniq -c   # §7 gate
```

Do **not** run `npm run build` — CZ builds (AGENTS.md §0-0). Report in CYCLE
REPORT format and say `NOT TESTED` for anything you could not run.