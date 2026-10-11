# PROMPT — Halo Island: finish it, and make it feel physical

## Raw Request

> yknow those fucking halos on like the top centre of the screen of like apple devices? i would like to implenent that for my app. i would like you to refert o the @agent/docs/HALO_ISLAND.md documentation specificaiotn on the guidelines and what i would like you to do is to pla nout what are the thfeatureso f he app to include tehre. one of the msut stuff for me is the speech to t text and hte stopwatch. and maybe like the focus thing. deisgn teh ui and evruthing and ur job is just to plan out and think of what are teh features tothat mightb e a good adition to be on the halo. not neccsarily everythign eeds to be added there but like different widgets (maybe some from the dsahboard widgets) to be addedo n the halo island htta sis able to expand on hover like when my mouseo nh te center top my scereen no matter what app im in.

> make sure the speech to text uses the ui that we alreayd have. and make sure htat the main thing should be the stopwatch with its proper design

> WHY IS IT NOT ON THE TOP CENTER? THE UP MOST TOP? AND WHY IS THE EDISGN OF THE STOPWATCH SO FUCKING ASS AND WHY IS THERE NO ANIMATINO?

> WHY DOES IT LAUNCH IMMEDIATELY ON THE CENTER OF THE THING?

> i would like it to only do any animation or change when i hover on the center

---

## Context

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the source of truth.** It contains real source
code, measured numbers, the live design tokens, the five outstanding defects, and ten process traps
that have already cost hours. Do not ask for files; everything you need is in that bundle.

The product is **RHEO**, an Electron + React + SQLite desktop productivity tracker. The Halo is a
macOS Dynamic-Island-style always-on-top surface at the top-centre of the screen which expands on
hover and works while any other application has focus.

**Current state, honestly:** the island renders and animates correctly in a browser (17/17 and 5/5
suites green), but in the real application **the window opens in the centre of the screen** and
therefore only responds to hover over the centre. The cause is the host running **native Wayland**,
where Electron ignores programmatic window position. The stopwatch also still shows placeholder
data because it lives in a renderer-realm singleton that cannot cross a window boundary.

---

## The Mandate

Act as **Lead Designer and Engineer**. Produce ONE complete, decisive specification that takes the
Halo from "renders in a browser but is misplaced and static-feeling on the target machine" to
"physically correct, glanceable, and finished". Do not offer options. Do not ask which approach to
take. Decide, justify, and specify.

### Requirement Checklist

**A. Placement — solve Wayland properly, and fail honestly**
1. Specify the exact launch/placement contract: what must be true of the environment for the island
   to be placeable, how to detect it, and what to do when it is not.
2. Specify a placement VERIFICATION step that reads back the real window rect and treats a
   mispositioned island as a failure, not a cosmetic bug.
3. Specify the degradation path when placement is impossible. A wrong-position island is worse than
   no island.
4. Account for: multi-monitor, mixed DPI, negative coordinates, display hotplug, sleep/wake,
   lock/unlock, fullscreen, and resolution change.

**B. Motion — this is the core complaint, treat it as first-class**
5. Specify the full open and close choreography frame-by-frame: what moves, what fades, in what
   order, over what duration, with what easing curve. The HALO spec §68/§69 is the reference.
6. Specify how the compact pill and the expanded panel share visual identity so the transition reads
   as ONE object growing rather than one view replacing another.
7. Specify the interruptibility rules: what happens when the cursor leaves mid-open, and why the
   reverse animation does not restart from zero.
8. Specify the `prefers-reduced-motion` path as a genuinely different presentation, not the same
   animation with the duration multiplied by zero.
9. Every animated property must be `transform` / `opacity`. Explicitly forbid animating `width`,
   `height`, `margin`, `padding`, `box-shadow` blur, or `backdrop-filter`.

**C. The stopwatch hero — the primary surface**
10. Specify the complete visual hierarchy for the expanded state. The numeral is the hero; everything
    else is annotation. State the exact type scale, weights, sizes, colours-as-token-names, and spacing
    for each element.
11. Specify the compact state, including what the idle state shows when nothing is running.
12. Specify ALL data states: loading, empty (zero tracked time), populated, paused, AFK-frozen,
    mid-day-reset, and error. The AFK-frozen state matters most — the clock stops without `paused`
    flipping, and an unlabelled frozen readout looks broken.
13. Specify the productive-vs-distracting visualisation, including the exact caption wording. A
    previous version rendered `00:49:59 off-track`, which reads as a timestamp rather than a quantity.
14. Specify how the surface reads when it is only 40px tall and glanceable in under 200ms.

**D. Dictation — reuse, do not reinvent**
15. The dictation UI must derive from the visual language of the deleted standalone panel: 24 waveform
    bars, 3px wide on a 2px gap, 22px tall, `--color-clay-400` centre bars over `--color-clay-500`
    outer bars, the same level hairline, the same control set. Do not redesign it.
16. Specify how the waveform behaves given that the engine's `interim` text is EMPTY on the primary
    on-device path — the RMS level is the only real mid-utterance signal, so the waveform carries the
    recording.
17. Specify the meter update mechanism such that 24 samples/second does not cause 24 React commits
    per second.

**E. Data — specify the real contract, not a mock**
18. Specify the exact relay contract that carries live stopwatch state from the renderer that owns it
    into the main process and out to the island. Include the payload shape, the validation rules, the
    cadence, and what happens on renderer reload.
19. State precisely how one canonical field and one canonical formatter are preserved, and why a
    second derivation is forbidden. (A previous regression made two surfaces show different values for
    "the same" number.)
20. Specify at least two additional activities beyond the stopwatch and dictation, drawn from the
    candidate list in CONTEXT_BUNDLE §7, each justified by its read cost.

**F. Engineering**
21. Specify the module boundaries and which directory each piece must live in, given that the main
    process can only import from a specific set of pre-compiled directories.
22. Specify the IPC surface: channel names, payloads, validation, and who is authoritative.
23. Specify what instrumentation is needed so a future failure is diagnosable from a file rather than
    from a terminal nobody is watching.
24. Specify the verification plan using ONLY the mechanisms available: no test runner exists. Scoped
    `tsc`, `esbuild` parse, a pure-logic probe that prints numbers, and a Playwright suite against the
    dev server.

### Constraints

- `design/design.md` (LAMINAR) **outranks** the HALO spec where they conflict. Specifically: **no
  springs** (§7.4) even though the HALO spec asks for them; radii `8/12/pill` only; max 2 font
  families; one signal hue per surface; no `backdrop-blur` on chrome; no raw hex inside any `.tsx`;
  honour `prefers-reduced-motion`.
- Must work on **macOS, Windows and Linux X11**, and must degrade honestly on **native Wayland**.
- The main process owns the window, geometry, hover policy and platform capability. React owns only
  the visual layer.
- The island must never steal keyboard focus from whatever the user is typing in.
- The island must never permanently intercept desktop clicks.
- The island is optional. Its failure must never crash or block the application.
- An agent never runs the build. CZ builds.

---

## Output Format

A single markdown specification document. For each decision give **what**, **why**, and **the exact
value** (token names, pixel sizes, durations, easing curves, channel names, field names). Produce
diagrams in text for the compact and expanded layouts. Include a build order in which every step is
independently verifiable, and mark each step with how it is verified.

Do not write implementation code. Specify it precisely enough that it could be implemented without
further interpretation.
