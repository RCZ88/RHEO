"use client";

import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "manifesto", label: "Observe" },
  { id: "act-record", label: "Record" },
  { id: "capabilities", label: "Capabilities" },
  { id: "understand", label: "Understand" },
  { id: "learn", label: "Learn" },
  { id: "atlas", label: "Atlas" },
  { id: "flow", label: "Flow" },
  { id: "gallery", label: "Surfaces" },
  { id: "instruments", label: "Ring" },
  { id: "download", label: "Download" },
];

const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R;

export default function SectionIndex() {
  const [active, setActive] = useState("hero");
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  // per-dot spring offset toward the cursor (x along the sidebar axis = vertical)
  const dotEls = useRef<(HTMLAnchorElement | null)[]>([]);
  // spring state for each dot
  const springs = useRef(
    SECTIONS.map(() => ({ cur: 0, target: 0, raf: 0 as number }))
  );

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

  // cursor proximity: pull a dot ≤4px toward the cursor (spring ~200/25)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const onMove = (e: PointerEvent | MouseEvent) => {
      const mx = e.clientX;
      const my = e.clientY;
      for (let i = 0; i < SECTIONS.length; i++) {
        const el = dotEls.current[i];
        if (!el) continue;
        // use the MARK element's position (not the full <a> which includes
        // the invisible label and inflates the bounding rect width)
        const mark = el.querySelector(".si-dot-mark") as HTMLElement | null;
        const target = mark || el;
        const r = target.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 24) {
          // within 24px → pull toward cursor along X, capped at 8px
          const k = 1 - dist / 24;
          springs.current[i].target = Math.max(-8, Math.min(8, dx * k * 0.5));
        } else {
          springs.current[i].target = 0;
        }
        ensureSpring(i);
      }
    };
    const onLeave = () => {
      for (let i = 0; i < SECTIONS.length; i++) {
        springs.current[i].target = 0;
        ensureSpring(i);
      }
    };

    // spring a single dot toward its target (stiffness ~200, damping ~25)
    function ensureSpring(i: number) {
      const s = springs.current[i];
      if (s.raf) return;
      const tick = () => {
        const force = (s.target - s.cur) * 0.2;
        s.cur += force;
        if (Math.abs(s.target - s.cur) < 0.05 && Math.abs(force) < 0.05) {
          s.cur = s.target;
          const el = dotEls.current[i];
          if (el) el.style.setProperty("--pull", `${s.cur.toFixed(2)}px`);
          s.raf = 0;
          return;
        }
        const el = dotEls.current[i];
        if (el) el.style.setProperty("--pull", `${s.cur.toFixed(2)}px`);
        s.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove as EventListener, { passive: true });
    window.addEventListener("mousemove", onMove as EventListener, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("mousemove", onMove as EventListener);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      springs.current.forEach((s) => cancelAnimationFrame(s.raf));
    };
  }, []);

  const pct = Math.round(progress * 100);

  return (
    <nav
      ref={navRef}
      className="section-index-sidebar"
      aria-label="Section index"
    >
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
          ref={(el) => {
            dotEls.current[i] = el;
          }}
          href={`#${s.id}`}
          className="si-dot"
          data-active={active === s.id}
          aria-label={`Jump to ${s.label}${active === s.id ? " (current)" : ""}`}
          aria-current={active === s.id ? "true" : undefined}
          style={{ ["--pull" as string]: "0px" }}
          onClick={(e) => {
            // smooth-scroll to section (anchor jump respects scroll-margin-top)
            e.preventDefault();
            document
              .getElementById(s.id)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span
            className="si-dot-mark"
            style={{ transform: "translateX(var(--pull,0px))" }}
          />
          <span className="si-dot-label">
            <span style={{ color: "#8a8a94" }}>
              {String(i + 1).padStart(2, "0")}
            </span>{" "}
            {s.label}
          </span>
        </a>
      ))}

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
