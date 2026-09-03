"use client";

import { useEffect, useRef, useState } from "react";

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

export function useMotionPreference(): MotionMode {
  const [mode, setMode] = useState<MotionMode>(() => readStoredMode() ?? "auto");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => {
      setMode((prev) => {
        if (prev === "auto") {
          // auto follows system
          return mq.matches ? "off" : "on";
        }
        return prev;
      });
    };

    // Initial sync
    if (mode === "auto") {
      setMode(mq.matches ? "off" : "on");
    }

    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [mode]);

  return mode;
}

export function useMotionPreferenceSetter() {
  const current = useMotionPreference();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // On first mount, persist default if not set
      if (!readStoredMode()) {
        try {
          localStorage.setItem(STORAGE_KEY, current === "auto" ? "auto" : current);
        } catch {}
      }
    }
  }, [current]);

  const setMode = (m: MotionMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  };

  const [modeState, setModeState] = useState<MotionMode>(current);

  // Sync external changes
  useEffect(() => {
    setModeState(current);
  }, [current]);

  return { mode: modeState, setMode: setModeState };
}

export function useShouldAnimate(): boolean {
  const mode = useMotionPreference();
  if (mode === "on") return true;
  if (mode === "off") return false;
  // auto: follow system
  return !getSystemReducedMotion();
}
