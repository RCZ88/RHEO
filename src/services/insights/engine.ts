import type Database from 'better-sqlite3';
import type { InsightAtom } from '../../shared/insights';
import { mean, std, zScore, delta, percentile, streak } from './detectors';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const score = (a: InsightAtom) =>
  0.45 * a.surprise + 0.25 * a.relevance + 0.20 * a.confidence + 0.10 * a.novelty;

// ═══════════════════════════════════════════════════════════════
// DAILY ROLLUP — builds daily_rollup rows for a given date
// ═══════════════════════════════════════════════════════════════
function safeQuery(db: Database, sql: string, ...params: any[]): any {
  try { return db.prepare(sql).get(...params); } catch { return null; }
}

function safeQueryAll(db: Database, sql: string, ...params: any[]): any[] {
  try { return db.prepare(sql).all(...params); } catch { return []; }
}

function tableExists(db: Database, name: string): boolean {
  try { return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name); } catch { return false; }
}

export function buildDailyRollup(db: Database, date: string) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO daily_rollup (date, domain, metric, value) VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // App usage from logs
    const appRows = safeQueryAll(db, `
      SELECT app, SUM(duration_ms) / 60000.0 as minutes
      FROM logs WHERE date(timestamp) = ? GROUP BY app
    `, date);
    for (const row of appRows) {
      stmt.run(date, 'apps', `app:${row.app}:min`, row.minutes);
    }

    // Total productive time — use app_categories if table exists, else 0
    let prodMin = 0;
    if (tableExists(db, 'app_categories')) {
      const prodRow = safeQuery(db, `
        SELECT COALESCE(SUM(duration_ms) / 60000.0, 0) as minutes
        FROM logs a LEFT JOIN app_categories c ON a.app = c.app_name
        WHERE date(a.timestamp) = ? AND c.tier = 'productive'
      `, date);
      prodMin = prodRow?.minutes || 0;
    }
    stmt.run(date, 'productivity', 'productive_min', prodMin);

    // Total time
    const totalRow = safeQuery(db, `
      SELECT COALESCE(SUM(duration_ms) / 60000.0, 0) as minutes
      FROM logs WHERE date(timestamp) = ?
    `, date);
    stmt.run(date, 'productivity', 'total_min', totalRow?.minutes || 0);

    // App switch count (context switches)
    const switchRow = safeQuery(db, `
      SELECT COUNT(DISTINCT app) as switches FROM logs WHERE date(timestamp) = ?
    `, date);
    stmt.run(date, 'productivity', 'app_switches', switchRow?.switches || 0);

    // Hourly distribution (for night owl detection)
    for (let h = 0; h < 24; h++) {
      const hourRow = safeQuery(db, `
        SELECT COALESCE(SUM(duration_ms) / 60000.0, 0) as minutes
        FROM logs WHERE date(timestamp) = ? AND CAST(strftime('%H', timestamp) AS INTEGER) = ?
      `, date, h);
      stmt.run(date, 'hourly', `hour:${h}`, hourRow?.minutes || 0);
    }

    // Git commits (table may not exist)
    if (tableExists(db, 'commits')) {
      const commitRow = safeQuery(db, `
        SELECT COUNT(*) as count FROM commits WHERE date(date) = ?
      `, date);
      stmt.run(date, 'git', 'commits', commitRow?.count || 0);
    }

    // AI sessions (table may not exist)
    if (tableExists(db, 'terminal_sessions')) {
      const aiRow = safeQuery(db, `
        SELECT COUNT(*) as count, COALESCE(SUM(total_tokens), 0) as tokens
        FROM terminal_sessions WHERE date(created_at) = ?
      `, date);
      stmt.run(date, 'ai', 'sessions', aiRow?.count || 0);
      stmt.run(date, 'ai', 'tokens', aiRow?.tokens || 0);
    }

    // Sleep (table may not exist)
    if (tableExists(db, 'external_sessions')) {
      const sleepRow = safeQuery(db, `
        SELECT COALESCE(SUM(duration_s) / 3600.0, 0) as hours
        FROM external_sessions WHERE date(start_time) = ? AND activity = 'Sleep'
      `, date);
      stmt.run(date, 'sleep', 'hours', sleepRow?.hours || 0);
    }

    // Focus sessions (table may not exist)
    if (tableExists(db, 'productivity_sessions')) {
      const focusRow = safeQuery(db, `
        SELECT COUNT(*) as count, COALESCE(SUM(duration_s) / 60.0, 0) as minutes
        FROM productivity_sessions WHERE date(started_at) = ?
      `, date);
      stmt.run(date, 'focus', 'sessions', focusRow?.count || 0);
      stmt.run(date, 'focus', 'minutes', focusRow?.minutes || 0);
    }
  });

  tx();
}

// ═══════════════════════════════════════════════════════════════
// HELPER: fetch a metric's history from daily_rollup
// ═══════════════════════════════════════════════════════════════
function metricHistory(db: Database, domain: string, metric: string, days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const row = db.prepare(
      `SELECT value FROM daily_rollup WHERE date = ? AND domain = ? AND metric = ?`
    ).get(daysAgo(i + 1), domain, metric) as any;
    return row?.value || 0;
  });
}

function todayMetric(db: Database, domain: string, metric: string, date: string): number {
  const row = db.prepare(
    `SELECT value FROM daily_rollup WHERE date = ? AND domain = ? AND metric = ?`
  ).get(date, domain, metric) as any;
  return row?.value || 0;
}

// ═══════════════════════════════════════════════════════════════
// GENERATORS — one function per insight type
// ═══════════════════════════════════════════════════════════════

function genTopApp(db: Database, date: string): InsightAtom | null {
  const topApp = db.prepare(`
    SELECT app, SUM(duration_ms) / 60000.0 as minutes
    FROM logs WHERE date(timestamp) = ? GROUP BY app ORDER BY minutes DESC LIMIT 1
  `).get(date) as any;
  if (!topApp || topApp.minutes < 15) return null;

  const hist = metricHistory(db, 'apps', `app:${topApp.app}:min`, 14);
  const z = zScore(topApp.minutes, hist);
  const avg = mean(hist);
  const pct = avg > 0 ? Math.round(((topApp.minutes - avg) / avg) * 100) : 0;
  const direction = pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat';

  return {
    id: `top_app.day.${date}`,
    kind: 'superlative',
    scope: { period: 'day', start: date, end: date },
    domain: 'apps',
    value: Math.round(topApp.minutes),
    unit: 'min',
    comparison: { baseline: Math.round(avg), deltaPct: pct, direction },
    entities: [{ label: topApp.app, value: Math.round(topApp.minutes) }],
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.8,
    confidence: hist.filter(v => v > 0).length >= 3 ? 0.9 : 0.5,
    novelty: 0.5,
    visual: 'bigNumber',
    copy: {
      headline: `${Math.round(topApp.minutes)} min in ${topApp.app}`,
      subtext: direction === 'up' ? `${pct}% above your ${Math.round(avg)} min average — unusually heads-down` : direction === 'down' ? `${Math.abs(pct)}% below your ${Math.round(avg)} min average` : `Right on your ${Math.round(avg)} min average`,
      source: 'template',
    },
    shareable: true,
  };
}

function genProductivityRatio(db: Database, date: string): InsightAtom | null {
  const todayProd = todayMetric(db, 'productivity', 'productive_min', date);
  const todayTotal = todayMetric(db, 'productivity', 'total_min', date);
  if (todayTotal < 30) return null;

  const ratio = todayProd / todayTotal;
  const histProd = metricHistory(db, 'productivity', 'productive_min', 14);
  const histTotal = metricHistory(db, 'productivity', 'total_min', 14);
  const histRatios = histProd.map((p, i) => histTotal[i] > 0 ? p / histTotal[i] : 0);
  const z = zScore(ratio, histRatios);

  return {
    id: `ratio.day.${date}`,
    kind: 'ratio',
    scope: { period: 'day', start: date, end: date },
    domain: 'productivity',
    value: Math.round(ratio * 100),
    unit: 'pct',
    surprise: clamp(Math.abs(z) / 2, 0, 1),
    relevance: 0.9,
    confidence: 0.8,
    novelty: 0.4,
    visual: 'donut',
    copy: {
      headline: `${Math.round(ratio * 100)}% productive today`,
      subtext: ratio > 0.6 ? 'Crushing it — well above your typical ratio' : ratio > 0.4 ? 'Solid focus time — close to your norm' : 'Room for more deep work — below your typical ratio',
      source: 'template',
    },
    shareable: true,
  };
}

function genGitCommits(db: Database, date: string): InsightAtom | null {
  const todayCommits = todayMetric(db, 'git', 'commits', date);
  if (todayCommits <= 0) return null;

  const hist = metricHistory(db, 'git', 'commits', 14);
  const z = zScore(todayCommits, hist);
  const avg = mean(hist);

  if (Math.abs(z) < 0.8) return null; // not interesting enough

  return {
    id: `commits.day.${date}`,
    kind: todayCommits > avg ? 'record' : 'delta',
    scope: { period: 'day', start: date, end: date },
    domain: 'git',
    value: todayCommits,
    unit: 'commits',
    comparison: { baseline: Math.round(avg), deltaPct: Math.round(delta(todayCommits, avg)), direction: todayCommits > avg ? 'up' : 'down' },
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.7,
    confidence: 0.9,
    novelty: 0.6,
    visual: 'bigNumber',
    copy: {
      headline: `${todayCommits} commits today`,
      subtext: todayCommits > avg ? `${Math.round(delta(todayCommits, avg))}% above your ${Math.round(avg)} commit average — code marathon` : `${Math.abs(Math.round(delta(todayCommits, avg)))}% below your ${Math.round(avg)} commit average — quieter day`,
      source: 'template',
    },
    shareable: true,
  };
}

function genSleep(db: Database, date: string): InsightAtom | null {
  const todaySleep = todayMetric(db, 'sleep', 'hours', date);
  if (todaySleep <= 0) return null;

  const hist = metricHistory(db, 'sleep', 'hours', 14);
  const filteredHist = hist.filter(v => v > 0);
  const avgSleep = mean(filteredHist);
  if (avgSleep <= 0) return null;

  return {
    id: `sleep.day.${date}`,
    kind: 'pattern',
    scope: { period: 'day', start: date, end: date },
    domain: 'sleep',
    value: Math.round(todaySleep * 10) / 10,
    unit: 'hr',
    comparison: { baseline: Math.round(avgSleep * 10) / 10, deltaPct: Math.round(delta(todaySleep, avgSleep)), direction: todaySleep > avgSleep ? 'up' : 'down' },
    surprise: clamp(Math.abs(zScore(todaySleep, hist)) / 2, 0, 1),
    relevance: 0.6,
    confidence: 0.8,
    novelty: 0.3,
    visual: 'bigNumber',
    copy: {
      headline: `${Math.round(todaySleep * 10) / 10}h sleep`,
      subtext: todaySleep >= 7 ? `Well rested — ${Math.round(todaySleep * 10) / 10}h is above your ${Math.round(avgSleep * 10) / 10}h average` : todaySleep >= 6 ? `Could use more — ${Math.round(todaySleep * 10) / 10}h vs your ${Math.round(avgSleep * 10) / 10}h average` : `Sleep debt building — ${Math.round(todaySleep * 10) / 10}h is well below your ${Math.round(avgSleep * 10) / 10}h average`,
      source: 'template',
    },
    shareable: false,
  };
}

function genNightOwl(db: Database, date: string): InsightAtom | null {
  // Check hours 21-04 for activity
  const lateHours = [21, 22, 23, 0, 1, 2, 3, 4];
  const lateMinutes = lateHours.map(h => todayMetric(db, 'hourly', `hour:${h}`, date));
  const totalLate = lateMinutes.reduce((a, b) => a + b, 0);
  if (totalLate < 30) return null;

  const histLate = Array.from({ length: 14 }, (_, i) => {
    return lateHours.reduce((sum, h) => {
      const row = db.prepare(
        `SELECT value FROM daily_rollup WHERE date = ? AND domain = 'hourly' AND metric = ?`
      ).get(daysAgo(i + 1), `hour:${h}`) as any;
      return sum + (row?.value || 0);
    }, 0);
  });
  const z = zScore(totalLate, histLate);

  // Find peak hour
  const peakIdx = lateMinutes.indexOf(Math.max(...lateMinutes));
  const peakHour = lateHours[peakIdx];
  const peakLabel = peakHour === 0 ? 'midnight' : peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? 'noon' : `${peakHour - 12}pm`;

  return {
    id: `night_owl.day.${date}`,
    kind: 'pattern',
    scope: { period: 'day', start: date, end: date },
    domain: 'apps',
    value: Math.round(totalLate),
    unit: 'min',
    entities: [{ label: `Peak at ${peakLabel}`, value: Math.round(totalLate) }],
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.5,
    confidence: 0.7,
    novelty: 0.6,
    visual: 'radial24',
    copy: {
      headline: `${Math.round(totalLate)} late-night minutes`,
      subtext: `Peak at ${peakLabel} — ${Math.round(totalLate)} min of activity while most people sleep`,
      source: 'template',
    },
    shareable: true,
  };
}

function genContextSwitch(db: Database, date: string): InsightAtom | null {
  const switches = todayMetric(db, 'productivity', 'app_switches', date);
  if (switches < 5) return null;

  const hist = metricHistory(db, 'productivity', 'app_switches', 14);
  const z = zScore(switches, hist);
  const avg = mean(hist);
  if (Math.abs(z) < 1) return null;

  return {
    id: `context_switch.day.${date}`,
    kind: 'anomaly',
    scope: { period: 'day', start: date, end: date },
    domain: 'productivity',
    value: switches,
    unit: 'count',
    comparison: { baseline: Math.round(avg), deltaPct: Math.round(delta(switches, avg)), direction: switches > avg ? 'up' : 'down' },
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.7,
    confidence: 0.8,
    novelty: 0.5,
    visual: 'bar',
    copy: {
      headline: `${switches} app switches today`,
      subtext: switches > avg ? `${Math.round(delta(switches, avg))}% above your ${Math.round(avg)} switch average — scattered focus` : `${Math.abs(Math.round(delta(switches, avg)))}% below your ${Math.round(avg)} switch average — laser focused`,
      source: 'template',
    },
    shareable: true,
  };
}

function genFocusStreak(db: Database, date: string): InsightAtom | null {
  const hist = metricHistory(db, 'focus', 'minutes', 14).reverse(); // oldest first
  const activeDays = hist.map(v => v > 0 ? 1 : 0);
  const currentStreak = streak(activeDays.map((v, i) => ({ date: daysAgo(14 - i), value: v })), 1);

  if (currentStreak < 2) return null;

  return {
    id: `focus_streak.day.${date}`,
    kind: 'streak',
    scope: { period: 'day', start: date, end: date },
    domain: 'focus',
    value: currentStreak,
    unit: 'days',
    surprise: clamp(currentStreak / 7, 0, 1),
    relevance: 0.8,
    confidence: 0.9,
    novelty: 0.4,
    visual: 'calRing',
    copy: {
      headline: `${currentStreak}-day focus streak`,
      subtext: currentStreak >= 7 ? 'A full week of focus — incredible consistency!' : currentStreak >= 4 ? `Building momentum — ${currentStreak} days and counting` : `Nice start — ${currentStreak} consecutive days of focus`,
      source: 'template',
    },
    shareable: true,
  };
}

function genAISpend(db: Database, date: string): InsightAtom | null {
  const todayTokens = todayMetric(db, 'ai', 'tokens', date);
  if (todayTokens <= 0) return null;

  const hist = metricHistory(db, 'ai', 'tokens', 14);
  const z = zScore(todayTokens, hist);
  const avg = mean(hist);
  if (Math.abs(z) < 0.8) return null;

  // Convert to approximate cost ($0.002 per 1K tokens average)
  const costToday = Math.round(todayTokens / 1000 * 0.002 * 100) / 100;
  const costAvg = Math.round(avg / 1000 * 0.002 * 100) / 100;

  return {
    id: `ai_spend.day.${date}`,
    kind: 'superlative',
    scope: { period: 'day', start: date, end: date },
    domain: 'ai',
    value: costToday,
    unit: 'usd',
    comparison: { baseline: costAvg, deltaPct: Math.round(delta(todayTokens, avg)), direction: todayTokens > avg ? 'up' : 'down' },
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.6,
    confidence: 0.8,
    novelty: 0.5,
    visual: 'bigNumber',
    copy: {
      headline: `$${costToday} in AI tokens`,
      subtext: todayTokens > avg ? `${Math.round(delta(todayTokens, avg))}% above your $${costAvg} average — heavy AI day` : `Light AI usage — $${costToday} vs your $${costAvg} average`,
      source: 'template',
    },
    shareable: false,
  };
}

function genFocusRecord(db: Database, date: string): InsightAtom | null {
  const todayFocus = todayMetric(db, 'focus', 'minutes', date);
  if (todayFocus <= 0) return null;

  const hist = metricHistory(db, 'focus', 'minutes', 30);
  const max = Math.max(...hist, 0);
  if (todayFocus <= max || todayFocus < 60) return null; // only if it's a new record

  return {
    id: `focus_record.day.${date}`,
    kind: 'record',
    scope: { period: 'day', start: date, end: date },
    domain: 'focus',
    value: todayFocus,
    unit: 'min',
    comparison: { baseline: max, deltaPct: Math.round(delta(todayFocus, max)), direction: 'up' },
    surprise: 0.9,
    relevance: 0.9,
    confidence: 1.0,
    novelty: 0.7,
    visual: 'bigNumber',
    copy: {
      headline: `New focus record!`,
      subtext: `${Math.round(todayFocus)} min — ${Math.round(delta(todayFocus, max))}% above your 30-day max of ${Math.round(max)} min`,
      source: 'template',
    },
    shareable: true,
  };
}

function genProductivityBar(db: Database, date: string): InsightAtom | null {
  const todayProd = todayMetric(db, 'productivity', 'productive_min', date);
  if (todayProd <= 0) return null;

  const hist = metricHistory(db, 'productivity', 'productive_min', 7);
  const avg = mean(hist);

  return {
    id: `prod_bar.day.${date}`,
    kind: 'delta',
    scope: { period: 'day', start: date, end: date },
    domain: 'productivity',
    value: Math.round(todayProd),
    unit: 'min',
    comparison: { baseline: Math.round(avg), deltaPct: Math.round(delta(todayProd, avg)), direction: todayProd > avg ? 'up' : 'down' },
    surprise: clamp(Math.abs(zScore(todayProd, hist)) / 3, 0, 1),
    relevance: 0.8,
    confidence: 0.8,
    novelty: 0.3,
    visual: 'bar',
    copy: {
      headline: `${Math.round(todayProd)} productive minutes`,
      subtext: todayProd > avg ? `${Math.round(delta(todayProd, avg))}% above your ${Math.round(avg)} min 7-day average` : `${Math.abs(Math.round(delta(todayProd, avg)))}% below your ${Math.round(avg)} min 7-day average`,
      source: 'template',
    },
    shareable: true,
  };
}

// ═══════════════════════════════════════════════════════════════
// GENERATORS — continued (sleepVsFocus, consistency, polyglot)
// ═══════════════════════════════════════════════════════════════

function genSleepVsFocus(db: Database, date: string): InsightAtom | null {
  const todaySleep = todayMetric(db, 'sleep', 'hours', date);
  const todayFocus = todayMetric(db, 'focus', 'minutes', date);
  if (todaySleep <= 0 || todayFocus <= 0) return null;

  // Check if sleep was good (>=7h) and focus was above average
  const focusHist = metricHistory(db, 'focus', 'minutes', 14);
  const avgFocus = mean(focusHist.filter(v => v > 0));
  if (avgFocus <= 0) return null;

  const focusRatio = todayFocus / avgFocus;
  if (todaySleep >= 7 && focusRatio > 1.2) {
    return {
      id: `sleep_focus.day.${date}`,
      kind: 'pattern',
      scope: { period: 'day', start: date, end: date },
      domain: 'focus',
      value: Math.round(todayFocus),
      unit: 'min',
      entities: [
        { label: `${Math.round(todaySleep * 10) / 10}h sleep`, value: Math.round(todaySleep * 60) },
        { label: `${Math.round(focusRatio * 100)}% of avg focus`, value: Math.round(focusRatio * 100) },
      ],
      surprise: clamp(focusRatio / 2, 0, 1),
      relevance: 0.7,
      confidence: 0.8,
      novelty: 0.5,
      visual: 'bar',
      copy: {
        headline: `Slept well, focused hard`,
        subtext: `${Math.round(todaySleep * 10) / 10}h sleep led to ${Math.round(focusRatio * 100)}% above-average focus`,
        source: 'template',
      },
      shareable: true,
    };
  }
  return null;
}

function genConsistency(db: Database, date: string): InsightAtom | null {
  // Calculate consistency: days with >30 min productive in the last 7 days
  const prodHist = metricHistory(db, 'productivity', 'productive_min', 7);
  const activeDays = prodHist.filter(v => v > 30).length;
  if (activeDays < 3) return null; // need at least 3 active days to be interesting

  const consistencyPct = Math.round((activeDays / 7) * 100);
  const prevHist = metricHistory(db, 'productivity', 'productive_min', 14);
  const prevActiveDays = prevHist.slice(0, 7).filter(v => v > 30).length;
  const prevConsistencyPct = Math.round((prevActiveDays / 7) * 100);
  const deltaPct = consistencyPct - prevConsistencyPct;

  return {
    id: `consistency.day.${date}`,
    kind: 'streak',
    scope: { period: 'day', start: date, end: date },
    domain: 'productivity',
    value: activeDays,
    unit: 'days',
    comparison: { baseline: prevActiveDays, deltaPct, direction: deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat' },
    surprise: clamp(consistencyPct / 100, 0, 1),
    relevance: 0.8,
    confidence: 0.9,
    novelty: 0.4,
    visual: 'calRing',
    copy: {
      headline: `${activeDays}/7 productive days`,
      subtext: consistencyPct >= 80 ? 'Incredible consistency this week!' : consistencyPct >= 50 ? 'Solid week — keep the momentum' : 'Room to build more consistent habits',
      source: 'template',
    },
    shareable: true,
  };
}

function genPolyglot(db: Database, date: string): InsightAtom | null {
  // Check distinct apps used today (proxy for "polyglot" — using many tools)
  const appRows = db.prepare(`
    SELECT COUNT(DISTINCT app) as distinctApps
    FROM logs WHERE date(timestamp) = ?
  `).get(date) as any;
  if (!appRows || appRows.distinctApps < 5) return null;

  const distinctApps = appRows.distinctApps;
  const hist = Array.from({ length: 14 }, (_, i) => {
    const row = db.prepare(
      `SELECT COUNT(DISTINCT app) as c FROM logs WHERE date(timestamp) = ?`
    ).get(daysAgo(i + 1)) as any;
    return row?.c || 0;
  });
  const avg = mean(hist);
  const z = zScore(distinctApps, hist);
  if (Math.abs(z) < 0.8) return null;

  return {
    id: `polyglot.day.${date}`,
    kind: 'superlative',
    scope: { period: 'day', start: date, end: date },
    domain: 'apps',
    value: distinctApps,
    unit: 'count',
    comparison: { baseline: Math.round(avg), deltaPct: Math.round(delta(distinctApps, avg)), direction: distinctApps > avg ? 'up' : 'down' },
    surprise: clamp(Math.abs(z) / 3, 0, 1),
    relevance: 0.6,
    confidence: 0.8,
    novelty: 0.5,
    visual: 'donut',
    copy: {
      headline: `${distinctApps} different tools today`,
      subtext: distinctApps > avg ? 'A polyglot day — juggling more apps than usual' : 'Focused toolkit — fewer context switches',
      source: 'template',
    },
    shareable: true,
  };
}

// ═══════════════════════════════════════════════════════════════
// ALL GENERATORS — ordered by priority
// ═══════════════════════════════════════════════════════════════
const ALL_GENERATORS = [
  genFocusRecord,
  genTopApp,
  genProductivityRatio,
  genGitCommits,
  genNightOwl,
  genContextSwitch,
  genFocusStreak,
  genSleep,
  genAISpend,
  genProductivityBar,
  genSleepVsFocus,
  genConsistency,
  genPolyglot,
];

// ═══════════════════════════════════════════════════════════════
// SCORING & DIVERSITY SELECTION
// ═══════════════════════════════════════════════════════════════
function scoreAndSelect(atoms: InsightAtom[], maxCount: number, db?: Database): InsightAtom[] {
  // Score each atom
  const scored = atoms.map(a => ({ ...a, _score: score(a) }));

  // Apply novelty penalty: penalize insights shown in the last 2 days
  if (db) {
    try {
      const recentIds = db.prepare(
        `SELECT atom_id FROM insight_log WHERE shown_at > datetime('now', '-2 days')`
      ).all() as any[];
      const recentSet = new Set(recentIds.map(r => r.atom_id));
      for (const a of scored) {
        if (recentSet.has(a.id)) a._score *= 0.3; // heavy penalty for repeats
      }
    } catch { /* insight_log may not exist yet */ }
  }

  // Sort by score descending
  scored.sort((a, b) => b._score - a._score);
  // Greedy diversity: max 2 per domain
  const selected: InsightAtom[] = [];
  const domainCounts: Record<string, number> = {};
  for (const atom of scored) {
    const dc = domainCounts[atom.domain] || 0;
    if (dc >= 2) continue;
    selected.push(atom);
    domainCounts[atom.domain] = dc + 1;
    if (selected.length >= maxCount) break;
  }
  return selected;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API: dailyFunFact — returns the best single fact for today
// ═══════════════════════════════════════════════════════════════
export function dailyFunFact(db: Database, date: string): InsightAtom | null {
  const candidates: InsightAtom[] = [];
  for (const gen of ALL_GENERATORS) {
    const atom = gen(db, date);
    if (atom) candidates.push(atom);
  }
  if (candidates.length === 0) return null;
  return scoreAndSelect(candidates, 1, db)[0];
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API: buildInsightStrip — returns 3-4 atoms for InsightsPage
// ═══════════════════════════════════════════════════════════════
export function buildInsightStrip(db: Database, period: string): InsightAtom[] {
  const date = today();
  const candidates: InsightAtom[] = [];

  // Ensure today's rollup is fresh before querying it
  buildDailyRollup(db, date);

  // Generate for today
  for (const gen of ALL_GENERATORS) {
    const atom = gen(db, date);
    if (atom) candidates.push(atom);
  }

  // Also generate for yesterday for variety
  const yesterday = daysAgo(1);
  buildDailyRollup(db, yesterday); // ensure yesterday is rolled up
  for (const gen of ALL_GENERATORS) {
    const atom = gen(db, yesterday);
    if (atom) {
      // Shift the ID to avoid collision
      atom.id = atom.id.replace('.day.', '.day.y.');
      candidates.push(atom);
    }
  }

  return scoreAndSelect(candidates, 4, db);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API: generateRewind — full rewind for a period (month/week)
// ═══════════════════════════════════════════════════════════════
export function generateRewind(db: Database, periodKey: string): any {
  // Check cache first — invalidate if >24h old for current period
  const cached = db.prepare(`SELECT json, built_at FROM rewind_cache WHERE period_key = ?`).get(periodKey) as any;
  if (cached) {
    try {
      const data = JSON.parse(cached.json);
      // Invalidate if cache is older than 24 hours
      if (cached.built_at) {
        const builtAt = new Date(cached.built_at).getTime();
        if (Date.now() - builtAt < 24 * 60 * 60 * 1000) {
          return data;
        }
      } else {
        return data;
      }
    } catch { /* fall through */ }
  }

  // Parse period key (e.g. "2026-06" for month, "2026-W23" for week)
  const isMonth = periodKey.length === 7; // YYYY-MM
  const isWeek = periodKey.includes('-W');
  const startDate = isWeek ? weekStart(periodKey) : `${periodKey}-01`;
  const endDate = isWeek ? weekEnd(periodKey) : monthEnd(periodKey);

  // Generate daily facts for each day in the period
  const days = dateRange(startDate, endDate);
  const allAtoms: InsightAtom[] = [];

  for (const d of days) {
    buildDailyRollup(db, d);
    for (const gen of ALL_GENERATORS) {
      const atom = gen(db, d);
      if (atom) allAtoms.push(atom);
    }
  }

  // Select top insights for the rewind
  const topInsights = scoreAndSelect(allAtoms, 10, db);

  // Build archetype narrative
  const archetype = determineArchetype(db, startDate, endDate);

  const rewind = {
    period: periodKey,
    startDate,
    endDate,
    archetype,
    insights: topInsights,
    summary: {
      totalDays: days.length,
      topDomain: findTopDomain(allAtoms),
      bestDay: findBestDay(db, days),
      totalScore: Math.round(topInsights.reduce((sum, a) => sum + score(a), 0) / topInsights.length * 100),
    },
  };

  // Cache the result
  try {
    db.prepare(
      `INSERT OR REPLACE INTO rewind_cache (period_key, json, built_at) VALUES (?, ?, datetime('now'))`
    ).run(periodKey, JSON.stringify(rewind));
  } catch (err) {
    console.error('[InsightEngine] rewind cache error:', err);
  }

  return rewind;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API: logInsightEvent — record insight shown/dismissed/shared
// ═══════════════════════════════════════════════════════════════
export function logInsightEvent(db: Database, atomId: string, event: 'shown' | 'dismissed' | 'shared', period: string) {
  try {
    db.prepare(
      `INSERT INTO insight_log (id, atom_id, shown_at, period, dismissed, shared) VALUES (?, ?, datetime('now'), ?, ?, ?)`
    ).run(`${atomId}-${Date.now()}`, atomId, period, event === 'dismissed' ? 1 : 0, event === 'shared' ? 1 : 0);
  } catch { /* insight_log may not exist */ }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function weekStart(key: string): string {
  const [year, week] = key.split('-W').map(Number);
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + ((8 - dayOfWeek) % 7 || 7));
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  return weekStart.toISOString().slice(0, 10);
}

function weekEnd(key: string): string {
  const start = weekStart(key);
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function monthEnd(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
}

function findTopDomain(atoms: InsightAtom[]): string {
  const counts: Record<string, number> = {};
  for (const a of atoms) {
    counts[a.domain] = (counts[a.domain] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'productivity';
}

function findBestDay(db: Database, days: string[]): string {
  let best = days[0];
  let bestProd = 0;
  for (const d of days) {
    const prod = todayMetric(db, 'productivity', 'productive_min', d);
    if (prod > bestProd) {
      bestProd = prod;
      best = d;
    }
  }
  return best;
}

function determineArchetype(db: Database, start: string, end: string): { name: string; emoji: string; description: string } {
  // Analyze the period's data to determine archetype
  const totalGit = metricHistory(db, 'git', 'commits', 30).reduce((a, b) => a + b, 0);
  const totalFocus = metricHistory(db, 'focus', 'minutes', 30).reduce((a, b) => a + b, 0);
  const totalAI = metricHistory(db, 'ai', 'tokens', 30).reduce((a, b) => a + b, 0);
  const totalSleep = metricHistory(db, 'sleep', 'hours', 30).reduce((a, b) => a + b, 0);

  // Simple archetype detection
  if (totalGit > 20 && totalFocus > 600) {
    return { name: 'The Builder', emoji: '🔧', description: 'You shipped code and stayed focused — a powerful combo.' };
  } else if (totalAI > 50000) {
    return { name: 'The Explorer', emoji: '🧭', description: 'AI was your copilot this month — curiosity led the way.' };
  } else if (totalSleep > 200) {
    return { name: 'The Rested One', emoji: '😴', description: 'You prioritized rest — and it showed in your energy.' };
  } else if (totalFocus > 1000) {
    return { name: 'The Deep Diver', emoji: '🤿', description: 'Deep work was your superpower this month.' };
  } else {
    return { name: 'The Balanced One', emoji: '⚖️', description: 'A steady month with a healthy mix of everything.' };
  }
}
