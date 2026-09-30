// ============================================================
// Real data for the 8 stat widgets that were permanently showing zeros.
//
// Before this, DashboardPage built a `widgetData` object with 20 keys and NONE of
// the 8 these widgets consume, so `widgetData?.financeSummary` was always
// undefined and every widget rendered its zero state forever — silently, because
// of `?.` chaining.
//
// INDEPENDENCE (required): every fetch is its own try/catch and its own state
// slot. A failing or slow endpoint can never block, blank, or crash another
// widget. Each one simply stays at its previous value.
// ============================================================

import { useEffect, useState } from 'react';

type A = Record<string, unknown> | undefined;
const EMPTY: A = undefined;

async function safe<T>(fn: () => Promise<T> | undefined, log: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[DashStats] ${log} failed:`, e);
    return undefined;
  }
}

const n = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

export interface DashStats {
  aiUsage: A;
  financeSummary: A;
  learnStats: A;
  browserStats: A;
  brainStats: A;
  consoleStats: A;
  covenantStats: A;
  sleepStats: A;
}

export function useDashStats(opts: { enabled: boolean }): DashStats {
  const [aiUsage, setAiUsage] = useState<A>(EMPTY);
  const [financeSummary, setFinanceSummary] = useState<A>(EMPTY);
  const [learnStats, setLearnStats] = useState<A>(EMPTY);
  const [browserStats, setBrowserStats] = useState<A>(EMPTY);
  const [brainStats, setBrainStats] = useState<A>(EMPTY);
  const [consoleStats, setConsoleStats] = useState<A>(EMPTY);
  const [covenantStats, setCovenantStats] = useState<A>(EMPTY);
  const [sleepStats, setSleepStats] = useState<A>(EMPTY);

  const { enabled } = opts;

  // ── AI usage ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.getAIUsageSummary) return;
      const res = await safe(
        () => api.getAIUsageSummary('today', 0, undefined),
        'aiUsage'
      );
      if (cancelled || !res) return;
      // handler: { totalTokens, totalCost, byTool: { [tool]: { tokens, sessions, ... } } }
      const r0 = res as any;
      const byTool = r0?.byTool && typeof r0.byTool === 'object' ? r0.byTool : {};
      const models = Object.entries(byTool)
        .map(([name, v]: [string, any]) => ({ name, tokens: n(v?.tokens) }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 5);
      const sessionCount = Object.values(byTool).reduce(
        (acc: number, v: any) => acc + n(v?.sessions), 0);
      setAiUsage({
        tokensToday: n(r0?.totalTokens),
        sessionCount,
        models,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Finance ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.financeGetSummary) return;
      const res = await safe(() => api.financeGetSummary(), 'finance');
      if (cancelled || !res) return;
      const s: any = (res as any)?.summary || (res as any)?.data || res;
      setFinanceSummary({
        totalBalance: n(s?.totalBalance ?? s?.balance),
        transactionCount: n(s?.transactionCount ?? s?.transactions),
        net7d: n(s?.net7d ?? s?.net),
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Learn ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.getLessonStats) return;
      const res = await safe(() => api.getLessonStats(), 'learn');
      if (cancelled || !res) return;
      const s: any = (res as any)?.stats || (res as any)?.data || res;
      const mastered = n(s?.mastered ?? s?.masteredCount);
      const total = n(s?.total ?? s?.totalCount);
      setLearnStats({
        dueCount: n(s?.due ?? s?.dueCount),
        masteryPercent: total ? Math.round((mastered / total) * 100) : 0,
        streak: n(s?.streak ?? s?.streakDays),
        nextLesson: s?.nextLesson ?? s?.next ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Browser ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.getBrowserDomainStats) return;
      const [domains, cats, status] = await Promise.all([
        safe(() => api.getBrowserDomainStats('today', 0), 'browser.domains'),
        safe(() => api.getBrowserCategoryStats?.('today', 0), 'browser.categories'),
        safe(() => api.getBrowserTrackingStatus?.(), 'browser.status'),
      ]);
      if (cancelled) return;
      const dl = Array.isArray(domains) ? domains : [];
      const cl = Array.isArray(cats) ? cats : [];
      setBrowserStats({
        topSites: dl.slice(0, 3).map((d: any) => ({
          domain: d?.domain ?? d?.name ?? 'unknown',
          visits: n(d?.visits ?? d?.count),
          category: d?.category ?? 'other',
        })),
        categories: cl.slice(0, 3).map((c: any) => ({
          name: c?.category ?? c?.name ?? 'other',
          pct: n(c?.pct ?? c?.percentage ?? c?.percent),
        })),
        tracking: Boolean((status as any)?.isTracking ?? (status as any)?.enabled ?? true),
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Brain ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.brainStats) return;
      const res = await safe(() => api.brainStats(), 'brain');
      if (cancelled || !res) return;
      const s: any = (res as any)?.stats || (res as any)?.data || res;
      setBrainStats({
        nodes: n(s?.nodes ?? s?.totalNodes ?? s?.episodeCount),
        density: n(s?.density ?? s?.avgDensity),
        retrievalsToday: n(s?.retrievalsToday ?? s?.retrievals),
        recentQuery: s?.recentQuery ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Console / terminal ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.getTerminalSessions) return;
      const res = await safe(() => api.getTerminalSessions(), 'console');
      if (cancelled) return;
      const sessions = Array.isArray(res) ? res : ((res as any)?.sessions ?? []);
      const done = n((res as any)?.handbookCompleted);
      const total = n((res as any)?.handbookTotal);
      setConsoleStats({
        commandCount: n((res as any)?.commandCount) || sessions.length,
        activeSessions: sessions.filter((s: any) => s?.active ?? s?.isActive).length,
        handbookCompleted: done,
        handbookTotal: total,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Covenant: localStorage-backed, no IPC exists ──────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const read = (k: string): any => {
        try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
      };
      const commitments = read('deskflow.covenant.commitments.v1');
      const list: any[] = Array.isArray(commitments) ? commitments : [];
      if (cancelled) return;
      const active = list.filter((c) => c?.active !== false).length;
      setCovenantStats({
        active,
        completionPercent: list.length
          ? Math.round((list.filter((c) => c?.keptToday || c?.completed).length / list.length) * 100)
          : 0,
        nextDue: list.find((c) => c?.nextDue)?.nextDue ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Health / sleep ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const api = (window as any).deskflowAPI;
      if (!api?.getSleepTrends) return;
      const res = await safe(() => api.getSleepTrends('week', 0), 'sleep');
      if (cancelled || !res) return;
      const rr: any = res as any;
      const daily: any[] = Array.isArray(rr?.daily) ? rr.daily : [];
      const today = daily[daily.length - 1];
      const hoursData = daily.map((d) => n(d?.hours ?? d?.duration));
      const gaps = n(rr?.gaps ?? rr?.gapCount);
      setSleepStats({
        lastNightHours: n(today?.hours ?? today?.duration),
        consistencyPercent: n(rr?.consistency ?? rr?.consistencyPercent),
        gapCount: gaps,
        hoursData,
        stepGoal: 8000,
        stepsToday: n(today?.steps),
        restingHeartRate: n(today?.restingHeartRate ?? rr?.restingHeartRate) || 70,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return {
    aiUsage,
    financeSummary,
    learnStats,
    browserStats,
    brainStats,
    consoleStats,
    covenantStats,
    sleepStats,
  };
}
