// src/app/docs/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Docs — RHEO",
};

const PAGES = [
  { href: "/docs/data", title: "Your data", line: "Where it lives, what it is, and what else sits in the same folder." },
  { href: "/docs/network", title: "Network", line: "Every outbound call, with host, payload, and whether it runs by default." },
  { href: "/docs/ai", title: "AI", line: "What a prompt contains, which providers, and what is locked out." },
  { href: "/docs/phases", title: "Phases", line: "How Learn and Burn-down work, and why RHEO never guesses." },
  { href: "/docs/faq", title: "FAQ", line: "Short answers, each linking to a page above." },
];

export default function DocsOverview() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>OVERVIEW</p>
      <h1 className="display-h2 mt-3">DOCUMENTATION.</h1>
      <p className="mt-5" style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}>
        RHEO is a private time tracker for your desktop. Its record is a SQLite
        database in your own data folder. These pages say where that data goes,
        what leaves the machine, and what does not. Every claim is backed by a
        file and line in the app's source.
      </p>
      <p className="mt-5" style={{ fontSize: 14, lineHeight: 1.6, color: "#8a8a94" }}>
        Not built on purpose: pricing, roadmap, and per-feature reference docs.
        The app is not released yet, so documenting features that cannot be tried
        would be fiction.
      </p>

      <ul className="mt-10 flex flex-col gap-6">
        {PAGES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="block group">
              <p className="mono" style={{ fontSize: 14, color: "#f4f4f5", fontWeight: 500 }}>
                {p.title} <span style={{ color: "#8a8a94" }}>→</span>
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "#8a8a94", marginTop: 4 }}>
                {p.line}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}