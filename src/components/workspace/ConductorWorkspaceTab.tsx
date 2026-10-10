import { useState, useEffect, useCallback } from 'react';
import { Bot, Play, Pause, Square, Activity, CheckCircle, XCircle, Clock, Sparkles, Shield, GitBranch, Coins, BarChart3, Settings, Plus, FolderOpen, Send, Loader2, ChevronDown, ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkspaceCard, WorkspaceSection, WorkspaceToolbar } from './_ds/containers';
import { listContainer, riseItem, expandPanel, DUR, EASE_OUT } from './_ds/motion';
import { WS_BTN_PRIMARY, WS_BTN_SECONDARY, WS_BTN_GHOST, WS_BTN_DANGER } from './_ds/forms';
import { EmptyState, Skeleton } from './_ds/primitives';
import { MissionWizard } from '../conductor/MissionWizard';
import { AgentProviderPanel } from '../conductor/AgentProviderPanel';
import { TemplateGallery } from '../conductor/TemplateGallery';
import { BudgetDashboard } from '../conductor/BudgetDashboard';
import { ConductorConfigPanel } from '../conductor/ConductorConfigPanel';
import OrgTreeGraph from '../conductor/OrgTreeGraph';

const MISSION_STATUS: Record<string, { cls: string; dot: string }> = {
  running: { cls: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: 'bg-emerald-500' },
  blocked: { cls: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30', dot: 'bg-amber-500' },
  done:    { cls: 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20', dot: 'bg-emerald-400' },
  killed:  { cls: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30', dot: 'bg-red-500' },
  paused:  { cls: 'text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30', dot: 'bg-yellow-500' },
};

const TRACE_TYPE: Record<string, string> = {
  REPORT: 'bg-emerald-500/10 text-emerald-300',
  ESCALATE: 'bg-amber-500/10 text-amber-300',
  MERGE_CONFLICT: 'bg-red-500/10 text-red-300',
  MERGE_OK: 'bg-blue-500/10 text-blue-300',
  DIRECTIVE: 'bg-purple-500/10 text-purple-300',
};

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3"
    >
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-red-300 flex-1">{message}</p>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-300 text-xs">✕</button>
    </motion.div>
  );
}

function MissionCard({ mission, isSelected, onSelect, onAction, onError, formatTime }: {
  mission: any; isSelected: boolean; onSelect: () => void;
  onAction: (action: string, id: string) => Promise<void>;
  onError: (msg: string) => void; formatTime: (ts: number) => string;
}) {
  const status = MISSION_STATUS[mission.status] || MISSION_STATUS.running;
  const pct = Math.round(mission.progress_pct || mission.progress?.pct || 0);

  return (
    <motion.div variants={riseItem}>
      <WorkspaceCard
        variant="default"
        accent={isSelected ? 'rose' : undefined}
        className={`!p-0 overflow-hidden transition-all duration-150 ${isSelected ? 'ring-1 ring-rose-500/40' : ''}`}
      >
        <button onClick={onSelect} className="w-full text-left p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${status.dot} ${mission.status === 'running' ? 'animate-pulse' : ''}`} />
              <span className="text-[12px] font-medium text-zinc-200">{mission.name || mission.objective || 'Untitled mission'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.cls}`}>{mission.status}</span>
              <motion.div animate={{ rotate: isSelected ? 90 : 0 }} transition={{ duration: DUR.fast }}>
                <ChevronRight className="w-3 h-3 text-zinc-500" />
              </motion.div>
            </div>
          </div>

          {mission.objective && <p className="text-[11px] text-zinc-400 mb-2 line-clamp-2">{mission.objective}</p>}

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-rose-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 tabular-nums font-mono">{pct}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            {mission.autonomy_level && <span>Autonomy: L{mission.autonomy_level}</span>}
            {mission.created_at && <span>· {formatTime(mission.created_at || mission.createdAt)}</span>}
          </div>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-zinc-800/40">
          {mission.status === 'running' && (
            <button onClick={(e) => { e.stopPropagation(); onAction('pause', mission.id).catch(onError); }} className={`${WS_BTN_GHOST} !text-[10px] !py-1 !px-2`}>
              <Pause className="w-3 h-3" /> Pause
            </button>
          )}
          {(mission.status === 'blocked' || mission.status === 'paused') && (
            <button onClick={(e) => { e.stopPropagation(); onAction('resume', mission.id).catch(onError); }} className={`${WS_BTN_GHOST} !text-[10px] !py-1 !px-2 !text-emerald-300`}>
              <Play className="w-3 h-3" /> Resume
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onAction('kill', mission.id).catch(onError); }} className={`${WS_BTN_GHOST} !text-[10px] !py-1 !px-2 !text-red-300`}>
            <Square className="w-3 h-3" /> Kill
          </button>
          {mission.status === 'done' && (
            <button onClick={(e) => { e.stopPropagation(); onAction('promote', mission.id).catch(onError); }} className={`${WS_BTN_GHOST} !text-[10px] !py-1 !px-2 !text-emerald-300 ml-auto`}>
              <GitBranch className="w-3 h-3" /> Promote
            </button>
          )}
        </div>
      </WorkspaceCard>
    </motion.div>
  );
}

export function ConductorWorkspaceTab({ activeTab, projectId, repoPath, userBranch }: { activeTab: string; projectId?: string; repoPath?: string; userBranch?: string }) {
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 8000);
  }, []);

  const refreshMissions = useCallback(async () => {
    if (!(window as any).deskflowAPI?.conductorListMissions) return;
    try {
      const r = await (window as any).deskflowAPI.conductorListMissions();
      if (r?.success) setMissions(r.data || []);
      else showError(r?.error || 'Failed to load missions');
    } catch (e: any) { showError(e?.message || 'Failed to load missions'); }
  }, [showError]);

  useEffect(() => {
    refreshMissions();
    const unsub = (window as any).deskflowAPI?.onConductorSnapshot?.((s: any) => {
      setSnapshot(s);
      if (s?.id) {
        setMissions(prev => {
          const idx = prev.findIndex((m: any) => m.id === s.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...s }; return next; }
          return [...prev, s];
        });
      }
    });
    return () => { if (unsub) unsub(); };
  }, [refreshMissions]);

  const loadSnapshot = useCallback(async (missionId: string) => {
    if (!(window as any).deskflowAPI?.conductorGetSnapshot) return;
    try {
      const r = await (window as any).deskflowAPI.conductorGetSnapshot(missionId);
      if (r?.success) setSnapshot(r.data);
    } catch (e: any) { showError(e?.message || 'Failed to load snapshot'); }
  }, [showError]);

  useEffect(() => {
    if (selectedMission) loadSnapshot(selectedMission.id);
  }, [selectedMission, loadSnapshot]);

  const handleLaunch = useCallback(async (config: any) => {
    try {
      const r = await (window as any).deskflowAPI?.conductorStart?.(config);
      if (r?.success) {
        setShowWizard(false);
        await refreshMissions();
      } else {
        showError(r?.error || 'Failed to start mission');
      }
    } catch (e: any) { showError(e?.message || 'Failed to start mission'); }
  }, [refreshMissions, showError]);

  const handleAction = useCallback(async (action: string, id: string) => {
    const api = (window as any).deskflowAPI;
    if (action === 'pause') await api?.conductorPause?.(id);
    else if (action === 'resume') await api?.conductorResume?.(id);
    else if (action === 'kill') await api?.conductorKill?.(id);
    else if (action === 'promote') await api?.conductorPromoteIntegration?.(id);
    await refreshMissions();
  }, [refreshMissions]);

  const formatTime = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Missions Tab ──────────────────────────────────────────────────────
  if (activeTab === 'missions') {
    return (
      <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto ws-scroll">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <WorkspaceToolbar>
          <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex-1">Active Missions</h3>
          <button onClick={() => setShowWizard(true)} className={WS_BTN_PRIMARY}>
            <Plus className="w-3 h-3" /> New Mission
          </button>
        </WorkspaceToolbar>

        {missions.length === 0 ? (
          <EmptyState
            icon={<Bot className="w-5 h-5" />}
            title="No active missions"
            hint="Create a mission to start coordinating agents."
            action={
              <button onClick={() => setShowWizard(true)} className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 underline">
                Create your first mission
              </button>
            }
          />
        ) : (
          <motion.div
            className="flex flex-col gap-2"
            variants={listContainer} initial="hidden" animate="show"
          >
            {missions.map((m: any) => (
              <MissionCard
                key={m.id}
                mission={m}
                isSelected={selectedMission?.id === m.id}
                onSelect={() => setSelectedMission(selectedMission?.id === m.id ? null : m)}
                onAction={handleAction}
                onError={showError}
                formatTime={formatTime}
              />
            ))}
          </motion.div>
        )}

        <AnimatePresence>
          {selectedMission?.id && snapshot && (
            <motion.div
              variants={expandPanel} initial="hidden" animate="show" exit="exit"
              className="overflow-hidden"
            >
              <WorkspaceCard variant="inset">
                <OrgTreeGraph nodes={snapshot.nodes || []} recentMessages={snapshot.messages || []} />
              </WorkspaceCard>
            </motion.div>
          )}
        </AnimatePresence>

        {showWizard && (
          <MissionWizard
            projectId={projectId || ''}
            repoPath={repoPath || ''}
            userBranch={userBranch || 'main'}
            onLaunch={handleLaunch}
            onClose={() => setShowWizard(false)}
          />
        )}
      </div>
    );
  }

  // ─── Approvals Tab ─────────────────────────────────────────────────────
  if (activeTab === 'approvals') {
    const escalations = snapshot?.escalations || [];
    return (
      <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto ws-scroll">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <WorkspaceSection title="Pending Approvals" icon={Shield} accent="rose">
          {escalations.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="w-5 h-5" />}
              title="No pending approvals"
              hint="All escalations have been resolved."
            />
          ) : (
            <motion.div className="flex flex-col gap-2" variants={listContainer} initial="hidden" animate="show">
              {escalations.map((esc: any) => (
                <motion.div key={esc.id} variants={riseItem}>
                  <WorkspaceCard variant="inset">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[12px] font-medium text-zinc-200">{esc.reason}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-3">{esc.detail || esc.note || 'No details'}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={async () => { try { await (window as any).deskflowAPI?.conductorResolveEscalation?.(esc.id, 'approved', ''); refreshMissions(); } catch (e: any) { showError(e?.message); } }} className={`${WS_BTN_GHOST} !text-[10px] !text-emerald-300`}>
                        <CheckCircle className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={async () => { try { await (window as any).deskflowAPI?.conductorResolveEscalation?.(esc.id, 'rejected', ''); refreshMissions(); } catch (e: any) { showError(e?.message); } }} className={`${WS_BTN_GHOST} !text-[10px] !text-red-300`}>
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </WorkspaceCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </WorkspaceSection>
      </div>
    );
  }

  // ─── Trace Tab ─────────────────────────────────────────────────────────
  if (activeTab === 'trace') {
    const trace = snapshot?.messages || [];
    return (
      <div className="flex flex-col gap-2 p-3 min-h-0 overflow-y-auto ws-scroll">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <WorkspaceSection title="Execution Trace" icon={Activity} accent="rose">
          {trace.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-5 h-5" />}
              title="No trace data"
              hint="Start a mission to see execution traces."
            />
          ) : (
            <motion.div className="flex flex-col gap-1" variants={listContainer} initial="hidden" animate="show">
              {trace.map((t: any, i: number) => (
                <motion.div key={i} variants={riseItem} className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/50 hover:bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] transition-colors duration-150">
                  <Clock className="w-3 h-3 mt-0.5 shrink-0 text-zinc-600" />
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TRACE_TYPE[t.type] || 'bg-zinc-800/60 text-zinc-400'}`}>
                      {t.type}
                    </span>
                    <span className="text-[11px] text-zinc-400 ml-1.5">{t.summary}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{formatTime(t.ts)}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </WorkspaceSection>
      </div>
    );
  }

  // ─── Budget Tab ────────────────────────────────────────────────────────
  if (activeTab === 'budget') {
    return <BudgetDashboard missionId={selectedMission?.id || ''} />;
  }

  // ─── Providers Tab ─────────────────────────────────────────────────────
  if (activeTab === 'providers') {
    return <AgentProviderPanel />;
  }

  // ─── Templates Tab ─────────────────────────────────────────────────────
  if (activeTab === 'templates') {
    return <TemplateGallery onSelect={() => { setShowWizard(true); }} onCreate={() => {}} />;
  }

  // ─── Settings Tab ──────────────────────────────────────────────────────
  if (activeTab === 'settings') {
    return <ConductorConfigPanel />;
  }

  return null;
}
