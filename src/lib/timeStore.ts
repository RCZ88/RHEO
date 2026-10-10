/**
 * Unified time store — stopwatches, timers, alarms in ONE module-scope store.
 *
 * Same pattern as stopwatchStore.ts: plain module object + useSyncExternalStore
 * subscribers, wall-clock derived (accumulated + since), mirrored to
 * localStorage. The top-bar clock popover, the AI deck Time card, and the
 * Life-page widget all read ONE snapshot — they cannot disagree.
 */

import { useSyncExternalStore } from 'react';

export interface Stopwatch {
  id: string;
  label: string;
  accumulatedMs: number;
  runningSinceMs: number | null;
  laps: number[]; // lap durations ms
}

export interface Timer {
  id: string;
  label: string;
  totalMs: number;
  accumulatedMs: number;
  runningSinceMs: number | null;
  finished: boolean;
}

export interface Alarm {
  id: string;
  label: string;
  /** minutes since midnight */
  atMinute: number;
  repeatDays: number[]; // 0=Sun..6=Sat, empty = once
  enabled: boolean;
}

export interface TimeSnapshot {
  stopwatches: Stopwatch[];
  timers: Timer[];
  alarms: Alarm[];
}

let state: TimeSnapshot = { stopwatches: [], timers: [], alarms: [] };
const listeners = new Set<() => void>();
const LS_KEY = 'deskflow-time-store-v1';

function emit() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach(l => l());
}
function setState(next: TimeSnapshot) { state = next; emit(); }

function hydrate() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.stopwatches)) state = parsed;
    }
  } catch { /* corrupt -> defaults */ }
}
hydrate();

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- stopwatches ---------- */
export function swStart(id: string) {
  setState({ ...state, stopwatches: state.stopwatches.map(s => s.id === id && s.runningSinceMs == null ? { ...s, runningSinceMs: Date.now() } : s) });
}
export function swPause(id: string) {
  const now = Date.now();
  setState({ ...state, stopwatches: state.stopwatches.map(s => s.id === id && s.runningSinceMs != null ? { ...s, accumulatedMs: s.accumulatedMs + (now - s.runningSinceMs), runningSinceMs: null } : s) });
}
export function swReset(id: string) {
  setState({ ...state, stopwatches: state.stopwatches.map(s => s.id === id ? { ...s, accumulatedMs: 0, runningSinceMs: null, laps: [] } : s) });
}
export function swLap(id: string) {
  const now = Date.now();
  setState({
    ...state, stopwatches: state.stopwatches.map(s => {
      if (s.id !== id) return s;
      const total = s.accumulatedMs + (s.runningSinceMs != null ? now - s.runningSinceMs : 0);
      const prevTotal = s.laps.reduce((a, b) => a + b, 0);
      return { ...s, laps: [...s.laps, Math.max(0, total - prevTotal)] };
    }),
  });
}
export function swAdd(label = 'Stopwatch') {
  const s: Stopwatch = { id: uid(), label, accumulatedMs: 0, runningSinceMs: Date.now(), laps: [] };
  setState({ ...state, stopwatches: [...state.stopwatches, s] });
  return s.id;
}
export function swRemove(id: string) {
  setState({ ...state, stopwatches: state.stopwatches.filter(s => s.id !== id) });
}

/* ---------- timers ---------- */
export function timerAdd(totalMs: number, label = 'Timer') {
  const t: Timer = { id: uid(), label, totalMs, accumulatedMs: 0, runningSinceMs: Date.now(), finished: false };
  setState({ ...state, timers: [...state.timers, t] });
  return t.id;
}
export function timerPause(id: string) {
  const now = Date.now();
  setState({ ...state, timers: state.timers.map(t => t.id === id && t.runningSinceMs != null ? { ...t, accumulatedMs: t.accumulatedMs + (now - t.runningSinceMs), runningSinceMs: null } : t) });
}
export function timerResume(id: string) {
  setState({ ...state, timers: state.timers.map(t => t.id === id && t.runningSinceMs == null && !t.finished ? { ...t, runningSinceMs: Date.now() } : t) });
}
export function timerRemove(id: string) {
  setState({ ...state, timers: state.timers.filter(t => t.id !== id) });
}

/* ---------- alarms ---------- */
export function alarmAdd(atMinute: number, label = 'Alarm', repeatDays: number[] = []) {
  const a: Alarm = { id: uid(), label, atMinute, repeatDays, enabled: true };
  setState({ ...state, alarms: [...state.alarms, a] });
  return a.id;
}
export function alarmToggle(id: string) {
  setState({ ...state, alarms: state.alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a) });
}
export function alarmRemove(id: string) {
  setState({ ...state, alarms: state.alarms.filter(a => a.id !== id) });
}

/* ---------- derived ---------- */
export function stopwatchMs(s: Stopwatch, now = Date.now()): number {
  return s.accumulatedMs + (s.runningSinceMs != null ? now - s.runningSinceMs : 0);
}
export function timerRemainingMs(t: Timer, now = Date.now()): number {
  const elapsed = t.accumulatedMs + (t.runningSinceMs != null ? now - t.runningSinceMs : 0);
  return Math.max(0, t.totalMs - elapsed);
}
export function formatHms(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export function formatAlarmAt(atMinute: number): string {
  const h = Math.floor(atMinute / 60);
  const m = atMinute % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function useTimeStore(): TimeSnapshot {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => state,
  );
}

/** 1 Hz tick so live readouts re-render. */
export function useNow(intervalMs = 500): number {
  return useSyncExternalStore(
    cb => { const i = setInterval(cb, intervalMs); return () => clearInterval(i); },
    () => Date.now(),
    () => Date.now(),
  );
}

/** Best-effort: fire a renderer notification when a timer hits zero. */
export function checkTimerCompletions() {
  const now = Date.now();
  let changed = false;
  const timers = state.timers.map(t => {
    if (!t.finished && timerRemainingMs(t, now) <= 0) {
      changed = true;
      try { new Notification('Timer done', { body: t.label }); } catch { /* not available */ }
      return { ...t, finished: true, runningSinceMs: null, accumulatedMs: t.totalMs };
    }
    return t;
  });
  if (changed) setState({ ...state, timers });
}
