# ROUND 10 — the sampler ran, it discriminated, and it found two real defects

> **Paste to GLM.** 44/48. Your pairing amendment was the whole round: the sampler
> found things the reflexive pairing could never have. **I did not fix them** — out
> of budget, and I am naming them instead of relaxing thresholds.

---

## 1. Your pairing analysis was right, and it is the reason this round produced anything

I had been reading "OS reduce" as *the* reduced condition. Your table shows it is
the one cell where a wrong hook is **coincidentally correct** — which is exactly why
`DecryptedText` shipped with the raw hook and passed every run in this session's
history. The reflexive pairing (off + reduce) is worse: right and wrong hooks agree
there too.

The `(off, no-preference)` cell has never run anywhere on the page. It ran this round.

**And the store toggle — the mechanism that sets the condition — is the first direct
test the store has ever had:**

```
PASS  the store is set by the PALETTE ROW (the mechanism itself, first direct test)
      — palette row "Motion — full" -> data-motion null -> off, hero anim=none
```

---

## 2. Per-section results, both conditions

```
contract(auto,reduce)                            store: n/a
    hero         max|ty|=0     hidden=0/2856
    act-record   max|ty|=15    hidden=0/6240   worst=DIV.
    gallery      max|ty|=0     hidden=0/15871
    understand   max|ty|=0     hidden=0/3180
    download     max|ty|=310   hidden=36/3552  worst=DIV.

discriminator(off,no-preference)
    store: palette row -> data-motion null -> off, hero anim=none
    hero         max|ty|=0     hidden=21/1700
    act-record   max|ty|=15    hidden=0/6048   worst=DIV.
    gallery      max|ty|=0     hidden=0/16409
    understand   max|ty|=0     hidden=0/3233
    download     max|ty|=310   hidden=61/3996  worst=DIV.
```

**Your pre-registered suspects: Gallery clean, Download confirmed.** I am recording
the Gallery result so it is not re-tested blind.

**One you did not predict: `act-record`, `max|ty|=15`, in BOTH conditions.** Because
it is identical under `(auto, reduce)` and `(off, no-preference)`, it is
**unconditional** — not the hook class. It moves even when the store is off *and* the
OS says reduce. Whatever drives it, the store does not.

---

## 3. THE DEFECT THAT MATTERS — `#download` is half-invisible under reduced motion

27 elements sit at `opacity < 0.05` under reduce, and they carry **real content**:

```
P.mt-5        "RHEO isn't on sale yet. Jo…"
DIV.mx-auto mt-10  "macOSApple Silicon + Intel"
DIV.mt-12     "Version history"
```

A reduced-motion visitor does not see the availability line, the platform list, or
the version-history link. `max|ty|=310` alongside it. That is not a polish item; it
is the section's content failing to render for a whole class of user, and **nothing
on the previous board could see it** because the board was hero-scoped.

---

## 4. I did not fix them, and did not relax the threshold

Both are OWED with their red-revert written down:

| # | Owed | Converts when |
|---|---|---|
| 1 | `#act-record` 15px, unconditional | gate the `initial` on `useShouldAnimate` or move to CSS with both suppression paths; **red-revert:** re-ungate → `max\|ty\| >= 0.5` |
| 2 | `#download` 27 stuck elements + 310px | same pattern across every `initial` in `Download.tsx`; **red-revert:** re-ungate one → `hidden >= 1` |

I had budget for the sampler or the fixes, not both. A threshold relaxed to `310`
would have bought a green board with an invisible download section under it, which is
the exact trade you refused in Round 7.

---

## 5. REQUEST 2 — both gates closed, and one of them not the way you meant

**`.gitignore` — closed by asking git, not by grepping the lines.**

```
.gitignore:151  !landing/public/media/
.gitignore:152  !landing/public/media/**

$ git ls-files landing/public/media/ | wc -l -> 24
$ git check-ignore -v landing/public/media/app-dashboard.png -> (no output: NOT IGNORED)
$ git check-ignore -v landing/public/media/                     -> (no output: not excluded)
```

25 on disk vs 24 tracked — the gap is `_rejected`, a **directory**. All 24 captures
are tracked. Grepping the negation lines would have proved nothing: git does not
descend into an excluded parent, so the lines can exist and still not work.

**`netlify.toml` — closed.** There is **no `publish` key at all**, so Netlify
defaults to base-relative `.next`:

```toml
[build]
  base    = "landing"
  command = "npm run build"
```

The file's own comment warns against writing `publish = "landing/.next"` because it
resolves to `/landing/landing/.next` and silently publishes nothing. Absent the key
the value is correct. Unchanged from baseline.

---

## 6. REQUEST 3 — RESULT.md v1.1, with your four edits

`agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md`

- **OWED / ASSIGNED split.** Your contradiction catch is right and I had not seen it:
  *"not released until OWED is empty"* plus a row no measurement can close is a
  permanently unreleasable document, built by following two correct instincts
  separately. A1 (the human read) and A2 (binaries + SHA-256) moved to **ASSIGNED**,
  each already carrying its exact converting action. They still **block release** —
  they just no longer block the document.
- **Evidence lines cite files and lines** — `Hero.tsx`, `SessionClock.tsx`,
  `Ledger.tsx`, `Gallery.tsx`, `ActUnderstand.tsx:66` — so a reader with grep and no
  memory of this session can re-check every DONE row.
- **The build row is split out.** It was a compliance note, not a gate; no amount of
  checking changes a deploy decision. Its consequence (dev-server ≠ deployed
  artefact) already lived under "What a reviewer should distrust", correctly.
- **Ledger entry 6 + the rule.** `MotionChip` matching nothing, and `null` vs
  `"ABSENT"`, are the canary's lesson turned inward. The rule is recorded as
  universal: *every property-assert prints its subject count, and `count === 0` is a
  FAIL.*
- **Lockfile caveat line**: *"content-verified; tool verification occurs at first
  deploy."*

---

## 7. Board

```
=== no-preference ===  22/24
=== reduce ===          22/24
44/48 asserts passed, 4 failed
```

All four failures are the two sampler offenders in the two conditions. **The board
is down from 42/42 to 44/48, and it got down because the probe got better.** Every
new assert is negative-tested; nothing was relaxed to hold a number.

---

## REQUEST

```
REQUEST 1: Approve OWED 1 and 2 as the only motion items in flight. Both are the
standing pattern — gate the initial, or move it to CSS with both suppression paths
— and each gets its own red-revert. I have not started either.

REQUEST 2: `#download` is the one I would not defer. 27 invisible elements is a
whole section failing for reduced-motion users, and it was invisible to a 42/42
board. Confirm it takes precedence over #act-record's 15px.

REQUEST 3: cmdk stays locked. Your unlock condition is now "both conditions run,
offenders fixed with red-reverts, board green". Conditions ran; offenders are NOT
fixed. So I am still not pulling — and this time the reason is a real defect rather
than sequencing hygiene.

REQUEST 4: Circulate v1.1 now, or after OWED 1–2 land? The gates have no blanks, the
sampler ran, the edits are in. My lean is circulate now with OWED 1–2 open, because
a report that documents two known defects is more useful than one that waits for
them to be fixed.
```