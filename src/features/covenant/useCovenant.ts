import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Commitment, DayCompletion, DayViolation, JournalEntry, StreakStats } from './types';
import {
  loadCommitments, saveCommitments,
  loadCompletions, saveCompletions,
  loadViolations, saveViolations,
  loadJournal, saveJournal,
  todayStr,
} from './storage';
import { computeStreakStats, justHitMilestone } from './streak';
import { useCommitmentDetection } from './useCommitmentDetection';

export interface CovenantEvent {
  type: 'grace-reset' | 'milestone';
  commitmentId: string;
  milestone?: number;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SEEN_RESETS_KEY = 'deskflow.covenant.seenResets.v1';

function loadSeenResets(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_RESETS_KEY) || '{}'); } catch { return {}; }
}
function saveSeenResets(v: Record<string, string>) {
  localStorage.setItem(SEEN_RESETS_KEY, JSON.stringify(v));
}

export function useCovenant() {
  const [commitments, setCommitments] = useState<Commitment[]>(() => loadCommitments());
  const [completions, setCompletions] = useState<DayCompletion[]>(() => loadCompletions());
  const [violations, setViolations] = useState<DayViolation[]>(() => loadViolations());
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal());
  const [events, setEvents] = useState<CovenantEvent[]>([]);
  const seenResetsRef = useRef<Record<string, string>>(loadSeenResets());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { saveCommitments(commitments); }, [commitments]);
  useEffect(() => { saveCompletions(completions); }, [completions]);
  useEffect(() => { saveViolations(violations); }, [violations]);
  useEffect(() => { saveJournal(journal); }, [journal]);

  const statsById = useMemo(() => {
    const map = new Map<string, StreakStats>();
    for (const c of commitments) {
      map.set(c.id, computeStreakStats(c, completions, violations));
    }
    return map;
  }, [commitments, completions, violations]);

  useEffect(() => {
    const seen = seenResetsRef.current;
    let changed = false;
    const newEvents: CovenantEvent[] = [];
    for (const c of commitments) {
      const stats = statsById.get(c.id);
      if (!stats || !stats.justReset) continue;
      const marker = stats.lastCompletedDate || 'never';
      if (seen[c.id] !== marker) {
        seen[c.id] = marker;
        changed = true;
        newEvents.push({ type: 'grace-reset', commitmentId: c.id });
      }
    }
    if (changed) {
      saveSeenResets(seen);
      setEvents(prev => [...prev, ...newEvents]);
    }
  }, [statsById, commitments]);

  const addCommitment = useCallback((input: Omit<Commitment, 'id' | 'createdAt' | 'archivedAt'>) => {
    const commitment: Commitment = {
      ...input,
      detection: { mode: 'positive', ...input.detection },
      id: uid(),
      createdAt: Date.now(),
      archivedAt: null,
    };
    setCommitments(prev => [...prev, commitment]);
    return commitment;
  }, []);

  const updateCommitment = useCallback((id: string, patch: Partial<Omit<Commitment, 'id' | 'createdAt' | 'archivedAt'>>) => {
    setCommitments(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
    setEditingId(null);
  }, []);

  const archiveCommitment = useCallback((id: string) => {
    setCommitments(prev => prev.map(c => (c.id === id ? { ...c, archivedAt: Date.now() } : c)));
  }, []);

  const deleteCommitment = useCallback((id: string) => {
    setCommitments(prev => prev.filter(c => c.id !== id));
    setCompletions(prev => prev.filter(c => c.commitmentId !== id));
    setViolations(prev => prev.filter(v => v.commitmentId !== id));
  }, []);

  const markComplete = useCallback((commitmentId: string, source: 'manual' | 'detected' = 'manual', date = todayStr()) => {
    setCompletions(prev => {
      if (prev.some(c => c.commitmentId === commitmentId && c.date === date)) return prev;
      const next = [...prev, { commitmentId, date, completedAt: Date.now(), source }];
      const totalAfter = next.filter(c => c.commitmentId === commitmentId).length;
      const hit = justHitMilestone(totalAfter);
      if (hit) {
        setEvents(evts => [...evts, { type: 'milestone', commitmentId, milestone: hit }]);
      }
      return next;
    });
  }, []);

  const unmarkComplete = useCallback((commitmentId: string, date = todayStr()) => {
    setCompletions(prev => prev.filter(c => !(c.commitmentId === commitmentId && c.date === date)));
  }, []);

  const markViolation = useCallback((commitmentId: string, date = todayStr()) => {
    setViolations(prev => {
      if (prev.some(v => v.commitmentId === commitmentId && v.date === date)) return prev;
      return [...prev, { commitmentId, date, detectedAt: Date.now() }];
    });
  }, []);

  const onAutoSatisfied = useCallback((commitmentId: string) => {
    markComplete(commitmentId, 'detected');
  }, [markComplete]);

  const onViolation = useCallback((commitmentId: string) => {
    markViolation(commitmentId);
  }, [markViolation]);

  useCommitmentDetection(commitments.filter(c => !c.archivedAt), onAutoSatisfied, onViolation);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      const avoidanceClean = commitments.filter(
        c => !c.archivedAt && c.detection.enabled && c.detection.mode === 'avoidance' && c.autoConfirmWhenClean,
      );
      for (const c of avoidanceClean) {
        const alreadyDone = completions.some(comp => comp.commitmentId === c.id && comp.date === today);
        const violated = violations.some(v => v.commitmentId === c.id && v.date === today);
        if (!alreadyDone && !violated) {
          markComplete(c.id, 'detected', today);
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [commitments, completions, violations, markComplete]);

  const violationsById = useMemo(() => {
    const map = new Map<string, DayViolation[]>();
    for (const v of violations) {
      if (!map.has(v.commitmentId)) map.set(v.commitmentId, []);
      map.get(v.commitmentId)!.push(v);
    }
    return map;
  }, [violations]);

  const upsertJournalEntry = useCallback((entry: JournalEntry) => {
    setJournal(prev => {
      const idx = prev.findIndex(j => j.commitmentId === entry.commitmentId && j.date === entry.date);
      if (idx === -1) return [...prev, entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  const journalFor = useCallback((commitmentId: string | null, date: string) => {
    return journal.find(j => j.commitmentId === commitmentId && j.date === date) || null;
  }, [journal]);

  const dismissEvent = useCallback((idx: number) => {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const activeCommitments = useMemo(() => commitments.filter(c => !c.archivedAt), [commitments]);

  const totalPracticeDays = useMemo(() => {
    const uniqueDates = new Set(completions.map(c => c.date));
    return uniqueDates.size;
  }, [completions]);

  return {
    commitments: activeCommitments,
    allCommitments: commitments,
    completions,
    violations,
    violationsById,
    statsById,
    events,
    editingId,
    setEditingId,
    dismissEvent,
    addCommitment,
    updateCommitment,
    archiveCommitment,
    deleteCommitment,
    markComplete,
    unmarkComplete,
    markViolation,
    upsertJournalEntry,
    journalFor,
    totalPracticeDays,
  };
}
