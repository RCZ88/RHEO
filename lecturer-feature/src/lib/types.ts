export type SplitDirection = "row" | "col";

export type PaneNode =
  | { kind: "pane"; paneId: string }
  | { kind: "split"; id: string; direction: SplitDirection; ratio: number; children: [PaneNode, PaneNode] };

export interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "success" | "system" | "dim";
  text: string;
  timestamp: number;
}

export interface PaneState {
  id: string;
  cwd: string;
  lines: TerminalLine[];
  cmdHistory: string[];
  historyCursor: number;
  lastExit?: number;
}

export interface TabStats {
  cmdCount: number;
}

export interface TerminalTab {
  id: string;
  label: string;
  color: string;
  groupId: string;
  icon: string;
  shell?: string;
  note?: string;
  layout: PaneNode;
  panes: Record<string, PaneState>;
  activePaneId: string;
  focusedPaneId: string | null;
  createdAt: number;
  stats: TabStats;
  pinned?: boolean;
}

export interface TermGroup {
  id: string;
  name: string;
  color: string;
  description?: string;
  collapsed?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  tabs: TerminalTab[];
  activeTabId: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  color: string;
  favorite: boolean;
  runCount: number;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  command: string;
  preview: string;
  tabId: string;
  tabLabel: string;
  paneId: string;
  cwd: string;
  timestamp: number;
  exitCode: number;
  durationMs: number;
}

export interface Shortcut {
  id: string;
  action: string;
  label: string;
  keys: string;
  description: string;
  category: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  bg: string;
  panel: string;
  panel2: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  border: string;
  promptUser: string;
  promptPath: string;
  selection: string;
  isLight?: boolean;
}

export interface Appearance {
  themeId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: "block" | "beam" | "underline";
  cursorBlink: boolean;
  opacity: number;
  padding: number;
  promptStyle: "classic" | "minimal" | "powerline" | "two-line";
  showStatusBar: boolean;
  transparency: boolean;
  glow: boolean;
  density: "cozy" | "compact";
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  layout: "single" | "dual-h" | "dual-v" | "triple" | "quad" | "sidebar";
  group: string;
  tabColor: string;
  bootstrap: string[];
  tags: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  command: string;
}

export interface MCPResource {
  name: string;
  uri: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  latencyMs: number;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export interface MCPLogEntry {
  id: string;
  ts: number;
  server: string;
  tool: string;
  detail: string;
  ok: boolean;
}

export interface DynamicParam {
  name: string;
  def: string;
  options: string[];
}

export interface ZoomState {
  tabId: string;
  paneId: string;
}

export type RightPanelTab = "inspect" | "layout" | "commands" | "history" | "stats" | "keys" | "mcp" | "theme" | "sys";

export interface DailyStat {
  date: string;
  count: number;
}
