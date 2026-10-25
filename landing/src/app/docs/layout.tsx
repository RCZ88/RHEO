// src/app/docs/layout.tsx
//
// Shared docs shell. Reuses the same container, tokens and type scale as the
// landing page so docs and marketing read as one product rather than two.
//
// DESIGN RULES (round-05 §3):
//   - no CMS, no MDX, no new runtime dependency. TSX only.
//   - every claim on a page is backed by a file:line in a source comment.
//   - no pricing, no roadmap, no per-feature docs until the app ships.

import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/docs", label: "Overview", slug: "" },
  { href: "/docs/data", label: "Your data", slug: "data" },
  { href: "/docs/network", label: "Network", slug: "network" },
  { href: "/docs/ai", label: "AI", slug: "ai" },
  { href: "/docs/phases", label: "Phases", slug: "phases" },
  { href: "/docs/faq", label: "FAQ", slug: "faq" },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col surface-page">
      <nav
        className="sticky top-0 z-50 border-b border-white/8 backdrop-blur-md"
        style={{ background: "rgba(5,5,6,0.85)" }}
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16 flex items-center justify-between py-4">
          <Link
            href="/"
            className="mono"
            style={{ fontSize: 13, color: "#f4f4f5", letterSpacing: "0.02em" }}
          >
            RHEO
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="mono"
              style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Product
            </Link>
            <Link
              href="/docs"
              className="mono"
              style={{ fontSize: 11, color: "#f4f4f5", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Docs
            </Link>
            <Link
              href="#download"
              className="mono"
              style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Download
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16 py-16 sm:py-20 w-full">
        <div className="flex flex-col lg:flex-row gap-12">
          <aside className="lg:w-[240px] flex-shrink-0">
            <p className="mono-label mb-4" style={{ fontSize: 11 }}>DOCUMENTATION</p>
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="mono block py-2 text-sm"
                    style={{ color: "#a1a1aa", letterSpacing: "0.02em" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
          <main className="flex-1 min-w-0 max-w-[720px]">{children}</main>
        </div>
      </div>
    </div>
  );
}