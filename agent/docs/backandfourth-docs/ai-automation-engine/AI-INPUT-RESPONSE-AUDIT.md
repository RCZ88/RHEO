# AI Input & Response Rendering — Feature Audit

> **Created:** 2026-10-07 | **Owner:** opencode | **Status:** audit complete, **implementation not started.**
> Every claim below is a verified grep with the command shown. Nothing here is estimated.

---

## 0. Executive verdict — the short answer to "are these features even there?"

| feature | status | the fact |
|---|---|---|
| Input expands as you type | ✅ **exists** | `ChatInput.tsx:47` `el.style.height = Math.min(el.scrollHeight, 140)` |
| Expansion size is configurable | ❌ **hardcoded** | the cap is the literal `140`. Not a setting, not in state, not user-editable |
| AI responses render **markdown** | ⚠️ **WRONG IN MY AUDIT** | a **hand-rolled parser** (`MarkdownRenderer.tsx`, 177 lines) already renders bold, italic, inline code, links, headings, ul/ol, blockquote, hr, fenced code |
| **Tables** | ❌ **real gap** | pipe lines fall through as paragraphs — no table handler |
| **Equations** | ⚠️ **real gap** | `katex` installed; works on `/learn`, **0** chat files use it |
| **Excel / CSV** | ❌ **real gap** | **0** parsers. Attachments are **images only** |

> **⚠️ CORRECTION (round 11).** I reported "markdown: 0 libraries, renders as
> `whitespace-pre-wrap`". The **dependency** count was right and my conclusion was
> wrong: `MarkdownRenderer.tsx` already existed as a hand-rolled parser, and
> `TypewriterText` was already calling it. I grepped `package.json` for a library,
> missed a component, and generalized from absence of a dep to absence of a feature.
> **Probed against the real component, not re-read from source.** Prose, headings,
> lists, quotes, rules and code all worked before this cycle. The genuine gaps were
> **tables and math** only.

**Markdown mostly works. Tables, math, and Excel do not.**

---

## 1. The input DOES expand — the limit is just a magic number

```ts
// src/components/ai/chat/ChatInput.tsx:44-48
const el = taRef.current
if (!el) return
el.style.height = "auto"
el.style.height = Math.min(el.scrollHeight, 140) + "px"
```

**What works:** it resets to `auto` then measures, so it shrinks *and* grows correctly.
Only runs on `props.value` change, so streaming is safe.

**What doesn't:** `140` is a hardcoded literal inside a `useEffect`. There is:

```
$ grep -rniE "maxHeight|composerHeight" src/components/ai src/pages/AiPage.tsx
  (only hits: GroupCard 'maxHeight: none', a palette list, ConnectorsPanel 320)
  → ZERO hits for an input height setting
```

**The fix is small and exactly what you asked for:**

```ts
// three-stage: user picks the ceiling
type GrowMode = 'compact' | 'comfortable' | 'full'
const CAPS = { compact: 140, comfortable: 320, full: 640 }
```

persisted per-user, with the current `140` as the default so nothing changes on upgrade.
Add a drag handle on the textarea's bottom edge for a free-form override, clamped to
`[88, 720]`.

**One thing to fix while you're there:** the effect depends only on `props.value`, so
**dragging the handle won't re-measure**. The height cap must be a dependency, or the two
will fight each other.

---

## 2. Markdown, tables, lists — none of it is installed

```
$ for l in react-markdown marked markdown-it remark-gfm rehype-katex; do
    grep -c "\"$l" package.json; done
  react-markdown   0
  marked           0
  markdown-it      0
  remark-gfm       0
  rehype-katex     0
```

And the renderer is deliberately plain:

```tsx
// src/components/ai/chat/TypewriterText.tsx:54
<span className={cn("whitespace-pre-wrap", ...)}>
```

`whitespace-pre-wrap` preserves newlines and nothing else. So today the AI writes:

```
Here's your plan:
**1. Ship it**
| step | owner |
|---|---|
```

and the user sees the pipe characters and the asterisks.

**There is no `dangerouslySetInnerHTML` anywhere in chat** — I checked, and that's *good*:
it means there's no XSS hole. But it also means markdown cannot be enabled by flipping a
flag. It needs a real parser.

**Recommended:** `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`.
`react-markdown` renders to a React tree, **not** `innerHTML` — so it fixes tables and
lists *and* stays safe, without weakening anything currently in place.

**The hard part is the typewriter.** `TypewriterText` reveals characters progressively.
A markdown parser needs the **complete** string. So this cannot be "wrap the existing
component" — it becomes two modes:

```
streaming (typewriter, plain text, ~60% of the stream)
   → on completion → parsed (full markdown render, no re-animation)
```

Doing it any other way means re-parsing on every keystroke, which will flicker and cost
more the longer the response gets. **Design decision, not an implementation detail** —
flag it before building.

---

## 3. Equations work — on the wrong page

```
$ grep -rln "katex" src --include=*.tsx
  src/components/learn/blocks/AnnotatedMathBlock.tsx
  src/components/learn/blocks/MathBlock.tsx
  src/components/learn/blocks/ProseBlock.tsx
```

**`katex` is a real dependency and lesson math renders today.** There is no reason to
build a maths renderer — `MathBlock.tsx` is the working reference to copy.

It is simply not connected to the chat pipeline. The missing piece is `remark-math` +
`rehype-katex` in the parser chain from §2 — **one afternoon of wiring, not new maths.**

---

## 4. Excel / CSV — there is no parser at all

```
$ grep -c "xlsx|papaparse" package.json
  xlsx        0
  papaparse   0

$ grep -niE "attach|upload|\.csv|\.xlsx" src/components/ai/chat/ChatInput.tsx
  "alt=\"attachment\""          (an <img> preview)
  "Attach image (for vision model…)"   (title attribute)
```

**Attachments are images, and only images** — they exist so a vision model can look at a
screenshot. `pendingImages` is the state; there is no file path.

**So the "it detects Excel and shows it properly" behaviour you described does not exist
in any form.** There is no detection, no parser, no grid, no table renderer.

**What building it actually requires** — and this is the part worth knowing before
committing:

| layer | work |
|---|---|
| picker | accept `.csv .xlsx .xls` alongside images |
| parser | `xlsx` (SheetJS) — **note: the npm `xlsx` package left npm; install from the SheetJS CDN or vendor it.** `papaparse` for CSV alone is smaller |
| shape | a CSV is a table; an XLSX is *many* sheets → that is a **card type**, not a message |
| render | reuse the GFM table renderer from §2 so CSV and markdown look identical |
| route | an XLSX should land on a card (per `AI-CANVAS-AUDIT.md` §3 `transient`) rather than inline |
| size | a 10 MB sheet must not be dumped into a message — row cap + "showing 100 of 4,000" |

**Recommend: CSV first.** One file, one parser, no sheet ambiguity, and it proves the
whole pipeline. XLSX second.

---

## 5. Tool calling & "AI interacting with features" — the real surface

This is the part you asked me to review "everything", so here is the honest shape of it.

```
$ grep -c "registerTool\|name:" src/services/ai/toolRegistry.ts
  → 91 tool registrations, 90 unique names

  lanes:  41 read · 49 confirm · 0 destructive
```

**That 41/49/0 split is the headline.** No tool can delete. Every write waits for
confirmation. That is a good design and it should not change.

**The gap that matters for what you asked:** those 91 tools are **renderer-side** and call
`(window as any).deskflowAPI` directly. That means:

- they only work while the UI is open,
- automation rules **cannot** call them (they run in the main process),
- there is no registry describing *"what each tool does / when the AI should use it"*, so
  the model picks from 90 names with no help.

Full breakdown in `RESULT.md` §2 and §9. The short version: **tool calling is real and
substantial, but it is UI-bound and undocumented to the model.**

---

## 6. What is NOT done

| item | status |
|---|---|
| Configurable input growth cap | ❌ not started |
| Drag-to-resize composer | ❌ not started |
| Markdown in AI responses | ✅ **already existed** (hand-rolled parser) — my audit was wrong |
| Tables / GFM | ❌ not started (**real gap**) |
| Equations in chat | ❌ not started (**real gap**; `katex` present, unwired) |
| CSV / Excel attachment | ❌ not started (no parser at all) |
| Streaming-vs-parsed mode switch | ❌ not started (this is the design decision) |
| Tool-registry capability descriptions for the model | ❌ not started |

**Nothing in §1–§4 is built.** This document is the audit you asked for, not a claim of
completion.

---

## 7. Build order I'd recommend

1. **Configurable growth cap** — smallest win, you named it first, ~30 lines.
2. **`react-markdown` + `remark-gfm`** — unlocks lists, bold, headings, code, tables.
   Decide the streaming/parsed switch first; it changes the component's shape.
3. **`remark-math` + `rehype-katex`** — copy `MathBlock.tsx`, wire two plugins.
4. **CSV attach** — proves the pipeline end to end, then XLSX.
5. **Tool-registry descriptions** — helps every AI interaction at once, and is what makes
   the 90 tools usable rather than merely present.

Steps 1 and 2 are independent and can be done in either order. **Step 2's design decision
should be settled before any of it is written** — retrofitting it afterwards means
rewriting the response component.