"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

type Category = "feedback" | "bug" | "feature" | "other";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "feedback", label: "Feedback" },
  { key: "bug", label: "Bug" },
  { key: "feature", label: "Feature Request" },
  { key: "other", label: "Other" },
];

const REPO = "RCZ88/RHEO";

export default function FeedbackPage() {
  const [category, setCategory] = useState<Category>("feedback");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [os, setOs] = useState("");
  const [version, setVersion] = useState("");
  const [copied, setCopied] = useState(false);

  // Draft autosave
  useEffect(() => {
    try {
      const draft = localStorage.getItem("rheo-feedback-draft");
      if (draft) {
        const d = JSON.parse(draft);
        if (d.category) setCategory(d.category);
        if (d.title) setTitle(d.title);
        if (d.body) setBody(d.body);
        if (d.os) setOs(d.os);
        if (d.version) setVersion(d.version);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "rheo-feedback-draft",
          JSON.stringify({ category, title, body, os, version }),
        );
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [category, title, body, os, version]);

  const buildIssueUrl = useCallback(() => {
    const templateMap: Record<Category, string> = {
      feedback: "feedback.yml",
      bug: "bug.yml",
      feature: "feature-request.yml",
      other: "feedback.yml",
    };
    const template = templateMap[category];
    const params = new URLSearchParams();
    params.set("template", template);
    params.set("labels", "landing");
    if (title.trim()) params.set("title", title.trim());
    const bodyParts: string[] = [];
    if (body.trim()) bodyParts.push(body.trim());
    if (category === "bug") {
      if (os.trim()) bodyParts.push(`\n**OS:** ${os.trim()}`);
      if (version.trim()) bodyParts.push(`**Version:** ${version.trim()}`);
    }
    if (bodyParts.length > 0) params.set("body", bodyParts.join("\n"));
    return `https://github.com/${REPO}/issues/new?${params.toString()}`;
  }, [category, title, body, os, version]);

  const copyAsMarkdown = useCallback(() => {
    const md = `## ${title || "Untitled"}\n\n**Category:** ${category}\n\n${body}\n${category === "bug" ? `\n**OS:** ${os}\n**Version:** ${version}\n` : ""}`;
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [category, title, body, os, version]);

  return (
    <main className="min-h-screen surface-page px-5 sm:px-10 lg:px-16 py-24 max-w-[760px] mx-auto">
      <Link href="/" className="mono text-sm text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
        ← back
      </Link>

      <h1 className="display-h2 mt-8">FEEDBACK.</h1>
      <p className="mt-4 text-[#a1a1aa]" style={{ fontSize: 15, lineHeight: 1.6 }}>
        Tell us what&apos;s broken, what&apos;s missing, or what you think. Nothing is sent
        until you submit on github.com.
      </p>

      {/* Category pills */}
      <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Feedback category">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            role="radio"
            aria-checked={category === c.key}
            onClick={() => setCategory(c.key)}
            className="mono"
            style={{
              fontSize: 11,
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: category === c.key ? "#ffffff" : "transparent",
              color: category === c.key ? "#050506" : "#a1a1aa",
              border: `1px solid ${category === c.key ? "#ffffff" : "rgba(255,255,255,0.12)"}`,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="mt-6">
        <label className="mono" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary"
          className="mt-2 w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-[#f4f4f5] placeholder:text-[#63636b] focus:outline-none focus:border-white/25"
          style={{ fontSize: 14 }}
        />
      </div>

      {/* Body */}
      <div className="mt-4">
        <label className="mono" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Details
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened? What did you expect?"
          rows={6}
          className="mt-2 w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-[#f4f4f5] placeholder:text-[#63636b] focus:outline-none focus:border-white/25 resize-y"
          style={{ fontSize: 14 }}
        />
      </div>

      {/* Bug-only fields */}
      {category === "bug" && (
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <label className="mono" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              OS
            </label>
            <input
              type="text"
              value={os}
              onChange={(e) => setOs(e.target.value)}
              placeholder="macOS 14, Windows 11, etc."
              className="mt-2 w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-[#f4f4f5] placeholder:text-[#63636b] focus:outline-none focus:border-white/25"
              style={{ fontSize: 14 }}
            />
          </div>
          <div className="flex-1">
            <label className="mono" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Version
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v0.2.0"
              className="mt-2 w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-[#f4f4f5] placeholder:text-[#63636b] focus:outline-none focus:border-white/25"
              style={{ fontSize: 14 }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex items-center gap-4">
        <a
          href={buildIssueUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mono"
          style={{
            fontSize: 13,
            padding: "12px 24px",
            borderRadius: 6,
            background: "#ffffff",
            color: "#050506",
            textDecoration: "none",
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          OPEN ON GITHUB →
        </a>
        <button
          onClick={copyAsMarkdown}
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding: "12px 16px",
            cursor: "pointer",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {copied ? "COPIED" : "COPY AS MARKDOWN"}
        </button>
      </div>

      <p className="mono mt-6" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
        DRAFT AUTOSAVED · NOTHING SENT UNTIL YOU SUBMIT ON GITHUB.COM
      </p>
    </main>
  );
}
