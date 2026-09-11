# Context Sidebar, Tutorial Page, & Setup Evaluation — Complete Implementation

## Design Overview

Three areas, one coherent system. The **Context Sidebar** replaces the modal pattern with a persistent sidebar panel. The **Tutorial Page** provides feature discovery and onboarding. **New settings scopes** expand what the sidebar manages.

---

## File 1: `src/components/ContextSidebar.tsx`

This replaces `WorkspaceSettingsDialog.tsx`. It's a sidebar panel (not a modal) that renders inside the IDE workspace when the "Context" tab is selected.

```tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Sparkles, Network, FolderTree, FileCode, Zap, Palette,
  Settings2, ChevronDown, ChevronUp, Info, Save, RotateCcw,
  Thermometer, MessageSquare, Terminal, Wrench, HardDrive,
  Check, X, FolderOpen, Bot, Clock, ToggleLeft, Brain,
} from 'lucide-react';

// ─── Preference Keys ───────────────────────────────────────

export const WORKSPACE_CONFIG_PREF_KEY = 'workspace-context-config';
const MODEL_CONFIG_KEY = 'model-improvisation-config';
const FILE_PATHS_KEY = 'workspace-file-paths';
const TERMINAL_COMM_KEY = 'terminal-communication-config';
const WORKSPACE_DEFAULTS_KEY = 'workspace-defaults';

// ─── Data Shapes ───────────────────────────────────────────

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

// ─── Defaults ──────────────────────────────────────────────

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

// ─── System Card Definitions ───────────────────────────────

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

// ─── Section Definitions ───────────────────────────────────

const SECTIONS = [
  { id: 'systems', label: 'Systems', icon: Settings2 },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'model', label: 'Model', icon: Thermometer },
  { id: 'paths', label: 'Paths', icon: HardDrive },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'defaults', label: 'Defaults', icon: Wrench },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// ─── Reusable Primitives ───────────────────────────────────

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
  label,
  icon: Icon,
  isOpen,
  onToggle,
  badge,
}: {
  label: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2.5 px-1 group"
    >
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
      {isOpen ? (
        <ChevronUp className="w-3 h-3 text-zinc-600" />
      ) : (
        <ChevronDown className="w-3 h-3 text-zinc-600" />
      )}
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  colorThumb = 'bg-zinc-400',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  colorThumb?: string;
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
        className={`w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:${colorThumb} [&::-webkit-slider-thumb]:cursor-pointer`}
      />
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  monospace = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
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
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="py-1.5">
      <label className="text-[11px] text-zinc-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Save Hook ─────────────────────────────────────────────

function usePersistedState<T>(
  prefKey: string,
  defaultValue: T,
  api: any,
  isOpen: boolean
): [T, (updater: (prev: T) => T) => void, boolean] {
  const [state, setState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on open
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const prefs = await api?.getPreferences?.();
        if (prefs?.[prefKey]) {
          setState(JSON.parse(prefs[prefKey]));
        } else {
          setState(defaultValue);
        }
      } catch {
        setState(defaultValue);
      } finally {
        setLoaded(true);
      }
    })();
  }, [isOpen, prefKey, api]);

  // Auto-save with debounce
  const updateState = useCallback(
    (updater: (prev: T) => T) => {
      setState((prev) => {
        const next = updater(prev);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            await api?.setPreference?.(prefKey, JSON.stringify(next));
          } catch (e) {
            console.warn(`[ContextSidebar] Save failed for ${prefKey}:`, e);
          }
        }, 600);
        return next;
      });
    },
    [prefKey, api]
  );

  return [state, updateState, loaded];
}

// ─── Main Component ────────────────────────────────────────

interface ContextSidebarProps {
  projectPath?: string;
  projectId?: string;
}

export default function ContextSidebar({ projectPath, projectId }: ContextSidebarProps) {
  const api = (window as any).deskflowAPI;
  const [activeSection, setActiveSection] = useState<SectionId>('systems');
  const [designExpanded, setDesignExpanded] = useState(false);

  // Persisted state — all auto-save on change
  const [wsConfig, setWsConfig, wsLoaded] = usePersistedState<WorkspaceConfig>(
    WORKSPACE_CONFIG_PREF_KEY, DEFAULT_WORKSPACE_CONFIG, api, true
  );
  const [modelConfig, setModelConfig, modelLoaded] = usePersistedState<ModelConfig>(
    MODEL_CONFIG_KEY, DEFAULT_MODEL_CONFIG, api, true
  );
  const [filePaths, setFilePaths, pathsLoaded] = usePersistedState<FilePathConfig>(
    FILE_PATHS_KEY, DEFAULT_FILE_PATHS, api, true
  );
  const [termComm, setTermComm, termLoaded] = usePersistedState<TerminalCommConfig>(
    TERMINAL_COMM_KEY, DEFAULT_TERMINAL_COMM, api, true
  );
  const [wsDefaults, setWsDefaults, defaultsLoaded] = usePersistedState<WorkspaceDefaultsConfig>(
    WORKSPACE_DEFAULTS_KEY, DEFAULT_WORKSPACE_DEFAULTS, api, true
  );

  const loaded = wsLoaded && modelLoaded && pathsLoaded && termLoaded && defaultsLoaded;

  // ── Derived ────────────────────────────────────────────

  const totalTokens = useMemo(
    () =>
      Object.values(wsConfig.systems).reduce(
        (sum, sys) => sum + (sys.enabled ? sys.max_tokens : 0),
        0
      ),
    [wsConfig]
  );

  const activeSystemsCount = useMemo(
    () => Object.values(wsConfig.systems).filter((s) => s.enabled).length,
    [wsConfig]
  );

  // ── Config updaters ────────────────────────────────────

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
        return {
          ...prev,
          systems: {
            ...prev.systems,
            design_skills: { ...ds, levels: { ...ds.levels, [k]: value } },
          },
        };
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
        return {
          ...prev,
          systems: { ...prev.systems, design_skills: { ...ds, skills } },
        };
      });
    },
    [setWsConfig]
  );

  // ── Render ─────────────────────────────────────────────

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
      {/* ── Header ── */}
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

        {/* Token budget bar */}
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

      {/* ── Section Navigation ── */}
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        <AnimatePresence mode="wait">
          {/* ━━━ SYSTEMS SECTION ━━━ */}
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
                  <div
                    key={card.key}
                    className={`rounded-xl p-2.5 border transition-all duration-200 ${
                      isEnabled
                        ? 'bg-zinc-800/60 border-zinc-700/50'
                        : 'bg-zinc-900/40 border-zinc-800/30 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-5 h-5 rounded-md ${card.colorBg} flex items-center justify-center flex-shrink-0`}>
                          <card.icon className={`w-3 h-3 ${card.colorText}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-zinc-300 truncate">
                            {card.name}
                          </div>
                          <div className="text-[9px] text-zinc-600">
                            {isEnabled ? `${sys.max_tokens} tokens` : 'Disabled'}
                          </div>
                        </div>
                      </div>
                      <Toggle
                        on={isEnabled}
                        onToggle={() => updateSystem(card.key, { enabled: !isEnabled })}
                      />
                    </div>
                    {isEnabled && card.key !== 'design_skills' && (
                      <div className="mt-1.5">
                        <input
                          type="range"
                          min={100}
                          max={1200}
                          step={50}
                          value={sys.max_tokens}
                          onChange={(e) =>
                            updateSystem(card.key, { max_tokens: parseInt(e.target.value) })
                          }
                          className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                            [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Behaviors */}
              <div className="pt-2 mt-1 border-t border-zinc-800/40">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Behaviors</div>
                {[
                  { key: 'summarization' as const, label: 'Auto-summarization', icon: MessageSquare },
                  { key: 'deep_memory' as const, label: 'Deep Memory', icon: Brain },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3 h-3 text-zinc-600" />
                      <span className="text-[11px] text-zinc-400">{item.label}</span>
                    </div>
                    <Toggle
                      on={wsConfig.behaviors[item.key]}
                      onToggle={() => updateBehavior(item.key, !wsConfig.behaviors[item.key])}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ━━━ DESIGN SECTION ━━━ */}
          {activeSection === 'design' && (
            <motion.div
              key="design"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Master toggle */}
              <div
                className={`rounded-xl p-3 border transition-all ${
                  (wsConfig.systems.design_skills as DesignSkillsConfig).enabled
                    ? 'bg-pink-500/5 border-pink-500/20'
                    : 'bg-zinc-900/40 border-zinc-800/30 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-medium text-zinc-200">Design Skills System</span>
                  </div>
                  <Toggle
                    on={(wsConfig.systems.design_skills as DesignSkillsConfig).enabled}
                    onToggle={() =>
                      updateSystem('design_skills', {
                        enabled: !(wsConfig.systems.design_skills as DesignSkillsConfig).enabled,
                      })
                    }
                  />
                </div>
              </div>

              {(wsConfig.systems.design_skills as DesignSkillsConfig).enabled && (
                <>
                  {/* Taste Knobs */}
                  <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30">
                    <div className="text-[10px] text-pink-400 uppercase tracking-wider font-medium mb-3">
                      Taste Knobs
                    </div>
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
                              type="range"
                              min={1}
                              max={10}
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
                  </div>

                  {/* Skill Toggles */}
                  <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30">
                    <div className="text-[10px] text-pink-400 uppercase tracking-wider font-medium mb-2">
                      Active Skills
                    </div>
                    <div className="space-y-1">
                      {DESIGN_SKILL_OPTIONS.map((skill) => {
                        const ds = wsConfig.systems.design_skills as DesignSkillsConfig;
                        const isActive = ds.skills.includes(skill.id);
                        return (
                          <div
                            key={skill.id}
                            className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-zinc-800/30"
                          >
                            <span className="text-[11px] text-zinc-400">{skill.label}</span>
                            <Toggle
                              on={isActive}
                              onToggle={() => updateDesignSkill(skill.id, !isActive)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* References toggle + token budget */}
                  <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-400">Include References</div>
                        <div className="text-[9px] text-zinc-600">DESIGN.md files</div>
                      </div>
                      <Toggle
                        on={(wsConfig.systems.design_skills as DesignSkillsConfig).include_references}
                        onToggle={() =>
                          setWsConfig((prev) => {
                            const ds = prev.systems.design_skills as DesignSkillsConfig;
                            return {
                              ...prev,
                              systems: {
                                ...prev.systems,
                                design_skills: { ...ds, include_references: !ds.include_references },
                              },
                            };
                          })
                        }
                      />
                    </div>
                    <SliderRow
                      label="Token Budget"
                      value={(wsConfig.systems.design_skills as DesignSkillsConfig).max_tokens}
                      min={200}
                      max={1200}
                      step={50}
                      onChange={(v) => updateSystem('design_skills', { max_tokens: v })}
                      colorThumb="bg-pink-400"
                    />
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ━━━ MODEL SECTION ━━━ */}
          {activeSection === 'model' && (
            <motion.div
              key="model"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Model parameters affect agent behavior. Applied when context is sent to the terminal.
                    Stored locally — not synced to backend.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-1">
                <SliderRow
                  label="Temperature"
                  value={modelConfig.temperature}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, temperature: v }))}
                  formatValue={(v) => v.toFixed(1)}
                  colorThumb="bg-orange-400"
                />
                <SliderRow
                  label="Max Response Tokens"
                  value={modelConfig.maxResponseTokens}
                  min={256}
                  max={8192}
                  step={256}
                  onChange={(v) => setModelConfig((p) => ({ ...p, maxResponseTokens: v }))}
                  formatValue={(v) => v.toLocaleString()}
                  colorThumb="bg-orange-400"
                />
                <SliderRow
                  label="Top-p Sampling"
                  value={modelConfig.topP}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  onChange={(v) => setModelConfig((p) => ({ ...p, topP: v }))}
                  formatValue={(v) => v.toFixed(2)}
                  colorThumb="bg-orange-400"
                />
                <SliderRow
                  label="Frequency Penalty"
                  value={modelConfig.frequencyPenalty}
                  min={-2.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, frequencyPenalty: v }))}
                  formatValue={(v) => v.toFixed(1)}
                  colorThumb="bg-orange-400"
                />
                <SliderRow
                  label="Presence Penalty"
                  value={modelConfig.presencePenalty}
                  min={-2.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => setModelConfig((p) => ({ ...p, presencePenalty: v }))}
                  formatValue={(v) => v.toFixed(1)}
                  colorThumb="bg-orange-400"
                />
              </div>
            </motion.div>
          )}

          {/* ━━━ PATHS SECTION ━━━ */}
          {activeSection === 'paths' && (
            <motion.div
              key="paths"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              <div className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Override default file locations. Use &lt;project&gt; and &lt;agent&gt; as placeholders.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-0.5">
                {([
                  { key: 'agentPath', label: 'Agent Workspace', placeholder: '<project>/agent/' },
                  { key: 'skillsDir', label: 'Skills Directory', placeholder: '<agent>/skills/' },
                  { key: 'graphifyOut', label: 'Graphify Output', placeholder: '<project>/graphify-out/' },
                  { key: 'paraVault', label: 'PARA Vault', placeholder: '<project>/../CZVault/' },
                  { key: 'qmdTemplates', label: 'QMD Templates', placeholder: '<agent>/templates/' },
                  { key: 'automationsFile', label: 'Automations', placeholder: '<agent>/automations/automations.json' },
                  { key: 'deepMemoryFile', label: 'Deep Memory', placeholder: '<agent>/context/deep-memory.json' },
                  { key: 'sessionSummariesFile', label: 'Session Summaries', placeholder: '<agent>/context/session-summaries.json' },
                  { key: 'designReferences', label: 'Design References', placeholder: '<agent>/design-references/' },
                ] as const).map((item) => (
                  <TextInput
                    key={item.key}
                    label={item.label}
                    value={filePaths[item.key]}
                    onChange={(v) => setFilePaths((p) => ({ ...p, [item.key]: v }))}
                    placeholder={item.placeholder}
                    monospace
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ━━━ TERMINAL SECTION ━━━ */}
          {activeSection === 'terminal' && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-1">
                <SelectInput
                  label="Default Agent Type"
                  value={termComm.defaultAgentType}
                  onChange={(v) => setTermComm((p) => ({ ...p, defaultAgentType: v }))}
                  options={[
                    { value: 'claude', label: 'Claude' },
                    { value: 'opencode', label: 'OpenCode' },
                    { value: 'aider', label: 'Aider' },
                    { value: 'codex', label: 'Codex' },
                    { value: 'generic', label: 'Generic' },
                  ]}
                />
                <TextInput
                  label="Agent CLI Flags"
                  value={termComm.agentCliFlags}
                  onChange={(v) => setTermComm((p) => ({ ...p, agentCliFlags: v }))}
                  placeholder="--model claude-sonnet-4-20250514 --resume"
                  monospace
                />
                <div className="py-1.5">
                  <label className="text-[11px] text-zinc-400 block mb-1">System Prompt Prefix</label>
                  <textarea
                    value={termComm.systemPromptPrefix}
                    onChange={(e) => setTermComm((p) => ({ ...p, systemPromptPrefix: e.target.value }))}
                    placeholder="Prepended to assembled context..."
                    rows={3}
                    className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors font-mono resize-none"
                  />
                </div>
                <SelectInput
                  label="Message Line Ending"
                  value={termComm.messageLineEnding}
                  onChange={(v) => setTermComm((p) => ({ ...p, messageLineEnding: v as any }))}
                  options={[
                    { value: 'LF', label: 'LF (Unix)' },
                    { value: 'CR', label: 'CR (Mac)' },
                    { value: 'CRLF', label: 'CRLF (Windows)' },
                  ]}
                />
              </div>

              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Context Sharing</div>
                    <div className="text-[9px] text-zinc-600">Share context across split terminals</div>
                  </div>
                  <Toggle
                    on={termComm.contextSharingBetweenTerminals}
                    onToggle={() =>
                      setTermComm((p) => ({
                        ...p,
                        contextSharingBetweenTerminals: !p.contextSharingBetweenTerminals,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-create Terminal</div>
                    <div className="text-[9px] text-zinc-600">Create terminal on session start</div>
                  </div>
                  <Toggle
                    on={termComm.autoCreateTerminalOnSessionStart}
                    onToggle={() =>
                      setTermComm((p) => ({
                        ...p,
                        autoCreateTerminalOnSessionStart: !p.autoCreateTerminalOnSessionStart,
                      }))
                    }
                  />
                </div>
                <SelectInput
                  label="Terminal Close Behavior"
                  value={termComm.terminalCloseBehavior}
                  onChange={(v) => setTermComm((p) => ({ ...p, terminalCloseBehavior: v as any }))}
                  options={[
                    { value: 'kill', label: 'Kill agent' },
                    { value: 'detach', label: 'Detach' },
                    { value: 'ask', label: 'Ask each time' },
                  ]}
                />
              </div>
            </motion.div>
          )}

          {/* ━━━ DEFAULTS SECTION ━━━ */}
          {activeSection === 'defaults' && (
            <motion.div
              key="defaults"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-initialize on Open</div>
                    <div className="text-[9px] text-zinc-600">Run trackerMindSetup when workspace opens</div>
                  </div>
                  <Toggle
                    on={wsDefaults.autoInitializeOnOpen}
                    onToggle={() =>
                      setWsDefaults((p) => ({ ...p, autoInitializeOnOpen: !p.autoInitializeOnOpen }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Auto-save Context on Close</div>
                    <div className="text-[9px] text-zinc-600">Persist context when closing workspace</div>
                  </div>
                  <Toggle
                    on={wsDefaults.autoSaveContextOnClose}
                    onToggle={() =>
                      setWsDefaults((p) => ({
                        ...p,
                        autoSaveContextOnClose: !p.autoSaveContextOnClose,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl p-3 bg-zinc-800/40 border border-zinc-700/30 space-y-1">
                <SelectInput
                  label="Default Model Tier"
                  value={wsDefaults.defaultModelTier}
                  onChange={(v) => setWsDefaults((p) => ({ ...p, defaultModelTier: v as any }))}
                  options={[
                    { value: 'top', label: 'Top — Full context (10K tokens)' },
                    { value: 'mid', label: 'Mid — Balanced (7K tokens)' },
                    { value: 'low', label: 'Low — Minimal (4K tokens)' },
                  ]}
                />
                <SliderRow
                  label="Default Token Budget"
                  value={wsDefaults.defaultTokenBudget}
                  min={4000}
                  max={20000}
                  step={500}
                  onChange={(v) => setWsDefaults((p) => ({ ...p, defaultTokenBudget: v }))}
                  formatValue={(v) => v.toLocaleString()}
                  colorThumb="bg-emerald-400"
                />
                <SelectInput
                  label="Session Summary Frequency"
                  value={String(wsDefaults.sessionSummaryFrequency)}
                  onChange={(v) => setWsDefaults((p) => ({ ...p, sessionSummaryFrequency: parseInt(v) }))}
                  options={[
                    { value: '10', label: 'Every 10 messages' },
                    { value: '25', label: 'Every 25 messages' },
                    { value: '50', label: 'Every 50 messages' },
                    { value: '100', label: 'Every 100 messages' },
                    { value: '0', label: 'Never' },
                  ]}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

---

## File 2: `src/pages/TutorialPage.tsx`

```tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  HelpCircle, ChevronRight, Check, RotateCcw, ArrowLeft, ArrowRight,
  Zap, ExternalLink, Trophy, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TutorialOverlay from '../components/TutorialOverlay';

// ─── Feature Inventory ─────────────────────────────────────

interface Feature {
  id: string;
  name: string;
  icon: any;
  category: string;
  status: 'released' | 'beta' | 'planned';
  description: string;
  route: string;
  tutorialSteps: TutorialStep[];
}

interface TutorialStep {
  target: string;     // CSS selector or route
  title: string;
  instruction: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const FEATURES: Feature[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Home,
    category: 'Core',
    status: 'released',
    description: 'Activity heatmap, weekly overview, daily stats, and 3D planet visualization of your app usage.',
    route: '/',
    tutorialSteps: [
      { target: '[data-tutorial="heatmap"]', title: 'Activity Heatmap', instruction: 'This heatmap shows your daily activity intensity. Darker cells = more tracked time.', position: 'bottom' },
      { target: '[data-tutorial="weekly"]', title: 'Weekly Overview', instruction: 'See your top apps and total hours for the current week at a glance.', position: 'bottom' },
      { target: '[data-tutorial="planets"]', title: '3D Orbit System', instruction: 'Each planet represents a tracked app. Size = time spent. Click to explore!', position: 'center' },
    ],
  },
  {
    id: 'orbit',
    name: '3D Orbit Visualization',
    icon: Activity,
    category: 'Core',
    status: 'released',
    description: 'Interactive Three.js solar system where planets represent your apps, scaled by usage time.',
    route: '/',
    tutorialSteps: [
      { target: '[data-tutorial="planets"]', title: 'Planet Navigation', instruction: 'Scroll to zoom, drag to rotate. Click a planet to see app details.', position: 'center' },
    ],
  },
  {
    id: 'stats',
    name: 'Usage Statistics',
    icon: BarChart3,
    category: 'Core',
    status: 'released',
    description: 'Detailed breakdowns of app usage by category, time period, and productivity type.',
    route: '/stats',
    tutorialSteps: [
      { target: '[data-tutorial="period-selector"]', title: 'Time Period', instruction: 'Switch between day, week, and month views.', position: 'bottom' },
    ],
  },
  {
    id: 'external',
    name: 'External Tracker',
    icon: Moon,
    category: 'Core',
    status: 'released',
    description: 'Manual activity logging, sleep tracking with timeline chart, and focus timer.',
    route: '/external',
    tutorialSteps: [
      { target: '[data-tutorial="sleep-chart"]', title: 'Sleep Timeline', instruction: '24-hour bar view of your sleep patterns. Color-coded by sleep segment.', position: 'top' },
      { target: '[data-tutorial="timer"]', title: 'Focus Timer', instruction: 'Start a focus session timer. Tracks time and category.', position: 'top' },
    ],
  },
  {
    id: 'terminal',
    name: 'Terminal & Agent Sessions',
    icon: Terminal,
    category: 'Tracker Mind',
    status: 'released',
    description: 'AI agent terminal with split panes, session management, and real-time context assembly.',
    route: '/ide',
    tutorialSteps: [
      { target: '[data-tutorial="terminal-pane"]', title: 'Terminal Pane', instruction: 'Type commands or let the AI agent work. Split panes for multitasking.', position: 'right' },
      { target: '[data-tutorial="new-agent"]', title: 'New Agent Session', instruction: 'Click "New Agent" to start an AI session with context from your workspace.', position: 'bottom' },
    ],
  },
  {
    id: 'context',
    name: 'Context Management',
    icon: BookOpen,
    category: 'Tracker Mind',
    status: 'released',
    description: '12 context systems that assemble knowledge into AI prompts: LLM Wiki, Skills, Graphify, PARA, QMD, and more.',
    route: '/ide',
    tutorialSteps: [
      { target: '[data-tutorial="context-tab"]', title: 'Context Sidebar', instruction: 'Open the Context tab in the workspace sidebar to configure all context systems.', position: 'right' },
    ],
  },
  {
    id: 'problems',
    name: 'Problems & Requests',
    icon: AlertTriangle,
    category: 'Tracker Mind',
    status: 'released',
    description: 'Track bugs, feature requests, and their checklists. AI agents can auto-update status.',
    route: '/ide',
    tutorialSteps: [
      { target: '[data-tutorial="problems-tab"]', title: 'Problems Panel', instruction: 'Create, track, and assign problems to AI agents for resolution.', position: 'right' },
    ],
  },
  {
    id: 'design',
    name: 'Design Skills System',
    icon: Palette,
    category: 'Tracker Mind',
    status: 'beta',
    description: 'Frontend design intelligence with taste knobs, style references, and 5 design skills.',
    route: '/ide',
    tutorialSteps: [
      { target: '[data-tutorial="context-tab"]', title: 'Design Configuration', instruction: 'Open Context → Design to adjust taste knobs and toggle design skills.', position: 'right' },
    ],
  },
  {
    id: 'skills',
    name: 'Skills Framework',
    icon: Sparkles,
    category: 'Tracker Mind',
    status: 'released',
    description: 'SKILL.md files define reusable agent behaviors. Browse, create, and compose skills.',
    route: '/ide',
    tutorialSteps: [
      { target: '[data-tutorial="skills-tab"]', title: 'Skills Browser', instruction: 'View and manage all skill definitions. Toggle them for context assembly.', position: 'right' },
    ],
  },
  {
    id: 'graphify',
    name: 'Knowledge Graph',
    icon: Network,
    category: 'Tracker Mind',
    status: 'beta',
    description: 'Automated knowledge graph construction from agent conversations and workspace files.',
    route: '/ide',
    tutorialSteps: [],
  },
  {
    id: 'database',
    name: 'Database Analytics',
    icon: Database,
    category: 'Data',
    status: 'released',
    description: 'Analytics dashboard with charts for tokens, costs, sessions, problems, and daily activity trends.',
    route: '/database',
    tutorialSteps: [
      { target: '[data-tutorial="analytics-toggle"]', title: 'Analytics View', instruction: 'Switch between Analytics charts and raw Tables browser.', position: 'bottom' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    category: 'Core',
    status: 'released',
    description: 'App tracking categories, tracker configuration, external page setup, and preferences.',
    route: '/settings',
    tutorialSteps: [],
  },
];

const CATEGORIES = ['All', 'Core', 'Tracker Mind', 'Data'] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  released: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Released' },
  beta: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Beta' },
  planned: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Planned' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Core: 'from-emerald-500/20 to-emerald-500/5',
  'Tracker Mind': 'from-purple-500/20 to-purple-500/5',
  Data: 'from-blue-500/20 to-blue-500/5',
};

// ─── Progress Persistence ──────────────────────────────────

const PROGRESS_KEY = 'tutorial-progress';

interface TutorialProgress {
  viewedFeatures: string[];
  completedAt: string | null;
}

function loadProgress(): TutorialProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { viewedFeatures: [], completedAt: null };
}

function saveProgress(progress: TutorialProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

// ─── Component ─────────────────────────────────────────────

export default function TutorialPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<TutorialProgress>(loadProgress);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  // ── Filtered features ──────────────────────────────────

  const filteredFeatures =
    selectedCategory === 'All'
      ? FEATURES
      : FEATURES.filter((f) => f.category === selectedCategory);

  const viewedCount = progress.viewedFeatures.length;
  const totalWithSteps = FEATURES.filter((f) => f.tutorialSteps.length > 0).length;
  const isAllComplete = totalWithSteps > 0 && viewedCount >= totalWithSteps;

  // ── Tutorial flow ──────────────────────────────────────

  const startTutorial = useCallback((feature: Feature) => {
    if (feature.tutorialSteps.length === 0) return;
    setActiveFeature(feature);
    setActiveStep(0);
    setShowOverlay(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeFeature) return;
    if (activeStep < activeFeature.tutorialSteps.length - 1) {
      setActiveStep((s) => s + 1);
    } else {
      // Tutorial complete for this feature
      setProgress((prev) => {
        const updated = {
          ...prev,
          viewedFeatures: prev.viewedFeatures.includes(activeFeature.id)
            ? prev.viewedFeatures
            : [...prev.viewedFeatures, activeFeature.id],
        };
        saveProgress(updated);
        return updated;
      });
      setShowOverlay(false);
      setActiveFeature(null);
    }
  }, [activeFeature, activeStep]);

  const prevStep = useCallback(() => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  }, [activeStep]);

  const closeTutorial = useCallback(() => {
    setShowOverlay(false);
    setActiveFeature(null);
  }, []);

  const tryFeature = useCallback(
    (feature: Feature) => {
      // Mark as viewed
      setProgress((prev) => {
        const updated = {
          ...prev,
          viewedFeatures: prev.viewedFeatures.includes(feature.id)
            ? prev.viewedFeatures
            : [...prev.viewedFeatures, feature.id],
        };
        saveProgress(updated);
        return updated;
      });
      navigate(feature.route);
    },
    [navigate]
  );

  const resetProgress = useCallback(() => {
    const cleared: TutorialProgress = { viewedFeatures: [], completedAt: null };
    saveProgress(cleared);
    setProgress(cleared);
  }, []);

  // ── Current tutorial step ──────────────────────────────

  const currentStep = activeFeature?.tutorialSteps[activeStep];

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Features & Tutorial</h1>
              <p className="text-xs text-zinc-500">
                {isAllComplete
                  ? 'All tutorials completed!'
                  : `${viewedCount}/${totalWithSteps} features toured`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${totalWithSteps > 0 ? (viewedCount / totalWithSteps) * 100 : 0}%` }}
              />
            </div>
            {viewedCount > 0 && (
              <button
                onClick={resetProgress}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="px-6 pb-3 flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-zinc-700/60 text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {isAllComplete && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 text-center mb-6 border border-emerald-500/20"
          >
            <Trophy className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-white mb-1">You've completed all tutorials!</h2>
            <p className="text-xs text-zinc-500 mb-3">
              You're now familiar with all of DeskFlow's features.
            </p>
            <button
              onClick={resetProgress}
              className="px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600/50 text-xs text-zinc-300 hover:bg-zinc-600/50 transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Restart tutorials
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeatures.map((feature, i) => {
            const isViewed = progress.viewedFeatures.includes(feature.id);
            const status = STATUS_STYLES[feature.status];
            const gradientClass = CATEGORY_COLORS[feature.category] || 'from-zinc-500/20 to-zinc-500/5';

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="glass rounded-2xl overflow-hidden border border-zinc-700/30 hover:border-zinc-600/50 transition-all group"
              >
                {/* Gradient top strip */}
                <div className={`h-1 bg-gradient-to-r ${gradientClass}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
                        <feature.icon className="w-4 h-4 text-zinc-300" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{feature.name}</h3>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    {isViewed && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                    {feature.description}
                  </p>

                  <div className="flex items-center gap-2">
                    {feature.tutorialSteps.length > 0 && (
                      <button
                        onClick={() => startTutorial(feature)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-700/40 border border-zinc-600/30 text-[11px] text-zinc-300 hover:bg-zinc-600/40 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        Tutorial
                        <span className="text-zinc-600">({feature.tutorialSteps.length})</span>
                      </button>
                    )}
                    <button
                      onClick={() => tryFeature(feature)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/30 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Try it
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Tutorial Overlay ── */}
      <TutorialOverlay
        isVisible={showOverlay}
        step={currentStep || null}
        stepIndex={activeStep}
        totalSteps={activeFeature?.tutorialSteps.length || 0}
        featureName={activeFeature?.name || ''}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={closeTutorial}
        onTryIt={() => activeFeature && tryFeature(activeFeature)}
      />
    </div>
  );
}
```

---

## File 3: `src/components/TutorialOverlay.tsx`

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, ExternalLink, Check } from 'lucide-react';

interface TutorialStep {
  target: string;
  title: string;
  instruction: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialOverlayProps {
  isVisible: boolean;
  step: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  featureName: string;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onTryIt: () => void;
}

export default function TutorialOverlay({
  isVisible,
  step,
  stepIndex,
  totalSteps,
  featureName,
  onNext,
  onPrev,
  onClose,
  onTryIt,
}: TutorialOverlayProps) {
  if (!isVisible || !step) return null;

  const isLastStep = stepIndex === totalSteps - 1;

  // Position the tooltip relative to center (since we can't query DOM elements from here)
  const positionClasses: Record<string, string> = {
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    top: 'top-[15%] left-1/2 -translate-x-1/2',
    bottom: 'bottom-[15%] left-1/2 -translate-x-1/2',
    left: 'top-1/2 left-[10%] -translate-y-1/2',
    right: 'top-1/2 right-[10%] -translate-y-1/2',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Spotlight circle (decorative, centered) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border-2 border-amber-400/30 bg-amber-400/5 shadow-[0_0_60px_rgba(245,158,11,0.15)]" />

          {/* Instruction tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className={`absolute ${positionClasses[step.position] || positionClasses.center} w-full max-w-sm`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <div className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">
                    {featureName}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instruction */}
              <div className="px-4 pb-3">
                <p className="text-xs text-zinc-400 leading-relaxed">{step.instruction}</p>
              </div>

              {/* Progress dots */}
              <div className="px-4 pb-3 flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === stepIndex
                        ? 'w-4 bg-amber-400'
                        : i < stepIndex
                        ? 'w-1.5 bg-emerald-500'
                        : 'w-1.5 bg-zinc-700'
                    }`}
                  />
                ))}
                <span className="text-[10px] text-zinc-600 ml-2">
                  {stepIndex + 1} of {totalSteps}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border-t border-zinc-700/50">
                <button
                  onClick={onPrev}
                  disabled={stepIndex === 0}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors disabled:opacity-30 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onTryIt}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-700/40 border border-zinc-600/30 text-[11px] text-zinc-300 hover:bg-zinc-600/40 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Try it
                  </button>

                  {isLastStep ? (
                    <button
                      onClick={onNext}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium text-white transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Done
                    </button>
                  ) : (
                    <button
                      onClick={onNext}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-[11px] font-medium text-white transition-colors flex items-center gap-1"
                    >
                      Next
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## File 4: Modifications to `src/pages/IDEProjectsPage.tsx`

### Step 1: Replace WorkspaceSettingsDialog import with ContextSidebar

Find the import of `WorkspaceSettingsDialog` and replace it:

```tsx
// REMOVE:
import WorkspaceSettingsDialog from '../components/WorkspaceSettingsDialog';

// ADD:
import ContextSidebar from '../components/ContextSidebar';
```

### Step 2: Remove showSetupModal state

Find and remove:

```tsx
const [showSetupModal, setShowSetupModal] = useState(false);
```

### Step 3: Replace the Setup button handler

The Setup button should now switch to the "Context" sidebar tab instead of opening a modal. Find the Setup button `onClick` and change it:

```tsx
// BEFORE:
onClick={() => setShowSetupModal(true)}

// AFTER:
onClick={() => {
  // Switch to the Context tab in the workspace sidebar
  window.dispatchEvent(new CustomEvent('switch-sidebar-tab', { detail: 'context' }));
}}
```

### Step 4: Remove WorkspaceSettingsDialog rendering

Find and remove the `<WorkspaceSettingsDialog>` JSX block.

### Step 5: Add ContextSidebar to the sidebar tabs

In the TerminalPage workspace sidebar (where the tab buttons and tab content are rendered), add a "Context" tab. Find the tab definitions and add:

```tsx
// In the tab buttons array, add:
{ id: 'context', label: 'Context', icon: Settings2 }

// In the tab content area, add:
{activeTab === 'context' && (
  <ContextSidebar
    projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path}
    projectId={selectedProject || undefined}
  />
)}
```

### Step 6: Listen for switch-sidebar-tab event

In TerminalPage's `useEffect` that handles custom events, add:

```tsx
const handleSwitchTab = (e: CustomEvent) => {
  if (e.detail === 'context') {
    setActiveTab('context');
  }
};
window.addEventListener('switch-sidebar-tab', handleSwitchTab as EventListener);
// Clean up in the return:
window.removeEventListener('switch-sidebar-tab', handleSwitchTab as EventListener);
```

---

## File 5: Modifications to `src/App.tsx`

Add the `/tutorial` route:

```tsx
import TutorialPage from './pages/TutorialPage';

// In the routes, add:
<Route path="/tutorial" element={<TutorialPage />} />
```

---

## File 6: Add Help Button to Main Navigation

In whichever component renders the main sidebar navigation (likely `App.tsx` or a `Sidebar` component), add a help/tutorial button:

```tsx
import { HelpCircle } from 'lucide-react';

// In the navigation items, add:
<button
  onClick={() => navigate('/tutorial')}
  className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all"
  title="Features & Tutorial"
>
  <HelpCircle className="w-5 h-5" />
</button>
```

---

## File 7: Modifications to `src/components/NewSessionDialog.tsx`

### Step 1: Add import for preference key

```tsx
import { WORKSPACE_CONFIG_PREF_KEY } from './ContextSidebar';
```

### Step 2: Load ALL workspace settings as defaults

The existing `useEffect` that loads `workspace-context-config` should also load the new preference keys. Find the existing load logic and expand it:

```tsx
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const api = (window as any).deskflowAPI;
      const prefs = await api?.getPreferences?.();
      if (cancelled) return;

      // Load workspace context config (existing)
      if (prefs?.[WORKSPACE_CONFIG_PREF_KEY]) {
        const wsConfig = JSON.parse(prefs[WORKSPACE_CONFIG_PREF_KEY]);
        // ... existing pre-population logic ...
      }

      // Load workspace defaults
      if (prefs?.['workspace-defaults']) {
        const defaults = JSON.parse(prefs['workspace-defaults']);
        if (defaults.defaultModelTier) setModelTier(defaults.defaultModelTier);
        if (defaults.defaultTokenBudget) setTokenBudget(defaults.defaultTokenBudget);
      }

      // Load terminal communication defaults
      if (prefs?.['terminal-communication-config']) {
        const termConfig = JSON.parse(prefs['terminal-communication-config']);
        if (termConfig.defaultAgentType) setNewSessionAgent(termConfig.defaultAgentType);
        if (termConfig.agentCliFlags) setAgentCliFlags(termConfig.agentCliFlags);
      }

      // Load model improvisation (from localStorage, not preferences)
      const modelRaw = localStorage.getItem('model-improvisation-config');
      if (modelRaw) {
        const modelConfig = JSON.parse(modelRaw);
        // These can be shown in an "Advanced" section of the dialog
        if (modelConfig.temperature != null) setTemperature(modelConfig.temperature);
        if (modelConfig.maxResponseTokens != null) setMaxResponseTokens(modelConfig.maxResponseTokens);
      }
    } catch (e) {
      console.warn('[NewSessionDialog] Could not load workspace settings:', e);
    }
  })();
  return () => { cancelled = true; };
}, []);
```

**Note:** The exact state variable names (`setModelTier`, `setTokenBudget`, `setAgentCliFlags`, `setTemperature`, `setMaxResponseTokens`) must be adapted to match NewSessionDialog's actual state. Some of these may need to be added as new state variables if they don't exist yet.

### Step 3: Remove redundant design taste knobs from the dialog

Since the Context Sidebar is now the canonical place for design skills configuration, the NewSessionDialog should show a simplified version — just a note that says "Using workspace defaults" with a link to "Edit in Context sidebar", plus an override toggle.

Find the Design Skills section in NewSessionDialog and simplify it to:

```tsx
{/* Design Skills — Quick Override */}
<div className="rounded-xl p-3 bg-pink-500/5 border border-pink-500/20">
  <div className="flex items-center justify-between mb-1">
    <div className="flex items-center gap-2">
      <Palette className="w-4 h-4 text-pink-400" />
      <span className="text-xs font-medium text-zinc-200">Design Skills</span>
    </div>
    <Toggle on={designSkillsEnabled} onToggle={() => setDesignSkillsEnabled(!designSkillsEnabled)} />
  </div>
  <p className="text-[10px] text-zinc-600">
    {designSkillsEnabled
      ? 'Using workspace defaults (V:' + designVariance + ' M:' + motionIntensity + ' D:' + visualDensity + ')'
      : 'Disabled for this session'}
  </p>
  <button
    onClick={() => window.dispatchEvent(new CustomEvent('switch-sidebar-tab', { detail: 'context' }))}
    className="text-[10px] text-pink-400 hover:text-pink-300 mt-1 flex items-center gap-1 transition-colors"
  >
    <Settings2 className="w-3 h-3" />
    Edit in Context sidebar
  </button>
</div>
```

---

## Summary of All Changes

### New Files

| File | Purpose |
|------|---------|
| `src/components/ContextSidebar.tsx` | Persistent sidebar panel replacing WorkspaceSettingsDialog. 6 sections: Systems, Design, Model, Paths, Terminal, Defaults. All auto-save via preferences. |
| `src/pages/TutorialPage.tsx` | Feature inventory + interactive tutorials. 12 features with category filters, progress tracking, "Try it" navigation. |
| `src/components/TutorialOverlay.tsx` | Spotlight overlay for guided tutorials. Progress dots, Back/Next/Try it actions, position-aware tooltip. |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/IDEProjectsPage.tsx` | Replace WorkspaceSettingsDialog with ContextSidebar. Setup button → switches to Context sidebar tab. Remove modal state. |
| `src/pages/TerminalPage.tsx` | Add "Context" sidebar tab with ContextSidebar component. Listen for `switch-sidebar-tab` event. |
| `src/App.tsx` | Add `/tutorial` route. Add Help icon to navigation. |
| `src/components/NewSessionDialog.tsx` | Load all 4 preference keys as defaults. Simplify design skills section to "using workspace defaults" + link to sidebar. |

### Removed Files

| File | Reason |
|------|--------|
| `src/components/WorkspaceSettingsDialog.tsx` | Replaced by ContextSidebar (persistent sidebar, not modal) |

### New Preference Keys

| Key | Storage | Shape |
|-----|---------|-------|
| `workspace-context-config` | setPreference | `{ systems, behaviors }` (existing) |
| `model-improvisation-config` | setPreference | `{ temperature, maxResponseTokens, topP, frequencyPenalty, presencePenalty }` |
| `workspace-file-paths` | setPreference | `{ agentPath, skillsDir, graphifyOut, paraVault, qmdTemplates, automationsFile, deepMemoryFile, sessionSummariesFile, designReferences }` |
| `terminal-communication-config` | setPreference | `{ defaultAgentType, agentCliFlags, systemPromptPrefix, messageLineEnding, contextSharingBetweenTerminals, autoCreateTerminalOnSessionStart, terminalCloseBehavior }` |
| `workspace-defaults` | setPreference | `{ autoInitializeOnOpen, autoSaveContextOnClose, defaultModelTier, defaultTokenBudget, sessionSummaryFrequency }` |
| `tutorial-progress` | localStorage | `{ viewedFeatures[], completedAt }` |

### Data Flow

```
Context Sidebar (canonical)
  ├─ workspace-context-config  →  NewSessionDialog loads as defaults
  ├─ workspace-defaults        →  NewSessionDialog loads model tier + token budget
  ├─ terminal-communication    →  NewSessionDialog loads agent type + CLI flags
  ├─ model-improvisation       →  Applied when context is sent to terminal
  └─ workspace-file-paths      →  Future: ContextService reads custom paths

Tutorial Page
  └─ tutorial-progress (localStorage)
       ├─ Tracks viewed features
       └─ Determines completion state

Setup Button (IDE header)
  → dispatches 'switch-sidebar-tab' with detail='context'
  → TerminalPage switches to Context tab
  → ContextSidebar renders with all 6 sections
```