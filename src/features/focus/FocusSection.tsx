import { useEffect, useRef, useState } from 'react';
import { Focus as FocusIcon, AlertTriangle } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import { LoadingState } from '../../components/LoadingState';
import { useFocusSession } from '../../hooks/useFocusSession';
import { useFocusGroups, type FocusGroup, type GroupDraft } from '../../hooks/useFocusGroups';
import { setActiveGroup } from '../../hooks/useActiveFocusGroup';
import { useToasts } from '../../hooks/useToasts';
import { FocusTimer } from './FocusTimer';
import { FocusStats } from './FocusStats';
import { FocusGoals } from './FocusGoals';
import { FocusGroupsPanel } from './FocusGroupsPanel';
import { FocusHistory } from './FocusHistory';
import { FocusInsights } from './FocusInsights';
import { FocusLeaderboard } from './FocusLeaderboard';
import { FocusDistractionLog } from './FocusDistractionLog';
import { FocusGroupEditor } from './FocusGroupEditor';
import { computeTodayStats, computeStreak, type FocusHistoryRow } from './focusHelpers';
import { cn } from '@/lib/utils';

type FocusMode = 'timer' | 'stopwatch';

interface PendingGroupSession {
  groupIds: number[];
  sessionId: number;
  plannedSec: number;
}

export function FocusSection() {
  const { state, history, start, stop, startWithGroup, startWithGroups } = useFocusSession();
  const { groups, loading, error: groupsError, save, remove, selectedId, setSelectedId, selectedIds, toggleSelect, clearSelection } = useFocusGroups();
  const { toasts, showToast, removeToast } = useToasts();
  const [mins, setMins] = useState(25);
  const [strict, setStrict] = useState<'distracting' | 'non_allowed'>('distracting');
  const [justCompleted, setJustCompleted] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [mode, setMode] = useState<FocusMode>('timer');
  const [distractions, setDistractions] = useState<Array<{ name: string; type: 'app' | 'website'; timestamp: number }>>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FocusGroup | null>(null);
  const pendingGroupRef = useRef<PendingGroupSession | null>(null);

  useEffect(() => {
    const hasApi = !!(window as any).deskflowAPI?.focus;
    setApiMissing(!hasApi);
  }, []);

  useEffect(() => {
    if (state?.active && distractions.length > 0) {
      const latest = distractions[distractions.length - 1];
      console.log('[Focus] Distraction detected:', latest);
    }
  }, [distractions, state?.active]);

  const rows = history as unknown as FocusHistoryRow[];
  const todayStats = computeTodayStats(rows);
  const streak = computeStreak(rows);

  const handleStart = () => start(mins * 60, strict);
  const handleStop = () => stop();

  const handleStartWithGroup = (groupId: number, durationSec: number, strictness: 'distracting' | 'non_allowed') => {
    startWithGroup(groupId, durationSec, strictness).then(res => {
      if (res?.success === false) {
        console.error('[Focus] startWithGroup failed:', res.error);
      } else if (res?.sessionId != null) {
        pendingGroupRef.current = { groupIds: [groupId], sessionId: Number(res.sessionId), plannedSec: durationSec };
        const group = groups.find(g => g.id === groupId);
        setActiveGroup({
          sessionId: Number(res.sessionId),
          groupId,
          groupIds: [groupId],
          groupNames: [group?.name ?? 'Group'],
          allowedCategories: (group?.allowed_categories ?? []).map((c: string) => String(c)),
          startedAt: Date.now(),
        });
      }
    });
  };

  const handleStartWithGroups = (groupIds: number[], durationSec: number, strictness: 'distracting' | 'non_allowed') => {
    if (groupIds.length === 0) return;
    startWithGroups(groupIds, durationSec, strictness).then(res => {
      if (res?.success === false) {
        console.error('[Focus] startWithGroups failed:', res.error);
      } else if (res?.sessionId != null) {
        pendingGroupRef.current = { groupIds, sessionId: Number(res.sessionId), plannedSec: durationSec };
        const selected = groupIds.map(id => groups.find(g => g.id === id)).filter((g): g is FocusGroup => !!g);
        const allCategories = Array.from(new Set(selected.flatMap(g => (g.allowed_categories ?? []).map((c: string) => String(c)))));
        setActiveGroup({
          sessionId: Number(res.sessionId),
          groupId: selected[0]?.id ?? groupIds[0],
          groupIds,
          groupNames: selected.map(g => g.name),
          allowedCategories: allCategories,
          startedAt: Date.now(),
        });
      }
    });
  };

  const onGroupSessionEnded = async (pending: PendingGroupSession) => {
    try {
      const pendingGroups = pending.groupIds
        .map(id => groups.find(g => g.id === id))
        .filter((g): g is FocusGroup => !!g);
      if (pendingGroups.length === 0) return;
      const api = (window as any).deskflowAPI;
      const allowed = Array.from(new Set(pendingGroups.flatMap(g => (g.allowed_categories || []).map((c: string) => String(c).toLowerCase()))));
      const goalIds: string[] = [];
      let goalTitle = '';
      let bestPct = 0;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const fetched = await api?.getGoals?.(today);
        const goals = fetched?.goals || (Array.isArray(fetched) ? fetched : []);
        for (const g of goals) {
          if (g?.target?.type !== 'time' || !g?.target?.matchCategory) continue;
          if (allowed.length > 0 && !allowed.includes(String(g.target.matchCategory).toLowerCase())) continue;
          goalIds.push(String(g.id));
          const target = Number(g.target?.targetSeconds) || 0;
          const pct = target > 0 ? Math.min(100, Math.round(((Number(g.progressSeconds) || 0) / target) * 100)) : 0;
          if (pct > bestPct) { bestPct = pct; goalTitle = g.title || ''; }
        }
      } catch {
        /* goal fetch is best-effort */
      }
      try {
        if (api?.focusGroup?.linkUsage) {
          for (const gid of pending.groupIds) {
            await api.focusGroup.linkUsage({ sessionId: pending.sessionId, groupId: gid, goalIds });
          }
        }
      } catch (e) {
        console.error('[Focus] linkUsage failed:', e);
      }
      const minsDone = Math.max(1, Math.round(pending.plannedSec / 60));
      const label = pendingGroups.length === 1 ? pendingGroups[0].name : `${pendingGroups.length} combined groups`;
      if (bestPct >= 100) {
        // confetti handled by FocusTimer completion state
      }
      showToast(
        goalTitle
          ? `${label} · ${minsDone} min · ${bestPct}% of '${goalTitle}' goal`
          : `${label} · ${minsDone} min · no matching goal`,
        'success',
      );
    } catch (e) {
      console.error('[Focus] Failed to summarize group session:', e);
    }
  };

  const handleSaveGroup = async (draft: GroupDraft): Promise<boolean> => {
    const id = await save(draft);
    return id != null;
  };

  const handleDeleteGroup = async (group: FocusGroup) => {
    const ok = await remove(group.id);
    if (ok && selectedId === group.id) setSelectedId(null);
  };

  useEffect(() => {
    if (!state) return;
    if (!state.active && history[0]?.outcome === 'completed') {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 4000);
      const pending = pendingGroupRef.current;
      if (pending) {
        pendingGroupRef.current = null;
        void onGroupSessionEnded(pending);
      }
      return () => clearTimeout(t);
    }
  }, [state, history]);

  if (apiMissing || (loading && groups.length === 0)) {
    return (
      <div>
        <SectionHeader title="Deep Focus" icon={<FocusIcon className="w-4 h-4 text-[var(--page-accent)]" />} />
        <LoadingState variant="skeleton" className="h-96" />
      </div>
    );
  }

  if (groupsError && groups.length === 0) {
    return (
      <div>
        <SectionHeader title="Deep Focus" icon={<FocusIcon className="w-5 h-5 text-[var(--page-accent)]" />} />
        <div className="rounded-xl border border-rose-500/30 bg-zinc-900/95 p-5">
          <p className="text-[13px] font-semibold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Failed to load Focus data.
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">{groupsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Deep Focus" icon={<FocusIcon className="w-5 h-5 text-clay-400" />} />

      {/* Main grid: timer hero left-center, groups left, stats/insights right */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: Focus groups sidebar */}
        <div className="col-span-12 lg:col-span-3 order-first">
          <FocusGroupsPanel
            groups={groups}
            selectedId={selectedId}
            onSelect={setSelectedId}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onCreate={() => { setEditingGroup(null); setEditorOpen(true); }}
            onEdit={g => { setEditingGroup(g); setEditorOpen(true); }}
            onDelete={handleDeleteGroup}
          />
        </div>

        {/* CENTER: Timer hero */}
        <div className="col-span-12 lg:col-span-5 order-2 lg:order-2">
          <FocusTimer
            state={state}
            mins={mins}
            onMinsChange={setMins}
            strict={strict}
            onStrictChange={setStrict}
            onStart={handleStart}
            onStop={handleStop}
            justCompleted={justCompleted}
            mode={mode}
            onModeChange={setMode}
            groups={groups}
            selectedGroupIds={selectedIds}
            activeGroup={selectedId != null ? groups.find(g => g.id === selectedId) ?? null : null}
            onStartWithGroup={handleStartWithGroup}
            onStartWithGroups={handleStartWithGroups}
            onDurationDrag={sec => setMins(Math.round(sec / 60))}
          />
        </div>

        {/* RIGHT: Stats + goals + insights stacked */}
        <div className="col-span-12 lg:col-span-4 order-3 space-y-4">
          <FocusStats stats={todayStats} streak={streak} />
          <FocusGoals history={rows} />
          <FocusInsights history={rows} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FocusLeaderboard history={rows} />
            <FocusDistractionLog distractions={distractions} isActive={!!state?.active} />
          </div>
          <FocusHistory history={rows} onStartFirstSession={handleStart} />
        </div>
      </div>

      <FocusGroupEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        group={editingGroup}
        onSave={handleSaveGroup}
      />

      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 max-w-sm">
          {toasts.map(t => (
            <button
              key={t.id}
              onClick={() => removeToast(t.id)}
              className={cn(
                `flex items-start gap-2.5 text-left px-4 py-3 rounded-xl bg-zinc-900/95 border transition-opacity hover:opacity-90`,
                t.type === 'success' ? 'border-emerald-500/40' :
                t.type === 'error' ? 'border-rose-500/40' :
                'border-zinc-800/60'
              )}
            >
              <span className={cn(
                'mt-0.5 w-2 h-2 rounded-full shrink-0',
                t.type === 'success' ? 'bg-emerald-400' :
                t.type === 'error' ? 'bg-rose-400' :
                'bg-zinc-400'
              )} />
              <span className="text-sm text-zinc-100">{t.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
