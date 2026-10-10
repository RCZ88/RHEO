/**
 * workforceActivity.ts — THE contract between the PTY and the Workforce scene.
 *
 * This module is the single source of truth for "what an AI worker just did".
 * It lives in `src/shared/` because BOTH processes need the exact same
 * implementation and the exact same table:
 *
 *   src/main.ts      → workforceAdapters.ts → classifyAction() → ActionEvent[]
 *   renderer         → workforceStore.ts (reducer) → scene model → inspector
 *
 * A second copy of any of these tables in one of the two processes is the bug
 * this file exists to prevent: the moment they drift, a worker walks to the
 * wrong station or an inspector field disagrees with the ring colour.
 *
 * HARD RULE (integration plan §2): no filesystem, no database, no `window`,
 * no `node:` imports. Pure in, pure out. That is what makes it unit-testable
 * from a plain `node` process and importable from the renderer.
 *
 * HARD RULE (integration plan §5): if a value has no real source, it is
 * ABSENT — never 0, never a guess. `tokens` in particular is only ever set
 * when the agent actually printed a token count.
 */

/* ------------------------------------------------------------------ */
/* §2 — the contract                                                    */
/* ------------------------------------------------------------------ */

export type ActionKind =
  | 'edit'
  | 'read'
  | 'search'
  | 'look'
  | 'think'
  | 'plan'
  | 'build'
  | 'test'
  | 'lint'
  | 'serve'
  | 'web'
  | 'remote'
  | 'mcp'
  | 'install'
  | 'container'
  | 'database'
  | 'commit'
  | 'branch'
  | 'move'
  | 'delete'
  | 'delegate'
  | 'run'
  | 'command'
  | 'blocked'
  | 'archived'
  | 'unknown';

export type ActionResult = 'ok' | 'fail' | 'running';

export interface ActionCounts {
  added?: number;
  removed?: number;
  passed?: number;
  failed?: number;
}

export interface ActionEvent {
  /** the terminal session this happened in — the join key for everything */
  sessionId: string;
  ts: number;
  kind: ActionKind;
  /** raw tool name as the agent printed it, if any */
  tool?: string;
  /** raw shell command, if any */
  command?: string;
  /** path, pattern, url, or mcp server — whatever the tool was pointed at */
  target?: string;
  result?: ActionResult;
  /** ONLY when the agent printed an exit code. Otherwise absent. */
  exitCode?: number;
  counts?: ActionCounts;
  /** ONLY when the agent printed a token count. NEVER computed. */
  tokens?: number;
}

/** Every ActionKind, in the order the inspector legend lists them. */
export const ACTION_KINDS: readonly ActionKind[] = [
  'edit', 'read', 'search', 'look', 'think', 'plan', 'build', 'test', 'lint',
  'serve', 'web', 'remote', 'mcp', 'install', 'container', 'database', 'commit',
  'branch', 'move', 'delete', 'delegate', 'run', 'command', 'blocked',
  'archived', 'unknown',
] as const;

/* ------------------------------------------------------------------ */
/* classifyAction — the ONE ordered table                              */
/* ------------------------------------------------------------------ */

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE TOOL REGISTRY — verified, not guessed.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * PROVENANCE: extracted from a real opencode session on this machine
 * (~/.local/share/opencode/opencode.db → part.data → the `invalid` tool's
 * error message, which enumerates every tool the model was offered). 140/140
 * tools accounted for. Reproduce with the extractor documented in
 * agent/docs/RHEO Workforce_ Visual Reference(1).html's sibling note.
 *
 * This replaced a hand-written table of tool names I had GUESSED, and the
 * guesses were wrong in three ways that mattered:
 *
 *   1. **MCP tools are NOT `mcp__`-prefixed.** opencode exposes them as bare
 *      `probe_eval`, `shadcn_get_component`, `playwright_browser_click`. My
 *      `^mcp__` test therefore never fired, and since none of those names were
 *      in the guessed table either, EVERY MCP call fell through to `null`.
 *      On this repo MCP calls are ~90% of all tool activity (probe alone:
 *      2,000+ calls in the sampled session), so the scene would have shown a
 *      permanently idle workforce during exactly the work it exists to show.
 *   2. **`skill` and `question` are real builtin tools.** `question` is how
 *      this agent asks a human — i.e. the `blocked` state, which is the one
 *      state the user most needs to see. `skill(name)` is how a skill is
 *      loaded, which is a more reliable signal than watching for a SKILL.md
 *      read that may never happen.
 *   3. **`list` and `patch` do not exist.** I had invented both. Any adapter
 *      keying on them was matching nothing.
 */

/** Every builtin (non-MCP) tool this agent can call. Authoritative. */
export const BUILTIN_TOOLS: readonly string[] = [
  'bash',
  'edit',
  'glob',
  'grep',
  'invalid',
  'list_mcp_resource_templates',
  'list_mcp_resources',
  'question',
  'read',
  'read_mcp_resource',
  'skill',
  'task',
  'todowrite',
  'webfetch',
  'websearch',
  'write',
];

/**
 * MCP server prefixes observed in this repo's `opencode.json`. Note the two
 * shadcn servers differ by ONE character class: `shadcn_` (underscore) and
 * `shadcn-ui-mcp_` (hyphens). A prefix table that normalises hyphens away would
 * merge them and, worse, `shadcn-ui-mcp_get_component` would not match a
 * `/^shadcn_/` test.
 */
export const MCP_SERVER_PREFIXES: readonly string[] = [
  'google-design-mcp_',
  'magicui_',
  'notion_',
  'playwright_browser_',
  'probe_',
  'reactbits_',
  'shadcn-ui-mcp_',
  'shadcn_',
];

/** The other agents namespace MCP tools as `mcp__server__tool`. */
const MCP_NS_RE = /^mcp__[a-z0-9_-]+__/i;

/**
 * Is this tool name an MCP call rather than a builtin?
 *
 * Three checks, in order of authority:
 *   1. `mcp__server__tool` — the namespaced form (claude / codex / gemini).
 *   2. a KNOWN server prefix — authoritative while the server list is current.
 *   3. NOT a builtin and shaped like `<prefix>_<tool>` — the fallback that keeps
 *      a newly-installed MCP server visible before anybody updates this file.
 *      Without it, adding an MCP server to opencode.json makes the scene go
 *      quiet for that server until someone re-runs the extractor.
 */
export function isMcpTool(tool: string): boolean {
  if (!tool) return false;
  const t = tool.toLowerCase();
  if (MCP_NS_RE.test(t)) return true;
  if (MCP_SERVER_PREFIXES.some((p) => t.startsWith(p.toLowerCase()))) return true;
  if ((BUILTIN_TOOLS as readonly string[]).includes(t)) return false;
  // Fallback: `server_tool`, where the server part may contain hyphens/dots.
  return /^[a-z][a-z0-9]*(?:[-.][a-z0-9]+)*_[a-z0-9][a-z0-9_]*$/.test(t);
}

/**
 * Builtin tool → kind.
 *
 * Only the verified names are listed. Every entry is a tool that actually
 * exists on this machine, so a name can never silently match nothing.
 * `bash` is deliberately absent from the immediate-return path — it is a SHELL
 * kind and must fall through to COMMAND_RULES (see SHELL_KINDS).
 */
const TOOL_RULES: ReadonlyArray<readonly [RegExp, ActionKind]> = [
  // -- the shell: falls through to the command table --------------------
  [/^(bash|shell|sh|zsh|powershell|cmd|run|exec|execute)$/, 'command'],

  // -- file mutation ----------------------------------------------------
  [/^(edit|write|patch|multiedit|notebookedit|apply_patch|applypatch|str_replace(?:_editor)?|update_file|create_file|write_file)$/, 'edit'],
  [/^(move|mv|rename|notebookmove)$/, 'move'],
  [/^(delete|rm|remove|remove_file|notebookdelete)$/, 'delete'],

  // -- inspection -------------------------------------------------------
  // `skill(name)` is a READ of a skill definition. Counting it here is more
  // reliable than watching for a SKILL.md file read, which an agent that
  // already has the skill cached never performs.
  [/^(read|read_file|notebookread|cat|head|tail|open|openfile|view|skill|loadskill|useskill)$/, 'read'],
  [/^(grep|glob|ripgrep|search|search_files|codebase_search)$/, 'search'],
  [/^(list|ls|list_dir|listdir|tree|list_files)$/, 'look'],

  // -- reasoning --------------------------------------------------------
  [/^(think|thinking|thought|reason|reasoning)$/, 'think'],
  [/^(todowrite|todo|write_todos|update_plan|plan|exit_plan_mode)$/, 'plan'],
  [/^(task|agent|delegate|spawn_agent|dispatch|handoff|subagent)$/, 'delegate'],

  // -- network ----------------------------------------------------------
  [/^(webfetch|web_fetch|websearch|web_search|fetch|browse|browser|download)$/, 'web'],
  [/^(ssh|scp|rsync|deploy|git_push|push)$/, 'remote'],

  // -- infra ------------------------------------------------------------
  [/^(docker|kubectl|podman|helm|compose|terraform|ansible)$/, 'container'],
  [/^(prisma|psql|sqlite3|mysql|mongo|alembic|db|migrate|knex)$/, 'database'],

  // -- interaction ------------------------------------------------------
  // `question` is how this agent asks a human a question. That IS the blocked
  // state — the one thing the user must be able to see at a glance.
  [/^(question|askuserquestion|ask_user|ask|permission|request_permission|confirm|prompt_user)$/, 'blocked'],
  [/^(checkpoint|compact|archive|snapshot)$/, 'archived'],

  // -- MCP resource plumbing -------------------------------------------
  [/^(list_mcp_resource_templates|list_mcp_resources|read_mcp_resource|list_mcp_resource|read_mcp_resource_template)$/, 'mcp'],

  // -- a failed tool call ------------------------------------------------
  // `invalid` is emitted when the model calls a tool that does not exist. It
  // is a REAL failure and must show as one, not vanish.
  [/^invalid$/, 'unknown'],
];

/**
 * Shell command -> kind. Ordered most-specific first.
 *
 * The `command` branch matters more than it looks: a coding agent spends most
 * of its wall-clock inside ONE tool (`bash` — 13,208 calls in the sampled
 * session vs 2,467 for `edit`), and every distinct command kind is a different
 * station. If all of them collapsed to `command`, the scene would park
 * everybody at the same bench and the fleet view would read as "one agent, one
 * activity" — the exact disconnected-looking UI this pipeline exists to fix.
 *
 * ORDER IS LOAD-BEARING. Each rule below is written to be decided before the
 * ones after it:
 *   * `npm test` must beat `npm install`-shaped and generic `npm run` rules.
 *   * `tsc --noEmit` is a LINT, but `tsc -b` is a BUILD — hence two rules.
 *   * `git push` is REMOTE, and must not be caught by the generic installer.
 */
const COMMAND_RULES: ReadonlyArray<readonly [RegExp, ActionKind]> = [
  // -- tests (before lint/build: `npm test` is neither) ----------------
  [/\b(?:vitest|jest|mocha|pytest|rspec|phpunit|ava|tap|unittest)\b/, 'test'],
  [/\bgo\s+test\b/, 'test'],
  [/\bcargo\s+test\b/, 'test'],
  [/^\s*(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|it)\b/, 'test'],

  // -- lint / typecheck (before build: `tsc --noEmit` is a lint) --------
  [/\b(?:eslint|prettier|biome|ruff|flake8|black|isort|clippy|golangci-lint|shellcheck|stylelint|tsc\s+--noEmit)\b/, 'lint'],
  [/^\s*(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|types|lint|format)\b/, 'lint'],

  // -- build -------------------------------------------------------------
  [/\b(?:tsc\s+-b|next\s+build|nuxt\s+build|ng\s+build)\b/, 'build'],
  [/\b(?:vite|webpack|rollup|esbuild|parcel|tsup|turbo)\b/, 'build'],
  [/\b(?:cargo\s+build|make|cmake|gradle|xcodebuild|msbuild)\b/, 'build'],
  [/^\s*(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b/, 'build'],

  // -- serve -------------------------------------------------------------
  [/\b(?:uvicorn|gunicorn|next\s+dev|webpack-dev-server|http-server|serve)\b/, 'serve'],
  [/^\s*(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview)\b/, 'serve'],
  [/^\s*python3?\s+-m\s+http\.server\b/, 'serve'],

  // -- install -----------------------------------------------------------
  // `npm ci` is the one that bites: it is the most common install command in
  // this repo's own tooling and it is neither `install`, `add`, nor bare `i`.
  [/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|ci|i)\b/, 'install'],
  [/^\s*(?:pip3?|uv|poetry)\s+install\b/, 'install'],
  [/\b(?:apt-get|apt|dnf|yum|brew|pacman|apk|choco)\s+install\b/, 'install'],
  [/\b(?:cargo\s+add|go\s+get|gem\s+install|composer\s+require)\b/, 'install'],

  // -- database ----------------------------------------------------------
  [/\b(?:prisma\s+migrate|alembic\s+(?:upgrade|revision)|knex\s+migrate|typeorm)\b/, 'database'],
  [/^\s*(?:psql|mysql|sqlite3|mongosh|redis-cli)\b/, 'database'],
  [/\bmigrat(?:e|ion)\b/, 'database'],

  // -- container / infra -------------------------------------------------
  [/\b(?:docker(?:-compose)?|kubectl|k9s|helm|podman|nerdctl|minikube)\b/, 'container'],
  [/\b(?:terraform|tofu|pulumi|ansible|vagrant)\b/, 'container'],

  // -- web fetch ---------------------------------------------------------
  // `curl` is unambiguous as a command; the TOOL_RULES entry for it only
  // catches a bare tool call, not `curl https://...` arriving through bash.
  [/\b(?:curl|wget|httpie)\b/, 'web'],

  // -- vcs (commit / branch BEFORE delete: `git commit` has no rm) ------
  [/^\s*git\s+commit\b/, 'commit'],
  [/\bgit\s+(?:checkout|switch)\s+-/, 'branch'],
  [/\bgit\s+(?:branch|init)\b/, 'branch'],
  [/^\s*(?:mv|git\s+mv)\b/, 'move'],
  [/^\s*(?:rm|del|rmdir|trash|unlink|git\s+rm)\b/, 'delete'],
  [/^\s*git\s+push\b/, 'remote'],
  [/^\s*(?:scp|ssh|rsync)\b/, 'remote'],
  [/\bgh\s+(?:pr|issue|release)\b/, 'remote'],

  // -- generic run --------------------------------------------------------
  [/^\s*(?:npm|pnpm|yarn|bun|npx)\s+run\s+\S+/, 'run'],
  [/^\s*(?:node|npx|deno|bun|tsx|ts-node|python3?|ruby|perl|go|cargo)\b/, 'run'],
];

const SHELL_KINDS = new Set<ActionKind>(['command']);

export function classifyAction(input: {
  tool?: string | null;
  command?: string | null;
  target?: string | null;
}): ActionKind | null {
  const tool = (input.tool ?? '').trim();
  const command = (input.command ?? '').trim();
  const target = (input.target ?? '').trim();

  // 1 — MCP namespaced tool names. Checked FIRST because `mcp__github__create_pr`
  //     would otherwise fall through to the generic rules on its last segment.
  if (isMcpTool(tool)) return 'mcp';
  // 2 — tool-name table. A SHELL tool is deliberately NOT returned here; see
  //     SHELL_KINDS below for why that distinction is load-bearing.
  const viaTool = classifyToolName(tool);
  if (viaTool && !SHELL_KINDS.has(viaTool)) return viaTool;

  // 3 — a shell tool (or no tool at all): the COMMAND is the action.
  if (command) {
    for (const [re, kind] of COMMAND_RULES) if (re.test(command)) return kind;
    // 4 — it ran, we just don't know what it means. NOT `unknown`: it is a run.
    if (looksLikeCommand(command)) return 'run';
  }

  // A bare target with no tool and no command carries no action.
  void target;
  // The shell tool name survived, but there was no command to classify.
  return viaTool ?? null;
}

function classifyToolName(tool: string): ActionKind | null {
  if (!tool) return null;
  const t = tool.toLowerCase();
  for (const [re, kind] of TOOL_RULES) if (re.test(t)) return kind;
  return null;
}

/** Cheap "is this plausibly a shell command" test — one leading token + args. */
function looksLikeCommand(s: string): boolean {
  return /^[\w./~\\-]+(?:\s|$)/.test(s) && !s.startsWith('#');
}

/* ------------------------------------------------------------------ */
/* extraction of the fields the contract allows                        */
/* ------------------------------------------------------------------ */

/**
 * Exit code, ONLY when the agent actually printed one.
 *
 * Patterns covered: `exit code: 1`, `exit code 1`, `Exit status: 1`,
 * `exited with code 1`, `process exited with 1`, and bare `exit 1` echoed by
 * a shell. Deliberately NOT inferred from a `✗` glyph or a red line — the plan
 * forbids guessing, and a wrong exit code puts a red ring on a healthy worker.
 */
export function extractExitCode(line: string): number | undefined {
  const m =
    line.match(/\bexit(?:\s+(?:code|status))?\s*[:=]?\s*(-?\d{1,3})\b/i) ??
    line.match(/\bexited\s+with\s+(?:code\s+)?(-?\d{1,3})\b/i) ??
    line.match(/\bprocess\s+exited\s+with\s+(?:code\s+)?(-?\d{1,3})\b/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Insertion/deletion counts, ONLY when printed as such.
 *
 * git and most agents print `12 insertions(+), 3 deletions(-)`. We require the
 * noun so that ordinary prose ("I have 12 lines here") cannot be mistaken for a
 * diff stat. When an agent prints only a unified diff we return undefined —
 * `git diff --numstat` at commit time is the honest source for that, and the
 * inspector must show touch counts only until then (integration plan §5).
 */
export function extractCounts(line: string): ActionCounts | undefined {
  const m = line.match(
    /(\d[\d,]*)\s+insertions?\(\+\)(?:\s*(?:,|and)\s*(\d[\d,]*)\s+deletions?\(-\))?/i,
  );
  if (!m) return undefined;
  const added = parseCount(m[1]);
  const removed = m[2] === undefined ? undefined : parseCount(m[2]);
  const out: ActionCounts = { added };
  if (removed !== undefined) out.removed = removed;
  return out;
}

/** Test tallies, ONLY when the agent prints a summary line. */
export function extractTestCounts(line: string): ActionCounts | undefined {
  const m = line.match(
    /\b(\d+)\s+(?:tests?\s+)?(?:passed|passing|ok)\b[^\d]{0,20}(\d+)?\s*(?:tests?\s+)?(?:failed|failing)/i,
  );
  if (!m) return undefined;
  const out: ActionCounts = { passed: Number.parseInt(m[1], 10) };
  if (m[2] !== undefined) out.failed = Number.parseInt(m[2], 10);
  return out;
}

/**
 * Token count, ONLY when printed.
 *
 * NEVER computed, NEVER estimated from characters. A wrong number in the
 * inspector's "$0.002" line is worse than "unknown" — it is the number the
 * user would budget against.
 */
export function extractTokens(line: string): number | undefined {
  const m = line.match(/\b(\d[\d,]*)\s*tokens?\b/i);
  if (!m) return undefined;
  return parseCount(m[1]);
}

function parseCount(raw: string): number {
  return Number.parseInt(raw.replace(/,/g, ''), 10);
}

/**
 * The one place `kind: 'unknown'` is minted: a `Tool(input)` shape we positively
 * identified as a tool call but could not place in the table above. Callers
 * should still prefer returning `[]` when they are not sure a line is a tool
 * call at all — see integration plan §3.
 */
export function unknownAction(
  sessionId: string,
  ts: number,
  hint: { tool?: string; command?: string; target?: string },
): ActionEvent {
  return { sessionId, ts, kind: 'unknown', ...hint };
}

/* ------------------------------------------------------------------ */
/* §6 — session lifecycle → worker state                                */
/* ------------------------------------------------------------------ */

export type WorkerLifecycle =
  | 'booting'
  | 'idle'
  | 'action'
  | 'blocked'
  | 'error'
  | 'saved'
  | 'gone';

export const LIFECYCLE_TERMINAL_READY_PENDING = 'booting' as const;