# PROMPT — Generate Handbook Command JSON for All Terminal Commands

**Target AI:** claude  
**Detail Level:** 10  
**Response Format:** markdown containing valid JSON  

---

## Raw Request

> with all of the ai features? generate prompt and then parsing the generated output? and then showing it properly? and being able to have it be interactive and be using those and practicing everything? and is it following the feature-integration SKILL.md skill?

## Instruction

Generate structured JSON objects for EVERY command listed in `agent/docs/terminal-handbook-data.json`. For each command, produce exactly one `HandbookCommandResponse` object matching this shape. The output must be valid JSON that `extractJsonFromResponse` in `src/agents/terminal-learn-prompt.ts` can parse and `src/components/learn/HandbookWorkspace.tsx` can render.

## Output Format (JSON)

Each command must produce this exact JSON shape:

```json
{
  "type": "handbook_command_response",
  "version": "1.0.0",
  "command": "<the exact command string from handbook-data.json>",
  "title": "<human-readable title>",
  "estimatedMinutes": <number>,
  "explanation": {
    "what": "<what this command does>",
    "when": "<when to reach for it>",
    "gotcha": "<gotcha that bites beginners, or omit if none>"
  },
  "params": [
    {
      "flag": "<flag name or omit>",
      "arg": "<arg name or omit>",
      "meaning": "<what this flag/arg does>",
      "type": "boolean|path|pattern|value|placeholder"
    }
  ],
  "safety": {
    "level": "safe|careful|destructive",
    "note": "<safety note>"
  },
  "exercises": [
    {
      "title": "<practice exercise title>",
      "command": "<the command to practice>",
      "explanation": "<what to expect when run>"
    }
  ],
  "related": [
    {
      "command": "<related command>",
      "relation": "<how it relates>"
    }
  ],
  "contextUsed": {
    "chatHistoryLength": 0,
    "sectionId": "<the section id from handbook-data.json>",
    "userLevel": "beginner"
  }
}
```

## Design Tokens (UI Must Match)

All rendered UI must use these exact tokens from `terminal-handbook.html` root CSS:

```css
--bg:#0a0e14; --bg2:#0d1219; --panel:#11161f; --panel2:#161d29;
--line:#1f2836; --line2:#2a3547; --txt:#dbe4ee; --dim:#7d8aa0; --faint:#54617a;
--grn:#7ee787; --grn-dim:rgba(126,231,135,.12);
--blu:#79c0ff; --amb:#ffa657; --amb-dim:rgba(255,166,87,.12);
--red:#ff7b72; --red-dim:rgba(255,123,114,.10);
--pur:#d2a8ff; --pur-dim:rgba(210,168,255,.12);
--mono:"Cascadia Code","JetBrains Mono","SF Mono",Consolas,monospace;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;
```

Depth badge colors: `core`=#79c0ff, `daily`=#7ee787, `power`=#d2a8ff, `rescue`=#ff7b72, `sudo`=#ffa657.

## Data Source

Read `src/services/learn/handbook-data.ts` and `agent/docs/terminal-handbook-data.json` for the full command list. The JSON has `sections[]` each containing `commands[]`. Generate one `HandbookCommandResponse` per command.

## Feature-Integration Requirements

Each `exercises[]` entry must be interactive-ready:
- `learn:runCode` executes `exercise.command` (supports shell, python, javascript via `child_process` in `/tmp/lyceum-run`, 15s timeout)
- `learn:submitQuiz` grades a quiz derived from the command
- `learn:generateCards` → `learn:getDueCards` → `learn:submitCardReview` for SRS flashcard study
- `learn:timerStart`/`timerStop` records `quizzesTaken`, `cardsReviewed`, `masteryGained`
- `learn:getProfile`/`setProfile` persists practice results to knowledge base
- `learn:addNote` appends session reflections as notes
- `learn:getGoals`/`setGoal`/`updateGoalProgress` tracks practice goals
- `learn:getStreak`/`getAchievements` reflect practice activity

## Constraints

- Output must be VALID JSON only. No markdown code blocks wrapping the JSON — the JSON itself must be parseable by `extractJsonFromResponse`.
- Every command in `terminal-handbook-data.json` must appear in the output. Do not skip any.
- `params` array must match the actual `CommandParam` interface: `{ base, subcommands, flags[], args[], pipe_to?, is_sudo? }`.
- `safety.level` must be one of `safe`, `careful`, `destructive`.
- `estimatedMinutes` must be a positive integer.
- `exercises` must have at least 1 entry per command (for interactive practice via `learn:runCode`).

## Anti-Slop Checklist

Every UI component rendered from this JSON must: re-skin to DeskFlow tokens above; dark mode only; `rounded-xl`, `p-5` padding; Geist + JetBrains Mono fonts; glass layer (`bg-zinc-900/80 backdrop-blur-xl`). No new hardcoded hexes outside the spec palette.
