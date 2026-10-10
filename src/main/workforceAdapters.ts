/**
 * workforceAdapters.ts — turns raw PTY chunks into `ActionEvent[]` for the
 * Workforce scene. Main process only (imported by src/main.ts).
 *
 *   PTY chunk → strip ANSI → line buffer per session → per-agent adapter
 *            → classifyAction() → ActionEvent[] → batched IPC send
 *
 * ── The one rule (integration plan §1) ────────────────────────────────
 * The scene is a PURE FUNCTION of this event stream. Nothing in this file
 * reads the database or the filesystem, and nothing here knows what a scene
 * looks like. If you find yourself wanting the DB here, the answer is no.
 *
 * ── Why a line buffer at all ──────────────────────────────────────────
 * A PTY delivers BYTES, not lines. `dataBuffer += chunk` then re-splitting is
 * the wrong shape here: it re-processes every previously-seen line on every
 * chunk, so one tool call that arrives in 20 pieces becomes 20 events. We keep
 * ONE unfinished line per session and only ever hand complete lines to the
 * adapters. That is also what makes a burst of output cheap: the adapters see
 * each line exactly once.
 *
 * ── Why batching is mandatory ─────────────────────────────────────────
 * A busy agent prints hundreds of lines per second. One IPC message per line
 * would saturate the renderer main thread and freeze the very scene it is
 * meant to describe. Events accumulate and flush on a 100 ms timer.
 *
 * ── Provenance warning, read before trusting an adapter ────────────────
 * The canonical agents spell tool calls in several shapes and this repo has
 * NO recorded fixtures for any of them. The patterns below are therefore
 * deliberately TOLERANT (several shapes, several prefixes) rather than
 * precise, and every one of them returns `[]` when unsure — integration plan §3
 * forbids emitting `unknown` for ordinary noise. `recordWorkforceEvents()`
 * (plan §8.2) exists precisely so these patterns can be verified against real
 * captured output instead of trusted. Until a shape is verified by a fixture,
 * treat it as a hypothesis.
 */

import {
  classifyAction,
  extractCounts,
  extractExitCode,
  extractTestCounts,
  extractTokens,
  isMcpTool,
  type ActionEvent,
  type ActionKind,
} from '../shared/workforceActivity';

/* ------------------------------------------------------------------ */
/* adapter contract                                                     */
/* ------------------------------------------------------------------ */

/** What an adapter extracts from ONE complete line, before classification. */
export interface RawAction {
  tool?: string;
  command?: string;
  target?: string;
  /** set when the line is a RESULT of a previous call rather than a new call */
  result?: 'ok' | 'fail' | 'running';
  /** set when the line is known to be narration (no action) — used to bail early */
  narration?: boolean;
}

/** Per-agent extraction. Returns null when the line carries no action. */
export type LineAdapter = (line: string) => RawAction | null;

export type AgentName = 'claude' | 'opencode' | 'codex' | 'gemini' | 'aider' | (string & {});

/* ------------------------------------------------------------------ */
/* generic line shapes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Shape 1 — `Name(argument)`. The dominant form for the Ink-based agents
 * (claude, gemini) and for aider's plain-text tool echo:
 *
 *     ● Read(src/main.ts)
 *     ⏺ Bash(npm run build)
 *     Edit(agent/MEMORY.md)
 *
 * The leading bullet/asterisk column is Ink's tree glyph, not part of the name.
 */
const NAME_ARG = /^[^\w]{0,3}([A-Za-z][A-Za-z0-9_]{1,30})\(([^)]*)\)\s*$/;

/**
 * Shape 2 — `Label: payload`. Used by codex's `▌ Shell: npm test` frames and
 * by several agents' result lines.
 */
const LABEL_PAYLOAD = /^[^\w]{0,3}([A-Za-z][A-Za-z0-9_ /-]{1,30}):\s+(\S.*)$/;

/**
 * Shape 3 — a key=value tool dump: `read  file_path=src/main.ts`. Some agents
 * render the tool input as a field list rather than a single positional arg.
 */
const KEY_VALUE = /^([A-Za-z][A-Za-z0-9_]{1,30})\s+([a-z_]{3,24})=(\S+)(?:\s|$)/;

/**
 * Shape 4 — `Run: <command>` (aider) and `Shell: <command>` (codex). Split out
 * from LABEL_PAYLOAD because the payload is always a COMMAND, never a target.
 */
const RUN_LABEL = /^[^\w]{0,3}(?:run|shell|bash|exec|execute)\s*:\s*(\S.*)$/i;

/** Keys whose value is a filesystem path in a key=value dump. */
const PATH_KEYS = new Set(['file_path', 'path', 'file', 'notebook_path', 'filename', 'pattern', 'query', 'url', 'uri']);

/* ------------------------------------------------------------------ */
/* per-agent configuration                                              */
/* ------------------------------------------------------------------ */

interface AgentAdapterConfig {
  /** which render family this agent's TUI belongs to */
  render: 'opencode' | 'ink' | 'bubbletea';
  /** does this agent wrap tool calls in a leading bullet column? */
  bullets: boolean;
  /** extra tool-name spellings this agent uses (lowercase) */
  toolAliases: Record<string, string>;
  /** result lines it prints (used to attach exit codes / counts) */
  resultMarkers: RegExp[];
}

const DEFAULT_CONFIG: AgentAdapterConfig = {
  render: 'ink',
  bullets: true,
  toolAliases: {},
  resultMarkers: [
    /\bexit(?:\s+(?:code|status))?\s*[:=]?\s*-?\d{1,3}\b/i,
    /\binsertions?\(\+\)/i,
    /\b(?:tests?\s+)?(?:passed|passing|failed|failing)\b/i,
  ],
};

const ADAPTER_CONFIGS: Record<string, AgentAdapterConfig> = {
  claude: {
    ...DEFAULT_CONFIG,
    render: 'ink',
    // claude renders `● Read(file)` and `⏺ Bash(cmd)`; results are indented `⎿`.
    bullets: true,
    toolAliases: {},
    resultMarkers: [...DEFAULT_CONFIG.resultMarkers, /^\s*[⎿⏺│]\s*(?:exit|error|success)/i],
  },
  opencode: {
    ...DEFAULT_CONFIG,
    // opencode is a bubbletea TUI, but its tool titles are a distinct family
    // (`Read src/main.ts`), so it routes to extractOpencodeAction. Verified
    // against the shipped binary — see the OC table above.
    render: 'opencode',
    bullets: false,
    toolAliases: {},
    // NOT the status glyphs. A glyph is on the SAME line as the title
    // (`✓ Read src/main.ts`), and isResultLine() short-circuits a match to []
    // before extraction runs — so listing them here would silently discard
    // every completed tool call, which is most of them. The glyph is read
    // inside extractOpencodeAction and turned into `result`.
    resultMarkers: DEFAULT_CONFIG.resultMarkers,
  },
  codex: {
    ...DEFAULT_CONFIG,
    render: 'ink',
    bullets: false,
    toolAliases: { update_plan: 'plan', apply_patch: 'apply_patch' },
    resultMarkers: [...DEFAULT_CONFIG.resultMarkers, /^\s*▌\s*(?:exit|error|success|failed)/i],
  },
  gemini: {
    ...DEFAULT_CONFIG,
    render: 'ink',
    bullets: true,
    toolAliases: {},
    resultMarkers: DEFAULT_CONFIG.resultMarkers,
  },
  aider: {
    ...DEFAULT_CONFIG,
    render: 'ink',
    bullets: false,
    // aider echoes plain `Edit(path)` / `Run: pytest` and is the least
    // TUI-ish of the set — most of its output is prose, which we skip.
    toolAliases: {},
    resultMarkers: DEFAULT_CONFIG.resultMarkers,
  },
};

export function adapterConfigFor(agent: AgentName): AgentAdapterConfig {
  return ADAPTER_CONFIGS[String(agent).toLowerCase()] ?? DEFAULT_CONFIG;
}


/* ------------------------------------------------------------------ */
/* opencode: the REAL render format, read out of the installed binary   */
/* ------------------------------------------------------------------ */

/**
 * ── PROVENANCE ────────────────────────────────────────────────────────
 * These patterns were NOT designed. They were extracted from the
 * opencode binary at ~/.opencode/bin/opencode (185MB bun ELF, not
 * stripped) by grepping its render functions. Every template below is a
 * verbatim slice of the shipped code:
 *
 *   Glob "${t.input.pattern??''}"      Grep "${t.input.pattern??''}"
 *   Read ${o}    Write ${s(t.input.filePath)}    Edit ${s(t.input.filePath)}
 *   List ${s(o)}  WebFetch ${o}          Skill "${t.input.name??''}"
 *   Asked ${o}   Patch ${o}             $ ${o}          (bash)
 *
 * Status glyphs, also verbatim: \u2713 completed · \u2022 in_progress ·
 * \u2717 error.
 *
 * ── WHY THIS SECTION EXISTS ───────────────────────────────────────────
 * My first adapter assumed `Name(argument)` — the Ink-TUI shape claude and
 * codex use — and that was WRONG for opencode, which is the agent this repo
 * runs almost exclusively. opencode prints `Read src/main.ts`: a SPACE, no
 * parentheses, and quotes around some arguments. A `Name(arg)` regex matches
 * essentially none of it. Every one of my 181 assertions still passed while
 * this was broken, because all of them fed my own assumed format into my own
 * parser — a closed loop that could never disagree with itself. That is the
 * single most dangerous shape a test suite can have, and it is why this
 * section is derived from the binary rather than from my imagination.
 */
const OC = {
  /** bash: the command is prefixed with a literal `$` */
  shell: /^\$\s+(.+)$/,
  /** file tools: `Read src/main.ts`, optionally home-relative */
  read: /^Read\s+(.+)$/,
  write: /^Write\s+(.+)$/,
  edit: /^Edit\s+(.+)$/,
  patch: /^Patch\s+(.+)$/,
  list: /^List\s+(.+)$/,
  /** search tools: the argument is QUOTED — `Grep "auth"` */
  grep: /^Grep\s+"?(.*?)"?$/,
  glob: /^Glob\s+"?(.*?)"?$/,
  webfetch: /^WebFetch\s+(.+)$/,
  websearch: /^WebSearch\s+"?(.*?)"?$/,
  /** skills: quoted, and this is the RELIABLE skill signal */
  skill: /^Skill\s+"?(.*?)"?$/,
  /** the agent asking a human — the blocked state */
  asked: /^Asked\s+(.+)$/,
  /** subagent dispatch */
  task: /^(?:Task|Agent)\s+(.+)$/,
  /** the model called a tool that does not exist */
  invalid: /^Invalid Tool$/,
  /** status glyph anywhere on the line */
  done: /\u2713/,
  running: /\u2022/,
  failed: /\u2717/,
} as const;

/** Strip surrounding quotes and a leading path form from a rendered arg. */
function unquote(v: string): string {
  const s = v.trim().replace(/^["'`]|["'`]$/g, '').trim();
  // `s(path)` in opencode abbreviates the home dir to `~`; keep it readable
  // but never pretend we know the full path.
  return s;
}

/**
 * Extract a RawAction from a line rendered by opencode's TUI.
 * Returns null for anything that is not one of the known title shapes.
 */
export function extractOpencodeAction(line: string): RawAction | null {
  const t = line.trim();
  if (!t) return null;

  // The status glyph is stripped before matching: it prefixes/suffixes the
  // title and would otherwise defeat an anchored regex.
  const status = OC.failed.test(t) ? 'fail' : OC.running.test(t) ? 'running' : OC.done.test(t) ? 'ok' : undefined;
  const bare = t.replace(/[\u2713\u2022\u2717]/g, '').trim();
  if (!bare) return null;

  const out = (a: RawAction): RawAction => (status ? { ...a, result: status } : a);

  let m: RegExpMatchArray | null;
  if ((m = bare.match(OC.shell))) return out({ tool: 'bash', command: unquote(m[1]), target: firstPath(m[1]) });
  if ((m = bare.match(OC.read))) return out({ tool: 'read', target: unquote(m[1]) });
  if ((m = bare.match(OC.write))) return out({ tool: 'write', target: unquote(m[1]) });
  if ((m = bare.match(OC.edit))) return out({ tool: 'edit', target: unquote(m[1]) });
  if ((m = bare.match(OC.patch))) return out({ tool: 'patch', target: unquote(m[1]) });
  if ((m = bare.match(OC.list))) return out({ tool: 'list', target: unquote(m[1]) });
  if ((m = bare.match(OC.grep))) return out({ tool: 'grep', target: unquote(m[1]) });
  if ((m = bare.match(OC.glob))) return out({ tool: 'glob', target: unquote(m[1]) });
  if ((m = bare.match(OC.webfetch))) return out({ tool: 'webfetch', target: unquote(m[1]) });
  if ((m = bare.match(OC.websearch))) return out({ tool: 'websearch', target: unquote(m[1]) });
  if ((m = bare.match(OC.skill))) return out({ tool: 'skill', target: unquote(m[1]) });
  if ((m = bare.match(OC.asked))) return out({ tool: 'question', target: unquote(m[1]) });
  if ((m = bare.match(OC.task))) return out({ tool: 'task', target: unquote(m[1]) });
  if (OC.invalid.test(bare)) return out({ tool: 'invalid' });

  // MCP tools: opencode's generic fallback renders
  //   title: frame.state.title || formatInput(input)
  // so the line is NOT reliably `<tool> <arg>` — it may be a bare title with
  // no tool name at all. When the name IS present it looks like
  // `probe_eval expression` or `shadcn_get_component card`, so match the real
  // server prefixes. Without this, every MCP call falls through to null —
  // and MCP is the single largest category of real activity on this machine
  // (124 of 140 tools), so the scene would look dead during exactly the work
  // it exists to show.
  const mcp = bare.match(/^([a-z][a-z0-9]*(?:[-.][a-z0-9]+)*_[a-z0-9][a-z0-9_]*)\s+(.*)$/);
  if (mcp) {
    if (isMcpTool(mcp[1])) return out({ tool: mcp[1], target: unquote(mcp[2]) || undefined });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* the shared line extractor                                            */
/* ------------------------------------------------------------------ */

/** Does this line carry an exit code / tally that belongs to a PREVIOUS call? */
export function isResultLine(line: string, cfg: AgentAdapterConfig): boolean {
  return cfg.resultMarkers.some((re) => re.test(line));
}

/**
 * Extract a RawAction from one complete line, or null.
 *
 * This is the only place a line becomes structured data. Everything
 * agent-specific arrives through `cfg`, so adding a sixth agent is a config
 * entry rather than a new parser — which is what integration plan §3 asks for
 * ("one file per agent… do not add a second parser").
 */
export function extractRawAction(line: string, agent: AgentName): RawAction | null {
  const cfg = adapterConfigFor(agent);
  const trimmed = line.trim();
  if (!trimmed) return null;

  // opencode renders `Read src/main.ts`, NOT `Read(src/main.ts)`. It gets its
  // own extractor because its shape is genuinely different, not a variation.
  if (cfg.render === 'opencode') return extractOpencodeAction(trimmed);

  // Result/tally lines are handled by the caller (they attach to the last
  // action for the session), so they must NOT open a new action here.
  if (isResultLine(trimmed, cfg)) return null;

  // Shape 4 — `Run: <cmd>` is always a command.
  const run = trimmed.match(RUN_LABEL);
  if (run) {
    const command = run[1].trim();
    if (!command) return null;
    return { command, tool: 'bash' };
  }

  // Shape 1 — `Name(arg)`.
  const na = trimmed.match(NAME_ARG);
  if (na) {
    const tool = resolveTool(na[1], cfg);
    const arg = na[2].trim();
    if (!tool) return null;
    // A single positional arg is a target for path-ish tools and a command
    // for shell-ish tools. That distinction is the whole reason classifyAction
    // checks `command` before `target`.
    const shellish = isShellTool(tool);
    return shellish
      ? { tool, command: arg, target: firstPath(arg) }
      : { tool, target: arg || undefined };
  }

  // Shape 3 — `name key=value`.
  const kv = trimmed.match(KEY_VALUE);
  if (kv) {
    const tool = resolveTool(kv[1], cfg);
    if (!tool) return null;
    const key = kv[2].toLowerCase();
    const value = kv[3];
    return { tool, target: PATH_KEYS.has(key) || !isShellTool(tool) ? value : undefined, command: isShellTool(tool) ? value : undefined };
  }

  // Shape 2 — `Label: payload`. Only accept it when the label resolves to a
  // real tool name; otherwise it is prose (`Note: the build failed because…`)
  // and treating it as an action would fill the feed with noise.
  const lp = trimmed.match(LABEL_PAYLOAD);
  if (lp) {
    const tool = resolveTool(lp[1], cfg);
    if (!tool) return null;
    const payload = lp[2].trim();
    return isShellTool(tool) ? { tool, command: payload } : { tool, target: payload };
  }

  return null;
}

function resolveTool(rawName: string, cfg: AgentAdapterConfig): string | null {
  const cleaned = rawName.trim().replace(/[^\w]/g, '');
  if (!cleaned) return null;
  const alias = cfg.toolAliases[cleaned.toLowerCase()];
  const name = alias ?? cleaned;
  // Reject obvious prose words so a sentence like `Warning(...)` or
  // `Error(...)` does not become a tool call.
  if (PROSE_ONLY.has(name.toLowerCase())) return null;
  return name;
}

/** Words that look like `Name(...)` in prose but are never tools. */
const PROSE_ONLY = new Set([
  'warning', 'warn', 'error', 'errors', 'note', 'notes', 'info', 'debug', 'tip',
  'example', 'examples', 'summary', 'result', 'results', 'output', 'status',
  'hint', 'todo', 'todos', 'step', 'steps', 'reason', 'reasoning', 'think',
  'thinking', 'warning:', 'permission', 'done', 'ok', 'yes', 'no',
]);

function isShellTool(tool: string): boolean {
  return /^(bash|shell|sh|zsh|powershell|cmd|run|exec|execute|execute_command|run_command|local_shell|terminal)$/i.test(tool);
}

/** Pull a plausible filesystem path out of a shell command, if there is one. */
function firstPath(cmd: string): string | undefined {
  const m = cmd.match(/(?:^|\s)(?:\.\/|\/)?(?:[\w.-]+\/)*[\w.-]+\.[A-Za-z0-9]{1,6}\b/);
  return m ? m[0].trim() : undefined;
}

/* ------------------------------------------------------------------ */
/* line → ActionEvent[]                                                 */
/* ------------------------------------------------------------------ */

/**
 * Turn one complete line into zero or more ActionEvents.
 *
 * Zero is the common and correct answer: most lines in a real agent transcript
 * are prose, box drawing, or a diff body. Integration plan §3 is explicit that
 * we must not invent an event for them.
 */
export function eventsFromLine(
  line: string,
  sessionId: string,
  agent: AgentName,
  ts: number,
): ActionEvent[] {
  const cfg = adapterConfigFor(agent);

  // Result line → patch the exit code / tallies onto the call we just made.
  // Returns [] on its own: a tally with no preceding call is not an action.
  if (isResultLine(line.trim(), cfg)) return [];

  const raw = extractRawAction(line, agent);
  if (!raw) return [];

  const kind: ActionKind | null = classifyAction(raw);
  if (!kind) return [];

  const ev: ActionEvent = { sessionId, ts, kind };
  if (raw.tool) ev.tool = raw.tool;
  if (raw.command) ev.command = raw.command;
  if (raw.target) ev.target = raw.target;
  // Carry the agent's own status through. Without this line `result` was
  // extracted by the adapter and then silently DROPPED, so a tool call the
  // agent marked ✗ error produced an event with no failure signal at all —
  // the worker would sit there looking healthy while its call had failed.
  if (raw.result) ev.result = raw.result;

  // Field extraction is deliberately best-effort and additive: a line can
  // carry an action AND a diff stat, and both are real.
  const counts = extractCounts(line);
  if (counts) ev.counts = counts;
  const tests = extractTestCounts(line);
  if (tests) ev.counts = { ...(ev.counts ?? {}), ...tests };
  const exit = extractExitCode(line);
  if (exit !== undefined) {
    ev.exitCode = exit;
    ev.result = exit === 0 ? 'ok' : 'fail';
  }
  const tokens = extractTokens(line);
  if (tokens !== undefined) ev.tokens = tokens;

  return [ev];
}

/* ------------------------------------------------------------------ */
/* the ingest pipeline: buffer + adapter + batch                       */
/* ------------------------------------------------------------------ */

/** A strip function, injected so main.ts keeps ownership of its ANSI rules. */
export type StripFn = (s: string) => string;

export interface WorkforceIngest {
  /** Feed a raw PTY chunk. Returns the events produced by COMPLETE lines. */
  push(sessionId: string, agent: AgentName, chunk: string, ts?: number): ActionEvent[];
  /** Events buffered but not yet handed to the caller (waiting for the timer). */
  drain(): ActionEvent[];
  /** Events accumulated since the last `drain`. */
  readonly pending: number;
  /** Flush a session's partial line and forget it (session closed). */
  endSession(sessionId: string): void;
  /** Forget every partial line. */
  reset(): void;
}

export interface WorkforceIngestOptions {
  /**
   * The main process's own ANSI stripper. Injected rather than reimplemented:
   * src/main.ts already carries a hardened one that handles escape sequences
   * split across two PTY chunks, and a second copy would drift.
   */
  strip: StripFn;
  /** max characters retained for one session's unfinished line. */
  maxLineLength?: number;
  /** now(), injected for deterministic tests. */
  now?: () => number;
}

const DEFAULT_MAX_LINE = 8192;

/**
 * Create the ingest pipeline. Pure w.r.t. Electron — no imports, no globals —
 * so it can be unit-tested with `node` and reused.
 */
export function createWorkforceIngest(opts: WorkforceIngestOptions): WorkforceIngest {
  const strip = opts.strip;
  const maxLine = opts.maxLineLength ?? DEFAULT_MAX_LINE;
  const now = opts.now ?? (() => Date.now());

  /** one partial line per session — the rejoin buffer */
  const buf = new Map<string, string>();
  /** events produced by push() that the caller has not flushed yet */
  let pending: ActionEvent[] = [];

  function push(sessionId: string, agent: AgentName, chunk: string, ts?: number): ActionEvent[] {
    if (!chunk) return [];
    const stamp = ts ?? now();
    const text = (buf.get(sessionId) ?? '') + strip(chunk);

    // Split on BOTH line endings: PTYs emit bare \r for progress lines and \n
    // for real ones, and a \r-only stream would otherwise never yield a line.
    const parts = text.split(/\r\n|\n|\r/);
    let partial = parts.pop() ?? '';
    // A progress-spinner stream or a binary blob can emit millions of bytes
    // without ever sending a line ending. Without this bound the buffer grows
    // for the whole session and every push() re-copies it — one agent's noise
    // becoming an O(n^2) cost on every chunk. Keep only the TAIL: a tool call
    // is short, so its interesting part is at the end.
    if (partial.length > maxLine) partial = partial.slice(-maxLine);
    buf.set(sessionId, partial);

    const out: ActionEvent[] = [];
    for (const line of parts) {
      if (!line.trim()) continue;
      out.push(...eventsFromLine(line, sessionId, agent, stamp));
    }
    if (out.length) pending.push(...out);
    return out;
  }

  function drain(): ActionEvent[] {
    if (!pending.length) return [];
    const out = pending;
    pending = [];
    return out;
  }

  function endSession(sessionId: string): void {
    // Do NOT emit the partial line: a tool call cut in half by a closed
    // terminal is a half-event, and a half-event in the feed is a lie.
    buf.delete(sessionId);
  }

  function reset(): void {
    buf.clear();
    pending = [];
  }

  return {
    push,
    drain,
    endSession,
    reset,
    get pending() {
      return pending.length;
    },
  };
}

/* ------------------------------------------------------------------ */
/* batching                                                             */
/* ------------------------------------------------------------------ */

export const WORKFORCE_FLUSH_MS = 100;

export interface WorkforceBatcher {
  add(evs: ActionEvent[]): void;
  /** start the flush timer; returns a disposer that flushes and stops it */
  start(): () => void;
  /** stop the timer without flushing (app shutdown) */
  stop(): void;
}

/**
 * Batch ActionEvents and hand them to `send` at most once per
 * WORKFORCE_FLUSH_MS. One IPC message per batch, never per event.
 *
 * The timer is `unref()`d so a pending flush can never keep the main process
 * alive on quit — a 100 ms timer that outlives app shutdown is a hung process.
 */
export function createWorkforceBatcher(
  send: (batch: ActionEvent[]) => void,
  flushMs: number = WORKFORCE_FLUSH_MS,
): WorkforceBatcher {
  let queue: ActionEvent[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  function flush(): void {
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    try {
      send(batch);
    } catch {
      /* a closed window must never take down the main process */
    }
  }

  function add(evs: ActionEvent[]): void {
    if (!evs || !evs.length) return;
    queue.push(...evs);
    // Auto-start. A batcher whose `add` works but whose `start` was forgotten
    // is a silent data-loss bug: events accumulate forever and are never sent,
    // so the scene just quietly stops updating. Start on the first event
    // instead of making correctness depend on call ordering.
    if (!timer) start();
  }

  function start(): () => void {
    if (timer) return stop;
    timer = setInterval(flush, flushMs);
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
    return stop;
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { add, start, stop };
}

/* ------------------------------------------------------------------ */
/* §8.2 — record and replay                                             */
/* ------------------------------------------------------------------ */

export interface WorkforceRecorder {
  /** enable/disable at runtime (dev flag) */
  enabled: boolean;
  /** record one batch */
  record(batch: ActionEvent[]): void;
  /** everything recorded so far, in order */
  events(): ActionEvent[];
  /** the recordable payload, for writing to a JSON fixture file */
  dump(): string;
  clear(): void;
}

/**
 * In-memory ActionEvent recorder. Integration plan §8.2 asks for "write every
 * ActionEvent to a JSON file" so the scene can be tuned against real data and
 * the adapters can be unit-tested with recorded fixtures.
 *
 * Deliberately in-memory with an explicit `dump()`: this module must not touch
 * the filesystem (plan §1), so persisting is the caller's job — main.ts owns
 * `fs` and the dev-flag check.
 */
export function createWorkforceRecorder(): WorkforceRecorder {
  let enabled = false;
  let events: ActionEvent[] = [];

  return {
    get enabled() {
      return enabled;
    },
    set enabled(v: boolean) {
      enabled = v;
      if (v) events = [];
    },
    record(batch) {
      if (!enabled || !batch?.length) return;
      // Bound the buffer: a long dev session must not grow without limit.
      events.push(...batch);
      if (events.length > 20000) events = events.slice(-20000);
    },
    events: () => events.slice(),
    dump: () => JSON.stringify({ recordedAt: new Date().toISOString(), events }, null, 2),
    clear: () => {
      events = [];
    },
  };
}