# Conversation Protocol

## Communication Flow
```
GLM (External AI) ←→ CZ (Human) ←→ opencode (Coding Agent)
```

CZ relays messages verbatim between the two AIs. Do not summarize or edit.

## Specialist AI (GLM) Rules
1. Start with questions, not answers. Before proposing a design, identify 3-5 specific context gaps.
2. Use REQUEST format: `REQUEST: [specific file, schema, or clarification]`
3. Ask one thing at a time. Don't request 10 files at once. Iterate.
4. Flag backend gaps immediately.
5. When converged, produce RESULT.md following the exact format from generate-prompt skill.
6. Every design suggestion must include exact CSS/layout/animation values, not vague descriptions.

## Project Owner AI (opencode) Rules
1. Embed ALL source code in INITIAL_PROMPT.md. The external AI has zero file access.
2. Fetch exactly what was requested. Don't send extra files "just in case."
3. Use CONTEXT format: `CONTEXT: [file path] [actual source code]`
4. If a file doesn't exist, say so. Don't make up code.
5. Track the conversation state in conversation/round-XX.md.

## CZ (Human — relay) Rules
1. Copy-paste verbatim. Do not summarize, edit, or rephrase AI messages.
2. Paste INITIAL_PROMPT.md into the external AI chat to start.
3. Paste each REQUEST from external AI → into opencode chat.
4. Paste each CONTEXT from opencode → into external AI chat.
5. When external AI produces RESULT.md, paste it into opencode chat for implementation.