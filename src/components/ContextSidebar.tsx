import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Sparkles, Network, FolderTree, FileCode, Zap, Palette,
  Settings2, ChevronDown, ChevronUp, Info, Save, RotateCcw,
  Thermometer, MessageSquare, Terminal, Wrench, HardDrive,
  Check, X, Bot, Brain,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

export const WORKSPACE_CONFIG_PREF_KEY = 'workspace-context-config';
const MODEL_CONFIG_KEY = 'model-improvisation-config';
const FILE_PATHS_KEY = 'workspace-file-paths';
const TERMINAL_COMM_KEY = 'terminal-communication-config';
const WORKSPACE_DEFAULTS_KEY = 'workspace-defaults';

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

export interface WorkspaceConfig {
  systems: Record<string, SystemConfig | DesignSkillsConfig>;
  behaviors: { summarization: boolean; deep_memory: boolean };
}

interface ModelConfig {
  temperature: number;
  maxResponseTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface FilePathConfig {
  agentPath: string;
  skillsDir: string;
  graphifyOut: string;
  paraVault: string;
  qmdTemplates: string;
  automationsFile: string;
  deepMemoryFile: string;
  sessionSummariesFile: string;
  designReferences: string;
}

interface TerminalCommConfig {
  defaultAgentType: string;
  agentCliFlags: string;
  systemPromptPrefix: string;
  messageLineEnding: 'LF' | 'CR' | 'CRLF';
  contextSharingBetweenTerminals: boolean;
  autoCreateTerminalOnSessionStart: boolean;
  terminalCloseBehavior: 'kill' | 'detach' | 'ask';
}

interface WorkspaceDefaultsConfig {
  autoInitializeOnOpen: boolean;
  autoSaveContextOnClose: boolean;
  defaultModelTier: 'top' | 'mid' | 'low';
  defaultTokenBudget: number;
  sessionSummaryFrequency: number;
}

const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  systems: {
    llm_wiki: { enabled: true, max_tokens: 800 },
    obsidian_skills: { enabled: true, max_tokens: 400 },
    graphify: { enabled: true, max_tokens: 400 },
    para: { enabled: true, max_tokens: 400 },
    qmd_templates: { enabled: true, max_tokens: 400 },
    automations: { enabled: true, max_tokens: 300 },
    design_skills: {
      enabled: true, max_tokens: 800,
      skills: ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill', 'design-taste'],
      levels: { design_variance: 5, motion_intensity: 5, visual_density: 7 },
      include_references: true,
    },
  },
  behaviors: { summarization: true, deep_memory: false },
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 1.0,
  maxResponseTokens: 4096,
  topP: 0.9,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

const DEFAULT_FILE_PATHS: FilePathConfig = {
  agentPath: '<project>/agent/',
  skillsDir: '<agent>/skills/',
  graphifyOut: '<project>/graphify-out/',
  paraVault: '<project>/../CZVault/',
  qmdTemplates: '<agent>/templates/',
  automationsFile: '<agent>/automations/automations.json',
  deepMemoryFile: '<agent>/context/deep-memory.json',
  sessionSummariesFile: '<agent>/context/session-summaries.json',
  designReferences: '<agent>/design-references/',
};

const DEFAULT_TERMINAL_COMM: TerminalCommConfig = {
  defaultAgentType: 'claude',
  agentCliFlags: '',
  systemPromptPrefix: '',
  messageLineEnding: 'LF',
  contextSharingBetweenTerminals: false,
  autoCreateTerminalOnSessionStart: true,
  terminalCloseBehavior: 'ask',
};

const DEFAULT_WORKSPACE_DEFAULTS: WorkspaceDefaultsConfig = {
  autoInitializeOnOpen: false,
  autoSaveContextOnClose: true,
  defaultModelTier: 'mid',
  defaultTokenBudget: 7000,
  sessionSummaryFrequency: 25,
};

const SYSTEM_CARDS = [
  { key: 'llm_wiki', name: 'LLM Wiki', icon: BookOpen, colorBg: 'bg-emerald-500/10', colorText: 'text-emerald-400', desc: 'Agent workspace files' },
  { key: 'obsidian_skills', name: 'Skills', icon: Sparkles, colorBg: 'bg-purple-500/10', colorText: 'text-purple-400', desc: 'SKILL.md frontmatter' },
  { key: 'design_skills', name: 'Design Skills', icon: Palette, colorBg: 'bg-pink-500/10', colorText: 'text-pink-400', desc: 'Frontend design intelligence' },
  { key: 'graphify', name: 'Graphify', icon: Network, colorBg: 'bg-blue-500/10', colorText: 'text-blue-400', desc: 'Knowledge graph' },
  { key: 'para', name: 'PARA', icon: FolderTree, colorBg: 'bg-amber-500/10', colorText: 'text-amber-400', desc: 'Vault structure' },
  { key: 'qmd_templates', name: 'QMD Templates', icon: FileCode, colorBg: 'bg-cyan-500/10', colorText: 'text-cyan-400', desc: 'Quick markup templates' },
  { key: 'automations', name: 'Automations', icon: Zap, colorBg: 'bg-orange-500/10', colorText: 'text-orange-400', desc: 'Automation rules' },
];

const DESIGN_SKILL_OPTIONS = [
  { id: 'frontend-design', label: 'Frontend Design' },
  { id: 'impeccable', label: 'Impeccable' },
  { id: 'ui-ux-pro-max', label: 'UI UX Pro Max' },
  { id: 'taste-skill', label: 'Taste Skill' },
  { id: 'design-taste', label: 'Design Taste' },
];

const KNOB_META: Record<keyof DesignLevels, { name: string; low: string; high: string }> = {
  design_variance: { name: 'Design Variance', low: 'Conservative', high: 'Experimental' },
  motion_intensity: { name: 'Motion Intensity', low: 'Static', high: 'Cinematic' },
  visual_density: { name: 'Visual Density', low: 'Airy', high: 'Maximal' },
};

const SECTIONS = [
  { id: 'systems', label: 'Systems', icon: Settings2 },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'model', label: 'Model', icon: Thermometer },
  { id: 'paths', label: 'Paths', icon: HardDrive },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'defaults', label: 'Defaults', icon: Wrench },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-8 h-4 rounded-full transition-colors duration-200 flex items-center flex-shrink-0 ${
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

function SectionHeader({
  label, icon: Icon, isOpen, onToggle, badge,
}: {
  label: string; icon: any; isOpen: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-2.5 px-1 group" data-tutorial="ctx.systems">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
        <span className="text-xs font-medium text-zinc-300 group-hover:text-zinc-200 transition-colors">
          {label}
        </span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
            {badge}
          </span>
        )}
      </div>
      {isOpen ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
    </button>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, formatValue,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; formatValue?: (v: number) => string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] font-mono text-zinc-300">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}

function TextInput({
  label, value, onChange, placeholder, monospace = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; monospace?: boolean;
}) {
  return (
    <div className="py-1.5">
      <label className="text-[11px] text-zinc-400 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors ${
          monospace ? 'font-mono' : ''
        }`}
      />
    </div>
  );
}

function SelectInput({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="py-1.5">
      <label className="text-[11px] text-zinc-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition-colors appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function usePersistedState<T>(
  prefKey: string, defaultValue: T, api: any, isOpen: boolean
): [T, (updater: (prev: T) => T) => void, boolean] {
  const [state, setState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const prefs = await api?.getPreferences?.();
        if (prefs?.[prefKey]) {
          const parsed = JSON.parse(prefs[prefKey]);
          setState(parsed);
          lastSavedRef.current = JSON.stringify(parsed);
        } else {
          setState(defaultValue);
          lastSavedRef.current = JSON.stringify(defaultValue);
        }
      } catch {
        setState(defaultValue);
      } finally {
        setLoaded(true);
      }
    })();
  }, [isOpen, prefKey, api]);

  const updateState = useCallback(
    (updater: (prev: T) => T) => {
      setState((prev) => {
        const next = updater(prev);
        const serialized = JSON.stringify(next);
        if (serialized !== lastSavedRef.current) {
          lastSavedRef.current = serialized;
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(async () => {
            try {
              await api?.setPreference?.(prefKey, serialized);
            } catch (e) {
              console.warn(`[ContextSidebar] Save failed for ${prefKey}:`, e);
            }
          }, 600);
        }
        return next;
      });
    },
    [prefKey, api]
  );

  return [state, updateState, loaded];
}

interface ContextSidebarProps {
  projectPath?: string;
  projectId?: string;
}

export default function ContextSidebar({ projectPath, projectId }: ContextSidebarProps) {
  const api = (window as any).deskflowAPI;
  const [activeSection, setActiveSection] = useState<SectionId>('systems');

  const scopeKey = (key: string) => projectId ? `${key}-${projectId}` : key;

  const [wsConfig, setWsConfig, wsLoaded] = usePersistedState<WorkspaceConfig>(
    scopeKey(WORKSPACE_CONFIG_PREF_KEY), DEFAULT_WORKSPACE_CONFIG, api, true
  );
  const [modelConfig, setModelConfig, modelLoaded] = usePersistedState<ModelConfig>(
    scopeKey(MODEL_CONFIG_KEY), DEFAULT_MODEL_CONFIG, api, true
  );
  const [filePaths, setFilePaths, pathsLoaded] = usePersistedState<FilePathConfig>(
    scopeKey(FILE_PATHS_KEY), DEFAULT_FILE_PATHS, api, true
  );
  const [termComm, setTermComm, termLoaded] = usePersistedState<TerminalCommConfig>(
    scopeKey(TERMINAL_COMM_KEY), DEFAULT_TERMINAL_COMM, api, true
  );
  const [wsDefaults, setWsDefaults, defaultsLoaded] = usePersistedState<WorkspaceDefaultsConfig>(
    scopeKey(WORKSPACE_DEFAULTS_KEY), DEFAULT_WORKSPACE_DEFAULTS, api, true
  );

  const loaded = wsLoaded && modelLoaded && pathsLoaded && termLoaded && defaultsLoaded;

  const totalTokens = useMemo(
    () => Object.values(wsConfig.systems).reduce((sum, sys) => sum + (sys.enabled ? sys.max_tokens : 0), 0),
    [wsConfig]
  );

  const activeSystemsCount = useMemo(
    () => Object.values(wsConfig.systems).filter((s) => s.enabled).length,
    [wsConfig]
  );

  const updateSystem = useCallback(
    (key: string, updates: Partial<SystemConfig>) => {
      setWsConfig((prev) => ({
        ...prev,
        systems: { ...prev.systems, [key]: { ...prev.systems[key], ...updates } },
      }));
    },
    [setWsConfig]
  );

  const updateBehavior = useCallback(
    (key: string, value: boolean) => {
      setWsConfig((prev) => ({
        ...prev,
        behaviors: { ...prev.behaviors, [key]: value },
      }));
    },
    [setWsConfig]
  );

  const updateDesignLevel = useCallback(
    (k: keyof DesignLevels, value: number) => {
      setWsConfig((prev) => {
        const ds = prev.systems.design_skills as DesignSkillsConfig;
        return { ...prev, systems: { ...prev.systems, design_skills: { ...ds, levels: { ...ds.levels, [k]: value } } } };
      });
    },
    [setWsConfig]
  );

  const updateDesignSkill = useCallback(
    (skillId: string, enabled: boolean) => {
      setWsConfig((prev) => {
        const ds = prev.systems.design_skills as DesignSkillsConfig;
        const skills = enabled
          ? [...ds.skills.filter((s) => s !== skillId), skillId]
          : ds.skills.filter((s) => s !== skillId);
        return { ...prev, systems: { ...prev.systems, design_skills: { ...ds, skills } } };
      });
    },
    [setWsConfig]
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin mr-2" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-zinc-200">Context Management</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {activeSystemsCount} on
            </span>
            <span>·</span>
            <span>{totalTokens} tok</span>
          </div>
        </div>
        <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
          {SYSTEM_CARDS.map((card) => {
            const sys = wsConfig.systems[card.key];
            if (!sys?.enabled) return null;
            const pct = (sys.max_tokens / 3200) * 100;
            return (
              <div
                key={card.key}
                className={`h-full ${card.colorBg.replace('/10', '/60')} transition-all duration-300`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-0.5 px-2 pt-2 pb-1 overflow-x-auto">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
              activeSection === sec.id
                ? 'bg-zinc-700/60 text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40'
            }`}
          >
            <sec.icon className="w-3 h-3" />
            {sec.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        <AnimatePresence mode="wait">
          {activeSection === 'systems' && (
            <motion.div
              key="systems"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {SYSTEM_CARDS.map((card) => {
                const sys = wsConfig.systems[card.key];
                const isEnabled = sys?.enabled ?? false;
                return (
                  <GlassCard
                    key={card.key}
                    className={`p-2.5 transition-all duration-200 ${
                      !isEnabled ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-5 h-5 rounded-md ${card.colorBg} flex items-center justify-center flex-shrink-0`}>
                          <card.icon className={`w-3 h-3 ${card.colorText}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-zinc-300 truncate">{card.name}</div>
                          <div className="text-[9px] text-zinc-600">{isEnabled ? `${sys.max_tokens} tokens` : 'Disabled'}</div>
                        </div>
                      </div>
                      <Toggle on={isEnabled} onToggle={() => updateSystem(card.key, { enabled: !isEnabled })} />
                    </div>
                    {isEnabled && card.key !== 'design_skills' && (
                      <div className="mt-1.5">
                        <input
                          type="range" min={100} max={1200} step={50}
                          value={(sys as SystemConfig).max_tokens}
                          onChange={(e) => updateSystem(card.key, { max_tokens: parseInt(e.target.value) })}
                          className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                            [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                    )}
                  </GlassCard>
                );
              })}

              <div className="pt-2 mt-1 border-t border-zinc-800/40">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Behaviors</div>
                {([
                  { key: 'summarization' as const, label: 'Auto-summarization', icon: MessageSquare },
                  { key: 'deep_memory' as const, label: 'Deep Memory', icon: Brain },
                ]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-800/30">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3 h-3 text-zinc-600" />
                      <span className="text-[11px] text-zinc-400">{item.label}</span>
                    </div>
                    <Toggle on={wsConfig.behaviors[item.key]} onToggle={() => updateBehavior(item.key, !wsConfig.behaviors[item.key])} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'design' && (
            <motion.div
              key="design"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
              data-tutorial="ctx.tokens"
            >
              <GlassCard
                className={`p-3 transition-all ${
                  (wsConfig.systems.design_skills as DesignSkillsConfig).enabled
                    ? '' : 'opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-medium text-zinc-200">Design Skills System</span>
                  </div>
                  <Toggle
                    on={(wsConfig.systems.design_skills as DesignSkillsConfig).enabled}
                    onToggle={() => updateSystem('design_skills', {
                      enabled: !(wsConfig.systems.design_skills as DesignSkillsConfig).enabled,
                    })}
                  />
                </div>
              </GlassCard>

              {(wsConfig.systems.design_skills as DesignSkillsConfig).enabled && (
                <>
                  <GlassCard className="p-3">
                    <div className="text-[10px] text-pink-400 uppercase tracking-wider font-medium mb-3">Taste Knobs</div>
                    <div className="space-y-3">
                      {(Object.keys(KNOB_META) as (keyof DesignLevels)[]).map((key) => {
                        const ds = wsConfig.systems.design_skills as DesignSkillsConfig;
                        const meta = KNOB_META[key];
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-zinc-400">{meta.name}</span>
                              <span className="text-[11px] font-mono text-pink-300">{ds.levels[key]}</span>
                            </div>
                            <input
                              type="range" min={1} max={10}
                              value={ds.levels[key]}
                              onChange={(e) => updateDesignLevel(key, parseInt(e.target.value))}
                              className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                                [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-amber-400
                                [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(245,158,11,0.4)]
                                [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[9px] text-zinc-600">{meta.low}</span>
                              <span className="text-[9px] text-zinc-600">{meta.high}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-3">
                    <div className="text-[10px] text-pink-400 uppercase tracking-wider font-medium mb-2">Active Skills</div>
                    <div className="space-y-1">
                      {DESIGN_SKILL_OPTIONS.map((skill) => {
                        const ds = wsConfig.systems.design_skills as DesignSkillsConfig;
                        const isActive = ds.skills.includes(skill.id);
                        return (
                          <div key={skill.id} className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-zinc-800/30">
                            <span className="text-[11px] text-zinc-400">{skill.label}</span>
                            <Toggle on={isActive} onToggle={() => updateDesignSkill(skill.id, !isActive)} />
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-400">Include References</div>
                        <div className="text-[9px] text-zinc-600">DESIGN.md files</div>
                      </div>
                      <Toggle
                        on={(wsConfig.systems.design_skills as DesignSkillsConfig).include_references}
                        onToggle={() => setWsConfig((prev) => {
                          const ds = prev.systems.design_skills as DesignSkillsConfig;
                          return { ...prev, systems: { ...prev.systems, design_skills: { ...ds, include_references: !ds.include_references } } };
                        })}
                      />
                    </div>
                    <SliderRow
                      label="Token Budget"
                      value={(wsConfig.systems.design_skills as DesignSkillsConfig).max_tokens}
                      min={200} max={1200} step={50}
                      onChange={(v) => updateSystem('design_skills', { max_tokens: v })}
                    />
                  </GlassCard>
                </>
              )}
            </motion.div>
          )}

          {activeSection === 'model' && (
            <motion.div
              key="model"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
              data-tutorial="ctx.model"
            >
              <GlassCard className="p-2">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Model parameters affect agent behavior. Applied when context is sent to the terminal. Stored locally.
                  </p>
                </div>
              </GlassCard>
              <GlassCard className="p-3 space-y-1">
                <SliderRow label="Temperature" value={modelConfig.temperature} min={0.1} max={2.0} step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, temperature: v }))} formatValue={(v) => v.toFixed(1)} />
                <SliderRow label="Max Response Tokens" value={modelConfig.maxResponseTokens} min={256} max={8192} step={256}
                  onChange={(v) => setModelConfig((p) => ({ ...p, maxResponseTokens: v }))} formatValue={(v) => v.toLocaleString()} />
                <SliderRow label="Top-p Sampling" value={modelConfig.topP} min={0.1} max={1.0} step={0.05}
                  onChange={(v) => setModelConfig((p) => ({ ...p, topP: v }))} formatValue={(v) => v.toFixed(2)} />
                <SliderRow label="Frequency Penalty" value={modelConfig.frequencyPenalty} min={-2.0} max={2.0} step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, frequencyPenalty: v }))} formatValue={(v) => v.toFixed(1)} />
                <SliderRow label="Presence Penalty" value={modelConfig.presencePenalty} min={-2.0} max={2.0} step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, presencePenalty: v }))} formatValue={(v) => v.toFixed(1)} />
              </GlassCard>
            </motion.div>
          )}

          {activeSection === 'paths' && (
            <motion.div
              key="paths"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              <GlassCard className="p-2">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-600 leading-relaxed">Override default file locations. Use {'<project>'} and {'<agent>'} as placeholders.</p>
                </div>
              </GlassCard>
              <GlassCard className="p-3 space-y-0.5">
                {([
                  { key: 'agentPath' as const, label: 'Agent Workspace', placeholder: '<project>/agent/' },
                  { key: 'skillsDir' as const, label: 'Skills Directory', placeholder: '<agent>/skills/' },
                  { key: 'graphifyOut' as const, label: 'Graphify Output', placeholder: '<project>/graphify-out/' },
                  { key: 'paraVault' as const, label: 'PARA Vault', placeholder: '<project>/../CZVault/' },
                  { key: 'qmdTemplates' as const, label: 'QMD Templates', placeholder: '<agent>/templates/' },
                  { key: 'automationsFile' as const, label: 'Automations', placeholder: '<agent>/automations/automations.json' },
                  { key: 'deepMemoryFile' as const, label: 'Deep Memory', placeholder: '<agent>/context/deep-memory.json' },
                  { key: 'sessionSummariesFile' as const, label: 'Session Summaries', placeholder: '<agent>/context/session-summaries.json' },
                  { key: 'designReferences' as const, label: 'Design References', placeholder: '<agent>/design-references/' },
                ]).map((item) => (
                  <TextInput
                    key={item.key} label={item.label}
                    value={filePaths[item.key]}
                    onChange={(v) => setFilePaths((p) => ({ ...p, [item.key]: v }))}
                    placeholder={item.placeholder} monospace
                  />
                ))}
              </GlassCard>
            </motion.div>
          )}

          {activeSection === 'terminal' && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <GlassCard className="p-3 space-y-1">
                <SelectInput label="Default Agent Type" value={termComm.defaultAgentType}
                  onChange={(v) => setTermComm((p) => ({ ...p, defaultAgentType: v }))}
                  options={[
                    { value: 'claude', label: 'Claude' },
                    { value: 'opencode', label: 'OpenCode' },
                    { value: 'aider', label: 'Aider' },
                    { value: 'codex', label: 'Codex' },
                    { value: 'generic', label: 'Generic' },
                  ]} />
                <TextInput label="Agent CLI Flags" value={termComm.agentCliFlags}
                  onChange={(v) => setTermComm((p) => ({ ...p, agentCliFlags: v }))}
                  placeholder="--model claude-sonnet-4-20250514 --resume" monospace />
                <div className="py-1.5">
                  <label className="text-[11px] text-zinc-400 block mb-1">System Prompt Prefix</label>
                  <VoiceInputWrapper>
                    <textarea value={termComm.systemPromptPrefix}
                      onChange={(e) => setTermComm((p) => ({ ...p, systemPromptPrefix: e.target.value }))}
                      placeholder="Prepended to assembled context..." rows={3}
                      className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors font-mono resize-none" />
                  </VoiceInputWrapper>
                </div>
                <SelectInput label="Message Line Ending" value={termComm.messageLineEnding}
                  onChange={(v) => setTermComm((p) => ({ ...p, messageLineEnding: v as any }))}
                  options={[
                    { value: 'LF', label: 'LF (Unix)' },
                    { value: 'CR', label: 'CR (Mac)' },
                    { value: 'CRLF', label: 'CRLF (Windows)' },
                  ]} />
              </GlassCard>
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Context Sharing</div>
                    <div className="text-[9px] text-zinc-600">Share context across split terminals</div>
                  </div>
                  <Toggle on={termComm.contextSharingBetweenTerminals}
                    onToggle={() => setTermComm((p) => ({ ...p, contextSharingBetweenTerminals: !p.contextSharingBetweenTerminals }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-create Terminal</div>
                    <div className="text-[9px] text-zinc-600">Create terminal on session start</div>
                  </div>
                  <Toggle on={termComm.autoCreateTerminalOnSessionStart}
                    onToggle={() => setTermComm((p) => ({ ...p, autoCreateTerminalOnSessionStart: !p.autoCreateTerminalOnSessionStart }))} />
                </div>
                <SelectInput label="Terminal Close Behavior" value={termComm.terminalCloseBehavior}
                  onChange={(v) => setTermComm((p) => ({ ...p, terminalCloseBehavior: v as any }))}
                  options={[
                    { value: 'kill', label: 'Kill agent' },
                    { value: 'detach', label: 'Detach' },
                    { value: 'ask', label: 'Ask each time' },
                  ]} />
              </GlassCard>
            </motion.div>
          )}

          {activeSection === 'defaults' && (
            <motion.div
              key="defaults"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-initialize on Open</div>
                    <div className="text-[9px] text-zinc-600">Run trackerMindSetup when workspace opens</div>
                  </div>
                  <Toggle on={wsDefaults.autoInitializeOnOpen}
                    onToggle={() => setWsDefaults((p) => ({ ...p, autoInitializeOnOpen: !p.autoInitializeOnOpen }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-save Context on Close</div>
                    <div className="text-[9px] text-zinc-600">Persist context when closing workspace</div>
                  </div>
                  <Toggle on={wsDefaults.autoSaveContextOnClose}
                    onToggle={() => setWsDefaults((p) => ({ ...p, autoSaveContextOnClose: !p.autoSaveContextOnClose }))} />
                </div>
              </GlassCard>
              <GlassCard className="p-3 space-y-1">
                <SelectInput label="Default Model Tier" value={wsDefaults.defaultModelTier}
                  onChange={(v) => setWsDefaults((p) => ({ ...p, defaultModelTier: v as any }))}
                  options={[
                    { value: 'top', label: 'Top — Full context (10K tokens)' },
                    { value: 'mid', label: 'Mid — Balanced (7K tokens)' },
                    { value: 'low', label: 'Low — Minimal (4K tokens)' },
                  ]} />
                <SliderRow label="Default Token Budget" value={wsDefaults.defaultTokenBudget}
                  min={4000} max={20000} step={500}
                  onChange={(v) => setWsDefaults((p) => ({ ...p, defaultTokenBudget: v }))}
                  formatValue={(v) => v.toLocaleString()} />
                  <SelectInput label="Session Summary Frequency" value={String(wsDefaults.sessionSummaryFrequency)}
                    onChange={(v) => setWsDefaults((p) => ({ ...p, sessionSummaryFrequency: parseInt(v) }))}
                    options={[
                      { value: '10', label: 'Every 10 messages' },
                      { value: '25', label: 'Every 25 messages' },
                      { value: '50', label: 'Every 50 messages' },
                      { value: '100', label: 'Every 100 messages' },
                      { value: '0', label: 'Never' },
                    ]} />
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
