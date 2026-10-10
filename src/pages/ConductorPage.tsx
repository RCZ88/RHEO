import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Play, Square, AlertTriangle, User, Info, Pause, RotateCcw, X, FolderOpen, ChevronRight } from 'lucide-react';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import OrgTreeGraph, { type ConductorNodeVM, type ConductorMessageVM } from '../components/conductor/OrgTreeGraph';
import ApprovalInbox, { type EscalationItemVM, type EscalationReasonVM } from '../components/conductor/ApprovalInbox';
import SwarmTrace, { type SwarmTraceMessageVM } from '../components/conductor/SwarmTrace';

interface MissionSummary {
  id: string;
  repoRoot: string;
  objective: string;
  status: string;
  autonomyLevel: string;
  nodeCount: number;
  activeCount: number;
  pendingEscalations: number;
  createdAt: number;
}

interface Snapshot {
  id: string;
  repoRoot: string;
  objective: string;
  agentType: string;
  autonomyLevel: string;
  status: string;
  nodes: ConductorNodeVM[];
  messages: ConductorMessageVM[];
  escalations: EscalationItemVM[];
  pendingChildren: number;
  createdAt: number;
}

interface Project {
  id?: number;
  path: string;
  name?: string;
}

type ConductorPageState = 'loading-projects' | 'no-projects' | 'project-selected' | 'error';

const API = (window as any).deskflowAPI;
const AGENT_OPTIONS = ['opencode', 'claude'];
const AGENT_LABEL: Record<string, string> = {
  opencode: 'Opencode',
  claude: 'Claude Code',
};

function pullTrace(msgs: ConductorMessageVM[]): SwarmTraceMessageVM[] {
  return msgs.map((m) => ({ id: m.id, ts: m.ts, from: m.from, to: m.to, type: m.type, summary: m.summary }));
}

export default function ConductorPage() {
  const [pageState, setPageState] = useState<ConductorPageState>('loading-projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [swarmLog, setSwarmLog] = useState<SwarmTraceMessageVM[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showNewMission, setShowNewMission] = useState(false);
  const [newObjective, setNewObjective] = useState('');
  const [newAgentType, setNewAgentType] = useState('claude');
  const [newAutonomy, setNewAutonomy] = useState('L3');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snap = snapshot;

  const loadProjects = useCallback(async () => {
    try {
      const list: Project[] = await API?.getProjects?.() ?? [];
      setProjects(list);
      if (list.length === 0) {
        setPageState('no-projects');
      } else if (!selectedProject) {
        setPageState('project-selected');
      }
    } catch (e: any) {
      setError(e.message);
      setPageState('no-projects');
    }
  }, [selectedProject]);

  const loadMissions = useCallback(async () => {
    try {
      const result = await API?.conductorListMissions?.();
      if (result?.success) {
        const list: MissionSummary[] = (result.data || []).filter(
          (m: MissionSummary) => m.repoRoot === selectedProject?.path
        );
        setMissions(list);
        if (activeMissionId && !list.find((m) => m.id === activeMissionId)) {
          setActiveMissionId(null);
        }
      }
    } catch { }
  }, [selectedProject, activeMissionId]);

  const pollSnapshot = useCallback(async () => {
    if (!activeMissionId) return;
    try {
      const result = await API?.conductorGetSnapshot?.(activeMissionId);
      if (result?.success && result.data) {
        const s = result.data as Snapshot;
        setSnapshot(s);
        setSwarmLog(pullTrace(s.messages || []));
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [activeMissionId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadMissions();
    }
  }, [selectedProject, loadMissions]);

  useEffect(() => {
    if (activeMissionId) {
      pollSnapshot();
      pollRef.current = setInterval(pollSnapshot, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setSnapshot(null);
      setSwarmLog([]);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeMissionId, pollSnapshot]);

  async function handleStartMission() {
    if (!newObjective.trim() || !selectedProject) return;
    setError(null);
    try {
      const result = await API?.conductorStart?.({
        repoRoot: selectedProject.path,
        objective: newObjective.trim(),
        agentType: newAgentType,
        autonomyLevel: newAutonomy,
      });
      if (result?.success) {
        setNewObjective('');
        setShowNewMission(false);
        await loadMissions();
        if (result.data?.id) {
          setActiveMissionId(result.data.id);
        }
      } else {
        setError(result?.error || 'Failed to start mission');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleKillMission(id: string) {
    try {
      const result = await API?.conductorKill?.(id);
      if (result?.success) {
        if (activeMissionId === id) setActiveMissionId(null);
        await loadMissions();
      } else {
        setError(result?.error || 'Failed to kill mission');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handlePauseMission(id: string) {
    try {
      await API?.conductorPause?.(id);
      await loadMissions();
    } catch { }
  }

  async function handleResumeMission(id: string) {
    try {
      await API?.conductorResume?.(id);
      await loadMissions();
    } catch { }
  }

  async function handleResolveEscalation(escalationId: string, decision: 'approved' | 'rejected', note?: string) {
    if (!activeMissionId) return;
    try {
      await API?.conductorResolveEscalation?.(activeMissionId, escalationId, decision, note);
    } catch { }
  }

  function handleSelectActor(actorId: string) { }

  const selectedNode = snap ? (snap.nodes || []).find((n) => n.id === 'dummy') : null;

  function selectProject(p: Project) {
    setSelectedProject(p);
    setActiveMissionId(null);
    setShowProjectPicker(false);
  }

  function renderProjectPicker() {
    return (
      <div className="relative">
        <button
          onClick={() => setShowProjectPicker(!showProjectPicker)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
        >
          <FolderOpen size={14} className="text-zinc-400" />
          {selectedProject ? selectedProject.name || selectedProject.path.split('\\').pop() || selectedProject.path : 'Select a project'}
          <ChevronRight size={12} className={`text-zinc-500 transition-transform ${showProjectPicker ? 'rotate-90' : ''}`} />
        </button>
        {showProjectPicker && (
          <div className="absolute top-full left-0 mt-1 w-80 max-h-48 overflow-y-auto bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-lg shadow-xl z-50">
            {projects.map((p, i) => (
              <button
                key={p.path || i}
                onClick={() => selectProject(p)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${selectedProject?.path === p.path ? 'text-cyan-400 bg-zinc-800/50' : 'text-zinc-300'}`}
              >
                <span className="font-medium">{p.name || p.path.split('\\').pop() || p.path}</span>
                <span className="block text-[10px] text-zinc-500 truncate">{p.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderHeader() {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-cyan-400" />
            <span className="text-sm font-semibold text-zinc-200">Conductor</span>
          </div>
          {renderProjectPicker()}
          {snap && snap.status === 'running' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Running · {snap.nodes?.length || 0} agents
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {snap && (
            <div className="relative flex items-center gap-1 mr-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-[10px] text-amber-400 font-medium" style={{ opacity: (snap.escalations || []).filter((e: any) => e.status === 'pending').length > 0 ? 1 : 0.3 }}>
                {(snap.escalations || []).filter((e: any) => e.status === 'pending').length} pending
              </span>
            </div>
          )}
          {!activeMissionId && selectedProject && (
            <button
              onClick={() => setShowNewMission(true)}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-medium text-zinc-950"
            >
              <Play size={12} /> New Mission
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderMissionCard(m: MissionSummary) {
    const isActive = m.id === activeMissionId;
    const isRunning = m.status === 'running';
    const isPaused = m.status === 'paused';
    return (
      <button
        key={m.id}
        onClick={() => setActiveMissionId(isActive ? null : m.id)}
        className={`w-full text-left rounded-lg border p-3 transition-all ${isActive ? 'border-cyan-500/50 bg-zinc-800/60' : 'border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] hover:border-zinc-600'}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-zinc-200 truncate flex-1">{m.objective}</span>
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isRunning ? 'bg-green-500/15 text-green-400' :
            isPaused ? 'bg-amber-500/15 text-amber-400' :
            'bg-zinc-700/50 text-zinc-400'
          }`}>
            {m.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span>{m.nodeCount} nodes · {m.activeCount} active</span>
          <span>{m.autonomyLevel}</span>
          {m.pendingEscalations > 0 && (
            <span className="text-amber-400">{m.pendingEscalations} escalations</span>
          )}
          <span className="ml-auto">{new Date(m.createdAt).toLocaleTimeString()}</span>
        </div>
      </button>
    );
  }

  function renderMissionList() {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {missions.length === 0 ? (
          <div className="text-center py-8">
            <Bot size={24} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-xs text-zinc-500 mb-3">No missions for this project</p>
            <button
              onClick={() => setShowNewMission(true)}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-zinc-950"
            >
              <Play size={12} /> Start your first mission
            </button>
          </div>
        ) : (
          missions.map(renderMissionCard)
        )}
      </div>
    );
  }

  function renderMissionDetail() {
    if (!snap) return <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Loading snapshot...</div>;
    const pendingEscs = (snap.escalations || []).filter((e: any) => e.status === 'pending');
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-300 font-medium truncate max-w-[200px]">{snap.objective}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{snap.agentType}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{snap.autonomyLevel}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{snap.nodes?.length || 0} nodes</span>
          </div>
          <div className="flex items-center gap-1.5">
            {snap.status === 'running' && (
              <button onClick={() => handlePauseMission(snap.id)} className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700" title="Pause"><Pause size={11} /></button>
            )}
            {snap.status === 'paused' && (
              <button onClick={() => handleResumeMission(snap.id)} className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700" title="Resume"><RotateCcw size={11} /></button>
            )}
            <button onClick={() => handleKillMission(snap.id)} className="rounded-md bg-red-900/30 px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/50" title="Kill"><Square size={11} /></button>
            <button onClick={() => setActiveMissionId(null)} className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700"><X size={11} /></button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-auto px-1 py-1">
              <OrgTreeGraph
                nodes={snap.nodes || []}
                recentMessages={snap.messages || []}
                selectedId={null}
                onSelect={() => {}}
              />
            </div>
            {selectedNode && (
              <div className="border-t border-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-medium text-zinc-200">{selectedNode.id}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{selectedNode.objective}</span>
                </div>
              </div>
            )}
          </div>
          <div className="w-60 flex-shrink-0 border-l border-zinc-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2.5">
              <ApprovalInbox escalations={pendingEscs} onResolve={handleResolveEscalation} />
            </div>
          </div>
        </div>
        <div className="h-36 border-t border-zinc-800 flex-shrink-0 overflow-y-auto">
          <SwarmTrace messages={swarmLog} onSelectActor={handleSelectActor} />
        </div>
      </div>
    );
  }

  function renderNewMissionDialog() {
    if (!showNewMission) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-xl w-96 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">New Mission</span>
            <button onClick={() => setShowNewMission(false)} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Objective</label>
              <VoiceInputWrapper>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="What should the swarm accomplish?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500"
                />
              </VoiceInputWrapper>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-zinc-400 block mb-1">Agent Type</label>
                <select
                  value={newAgentType}
                  onChange={(e) => setNewAgentType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                >
                  {AGENT_OPTIONS.map((a) => <option key={a} value={a}>{AGENT_LABEL[a] || a}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="text-[11px] text-zinc-400 block mb-1">Autonomy</label>
                <select
                  value={newAutonomy}
                  onChange={(e) => setNewAutonomy(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                >
                  <option value="L2">L2 (Guarded)</option>
                  <option value="L3">L3 (Standard)</option>
                  <option value="L4">L4 (High)</option>
                </select>
              </div>
            </div>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button onClick={() => setShowNewMission(false)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">Cancel</button>
            <button
              onClick={handleStartMission}
              disabled={!newObjective.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-40"
            >
              <Play size={12} /> Start Mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'loading-projects') {
    return (
      <div className="flex flex-col h-full bg-zinc-950 light:bg-[var(--ws-surface)]/80">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Loading projects...</div>
      </div>
    );
  }

  if (pageState === 'no-projects') {
    return (
      <div className="flex flex-col h-full bg-zinc-950 light:bg-[var(--ws-surface)]/80">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderOpen size={28} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-xs text-zinc-500 mb-1">No projects found</p>
            <p className="text-[10px] text-zinc-600">Add a project in the IDE page first</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 light:bg-[var(--ws-surface)]/80">
      {renderHeader()}
      {activeMissionId ? renderMissionDetail() : renderMissionList()}
      {renderNewMissionDialog()}
    </div>
  );
}
