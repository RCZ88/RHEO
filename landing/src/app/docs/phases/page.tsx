// src/app/docs/phases/page.tsx
export const metadata = { title: "Phases — RHEO docs" };

export default function PhasesPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>PHASES</p>
      <h1 className="display-h2 mt-3">HOW A PHASE IS DETECTED.</h1>

      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa", marginTop: 16 }}>
        Phases are set by you. RHEO does not guess them.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Two modes
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.7, color: "#a1a1aa", marginLeft: 20, listStyle: "disc" }}>
        <li><strong style={{ color: "#f4f4f5" }}>Learn.</strong> New material allowed, up to 2 new topics a day, with a 10-minute review floor.</li>
        <li><strong style={{ color: "#f4f4f5" }}>Burn-down.</strong> No new material, with a 20-minute review floor. Asks you to clear the review queue first.</li>
      </ul>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Drift detection
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        A drift check is written to notice when you start working on new material during
        burn-down. In v0.2.0 it is switched off, so RHEO never changes your mode on its own.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#8a8a94", marginTop: 8 }}>
        The detector is conservative by design: it needs a pattern across at least 3 days,
        with 60% or more of recent work being new material, and 3 consecutive days with
        new work. It runs entirely on your machine. No AI, no network.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Note on naming
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#8a8a94" }}>
        "Phase" means three different things in RHEO: a life era you set on the Life
        screen, the Learn/Burn-down training mode, and the time blocks shown in the
        "A Day, Replayable" section. The last one is a labelled sample day, not a
        detected phase.
      </p>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}