---
name: feature-integration
description: >-
  Use whenever a new feature, page, or module is being added to an existing
  app — especially when it was generated somewhere with no knowledge of
  this codebase (a different AI, a prototype tool, a scaffold). Guides
  turning that into a real, connected part of the product: audit the app's
  database, design system, and existing features first; treat the
  generated code as a spec for logic, not a drop-in deliverable; write an
  integration plan (data model, design-system mapping, cross-feature hooks,
  build order) before implementing; then run a verification pass that
  catches features that were "mounted" but never integrated — mock data
  left in place, off-brand UI, missing database wiring, dead-end features
  that don't connect to the rest of the app the way a user would expect.
  Trigger for "integrate this into the app," "wire this up to the
  database," "another AI built this, make it fit," "connect this to my
  other features," or any request to take a generated component/page/module
  and make it a real part of the product.
---

# Feature Integration

## The failure mode this exists to prevent

The default thing an agent does with a freshly generated feature — a page, a
component, a module someone handed it — is drop it into the project
structure, wire up just enough for it to render without crashing, and call it
done. That's placement, not integration. It looks finished because it
compiles and the page loads. It isn't finished, because:

- it reads and writes fake or local-only data instead of the app's real
  database
- its UI looks like whatever the generating tool's defaults are, not like the
  rest of the app
- it has no idea the app already has a to-do list, a notes feature, a
  schedule, a notification system — so it doesn't feed any of them, even
  when a user would obviously expect it to
- it's reachable only if you know the raw route, because nobody added it to
  navigation or checked it against the app's permission model

This happens because whatever generated the feature — another AI, a scaffold,
a prototype tool — had no context on this application. It could only guess at
a database schema, invent its own visual style, and had no way to know what
other features exist. None of that is a flaw in the generated code; it's just
the ceiling of what's possible without context. Closing that gap is the
agent's job, and it's a job that has to happen deliberately, not by osmosis.

## What "integrated" actually means

A feature is integrated when it touches all of these, not just the ones that
happen to be obvious:

1. **Data** — it reads and writes through the app's real database layer,
   using the app's existing schema/migration conventions. No mock arrays,
   no `localStorage`-as-a-database, no hardcoded fixtures left behind after
   the demo works.
2. **Design system** — it looks like it was built by the same team that
   built everything else: same tokens, same components, same spacing and
   type scale. Not "close enough," rebuilt to match.
3. **The feature graph** — it connects to the other features a user would
   expect it to connect to. See the litmus test below; this is the piece
   that's easiest to skip because nothing breaks if you skip it.
4. **Navigation & access** — a real user can actually reach it through the
   app's normal navigation, and it respects whatever auth/permission model
   the rest of the app uses.
5. **Conventions** — file structure, naming, error handling, loading states
   match the surrounding codebase, so the next person (human or agent)
   working in this feature isn't confused about which rules apply.

If any of these five is missing, the feature is placed, not integrated —
regardless of how polished it looks running on its own.

## Workflow

Do these phases in order. The temptation is to skip straight to "make the
generated thing work here" — resist it. Almost every integration failure
traces back to skipping phase 1 or phase 3.

### Phase 0 — Classify the input

Before anything else, figure out what you're actually holding:

- **Same stack as the host app?** (same framework, language, styling
  approach) If yes, some of the generated code may be directly adaptable.
- **Different stack?** Then treat the generated code as pseudocode. You're
  porting logic and UI *intent*, not code. Don't let a second runtime,
  package manager, or dependency tree sneak into the project because it was
  easier to keep the original files.
- **Is it a full app/page, or just a piece of logic** (a prompt, an
  algorithm, a transformation)? The more "just logic" it is, the more of
  this workflow is about building the surrounding integration from scratch
  rather than adapting existing UI.

### Phase 1 — Audit the host application first

Do this before opening the generated code in earnest. You can't tell what
needs to change about the new feature until you know what it's joining.

- Read the app's design system / style guide / design doc — tokens,
  components, layout conventions, whatever markdown or config defines "what
  this app looks like."
- Read the actual database schema and the app's data-access conventions
  (ORM models, query patterns, migration style).
- Build a working picture of the **feature graph**: what existing features
  exist, and for each, what it reads, what it writes, and what other
  features already consume from it. You don't need a diagram, but you need
  to be able to answer "if a new feature produced X, who already consumes
  things like X?"
- Note the auth/permission model and where it's enforced.
- Note navigation conventions — how does a page get registered so users can
  actually find it?
- Find the existing feature most similar to the new one and read it
  end-to-end. It's the best available template for this app's conventions,
  better than any generic best practice.
- If the project has its own skills, component libraries, or style guides
  registered (a frontend-design skill, a design-tokens file, a component
  storybook), plan to use them explicitly rather than reinventing patterns
  the app already has answers for.

### Phase 2 — Read the generated code as a spec, not a deliverable

Go through the generated feature and extract, separately:

- **The logic worth keeping**: algorithms, prompts, data transformations,
  the actual novel work. This is usually the valuable part.
- **The inputs and outputs**: what data does it need to run, what does it
  produce? This is what phase 3's data model and cross-feature hooks get
  built around.
- **The UI intent**: what does it let a user do, not what does it look
  like. The visual layer gets rebuilt in phase 4; don't get attached to it.
- **Anything invented to make the demo work**: fake auth, placeholder data,
  an assumed backend, hardcoded sample content. Flag every one of these
  explicitly — they're exactly the things that must not survive into the
  real integration unchanged.

### Phase 3 — Write the integration plan before writing integration code

Produce an actual plan, in writing, before touching the codebase. This is
the step that gets skipped under time pressure and is the single biggest
predictor of a feature that's placed instead of integrated. Use
`references/integration-plan-template.md` as the shape; fill it out for
real rather than treating it as a formality. It should cover, at minimum:
the data model (new tables vs. reuse), the cross-feature hooks this feature
needs (see the litmus test below), how the UI maps onto the existing design
system, which existing skills/utilities/services apply, and the build
order.

Share this plan before implementing if there's any real ambiguity in it —
see "When something is genuinely ambiguous" below. A five-minute plan review
is much cheaper than reworking a wired-up feature.

### Phase 4 — Build in integration order

Build in this order, not the order that gets a visible result fastest:

1. Data layer — schema/migrations, matching host conventions
2. Business logic / services — the adapted logic from phase 2
3. UI — rebuilt against the host design system, not the generated styling
4. Cross-feature hooks — wire the connections identified in phase 3
5. Navigation & permissions — register it so it's actually reachable and
   properly gated

Building UI before data, or wiring cross-feature hooks as an afterthought
"if there's time," is exactly how features end up placed instead of
integrated — the visible part looks done and the invisible part quietly
never happens.

### Phase 5 — Verify before calling it done

Run through `references/verification-checklist.md`. This is a real gate,
not a formality — its whole purpose is to catch the specific failure mode
this skill exists to prevent: something that renders correctly on its own
but was never actually wired into the app.

## The cross-feature litmus test

This is the general rule underneath the lecture-notes example that prompted
this skill, and it applies to any feature in any app:

> After a user finishes using this feature, where would they reasonably
> expect its output to show up elsewhere in the app? If the honest answer
> isn't "nowhere," every one of those places is a required integration
> point — not a nice-to-have, not future work.

Walk every existing feature and ask, concretely, does this new feature
produce something that feature would want, or need something that feature
already has? A feature that extracts action items from a lecture isn't done
when it displays a list on its own page — it's done when those items can
land in the to-do list, the relevant material can land in notes, and dates
mentioned can land on the schedule, because that's what a user actually
expects "add this to my learning" to mean. The specifics change per app; the
question — "who else in this app would care about this feature's output or
have something this feature needs" — doesn't.

## When something is genuinely ambiguous

Don't silently guess on integration points that could go multiple
reasonable ways (should this auto-populate the schedule, or just suggest
it?). Pick the more conservative behavior, and say plainly in the
integration plan that this was a judgment call and why — that's cheap to
flag and expensive to get wrong silently.

If the generated UI introduces a pattern the design system genuinely
doesn't have an answer for yet (not "didn't match," but "there's no
existing component for this at all"), don't invent a one-off inconsistent
component to paper over it. Propose it as an addition to the design system
explicitly, so the next feature that needs it inherits the same answer
instead of a third inconsistent one.

## Edge cases worth naming explicitly

- **Different language/framework than the host app**: full rewrite of the
  implementation, not a port of the files. It's fine — expected, even — to
  end up with almost none of the original code once you're done; the value
  was the logic and UI intent, not the files themselves.
- **Generated code that brought its own backend/auth/database**: none of
  that comes along. It was invented to make the demo self-contained: strip
  it entirely and rebuild against the host app's real backend.
- **Logic that other future features would plausibly also need** (a
  file-to-prompt compression utility, a shared parsing routine): build it
  as a standalone shared service/utility rather than burying it inside this
  one feature, so it's actually reusable later instead of getting
  duplicated.
- **A feature that clearly supersedes or overlaps existing functionality**:
  don't let both live on unconnected — either the new one replaces the old
  path (with the old one properly deprecated, not just orphaned) or they're
  explicitly reconciled. Two disconnected ways to do the same thing is its
  own integration failure.

## Reference files

- `references/integration-plan-template.md` — the template to fill out in
  phase 3.
- `references/verification-checklist.md` — the gate to run in phase 5.
- `references/worked-example.md` — a full walkthrough of the lecture /
  speech-to-text example (learning page, to-do list, notes, schedule),
  showing what a filled-out plan and the litmus test look like in practice.
  It's one example, not the template for every feature — read it for the
  pattern, not for the specifics.
