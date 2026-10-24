"use client";

import FlowFieldCanvas from "./FlowFieldCanvas";
import DecryptedText from "./DecryptedText";
import SessionClock from "./SessionClock";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden surface-page"
      style={{ height: "100dvh", minHeight: 600 }}
    >
      {/* ASCII flow field */}
      <FlowFieldCanvas />

      {/* ambient corner marks (instrument-frame feel) */}
      <div className="corner-marks" aria-hidden>
        <span className="corner-mark corner-mark-tl" />
        <span className="corner-mark corner-mark-tr" />
        <span className="corner-mark corner-mark-bl" />
        <span className="corner-mark corner-mark-br" />
      </div>

      {/* subtle vignette so foreground text stays legible */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 20% 50%, rgba(5,5,6,0.65), rgba(5,5,6,0.2) 45%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* foreground content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <p
          className="mono-label mb-6 hero-enter hero-enter--kicker"
          style={{ fontSize: 11, color: "#8a8a94" }}
        >
          <DecryptedText text="RHEO — ῥέω · GREEK: TO FLOW" speed={28} maxIterations={6} />
        </p>

        <h1 className="display-h1 hero-enter">
          TIME,
          <br />
          MADE LEGIBLE.
        </h1>

        {/* THE PLAIN SENTENCE. The manifesto below is the emotional spine and it
            is good, but it does not tell a first-time visitor what the product
            IS. This is the sentence that does, and every clause is checkable:
              "private"               -> 0 analytics code, verified by grep over
                                          main, preload and renderer
              "which apps you use"    -> src/main.ts:5121-5132 writes `logs` and
                                          `browser_sessions` from the tracking poll
              "your own data folder"  -> deliberately NOT "one file". WAL mode
                                          (src/main.ts:27306) puts the record in
                                          three files, so the precise claim is the
                                          Ledger's, not this paragraph's
              "ask questions"         -> real, and conditional on a provider,
                                          which the Proof section states plainly
            Written here rather than pulled from the copy deck for exactly that
            reason: it had to survive being checked. */}
        <p
          className="mt-8 hero-enter hero-enter--manifesto"
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "#f4f4f5",
            maxWidth: 560,
          }}
        >
          RHEO is a private time tracker for your desktop. It records which apps
          you use, keeps the record in your own data folder, and lets you ask
          questions about it.
        </p>

        <p
          className="mt-6 hero-enter hero-enter--manifesto"
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "#a1a1aa",
            maxWidth: 560,
          }}
        >
            Your hours are the only currency you can never earn back. RHEO
            records how they flow — so every phase of your life can be seen,
            questioned, and improved.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3 hero-enter hero-enter--ctas">
          {/* R2 — ORDER MATTERS, not styling. The carousel is the main thing, and
              this is the one element every visitor sees. Download is ghosted because
              there are no real binaries and no real checksums yet, so it cannot be
              the hero's promise until it fully delivers. "See the method" is GONE:
              its destination is the next scroll position, and a CTA that duplicates
              the scroll wheel is noise. Reversal condition: when real installers with
              real SHA-256 ship, download-primary becomes defensible again. */}

          {/* PRIMARY — the evidence */}
          <a
            href="#gallery"
            className="btn-sheen inline-flex items-center justify-center"
            style={{
              background: "#ffffff",
              color: "#050506",
              borderRadius: 6,
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            <span className="mono" style={{ fontWeight: 500, fontSize: 13 }}>
              See all 17 screens, untouched ↓
            </span>
            <span aria-hidden className="btn-sheen-sweep" />
          </a>

        </div>

      </div>

      {/* right half — real screenshot, unretouched. The hero was left with an empty
          right side; putting a real capture here closes the dead space and keeps the
          "unretouched" claim first thing. */}
      <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-6 w-[42%] z-5">
        <div
          className="relative"
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          <img
            src="/media/app-dashboard.png"
            alt="The RHEO dashboard — a real day's tracked time, unretouched."
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
      </div>

      {/* bottom edge live line */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-5 sm:px-10 lg:px-16 hero-enter"
        style={{ paddingBottom: 18, animationDelay: "1.2s" }}
      >
        <div
          className="flex items-center gap-3 max-w-[1280px] mx-auto"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="mono" style={{ fontSize: 11, color: "#8a8a94", paddingTop: 8 }}>
            <span className="blink-cursor" style={{ color: "#ffffff" }}>▍</span>{" "}
            <span style={{ color: "#a1a1aa" }}>tracking</span>
            <span style={{ color: "#8a8a94" }}> · </span>
            {/* R3: real elapsed time on THIS page. Was a hard-coded 1,204,032 that
                ticked up forever — a fabricated measurement on a page whose brand is
                that its labels are true. */}
            <SessionClock />
            <span style={{ color: "#a1a1aa" }}> on this page</span>
            <span style={{ color: "#8a8a94" }}> · </span>
            {/* R1: the privacy claim lands here because this is the only hero element
                whose register is an INSTRUMENT READOUT — and it is now checkable, so
                it can be a fact rather than a promise. `field: laminar` was removed:
                the flow field is already visible, so labelling it encoded nothing. */}
            {/* The hero line is now "no analytics on this page" instead of
                the old hero line, because it was unprovable. Fonts
                are self-hosted via next/font/local (src/app/layout.tsx:2), so
                even the type is not a CDN request. */}
            <span style={{ color: "#f4f4f5" }}>no analytics on this page</span>
          </span>
        </div>
      </div>
    </section>
  );
}
