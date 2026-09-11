I've gathered the current Motion (motion.dev) API details. Below is the complete `docs/motion_patterns.md` deliverable with five code sketches, including the 300vh-pinned playhead scrub (Act II) and a velocity-coupled spring pattern.

***

## docs/motion_patterns.md

### Motion (motion.dev) current scroll API snapshot — August 2026

**Core primitives for reversible, scroll-scrubbed animation:**

- **Vanilla:** `scroll()` (5.1kb) — universal scroll driver, callback or `animate()` instance, supports `ScrollTimeline` where available. [motion](https://motion.dev/docs/scroll)
- **React hooks:** `useScroll`, `useSpring`, `useTransform`, `useInView`, `useVelocity` (via `motion/react`). [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- **Pinning:** Use CSS `position: sticky` for best performance; Motion docs explicitly recommend this over JS pinning. [motion](https://motion.dev/docs/scroll)
- **Offsets:** `offset: ["start start", "end end"]` (or custom intersections like `"start end"`, `"center center"`, pixels, `%`, `vh/vw`). [motion](https://motion.dev/docs/scroll)
- **Reversibility:** All scroll-linked patterns are inherently reversible because values are bound to scroll progress, not time. [motion](https://motion.dev/docs/scroll)

***

### React vs vanilla usage

| Feature | Vanilla (`scroll()`) | React (`useScroll` + hooks) |
|---|---|---|
| Import | `import { scroll, animate } from "motion"` | `import { motion, useScroll, useSpring, useTransform, useInView } from "motion/react"`  [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8) |
| Scroll driver | `scroll(callback, options)` or `scroll(animation, options)` | `const { scrollY, scrollYProgress } = useScroll(options)`  [motion](https://motion.dev/docs/scroll) |
| Smoothing | Manual via `info.velocity` or custom lerp | `useSpring(scrollYProgress, { stiffness, damping, restDelta })`  [motion](https://motion.dev/docs/scroll) |
| Mapping | `progress` → CSS in callback | `useTransform(scrollYProgress, input, output)`  [motion](https://motion.dev/docs/scroll) |
| Trigger-once | N/A (use `inView` or IntersectionObserver) | `useInView(ref, { once: true, root, rootMargin, threshold })`  [motion](https://motion.dev/docs/react-scroll-animations) |
| Pinning | `position: sticky` (recommended) | Same; Motion examples use `sticky` containers for horizontal/parallax sections  [motion](https://motion.dev/docs/scroll) |

***

### Bundle size

- **`scroll()` core:** 5.1kb. [motion](https://motion.dev/docs/scroll)
- **`animate()` mini:** 2.6kb; full: 18kb. [motion](https://motion.dev/docs/gsap-vs-motion)
- **React `motion` full:** ~34kb gzip, but tree-shakable; `LazyMotion` + `m` can drop initial to ~4.6kb. [motion](https://motion.dev/docs/gsap-vs-motion)
- **Lenis (smooth scroll):** ~3kb; commonly paired with Motion/GSAP for inertia scroll. [npmjs](https://www.npmjs.com/package/framer-motion)

***

### `prefers-reduced-motion` support

Motion supports reduced motion via `MotionConfig`:

```tsx
import { MotionConfig } from "motion/react"

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

- With `reducedMotion="user"`, Motion automatically disables transform/layout animations when the OS setting is on, while keeping opacity/color transitions. [animate-ui](https://animate-ui.com/docs/accessibility)
- For custom JS scroll animations, detect via `window.matchMedia("(prefers-reduced-motion: reduce)")` and skip or simplify. [blog.pope](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)

***

### Lenis compatibility

- **Lenis** is a lightweight smooth-scroll library (~3kb) that works alongside Motion; it does not conflict with `useScroll`/`scroll()`. [npmjs](https://www.npmjs.com/package/framer-motion)
- Pattern: wrap app in `<ReactLenis>` (or manual `new Lenis()`), then use Motion hooks normally; scroll events are smoothed, Motion reads the same `window`/`container` scroll. [snigdhachandrapaik.vercel](https://snigdhachandrapaik.vercel.app/blogs/animated-website-libraries-nextjs-react)
- For GSAP users, `ScrollTrigger.update` is synced on each Lenis tick; with Motion, no special sync is required beyond using the same scroll container. [snigdhachandrapaik.vercel](https://snigdhachandrapaik.vercel.app/blogs/animated-website-libraries-nextjs-react)

***

### iOS Safari sticky pitfalls (2025–2026)

Known issues with `position: sticky` / `fixed` on iOS Safari (esp. iOS 26 beta):

- Address bar shrink/expand can displace fixed/sticky elements vertically. [stackoverflow](https://stackoverflow.com/questions/79753701/ios-26-safari-web-layouts-are-breaking-due-to-fixed-sticky-position-elements-g)
- Workarounds:
  - Use dynamic viewport units (`100dvh`) and safe-area insets: `top: env(safe-area-inset-top)`. [pratikpathak](https://pratikpathak.com/fix-ios-26-safari-web-layouts-are-breaking-due-to-fixed-sticky-position-elements-getting-misplaced/)
  - For critical full-screen sticky sections, test on real devices; consider JS-based `visualViewport` corrections if needed. [pratikpathak](https://pratikpathak.com/fix-ios-26-safari-web-layouts-are-breaking-due-to-fixed-sticky-position-elements-getting-misplaced/)
  - Avoid relying on `100vh` alone; prefer `100dvh` or JS-computed `--vh`. [pratikpathak](https://pratikpathak.com/fix-ios-26-safari-web-layouts-are-breaking-due-to-fixed-sticky-position-elements-getting-misplaced/)

Motion’s own docs recommend `position: sticky` for pinning, but on iOS you may need these extra guards for full-screen pinned sections. [motion](https://motion.dev/docs/scroll)

***

## Five code sketches

### 1. Vanilla `scroll()` callback scrub (reversible progress bar)

```js
// motion_patterns/01-vanilla-scroll-progress.js
import { scroll } from "motion"

const bar = document.querySelector(".progress-bar")

const cancel = scroll((progress) => {
  bar.style.transform = `scaleX(${progress})`
  bar.style.transformOrigin = "0 50%"
}, {
  axis: "y",
  offset: ["start start", "end end"] // full page scroll
})

// Optional: cleanup on unmount / route change
// cancel()
```

- Reversible: as user scrolls up/down, `progress` moves 0→1→0. [motion](https://motion.dev/docs/scroll)

***

### 2. React `useScroll` + `useTransform` parallax (multi-layer)

```tsx
// motion_patterns/02-react-parallax.tsx
import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

export function ParallaxScene() {
  const ref = useRef<HTMLElement>(null)
  const { scrollY } = useScroll({ container: ref })

  const bgY = useTransform(scrollY, [0, 1], [0, -50], { clamp: false })
  const midY = useTransform(scrollY, [0, 1], [0, -100], { clamp: false })
  const fgY = useTransform(scrollY, [0, 1], [0, -150], { clamp: false })

  return (
    <section ref={ref} style={{ height: "300vh", overflow: "auto" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <motion.div style={{ y: bgY }} className="layer bg" />
        <motion.div style={{ y: midY }} className="layer mid" />
        <motion.div style={{ y: fgY }} className="layer fg" />
      </div>
    </section>
  )
}
```

- `clamp: false` allows layers to keep moving beyond 0–1 range. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)

***

### 3. Velocity-coupled spring (smoothed scrub with inertia feel)

```tsx
// motion_patterns/03-velocity-spring-scrub.tsx
import { useRef } from "react"
import { motion, useScroll, useSpring, useTransform } from "motion/react"

export function SpringScrubHero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"]
  })

  // Spring-smoothed progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    restDelta: 0.001
  })

  const rotate = useTransform(smoothProgress, [0, 1], [0, 180])
  const scale = useTransform(smoothProgress, [0, 1], [0.8, 1.2])

  return (
    <section ref={ref} style={{ height: "200vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "grid", placeItems: "center" }}>
        <motion.div
          style={{ rotate, scale, width: 200, height: 200, background: "#6366f1", borderRadius: 999 }}
        />
      </div>
    </section>
  )
}
```

- Spring adds a subtle lag/overshoot feel while remaining fully reversible. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)

***

### 4. 300vh-pinned playhead scrub (Act II pattern)

```tsx
// motion_patterns/04-act-ii-300vh-pinned-playhead.tsx
import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

export function ActIIPinnedPlayhead() {
  const containerRef = useRef<HTMLElement>(null)

  // Full-container scroll → 0..1 over 300vh
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  // Map to horizontal playhead (0% → -75% for 4 "frames")
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"])

  // Optional: circular progress indicator
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = useTransform(
    scrollYProgress,
    [0, 1],
    [circumference, 0]
  )

  return (
    <section ref={containerRef} style={{ height: "300vh" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden"
        }}
      >
        {/* Horizontal scrub strip */}
        <motion.div
          style={{ x, display: "flex", gap: 20 }}
        >
          {["Frame 1", "Frame 2", "Frame 3", "Frame 4"].map((label, i) => (
            <div
              key={label}
              style={{
                flexShrink: 0,
                width: 400,
                height: 400,
                background: i % 2 ? "#10b981" : "#f59e0b",
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 24
              }}
            >
              {label}
            </div>
          ))}
        </motion.div>

        {/* Circular playhead overlay */}
        <svg
          width="120"
          height="120"
          style={{ position: "absolute", right: 24, bottom: 24 }}
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#fff"
            strokeWidth="8"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset
            }}
          />
        </svg>
      </div>
    </section>
  )
}
```

- Outer `300vh` container defines scrub distance; inner `sticky` viewport stays pinned. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- Fully reversible: scrubbing up/down moves the playhead back and forth.

***

### 5. `useInView` + `useSpring` number ticker (trigger-once, then spring-animated)

```tsx
// motion_patterns/05-useInView-spring-ticker.tsx
import { useEffect, useRef } from "react"
import { useInView, useMotionValue, useSpring } from "motion/react"

export function NumberTicker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 2000 })
  const inView = useInView(ref, { once: true, margin: "0px" })

  useEffect(() => {
    if (inView) mv.set(value)
  }, [inView, mv, value])

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toLocaleString()
      }
    })
  }, [spring])

  return <span ref={ref} />
}
```

- `useInView` with `once: true` ensures the animation fires only the first time the element enters view. [jiapixel](https://www.jiapixel.com/blogs/advanced-website-animations-creating-immersive-digital-experiences)
- Spring provides smooth count-up; not scroll-scrubbed, but often used alongside scroll sections.

***

### Quick checklist for your Act II implementation

- Use `height: 300vh` (or more) outer container + `position: sticky; top: 0; height: 100vh` inner viewport. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- Drive animation with `useScroll({ target: containerRef, offset: ["start start", "end end"] })`. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- Map `scrollYProgress` via `useTransform` to `x`, `rotate`, `scale`, `strokeDashoffset`, etc. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- For smoother feel, wrap progress in `useSpring`. [motion](https://motion.dev/docs/react-scroll-animations?via=cptv8)
- Wrap app in `<MotionConfig reducedMotion="user">` and/or check `prefers-reduced-motion` for fallbacks. [animate-ui](https://animate-ui.com/docs/accessibility)
- If using Lenis, wrap content in `<ReactLenis>` and keep Motion hooks unchanged. [snigdhachandrapaik.vercel](https://snigdhachandrapaik.vercel.app/blogs/animated-website-libraries-nextjs-react)
- Test pinned sections on iOS Safari; consider `100dvh` and `env(safe-area-inset-*)` if you see jumps. [pratikpathak](https://pratikpathak.com/fix-ios-26-safari-web-layouts-are-breaking-due-to-fixed-sticky-position-elements-getting-misplaced/)

If you want, I can next adapt these sketches to your exact Act II storyboard (e.g., specific frames, colors, timing, and whether you want a circular vs linear playhead).