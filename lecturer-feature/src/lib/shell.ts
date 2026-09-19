export interface ExecLine {
  type: "output" | "error" | "success" | "system" | "dim";
  text: string;
}

export interface ExecResult {
  lines: ExecLine[];
  newCwd: string;
  exitCode: number;
  durationMs: number;
  envDelta?: Record<string, string | null>;
}

export interface ExecOpts {
  distro?: string;
  shell?: string;
}

const HOME = "/home/user";

const FILES: Record<string, string[]> = {
  "~": ["projects", "documents", ".config", ".zshrc", ".gitconfig", "notes.md"],
  "~/projects": ["nova", "penguin-console", "dotfiles", "api-server"],
  "~/projects/nova": ["package.json", "src", "server", "README.md", ".git", "compose.yml"],
  "~/projects/nova/server": ["index.ts", "routes", "Dockerfile"],
  "~/projects/nova/src": ["split.ts", "store.ts", "theme.css"],
  "~/documents": ["cheatsheet.md", "todo.txt", "invoice.pdf"],
  "~/.config": ["penguin", "nvim", "htop"],
  "/etc": ["hosts", "fstab", "os-release", "passwd", "ssh"],
  "/var/log": ["syslog", "auth.log", "kern.log"],
};

const KNOWN = ["help", "ls", "cd", "pwd", "echo", "cat", "clear", "history", "whoami", "hostname", "uname", "date", "uptime", "neofetch", "df", "du", "free", "ps", "top", "htop", "sensors", "systemctl", "journalctl", "git", "docker", "kubectl", "npm", "node", "python3", "ffmpeg", "grep", "find", "rg", "curl", "wget", "ping", "ssh", "tail", "head", "wc", "env", "export", "which", "man", "theme", "stats", "mcp", "workspace", "exit", "tree", "cowsay", "nvidia-smi", "lsblk"];

const TYPO: Record<string, string> = { gti: "git", dokcer: "docker", sl: "ls", "cd..": "cd ..", htopop: "htop", pyhton3: "python3", kubctl: "kubectl", dcoker: "docker" };

function ls(cwd: string, flag: string): string {
  const key = cwd.replace(HOME, "~");
  const list = FILES[key] ?? (cwd === "/" ? ["home", "etc", "var", "usr", "opt", "tmp"] : ["file1.txt", "src", "README.md"]);
  if (flag.includes("l"))
    return `total ${list.length * 4}\n` + list.map((f) => {
      const dir = !f.includes(".") ? "d" : "-";
      return `${dir}rwxr-xr-x  2 user user  4096 Sep  ${1 + ((f.length * 7) % 8)} 09:12  ${f}`;
    }).join("\n");
  return list.join("   ");
}

function resolvePath(cwd: string, arg?: string): string {
  if (!arg || arg === "~" || arg === "$HOME") return HOME;
  const a = arg.replace(/^['"]|['"]$/g, "");
  if (a === "..") {
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    return "/" + parts.join("/") || "/";
  }
  if (a === "-") return cwd;
  if (a === ".") return cwd;
  if (a.startsWith("/")) return a;
  if (a.startsWith("~/")) return HOME + "/" + a.slice(2);
  const base = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
  return `${base}/${a}`.replace(/\/\/+/g, "/");
}

const short = (cwd: string) => cwd.replace(HOME, "~");

function expandEnv(s: string, env: Record<string, string>): string {
  return s
    .replace(/\$\(date \+%F\)/g, "2026-09-09")
    .replace(/\$\((date|whoami|pwd|hostname)\)/g, (_, c: string) => (c === "date" ? "Wed Sep  9 09:14:22 UTC 2026" : c === "whoami" ? "user" : c === "pwd" ? env.PWD ?? HOME : "penguin"))
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, k: string) => env[k] ?? "")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) => env[k] ?? "")
    .replace(/\$HOME/g, HOME)
    .replace(/\$USER/g, "user");
}

type Seg = { cmd: string; op: "seq" | "and" | "or" };

function splitChain(input: string): Seg[] {
  const segs: Seg[] = [];
  let cur = "", op: Seg["op"] = "seq", sq = false, dq = false, esc = false;
  const push = () => { if (cur.trim()) segs.push({ cmd: cur.trim(), op }); cur = ""; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (esc) { cur += c; esc = false; continue; }
    if (c === "\\") { cur += c; esc = true; continue; }
    if (c === "'" && !dq) { sq = !sq; cur += c; continue; }
    if (c === '"' && !sq) { dq = !dq; cur += c; continue; }
    if (!sq && !dq) {
      if (c === "&" && input[i + 1] === "&") { push(); op = "and"; i++; continue; }
      if (c === "|" && input[i + 1] === "|") { push(); op = "or"; i++; continue; }
      if (c === ";") { push(); op = "seq"; continue; }
    }
    cur += c;
  }
  push();
  return segs;
}

function splitPipe(seg: string): string[] {
  const parts: string[] = [];
  let cur = "", sq = false, dq = false, esc = false;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (esc) { cur += c; esc = false; continue; }
    if (c === "\\") { cur += c; esc = true; continue; }
    if (c === "'" && !dq) { sq = !sq; cur += c; continue; }
    if (c === '"' && !sq) { dq = !dq; cur += c; continue; }
    if (!sq && !dq && c === "|" && seg[i + 1] !== "|") { parts.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = "", sq = false, dq = false, esc = false;
  for (const c of s) {
    if (esc) { cur += c; esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === "'" && !dq) { sq = !sq; continue; }
    if (c === '"' && !sq) { dq = !dq; continue; }
    if (!sq && !dq && /\s/.test(c)) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

interface Ctx { cwd: string; env: Record<string, string>; sudo: boolean; opts: ExecOpts; }
interface Single { lines: ExecLine[]; newCwd: string; code: number; envDelta?: Record<string, string | null>; slow?: number; }

function applyFilter(text: string, filterRaw: string): { text: string; code: number } {
  const t = tokenize(filterRaw);
  const [bin, ...a] = t;
  const rows = text.split("\n");
  if (bin === "grep") {
    const pat = (a[a.length - 1] ?? "").toLowerCase();
    const inv = a.includes("-v");
    const ci = a.includes("-i") || true;
    const hit = rows.filter((r) => { const m = ci ? r.toLowerCase().includes(pat) : r.includes(pat); return inv ? !m : m; });
    return { text: hit.join("\n") || "(no matches)", code: hit.length ? 0 : 1 };
  }
  if (bin === "head") {
    const ni = a.indexOf("-n");
    const n = ni >= 0 ? Number(a[ni + 1] ?? 10) : 10;
    return { text: rows.slice(0, n).join("\n"), code: 0 };
  }
  if (bin === "tail") {
    const ni = a.indexOf("-n");
    const n = ni >= 0 ? Number(a[ni + 1] ?? 10) : 10;
    const f = a.includes("-f");
    return { text: rows.slice(-n).join("\n") + (f ? "\n(following — simulated)" : ""), code: 0 };
  }
  if (bin === "wc") {
    if (a.includes("-l")) return { text: String(rows.length), code: 0 };
    return { text: `${rows.length} ${text.split(/\s+/).length} ${text.length}`, code: 0 };
  }
  if (bin === "sort") return { text: [...rows].sort().join("\n"), code: 0 };
  if (bin === "uniq") return { text: [...new Set(rows)].join("\n"), code: 0 };
  return { text: `(pipe to '${bin}' not simulated)`, code: 0 };
}

function runSingle(rawSeg: string, ctx: Ctx): Single {
  const { cwd, env, sudo, opts } = ctx;
  let seg = rawSeg.trim();
  const pre = sudo ? "[sudo] " : "";
  const ok = (lines: ExecLine[], newCwd = cwd, code = 0, extra?: Partial<Single>): Single => ({ lines, newCwd, code, ...extra });
  if (!seg) return ok([]);
  const toks = tokenize(expandEnv(seg, env));
  if (!toks.length) return ok([]);
  const [bin, ...argv] = toks;
  const args = argv.join(" ");
  const distro = opts.distro ?? "Ubuntu 24.04 LTS";
  const shellName = opts.shell ?? "zsh";

  switch (bin) {
    case "help":
      return ok([
        { type: "success", text: `${pre}Penguin Console · simulated Linux shell (${shellName} · Electron renderer)` },
        { type: "dim", text: " core:  ls  cd  pwd  echo  cat  head|tail  tree  clear  history  whoami  hostname  date  uptime  uname  neofetch" },
        { type: "dim", text: " sys:   df  du  free  ps  htop  sensors  nvidia-smi  lsblk  systemctl  journalctl  env  export  which  man  cowsay" },
        { type: "dim", text: " dev:   git  docker  kubectl  npm  node  python3  ffmpeg  grep|rg  find  curl  ping  ssh  tar" },
        { type: "dim", text: " flow:  &&  ;  ||  pipes (| grep | head | tail | wc | sort)  sudo  $VARS" },
        { type: "dim", text: " meta:  theme <name>  workspace save <name>  stats  mcp list  help" },
        { type: "output", text: "Every command is logged to History + Stats automatically." },
      ]);
    case "pwd": return ok([{ type: "output", text: cwd }]);
    case "whoami": return ok([{ type: "output", text: `${pre}user` }]);
    case "hostname": return ok([{ type: "output", text: "penguin" }]);
    case "id": return ok([{ type: "output", text: "uid=1000(user) gid=1000(user) groups=1000(user),27(sudo),999(docker)" }]);
    case "groups": return ok([{ type: "output", text: "user sudo docker" }]);
    case "uname":
      return ok([{ type: "output", text: argv.includes("-a") ? "Linux penguin 6.8.0-41-generic #41-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux" }]);
    case "date": return ok([{ type: "output", text: "Wed Sep  9 09:14:22 UTC 2026" }]);
    case "uptime": return ok([{ type: "output", text: "09:14:22 up 3:12,  2 users,  load average: 0.42, 0.35, 0.28" }]);
    case "echo": {
      let out = args.replace(/\s+-n\s+/g, " ").trim();
      return ok([{ type: "output", text: out }]);
    }
    case "printf": return ok([{ type: "output", text: argv.join(" ").replace(/%s/g, "").replace(/\\n/g, "\n") }]);
    case "clear": case "reset": return ok([{ type: "system", text: "__CLEAR__" }]);
    case "cd": {
      if (!argv[0] || argv[0] === "~") return ok([], HOME);
      return ok([], resolvePath(cwd, argv[0]));
    }
    case "ls": case "dir": return ok([{ type: "output", text: ls(cwd, args) }]);
    case "tree":
      return ok([{ type: "output", text: `${short(cwd)}\n├── src/\n│   ├── split.ts\n│   └── store.ts\n├── server/\n├── package.json\n└── README.md\n\n2 directories, 4 files (simulated)` }]);
    case "cat": {
      if (!argv[0]) return ok([{ type: "error", text: "cat: missing operand" }], cwd, 1);
      const f = argv.filter((a) => !a.startsWith("-"))[0] ?? "";
      if (f.includes("cheatsheet")) return ok([{ type: "output", text: "# shortcuts\nCtrl+K palette · Ctrl+Shift+T tab · Ctrl+Shift+H split · Ctrl+Shift+S workspace" }]);
      if (f.includes("todo")) return ok([{ type: "output", text: "[ ] ship console 2.14\n[x] theme engine\n[ ] wayland fixes" }]);
      if (f.includes("package.json")) return ok([{ type: "output", text: '{\n  "name": "nova",\n  "version": "2.14.0",\n  "scripts": { "dev": "vite", "watch": "tsc -w" }\n}' }]);
      if (f.includes(".zshrc")) return ok([{ type: "output", text: 'export ZSH="$HOME/.oh-my-zsh"\nplugins=(git docker kubectl)\nsource $ZSH/oh-my-zsh.sh' }]);
      if (f.includes("notes.md")) return ok([{ type: "output", text: "# notes\n- workspaces snapshot tabs+splits\n- {{port:3000}} makes commands dynamic" }]);
      if (f.includes("hosts")) return ok([{ type: "output", text: "127.0.0.1 localhost\n127.0.1.1 penguin" }]);
      if (f.includes("os-release")) return ok([{ type: "output", text: `NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu` }]);
      if (f.includes("syslog") || f.includes(".log")) return ok([
        { type: "dim", text: "Sep  9 09:12:01 penguin systemd[1]: Started Penguin Console." },
        { type: "dim", text: "Sep  9 09:12:09 penguin electron[2931]: renderer ready in 412ms" },
      ]);
      return ok([{ type: "output", text: `── ${f} ──\nsimulated file content · kernel 6.8 · electron 31` }]);
    }
    case "head": case "tail": case "less": case "more": {
      const f = argv.filter((a) => !a.startsWith("-"))[0] ?? "/var/log/syslog";
      const r = runSingle(`cat ${f}`, ctx);
      const n = bin === "head" ? 10 : 10;
      void n;
      return ok(r.lines.slice(0, 6));
    }
    case "wc": return ok([{ type: "output", text: argv.includes("-l") ? "128" : "128  942  6120" }]);
    case "neofetch": case "screenfetch":
      return ok([
        { type: "success", text: "       _,met$$$$$gg.          user@penguin" },
        { type: "success", text: "    ,g$$$$$$$$$$$$$$$P.       ─────────────" },
        { type: "output", text: `  ,g$$P"     """Y$$.\".     OS: ${distro} x86_64` },
        { type: "output", text: " ,$$P'              `$$$.    Kernel: 6.8.0-41-generic" },
        { type: "output", text: `,$$P       ,ggs.     \`$$b:   Shell: ${shellName} 5.9 · Electron 31` },
        { type: "output", text: "DE: GNOME 46 · Terminal: Penguin 2.14 · CPU: Ryzen 7 7840U · MEM: 9.1G / 31G" },
      ]);
    case "df":
      return ok([{ type: "output", text: `${pre}Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p2  457G  213G  221G  50% /\ntmpfs            16G     0   16G   0% /dev/shm` }]);
    case "du":
      return ok([{ type: "output", text: `4.0K\t./src\n412M\t./node_modules\n1.2G\t${short(cwd)} (simulated)` }]);
    case "free":
      return ok([{ type: "output", text: "               total        used        free\nMem:        32541756     9123404    14882312\nSwap:        8388604           0     8388604" }]);
    case "lscpu": return ok([{ type: "output", text: "Architecture: x86_64\nCPU(s): 16\nModel: AMD Ryzen 7 7840U\nMHz: 3293 (simulated)" }]);
    case "lsblk": return ok([{ type: "output", text: "NAME        SIZE TYPE MOUNTPOINT\nnvme0n1     476G disk\n└─nvme0n1p2 457G part /" }]);
    case "lspci": return ok([{ type: "output", text: "00:02.0 VGA compatible controller: AMD Phoenix1 (simulated)\n01:00.0 Non-Volatile memory controller: Samsung 990 Pro" }]);
    case "ps":
      return ok([{ type: "output", text: "    PID TTY          TIME CMD\n   1842 pts/0    00:00:02 zsh\n   2931 pts/0    00:00:11 electron penguin-console\n   3104 pts/1    00:00:00 nvim\n   4410 pts/2    00:01:44 node server/index.ts" }]);
    case "pgrep": return ok([{ type: "output", text: "2931\n4410" }]);
    case "jobs": return ok([{ type: "dim", text: "[1]+  Running                 npm run watch & (simulated)" }]);
    case "history":
      return ok([{ type: "dim", text: "history is tracked in the right panel → History tab (global, searchable)" }]);
    case "htop": case "top": case "btop":
      return ok([
        { type: "success", text: `${pre}CPU ▓▓▓▓▓░░░░░  34%   MEM ▓▓▓▓░░░░░░  28%   (simulated)` },
        { type: "output", text: "  PID USER   CPU% MEM% COMMAND\n 2931 user    6.2  3.1 electron penguin-console\n 4410 user    4.8  2.4 node server/index.ts\n 3104 user    0.4  0.6 nvim" },
      ]);
    case "sensors":
      return ok([{ type: "output", text: "k10temp-pci-00c3\nAdapter: PCI adapter\nTctl:         +48.2°C\namdgpu-pci-0300\nedge:         +46.0°C  (simulated)" }]);
    case "nvidia-smi":
      return ok([{ type: "output", text: "NVIDIA-SMI: no NVIDIA GPU detected on penguin (AMD iGPU active) — simulated" }], cwd, 0);
    case "systemctl": {
      const sub = argv[0] ?? "status";
      if (sub === "--failed" || args.includes("--failed")) return ok([{ type: "success", text: "0 loaded units listed. No failed units. (simulated)" }]);
      if (["start", "stop", "restart", "enable"].includes(sub)) return ok([{ type: "success", text: `${pre}✓ ${sub} ${argv[1] ?? "unit"} · done (simulated)` }]);
      return ok([{ type: "output", text: "UNIT                      LOAD   ACTIVE SUB\npenguin-console.service    loaded active running\ndocker.service            loaded active running\n2 units (simulated)" }]);
    }
    case "service": return ok([{ type: "success", text: `${pre}✓ service ${args} · done (simulated)` }]);
    case "journalctl":
      return ok([{ type: "dim", text: "-- Logs begin at Tue 2026-09-09 08:00:11 --" }, { type: "output", text: "Sep 09 09:00:11 penguin systemd[1]: Reached target Graphical Interface.\nSep 09 09:12:01 penguin systemd[1]: Started Penguin Console." }]);
    case "dmesg": return ok([{ type: "dim", text: "[    0.000000] Linux version 6.8.0-41-generic (simulated ring buffer)" }]);
    case "git": {
      const sub = argv[0] ?? "status";
      if (sub === "status") return ok([
        { type: "output", text: "On branch main · up to date with 'origin/main'." },
        { type: "success", text: "nothing to commit, working tree clean" },
      ]);
      if (sub === "log") return ok([{ type: "output", text: "* 9f3ac21 (HEAD -> main) feat: split resizing (#214)\n* 77bd902 fix: wayland IME\n* a1c90e0 chore: bump electron 31" }]);
      if (sub === "diff") return ok([{ type: "output", text: "diff --git a/src/split.ts b/src/split.ts\n+ export function balance(node) { /* … */ }\n- const ratio = 0.5;" }]);
      if (sub === "branch") return ok([{ type: "success", text: "* main\n  feat/workspaces\n  fix/ime" }]);
      if (["pull", "fetch", "push"].includes(sub)) return ok([{ type: "success", text: `${pre}✓ ${sub} complete · already up to date.` }]);
      if (sub === "stash") return ok([{ type: "success", text: "No local changes to save" }]);
      return ok([{ type: "output", text: `${pre}git ${args} → simulated OK in ${short(cwd)}` }]);
    }
    case "docker": {
      const sub = argv[0] ?? "ps";
      if (sub === "ps") return ok([{ type: "output", text: "NAMES       STATUS         PORTS\nnova-api     Up 3 hours     0.0.0.0:3001->3001/tcp\npostgres     Up 2 days      5432/tcp" }]);
      if (sub === "images") return ok([{ type: "output", text: "REPOSITORY   TAG      SIZE\nnova/api      latest   412MB\npostgres      16       379MB" }]);
      if (sub === "logs") return ok([{ type: "dim", text: "[api] GET /health 200 · 3ms" }, { type: "dim", text: "[api] WS client connected" }]);
      if (sub === "compose") return ok([{ type: "success", text: `${pre}✓ compose up -d · 2 containers started` }]);
      if (sub === "stats") return ok([{ type: "output", text: "CONTAINER   CPU%   MEM\nnova-api    2.14%  188MB\npostgres    0.62%  96MB (simulated)" }]);
      return ok([{ type: "output", text: `${pre}docker ${args} → simulated OK` }]);
    }
    case "kubectl": case "k": {
      const sub = argv[0] ?? "get";
      if (sub === "get") return ok([{ type: "output", text: "NAME                      READY   STATUS    RESTARTS\nnova-api-7d9c4f6b9-x2v4q   1/1     Running   0\npostgres-0                1/1     Running   1 (simulated)" }]);
      if (sub === "describe" || sub === "logs") return ok([{ type: "dim", text: `[k8s] ${sub} → streaming simulated output…` }, { type: "output", text: "Status: Running · IP: 10.42.1.17" }]);
      return ok([{ type: "output", text: `${pre}kubectl ${args} → simulated OK` }]);
    }
    case "helm": return ok([{ type: "output", text: "NAME      STATUS    CHART\nnova       deployed  nova-2.14.0 (simulated)" }]);
    case "npm": case "pnpm": case "yarn": case "bun":
      if (args.includes("run dev")) return ok([{ type: "success", text: "➜  Local:   http://localhost:5173/" }, { type: "dim", text: "  watching for changes… (simulated)" }], cwd, 0, { slow: 120 });
      if (args.includes("test")) return ok([{ type: "success", text: "✓ 24 tests passed (1.2s)" }], cwd, 0, { slow: 160 });
      if (args.includes("install") || args.includes(" i")) return ok([{ type: "success", text: `${pre}✓ up to date · 412 packages in 3s (simulated)` }], cwd, 0, { slow: 200 });
      return ok([{ type: "output", text: `${pre}${bin} ${args} → simulated OK` }]);
    case "npx": case "node":
      if (args.includes("--version") || !args) return ok([{ type: "output", text: bin === "npx" ? "10.2.0" : "v22.11.0" }]);
      if (args.includes("-e")) return ok([{ type: "output", text: "42" }]);
      return ok([{ type: "output", text: `${pre}${bin} ${args} → simulated OK` }]);
    case "python3": case "python":
      if (args.includes("-m http.server")) return ok([{ type: "success", text: "Serving HTTP on 0.0.0.0 port 8000 … (simulated, Ctrl+C to stop)" }]);
      if (args.includes("--version") || !args) return ok([{ type: "output", text: "Python 3.12.3" }]);
      return ok([{ type: "output", text: `${pre}${bin} ${args} → simulated OK` }]);
    case "pip": return ok([{ type: "success", text: "Requirement already satisfied · 38 packages (simulated)" }]);
    case "gcc": case "make": case "cargo": case "go":
      return ok([{ type: "success", text: `${pre}✓ ${bin} ${args} · build succeeded (simulated)` }]);
    case "ffmpeg":
      return ok([{ type: "success", text: `${pre}frame= 2400 fps=118 · Lsize=  8420kB · done in 20.3s (simulated)` }], cwd, 0, { slow: 220 });
    case "convert": case "magick": return ok([{ type: "success", text: `${pre}✓ image converted (simulated)` }]);
    case "ssh":
      return ok([{ type: "success", text: `${pre}✓ connected to ${argv[0] ?? "prod-01"} (simulated session)` }, { type: "dim", text: "Last login: Tue Sep  9 08:14:22 2026 from 10.0.0.8" }]);
    case "scp": return ok([{ type: "success", text: `${pre}✓ 100% 12MB  48.2MB/s · done (simulated)` }]);
    case "curl": case "wget":
      return ok([{ type: "dim", text: `${pre}→ GET ${argv.find((a) => !a.startsWith("-")) ?? "https://example.com"} … 200 OK (312ms, simulated)` }]);
    case "ping":
      return ok([{ type: "output", text: `PING ${argv[0] ?? "8.8.8.8"}: 56 bytes · 12.4 ms · ttl=117 (simulated ×3)` }]);
    case "ss": case "netstat": return ok([{ type: "output", text: "tcp  0  0 0.0.0.0:3001  LISTEN\ntcp  0  0 0.0.0.0:22    LISTEN (simulated)" }]);
    case "ip": return ok([{ type: "output", text: "2: wlp0s20f3: <UP> inet 192.168.1.42/24 (simulated)" }]);
    case "find": case "grep": case "rg": case "fd":
      return ok([{ type: "output", text: "./src/split.ts:42:  export function balance(node)\n./src/store.ts:108: history.push(entry)\n2 matches (simulated)" }]);
    case "sed": case "awk": case "cut": case "sort": case "uniq": case "tr":
      return ok([{ type: "dim", text: `(${bin} usually follows a pipe — try: ls | ${bin})` }]);
    case "tar":
      return ok([{ type: "success", text: `${pre}✓ archive written · 84M → 21M (simulated)` }]);
    case "zip": case "unzip": return ok([{ type: "success", text: `${pre}✓ ${bin} ${args} · done (simulated)` }]);
    case "chmod": case "chown": return ok([{ type: "success", text: `${pre}✓ ${bin} ${args} · done (simulated)` }]);
    case "mkdir": case "touch": case "cp": case "mv": case "ln":
      return ok([{ type: "success", text: `${pre}✓ ${bin} ${args} · done` }]);
    case "rmdir": return ok([{ type: "success", text: `${pre}✓ rmdir ${args} · done` }]);
    case "rm": {
      if (args.includes("/") && (args.includes("-rf") || args.includes("-fr")) && /\s\/\s?$/.test(" " + args)) return ok([{ type: "error", text: "rm: refusing to wipe / — nice try (simulated)" }], cwd, 1);
      return ok([{ type: "error", text: "rm: simulated FS is read-only in demo mode (nothing deleted)" }], cwd, 1);
    }
    case "fuser": case "kill": case "killall": case "pkill":
      return ok([{ type: "success", text: `${pre}✓ process on ${args || "…"} terminated (simulated)` }]);
    case "rsync":
      return ok([{ type: "success", text: `${pre}sending incremental file list … 1.2G/1.2G 100% · done` }], cwd, 0, { slow: 180 });
    case "watch":
      return ok([{ type: "dim", text: `Every 2.0s: ${args || "df -h"} (simulated snapshot)` }, { type: "output", text: "/dev/nvme0n1p2  457G  213G  221G  50% /" }]);
    case "sleep": return ok([{ type: "dim", text: `(slept ${argv[0] ?? 1}s — simulated instantly)` }]);
    case "time": return ok([{ type: "dim", text: "real 0m0.042s · user 0m0.031s · sys 0m0.011s (simulated)" }]);
    case "env": case "printenv":
      return ok([{ type: "output", text: Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") }]);
    case "export": {
      const m = args.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) return ok([{ type: "dim", text: "usage: export NAME=value" }], cwd, args ? 1 : 0);
      return ok([{ type: "success", text: `${pre}✓ exported ${m[1]}` }], cwd, 0, { envDelta: { [m[1]]: m[2] } } as unknown as Partial<Single>);
    }
    case "unset":
      if (!argv[0]) return ok([{ type: "dim", text: "usage: unset NAME" }], cwd, 1);
      return ok([{ type: "dim", text: `unset ${argv[0]} (simulated)` }], cwd, 0, { envDelta: { [argv[0]]: null } } as unknown as Partial<Single>);
    case "which": case "whereis": case "command":
      return ok([{ type: "output", text: KNOWN.includes(argv[0]) ? `/usr/bin/${argv[0]}` : `${argv[0] ?? ""}: not found` }], cwd, KNOWN.includes(argv[0]) ? 0 : 1);
    case "man": case "tldr":
      return ok([{ type: "output", text: `${(argv[0] ?? "command").toUpperCase()}(1) — simulated man page\nSYNOPSIS  ${argv[0] ?? "cmd"} [OPTIONS]\nSee the History panel for real usage examples.` }]);
    case "cowsay":
      return ok([{ type: "output", text: ` _______\n< ${args || "moo"} >\n -------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||` }]);
    case "fortune": return ok([{ type: "output", text: "“Ship workspaces, not meetings.” — fortune (simulated)" }]);
    case "yes": return ok([{ type: "output", text: Array(6).fill(args || "y").join("\n") + "\n…(truncated — simulated)" }]);
    case "xdg-open": case "open": return ok([{ type: "success", text: `${pre}✓ opened ${args || "."} in file manager (simulated)` }]);
    case "code": return ok([{ type: "success", text: `${pre}✓ opened ${args || "."} in VS Code (simulated)` }]);
    case "vim": case "nvim": case "nano": case "emacs": case "hx":
      return ok([{ type: "dim", text: `${bin} ${args} — buffer opened in a real Electron build via node-pty; simulated here.` }]);
    case "tmux": case "screen":
      return ok([{ type: "dim", text: `${bin}: penguin panes already multiplex — try Ctrl+Shift+H instead.` }]);
    case "bash": case "zsh": case "fish":
      return ok([{ type: "success", text: `✓ switched login shell → ${bin} (simulated for this pane)` }]);
    case "source": case ".": return ok([{ type: "success", text: `✓ sourced ${args || ".zshrc"} (simulated)` }]);
    case "alias": return ok([{ type: "output", text: "ll='ls -la'\ngs='git status'\nd='docker ps' (simulated)" }]);
    case "crontab": return ok([{ type: "output", text: "no crontab for user (simulated)" }]);
    case "apt": case "apt-get": case "dnf": case "pacman": case "zypper": case "snap": case "flatpak":
      return ok([{ type: "success", text: `${pre}✓ ${bin} ${args} · 0 upgraded, 0 newly installed (simulated)` }], cwd, 0, { slow: 200 });
    case "passwd": return ok([{ type: "error", text: "passwd: password changes disabled in demo sandbox" }], cwd, 1);
    case "reboot": case "shutdown": case "poweroff": case "halt":
      return ok([{ type: "error", text: `${bin}: refusing — the demo must go on (simulated)` }], cwd, 1);
    case "sudo": {
      if (!args) return ok([{ type: "dim", text: "usage: sudo <command>" }], cwd, 1);
      const inner = runSingle(args, { ...ctx, sudo: true });
      return inner;
    }
    case "theme": return ok([{ type: "system", text: `__THEME__${args}` }]);
    case "stats": return ok([{ type: "system", text: "__STATS__" }]);
    case "mcp": return ok([{ type: "system", text: `__MCP__${args}` }]);
    case "workspace": case "ws": return ok([{ type: "system", text: `__WORKSPACE__${args}` }]);
    case "exit": case "logout": return ok([{ type: "system", text: "__CLOSE_PANE__" }]);
    default: {
      if (TYPO[bin]) return ok([{ type: "error", text: `${bin}: command not found — did you mean '${TYPO[bin]}'?` }], cwd, 127);
      let best = "";
      for (const k of KNOWN) { if (k.startsWith(bin.slice(0, 2)) && bin.length >= 3) { best = k; break; } }
      void best;
      return ok([
        { type: "output", text: `${pre}$ ${seg}` },
        { type: "success", text: `✓ executed in ${short(cwd)} · exit 0 (simulated Linux)` },
      ]);
    }
  }
}

export function execShell(raw: string, cwd: string, env: Record<string, string> = {}, opts: ExecOpts = {}): ExecResult {
  const t0 = performance.now();
  const cmd = raw.trim();
  const base: ExecResult = { lines: [], newCwd: cwd, exitCode: 0, durationMs: 4 };
  if (!cmd) return base;
  const fullEnv = { HOME, USER: "user", SHELL: "/bin/zsh", TERM: "xterm-256color", PWD: cwd, ...env };
  const chain = splitChain(cmd);
  let curCwd = cwd;
  let lastCode = 0;
  let slow = 0;
  const mergedDelta: Record<string, string | null> = {};
  const out: ExecLine[] = [];
  chain.forEach((s, i) => {
    if (i > 0) {
      if (s.op === "and" && lastCode !== 0) return;
      if (s.op === "or" && lastCode === 0) return;
    }
    const pipes = splitPipe(s.cmd);
    const first = runSingle(pipes[0], { cwd: curCwd, env: { ...fullEnv }, sudo: false, opts });
    curCwd = first.newCwd;
    if (first.envDelta) Object.assign(mergedDelta, first.envDelta);
    slow += first.slow ?? 0;
    if (pipes.length === 1) {
      out.push(...first.lines);
      lastCode = first.code;
      return;
    }
    let text = first.lines.filter((l) => l.type !== "system").map((l) => l.text).join("\n");
    let code = first.code;
    for (const f of pipes.slice(1)) {
      const r = applyFilter(text, f);
      text = r.text;
      code = r.code;
    }
    out.push({ type: code === 0 ? "output" : "error", text });
    lastCode = code;
  });
  const ms = Math.max(4, Math.round(performance.now() - t0 + Math.random() * 36 + slow * Math.random()));
  const res: ExecResult = { lines: out, newCwd: curCwd, exitCode: lastCode, durationMs: ms };
  if (Object.keys(mergedDelta).length) res.envDelta = mergedDelta;
  return res;
}
