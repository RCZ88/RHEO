# AI Agent Data Storage Research

**Date:** 2026-04-18
**Status:** COMPLETE

---

## Overview

This directory contains research on how AI coding assistants store their data, including:

- Chat session history
- Token usage tracking
- Project/workspace data
- Configuration files

## Research Complete

The detailed findings have been compiled in `result.md`.

## Summary of Findings

| Agent | Data Directory | File Format | Key Limitation |
|-------|--------------|-------------|---------------|
| **Claude Code** | `~/.claude/projects/` | JSONL | `output_tokens` placeholder values |
| **Cursor** | `%APPDATA%\Cursor\User\globalStorage\` | SQLite | None significant |
| **OpenCode** | `%USERPROFILE%\.local\share\opencode\` | SQLite | Channel-specific DBs |
| **Gemini CLI** | `~/.gemini/tmp/` | JSONL | Cache tokens with API key only |
| **Aider** | `~/.aider/` or `%APPDATA%\Aider\` | Markdown | Requires analytics config |
| **Windsurf** | `~/.codeium/windsurf\` | SQLite | Now cloud-based |

## Files

| File | Description |
|------|-------------|
| `research-prompt.md` | Detailed research questions |
| `README.md` | This file |
| `result.md` | **Complete findings document** |

## Key Documents

See **`result.md`** for:
- Exact Windows/macOS/Linux paths for all agents
- SQLite database schemas
- Token field structures
- Parsing code examples
- Known limitations

---

*Completed: 2026-04-18*
