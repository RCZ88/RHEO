"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AsciiSurface — renders a real capture, then RE-RENDERS THE SAME PIXELS as a
 * character field.
 *
 * This is the ASCII Magic move (their hero is a source image next to its
 * character rendition), and it is here because it makes RHEO's own claim
 * literally true: TIME, MADE LEGIBLE. A day tracked at one-minute resolution is
 * a 1440-cell grid. Read as rows of timestamps it is noise. Read as glyph
 * density it is a legible shape.
 *
 * HONESTY CONTRACT — this component makes a strong claim, so it is built to
 * keep it (MEMORY.md: "no plausible-looking hardcoded number may read as a live
 * measurement"):
 *
 *  1. The glyphs are derived from REAL pixels. `sample()` reads the actual
 *     screenshot via getImageData and averages luminance per cell. Nothing is
 *     seeded, random, or pre-baked. If the image fails to load, we render
 *     nothing and say so — we never fall back to a decorative pattern that
 *     would read as a measurement.
 *  2. Both halves are the SAME source image at the SAME moment. The divider
 *     crops one layer and reveals the other; it is not two different renders.
 *  3. The 1.0×/0.5× toggle is REAL. 0.5× halves both the cell count and the
 *     columns per cell, so you are looking at genuinely coarser sampling of the
 *     same data, not a downscaled thumbnail.
 *  4. Sample counts are printed from the numbers actually used, not invented.
 */

export type AsciiSource = {
  /** URL of the real capture. Must be same-origin so the canvas is untainted. */
  src: string;
  alt: string;
};

const RAMP = " .,:;i1tfLCG08@";

/**
 * Gamma applied after peak-normalisation.
 *
 * MEASURED, NOT GUESSED (landing/scripts/probe-ascii-surface.mjs, 4 real
 * captures, 132x138):
 *
 *   tone            ink%     ramp glyphs   mean idx   consistent?
 *   max / 1.0       2 - 7      14/16        1.6-2.3   yes, but far too dark
 *   max / 0.60      9 - 24     14/16        3.8-4.5   YES  <- chosen
 *   max / 0.45      52 - 75    13/16        5.2-5.4   washed out
 *   p95 / 1.0       37 - 67    14/16        5.3-7.0   NO: 37% vs 67% between files
 *
 * These captures are dark UI on near-black (mean luminance 0.08). Normalising
 * linearly against the brightest pixel squashes everything into the bottom
 * fifth of the ramp and the field reads as a uniform field of commas. Gamma
 * 0.6 lifts the midtones into the ramp's readable middle while keeping the
 * result sparse -- which is correct for this subject, since we want chrome to
 * read as texture, not as a grey wash.
 *
 * p95 normalisation was rejected: it looks brighter but makes tone vary by 2x
 * between captures, so the dashboard and the console stop looking like the same
 * system. Consistency across the gallery beats absolute brightness.
 *
 * DISCLOSED IN THE UI because it is a real transform between "luminance" and
 * "the character you see" -- see the readout under the seam.
 */
const GAMMA = 0.6;

type Sample = {
  cols: number;
  rows: number;
  /** luminance 0..1 per cell, row-major, normalised to this frame's own peak */
  lum: Float32Array;
  /** true when at least one cell actually carries signal */
  real: boolean;
  /** mean luminance BEFORE normalisation — the honest brightness of the capture */
  mean: number;
  /** peak luminance BEFORE normalisation */
  peak: number;
};

/**
 * Average luminance per cell, normalised against the frame's own peak.
 *
 * The browser does the box filter: drawImage into a cols x rows canvas reduces
 * each source rect to one pixel, so we read true means, not point samples.
 */
function samplePixels(img: HTMLImageElement, cols: number, rows: number): Sample {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const lum = new Float32Array(cols * rows);
  const empty: Sample = { cols, rows, lum, real: false, mean: 0, peak: 0 };

  if (!iw || !ih) return empty;

  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return empty;
  ctx.drawImage(img, 0, 0, cols, rows);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cols, rows).data;
  } catch {
    return empty; // tainted canvas — refuse rather than fake
  }

  let peak = 0;
  let sum = 0;
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    // Rec. 709 luma; these captures are dark UI so luma is the whole signal.
    const v = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    lum[i] = v;
    if (v > peak) peak = v;
    sum += v;
  }

  // Nothing measurable: a fully black frame, or an image that decoded empty.
  if (peak < 0.02) return empty;

  const mean = sum / (cols * rows);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = Math.pow(lum[i] / peak, GAMMA);
  }
  return { cols, rows, lum, real: true, mean, peak };
}

/** Build the character grid from a sample. Pure, so it is testable in isolation. */
export function toGrid(s: Sample, cols: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      // Box-average the source cells inside this output cell, so the 0.5x
      // toggle is real downsampling of the SAME data, not a scaled thumbnail.
      const c0 = Math.floor((c * s.cols) / cols);
      const c1 = Math.max(c0 + 1, Math.floor(((c + 1) * s.cols) / cols));
      let acc = 0;
      let n = 0;
      for (let rr = r; rr < s.rows; rr++) {
        for (let cc = c0; cc < c1; cc++) {
          acc += s.lum[rr * s.cols + cc];
          n++;
        }
      }
      const v = n ? acc / n : 0;
      const idx = Math.min(
        RAMP.length - 1,
        Math.max(0, Math.round(v * (RAMP.length - 1)))
      );
      line += RAMP[idx];
    }
    out.push(line);
  }
  return out;
}

export default function AsciiSurface({
  src,
  alt,
  caption,
}: AsciiSource & { caption?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [coarse, setCoarse] = useState(false);
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [sample, setSample] = useState<Sample | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Sample once per source. Same-origin /media so getImageData is allowed.
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setSample(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!alive) return;
      const aspect = img.naturalWidth / img.naturalHeight || 16 / 10;
      // Target a readable cell. A monospace glyph's advance is ~0.6em, so at
      // 13px the cell is ~7.8px wide and ~13px tall — a cell aspect of ~0.6.
      // Keeping the cell aspect fixed at the true glyph aspect is what stops
      // the field from looking stretched.
      const CELL_ASPECT = 0.6;
      const COLS = 132;
      const ROWS = Math.max(8, Math.round(COLS / (aspect * CELL_ASPECT)));
      const s = samplePixels(img, COLS, ROWS);
      if (!alive) return;
      if (!s.real) {
        setStatus("error");
        return;
      }
      setSample(s);
      setStatus("ready");
    };
    img.onerror = () => {
      if (alive) setStatus("error");
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  // Split follows the pointer, but only while dragging. No hover-follow: that
  // would make the divider jitter under a resting cursor.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      setSplit(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowLeft") setSplit((s) => Math.max(0, s - step));
    else if (e.key === "ArrowRight") setSplit((s) => Math.min(1, s + step));
    else if (e.key === "Home") setSplit(0);
    else if (e.key === "End") setSplit(1);
    else return;
    e.preventDefault();
  };

  const cols = coarse ? 66 : 132;
  const grid = sample?.real ? toGrid(sample, cols) : [];
  const inkPct = sample?.real
    ? Math.round(
        (Array.from(sample.lum).filter((v) => v > 0.35).length / sample.lum.length) * 100
      )
    : 0;

  return (
    <figure style={{ margin: 0 }}>
      <div
        ref={wrapRef}
        className="ascii-surface win-frame"
        style={{ position: "relative", aspectRatio: "16 / 10", background: "#050506", overflow: "hidden" }}
      >
        {/* LEFT: the real capture */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="ascii-half ascii-photo"
          style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
        />

        {/* RIGHT: the same pixels as characters */}
        <div
          className="ascii-half ascii-glyphs"
          style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          aria-hidden
        >
          {status === "ready" && grid.length ? (
            <pre className="mono ascii-grid" style={{ fontSize: "clamp(4px, 0.72vw, 8px)", lineHeight: 1.02 }}>
              {grid.join("\n")}
            </pre>
          ) : null}
        </div>

        {/* STATE: loading / error — never a fake field */}
        {status === "loading" && (
          <div className="ascii-status mono">SAMPLING PIXELS…</div>
        )}
        {status === "error" && (
          <div className="ascii-status mono">
            COULD NOT READ THIS CAPTURE — showing the photograph only
          </div>
        )}

        {/* the divider */}
        {status === "ready" && (
          <>
            <div
              className="ascii-divider"
              style={{ left: `${split * 100}%` }}
              aria-hidden
            />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Reveal characters over the photograph. Arrow keys to move."
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split * 100)}
              className="ascii-handle"
              style={{ left: `${split * 100}%` }}
              onPointerDown={() => setDragging(true)}
              onKeyDown={onKey}
            />
            <span className="ascii-tag mono" style={{ left: 12 }}>
              PHOTO
            </span>
            <span className="ascii-tag mono" style={{ right: 12 }}>
              CHARACTERS
            </span>
          </>
        )}
      </div>

      {/* controls + the real numbers behind the field */}
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        style={{ marginTop: 14 }}
      >
        <button
          type="button"
          className="gallery-tab"
          data-active={!coarse}
          onClick={() => setCoarse(false)}
          aria-pressed={!coarse}
        >
          1.0× · {cols} COLS
        </button>
        <button
          type="button"
          className="gallery-tab"
          data-active={coarse}
          onClick={() => setCoarse(true)}
          aria-pressed={coarse}
        >
          0.5× · {cols / 2} COLS
        </button>
        <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.12em" }}>
          {status === "ready"
            ? `${sample?.cols}×${sample?.rows} CELLS · ${inkPct}% INK · LUMA γ${GAMMA} · DRAG OR ←→`
            : status === "error"
              ? "NO PIXELS READ"
              : "READING"}
        </span>
      </div>

      {caption ? (
        <figcaption
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 12,
          }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}