# Conversation Protocol — Landing: Live & Interactive

## Parties

- **CZ (human)** — relays messages between the two AIs. CZ is NOT the QA tester.
  CZ is the only one who builds (§0-0) and the only one who pushes to origin.
- **Architect (Notion AI)** — plans, writes patches, issues FIX PACKETs.
- **Hands (opencode agent)** — verifies with scoped checks, never builds, never
  pushes without CZ's word. Writes files, runs `prompt-copy`, reports in CYCLE
  REPORT format.

## Rules

1. Every round is a numbered file: `conversation/round-NN.md`.
2. The Architect's reply lands in a file I write as `CONTEXT-round-NN-<topic>.md`.
3. Only NEW answers get sent back, not the whole bundle again.
4. Before each paste, check the file path at the top. (This is the second time
   the wrong file came through.)
5. Say "I have not read it" instead of describing a file from its name.
6. Count by running a count. Do not state a number you did not measure.
7. The context bundle is the source of truth for app facts. If the Architect
   proposes something that contradicts it, the bundle wins until CZ says otherwise.

## What this bundle is NOT

- Not a rewrite of the landing page. It is a plan for adding liveliness.
- Not a license to break LAMINAR. The monochrome contract is the brand.
- Not a request to install dependencies without approval. `@lucasmarkes/hairline`
  is MIT and zero-dep, but installing it is CZ's call.