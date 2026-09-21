import type { Appearance, MCPServer, Preset, SavedCommand, Shortcut, TermGroup, ThemeDef } from "./types";

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const TAB_COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f97316", "#e879f9",
];

export const THEMES: ThemeDef[] = [
  { id: "tokyo-night", name: "Tokyo Night", bg: "#0b0e17", panel: "#11151f", panel2: "#161b28", fg: "#c0caf5", muted: "#7a86a8", accent: "#7aa2f7", accent2: "#bb9af7", border: "#232b40", promptUser: "#7aa2f7", promptPath: "#9ece6a", selection: "#33467c" },
  { id: "dracula", name: "Dracula Pro", bg: "#0d0f1a", panel: "#141627", panel2: "#1a1d33", fg: "#f8f8f2", muted: "#8b8fa8", accent: "#bd93f9", accent2: "#ff79c6", border: "#2a2d4a", promptUser: "#50fa7b", promptPath: "#bd93f9", selection: "#44475a" },
  { id: "gruvbox", name: "Gruvbox Dark", bg: "#0f0e0c", panel: "#161412", panel2: "#1d1a16", fg: "#ebdbb2", muted: "#928374", accent: "#fabd2f", accent2: "#fe8019", border: "#2e2823", promptUser: "#b8bb26", promptPath: "#fabd2f", selection: "#3c3836" },
  { id: "nord", name: "Nord Frost", bg: "#0e1319", panel: "#131a22", panel2: "#182029", fg: "#d8dee9", muted: "#7b8ca3", accent: "#88c0d0", accent2: "#81a1c1", border: "#223040", promptUser: "#88c0d0", promptPath: "#a3be8c", selection: "#2e3b4e" },
  { id: "matrix", name: "Matrix Console", bg: "#030a05", panel: "#071009", panel2: "#0a1510", fg: "#c8ffd4", muted: "#4d7a5c", accent: "#00ff88", accent2: "#aaff00", border: "#0f2a1c", promptUser: "#00ff88", promptPath: "#aaff00", selection: "#0d3b22" },
  { id: "rosepine", name: "Rosé Pine", bg: "#0f0d13", panel: "#161320", panel2: "#1e1a2c", fg: "#e0def4", muted: "#908caa", accent: "#ebbcba", accent2: "#c4a7e7", border: "#2a2438", promptUser: "#9ccfd8", promptPath: "#ebbcba", selection: "#403d52" },
  { id: "solar-light", name: "Solar Paper", bg: "#f6f1e7", panel: "#fffdf7", panel2: "#efe8d8", fg: "#3d3529", muted: "#8a7f6a", accent: "#b45309", accent2: "#0d9488", border: "#ddd2bd", promptUser: "#0d9488", promptPath: "#b45309", selection: "#f5e3b3", isLight: true },
  { id: "rheo-dark", name: "RHEO Dark", bg: "#09090b", panel: "#18181b", panel2: "#1f1f23", fg: "#e4e4e7", muted: "#71717a", accent: "#f472b6", accent2: "#2dd4bf", border: "#27272a", promptUser: "#f472b6", promptPath: "#2dd4bf", selection: "#3f3f46" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  themeId: "tokyo-night",
  fontFamily: "JetBrains Mono",
  fontSize: 13.5,
  lineHeight: 1.55,
  cursorStyle: "block",
  cursorBlink: true,
  opacity: 0.98,
  padding: 14,
  promptStyle: "powerline",
  showStatusBar: true,
  transparency: true,
  glow: true,
  density: "cozy",
};

export const FONT_OPTIONS = ["JetBrains Mono", "Fira Code", "Cascadia Code", "IBM Plex Mono", "Ubuntu Mono", "Hack", "MesloLGS NF"];

export const DEFAULT_GROUPS: TermGroup[] = [
  { id: "g-dev", name: "Development", color: "#22d3ee", description: "App code, builds & dev servers" },
  { id: "g-ops", name: "DevOps / Infra", color: "#a78bfa", description: "Deploy, docker & servers" },
  { id: "g-sys", name: "System", color: "#34d399", description: "Monitoring & admin" },
  { id: "g-exp", name: "Experiments", color: "#fbbf24", description: "Scratch & trials" },
];

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "s-new-tab", action: "new-tab", label: "New tab", keys: "Ctrl+Shift+T", description: "Open a fresh terminal tab", category: "Tabs" },
  { id: "s-close-tab", action: "close-tab", label: "Close tab", keys: "Ctrl+Shift+W", description: "Close the active tab", category: "Tabs" },
  { id: "s-rename", action: "rename", label: "Rename tab", keys: "Ctrl+Shift+R", description: "Rename active tab inline", category: "Tabs" },
  { id: "s-pin", action: "pin-tab", label: "Pin / unpin tab", keys: "Ctrl+Shift+P", description: "Pin tab to the front", category: "Tabs" },
  { id: "s-next-tab", action: "next-tab", label: "Next tab", keys: "Ctrl+Tab", description: "Cycle to next tab", category: "Tabs" },
  { id: "s-prev-tab", action: "prev-tab", label: "Previous tab", keys: "Ctrl+Shift+Tab", description: "Cycle to previous tab", category: "Tabs" },
  { id: "s-split-h", action: "split-h", label: "Split horizontal", keys: "Ctrl+Shift+H", description: "Split active pane side-by-side", category: "Splits" },
  { id: "s-split-v", action: "split-v", label: "Split vertical", keys: "Ctrl+Shift+V", description: "Split active pane stacked", category: "Splits" },
  { id: "s-next-pane", action: "next-pane", label: "Next pane", keys: "Ctrl+Shift+ArrowRight", description: "Focus next pane", category: "Splits" },
  { id: "s-prev-pane", action: "prev-pane", label: "Previous pane", keys: "Ctrl+Shift+ArrowLeft", description: "Focus previous pane", category: "Splits" },
  { id: "s-zoom", action: "zoom-pane", label: "Zoom pane", keys: "Ctrl+Shift+Z", description: "Maximize focused pane", category: "Splits" },
  { id: "s-broadcast", action: "broadcast", label: "Broadcast toggle", keys: "Ctrl+Shift+B", description: "Send input to every pane", category: "Splits" },
  { id: "s-palette", action: "palette", label: "Command palette", keys: "Ctrl+K", description: "Fuzzy search actions & commands", category: "General" },
  { id: "s-clear", action: "clear", label: "Clear pane", keys: "Ctrl+L", description: "Clear active pane output", category: "General" },
  { id: "s-workspace", action: "save-workspace", label: "Save workspace", keys: "Ctrl+Shift+S", description: "Snapshot tabs as workspace", category: "Workspace" },
  { id: "s-find", action: "find-history", label: "Search history", keys: "Ctrl+Shift+F", description: "Search every command run", category: "General" },
  { id: "s-find-in-panes", action: "find", label: "Find in panes", keys: "Ctrl+Shift+J", description: "Search terminal output", category: "General" },
  { id: "s-balance", action: "balance", label: "Balance panes", keys: "Ctrl+Shift+Space", description: "Balance active pane sizes", category: "Splits" },
  { id: "s-export", action: "export-transcript", label: "Export transcript", keys: "Ctrl+Shift+E", description: "Export terminal transcript", category: "General" },
  { id: "s-save-cmd", action: "save-cmd", label: "Save command", keys: "Ctrl+Shift+D", description: "Save input as command", category: "General" },
  { id: "s-cycle-theme", action: "cycle-theme", label: "Cycle theme", keys: "Ctrl+Shift+Y", description: "Rotate terminal themes", category: "Appearance" },
];

export const DEFAULT_COMMANDS: SavedCommand[] = [
  { id: "c-update", name: "System update", command: "sudo apt update && sudo apt upgrade -y", description: "Update all packages", category: "System", color: "#34d399", favorite: true, runCount: 42, createdAt: Date.now() - 86400000 * 12 },
  { id: "c-docker", name: "Docker status", command: "docker ps -a", description: "List containers", category: "DevOps", color: "#60a5fa", favorite: true, runCount: 31, createdAt: Date.now() - 86400000 * 9 },
  { id: "c-gitlog", name: "Pretty git log", command: "git log --oneline --graph --decorate -n {{count:15}}", description: "Graph log, takes count", category: "Git", color: "#f97316", favorite: true, runCount: 58, createdAt: Date.now() - 86400000 * 20 },
  { id: "c-serve", name: "Serve directory", command: "python3 -m http.server {{port:8000|8000|3000|5000}} --directory {{path:.}}", description: "HTTP server with port + path inputs", category: "Dev", color: "#22d3ee", favorite: false, runCount: 12, createdAt: Date.now() - 86400000 * 4 },
  { id: "c-find", name: "Find big files", command: "find {{path:.}} -type f -size +{{size:100}}M -exec ls -lh {} \\;", description: "Hunt disk hogs", category: "System", color: "#fbbf24", favorite: false, runCount: 7, createdAt: Date.now() - 86400000 * 6 },
  { id: "c-ssh", name: "SSH deploy", command: "ssh {{user:deploy}}@{{host:prod-01|prod-01|staging-01|dev-box}} -p {{port:22}} 'cd {{dir:/srv/app}} && git pull && docker compose up -d'", description: "Deploy over SSH, pick host", category: "DevOps", color: "#a78bfa", favorite: false, runCount: 9, createdAt: Date.now() - 86400000 * 2 },
  { id: "c-kill", name: "Kill port", command: "fuser -k {{port:3000|3000|5173|8000|8080}}/tcp", description: "Free a busy port", category: "Dev", color: "#fb7185", favorite: true, runCount: 26, createdAt: Date.now() - 86400000 * 15 },
  { id: "c-backup", name: "Rsync backup", command: "rsync -avz --progress {{src:~/projects}} {{dest:/mnt/backup}}", description: "Backup with progress", category: "System", color: "#e879f9", favorite: false, runCount: 5, createdAt: Date.now() - 86400000 * 3 },
  { id: "c-k8s", name: "K8s pods", command: "kubectl get pods -n {{namespace:default|default|kube-system|production}} -o wide", description: "List pods in namespace", category: "DevOps", color: "#60a5fa", favorite: false, runCount: 11, createdAt: Date.now() - 86400000 * 5 },
  { id: "c-ffmpeg", name: "Compress video", command: "ffmpeg -i {{input:input.mp4}} -vcodec libx264 -crf {{crf:23|23|18|28}} {{output:out.mp4}}", description: "Re-encode with quality picker", category: "Media", color: "#f97316", favorite: false, runCount: 4, createdAt: Date.now() - 86400000 * 7 },
];

export const PRESETS: Preset[] = [
  { id: "p-dev", name: "Full-stack Dev", description: "Editor watcher + API + client stacked", icon: "code", color: "#22d3ee", layout: "triple", group: "g-dev", tabColor: "#22d3ee", bootstrap: ["cd ~/projects/nova && git status", "docker ps", "neofetch"], tags: ["node", "watch"] },
  { id: "p-ops", name: "Ops Dashboard", description: "Quad: logs, docker, htop, ssh", icon: "server", color: "#a78bfa", layout: "quad", group: "g-ops", tabColor: "#a78bfa", bootstrap: ["docker ps", "htop", "tail -f /var/log/syslog", "ssh prod-01"], tags: ["docker", "monitor"] },
  { id: "p-git", name: "Git Triage", description: "Status beside diff + log", icon: "git", color: "#f97316", layout: "dual-h", group: "g-dev", tabColor: "#f97316", bootstrap: ["git status", "git log --oneline -n 12"], tags: ["git"] },
  { id: "p-sys", name: "System Monitor", description: "neofetch + df + sensors stacked", icon: "activity", color: "#34d399", layout: "dual-v", group: "g-sys", tabColor: "#34d399", bootstrap: ["neofetch", "sensors"], tags: ["sysinfo"] },
  { id: "p-focus", name: "Single Focus", description: "One clean shell, zero noise", icon: "terminal", color: "#fbbf24", layout: "single", group: "g-exp", tabColor: "#fbbf24", bootstrap: ["neofetch"], tags: ["minimal"] },
  { id: "p-pipe", name: "Log Pipeline", description: "Sidebar tail + main shell", icon: "logs", color: "#e879f9", layout: "sidebar", group: "g-ops", tabColor: "#e879f9", bootstrap: ["tail -f /var/log/syslog", "ls -la"], tags: ["logs"] },
  { id: "p-k8s", name: "K8s Watch", description: "Pods, events + shell triple", icon: "container", color: "#60a5fa", layout: "triple", group: "g-ops", tabColor: "#60a5fa", bootstrap: ["kubectl get pods", "kubectl get events --sort-by=.lastTimestamp | tail -n 20", "htop"], tags: ["k8s"] },
  { id: "p-media", name: "Media Bench", description: "GPU + disk + encode side-by-side", icon: "zap", color: "#fb7185", layout: "dual-h", group: "g-exp", tabColor: "#fb7185", bootstrap: ["nvidia-smi", "df -h"], tags: ["gpu"] },
];

export const DEFAULT_MCP: MCPServer[] = [
  {
    id: "mcp-fs", name: "filesystem", description: "Scoped Linux FS access · /home/user", icon: "folder", enabled: true, status: "connected", latencyMs: 4,
    tools: [
      { name: "read_file", description: "Read file contents with line ranges", command: "cat ~/notes.md" },
      { name: "list_dir", description: "List directory with metadata", command: "ls -la" },
      { name: "search", description: "Ripgrep workspace search", command: "rg balance src/" },
    ],
    resources: [{ name: "workspace files", uri: "file:///home/user/projects" }, { name: "shell history", uri: "history://last-50" }],
    prompts: [{ name: "explain-error", description: "Explain last non-zero exit" }, { name: "suggest-cmd", description: "Suggest next command" }],
  },
  {
    id: "mcp-shell", name: "shell-exec", description: "Sandboxed bash execution · zsh", icon: "terminal", enabled: true, status: "connected", latencyMs: 9,
    tools: [
      { name: "run", description: "Execute allow-listed command", command: "echo $SHELL" },
      { name: "history_ctx", description: "Inject last N commands as context", command: "history" },
    ],
    resources: [{ name: "env allow-list", uri: "config://allow-list" }],
    prompts: [{ name: "fix-command", description: "Repair a failing one-liner" }],
  },
  {
    id: "mcp-git", name: "git-ops", description: "Repo aware diff / log / status", icon: "git", enabled: true, status: "connected", latencyMs: 12,
    tools: [
      { name: "diff", description: "Unified diff of working tree", command: "git diff" },
      { name: "commit_ctx", description: "Summarise staged changes", command: "git status" },
    ],
    resources: [{ name: "HEAD", uri: "git://HEAD" }, { name: "branches", uri: "git://branches" }],
    prompts: [{ name: "write-commit", description: "Draft conventional commit" }],
  },
  {
    id: "mcp-docker", name: "docker-ctx", description: "Containers, images & compose", icon: "container", enabled: false, status: "disconnected", latencyMs: 0,
    tools: [
      { name: "ps", description: "Running containers table", command: "docker ps" },
      { name: "logs", description: "Tail container logs", command: "docker logs nova-api --tail 50" },
    ],
    resources: [{ name: "compose project", uri: "docker://compose/nova" }],
    prompts: [{ name: "debug-container", description: "Diagnose crash loop" }],
  },
  {
    id: "mcp-sys", name: "sys-monitor", description: "Sensors, units & journal on Linux", icon: "activity", enabled: true, status: "connected", latencyMs: 6,
    tools: [
      { name: "sensors", description: "Thermal + fan snapshot", command: "sensors" },
      { name: "units", description: "Failed systemd units", command: "systemctl --failed" },
    ],
    resources: [{ name: "journal", uri: "journal://system" }],
    prompts: [{ name: "triage-boot", description: "Summarise failed units" }],
  },
];

export const MOTD = [
  "Welcome to Penguin Console — Electron build 2.14.0 · kernel 6.8.0-41-generic",
  "Type `help` for commands · `Ctrl+K` palette · drag dividers to resize splits",
];
