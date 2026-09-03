"use client";

import { useEffect, useState } from "react";

export type DetectedOS = "macOS" | "Windows" | "Linux";

export function useDetectedOS(): DetectedOS {
  const [os, setOs] = useState<DetectedOS>("macOS");
  useEffect(() => {
    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    // SSR-safe browser detection: runs only on client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/Mac|iPhone|iPad|iPod/.test(ua)) setOs("macOS");
    else if (/Windows/.test(ua)) setOs("Windows");
    else if (/Linux|X11/.test(ua)) setOs("Linux");
    else setOs("macOS");
  }, []);
  return os;
}
