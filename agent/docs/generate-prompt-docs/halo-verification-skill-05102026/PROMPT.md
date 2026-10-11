# PROMPT — Design a new RHEO skill

## Raw Request

> have you upgraded the shit out of the ui andd like the aesthetics of the thing woth the pain skill?

> paint skill i meant @agent/skills/paint/SKILL.md

> TIFX THE ERROR FIRST and the BLACK BACKGROUND IS STILL THERE COVERING EVERTHING there hsould also be a setting ot adjsut the size of the halo island adn the setting to toggle it on and off

> @agent/skills/generate-prompt/ for another ai to design a skill with the skillset (u need to use the eksills adn the mcp before enerating hte propmt

---

## Context

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the source of truth.** It contains the real skill
frontmatter format used by all 45 skills in `agent/skills/`, a queried MCP registry inventory with a
measured finding about how those registries behave, the design constitution your skill must not
contradict, the agent rules it must not contradict, the verification tooling that already exists,
and ten measured defects that justify the skill's existence.

You have **no access to this codebase**. Everything you need is in that bundle.

---

## The Mandate

Act as **Lead Skill Architect** for this repository. Design and specify **ONE** new skill, ready to
drop into `agent/skills/<name>/SKILL.md`, that prevents the failure class documented in bundle §5.

**Recommended subject:** a skill that closes the gap between *a check passing* and *the thing
actually working* — covering mount/ownership verification, fixture honesty, runtime proof before
claiming, precedent matching, and artifact-freshness. If you disagree with that subject, propose
your own and justify it against the same evidence.

Do not offer options. Decide, justify, specify.

### Requirement Checklist

1. **Frontmatter** — exact `id`, `name`, `version`, `category`, `description`, `metadata`, and
   `requires`. The `description` must be written to be *matched against a task*, and you must justify
   it against at least three concrete task phrasings.
2. **A numbered procedure** whose steps are each independently checkable. Name the exact command for
   every check. This repository has **no test runner**, so every step must use something that
   actually exists here.
3. **The ownership/mount gate.** Specify how an agent proves a newly created component is actually
   mounted and reachable, given that a compile-clean, type-clean, probe-green component with zero
   importers is the exact shape of dead code this repo keeps producing.
4. **The fixture-honesty rule.** Specify how an agent must label placeholder data so it can never be
   mistaken for a measurement, and how it must report "this is a fixture" in its output.
5. **The claim-gate.** Specify what evidence is required before writing `VERDICT: PASS` for a UI
   feature, and what a truthful `NOT TESTED` must name instead.
6. **The artifact-freshness check.** Specify how to confirm the RUNNING artifact contains a change
   before reporting it fixed. Two of the ten defects were a correct fix reported against a stale
   bundle.
7. **Precedent matching.** Specify how to choose a precedent: the closest existing implementation by
   *shape*, not merely by domain. One defect came from borrowing a rule from a fullscreen overlay
   and applying it to a small panel.
8. **Reference files.** List what genuinely belongs in `references/*.md` and what must stay in
   `SKILL.md`. Do not pad.
9. **Collision analysis.** Name every existing skill this overlaps (`paint`, `impeccable`,
   `fix-problems-recursive`, `multi-agent-coordination`, `generate-prompt`, `commit`, …) and either
   argue for extending one instead, or justify a separate skill.
10. **The same-cycle integration diff.** State exactly what must be edited *outside* the new
    directory for the skill to ever load — the `skill-router` entry, and if it is a design skill, the
    `paint` `requires:` list and pipeline table, per `paint` §LAYER 3 self-maintenance.

### Constraints

- Must not contradict `AGENTS.md` §0-0/§0-0a (**an agent never runs a build**; `dist/` is the running
  application), §0.5 (zero destruction), §0.6 (process teardown, no `pkill -f` on your own pattern),
  §0a (multi-agent claim before editing), or §0a/§5e (scope every check to your own files).
- Any UI guidance must cite `design/design.md` and the precedence order in bundle §3, because the
  sub-skills contradict each other and the constitution is what wins.
- `description` must enumerate concrete trigger surfaces, matching the convention of the existing 45
  skills. Vague virtue-listing is a failure.
- The skill must be self-maintaining: a stale skill is worse than none, because every agent trusts it.

---

## Output Format

A single markdown document containing:

1. The complete `SKILL.md`, ready to write to disk, in a fenced block.
2. The exact contents (or a precise outline plus the load-bearing excerpts) of each
   `references/*.md` you are specifying.
3. The **same-cycle integration diff** as a literal patch description — which files, which lines.
4. A short section: *three task phrasings this skill must match, and why the description catches
   each of them.*
5. A short section: *the three defects in bundle §5 that this skill would have caught first, and the
   exact step that catches each.*

Do not write the skill to disk. Specify it precisely enough that it could be implemented without
further interpretation.
