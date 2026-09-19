# Integration Plan Template

Fill this out for real before writing integration code. Short answers are
fine where the answer is genuinely simple — the point is that every section
gets an actual answer, not that every section needs paragraphs. A section
answered "N/A" should say why it's N/A, not just be skipped.

---

## 1. What this feature is

One or two sentences: what does a user do with this, and what do they get
out of it. If the source was generated elsewhere, note that here and what
it was (a different AI, a prototype tool, etc.) and whether it shares the
host app's stack.

## 2. Data model

- What entities/data does this feature need to persist?
- Which of those already exist in the app's schema and can be reused
  as-is or extended?
- Which are genuinely new, and what does the migration look like?
- What in the generated version was mocked/hardcoded/local-only that needs
  to be replaced with real persistence?

## 3. Cross-feature hooks

Run the litmus test from SKILL.md against every existing feature in the
app, not just the ones that seem obviously related. For each existing
feature, answer: does this new feature produce something that feature would
plausibly want, or need something that feature already has?

List the ones that come back yes, and for each:

- **Direction**: does the new feature push data into the existing one, pull
  from it, or both?
- **What, specifically**: the exact data/event, not "relevant info."
- **How**: shared service call, event/hook, direct write with the existing
  feature's own access patterns — whatever the app's convention is for
  cross-feature communication.
- **Judgment calls**: anything here that's a genuine "could go either way"
  decision (e.g., auto-add vs. suggest-and-confirm) — name it and say which
  way you're going and why.

If this list comes back empty, that's a flag to double-check, not a
conclusion to accept quickly — most features connect to at least one
existing part of the app.

## 4. Design system mapping

- List the UI elements the generated version has.
- For each, what's the host app's equivalent existing component/token? If
  there isn't one, is this a case for proposing a design-system addition
  (see SKILL.md) rather than a one-off?
- Anything in the generated UI (colors, fonts, spacing, component
  patterns) that will NOT be carried over as-is.

## 5. Navigation & access

- Where does this feature live in the app's navigation?
- What permission/auth level does it require, matching the app's existing
  model?

## 6. Skills, utilities, and services to use

- Existing skills, style guides, component libraries, or shared
  utilities/services this build should use rather than reinvent.
- Any new shared utility this feature's logic should be extracted into
  (see "logic other features would plausibly need" in SKILL.md), if
  applicable.

## 7. Build order

Default order (adjust only with a reason):

1. Data layer (schema/migrations)
2. Business logic / services
3. UI (against host design system)
4. Cross-feature hooks
5. Navigation & permissions

## 8. Open questions

Anything genuinely ambiguous that's worth a second pair of eyes before
implementation starts. It's fine for this to be empty — but check that it's
actually empty, not just unexamined.
