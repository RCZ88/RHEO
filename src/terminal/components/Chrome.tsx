import { useState } from "react";
import { Boxes, Copy, GitBranch, Maximize2, Minus, Pin, Plus, Search, SplitSquareHorizontal, X } from "lucide-react";
import type { Store } from "../hooks/useConsoleStore";
import { TabIcon } from "./TabIcon";
import { cx } from "../lib/utils";
import { ClockDropdown } from "../../components/ClockDropdown";

export function TabStrip({ store, onNewTab }: { store: Store; onNewTab: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<string | null>(null);

  const visible = store.sortedTabs.filter((t) =>
    (store.groupFilter === "all" || t.groupId === store.groupFilter) &&
    t.label.toLowerCase().includes(store.tabSearch.toLowerCase())
  );

  const startRename = (id: string, label: string) => { setEditing(id); setDraft(label); setCtx(null); };
  const commit = (id: string) => {
    if (draft.trim()) store.mutateTab(id, (t) => ({ ...t, label: draft.trim().slice(0, 40) }));
    setEditing(null);
  };

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    store.setTabs((prev) => {
      const from = prev.findIndex((t) => t.id === dragId);
      const to = prev.findIndex((t) => t.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1.5 overflow-x-auto" style={{ background: "var(--t-bg)" }} onClick={() => setCtx(null)}>
      {visible.map((t, i) => {
        const active = t.id === store.activeTabId;
        const g = store.groups.find((x) => x.id === t.groupId);
        const panes = Object.keys(t.panes).length;
        return (
          <div
            key={t.id}
            draggable={editing !== t.id}
            onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragId(null); setDropId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDropId(t.id); }}
            onDragLeave={() => setDropId((d) => (d === t.id ? null : d))}
            onDrop={(e) => { e.preventDefault(); reorder(t.id); setDragId(null); setDropId(null); }}
            onClick={() => store.setActiveTabId(t.id)}
            onDoubleClick={() => startRename(t.id, t.label)}
            onContextMenu={(e) => { e.preventDefault(); setCtx(ctx === t.id ? null : t.id); }}
            className={cx("group relative flex items-center gap-2 pl-3 pr-1.5 h-10 rounded-xl border cursor-pointer select-none shrink-0 transition-colors", active ? "shadow-lg" : "hover:border-[var(--t-accent)]", dragId === t.id && "tab-dragging", dropId === t.id && dragId !== t.id && "tab-drop-hint")}
            style={{
              background: active ? "var(--t-panel2)" : "var(--t-panel)",
              borderColor: active ? t.color : "var(--t-border)",
              boxShadow: active ? `0 6px 22px -10px ${t.color}66` : undefined,
              minWidth: 168, maxWidth: 248,
            }}
            title={`${t.label} — double-click rename · right-click menu · drag to reorder`}
          >
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: t.color }} />
            {t.pinned ? <Pin size={12} className="shrink-0 fill-current" style={{ color: t.color }} /> : <TabIcon name={t.icon} size={14} className="shrink-0" />}
            {editing === t.id ? (
              <input
                autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(t.id); if (e.key === "Escape") setEditing(null); e.stopPropagation(); }}
                onClick={(e) => e.stopPropagation()}
                className="w-28 bg-transparent outline-none text-[12.5px] font-semibold border-b mono" style={{ color: "var(--t-fg)", borderColor: t.color }}
                aria-label="rename tab"
              />
            ) : (
              <span className="text-[12.5px] font-semibold truncate flex-1" style={{ color: "var(--t-fg)" }}>{i + 1}. {t.label}</span>
            )}
            <span className="hidden group-hover:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button title="Split horizontal" onClick={() => store.splitPane(t.id, t.activePaneId, "row")} className="w-6 h-6 rounded-md grid place-items-center hover:bg-white/10" style={{ color: "var(--t-muted)" }}><SplitSquareHorizontal size={13} /></button>
              <button title="Close tab" onClick={() => store.closeTab(t.id)} className="w-6 h-6 rounded-md grid place-items-center hover:bg-red-500/80 hover:text-white" style={{ color: "var(--t-muted)" }}><X size={13} /></button>
            </span>
            <span className="flex group-hover:hidden items-center gap-1.5 shrink-0">
            <span className="text-[9.5px] mono font-semibold px-1 rounded" style={{ background: `${t.color}22`, color: t.color }}>×{panes}</span>
              <span className="text-[9.5px] mono px-1 rounded" style={{ background: "color-mix(in srgb, var(--t-accent) 12%, transparent)", color: "var(--t-muted)" }}>{t.stats.cmdCount}</span>
            </span>
            {g && <span title={g.name} className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />}
            {ctx === t.id && (
              <div className="absolute top-11 left-0 z-40 w-52 rounded-xl border overflow-hidden anim-pop shadow-2xl" style={{ background: "var(--t-panel2)", borderColor: "var(--t-border)" }} onClick={(e) => e.stopPropagation()}>
                {[
                  { l: "Rename", fn: () => startRename(t.id, t.label) },
                  { l: t.pinned ? "Unpin" : "Pin to front", fn: () => { store.togglePin(t.id); setCtx(null); } },
                  { l: "Duplicate", fn: () => { store.duplicateTab(t.id); setCtx(null); } },
                  { l: "Split horizontal", fn: () => { store.splitPane(t.id, t.activePaneId, "row"); setCtx(null); } },
                  { l: "Split vertical", fn: () => { store.splitPane(t.id, t.activePaneId, "col"); setCtx(null); } },
                  { l: "Save as workspace", fn: () => { store.saveWorkspace(t.label); setCtx(null); } },
                  { l: "Close", fn: () => { store.closeTab(t.id); setCtx(null); } },
                ].map((a) => (
                  <button key={a.l} onClick={a.fn} className="w-full text-left px-3.5 py-2 text-[12px] font-medium hover:bg-white/5 transition" style={{ color: "var(--t-fg)" }}>{a.l}</button>
                ))}
                <div className="px-3.5 py-2 border-t" style={{ borderColor: "var(--t-border)" }}>
          <div className="text-[9.5px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--t-muted)" }}>Move to group</div>
                  <div className="flex flex-wrap gap-1">
                    {store.groups.map((gg) => (
                      <button key={gg.id} onClick={() => { store.moveTabToGroup(t.id, gg.id); setCtx(null); }} className="flex items-center gap-1 text-[10.5px] px-1.5 py-1 rounded-md border" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: gg.color }} />{gg.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={onNewTab} title="New tab" className="w-10 h-10 rounded-xl border border-dashed grid place-items-center shrink-0 transition hover:border-solid" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Plus size={16} /></button>
      {(store.groupFilter !== "all" || store.tabSearch) && (
        <button onClick={() => { store.setGroupFilter("all"); store.setTabSearch(""); }} className="h-8 px-3 rounded-lg text-[11.5px] font-medium shrink-0 border" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>Clear filter ×</button>
      )}
      <div className="ml-auto shrink-0 pl-2 flex items-center">
        <ClockDropdown label="Timers, stopwatch and alarms">
          <span className="text-xs mono text-zinc-400">Timers</span>
        </ClockDropdown>
      </div>
    </div>
  );
}

export function LeftSidebar({ store, onPresets, onWorkspaces, onNewTab }: { store: Store; onPresets: () => void; onWorkspaces: () => void; onNewTab: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyCwd = (paneId: string, cwd: string) => {
    navigator.clipboard?.writeText(cwd).catch(() => {});
    setCopied(paneId);
    setTimeout(() => setCopied(null), 1200);
  };
  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}>
      {/* ── SIDEBAR HEADER ────────────────────────────────────────────────
          This was four competing controls stacked in a column: an oversized
          full-width "New tab" button, a bordered "Presets" button, a filter
          field, and then a WRAPPING ROW of group-filter pills (All 3 /
          Development 1 / DevOps 1 / System 1 / Experiments 0) that changed
          width and count every time a group was added. Five pills of noise
          above a list of names.

          It is now one compact toolbar plus ONE group control, so the sidebar
          opens on navigation instead of on chrome. */}
      <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewTab}
            title="New tab (Ctrl+Shift+T)"
            className="df-tool-btn h-8 px-2.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 shrink-0"
            style={{ color: "var(--t-fg)" }}
          >
            <Plus size={13} />New tab
          </button>
          <button
            onClick={onPresets}
            title="Presets"
            aria-label="Presets"
            className="df-tool-btn h-8 w-8 rounded-lg grid place-items-center shrink-0"
            style={{ color: "var(--t-muted)" }}
          >
            <Boxes size={14} />
          </button>
          <div className="flex-1" />
          {/* ONE group control instead of N pills. Shows the active scope and
              how many tabs it holds; the count is the useful part, the label is
              the part you already know. */}
          <button
            onClick={() => store.setGroupFilter(store.groupFilter === "all" ? (store.groups[0]?.id ?? "all") : "all")}
            title={store.groupFilter === "all" ? "Show one group" : "Show all groups"}
            className="df-tool-btn h-8 px-2 rounded-lg text-[11px] mono flex items-center gap-1.5 shrink-0 tabular-nums"
            style={{ color: "var(--t-muted)" }}
          >
            {store.groupFilter === "all"
              ? <>All<span className="opacity-60">{store.tabs.length}</span></>
              : <>{store.groups.find((g) => g.id === store.groupFilter)?.name ?? "Group"}<span className="opacity-60">{store.tabs.filter((t) => t.groupId === store.groupFilter).length}</span></>}
          </button>
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--t-muted)" }} />
          <input
            value={store.tabSearch}
            onChange={(e) => store.setTabSearch(e.target.value)}
            placeholder="Filter tabs"
            aria-label="filter tabs"
            className="w-full h-8 pl-8 pr-7 rounded-lg text-[12px] outline-none border transition-colors"
            style={{ background: "var(--df-plane-3, var(--t-bg))", borderColor: "var(--t-border)", color: "var(--t-fg)" }}
          />
          {store.tabSearch && (
            <button
              onClick={() => store.setTabSearch("")}
              aria-label="clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded grid place-items-center hover:bg-[var(--t-fg)]/[0.07]"
              style={{ color: "var(--t-muted)" }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* The sidebar needs a SPINE, otherwise the nav is one undifferentiated
          stack of names and the group headers read as more rows rather than as
          structure. */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-2 min-h-0">
        <div className="df-section-label flex items-center gap-1.5 px-0.5">
          <span className="text-[9px] mono uppercase tracking-[0.09em]" style={{ color: "var(--t-muted)" }}>
            Tabs
          </span>
          <span className="flex-1 h-px" style={{ background: "var(--t-border)" }} />
          <span className="text-[9px] mono tabular-nums" style={{ color: "var(--t-muted)" }}>
            {store.tabs.length}
          </span>
        </div>
        {store.groups.filter((g) => store.groupFilter === "all" || g.id === store.groupFilter).map((g) => {
          const gtabs = store.tabs.filter((t) => t.groupId === g.id && t.label.toLowerCase().includes(store.tabSearch.toLowerCase()));
          if (!gtabs.length && !g.collapsed) return null;
          if (!gtabs.length) return null;
          return (
            <div key={g.id}>
              <button onClick={() => store.setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, collapsed: !x.collapsed } : x))} className="w-full flex items-center gap-2 px-1 mb-1.5" aria-expanded={!g.collapsed}>
                <span className="text-[10px] mono w-3" style={{ color: "var(--t-muted)" }}>{g.collapsed ? "▸" : "▾"}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--t-muted)" }}>{g.name}</span>
                <span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{gtabs.length}</span>
                <div className="flex-1 h-px" style={{ background: "var(--t-border)" }} />
              </button>
              {!g.collapsed && (
              <div className="space-y-1.5">
                {gtabs.map((t) => {
                  const active = t.id === store.activeTabId;
                  return (
                    /* ── ONE ROW PER TAB. ──────────────────────────────────────
                       This used to be a bordered card with the pane list
                       NESTED INSIDE it, so each navigation item rendered as a
                       small multi-row widget. Three tabs became nine competing
                       blocks of chrome, and the sidebar read as "a pile of
                       little components" rather than as navigation -- which is
                       the inversion you spotted: the nav was weaker than the
                       panels it navigates to.

                       Navigation is now one flat row per destination, with the
                       pane detail demoted to a single quiet meta line, and the
                       row actions revealed on hover so a resting sidebar shows
                       only names. Selection is an accent LEFT BAR, not a second
                       bordered box -- the same language the inspector uses. */
                    <div
                      key={t.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => store.setActiveTabId(t.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); store.setActiveTabId(t.id); } }}
                      className="group/nav relative flex items-center gap-2 h-9 pl-2.5 pr-1.5 rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: active ? "color-mix(in srgb, var(--t-accent) 11%, transparent)" : "transparent",
                      }}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: "var(--t-accent)" }} />
                      )}
                      <span className="shrink-0" style={{ color: active ? "var(--t-accent)" : "var(--t-muted)" }}>
                        {t.pinned ? <Pin size={13} className="fill-current" /> : <TabIcon name={t.icon} size={14} />}
                      </span>
                      <span className="text-[13px] truncate flex-1" style={{ color: "var(--t-fg)", fontWeight: active ? 600 : 500 }}>
                        {t.label}
                      </span>
                      <span className="text-[10px] mono shrink-0 tabular-nums" style={{ color: "var(--t-muted)" }}>
                        {Object.keys(t.panes).length}⌁
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/nav:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button title={t.pinned ? "Unpin" : "Pin"} onClick={(e) => { e.stopPropagation(); store.togglePin(t.id); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-[var(--t-fg)]/[0.07]" aria-label={`Pin ${t.label}`}><Pin size={11} /></button>
                        <button title="Duplicate" onClick={(e) => { e.stopPropagation(); store.duplicateTab(t.id); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-[var(--t-fg)]/[0.07]" aria-label={`Duplicate ${t.label}`}><Copy size={11} /></button>
                        <button title="Close" onClick={(e) => { e.stopPropagation(); store.closeTab(t.id); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-[var(--pc-danger-15)] hover:text-[var(--pc-danger)]" aria-label={`Close ${t.label}`}><X size={12} /></button>
                      </span>
                      {/* pane detail: ONE quiet meta line, not a nested list */}
                      {Object.values(t.panes).length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); const p0 = Object.values(t.panes)[0]; store.setActiveTabId(t.id); store.focusPane(t.id, p0.id); copyCwd(p0.id, p0.cwd); }}
                          title="Focus pane & copy its path"
                          className="absolute left-2.5 right-2 top-full text-[10px] mono truncate text-left leading-none hover:text-[var(--t-fg)] transition-colors"
                          style={{ color: "var(--t-muted)", opacity: 0.75 }}
                        >
                          {copied === Object.values(t.panes)[0].id ? <span style={{ color: "var(--pc-success)" }}>copied ✓</span> : <>
                            {Object.values(t.panes)[0].cwd.replace("/home/user", "~")}
                            {Object.keys(t.panes).length > 1 ? `  +${Object.keys(t.panes).length - 1} more` : ""}
                          </>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)" }}>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--t-muted)" }}>Session</div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[{ v: store.stats.total, l: "cmds" }, { v: store.stats.today, l: "today" }, { v: store.stats.week, l: "7d" }, { v: store.stats.panes, l: "panes" }].map((s) => (
              <div key={s.l} className="rounded-lg py-1.5" style={{ background: "var(--t-panel2)" }}>
                <div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>{s.v}</div>
                <div className="text-[9.5px] uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => store.setRightTab("stats")} className="mt-2 w-full h-7 rounded-lg text-[11px] font-semibold transition hover:brightness-110" style={{ background: "color-mix(in srgb, var(--t-accent) 16%, transparent)", color: "var(--t-accent)" }}>Open analytics →</button>
        </div>
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--t-muted)" }}>Workspaces</span>
            <button onClick={onWorkspaces} className="text-[10.5px] font-semibold" style={{ color: "var(--t-accent)" }}>View all</button>
          </div>
          {store.workspaces.slice(0, 3).map((w) => (
            <button key={w.id} onClick={() => store.restoreWorkspace(w.id)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border mb-1.5 transition hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: w.color }} />
              <span className="text-[12px] font-semibold truncate flex-1 text-left" style={{ color: "var(--t-fg)" }}>{w.name}</span>
              <span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{w.tabs.length} tabs</span>
            </button>
          ))}
          {!store.workspaces.length && <div className="text-[11.5px] px-1" style={{ color: "var(--t-muted)" }}>No snapshots yet — save one with <span className="mono">Ctrl+Shift+S</span>.</div>}
        </div>
      </div>
    </div>
  );
}

export function BottomBar({ store }: { store: Store }) {
  const t = store.activeTab;
  const pane = t?.panes[t.activePaneId];
  const mcpOn = store.mcp.filter((m) => m.enabled).length;
  return (
    <div className="h-8 shrink-0 flex items-center gap-4 px-3 text-[11px] mono border-t overflow-x-auto whitespace-nowrap" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)", color: "var(--t-muted)" }}>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full anim-pulse-dot" style={{ background: t?.color }} /><b style={{ color: "var(--t-fg)" }}>{t?.label}</b></span>
      <span className="hidden sm:flex items-center gap-1"><Maximize2 size={11} />{t ? Object.keys(t.panes).length : 0} panes</span>
      <span className="hidden md:flex items-center gap-1"><GitBranch size={11} />{pane?.cwd.replace("/home/user", "~")}</span>
      <span className="hidden lg:inline">{store.shell} · main* ⇅ 0</span>
      <div className="flex-1" />
      {store.broadcastTabId && <span className="font-semibold" style={{ color: "var(--pc-danger)" }}>● BROADCAST</span>}
      <span>{store.distro.split(" ")[0].toLowerCase()} · utf-8</span>
      <span className="hidden sm:inline" style={{ color: "var(--t-accent)" }}>⬡ mcp:{mcpOn}/{store.mcp.length}</span>
      <span className="hidden sm:inline" title="Shell syntax colours only — the console chrome follows the app theme">syntax: {store.theme.name}</span>
      <span className="flex items-center gap-1"><Minus size={10} />{store.stats.total} cmds</span>
      <span className="hidden md:inline opacity-70">Ctrl+K palette · Ctrl+Shift+S workspace</span>
    </div>
  );
}
