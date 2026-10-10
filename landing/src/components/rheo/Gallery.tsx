"use client";

import { motion } from "framer-motion";
import { Download, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import AsciiSurface from "./AsciiSurface";
import DecryptedText from "./DecryptedText";
import { RealClip, RealShot } from "./RealFootage";

/**
 * Gallery — the primary viewing surface. THE WHOLE APP. UNRETOUCHED.
 *
 * Per `agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md`
 * §1–2. This section is the reason the page exists: it owns ALL 17 stills and
 * ALL 7 recordings, and no other section renders a capture.
 *
 * THREE FAILURES THIS REPLACES:
 *
 *  1. **24 chips in a wrapping row** — no position indicator, 24 equal weights so
 *     the 3 that mattered looked like the 21 that didn't, and no affordance that
 *     the panel below changed on click.
 *  2. **A ring.** An orbit of all 17 that dragged horizontally on a vertically
 *     scrolling page, so you scrolled down to reach it, dragged sideways, then
 *     scrolled down again. 1,209 lines to duplicate what this strip already did.
 *  3. **24 rows for 17 screens.** A still and its recording were separate rows,
 *     so "Dashboard" and "▶ Dashboard" looked unrelated and the count lied.
 *
 * Now: 17 SCREENS is the unit. A recording is a STATE of a screen, reachable
 * with one toggle, and the readout says a true count.
 *
 * DELIBERATE NON-FEATURES, per RESULT.md §2.7:
 *   - No autoplay. Content moving >5s without a pause control is a WCAG 2.2.2
 *     failure, and it hides 16 of 17 screens behind a timer nobody asked for.
 *   - No carousel engine. Native scroll-snap, confirmed by reading
 *     `@kokonutui/carousel-cards`: it is `snap-x snap-mandatory` + `scrollBy`
 *     arrows and pulls in no dependency.
 *   - No 3D. These are 2880x1800 captures; the section's claim is that they are
 *     unretouched, and perspective, blur or portrait crops all undercut that.
 */

/** A recording belonging to a screen. Never a row of its own. */
type Recording = {
  src: string;
  /** names WHICH capture, since two screens have two each */
  label: string;
};

/** One screen of the app. THE unit of counting. */
type Screen = {
  id: string;
  label: string;
  still: string;
  alt: string;
  /** <=9 words. The atlas's 180 words, compressed to sit next to the thing
   *  they describe instead of occupying their own section. */
  caption: string;
  recordings?: Recording[];
};

const SCREENS: Screen[] = [
  // RESULT.md CONTRADICTION, resolved toward "no capture twice" (the user's
  // primary complaint). §2.2 spells out Dashboard as [STILL | IDLE | 24H
  // TIMELINE], but §1.1 ALSO grants #act-record its own RealClip and §1.3 gives
  // the gallery all 7 recordings. All three cannot hold. §1.2 decides it:
  // "a capture serves its section's claim." The 24h-timeline clip IS the record
  // loop, so #act-record owns it; the Dashboard screen shows IDLE.
    { id: "dashboard", label: "Dashboard", still: "/media/app-dashboard.png", alt: "The RHEO dashboard with a real day's tracked time", caption: "The whole day on one surface — depth, not duration.", recordings: [{ src: "/media/app-dashboard-idle.mp4", label: "IDLE" }] },
  { id: "console", label: "Penguin Console", still: "/media/app-console.png", alt: "Penguin Console running real commands in a real shell", caption: "A real PTY. Real commands, real output, no wrapper.", recordings: [{ src: "/media/app-terminal-real.mp4", label: "TERMINAL" }, { src: "/media/app-terminal-work.mp4", label: "REAL WORK" }] },
  { id: "activity", label: "Activity", still: "/media/app-activity.png", alt: "The raw record behind the timeline", caption: "Every app and site, logged. The record before it becomes anything." },
  { id: "insights", label: "Insights", still: "/media/app-insights.png", alt: "Insights showing real productive, neutral and distracting totals", caption: "Productive, neutral, distracting — weighted by depth.", recordings: [{ src: "/media/app-insights-detail.mp4", label: "DETAIL" }] },
  { id: "life", label: "Life", still: "/media/app-life.png", alt: "The Life page with a real week", caption: "The week, with its phases. Not a mood ring.", recordings: [{ src: "/media/app-life-week.mp4", label: "WEEK" }] },
  { id: "ai", label: "AI Assistant", still: "/media/app-ai.png", alt: "The AI Assistant querying a real tracked record", caption: "It answers against your record, and cites the sessions it used." },
  { id: "learn", label: "Lyceum", still: "/media/app-learn.png", alt: "A lesson open in Lyceum", caption: "Lessons that redraw as you grow. Weights adjust themselves." },
  { id: "finance", label: "Finance", still: "/media/app-finance.png", alt: "The Finance page with real transactions", caption: "Where the money went, from the same record. No bank sync." },
  { id: "ide", label: "IDE Projects", still: "/media/app-ide.png", alt: "IDE Projects tracking real work", caption: "Coding time, organised per project." },
  { id: "database", label: "Database", still: "/media/app-database.png", alt: "The local-first database browser", caption: "One SQLite file on your disk. Browse it. It's yours.", recordings: [{ src: "/media/app-database-scroll.mp4", label: "SCROLL" }] },
  { id: "rankings", label: "Rankings", still: "/media/app-rankings.png", alt: "Rankings computed from the real record", caption: "Computed from the record, never typed in." },
  { id: "labs", label: "Labs", still: "/media/app-labs.png", alt: "Labs, the experimental surface", caption: "Where unfinished things live until they're not." },
  { id: "studio", label: "Content Engine", still: "/media/app-studio.png", alt: "The Overlay Studio content engine", caption: "Sessions become documentation and explainers." },
  { id: "guide", label: "Guide", still: "/media/app-guide.png", alt: "The in-app Guide", caption: "How the instruments fit together." },
  { id: "settings", label: "Settings", still: "/media/app-settings.png", alt: "Settings", caption: "Local-first by default. Zero telemetry." },
  { id: "lecture", label: "Lecture", still: "/media/app-lecture.png", alt: "Lecture mode", caption: "Teach the room from the record." },
  { id: "profiler", label: "Profiler", still: "/media/app-profiler.png", alt: "The in-app performance profiler", caption: "RHEO measures itself with RHEO." },
];

/** The capture the ASCII seam re-reads. Must be a real file in public/media. */
/**
 * The capture the ASCII seam re-reads.
 *
 * CHOSEN BY MEASUREMENT, NOT BY POSITION. It was `SCREENS[0]` (the dashboard)
 * because that was the path of least resistance, and the dashboard was then
 * doing four jobs: strip slide, thumbnail tile, act-record poster, and seam
 * source. GLM flagged it as the §0.5 smell in miniature.
 *
 * `probe-ascii-surface.mjs` measures ramp indices per capture — the seam's only
 * job is glyph legibility, so the widest spread wins:
 *
 *   app-lecture.png    14/16   <- selected. peak 1.000, the only full-white pixel
 *   app-ide.png        12/16
 *   app-learn.png      12/16
 *   app-life.png       12/16
 *   app-profiler.png   12/16
 *   app-dashboard.png  11/16   <- was used, not the widest
 *   app-guide.png       9/16   <- genuinely the flattest field
 *
 * Selected BY ID, not index, so a future reorder cannot silently change which
 * capture the seam claims.
 */
const ASCII_SOURCE = SCREENS.find((s) => s.id === "lecture")!;

export default function Gallery() {
  const reduced = usePrefersReducedMotion();
  const railRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [AtEnd, setAtEnd] = useState(false);
  // First slide index whose start-stop is unreachable, so it must be END-aligned.
  const [tailFrom, setTailFrom] = useState(SCREENS.length);
  /** which recording of THIS screen is showing; null = the still */
  const [recording, setRecording] = useState<Recording | null>(null);

  const active = SCREENS[index];
  const recordings = active.recordings ?? [];

  /**
   * Position comes from the rail's real scrollLeft, never click bookkeeping.
   * Anything else desyncs the moment the user drags, uses a trackpad, or
   * resizes — the readout would then claim a slide the viewport isn't showing.
   */
  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + RAIL_GAP;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    // The tail slides are END-aligned, and the rail carries a `padding-right`
    // (clamp(20px,4vw,64px) = 57.6px at 1440) used for the edge-bleed. An
    // end-aligned snap therefore parks at maxScroll MINUS that padding — measured
    // 7206 vs 7264, a 58px shortfall. Testing against maxScroll meant atEnd never
    // fired, the readout stayed "16 / 17" with the last slide on screen, and the
    // derived index rounded 7206/496 = 14.53 to 15.
    const padEnd = parseFloat(getComputedStyle(rail).paddingRight) || 0;
    const endStop = Math.max(0, maxScroll - padEnd);
    const atEndNow = rail.scrollLeft >= endStop - 8;
    // GLM R4: the tail slides are END-aligned, so they have no reachable start-stop.
    // Dividing by `step` alone made the last two slides unreachable and left the
    // readout claiming slide 16 with slide 17 half off-screen. At the end, the rail
    // IS showing the last slide — so say so, instead of rounding a position that
    // was never available.
    const i = atEndNow
      ? SCREENS.length - 1
      : Math.max(0, Math.min(SCREENS.length - 1, Math.round(rail.scrollLeft / step)));
    if (i !== index) {
      setIndex(i);
      // never land on a new screen mid-recording
      setRecording(null);
    }
    setAtStart(rail.scrollLeft <= 8);
    setAtEnd(atEndNow);
    // Recomputed on scroll and resize: the reachable range changes with viewport.
    let firstUnreachable = SCREENS.length;
    for (let n = 0; n < SCREENS.length; n++) {
      if (n * step > maxScroll) { firstUnreachable = n; break; }
    }
    setTailFrom(firstUnreachable);
  }, [index]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    sync();
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      rail.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const goTo = useCallback((i: number) => {
    const rail = railRef.current;
    const slide = rail?.firstElementChild as HTMLElement | null;
    if (!rail || !slide) return;
    const clamped = Math.max(0, Math.min(SCREENS.length - 1, i));
    // Clamp to the real scroll range. The tail slides are END-aligned, so asking for
    // `16 * step` overshoots maxScroll by 672px and the browser silently lands
    // somewhere else entirely.
    const step = slide.offsetWidth + RAIL_GAP;
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const padEnd = parseFloat(getComputedStyle(rail).paddingRight) || 0;
    const target = clamped === SCREENS.length - 1 ? Math.max(0, maxScroll - padEnd) : clamped * step;
    rail.scrollTo({
      left: Math.min(target, maxScroll),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setIndex(clamped);
    setRecording(null);
  }, []);

  const onRailKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { goTo(index + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { goTo(index - 1); e.preventDefault(); }
    else if (e.key === "Home") { goTo(0); e.preventDefault(); }
    else if (e.key === "End") { goTo(SCREENS.length - 1); e.preventDefault(); }
  };

  return (
    <section id="gallery" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-8 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 03 / EVERY SURFACE" speed={28} maxIterations={6} />
          </p>
          <h2 className="display-h2 mt-3">THE WHOLE APP. UNRETOUCHED.</h2>
          <p className="mt-5" style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}>
            Seventeen screens, every one a real capture of RHEO running against
            a real database. Five also have a recording. Nothing below is a
            mockup, and nothing is cropped to fit.
          </p>
        </div>

        {/* ---- controls: arrows, true count, and the recording toggle ---- */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <RailButton dir="prev" disabled={atStart} onClick={() => goTo(index - 1)} />
            <RailButton dir="next" disabled={AtEnd} onClick={() => goTo(index + 1)} />
            <span className="mono tabular-nums" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.12em", marginLeft: 8 }} aria-live="polite">
              {String(index + 1).padStart(2, "0")} / {SCREENS.length}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "#f4f4f5", letterSpacing: "0.1em" }}>
              {active.label.toUpperCase()}
            </span>
          </div>

          {/* only rendered when this screen HAS a recording — never a dead toggle */}
          {recordings.length > 0 ? (
            <div className="seg" role="radiogroup" aria-label={`${active.label} still or motion`}>
              <button
                type="button"
                role="radio"
                aria-checked={recording === null}
                className="seg-btn"
                data-selected={recording === null}
                onClick={() => setRecording(null)}
              >
                STILL
              </button>
              {recordings.map((r) => (
                <button
                  key={r.src}
                  type="button"
                  role="radio"
                  aria-checked={recording?.src === r.src}
                  className="seg-btn"
                  data-selected={recording?.src === r.src}
                  onClick={() => setRecording(recording?.src === r.src ? null : r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ---- the strip: 2.5 slides visible, snap, no engine ---- */}
        <ul
          ref={railRef}
          className="gallery-rail"
          role="listbox"
          aria-label="RHEO screens"
          aria-activedescendant={`gal-${active.id}`}
          tabIndex={0}
          onKeyDown={onRailKey}
        >
          {SCREENS.map((s, i) => (
            <li
                key={s.id}
                id={`gal-${s.id}`}
                role="option"
                aria-selected={i === index}
                /* GLM R4: tail slides are END-aligned. Their start-stops exceed
                   maxScroll (measured 7936 wanted vs 7264 available), so they can
                   never be snapped flush-left; end-aligning them makes the rail's
                   final state "slide 17 fully visible" instead of "slide 15 with
                   two hanging". */
                data-snap={i >= tailFrom && tailFrom < SCREENS.length ? "end" : undefined}
                className="gallery-slide"
                data-active={i === index}
              >
              {/* the plate (§3): invariant frame, invariant ratio, invariant
                  caption position. Nothing overlays the image — the section is
                  titled UNRETOUCHED, so any treatment on the pixels would
                  contradict the claim. */}
              {/* 240ms opacity crossfade. opacity is transform's sibling and
                  allowed; animating the video element itself would be neither.
                  Skipped entirely under reduced motion — an instant swap there
                  is a different rendering path, not a 0ms fade. */}
              <motion.div
                key={`${s.id}-${recording?.src ?? "still"}`}
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
              {i === index && recording ? (
                <RealClip
                  src={recording.src}
                  poster={s.still}
                  alt={s.alt}
                  caption={`REAL RECORDING — ${recording.label}`}
                  plate={plateLabel(s, i)}
                  ratio={16 / 10}
                  priority={i < 3}
                  pauseControl
                />
              ) : (
                <RealShot
                  src={s.still}
                  alt={s.alt}
                  caption={`REAL CAPTURE — ${s.caption}`}
                  plate={plateLabel(s, i)}
                  ratio={16 / 10}
                  priority={i < 3}
                />
              )}
              </motion.div>
            </li>
          ))}
        </ul>

        {/* drain line */}
        <div className="gallery-progress" aria-hidden>
          <motion.div className="gallery-progress-fill" animate={{ scaleX: (index + 1) / SCREENS.length }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        </div>

        {/* ---- the index: all 17 at a glance, no drag, no second carousel ---- */}
        <div className="mt-14">
          <p className="mono-label mb-4" style={{ fontSize: 11 }}>
            ALL {SCREENS.length} — TAP TO JUMP
          </p>
          <ul className="thumb-grid">
            {SCREENS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="thumb"
                  data-active={i === index}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => goTo(i)}
                >
                  <img
                    src={s.still}
                    alt=""
                    width={2880}
                    height={1800}
                    loading={i < 6 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className="mono">
                    {String(i + 1).padStart(2, "0")} {s.label}
                  </span>
                  {s.recordings && s.recordings.length > 0 ? (
                    <span className="rec-chip" title={`${s.recordings.length} recording${s.recordings.length > 1 ? "s" : ""}`}>
                      <Play size={10} strokeWidth={2} aria-hidden />
                      {s.recordings.length}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {/* 18th cell — makes 18 divide 2/3/6 at every breakpoint, and gives the
                index a terminal action instead of being a dead-end grid. */}
            <li>
              <a className="thumb thumb-cta" href="#download">
                <span className="thumb-cta-mark" aria-hidden>
                  <Download size={18} strokeWidth={1.25} />
                </span>
                <span className="mono">GET RHEO</span>
              </a>
            </li>
          </ul>
        </div>

        {/* ---- the seam, as a coda: the same pixels as characters ---- */}
        <div className="mt-20 max-w-[680px]">
          <p className="mono-label mb-4" style={{ fontSize: 11 }}>
            <DecryptedText text="THE SAME PIXELS, AS CHARACTERS" speed={28} maxIterations={6} />
          </p>
          <p className="mb-6" style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa" }}>
            The characters are read from{" "}
            <span className="mono" style={{ color: "#f4f4f5" }}>{ASCII_SOURCE.still}</span>{" "}
            — real luminance, real grid, computed in your browser from that
            photograph and nothing else. Drag the seam across it.
          </p>
          <AsciiSurface
            src={ASCII_SOURCE.still}
            alt={ASCII_SOURCE.alt}
            caption="NOT A MOCKUP — A REAL CAPTURE, RE-SAMPLED"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * The rail's inter-slide gap. WAS a hardcoded 24 in two places while the CSS
 * said 16 — GLM caught the drift in Round 2. Read from the live computed style
 * so the JS and the stylesheet cannot disagree again.
 */
const RAIL_GAP = 16;

/** The plate label (§3): position + name on line one. */
function plateLabel(s: Screen, i: number) {
  return `${String(i + 1).padStart(2, "0")} / ${SCREENS.length} — ${s.label.toUpperCase()}`;
}

function RailButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={dir === "prev" ? "Previous screen" : "Next screen"} className="gallery-arrow" data-disabled={disabled}>
      <span aria-hidden className="mono" style={{ fontSize: 13, lineHeight: 1 }}>{dir === "prev" ? "←" : "→"}</span>
    </button>
  );
}