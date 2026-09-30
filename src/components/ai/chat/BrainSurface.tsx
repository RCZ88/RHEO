// BrainSurface — the Context Brain, mounted on AI Assistant.
//
// The brain was living inside LifePage's `self` tab, which put AI/knowledge
// infrastructure under "who the user is" and left three built components
// unreachable (ExternalAITrail, ContextRetrievalPanel, and ContextGraphView
// itself, whose only mount site was a never-rendered import). Moving it here
// puts it beside the AI Context viewer it already shares a pipeline with.
//
// Every panel below is a pre-existing component, re-skinned to LAMINAR: flat
// surfaces + hairline, no backdrop-blur on chrome, radii 8/12, and the AI
// surface's single signal hue.

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Network, Search, Zap, History, Loader2, AlertTriangle } from "lucide-react";

import { BrainManagementView } from "@/features/warmth/context-brain/BrainManagementView";
import { ContextRetrievalPanel } from "@/features/warmth/context-brain/ContextRetrievalPanel";
import { ExternalAITrail } from "@/features/warmth/context-brain/ExternalAITrail";
import { BrainVisualization } from "@/features/warmth/context-brain/BrainVisualization";
import { ActivityFeed } from "@/features/warmth/context-brain/ActivityFeed";
import { EntityDetailPanel } from "@/features/warmth/context-graph/EntityDetailPanel";

type Tab = "graph" | "search" | "trail" | "manage";

const TABS: Array<{ id: Tab; label: string; icon: typeof Brain; hint: string }> = [
  { id: "graph", label: "Graph", icon: Network, hint: "Knowledge graph" },
  { id: "search", label: "Search", icon: Search, hint: "Query the brain" },
  { id: "trail", label: "Trail", icon: Zap, hint: "External AI → brain" },
  { id: "manage", label: "Manage", icon: Brain, hint: "Entities, facts, jobs" },
];

const REDUCED = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface GraphData {
  nodes: any[];
  links: any[];
  factCount: number;
}

export function BrainSurface({ onOpenLibrary }: { onOpenLibrary?: () => void }) {
  const [tab, setTab] = useState<Tab>("graph");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [box, setBox] = useState({ w: 640, h: 420 });
  const hostRef = useRef<HTMLDivElement | null>(null);
  const reduced = REDUCED();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (window as any).deskflowAPI;
      const [entities, facts] = await Promise.all([
        api?.brainGetEntities?.({ limit: 300 }) ?? Promise.resolve({ items: [] }),
        api?.brainGetFacts?.({ currentOnly: true, limit: 600 }) ?? Promise.resolve({ items: [] }),
      ]);
      // Both brain list handlers return { items, total } — NOT { entities } / { facts }.
      const ents: any[] = entities?.items || [];
      const fcts: any[] = facts?.items || [];
      const byId = new Map<string, any>();
      for (const e of ents) {
        byId.set(e.id, {
          id: e.id,
          name: e.name,
          group: e.type || "entity",
        });
      }
      const links = fcts
        .map((f: any) => {
          const s = byId.get(f.subjectId);
          const o = byId.get(f.objectId);
          if (!s || !o) return null;
          return { source: s.id, target: o.id };
        })
        .filter(Boolean) as any[];
      // A fact with object_id NULL is a literal ("has_conversation: ..."), not an
      // edge — it counts as a fact but never becomes a link.
      setGraph({ nodes: ents, links, factCount: fcts.length });
    } catch (e: any) {
      setError(e?.message || "Could not read the knowledge graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Canvas sizing — BrainVisualization needs a real box or it renders nothing.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.max(320, Math.round(r.width)), h: Math.max(260, Math.round(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  return (
    <div className="flex flex-col" style={{ height: "100%", minHeight: 0 }}>
      <div
        className="flex items-center gap-1.5 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--ws-border)" }}
      >
        <Brain size={13} style={{ color: "var(--color-amber-400)" }} />
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.hint}
              aria-pressed={on}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors focus:outline-none focus-visible:ring-2"
              style={
                on
                  ? {
                      background: "rgba(251,191,36,0.14)",
                      color: "var(--color-amber-400)",
                      border: "1px solid rgba(251,191,36,0.3)",
                    }
                  : { border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }
              }
            >
              <Icon size={10} />
              {t.label}
            </button>
          );
        })}
        <span
          className="ml-1 text-[9px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}
        >
          {graph ? `${graph.nodes.length} entities · ${graph.factCount} facts · ${graph.links.length} links` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => void load()}
            className="rounded p-1 transition-colors focus:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-muted-foreground)" }}
            aria-label="Reload brain"
            title="Reload"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <History size={12} />
            )}
          </button>
          {onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              className="px-2 py-1 rounded-md text-[10px] transition-colors focus:outline-none focus-visible:ring-2"
              style={{ border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }}
              title="Search every conversation"
            >
              Chats
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 px-4 py-2.5 shrink-0"
          style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid var(--ws-border)" }}
        >
          <AlertTriangle size={13} style={{ color: "var(--color-destructive)" }} className="shrink-0 mt-0.5" />
          <span className="text-[11px]" style={{ color: "var(--color-destructive)" }}>
            {error}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={hostRef}>
        {tab === "graph" && (
          <div className="flex flex-col gap-4" style={{ transitionDuration: reduced ? "0ms" : "150ms" }}>
            <div style={{ height: box.h, minHeight: 260 }}>
              {loading ? (
                <div
                  className="h-full flex items-center justify-center gap-2 text-[11px]"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  <Loader2 size={13} className="animate-spin" /> Building knowledge graph…
                </div>
              ) : !graph || graph.nodes.length === 0 ? (
                <div
                  className="h-full flex flex-col items-center justify-center gap-2 text-center px-6"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  <Network size={22} style={{ opacity: 0.35 }} />
                  <p className="text-[12px]">The graph is empty.</p>
                  <p className="text-[10px] max-w-sm">
                    It fills as conversations are captured. Have a chat with any AI, or let
                    the browser extension capture one, then reload.
                  </p>
                </div>
              ) : (
                <BrainVisualization
                  nodes={graph.nodes as any}
                  links={graph.links as any}
                  width={box.w}
                  height={box.h}
                  state="populated"
                  livelinessLevel="L1"
                  reducedMotion={reduced}
                  selectedNode={selectedNode}
                  onNodeClick={(n: any) => setSelectedNode((cur: any) => (cur?.id === n?.id ? null : n ?? null))}
                />
              )}
            </div>
            {selectedNode && (
              <EntityDetailPanel node={selectedNode as any} onClose={() => setSelectedNode(null)} />
            )}
            <div style={{ borderTop: "1px solid var(--ws-border)", paddingTop: 16 }}>
              <div
                className="text-[9px] uppercase tracking-wider mb-2"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}
              >
                Recent activity
              </div>
              {graph && graph.nodes.length > 0 ? (
                <ActivityFeed nodes={graph.nodes as any} reducedMotion={reduced} />
              ) : (
                <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                  No activity recorded yet.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "search" && <ContextRetrievalPanel />}
        {tab === "trail" && <ExternalAITrail />}

        {tab === "manage" && (
          <div>
            <BrainManagementView />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrainSurface;
