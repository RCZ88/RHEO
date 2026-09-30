import { motion } from 'framer-motion';
import { Settings, Database, Clock, Download, Trash2, RefreshCw, Terminal, ChevronRight, X, Plus, GripVertical, Palette, Check, ChevronDown, Globe, ChevronLeft, Search, AlertTriangle, Sparkles, ChevronUp, Loader2, Eye, EyeOff, DollarSign, Shield, Key, Save, Lock, LockOpen, History, Undo2, Pencil, Upload, FileText, SearchX, Inbox, Keyboard, Monitor, WandSparkles, Brain, Compass, Route, Network, Cpu, Activity, MapPin, Package, TrendingUp, BadgeInfo, Volume2, Mic, Headphones, Gamepad, Calculator, PieChart, BarChart3, Gauge, ArrowRight, ArrowUp, Zap } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSection } from './shared';
import { SectionHeader } from '../../components/SectionHeader';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/ui/button';
import { DEFAULT_SYSTEM_PROMPT } from '../../lib/defaults';
import { migrateSystemPrompts, projectKey } from '../../lib/promptAssembly';
import { useEffect } from 'react';

export function PromptsSection(props: any) {
  const {
    systemPrompts, setSystemPrompts, promptProjectId, setPromptProjectId,
    promptProjects, setPromptProjects, handleSaveSystemPrompt,
    resumeCommands, setResumeCommands, handleSaveResumeCommand,
    DEFAULT_RESUME_COMMANDS, AGENTS,
    settingsSearch,
  } = props;

  useEffect(() => {
    const loadPrompts = async () => {
      if (window.deskflowAPI?.getPreferences) {
        const prefs = await window.deskflowAPI.getPreferences();
        if (prefs?.systemPrompts) {
          const migrated = migrateSystemPrompts(prefs.systemPrompts);
          setSystemPrompts({ claude: '', opencode: '', custom: '', generalAdditions: '', ...migrated });
          if (prefs.systemPrompts.__v !== '2' && window.deskflowAPI?.setPreference) {
            window.deskflowAPI.setPreference('systemPrompts', migrated);
          }
        }
      }
    };
    loadPrompts();
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      if (window.deskflowAPI?.getProjects) {
        const data = await window.deskflowAPI.getProjects();
        if (Array.isArray(data)) {
          setPromptProjects(data.filter((p: any) => !p.deleted_at).map((p: any) => ({ id: p.id, name: p.name })));
          if (data.length > 0) setPromptProjectId(data[0].id);
        }
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (window.deskflowAPI?.getPreferences) {
        const prefs = await window.deskflowAPI.getPreferences();
        if (prefs?.agentResumeCommands) setResumeCommands(prev => ({ ...prev, ...prefs.agentResumeCommands }));
      }
    };
    load();
  }, []);

  return (
    <div data-section="settings.prompts" className="space-y-6">
      {/* 1. DEFAULT (read-only) */}
      <SearchableSection terms={['default', 'baseline', 'app baseline']} search={settingsSearch}>
      <GlassCard>
        <div><h3 className="text-cyan-400 font-semibold">Default · app baseline</h3><p className="text-sm text-zinc-500">Always applied first to every agent and project. Edit in agent/DEFAULT_SYSTEM_PROMPT.md.</p></div>
        <details className="mt-2 group">
          <summary className="text-sm font-medium text-zinc-400 hover:text-zinc-300 cursor-pointer select-none list-none flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />View default prompt</summary>
          <div className="mt-2 bg-zinc-900/80 light:bg-white/60 rounded-lg border border-zinc-700/50 p-3 max-h-48 overflow-y-auto"><pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap">{DEFAULT_SYSTEM_PROMPT}</pre></div>
        </details>
      </GlassCard>
      </SearchableSection>

      {/* 2. GENERAL (generalAdditions) */}
      <SearchableSection terms={['general', 'instructions', 'general additions']} search={settingsSearch}>
      <GlassCard>
        <div><h3 className="text-blue-400 font-semibold">General · all projects · all agents</h3><p className="text-sm text-zinc-500">Reusable instructions saved to the app and applied on every project.</p></div>
        <textarea value={systemPrompts.generalAdditions || ''} onChange={(e) => setSystemPrompts((p) => ({ ...p, generalAdditions: e.target.value }))} onBlur={() => handleSaveSystemPrompt('generalAdditions', systemPrompts.generalAdditions || '')} placeholder={'App-wide instructions appended after the default, before agent/project layers...'} rows={4}
          className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors duration-150" />
      </GlassCard>
      </SearchableSection>

      {/* 3. AGENT-TYPE (claude/opencode/custom) */}
      <SearchableSection terms={['agent', 'agent-type', 'claude', 'opencode', 'custom agent']} search={settingsSearch}>
      <GlassCard>
        <div><h3 className="text-emerald-400 font-semibold">Agent-type · only this agent</h3><p className="text-sm text-zinc-500">Applied only when a session uses this agent type. Stacks on top of Default + General.</p></div>
        <div className="mt-2 space-y-4">
          {['claude', 'opencode', 'custom'].map((agent) => {
            const additions = systemPrompts[agent] || '';
            return (
              <div key={agent} className="p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-zinc-300 capitalize">{agent === 'custom' ? 'Custom AI' : agent}</label><button onClick={() => handleSaveSystemPrompt(agent, '')} className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-400 rounded transition-colors">Clear</button></div>
                <textarea value={additions} onChange={(e) => setSystemPrompts(prev => ({ ...prev, [agent]: e.target.value }))} onBlur={() => handleSaveSystemPrompt(agent, systemPrompts[agent] || '')} placeholder={`Instructions applied only to ${agent} sessions...`} rows={4}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors duration-150" />
              </div>
            );
          })}
        </div>
      </GlassCard>
      </SearchableSection>

      {/* 4. PROJECT (project:<id>) */}
      <SearchableSection terms={['project', 'project prompt']} search={settingsSearch}>
      <GlassCard>
        <div><h3 className="text-purple-400 font-semibold">Project · only the selected project</h3><p className="text-sm text-zinc-500">Applied only to the chosen project. Highest precedence.</p></div>
        <div className="mt-2">
          <select value={promptProjectId} onChange={(e) => setPromptProjectId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50">
            {promptProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <textarea value={systemPrompts[projectKey(promptProjectId)] || ''} onChange={(e) => setSystemPrompts((p) => ({ ...p, [projectKey(promptProjectId)]: e.target.value }))} onBlur={() => handleSaveSystemPrompt(projectKey(promptProjectId), systemPrompts[projectKey(promptProjectId)] || '')} placeholder={'Instructions applied only to this project...'} rows={4}
            className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors duration-150" />
        </div>
      </GlassCard>
      </SearchableSection>

      <SearchableSection terms={['resume', 'commands', 'agent resume']} search={settingsSearch}>
      <GlassCard>
        <div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-semibold">Agent Resume Commands</h2><p className="text-xs text-zinc-500">Template for resuming AI agent sessions. Use <code className="text-cyan-400">{'{agent}'}</code> and <code className="text-cyan-400">{'{resumeId}'}</code> as placeholders.</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AGENTS.map(agent => {
            const cmd = resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}';
            return (
              <div key={agent} className="p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30">
                <label className="text-sm font-medium text-zinc-300 capitalize block mb-1.5">{agent}</label>
                <div className="flex gap-2">
                  <input value={cmd} onChange={(e) => setResumeCommands(prev => ({ ...prev, [agent]: e.target.value }))} onBlur={() => handleSaveResumeCommand(agent, resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}')} placeholder="{agent} -s {resumeId}"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors duration-150" />
                  <button onClick={() => handleSaveResumeCommand(agent, resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}')} className="px-2.5 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors shrink-0">Save</button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">Result: <code className="text-emerald-400">{cmd.replace('{agent}', agent).replace('{resumeId}', 'abc123')}</code></p>
              </div>
            );
          })}
        </div>
      </GlassCard>
      </SearchableSection>
    </div>
  );
}