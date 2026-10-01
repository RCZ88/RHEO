/**
 * AgentCharacter.tsx — one reusable terminal-native worker.
 *
 * Every agent type and every instance renders through this single component.
 * Identity comes from agentVisuals (glyph + accent + abbr) plus a stable
 * per-type instance tag (OPENCODE·3) so fleets of the same tool stay
 * tellable apart. State behavior lives in workforce.css classes — this
 * component only maps state → classes/colors and small one-shot reactions.
 *
 * Anatomy (front view, "someone sits here and works"):
 *   head-CRT (glyph + cursor) on a posture wrapper (leans in when busy)
 *   → neck → chair back behind torso → torso(+scarf) with arms reaching
 *   down to a keyboard on the desk, hands alternating while typing
 *   → desk slab + activity strip apron + legs → label.
 *
 * framer-motion is used solely for the badge pop (event-driven transition).
 * All continuous loops (blink / typing / breathing / flicker) are CSS.
 */

import { memo } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACTIVITY_PREFIX,
  ERROR_GLYPH,
  STATE_DOT,
  identityFor,
  stateWord,
  visualForAgent,
} from './agentVisuals';
import type { VisualAgent } from './workforceTypes';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface AgentCharacterProps {
  agent: VisualAgent;
  /** tier scale × station depth scale × density scale */
  scale: number;
  walking: boolean;
  /** back-row workers flip their tooltip below so the frame never clips it */
  tipBelow: boolean;
  /** edge workers align the tooltip inward so it stays inside the frame */
  tipAlign: 'start' | 'center' | 'end';
  /** roomy floors show full names; dense/swarm show OC·3 style tags */
  labelMode: 'full' | 'short';
  selected: boolean;
  onSelect?: (sessionId: string) => void;
}

function badgeFor(state: VisualAgent['state']): { char: string; color: string } | null {
  switch (state) {
    case 'attention': return { char: '!', color: '#fbbf24' }; // amber-400
    case 'error':     return { char: '×', color: '#f87171' }; // red-400
    case 'completed': return { char: '✓', color: '#34d399' }; // emerald-400
    default:          return null;
  }
}

function AgentCharacterBase({
  agent,
  scale,
  walking,
  tipBelow,
  tipAlign,
  labelMode,
  selected,
  onSelect,
}: AgentCharacterProps) {
  const visual = visualForAgent(agent.agent, agent.known);
  const identity = identityFor(agent.sessionId, agent.agent);
  const badge = badgeFor(agent.state);
  const word = stateWord(agent.state, agent.activity);
  const glyph = agent.state === 'error' ? ERROR_GLYPH : visual.glyph;

  const nameFull = agent.multi ? `${visual.label}·${agent.tag}` : visual.label;
  const nameShort = agent.multi ? `${visual.abbr}·${agent.tag}` : visual.abbr;
  const name = labelMode === 'full' ? nameFull : nameShort;

  const unitVars = {
    '--wf-accent': visual.accent,
    '--wf-dotcolor': STATE_DOT[agent.state],
    '--wf-blink': identity.blinkDelay,
    '--wf-breathe': identity.breatheDelay,
    '--wf-look': identity.lookDelay,
    '--wf-tempo': identity.tempo,
    '--wf-bardelay': identity.barDelay,
    // deterministic per-session placement variance (never re-rolled)
    transform: `translateX(${identity.nudgeX}px) scale(${scale})`,
  } as CSSProperties;

  const ariaLabel =
    `${nameFull} agent session, ${word}.` +
    (agent.topic ? ` ${agent.topic}.` : '') +
    (onSelect ? ' Activate to focus its terminal.' : '');

  return (
    <div
      className={`wf-unit wf-state-${agent.state}${walking ? ' wf-walking' : ''}${selected ? ' wf-selected' : ''}`}
      style={unitVars}
      data-session-id={agent.sessionId}
    >
      <div className="wf-unit-inner">
        <div className="wf-figure">
          {/* head — tiny CRT whose screen is the agent's prompt glyph.
              The wrapper carries posture (lean-in / look-up / recoil). */}
          <div className="wf-head-wrap">
            <div className="wf-headbox">
              <span className="wf-glyph">{glyph}</span>
              <span className="wf-cursor" aria-hidden="true" />
              <span className="wf-dots" aria-hidden="true">
                <i>·</i><i>·</i><i>·</i>
              </span>
              <AnimatePresence>
                {badge && (
                  <motion.span
                    key={badge.char}
                    className="wf-badge"
                    style={{ '--wf-badgecolor': badge.color } as CSSProperties}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    aria-hidden="true"
                  >
                    {badge.char}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="wf-neck" />

          {/* chair back + torso + arms reaching the keyboard */}
          <div className="wf-body">
            <div className="wf-chair" aria-hidden="true" />
            <div className="wf-arm wf-arm-l" aria-hidden="true" />
            <div className="wf-torso">
              <div className="wf-scarf" aria-hidden="true" />
            </div>
            <div className="wf-arm wf-arm-r" aria-hidden="true" />
          </div>

          {/* desk: keyboard + hands, slab, activity strip, legs */}
          <div className="wf-desk">
            <div className="wf-kbd" aria-hidden="true">
              <i className="wf-hand wf-hand-l" />
              <i className="wf-hand wf-hand-r" />
            </div>
            <div className="wf-slab" />
            <div className="wf-apron">
              <div className="wf-strip" aria-hidden="true">
                <span className="wf-prefix">
                  {agent.state === 'error' ? '×' : ACTIVITY_PREFIX[agent.activity]}
                </span>
                <span className="wf-bars">
                  <i /><i /><i />
                </span>
              </div>
            </div>
            <div className="wf-legs" aria-hidden="true">
              <i /><i />
            </div>
          </div>
        </div>

        {/* label */}
        <div className="wf-label">
          <div className="wf-name-row">
            <span
              className="wf-name"
              style={selected ? { color: visual.accent } : undefined}
            >
              {name}
            </span>
            <span className="wf-dot" aria-hidden="true" />
          </div>
          <span className="wf-word">{word}</span>
        </div>
      </div>

      {/* interaction: only this layer takes pointer events */}
      {onSelect ? (
        <button
          type="button"
          className="wf-hit"
          aria-label={ariaLabel}
          onClick={() => onSelect(agent.sessionId)}
        />
      ) : (
        <div className="wf-hit" aria-hidden="true" />
      )}

      <div
        className={[
          'wf-tip',
          tipBelow ? 'wf-tip-below' : '',
          tipAlign === 'start' ? 'wf-tip-start' : tipAlign === 'end' ? 'wf-tip-end' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="tooltip"
        aria-hidden="true"
      >
        <div className="wf-tip-head">
          {nameFull} <em>// {word.toUpperCase()}</em>
        </div>
        {agent.topic && <div className="wf-tip-topic">{agent.topic}</div>}
        <div className="wf-tip-meta">
          {agent.known ? agent.agent : `unknown agent “${agent.agent}”`}
          {' · '}id {agent.sessionId.slice(0, 6)}
        </div>
      </div>
    </div>
  );
}

export const AgentCharacter = memo(AgentCharacterBase);
export default AgentCharacter;
