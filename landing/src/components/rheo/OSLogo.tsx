"use client";

import { memo } from "react";

interface OSLogoProps {
  os: "macOS" | "Windows" | "Linux";
  size?: number;
}

const SIZE = 14;

export const OSLogo = memo(function OSLogo({ os, size = SIZE }: OSLogoProps) {
  if (os === "Linux") {
    // Tux-style penguin silhouette — two shapes: body + head
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        {/* body */}
        <path
          d="M12 22c-3.31 0-6-2.69-6-6 0-2.21 1.79-4 4-4 .29 0 .54.04.78.12C10.79 11.33 12 10.31 12 10.31s1.21 1.02 2.22 1.88c.24-.08.49-.12.78-.12 2.21 0 4 1.79 4 4 0 3.31-2.69 6-6 6z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* head */}
        <circle cx="12" cy="8" r="3.5" fill="currentColor" />
        {/* eye */}
        <circle cx="13.2" cy="7.2" r="0.6" fill="#050506" />
        {/* beak */}
        <path d="M14.5 8.5 L16 9 L14.5 9.5Z" fill="#f4f4f5" />
      </svg>
    );
  }

  if (os === "Windows") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.65" />
        <rect x="3" y="13" width="8" height="8" rx="1" fill="currentColor" opacity="0.65" />
        <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    );
  }

  // macOS — four pips (traffic-light style, but simplified as mono marks)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="7" cy="7" r="2" fill="currentColor" opacity="0.9" />
      <circle cx="12" cy="7" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="17" cy="7" r="2" fill="currentColor" opacity="0.5" />
      <rect x="4" y="11" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
});

export default OSLogo;
