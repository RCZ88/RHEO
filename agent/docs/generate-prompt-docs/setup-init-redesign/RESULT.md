# Setup vs Initialize — Complete Implementation

## File 1: `src/components/InitializeProgressModal.tsx`

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderTree, FileText, Check, X, AlertCircle,
  Loader2, RotateCcw, XCircle,
} from 'lucide-react';

// ─── Step Definitions ──────────────────────────────────────

interface InitStep {
  id: string;
  label: string;
  type: 'folder' | 'file';
  status: 'pending' | 'creating' | 'done' | 'error';
}

const STEP_DEFS: Omit<InitStep, 'status'>[] = [
  { id: 'agent-dir', label: 'agent/ directory', type: 'folder' },
  { id: 'agents-md', label: 'AGENTS.md', type: 'file' },
  { id: 'initialize-md', label: 'INITIALIZE.md', type: 'file' },
  { id: 'problems-md', label: 'PROBLEMS.md', type: 'file' },
  { id: 'requests-md', label: 'REQUESTS.md', type: 'file' },
  { id: 'state-md', label: 'state.md', type: 'file' },
  { id: 'problems-json', label: 'problems.json', type: 'file' },
  { id: 'requests-json', label: 'requests.json', type: 'file' },
  { id: 'checklists-json', label: 'checklists.json', type: 'file' },
  { id: 'commits-md', label: 'COMMITS.md', type: 'file' },
  { id: 'feature-tracker', label: 'FEATURE_TRACKER.md', type: 'file' },
  { id: 'workspace-context', label: 'WORKSPACE_CONTEXT.md', type: 'file' },
  { id: 'human-test', label: 'HUMAN_TEST_CHECKLIST.md', type: 'file' },
  { id: 'skills-dir', label: 'agent/skills/ directory', type: 'folder' },
  { id: 'skill-templates', label: 'Skill templates', type: 'file' },
  { id: 'graphify-dir', label: 'graphify-out/ directory', type: 'folder' },
];

const freshSteps = (): InitStep[] =>
  STEP_DEFS.map((s) => ({ ...s, status: 'pending' as const }));

// ─── Props ─────────────────────────────────────────────────

interface InitializeProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  projectId?: string;
  isReinit?: boolean;
}

// ─── Component ─────────────────────────────────────────────

export default function InitializeProgressModal({
  isOpen,
  onClose,
  onComplete,
  projectId,
  isReinit = false,
}: InitializeProgressModalProps) {
  const [steps, setSteps] = useState<InitStep[]>(freshSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const cancelledRef = useRef(false);

  // ── Run initialization ─────────────────────────────────

  const runInit = useCallback(() => {
    cancelledRef.current = false;
    setSteps(freshSteps());
    setIsRunning(true);
    setIsComplete(false);
    setHasError(false);
    setErrorMessage('');

    // Mark the first step as creating immediately
    setSteps((prev) => {
      const u = [...prev];
      if (u[0]) u[0] = { ...u[0], status: 'creating' };
      return u;
    });

    // Simulated step-by-step progress (real IPC doesn't stream per-step)
    let simIdx = 0;
    let simTimer: ReturnType<typeof setTimeout> | null = null;

    const simTick = () => {
      if (cancelledRef.current) return;

      setSteps((prev) => {
        const u = [...prev];
        const creatingIdx = u.findIndex((s) => s.status === 'creating');
        if (creatingIdx >= 0) u[creatingIdx] = { ...u[creatingIdx], status: 'done' };
        const nextPending = u.findIndex((s) => s.status === 'pending');
        if (nextPending >= 0) u[nextPending] = { ...u[nextPending], status: 'creating' };
        return u;
      });

      simIdx++;
      if (simIdx < STEP_DEFS.length) {
        simTimer = setTimeout(simTick, 220 + Math.random() * 200);
      }
    };

    simTimer = setTimeout(simTick, 350);

    // Actual IPC call — runs in parallel with simulation
    const api = (window as any).deskflowAPI;
    const agent = localStorage.getItem('terminal-defaultAgent') || 'claude';

    api
      ?.trackerMindSetup?.('init-all', projectId || undefined, agent)
      .then((result: any) => {
        if (cancelledRef.current) return;
        if (simTimer) clearTimeout(simTimer);

        if (result?.success) {
          setSteps((prev) =>
            prev.map((s) => ({
              ...s,
              status:
                s.status === 'creating' || s.status === 'pending'
                  ? ('done' as const)
                  : s.status,
            }))
          );
          setIsComplete(true);
          onComplete?.();
        } else {
          setSteps((prev) =>
            prev.map((s) => ({
              ...s,
              status: s.status === 'creating' ? ('error' as const) : s.status,
            }))
          );
          setHasError(true);
          setErrorMessage(result?.error || 'Infrastructure setup failed');
        }
      })
      .catch((e: any) => {
        if (cancelledRef.current) return;
        if (simTimer) clearTimeout(simTimer);
        setSteps((prev) =>
          prev.map((s) => ({
            ...s,
            status: s.status === 'creating' ? ('error' as const) : s.status,
          }))
        );
        setHasError(true);
        setErrorMessage(e?.message || 'Failed to initialize workspace');
      })
      .finally(() => {
        if (!cancelledRef.current) setIsRunning(false);
      });
  }, [projectId, onComplete]);

  // ── Auto-start on open ─────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(runInit, 400);
      return () => {
        clearTimeout(t);
        cancelledRef.current = true;
      };
    } else {
      cancelledRef.current = true;
    }
  }, [isOpen, runInit]);

  // ── Derived ────────────────────────────────────────────

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  // ── Render ─────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-zinc-800 rounded-xl p-6 border border-zinc-700 shadow-2xl w-full max-w-md"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                hasError
                  ? 'bg-red-500/10'
                  : isComplete
                  ? 'bg-emerald-500/10'
                  : 'bg-green-500/10'
              }`}
            >
              {hasError ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : isComplete ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <FolderTree className="w-4 h-4 text-green-400" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {hasError
                  ? 'Initialization Failed'
                  : isComplete
                  ? 'Initialization Complete'
                  : isReinit
                  ? 'Re-initializing Workspace'
                  : 'Initializing Workspace'}
              </h2>
              <p className="text-[10px] text-zinc-500">
                {hasError
                  ? 'Some steps failed'
                  : isComplete
                  ? `${doneCount} of ${totalCount} files created`
                  : `${doneCount}/${totalCount} steps`}
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Progress Bar ── */}
        <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden mb-4">
          <motion.div
            className={`h-full rounded-full transition-colors duration-300 ${
              hasError
                ? 'bg-red-500'
                : isComplete
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        {/* ── Steps List ── */}
        <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1 mb-4 scrollbar-thin">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.15 }}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-colors ${
                step.status === 'creating'
                  ? 'bg-green-500/5'
                  : step.status === 'done'
                  ? 'bg-emerald-500/5'
                  : step.status === 'error'
                  ? 'bg-red-500/5'
                  : ''
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {step.status === 'pending' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                )}
                {step.status === 'creating' && (
                  <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin" />
                )}
                {step.status === 'done' && (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {step.status === 'error' && (
                  <X className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>

              {step.type === 'folder' ? (
                <FolderTree className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              )}

              <span
                className={`truncate flex-1 ${
                  step.status === 'pending'
                    ? 'text-zinc-600'
                    : step.status === 'creating'
                    ? 'text-green-300'
                    : step.status === 'done'
                    ? 'text-zinc-400'
                    : 'text-red-400'
                }`}
              >
                {step.label}
              </span>

              {step.status === 'creating' && (
                <span className="text-[9px] text-green-500 flex-shrink-0">creating…</span>
              )}
              {step.status === 'done' && (
                <span className="text-[9px] text-emerald-600 flex-shrink-0">done</span>
              )}
              {step.status === 'error' && (
                <span className="text-[9px] text-red-500 flex-shrink-0">failed</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── Error Message ── */}
        <AnimatePresence>
          {hasError && errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{errorMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Success Summary ── */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    Workspace Ready
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  {doneCount} files created. Configure context systems via
                  Setup, or start a new agent session.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2">
          {hasError && (
            <button
              onClick={runInit}
              className="px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600/50 text-xs text-zinc-300 hover:bg-zinc-600/50 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isRunning}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${
              isComplete
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : hasError
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-green-700 hover:bg-green-600'
            }`}
          >
            {isRunning ? 'Initializing…' : isComplete ? 'Done' : 'Close'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

---

## File 2: `src/components/WorkspaceSettingsDialog.tsx`

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2, X, BookOpen, Sparkles, Network, FolderTree,
  FileCode, Zap, Palette, RotateCcw, Save, ChevronDown,
  ChevronUp, Info, Check,
} from 'lucide-react';

// ─── System Card Definitions ───────────────────────────────

interface SystemCardDef {
  key: string;
  name: string;
  desc: string;
  icon: any;
  colorBg: string;
  colorText: string;
  defaultTokens: number;
}

const SYSTEM_CARDS: SystemCardDef[] = [
  {
    key: 'llm_wiki',
    name: 'LLM Wiki',
    desc: 'Agent workspace files (state.md, context.md, patterns.md)',
    icon: BookOpen,
    colorBg: 'bg-emerald-500/10',
    colorText: 'text-emerald-400',
    defaultTokens: 800,
  },
  {
    key: 'obsidian_skills',
    name: 'Skills',
    desc: 'SKILL.md frontmatter from agent/skills/',
    icon: Sparkles,
    colorBg: 'bg-purple-500/10',
    colorText: 'text-purple-400',
    defaultTokens: 400,
  },
  {
    key: 'graphify',
    name: 'Graphify',
    desc: 'Knowledge graph communities from graphify-out/',
    icon: Network,
    colorBg: 'bg-blue-500/10',
    colorText: 'text-blue-400',
    defaultTokens: 400,
  },
  {
    key: 'para',
    name: 'PARA',
    desc: 'Projects, Areas, Resources, Archives',
    icon: FolderTree,
    colorBg: 'bg-amber-500/10',
    colorText: 'text-amber-400',
    defaultTokens: 400,
  },
  {
    key: 'qmd_templates',
    name: 'QMD Templates',
    desc: 'Quick markup templates from agent/templates/',
    icon: FileCode,
    colorBg: 'bg-cyan-500/10',
    colorText: 'text-cyan-400',
    defaultTokens: 400,
  },
  {
    key: 'automations',
    name: 'Automations',
    desc: 'Automation rules from agent/automations/',
    icon: Zap,
    colorBg: 'bg-orange-500/10',
    colorText: 'text-orange-400',
    defaultTokens: 300,
  },
  {
    key: 'design_skills',
    name: 'Design Skills',
    desc: 'Frontend design intelligence, taste knobs, references',
    icon: Palette,
    colorBg: 'bg-pink-500/10',
    colorText: 'text-pink-400',
    defaultTokens: 800,
  },
];

// ─── Config Shape ──────────────────────────────────────────

interface SystemConfig {
  enabled: boolean;
  max_tokens: number;
}

interface DesignLevels {
  design_variance: number;
  motion_intensity: number;
  visual_density: number;
}

interface DesignSkillsConfig extends SystemConfig {
  skills: string[];
  levels: DesignLevels;
  include_references: boolean;
}

interface WorkspaceConfig {
  systems: Record<string, SystemConfig | DesignSkillsConfig>;
  behaviors: {
    summarization: boolean;
    deep_memory: boolean;
  };
}

// ─── Defaults ──────────────────────────────────────────────

const DEFAULT_CONFIG: WorkspaceConfig = {
  systems: {
    llm_wiki: { enabled: true, max_tokens: 800 },
    obsidian_skills: { enabled: true, max_tokens: 400 },
    graphify: { enabled: true, max_tokens: 400 },
    para: { enabled: true, max_tokens: 400 },
    qmd_templates: { enabled: true, max_tokens: 400 },
    automations: { enabled: true, max_tokens: 300 },
    design_skills: {
      enabled: true,
      max_tokens: 800,
      skills: [
        'frontend-design',
        'impeccable',
        'ui-ux-pro-max',
        'taste-skill',
        'design-taste',
      ],
      levels: { design_variance: 5, motion_intensity: 5, visual_density: 7 },
      include_references: true,
    },
  },
  behaviors: { summarization: true, deep_memory: false },
};

export const WORKSPACE_CONFIG_PREF_KEY = 'workspace-context-config';

export { DEFAULT_CONFIG };
export type { WorkspaceConfig, SystemConfig, DesignSkillsConfig, DesignLevels };

const DESIGN_SKILL_OPTIONS = [
  { id: 'frontend-design', label: 'Frontend Design' },
  { id: 'impeccable', label: 'Impeccable' },
  { id: 'ui-ux-pro-max', label: 'UI UX Pro Max' },
  { id: 'taste-skill', label: 'Taste Skill' },
  { id: 'design-taste', label: 'Design Taste (master)' },
];

const KNOB_LABELS: Record<
  keyof DesignLevels,
  { low: string; high: string; name: string }
> = {
  design_variance: {
    low: 'Conservative',
    high: 'Experimental',
    name: 'Design Variance',
  },
  motion_intensity: {
    low: 'Static',
    high: 'Cinematic',
    name: 'Motion Intensity',
  },
  visual_density: { low: 'Airy', high: 'Maximal', name: 'Visual Density' },
};

// ─── Deep merge ────────────────────────────────────────────

function deepMerge(
  base: WorkspaceConfig,
  override: Partial<WorkspaceConfig>
): WorkspaceConfig {
  const result = JSON.parse(JSON.stringify(base)) as WorkspaceConfig;
  if (override.systems) {
    for (const [key, val] of Object.entries(override.systems)) {
      if (result.systems[key]) {
        result.systems[key] = { ...result.systems[key], ...val };
      } else {
        result.systems[key] = val;
      }
    }
  }
  if (override.behaviors) {
    result.behaviors = { ...result.behaviors, ...override.behaviors };
  }
  return result;
}

// ─── Toggle ────────────────────────────────────────────────

function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-8 h-4 rounded-full transition-colors duration-200 flex items-center ${
        on ? 'bg-emerald-600' : 'bg-zinc-700'
      }`}
    >
      <div
        className="w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

// ─── Knob Slider ───────────────────────────────────────────

function KnobSlider({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs font-mono text-zinc-300 w-5 text-right">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-amber-400
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(245,158,11,0.4)]
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-zinc-600">{lowLabel}</span>
        <span className="text-[9px] text-zinc-600">{highLabel}</span>
      </div>
    </div>
  );
}

// ─── Context Map SVG ───────────────────────────────────────

function ContextMapSVG({ config }: { config: WorkspaceConfig }) {
  const nodePositions = [
    { x: 15, y: 8 },
    { x: 120, y: 5 },
    { x: 230, y: 8 },
    { x: 15, y: 50 },
    { x: 230, y: 50 },
    { x: 15, y: 82 },
    { x: 120, y: 82 },
  ];

  return (
    <svg viewBox="0 0 320 100" className="w-full" style={{ maxHeight: 100 }}>
      {/* Central assembly node */}
      <rect
        x="120"
        y="35"
        width="80"
        height="30"
        rx="6"
        fill="rgba(245,158,11,0.15)"
        stroke="rgba(245,158,11,0.4)"
        strokeWidth="1"
      />
      <text
        x="160"
        y="54"
        textAnchor="middle"
        fill="#fbbf24"
        fontSize="8"
        fontWeight="600"
      >
        ASSEMBLE
      </text>

      {SYSTEM_CARDS.map((card, i) => {
        const sys = config.systems[card.key];
        const active = sys?.enabled ?? false;
        const pos = nodePositions[i] || { x: 230, y: 82 };
        const fill = active
          ? 'rgba(52,211,153,0.1)'
          : 'rgba(39,39,42,0.5)';
        const stroke = active
          ? 'rgba(52,211,153,0.3)'
          : 'rgba(63,63,70,0.3)';
        const textColor = active ? '#a1a1aa' : '#52525b';
        const w = card.key === 'design_skills' ? 70 : 55;

        return (
          <g key={card.key}>
            {active && (
              <line
                x1={pos.x + w / 2}
                y1={pos.y + 10}
                x2={160}
                y2={50}
                stroke="rgba(52,211,153,0.12)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            )}
            <rect
              x={pos.x}
              y={pos.y}
              width={w}
              height="20"
              rx="4"
              fill={fill}
              stroke={stroke}
              strokeWidth="1"
            />
            <text
              x={pos.x + w / 2}
              y={pos.y + 13}
              textAnchor="middle"
              fill={textColor}
              fontSize="7"
            >
              {card.name.length > 10
                ? card.name.slice(0, 9) + '…'
                : card.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Props ─────────────────────────────────────────────────

interface WorkspaceSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectPath?: string;
}

// ─── Component ─────────────────────────────────────────────

export default function WorkspaceSettingsDialog({
  isOpen,
  onClose,
  projectId,
  projectPath,
}: WorkspaceSettingsDialogProps) {
  const [config, setConfig] = useState<WorkspaceConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<WorkspaceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [designExpanded, setDesignExpanded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const api = (window as any).deskflowAPI;

  // ── Load preferences on open ───────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const prefs = await api?.getPreferences?.();
        if (prefs?.[WORKSPACE_CONFIG_PREF_KEY]) {
          const parsed = JSON.parse(prefs[WORKSPACE_CONFIG_PREF_KEY]);
          const merged = deepMerge(DEFAULT_CONFIG, parsed);
          setConfig(merged);
          setSavedConfig(merged);
        } else {
          setConfig(DEFAULT_CONFIG);
          setSavedConfig(DEFAULT_CONFIG);
        }
      } catch {
        setConfig(DEFAULT_CONFIG);
        setSavedConfig(DEFAULT_CONFIG);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, api]);

  // ── Config updaters ────────────────────────────────────

  const updateSystem = useCallback(
    (key: string, updates: Partial<SystemConfig>) => {
      setConfig((prev) => ({
        ...prev,
        systems: {
          ...prev.systems,
          [key]: { ...prev.systems[key], ...updates },
        },
      }));
    },
    []
  );

  const updateBehavior = useCallback((key: string, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      behaviors: { ...prev.behaviors, [key]: value },
    }));
  }, []);

  const updateDesignLevel = useCallback(
    (key: keyof DesignLevels, value: number) => {
      setConfig((prev) => {
        const ds = prev.systems.design_skills as DesignSkillsConfig;
        return {
          ...prev,
          systems: {
            ...prev.systems,
            design_skills: {
              ...ds,
              levels: { ...ds.levels, [key]: value },
            },
          },
        };
      });
    },
    []
  );

  const updateDesignSkill = useCallback(
    (skillId: string, enabled: boolean) => {
      setConfig((prev) => {
        const ds = prev.systems.design_skills as DesignSkillsConfig;
        const skills = enabled
          ? [...ds.skills.filter((s) => s !== skillId), skillId]
          : ds.skills.filter((s) => s !== skillId);
        return {
          ...prev,
          systems: {
            ...prev.systems,
            design_skills: { ...ds, skills },
          },
        };
      });
    },
    []
  );

  const toggleDesignReferences = useCallback((enabled: boolean) => {
    setConfig((prev) => {
      const ds = prev.systems.design_skills as DesignSkillsConfig;
      return {
        ...prev,
        systems: {
          ...prev.systems,
          design_skills: { ...ds, include_references: enabled },
        },
      };
    });
  }, []);

  // ── Derived ────────────────────────────────────────────

  const hasChanges = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfig),
    [config, savedConfig]
  );

  const totalTokens = useMemo(
    () =>
      Object.values(config.systems).reduce(
        (sum, sys) => sum + (sys.enabled ? sys.max_tokens : 0),
        0
      ),
    [config]
  );

  // ── Save ───────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api?.setPreference?.(
        WORKSPACE_CONFIG_PREF_KEY,
        JSON.stringify(config)
      );
      setSavedConfig(config);
    } catch (e) {
      console.error('[WorkspaceSettings] Save failed:', e);
    } finally {
      setSaving(false);
    }
    onClose();
  }, [config, api, onClose]);

  // ── Reset ──────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setShowResetConfirm(false);
  }, []);

  // ── Render ─────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center justify-between p-5 pb-3 border-b border-zinc-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Workspace Settings
              </h2>
              <p className="text-[10px] text-zinc-500">
                Configure context systems & defaults for new sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-amber-400 rounded-full animate-spin mr-2" />
              <span className="text-xs">Loading settings…</span>
            </div>
          ) : (
            <>
              {/* ── Context Systems ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
                    Context Systems
                  </h3>
                  <span className="text-[10px] text-zinc-600">
                    {totalTokens} tokens active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_CARDS.map((card) => {
                    const sys = config.systems[card.key];
                    const isEnabled = sys?.enabled ?? false;

                    return (
                      <motion.div
                        key={card.key}
                        layout
                        className={`relative rounded-xl p-3 border transition-all duration-200 ${
                          isEnabled
                            ? 'bg-zinc-800/80 border-zinc-600/50'
                            : 'bg-zinc-900/50 border-zinc-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-md ${card.colorBg} flex items-center justify-center flex-shrink-0`}
                            >
                              <card.icon
                                className={`w-3.5 h-3.5 ${card.colorText}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-zinc-200 truncate">
                                {card.name}
                              </div>
                              <div className="text-[9px] text-zinc-600 truncate">
                                {isEnabled ? `${sys.max_tokens} tok` : 'Off'}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={isEnabled}
                            onToggle={() =>
                              updateSystem(card.key, {
                                enabled: !isEnabled,
                              })
                            }
                          />
                        </div>
                        {isEnabled && card.key !== 'design_skills' && (
                          <div className="mt-2">
                            <input
                              type="range"
                              min={100}
                              max={1200}
                              step={50}
                              value={sys.max_tokens}
                              onChange={(e) =>
                                updateSystem(card.key, {
                                  max_tokens: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                                [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                          </div>
                        )}
                        {card.key === 'design_skills' && isEnabled && (
                          <button
                            onClick={() =>
                              setDesignExpanded(!designExpanded)
                            }
                            className="mt-2 text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors"
                          >
                            {designExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                            Design settings
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Design Skills Expanded ── */}
                <AnimatePresence>
                  {designExpanded &&
                    (config.systems.design_skills as DesignSkillsConfig)
                      ?.enabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 p-4 rounded-xl bg-pink-500/5 border border-pink-500/10 space-y-4">
                          {/* Taste Knobs */}
                          <div>
                            <h4 className="text-[10px] font-medium text-pink-400 uppercase tracking-wider mb-3">
                              Taste Knobs
                            </h4>
                            <div className="space-y-3">
                              {(
                                Object.keys(KNOB_LABELS) as (
                                  | keyof DesignLevels
                                )[]
                              ).map((key) => {
                                const ds =
                                  config.systems.design_skills as DesignSkillsConfig;
                                const meta = KNOB_LABELS[key];
                                return (
                                  <KnobSlider
                                    key={key}
                                    label={meta.name}
                                    value={ds.levels[key]}
                                    onChange={(v) =>
                                      updateDesignLevel(key, v)
                                    }
                                    lowLabel={meta.low}
                                    highLabel={meta.high}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* Skill Toggles */}
                          <div>
                            <h4 className="text-[10px] font-medium text-pink-400 uppercase tracking-wider mb-2">
                              Active Skills
                            </h4>
                            <div className="space-y-1.5">
                              {DESIGN_SKILL_OPTIONS.map((skill) => {
                                const ds =
                                  config.systems.design_skills as DesignSkillsConfig;
                                const isActive = ds.skills.includes(
                                  skill.id
                                );
                                return (
                                  <div
                                    key={skill.id}
                                    className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-zinc-800/30"
                                  >
                                    <span className="text-xs text-zinc-400">
                                      {skill.label}
                                    </span>
                                    <Toggle
                                      on={isActive}
                                      onToggle={() =>
                                        updateDesignSkill(
                                          skill.id,
                                          !isActive
                                        )
                                      }
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* References Toggle */}
                          <div className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-zinc-800/30">
                            <div>
                              <span className="text-xs text-zinc-400">
                                Include Design References
                              </span>
                              <p className="text-[9px] text-zinc-600">
                                DESIGN.md files from
                                agent/design-references/
                              </p>
                            </div>
                            <Toggle
                              on={
                                (
                                  config.systems.design_skills as DesignSkillsConfig
                                ).include_references
                              }
                              onToggle={toggleDesignReferences}
                            />
                          </div>

                          {/* Token budget */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-zinc-400">
                                Token Budget
                              </span>
                              <span className="text-xs font-mono text-zinc-300">
                                {
                                  (
                                    config.systems.design_skills as DesignSkillsConfig
                                  ).max_tokens
                                }
                              </span>
                            </div>
                            <input
                              type="range"
                              min={200}
                              max={1200}
                              step={50}
                              value={
                                (
                                  config.systems.design_skills as DesignSkillsConfig
                                ).max_tokens
                              }
                              onChange={(e) =>
                                updateSystem('design_skills', {
                                  max_tokens: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                                [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </section>

              {/* ── Token Budget Summary ── */}
              <section className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400">
                    Total Active Token Budget
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {totalTokens}
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  {SYSTEM_CARDS.map((card) => {
                    const sys = config.systems[card.key];
                    if (!sys?.enabled) return null;
                    const pct = (sys.max_tokens / 3200) * 100;
                    return (
                      <div
                        key={card.key}
                        className={`h-full ${card.colorBg.replace(
                          '/10',
                          '/60'
                        )} transition-all duration-300`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                        title={`${card.name}: ${sys.max_tokens}`}
                      />
                    );
                  })}
                </div>
              </section>

              {/* ── Behaviors ── */}
              <section>
                <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider mb-3">
                  Behaviors
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-zinc-500" />
                      <div>
                        <div className="text-xs text-zinc-300">
                          Auto-summarization
                        </div>
                        <div className="text-[9px] text-zinc-600">
                          Summarize long context before sending
                        </div>
                      </div>
                    </div>
                    <Toggle
                      on={config.behaviors.summarization}
                      onToggle={() =>
                        updateBehavior(
                          'summarization',
                          !config.behaviors.summarization
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-zinc-500" />
                      <div>
                        <div className="text-xs text-zinc-300">
                          Deep Memory
                        </div>
                        <div className="text-[9px] text-zinc-600">
                          Include session summaries & deep memory
                        </div>
                      </div>
                    </div>
                    <Toggle
                      on={config.behaviors.deep_memory}
                      onToggle={() =>
                        updateBehavior(
                          'deep_memory',
                          !config.behaviors.deep_memory
                        )
                      }
                    />
                  </div>
                </div>
              </section>

              {/* ── Context Map ── */}
              <section>
                <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider mb-3">
                  Context Assembly Map
                </h3>
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                  <ContextMapSVG config={config} />
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 flex items-center justify-between p-5 pt-3 border-t border-zinc-700/50">
          <div className="flex items-center gap-2">
            {showResetConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Reset?</span>
                <button
                  onClick={handleReset}
                  className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-0.5 rounded text-[10px] bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset defaults
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600/50 text-xs text-zinc-400 hover:bg-zinc-600/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-xs font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

---

## File 3: Modifications to `src/pages/IDEProjectsPage.tsx`

### Step 1: Add imports

At the top with the other imports, add:

```tsx
import { Settings2, Bot } from 'lucide-react';
import InitializeProgressModal from '../components/InitializeProgressModal';
import WorkspaceSettingsDialog from '../components/WorkspaceSettingsDialog';
```

### Step 2: Add modal state

Find the `provisionStatus` state (around line 185) and add after it:

```tsx
const [showInitModal, setShowInitModal] = useState(false);
const [showSetupModal, setShowSetupModal] = useState(false);
```

### Step 3: Replace the two buttons (lines ~3395–3411)

Replace the entire two-button block with:

```tsx
{/* Initialize — Infrastructure */}
<button
  onClick={() => {
    if (provisionStatus === 'provisioned') {
      if (!window.confirm('This project is already initialized. Re-initialize workspace files?')) return;
    }
    setShowInitModal(true);
  }}
  disabled={provisionStatus === 'provisioning' || !selectedProject}
  className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
  title="Initialize workspace infrastructure (creates agent files, directories)"
>
  <FolderTree className="w-3.5 h-3.5" />
  Initialize
</button>

{/* Setup — Workspace Settings */}
<button
  onClick={() => setShowSetupModal(true)}
  disabled={!selectedProject}
  className="px-2.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs rounded-lg flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
  title="Configure workspace context systems, design skills, and behaviors"
>
  <Settings2 className="w-3.5 h-3.5" />
  Setup
</button>

{/* New Agent — Session */}
<button
  onClick={() => window.dispatchEvent(new CustomEvent('open-new-agent'))}
  disabled={!selectedProject}
  className="px-2 py-1.5 bg-zinc-700/60 hover:bg-zinc-600/60 border border-zinc-600/50 text-zinc-300 text-xs rounded-lg flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
  title="Start a new AI agent session"
>
  <Bot className="w-3.5 h-3.5" />
  New Agent
</button>
```

### Step 4: Add modal rendering

Find a suitable location near the end of the component's return, before the final closing fragment/div, and add:

```tsx
{/* Initialize Progress Modal */}
<InitializeProgressModal
  isOpen={showInitModal}
  onClose={() => {
    setShowInitModal(false);
    if (provisionStatus !== 'provisioned') setProvisionStatus('provisioned');
  }}
  onComplete={() => setProvisionStatus('provisioned')}
  projectId={selectedProject || undefined}
  isReinit={provisionStatus === 'provisioned'}
/>

{/* Workspace Settings Dialog */}
<WorkspaceSettingsDialog
  isOpen={showSetupModal}
  onClose={() => setShowSetupModal(false)}
  projectId={selectedProject || undefined}
  projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path}
/>
```

---

## File 4: Modifications to `src/pages/TerminalPage.tsx`

### Step 1: Add imports

At the top with the other imports, add:

```tsx
import { Settings2 } from 'lucide-react';
import InitializeProgressModal from '../components/InitializeProgressModal';
import WorkspaceSettingsDialog from '../components/WorkspaceSettingsDialog';
```

### Step 2: Add modal state

Find the existing `initStatus` state (around line 1005) and add after it:

```tsx
const [showInitModal, setShowInitModal] = useState(false);
const [showSetupModal, setShowSetupModal] = useState(false);
```

### Step 3: Replace `handleTriggerProvision`

Replace the existing handler (lines ~1005–1026) with:

```tsx
const handleTriggerProvision = () => {
  // Check if already initialized
  if (initStatus === 'init-ok') {
    if (!window.confirm('This project is already initialized. Re-initialize workspace files?')) return;
  }
  setShowInitModal(true);
};

const handleOpenWorkspaceSettings = () => {
  setShowSetupModal(true);
};
```

### Step 4: Add event listener for workspace settings

Find where the `trigger-provision` event listener is registered (likely in a `useEffect` with `window.addEventListener`). Add a new listener for `open-workspace-settings`:

```tsx
useEffect(() => {
  const handleProvision = () => handleTriggerProvision();
  const handleSettings = () => handleOpenWorkspaceSettings();

  window.addEventListener('trigger-provision', handleProvision);
  window.addEventListener('open-workspace-settings', handleSettings);

  return () => {
    window.removeEventListener('trigger-provision', handleProvision);
    window.removeEventListener('open-workspace-settings', handleSettings);
  };
}, [handleTriggerProvision, handleOpenWorkspaceSettings]);
```

Or, if the event listeners are already in a combined useEffect, just add the `open-workspace-settings` handler to it.

### Step 5: Add modal rendering

Find where `NewSessionDialog` is rendered (likely near the end of the component's return), and add the two modals alongside it:

```tsx
{showNewSessionDialog && (
  <NewSessionDialog ... />
)}

{/* Initialize Progress Modal */}
<InitializeProgressModal
  isOpen={showInitModal}
  onClose={() => {
    setShowInitModal(false);
    if (initStatus !== 'init-ok') setInitStatus('init-ok');
  }}
  onComplete={() => setInitStatus('init-ok')}
  projectId={selectedProject || propProjectId || undefined}
  isReinit={initStatus === 'init-ok'}
/>

{/* Workspace Settings Dialog */}
<WorkspaceSettingsDialog
  isOpen={showSetupModal}
  onClose={() => setShowSetupModal(false)}
  projectId={selectedProject || propProjectId || undefined}
  projectPath={propProjectPath}
/>
```

---

## File 5: Modifications to `src/components/NewSessionDialog.tsx`

### Step 1: Add import

At the top, add:

```tsx
import {
  WORKSPACE_CONFIG_PREF_KEY,
  DEFAULT_CONFIG,
} from './WorkspaceSettingsDialog';
import type {
  WorkspaceConfig,
  DesignSkillsConfig,
  DesignLevels,
} from './WorkspaceSettingsDialog';
```

### Step 2: Load workspace settings as defaults

Add a `useEffect` that runs on mount to load workspace settings from preferences and apply them as the initial values for the dialog's context configuration. The exact integration point depends on how NewSessionDialog manages its state — find where `contextConfig` or equivalent state is initialized and add:

```tsx
// Load workspace settings as defaults on mount
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const api = (window as any).deskflowAPI;
      const prefs = await api?.getPreferences?.();
      if (cancelled || !prefs?.[WORKSPACE_CONFIG_PREF_KEY]) return;

      const wsConfig: WorkspaceConfig = JSON.parse(
        prefs[WORKSPACE_CONFIG_PREF_KEY]
      );

      // Apply workspace settings to this dialog's state.
      // Adapt this to match the dialog's actual state structure.
      if (wsConfig.systems) {
        // If the dialog uses a single contextConfig state:
        // setContextConfig(prev => {
        //   const updated = { ...prev };
        //   if (wsConfig.systems.llm_wiki) updated.llmWiki = wsConfig.systems.llm_wiki.enabled;
        //   if (wsConfig.systems.obsidian_skills) updated.obsidianSkills = wsConfig.systems.obsidian_skills.enabled;
        //   if (wsConfig.systems.graphify) updated.graphify = wsConfig.systems.graphify.enabled;
        //   if (wsConfig.systems.para) updated.para = wsConfig.systems.para.enabled;
        //   if (wsConfig.systems.qmd_templates) updated.qmdTemplates = wsConfig.systems.qmd_templates.enabled;
        //   if (wsConfig.systems.automations) updated.automations = wsConfig.systems.automations.enabled;
        //   if (wsConfig.systems.design_skills) {
        //     updated.designSkills = wsConfig.systems.design_skills.enabled;
        //     const ds = wsConfig.systems.design_skills as DesignSkillsConfig;
        //     updated.designVariance = ds.levels.design_variance;
        //     updated.motionIntensity = ds.levels.motion_intensity;
        //     updated.visualDensity = ds.levels.visual_density;
        //   }
        //   return updated;
        // });

        // If the dialog uses individual boolean states:
        if (wsConfig.systems.llm_wiki != null) setLlmWikiEnabled(wsConfig.systems.llm_wiki.enabled);
        if (wsConfig.systems.obsidian_skills != null) setObsidianSkillsEnabled(wsConfig.systems.obsidian_skills.enabled);
        if (wsConfig.systems.graphify != null) setGraphifyEnabled(wsConfig.systems.graphify.enabled);
        if (wsConfig.systems.para != null) setParaEnabled(wsConfig.systems.para.enabled);
        if (wsConfig.systems.qmd_templates != null) setQmdTemplatesEnabled(wsConfig.systems.qmd_templates.enabled);
        if (wsConfig.systems.automations != null) setAutomationsEnabled(wsConfig.systems.automations.enabled);
        if (wsConfig.systems.design_skills != null) {
          setDesignSkillsEnabled(wsConfig.systems.design_skills.enabled);
          const ds = wsConfig.systems.design_skills as DesignSkillsConfig;
          setDesignVariance(ds.levels.design_variance);
          setMotionIntensity(ds.levels.motion_intensity);
          setVisualDensity(ds.levels.visual_density);
        }
      }

      if (wsConfig.behaviors) {
        if (wsConfig.behaviors.summarization != null) setSummarization(wsConfig.behaviors.summarization);
        if (wsConfig.behaviors.deep_memory != null) setDeepMemory(wsConfig.behaviors.deep_memory);
      }
    } catch (e) {
      // Silently fail — use built-in defaults
      console.warn('[NewSessionDialog] Could not load workspace settings:', e);
    }
  })();
  return () => { cancelled = true; };
}, []);
```

**Important:** The exact state setter names above (`setLlmWikiEnabled`, `setObsidianSkillsEnabled`, etc.) are placeholders. You must adapt them to match NewSessionDialog's actual state variables. The commented-out block shows the pattern for a single `contextConfig` state object, which may be closer to what the dialog actually uses. The key principle is: read `workspace-context-config` from preferences, parse it, and apply each system's `enabled` and `max_tokens` values to the dialog's initial state.

---

## Summary of All Changes

| File | Action | What Changes |
|------|--------|-------------|
| `src/components/InitializeProgressModal.tsx` | **New** | 16-step progress modal with simulated + real IPC, error/retry, re-init confirm |
| `src/components/WorkspaceSettingsDialog.tsx` | **New** | Persistent settings dialog with 7 system toggles, design knobs, behaviors, context map, save/cancel |
| `src/pages/IDEProjectsPage.tsx` | **Modified** | Button swap (Initialize=green, Setup=amber, New Agent=neutral), modal state, modal rendering |
| `src/pages/TerminalPage.tsx` | **Modified** | Added modal state, replaced `handleTriggerProvision` to open modal, added `handleOpenWorkspaceSettings`, added `open-workspace-settings` event listener, rendered modals |
| `src/components/NewSessionDialog.tsx` | **Modified** | Added useEffect to load `workspace-context-config` preferences as default values on mount |
| `src/main.ts` | **No changes** | Constraint preserved |
| `src/services/ContextService.ts` | **No changes** | Constraint preserved |

### Button Mapping (Before → After)

| Button | Before | After |
|--------|--------|-------|
| Green, FolderTree | "Setup" → one-click IPC, no UI | **"Initialize"** → progress modal with step-by-step |
| Amber, Bot | "Initialize" → opens NewSessionDialog | **"Setup"** → opens WorkspaceSettingsDialog |
| New, Bot | (didn't exist) | **"New Agent"** → opens NewSessionDialog for session creation |

### Data Flow

```
[Initialize Button]
  → setShowInitModal(true)
  → InitializeProgressModal opens
  → Simulated step animation + trackerMindSetup('init-all') IPC
  → On success: steps all green, summary card, provisionStatus → 'provisioned'
  → On error: step turns red, error message, retry button

[Setup Button]
  → setShowSetupModal(true)
  → WorkspaceSettingsDialog opens
  → Loads settings from getPreferences()['workspace-context-config']
  → User toggles systems, adjusts tokens, configures design knobs
  → Save → setPreference('workspace-context-config', JSON.stringify(config))
  → Settings persist across app restarts

[New Agent Button]
  → open-new-agent event → NewSessionDialog opens
  → On mount: reads workspace-context-config from preferences
  → Pre-populates context toggles with saved workspace defaults
  → User can still override per-session
  → Creates session with assembled context
```