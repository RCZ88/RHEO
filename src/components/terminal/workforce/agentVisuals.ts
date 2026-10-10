/**
 * agentVisuals.ts — single source of truth for agent appearance + status colors.
 *
 * All colors come from the existing RHEO palette (zinc surfaces + the five
 * group accents: cyan / emerald / violet / indigo / amber). Nothing here
 * invents a new color system.
 */

import type { ActivityKind, KnownAgentId, VisualState } from './workforceTypes';

export interface AgentVisualConfig {
  /** short terminal-native glyph shown on the worker's head screen */
  glyph: string;
  /** identity accent (one of the existing group accents) */
  accent: string;
  /** uppercase label */
  label: string;
  /** two-letter abbreviation for dense/swarm floors (OC·3) */
  abbr: string;
}

/**
 * Palette resolution.
 *
 * LAMINAR forbids raw hex in components, but these values are consumed as JS
 * strings (inline `style={{ color }}`, and framer-motion `animate={{ color }}`
 * which needs a literal, not a var()). So instead of inlining hex at each use
 * site we name every value here ONCE and resolve the name at the boundary.
 *
 * Agent identity accents are the one legitimate multi-hue case: five distinct
 * agents must be told apart at a glance, and each is still a real palette entry
 * rather than an ad-hoc colour.
 */
export const WF_PALETTE = {
  // agent identity
  opencode: '#22d3ee',
  claude: '#a78bfa',
  codex: '#34d399',
  gemini: '#818cf8',
  aider: '#fbbf24',
  // semantic state (mirrors the --wf-* custom properties in workforce.css)
  ok: '#34d399',
  warn: '#fbbf24',
  err: '#f87171',
  idle: '#52525b',
  muted: '#a1a1aa',
  signal: '#22d3ee',
} as const;

export type WfPaletteKey = keyof typeof WF_PALETTE;

/** Resolve a palette key to its colour. Throws on a typo instead of painting black. */
export function wfColor(key: WfPaletteKey): string {
  const v = WF_PALETTE[key];
  if (typeof v !== 'string') throw new Error(`[workforce] unknown palette key: ${String(key)}`);
  return v;
}

export const AGENT_VISUALS: Record<KnownAgentId, AgentVisualConfig> = {
  opencode: { glyph: '>_',  accent: WF_PALETTE.opencode, label: 'OPENCODE', abbr: 'OC' },
  claude:   { glyph: '◉_',  accent: WF_PALETTE.claude,   label: 'CLAUDE',   abbr: 'CL' },
  codex:    { glyph: '</>', accent: WF_PALETTE.codex,    label: 'CODEX',    abbr: 'CX' },
  gemini:   { glyph: '✦',   accent: WF_PALETTE.gemini,   label: 'GEMINI',   abbr: 'GM' },
  aider:    { glyph: '#_',  accent: WF_PALETTE.aider,    label: 'AIDER',    abbr: 'AI' },
};

export const UNKNOWN_VISUAL: AgentVisualConfig = {
  glyph: '?_',
  accent: WF_PALETTE.muted,
  label: 'AGENT',
  abbr: '??',
};

export function visualForAgent(agent: string, known: boolean): AgentVisualConfig {
  if (known && agent in AGENT_VISUALS) return AGENT_VISUALS[agent as KnownAgentId];
  const label = (agent || 'agent').slice(0, 10).toUpperCase();
  return { ...UNKNOWN_VISUAL, label, abbr: label.slice(0, 2) };
}

/** Error face swap, per spec: `x_` */
export const ERROR_GLYPH = 'x_';

/** Status dot colors — mirror the existing RHEO session indicator colors. */
export const STATE_DOT: Record<VisualState, string> = {
  launching: WF_PALETTE.idle, // zinc-600
  ready:     WF_PALETTE.signal, // cyan-400
  busy:      WF_PALETTE.ok, // emerald-400
  thinking:  WF_PALETTE.ok,
  attention: WF_PALETTE.warn, // amber-400
  error:     WF_PALETTE.err, // red-400
  idle:      WF_PALETTE.warn,
  completed: WF_PALETTE.ok,
  inactive:  WF_PALETTE.idle,
};

/** Small lowercase word rendered under the agent name. */
export const STATE_WORD: Record<VisualState, string> = {
  launching: 'booting',
  ready:     'ready',
  busy:      'working',
  thinking:  'thinking',
  attention: 'attention',
  error:     'error',
  idle:      'idle',
  completed: 'done',
  inactive:  'offline',
};

/** When busy, the activity refines the status word. */
export const ACTIVITY_WORD: Record<ActivityKind, string | null> = {
  coding:   'coding',
  research: 'searching',
  terminal: 'shell',
  thinking: 'thinking',
  waiting:  'waiting',
  working:  'working',
  none:     null,
};

/** Prefix char rendered at the head of the desk activity strip. */
export const ACTIVITY_PREFIX: Record<ActivityKind, string> = {
  coding:   '*',
  research: '?',
  terminal: '$',
  thinking: '·',
  waiting:  '‖',
  working:  '>',
  none:     ' ',
};

export function stateWord(state: VisualState, activity: ActivityKind): string {
  if (state === 'busy') return ACTIVITY_WORD[activity] ?? STATE_WORD.busy;
  if (state === 'attention' && activity === 'waiting') return 'needs input';
  return STATE_WORD[state];
}

/**
 * Deterministic per-session identity (spec §16). Pure function of the
 * sessionId — never re-rolled between renders. Drives small organic
 * variations: blink/breathe/look offsets, typing tempo, desk nudge.
 */
export interface AgentIdentity {
  blinkDelay: string;   // head-cursor blink phase offset
  breatheDelay: string; // idle breathing offset
  lookDelay: string;    // occasional "look around" offset
  tempo: string;        // typing arm tempo (s)
  nudgeX: number;       // ±2px desk placement variance
  barDelay: string;     // activity strip phase offset
}

function hashString(input: string): number {
  // small FNV-1a — stable across runs, no crypto needed
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function identityFor(sessionId: string, agent: string): AgentIdentity {
  const h = hashString(`${sessionId}:${agent}`);
  return {
    blinkDelay: `-${((h % 997) / 1000).toFixed(3)}s`,
    breatheDelay: `-${(((h >> 5) % 4500) / 1000).toFixed(3)}s`,
    lookDelay: `-${(((h >> 9) % 9000) / 1000).toFixed(3)}s`,
    tempo: `${(0.1 + ((h >> 13) % 5) * 0.012).toFixed(3)}s`,
    nudgeX: ((h >> 17) % 5) - 2,
    barDelay: `-${((h >> 21) % 1100) / 1000}s`,
  };
}
