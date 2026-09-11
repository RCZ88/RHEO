<aside>
📤

**Context Handoff skill.** A reusable procedure for compacting and transferring the working context of a session — or one topic inside it — into a single durable, exportable artifact, so a fresh chat or another agent can resume with full grasp.

Note: I can't register this into the runtime's auto-loaded skill list (that's system-controlled), so it lives here as a spec I follow whenever you ask for a context handoff. It's written in the standard SKILL.md format so you can also drop it into a skills folder.

</aside>

## SKILL.md frontmatter

```yaml
name: context-handoff
description: >-
  Use when the user wants to transfer, compact, or hand off the context of a
  session — or a specific topic/part/section within it — into a portable,
  durable handoff document so a fresh session or another agent can resume
  without re-reading the whole history. By DEFAULT capture the ENTIRE session;
  if the user names a specific topic/part/section, capture ONLY that scope.
```

## Purpose

Distill the working context of a session into one durable, exportable artifact (a Notion page by default) so that:

- A new chat, or a different agent, can resume without re-reading the entire thread.
- Long, crowded threads stop degrading context grasp.

## When to use

- The thread is long/crowded and risks losing precision.
- The user says "hand off", "transfer context", "compact context", "carry this over", or "save the state of X".
- Intentionally switching to a fresh session.

## Scope rules (most important part)

1. **Default scope = the ENTIRE session**: every topic, decision, artifact, and open thread.
2. **If the user names a topic / part / section**, capture ONLY that scope and exclude everything unrelated.
3. If scope is ambiguous, ask ONE short clarifying question; otherwise proceed with the stated scope.
4. Even when scoped, add a one-line **cross-reference** to related-but-excluded topics (name + link) so the reader knows they exist.

## Handoff schema (sections to produce)

Produce these, in order. Omit a section only if it's genuinely empty.

1. **TL;DR / Mission** — 2–4 sentences: what this work is and its current goal.
2. **Current status** — where things stand right now; what was just finished; what's in flight.
3. **Key decisions & rationale** — durable decisions and WHY, so they aren't relitigated.
4. **Constraints & gotchas** — hard rules, corrections, and mistakes to avoid (verbatim where precision matters).
5. **Artifacts & references** — links to pages, files, sandbox paths, repos, each with a one-line description. Real URLs/IDs only.
6. **State of the code / data** — concrete facts: file structure, versions, measured values, schema.
7. **Open tasks / next actions** — ordered, each with what "done" looks like.
8. **Glossary / key entities** — names, IDs, people, so references resolve.

## Method

1. **Determine scope** from the request (default = everything).
2. **Gather** within scope: review the session, referenced pages, files, and prior tool outputs. Re-load or search if a referenced artifact isn't fresh.
3. **Compact**: prefer specific facts (numbers, IDs, paths, decisions) over narration. Drop chit-chat, superseded attempts (unless the lesson matters), and duplicates.
4. **Preserve fidelity**: copy exact values, verbatim rules, and corrections — never paraphrase away precision.
5. **Write to a durable artifact**:
    - Default: a new Notion page. Title pattern: `<Topic> — Context Handoff (<date>)`.
    - Parent: child of the most relevant existing hub page, else top-level private.
    - Optionally also write a Markdown file to the sandbox and offer it as a download for a portable copy.
6. **Make it self-contained**: someone with zero prior context should be able to resume from it alone.
7. **End with "How to resume"** — tell the next agent exactly what to read first.

## Output rules

- Exhaustive on facts within scope; terse on prose.
- Use tables for structured data (measurements, file maps, task lists).
- Every reference is a working link/ID, not a vague mention.
- Date-stamp the handoff.
- Never include content outside the requested scope (except brief cross-ref pointers).

## Anti-patterns

- Don't summarize the conversation chronologically — organize by the schema above.
- Don't lose precise values (measurements, versions, IDs).
- Don't include resolved dead-ends unless they encode a lesson.
- Don't pad with generic background the reader already knows.

## How to invoke

- "Do a context handoff" → full-session handoff.
- "Hand off the <X> context" / "transfer the <X> part" → scoped handoff for X only.
- I confirm the scope, build the artifact, and give you the link (plus a downloadable file if you want one).