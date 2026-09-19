# Verification Checklist

Run this after implementation, against the actual code — not against memory
of what the plan said should happen. The point of this pass is to catch the
gap between "the plan covered it" and "the code actually does it."

## Data & backend

- [ ] Search the new feature's code for mock/dummy/fake/placeholder/sample
      data and confirm none of it survived into the real build.
- [ ] Every read and write goes through the app's real database layer, using
      its existing conventions (ORM, query patterns, migration style) — not
      a local array, `localStorage`, or an in-memory store standing in for
      persistence.
- [ ] Migrations are actually committed/applied, not just implied by a
      model definition.
- [ ] If the generated source assumed its own backend or auth, confirm none
      of that leaked in — no stray endpoints, no bypassed auth check left
      over from the demo version.

## Design system

- [ ] The feature's UI uses the app's actual components/tokens, not the
      generated version's original styling carried over.
- [ ] Spacing, type scale, and color are consistent with a neighboring
      existing feature when placed side by side — not just "close."
- [ ] Any UI pattern that genuinely didn't exist in the design system was
      either proposed as a real addition or reworked to use what exists —
      not shipped as a one-off inconsistency.

## Cross-feature integration

- [ ] Every hook identified in the integration plan's section 3 is actually
      implemented, not left as a comment or a "future work" note.
- [ ] Spot-check from the user's side: after using this feature, do the
      other features it's supposed to feed actually show the new data?
- [ ] Nothing was silently skipped because "it would take extra time" —
      if a hook got cut, that's a plan change to flag, not a quiet omission.

## Navigation & access

- [ ] A user can reach this feature through the app's normal navigation,
      not only by knowing the raw route.
- [ ] Permission/auth checks match how the rest of the app gates similar
      features.

## Code hygiene

- [ ] File structure, naming, and error/loading-state handling match the
      conventions of the similar existing feature identified in Phase 1.
- [ ] If the source was a different language/framework, confirm no foreign
      dependencies, config, or dead files from that stack remain in the
      project.
- [ ] If this feature supersedes or overlaps something that already
      existed, the old path is either deprecated or explicitly reconciled —
      not left running in parallel, disconnected.

If anything here is unchecked, the feature is placed, not integrated, no
matter how correct it looks running on its own.
