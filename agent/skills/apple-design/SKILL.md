---
name: apple-design
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.
---

# Apple Design

> **Initial Response:** when this skill is first invoked without a specific question, respond only with:
> "I'm ready to help you build fluid, Apple-style interfaces on the web, my knowledge comes from Apple's WWDC design talks, translated for the web."
> Do not provide any other information until the user asks a question.

Source: `https://www.ui-skills.com/skills/emilkowalski/apple-design` (emilkowalski). Distilled from Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — translated to the web platform (CSS, Pointer Events, `requestAnimationFrame`, Motion/Framer Motion).

**The through-line:** an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant. Springs are the tool that makes all of this natural, because they are inherently interruptible and velocity-aware.

## ⚠️ PROJECT OVERRIDE — READ BEFORE USING §12 (Materials) OR §4 (Springs)

DeskFlow is governed by **`design/design.md` (LAMINAR constitution)**, which OVERRIDES this skill wherever they conflict.

| This skill says | **DeskFlow requires** |
|---|---|
| §12 translucent chrome, `backdrop-filter` blur layers, material hierarchy | **BANNED on chrome.** LAMINAR §7: no glassmorphism on chrome. Flat surfaces + hairline borders. |
| §4 bounce / under-damped springs (`damping ~0.8`) | **`damping 1.0` (critically damped). No spring/bounce anywhere in data areas.** |
| §12 "materialize" blur+scale animation on surfaces | Animations only where they encode meaning, not on surfaces. |

**Still authoritative and unchanged from this skill:** §1 response-on-press, §2 direct manipulation, §3 interruptibility, §5 velocity handoff, §6 momentum projection, §7 spatial consistency, §8 gesture-direction hints, §9 rubber-banding, §10 gesture details, §11 frame smoothness, §14 reduced-motion, §15 typography, §16 design foundations.

Those are engineering rules about *feel* — they do not conflict with LAMINAR's visual rules, and they are the parts worth having.

## 1. Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff."

- **Respond on pointer-down, not on release.** Highlight a button the instant it's pressed. Waiting for `click`/touch-up feels dead.
- **Audit every latency:** debounces, artificial timers, transition waits, the ~300ms tap delay. Anything on the input path that isn't essential is a regression.
- **Feedback must be continuous *during* the interaction**, not just at the end. Update the UI 1:1 with the pointer the whole way through.

```css
.button:active { transform: scale(0.97); transition: transform 100ms ease-out; }
```

## 2. Direct manipulation — 1:1 tracking

> "Touch and content should move together."

Track **from where they grabbed it**, not from the element's centre — snapping to centre on grab breaks the illusion immediately.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top;
  // ...track position + timestamp history for velocity
});
```

Use `setPointerCapture` so tracking continues past the element bounds. Keep a short **position/velocity history** — you'll need release velocity.

## 3. Interruptibility — the single most important principle

> "The thought and the gesture happen in parallel."

Every animation must be grabbable and redirectable mid-flight.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target value.** Read the element's live on-screen transform. Starting from the logical value causes a visible jump.
- **Avoid CSS transitions and `@keyframes` for anything gesture-driven** — they can't be smoothly reversed. Springs animate from the current value by default.
- **Blend velocity on reversal.** Replacing one animation with another creates a "brick wall."
- **Decompose 2D motion into independent X and Y springs** — one spring on a 2D distance desyncs when the axes differ.

## 4. Behavior over animation — use springs

> "Think of animation as a conversation between you and the object."

Apple replaced mass/stiffness/damping with two designer-facing parameters:

- **Damping ratio** — overshoot. `1.0` = critically damped. `< 1.0` = oscillates.
- **Response** — how fast it reaches target, in seconds. **Not "duration"** — a spring's settle time emerges from its parameters.

> **DeskFlow: use `damping: 1.0`. Bounce is banned** (LAMINAR). This section's guidance survives as *springs beat fixed-duration easing for anything interruptible* — not as permission to overshoot.

## 5. Velocity handoff — the seam between drag and animation

When a gesture ends, continue at the finger's exact velocity so there's no seam.

```
relativeVelocity = gestureVelocity / (targetValue − currentValue)
```

Motion/Framer Motion take absolute px/s directly, so usually hand over the raw value.

## 6. Momentum projection — animate to where the gesture is *going*

> "Take a small input and make a big output."

Project the resting position from release velocity — like scroll deceleration — then snap to the target nearest that point.

```js
// decelerationRate ≈ 0.998 for normal scroll feel; 0.99 for snappier
function project(initialVelocity, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}
const target = nearestSnapPoint(currentPosition + project(releaseVelocity));
animateSpringTo(target, { velocity: releaseVelocity });
```

The physics-textbook `v²/(2·decel)` is **not** what Apple ships — use the exponential-decay form.

## 7. Spatial consistency — symmetric paths, anchored origins

> "If something disappears one way, we expect it to emerge from where it came."

- **Enter and exit along the same path.** In-from-right must exit right.
- **Anchor interactions to their source** — set `transform-origin` to the trigger element.
- **Mirror easing on reversible transitions** (inverse cubic-bézier control points).

## 8. Hint in the direction of the gesture

Humans predict final state from trajectory. Intermediate frames should point at the outcome, not just interpolate.

## 9. Rubber-banding — soft boundaries

A hard stop reads as "frozen"; progressive resistance reads as "responsive, but there's nothing more here."

```js
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details

- **Tap:** highlight on touch-down, commit on touch-up. ~10px hysteresis/cancel-by-dragging-away.
- **Drag:** small movement threshold (~10px) before committing to a direction, then track 1:1.
- **Detect all plausible gestures in parallel from the first move**, cancel losers once intent is clear. Avoid `swipeleft`-style final-state-only events — they throw away the continuous tracking you need.
- **Minimise disambiguation delays.** Only pay for double-tap detection where it truly exists.

## 11. Frame-level smoothness

- Keep per-frame positional change below the perception threshold.
- For very fast motion, subtle **motion blur / stretch** encodes speed better than a hard streak.
- Animate only `transform` and `opacity`; hint with `will-change` where motion is imminent.

## 12. Materials & depth — translucency conveys hierarchy

> **⚠️ OVERRIDDEN for DeskFlow chrome. See the Project Override table above.**

Apple's approach (translucent `backdrop-filter` layers, material weight encoding hierarchy, vibrancy, scroll-edge fades) is good craft — **but LAMINAR bans it on chrome.** Keep §12 for reference only; do not apply to DeskFlow surfaces.

## 13. Multimodal feedback — motion + sound + haptics

1. **Causality** — obvious what caused the feedback; fire on the actual causal event.
2. **Harmony** — visual, sound, haptic on the **same frame**. A lagging CSS transition destroys the illusion.
3. **Utility** — reserve feedback for meaningful moments. Over-feedback trains users to ignore all of it.

## 14. Reduced motion & accessibility

Reduced motion ≠ no feedback. Respond to three independent signals:

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; }
}
```

Also avoid full-viewport moving backgrounds, slow looping oscillations (~0.2 Hz), and abrupt brightness jumps. Scale layout in `rem`/`em`, not fixed px, so larger text doesn't break it.

## 15. Typography — optical sizing, tracking, leading

- **Tracking is size-specific, never one value for all sizes.** Large display text wants *negative* tracking; small text wants slightly positive. Body near `0`.
- **Leading tracks size inversely.** Tight on large headings, looser on body.
- **Build hierarchy from weight + size + leading as a set**, not size alone.
- **Respect the user's text-size setting.** Scale layout with the text.
- **Default to the platform system font** before a custom face.

```css
:root { font: 100%/1.5 system-ui, sans-serif; }
.display {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}
```

## 16. Design foundations — the eight principles

1. **Purpose** — decide what *not* to build.
2. **Agency** — keep people in control; forgive mistakes. Confirmation dialogs only for irreversible actions.
3. **Responsibility** — act in the user's interest. Anticipate misuse, especially with AI.
4. **Familiarity** — build on what people know; consistent behaviour for consistent-looking things.
5. **Flexibility** — different contexts, devices, abilities. Let people hide what they don't use.
6. **Simplicity — not minimalism.** Concise, clear, hierarchy-driven. Show the common path first.
7. **Craft** — nothing random; every value deliberate and defensible.
8. **Delight** — the result of the other seven, not confetti on top.

Tactical: **feedback** comes in four kinds (status, completion, warning, error); validate inline, not on submit. **Wayfinding** — every screen answers where am I / where can I go / what's there / how do I get out. **Grouping** — proximity implies relationship. **Labels** — direct and specific beats safe and generic.

## 17. Process

- **Prototype interactively** — an interactive demo is worth a million static designs.
- **Design interaction and visuals together** — motion is not a layer added after the pixels.
- **Test with real people**, review motion in slow motion / frame by frame.

## Quick Reference

| Need | Technique | Value |
|---|---|---|
| Default UI spring | Critically damped | `damping 1.0`, `response 0.3–0.4` |
| Momentum / flick spring | Under-damped (**banned in DeskFlow**) | `damping ~0.8` |
| Gesture → spring velocity | Hand off release velocity | `gestureVelocity / (target − current)` |
| Flick landing point | Project momentum | `current + (v/1000)·d/(1−d)`, `d ≈ 0.998` |
| Interrupt cleanly | Start from presentation value | read the on-screen transform |
| Avoid reversal brick wall | Carry velocity through re-target | velocity-blending spring |
| Reversible transition | Mirror the easing curve | inverse cubic-bézier |
| Reverse vs. commit | Use velocity **sign**, not position | at release |
| 1:1 drag | Pointer Events + capture | respect the grab offset |
| Feedback | On pointer-down, continuous | never only at the end |
| Boundary | Rubber-band, don't hard-stop | progressive resistance |
| Type tracking | Size-specific, never fixed | large `-0.02em`, body ~0 |
| Reduced motion | Cross-fade, not slide/spring | `@media (prefers-reduced-motion)` |
