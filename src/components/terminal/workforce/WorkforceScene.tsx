/**
 * WorkforceScene.tsx — the little terminal-themed workplace.
 *
 * Owns: stage measurement, workstation pixel math, spawn/walk/exit
 * transitions (framer-motion, transform + opacity only), floor lines per
 * layout tier, the in-scene task line, empty-floor ghosts, header summary,
 * and pausing all CSS loops when the scene is not meaningfully visible
 * (tab hidden or scrolled out of view).
 *
 * It receives fully prepared VisualAgent[] + the active Tier — no data
 * access here.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AgentCharacter from './AgentCharacter';
import { visualForAgent } from './agentVisuals';
import {
  DENSITY_SCALE,
  SCENE_HEIGHT,
  SPAWN_POINT,
  type SceneDensity,
  type Tier,
} from './workforceLayout';
import type { VisualAgent } from './workforceTypes';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** 150 / 250 / 400ms motion philosophy */
const T_ENTER = 0.4;
const T_EXIT = 0.25;
const T_FADE = 0.15;

export interface WorkforceSceneProps {
  agents: Array<VisualAgent & { station: number }>;
  tier: Tier;
  hiddenCount: number;
  activeCount: number;
  density?: SceneDensity;
  /** force reduced-motion styling (otherwise the OS media query is used) */
  reducedMotion?: boolean;
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  className?: string;
  title?: ReactNode;
}

interface StageSize {
  w: number;
  h: number;
}

/** One worker slot: absolute-positioned, animated between fixed points. */
function WorkerSlot({
  agent,
  x,
  y,
  spawnX,
  spawnY,
  scale,
  z,
  reduced,
  tipBelow,
  tipAlign,
  labelMode,
  selected,
  onSelect,
}: {
  agent: VisualAgent;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  scale: number;
  z: number;
  reduced: boolean;
  tipBelow: boolean;
  tipAlign: 'start' | 'center' | 'end';
  labelMode: 'full' | 'short';
  selected: boolean;
  onSelect?: (sessionId: string) => void;
}) {
  const [walking, setWalking] = useState(!reduced);
  const prevTarget = useRef<{ x: number; y: number }>({ x, y });

  // a seat change (rare — tier change or overflow reshuffle) triggers a walk
  useEffect(() => {
    if (prevTarget.current.x !== x || prevTarget.current.y !== y) {
      prevTarget.current = { x, y };
      if (!reduced) setWalking(true);
    }
  }, [x, y, reduced]);

  const move = reduced ? { duration: 0 } : { duration: T_ENTER, ease: EASE_OUT };

  return (
    <motion.div
      className="wf-slot"
      style={{ zIndex: z } as CSSProperties}
      initial={{ x: spawnX, y: spawnY, opacity: 0 }}
      animate={{ x, y, opacity: 1 }}
      exit={{ opacity: 0, y: y + 14, transition: { duration: T_EXIT, ease: EASE_OUT } }}
      transition={{ default: move, opacity: { duration: reduced ? 0 : T_FADE } }}
      onAnimationComplete={() => setWalking(false)}
    >
      <div className="wf-anchor">
        <AgentCharacter
          agent={agent}
          scale={scale}
          walking={walking}
          tipBelow={tipBelow}
          tipAlign={tipAlign}
          labelMode={labelMode}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </motion.div>
  );
}

export function WorkforceScene({
  agents,
  tier,
  hiddenCount,
  activeCount,
  density = 'compact',
  reducedMotion = false,
  selectedSessionId = null,
  onSelectSession,
  className,
  title,
}: WorkforceSceneProps) {
  const mediaReduced = useReducedMotion();
  const reduced = reducedMotion || !!mediaReduced;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<StageSize | null>(null);
  const [paused, setPaused] = useState(false);

  // measure the stage so station percentages become pixels (event-driven, not polled)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, []);

  // pause all CSS loops when the tab is hidden or the scene is off-screen
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && stageRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          setPaused(document.hidden ? true : !visible);
        },
        { threshold: 0.05 },
      );
      io.observe(stageRef.current);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) io.disconnect();
    };
  }, []);

  const sizeReady = size !== null;
  const w = size?.w ?? 260;
  const h = size?.h ?? SCENE_HEIGHT[density] - 27;
  const densityScale = DENSITY_SCALE[density];
  const px = (pctX: number, pctY: number) => ({
    x: (pctX / 100) * w,
    y: (pctY / 100) * h,
  });
  const spawn = px(SPAWN_POINT.x, SPAWN_POINT.y);
  const lastRowY = tier.rows[tier.rows.length - 1];

  const empty = agents.length === 0 && hiddenCount === 0;

  // in-scene task line: attention first (somebody needs you), else the
  // selected worker's task. Event-driven — never loops on its own.
  const attentionAgent = agents.find((a) => a.state === 'attention');
  const selectedAgent = agents.find((a) => a.sessionId === selectedSessionId);
  const taskAgent = attentionAgent ?? (selectedAgent?.topic ? selectedAgent : null);
  const taskChip = taskAgent
    ? {
        mark: attentionAgent ? '!' : '▸',
        color: attentionAgent ? '#fbbf24' : visualForAgent(taskAgent.agent, taskAgent.known).accent,
        name:
          tier.labelMode === 'full'
            ? visualForAgent(taskAgent.agent, taskAgent.known).label
            : visualForAgent(taskAgent.agent, taskAgent.known).abbr,
        tag: taskAgent.tag,
        multi: taskAgent.multi,
        text: taskAgent.topic ?? (attentionAgent ? 'needs input' : ''),
      }
    : null;

  // header summary — honest counts only
  let summary: { text: string; attr: Record<string, string> };
  if (agents.length === 0) {
    summary = { text: 'STANDBY', attr: {} };
  } else if (activeCount > 0) {
    summary = {
      text: `${activeCount} ACTIVE`,
      attr: { 'data-active': '1' },
    };
  } else {
    const allOffline = agents.every((a) => a.state === 'inactive');
    const booting = agents.some((a) => a.state === 'launching');
    summary = {
      text: allOffline ? 'OFFLINE' : booting ? 'BOOT' : 'IDLE',
      attr: { 'data-idle': '1' },
    };
  }

  return (
    <div
      className={`wf-scene${className ? ` ${className}` : ''}`}
      data-density={density}
      data-tier={tier.id}
      data-reduced={reduced ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      style={{ height: SCENE_HEIGHT[density] }}
      aria-label="Agent workforce — ambient status of AI agent sessions"
    >
      <div className="wf-head">
        <span className="wf-title">
          {title ?? (
            <>
              RHEO <i>//</i> WORKFORCE
            </>
          )}
        </span>
        <span className="wf-summary" {...summary.attr}>
          {activeCount > 0 && <span className="wf-sum-dot" aria-hidden="true" />}
          {summary.text}
          {hiddenCount > 0 && (
            <span className="wf-overflow-chip">+{hiddenCount}</span>
          )}
        </span>
      </div>

      {taskChip && taskChip.text && (
        <div
          className="wf-taskchip"
          style={{ '--wf-taskcolor': taskChip.color } as CSSProperties}
        >
          <span className="wf-task-mark">{taskChip.mark}</span>
          <span className="wf-task-text">
            {taskChip.name}
            {taskChip.multi ? `·${taskChip.tag}` : ''} {taskChip.text}
          </span>
        </div>
      )}

      <div className="wf-stage" ref={stageRef}>
        {tier.rows.map((rowY) => (
          <div
            key={rowY}
            className="wf-floor"
            style={{ top: `${rowY}%` }}
            aria-hidden="true"
          />
        ))}

        {empty && (
          <div className="wf-empty" aria-hidden="true">
            <div
              className="wf-ghost"
              style={{
                left: '31%',
                top: `${lastRowY}%`,
                transform: 'translate(-50%,-100%) scale(0.8)',
              }}
            />
            <div
              className="wf-ghost"
              style={{
                left: '69%',
                top: `${lastRowY}%`,
                transform: 'translate(-50%,-100%) scale(0.8)',
              }}
            />
            <span>// awaiting agents</span>
          </div>
        )}

        <AnimatePresence>
          {sizeReady &&
            agents.map((agent) => {
              const st = tier.seats[agent.station];
              if (!st) return null;
              const scale = tier.scale * (st.s ?? 1) * densityScale;
              const target = px(st.x, st.y);
              // keep the whole desk inside the stage even in narrow sidebars
              const halfWidth = 31 * scale;
              const x = Math.min(
                Math.max(target.x, halfWidth),
                Math.max(w - halfWidth, halfWidth),
              );
              return (
                <WorkerSlot
                  key={agent.key}
                  agent={agent}
                  x={x}
                  y={target.y}
                  spawnX={spawn.x}
                  spawnY={spawn.y}
                  scale={scale}
                  z={st.z * 10 + agent.station}
                  reduced={reduced}
                  tipBelow={st.y < lastRowY - 3}
                  tipAlign={st.x < 28 ? 'start' : st.x > 72 ? 'end' : 'center'}
                  labelMode={tier.labelMode}
                  selected={selectedSessionId === agent.sessionId}
                  onSelect={onSelectSession}
                />
              );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default WorkforceScene;
