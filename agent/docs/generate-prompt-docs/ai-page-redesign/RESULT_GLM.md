```markdown
# RESULT — AiPage Redesign

---

## 1. Prompt Rewrites

### Daily Brief (`AIService.ts` line 167)

Replace the existing `DAILY_BRIEF_PROMPT` constant entirely:

```typescript
const DAILY_BRIEF_PROMPT = `You are a sharp, honest productivity analyst. Given the user's daily activity data below, produce a concise daily briefing.

RULES:
- Be specific — cite actual numbers, app names, and percentages from the data
- Be honest — if the day was unproductive, say so directly
- Write observation and suggestion in second person
- The signal must be 2-3 words maximum, capturing the day's theme
- Each metric must reference real data from the input

Return ONLY valid JSON matching this exact schema (no markdown, no code fences, no commentary):
{
  "signal": "string (2-3 words capturing the day's theme)",
  "observation": "string (1 sentence: what happened today, with specific data)",
  "suggestion": "string (1 sentence: concrete action for tomorrow)",
  "trend": "improving" | "stable" | "declining",
  "metrics": [
    { "key": "string (metric name, e.g. 'Focus Time')", "value": "string (formatted value, e.g. '4h 12m')", "trend": "up" | "down" | "flat" }
  ]
}

Include 3-5 metrics covering focus time, productive percentage, top app, and any notable change from yesterday.`;
```

### Pattern Analysis (`AIService.ts` line 331)

Replace the inline prompt text inside `analyzePatterns()` method body:

```typescript
const PATTERN_ANALYSIS_PROMPT = `You are a behavioral data scientist analyzing 30 days of productivity data. Identify meaningful patterns in how the user spends time.

RULES:
- Each pattern must cite specific data points (hours, days, percentages)
- Impact must reflect actual effect on productivity — "negative" if it correlates with lost focus, "positive" if it correlates with high output, "neutral" if unclear
- Frequency describes how often the pattern occurs (e.g. "3-4x per week", "every Friday", "weekends only")
- Recommendation is optional — include only if you have an actionable, specific suggestion
- Score reflects overall pattern health: 70+ means patterns are mostly beneficial, below 40 means concerning trends dominate
- Assessment should be 1-2 sentences summarizing the overall pattern landscape

Return ONLY valid JSON matching this exact schema (no markdown, no code fences, no commentary):
{
  "score": number (0-100, overall pattern health score),
  "assessment": "string (1-2 sentence summary of pattern landscape)",
  "patterns": [
    {
      "name": "string (short pattern name, e.g. 'Friday Slump', 'Morning Deep Work')",
      "description": "string (1-2 sentences describing the pattern with data citations)",
      "impact": "positive" | "neutral" | "negative",
      "frequency": "string (how often, e.g. 'Daily', '3x per week', 'Weekends')",
      "recommendation": "string (optional: specific actionable suggestion)"
    }
  ]
}

Identify 3-6 patterns. Include at least one positive and one negative pattern if the data supports it.`;
```

### Sleep Analysis (`AIService.ts` line 353)

Replace the inline prompt text inside `analyzeSleep()` method body:

```typescript
const SLEEP_ANALYSIS_PROMPT = `You are a sleep researcher analyzing the relationship between sleep patterns and next-day productivity. You have sleep session data and corresponding productivity metrics.

RULES:
- Score reflects sleep-productivity alignment: 70+ means good sleep correlates with productive days, below 40 means poor alignment
- Correlation should describe the statistical relationship in plain language (e.g. "Later bedtimes strongly predict lower focus the next day")
- optimalBedtime is optional — only include if a clear optimal bedtime emerges from the data
- Insomnia assessment should note any patterns of delayed sleep onset, early waking, or insufficient duration
- Suggestions should be specific and data-grounded, not generic sleep hygiene advice
- Icon names must be valid Lucide icon identifiers (e.g. "moon", "clock", "alarm-clock", "bed", "coffee", "sun", "zap", "brain", "heart", "activity")

Return ONLY valid JSON matching this exact schema (no markdown, no code fences, no commentary):
{
  "score": number (0-100, sleep-productivity alignment score),
  "correlation": "string (1-2 sentences describing the sleep-productivity relationship)",
  "optimalBedtime": "string (optional, e.g. '22:30' in 24h format — only if data supports a specific recommendation)",
  "insomnia": "string (1-2 sentences assessing insomnia risk or symptoms from the data)",
  "suggestions": [
    {
      "icon": "string (Lucide icon name, e.g. 'moon', 'clock', 'alarm-clock')",
      "title": "string (short title, e.g. 'Shift Bedtime Earlier')",
      "detail": "string (1-2 sentences with specific, data-backed advice)"
    }
  ]
}

Provide 2-4 suggestions. Each must reference the user's actual data.`;
```

---

## 2. Parsing Layer

### New Type Definitions

Add at the top of `src/services/AIService.ts`, after existing imports:

```typescript
// ─── Structured AI Response Types ──────────────────────────────────────────────

export interface ParsedDailyBrief {
  signal: string;
  observation: string;
  suggestion: string;
  trend: 'improving' | 'stable' | 'declining';
  metrics: Array<{
    key: string;
    value: string;
    trend: 'up' | 'down' | 'flat';
  }>;
}

export interface ParsedPatternResponse {
  score: number;
  assessment: string;
  patterns: Array<{
    name: string;
    description: string;
    impact: 'positive' | 'neutral' | 'negative';
    frequency: string;
    recommendation?: string;
  }>;
}

export interface ParsedSleepResponse {
  score: number;
  correlation: string;
  optimalBedtime?: string;
  insomnia: string;
  suggestions: Array<{
    icon: string;
    title: string;
    detail: string;
  }>;
}
```

### Fallback Parse Functions

Add after the existing `parseAIJson<T>` function in `src/services/AIService.ts`:

```typescript
// ─── Fallback Parsers ─────────────────────────────────────────────────────────
// When JSON.parse fails even after cleanAIJson(), these regex-based extractors
// produce a valid typed object from plain-text AI output.

function clampScore(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

function normalizeTrend(raw: string): 'improving' | 'stable' | 'declining' {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('improv') || lower.includes('better') || lower.includes('up')) return 'improving';
  if (lower.includes('declin') || lower.includes('worse') || lower.includes('down')) return 'declining';
  return 'stable';
}

function normalizeMetricTrend(raw: string): 'up' | 'down' | 'flat' {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('up') || lower.includes('increas') || lower.includes('higher') || lower === '+') return 'up';
  if (lower.includes('down') || lower.includes('decreas') || lower.includes('lower') || lower === '-') return 'down';
  return 'flat';
}

function normalizeImpact(raw: string): 'positive' | 'neutral' | 'negative' {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('posit') || lower.includes('good') || lower.includes('beneficial')) return 'positive';
  if (lower.includes('negat') || lower.includes('bad') || lower.includes('harmful')) return 'negative';
  return 'neutral';
}

/**
 * Attempt to parse a Daily Brief response.
 * 1. Try parseAIJson<ParsedDailyBrief>
 * 2. On failure, extract fields via regex from plain text
 */
export function parseDailyBrief(raw: string): ParsedDailyBrief {
  try {
    const parsed = parseAIJson<ParsedDailyBrief>(raw);
    // Validate required fields exist
    if (parsed.signal !== undefined && parsed.observation !== undefined) {
      return {
        signal: String(parsed.signal || ''),
        observation: String(parsed.observation || ''),
        suggestion: String(parsed.suggestion || ''),
        trend: normalizeTrend(String(parsed.trend || 'stable')),
        metrics: Array.isArray(parsed.metrics)
          ? parsed.metrics.map((m: any) => ({
              key: String(m.key || 'Metric'),
              value: String(m.value || '—'),
              trend: normalizeMetricTrend(String(m.trend || 'flat')),
            }))
          : [],
      };
    }
  } catch { /* fall through to regex */ }

  // ── Regex fallback ──
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  const signalMatch = raw.match(/(?:signal|theme|headline)[:\s]+(.+?)(?:\n|$)/i);
  const observationMatch = raw.match(/(?:observation|summary|overview)[:\s]+(.+?)(?:\n|$)/i);
  const suggestionMatch = raw.match(/(?:suggestion|recommendation|action)[:\s]+(.+?)(?:\n|$)/i);
  const trendMatch = raw.match(/(?:trend|direction)[:\s]+(.+?)(?:\n|$)/i);

  // Extract metrics from lines like "Focus Time: 4h 12m ↑" or "- Focus Time: 4h (up)"
  const metrics: ParsedDailyBrief['metrics'] = [];
  const metricLineRegex = /[-•*]\s*(.+?):\s*(.+?)(?:\s*[\(⟨\[]?(up|down|flat|↑|↓|→|➡|-)[\)⟩\]]?)?\s*$/i;
  for (const line of lines) {
    const m = line.match(metricLineRegex);
    if (m) {
      let trend: 'up' | 'down' | 'flat' = 'flat';
      const trendStr = (m[3] || '').trim();
      if (['up', '↑'].includes(trendStr)) trend = 'up';
      else if (['down', '↓'].includes(trendStr)) trend = 'down';
      metrics.push({ key: m[1].trim(), value: m[2].trim(), trend });
    }
  }

  return {
    signal: signalMatch?.[1]?.trim() || lines[0]?.slice(0, 40) || 'Daily summary',
    observation: observationMatch?.[1]?.trim() || lines.slice(0, 2).join(' ').slice(0, 200) || '',
    suggestion: suggestionMatch?.[1]?.trim() || '',
    trend: normalizeTrend(trendMatch?.[1] || ''),
    metrics,
  };
}

/**
 * Attempt to parse a Pattern Analysis response.
 * 1. Try parseAIJson<ParsedPatternResponse>
 * 2. On failure, extract fields via regex from plain text
 */
export function parsePatternResponse(raw: string): ParsedPatternResponse {
  try {
    const parsed = parseAIJson<ParsedPatternResponse>(raw);
    if (parsed.score !== undefined && Array.isArray(parsed.patterns)) {
      return {
        score: clampScore(Number(parsed.score) || 50),
        assessment: String(parsed.assessment || ''),
        patterns: parsed.patterns.map((p: any) => ({
          name: String(p.name || 'Pattern'),
          description: String(p.description || ''),
          impact: normalizeImpact(String(p.impact || 'neutral')),
          frequency: String(p.frequency || ''),
          recommendation: p.recommendation ? String(p.recommendation) : undefined,
        })),
      };
    }
  } catch { /* fall through */ }

  // ── Regex fallback ──
  const scoreMatch = raw.match(/(?:score|rating|health)[:\s]+(\d{1,3})/i);
  const assessmentMatch = raw.match(/(?:assessment|overall|summary)[:\s]+(.+?)(?:\n\n|\n[-•]|\n#|$)/is);
  const lines = raw.split('\n');

  const patterns: ParsedPatternResponse['patterns'] = [];
  let currentPattern: Partial<ParsedPatternResponse['patterns'][0]> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect pattern header lines: "1. Pattern Name" or "- Pattern Name" or "**Pattern Name**"
    const headerMatch = trimmed.match(/^(?:\d+[.\):]\s*|[-•*]\s*)(?:\*\*)?(.+?)(?:\*\*)?(?:\s*[-–—]\s*)?$/);
    // Detect impact mention
    const impactMatch = trimmed.match(/impact[:\s]+(positive|neutral|negative|good|bad)/i);
    // Detect frequency mention
    const freqMatch = trimmed.match(/frequency[:\s]+(.+?)(?:\n|$)/i);
    // Detect recommendation
    const recMatch = trimmed.match(/(?:recommend|suggest|action)[:\s]+(.+?)(?:\n|$)/i);

    if (impactMatch && currentPattern) {
      currentPattern.impact = normalizeImpact(impactMatch[1]);
    } else if (freqMatch && currentPattern) {
      currentPattern.frequency = freqMatch[1].trim();
    } else if (recMatch && currentPattern) {
      currentPattern.recommendation = recMatch[1].trim();
    } else if (headerMatch && trimmed.length > 3 && trimmed.length < 80 && !trimmed.match(/^(score|assessment|overall|summary|pattern)/i)) {
      // Save previous pattern
      if (currentPattern?.name) {
        patterns.push({
          name: currentPattern.name,
          description: currentPattern.description || '',
          impact: currentPattern.impact || 'neutral',
          frequency: currentPattern.frequency || '',
          recommendation: currentPattern.recommendation,
        });
      }
      currentPattern = { name: headerMatch[1].trim() };
    } else if (currentPattern && !currentPattern.description && trimmed.length > 10) {
      currentPattern.description = trimmed;
    }
  }
  // Save last pattern
  if (currentPattern?.name) {
    patterns.push({
      name: currentPattern.name,
      description: currentPattern.description || '',
      impact: currentPattern.impact || 'neutral',
      frequency: currentPattern.frequency || '',
      recommendation: currentPattern.recommendation,
    });
  }

  return {
    score: clampScore(scoreMatch ? parseInt(scoreMatch[1], 10) : 50),
    assessment: assessmentMatch?.[1]?.trim() || '',
    patterns: patterns.length > 0 ? patterns : [{
      name: 'Analysis Result',
      description: raw.slice(0, 300),
      impact: 'neutral',
      frequency: '',
    }],
  };
}

/**
 * Attempt to parse a Sleep Analysis response.
 * 1. Try parseAIJson<ParsedSleepResponse>
 * 2. On failure, extract fields via regex from plain text
 */
export function parseSleepResponse(raw: string): ParsedSleepResponse {
  try {
    const parsed = parseAIJson<ParsedSleepResponse>(raw);
    if (parsed.score !== undefined && parsed.correlation !== undefined) {
      return {
        score: clampScore(Number(parsed.score) || 50),
        correlation: String(parsed.correlation || ''),
        optimalBedtime: parsed.optimalBedtime ? String(parsed.optimalBedtime) : undefined,
        insomnia: String(parsed.insomnia || ''),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map((s: any) => ({
              icon: String(s.icon || 'moon'),
              title: String(s.title || 'Suggestion'),
              detail: String(s.detail || ''),
            }))
          : [],
      };
    }
  } catch { /* fall through */ }

  // ── Regex fallback ──
  const scoreMatch = raw.match(/(?:score|rating|alignment)[:\s]+(\d{1,3})/i);
  const correlationMatch = raw.match(/(?:correlation|relationship|connection)[:\s]+(.+?)(?:\n\n|\n[-•]|\n#|$)/is);
  const bedtimeMatch = raw.match(/(?:optimal\s*(?:bed)?time|bedtime|ideal\s*time)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i);
  const insomniaMatch = raw.match(/(?:insomnia|sleep\s*quality|sleep\s*issues)[:\s]+(.+?)(?:\n\n|\n[-•]|\n#|$)/is);

  const suggestions: ParsedSleepResponse['suggestions'] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const sugMatch = trimmed.match(/^(?:\d+[.\):]\s*|[-•*]\s*)(?:\*\*)?(.+?)(?:\*\*)?(?:\s*[-–—:]\s*)(.+)$/);
    if (sugMatch) {
      suggestions.push({
        icon: 'moon',
        title: sugMatch[1].trim(),
        detail: sugMatch[2].trim(),
      });
    }
  }

  return {
    score: clampScore(scoreMatch ? parseInt(scoreMatch[1], 10) : 50),
    correlation: correlationMatch?.[1]?.trim() || '',
    optimalBedtime: bedtimeMatch?.[1]?.trim(),
    insomnia: insomniaMatch?.[1]?.trim() || '',
    suggestions: suggestions.length > 0 ? suggestions : [{
      icon: 'moon',
      title: 'Sleep Insight',
      detail: raw.slice(0, 200),
    }],
  };
}
```

### Modified AIService Methods

Replace the three methods in `src/services/AIService.ts`:

```typescript
// ─── generateDailyBrief (replace existing) ────────────────────────────────────

async generateDailyBrief(
  apiKey: string,
  data: Record<string, any>,
  model?: string,
): Promise<{ content: ParsedDailyBrief; usage?: any }> {
  const prompt = `${DAILY_BRIEF_PROMPT}\n\nUser's daily data:\n${JSON.stringify(data, null, 2)}`;
  const raw = await this.callOpenRouter(prompt, model || this.defaultModel);
  const content = parseDailyBrief(raw.content);
  return { content, usage: raw.usage };
}

// ─── analyzePatterns (replace existing) ───────────────────────────────────────

async analyzePatterns(
  apiKey: string,
  data: Record<string, any>,
  model?: string,
): Promise<{ content: ParsedPatternResponse; usage?: any }> {
  const prompt = `${PATTERN_ANALYSIS_PROMPT}\n\n30-day daily summaries:\n${JSON.stringify(data, null, 2)}`;
  const raw = await this.callOpenRouter(prompt, model || this.defaultModel);
  const content = parsePatternResponse(raw.content);
  return { content, usage: raw.usage };
}

// ─── analyzeSleep (replace existing) ──────────────────────────────────────────

async analyzeSleep(
  apiKey: string,
  data: Record<string, any>,
  model?: string,
): Promise<{ content: ParsedSleepResponse; usage?: any }> {
  const prompt = `${SLEEP_ANALYSIS_PROMPT}\n\nSleep data:\n${JSON.stringify(data, null, 2)}\n\nProductivity data:\n${JSON.stringify(data.productivitySummary, null, 2)}`;
  const raw = await this.callOpenRouter(prompt, model || this.defaultModel);
  const content = parseSleepResponse(raw.content);
  return { content, usage: raw.usage };
}
```

---

## 3. Persistence Strategy

### localStorage Helpers

Add to a new file `src/services/AiCache.ts`:

```typescript
// ─── AI Result Local Cache ────────────────────────────────────────────────────
// Persists parsed AI responses across page navigations and app reloads.
// Each key stores the parsed typed object, not raw text.

import type { ParsedDailyBrief, ParsedPatternResponse, ParsedSleepResponse } from './AIService';

const KEYS = {
  dailyBrief: 'ai_daily_brief',
  patterns: 'ai_patterns',
  sleep: 'ai_sleep',
} as const;

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — stale data is better than no data

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CachedEntry<T> = JSON.parse(raw);
    // Even if stale, return it — caller decides whether to refetch
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CachedEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

function isStale(key: string, maxAgeMs: number = MAX_AGE_MS): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const entry: CachedEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp > maxAgeMs;
  } catch {
    return true;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const aiCache = {
  // Daily Brief
  getDailyBrief: (): ParsedDailyBrief | null => readCache<ParsedDailyBrief>(KEYS.dailyBrief),
  setDailyBrief: (data: ParsedDailyBrief): void => writeCache(KEYS.dailyBrief, data),
  isDailyBriefStale: (): boolean => isStale(KEYS.dailyBrief),

  // Patterns
  getPatterns: (): ParsedPatternResponse | null => readCache<ParsedPatternResponse>(KEYS.patterns),
  setPatterns: (data: ParsedPatternResponse): void => writeCache(KEYS.patterns, data),
  isPatternsStale: (): boolean => isStale(KEYS.patterns),

  // Sleep
  getSleep: (): ParsedSleepResponse | null => readCache<ParsedSleepResponse>(KEYS.sleep),
  setSleep: (data: ParsedSleepResponse): void => writeCache(KEYS.sleep, data),
  isSleepStale: (): boolean => isStale(KEYS.sleep),

  // Per-section clear (for regeneration)
  clearDailyBrief: (): void => localStorage.removeItem(KEYS.dailyBrief),
  clearPatterns: (): void => localStorage.removeItem(KEYS.patterns),
  clearSleep: (): void => localStorage.removeItem(KEYS.sleep),
};
```

### IPC Handler Changes — `src/main.ts`

**Modify `generateDailyBriefAndCache` (line 9304)** — return parsed JSON:

```typescript
async function generateDailyBriefAndCache(_event, key, apiKey): Promise<any> {
  // ... existing data-gathering code unchanged ...
  const result = await AIService.generateDailyBrief(apiKey, { totalHours, topApps, ... });
  // result.content is now ParsedDailyBrief, not a string
  const content = { ...result.content, type: 'daily', modelUsed: briefModel };
  // INSERT OR REPLACE INTO ai_briefs (type, date, content, ...)
  // content JSON now includes signal, observation, suggestion, trend, metrics
  return { success: true, content, cached: false };
}
```

**Modify `analyze-patterns` handler (line 9559)** — return parsed object:

```typescript
ipcMain.handle('analyze-patterns', async (_event) => {
  // ... existing data-gathering code unchanged ...
  const result = await AIService.analyzePatterns(apiKey, { dailySummary }, model);
  // result.content is now ParsedPatternResponse
  return { success: true, content: result.content };
});
```

**Modify `analyze-sleep` handler (line 9599)** — return parsed object:

```typescript
ipcMain.handle('analyze-sleep', async (_event) => {
  // ... existing data-gathering code unchanged ...
  const result = await AIService.analyzeSleep(apiKey, { sleepSummary, productivitySummary }, model);
  // result.content is now ParsedSleepResponse
  return { success: true, content: result.content };
});
```

---

## 4. AiPage Layout

### Grid Structure

Replace the existing `<div className="space-y-8">` with this responsive grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Row 1: Daily Brief — full width on lg+, full width on md, full width on sm */}
  <div className="md:col-span-2 lg:col-span-3">
    <BriefCard
      content={briefContent}
      loading={briefLoading}
      error={briefError}
      onRegenerate={handleRegenerateBrief}
      onDismiss={() => setBriefCollapsed(true)}
      collapsed={briefCollapsed}
      onToggle={() => setBriefCollapsed(prev => !prev)}
    />
  </div>

  {/* Row 2: Patterns + Sleep — side by side on lg/md, stacked on sm */}
  <div className="md:col-span-1">
    <PatternCard
      content={patternContent}
      loading={patternLoading}
      error={patternError}
      onRegenerate={handleRegeneratePatterns}
    />
  </div>
  <div className="md:col-span-1">
    <SleepCard
      content={sleepContent}
      loading={sleepLoading}
      error={sleepError}
      onRegenerate={handleRegenerateSleep}
    />
  </div>

  {/* Row 3: Weekly Review — full width on lg, full width on md, full width on sm */}
  <div className="md:col-span-2 lg:col-span-2">
    <WeeklyReviewCard
      content={weeklyContent}
      loading={weeklyLoading}
      error={weeklyError}
      onRegenerate={handleRegenerateWeekly}
      dismissed={weeklyDismissed}
      onRestore={() => setWeeklyDismissed(false)}
    />
  </div>

  {/* Row 3 cont: Research Digest — 1 col on lg, full width on md */}
  <div className="md:col-span-2 lg:col-span-1">
    <TopicDigestCard
      topics={digestTopics}
      loading={digestLoading}
      error={digestError}
      onRegenerate={handleRegenerateDigest}
    />
  </div>

  {/* Row 4: Chat — 2 cols on lg, full width on md/sm */}
  <div className="md:col-span-2 lg:col-span-2">
    {/* Chat section — existing chat JSX moved here */}
  </div>

  {/* Row 4 cont: Anomaly Alerts — 1 col on lg, full width on md/sm */}
  <div className="md:col-span-2 lg:col-span-1">
    {/* Anomaly section — existing anomaly JSX moved here */}
  </div>
</div>
```

### Section Numbering Map

| # | Section | Grid Placement | lg cols | md cols | sm cols |
|---|---------|---------------|---------|---------|---------|
| 1 | Daily Brief | Row 1 | 3/3 | 2/2 | 1/1 |
| 2 | Pattern Analysis | Row 2, left | 1/3 | 1/2 | 1/1 |
| 3 | Sleep Optimizer | Row 2, right | 1/3 | 1/2 | 1/1 |
| 4 | Weekly Review | Row 3, left | 2/3 | 2/2 | 1/1 |
| 5 | Research Digest | Row 3, right | 1/3 | 2/2 | 1/1 |
| 6 | Data Chat | Row 4, left | 2/3 | 2/2 | 1/1 |
| 7 | Anomaly Alerts | Row 4, right | 1/3 | 2/2 | 1/1 |

### Visual Layout (lg breakpoint)

```
┌─────────────────────────────────────────────────────────┐
│  1. Daily Brief (gradient top bar)            full width │
│     signal badge │ observation │ suggestion │ metrics    │
└─────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌──────────────────────────┐
│  2. Pattern Analysis     │ │  3. Sleep Optimizer      │
│  (emerald accent)        │ │  (indigo accent)         │
│  score bar               │ │  score bar               │
│  assessment              │ │  correlation line        │
│  pattern items list      │ │  optimal bedtime         │
│  ┌─ pattern 1 ────────┐  │ │  suggestion grid (2-col) │
│  │ badge │ impact │ ▸ │  │ │  ┌──────┐ ┌──────┐      │
│  └────────────────────┘  │ │  │ icon │ │ icon │      │
│  ┌─ pattern 2 ────────┐  │ │  │title │ │title │      │
│  │ badge │ impact │ ▸ │  │ │  │detail│ │detail│      │
│  └────────────────────┘  │ │  └──────┘ └──────┘      │
└──────────────────────────┘ └──────────────────────────┘
┌───────────────────────────────────┐ ┌──────────────────┐
│  4. Weekly Review (gradient bar)  │ │  5. Research     │
│  wentWell │ watchFor │ suggestion │ │  Digest (cyan)   │
│  (green)  │ (amber)  │ (purple)   │ │  accordion list  │
└───────────────────────────────────┘ └──────────────────┘
┌───────────────────────────────────┐ ┌──────────────────┐
│  6. Data Chat (amber accent)      │ │  7. Anomaly      │
│  messages + input                 │ │  Alerts (red)    │
│                                   │ │  severity list   │
└───────────────────────────────────┘ └──────────────────┘
```

---

## 5. Sub-Component Specs

### PatternCard

File: `src/components/PatternCard.tsx`

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Minus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingState } from './LoadingState';
import type { ParsedPatternResponse } from '../services/AIService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PatternCardProps {
  content: ParsedPatternResponse | null;
  loading: boolean;
  error?: string;
  onRegenerate: () => void;
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-emerald-400' :
    score >= 40 ? 'bg-amber-400' :
    'bg-red-400';
  const textColor =
    score >= 70 ? 'text-emerald-400' :
    score >= 40 ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className={`text-2xl font-bold tabular-nums ${textColor}`}>
        {score}
      </span>
      <div className="flex-1 h-2 rounded-full bg-zinc-800">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="text-xs text-zinc-600">/100</span>
    </div>
  );
}

// ─── Impact Badge ─────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: 'positive' | 'neutral' | 'negative' }) {
  const config = {
    positive: { icon: ThumbsUp, bg: 'bg-emerald-400/15', text: 'text-emerald-400', label: 'Positive' },
    neutral:  { icon: Minus,    bg: 'bg-zinc-400/15',    text: 'text-zinc-400',    label: 'Neutral' },
    negative: { icon: ThumbsDown, bg: 'bg-red-400/15',  text: 'text-red-400',     label: 'Negative' },
  } as const;

  const c = config[impact];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// ─── Pattern Item ─────────────────────────────────────────────────────────────

function PatternItem({ pattern }: {
  pattern: ParsedPatternResponse['patterns'][0];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800/60 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 text-xs font-medium truncate">
            {pattern.name}
          </span>
          <ImpactBadge impact={pattern.impact} />
        </div>
        {pattern.frequency && (
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">
            {pattern.frequency}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
        {pattern.description}
      </p>
      {pattern.recommendation && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center gap-1 text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors duration-150"
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChevronDown className="w-3 h-3" />
            </motion.div>
            Recommendation
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-xs text-zinc-500 mt-1.5 pl-4 border-l border-emerald-400/30 overflow-hidden"
              >
                {pattern.recommendation}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PatternCard({ content, loading, error, onRegenerate }: PatternCardProps) {
  return (
    <GlassCard accent accentColor="#10b981" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Pattern Analysis</h3>
        </div>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading && !content && <LoadingState variant="skeleton" rows={4} />}

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {content && (
        <div className="flex flex-col gap-4">
          <ScoreBar score={content.score} />
          {content.assessment && (
            <p className="text-sm text-zinc-400 leading-relaxed">{content.assessment}</p>
          )}
          <div className="flex flex-col gap-2">
            {content.patterns.map((p, i) => (
              <PatternItem key={i} pattern={p} />
            ))}
          </div>
        </div>
      )}

      {!loading && !content && !error && (
        <div className="flex flex-col items-center gap-2 py-6 text-zinc-600">
          <Sparkles className="w-6 h-6" />
          <p className="text-xs">Run analysis to discover your patterns</p>
        </div>
      )}
    </GlassCard>
  );
}
```

### SleepCard

File: `src/components/SleepCard.tsx`

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  AlarmClock,
  Clock,
  Coffee,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Zap,
  Brain,
  Heart,
  Bed,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingState } from './LoadingState';
import type { ParsedSleepResponse } from '../services/AIService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SleepCardProps {
  content: ParsedSleepResponse | null;
  loading: boolean;
  error?: string;
  onRegenerate: () => void;
}

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  moon, clock: Clock, 'alarm-clock': AlarmClock, coffee: Coffee,
  sun: Sun, zap: Zap, brain: Brain, heart: Heart, bed: Bed,
};

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase().trim();
  const Icon = ICON_MAP[lower] || Moon;
  return <Icon className={className} />;
}

// ─── Score Bar (shared pattern, same as PatternCard) ─────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-indigo-400' :
    score >= 40 ? 'bg-amber-400' :
    'bg-red-400';
  const textColor =
    score >= 70 ? 'text-indigo-400' :
    score >= 40 ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className={`text-2xl font-bold tabular-nums ${textColor}`}>
        {score}
      </span>
      <div className="flex-1 h-2 rounded-full bg-zinc-800">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="text-xs text-zinc-600">/100</span>
    </div>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({ suggestion }: {
  suggestion: ParsedSleepResponse['suggestions'][0];
}) {
  return (
    <div className="border border-zinc-800/60 rounded-lg p-3 flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-400/10 flex items-center justify-center">
        <DynamicIcon name={suggestion.icon} className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{suggestion.title}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{suggestion.detail}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SleepCard({ content, loading, error, onRegenerate }: SleepCardProps) {
  return (
    <GlassCard accent accentColor="#818cf8" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Sleep Optimizer</h3>
        </div>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading && !content && <LoadingState variant="skeleton" rows={4} />}

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {content && (
        <div className="flex flex-col gap-4">
          <ScoreBar score={content.score} />

          {/* Correlation */}
          {content.correlation && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              {content.correlation}
            </p>
          )}

          {/* Optimal Bedtime */}
          {content.optimalBedtime && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-400/8 border border-indigo-400/20">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-zinc-500">Optimal bedtime</span>
              <span className="text-sm font-semibold text-indigo-300 ml-auto tabular-nums">
                {content.optimalBedtime}
              </span>
            </div>
          )}

          {/* Insomnia */}
          {content.insomnia && (
            <p className="text-xs text-zinc-500 leading-relaxed">
              {content.insomnia}
            </p>
          )}

          {/* Suggestions grid */}
          {content.suggestions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {content.suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !content && !error && (
        <div className="flex flex-col items-center gap-2 py-6 text-zinc-600">
          <Sparkles className="w-6 h-6" />
          <p className="text-xs">Log sleep data to get optimization insights</p>
        </div>
      )}
    </GlassCard>
  );
}
```

### Updated BriefCard

File: `src/components/AiBriefCard.tsx` — complete rewrite

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Minus,
  RefreshCw,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingState } from './LoadingState';
import type { ParsedDailyBrief } from '../services/AIService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiBriefCardProps {
  content: ParsedDailyBrief | null;
  loading: boolean;
  error?: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Trend Badge ──────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: ParsedDailyBrief['trend'] }) {
  const config = {
    improving: { icon: TrendingUp,   bg: 'bg-emerald-400/15', text: 'text-emerald-400', label: 'Improving' },
    stable:    { icon: Minus,        bg: 'bg-zinc-400/15',    text: 'text-zinc-400',    label: 'Stable' },
    declining: { icon: TrendingDown, bg: 'bg-red-400/15',     text: 'text-red-400',     label: 'Declining' },
  } as const;

  const c = config[trend];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </span>
  );
}

// ─── Metric Trend Indicator ───────────────────────────────────────────────────

function MetricTrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <ArrowUp className="w-3 h-3 text-emerald-400" />;
  if (trend === 'down') return <ArrowDown className="w-3 h-3 text-red-400" />;
  return <ArrowRight className="w-3 h-3 text-zinc-600" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiBriefCard({
  content,
  loading,
  error,
  onRegenerate,
  onDismiss,
  collapsed,
  onToggle,
}: AiBriefCardProps) {
  return (
    <GlassCard className="flex flex-col overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 -mt-5 -mx-5 mb-4" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity duration-150"
        >
          <Sun className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Daily Brief</h3>
          {content && !collapsed && (
            <TrendBadge trend={content.trend} />
          )}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsed: show just signal */}
      {collapsed && content && (
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium">
            {content.signal}
          </span>
          <span className="text-xs text-zinc-600 truncate">{content.observation}</span>
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && (
        <div className="flex flex-col gap-4 mt-1">
          {loading && !content && <LoadingState variant="skeleton" rows={3} />}

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {content && (
            <>
              {/* Signal badge */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-cyan-500/15 text-zinc-200 text-sm font-semibold border border-purple-500/20">
                  {content.signal}
                </span>
              </div>

              {/* Observation */}
              {content.observation && (
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {content.observation}
                </p>
              )}

              {/* Suggestion */}
              {content.suggestion && (
                <p className="text-sm text-zinc-500 leading-relaxed border-l-2 border-purple-500/30 pl-3">
                  {content.suggestion}
                </p>
              )}

              {/* Metrics row */}
              {content.metrics.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {content.metrics.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-800/60"
                    >
                      <MetricTrendIcon trend={m.trend} />
                      <span className="text-xs text-zinc-500">{m.key}</span>
                      <span className="text-xs font-medium text-zinc-200 tabular-nums">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !content && !error && (
            <div className="flex flex-col items-center gap-2 py-6 text-zinc-600">
              <Sparkles className="w-6 h-6" />
              <p className="text-xs">Generate your daily briefing</p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
```

---

## 6. TypeScript Changes

### `src/App.tsx` — Window interface additions (around line 249)

Add the three missing method type declarations to the `deskflowAPI` interface inside the `Window` interface:

```typescript
// Find the existing interface block that declares deskflowAPI methods.
// Add these three entries alongside the existing getAiBrief, regenerateAiBrief, etc.

interface Window {
  deskflowAPI?: {
    // ... existing methods ...

    // ─── AI Analysis (typed) ──────────────────────────────────────────────
    analyzePatterns(): Promise<{
      success: boolean;
      content: import('./services/AIService').ParsedPatternResponse;
      error?: string;
    }>;

    analyzeSleep(): Promise<{
      success: boolean;
      content: import('./services/AIService').ParsedSleepResponse;
      error?: string;
    }>;

    dataChatQuery(params: {
      query: string;
      history: Array<{ role: string; content: string }>;
    }): Promise<{
      success: boolean;
      content: string;
      error?: string;
    }>;

    // ... existing methods ...
  };
}
```

If `import()` type syntax is not desired within the interface (some Vite setups), use inline types instead:

```typescript
analyzePatterns(): Promise<{
  success: boolean;
  content: {
    score: number;
    assessment: string;
    patterns: Array<{
      name: string;
      description: string;
      impact: 'positive' | 'neutral' | 'negative';
      frequency: string;
      recommendation?: string;
    }>;
  };
  error?: string;
}>;

analyzeSleep(): Promise<{
  success: boolean;
  content: {
    score: number;
    correlation: string;
    optimalBedtime?: string;
    insomnia: string;
    suggestions: Array<{
      icon: string;
      title: string;
      detail: string;
    }>;
  };
  error?: string;
}>;
```

### `src/services/AIService.ts` — Export types

Ensure the three parsed response types are exported (they already are from section 2, but verify):

```typescript
export interface ParsedDailyBrief { /* ... */ }
export interface ParsedPatternResponse { /* ... */ }
export interface ParsedSleepResponse { /* ... */ }
export function parseDailyBrief(raw: string): ParsedDailyBrief;
export function parsePatternResponse(raw: string): ParsedPatternResponse;
export function parseSleepResponse(raw: string): ParsedSleepResponse;
```

---

## 7. Integration

### AiPage.tsx — Full Rewrite

This section shows the complete wiring: state changes, effect for cache-first loading, background fetch, independent regeneration, and the new grid layout.

#### New State Variables

Replace the existing `briefContent`, `patternContent`, `sleepContent` state declarations:

```typescript
// ─── State ────────────────────────────────────────────────────────────────────

import { aiCache } from '../services/AiCache';
import type { ParsedDailyBrief, ParsedPatternResponse, ParsedSleepResponse } from '../services/AIService';

// Daily Brief — now stores parsed object, not raw string
const [briefContent, setBriefContent] = useState<ParsedDailyBrief | null>(
  () => aiCache.getDailyBrief()
);
const [briefLoading, setBriefLoading] = useState(false);
const [briefError, setBriefError] = useState<string | undefined>();
const [briefCollapsed, setBriefCollapsed] = useState(false);

// Pattern Analysis — parsed object
const [patternContent, setPatternContent] = useState<ParsedPatternResponse | null>(
  () => aiCache.getPatterns()
);
const [patternLoading, setPatternLoading] = useState(false);
const [patternError, setPatternError] = useState<string | undefined>();

// Sleep Optimizer — parsed object
const [sleepContent, setSleepContent] = useState<ParsedSleepResponse | null>(
  () => aiCache.getSleep()
);
const [sleepLoading, setSleepLoading] = useState(false);
const [sleepError, setSleepError] = useState<string | undefined>();

// Weekly, Digest, Chat, Anomalies — unchanged
const [weeklyContent, setWeeklyContent] = useState<any>(null);
const [weeklyLoading, setWeeklyLoading] = useState(false);
const [weeklyError, setWeeklyError] = useState<string | undefined>();
const [weeklyDismissed, setWeeklyDismissed] = useState(false);

const [digestTopics, setDigestTopics] = useState<any[]>([]);
const [digestLoading, setDigestLoading] = useState(false);
const [digestError, setDigestError] = useState<string | undefined>();

const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
const [chatInput, setChatInput] = useState('');
const [chatLoading, setChatLoading] = useState(false);
const chatEndRef = useRef<HTMLDivElement>(null);

const [anomalies, setAnomalies] = useState<Array<{ severity: string; detail: string }>>([]);
const [anomaliesLoading, setAnomaliesLoading] = useState(false);
```

#### Fetch Functions

Replace the existing fetch logic for patterns and sleep:

```typescript
// ─── Fetch: Daily Brief ───────────────────────────────────────────────────────

const fetchDailyBrief = useCallback(async (forceRefresh = false) => {
  // If we have cached data and it's not stale, skip unless forced
  if (!forceRefresh && briefContent && !aiCache.isDailyBriefStale()) return;

  setBriefLoading(true);
  setBriefError(undefined);
  try {
    const result = await window.deskflowAPI?.getAiBrief?.({ type: 'daily' });
    if (result?.success && result.content) {
      // The IPC now returns ParsedDailyBrief from the updated handler
      const brief = result.content as ParsedDailyBrief;
      // If the IPC still returns { summary: string } for backward compat,
      // parse it here:
      const parsed = brief.signal !== undefined
        ? brief
        : parseDailyBrief((brief as any).summary || JSON.stringify(brief));
      setBriefContent(parsed);
      aiCache.setDailyBrief(parsed);
    } else {
      setBriefError(result?.error || 'Failed to generate brief');
    }
  } catch (e: any) {
    setBriefError(e.message || 'Unknown error');
  } finally {
    setBriefLoading(false);
  }
}, [briefContent]);

// ─── Fetch: Pattern Analysis ──────────────────────────────────────────────────

const fetchPatterns = useCallback(async (forceRefresh = false) => {
  if (!forceRefresh && patternContent && !aiCache.isPatternsStale()) return;

  setPatternLoading(true);
  setPatternError(undefined);
  try {
    const result = await window.deskflowAPI?.analyzePatterns?.();
    if (result?.success && result.content) {
      const parsed = result.content as ParsedPatternResponse;
      // Handle backward compat: if content is still a string
      const data = typeof parsed === 'string'
        ? parsePatternResponse(parsed)
        : (parsed.score !== undefined ? parsed : parsePatternResponse(JSON.stringify(parsed)));
      setPatternContent(data);
      aiCache.setPatterns(data);
    } else {
      setPatternError(result?.error || 'Failed to analyze patterns');
    }
  } catch (e: any) {
    setPatternError(e.message || 'Unknown error');
  } finally {
    setPatternLoading(false);
  }
}, [patternContent]);

// ─── Fetch: Sleep Analysis ────────────────────────────────────────────────────

const fetchSleep = useCallback(async (forceRefresh = false) => {
  if (!forceRefresh && sleepContent && !aiCache.isSleepStale()) return;

  setSleepLoading(true);
  setSleepError(undefined);
  try {
    const result = await window.deskflowAPI?.analyzeSleep?.();
    if (result?.success && result.content) {
      const parsed = result.content as ParsedSleepResponse;
      const data = typeof parsed === 'string'
        ? parseSleepResponse(parsed)
        : (parsed.score !== undefined ? parsed : parseSleepResponse(JSON.stringify(parsed)));
      setSleepContent(data);
      aiCache.setSleep(data);
    } else {
      setSleepError(result?.error || 'Failed to analyze sleep');
    }
  } catch (e: any) {
    setSleepError(e.message || 'Unknown error');
  } finally {
    setSleepLoading(false);
  }
}, [sleepContent]);
```

#### Independent Regeneration Handlers

```typescript
// ─── Regenerate Handlers ──────────────────────────────────────────────────────

const handleRegenerateBrief = useCallback(() => {
  aiCache.clearDailyBrief();
  setBriefContent(null);
  fetchDailyBrief(true);
}, [fetchDailyBrief]);

const handleRegeneratePatterns = useCallback(() => {
  aiCache.clearPatterns();
  setPatternContent(null);
  fetchPatterns(true);
}, [fetchPatterns]);

const handleRegenerateSleep = useCallback(() => {
  aiCache.clearSleep();
  setSleepContent(null);
  fetchSleep(true);
}, [fetchSleep]);

const handleRegenerateWeekly = useCallback(() => {
  setWeeklyContent(null);
  setWeeklyLoading(true);
  window.deskflowAPI?.regenerateAiBrief?.({ type: 'weekly' })
    .then(result => {
      if (result?.success) setWeeklyContent(result.content);
      else setWeeklyError(result?.error || 'Failed');
    })
    .catch(e => setWeeklyError(e.message))
    .finally(() => setWeeklyLoading(false));
}, []);

const handleRegenerateDigest = useCallback(() => {
  setDigestTopics([]);
  setDigestLoading(true);
  window.deskflowAPI?.getTopicDigest?.()
    .then(result => {
      if (result?.success) setDigestTopics(result.topics || []);
      else setDigestError(result?.error || 'Failed');
    })
    .catch(e => setDigestError(e.message))
    .finally(() => setDigestLoading(false));
}, []);
```

#### Mount Effect — Cache-First, Then Background Fetch

```typescript
// ─── Mount: Load from cache instantly, then fetch fresh in background ─────────

useEffect(() => {
  // Cache is already loaded via useState initializers above.
  // Now fetch fresh data in the background (always, even if cache exists,
  // to update stale data). The loading state is only set if there's NO cache.
  const hasBriefCache = !!aiCache.getDailyBrief();
  const hasPatternCache = !!aiCache.getPatterns();
  const hasSleepCache = !!aiCache.isSleepStale();

  // Only show loading skeleton if no cached data
  if (!hasBriefCache) setBriefLoading(true);
  if (!hasPatternCache) setPatternLoading(true);
  if (!aiCache.getSleep()) setSleepLoading(true);

  // Fire all fetches concurrently
  fetchDailyBrief();
  fetchPatterns();
  fetchSleep();

  // Anomalies are transient — always refetch
  setAnomaliesLoading(true);
  window.deskflowAPI?.checkAnomalies?.()
    .then(result => {
      if (result?.success) setAnomalies(result.anomalies || []);
    })
    .catch(() => {})
    .finally(() => setAnomaliesLoading(false));

  // Weekly + Digest — existing logic
  setWeeklyLoading(true);
  setDigestLoading(true);
  Promise.all([
    window.deskflowAPI?.getAiBrief?.({ type: 'weekly' }),
    window.deskflowAPI?.getTopicDigest?.(),
  ]).then(([weeklyResult, digestResult]) => {
    if (weeklyResult?.success) setWeeklyContent(weeklyResult.content);
    if (digestResult?.success) setDigestTopics(digestResult.topics || []);
  }).catch(() => {}).finally(() => {
    setWeeklyLoading(false);
    setDigestLoading(false);
  });
}, []); // Run once on mount
```

#### Render — Complete JSX

```tsx
return (
  <div className="p-6 max-w-7xl mx-auto">
    {/* Page title */}
    <div className="mb-6">
      <h1 className="text-xl font-bold text-zinc-100">AI Hub</h1>
      <p className="text-sm text-zinc-500 mt-1">Insights, patterns, and analysis from your data</p>
    </div>

    {/* Grid layout */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

      {/* ─── 1. Daily Brief (full width) ─────────────────────────────── */}
      <div className="md:col-span-2 lg:col-span-3">
        <AiBriefCard
          content={briefContent}
          loading={briefLoading}
          error={briefError}
          onRegenerate={handleRegenerateBrief}
          onDismiss={() => setBriefCollapsed(true)}
          collapsed={briefCollapsed}
          onToggle={() => setBriefCollapsed(prev => !prev)}
        />
      </div>

      {/* ─── 2. Pattern Analysis ─────────────────────────────────────── */}
      <div className="md:col-span-1">
        <PatternCard
          content={patternContent}
          loading={patternLoading}
          error={patternError}
          onRegenerate={handleRegeneratePatterns}
        />
      </div>

      {/* ─── 3. Sleep Optimizer ──────────────────────────────────────── */}
      <div className="md:col-span-1">
        <SleepCard
          content={sleepContent}
          loading={sleepLoading}
          error={sleepError}
          onRegenerate={handleRegenerateSleep}
        />
      </div>

      {/* ─── 4. Weekly Review ────────────────────────────────────────── */}
      {!weeklyDismissed && (
        <div className="md:col-span-2 lg:col-span-2">
          <WeeklyReviewCard
            content={weeklyContent}
            loading={weeklyLoading}
            error={weeklyError}
            onRegenerate={handleRegenerateWeekly}
            dismissed={weeklyDismissed}
            onRestore={() => setWeeklyDismissed(false)}
          />
        </div>
      )}

      {/* ─── 5. Research Digest ──────────────────────────────────────── */}
      <div className={weeklyDismissed ? 'md:col-span-2 lg:col-span-3' : 'md:col-span-2 lg:col-span-1'}>
        <TopicDigestCard
          topics={digestTopics}
          loading={digestLoading}
          error={digestError}
          onRegenerate={handleRegenerateDigest}
        />
      </div>

      {/* ─── 6. Data Chat ────────────────────────────────────────────── */}
      <div className="md:col-span-2 lg:col-span-2">
        <GlassCard accent accentColor="#f59e0b" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Data Chat</h3>
          </div>

          {/* Messages */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {chatMessages.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">Ask questions about your data</p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                <span className="text-xs text-zinc-600 font-medium mr-1.5">
                  {msg.role === 'user' ? 'You' : 'AI'}
                </span>
                {msg.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!chatInput.trim() || chatLoading) return;
              const query = chatInput.trim();
              setChatInput('');
              setChatMessages(prev => [...prev, { role: 'user', content: query }]);
              setChatLoading(true);
              try {
                const result = await window.deskflowAPI?.dataChatQuery?.({
                  query,
                  history: chatMessages,
                });
                if (result?.success) {
                  setChatMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
                }
              } catch { /* ignore */ }
              finally { setChatLoading(false); }
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex gap-2"
          >
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about your data..."
              className="flex-1 bg-zinc-800/60 border border-zinc-800/60 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-400/40 transition-colors duration-150"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-3 py-2 rounded-lg bg-amber-400/15 text-amber-400 text-xs font-medium hover:bg-amber-400/25 transition-colors duration-150 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </GlassCard>
      </div>

      {/* ─── 7. Anomaly Alerts ───────────────────────────────────────── */}
      <div className="md:col-span-2 lg:col-span-1">
        <GlassCard accent accentColor="#ef4444" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Anomaly Alerts</h3>
          </div>

          {anomaliesLoading && <LoadingState variant="skeleton" rows={2} />}

          {!anomaliesLoading && anomalies.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 text-zinc-600">
              <Shield className="w-5 h-5" />
              <p className="text-xs">No anomalies detected</p>
            </div>
          )}

          {!anomaliesLoading && anomalies.length > 0 && (
            <div className="space-y-2">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-400/8 border border-red-400/20">
                  <span className={`shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                    a.severity === 'high' ? 'bg-red-400' : a.severity === 'medium' ? 'bg-amber-400' : 'bg-zinc-500'
                  }`} />
                  <p className="text-xs text-zinc-400 leading-relaxed">{a.detail}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  </div>
);
```

#### New Imports for AiPage.tsx

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  MessageSquare,
  Shield,
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { AiBriefCard } from '../components/AiBriefCard';
import { PatternCard } from '../components/PatternCard';
import { SleepCard } from '../components/SleepCard';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';
import { TopicDigestCard } from '../components/TopicDigestCard';
import { LoadingState } from '../components/LoadingState';
import { aiCache } from '../services/AiCache';
import { parseDailyBrief, parsePatternResponse, parseSleepResponse } from '../services/AIService';
import type { ParsedDailyBrief, ParsedPatternResponse, ParsedSleepResponse } from '../services/AIService';
```

#### Remove These No-Longer-Needed Items from AiPage.tsx

1. **`ContentList` component** — deleted entirely. All structured rendering is now in `PatternCard`, `SleepCard`, `AiBriefCard`.
2. **`SectionHeader` component** — can be kept for Chat/Anomaly sections if desired, but header is now embedded in each card.
3. **`ActionButton` component** — replaced by inline regenerate buttons in each card.
4. **`EmptyState` component** — kept if other sections use it, otherwise inline in each card.
5. **`ErrorBlock` component** — replaced by inline error displays in each card.

### File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/services/AIService.ts` | Modify | Add 3 type interfaces, 3 prompt constants, 6 parser functions (`parseDailyBrief`, `parsePatternResponse`, `parseSleepResponse`, plus 3 fallback variants). Replace 3 method bodies (`generateDailyBrief`, `analyzePatterns`, `analyzeSleep`) to return parsed objects. |
| `src/services/AiCache.ts` | Create | New file — localStorage read/write/stale helpers for 3 data types. |
| `src/components/PatternCard.tsx` | Create | New file — `PatternCard` with `ScoreBar`, `ImpactBadge`, `PatternItem` (collapsible recommendation). |
| `src/components/SleepCard.tsx` | Create | New file — `SleepCard` with `ScoreBar`, `DynamicIcon`, `SuggestionCard`. |
| `src/components/AiBriefCard.tsx` | Rewrite | Replace raw-text rendering with structured `TrendBadge`, `MetricTrendIcon`, signal/observation/suggestion/metrics layout. Gradient top bar preserved. |
| `src/pages/AiPage.tsx` | Rewrite | State types changed to parsed objects (initialized from cache). Grid layout replaces `space-y-8`. Cache-first mount effect. Independent regeneration per section. Remove `ContentList`. |
| `src/main.ts` | Modify | 3 IPC handlers updated: `generateDailyBriefAndCache` returns parsed JSON, `analyze-patterns` returns `ParsedPatternResponse`, `analyze-sleep` returns `ParsedSleepResponse`. |
| `src/App.tsx` | Modify | Add `analyzePatterns`, `analyzeSleep`, `dataChatQuery` to Window interface type declarations. |
```