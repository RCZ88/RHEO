// AiProviderManager — add / edit / enable / remove AI providers, including the
// local AI Router, and store each provider's model list.
//
// Two render shapes:
//   inline   — body only, for the unified dialog. AiProviderSelectModal shows
//              it as the "Providers & models" view: ONE window, no second popup.
//   overlay  — the original standalone dialog, kept for any other caller.
//
// Catalogue honesty: provider kinds come from services/providers/templates.ts —
// the same catalogue the main-process router dispatches on. The hand-written
// copy that used to live here had already drifted from it.
//
// Models are entered through the type-then-select field (ModelCombobox) and
// stored as a real list — not a comma-separated string.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Save, X, Check, Loader2, AlertTriangle, Server, Eye, EyeOff, Zap,
} from "lucide-react";
import { ModelsField } from "./ModelCombobox";
import { listProviderTemplates } from "../../services/providers/templates";
import type { ProviderTemplateSummary } from "../../services/providers/templates";

export interface ProviderRow {
  id: string;
  templateId: string;
  label: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  priority?: number;
  monthlyTokenBudget?: number;
  timeoutMs?: number;
}

// Preferred display order — the AI Router is the single best answer to
// "route across all my keys", so it leads. Anything the catalogue grows later
// still appears (appended), it just does not get a hand-picked position.
const TEMPLATE_ORDER = ["airouter", "openrouter", "ollama", "google", "cloudflare", "github", "custom"];

const TEMPLATES: ProviderTemplateSummary[] = (() => {
  const all = listProviderTemplates();
  const byId = new Map(all.map((t) => [t.id, t]));
  const ordered = TEMPLATE_ORDER
    .map((id) => byId.get(id))
    .filter((t): t is ProviderTemplateSummary => t != null);
  const rest = all.filter((t) => !TEMPLATE_ORDER.includes(t.id));
  return [...ordered, ...rest];
})();

const TEMPLATE_BY_ID: Record<string, ProviderTemplateSummary> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

// One-line guidance per kind. Not a catalogue — the catalogue is templates.ts.
const BLURBS: Record<string, string> = {
  airouter:
    "Your own router. One entry that picks among every provider you have keys for — "
    + "switching on failure, rate limits and cooldowns. Models are quality groups, not model names.",
  openrouter: "Many models behind one key.",
  ollama: "Models running on this machine.",
  google: "Gemini models.",
  cloudflare: "Edge-hosted models.",
  github: "GitHub-hosted catalogue.",
  custom: "Any endpoint that speaks the OpenAI shape.",
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "provider";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so the caller can refresh its badges. */
  onSaved?: (providers: ProviderRow[]) => void;
  /** Render the body only — the caller supplies the dialog chrome. */
  inline?: boolean;
}

type Draft = {
  id: string;
  templateId: string;
  label: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
  enabled: boolean;
};

const emptyDraft = (templateId = "airouter"): Draft => {
  const t = TEMPLATE_BY_ID[templateId];
  return {
    id: "",
    templateId,
    label: t?.label || "",
    apiKey: "",
    baseUrl: t?.defaultBaseUrl || "",
    models: t ? [...t.suggestedModels] : [],
    enabled: true,
  };
};

const softBtn = { border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" } as const;
const accentBtn = {
  background: "var(--page-accent-14)",
  border: "1px solid color-mix(in srgb, var(--page-accent) 32%, transparent)",
  color: "var(--page-accent)",
} as const;

export function AiProviderManager({ open, onClose, onSaved, inline }: Props) {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [snapshot, setSnapshot] = useState<string>("[]");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editing, setEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [routerState, setRouterState] = useState<"unknown" | "up" | "down">("unknown");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [testing, setTesting] = useState<Record<string, { s: "testing" | "ok" | "fail"; msg?: string }>>({});

  const dirty = JSON.stringify(providers) !== snapshot;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await (window as any).deskflowAPI?.getAiProviders?.();
      const rows: ProviderRow[] = Array.isArray(r?.providers)
        ? r.providers
        : Array.isArray(r)
          ? r
          : [];
      setProviders(rows);
      setSnapshot(JSON.stringify(rows));
    } catch (e: any) {
      setError(e?.message || "Could not read the provider list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Probe the router while any airouter entry is in play (row badge or editor).
  useEffect(() => {
    if (!open) return;
    const wants = draft.templateId === "airouter" || providers.some((p) => p.templateId === "airouter");
    if (!wants) return;
    let live = true;
    const api = (window as any).deskflowAPI;
    if (typeof api?.airouter?.status !== "function") return;
    void Promise.resolve(api.airouter.status()).then((r: any) => {
      if (live) setRouterState(r?.success ? "up" : "down");
    });
    return () => {
      live = false;
    };
  }, [open, draft.templateId, providers]);

  const pickTemplate = (id: string) => {
    setDraft((d) => {
      const t = TEMPLATE_BY_ID[id];
      return {
        ...d,
        templateId: id,
        label: d.label || t?.label || "",
        baseUrl: t?.defaultBaseUrl || d.baseUrl,
        models: t ? [...t.suggestedModels] : d.models,
      };
    });
  };

  const startAdd = () => {
    setDraft(emptyDraft("airouter"));
    setEditing(true);
    setShowKey(false);
  };

  const startEdit = (p: ProviderRow) => {
    setDraft({
      id: p.id,
      templateId: p.templateId,
      label: p.label,
      apiKey: p.apiKey || "",
      baseUrl: p.baseUrl || TEMPLATE_BY_ID[p.templateId]?.defaultBaseUrl || "",
      models: [...(p.models || [])],
      enabled: p.enabled !== false,
    });
    setEditing(true);
    setShowKey(false);
  };

  // Suggestions for the models field: the template's catalogue models plus any
  // model id already stored on ANOTHER provider (reuse, not retype).
  const modelSuggestions = useMemo(() => {
    const t = TEMPLATE_BY_ID[draft.templateId];
    const others = providers.filter((p) => p.id !== draft.id).flatMap((p) => p.models || []);
    return [...new Set([...(t?.suggestedModels || []), ...others])];
  }, [draft.templateId, draft.id, providers]);

  const commit = () => {
    const t = TEMPLATE_BY_ID[draft.templateId];
    const label = draft.label.trim() || t?.label || "Provider";
    let id = draft.id || slug(draft.templateId === "airouter" ? "ai-router" : label);
    if (!draft.id) {
      // Never let a new row silently collide with an existing id.
      const base = id;
      let n = 2;
      while (providers.some((p) => p.id === id)) id = `${base}-${n++}`;
    }
    const models = draft.models.map((s) => s.trim()).filter(Boolean);
    if (!models.length) {
      setError("Add at least one model — for the AI Router, a group like auto or fast.");
      return;
    }
    if (t?.requiresKey && !draft.apiKey.trim() && !draft.id) {
      setError(`${t.label} needs an API key.`);
      return;
    }
    if (!draft.baseUrl.trim() && draft.templateId === "custom") {
      setError("A custom provider needs a base URL.");
      return;
    }

    const row: ProviderRow = {
      id,
      templateId: draft.templateId,
      label,
      enabled: draft.enabled,
      models,
      priority: providers.length,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      ...(draft.baseUrl.trim() ? { baseUrl: draft.baseUrl.trim() } : {}),
    };

    setProviders((cur) => (draft.id ? cur.map((p) => (p.id === draft.id ? row : p)) : [...cur, row]));
    setEditing(false);
    setError(null);
  };

  const remove = (id: string) => {
    setProviders((p) => p.filter((x) => x.id !== id));
    setConfirmRemove(null);
  };

  const toggleEnabled = (id: string) =>
    setProviders((cur) => cur.map((p) => (p.id === id ? { ...p, enabled: p.enabled === false } : p)));

  const runTest = async (p: ProviderRow) => {
    const api = (window as any).deskflowAPI;
    if (typeof api?.testAiProvider !== "function") {
      setTesting((t) => ({ ...t, [p.id]: { s: "fail", msg: "Testing is not available in this build." } }));
      return;
    }
    setTesting((t) => ({ ...t, [p.id]: { s: "testing" } }));
    try {
      const r = await api.testAiProvider(p.id);
      setTesting((t) => ({
        ...t,
        [p.id]: r?.success ? { s: "ok" } : { s: "fail", msg: r?.error || "Request failed" },
      }));
    } catch (e: any) {
      setTesting((t) => ({ ...t, [p.id]: { s: "fail", msg: e?.message || "Request failed" } }));
    }
  };

  const persist = async () => {
    setSaving(true);
    setError(null);
    try {
      // Preserve the existing routing block — this manager only owns `providers`.
      const cur = await (window as any).deskflowAPI?.getAiProviders?.();
      const routing = cur?.routing ?? {
        default: { providerId: providers[0]?.id ?? "", model: providers[0]?.models?.[0] ?? "" },
      };
      const r = await (window as any).deskflowAPI?.saveAiProviders?.({ providers, routing });
      if (r && r.success === false) {
        setError(r.error || "Could not save the provider list.");
        return;
      }
      setSnapshot(JSON.stringify(providers));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.(providers);
    } catch (e: any) {
      setError(e?.message || "Could not save the provider list.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const banner = error ? (
    <div
      className="flex shrink-0 items-start gap-2 px-4 py-2"
      style={{ background: "color-mix(in srgb, var(--color-destructive) 10%, transparent)", borderBottom: "1px solid var(--ws-border)" }}
    >
      <AlertTriangle size={12} style={{ color: "var(--color-destructive)", flexShrink: 0 }} className="mt-0.5" />
      <span className="text-[10px]" style={{ color: "var(--color-destructive)" }}>
        {error}
      </span>
      <button onClick={() => setError(null)} aria-label="Dismiss error" className="ml-auto rounded-lg p-0.5" style={{ color: "var(--color-destructive)" }}>
        <X size={11} />
      </button>
    </div>
  ) : null;

  const body = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {loading ? (
        <div className="space-y-1.5" aria-label="Loading providers">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-2" style={{ border: "1px solid var(--ws-border)", borderRadius: 8 }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ws-border-strong)" }} />
              <span className="h-2.5 flex-1 animate-pulse rounded-full" style={{ background: "var(--ws-border)" }} />
            </div>
          ))}
        </div>
      ) : providers.length === 0 && !editing ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Server size={22} style={{ color: "var(--color-muted-foreground)", opacity: 0.35 }} />
          <p className="text-[12px]" style={{ color: "var(--color-muted-foreground)" }}>
            No providers configured.
          </p>
          <p className="max-w-sm text-[10px]" style={{ color: "var(--color-muted-foreground)", opacity: 0.75 }}>
            Add one below — or add the AI Router, which presents as a single provider and switches between your keys for you.
          </p>
          <button onClick={startAdd} className="mt-1 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px]" style={accentBtn}>
            <Plus size={11} /> Add provider
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-2.5 py-2" style={{ border: "1px solid var(--ws-border)", borderRadius: 8 }}>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: p.enabled === false ? "var(--color-muted-foreground)" : "var(--color-emerald-400)" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium" style={{ color: "var(--color-foreground)" }}>
                  {p.label}
                </div>
                <div className="truncate text-[9px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}>
                  {p.templateId} · {(p.models || []).slice(0, 4).join(", ")}
                  {(p.models || []).length > 4 ? ` +${p.models.length - 4}` : ""}
                  {p.apiKey ? " · key set" : ""}
                </div>
                {testing[p.id]?.s === "fail" && (
                  <div className="truncate text-[9px]" title={testing[p.id]?.msg} style={{ color: "var(--color-destructive)" }}>
                    {testing[p.id]?.msg}
                  </div>
                )}
              </div>
              {p.templateId === "airouter" && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    border: "1px solid var(--ws-border)",
                    color: routerState === "up" ? "var(--color-emerald-400)" : "var(--color-muted-foreground)",
                  }}
                >
                  {routerState === "up" ? "router up" : "router idle"}
                </span>
              )}
              {testing[p.id]?.s === "ok" && (
                <span className="text-[9px]" style={{ color: "var(--color-emerald-400)" }}>
                  OK
                </span>
              )}
              {confirmRemove === p.id ? (
                <>
                  <span className="text-[9px]" style={{ color: "var(--color-muted-foreground)" }}>
                    Remove {p.label}?
                  </span>
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded-lg px-1.5 py-0.5 text-[9px]"
                    style={{ border: "1px solid color-mix(in srgb, var(--color-destructive) 40%, transparent)", color: "var(--color-destructive)" }}
                  >
                    Remove
                  </button>
                  <button onClick={() => setConfirmRemove(null)} className="rounded-lg px-1.5 py-0.5 text-[9px]" style={softBtn}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => void runTest(p)}
                    disabled={testing[p.id]?.s === "testing"}
                    title="Send a ping using the SAVED configuration"
                    className="rounded-lg px-1.5 py-0.5 text-[9px] disabled:opacity-50"
                    style={softBtn}
                  >
                    {testing[p.id]?.s === "testing" ? <Loader2 size={10} className="animate-spin" /> : "Test"}
                  </button>
                  <button
                    role="switch"
                    aria-checked={p.enabled !== false}
                    aria-label={`${p.enabled === false ? "Enable" : "Disable"} ${p.label}`}
                    onClick={() => toggleEnabled(p.id)}
                    className="relative h-4 w-7 shrink-0 rounded-full transition-colors motion-reduce:transition-none"
                    style={{ background: p.enabled === false ? "var(--ws-border-strong)" : "var(--page-accent)" }}
                  >
                    <span
                      className="absolute top-0.5 h-3 w-3 rounded-full transition-transform motion-reduce:transition-none"
                      style={{
                        left: 2,
                        transform: p.enabled === false ? "none" : "translateX(12px)",
                        background: "var(--color-background)",
                      }}
                    />
                  </button>
                  <button onClick={() => startEdit(p)} className="rounded-lg px-1.5 py-0.5 text-[9px]" style={softBtn}>
                    Edit
                  </button>
                  <button onClick={() => setConfirmRemove(p.id)} aria-label={`Remove ${p.label}`} className="rounded-lg p-1" style={{ color: "var(--color-muted-foreground)" }}>
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="space-y-2.5 p-3"
          style={{
            border: "1px solid color-mix(in srgb, var(--page-accent) 28%, transparent)",
            borderRadius: 8,
            background: "var(--page-accent-10)",
          }}
        >
          <div className="text-[10px] uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}>
            {draft.id ? "Edit provider" : "Add provider"}
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Kind
            </span>
            <select
              value={draft.templateId}
              onChange={(e) => pickTemplate(e.target.value)}
              className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
              style={{ background: "var(--color-background)", border: "1px solid var(--ws-border)", color: "var(--color-foreground)" }}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
            {BLURBS[draft.templateId]}
          </p>

          {draft.templateId === "airouter" && (
            <div className="flex items-start gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--page-accent-10)" }}>
              <Zap size={12} style={{ color: "var(--page-accent)", flexShrink: 0 }} className="mt-0.5" />
              <p className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                Start it with <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-foreground)" }}>airouter run</span> in your
                ai-router folder. No API key needed — it holds your keys itself.
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Display name
            </span>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="My router"
              className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
              style={{ background: "var(--color-background)", border: "1px solid var(--ws-border)", color: "var(--color-foreground)" }}
            />
          </label>

          {TEMPLATE_BY_ID[draft.templateId]?.requiresKey && (
            <label className="block">
              <span className="mb-1 block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                API key {draft.id ? "(leave blank to keep the saved key)" : ""}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--ws-border)",
                    color: "var(--color-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                  className="rounded-lg p-1"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Base URL
            </span>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://…/v1/chat/completions"
              className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
              style={{
                background: "var(--color-background)",
                border: "1px solid var(--ws-border)",
                color: "var(--color-foreground)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Models / groups — type to search, Enter to store
            </span>
            <ModelsField
              value={draft.models}
              options={modelSuggestions}
              onChange={(models) => setDraft({ ...draft, models })}
              placeholder="Type a model id, e.g. gemini-2.5-flash"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg px-2.5 py-1 text-[10px]"
              style={softBtn}
            >
              Cancel
            </button>
            <button onClick={commit} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium" style={accentBtn}>
              <Check size={11} /> {draft.id ? "Apply changes" : "Add to list"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--ws-border)" }}>
      <button onClick={startAdd} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px]" style={{ border: "1px solid var(--ws-border)", color: "var(--color-foreground)" }}>
        <Plus size={11} /> Add provider
      </button>
      <span className="text-[10px]" style={{ color: dirty ? "var(--color-amber-400)" : "var(--color-muted-foreground)" }}>
        {saved ? "Saved" : dirty ? "Unsaved changes" : `${providers.length} configured`}
      </span>
      <button
        onClick={() => void persist()}
        disabled={saving || !dirty}
        className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
        style={accentBtn}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
        Save providers
      </button>
    </div>
  );

  const content = (
    <>
      {banner}
      {body}
      {footer}
    </>
  );

  // Inline: the caller (unified dialog) owns the chrome and the flex column.
  if (inline) return content;

  return (
    <div
      role="dialog"
      aria-label="Manage AI providers"
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: "color-mix(in srgb, black 72%, transparent)" }}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden"
        style={{
          maxHeight: "min(86vh, 780px)",
          background: "var(--color-card)",
          border: "1px solid var(--ws-border-strong)",
          borderRadius: 12,
        }}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--ws-border)" }}>
          <Server size={13} style={{ color: "var(--page-accent)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-foreground)" }}>
            AI Providers
          </span>
          <span className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}>
            {providers.length} configured
          </span>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1" style={{ color: "var(--color-muted-foreground)" }}>
            <X size={13} />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}

export default AiProviderManager;
