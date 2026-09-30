// ChatExportBridge — closes the loop on "where does an exported chat go?"
//
// Before this, the Export button did JSON.stringify → Blob → download, and
// nothing in the app ever read that file back. So an exported conversation was
// a dead artifact: it never reached the Chat Library and never reached the
// brain. This gives the user both directions explicitly:
//
//   → Brain   ingest the current thread now (works for threads that predate the
//             library, where the automatic save-time ingest did not run)
//   ↓ JSON    the original download, unchanged
//   ↑ Import  drop a ChatGPT / Claude / Perplexity conversations.json export in
//             and it is parsed, ingested and learned from
//
// The importer is deliberately forgiving about shape: every real export differs
// slightly, and a strict parser would reject the user's actual file.

import { useState, useRef, useCallback } from "react";
import { Download, Upload, Brain, Loader2, AlertTriangle, Check, X, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  threadDate: string;
  threadTitle?: string | null;
  messageCount?: number;
}

type Result = { kind: "ok" | "err"; text: string };

const api = () => (window as any).deskflowAPI;

/** Pull {role, content} out of the many shapes real exports use. */
function normalizeMessages(raw: any): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = [];

  const push = (role: string, content: any) => {
    if (typeof content === "string" && content.trim()) {
      out.push({ role: String(role || "user").toLowerCase(), content });
    } else if (content && typeof content === "object") {
      // ChatGPT parts[] shape
      const parts = content.parts;
      if (Array.isArray(parts)) {
        const text = parts.filter((p) => typeof p === "string").join("\n");
        if (text.trim()) out.push({ role: String(role || "user").toLowerCase(), content: text });
      } else if (typeof content.text === "string" && content.text.trim()) {
        out.push({ role: String(role || "user").toLowerCase(), content: content.text });
      }
    }
  };

  const walk = (node: any, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    // A message node. In the ChatGPT `mapping` tree both the role and the body
    // live under `node.message`, so both lookups must reach into it — checking
    // only node.role finds a body but no role and silently drops the message.
    const role = node.role || node.author?.role || node.message?.author?.role || node.sender;
    const body = node.content ?? node.text ?? node.message?.content ?? node.body;
    if (role && body != null) push(role, body);
    // ChatGPT mapping tree
    if (node.mapping) Object.values(node.mapping).forEach((n: any) => walk(n, depth + 1));
    if (Array.isArray(node.messages)) walk(node.messages, depth + 1);
    if (Array.isArray(node.conversations)) walk(node.conversations, depth + 1);
    // Claude / Perplexity
    if (Array.isArray(node.chat_messages)) walk(node.chat_messages, depth + 1);
  };

  walk(raw);
  return out;
}

function titleFrom(raw: any): string | undefined {
  return (
    raw?.title ||
    raw?.name ||
    raw?.conversations?.[0]?.title ||
    raw?.chat_messages?.[0]?.conversation?.title ||
    undefined
  );
}

export function ChatExportBridge({ open, onClose, threadDate, threadTitle, messageCount }: Props) {
  const [busy, setBusy] = useState<null | "brain" | "import">(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = useCallback(() => {
    try {
      const load = api()?.aiChatLoad;
      if (typeof load !== "function") throw new Error("Chat bridge unavailable");
      Promise.resolve(load(threadDate)).then((r: any) => {
        const rows = r?.messages || r?.data?.messages || [];
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-${threadDate}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ kind: "ok", text: `Downloaded ${rows.length} message(s).` });
      });
    } catch (e: any) {
      setResult({ kind: "err", text: e?.message || "Could not export this conversation." });
    }
  }, [threadDate]);

  const toBrain = useCallback(async () => {
    setBusy("brain");
    setResult(null);
    try {
      const load = api()?.aiChatLoad;
      const r = load ? await load(threadDate) : null;
      const rows = r?.messages || r?.data?.messages || [];
      if (!rows.length) {
        setResult({ kind: "err", text: "This conversation has no stored messages." });
        return;
      }
      const res = await api()?.chatLibraryIngest?.({
        source: "deskflow_chat",
        provider: "deskflow",
        externalId: threadDate,
        title: threadTitle || undefined,
        messages: rows.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });
      if (!res?.success) {
        setResult({ kind: "err", text: res?.error || "Could not save to the library." });
        return;
      }
      const st = res.result?.status;
      setResult({
        kind: "ok",
        text:
          st === "duplicate"
            ? "Already in the library — nothing to add."
            : `Saved ${res.result?.messageCount} message(s) to the library and the brain.`,
      });
    } catch (e: any) {
      setResult({ kind: "err", text: e?.message || "Could not save to the brain." });
    } finally {
      setBusy(null);
    }
  }, [threadDate, threadTitle]);

  const importFile = useCallback(async (file: File) => {
    setBusy("import");
    setResult(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const messages = normalizeMessages(raw);
      if (!messages.length) {
        setResult({
          kind: "err",
          text: "No conversations recognised in that file. Expected a ChatGPT / Claude / Perplexity export.",
        });
        return;
      }
      const res = await api()?.chatLibraryIngest?.({
        source: "imported_file",
        provider: file.name.replace(/\.json$/i, "").slice(0, 40),
        title: titleFrom(raw),
        messages,
      });
      if (!res?.success) {
        setResult({ kind: "err", text: res?.error || "Could not import that file." });
        return;
      }
      setResult({
        kind: "ok",
        text: `Imported ${res.result?.messageCount} message(s) into the library and the brain.`,
      });
    } catch (e: any) {
      setResult({ kind: "err", text: e?.message || "That file is not valid JSON." });
    } finally {
      setBusy(null);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Export conversation"
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(9,9,11,0.72)" }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--ws-border-strong)",
          borderRadius: 12,
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--ws-border)" }}
        >
          <FileText size={13} style={{ color: "var(--color-amber-400)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-foreground)" }}>
            Conversation export
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 transition-colors focus:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2" style={{ borderBottom: "1px solid var(--ws-border)" }}>
          <p className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
            {threadTitle || threadDate}
            {messageCount != null ? ` · ${messageCount} messages` : ""}
          </p>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={() => void toBrain()}
            disabled={busy !== null}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2"
            style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.28)" }}
          >
            {busy === "brain" ? (
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-amber-400)" }} />
            ) : (
              <Brain size={14} style={{ color: "var(--color-amber-400)" }} />
            )}
            <span className="flex-1">
              <span className="block text-[11px] font-medium" style={{ color: "var(--color-amber-400)" }}>
                Save to brain
              </span>
              <span className="block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                Index it in the library so it is searchable and learnable
              </span>
            </span>
          </button>

          <button
            onClick={download}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2"
            style={{ border: "1px solid var(--ws-border)" }}
          >
            <Download size={14} style={{ color: "var(--color-muted-foreground)" }} />
            <span className="flex-1">
              <span className="block text-[11px] font-medium" style={{ color: "var(--color-foreground)" }}>
                Download JSON
              </span>
              <span className="block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                The plain file, for moving it elsewhere
              </span>
            </span>
          </button>

          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
            style={{ border: "1px dashed var(--ws-border)" }}
          >
            <Upload size={14} style={{ color: "var(--color-muted-foreground)" }} />
            <div className="flex-1">
              <span className="block text-[11px] font-medium" style={{ color: "var(--color-foreground)" }}>
                Import a chat export
              </span>
              <span className="block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                ChatGPT, Claude or Perplexity conversations.json
              </span>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
              className="px-2 py-1 rounded-md text-[10px] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2"
              style={{ border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }}
            >
              {busy === "import" ? <Loader2 size={11} className="animate-spin" /> : "Choose…"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {result && (
            <div
              className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
              style={{
                background: result.kind === "ok" ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
              }}
            >
              {result.kind === "ok" ? (
                <Check size={12} style={{ color: "var(--color-emerald-400)", flexShrink: 0 }} className="mt-0.5" />
              ) : (
                <AlertTriangle size={12} style={{ color: "var(--color-destructive)" }} className="mt-0.5" />
              )}
              <span
                className="text-[10px]"
                style={{ color: result.kind === "ok" ? "var(--color-emerald-400)" : "var(--color-destructive)" }}
              >
                {result.text}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatExportBridge;
