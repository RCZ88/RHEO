// ExternalAiLauncher — the app-side surface for "which AI, and where is it".
//
// Answers the four questions the scattered hardcoded URLs could not:
//   which AIs exist · which am I signed in to · open it in my browser · copy the
//   prompt / copy the link
//
// Sign-in state is NOT stored here. It is read live from the AI Gateway, whose
// per-provider sessions live in an AES-256-GCM encrypted vault on disk
// (services/ai-gateway/CredentialVault.ts). This component only DISPLAYS that
// state and routes the user to the one place that can change it — Workspace ->
// AI Gateway -> Providers — because automating a provider login is a ToS
// violation on every adapter (antiBot.cloudflare: true) and risks a ban.

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink, Copy, Check, Link2, Loader2, KeyRound, Search, X, AlertTriangle,
} from "lucide-react";

import {
  EXTERNAL_AI_PROVIDERS, openInBrowser, copyText,
  type ExternalAiProvider,
} from "@/services/externalAiProviders";
import { sendViaGateway } from "@/services/externalAiTransport";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional prompt so "copy prompt" / send are useful from the launcher. */
  prompt?: string;
}

type Status = {
  sessionValid: boolean;
  status?: string;
  lastError?: string | null;
};

export function ExternalAiLauncher({ open, onClose, prompt }: Props) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const api = (window as any).deskflowAPI;
    if (typeof api?.aigatewayAllStatuses !== "function") return;
    setLoading(true);
    try {
      const r = await api.aigatewayAllStatuses();
      const rows: any[] = Array.isArray(r?.data) ? r.data : [];
      const map: Record<string, Status> = {};
      for (const s of rows) map[s.provider] = s;
      setStatuses(map);
    } catch {
      /* leave the map empty — every tile just shows "not signed in" */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const openProvider = useCallback(async (p: ExternalAiProvider) => {
    const ok = await openInBrowser(p.url);
    setNote(
      ok
        ? `${p.name} opened in your browser. The prompt is not auto-pasted — use “Copy prompt”.`
        : "Could not open your browser."
    );
  }, []);

  const copyLink = useCallback(async (p: ExternalAiProvider) => {
    if (await copyText(p.url)) {
      flash(p.id);
      setNote(`${p.name} link copied.`);
    }
  }, []);

  const copyPrompt = useCallback(async () => {
    if (!prompt) {
      setNote("There is no prompt here yet — open a feature that generates one.");
      return;
    }
    if (await copyText(prompt)) {
      flash("prompt");
      setNote("Prompt copied — paste it into the AI.");
    }
  }, [prompt]);

  const sendHandsFree = useCallback(
    async (p: ExternalAiProvider) => {
      if (!prompt) {
        setNote("There is no prompt here yet.");
        return;
      }
      setBusy(p.id);
      setNote(null);
      const res = await sendViaGateway(prompt, { provider: p.id });
      setBusy(null);
      if (res.ok) {
        setNote(`Answer from ${p.name}:\n\n${res.text!.slice(0, 1200)}`);
      } else {
        setNote(res.error || `Could not reach ${p.name}.`);
      }
    },
    [prompt]
  );

  if (!open) return null;

  const visible = EXTERNAL_AI_PROVIDERS.filter((p) =>
    filter ? p.name.toLowerCase().includes(filter.toLowerCase()) : true
  );
  const signedInCount = Object.values(statuses).filter((s) => s.sessionValid).length;

  return (
    <div
      role="dialog"
      aria-label="External AI"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(9,9,11,0.72)" }}
    >
      <div
        className="w-full max-w-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: "min(84vh, 760px)",
          background: "var(--color-card)",
          border: "1px solid var(--ws-border-strong)",
          borderRadius: 12,
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--ws-border)" }}
        >
          <ExternalLink size={13} style={{ color: "var(--color-amber-400)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-foreground)" }}>
            External AI
          </span>
          <span
            className="text-[10px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}
          >
            {signedInCount
              ? `${signedInCount} signed in`
              : "none signed in — browser only"}
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

        {/* Search */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--ws-border)" }}>
          <div
            className="flex items-center gap-2 px-3"
            style={{
              background: "var(--color-background)",
              border: "1px solid var(--ws-border)",
              borderRadius: 8,
            }}
          >
            <Search size={13} style={{ color: "var(--color-muted-foreground)" }} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter providers…"
              aria-label="Filter providers"
              className="flex-1 bg-transparent py-2 text-[12px] outline-none"
              style={{ color: "var(--color-foreground)" }}
            />
            {loading && <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-amber-400)" }} />}
          </div>
        </div>

        {/* Vault explainer */}
        <div
          className="flex items-start gap-2 px-4 py-2.5 shrink-0"
          style={{ background: "rgba(6,182,212,0.06)", borderBottom: "1px solid var(--ws-border)" }}
        >
          <KeyRound size={12} style={{ color: "var(--ws-accent)", flexShrink: 0 }} className="mt-0.5" />
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
            Logins are stored per provider in an encrypted vault (AES-256-GCM) on this
            machine — no passwords, no cookies sent anywhere. Sign in from{" "}
            <span style={{ color: "var(--ws-accent)" }}>Workspace → AI Gateway → Providers</span>;
            you log in by hand there once, then every provider here shows “signed in”.
          </p>
        </div>

        {/* Provider grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {visible.map((p) => {
              const st = statuses[p.id];
              const signedIn = !!st?.sessionValid;
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 p-2.5"
                  style={{ border: "1px solid var(--ws-border)", borderRadius: 8 }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="text-[11px] font-medium" style={{ color: "var(--color-foreground)" }}>
                      {p.name}
                    </span>
                    <span
                      className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{
                        fontFamily: "var(--font-mono)",
                        border: "1px solid var(--ws-border)",
                        color: signedIn ? "var(--color-emerald-400)" : "var(--color-muted-foreground)",
                        background: signedIn ? "rgba(52,211,153,0.10)" : "transparent",
                      }}
                    >
                      {signedIn ? "signed in" : "browser only"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => void openProvider(p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors focus:outline-none focus-visible:ring-2"
                      style={{ border: "1px solid var(--ws-border)", color: "var(--color-foreground)" }}
                      title={`Open ${p.name} in your browser`}
                    >
                      <ExternalLink size={10} /> Open
                    </button>
                    <button
                      onClick={() => void copyLink(p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors focus:outline-none focus-visible:ring-2"
                      style={{ border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }}
                      title="Copy the provider link"
                    >
                      {copied === p.id ? <Check size={10} /> : <Link2 size={10} />}
                      {copied === p.id ? "Copied" : "Link"}
                    </button>
                    <button
                      onClick={() => void copyPrompt()}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors focus:outline-none focus-visible:ring-2"
                      style={{ border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }}
                      title="Copy the current prompt"
                    >
                      {copied === "prompt" ? <Check size={10} /> : <Copy size={10} />}
                      {copied === "prompt" ? "Copied" : "Prompt"}
                    </button>
                    {signedIn && (
                      <button
                        onClick={() => void sendHandsFree(p)}
                        disabled={busy === p.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2"
                        style={{
                          background: "rgba(251,191,36,0.12)",
                          border: "1px solid rgba(251,191,36,0.3)",
                          color: "var(--color-amber-400)",
                        }}
                        title="Send hands-free — no browser tab needed"
                      >
                        {busy === p.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <ExternalLink size={10} />
                        )}
                        Send
                      </button>
                    )}
                  </div>

                  {st?.lastError && (
                    <p className="text-[9px]" style={{ color: "var(--color-destructive)" }}>
                      {st.lastError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {note && (
            <div
              className="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: "rgba(251,191,36,0.07)" }}
            >
              <AlertTriangle size={12} style={{ color: "var(--color-amber-400)", flexShrink: 0 }} className="mt-0.5" />
              <p
                className="text-[10px] whitespace-pre-wrap"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExternalAiLauncher;