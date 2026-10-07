"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import AsciiSurface from "./AsciiSurface";
import DecryptedText from "./DecryptedText";
import { RealClip, RealShot } from "./RealFootage";

/**
 * Gallery — every surface of RHEO, as actually captured.
 *
 * NAVIGATION: this used to be 24 text chips in a wrapping row, which had three
 * real failures — no indication of position or how many there were, 24 equal
 * weights so the 3 that matter looked like the 21 that didn't, and no
 * affordance that the panel below changes on click.
 *
 * It is now a USER-DRIVEN FILMSTRIP. Deliberately not an autoplay carousel:
 * content that moves automatically for more than 5s without a pause control is
 * a WCAG 2.2.2 failure, and it hides 23 of 24 items behind a timer nobody
 * asked for. Scroll-snap with ~2.5 slides visible keeps the set legible as a
 * set (you can see there is more to the right), which is the thing a
 * one-slide-at-a-time carousel destroys.
 *
 * The ASCII surface is a separate, labelled moment rather than an overlay on
 * every slide: this section's claim is "nothing here is a mockup," and
 * decorating the evidence would undercut it. See AsciiSurface.tsx.
 *
 * Captures come from `landing/docs/APP_MEDIA_CAPTURE_GUIDE.md`.
 */

type Entry = {
  id: string;
  label: string;
  src: string;
  poster?: string;
  alt: string;
  kind: "shot" | "clip";
};

const ENTRIES: Entry[] = [
  { id: "dashboard", label: "Dashboard", src: "/media/app-dashboard.png", alt: "The RHEO dashboard with a real day's tracked time", kind: "shot" },
  { id: "console", label: "Penguin Console", src: "/media/app-console.png", alt: "Penguin Console running real commands in a real shell", kind: "shot" },
  { id: "activity", label: "Activity", src: "/media/app-activity.png", alt: "The raw record behind the timeline", kind: "shot" },
  { id: "insights", label: "Insights", src: "/media/app-insights.png", alt: "Insights showing real productive, neutral and distracting totals", kind: "shot" },
  { id: "life", label: "Life", src: "/media/app-life.png", alt: "The Life page with a real week", kind: "shot" },
  { id: "ai", label: "AI Assistant", src: "/media/app-ai.png", alt: "The AI Assistant querying a real tracked record", kind: "shot" },
  { id: "learn", label: "Lyceum", src: "/media/app-learn.png", alt: "A lesson open in Lyceum", kind: "shot" },
  { id: "finance", label: "Finance", src: "/media/app-finance.png", alt: "The Finance page with real transactions", kind: "shot" },
  { id: "ide", label: "IDE Projects", src: "/media/app-ide.png", alt: "IDE Projects tracking real work", kind: "shot" },
  { id: "database", label: "Database", src: "/media/app-database.png", alt: "The local-first database browser", kind: "shot" },
  { id: "rankings", label: "Rankings", src: "/media/app-rankings.png", alt: "Rankings computed from the real record", kind: "shot" },
  { id: "labs", label: "Labs", src: "/media/app-labs.png", alt: "Labs, the experimental surface", kind: "shot" },
  { id: "studio", label: "Content Engine", src: "/media/app-studio.png", alt: "The Overlay Studio content engine", kind: "shot" },
  { id: "guide", label: "Guide", src: "/media/app-guide.png", alt: "The in-app Guide", kind: "shot" },
  { id: "settings", label: "Settings", src: "/media/app-settings.png", alt: "Settings", kind: "shot" },
  { id: "lecture", label: "Lecture", src: "/media/app-lecture.png", alt: "Lecture mode", kind: "shot" },
  { id: "profiler", label: "Profiler", src: "/media/app-profiler.png", alt: "The in-app performance profiler", kind: "shot" },
  { id: "v-dash", label: "▶ Dashboard", src: "/media/app-dashboard-idle.mp4", poster: "/media/app-dashboard.png", alt: "The dashboard running live", kind: "clip" },
  { id: "v-timeline", label: "▶ 24h timeline", src: "/media/app-timeline-24h.mp4", poster: "/media/app-dashboard.png", alt: "The 24 hour timeline filling in", kind: "clip" },
  { id: "v-term", label: "▶ Terminal", src: "/media/app-terminal-real.mp4", poster: "/media/app-console.png", alt: "A real PTY producing real output", kind: "clip" },
  { id: "v-work", label: "▶ Real work", src: "/media/app-terminal-work.mp4", poster: "/media/app-console.png", alt: "Real git operations in a real shell", kind: "clip" },
  { id: "v-life", label: "▶ Life", src: "/media/app-life-week.mp4", poster: "/media/app-life.png", alt: "The Life week view", kind: "clip" },
  { id: "v-insights", label: "▶ Insights", src: "/media/app-insights-detail.mp4", poster: "/media/app-insights.png", alt: "Insights detail", kind: "clip" },
  { id: "v-db", label: "▶ Database", src: "/media/app-database-scroll.mp4", poster: "/media/app-database.png", alt: "Scrolling the local database", kind: "clip" },
];

/** The one capture shown as characters. The dashboard, because it is the densest. */
const ASCII_ENTRY = ENTRIES[0];

export default function Gallery() {
  const railRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * Position comes from the rail's real scrollLeft, not from click bookkeeping.
   * Anything else desyncs the moment the user drags, uses a trackpad, or
   * resizes — the readout would claim a slide the viewport isn't showing.
   */
  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + 24; // gap-6
    const i = Math.round(rail.scrollLeft / step);
    setIndex(Math.max(0, Math.min(ENTRIES.length - 1, i)));
    setAtStart(rail.scrollLeft <= 8);
    setAtEnd(rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 8);
  }, []);

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
    const clamped = Math.max(0, Math.min(ENTRIES.length - 1, i));
    const step = slide.offsetWidth + 24;
    rail.scrollTo({
      left: clamped * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    setIndex(clamped);
  }, []);

  const onRailKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      goTo(index + 1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      goTo(index - 1);
      e.preventDefault();
    } else if (e.key === "Home") {
      goTo(0);
      e.preventDefault();
    } else if (e.key === "End") {
      goTo(ENTRIES.length - 1);
      e.preventDefault();
    }
  };

  return (
    <section id="gallery" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 05 / EVERY SURFACE" speed={28} maxIterations={6} />
          </p>
          <h2 className="display-h2 mt-3">THE WHOLE APP. UNRETOUCHED.</h2>
          <p className="mt-5" style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}>
            Every frame below is a real capture of RHEO running against a real
            database — your own hours, not a mock. Scroll, or use the arrows.
          </p>
        </div>

        {/* rail + position readout */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <RailButton dir="prev" disabled={atStart} onClick={() => goTo(index - 1)} />
            <RailButton dir="next" disabled={atEnd} onClick={() => goTo(index + 1)} />
            <span
              className="mono tabular-nums"
              style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.12em", marginLeft: 8 }}
              aria-live="polite"
            >
              {String(index + 1).padStart(2, "0")} / {ENTRIES.length}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "#f4f4f5", letterSpacing: "0.1em" }}>
              {ENTRIES[index].label}
            </span>
          </div>
          <span className="mono hidden sm:block" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.12em" }}>
            DRAG · SCROLL · ← →
          </span>
        </div>

        {/* the filmstrip */}
        <ul
          ref={railRef}
          className="gallery-rail"
          role="listbox"
          aria-label="RHEO surfaces"
          aria-activedescendant={`gal-${ENTRIES[index].id}`}
          tabIndex={0}
          onKeyDown={onRailKey}
        >
          {ENTRIES.map((e, i) => (
            <li
              key={e.id}
              id={`gal-${e.id}`}
              role="option"
              aria-selected={i === index}
              className="gallery-slide"
              data-active={i === index}
            >
              {e.kind === "clip" ? (
                <RealClip
                  src={e.src}
                  poster={e.poster}
                  alt={e.alt}
                  caption={`REAL CAPTURE — ${e.label.replace("▶ ", "")}`}
                  ratio={16 / 10}
                />
              ) : (
                <RealShot src={e.src} alt={e.alt} caption="REAL CAPTURE" ratio={16 / 10} />
              )}
            </li>
          ))}
        </ul>

        {/* scroll hint: a hairline that drains as you move through the rail */}
        <div className="gallery-progress" aria-hidden>
          <motion.div
            className="gallery-progress-fill"
            animate={{ scaleX: (index + 1) / ENTRIES.length }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* ---- the ASCII moment, labelled as a distinct beat ---- */}
        <div className="mt-24 sm:mt-32">
          <div className="max-w-[680px] mb-8">
            <p className="mono-label" style={{ fontSize: 11 }}>
              <DecryptedText text="THE SAME PIXELS, AS CHARACTERS" speed={28} maxIterations={6} />
            </p>
            <p className="mt-4" style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa" }}>
              Time made legible is the whole claim, so here it is literally. The
              characters on the right are read from{" "}
              <span className="mono" style={{ color: "#f4f4f5" }}>
                {ASCII_ENTRY.src}
              </span>{" "}
              — real luminance, real grid, computed in your browser from that
              photograph and nothing else. Drag the seam across it.
            </p>
          </div>
          <AsciiSurface
            src={ASCII_ENTRY.src}
            alt={ASCII_ENTRY.alt}
            caption="NOT A MOCKUP — A REAL CAPTURE, RE-SAMPLED"
          />
        </div>
      </div>
    </section>
  );
}

function RailButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous capture" : "Next capture"}
      className="gallery-arrow"
      data-disabled={disabled}
    >
      <span aria-hidden className="mono" style={{ fontSize: 13, lineHeight: 1 }}>
        {dir === "prev" ? "←" : "→"}
      </span>
    </button>
  );
}