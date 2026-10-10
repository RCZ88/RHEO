"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";

type MotionMode = "auto" | "on" | "off";

const STORAGE_KEY = "rheo-motion";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readStoredMode(): MotionMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") return null;   // empty string = no stored choice
    if (raw === "auto" || raw === "on" || raw === "off") return raw;
  } catch {}
  return null;
}

// ---- Module-level store ----
let mode: MotionMode = "auto";
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getServerSnapshot(): MotionMode {
  return "auto";
}

function getSnapshot(): MotionMode {
  return mode;
}

function writeMode(next: MotionMode): void {
  if (mode === next) return;
  mode = next;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  // Stamp the mode onto <html> so CSS can honour the EXPLICIT toggle. The
  // prefers-reduced-motion query covers the system setting, but it cannot see a
  // choice made in the MotionChip — without this stamp the hero keyframes would
  // keep running for a user who turned motion off, and the chip would be lying.
  // Stamp ONLY explicit choices, and DELETE the attribute for "auto".
  //
  // The deletion is load-bearing. If off -> auto left `data-motion="off"` behind,
  // an auto user's keyframes would be dead for the rest of the session with no OS
  // reduce anywhere — a stuck-flag bug of exactly the class this session keeps
  // hitting. "auto" must leave the attribute ABSENT so the media query governs.
  if (typeof document !== "undefined") {
    if (mode === "on" || mode === "off") {
      document.documentElement.dataset.motion = mode;
    } else {
      delete document.documentElement.dataset.motion;
    }
  }
  for (const fn of [...listeners]) fn();
}

export function useMotionPreference(): MotionMode {
  // Init from storage or system on first client mount
  // When no stored preference, leave mode as "auto" (don't write localStorage —
  // the nudge banner needs !hasChosen to be true). The system RM listener
  // (below) will apply a transient mode when in auto.
  useEffect(() => {
    const stored = readStoredMode();
    if (stored) {
      writeMode(stored);
    }
    // else: mode stays "auto", no localStorage write
  }, []);

  // Live system reduced-motion listener when in auto mode
  // Applies a transient mode based on system setting — does NOT persist to
  // localStorage (that's a user choice, made via setMode/setter).
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const apply = () => {
      const cur = readStoredMode();
      // Only apply transient system mode when user explicitly chose "auto"
      // (stored value is "auto"). When no stored preference, leave as "auto"
      // so the chip shows "MOTION AUTO" and the nudge banner can fire.
      if (!cur || cur !== "auto") return;
      mode = mq.matches ? "off" : "on";
      for (const fn of [...listeners]) fn();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Cross-tab storage sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.storageArea === localStorage) {
        const val = readStoredMode();
        if (val) writeMode(val);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMotionPreferenceSetter() {
  const mode = useMotionPreference();
  const setMode = useCallback(
    (next: MotionMode) => writeMode(next),
    [],
  );
  return { mode, setMode };
}

// The system reduced-motion value is external state, so it belongs in an external
// store with a server snapshot. Reading it during render (the old
// `!getSystemReducedMotion()`) meant the server answered `false` while a reduce
// client answered `true` on its FIRST render — a different DOM tree, and React
// discarded the server HTML. That mismatch reached 13 call sites.
//
// Server snapshot is `false` on purpose: byte-identical SSR output to the old
// behaviour, and full motion is the safer assumption to paint first.
function subscribeSystemReduced(cb: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getSystemReducedSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getSystemReducedServerSnapshot(): boolean {
  return false;
}

export function useShouldAnimate(): boolean {
  const m = useMotionPreference();
  // Precedence unchanged: an explicit "on"/"off" still beats the system value.
  const systemReduced = useSyncExternalStore(
    subscribeSystemReduced,
    getSystemReducedSnapshot,
    getSystemReducedServerSnapshot
  );
  if (m === "on") return true;
  if (m === "off") return false;
  return !systemReduced;
}
