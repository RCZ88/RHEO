---
id: human-centric-ux
name: Human-Centric UX
version: 1.0.0
category: design
tags: [ux, ui, usability, ai-slop, clarity, states, accessibility, scope]
---

# Human-Centric UX Skill

## Philosophy

A UI is not "done" when it works for a machine — it is done when a human can look at it and immediately know **where they are, what is happening, and what to do next** without being taught. AI co-coding agents default to *system-centric* design: they emit interfaces that are internally consistent and machine-parseable but cognitively hostile to humans. This is "AI slop." The job of this skill is to force every generated interface through a human-comprehension filter so the output is clear, straightforward, low-friction, and pleasant — optimizing for **user experience first**, aesthetics second.

Function and clarity are the foundation. Beauty is the finish, not the substitute.

---

## Scope Rule (READ FIRST)

This skill is **scope-aware**. Before generating or reviewing, determine the target:

1. **If the user names a specific part** (a page, a route, a component, a panel, a modal, a feature, e.g. "the settings page" or "the export button"):
   - Apply this skill **only to that part**.
   - Do NOT refactor or touch unrelated areas. Treat surrounding code as fixed context to match, not to change.
   - Match the existing conventions of the file/page you are editing (spacing, tokens, component library) unless they directly violate a hard rule below.

2. **If the user does NOT specify a part** (they forgot, or asked generally):
   - Apply this skill to the **entire project / whole surface** being generated or reviewed.
   - Sweep every page, route, and shared component for the violations listed in the Checklist.

3. **Always state your scope out loud** at the start: e.g. "Applying Human-Centric UX to: the Database page only" or "No part specified — applying project-wide."

---

## The 6 Pillars of Good UX

### 1. Clarity Over Cleverness
The user should never have to decode the interface.
- Every label, button, tooltip, placeholder, and error is written in plain human language — never raw system tokens (`user_pref_theme`), enum values (`STATE_2`), or stack traces.
- Primary action of any screen is obvious within 1 second.
- Icons are never used alone for non-universal actions — pair with a label or tooltip.

### 2. Progressive Disclosure
Show what matters now; hide complexity until it is needed.
- Do not render every option, field, or toggle at once. Use tabs, sections, accordions, "Advanced" toggles, or step flows.
- Default to the common case; make the rare case reachable, not omnipresent.
- A screen should answer one primary question. If it answers five, split it.

### 3. Visual Hierarchy
Humans scan, they do not read. Guide the eye.
- Establish hierarchy with weight, color temperature, and spacing — not size alone.
- Most important element = highest contrast. Metadata = muted. One clear focal point per view.
- Group related items; separate unrelated items with deliberate whitespace.

### 4. Complete State Coverage (the #1 anti-slop rule)
AI almost always designs only the "happy path." Humans experience time and failure. EVERY data-driven component must define:
- **Empty** — icon + friendly one-line explanation + a clear call-to-action. Never a blank box.
- **Loading** — skeleton placeholders matching content shape (not just a spinner).
- **Error** — plain-language cause + a recovery action (Retry / Fix / Contact). Never raw JSON.
- **Populated** — the normal state.
- **Partial / Overflow** — long text truncation, large lists paginated/virtualized, very large numbers formatted.

### 5. Feedback & Quality-of-Life Micro-interactions
The system must always acknowledge the human.
- Every interactive element has hover, focus, active, and disabled states.
- State changes get a 150–300ms transition (opacity/transform) so they feel intentional, not jarring.
- Destructive or irreversible actions require confirmation and/or offer undo.
- Provide immediate feedback on submit (button → loading → success/error). Never leave the user wondering if it worked.
- Preserve user effort: don't wipe form input on error; remember scroll position and unsaved-change warnings.

### 6. Forgiveness & Affordance
Make the right action easy and mistakes cheap.
- It is always visually obvious what is clickable vs static.
- Touch/click targets are comfortably sized (≥ 44px), even on desktop.
- Inputs validate inline with helpful messages, not after a wall-bounce submit.
- Keyboard navigation and visible focus rings work; nothing is mouse-only.

---

## Anti-Patterns (NEVER ship these)

- **NEVER** expose raw system identifiers, enum codes, or stack traces to the user.
- **NEVER** render a data view without Empty / Loading / Error states.
- **NEVER** present a flat wall of equally-weighted elements with no focal point.
- **NEVER** dump every setting/field/action onto one screen — use progressive disclosure.
- **NEVER** trigger a silent action with no feedback (no spinner, no toast, no state change).
- **NEVER** destroy user input or work without confirmation or undo.
- **NEVER** rely on color alone to convey meaning (accessibility) — pair with text/icon/shape.
- **NEVER** use icon-only buttons for non-obvious actions without a label or tooltip.
- **NEVER** prioritize a "cool" visual effect at the cost of comprehension or performance.

---

## Generation Workflow

When generating UI with this skill active:

1. **Declare scope** (specific part vs whole project) per the Scope Rule.
2. **Identify the user's primary goal** for the surface. State it in one sentence.
3. **Design the happy path**, then immediately design Empty / Loading / Error for every data element.
4. **Establish hierarchy**: pick the single primary action and make it dominant; demote the rest.
5. **Apply progressive disclosure**: hide secondary/advanced controls.
6. **Wire feedback**: hover/focus/active/disabled + transitions + submit feedback + confirmations.
7. **Humanize copy**: rewrite every label, error, and empty message in plain language.
8. **Self-review against the Checklist below before returning code.**

---

## Pre-Return Review Checklist

Run this on the in-scope target before finishing. Each item is pass/fail.

- [ ] Scope stated (specific part or whole project).
- [ ] Primary action on each screen is obvious in < 1s.
- [ ] No raw system tokens, enums, or stack traces visible to the user.
- [ ] Empty, Loading, and Error states exist for every data-driven element.
- [ ] Clear visual hierarchy — one focal point, muted metadata.
- [ ] Secondary/advanced complexity is hidden behind disclosure.
- [ ] All interactive elements have hover / focus / active / disabled states.
- [ ] State changes animate (150–300ms), nothing snaps jarringly.
- [ ] Submit/save gives immediate feedback; destructive actions confirm or offer undo.
- [ ] Copy is plain-language and instructive (labels, placeholders, errors, empties).
- [ ] Meaning is never conveyed by color alone; focus rings + keyboard nav work.
- [ ] Targets ≥ 44px; nothing is mouse-only.
- [ ] No "cool" effect harms clarity or performance.

If any box fails, fix it before returning.

---

## Output Expectation

Along with the code, briefly log the key UX decisions made, e.g.:
> "Scope: Export modal only. Primary action: Confirm export. Added Loading (skeleton) + Error (retry) states. Demoted format options behind an Advanced toggle. Added unsaved-change guard."

Keep the log short — it exists so the user can verify the human-centric reasoning, not to pad the response.

---

## Activation Criteria

**Activate when:**
- Generating, building, or reviewing any UI / page / component / website.
- The user complains output is "AI slop," confusing, generic, tedious, or unclear.
- The user asks to improve usability, clarity, UX, or "quality of life."
- A co-coding agent produced an interface that is machine-clear but human-confusing.

**Combine with:** Frontend Design (visual tokens/components) and Taste Skill (variance/motion/density knobs). This skill governs **comprehension and experience**; those govern **look and personality**. When they conflict, human comprehension wins.

**Do NOT over-apply when:**
- The user gave exact specs/mockups that already resolve these concerns — follow them.
- Working on a throwaway internal debug tool where the user explicitly says function-only.