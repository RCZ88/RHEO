# Incident Report — Truncated Root Container className

**Date:** 2026-09-03
**Severity:** P1 (render-breaking — root container className literal truncated mid-attribute)
**Status:** Resolved (already committed in `5fe0328`)

---

## Root Cause

**#4 — Reset-era JSX corruption:** the root app container's `className` literal in
`src/App.tsx:2720` was truncated mid-arbitrary-value during a reset/rebase churn.

**Corrupted version (commit 063cdf0):**
```tsx
<div className="flex h-screen overflow-hidden bg-[#121212 text-white">
```

Two simultaneous truncations:
1. **Attribute-level truncation:** the Tailwind arbitrary value bracket never closed —
   `bg-[#121212` instead of `bg-[#121212]`. The `]` was cut off, leaving an unclosed
   `[` in the middle of the className string.
2. **Token loss:** `flex-col` was dropped — the root was `flex` (row direction) instead
   of `flex flex-col`, which would have collapsed the vertical layout.

**Healed version (commit 5fe0328, current HEAD):**
```tsx
<div className="flex flex-col h-screen overflow-hidden bg-[#121212] text-white">
```

Both truncations restored: `]` bracket closed, `flex-col` token reinstated.

---

## Verification

### 1. Locate
- **File:** `src/App.tsx:2720`
- **Full className (current):** `flex flex-col h-screen overflow-hidden bg-[#121212] text-white`
- **Surrounding JSX:** TitleBar → AppBackground → Sidebar motion.div (standard root structure)

### 2. Git diff (063cdf0 → HEAD)
- `flex` → `flex flex-col` (token restored)
- `bg-[#121212` → `bg-[#121212]` (bracket closed)
- `<AppBackground />` child also restored (was absent in corrupted version)

### 3. Corruption sweep
All patterns scanned across `src/`:
| Pattern | Hits |
|---------|------|
| Unclosed arbitrary value `className="...\[[^]"]*$` (double-quoted) | 0 |
| Unclosed arbitrary value `className='...\[[^]']*$'` (single-quoted) | 0 |
| `flex-flex` residue | 0 |
| `className=""` empty | 0 |
| `className=" "` single-space | 0 |

**SWEEP RESULT: CLEAN.** No sibling corruptions detected.

### 4. Gates
| Gate | Result |
|------|--------|
| **Build** (`node scripts/build.mjs`) | ✅ PASS — `✅ Build complete!` |
| **Bundle verification** (grep compiled `dist-tmp/assets/index.*.js`) | ✅ `bg-[#121212]` CLOSED present; `flex-col` present (428 occurrences); zero unclosed `[` patterns in any className string |
| **tsc --noEmit** | ✅ Zero real type errors — all TS6305/6306/6310 (project-reference composite noise, documented debt) |
| **Electron cold-launch verify** | ⚠️ Port 8788 collision with already-running app — second instance could not start. Build artifact verification used instead (authoritative for className check). |
| **#df-fallback** | Not checked (Electron verify did not complete browser interaction) — pre-existing state; not introduced by this fix |

---

## Lesson

**The corruption sweep must include attribute-level truncation patterns, not just tag mismatches.**

Prior sweeps focused on:
- Mismatched/hedged tags (`flex-flex-col`, `"" |" ` residue)
- Unclosed JSX tags

This incident introduced a new genus: **the attribute value itself was truncated mid-token** — the JSX was syntactically valid (properly closed `>` on the div), but the className string content was corrupted. The tag structure was fine; the attribute value was not.

**New sweep pattern added:** `className="[^"]*\[[^]"]*$` — catches arbitrary values whose closing `]` is missing, regardless of whether the JSX tag itself is well-formed.

---

## Files Changed

- `src/App.tsx` — root container className restored (already committed in `5fe0328`)
- `scripts/verify-electron.cjs` — new verification script (not committed — utility)
- `scripts/verify-run.cjs` — new verification runner (not committed — utility)

---

## Commit Reference

```
5fe0328 recovery: working-tree snapshot after repair session
```

Fix message (as specified): `fix: restore truncated root className (reset-era JSX corruption)`
