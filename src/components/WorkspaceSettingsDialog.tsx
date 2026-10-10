import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2, X, BookOpen, Sparkles, Network, FolderTree,
  FileCode, Zap, Palette, RotateCcw, Save, ChevronDown,
  ChevronUp, Info,
} from 'lucide-react';

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
        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(245,158,11,0.4)] [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-zinc-600">{lowLabel}</span>
        <span className="text-[9px] text-zinc-600">{highLabel}</span>
      </div>
    </div>
  );
}

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

interface WorkspaceSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectPath?: string;
}

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

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setShowResetConfirm(false);
  }, []);

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
        className="bg-zinc-800 rounded-xl border border-zinc-700 w-full max-w-lg max-h-[85vh] flex flex-col"
      >
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-amber-400 rounded-full animate-spin mr-2" />
              <span className="text-xs">Loading settings…</span>
            </div>
          ) : (
            <>
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
                            : 'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border-zinc-800/50 opacity-60'
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
                              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
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
                          <div>
                            <h4 className="text-[10px] font-medium text-pink-400 uppercase tracking-wider mb-3">
                              Taste Knobs
                            </h4>
                            <div className="space-y-3">
                              {(
                                Object.keys(KNOB_LABELS) as (
                                  keyof DesignLevels
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
                              onToggle={() => toggleDesignReferences(
                                !(config.systems.design_skills as DesignSkillsConfig).include_references
                              )}
                            />
                          </div>

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
                              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </section>

              <section className="p-3 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50">
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

              <section>
                <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider mb-3">
                  Behaviors
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50">
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
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-zinc-500" />
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

              <section>
                <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider mb-3">
                  Context Assembly Map
                </h3>
                <div className="p-3 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50">
                  <ContextMapSVG config={config} />
                </div>
              </section>
            </>
          )}
        </div>

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
