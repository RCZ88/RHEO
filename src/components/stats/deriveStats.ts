export interface AnalyticsRawData {
  aiUsage?: {
    totalTokens?: number;
    totalCost?: number;
    totalMessages?: number;
    byTool?: Record<string, {
      tokens?: number;
      cost?: number;
      sessions?: number;
      messageCount?: number;
      daily?: Record<string, { tokens?: number; cost?: number; sessions?: number; messageCount?: number }>;
    }>;
  } | null;
  sessions?: Array<{ agent?: string; status?: string }>;
}

export interface DerivedStats {
  totalTokens: string;
  totalCost: string;
  activeSessions: string;
  toolsModels: string;
  totalTokensNum: number;
  totalCostNum: number;
  activeSessionsNum: number;
  toolsModelsNum: number;
  dailyAvgTokens: string;
  dailyAvgCost: string;
  dailyAvgMessages: string;
  dailyAvgTokensNum: number;
  dailyAvgCostNum: number;
  dailyAvgMessagesNum: number;
  activeDays: number;
  tokensByTool: { labels: string[]; values: number[] };
  sessionsByAgent: { labels: string[]; values: number[] };
  hasData: boolean;
}

const fmtNum = (n: number) => {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + 'T';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};

const fmtCost = (n: number) => {
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  if (n > 0) return '$' + n.toFixed(4);
  return '$0.00';
};

export function deriveStats(raw: AnalyticsRawData, timeframeDays?: number): DerivedStats {
  const aiUsage = raw.aiUsage;
  const sessions = raw.sessions || [];

  const totalTokens = aiUsage?.totalTokens || 0;
  const totalCost = aiUsage?.totalCost || 0;
  const totalMessages = aiUsage?.totalMessages || 0;
  const toolsModels = aiUsage?.byTool ? Object.keys(aiUsage.byTool).length : 0;

  // Count AI sessions from byTool (ai_usage row counts), not terminal_sessions
  const byTool = aiUsage?.byTool || {};
  let totalAISessions = 0;
  const activeDaysSet = new Set<string>();
  let dailyTotalTokens = 0;
  let dailyTotalCost = 0;
  let dailyTotalMessages = 0;

  for (const data of Object.values(byTool)) {
    totalAISessions += (data as any)?.sessions || 0;
    const daily = (data as any)?.daily;
    if (daily) {
      for (const [dayStr, dayData] of Object.entries(daily)) {
        activeDaysSet.add(dayStr);
        dailyTotalTokens += (dayData as any)?.tokens || 0;
        dailyTotalCost += (dayData as any)?.cost || 0;
        dailyTotalMessages += (dayData as any)?.messageCount || 0;
      }
    }
  }

  const activeDays = activeDaysSet.size || 1;

  // Use the caller-supplied timeframeDays (calendar days in the selected period)
  // when available; otherwise fall back to the data-range computation.
  const computedTimeframeDays = timeframeDays ?? (() => {
    const allDayStrs: string[] = [];
    for (const data of Object.values(byTool)) {
      const daily = (data as any)?.daily;
      if (daily) {
        for (const dayStr of Object.keys(daily)) {
          if (!allDayStrs.includes(dayStr)) allDayStrs.push(dayStr);
        }
      }
    }
    allDayStrs.sort();
    if (allDayStrs.length >= 2) {
      const first = new Date(allDayStrs[0]).getTime();
      const last = new Date(allDayStrs[allDayStrs.length - 1]).getTime();
      return Math.round((last - first) / 86400000) + 1;
    } else if (allDayStrs.length === 1) {
      return 1;
    } else {
      return activeDays;
    }
  })();

  const divisor = computedTimeframeDays > 0 ? computedTimeframeDays : 1;
  const dailyAvgTokens = totalTokens / divisor;
  const dailyAvgCost = totalCost / divisor;
  const dailyAvgMessages = totalMessages / divisor;

  const tokenEntries = Object.entries(byTool)
    .map(([tool, data]) => ({ tool, tokens: (data as any)?.tokens || 0 }))
    .sort((a, b) => b.tokens - a.tokens);

  // Session counts by agent from terminal_sessions (for the bar chart)
  const sessionCounts: Record<string, number> = {};
  for (const s of sessions) {
    const agent = s.agent || 'Unknown';
    sessionCounts[agent] = (sessionCounts[agent] || 0) + 1;
  }
  const sessionEntries = Object.entries(sessionCounts).sort((a, b) => b[1] - a[1]);

  return {
    totalTokens: fmtNum(totalTokens),
    totalCost: fmtCost(totalCost),
    activeSessions: String(totalAISessions),
    toolsModels: String(toolsModels),
    totalTokensNum: totalTokens,
    totalCostNum: totalCost,
    activeSessionsNum: totalAISessions,
    toolsModelsNum: toolsModels,
    dailyAvgTokens: fmtNum(Math.round(dailyAvgTokens)),
    dailyAvgCost: fmtCost(dailyAvgCost),
    dailyAvgMessages: fmtNum(Math.round(dailyAvgMessages)),
    dailyAvgTokensNum: Math.round(dailyAvgTokens),
    dailyAvgCostNum: dailyAvgCost,
    dailyAvgMessagesNum: Math.round(dailyAvgMessages),
    activeDays,
    tokensByTool: { labels: tokenEntries.map(e => e.tool), values: tokenEntries.map(e => e.tokens) },
    sessionsByAgent: { labels: sessionEntries.map(e => e[0]), values: sessionEntries.map(e => e[1]) },
    hasData: totalTokens > 0 || totalAISessions > 0,
  };
}
