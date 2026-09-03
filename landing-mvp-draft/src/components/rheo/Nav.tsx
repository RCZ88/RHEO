"use client";

import { motion, AnimatePresence, useScroll, useSpring, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import NavClock from "./NavClock";

const LINKS = [
  { label: "PRODUCT", href: "#hero" },
  { label: "METHOD", href: "#act-record" },
  { label: "DOWNLOAD", href: "#download" },
];

const SECTION_IDS = ["hero", "manifesto", "act-record", "capabilities", "gallery", "understand", "learn", "design", "principles", "compare", "testimonials", "flow", "pricing", "faq", "download"];

export default function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  // glass after 40px
  const bg = useTransform(scrollY, [0, 40], ["rgba(5,5,6,0)", "rgba(5,5,6,0.6)"]);
  const blur = useTransform(scrollY, [0, 40], ["blur(0px)", "blur(14px)"]);
  const borderOpacity = useTransform(
    scrollY,
    [0, 40],
    ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"]
  );
  // top scroll-progress bar
  const progressScaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    mass: 0.3,
  });

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("hero");

  useEffect(() => {
    return scrollY.on("change", (v) => setScrolled(v > 40));
  }, [scrollY]);

  // active section tracking via IntersectionObserver
  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // pick the entry most in view
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      {/* top scroll-progress bar */}
      <motion.div
        className="scroll-progress"
        aria-hidden
        style={{ scaleX: progressScaleX, width: "100%" }}
      />
      <motion.header
        className="fixed top-0 left-0 right-0 z-[9000]"
        style={{
          background: bg,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          borderBottom: "1px solid",
          borderBottomColor: borderOpacity,
        }}
      >
        <nav className="flex items-center justify-between px-5 sm:px-8 h-14">
          <a
            href="#hero"
            className="mono font-medium text-[13px] text-[#f4f4f5] hover:text-white transition-colors"
            style={{ letterSpacing: "0.14em" }}
            aria-label="RHEO — back to top"
          >
            RHEO
          </a>

          {/* desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {LINKS.map((l) => {
              const isActive = active === l.href.replace("#", "");
              return (
                <a
                  key={l.label}
                  href={l.href}
                  className="mono-label transition-colors relative"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: isActive
                      ? "#f4f4f5"
                      : scrolled
                      ? "#a1a1aa"
                      : "#63636b",
                  }}
                >
                  {l.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -bottom-1 left-0 right-0 h-px"
                      style={{ background: "#ffffff" }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          {/* ambient clock (desktop only) + kbd hint + mobile hamburger */}
          <div className="flex items-center gap-3">
            <NavClock />
            <button
              type="button"
              className="nav-kbd-hint"
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                    cancelable: true,
                  })
                )
              }
              aria-label="Open command palette"
              title="Command palette · ⌘K"
            >
              <span>⌘</span>
              <span>K</span>
            </button>
            <button
              type="button"
              className="md:hidden flex items-center justify-center"
              style={{ width: 40, height: 40, color: "#f4f4f5" }}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </motion.header>

      {/* mobile menu drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col" style={{ padding: "8px 20px 20px" }}>
              {LINKS.map((l, i) => (
                <motion.a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.06 * i,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="mono-label"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.16em",
                    color: "#a1a1aa",
                    padding: "14px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {l.label}
                </motion.a>
              ))}
              <a
                href="#download"
                onClick={() => setMenuOpen(false)}
                className="btn-sheen inline-flex items-center justify-center mt-5"
                style={{
                  background: "#ffffff",
                  color: "#050506",
                  borderRadius: 6,
                  padding: "14px 18px",
                }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.04em" }}>
                  DOWNLOAD RHEO
                </span>
                <span aria-hidden className="btn-sheen-sweep" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
