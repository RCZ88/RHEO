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

export const AGENT_VISUALS: Record<KnownAgentId, AgentVisualConfig> = {
  opencode: { glyph: '>_',  accent: '#22d3ee', label: 'OPENCODE', abbr: 'OC' },
  claude:   { glyph: '◉_',  accent: '#a78bfa', label: 'CLAUDE',   abbr: 'CL' },
  codex:    { glyph: '</>', accent: '#34d399', label: 'CODEX',    abbr: 'CX' },
  gemini:   { glyph: '✦',   accent: '#818cf8', label: 'GEMINI',   abbr: 'GM' },
  aider:    { glyph: '#_',  accent: '#fbbf24', label: 'AIDER',    abbr: 'AI' },
};

export const UNKNOWN_VISUAL: AgentVisualConfig = {
  glyph: '?_',
  accent: '#a1a1aa', // zinc-400
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
  launching: '#52525b', // zinc-600
  ready:     '#22d3ee', // cyan-400
  busy:      '#34d399', // emerald-400
  thinking:  '#34d399',
  attention: '#fbbf24', // amber-400
  error:     '#f87171', // red-400
  idle:      '#fbbf24',
  completed: '#34d399',
  inactive:  '#52525b',
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
