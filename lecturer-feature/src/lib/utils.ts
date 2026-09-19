export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

export const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

export const fmtClock = (ts: number) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

import type { DynamicParam } from "./types";

/**
 * Dynamic params: {{name}}, {{name:default}}, {{name|opt1|opt2}}, {{name:default|opt1|opt2}}
 */
export function parseDynamicParams(cmd: string): DynamicParam[] {
  const out: DynamicParam[] = [];
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const inner = m[1].trim();
    const pipeParts = inner.split("|").map((s) => s.trim()).filter(Boolean);
    const head = pipeParts[0] ?? "";
    const colon = head.indexOf(":");
    let name = head;
    let def = "";
    if (colon >= 0) {
      name = head.slice(0, colon).trim();
      def = head.slice(colon + 1).trim();
    }
    if (!name || !/^[a-zA-Z0-9_\-]+$/.test(name)) continue;
    if (out.some((p) => p.name === name)) continue;
    const options = pipeParts.slice(1);
    if (!def && options.length) def = options[0];
    out.push({ name, def, options });
  }
  return out;
}

export function fillDynamic(cmd: string, values: Record<string, string>): string {
  return cmd.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, innerRaw: string) => {
    const inner = String(innerRaw).trim();
    const head = inner.split("|")[0].trim();
    const colon = head.indexOf(":");
    const name = (colon >= 0 ? head.slice(0, colon) : head).trim();
    const def = colon >= 0 ? head.slice(colon + 1).trim() : "";
    const v = values[name];
    if (v !== undefined && v !== "") return v;
    if (def) return def;
    return full;
  });
}

export function keysToLabel(keys: string): string[] {
  return keys.split("+").map((k) => k.trim()).filter(Boolean);
}

const KEY_ALIASES: Record<string, string> = {
  " ": "Space", spacebar: "Space", esc: "Escape",
  arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  del: "Delete", bs: "Backspace", return: "Enter", ins: "Insert",
};

/** Build a stable combo string like "Ctrl+Shift+T" from a keydown event. Returns null for lone modifiers. */
export function normalizeCombo(e: KeyboardEvent): string | null {
  const k = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(k)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && k.length !== 1) parts.push("Shift");
  let key = k;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  else key = KEY_ALIASES[key.toLowerCase()] ?? (key[0].toUpperCase() + key.slice(1));
  if (e.shiftKey && k.length === 1 && /[A-Z]/.test(key)) {
    if (!parts.includes("Shift")) parts.unshift("Shift");
  }
  parts.push(key);
  return parts.join("+");
}

/** Match a keydown event against a stored combo like "Ctrl+Shift+T". */
export function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split("+").map((s) => s.trim());
  if (!parts.length) return false;
  const lowers = parts.map((p) => p.toLowerCase());
  const wantCtrl = lowers.includes("ctrl") || lowers.includes("control");
  const wantAlt = lowers.includes("alt") || lowers.includes("option");
  const wantMeta = lowers.includes("meta") || lowers.includes("cmd") || lowers.includes("super") || lowers.includes("win");
  const wantShiftExplicit = lowers.includes("shift");
  let keyPart = parts[parts.length - 1];
  const kl = keyPart.toLowerCase();
  if (["ctrl", "control", "alt", "shift", "meta"].includes(kl)) return false;
  keyPart = KEY_ALIASES[kl] ?? keyPart;
  const pressed = e.key;
  let keyOk: boolean;
  if (keyPart.length === 1) {
    keyOk = pressed.length === 1 && pressed.toUpperCase() === keyPart.toUpperCase();
  } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(keyPart)) {
    keyOk = pressed === keyPart;
  } else {
    keyOk = pressed.toLowerCase() === keyPart.toLowerCase();
  }
  if (!keyOk) return false;
  if (!!e.ctrlKey !== wantCtrl) return false;
  if (!!e.altKey !== wantAlt) return false;
  if (!!e.metaKey !== wantMeta) return false;
  const shiftNeeded = wantShiftExplicit || (keyPart.length === 1 && /[A-Z]/.test(keyPart) && pressed === pressed.toUpperCase() && /[a-zA-Z]/.test(pressed));
  if (wantShiftExplicit && !e.shiftKey) return false;
  if (!wantShiftExplicit && !shiftNeeded && e.shiftKey && keyPart.length === 1) {
    // allow shift for symbols typed with shift (e.g. "?" "]" family) — be lenient
  }
  void shiftNeeded;
  return true;
}

export function download(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildTranscript(tabLabel: string, panes: { cwd: string; lines: { type: string; text: string; timestamp: number }[] }[]): string {
  const out: string[] = [];
  out.push(`# Penguin Console transcript — ${tabLabel}`);
  out.push(`# exported ${new Date().toLocaleString()}`);
  panes.forEach((p, i) => {
    out.push(``);
    out.push(`## pane ${i + 1} — ${p.cwd}`);
    p.lines.forEach((l) => {
      const t = new Date(l.timestamp).toLocaleTimeString();
      if (l.type === "input") out.push(`\n[${t}] $ ${l.text}`);
      else out.push(l.text);
    });
  });
  return out.join("\n");
}
