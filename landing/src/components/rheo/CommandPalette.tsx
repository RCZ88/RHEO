"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Moon,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  group: "JUMP" | "ACTIONS";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

const SECTIONS = [
  { id: "hero", label: "Hero — Time, made legible" },
  { id: "manifesto", label: "Manifesto — Observe" },
  { id: "act-record", label: "Act II — Record" },
  { id: "capabilities", label: "Capabilities" },
  { id: "understand", label: "Act III — Understand" },
  { id: "learn", label: "Act IV — Learn" },
  { id: "atlas", label: "The Atlas" },
  { id: "flow", label: "Act V — Flow" },
  { id: "download", label: "Download" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // open on Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // reset on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const jump: Item[] = SECTIONS.map((s) => ({
      id: `jump-${s.id}`,
      group: "JUMP",
      label: s.label,
      hint: "↵",
      icon: <ArrowDown size={14} strokeWidth={1.5} />,
      run: () => {
        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
        setOpen(false);
      },
    }));
    const actions: Item[] = [
      {
        id: "act-top",
        group: "ACTIONS",
        label: "Scroll to top",
        hint: "↵",
        icon: <ArrowUp size={14} strokeWidth={1.5} />,
        run: () => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setOpen(false);
        },
      },
      {
        id: "act-download",
        group: "ACTIONS",
        label: "Go to download",
        hint: "↵",
        icon: <Download size={14} strokeWidth={1.5} />,
        run: () => {
          document.getElementById("download")?.scrollIntoView({ behavior: "smooth" });
          setOpen(false);
        },
      },
      {
        id: "act-changelog",
        group: "ACTIONS",
        label: "Open changelog",
        hint: "↵",
        icon: <FileText size={14} strokeWidth={1.5} />,
        run: () => {
          window.dispatchEvent(new CustomEvent("rheo:open-changelog"));
          setOpen(false);
        },
      },
      {
        id: "act-reduce",
        group: "ACTIONS",
        label: "Reduce motion (open OS setting)",
        hint: "↵",
        icon: <Moon size={14} strokeWidth={1.5} />,
        run: () => {
          // informational only — can't toggle OS pref from JS
          setOpen(false);
        },
      },
    ];
    return [...jump, ...actions];
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q) || it.group.toLowerCase().includes(q));
  }, [items, query]);

  // clamp active into range during render (no effect needed)
  const safeActive = Math.min(active, Math.max(0, filtered.length - 1));

  // arrow nav
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, (a >= filtered.length ? 0 : a) + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, (a >= filtered.length ? 0 : a) - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[safeActive]?.run();
    }
  };

  // group filtered items
  const groups = useMemo(() => {
    const g: Record<string, Item[]> = {};
    filtered.forEach((it) => {
      (g[it.group] = g[it.group] || []).push(it);
    });
    return g;
  }, [filtered]);

  // flat index for active tracking
  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ scale: 0.97, y: -8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="cmdk-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <Search size={16} strokeWidth={1.5} style={{ color: "#63636b", marginLeft: 18, flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to a section or run a command…"
                className="cmdk-input"
                style={{ paddingLeft: 10 }}
                aria-label="Command input"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
              />
              <span className="kbd" style={{ marginRight: 14, flexShrink: 0 }}>esc</span>
            </div>

            <div ref={listRef} id="cmdk-list" role="listbox" style={{ maxHeight: 360, overflowY: "auto" }} className="no-scrollbar">
              {filtered.length === 0 && (
                <div className="mono" style={{ padding: "24px 20px", fontSize: 12, color: "#63636b", textAlign: "center" }}>
                  No matches for “{query}”
                </div>
              )}
              {Object.entries(groups).map(([groupName, groupItems]) => (
                <div key={groupName} className="cmdk-group">
                  <div className="cmdk-group-label">{groupName}</div>
                  {groupItems.map((it) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === safeActive;
                    return (
                      <div
                        key={it.id}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        className="cmdk-row"
                        onClick={() => it.run()}
                        onMouseEnter={() => setActive(idx)}
                      >
                        <span className="cmdk-row-icon">{it.icon}</span>
                        <span className="cmdk-row-label">{it.label}</span>
                        {it.hint && <span className="cmdk-row-hint">{it.hint}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cmdk-footer">
              <span className="kbd" style={{ height: 18, fontSize: 9 }}>↑</span>
              <span className="kbd" style={{ height: 18, fontSize: 9 }}>↓</span>
              <span>nav</span>
              <span style={{ color: "#63636b" }}>·</span>
              <span className="kbd" style={{ height: 18, fontSize: 9 }}>↵</span>
              <span>run</span>
              <span style={{ marginLeft: "auto", color: "#63636b" }}>⌘K to toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
