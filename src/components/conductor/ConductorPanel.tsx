import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Plus, ArrowUpCircle, ChevronLeft, GitBranch, AlertTriangle } from 'lucide-react';
import OrgTreeGraph, { ConductorNodeVM, ConductorMessageVM } from './OrgTreeGraph';
import ApprovalInbox from './ApprovalInbox';
import SwarmTrace from './SwarmTrace';

interface MissionSummary {
  id: string;
  repoRoot: string;
  objective: string;
  agentType: string;
  autonomyLevel: 'L2' | 'L3' | 'L4';
  status: string;
  nodeCount: number;
  activeCount: number;
  pendingEscalations: number;
  createdAt: number;
}

interface EscalationItemVM {
  id: string;
  missionId: string;
  nodeId: string | null;
  reason: string;
  detail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt?: number;
  note?: string;
}

interface MissionSnapshot {
  id: string;
  repoRoot: string;
  objective: string;
  agentType: string;
  autonomyLevel: 'L2' | 'L3' | 'L4';
  status: 'running' | 'paused' | 'killed';
  userBranch: string;
  integrationBranch: string;
  nodes: ConductorNodeVM[];
  messages: ConductorMessageVM[];
  escalations: EscalationItemVM[];
  pendingChildren: unknown[];
  createdAt: number;
}

type PanelView = 'list' | 'detail' | 'new-mission';

const AGENT_OPTIONS = ['opencode', 'claude'];

const AUTONOMY_LABEL: Record<string, string> = {
  L2: 'L2 — Ask to approve',
  L3: 'L3 — Act then notify',
  L4: 'L4 — Full autonomy',
};

const STATUS_COLOR: Record<string, string> = {
  running: '#22d3ee',
  paused: '#f59e0b',
  killed: '#ef4444',
  completed: '#10b981',
  failed: '#ef4444',
};

function dotColor(status: string): string {
  return STATUS_COLOR[status] || '#71717a';
}

export default function ConductorPanel({ projectId, projectPath }: { projectId: string; projectPath: string }) {
  const [view, setView] = useState<PanelView>('list');
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const [objective, setObjective] = useState('');
  const [agentType, setAgentType] = useState('claude');
  const [autonomy, setAutonomy] = useState<'L2' | 'L3' | 'L4'>('L3');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const api = (window as any).deskflowAPI;

  const loadMissions = useCallback(async () => {
    if (!api?.conductorListMissions) return;
    try {
      const res = await api.conductorListMissions();
      if (res?.success) {
        const filtered = (res.data || []).filter((m: MissionSummary) => m.repoRoot === projectPath);
        setMissions(filtered);
      }
    } catch {}
  }, [projectPath]);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  const loadSnapshot = useCallback(async (missionId: string) => {
    if (!api?.conductorGetSnapshot) return;
    try {
      const res = await api.conductorGetSnapshot(missionId);
      if (res?.success) setSnapshot(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadSnapshot(selectedId);
      const interval = setInterval(() => loadSnapshot(selectedId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedId, loadSnapshot]);

  const handleStart = async () => {
    if (!objective.trim() || !projectPath || !api?.conductorStart) return;
    setStarting(true);
    setError('');
    try {
      const res = await api.conductorStart({ repoRoot: projectPath, objective: objective.trim(), agentType, autonomyLevel: autonomy });
      if (res?.success) {
        setObjective('');
        setView('list');
        setSelectedId(res.data.id);
        await loadMissions();
      } else {
        setError(res?.error || 'Failed to start mission');
      }
    } catch (e: any) {
      setError(e.message || 'Error starting mission');
    } finally {
      setStarting(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!selectedId || !api) return;
    const methodMap: Record<string, string> = {
      pause: 'conductorPause',
      resume: 'conductorResume',
      kill: 'conductorKill',
      promote: 'conductorPromoteIntegration',
    };
    const method = methodMap[action];
    if (!method) return;
    try {
      const res = await api[method](selectedId);
      if (res?.success && res.data) setSnapshot(res.data);
      setTimeout(loadMissions, 500);
    } catch {}
  };

  const handleResolve = async (escalationId: string, decision: 'approved' | 'rejected', note?: string) => {
    if (!selectedId || !api?.conductorResolveEscalation) return;
    try {
      const res = await api.conductorResolveEscalation(selectedId, escalationId, decision, note);
      if (res?.success && res.data) setSnapshot(res.data);
    } catch {}
  };

  const handleSelectMission = (id: string) => {
    setSelectedId(id);
    setSelectedNodeId(null);
    setView('detail');
  };

  const missionForId = missions.find(m => m.id === selectedId);

  if (view === 'new-mission') {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200">
          <ChevronLeft size={12} /> Back to missions
        </button>
        <div className="text-xs font-semibold text-zinc-200">New Mission</div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500">Objective</label>
          <textarea
            value={objective}
            onChange={e => setObjective(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-green-500"
            placeholder="What should the swarm accomplish?"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500">Agent</label>
          <select value={agentType} onChange={e => setAgentType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-green-500">
            {AGENT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500">Autonomy</label>
          <select value={autonomy} onChange={e => setAutonomy(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-green-500">
            {Object.entries(AUTONOMY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
        <button
          onClick={handleStart}
          disabled={starting || !objective.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-green-50 text-xs font-medium rounded transition-colors active:scale-95"
        >
          {starting ? 'Starting...' : 'Start Mission'}
        </button>
      </div>
    );
  }

  if (view === 'detail' && snapshot) {
    const pendingEscalations = snapshot.escalations.filter(e => e.status === 'pending');
    return (
      <div className="flex flex-col gap-3 h-full">
        <button onClick={() => { setView('list'); setSelectedId(null); setSnapshot(null); setSelectedNodeId(null); }}
          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200">
          <ChevronLeft size={12} /> Back to missions
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: dotColor(snapshot.status) }} />
            <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]">{snapshot.objective}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">{snapshot.autonomyLevel}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {snapshot.status === 'running' ? (
            <MiniBtn icon={Pause} label="Pause" onClick={() => handleAction('pause')} color="#f59e0b" />
          ) : snapshot.status === 'paused' ? (
            <MiniBtn icon={Play} label="Resume" onClick={() => handleAction('resume')} color="#22d3ee" />
          ) : null}
          {snapshot.status !== 'killed' && (
            <MiniBtn icon={Square} label="Kill" onClick={() => handleAction('kill')} color="#ef4444" />
          )}
          {snapshot.status === 'killed' && snapshot.integrationBranch && (
            <MiniBtn icon={ArrowUpCircle} label="Promote" onClick={() => handleAction('promote')} color="#10b981" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-400">
          <div>Nodes: <span className="text-zinc-200">{snapshot.nodes.length}</span></div>
          <div>Active: <span className="text-zinc-200">{snapshot.nodes.filter(n => n.status === 'running').length}</span></div>
          <div>Branch: <span className="text-zinc-200 font-mono truncate">{snapshot.integrationBranch}</span></div>
          <div>User: <span className="text-zinc-200">{snapshot.userBranch}</span></div>
        </div>
        {pendingEscalations.length > 0 && (
          <div className="border border-zinc-700 rounded-lg p-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mb-2">
              <AlertTriangle size={10} /> Pending approvals ({pendingEscalations.length})
            </div>
            <ApprovalInbox escalations={pendingEscalations} onResolve={handleResolve} />
          </div>
        )}
        <div className="flex-1 min-h-0">
          <SwarmTrace messages={snapshot.messages} onSelectActor={setSelectedNodeId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-200">Missions</span>
        <button onClick={() => { setView('new-mission'); setObjective(''); setError(''); }}
          className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded transition-colors active:scale-95">
          <Plus size={10} /> New
        </button>
      </div>
      {missions.length === 0 ? (
        <div className="text-[11px] text-zinc-500 text-center py-6">
          {projectPath ? 'No missions yet. Start one!' : 'Select a project first.'}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {missions.map(m => (
            <button key={m.id} onClick={() => handleSelectMission(m.id)}
              className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                selectedId === m.id ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border-zinc-800 hover:border-zinc-600'
              }`}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor(m.status) }} />
                <span className="text-[11px] font-medium text-zinc-200 truncate flex-1">{m.objective}</span>
                <span className="text-[9px] text-zinc-500 font-mono">{m.autonomyLevel}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-500">
                <span>{m.nodeCount} nodes</span>
                {m.activeCount > 0 && <span className="text-cyan-400">{m.activeCount} active</span>}
                {m.pendingEscalations > 0 && <span className="text-amber-400">{m.pendingEscalations} pending</span>}
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">
                {new Date(m.createdAt).toLocaleDateString()} · {m.agentType}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBtn({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors active:scale-95"
      style={{ background: `${color}15`, color }}>
      <Icon size={10} /> {label}
    </button>
  );
}
