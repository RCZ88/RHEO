"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** caption drawn from the atlas instrument copy — the 180 words that used to
   *  be their own section now sit next to the thing they describe */
  caption: string;
  recordings?: Recording[];
};

const SCREENS: Screen[] = [
  { id: "dashboard", label: "Dashboard", still: "/media/app-dashboard.png", alt: "The RHEO dashboard with a real day's tracked time", caption: "The whole day on one surface — depth, not duration.", recordings: [{ src: "/media/app-dashboard-idle.mp4", label: "IDLE" }, { src: "/media/app-timeline-24h.mp4", label: "24H TIMELINE" }] },
  { id: "console", label: "Penguin Console", still: "/media/app-console.png", alt: "Penguin Console running real commands in a real shell", caption: "A real PTY. Real commands, real output, no wrapper.", recordings: [{ src: "/media/app-terminal-real.mp4", label: "PTY" }, { src: "/media/app-terminal-work.mp4", label: "REAL WORK" }] },
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
const ASCII_SOURCE = SCREENS[0];

export default function Gallery() {
  const railRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [AtEnd, setAtEnd] = useState(false);
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
    const step = slide.offsetWidth + 24;
    const i = Math.max(0, Math.min(SCREENS.length - 1, Math.round(rail.scrollLeft / step)));
    if (i !== index) {
      setIndex(i);
      // never land on a new screen mid-recording
      setRecording(null);
    }
    setAtStart(rail.scrollLeft <= 8);
    setAtEnd(rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 8);
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
    rail.scrollTo({
      left: clamped * (slide.offsetWidth + 24),
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
            <li key={s.id} id={`gal-${s.id}`} role="option" aria-selected={i === index} className="gallery-slide" data-active={i === index}>
              {i === index && recording ? (
                <RealClip
                  src={recording.src}
                  poster={s.still}
                  alt={s.alt}
                  caption={`REAL CAPTURE — ${recording.label}`}
                  ratio={16 / 10}
                  pauseControl
                />
              ) : (
                <RealShot src={s.still} alt={s.alt} caption={s.caption} ratio={16 / 10} />
              )}
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
                  <img src={s.still} alt={s.label} loading="lazy" decoding="async" />
                  <span className="mono">{s.label}</span>
                  {s.recordings ? <span className="thumb-dot" aria-label="has a recording" /> : null}
                </button>
              </li>
            ))}
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

function RailButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={dir === "prev" ? "Previous screen" : "Next screen"} className="gallery-arrow" data-disabled={disabled}>
      <span aria-hidden className="mono" style={{ fontSize: 13, lineHeight: 1 }}>{dir === "prev" ? "←" : "→"}</span>
    </button>
  );
}