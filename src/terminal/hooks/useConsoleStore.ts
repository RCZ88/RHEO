import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Appearance, HistoryEntry, MCPLogEntry, MCPServer, PaneNode, PaneState, Preset,
  SavedCommand, Shortcut, TerminalLine, TerminalTab, TermGroup, Workspace, ZoomState,
} from "../lib/types";
import { DEFAULT_APPEARANCE, DEFAULT_COMMANDS, DEFAULT_GROUPS, DEFAULT_MCP, DEFAULT_SHORTCUTS, MOTD, TAB_COLORS, THEMES, uid } from "../lib/data";
import { execShell, execShellReal } from "../lib/shell";

const LS_KEY = "penguin-console-v3";
const LS_OLD = "penguin-console-v2";

/** Hard cap on retained scrollback per pane. */
const MAX_LINES = 600;

function mkPane(cwd = "/home/user", seedCmd?: string, env?: Record<string, string>, demo = true): PaneState {
  const lines: TerminalLine[] = [
    { id: uid("l"), type: "dim", text: MOTD[0], timestamp: Date.now(), demo },
    { id: uid("l"), type: "dim", text: MOTD[1], timestamp: Date.now(), demo },
  ];
  return { id: uid("pane"), cwd, lines, cmdHistory: seedCmd ? [seedCmd] : [], historyCursor: -1, lastExit: 0 };
}

function layoutFor(kind: Preset["layout"], bootstraps: string[], env: Record<string, string>, opts: { distro: string; shell: string }, demo = true): { layout: PaneNode; panes: Record<string, PaneState>; active: string } {
  const panes: Record<string, PaneState> = {};
  const mk = (i: number) => {
    const p = mkPane("/home/user", bootstraps[i], env, demo);
    if (bootstraps[i]) {
      if (demo) {
        const r = execShell(bootstraps[i], p.cwd, env, opts);
        p.lines.push({ id: uid("l"), type: "input", text: bootstraps[i], timestamp: Date.now(), demo });
        r.lines.forEach((l) => { if (!l.text.startsWith("__")) p.lines.push({ ...l, id: uid("l"), timestamp: Date.now(), demo }); });
        p.cwd = r.newCwd;
        p.lastExit = r.exitCode;
      } else {
        // REAL mode: never fabricate output. Record the bootstrap command without
        // inventing a result — the real shell will run it when the user executes it.
        p.cmdHistory = [];
      }
    }
    panes[p.id] = p;
    return p.id;
  };
  const P = (paneId: string): PaneNode => ({ kind: "pane", paneId });
  let layout: PaneNode;
  if (kind === "single") layout = P(mk(0));
  else if (kind === "dual-h") layout = { kind: "split", id: uid("sp"), direction: "row", ratio: 0.5, children: [P(mk(0)), P(mk(1))] };
  else if (kind === "dual-v") layout = { kind: "split", id: uid("sp"), direction: "col", ratio: 0.5, children: [P(mk(0)), P(mk(1))] };
  else if (kind === "triple") {
    const a = mk(0), b = mk(1), c = mk(2);
    layout = { kind: "split", id: uid("sp"), direction: "row", ratio: 0.55, children: [P(a), { kind: "split", id: uid("sp"), direction: "col", ratio: 0.5, children: [P(b), P(c)] }] };
  } else if (kind === "quad") {
    const a = mk(0), b = mk(1), c = mk(2), d = mk(3);
    layout = {
      kind: "split", id: uid("sp"), direction: "row", ratio: 0.5,
      children: [
        { kind: "split", id: uid("sp"), direction: "col", ratio: 0.5, children: [P(a), P(b)] },
        { kind: "split", id: uid("sp"), direction: "col", ratio: 0.5, children: [P(c), P(d)] },
      ],
    };
  } else {
    const a = mk(0), b = mk(1);
    layout = { kind: "split", id: uid("sp"), direction: "row", ratio: 0.32, children: [P(a), P(b)] };
  }
  const ids = Object.keys(panes);
  return { layout, panes, active: ids[0] };
}

export function mkTab(label: string, color: string, groupId: string, kind: Preset["layout"] = "single", bootstraps: string[] = [], icon = "terminal", shell = "zsh", demo = true): TerminalTab {
  const { layout, panes, active } = layoutFor(kind, bootstraps, {}, { distro: "Ubuntu 24.04 LTS", shell }, demo);
  return { id: uid("tab"), label, color, groupId, icon, shell, note: "", layout, panes, activePaneId: active, focusedPaneId: active, createdAt: Date.now(), stats: { cmdCount: demo ? bootstraps.filter(Boolean).length : 0 } };
}

function seedTabs(demo = true): TerminalTab[] {
  const t1 = mkTab("nova · dev", "#22d3ee", "g-dev", "triple", ["cd ~/projects/nova && git status", "docker ps", "neofetch"], "code", "zsh", demo);
  const t2 = mkTab("ops · prod-01", "#a78bfa", "g-ops", "dual-h", ["ssh prod-01", "tail -f /var/log/syslog"], "server", "bash", demo);
  const t3 = mkTab("sys · monitor", "#34d399", "g-sys", "single", ["neofetch"], "activity", "fish", demo);
  t3.pinned = false;
  return [t1, t2, t3];
}

function seedHistory(tabs: TerminalTab[]): HistoryEntry[] {
  const cmds = ["git status", "docker ps", "npm run dev", "ls -la ~/projects/nova", "htop", "git log --oneline -n 12", "ssh prod-01", "df -h", "tail -f /var/log/syslog", "npm test", "neofetch", "kubectl get pods", "cd ~/projects/nova/server", "git diff", "free -h", "sensors", "systemctl --failed"];
  const out: HistoryEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < 84; i++) {
    const cmd = cmds[i % cmds.length];
    const tab = tabs[i % tabs.length];
    const paneIds = Object.keys(tab.panes);
    const ts = now - i * 1000 * 60 * (5 + ((i * 13) % 37));
    out.push({
      id: uid("h"), command: cmd, preview: i % 17 === 5 ? "✗ exit 1" : "✓ exit 0",
      tabId: tab.id, tabLabel: tab.label, paneId: paneIds[0], cwd: "/home/user/projects/nova",
      timestamp: ts, exitCode: i % 17 === 5 ? 1 : 0, durationMs: 40 + ((i * 37) % 900), demo: true,
    });
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- tree helpers (pure) ----
export function listPaneIds(n: PaneNode): string[] {
  if (n.kind === "pane") return [n.paneId];
  return [...listPaneIds(n.children[0]), ...listPaneIds(n.children[1])];
}
export function countLeaves(n: PaneNode): number {
  return n.kind === "pane" ? 1 : countLeaves(n.children[0]) + countLeaves(n.children[1]);
}
export function splitNode(n: PaneNode, paneId: string, dir: "row" | "col", newPaneId: string): PaneNode {
  if (n.kind === "pane") {
    if (n.paneId !== paneId) return n;
    return { kind: "split", id: uid("sp"), direction: dir, ratio: 0.5, children: [{ kind: "pane", paneId }, { kind: "pane", paneId: newPaneId }] };
  }
  return { ...n, children: [splitNode(n.children[0], paneId, dir, newPaneId), splitNode(n.children[1], paneId, dir, newPaneId)] };
}
export function removePane(n: PaneNode, paneId: string): PaneNode | null {
  if (n.kind === "pane") return n.paneId === paneId ? null : n;
  const l = removePane(n.children[0], paneId);
  const r = removePane(n.children[1], paneId);
  if (!l) return r;
  if (!r) return l;
  return { ...n, children: [l, r] };
}
export function setRatio(n: PaneNode, splitId: string, ratio: number): PaneNode {
  if (n.kind === "pane") return n;
  if (n.id === splitId) return { ...n, ratio };
  return { ...n, children: [setRatio(n.children[0], splitId, ratio), setRatio(n.children[1], splitId, ratio)] };
}
export function flipSplit(n: PaneNode, splitId: string): PaneNode {
  if (n.kind === "pane") return n;
  if (n.id === splitId) return { ...n, direction: n.direction === "row" ? "col" : "row" };
  return { ...n, children: [flipSplit(n.children[0], splitId), flipSplit(n.children[1], splitId)] };
}
export function balance(n: PaneNode): PaneNode {
  if (n.kind === "pane") return n;
  return { ...n, ratio: 0.5, children: [balance(n.children[0]), balance(n.children[1])] };
}
export function collectSplits(n: PaneNode, depth = 0): { id: string; direction: "row" | "col"; ratio: number; depth: number }[] {
  if (n.kind === "pane") return [];
  return [{ id: n.id, direction: n.direction, ratio: n.ratio, depth }, ...collectSplits(n.children[0], depth + 1), ...collectSplits(n.children[1], depth + 1)];
}

interface Persist {
  tabs: TerminalTab[]; activeTabId: string; groups: TermGroup[]; workspaces: Workspace[];
  commands: SavedCommand[]; history: HistoryEntry[]; shortcuts: Shortcut[]; appearance: Appearance;
  distro: string; shell: string; demoMode: boolean; sidebarWidth: number; rightPanelWidth: number;
  autosaveEnabled: boolean;
}

function load(): Persist | null {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LS_OLD);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persist;
    if (!p.tabs?.length) return null;
    return p;
  } catch { return null; }
}

export function useConsoleStore() {
  const saved = useRef<Persist | null | undefined>(undefined);
  if (saved.current === undefined) saved.current = typeof window !== "undefined" ? load() : null;
  const s = saved.current;

  const initialDemo = s?.demoMode ?? true;
  const [demoMode, setDemoMode] = useState(initialDemo);

  const initialTabs = useMemo(() => s?.tabs ?? seedTabs(initialDemo), []); // eslint-disable-line
  const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState(s?.activeTabId ?? initialTabs[0].id);
  const [groups, setGroups] = useState<TermGroup[]>(s?.groups ?? DEFAULT_GROUPS);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(s?.workspaces ?? []);
  const [commands, setCommands] = useState<SavedCommand[]>(s?.commands ?? DEFAULT_COMMANDS);
  const [history, setHistory] = useState<HistoryEntry[]>(() => (initialDemo ? s?.history ?? seedHistory(initialTabs) : (s?.history ?? []).filter((h) => !h.demo)));
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(s?.shortcuts ?? DEFAULT_SHORTCUTS);
  const [appearance, setAppearance] = useState<Appearance>(() => ({ ...DEFAULT_APPEARANCE, ...(s?.appearance ?? {}) }));
  const [mcp, setMcp] = useState<MCPServer[]>(DEFAULT_MCP);
  const [mcpLog, setMcpLog] = useState<MCPLogEntry[]>(() => [
    { id: uid("m"), ts: Date.now() - 1000 * 60 * 42, server: "filesystem", tool: "list_dir", detail: "ls -la → 6 entries", ok: true },
    { id: uid("m"), ts: Date.now() - 1000 * 60 * 18, server: "git-ops", tool: "commit_ctx", detail: "git status → clean", ok: true },
    { id: uid("m"), ts: Date.now() - 1000 * 60 * 6, server: "shell-exec", tool: "history_ctx", detail: "injected 12 cmds as context", ok: true },
  ]);
  const [rightTab, setRightTab] = useState<"inspect" | "layout" | "commands" | "history" | "stats" | "keys" | "mcp" | "theme" | "sys" | "notes" | "handbook">("inspect");
  const [historyQuery, setHistoryQuery] = useState("");
  const [notesQuery, setNotesQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [tabSearch, setTabSearch] = useState("");
  const [broadcastTabId, setBroadcastTabId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const [distro, setDistro] = useState(s?.distro ?? "Ubuntu 24.04 LTS");
  const [shell, setShell] = useState(s?.shell ?? "zsh");
  const [paneEnv, setPaneEnv] = useState<Record<string, Record<string, string>>>({});
  const [sidebarWidth, setSidebarWidth] = useState(s?.sidebarWidth ?? 264);
  const [rightPanelWidth, setRightPanelWidth] = useState(330);
  const [autosaveEnabled, setAutosaveEnabled] = useState(s?.autosaveEnabled ?? false);

  // ---- persistence ---------------------------------------------------------
  // Trims scrollback before serialising: the full store (every tab x 800 lines +
  // 500 history rows) stringifies to megabytes and froze the main thread when it
  // ran synchronously on every state change.
  const PERSIST_LINE_CAP = 300;
  const snapshot = useRef<Persist | null>(null);
  snapshot.current = {
    tabs: tabs.map((t) => ({
      ...t,
      panes: Object.fromEntries(Object.entries(t.panes).map(([k, p]) => [k, { ...p, lines: p.lines.slice(-PERSIST_LINE_CAP) }])),
    })),
    activeTabId, groups, workspaces, commands,
    history: history.slice(0, 400),
    shortcuts, appearance, distro, shell, demoMode, sidebarWidth, rightPanelWidth, autosaveEnabled,
  };
  const writeNow = useCallback(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot.current)); } catch { /* quota */ }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(writeNow, 400);
    return () => window.clearTimeout(t);
  }, [tabs, activeTabId, groups, workspaces, commands, history, shortcuts, appearance, distro, shell, demoMode, sidebarWidth, rightPanelWidth, autosaveEnabled, writeNow]);

  useEffect(() => {
    if (!autosaveEnabled) return;
    const interval = setInterval(writeNow, 30000);
    return () => clearInterval(interval);
  }, [autosaveEnabled, writeNow]);

  // ---- DEMO <-> REAL switch ------------------------------------------------
  // Switching to REAL must visibly change the surface. Keep ONLY lines that a
  // real execution actually produced (`real: true`). Everything else is discarded:
  // simulated output, the MOTD banner, AND untagged legacy data already sitting in
  // localStorage from a build that predates the demo/real flags — which is why a
  // `demo`-flag-only filter left the old fake data on screen.
  const prevDemo = useRef(demoMode);
  useEffect(() => {
    if (prevDemo.current === demoMode) return;
    prevDemo.current = demoMode;
    if (demoMode) return;
    setTabs((prev) => prev.map((t) => {
      const panes: Record<string, PaneState> = {};
      for (const [k, p] of Object.entries(t.panes)) {
        const kept = p.lines.filter((l) => l.real === true);
        const keptCmds = new Set(kept.filter((l) => l.type === "input").map((l) => l.text));
        panes[k] = { ...p, lines: kept, cmdHistory: p.cmdHistory.filter((c) => keptCmds.has(c)) };
      }
      return { ...t, panes, stats: { cmdCount: 0 } };
    }));
    setHistory((h) => h.filter((e) => e.demo !== true && (e as HistoryEntry).real === true));
    setMcpLog([]);
    void (async () => {
      try {
        // Empty cwd -> the main process substitutes the real os.homedir(), so pwd
        // reports the genuine working directory instead of echoing back "/".
        const r = await execShellReal("pwd", "");
        const real = r.lines.find((l) => l.type === "output")?.text.trim();
        if (!real || !real.startsWith("/")) return;
        setTabs((prev) => prev.map((t) => ({ ...t, panes: Object.fromEntries(Object.entries(t.panes).map(([k, p]) => [k, { ...p, cwd: real }])) })));
      } catch { /* keep default cwd */ }
    })();
  }, [demoMode]);

  const sortedTabs = useMemo(() => [...tabs].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false)), [tabs]);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const theme = THEMES.find((t) => t.id === appearance.themeId) ?? THEMES[0];

  const mutateTab = useCallback((tabId: string, fn: (t: TerminalTab) => TerminalTab) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? fn(t) : t)));
  }, []);

  const pushLines = useCallback((tabId: string, paneId: string, lines: TerminalLine[]) => {
    if (!lines.length) return;
    mutateTab(tabId, (t) => {
      const pane = t.panes[paneId];
      if (!pane) return t;
      return { ...t, panes: { ...t.panes, [paneId]: { ...pane, lines: [...pane.lines, ...lines].slice(-MAX_LINES) } } };
    });
  }, [mutateTab]);

  const logMcp = useCallback((server: string, tool: string, detail: string, ok = true) => {
    setMcpLog((l) => [{ id: uid("m"), ts: Date.now(), server, tool, detail, ok }, ...l].slice(0, 80));
  }, []);

  const execInPane = useCallback(async (tabId: string, paneId: string, raw: string, tab: TerminalTab, pane: PaneState) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const ts = Date.now();
    const env = paneEnv[`${tabId}:${paneId}`] ?? {};
    mutateTab(tabId, (t) => ({
      ...t,
      stats: { cmdCount: t.stats.cmdCount + 1 },
      panes: {
        ...t.panes,
        [paneId]: {
          ...t.panes[paneId],
          lines: [...t.panes[paneId].lines, { id: uid("l"), type: "input" as const, text: cmd, timestamp: ts, demo: demoMode, real: !demoMode }].slice(-MAX_LINES),
          cmdHistory: [cmd, ...t.panes[paneId].cmdHistory.filter((c) => c !== cmd)].slice(0, 120),
          historyCursor: -1,
        },
      },
    }));
    const res = await (demoMode ? execShell(cmd, pane.cwd, env) : execShellReal(cmd, pane.cwd, env));
    if (res.envDelta) {
      setPaneEnv((prev) => {
        const key = `${tabId}:${paneId}`;
        const cur = { ...(prev[key] ?? {}) };
        Object.entries(res.envDelta!).forEach(([k, v]) => { if (v === null) delete cur[k]; else cur[k] = v; });
        return { ...prev, [key]: cur };
      });
    }
    const sysLine = res.lines.find((l) => l.type === "system");
    const sysText = sysLine?.text ?? "";
    if (sysText === "__CLEAR__") {
      mutateTab(tabId, (t) => ({ ...t, panes: { ...t.panes, [paneId]: { ...t.panes[paneId], lines: [] } } }));
    } else if (sysText.startsWith("__THEME__")) {
      const name = sysText.replace("__THEME__", "").toLowerCase().trim();
      const found = THEMES.find((t) => t.name.toLowerCase().includes(name) || t.id === name);
      pushLines(tabId, paneId, [{ id: uid("l"), type: found ? "success" : "error", text: found ? `✓ theme → ${found.name}` : `theme "${name}" not found · try: ${THEMES.map((t) => t.id).join(", ")}`, timestamp: Date.now(), real: !demoMode }]);
      if (found) setAppearance((a) => ({ ...a, themeId: found.id }));
    } else if (sysText === "__STATS__") {
      setRightTab("stats");
      pushLines(tabId, paneId, [{ id: uid("l"), type: "success", text: "→ opened Stats inspector (right panel)", timestamp: Date.now(), real: !demoMode }]);
    } else if (sysText.startsWith("__MCP__")) {
      setRightTab("mcp");
      logMcp("shell-exec", "run", `$ ${cmd} → context bus`, true);
      pushLines(tabId, paneId, [{ id: uid("l"), type: "success", text: "→ opened MCP inspector (right panel)", timestamp: Date.now(), real: !demoMode }]);
    } else if (sysText.startsWith("__WORKSPACE__")) {
      const rest = sysText.replace("__WORKSPACE__", "").trim();
      if (rest.startsWith("save")) {
        const name = rest.slice(4).trim() || `Workspace ${workspaces.length + 1}`;
        const ws: Workspace = {
          id: uid("ws"), name, description: `${tabs.length} tabs · saved ${new Date().toLocaleString()}`,
          color: TAB_COLORS[workspaces.length % TAB_COLORS.length],
          tabs: JSON.parse(JSON.stringify(tabs)), activeTabId, createdAt: Date.now(), updatedAt: Date.now(),
        };
        setWorkspaces((w) => [ws, ...w]);
        pushLines(tabId, paneId, [{ id: uid("l"), type: "success", text: `✓ workspace "${name}" saved`, timestamp: Date.now(), real: !demoMode }]);
      } else {
        pushLines(tabId, paneId, [{ id: uid("l"), type: "dim", text: "usage: workspace save <name> · ws save <name>", timestamp: Date.now(), real: !demoMode }]);
      }
    } else if (sysText === "__CLOSE_PANE__") {
      setHistory((h) => [{ id: uid("h"), command: cmd, preview: "pane closed", tabId, tabLabel: tab.label, paneId, cwd: pane.cwd, timestamp: ts, exitCode: 0, durationMs: res.durationMs, real: !demoMode }, ...h].slice(0, 500));
      closePaneRef.current?.(tabId, paneId);
      return;
    } else {
      pushLines(tabId, paneId, res.lines.map((l) => ({ ...l, id: uid("l"), timestamp: Date.now(), demo: demoMode, real: !demoMode })));
      mutateTab(tabId, (t) => ({ ...t, panes: { ...t.panes, [paneId]: { ...t.panes[paneId], cwd: res.newCwd, lastExit: res.exitCode } } }));
    }
    setHistory((h) => [{ id: uid("h"), command: cmd, preview: res.exitCode === 0 ? `✓ exit 0 · ${res.durationMs}ms` : `✗ exit ${res.exitCode}`, tabId, tabLabel: tab.label, paneId, cwd: pane.cwd, timestamp: ts, exitCode: res.exitCode, durationMs: res.durationMs, real: !demoMode }, ...h].slice(0, 500));
  }, [distro, shell, paneEnv, mutateTab, pushLines, tabs, workspaces.length, logMcp, demoMode]);

  const closePaneRef = useRef<((tabId: string, paneId: string) => void) | null>(null);

  const runCommand = useCallback(async (tabId: string, paneId: string, raw: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    const pane = tab?.panes[paneId];
    if (!tab || !pane) return;
    if (broadcastTabId === tabId) {
      const ids = listPaneIds(tab.layout);
      ids.forEach((pid) => {
        const p = tab.panes[pid];
        if (p) void execInPane(tabId, pid, raw, tab, p);
      });
      return;
    }
    await execInPane(tabId, paneId, raw, tab, pane);
  }, [tabs, broadcastTabId, execInPane]);

  const newTab = useCallback((preset?: { label?: string; color?: string; groupId?: string; layout?: Preset["layout"]; bootstraps?: string[]; icon?: string; shell?: string }) => {
    const g = preset?.groupId ?? (groups[0]?.id ?? "g-dev");
    const t = mkTab(preset?.label ?? `shell ${tabs.length + 1}`, preset?.color ?? TAB_COLORS[tabs.length % TAB_COLORS.length], g, preset?.layout ?? "single", preset?.bootstraps ?? [], preset?.icon ?? "terminal", preset?.shell ?? shell, demoMode);
    setTabs((p) => [...p, t]);
    setActiveTabId(t.id);
    return t.id;
  }, [tabs.length, groups, shell, demoMode]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length === 1) {
        const fresh = mkTab("shell 1", TAB_COLORS[0], groups[0]?.id ?? "g-dev");
        setActiveTabId(fresh.id);
        return [fresh];
      }
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) setActiveTabId(next[Math.max(0, idx - 1)].id);
      return next;
    });
    setBroadcastTabId((b) => (b === tabId ? null : b));
    setZoom((z) => (z?.tabId === tabId ? null : z));
  }, [activeTabId, groups]);

  const duplicateTab = useCallback((tabId: string) => {
    const t = tabs.find((x) => x.id === tabId);
    if (!t) return;
    const copy: TerminalTab = JSON.parse(JSON.stringify(t));
    copy.id = uid("tab");
    copy.label = `${t.label} copy`;
    copy.createdAt = Date.now();
    copy.pinned = false;
    const remap: Record<string, string> = {};
    Object.keys(copy.panes).forEach((pid) => { remap[pid] = uid("pane"); });
    const newPanes: Record<string, PaneState> = {};
    Object.entries(copy.panes).forEach(([pid, p]) => { newPanes[remap[pid]] = { ...(p as PaneState), id: remap[pid] }; });
    const remapNode = (n: PaneNode): PaneNode => n.kind === "pane" ? { kind: "pane", paneId: remap[n.paneId] } : { ...n, id: uid("sp"), children: [remapNode(n.children[0]), remapNode(n.children[1])] };
    copy.layout = remapNode(copy.layout);
    copy.panes = newPanes;
    copy.activePaneId = remap[t.activePaneId] ?? Object.keys(newPanes)[0];
    copy.focusedPaneId = copy.activePaneId;
    setTabs((p) => [...p, copy]);
    setActiveTabId(copy.id);
  }, [tabs]);

  const togglePin = useCallback((tabId: string) => {
    mutateTab(tabId, (t) => ({ ...t, pinned: !t.pinned }));
  }, [mutateTab]);

  const moveTabToGroup = useCallback((tabId: string, groupId: string) => {
    mutateTab(tabId, (t) => ({ ...t, groupId }));
  }, [mutateTab]);

  const splitPane = useCallback((tabId: string, paneId: string, dir: "row" | "col") => {
    const p = mkPane("/home/user");
    const tab = tabs.find((t) => t.id === tabId);
    const src = tab?.panes[paneId];
    if (src) p.cwd = src.cwd;
    p.lines.push({ id: uid("l"), type: "dim", text: `split ${dir === "row" ? "horizontal →" : "vertical ↓"} · drag the divider to resize`, timestamp: Date.now() });
    mutateTab(tabId, (t) => ({
      ...t,
      layout: splitNode(t.layout, paneId, dir, p.id),
      panes: { ...t.panes, [p.id]: p },
      activePaneId: p.id,
      focusedPaneId: p.id,
    }));
  }, [mutateTab, tabs]);

  const closePane = useCallback((tabId: string, paneId: string) => {
    setZoom((z) => (z?.tabId === tabId && z?.paneId === paneId ? null : z));
    mutateTab(tabId, (t) => {
      const ids = listPaneIds(t.layout);
      if (ids.length <= 1) {
        const p = mkPane("/home/user", undefined, undefined, demoMode);
        return { ...t, layout: { kind: "pane", paneId: p.id }, panes: { [p.id]: p }, activePaneId: p.id, focusedPaneId: p.id };
      }
      const layout = removePane(t.layout, paneId) ?? t.layout;
      const panes = { ...t.panes };
      delete panes[paneId];
      const remaining = listPaneIds(layout);
      return { ...t, layout, panes, activePaneId: remaining.includes(t.activePaneId) ? t.activePaneId : remaining[0], focusedPaneId: remaining[0] };
    });
  }, [mutateTab, demoMode]);
  closePaneRef.current = closePane;

  const movePaneToNewTab = useCallback((tabId: string, paneId: string) => {
    const t = tabs.find((x) => x.id === tabId);
    const pane = t?.panes[paneId];
    if (!t || !pane || Object.keys(t.panes).length <= 1) return;
    const layout = removePane(t.layout, paneId) ?? t.layout;
    const panes = { ...t.panes };
    delete panes[paneId];
    const remaining = listPaneIds(layout);
    mutateTab(tabId, (x) => ({ ...x, layout, panes, activePaneId: remaining[0], focusedPaneId: remaining[0] }));
    const nt: TerminalTab = {
      id: uid("tab"), label: `${t.label} · pane`, color: t.color, groupId: t.groupId, icon: t.icon, shell: t.shell,
      note: "", layout: { kind: "pane", paneId: pane.id }, panes: { [pane.id]: pane },
      activePaneId: pane.id, focusedPaneId: pane.id, createdAt: Date.now(), stats: { cmdCount: 0 },
    };
    setTabs((p) => [...p, nt]);
    setActiveTabId(nt.id);
  }, [tabs, mutateTab]);

  const swapWithNext = useCallback((tabId: string) => {
    const t = tabs.find((x) => x.id === tabId);
    if (!t) return;
    const ids = listPaneIds(t.layout);
    if (ids.length < 2) return;
    const i = ids.indexOf(t.activePaneId);
    const j = (i + 1) % ids.length;
    mutateTab(tabId, (x) => ({ ...x, activePaneId: ids[j], focusedPaneId: ids[j] }));
  }, [tabs, mutateTab]);

  const focusPane = useCallback((tabId: string, paneId: string) => {
    mutateTab(tabId, (t) => (t.panes[paneId] ? { ...t, activePaneId: paneId, focusedPaneId: paneId } : t));
  }, [mutateTab]);

  const cyclePane = useCallback((tabId: string, dir: 1 | -1) => {
    const t = tabs.find((x) => x.id === tabId);
    if (!t) return;
    const ids = listPaneIds(t.layout);
    const i = ids.indexOf(t.activePaneId);
    const next = ids[(i + dir + ids.length) % ids.length];
    focusPane(tabId, next);
  }, [tabs, focusPane]);

  const cycleTab = useCallback((dir: 1 | -1) => {
    setTabs((prev) => prev); // noop keep order
    const ids = sortedTabs.map((t) => t.id);
    const i = ids.indexOf(activeTabId);
    const next = ids[(i + dir + ids.length) % ids.length];
    if (next) setActiveTabId(next);
  }, [sortedTabs, activeTabId]);

  const setSplitRatio = useCallback((tabId: string, splitId: string, ratio: number) => {
    mutateTab(tabId, (t) => ({ ...t, layout: setRatio(t.layout, splitId, Math.min(0.85, Math.max(0.15, ratio))) }));
  }, [mutateTab]);

  const saveWorkspace = useCallback((name: string, description = "", color?: string) => {
    const existing = workspaces.find((w) => w.name === name);
    if (existing) {
      setWorkspaces((w) => w.map((x) => (x.name === name ? { ...x, tabs: JSON.parse(JSON.stringify(tabs)), activeTabId, updatedAt: Date.now() } : x)));
      return existing;
    }
    const ws: Workspace = {
      id: uid("ws"), name, description: description || `${tabs.length} tabs · ${tabs.reduce((a, t) => a + Object.keys(t.panes).length, 0)} panes · saved ${new Date().toLocaleString()}`,
      color: color ?? TAB_COLORS[workspaces.length % TAB_COLORS.length],
      tabs: JSON.parse(JSON.stringify(tabs)), activeTabId, themeId: appearance.themeId, createdAt: Date.now(), updatedAt: Date.now(),
    };
    setWorkspaces((w) => [ws, ...w]);
    return ws;
  }, [tabs, activeTabId, appearance.themeId, workspaces.length]);

  const restoreWorkspace = useCallback((id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    const tabs2: TerminalTab[] = JSON.parse(JSON.stringify(ws.tabs));
    setTabs(tabs2);
    setActiveTabId(ws.activeTabId && tabs2.some((t) => t.id === ws.activeTabId) ? ws.activeTabId : tabs2[0]?.id);
    setZoom(null);
    setBroadcastTabId(null);
    if (ws.themeId) setAppearance((a) => ({ ...a, themeId: ws.themeId! }));
    setWorkspaces((w) => w.map((x) => (x.id === id ? { ...x, updatedAt: Date.now() } : x)));
  }, [workspaces]);

  const stats = useMemo(() => {
    // Single pass over history — the previous version filtered the full history
    // 14x (days) plus once per tab and per group, and re-ran on every output line.
    const total = history.length;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCut = todayStart.getTime();
    const weekCut = Date.now() - 7 * 86400000;
    const dayCuts: number[] = [];
    for (let i = 13; i >= 0; i--) dayCuts.push(Date.now() - i * 86400000);
    const freq: Record<string, number> = {};
    const perTabCount: Record<string, number> = {};
    const hours = new Array(24).fill(0) as number[];
    const dayCount = new Array(14).fill(0) as number[];
    let today = 0, week = 0, errors = 0, msTotal = 0;
    const dayKeys = dayCuts.map((c) => new Date(c).toISOString().slice(0, 10));
    for (const h of history) {
      if (h.timestamp >= todayCut) today++;
      if (h.timestamp >= weekCut) week++;
      if (h.exitCode !== 0) errors++;
      msTotal += h.durationMs;
      const k = h.command.split(/\s+/).slice(0, 2).join(" ");
      freq[k] = (freq[k] ?? 0) + 1;
      perTabCount[h.tabId] = (perTabCount[h.tabId] ?? 0) + 1;
      hours[new Date(h.timestamp).getHours()]++;
      const hk = new Date(h.timestamp).toISOString().slice(0, 10);
      const di = dayKeys.indexOf(hk);
      if (di >= 0) dayCount[di]++;
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const days = dayCuts.map((c, i) => {
      const d = new Date(c);
      return { date: dayKeys[i], label: d.toLocaleDateString([], { month: "numeric", day: "numeric" }), count: dayCount[i] };
    });
    const groupOfTab: Record<string, string> = {};
    tabs.forEach((t) => { groupOfTab[t.id] = t.groupId; });
    const perGroupCount: Record<string, number> = {};
    history.forEach((h) => { const g = groupOfTab[h.tabId]; if (g) perGroupCount[g] = (perGroupCount[g] ?? 0) + 1; });
    const perTab = tabs.map((t) => ({ id: t.id, label: t.label, color: t.color, count: (perTabCount[t.id] ?? 0) + t.stats.cmdCount }));
    const perGroup = groups.map((g) => ({ id: g.id, name: g.name, color: g.color, count: perGroupCount[g.id] ?? 0 }));
    const okRate = total ? Math.round(((total - errors) / total) * 100) : 100;
    const avgMs = total ? Math.round(msTotal / total) : 0;
    return { total, today, week, top, days, perTab, perGroup, hours, errors, okRate, avgMs, panes: tabs.reduce((a, t) => a + Object.keys(t.panes).length, 0) };
  }, [history, tabs, groups]);

  const openNotesTab = useCallback(() => setRightTab("notes"), []);
  const closeNotesTab = useCallback(() => setRightTab("inspect"), []);

  const copyAllContent = useCallback((tabId?: string, paneId?: string) => {
    const t = tabs.find((tab) => tab.id === (tabId ?? activeTabId)) ?? activeTab;
    const targetPane = paneId != null ? t.panes[paneId] : t.panes[t.activePaneId];
    if (!targetPane) return;
    const text = targetPane.lines.map((l) => l.text).filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }, [tabs, activeTabId, activeTab]);

  /** Parse pasted terminal output and import commands as history entries.
   *  Looks for prompt lines like `user@host:~$ cmd` or `~/path$ cmd` or `▶ cmd`
   *  and extracts the command portion after the prompt marker. */
  const importFromText = useCallback((text: string, tabId?: string, paneId?: string) => {
    const t = tabs.find((tab) => tab.id === (tabId ?? activeTabId)) ?? activeTab;
    if (!t) return { imported: 0, errors: 0 };
    const targetTabId = t.id;
    const targetPaneId = paneId ?? t.activePaneId;
    const targetPane = t.panes[targetPaneId];
    const cwd = targetPane?.cwd ?? "/home/user";

    const lines = text.split("\n");
    const cmds: string[] = [];
    // Pattern: detect command lines after a shell prompt
    // Matches: "user@host:~$ cmd", "~/path$ cmd", "path$ cmd", "❯ cmd", "> cmd", "user@host$ cmd"
    const promptRe = /^(?:[\w.-]+@)?[\w.-]+:\$?\s*[~$>❯]\s+(.+)$/;
    const simplePromptRe = /^\s*[:$~>❯]\s+(.+)$/;

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      // Skip output lines (no prompt marker)
      let cmd = null;
      // Try full prompt pattern first
      let m = trimmed.match(promptRe);
      if (m) { cmd = m[1].trim(); }
      else {
        // Try simple prompt pattern (just $: cmd or > cmd)
        m = trimmed.match(simplePromptRe);
        if (m) { cmd = m[1].trim(); }
      }
      // Also detect lines starting with $ (common in copied terminal output)
      if (!cmd && trimmed.startsWith("$ ")) {
        cmd = trimmed.slice(2).trim();
      }
      if (cmd && cmd.length > 1 && !cmd.startsWith("__")) {
        // Deduplicate consecutive duplicates
        if (cmds.length === 0 || cmds[cmds.length - 1] !== cmd) {
          cmds.push(cmd);
        }
      }
    }

    if (!cmds.length) return { imported: 0, errors: 0 };

    const now = Date.now();
    let imported = 0;
    for (const cmd of cmds) {
      setHistory((h) => [{
        id: uid("h"),
        command: cmd,
        preview: "imported",
        tabId: targetTabId,
        tabLabel: t.label,
        paneId: targetPaneId,
        cwd,
        timestamp: now - imported * 1000,
        exitCode: 0,
        durationMs: 4,
      }, ...h].slice(0, 500));
      imported++;
    }
    return { imported, errors: 0 };
  }, [tabs, activeTabId, activeTab, setHistory]);

  

  return {
    tabs, sortedTabs, setTabs, activeTab, activeTabId, setActiveTabId, groups, setGroups, workspaces, setWorkspaces,
    commands, setCommands, history, setHistory, shortcuts, setShortcuts, appearance, setAppearance,
    mcp, setMcp, mcpLog, logMcp, rightTab, setRightTab, historyQuery, setHistoryQuery, notesQuery, setNotesQuery,
    openNotesTab, closeNotesTab,
    groupFilter, setGroupFilter, tabSearch, setTabSearch, theme, broadcastTabId, setBroadcastTabId,
    zoom, setZoom, distro, setDistro, shell, setShell, paneEnv,
    mutateTab, pushLines, runCommand, newTab, closeTab, duplicateTab, togglePin, moveTabToGroup,
    splitPane, closePane, movePaneToNewTab, swapWithNext,
    focusPane, cyclePane, cycleTab, setSplitRatio, saveWorkspace, restoreWorkspace, stats,
    flipSplitAction: (tabId: string, splitId: string) => mutateTab(tabId, (t) => ({ ...t, layout: flipSplit(t.layout, splitId) })),
    balanceAction: (tabId: string) => mutateTab(tabId, (t) => ({ ...t, layout: balance(t.layout) })),
    applyTemplate: (tabId: string, kind: Preset["layout"]) => mutateTab(tabId, (t) => {
      const keep = Object.values(t.panes)[0];
      const { layout, panes, active } = layoutFor(kind, [], {}, { distro, shell: t.shell ?? shell }, demoMode);
      const firstId = Object.keys(panes)[0];
      const merged = { ...panes };
      if (keep) merged[firstId] = { ...keep, id: firstId };
      return { ...t, layout, panes: merged, activePaneId: active, focusedPaneId: active };
    }),
    demoMode, setDemoMode, sidebarWidth, setSidebarWidth, rightPanelWidth, setRightPanelWidth, autosaveEnabled, setAutosaveEnabled,
    copyAllContent,
    importFromText,
  };
}

export type Store = ReturnType<typeof useConsoleStore>;
