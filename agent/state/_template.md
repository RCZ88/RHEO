<!-- AGENT STATE TEMPLATE — Copy this to create your spoke file -->
<!-- Replace ALL {braces} with actual values before writing -->
<!-- SESSION: {SESSION_ID} -->
<!-- AGENT: {AGENT_TYPE} | TERMINAL: {TERMINAL_ID} | PROJECT: {PROJECT_PATH} -->

# Agent State — {SESSION_ID}

> **STATUS:** {working|idle|error|completed} | **UPDATED:** {ISO_TIMESTAMP}

---

## CURRENT CYCLE ({CYCLE_NUMBER})
**ROLE:** {what you are doing this cycle}
**STATUS:** {working|idle|error|completed}
**IN FLIGHT:**
- {active task 1}
- {active task 2}
**COMPLETED:**
- {task completed this cycle}
**NEXT ACTION:** {what happens next}
**NOTES:** {optional freeform context}

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle {N-1} — {TIMESTAMP}
**ROLE:** {role}
**STATUS:** {status}
**IN FLIGHT:**
- {task}
**COMPLETED:**
- {task}
**NEXT ACTION:** {next}

### Cycle {N-2} — {TIMESTAMP}
**ROLE:** {role}
**STATUS:** {status}
**IN FLIGHT:**
- {task}
**COMPLETED:**
- {task}
**NEXT ACTION:** {next}
