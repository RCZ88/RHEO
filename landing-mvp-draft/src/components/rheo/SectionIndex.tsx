"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "manifesto", label: "Observe" },
  { id: "act-record", label: "Record" },
  { id: "capabilities", label: "Capabilities" },
  { id: "gallery", label: "Gallery" },
  { id: "understand", label: "Understand" },
  { id: "learn", label: "Learn" },
  { id: "design", label: "Design" },
  { id: "principles", label: "Why RHEO" },
  { id: "compare", label: "Compare" },
  { id: "testimonials", label: "Quotes" },
  { id: "flow", label: "Flow" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
  { id: "download", label: "Download" },
];

const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R; // circumference

export default function SectionIndex() {
  const [active, setActive] = useState("hero");
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    // reading progress via scroll
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      setProgress(Math.max(0, Math.min(1, p)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const activeIdx = SECTIONS.findIndex((s) => s.id === active);
  const pct = Math.round(progress * 100);

  return (
    <nav className="section-index-sidebar" aria-label="Section index">
      {/* reading-progress ring */}
      <div className="si-ring-wrap" title={`Reading progress · ${pct}%`}>
        <svg width="28" height="28" aria-hidden>
          <circle className="si-ring-track" cx="14" cy="14" r={RING_R} />
          <circle
            className="si-ring-progress"
            cx="14"
            cy="14"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
          />
        </svg>
        <span className="si-ring-label">{String(pct).padStart(2, "0")}</span>
      </div>

      {/* divider */}
      <span
        aria-hidden
        style={{
          width: 18,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          marginBottom: 10,
        }}
      />

      {SECTIONS.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="si-dot"
          data-active={active === s.id}
          aria-label={`Jump to ${s.label}${active === s.id ? " (current)" : ""}`}
          aria-current={active === s.id ? "true" : undefined}
        >
          <span className="si-dot-mark" />
          <span className="si-dot-label">
            <span style={{ color: "#63636b" }}>{String(i + 1).padStart(2, "0")}</span>{" "}
            {s.label}
          </span>
        </a>
      ))}

      {/* reading-time estimate */}
      <span
        aria-hidden
        style={{
          width: 18,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          marginTop: 10,
          marginBottom: 4,
        }}
      />
      <span className="si-reading-time" title="Estimated reading time">
        ~{Math.max(1, Math.round(progress * 8))} min
      </span>
    </nav>
  );
}
