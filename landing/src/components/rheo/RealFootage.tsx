"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RealFootage — renders ACTUAL captures of the RHEO app.
 *
 * Every asset under /media/ is a real screenshot or a real screen recording of
 * a running RHEO instance backed by a real SQLite database. Nothing here is a
 * mock, a hand-drawn SVG, or an animation standing in for the product.
 *
 * Frame styling reuses the `.win-frame` class already defined in globals.css
 * (background #0a0a0c, 1px rgba(255,255,255,0.16), radius 10) so these sit in
 * the same visual system as every other panel instead of inventing a new frame.
 */

type Base = {
  src: string;
  alt: string;
  /** Caption rendered under the frame. Use one that states what is on screen. */
  caption?: string;
  /**
   * The plate label (§3): "03 / 17 — DASHBOARD". Rendered as the FIRST line of
   * the caption block, above `caption`. It is what makes a slide announce its
   * own position to a screen reader and to the eye without a separate overlay —
   * an overlay on the image would contradict the section's UNRETOUCHED claim.
   */
  plate?: string;
  className?: string;
  /**
   * Box the media to this aspect ratio. Every capture is 16:10, so this is the
   * default. Set to null to let the media size itself (use in a wide band).
   */
  ratio?: number | null;
  /**
   * Native capture dimensions, emitted as width/height attributes. RESULT.md
   * §3.5: without these the frame has no reserved space and every slide shifts
   * the page as it loads. Every capture in public/media is 2880x1800.
   */
  width?: number;
  height?: number;
  /** load eagerly. RESULT.md §3.5: the first three slides only — the other 14
   *  are lazy so the strip does not pull 18 MB on first paint. */
  priority?: boolean;
};

/** A real screenshot. */
export function RealShot({ src, alt, caption, plate, className = "", ratio = 16 / 10, width = 2880, height = 1800, priority = false }: Base) {
  const frame: React.CSSProperties = ratio
    ? { background: "#050506", aspectRatio: String(ratio) }
    : { background: "#050506" };
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div className="win-frame" style={frame}>
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          style={{
            display: "block",
            width: "100%",
            height: ratio ? "100%" : "auto",
            objectFit: ratio ? "cover" : "contain",
          }}
        />
      </div>
      {caption || plate ? (
        <figcaption
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 18,
          }}
        >
          {plate ? <span style={{ display: "block", color: "#f4f4f5" }}>{plate}</span> : null}
          {caption ? <span style={{ display: "block" }}>{caption}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A real screen recording.
 *
 * Plays on intersection (never scroll-scrubbed — the design spec requires motion
 * to be a pure function of progress, and scrubbing a video would fight that),
 * loops so the section stays alive, and does NOT autoplay when the visitor has
 * asked for reduced motion.
 */
export function RealClip({
  src,
  alt,
  caption,
  plate,
  poster,
  className = "",
  ratio,
  width = 2880,
  height = 1800,
  /**
   * Show a play/pause control. WCAG 2.2.2: any media that moves for more than
   * 5 seconds must offer a way to stop it. Default OFF because the loops that
   * autoplay on intersection are decorative and generally paired with a static
   * alternative somewhere else on the page.
   */
  pauseControl = false,
}: Base & { poster?: string; pauseControl?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // A user-paused video must STAY paused even if it scrolls back into view,
  // otherwise the IntersectionObserver autoplay overrides the user's decision.
  useEffect(() => {
    const el = ref.current;
    const video = videoRef.current;
    // `reduced` starts false and flips true in a post-mount effect, so a clip
    // can already be playing by the time it is set. Returning early here only
    // prevents the NEXT autoplay; it never stops the current one. Measured
    // under `prefers-reduced-motion: reduce`: currentTime 0.27 -> 1.78 -> 3.28.
    if (reduced && video && !video.paused) {
      video.pause();
      setPaused(true);
      return;
    }
    if (!el || !video || reduced || paused) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, paused]);

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        ref={ref}
        className="win-frame"
        style={ratio ? { background: "#050506", aspectRatio: String(ratio) } : { background: "#050506" }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          aria-label={alt}
          muted
          loop
          playsInline
          preload="metadata"
          style={{
            display: "block",
            width: "100%",
            height: ratio ? "100%" : "auto",
            objectFit: ratio ? "cover" : "contain",
          }}
        />
      </div>
      {caption || plate || pauseControl ? (
        <figcaption
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
            {/* plate label sits ABOVE the claim (§3 two-line plate) */}
            {plate ? (
              <span style={{ display: "block", color: "#f4f4f5", marginRight: "auto" }}>
                {plate}
              </span>
            ) : null}
            {caption ? <span>{caption}</span> : null}
          {pauseControl ? (
            <button
              type="button"
              className="clip-pause"
              aria-label={paused ? `Play ${alt}` : `Pause ${alt}`}
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) {
                  void v.play().catch(() => {});
                  setPaused(false);
                } else {
                  v.pause();
                  setPaused(true);
                }
              }}
            >
              {paused ? "PLAY" : "PAUSE"}
            </button>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}