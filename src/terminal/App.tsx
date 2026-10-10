import { ImportModal } from './components/Modals';
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useConsoleStore } from "./hooks/useConsoleStore";
import type { Store } from "./hooks/useConsoleStore";
import { getAmbientPrefs } from "../lib/ambient";

/** 0-100 alpha -> 2-digit hex suffix, matching src/lib/ambient.ts. */
function hexAlpha(v: number): string {
  return Math.max(0, Math.min(255, Math.round((v / 100) * 255)))
    .toString(16).padStart(2, "0");
}
import { THEMES, uid } from "./lib/data";
import { buildTranscript, download, fillDynamic, matchCombo } from "./lib/utils";
import type { SavedCommand } from "./lib/types";
import { TitleBar } from "./components/TitleBar";
import { BottomBar, LeftSidebar, TabStrip } from "./components/Chrome";
import { SplitView, TermPane } from "./components/Terminal";
import { RightPanel } from "./components/Panels";
import { NewTabModal, Palette, PresetsModal, RunCmdModal, SaveCmdModal, SaveWsModal, Toasts, WorkspacesModal } from "./components/Modals";
import { ArrowUpDown, BookmarkPlus, Check, Download, Maximize2, MoreHorizontal, Pencil, Radio, Scale, Search, X, Upload, Import } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Modal = "palette" | "presets" | "workspaces" | "savews" | "newtab" | "savecmd" | "rename" | "find" | "import" | null;

const PASSIVE_KEYS = ["t", "w", "r", "h", "v", "]", "[", "k", "l", "s", "f", "y", "p", "b", "d", "z", "tab", "arrowright", "arrowleft"];

const SIDEBAR_MIN = 208;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 264;
const RIGHT_MIN = 264;
const RIGHT_MAX = 720;
const RIGHT_DEFAULT = 330;

/** Generic drag handle for the left sidebar and the right inspector. Clamped so a
 *  panel can never be shrunk far enough to obstruct the terminal, nor dragged
 *  wide enough to crowd it out. Drag + arrow keys (keyboard resizing) +
 *  double-click to reset. `side` decides which edge the drag follows. */
function PanelResizer({ store, side }: { store: Store; side: "left" | "right" }) {
  const isLeft = side === "left";
  const min = isLeft ? SIDEBAR_MIN : RIGHT_MIN;
  const max = isLeft ? SIDEBAR_MAX : RIGHT_MAX;
  const width = isLeft ? store.sidebarWidth : store.rightPanelWidth;
  const setWidth = isLeft ? store.setSidebarWidth : store.setRightPanelWidth;
  const label = isLeft ? "sidebar" : "inspector";
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    // Coalesce to one state write per frame. Without this, every mousemove pushes a
    // full re-render of the whole console and the drag becomes janky/laggy.
    let pending = startW;
    let frame = 0;
    // ── WHY THIS IS NOT A setState CALL ──────────────────────────────────────
    // The old handler did `setWidth()` inside requestAnimationFrame. sidebarWidth
    // is App-level state, so every single drag frame re-rendered the WHOLE console:
    // both panels, all panes, every visible scrollback row and the inspector. That
    // is what made the drag feel sticky -- the cost was React, not the mouse.
    //
    // Instead the drag writes inline widths straight to the two affected DOM nodes
    // (zero React work per frame) and commits to the store ONCE on pointerup. The
    // inline styles are cleared on commit so the animated width prop takes over
    // again and React and the DOM cannot disagree.
    const root = (e.currentTarget as HTMLElement).closest("[data-console-root]") as HTMLElement | null;
    const panel = root?.querySelector(`[data-panel="${isLeft ? "left" : "right"}"]`) as HTMLElement | null;
    const inner = panel?.firstElementChild as HTMLElement | null;
    let last = startW;

    const apply = (w: number) => {
      if (panel) panel.style.width = `${w + 8}px`;
      if (inner) inner.style.width = `${w}px`;
    };

    const move = (ev: MouseEvent) => {
      pending = clamp(startW + (isLeft ? 1 : -1) * (ev.clientX - startX));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        last = pending;
        apply(pending);
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (frame) cancelAnimationFrame(frame);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // hand control back to React, then commit exactly once
      if (panel) panel.style.width = "";
      if (inner) inner.style.width = "";
      if (last !== startW) setWidth(last);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`resize ${label}, ${width} pixels`}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-testid={isLeft ? "sidebar-resizer" : "right-panel-resizer"}
      onMouseDown={onDown}
      onDoubleClick={() => setWidth(isLeft ? SIDEBAR_DEFAULT : RIGHT_DEFAULT)}
      onKeyDown={(e) => {
        const nudge = (d: number) => { e.preventDefault(); setWidth(clamp(width + (isLeft ? d : -d))); };
        if (e.key === "ArrowLeft") nudge(16);
        if (e.key === "ArrowRight") nudge(16);
        if (e.key === "Home") { e.preventDefault(); setWidth(min); }
        if (e.key === "End") { e.preventDefault(); setWidth(max); }
      }}
      title="Drag to resize · arrows nudge · double-click resets"
      className="panel-resizer df-interactive-edge w-3 shrink-0 cursor-col-resize grid place-items-center group/resizer outline-none hover:bg-[var(--t-fg)]/[0.05]"
    >
      {/* The grip is ALWAYS visible. It was a 2x32px pill painted in --t-border,
          which is #27272a on #09090b -- effectively invisible -- and it only
          brightened on hover, so there was nothing to aim at. Now a 3x40px muted
          grip that turns accent on hover/focus/drag, inside a 12px hit column
          that tints on hover so the target announces itself. */}
      <span className="w-[3px] h-10 rounded-full transition-colors group-hover/resizer:bg-[var(--t-accent)] group-focus-visible/resizer:bg-[var(--t-accent)] group-active/resizer:bg-[var(--t-accent)]" style={{ background: "var(--t-muted)", opacity: 0.45 }} />
    </div>
  );
}

export default function App() {
  const store = useConsoleStore();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [runCmd, setRunCmd] = useState<SavedCommand | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [saveCmdInitial, setSaveCmdInitial] = useState("");
  const [renameG, setRenameG] = useState<string | null>(null);
  const [gDraft, setGDraft] = useState("");
  const [findQ, setFindQ] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  const notify = useCallback((msg: string) => {
    const id = uid("t");
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const demoMode = store.demoMode;
  const setDemoMode = store.setDemoMode;
  const theme = store.theme;
  // LAMINAR P4 — CHROME IS THE APP'S JOB, NOT THE SYNTAX THEME'S.
  // This block is the reason the console never followed the design spec. All
  // eight terminal palettes used to inject their own --t-bg/--t-panel/--t-accent
  // as raw hex, so the surface ignored the app's zinc ramp + single signal hue
  // entirely -- and "RHEO Dark" shipped accent #f472b6 (pink) as its identity.
  // CHROME now derives from the app's LAMINAR tokens and the page accent, so the
  // console is on-spec no matter which palette is selected. Only SYNTAX colours
  // (prompt / path / selection) stay per-theme: a terminal's content palette is
  // content, not chrome.
  const cssVars = useMemo(() => ({
    ["--t-bg" as string]: "var(--color-background)",
    ["--t-panel" as string]: "var(--color-card)",
    ["--t-panel2" as string]: "color-mix(in srgb, var(--color-card) 88%, var(--color-border))",
    ["--t-fg" as string]: "var(--color-foreground)",
    ["--t-muted" as string]: "var(--color-muted-foreground)",
    ["--t-accent" as string]: "var(--page-accent, #06b6d4)",
    ["--t-accent2" as string]: "var(--color-muted-foreground)",
    ["--t-border" as string]: "var(--color-border)",
    ["--t-promptUser" as string]: theme.promptUser,
    ["--t-promptPath" as string]: theme.promptPath,
    ["--t-selection" as string]: theme.selection,
    // LAMINAR §2 semantics for the console surface. Emerald is success-only,
    // rose is destructive-only, amber is warning-only -- never decoration.
    ["--pc-success" as string]: "var(--pc-emerald)",
    ["--pc-danger" as string]: "var(--pc-rose)",
    ["--pc-warning" as string]: "var(--color-amber-400)",
    ["--pc-warn" as string]: "#fbbf24",
  }), [theme]);

  /** The single gate for "make a new tab". In `quick` mode it creates one
   *  immediately with an auto-name (no dialog); in `prompt` mode it opens the
   *  setup dialog. Every entry point -- +, Ctrl+Shift+T, palette, tab strip,
   *  sidebar, mobile -- routes through here, so the preference is respected
   *  everywhere instead of only at one button. */
  const requestNewTab = useCallback((preset?: Parameters<typeof store.newTab>[0]) => {
    if (store.newTabMode === "prompt" && !preset) { setModal("newtab"); return; }
    const id = store.newTab(preset);
    notify(`New tab · ${store.tabs.length + 1}`);
    return id;
  }, [store, notify]);

  const openRunCmd = useCallback((idOrCmd: string) => {
    const byId = store.commands.find((c) => c.id === idOrCmd);
    if (byId) { setRunCmd(byId); return; }
    const t = store.activeTab;
    if (t) store.runCommand(t.id, t.activePaneId, fillDynamic(idOrCmd, {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.commands, store.activeTabId]);

  const doAction = useCallback((action: string) => {
    const t = store.activeTab;
    switch (action) {
      case "new-tab": requestNewTab(); break;
      case "close-tab": if (t) { store.closeTab(t.id); notify(`Closed “${t.label}”`); } break;
      case "rename": if (t) { setRenameDraft(t.label); setModal("rename"); } break;
      case "pin-tab": if (t) { store.togglePin(t.id); notify(t.pinned ? "Unpinned" : "Pinned to front"); } break;
      case "next-tab": store.cycleTab(1); break;
      case "prev-tab": store.cycleTab(-1); break;
      case "split-h": if (t) { store.splitPane(t.id, t.activePaneId, "row"); notify("Split →"); } break;
      case "split-v": if (t) { store.splitPane(t.id, t.activePaneId, "col"); notify("Split ↓"); } break;
      case "next-pane": if (t) store.cyclePane(t.id, 1); break;
      case "prev-pane": if (t) store.cyclePane(t.id, -1); break;
      case "zoom-pane": if (t) store.setZoom({ tabId: t.id, paneId: t.activePaneId }); break;
      case "broadcast":
        if (t) {
          const on = store.broadcastTabId === t.id;
          store.setBroadcastTabId(on ? null : t.id);
          notify(on ? "Broadcast off" : "Broadcast on — input runs in every pane");
        }
        break;
      case "palette": setModal("palette"); break;
      case "clear": if (t) store.mutateTab(t.id, (x) => ({ ...x, panes: { ...x.panes, [t.activePaneId]: { ...x.panes[t.activePaneId], lines: [] } } })); break;
      case "save-workspace": setModal("savews"); break;
      case "save-cmd": setSaveCmdInitial(""); setModal("savecmd"); break;
      case "find-history": store.setRightTab("history"); setRightOpen(true); notify("History search focused"); break;
      case "find": if (t) { setFindOpen(true); setFindQ(""); notify("Find mode active"); } break;
      case "balance": if (t) store.balanceAction(t.id); notify("Panes balanced"); break;
      case "export-transcript": exportTranscript(); break;
      case "import-history": setModal("import"); break;
      case "cycle-theme": {
        const i = THEMES.findIndex((x) => x.id === store.appearance.themeId);
        const n = THEMES[(i + 1) % THEMES.length];
        store.setAppearance({ ...store.appearance, themeId: n.id });
        notify(`Theme → ${n.name}`);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeTabId, store.tabs, store.appearance.themeId, store.broadcastTabId, notify]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      const inTerm = !!target && target.getAttribute?.("aria-label") === "terminal input";
      const pal = store.shortcuts.find((s) => s.action === "palette");
      if (pal && matchCombo(e, pal.keys)) { e.preventDefault(); e.stopPropagation(); setModal((m) => (m === "palette" ? null : "palette")); return; }
      if (e.key === "Escape") {
        if (store.zoom) { store.setZoom(null); return; }
        if (findOpen) { setFindOpen(false); setFindQ(""); return; }
        return;
      }
      if (inField && !inTerm) return;
      if (inTerm) {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
        const modded = e.ctrlKey || e.metaKey;
        if (!modded) return;
        if (!PASSIVE_KEYS.includes(k)) return;
      }
      for (const s of store.shortcuts) {
        if (s.action === "palette") continue;
        if (matchCombo(e, s.keys)) { e.preventDefault(); e.stopPropagation(); doAction(s.action); return; }
      }
    };
    window.addEventListener("keydown", fn, true);
    return () => window.removeEventListener("keydown", fn, true);
  }, [store.shortcuts, doAction, store.zoom, findOpen, store.setZoom]);

  const t = store.activeTab;
  const zoomedPane = store.zoom && t?.id === store.zoom.tabId ? t.panes[store.zoom.paneId] : null;

  const paletteCmd = (c: string) => {
    if (c === "__save_ws__") setModal("savews");
    else if (c === "__cycle_theme__") doAction("cycle-theme");
    else if (c === "__new_tab__") requestNewTab();
    else if (c === "__broadcast__") doAction("broadcast");
    else if (c.startsWith("__runcmd__")) openRunCmd(c.replace("__runcmd__", ""));
    else if (c === "__import__") { setModal("import"); notify("Import terminal history"); }
    else {
      const tt = store.activeTab;
      if (tt) store.runCommand(tt.id, tt.activePaneId, c);
    }
  };

  const exportTranscript = () => {
    if (!t) return;
    const panes = Object.values(t.panes).map((p) => ({ cwd: p.cwd, lines: p.lines.map((l) => ({ type: l.type, text: l.type === "input" ? `$ ${l.text}` : l.text, timestamp: l.timestamp })) }));
    download(`${t.label.replace(/\s+/g, "-").toLowerCase()}-transcript.md`, buildTranscript(t.label, panes), "text/markdown");
    notify("Transcript exported (.md)");
  };

  // Global ambient prefs, kept in sync with Settings.
  const [ambientPrefs, setAmbientPrefsState] = useState(getAmbientPrefs);
  useEffect(() => {
    const onChange = () => setAmbientPrefsState(getAmbientPrefs());
    window.addEventListener("ambient-prefs-changed", onChange);
    return () => window.removeEventListener("ambient-prefs-changed", onChange);
  }, []);

  const matchCount = findQ && t ? Object.values(t.panes).reduce((a, p) => a + p.lines.filter((l) => l.text.toLowerCase().includes(findQ.toLowerCase())).length, 0) : 0;

  return (
    <div data-console-root data-page="terminal" className={store.appearance.glow ? "term-glow h-full flex flex-col" : "h-full flex flex-col"} style={{ background: "var(--color-background)", ...cssVars } as React.CSSProperties}>
      {/* Terminal's own wash, tinted by the TERMINAL THEME (not --page-accent),
          so it still tracks the user's chosen terminal theme. Shares the global
          ambient prefs so one on/off switch governs the whole app: when the user
          turns the ambient background off it must not survive here. */}
      {ambientPrefs.enabled && ambientPrefs.intensity > 0 && (
        <div className="pointer-events-none fixed inset-0 z-0" style={{
          background: `radial-gradient(${900 + (ambientPrefs.spread / 100) * 1400}px ${400 + (ambientPrefs.spread / 100) * 260}px at 15% -5%, var(--page-accent, #06b6d4)${hexAlpha(ambientPrefs.intensity * 0.08)}, transparent 60%), radial-gradient(${800 + (ambientPrefs.spread / 100) * 1300}px ${380 + (ambientPrefs.spread / 100) * 250}px at 95% 0%, var(--page-accent, #06b6d4)${hexAlpha(ambientPrefs.intensity * 0.05)}, transparent 60%)`,
        }} />
      )}
      <a href="#terminal-main" className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:px-3 focus:py-2 focus:rounded-lg" style={{ background: "var(--t-accent)", color: "#fff" }}>Skip to terminal</a>
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <TitleBar
          store={store}
          onPalette={() => setModal("palette")}
          onSaveWs={() => setModal("savews")}
          onWorkspaces={() => setModal("workspaces")}
          onPresets={() => setModal("presets")}
          onNewTab={() => requestNewTab()}
          leftOpen={leftOpen} setLeftOpen={setLeftOpen} rightOpen={rightOpen} setRightOpen={setRightOpen}
          demoMode={demoMode} setDemoMode={setDemoMode}
          onRename={() => { setRenameDraft(t.label); setModal("rename"); }}
        />
        <TabStrip store={store} onNewTab={() => requestNewTab()} />
        <div className="flex-1 flex min-h-0 px-3 pb-3 pt-1">
          {/* The ONE frame of the surface. `console-frame` lifts it onto the
              elevation ramp (plane 2) with the only shadow in the console, and
              `df-rail-edge` gives it a lit top hairline so the chrome reads as a
              physical plane catching light rather than a flat rectangle. */}
          <div className="console-frame df-rail-edge flex-1 flex min-h-0 overflow-hidden rounded-xl border" style={{ borderColor: "var(--t-border)" }}>
          <AnimatePresence initial={false}>
            {leftOpen && (
              <motion.div key="left" data-panel="left" initial={{ width: 0, opacity: 0 }} animate={{ width: store.sidebarWidth + 8, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="hidden lg:flex shrink-0 min-h-0 border-r" style={{ borderColor: "var(--t-border)" }}>
                <div className="h-full" style={{ width: store.sidebarWidth }}>
                  <LeftSidebar store={store} onPresets={() => setModal("presets")} onWorkspaces={() => setModal("workspaces")} onNewTab={() => requestNewTab()} />
                </div>
                <PanelResizer store={store} side="left" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 shrink-0 flex-wrap border-b" style={{ borderColor: "var(--t-border)" }}>
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: `${t?.color ?? "var(--t-accent)"}15`, color: t?.color ?? "var(--t-fg)" }}>
                <span className="w-1.5 h-1.5 rounded-full anim-pulse-dot" style={{ background: t?.color }} />{t?.label}
                {t?.pinned && <span className="text-[9px] mono px-1 rounded" style={{ background: t.color, color: "var(--t-bg)" }}>PINNED</span>}
              </span>
              <span className="text-[10.5px] mono hidden sm:inline" style={{ color: "var(--t-muted)" }}>{t ? Object.keys(t.panes).length : 0} panes · {t?.shell ?? store.shell} · {store.distro.split(" ")[0]}</span>
              {store.broadcastTabId === t?.id && <span className="flex items-center gap-1 text-[10px] mono font-bold px-1.5 py-1 rounded-lg" style={{ background: "rgba(251,113,133,.12)", color: "var(--pc-danger)" }}><Radio size={11} />BROADCAST</span>}
              <div className="flex-1" />
              <button
                onClick={() => { setModal("find"); if (t) { setFindOpen(true); notify("Find mode active"); } }}
                className="h-7 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 hover:bg-[var(--t-fg)]/[0.06]"
                style={{ color: "var(--t-muted)" }}
              >
                <Search size={12} />Find
              </button>
              {/* ONE primary action for this bar. Splitting a pane is the console's
                  core verb, so it is the only thing allowed a filled accent —
                  the rail has zero, and LAMINAR §4 allows one signal per surface,
                  not one per toolbar. Everything else moved into the overflow so
                  this stops being a wall of eight equal chips. */}
              <button
                onClick={() => t && store.splitPane(t.id, t.activePaneId, "row")}
                title="Split pane left/right (Ctrl+Shift+H)"
                className="h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ background: "var(--t-accent)", color: "var(--color-background)" }}
              >
                Split <span className="text-[10px] mono opacity-70">⇧⌃H</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="More pane actions"
                  className="h-7 w-7 rounded-lg grid place-items-center transition-colors hover:bg-[var(--t-fg)]/[0.06]"
                  style={{ color: "var(--t-muted)" }}
                >
                  <MoreHorizontal size={13} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => t && store.splitPane(t.id, t.activePaneId, "col")}>
                    <ArrowUpDown size={13} />
                    Stack panes
                    <span className="ml-auto text-[10px] mono" style={{ color: "var(--t-muted)" }}>⇧⌃V</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => t && store.balanceAction(t.id)}>
                    <Scale size={13} />
                    Balance panes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setModal("import"); notify("Import terminal history"); }}>
                    <Import size={13} />
                    Import history
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportTranscript}>
                    <Download size={13} />
                    Export transcript
                    <span className="ml-auto text-[10px] mono" style={{ color: "var(--t-muted)" }}>.md</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSaveCmdInitial(""); setModal("savecmd"); }}>
                    <BookmarkPlus size={13} />
                    Save command
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {findOpen && (
              <div className="flex items-center gap-2 px-3 py-2 shrink-0 anim-fadeUp border-b" style={{ borderColor: "var(--t-border)" }}>
                <div className="relative flex-1 max-w-xs">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--t-muted)" }} />
                  <input autoFocus value={findQ} onChange={(e) => setFindQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setFindOpen(false); setFindQ(""); } }} placeholder="Find in all panes…" aria-label="find in panes" className="w-full h-8 pl-8 pr-3 rounded-lg text-[12px] outline-none mono border" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)", color: "var(--t-fg)" }} />
                </div>
                <span className="text-[11px] mono" style={{ color: "var(--t-muted)" }}>{findQ ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "type to highlight"}</span>
                <button onClick={() => { setFindOpen(false); setFindQ(""); }} className="w-7 h-7 rounded-lg grid place-items-center hover:bg-white/10" style={{ color: "var(--t-muted)" }} aria-label="close find"><X size={13} /></button>
              </div>
            )}
            <div id="terminal-main" className="flex-1 flex min-h-0 min-w-0" role="main" aria-label="terminal workspace">
              {t && <SplitView store={store} tab={t} node={t.layout} findQ={findQ} onFind={() => setFindOpen(true)} />}
            </div>
          </div>
          <AnimatePresence initial={false}>
            {rightOpen && (
              <motion.div key="right" data-panel="right" initial={{ width: 0, opacity: 0 }} animate={{ width: store.rightPanelWidth + 8, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="hidden md:flex shrink-0 min-h-0 border-l" style={{ borderColor: "var(--t-border)" }}>
                <PanelResizer store={store} side="right" />
                <div className="h-full" style={{ width: store.rightPanelWidth }}>
                  <RightPanel store={store} notify={notify} groupCtl={{ renameG, setRenameG, gDraft, setGDraft }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
        <BottomBar store={store} />
      </div>

      <div className="lg:hidden">
        {leftOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setLeftOpen(false)} />
            <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} className="fixed inset-y-0 left-0 w-[300px] z-40 border-r overflow-hidden" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}>
              <div className="flex justify-end p-2"><button onClick={() => setLeftOpen(false)} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10" style={{ color: "var(--t-muted)" }} aria-label="close sidebar"><X size={15} /></button></div>
              <div className="h-[calc(100%-48px)]"><LeftSidebar store={store} onPresets={() => { setModal("presets"); setLeftOpen(false); }} onWorkspaces={() => { setModal("workspaces"); setLeftOpen(false); }} onNewTab={() => requestNewTab()} /></div>
            </motion.div>
          </>
        )}
      </div>
      <div className="md:hidden">
        {!rightOpen && t && (
          <button onClick={() => setRightOpen(true)} aria-label="Open inspector" className="fixed bottom-12 right-3 z-40 h-8 px-2.5 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors hover:bg-[var(--t-fg)]/[0.06]" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)", color: "var(--t-fg)" }}><Maximize2 size={12} />Inspector</button>
        )}
        {rightOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setRightOpen(false)} />
            <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} className="fixed inset-y-0 right-0 w-[330px] max-w-[92vw] z-40 border-l overflow-hidden" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }}>
              <div className="flex justify-end p-2"><button onClick={() => setRightOpen(false)} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10" style={{ color: "var(--t-muted)" }} aria-label="close inspector"><X size={15} /></button></div>
              <div className="h-[calc(100%-48px)]"><RightPanel store={store} notify={notify} groupCtl={{ renameG, setRenameG, gDraft, setGDraft }} /></div>
            </motion.div>
          </>
        )}
      </div>

      <AnimatePresence>
        {store.zoom && zoomedPane && t && (
          <motion.div key="zoom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 p-4 sm:p-8" style={{ background: "rgba(3,5,10,.78)", backdropFilter: "blur(6px)" }} onClick={() => store.setZoom(null)} role="dialog" aria-modal="true" aria-label="zoomed pane">
            <motion.div initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 6 }} className="h-full max-w-5xl mx-auto flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: "var(--t-fg)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />Zoomed · {t.label}
                <span className="mono font-normal" style={{ color: "var(--t-muted)" }}>esc to exit</span>
                <button onClick={() => store.setZoom(null)} className="ml-auto h-8 px-3 rounded-lg border text-[12px] font-bold" style={{ borderColor: "var(--t-border)", color: "var(--t-fg)" }}>Exit zoom</button>
              </div>
              <div className="flex-1 min-h-0"><TermPane store={store} tab={t} pane={zoomedPane} focused findQ={findQ} /></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "palette" && <Palette store={store} onClose={() => setModal(null)} onCmd={paletteCmd} onNewCmd={(prefill) => { setSaveCmdInitial(prefill); setModal("savecmd"); }} />}
        {modal === "presets" && <PresetsModal store={store} onClose={() => setModal(null)} notify={notify} />}
        {modal === "workspaces" && <WorkspacesModal store={store} onClose={() => setModal(null)} onSave={() => setModal("savews")} notify={notify} />}
        {modal === "savews" && <SaveWsModal store={store} onClose={() => setModal(null)} notify={notify} />}
        {modal === "newtab" && <NewTabModal store={store} onClose={() => setModal(null)} notify={notify} />}
        {modal === "savecmd" && <SaveCmdModal store={store} initial={saveCmdInitial} onClose={() => setModal(null)} notify={notify} />}
        {modal === "import" && <ImportModal store={store} onClose={() => setModal(null)} notify={notify} />}
        {modal === "rename" && t && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(3,5,10,.6)" }} onClick={() => setModal(null)} role="dialog" aria-modal="true" aria-label="rename tab">
            <div className="w-full max-w-sm rounded-xl border p-5 anim-pop" style={{ background: "var(--t-panel)", borderColor: "var(--t-border)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3"><Pencil size={15} style={{ color: "var(--t-accent)" }} /><span className="display font-bold text-[14px]" style={{ color: "var(--t-fg)" }}>Rename tab</span></div>
              <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && renameDraft.trim()) { store.mutateTab(t.id, (x) => ({ ...x, label: renameDraft.trim().slice(0, 40) })); setModal(null); notify("Tab renamed"); } }} className="w-full h-10 px-3.5 rounded-xl border text-[13.5px] font-semibold outline-none mono" style={{ background: "var(--t-bg)", borderColor: t.color, color: "var(--t-fg)" }} />
              <button onClick={() => { if (renameDraft.trim()) { store.mutateTab(t.id, (x) => ({ ...x, label: renameDraft.trim().slice(0, 40) })); notify("Tab renamed"); } setModal(null); }} className="mt-3 w-full h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2" style={{ background: t.color }}><Check size={15} />Rename</button>
              <div className="text-[10.5px] mono mt-2 text-center" style={{ color: "var(--t-muted)" }}>shortcut: {store.shortcuts.find((s) => s.action === "rename")?.keys}</div>
            </div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {runCmd && <RunCmdModal store={store} cmd={runCmd} onClose={() => setRunCmd(null)} notify={notify} />}
      </AnimatePresence>
      <Toasts toasts={toasts} />
    </div>
  );
}
