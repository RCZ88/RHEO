"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";

type MotionMode = "auto" | "on" | "off";

const STORAGE_KEY = "rheo-motion";

function getSystemReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readStoredMode(): MotionMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  for (const fn of [...listeners]) fn();
}

export function useMotionPreference(): MotionMode {
  // Init from storage or system on first client mount
  useEffect(() => {
    const stored = readStoredMode();
    if (stored) {
      writeMode(stored);
    } else {
      writeMode(getSystemReducedMotion() ? "off" : "on");
    }
  }, []);

  // Live system reduced-motion listener when in auto mode
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const cur = readStoredMode();
      if (cur && cur !== "auto") return;
      writeMode(mq.matches ? "off" : "on");
    };
    apply();
    const handler = () => apply();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
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

export function useShouldAnimate(): boolean {
  const m = useMotionPreference();
  if (m === "on") return true;
  if (m === "off") return false;
  return !getSystemReducedMotion();
}
