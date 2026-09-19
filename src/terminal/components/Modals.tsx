import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Blocks, Boxes, Clock, Download, FolderInput, History, Layers, Play, Plus, RotateCcw, Save, Search,
  Settings2, Star, Terminal, Trash2, Upload, X, Zap,
} from "lucide-react";
import type { Preset, SavedCommand, Workspace } from "../lib/types";
import { PRESETS, TAB_COLORS, uid } from "../lib/data";
import { SHELLS } from "../lib/electron";
import { cx, download, fillDynamic, parseDynamicParams, timeAgo } from "../lib/utils";
import type { Store } from "../hooks/useConsoleStore";
import { TabIcon } from "./TabIcon";

function Shell({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(3,5,10,.66)", backdropFilter: "blur(6px)" }} onClick={onClose} role="dialog" aria-modal="true">
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.97, y: 8, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        className={cx("w-full rounded-2xl border overflow-hidden shadow-2xl max-h-[86vh] flex flex-col", wide ? "max-w-3xl" : "max-w-xl")}
        style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ---------- command palette ---------- */
export function Palette({ store, onClose, onCmd, onNewCmd }: { store: Store; onClose: () => void; onCmd: (c: string) => void; onNewCmd: (prefill: string) => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const items = useMemo(() => {
    const ql = q.toLowerCase();
    const tabs = store.sortedTabs.filter((t) => t.label.toLowerCase().includes(ql)).map((t) => ({ kind: "tab" as const, id: t.id, title: t.label, sub: `${Object.keys(t.panes).length} panes · ${t.stats.cmdCount} cmds`, color: t.color, icon: t.icon }));
    const cmds = store.commands.filter((c) => (c.name + c.command).toLowerCase().includes(ql)).map((c) => ({ kind: "cmd" as const, id: c.id, title: c.name, sub: c.command.slice(0, 64), color: c.color, icon: "zap" }));
    const wss = store.workspaces.filter((w) => w.name.toLowerCase().includes(ql)).map((w) => ({ kind: "ws" as const, id: w.id, title: w.name, sub: `${w.tabs.length} tabs · ${timeAgo(w.updatedAt)}`, color: w.color, icon: "terminal" }));
    const acts = [
      { title: "New tab", sub: "open tab dialog", go: () => onCmd("__new_tab__") },
      { title: "Split horizontal", sub: "active pane →", go: () => { const t = store.activeTab; if (t) store.splitPane(t.id, t.activePaneId, "row"); } },
      { title: "Split vertical", sub: "active pane ↓", go: () => { const t = store.activeTab; if (t) store.splitPane(t.id, t.activePaneId, "col"); } },
      { title: "Zoom pane", sub: "maximize focus", go: () => { const t = store.activeTab; if (t) store.setZoom({ tabId: t.id, paneId: t.activePaneId }); } },
      { title: "Toggle broadcast", sub: "input to all panes", go: () => onCmd("__broadcast__") },
      { title: "Save workspace…", sub: "snapshot tabs", go: () => onCmd("__save_ws__") },
      { title: "Open stats", sub: "analytics", go: () => { store.setRightTab("stats"); } },
      { title: "Open history search", sub: "every command", go: () => { store.setRightTab("history"); } },
      { title: "Open MCP bus", sub: "tools & log", go: () => { store.setRightTab("mcp"); } },
      { title: "Cycle theme", sub: "appearance", go: () => onCmd("__cycle_theme__") },
      { title: "Balance splits", sub: "layout 50/50", go: () => { const t = store.activeTab; if (t) store.balanceAction(t.id); } },
    ].filter((a) => a.title.toLowerCase().includes(ql)).map((a, i) => ({ kind: "act" as const, id: `a${i}`, title: a.title, sub: a.sub, color: "var(--t-accent)", icon: "terminal", go: a.go }));
    const hist = store.history.filter((h) => h.command.toLowerCase().includes(ql)).slice(0, 5).map((h) => ({ kind: "hist" as const, id: h.id, title: h.command, sub: `${h.tabLabel} · ${timeAgo(h.timestamp)}`, color: "var(--t-muted)", icon: "history" }));
    return [...tabs.slice(0, 6), ...cmds.slice(0, 6), ...wss.slice(0, 3), ...acts, ...hist];
  }, [q, store]);

  useEffect(() => setIdx(0), [q]);
  const pick = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === "tab") store.setActiveTabId(it.id);
    else if (it.kind === "cmd") { const c = store.commands.find((x) => x.id === it.id); if (c) onCmd(c.id.startsWith("__") ? c.command : `__runcmd__${c.id}`); }
    else if (it.kind === "ws") { store.restoreWorkspace(it.id); }
    else if (it.kind === "act") (it as { go: () => void }).go();
    else if (it.kind === "hist") { const h = store.history.find((x) => x.id === it.id); if (h) onCmd(h.command); }
    onClose();
  };
  return (
    <Shell onClose={onClose}>
      <div className="flex items-center gap-2.5 px-4 h-14 border-b" style={{ borderColor: "var(--t-border)" }}>
        <Search size={17} style={{ color: "var(--t-accent)" }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setIdx((v) => Math.min(v + 1, items.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx((v) => Math.max(v - 1, 0)); } if (e.key === "Enter") pick(idx); }} placeholder="Type a tab, command, workspace, action or history…" aria-label="command palette" className="flex-1 bg-transparent outline-none text-[14px] mono" style={{ color: "var(--t-fg)" }} />
        <kbd className="text-[10px] mono px-1.5 py-1 rounded-md border" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>esc</kbd>
      </div>
      <div className="overflow-y-auto p-2 max-h-[52vh]">
        {items.map((it, i) => (
          <button key={`${it.kind}-${it.id}`} onMouseEnter={() => setIdx(i)} onClick={() => pick(i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition" style={{ background: i === idx ? "color-mix(in srgb, var(--t-accent) 13%, transparent)" : "transparent" }}>
            <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${it.kind === "act" || it.kind === "hist" ? "var(--t-accent)" : it.color}1c`, color: it.kind === "act" || it.kind === "hist" ? "var(--t-accent)" : it.color }}><TabIcon name={it.icon} size={15} /></span>
            <span className="flex-1 min-w-0"><span className="block text-[13px] font-semibold truncate mono" style={{ color: "var(--t-fg)" }}>{it.title}</span><span className="block text-[11px] truncate" style={{ color: "var(--t-muted)" }}>{it.sub}</span></span>
            <span className="text-[10px] mono font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ background: "var(--t-bg)", color: "var(--t-muted)" }}>{it.kind}</span>
          </button>
        ))}
        {!items.length && <div className="text-center py-10 text-[13px]" style={{ color: "var(--t-muted)" }}>No matches for “{q}”.</div>}
      </div>
      <div className="flex items-center gap-3 px-4 h-10 border-t text-[10.5px]" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>
        <span><b>↑↓</b> navigate</span><span><b>↵</b> run / open</span><span><b>esc</b> close</span>
        <button onClick={() => { onNewCmd(q); }} className="ml-auto font-bold" style={{ color: "var(--t-accent)" }}>＋ save “{q || "…"}” as command</button>
      </div>
    </Shell>
  );
}

/* ---------- presets ---------- */
export function PresetsModal({ store, onClose, notify }: { store: Store; onClose: () => void; notify: (m: string) => void }) {
  const [q, setQ] = useState("");
  const list = PRESETS.filter((p) => (p.name + p.description + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell onClose={onClose} wide>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, var(--t-accent), var(--t-accent2))" }}><Blocks size={17} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>Preset gallery</div><div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>One-click tab layouts with bootstrap commands</div></div>
        <div className="relative hidden sm:block w-44">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--t-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter presets…" className="w-full h-9 pl-8 pr-2 rounded-xl border text-[12px] outline-none mono" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
        </div>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="overflow-y-auto px-5 pb-5 grid sm:grid-cols-2 gap-2.5">
        {list.map((p: Preset) => (
          <div key={p.id} className="rounded-2xl border p-3.5 transition hover:-translate-y-0.5" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)" }}>
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${p.color}1a`, color: p.color }}><TabIcon name={p.icon} size={18} /></span>
              <div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]" style={{ color: "var(--t-fg)" }}>{p.name}</div><div className="text-[11px] truncate" style={{ color: "var(--t-muted)" }}>{p.description}</div></div>
            </div>
            <div className="flex gap-1 mt-2.5 flex-wrap">{p.tags.map((tg) => <span key={tg} className="text-[9.5px] mono px-1.5 py-0.5 rounded-md" style={{ background: `${p.color}14`, color: p.color }}>#{tg}</span>)}<span className="text-[9.5px] mono px-1.5 py-0.5 rounded-md ml-auto" style={{ background: "var(--t-panel2)", color: "var(--t-muted)" }}>{p.layout}</span></div>
            <div className="mt-2 rounded-lg p-2 text-[10.5px] mono space-y-0.5 max-h-[74px] overflow-hidden" style={{ background: "var(--t-panel)", color: "var(--t-muted)" }}>
              {p.bootstrap.map((b) => <div key={b} className="truncate">$ {b}</div>)}
            </div>
            <button onClick={() => { store.newTab({ label: p.name, color: p.tabColor, groupId: p.group, layout: p.layout, bootstraps: p.bootstrap, icon: p.icon }); notify(`Launched “${p.name}”`); onClose(); }} className="mt-2.5 w-full h-9 rounded-xl text-white text-[12.5px] font-bold flex items-center justify-center gap-2 transition hover:brightness-110" style={{ background: p.color }}><Play size={14} />Launch preset</button>
          </div>
        ))}
        {!list.length && <div className="col-span-2 text-center py-8 text-[12.5px]" style={{ color: "var(--t-muted)" }}>No presets match “{q}”.</div>}
      </div>
    </Shell>
  );
}

/* ---------- workspaces ---------- */
export function WorkspacesModal({ store, onClose, onSave, notify }: { store: Store; onClose: () => void; onSave: () => void; notify: (m: string) => void }) {
  const exportWs = (w: Workspace) => download(`${w.name.replace(/\s+/g, "-").toLowerCase()}.penguin.json`, JSON.stringify(w, null, 2));
  return (
    <Shell onClose={onClose} wide>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #a78bfa, #22d3ee)" }}><Boxes size={17} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>Workspaces</div><div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>Snapshots of every open tab, split & pane — restore in one click</div></div>
        <button onClick={onSave} className="h-9 px-3.5 rounded-xl text-white text-[12.5px] font-semibold flex items-center gap-1.5 shrink-0" style={{ background: "var(--t-accent)" }}><Save size={14} />Save current</button>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="overflow-y-auto px-5 pb-5 space-y-2.5">
        {!store.workspaces.length && <div className="text-center py-10 text-[13px] rounded-2xl border border-dashed" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>No workspaces yet. Arrange your tabs & splits, then hit <b>Save current</b>.</div>}
        {store.workspaces.map((w) => (
          <div key={w.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)" }}>
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: w.color }} />
              <div className="flex-1 min-w-0"><div className="font-bold text-[13.5px] truncate" style={{ color: "var(--t-fg)" }}>{w.name}</div><div className="text-[11px] truncate" style={{ color: "var(--t-muted)" }}>{w.description}</div></div>
              <span className="text-[10px] mono hidden sm:inline shrink-0" style={{ color: "var(--t-muted)" }}>{timeAgo(w.updatedAt)}</span>
            </div>
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {w.tabs.map((t) => (
                <span key={t.id} className="flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-lg border" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />{t.label}<span className="mono opacity-50">×{Object.keys(t.panes).length}</span></span>
              ))}
            </div>
            <div className="flex gap-1.5 mt-3">
              <button onClick={() => { store.restoreWorkspace(w.id); notify(`Restored “${w.name}”`); onClose(); }} className="flex-1 h-8 rounded-xl text-white text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: w.color }}><RotateCcw size={13} />Restore</button>
              <button onClick={() => exportWs(w)} title="Export JSON" className="w-8 h-8 rounded-xl border grid place-items-center" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Download size={13} /></button>
              <button onClick={() => store.setWorkspaces((ws) => ws.filter((x) => x.id !== w.id))} title="Delete workspace" className="w-8 h-8 rounded-xl border grid place-items-center hover:bg-red-500/80 hover:text-white hover:border-transparent" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <label className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed text-[12.5px] font-semibold cursor-pointer transition hover:border-[var(--t-accent)]" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>
          <Upload size={15} />Import workspace JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => { try {
              const w = JSON.parse(String(r.result)) as Workspace;
              if (!w.tabs?.length || !w.name) throw new Error("bad");
              w.id = uid("ws");
              store.setWorkspaces((ws) => [w, ...ws]); notify(`Imported “${w.name}”`);
            } catch { notify("Invalid workspace file"); } };
            r.readAsText(f);
            e.target.value = "";
          }} />
        </label>
      </div>
    </Shell>
  );
}

/* ---------- save workspace ---------- */
export function SaveWsModal({ store, onClose, notify }: { store: Store; onClose: () => void; notify: (m: string) => void }) {
  const [name, setName] = useState(`Workspace ${store.workspaces.length + 1}`);
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(TAB_COLORS[store.workspaces.length % TAB_COLORS.length]);
  const save = () => {
    if (!name.trim()) { notify("Give the workspace a name"); return; }
    store.saveWorkspace(name.trim(), desc.trim(), color);
    notify(`Saved “${name.trim()}”`);
    onClose();
  };
  return (
    <Shell onClose={onClose}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: color }}><Save size={16} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>Save workspace</div><div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>{store.tabs.length} tabs · {store.tabs.reduce((a, t) => a + Object.keys(t.panes).length, 0)} panes will be snapshotted</div></div>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} className="w-full h-10 px-3.5 rounded-xl border text-[13.5px] font-semibold outline-none mt-1 mono" style={{ background: "var(--t-bg)", borderColor: color, color: "var(--t-fg)" }} /></div>
        <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Description (optional)</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="e.g. pre-release triage layout" className="w-full h-10 px-3.5 rounded-xl border text-[13px] outline-none mt-1" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} /></div>
        <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Color</label>
          <div className="flex gap-1.5 mt-1.5">{TAB_COLORS.map((c) => <button key={c} aria-label={`color ${c}`} onClick={() => setColor(c)} className="w-8 h-8 rounded-lg transition hover:scale-110" style={{ background: c, outline: color === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} />)}</div></div>
        <div className="rounded-xl p-2.5 flex gap-1.5 flex-wrap" style={{ background: "var(--t-bg)" }}>
          {store.tabs.map((t) => <span key={t.id} className="flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-lg border" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />{t.label}</span>)}
        </div>
        <button onClick={save} className="w-full h-10 rounded-xl text-white text-[13px] font-bold" style={{ background: color }}>Snapshot workspace</button>
      </div>
    </Shell>
  );
}

/* ---------- new tab ---------- */
export function NewTabModal({ store, onClose, notify }: { store: Store; onClose: () => void; notify: (m: string) => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TAB_COLORS[store.tabs.length % TAB_COLORS.length]);
  const [groupId, setGroupId] = useState(store.groups[0]?.id ?? "");
  const [layout, setLayout] = useState<Preset["layout"]>("single");
  const [icon, setIcon] = useState("terminal");
  const [shellId, setShellId] = useState(store.shell);
  const open = () => { store.newTab({ label: label.trim() || `shell ${store.tabs.length + 1}`, color, groupId, layout, icon, shell: shellId }); notify(`Opened “${label.trim() || "shell"}”`); onClose(); };
  return (
    <Shell onClose={onClose}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: color }}><Terminal size={16} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>New terminal tab</div><div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>Label, color-code, group, shell & split layout</div></div>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tab label — e.g. api · staging" onKeyDown={(e) => { if (e.key === "Enter") open(); }} aria-label="tab label" className="w-full h-10 px-3.5 rounded-xl border text-[13.5px] font-semibold outline-none mono" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
        <div className="flex gap-1.5" role="radiogroup" aria-label="tab color">{TAB_COLORS.map((c) => <button key={c} aria-label={`color ${c}`} onClick={() => setColor(c)} className="w-8 h-8 rounded-lg transition hover:scale-110" style={{ background: c, outline: color === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} />)}</div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Group</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full h-9 px-2 rounded-xl border text-[12.5px] mt-1 outline-none" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }}>
              {store.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></div>
          <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Shell</label>
            <select value={shellId} onChange={(e) => setShellId(e.target.value)} className="w-full h-9 px-2 rounded-xl border text-[12.5px] mt-1 outline-none mono" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }}>
              {SHELLS.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.version}</option>)}
            </select></div>
        </div>
        <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Icon</label>
          <div className="flex gap-1 mt-1 flex-wrap">{["terminal", "code", "server", "git", "activity", "database", "container", "monitor"].map((ic) => <button key={ic} title={ic} onClick={() => setIcon(ic)} className="w-8 h-9 rounded-lg border grid place-items-center" style={{ borderColor: icon === ic ? color : "var(--t-border)", color: icon === ic ? color : "var(--t-muted)" }}><TabIcon name={ic} size={14} /></button>)}</div></div>
        <div><label className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--t-muted)" }}>Split layout</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {(["single", "dual-h", "dual-v", "triple", "quad", "sidebar"] as const).map((k) => <button key={k} onClick={() => setLayout(k)} className="h-8 rounded-lg border text-[11px] font-bold mono" style={{ borderColor: layout === k ? color : "var(--t-border)", color: layout === k ? color : "var(--t-muted)" }}>{k}</button>)}
          </div></div>
        <button onClick={open} className="w-full h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2" style={{ background: color }}><Plus size={15} />Open tab</button>
      </div>
    </Shell>
  );
}

/* ---------- save command ---------- */
export function SaveCmdModal({ store, initial, onClose, notify }: { store: Store; initial: string; onClose: () => void; notify: (m: string) => void }) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState(initial);
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Dev");
  const [color, setColor] = useState("#22d3ee");
  const dyn = parseDynamicParams(command);
  useEffect(() => setCommand(initial), [initial]);
  const save = () => {
    if (!name.trim() || !command.trim()) { notify("Name + command required"); return; }
    const c: SavedCommand = { id: uid("c"), name: name.trim(), command: command.trim(), description: desc.trim() || "Custom command", category: cat, color, favorite: false, runCount: 0, createdAt: Date.now() };
    store.setCommands((cs) => [c, ...cs]);
    notify(`Saved “${c.name}”${dyn.length ? ` · ${dyn.length} inputs` : ""}`);
    onClose();
  };
  return (
    <Shell onClose={onClose} wide>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #fbbf24, #f97316)" }}><Zap size={16} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>Save command</div><div className="text-[11.5px]" style={{ color: "var(--t-muted)" }}>Use <span className="mono font-semibold" style={{ color: "var(--t-accent)" }}>{`{{name}}`}</span>, <span className="mono font-semibold" style={{ color: "var(--t-accent)" }}>{`{{name:default}}`}</span> or <span className="mono font-semibold" style={{ color: "var(--t-accent)" }}>{`{{name|a|b}}`}</span> for dropdown inputs</div></div>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="px-5 pb-5 grid sm:grid-cols-2 gap-3">
        <div className="space-y-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Command name — e.g. Deploy staging" aria-label="command name" className="w-full h-10 px-3.5 rounded-xl border text-[13px] font-semibold outline-none" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
          <textarea value={command} onChange={(e) => setCommand(e.target.value)} rows={4} spellCheck={false} placeholder="ssh {{user:deploy}}@{{host|prod-01|staging-01}} 'cd {{dir:/srv/app}} && git pull'" aria-label="command body" className="w-full p-3 rounded-xl border text-[12.5px] outline-none mono resize-none" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" aria-label="command description" className="w-full h-9 px-3 rounded-xl border text-[12.5px] outline-none" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
          <div className="flex gap-1.5 flex-wrap">
            {["Dev", "Git", "DevOps", "System", "Docker", "K8s", "Media", "Custom"].map((c) => <button key={c} onClick={() => setCat(c)} className="h-7 px-2.5 rounded-lg text-[11px] font-bold border" style={{ borderColor: cat === c ? "var(--t-accent)" : "var(--t-border)", color: cat === c ? "var(--t-accent)" : "var(--t-muted)" }}>{c}</button>)}
          </div>
          <div className="flex gap-1.5">{TAB_COLORS.map((c) => <button key={c} aria-label={`color ${c}`} onClick={() => setColor(c)} className="w-7 h-7 rounded-lg" style={{ background: c, outline: color === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} />)}</div>
        </div>
        <div className="rounded-xl border p-3 flex flex-col" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)" }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--t-muted)" }}>Live preview · {dyn.length} input{dyn.length === 1 ? "" : "s"}</div>
          {dyn.length === 0 && <div className="text-[12px] mb-2" style={{ color: "var(--t-muted)" }}>No dynamic inputs — add <span className="mono" style={{ color: "var(--t-accent)" }}>{`{{port:3000}}`}</span> to prompt for values at run time.</div>}
          <div className="space-y-1 mb-1 max-h-32 overflow-y-auto">
            {dyn.map((d) => <div key={d.name} className="flex items-center gap-2 text-[11.5px] mono"><span className="px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)", color: "var(--t-accent)" }}>{`{{${d.name}}}`}</span><span className="truncate" style={{ color: "var(--t-muted)" }}>{d.options.length ? `options: ${d.options.join(", ")}` : `default: ${d.def || "—"}`}</span></div>)}
          </div>
          <div className="text-[11.5px] mono p-2.5 rounded-lg break-all mt-1" style={{ background: "var(--t-panel)", color: "#34d399" }}>$ {fillDynamic(command, {}) || "…"}</div>
          <div className="flex gap-1.5 mt-1">
            <button onClick={() => setCommand((c) => c ? `${c} {{arg:val}}` : "{{arg:val}}") } className="flex-1 h-7 rounded-lg border text-[10.5px] font-bold" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>+ text input</button>
            <button onClick={() => setCommand((c) => c ? `${c} {{env|dev|staging|prod}}` : "{{env|dev|staging|prod}}")} className="flex-1 h-7 rounded-lg border text-[10.5px] font-bold" style={{ borderColor: "var(--t-border)", color: "var(--t-muted)" }}>+ dropdown</button>
          </div>
          <div className="flex-1" />
          <button onClick={save} className="mt-3 w-full h-10 rounded-xl text-white text-[12.5px] font-semibold flex items-center justify-center gap-2" style={{ background: "var(--t-accent)" }}><Star size={14} />Save command</button>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- dynamic runner ---------- */
export function RunCmdModal({ store, cmd, onClose, notify }: { store: Store; cmd: SavedCommand; onClose: () => void; notify: (m: string) => void }) {
  const params = parseDynamicParams(cmd.command);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(params.map((p) => [p.name, p.def])));
  const final = fillDynamic(cmd.command, vals);
  const missing = params.filter((p) => !(vals[p.name] ?? "").trim() && !p.def);
  const run = () => {
    if (missing.length) { notify(`Fill: ${missing.map((m) => m.name).join(", ")}`); return; }
    const t = store.activeTab;
    if (!t) return;
    store.runCommand(t.id, t.activePaneId, final);
    store.setCommands((cs) => cs.map((x) => x.id === cmd.id ? { ...x, runCount: x.runCount + 1 } : x));
    notify(`Ran “${cmd.name}”`);
    onClose();
  };
  return (
    <Shell onClose={onClose}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: cmd.color }}><Zap size={16} /></div>
        <div className="flex-1 min-w-0"><div className="font-semibold text-[15px]" style={{ color: "var(--t-fg)" }}>{cmd.name}</div><div className="text-[11.5px] truncate" style={{ color: "var(--t-muted)" }}>{cmd.description}</div></div>
        <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0" style={{ color: "var(--t-muted)" }}><X size={16} /></button>
      </div>
      <div className="px-5 pb-5 space-y-2.5">
        <div className="text-[11px] mono p-2.5 rounded-xl break-all" style={{ background: "var(--t-bg)", color: "var(--t-muted)" }}>{cmd.command}</div>
        {params.map((p) => (
          <div key={p.name}>
            <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mono" style={{ color: "var(--t-accent)" }}>{p.name}{!p.def && " *"}</label>
            {p.options.length ? (
              <select value={vals[p.name] ?? p.def} onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-[13px] mt-1 outline-none mono" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-fg)" }}>
                {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input value={vals[p.name] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))} placeholder={p.def || `value for ${p.name}`} onKeyDown={(e) => { if (e.key === "Enter") run(); }} className="w-full h-10 px-3 rounded-xl border text-[13px] mt-1 outline-none mono" style={{ background: "var(--t-bg)", borderColor: missing.some((m) => m.name === p.name) ? "#fb7185" : "var(--t-border)", color: "var(--t-fg)" }} />
            )}
          </div>
        ))}
        <div className="text-[12px] mono p-2.5 rounded-xl break-all border" style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "#34d399" }}>$ {final}</div>
        <button onClick={run} className="w-full h-10 rounded-xl text-white text-[12.5px] font-semibold flex items-center justify-center gap-2" style={{ background: "var(--t-accent)" }}><Play size={14} />Execute in active pane</button>
      </div>
    </Shell>
  );
}

export function Toasts({ toasts }: { toasts: { id: string; msg: string }[] }) {
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[12.5px] font-semibold shadow-2xl" style={{ background: "var(--t-panel2)", borderColor: "var(--t-accent)", color: "var(--t-fg)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--t-accent)" }} />{t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ModalsHint() {
  return <span className="hidden"><FolderInput size={8} /><History size={8} /><Clock size={8} /><Layers size={8} /><Settings2 size={8} /></span>;
}
