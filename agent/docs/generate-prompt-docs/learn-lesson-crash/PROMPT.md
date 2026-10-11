# FIX PACKET — Lyceum crashes when opening any lesson

**Status:** open. **Severity:** high — the learning engine is unreachable in the UI.
**Component:** `src/components/learn/` · **Symptom class:** error-boundary trip on a
benign-looking browser warning.

---

## 1. The bug

Opening **any** lesson in Lyceum (`/learn` → Library → any card) kills the screen:

```
FAULT · /LEARN — This screen stopped responding
This screen stopped responding. Reload to start it again, or open a different page below.
ERROR MESSAGE: ResizeObserver loop completed with undelivered notifications.
```

The library itself is fine — 9 lessons load, cards render, `role="button"` targets are
present. The crash happens on **opening a lesson**, i.e. the moment the reader mounts.

Reproduced **3 / 3** attempts, on the first card, with the shipped configuration and no
other agents editing. Other pages (`/ai`, `/life`, `/reports`, `/`) load clean, so this is
specific to the lesson reader.

---

## 2. Reproduction

1. Launch the app.
2. Go to **Lyceum** (`/learn`).
3. **Browse Library** → "Your Library — 9 volumes on the Computer Science & AI shelf".
4. Click **any** lesson card, e.g. *PART 00 — What AI Engineers Actually Do*, or
   *PART 02 — Performance & Efficiency*, or *PART 09 — Testing the Lyceum Parser*.
5. → Error boundary. Screen is dead.

Every lesson in the library triggers it. The lessons are not corrupt.

---

## 3. Root cause — a ResizeObserver feedback loop

**`src/components/learn/blocks/ZoomPan.tsx:56-67`**

```tsx
const fitToContainer = useCallback(() => {
  // ... reads container + content sizes ...
  const s = Math.min(1, cw / nw, ch / nh);
  setScale(s);                          // <-- layout write
  setTx((cw - nw * s) / 2);              // <-- layout write
  setTy((ch - nh * s) / 2);              // <-- layout write
}, []);

useEffect(() => {
  fitToContainer();
  const el = containerRef.current;
  const content = contentRef.current;
  if (!el || !content) return;
  const ro = new ResizeObserver(() => {
    if (!interactedRef.current) fitToContainer();
  });
  ro.observe(el);
  ro.observe(content);                  // <-- observes the element it mutates
  return () => ro.disconnect();
}, [fitToContainer]);
```

**The loop:**

1. `ro` observes **`content`**.
2. The callback calls `fitToContainer()`, which writes `scale` / `tx` / `ty`.
3. Those writes change the size of the very element being observed.
4. Chromium re-delivers the notification → back to step 2.

That never-terminating cycle is exactly what
`ResizeObserver loop completed with undelivered notifications` reports. It is only a
console *warning* in a normal page — **here it becomes fatal because the app's error
boundary treats it as an uncaught error and unmounts the screen.**

`ZoomPan` is the wrapper used by every diagram-bearing block:

- `src/components/learn/blocks/FlowBlock.tsx`
- `src/components/learn/blocks/MermaidBlock.tsx`
- `src/components/learn/blocks/SvgBlock.tsx`

which is why *every* lesson crashes rather than only the diagram-heavy ones.

---

## 4. The fix

**Break the feedback edge — do not suppress the warning.** Any lesson that renders one
diagram block must open.

Preferred, in `ZoomPan.tsx`:

1. **Make `fitToContainer` idempotent.** Compare the computed `s` / `tx` / `ty` against
   current state (via a ref holding the last applied values) and **return early when the
   delta is below ~0.5px**. A fit that changes nothing cannot re-trigger the observer, so
   the loop terminates on the second pass.
2. **Stop observing the mutated element.** Observe the **container only**
   (`ro.observe(el)`); drop `ro.observe(content)`. Content-driven refits are better handled
   by the existing mount `fitToContainer()` plus a `ResizeObserver` on the container.
3. Keep the `interactedRef` guard — it is correct and should stay.

Both 1 and 2 are independently sufficient; do both.

**Also fix the blast radius.** A benign `ResizeObserver` warning should never be able to
take down a whole screen. Find the error boundary that renders the
`FAULT · <route> — This screen stopped responding` copy and, at minimum, stop routing
browser-emitted `ResizeObserver loop` notifications into it. Keep the boundary for real
render errors — do not delete it.

---

## 5. Scope

**In scope (claim these before editing):**

- `src/components/learn/blocks/ZoomPan.tsx` — the fix
- `src/components/learn/blocks/FlowBlock.tsx`, `MermaidBlock.tsx`, `SvgBlock.tsx` — only
  if they pass sizes that participate in the loop
- the error-boundary file that emits the `FAULT` copy — the blast-radius fix

**Out of scope — do not touch:** the lesson reader's layout, the curriculum graph, the
scoring logic, or anything under `src/terminal/`.

---

## 6. Hard constraints

- **Do not run a build.** `npm run build` / `scripts/build.mjs` are CZ-only per
  `AGENTS.md` §0-0. Verify with scoped checks instead:
  ```bash
  npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "learn/blocks|ErrorBoundary|error-boundary"
  npx esbuild src/components/learn/blocks/ZoomPan.tsx --bundle --outfile=/dev/null \
    --alias:@=./src --external:react --log-level=warning
  ```
- **Never delete or empty `dist/` or `dist-electron/`** (§0-0a) — that *is* the running app.
- **All `localStorage` access stays wrapped in `try/catch`** (§7).
- Do not "fix" this by removing the fit-to-container behaviour — the diagram must still
  scale to its container on mount.
- Files are CRLF. Do not mass-reformat.
- Multi-agent repo: `register` → `status` → `claim` before editing. A denied claim is a
  hard stop.

---

## 7. Acceptance criteria

A fix is done only when **all** of these hold:

1. Opening **every** one of the 9 lessons renders the reader with **no** error boundary
   and **no** `ResizeObserver loop` in the console.
2. Diagrams, Mermaid and SVG blocks still scale to fit their container on mount.
3. Scrolling and resizing the window do **not** reintroduce the loop.
4. Zoom/pan (wheel + buttons) still works and still suppresses auto-refit after first
   interaction.
5. `npx tsc --noEmit --project tsconfig.app.json` filtered to the touched files is clean.

---

## 8. Why this blocks other work

This bug is currently **blocking the V6 marketing capture**
(`landing/public/media/app-lesson-redraw.mp4`, tracked in
`landing/docs/APP_MEDIA_CAPTURE_GUIDE.md` §3.1). The lesson reader cannot be filmed while
every lesson crashes on open, so the Lyceum footage for the landing page does not exist yet.
Fix this and that capture becomes straightforward.
