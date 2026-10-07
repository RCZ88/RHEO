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
  className?: string;
  /**
   * Box the media to this aspect ratio. Every capture is 16:10, so this is the
   * default. Set to null to let the media size itself (use in a wide band).
   */
  ratio?: number | null;
};

/** A real screenshot. */
export function RealShot({ src, alt, caption, className = "", ratio = 16 / 10 }: Base) {
  const frame: React.CSSProperties = ratio
    ? { background: "#050506", aspectRatio: String(ratio) }
    : { background: "#050506" };
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div className="win-frame" style={frame}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            display: "block",
            width: "100%",
            height: ratio ? "100%" : "auto",
            objectFit: ratio ? "cover" : "contain",
          }}
        />
      </div>
      {caption ? (
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
          {caption}
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
  poster,
  className = "",
  ratio,
}: Base & { poster?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const video = videoRef.current;
    if (!el || !video || reduced) return;
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
  }, [reduced]);

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
      {caption ? (
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
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}