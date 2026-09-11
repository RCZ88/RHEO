import { useEffect, useMemo, useState } from "react";
import {
  AlignHorizontalDistributeCenter, ArrowDown, ArrowRight, Award, BarChart3, Check, ChevronDown, Clock, Copy, Cpu, Download,
  Equal, Flame, FlipHorizontal2, FolderGit2, History, Keyboard, Layers, ListOrdered, Monitor, Pencil, Pin, PinOff, Play, Plus, Plug, Search,
  Settings2, Star, Terminal, Trash2, Type, X, Zap, ZoomIn,
} from "lucide-react";
import type { MCPServer, PaneNode, SavedCommand, Shortcut, TerminalTab, ThemeDef } from "../lib/types";
import { DEFAULT_SHORTCUTS, FONT_OPTIONS, TAB_COLORS, THEMES } from "../lib/data";
import { DISTROS, LINUX_TIPS, MAIN_SNIPPET, PRELOAD_SNIPPET, SHELLS, isElectron } from "../lib/electron";
import { cx, download, fillDynamic, fmtClock, fmtDate, fmtTime, formatDuration, keysToLabel, normalizeCombo, parseDynamicParams, timeAgo } from "../lib/utils";
import type { Store } from "../hooks/useConsoleStore";
import { collectSplits, countLeaves, listPaneIds } from "../hooks/useConsoleStore";
import { ICON_CHOICES, TabIcon } from "./TabIcon";

function Section({ title, icon, right, children }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-3.5" style={{ borderColor: "var(--t-border)", background: "var(--t-panel)" }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}<h3 className="display font-bold text-[12.5px] tracking-tight flex-1" style={{ color: "var(--t-fg)" }}>{title}</h3>{right}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full h-9 px-3 rounded-xl border text-[12.5px] outline-none focus:border-[var(--t-accent)] transition";
const inputStyle = { background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" } as const;
const lbl = "text-[10.5px] font-bold uppercase tracking-wider";

/* ============ INSPECT ============ */
export function InspectPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const t = store.activeTab;
  const [label, setLabel] = useState(t?.label ?? "");
  const [note, setNote] = useState(t?.note ?? "");
  const [showGroups, setShowGroups] = useState(false);
  const [renameG, setRenameG] = useState<string | null>(null);
  const [gDraft, setGDraft] = useState("");
  useEffect(() => { setLabel(t?.label ?? ""); setNote(t?.note ?? ""); }, [t?.id, t?.label]); // eslint-disable-line
  if (!t) return null;
  const g = store.groups.find((x) => x.id === t.groupId);
  const leaves = listPaneIds(t.layout).length;
  const saveLabel = () => { if (label.trim()) { store.mutateTab(t.id, (x) => ({ ...x, label: label.trim().slice(0, 40) })); notify("Tab labeled"); } };
  const saveNote = () => { store.mutateTab(t.id, (x) => ({ ...x, note: note.trim().slice(0, 140) })); notify(note.trim() ? "Note saved" : "Note cleared"); };
  return (
    <div className="space-y-3 anim-fadeUp">
      <Section title="Active tab" icon={<Terminal size={14} style={{ color: "var(--t-accent)" }} />} right={<span className="text-[10px] mono px-1.5 py-0.5 rounded-md" style={{ background: `${t.color}1c`, color: t.color }}>{t.stats.cmdCount} cmds</span>}>
        <label className={lbl} style={{ color: "var(--t-muted)" }}>Label</label>
        <div className="flex gap-2 mt-1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { saveLabel(); (e.target as HTMLInputElement).blur(); } }} placeholder={t.label} aria-label="tab label" className={cx(inputCls, "mono")} style={inputStyle} />
          <button onClick={saveLabel} aria-label="save label" className="h-9 px-3 rounded-xl text-white text-[12px] font-semibold shrink-0" style={{ background: t.color }}><Check size={14} /></button>
        </div>
        <label className={cx(lbl, "mt-3 block")} style={{ color: "var(--t-muted)" }}>Note</label>
        <div className="flex gap-2 mt-1">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNote(); }} placeholder="e.g. staging tail — do not kill" aria-label="tab note" className={cx(inputCls)} style={inputStyle} />
          <button onClick={saveNote} aria-label="save note" className="h-9 px-3 rounded-xl border text-[12px] font-semibold shrink-0" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><Check size={14} /></button>
        </div>
        <label className={cx(lbl, "mt-3 block")} style={{ color: "var(--t-muted)" }}>Color code</label>
        <div className="flex gap-1.5 mt-1.5 flex-wrap" role="radiogroup" aria-label="tab color">
          {TAB_COLORS.map((c) => (
            <button key={c} role="radio" aria-checked={t.color === c} aria-label={`color ${c}`} onClick={() => store.mutateTab(t.id, (x) => ({ ...x, color: c }))} className="w-7 h-7 rounded-lg transition hover:scale-110 grid place-items-center" style={{ background: c, outline: t.color === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }}>
              {t.color === c && <Check size={13} className="text-black/70" />}
            </button>
          ))}
        </div>
        <label className={cx(lbl, "mt-3 block")} style={{ color: "var(--t-muted)" }}>Icon</label>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {ICON_CHOICES.slice(0, 12).map((ic) => (
            <button key={ic} title={ic} onClick={() => store.mutateTab(t.id, (x) => ({ ...x, icon: ic }))} className="w-8 h-8 rounded-lg border grid place-items-center transition" style={{ borderColor: t.icon === ic ? t.color : "var(--t-border)", background: t.icon === ic ? `${t.color}18` : "transparent", color: t.icon === ic ? t.color : "var(--t-muted)" }}><TabIcon name={ic} size={14} /></button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          <div>
            <label className={lbl} style={{ color: "var(--t-muted)" }}>Group</label>
            <div className="relative mt-1">
              <button onClick={() => setShowGroups(!showGroups)} className="w-full h-9 px-3 rounded-xl border flex items-center gap-2 text-[12.5px] font-semibold" style={inputStyle}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: g?.color }} />{g?.name ?? "—"}<ChevronDown size={14} className="ml-auto" style={{ color: "var(--t-muted)" }} />
              </button>
              {showGroups && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border overflow-hidden anim-pop max-h-48 overflow-y-auto" style={{ background: "var(--t-panel2)", borderColor: "var(--t-border)" }}>
                  {store.groups.map((gg) => (
                    <button key={gg.id} onClick={() => { store.moveTabToGroup(t.id, gg.id); setShowGroups(false); notify(`Moved to ${gg.name}`); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-white/5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: gg.color }} /><span style={{ color: "var(--t-fg)" }}>{gg.name}</span>{gg.id === t.groupId && <Check size={13} className="ml-auto" style={{ color: "var(--t-accent)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={lbl} style={{ color: "var(--t-muted)" }}>Shell</label>
            <select value={t.shell ?? store.shell} onChange={(e) => { store.mutateTab(t.id, (x) => ({ ...x, shell: e.target.value })); notify(`Shell → ${e.target.value}`); }} className="w-full h-9 px-2 rounded-xl border text-[12.5px] mt-1 outline-none mono" style={inputStyle}>
              {SHELLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <button onClick={() => store.splitPane(t.id, t.activePaneId, "row")} className="h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 hover:border-[var(--t-accent)] transition" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><ArrowRight size={12} />Split</button>
          <button onClick={() => store.splitPane(t.id, t.activePaneId, "col")} className="h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 hover:border-[var(--t-accent)] transition" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><ArrowDown size={12} />Stack</button>
          <button onClick={() => store.duplicateTab(t.id)} className="h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 hover:border-[var(--t-accent)] transition" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><Copy size={12} />Clone</button>
          <button onClick={() => { store.togglePin(t.id); notify(t.pinned ? "Unpinned" : "Pinned to front"); }} className="h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 hover:border-[var(--t-accent)] transition" style={{ borderColor: t.pinned ? t.color : "var(--t-border)", color: t.pinned ? t.color : "var(--t-fg)" }}>{t.pinned ? <PinOff size={12} /> : <Pin size={12} />}{t.pinned ? "Unpin" : "Pin"}</button>
        </div>
      </Section>
      <Section title="Panes" icon={<Layers size={14} style={{ color: "var(--t-accent)" }} />} right={<span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{leaves} live</span>}>
        <div className="space-y-1.5">
          {Object.values(t.panes).map((p, i) => (
            <div key={p.id} onClick={() => store.focusPane(t.id, p.id)} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer transition" style={{ borderColor: t.activePaneId === p.id ? t.color : "var(--t-border)", background: t.activePaneId === p.id ? `${t.color}0c` : "transparent" }}>
              <span className="w-5 h-5 rounded-md grid place-items-center text-[10px] mono font-bold shrink-0" style={{ background: t.activePaneId === p.id ? t.color : "var(--t-border)", color: t.activePaneId === p.id ? "#0b0e17" : "var(--t-muted)" }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] mono truncate" style={{ color: "var(--t-fg)" }}>{p.cwd.replace("/home/user", "~")}</div>
                <div className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{p.cmdHistory.length} cmds · {p.lines.length} lines{p.lastExit ? ` · ✗${p.lastExit}` : ""}</div>
              </div>
              <button title="Zoom" onClick={(e) => { e.stopPropagation(); store.setZoom({ tabId: t.id, paneId: p.id }); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-white/10" style={{ color: "var(--t-muted)" }}><ZoomIn size={12} /></button>
              {Object.keys(t.panes).length > 1 && <button title="Close pane" onClick={(e) => { e.stopPropagation(); store.closePane(t.id, p.id); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-red-500/80 hover:text-white" style={{ color: "var(--t-muted)" }}><X size={12} /></button>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Groups" icon={<FolderGit2 size={14} style={{ color: "var(--t-accent)" }} />}>
        <GroupManager store={store} notify={notify} renameG={renameG} setRenameG={setRenameG} gDraft={gDraft} setGDraft={setGDraft} compact />
      </Section>
    </div>
  );
}

export function GroupManager({ store, notify, compact, renameG, setRenameG, gDraft, setGDraft }: { store: Store; notify: (m: string) => void; compact?: boolean; renameG: string | null; setRenameG: (v: string | null) => void; gDraft: string; setGDraft: (v: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAB_COLORS[Math.floor(Math.random() * TAB_COLORS.length)]);
  const commitRename = (id: string) => {
    if (gDraft.trim()) { store.setGroups((gs) => gs.map((x) => x.id === id ? { ...x, name: gDraft.trim().slice(0, 28) } : x)); notify("Group renamed"); }
    setRenameG(null);
  };
  return (
    <div>
      <div className="space-y-1.5">
        {store.groups.map((gr) => {
          const n = store.tabs.filter((x) => x.groupId === gr.id).length;
          return (
            <div key={gr.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border" style={{ borderColor: "var(--t-border)" }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: gr.color }} />
              <div className="flex-1 min-w-0">
                {renameG === gr.id ? (
                  <input autoFocus value={gDraft} onChange={(e) => setGDraft(e.target.value)} onBlur={() => commitRename(gr.id)} onKeyDown={(e) => { if (e.key === "Enter") commitRename(gr.id); if (e.key === "Escape") setRenameG(null); e.stopPropagation(); }} className="w-full bg-transparent outline-none text-[12px] font-semibold border-b mono" style={{ color: "var(--t-fg)", borderColor: gr.color }} aria-label="rename group" />
                ) : (
                  <div className="text-[12px] font-semibold truncate" style={{ color: "var(--t-fg)" }}>{gr.name}</div>
                )}
                {!compact && gr.description && <div className="text-[10.5px] truncate" style={{ color: "var(--t-muted)" }}>{gr.description}</div>}
              </div>
              <span className="text-[10px] mono px-1.5 py-0.5 rounded-md shrink-0" style={{ background: `${gr.color}1a`, color: gr.color }}>{n}</span>
              <button title="Rename group" onClick={() => { setRenameG(gr.id); setGDraft(gr.name); }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><Pencil size={11} /></button>
              {store.groups.length > 1 && <button title="Delete group (tabs move to first group)" onClick={() => {
                const fallback = store.groups.find((x) => x.id !== gr.id)!;
                store.setTabs((ts) => ts.map((x) => x.groupId === gr.id ? { ...x, groupId: fallback.id } : x));
                store.setGroups((gs) => gs.filter((x) => x.id !== gr.id));
                if (store.groupFilter === gr.id) store.setGroupFilter("all");
                notify(`Deleted “${gr.name}” · tabs moved`);
              }} className="w-6 h-6 rounded-md grid place-items-center hover:bg-red-500/80 hover:text-white shrink-0" style={{ color: "var(--t-muted)" }}><Trash2 size={11} /></button>}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { store.setGroups((gs) => [...gs, { id: `g-${Date.now()}`, name: name.trim().slice(0, 28), color, description: "" }]); setName(""); notify("Group created"); } }} placeholder="New group name…" aria-label="new group name" className={cx(inputCls, "!h-8 text-[12px]")} style={inputStyle} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="group color" className="w-9 h-8 rounded-lg cursor-pointer bg-transparent border shrink-0" style={{ borderColor: "var(--t-border)" }} />
        <button aria-label="add group" onClick={() => { if (name.trim()) { store.setGroups((gs) => [...gs, { id: `g-${Date.now()}`, name: name.trim().slice(0, 28), color, description: "" }]); setName(""); notify("Group created"); } }} className="h-8 px-3 rounded-lg text-white text-[12px] font-semibold shrink-0" style={{ background: "var(--t-accent)" }}><Plus size={14} /></button>
      </div>
    </div>
  );
}

/* ============ LAYOUT (manual adjuster) ============ */
function MiniMap({ node, color, activeId, onPick }: { node: PaneNode; color: string; activeId: string; onPick?: (paneId: string) => void }) {
  if (node.kind === "pane")
    return <button onClick={() => onPick?.(node.paneId)} title="Focus pane" className="flex-1 rounded-[4px] border min-h-[14px] transition hover:brightness-150" style={{ borderColor: node.paneId === activeId ? color : "var(--t-border)", background: node.paneId === activeId ? `${color}40` : "var(--t-bg)" }} />;
  return (
    <div className="flex-1 flex gap-[3px] min-h-[14px]" style={{ flexDirection: node.direction === "row" ? "row" : "column" }}>
      <MiniMap node={node.children[0]} color={color} activeId={activeId} onPick={onPick} />
      <MiniMap node={node.children[1]} color={color} activeId={activeId} onPick={onPick} />
    </div>
  );
}

function SplitRow({ store, tab, node, depth }: { store: Store; tab: TerminalTab; node: PaneNode; depth: number }) {
  if (node.kind === "pane") return null;
  const pct = Math.round(node.ratio * 100);
  return (
    <div className={cx("rounded-xl border p-2.5 space-y-2", depth > 0 && "tree-guide !border-0 !rounded-none !pr-0 ml-1 pl-2.5")} style={depth === 0 ? { borderColor: "var(--t-border)", background: "var(--t-bg)" } : undefined}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] mono font-bold px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)", color: "var(--t-accent)" }}>{node.direction === "row" ? "⇔ ROW" : "⇕ COL"}</span>
        <span className="text-[11px] mono font-bold" style={{ color: "var(--t-fg)" }}>{pct} / {100 - pct}</span>
        <div className="flex-1" />
        <button title="Flip orientation" onClick={() => store.flipSplitAction(tab.id, node.id)} className="h-7 px-2 rounded-lg border text-[10.5px] font-semibold flex items-center gap-1 hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><FlipHorizontal2 size={11} />Flip</button>
        <button title="Balance 50/50" onClick={() => store.setSplitRatio(tab.id, node.id, 0.5)} className="h-7 px-2 rounded-lg border text-[10.5px] font-semibold flex items-center gap-1 hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><Equal size={11} />50/50</button>
      </div>
      <input type="range" min={15} max={85} value={pct} aria-label={`split ratio ${pct} percent`} onChange={(e) => store.setSplitRatio(tab.id, node.id, Number(e.target.value) / 100)} className="slider w-full" style={{ ["--fill" as string]: `${pct}%` }} />
      <SplitRow store={store} tab={tab} node={node.children[0]} depth={depth + 1} />
      <SplitRow store={store} tab={tab} node={node.children[1]} depth={depth + 1} />
    </div>
  );
}

export function LayoutPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const t = store.activeTab;
  if (!t) return null;
  const broadcasting = store.broadcastTabId === t.id;
  const splits = collectSplits(t.layout);
  const templates: { k: "single" | "dual-h" | "dual-v" | "triple" | "quad" | "sidebar"; label: string; icon: React.ReactNode }[] = [
    { k: "single", label: "Single", icon: <Layers size={13} /> },
    { k: "dual-h", label: "Dual →", icon: <ArrowRight size={13} /> },
    { k: "dual-v", label: "Dual ↓", icon: <ArrowDown size={13} /> },
    { k: "triple", label: "Triple", icon: <AlignHorizontalDistributeCenter size={13} /> },
    { k: "quad", label: "Quad", icon: <Equal size={13} /> },
    { k: "sidebar", label: "Sidebar", icon: <FlipHorizontal2 size={13} /> },
  ];
  return (
    <div className="space-y-3 anim-fadeUp">
      <Section title="Layout blueprint" icon={<Layers size={14} style={{ color: "var(--t-accent)" }} />} right={<span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{countLeaves(t.layout)} panes · {splits.length} splits</span>}>
        <div className="rounded-xl border p-2 h-[86px] flex" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)" }}>
          <MiniMap node={t.layout} color={t.color} activeId={t.activePaneId} onPick={(pid) => store.focusPane(t.id, pid)} />
        </div>
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--t-muted)" }}>Click the blueprint to focus a pane. Drag dividers live, nudge with arrow keys when a divider is focused, or double-click for 50/50.</p>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => store.balanceAction(t.id)} className="flex-1 h-8 rounded-lg text-[11.5px] font-semibold" style={{ background: "color-mix(in srgb, var(--t-accent) 16%, transparent)", color: "var(--t-accent)" }}>Balance all</button>
          <button onClick={() => store.cyclePane(t.id, 1)} className="flex-1 h-8 rounded-lg border text-[11.5px] font-semibold" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}>Focus next</button>
        </div>
        <button onClick={() => { store.setBroadcastTabId(broadcasting ? null : t.id); notify(broadcasting ? "Broadcast off" : "Broadcast on — typing runs everywhere"); }} className="mt-1.5 w-full h-8 rounded-lg text-[11.5px] font-bold border" style={{ borderColor: broadcasting ? "#fb7185" : "var(--t-border)", color: broadcasting ? "#fb7185" : "var(--t-fg)", background: broadcasting ? "rgba(251,113,133,.08)" : undefined }}>
          {broadcasting ? "● Broadcasting to all panes — stop" : "○ Broadcast input to all panes"}
        </button>
      </Section>
      <Section title="Split tree" icon={<Settings2 size={14} style={{ color: "var(--t-accent)" }} />}>
        {t.layout.kind === "pane" ? <div className="text-[12px]" style={{ color: "var(--t-muted)" }}>Single pane — split it from the tab bar or with <span className="mono">Ctrl+Shift+H</span>.</div> : <SplitRow store={store} tab={t} node={t.layout} depth={0} />}
      </Section>
      <Section title="Apply template" icon={<AlignHorizontalDistributeCenter size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="grid grid-cols-3 gap-1.5">
          {templates.map((tp) => (
            <button key={tp.k} onClick={() => { store.applyTemplate(t.id, tp.k); notify(`Layout → ${tp.label}`); }} className="h-9 rounded-xl border text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}>{tp.icon}{tp.label}</button>
          ))}
        </div>
        <p className="text-[10.5px] mt-2" style={{ color: "var(--t-muted)" }}>Templates rebuild splits; first pane content is preserved.</p>
      </Section>
    </div>
  );
}

/* ============ COMMANDS ============ */
export function CommandsPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [favs, setFavs] = useState(false);
  const [execFor, setExecFor] = useState<SavedCommand | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const cats = ["All", ...Array.from(new Set(store.commands.map((c) => c.category)))];
  const list = store.commands.filter((c) => (!favs || c.favorite) && (cat === "All" || c.category === cat) && (c.name + c.command + c.description).toLowerCase().includes(q.toLowerCase()));
  const run = (c: SavedCommand, values: Record<string, string>) => {
    const t = store.activeTab;
    if (!t) return;
    const final = fillDynamic(c.command, values);
    if (/\{\{[^}]+\}\}/.test(final)) { notify("Fill every {{input}} first"); return; }
    store.runCommand(t.id, t.activePaneId, final);
    store.setCommands((cs) => cs.map((x) => x.id === c.id ? { ...x, runCount: x.runCount + 1 } : x));
    setExecFor(null); setVals({});
    notify(`Ran “${c.name}”`);
  };
  return (
    <div className="space-y-3 anim-fadeUp">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--t-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved commands…" aria-label="search commands" className={cx(inputCls, "!pl-8 mono")} style={inputStyle} />
        </div>
        <button onClick={() => setFavs(!favs)} title="Favorites only" aria-pressed={favs} className="w-9 h-9 rounded-xl border grid place-items-center shrink-0 transition" style={{ borderColor: favs ? "#fbbf24" : "var(--t-border)", color: favs ? "#fbbf24" : "var(--t-muted)", background: favs ? "#fbbf2415" : undefined }}><Star size={15} className={favs ? "fill-current" : ""} /></button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition" style={{ borderColor: cat === c ? "var(--t-accent)" : "var(--t-border)", color: cat === c ? "var(--t-accent)" : "var(--t-muted)", background: cat === c ? "color-mix(in srgb, var(--t-accent) 12%, transparent)" : undefined }}>{c}</button>
        ))}
      </div>
      {execFor && (
        <div className="rounded-2xl border p-3.5 anim-pop" style={{ borderColor: "var(--t-accent)", background: "color-mix(in srgb, var(--t-accent) 8%, var(--t-panel))" }}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} style={{ color: "var(--t-accent)" }} />
            <span className="text-[12.5px] font-bold" style={{ color: "var(--t-fg)" }}>{execFor.name}</span>
            <button onClick={() => setExecFor(null)} aria-label="close" className="ml-auto" style={{ color: "var(--t-muted)" }}><X size={14} /></button>
          </div>
          <div className="text-[11px] mono p-2 rounded-lg mb-2 break-all" style={{ background: "var(--t-bg)", color: "var(--t-muted)" }}>{execFor.command}</div>
          {parseDynamicParams(execFor.command).map((p) => (
            <div key={p.name} className="mb-1.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider mono" style={{ color: "var(--t-accent)" }}>{`{{${p.name}}}`}</label>
              {p.options.length ? (
                <select value={vals[p.name] ?? p.def} onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))} className={cx(inputCls, "!h-8 mono mt-0.5")} style={inputStyle}>
                  {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={vals[p.name] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))} placeholder={p.def || `value for ${p.name}`} className={cx(inputCls, "!h-8 mono mt-0.5")} style={inputStyle} />
              )}
            </div>
          ))}
          <div className="text-[11px] mono p-2 rounded-lg mb-2 break-all border" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "#34d399" }}>$ {fillDynamic(execFor.command, vals)}</div>
          <button onClick={() => run(execFor, vals)} className="w-full h-9 rounded-xl text-white text-[12.5px] font-bold flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, var(--t-accent), var(--t-accent2))" }}><Play size={14} />Execute in active pane</button>
        </div>
      )}
      <div className="space-y-2">
        {list.map((c) => {
          const dyn = parseDynamicParams(c.command);
          return (
            <div key={c.id} className="rounded-xl border p-2.5 transition hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", background: "var(--t-panel)" }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-bold truncate" style={{ color: "var(--t-fg)" }}>{c.name}</span>
                    {dyn.length > 0 && <span className="text-[9px] mono font-bold px-1 rounded shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)", color: "var(--t-accent)" }}>{dyn.length} inputs</span>}
                  </div>
                  <div className="text-[10.5px] truncate" style={{ color: "var(--t-muted)" }}>{c.description} · {c.category}</div>
                </div>
                <button aria-label="favorite" onClick={() => store.setCommands((cs) => cs.map((x) => x.id === c.id ? { ...x, favorite: !x.favorite } : x))} style={{ color: c.favorite ? "#fbbf24" : "var(--t-muted)" }}><Star size={14} className={c.favorite ? "fill-current" : ""} /></button>
              </div>
              <div className="text-[11px] mono mt-1.5 p-2 rounded-lg break-all" style={{ background: "var(--t-bg)", color: "var(--t-muted)" }}>$ {c.command}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <button onClick={() => { if (dyn.length) { setExecFor(c); setVals(Object.fromEntries(dyn.map((d) => [d.name, d.def]))); } else run(c, {}); }} className="flex-1 h-7 rounded-lg text-[11.5px] font-bold text-white flex items-center justify-center gap-1.5" style={{ background: c.color }}><Play size={12} />{dyn.length ? "Fill & run" : "Run"}</button>
                <button title="Copy" onClick={() => { navigator.clipboard?.writeText(c.command).catch(() => {}); notify("Command copied"); }} className="w-7 h-7 rounded-lg border grid place-items-center" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Copy size={12} /></button>
                <button title="Open in new tab" onClick={() => { store.newTab({ label: c.name, color: c.color, layout: "single", bootstraps: [fillDynamic(c.command, {})] }); notify("Opened in new tab"); }} className="w-7 h-7 rounded-lg border grid place-items-center" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Plus size={12} /></button>
                <button title="Delete" onClick={() => { store.setCommands((cs) => cs.filter((x) => x.id !== c.id)); notify("Command deleted"); }} className="w-7 h-7 rounded-lg border grid place-items-center hover:bg-red-500/80 hover:text-white hover:border-transparent" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Trash2 size={12} /></button>
                <span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>×{c.runCount}</span>
              </div>
            </div>
          );
        })}
        {!list.length && <div className="text-center py-8 text-[12.5px]" style={{ color: "var(--t-muted)" }}>No commands match. Save the current input as a command with ＋ Save cmd.</div>}
      </div>
    </div>
  );
}

/* ============ HISTORY ============ */
export function HistoryPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const q = store.historyQuery;
  const [filter, setFilter] = useState<"all" | "ok" | "err">("all");
  const list = useMemo(() => store.history.filter((h) =>
    (filter === "all" || (filter === "ok" ? h.exitCode === 0 : h.exitCode !== 0)) &&
    (h.command + h.tabLabel + h.cwd).toLowerCase().includes(q.toLowerCase())
  ).slice(0, 150), [store.history, q, filter]);
  const rerun = (id: string) => {
    const h = store.history.find((x) => x.id === id);
    const t = store.activeTab;
    if (!h || !t) return;
    store.runCommand(t.id, t.activePaneId, h.command);
    notify(`Re-ran: ${h.command.slice(0, 44)}`);
  };
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>();
    list.forEach((h) => {
      const d = new Date(h.timestamp).toDateString();
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(h);
    });
    return [...m.entries()];
  }, [list]);
  return (
    <div className="space-y-2 anim-fadeUp">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--t-muted)" }} />
        <input value={q} onChange={(e) => store.setHistoryQuery(e.target.value)} placeholder="Search every command ever run…" aria-label="search history" className={cx(inputCls, "!pl-8 mono")} style={inputStyle} />
      </div>
      <div className="flex items-center gap-1.5">
        {(["all", "ok", "err"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="h-7 px-2.5 rounded-lg text-[11px] font-bold border" style={{ borderColor: filter === f ? "var(--t-accent)" : "var(--t-border)", color: filter === f ? "var(--t-accent)" : "var(--t-muted)" }}>{f === "all" ? "All" : f === "ok" ? "✓ OK" : "✗ Errors"}</button>
        ))}
        <span className="text-[10.5px] mono ml-1" style={{ color: "var(--t-muted)" }}>{store.history.length} entries</span>
        <button onClick={() => { navigator.clipboard?.writeText(store.history.map((h) => h.command).join("\n")).catch(() => {}); notify("History copied"); }} className="ml-auto flex items-center gap-1 text-[11px] hover:text-[var(--t-fg)]" style={{ color: "var(--t-muted)" }}><Copy size={11} />export</button>
        <button onClick={() => { store.setHistory([]); notify("History cleared"); }} className="flex items-center gap-1 text-[11px] hover:text-red-400" style={{ color: "var(--t-muted)" }}><Trash2 size={11} /></button>
      </div>
      {groups.map(([day, items]) => (
        <div key={day}>
          <div className="flex items-center gap-2 my-2 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>{new Date(day).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
            <div className="flex-1 h-px" style={{ background: "var(--t-border)" }} />
            <span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>{items.length}</span>
          </div>
          <div className="space-y-1.5">
            {items.map((h) => (
              <div key={h.id} className="rounded-xl border px-2.5 py-2 transition hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", background: "var(--t-panel)" }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: h.exitCode === 0 ? "#34d399" : "#fb7185" }} />
                  <span className="text-[12px] mono font-medium truncate flex-1" style={{ color: "var(--t-fg)" }}>$ {h.command}</span>
                  <button onClick={() => rerun(h.id)} title="Re-run in active pane" className="w-6 h-6 rounded-md grid place-items-center shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)", color: "var(--t-accent)" }}><Play size={11} /></button>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] mono" style={{ color: "var(--t-muted)" }}>
                  <span className="truncate">{h.tabLabel} · {h.cwd.replace("/home/user", "~")}</span>
                  <span className="ml-auto shrink-0">{timeAgo(h.timestamp)} · {formatDuration(h.durationMs)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!list.length && <div className="text-center py-8 text-[12.5px]" style={{ color: "var(--t-muted)" }}>No history matches — run something.</div>}
    </div>
  );
}

/* ============ STATS ============ */
export function StatsPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const s = store.stats;
  const maxDay = Math.max(1, ...s.days.map((d) => d.count));
  const maxTop = Math.max(1, ...s.top.map(([, c]) => c));
  const maxTab = Math.max(1, ...s.perTab.map((x) => x.count));
  const maxHour = Math.max(1, ...s.hours);
  const rerunTop = (cmd: string) => {
    const t = store.activeTab;
    if (!t) return;
    store.runCommand(t.id, t.activePaneId, cmd);
    notify(`Ran: ${cmd}`);
  };
  return (
    <div className="space-y-3 anim-fadeUp">
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: s.total, l: "Total commands", c: "var(--t-accent)", i: <Terminal size={14} /> },
          { v: s.today, l: "Run today", c: "#34d399", i: <Flame size={14} /> },
          { v: `${s.okRate}%`, l: "Success rate", c: "#22d3ee", i: <Check size={14} /> },
          { v: formatDuration(s.avgMs), l: "Avg runtime", c: "#fbbf24", i: <Clock size={14} /> },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border p-3" style={{ borderColor: "var(--t-border)", background: "var(--t-panel)" }}>
            <div className="flex items-center gap-1.5" style={{ color: k.c }}>{k.i}<span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>{k.l}</span></div>
            <div className="display font-bold text-[24px] leading-tight" style={{ color: "var(--t-fg)" }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["7-day", "errors"].map((k) => (
          <div key={k} className="rounded-2xl border px-3 py-2 flex items-center gap-2" style={{ borderColor: "var(--t-border)", background: "var(--t-panel)" }}>
            <span className="display font-bold text-[18px]" style={{ color: k === "errors" ? "#fb7185" : "var(--t-fg)" }}>{k === "errors" ? s.errors : s.week}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>{k === "errors" ? "failed runs" : "last 7 days"}</span>
          </div>
        ))}
      </div>
      <Section title="Last 14 days" icon={<BarChart3 size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="flex items-end gap-1 h-[92px]" role="img" aria-label={`command activity, max ${maxDay} per day`}>
          {s.days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.count}`}>
              <span className="text-[8.5px] mono" style={{ color: "var(--t-muted)" }}>{d.count || ""}</span>
              <div className="w-full rounded-md transition-all" style={{ height: `${Math.max(4, (d.count / maxDay) * 62)}px`, background: d.count ? "linear-gradient(180deg, var(--t-accent), var(--t-accent2))" : "var(--t-border)", opacity: d.count ? 1 : 0.4 }} />
              <span className="text-[7.5px] mono truncate w-full text-center" style={{ color: "var(--t-muted)" }}>{d.label}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Active hours" icon={<Clock size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="flex items-end gap-[2px] h-[52px]" role="img" aria-label="commands by hour of day">
          {s.hours.map((c, h) => (
            <div key={h} title={`${h}:00 — ${c} cmds`} className="flex-1 rounded-sm" style={{ height: `${Math.max(3, (c / maxHour) * 44)}px`, background: c ? "color-mix(in srgb, var(--t-accent) 75%, transparent)" : "var(--t-border)", opacity: c ? 0.55 + 0.45 * (c / maxHour) : 0.5 }} />
          ))}
        </div>
        <div className="flex justify-between text-[8.5px] mono mt-1" style={{ color: "var(--t-muted)" }}><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </Section>
      <Section title="Top commands" icon={<Award size={14} style={{ color: "#fbbf24" }} />} right={<span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>click ▶ to run</span>}>
        <div className="space-y-1.5">
          {s.top.map(([cmd, c], i) => (
            <div key={cmd} className="flex items-center gap-2">
              <span className="text-[10px] mono font-bold w-4" style={{ color: "var(--t-muted)" }}>{i + 1}</span>
              <span className="text-[11.5px] mono truncate flex-1" style={{ color: "var(--t-fg)" }}>{cmd}</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--t-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${(c / maxTop) * 100}%`, background: "linear-gradient(90deg, var(--t-accent), var(--t-accent2))" }} />
              </div>
              <span className="text-[10.5px] mono font-bold w-6 text-right" style={{ color: "var(--t-accent)" }}>{c}</span>
              <button onClick={() => rerunTop(cmd)} title={`Run ${cmd}`} className="w-6 h-6 rounded-md grid place-items-center shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 14%, transparent)", color: "var(--t-accent)" }}><Play size={10} /></button>
            </div>
          ))}
          {!s.top.length && <div className="text-[12px]" style={{ color: "var(--t-muted)" }}>Nothing yet.</div>}
        </div>
      </Section>
      <Section title="Per-tab load" icon={<Cpu size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="space-y-1.5">
          {s.perTab.map((x) => (
            <div key={x.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: x.color }} />
              <span className="text-[11.5px] font-semibold truncate flex-1" style={{ color: "var(--t-fg)" }}>{x.label}</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--t-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${(x.count / maxTab) * 100}%`, background: x.color }} />
              </div>
              <span className="text-[10.5px] mono font-bold w-7 text-right" style={{ color: "var(--t-muted)" }}>{x.count}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Per-group load" icon={<FolderGit2 size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="space-y-1.5">
          {s.perGroup.map((x) => {
            const mx = Math.max(1, ...s.perGroup.map((y) => y.count));
            return (
              <div key={x.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: x.color }} />
                <span className="text-[11.5px] font-semibold truncate flex-1" style={{ color: "var(--t-fg)" }}>{x.name}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--t-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(x.count / mx) * 100}%`, background: x.color }} />
                </div>
                <span className="text-[10.5px] mono font-bold w-7 text-right" style={{ color: "var(--t-muted)" }}>{x.count}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

/* ============ KEYS ============ */
export function KeysPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const [rec, setRec] = useState<string | null>(null);
  const byCat = useMemo(() => {
    const m: Record<string, Shortcut[]> = {};
    store.shortcuts.forEach((s) => { (m[s.category] ??= []).push(s); });
    return m;
  }, [store.shortcuts]);

  useEffect(() => {
    if (!rec) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      const combo = normalizeCombo(e);
      if (!combo) return;
      const clash = store.shortcuts.find((s) => s.id !== rec && s.keys.toLowerCase() === combo.toLowerCase());
      store.setShortcuts((ss) => ss.map((s) => (s.id === rec ? { ...s, keys: combo } : s)));
      notify(clash ? `Bound ${combo} · replaced “${clash.label}”` : `Bound ${combo}`);
      setRec(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [rec, store, notify]);

  useEffect(() => {
    if (!rec) return;
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") setRec(null); };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [rec]);

  return (
    <div className="space-y-3 anim-fadeUp">
      <div className="rounded-2xl border p-3 text-[11.5px] leading-relaxed" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 40%, transparent)", background: "color-mix(in srgb, var(--t-accent) 8%, transparent)" }}>
        <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: "var(--t-accent)" }}><Keyboard size={13} />Capture mode</div>
        <span style={{ color: "var(--t-muted)" }}>Click <b>Record</b>, press the combo — it saves instantly and works everywhere, even inside terminal inputs. <b>Esc</b> cancels.</span>
      </div>
      {Object.entries(byCat).map(([cat, items]) => (
        <Section key={cat} title={cat} icon={<ListOrdered size={13} style={{ color: "var(--t-muted)" }} />}>
          <div className="space-y-1.5">
            {items.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl border" style={{ borderColor: rec === s.id ? "var(--t-accent)" : "var(--t-border)", background: rec === s.id ? "color-mix(in srgb, var(--t-accent) 8%, transparent)" : undefined }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: "var(--t-fg)" }}>{s.label}</div>
                  <div className="text-[10px] truncate" style={{ color: "var(--t-muted)" }}>{s.description}</div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {keysToLabel(s.keys).map((k) => (
                    <kbd key={k} className="text-[10px] mono font-bold px-1.5 py-1 rounded-md border" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }}>{k}</kbd>
                  ))}
                </div>
                <button onClick={() => setRec(rec === s.id ? null : s.id)} className="h-7 px-2 rounded-lg text-[10.5px] font-bold shrink-0" style={{ background: rec === s.id ? "#fb7185" : "color-mix(in srgb, var(--t-accent) 16%, transparent)", color: rec === s.id ? "#fff" : "var(--t-accent)" }}>{rec === s.id ? "press…" : "Record"}</button>
              </div>
            ))}
          </div>
        </Section>
      ))}
      <div className="flex gap-1.5">
        <button onClick={() => { store.setShortcuts(DEFAULT_SHORTCUTS); notify("Keymap reset to defaults"); }} className="flex-1 h-8 rounded-xl border text-[11.5px] font-semibold" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>Reset defaults</button>
        <button onClick={() => download("penguin-keymap.json", JSON.stringify(store.shortcuts, null, 2))} className="flex-1 h-8 rounded-xl border text-[11.5px] font-semibold flex items-center justify-center gap-1.5" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Download size={12} />Export keymap</button>
      </div>
    </div>
  );
}

/* ============ MCP ============ */
export function McpPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const on = store.mcp.filter((m) => m.enabled).length;
  const [copied, setCopied] = useState<string | null>(null);
  const runTool = (m: MCPServer, tool: string, cmd: string) => {
    const t = store.activeTab;
    if (!t) return;
    if (!m.enabled) { notify("Enable the server first"); return; }
    store.runCommand(t.id, t.activePaneId, cmd);
    store.logMcp(m.name, tool, `$ ${cmd}`, true);
    notify(`${m.name} · ${tool} → active pane`);
  };
  return (
    <div className="space-y-3 anim-fadeUp">
      <div className="rounded-2xl border p-3.5" style={{ borderColor: "color-mix(in srgb, #34d399 40%, transparent)", background: "linear-gradient(135deg, rgba(52,211,153,.1), transparent)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(52,211,153,.16)", color: "#34d399" }}><Plug size={16} /></div>
          <div className="flex-1 min-w-0">
            <div className="display font-bold text-[13px]" style={{ color: "var(--t-fg)" }}>MCP Context Bus</div>
            <div className="text-[10.5px] mono" style={{ color: "#34d399" }}>{on}/{store.mcp.length} servers · {store.mcp.reduce((a, m) => a + m.tools.length, 0)} tools · stdio</div>
          </div>
          <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" /></span>
        </div>
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--t-muted)" }}>Model Context Protocol servers inject filesystem, shell, git, container and system context into every pane. Tools execute in the active pane and are logged below.</p>
      </div>
      {store.mcp.map((m: MCPServer) => (
        <div key={m.id} className="rounded-2xl border p-3" style={{ borderColor: m.enabled ? "color-mix(in srgb, #34d399 35%, var(--t-border))" : "var(--t-border)", background: "var(--t-panel)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: m.enabled ? "rgba(52,211,153,.14)" : "var(--t-bg)", color: m.enabled ? "#34d399" : "var(--t-muted)" }}><TabIcon name={m.icon} size={16} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-bold mono" style={{ color: "var(--t-fg)" }}>{m.name}</span>
                <span className="text-[9px] mono font-bold px-1.5 py-px rounded-md" style={{ background: m.status === "connected" ? "rgba(52,211,153,.14)" : "rgba(251,113,133,.14)", color: m.status === "connected" ? "#34d399" : "#fb7185" }}>{m.status.toUpperCase()}</span>
                {m.enabled && <span className="text-[9px] mono" style={{ color: "var(--t-muted)" }}>{m.latencyMs}ms</span>}
              </div>
              <div className="text-[10.5px] truncate" style={{ color: "var(--t-muted)" }}>{m.description}</div>
            </div>
            <button role="switch" aria-checked={m.enabled} aria-label={`toggle ${m.name}`} onClick={() => { store.setMcp((ms) => ms.map((x) => x.id === m.id ? { ...x, enabled: !x.enabled, status: !x.enabled ? "connected" : "disconnected" } : x)); notify(`${m.name} ${m.enabled ? "disconnected" : "connected"}`); }} className="w-10 h-[22px] rounded-full relative transition-all shrink-0" style={{ background: m.enabled ? "#34d399" : "var(--t-border)" }}>
              <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: m.enabled ? 22 : 3 }} />
            </button>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[9.5px] font-bold uppercase tracking-wider px-1" style={{ color: "var(--t-muted)" }}>Tools</div>
            {m.tools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "var(--t-bg)" }}>
                <Zap size={11} className="shrink-0" style={{ color: m.enabled ? "#34d399" : "var(--t-muted)" }} />
                <span className="mono font-bold shrink-0" style={{ color: "var(--t-fg)" }}>{tool.name}</span>
                <span className="truncate" style={{ color: "var(--t-muted)" }}>{tool.description}</span>
                <button title={`Run ${tool.command} in active pane`} onClick={() => runTool(m, tool.name, tool.command)} className="ml-auto text-[10px] mono font-bold shrink-0 hover:underline" style={{ color: "var(--t-accent)" }}>{tool.command}</button>
              </div>
            ))}
            <div className="text-[9.5px] font-bold uppercase tracking-wider px-1 pt-1" style={{ color: "var(--t-muted)" }}>Resources · Prompts</div>
            <div className="flex flex-wrap gap-1 px-1">
              {m.resources.map((r) => (
                <button key={r.uri} title={r.uri} onClick={() => { navigator.clipboard?.writeText(r.uri).catch(() => {}); setCopied(r.uri); setTimeout(() => setCopied(null), 1200); notify("Resource URI copied"); }} className="text-[10px] mono px-1.5 py-1 rounded-md border" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>{copied === r.uri ? "copied ✓" : `${r.name}`}</button>
              ))}
              {m.prompts.map((p) => (
                <button key={p.name} title={p.description} onClick={() => { const t = store.activeTab; if (t && m.enabled) { store.runCommand(t.id, t.activePaneId, `echo "[${m.name}/${p.name}] ${p.description}"`); store.logMcp(m.name, p.name, "prompt invoked", true); } else notify("Enable the server first"); }} className="text-[10px] mono px-1.5 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 40%, transparent)", color: "var(--t-accent)" }}>✦ {p.name}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <Section title="Tool call log" icon={<History size={13} style={{ color: "#34d399" }} />} right={<button onClick={() => store.logMcp("bus", "clear", "log cleared", true)} className="text-[10px] font-bold" style={{ color: "var(--t-muted)" }}>clear</button>}>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {store.mcpLog.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[10.5px] mono px-2 py-1.5 rounded-lg" style={{ background: "var(--t-bg)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.ok ? "#34d399" : "#fb7185" }} />
              <span className="font-bold shrink-0" style={{ color: "var(--t-fg)" }}>{e.server}/{e.tool}</span>
              <span className="truncate" style={{ color: "var(--t-muted)" }}>{e.detail}</span>
              <span className="ml-auto shrink-0" style={{ color: "var(--t-muted)" }}>{timeAgo(e.ts)}</span>
            </div>
          ))}
          {!store.mcpLog.length && <div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>No tool calls yet.</div>}
        </div>
      </Section>
    </div>
  );
}

/* ============ THEME ============ */
export function ThemePanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const a = store.appearance;
  const set = (p: Partial<typeof a>) => store.setAppearance({ ...a, ...p });
  const slider = (label: string, v: number, min: number, max: number, step: number, fn: (n: number) => void, fmt: (n: number) => string) => (
    <div>
      <div className="flex justify-between text-[11px] font-semibold mb-1"><span style={{ color: "var(--t-muted)" }}>{label}</span><span className="mono" style={{ color: "var(--t-fg)" }}>{fmt(v)}</span></div>
      <input type="range" min={min} max={max} step={step} value={v} aria-label={label} onChange={(e) => fn(Number(e.target.value))} className="slider w-full" style={{ ["--fill" as string]: `${((v - min) / (max - min)) * 100}%` }} />
    </div>
  );
  return (
    <div className="space-y-3 anim-fadeUp">
      <Section title="Theme" icon={<Type size={14} style={{ color: "var(--t-accent)" }} />} right={<button onClick={() => { const i = THEMES.findIndex((x) => x.id === a.themeId); const n = THEMES[(i + 1) % THEMES.length]; set({ themeId: n.id }); notify(`Theme → ${n.name}`); }} className="text-[10.5px] font-bold" style={{ color: "var(--t-accent)" }}>shuffle →</button>}>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((th: ThemeDef) => (
            <button key={th.id} onClick={() => { set({ themeId: th.id }); notify(`Theme → ${th.name}`); }} aria-pressed={a.themeId === th.id} className="rounded-xl border p-2 text-left transition hover:scale-[1.02]" style={{ borderColor: a.themeId === th.id ? th.accent : "var(--t-border)", background: th.bg }}>
              <div className="flex gap-1 mb-1.5">
                {[th.accent, th.accent2, th.promptPath].map((c) => <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
                {a.themeId === th.id && <Check size={12} className="ml-auto" style={{ color: th.accent }} />}
              </div>
              <div className="text-[11px] font-bold" style={{ color: th.fg }}>{th.name}</div>
              <div className="text-[9.5px] mono" style={{ color: th.muted }}>user@penguin ❯ ▊</div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Typography" icon={<Type size={14} style={{ color: "var(--t-accent)" }} />}>
        <label className={lbl} style={{ color: "var(--t-muted)" }}>Font</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-3">
          {FONT_OPTIONS.map((f) => (
            <button key={f} onClick={() => set({ fontFamily: f })} className="h-7 px-2.5 rounded-lg text-[11px] border mono transition" style={{ borderColor: a.fontFamily === f ? "var(--t-accent)" : "var(--t-border)", color: a.fontFamily === f ? "var(--t-accent)" : "var(--t-muted)", fontFamily: `'${f}', monospace` }}>{f.split(" ")[0]}</button>
          ))}
        </div>
        <div className="space-y-3">
          {slider("Font size", a.fontSize, 10, 20, 0.5, (n) => set({ fontSize: n }), (n) => `${n}px`)}
          {slider("Line height", a.lineHeight, 1.2, 2, 0.05, (n) => set({ lineHeight: n }), (n) => n.toFixed(2))}
          {slider("Pane padding", a.padding, 4, 28, 1, (n) => set({ padding: n }), (n) => `${n}px`)}
          {slider("Opacity", a.opacity, 0.6, 1, 0.01, (n) => set({ opacity: n }), (n) => `${Math.round(n * 100)}%`)}
        </div>
        <label className={cx(lbl, "mt-3 block")} style={{ color: "var(--t-muted)" }}>Density</label>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          {(["cozy", "compact"] as const).map((d) => (
            <button key={d} onClick={() => set({ density: d })} className="h-8 rounded-lg text-[11.5px] font-bold border" style={{ borderColor: a.density === d ? "var(--t-accent)" : "var(--t-border)", color: a.density === d ? "var(--t-accent)" : "var(--t-muted)" }}>{d}</button>
          ))}
        </div>
      </Section>
      <Section title="Prompt & cursor" icon={<Terminal size={14} style={{ color: "var(--t-accent)" }} />}>
        <label className={lbl} style={{ color: "var(--t-muted)" }}>Prompt style</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5 mb-3">
          {(["classic", "minimal", "powerline", "two-line"] as const).map((p) => (
            <button key={p} onClick={() => set({ promptStyle: p })} className="h-8 rounded-lg text-[10.5px] font-bold border mono" style={{ borderColor: a.promptStyle === p ? "var(--t-accent)" : "var(--t-border)", color: a.promptStyle === p ? "var(--t-accent)" : "var(--t-muted)" }}>{p}</button>
          ))}
        </div>
        <label className={lbl} style={{ color: "var(--t-muted)" }}>Cursor</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5 mb-3">
          {(["block", "beam", "underline"] as const).map((c) => (
            <button key={c} onClick={() => set({ cursorStyle: c })} className="h-8 rounded-lg text-[11px] font-bold border" style={{ borderColor: a.cursorStyle === c ? "var(--t-accent)" : "var(--t-border)", color: a.cursorStyle === c ? "var(--t-accent)" : "var(--t-muted)" }}>{c}</button>
          ))}
        </div>
        {[["Cursor blink", a.cursorBlink, (v: boolean) => set({ cursorBlink: v })], ["Pane status bar", a.showStatusBar, (v: boolean) => set({ showStatusBar: v })], ["Transparency blur", a.transparency, (v: boolean) => set({ transparency: v })], ["Accent glow", a.glow, (v: boolean) => set({ glow: v })]].map(([label2, v, fn]) => (
          <button key={label2 as string} role="switch" aria-checked={!!v} onClick={() => (fn as (v: boolean) => void)(!(v as boolean))} className="w-full flex items-center justify-between py-1.5">
            <span className="text-[12px] font-medium" style={{ color: "var(--t-fg)" }}>{label2 as string}</span>
            <span className="w-9 h-5 rounded-full relative transition-all" style={{ background: v ? "var(--t-accent)" : "var(--t-border)" }}><span className="absolute top-[2.5px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all" style={{ left: v ? 19 : 3 }} /></span>
          </button>
        ))}
      </Section>
    </div>
  );
}

/* ============ SYSTEM (Electron + Linux) ============ */
export function SysPanel({ store, notify }: { store: Store; notify: (m: string) => void }) {
  const electron = isElectron();
  const [snippet, setSnippet] = useState<"main" | "preload">("main");
  const text = snippet === "main" ? MAIN_SNIPPET : PRELOAD_SNIPPET;
  const envKey = store.activeTab ? `${store.activeTab.id}:${store.activeTab.activePaneId}` : "";
  const overrides = (store.paneEnv[envKey] ?? {});
  return (
    <div className="space-y-3 anim-fadeUp">
      <div className="rounded-2xl border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 40%, transparent)", background: "linear-gradient(135deg, color-mix(in srgb, var(--t-accent) 12%, transparent), transparent)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 16%, transparent)", color: "var(--t-accent)" }}><Monitor size={16} /></div>
          <div className="flex-1 min-w-0">
            <div className="display font-bold text-[13px]" style={{ color: "var(--t-fg)" }}>{electron ? "Native Electron runtime" : "Web preview · Electron-ready"}</div>
            <div className="text-[10.5px] mono" style={{ color: "var(--t-muted)" }}>{electron ? "node-pty available · linux" : "simulated pty · ships with node-pty bindings"}</div>
          </div>
        </div>
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--t-muted)" }}>In production each pane maps 1:1 to a <span className="mono" style={{ color: "var(--t-fg)" }}>node-pty</span> process running the user's real login shell. This preview simulates output so every feature works in the browser too.</p>
      </div>
      <Section title="Linux target" icon={<Terminal size={14} style={{ color: "var(--t-accent)" }} />}>
        <label className={lbl} style={{ color: "var(--t-muted)" }}>Distro profile</label>
        <select value={store.distro} onChange={(e) => { store.setDistro(e.target.value); notify(`Distro → ${e.target.value}`); }} className="w-full h-9 px-2 rounded-xl border text-[12.5px] mt-1 outline-none" style={inputStyle}>
          {DISTROS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className={cx(lbl, "mt-3 block")} style={{ color: "var(--t-muted)" }}>Default shell</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          {SHELLS.map((s) => (
            <button key={s.id} title={s.version} onClick={() => { store.setShell(s.id); notify(`Default shell → ${s.name}`); }} className="h-9 rounded-xl border text-[11.5px] font-bold mono" style={{ borderColor: store.shell === s.id ? "var(--t-accent)" : "var(--t-border)", color: store.shell === s.id ? "var(--t-accent)" : "var(--t-muted)" }}>{s.name}</button>
          ))}
        </div>
        <div className="text-[10.5px] mono mt-2" style={{ color: "var(--t-muted)" }}>{SHELLS.find((s) => s.id === store.shell)?.version} · {(SHELLS.find((s) => s.id === store.shell)?.prompt)}
        </div>
      </Section>
      <Section title="Pane environment" icon={<Cpu size={14} style={{ color: "var(--t-accent)" }} />} right={<span className="text-[10px] mono" style={{ color: "var(--t-muted)" }}>export persists</span>}>
        {Object.keys(overrides).length === 0
          ? <div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>No overrides in this pane. Try <button className="mono underline" style={{ color: "var(--t-accent)" }} onClick={() => { const t = store.activeTab; if (t) store.runCommand(t.id, t.activePaneId, "export GREETING=hello"); }}>export GREETING=hello</button> then <span className="mono">echo $GREETING</span>.</div>
          : <div className="space-y-1">{Object.entries(overrides).map(([k, v]) => <div key={k} className="flex text-[11px] mono px-2 py-1.5 rounded-lg" style={{ background: "var(--t-bg)" }}><span className="font-bold" style={{ color: "var(--t-accent)" }}>{k}</span><span className="truncate ml-2" style={{ color: "var(--t-fg)" }}>= {v}</span></div>)}</div>}
      </Section>
      <Section title="Electron wiring" icon={<Settings2 size={14} style={{ color: "var(--t-accent)" }} />}>
        <div className="flex gap-1.5 mb-2">
          {(["main", "preload"] as const).map((k) => (
            <button key={k} onClick={() => setSnippet(k)} className="flex-1 h-8 rounded-lg text-[11.5px] font-bold mono border" style={{ borderColor: snippet === k ? "var(--t-accent)" : "var(--t-border)", color: snippet === k ? "var(--t-accent)" : "var(--t-muted)" }}>{k}.js</button>
          ))}
          <button onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); notify("Snippet copied"); }} className="h-8 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><Copy size={12} />Copy</button>
        </div>
        <pre className="text-[10px] mono p-2.5 rounded-xl overflow-x-auto leading-relaxed" style={{ background: "var(--t-bg)", color: "var(--t-fg)" }}>{text}</pre>
        <div className="mt-2 space-y-1.5">
          {LINUX_TIPS.map((tip, i) => (
            <div key={i} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: "var(--t-muted)" }}><span className="mono font-bold shrink-0" style={{ color: "var(--t-accent)" }}>{i + 1}.</span>{tip}</div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function RightPanel({ store, notify, groupCtl }: { store: Store; notify: (m: string) => void; groupCtl: { renameG: string | null; setRenameG: (v: string | null) => void; gDraft: string; setGDraft: (v: string) => void } }) {
  const tabs = [
    { id: "inspect", label: "Inspect", icon: <Settings2 size={13} /> },
    { id: "layout", label: "Layout", icon: <Layers size={13} /> },
    { id: "commands", label: "Cmds", icon: <Zap size={13} /> },
    { id: "history", label: "Hist", icon: <History size={13} /> },
    { id: "stats", label: "Stats", icon: <BarChart3 size={13} /> },
    { id: "keys", label: "Keys", icon: <Keyboard size={13} /> },
    { id: "mcp", label: "MCP", icon: <Plug size={13} /> },
    { id: "theme", label: "Theme", icon: <Type size={13} /> },
    { id: "sys", label: "System", icon: <Monitor size={13} /> },
  ] as const;
  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}>
      <div className="grid grid-cols-3 gap-1 p-2.5 pb-1.5" role="tablist" aria-label="inspector tabs">
        {tabs.map((tb) => (
          <button key={tb.id} role="tab" aria-selected={store.rightTab === tb.id} onClick={() => store.setRightTab(tb.id as Store["rightTab"])} className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9.5px] font-bold uppercase tracking-wider transition" style={{
            background: store.rightTab === tb.id ? "color-mix(in srgb, var(--t-accent) 16%, transparent)" : "transparent",
            color: store.rightTab === tb.id ? "var(--t-accent)" : "var(--t-muted)",
          }}>
            {tb.icon}{tb.label}
            {tb.id === "history" && <span className="text-[8.5px] mono px-1 rounded" style={{ background: "var(--t-accent)", color: "#fff" }}>{store.history.length}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 min-h-0">
        {store.rightTab === "inspect" && <InspectPanel store={store} notify={notify} />}
        {store.rightTab === "layout" && <LayoutPanel store={store} notify={notify} />}
        {store.rightTab === "commands" && <CommandsPanel store={store} notify={notify} />}
        {store.rightTab === "history" && <HistoryPanel store={store} notify={notify} />}
        {store.rightTab === "stats" && <StatsPanel store={store} notify={notify} />}
        {store.rightTab === "keys" && <KeysPanel store={store} notify={notify} />}
        {store.rightTab === "mcp" && <McpPanel store={store} notify={notify} />}
        {store.rightTab === "theme" && <ThemePanel store={store} notify={notify} />}
        {store.rightTab === "sys" && <SysPanel store={store} notify={notify} />}
      </div>
    </div>
  );
}

export function UnusedRefs() {
  return <span className="hidden">{fmtDate(0)}{fmtTime(0)}{fmtClock(0)}<Pencil size={8} /><Star size={8} /><Clock size={8} /><Download size={8} /><Cpu size={8} /><BarChart3 size={8} /><History size={8} /><Keyboard size={8} /><Plug size={8} /><Type size={8} /><Terminal size={8} /><Layers size={8} /><ListOrdered size={8} /><FolderGit2 size={8} /><Settings2 size={8} /><Pin size={8} /><PinOff size={8} /><X size={8} /><Check size={8} /><Award size={8} /><Flame size={8} /><Monitor size={8} /><Play size={8} /><Plus size={8} /><Search size={8} /><Trash2 size={8} /><Copy size={8} /><Zap size={8} /><ZoomIn size={8} /><ArrowDown size={8} /><ArrowRight size={8} /><AlignHorizontalDistributeCenter size={8} /><FlipHorizontal2 size={8} /><Equal size={8} /><ChevronDown size={8} /></span>;
}
