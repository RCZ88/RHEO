# RESULT — AiPage Redesign

## 1. Prompt Rewrites

### Daily Brief (`AIService.ts` line 167)

Replace `DAILY_BRIEF_PROMPT` with:

```typescript
const DAILY_BRIEF_PROMPT = `You are a sharp, honest productivity analyst. Output raw JSON only. No markdown. No code fences. No explanations. No text before or after. Start with { and end with }.

Required JSON schema:
{
  "signal": "2-3 word summary of the most notable signal",
  "observation": "One specific observation tied to a real app or category from the data. Name the app.",
  "suggestion": "One actionable suggestion — name a specific change, not generic advice",
  "trend": "improving" | "stable" | "declining",
  "metrics": [
    { "key": "metric name (e.g. 'Total Time')", "value": "metric value (e.g. '6.2h')", "trend": "up" | "down" | "flat" }
  ]
}

Example response:
{"signal":"Deep work streak","observation":"VS Code logged 5.2h yesterday — your highest coding block this week, with zero app switches between 2-4pm.","suggestion":"Protect that 2-4pm slot by muting notifications and closing Slack before you start.","trend":"improving","metrics":[{"key":"Total Time","value":"6.2h","trend":"up"},{"key":"Productivity","value":"83%","trend":"up"},{"key":"Distractions","value":"0.8h","trend":"down"}]}

Rules:
- Lead with the most notable signal (big win, sharp drop, unusual pattern)
- Every claim must trace to the data. Name real times and apps from the user's data.
- Use second person. Direct. No cheerleading. No filler.
- observation and suggestion under 70 words each
- signal must be 2-3 words
- metrics array: 2-4 metrics, each with a trend
- NEVER use markdown code fences or backticks. NEVER add trailing commas. NEVER use placeholder text like "..." or "insert text here".`
```

### Pattern Analysis (`AIService.ts` line 331)

Replace the inline systemPrompt in `analyzePatterns()` with:

```typescript
const PATTERN_ANALYSIS_SYSTEM = `You are a sharp productivity pattern analyst. You'll receive compressed daily summaries of the user's tracked time over the last 30 days.

Output raw JSON only. No markdown. No code fences. No explanations. No text before or after. Start with { and end with }.

Required JSON schema:
{
  "score": 0-100,
  "assessment": "1-sentence overall assessment of the user's pattern health",
  "patterns": [
    {
      "name": "Short pattern name (3-5 words)",
      "description": "1-2 sentence description citing specific data (app name, time, day)",
      "impact": "positive" | "neutral" | "negative",
      "frequency": "How often (e.g. 'Daily', '3x/week', 'Every Tuesday afternoon')",
      "recommendation": "Optional. One actionable suggestion. Omit if not applicable."
    }
  ]
}

Example response:
{"score":72,"assessment":"You have strong coding consistency but a recurring post-lunch social media loop is costing you 3.5h per week.","patterns":[{"name":"Tuesday Peak Focus","description":"Every Tuesday between 2-5pm you log your most productive coding block averaging 2.8h uninterrupted.","impact":"positive","frequency":"Weekly","recommendation":"Schedule your hardest coding tasks for Tuesday afternoons."},{"name":"Post-Lunch Distraction Loop","description":"After lunch (12:30-1:30pm) you open social media for '5 min' but stay 25-40min on 4 out of 5 weekdays.","impact":"negative","frequency":"4x/week","recommendation":"Set a 5-min timer when opening social media. When it rings, close the tab immediately."},{"name":"Sleep-Producivity Link","description":"Days following 7+ hours of sleep show 23% higher productive time vs days with under 6 hours.","impact":"positive","frequency":"Daily","recommendation":"Aim for 7h minimum sleep before days with important deadlines."}]}

Rules:
- Identify non-obvious patterns they would never spot manually
- Look for: time-of-day productivity clusters, recurring distraction loops, weekly rhythms, sleep-productivity correlation, transition blockers
- score 0-100: <40 needs intervention, 40-69 mixed, 70+ good
- 3-5 patterns in the array
- Every claim must trace to real data
- Under 60 words per description
- NEVER use markdown code fences or backticks. NEVER add trailing commas. NEVER use placeholder text.`
```

### Sleep Analysis (`AIService.ts` line 353)

Replace the inline systemPrompt in `analyzeSleep()` with:

```typescript
const SLEEP_ANALYSIS_SYSTEM = `You are a sleep and energy optimization analyst. You'll receive sleep records and corresponding next-day productivity data.

Output raw JSON only. No markdown. No code fences. No explanations. No text before or after. Start with { and end with }.

Required JSON schema:
{
  "score": 0-100,
  "correlation": "1-sentence explaining how sleep affects the user's productivity",
  "optimalBedtime": "Optional. The ideal bedtime range (e.g. '10:30pm - 11:30pm')",
  "insomnia": "1-sentence describing any insomnia patterns or 'No insomnia patterns detected'",
  "suggestions": [
    {
      "icon": "moon" | "sun" | "clock" | "brain" | "activity",
      "title": "Short suggestion title (2-4 words)",
      "detail": "1-2 sentence actionable recommendation with data"
    }
  ]
}

Example response:
{"score":78,"correlation":"Days following 7-8h of sleep average 34% more productive time than days with under 6h.","optimalBedtime":"10:30pm - 11:30pm","insomnia":"You have 3 instances of late-night activity (after 2am) followed by sub-5h sleep, suggesting occasional insomnia or late work sessions.","suggestions":[{"icon":"moon","title":"Target 7-8h Sleep","detail":"Your best productivity days follow 7-8h of sleep. You average 6.4h — closing this gap by 1h could gain 1.5h of productive time."},{"icon":"clock","title":"Consistent Bedtime","detail":"Your bedtime varies by 90min on weeknights. A consistent 11pm bedtime could improve your sleep quality and next-day focus."},{"icon":"sun","title":"Morning Light Exposure","detail":"On days you wake before 7am, your morning productivity is 28% higher. Try opening curtains within 10min of waking."}]}

Rules:
- Find correlations between sleep patterns and productive output
- Look for: optimal sleep duration range, bedtime timing impact, recovery patterns, weekend vs weekday debt
- Score 0-100: <40 needs intervention, 40-69 mixed, 70+ good
- 2-4 suggestions in the array
- Every claim must cite the data (hours, times, productivity %)
- NEVER use markdown code fences or backticks. NEVER add trailing commas. NEVER use placeholder text.`
```

---

## 2. Parsing Layer

Add to `src/services/AIService.ts` — exported interfaces and fallback parsers:

```typescript
// === Exported response types ===

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

// === Fallback parsers ===

function fallbackParseDailyBrief(raw: string): ParsedDailyBrief {
  const signal = raw.match(/signal[:\s]+(.+?)[.\n]/i)?.[1]?.trim() || 'Daily Brief';
  const observation = raw.match(/observation[:\s]+(.+?)[.\n]/i)?.[1]?.trim() || raw;
  const suggestion = raw.match(/suggestion[:\s]+(.+?)[.\n]/i)?.[1]?.trim() || '';
  const trendMatch = raw.match(/trend[:\s]+(improving|stable|declining)/i);
  const trend: 'improving' | 'stable' | 'declining' = trendMatch?.[1]?.toLowerCase() as any || 'stable';

  const metrics: ParsedDailyBrief['metrics'] = [];
  const metricRegex = /(?:^|\n)[-•*]\s*(.+?):\s*(.+?)(?:\s+\((up|down|flat)\))?/gi;
  let m;
  while ((m = metricRegex.exec(raw)) !== null) {
    metrics.push({ key: m[1].trim(), value: m[2].trim(), trend: (m[3]?.toLowerCase() as any) || 'flat' });
  }
  if (metrics.length === 0 && raw.length > 0) {
    metrics.push({ key: 'Status', value: trend === 'improving' ? 'Positive' : trend === 'declining' ? 'Needs attention' : 'Stable', trend });
  }

  return { signal, observation, suggestion, trend, metrics };
}

function fallbackParsePatternAnalysis(raw: string): ParsedPatternResponse {
  const scoreMatch = raw.match(/score[:\s]+(\d+)/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;

  const assessment = raw.match(/assessment[:\s]+(.+?)(?:\n|$)/i)?.[1]?.trim()
    || raw.split('\n')[0]?.replace(/^[-•*\d.]+/, '').trim()
    || 'Pattern analysis completed.';

  const patterns: ParsedPatternResponse['patterns'] = [];
  const bullets = raw.split('\n').filter(l => /^[-•*\d.]/.test(l.trim()));
  for (const line of bullets) {
    const clean = line.replace(/^[-•*\d.]+\s*/, '').trim();
    if (!clean) continue;
    const impact: 'positive' | 'neutral' | 'negative' =
      /\b(positive|good|great|beneficial|improve)\b/i.test(clean) ? 'positive' :
      /\b(negative|bad|harmful|distract|waste|concern)\b/i.test(clean) ? 'negative' : 'neutral';
    patterns.push({
      name: clean.split(/[.:]/)[0]?.trim()?.slice(0, 40) || 'Pattern',
      description: clean.slice(0, 120) || clean,
      impact,
      frequency: 'Varies',
      recommendation: clean.length > 120 ? clean.slice(120, 200) : undefined,
    });
  }

  if (patterns.length === 0) {
    patterns.push({ name: 'Analysis Result', description: raw.slice(0, 200), impact: 'neutral', frequency: 'Once' });
  }

  return { score, assessment, patterns };
}

function fallbackParseSleepAnalysis(raw: string): ParsedSleepResponse {
  const scoreMatch = raw.match(/score[:\s]+(\d+)/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;

  const correlation = raw.match(/correlation[:\s]+(.+?)(?:\n|$)/i)?.[1]?.trim()
    || raw.match(/sleep.*productivity/i) ? 'Sleep affects your next-day productivity.' : 'Analysis completed.';

  const optimalBedtime = raw.match(/bedtime[:\s]+(.+?)(?:\n|$)/i)?.[1]?.trim() || undefined;

  const insomnia = raw.match(/insomnia[:\s]+(.+?)(?:\n|$)/i)?.[1]?.trim()
    || 'No insomnia patterns detected.';

  const suggestions: ParsedSleepResponse['suggestions'] = [];
  const bullets = raw.split('\n').filter(l => /^[-•*\d.]/.test(l.trim()));
  for (const line of bullets) {
    const clean = line.replace(/^[-•*\d.]+\s*/, '').trim();
    if (!clean) continue;
    const icon =
      /moon|sleep|night/i.test(clean) ? 'moon' :
      /sun|morning|light/i.test(clean) ? 'sun' :
      /clock|time|bedtime/i.test(clean) ? 'clock' :
      /brain|focus|mental/i.test(clean) ? 'brain' : 'activity';
    suggestions.push({
      icon,
      title: clean.split(/[.:]/)[0]?.trim()?.slice(0, 30) || 'Suggestion',
      detail: clean.slice(0, 150) || clean,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({ icon: 'moon', title: 'Sleep Analysis', detail: raw.slice(0, 200) });
  }

  return { score, correlation, optimalBedtime, insomnia, suggestions };
}
```

### Updated AIService methods

Replace `analyzePatterns` return processing:

```typescript
static async analyzePatterns(apiKey: string, data: { dailySummary: string }, model?: string): Promise<{ content: ParsedPatternResponse | string; usage?: any }> {
    const result = await callOpenRouter({
      systemPrompt: PATTERN_ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: `Here are the last 30 days of activity data:\n\n${data.dailySummary}` }],
      model: model || 'google/gemini-2.0-flash-001',
      maxTokens: 500,
      temperature: 0.3,
      apiKey,
    });
    const raw = result.content.trim();
    let parsed: ParsedPatternResponse;
    try {
      parsed = parseAIJson<ParsedPatternResponse>(raw);
    } catch {
      parsed = fallbackParsePatternAnalysis(raw);
    }
    return { content: parsed, usage: result.usage };
  }
```

Replace `analyzeSleep` return processing:

```typescript
static async analyzeSleep(apiKey: string, data: { sleepSummary: string; productivitySummary: string }, model?: string): Promise<{ content: ParsedSleepResponse | string; usage?: any }> {
    const result = await callOpenRouter({
      systemPrompt: SLEEP_ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: `Sleep data (last 30 days):\n${data.sleepSummary}\n\nNext-day productivity:\n${data.productivitySummary}` }],
      model: model || 'google/gemini-2.0-flash-001',
      maxTokens: 400,
      temperature: 0.3,
      apiKey,
    });
    const raw = result.content.trim();
    let parsed: ParsedSleepResponse;
    try {
      parsed = parseAIJson<ParsedSleepResponse>(raw);
    } catch {
      parsed = fallbackParseSleepAnalysis(raw);
    }
    return { content: parsed, usage: result.usage };
  }
```

Replace `generateDailyBrief` return processing:

```typescript
static async generateDailyBrief(apiKey: string, data: DailyBriefInput, model?: string): Promise<{ content: ParsedDailyBrief | string; usage?: any }> {
    const userPrompt = `Yesterday's data:\n- Total tracked time: ${data.totalHours}h\n- Top apps: ${data.topApps}\n- Productive time: ${data.productivePct}% (${data.productiveHours}h)\n- Distracting time: ${data.distractingPct}%\n- Sleep last night: ${data.sleepHours || 'unknown'}h (avg: ${data.sleepAvg || 'unknown'}h)\n- 7-day trend: ${data.trendDescription}`;

    const result = await callOpenRouter({
      systemPrompt: DAILY_BRIEF_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      model: model || 'google/gemini-2.0-flash-001',
      maxTokens: 300,
      temperature: 0.5,
      apiKey,
    });
    const raw = result.content.trim();
    let parsed: ParsedDailyBrief;
    try {
      parsed = parseAIJson<ParsedDailyBrief>(raw);
    } catch {
      parsed = fallbackParseDailyBrief(raw);
    }
    return { content: parsed, usage: result.usage };
  }
```

---

## 3. Persistence Strategy

Add to `src/pages/AiPage.tsx`:

```typescript
// localStorage helpers
const STORAGE_KEYS = {
  patterns: 'ai_patterns',
  sleep: 'ai_sleep',
  dailyBrief: 'ai_daily_brief',
  weeklyReview: 'ai_weekly_review',
  digestTopics: 'ai_digest_topics',
} as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}
```

Update mount effect to load from localStorage first, then background refresh:

```typescript
useEffect(() => {
  // Load cached data immediately
  const cachedPatterns = loadJson<ParsedPatternResponse | null>(STORAGE_KEYS.patterns, null);
  const cachedSleep = loadJson<ParsedSleepResponse | null>(STORAGE_KEYS.sleep, null);
  const cachedBrief = loadJson<ParsedDailyBrief | null>(STORAGE_KEYS.dailyBrief, null);
  if (cachedPatterns) setParsedPatternContent(cachedPatterns);
  if (cachedSleep) setParsedSleepContent(cachedSleep);
  if (cachedBrief) setParsedBriefContent(cachedBrief);

  let cancelled = false;
  (async () => {
    // Daily Brief (background refresh)
    if (!cachedBrief) setBriefLoading(true);
    try {
      const result = await window.deskflowAPI.getAiBrief({ type: 'daily' });
      if (cancelled) return;
      if (result.success && result.content) {
        const brief = result.content.summary
          ? fallbackParseDailyBrief(result.content.summary)
          : (result.content as ParsedDailyBrief);
        if (typeof brief === 'object' && 'signal' in brief) {
          setParsedBriefContent(brief as ParsedDailyBrief);
          saveJson(STORAGE_KEYS.dailyBrief, brief);
        } else {
          setBriefContent(result.content);
        }
        setBriefError(null);
      } else if (!result.success) {
        setBriefError(result.error || 'Failed to generate brief');
      }
    } catch (err: any) { if (!cancelled) setBriefError(err.message); }
    finally { if (!cancelled) setBriefLoading(false); }

    // Weekly
    if (new Date().getDay() === 1) {
      setWeeklyLoading(true);
      try {
        const r = await window.deskflowAPI.getAiBrief({ type: 'weekly' });
        if (cancelled) return;
        if (r.success && r.content) { setWeeklyContent(r.content); setWeeklyError(null); }
      } catch (err: any) { if (!cancelled) setWeeklyError(err.message); }
      finally { if (!cancelled) setWeeklyLoading(false); }
    }

    // Anomalies (transient — no cache)
    setAnomaliesLoading(true);
    try {
      const r = await window.deskflowAPI.checkAnomalies();
      if (cancelled) return;
      if (r.success && r.anomalies?.length > 0) setAnomalies(r.anomalies);
    } catch {} finally { if (!cancelled) setAnomaliesLoading(false); }

    // Digest
    setDigestLoading(true); setDigestError(null);
    try {
      const r = await window.deskflowAPI.getTopicDigest();
      if (cancelled) return;
      if (r.success && r.topics?.length > 0) { setDigestTopics(r.topics); setDigestError(null); }
      else if (!r.success) { setDigestError(r.error || 'Failed to load digests'); }
    } catch (err: any) { if (!cancelled) setDigestError(err.message); }
    finally { if (!cancelled) setDigestLoading(false); }
  })();
  return () => { cancelled = true; };
}, []);
```

---

## 4. AiPage Layout

Replace the `space-y-8` wrapper with a responsive CSS grid:

```
Desktop (lg: 1024px+):      3 columns
Tablet (md: 768px+):        2 columns
Mobile (<768px):            1 column (stack)
```

```
┌──────────────────────────────────────────────────────────────┐
│  Header (full-width, not in grid)                            │
├──────────────────────────────────────────────────────────────┤
│  Anomaly Banner (full-width, not in grid, conditional)       │
├────────────────┬─────────────────┬───────────────────────────┤
│  [1] Daily     │  [4] Pattern     │ [5] Sleep               │
│      Brief     │      Analyst     │     Optimizer            │
│  spans cols    │  accent:emerald  │ accent:indigo            │
│  pink->purple  │                  │                          │
│  ->cyan grad   │                  │                          │
├────────────────┼─────────────────┼───────────────────────────┤
│  [2] Weekly    │  [6] Anomalies   │ [7] Chat                 │
│      Review    │  accent:red      │ accent:amber              │
│  green->amber  │                  │                          │
│  ->purple grad │                  │                          │
├────────────────┴─────────────────┴───────────────────────────┤
│  [3] Research Digest (full-width)                            │
│  accent:cyan                                                 │
└──────────────────────────────────────────────────────────────┘

Grid template:
  lg: grid-cols-3
  md: grid-cols-2
  sm: grid-cols-1

Daily Brief (section 1):      lg:col-span-3  md:col-span-2
Weekly Review (section 2):    lg:col-span-3  md:col-span-2 (if Monday)
Research Digest (section 3):  lg:col-span-3  md:col-span-2
Pattern Analyst (section 4):  lg:col-span-1  md:col-span-1
Sleep Optimizer (section 5):  lg:col-span-1  md:col-span-1
Anomalies (section 6):        lg:col-span-1  md:col-span-1
Chat (section 7):             lg:col-span-1  md:col-span-1 (spans below digest on md+)

Order in DOM: Brief → Weekly → Digest → Pattern → Sleep → Anomalies → Chat
```

Exact wrapper:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  {/* sections go here with col-span classes */}
</div>
```

---

## 5. Sub-Component Specs

### New: `src/components/PatternCard.tsx`

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ChevronDown, ThumbsUp, ThumbsDown, Minus, Lightbulb } from 'lucide-react';

interface PatternItem {
  name: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
  frequency: string;
  recommendation?: string;
}

interface ParsedPatternResponse {
  score: number;
  assessment: string;
  patterns: PatternItem[];
}

interface PatternCardProps {
  data: ParsedPatternResponse | null;
  loading: boolean;
  error?: string;
  onAnalyze: () => void;
  onRefresh?: () => void;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score < 40 ? 'bg-red-400' :
    score < 70 ? 'bg-amber-400' :
    'bg-emerald-400';
  const textColor =
    score < 40 ? 'text-red-400' :
    score < 70 ? 'text-amber-400' :
    'text-emerald-400';

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums ${textColor}`}>{score}/100</span>
    </div>
  );
}

const impactConfig = {
  positive: { icon: ThumbsUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  neutral: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20' },
  negative: { icon: ThumbsDown, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
};

function PatternRow({ pattern, index }: { pattern: PatternItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = impactConfig[pattern.impact];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-800/30 transition-colors duration-150"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
          <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-100">{pattern.name}</span>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
              {pattern.impact === 'positive' ? 'Positive' : pattern.impact === 'negative' ? 'Negative' : 'Neutral'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{pattern.description}</p>
          <span className="text-[10px] text-zinc-500 mt-1 inline-block">{pattern.frequency}</span>
        </div>
        {pattern.recommendation && (
          <ChevronDown className={`w-4 h-4 text-zinc-500 mt-1 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>
      <AnimatePresence>
        {expanded && pattern.recommendation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-300 leading-relaxed">{pattern.recommendation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PatternCard({ data, loading, error, onAnalyze, onRefresh }: PatternCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-400/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
            <div className="h-2 w-36 bg-zinc-800/60 rounded mt-1.5 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
        </div>
        <p className="text-xs text-zinc-500 text-center">Analyzing 30 days of activity data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60">
        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400" />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-400/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Activity Pattern Analyst</h3>
            <p className="text-[10px] text-zinc-500">Hidden patterns in your last 30 days</p>
          </div>
        </div>
        <button
          onClick={onRefresh || onAnalyze}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20 transition-colors duration-150"
        >
          <TrendingUp className="w-3 h-3" />
          {data ? 'Re-analyze' : 'Analyze Patterns'}
        </button>
      </div>

      {data ? (
        <div className="space-y-3">
          <ScoreBar score={data.score} />
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">{data.assessment}</p>
          <div className="space-y-2">
            {data.patterns.map((p, i) => (
              <PatternRow key={i} pattern={p} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <TrendingUp className="w-10 h-10 text-zinc-700 mb-4" />
          <p className="text-sm text-zinc-400 font-medium">Discover your productivity patterns</p>
          <p className="text-xs text-zinc-600 mt-2 max-w-md">Click "Analyze Patterns" to uncover hidden rhythms, distraction loops, and optimal work times.</p>
        </div>
      )}
    </div>
  );
}
```

### New: `src/components/SleepCard.tsx`

```typescript
import { motion } from 'framer-motion';
import { Moon, Clock, Sun, Brain, Activity } from 'lucide-react';

interface SleepSuggestion {
  icon: string;
  title: string;
  detail: string;
}

interface ParsedSleepResponse {
  score: number;
  correlation: string;
  optimalBedtime?: string;
  insomnia: string;
  suggestions: SleepSuggestion[];
}

interface SleepCardProps {
  data: ParsedSleepResponse | null;
  loading: boolean;
  error?: string;
  onAnalyze: () => void;
  onRefresh?: () => void;
}

const iconMap: Record<string, any> = { moon: Moon, sun: Sun, clock: Clock, brain: Brain, activity: Activity };

function ScoreBar({ score }: { score: number }) {
  const color =
    score < 40 ? 'bg-red-400' :
    score < 70 ? 'bg-amber-400' :
    'bg-indigo-400';
  const textColor =
    score < 40 ? 'text-red-400' :
    score < 70 ? 'text-amber-400' :
    'text-indigo-400';

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums ${textColor}`}>{score}/100</span>
    </div>
  );
}

export function SleepCard({ data, loading, error, onAnalyze, onRefresh }: SleepCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-400/15 flex items-center justify-center">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="h-3 w-28 bg-zinc-800 rounded animate-pulse" />
            <div className="h-2 w-40 bg-zinc-800/60 rounded mt-1.5 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
        </div>
        <p className="text-xs text-zinc-500 text-center">Correlating sleep and productivity data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60">
        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-400" />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-400/15 flex items-center justify-center">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sleep & Energy Optimizer</h3>
            <p className="text-[10px] text-zinc-500">How your sleep affects next-day productivity</p>
          </div>
        </div>
        <button
          onClick={onRefresh || onAnalyze}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-400/10 text-indigo-400 border border-indigo-400/30 hover:bg-indigo-400/20 transition-colors duration-150"
        >
          <Moon className="w-3 h-3" />
          {data ? 'Re-analyze' : 'Analyze Sleep'}
        </button>
      </div>

      {data ? (
        <div className="space-y-4">
          <ScoreBar score={data.score} />
          <p className="text-sm text-zinc-300 leading-relaxed">{data.correlation}</p>

          {data.optimalBedtime && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-400/5 border border-indigo-400/15">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-medium">Optimal Bedtime</span>
                <p className="text-sm text-zinc-200 font-medium">{data.optimalBedtime}</p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/40">
            <p className="text-xs text-zinc-400 leading-relaxed">{data.insomnia}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.suggestions.map((s, i) => {
              const Icon = iconMap[s.icon] || Activity;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-400/10 flex items-center justify-center mb-2">
                    <Icon className="w-3 h-3 text-indigo-400" />
                  </div>
                  <p className="text-xs font-medium text-zinc-200 mb-1">{s.title}</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{s.detail}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Moon className="w-10 h-10 text-zinc-700 mb-4" />
          <p className="text-sm text-zinc-400 font-medium">Optimize your sleep schedule</p>
          <p className="text-xs text-zinc-600 mt-2 max-w-md">Analyze how your sleep patterns affect next-day productivity.</p>
        </div>
      )}
    </div>
  );
}
```

### Updated: `src/components/AiBriefCard.tsx` (now `BriefCard.tsx`)

```typescript
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, X, ChevronDown, Sun, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LoadingState } from './LoadingState';

interface BriefMetric {
  key: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
}

interface ParsedDailyBrief {
  signal: string;
  observation: string;
  suggestion: string;
  trend: 'improving' | 'stable' | 'declining';
  metrics: BriefMetric[];
}

interface BriefCardProps {
  content: ParsedDailyBrief | { summary: string; type?: string; modelUsed?: string } | null;
  loading: boolean;
  error?: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const trendColors: Record<string, string> = {
  improving: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  stable: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  declining: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const trendArrows: Record<string, any> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const trendArrowColors: Record<string, string> = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  flat: 'text-zinc-500',
};

export function BriefCard({ content, loading, error, onRegenerate, onDismiss, collapsed, onToggle }: BriefCardProps) {
  const isParsed = content && 'signal' in content;

  if (collapsed) {
    return (
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onToggle}
        className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm cursor-pointer bg-pink-400/10 border-pink-400/30"
      >
        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
        <span className="text-xs text-pink-300 font-medium">View Brief</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard className="relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' }}
        />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-400/15 flex items-center justify-center">
              <Sun className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Brief</h3>
              <p className="text-[10px] text-zinc-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRegenerate}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors duration-150 disabled:opacity-40"
              title="Regenerate"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              title="Collapse"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="py-4">
            <LoadingState variant="spinner" />
            <p className="text-xs text-zinc-500 text-center mt-2">Generating your daily brief...</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20">
            <p className="text-xs text-red-400">{error}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Configure your API key in Settings to enable AI features.</p>
          </div>
        )}

        {content && !loading && (
          <div className="space-y-3">
            {'summary' in content ? (
              <>
                <p className="text-sm text-zinc-300 leading-relaxed">{content.summary}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="w-3 h-3 text-pink-400/60" />
                  <span className="text-[10px] text-zinc-600">Generated by {content.modelUsed || 'Unknown'}</span>
                </div>
              </>
            ) : isParsed ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${trendColors[(content as ParsedDailyBrief).trend]}`}>
                    {(content as ParsedDailyBrief).signal}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {(content as ParsedDailyBrief).trend}
                  </span>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed">{(content as ParsedDailyBrief).observation}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{(content as ParsedDailyBrief).suggestion}</p>

                {(content as ParsedDailyBrief).metrics.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(content as ParsedDailyBrief).metrics.map((m, i) => {
                      const ArrowIcon = trendArrows[m.trend];
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                          <ArrowIcon className={`w-3 h-3 ${trendArrowColors[m.trend]}`} />
                          <span className="text-xs text-zinc-400">{m.key}:</span>
                          <span className="text-xs font-medium text-zinc-200">{m.value}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="w-3 h-3 text-pink-400/60" />
                  <span className="text-[10px] text-zinc-600">Generated by {'modelUsed' in content ? content.modelUsed : 'AI'}</span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
```

---

## 6. TypeScript Changes

### In `src/App.tsx` — Window interface (around line 249)

Add these 3 new methods to the `deskflowAPI` object type, after `checkAnomalies`:

```
Current (line 253):
  checkAnomalies: () => Promise<{ success: boolean; anomalies?: any[]; error?: string }>;

Add after checkAnomalies:
  analyzePatterns: () => Promise<{ success: boolean; content: any; error?: string }>;
  analyzeSleep: () => Promise<{ success: boolean; content: any; error?: string }>;
  dataChatQuery: (params: { query: string; history: Array<{ role: string; content: string }> }) => Promise<{ success: boolean; content: string; error?: string }>;
```

Exact diff:

```diff
       checkAnomalies: () => Promise<{ success: boolean; anomalies?: any[]; error?: string }>;
+      analyzePatterns: () => Promise<{ success: boolean; content: any; error?: string }>;
+      analyzeSleep: () => Promise<{ success: boolean; content: any; error?: string }>;
+      dataChatQuery: (params: { query: string; history: Array<{ role: string; content: string }> }) => Promise<{ success: boolean; content: string; error?: string }>;
       saveAiConfig: (config: any) => Promise<{ success: boolean }>;
       getAiConfig: () => Promise<any>;
       getInterestTopics: () => Promise<string[]>;
```

---

## 7. Integration

### Final `src/pages/AiPage.tsx` — full wiring

Complete new file showing how all pieces connect:

```typescript
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, BarChart3, Newspaper, TrendingUp, Moon, MessageCircle,
  AlertTriangle, Sparkles, Send, RefreshCw, X, Loader2,
} from 'lucide-react';
import { BriefCard } from '../components/BriefCard';
import { PatternCard } from '../components/PatternCard';
import { SleepCard } from '../components/SleepCard';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';
import { TopicDigestCard } from '../components/TopicDigestCard';
import { GlassCard } from '../components/GlassCard';
import { LoadingState } from '../components/LoadingState';
import type { ParsedDailyBrief, ParsedPatternResponse, ParsedSleepResponse } from '../services/AIService';
import { fallbackParseDailyBrief, fallbackParsePatternAnalysis, fallbackParseSleepAnalysis } from '../services/AIService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'How much YouTube this week?',
  'What is my top app?',
  'Analyze sleep patterns',
];

const STORAGE_KEYS = {
  patterns: 'ai_patterns',
  sleep: 'ai_sleep',
  dailyBrief: 'ai_daily_brief',
} as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function SectionHeader({ icon: Icon, accent, title, description, action }: {
  icon: any; accent: string; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1F` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-lg text-sm bg-red-400/8 border border-red-400/20">
      <p className="text-red-400">{message}</p>
    </div>
  );
}

export function AiPage() {
  const [briefContent, setBriefContent] = useState<any>(null);
  const [parsedBriefContent, setParsedBriefContent] = useState<ParsedDailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefCollapsed, setBriefCollapsed] = useState(false);

  const [weeklyContent, setWeeklyContent] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [weeklyDismissed, setWeeklyDismissed] = useState(false);

  const [digestTopics, setDigestTopics] = useState<any[]>([]);
  const [digestLoading, setDigestLoading] = useState(true);
  const [digestError, setDigestError] = useState<string | null>(null);

  const [parsedPatternContent, setParsedPatternContent] = useState<ParsedPatternResponse | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  const [parsedSleepContent, setParsedSleepContent] = useState<ParsedSleepResponse | null>(null);
  const [sleepLoading, setSleepLoading] = useState(false);
  const [sleepError, setSleepError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! Ask me anything about your tracked activity.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  useEffect(() => {
    const cachedBrief = loadJson<ParsedDailyBrief | null>(STORAGE_KEYS.dailyBrief, null);
    const cachedPatterns = loadJson<ParsedPatternResponse | null>(STORAGE_KEYS.patterns, null);
    const cachedSleep = loadJson<ParsedSleepResponse | null>(STORAGE_KEYS.sleep, null);
    if (cachedBrief) setParsedBriefContent(cachedBrief);
    if (cachedPatterns) setParsedPatternContent(cachedPatterns);
    if (cachedSleep) setParsedSleepContent(cachedSleep);

    let cancelled = false;
    (async () => {
      if (!cachedBrief) setBriefLoading(true);
      try {
        const result = await window.deskflowAPI.getAiBrief({ type: 'daily' });
        if (cancelled) return;
        if (result.success && result.content) {
          if (typeof result.content === 'object' && 'signal' in result.content) {
            setParsedBriefContent(result.content as ParsedDailyBrief);
            saveJson(STORAGE_KEYS.dailyBrief, result.content);
          } else if (result.content.summary) {
            const parsed = fallbackParseDailyBrief(result.content.summary);
            setParsedBriefContent(parsed);
            saveJson(STORAGE_KEYS.dailyBrief, parsed);
          } else {
            setBriefContent(result.content);
          }
          setBriefError(null);
        } else if (!result.success) {
          setBriefError(result.error || 'Failed to generate brief');
        }
      } catch (err: any) { if (!cancelled) setBriefError(err.message); }
      finally { if (!cancelled) setBriefLoading(false); }

      if (new Date().getDay() === 1) {
        setWeeklyLoading(true);
        try {
          const r = await window.deskflowAPI.getAiBrief({ type: 'weekly' });
          if (cancelled) return;
          if (r.success && r.content) { setWeeklyContent(r.content); setWeeklyError(null); }
        } catch (err: any) { if (!cancelled) setWeeklyError(err.message); }
        finally { if (!cancelled) setWeeklyLoading(false); }
      }

      setAnomaliesLoading(true);
      try {
        const r = await window.deskflowAPI.checkAnomalies();
        if (cancelled) return;
        if (r.success && r.anomalies?.length > 0) setAnomalies(r.anomalies);
      } catch {} finally { if (!cancelled) setAnomaliesLoading(false); }

      setDigestLoading(true); setDigestError(null);
      try {
        const r = await window.deskflowAPI.getTopicDigest();
        if (cancelled) return;
        if (r.success && r.topics?.length > 0) { setDigestTopics(r.topics); setDigestError(null); }
        else if (!r.success) { setDigestError(r.error || 'Failed to load digests'); }
      } catch (err: any) { if (!cancelled) setDigestError(err.message); }
      finally { if (!cancelled) setDigestLoading(false); }

      if (!cancelled && !cachedPatterns && !cachedSleep) {
        setPatternLoading(true); setSleepLoading(true);
        try {
          const [pR, sR] = await Promise.all([
            window.deskflowAPI.analyzePatterns(),
            window.deskflowAPI.analyzeSleep(),
          ]);
          if (cancelled) return;
          if (pR.success && pR.content) {
            if (typeof pR.content === 'object' && 'score' in pR.content) {
              setParsedPatternContent(pR.content as ParsedPatternResponse);
              saveJson(STORAGE_KEYS.patterns, pR.content);
            } else {
              const parsed = fallbackParsePatternAnalysis(pR.content as string);
              setParsedPatternContent(parsed);
              saveJson(STORAGE_KEYS.patterns, parsed);
            }
          } else { setPatternError(pR.error || 'Failed to analyze'); }
          if (sR.success && sR.content) {
            if (typeof sR.content === 'object' && 'score' in sR.content) {
              setParsedSleepContent(sR.content as ParsedSleepResponse);
              saveJson(STORAGE_KEYS.sleep, sR.content);
            } else {
              const parsed = fallbackParseSleepAnalysis(sR.content as string);
              setParsedSleepContent(parsed);
              saveJson(STORAGE_KEYS.sleep, parsed);
            }
          } else { setSleepError(sR.error || 'Failed to analyze'); }
        } catch (err: any) {
          if (!cancelled) { setPatternError(err.message); setSleepError(err.message); }
        } finally {
          if (!cancelled) { setPatternLoading(false); setSleepLoading(false); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = window.deskflowAPI.onAiBriefReady?.((data: any) => {
      if (data.type === 'daily') {
        if (typeof data.content === 'object' && 'signal' in data.content) {
          setParsedBriefContent(data.content as ParsedDailyBrief);
          saveJson(STORAGE_KEYS.dailyBrief, data.content);
        } else {
          setBriefContent(data.content);
        }
        setBriefLoading(false); setBriefError(null);
      } else if (data.type === 'weekly') {
        setWeeklyContent(data.content); setWeeklyLoading(false); setWeeklyError(null);
      }
    });
    return () => cleanup?.();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const history = chatMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const result = await window.deskflowAPI.dataChatQuery({ query: userMsg, history });
      if (result.success && result.content) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: result.error || 'Sorry, I could not process that.' }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">AI Assistant</h1>
          <p className="text-xs text-zinc-500">Intelligence for your productivity data</p>
        </div>
      </div>

      {/* Anomaly Banner */}
      {anomalies.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-lg text-xs"
          style={{
            backgroundColor: anomalies.some(a => a.severity === 'high') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${anomalies.some(a => a.severity === 'high') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            color: anomalies.some(a => a.severity === 'high') ? '#ef4444' : '#f59e0b',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{anomalies.length} anomaly{anomalies.length !== 1 ? 'ies' : ''} detected — check Alerts section below</span>
          </div>
          <button onClick={() => setAnomalies([])} className="underline opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* 1. Daily Brief — full width */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <BriefCard
              content={parsedBriefContent || briefContent}
              loading={briefLoading}
              error={briefError || undefined}
              onRegenerate={async () => {
                setBriefLoading(true); setBriefError(null);
                try {
                  const r = await window.deskflowAPI.regenerateAiBrief({ type: 'daily' });
                  if (r.success && r.content) {
                    if (typeof r.content === 'object' && 'signal' in r.content) {
                      setParsedBriefContent(r.content as ParsedDailyBrief);
                      saveJson(STORAGE_KEYS.dailyBrief, r.content);
                    } else {
                      setBriefContent(r.content);
                    }
                  } else { setBriefError(r.error || 'Failed to regenerate'); }
                } catch (err: any) { setBriefError(err.message); }
                finally { setBriefLoading(false); }
              }}
              onDismiss={() => { setParsedBriefContent(null); setBriefContent(null); }}
              collapsed={briefCollapsed}
              onToggle={() => setBriefCollapsed(!briefCollapsed)}
            />
          </motion.div>
        </div>

        {/* 2. Weekly Review — full width (if Monday) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            {new Date().getDay() === 1 && !weeklyDismissed ? (
              <WeeklyReviewCard
                content={weeklyContent}
                loading={weeklyLoading}
                error={weeklyError || undefined}
                onRegenerate={async () => {
                  setWeeklyLoading(true); setWeeklyError(null);
                  try {
                    const r = await window.deskflowAPI.regenerateAiBrief({ type: 'weekly' });
                    if (r.success && r.content) setWeeklyContent(r.content);
                    else setWeeklyError(r.error || 'Failed to regenerate');
                  } catch (err: any) { setWeeklyError(err.message); }
                  finally { setWeeklyLoading(false); }
                }}
                onDismiss={() => setWeeklyDismissed(true)}
              />
            ) : (
              <GlassCard>
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <BarChart3 className="w-10 h-10 text-zinc-700 mb-4" />
                  <p className="text-sm text-zinc-400 font-medium">No Weekly Review Yet</p>
                  <p className="text-xs text-zinc-600 mt-2 max-w-md">
                    {new Date().getDay() !== 1
                      ? 'Weekly reviews are generated every Monday morning.'
                      : 'The weekly review was dismissed.'}
                  </p>
                </div>
              </GlassCard>
            )}
          </motion.div>
        </div>

        {/* 3. Research Digest — full width */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <TopicDigestCard
              topics={digestTopics}
              loading={digestLoading}
              error={digestError || undefined}
              onRefresh={async () => {
                setDigestLoading(true); setDigestError(null);
                try {
                  const r = await window.deskflowAPI.getTopicDigest();
                  if (r.success) { setDigestTopics(r.topics || []); setDigestError(null); }
                  else { setDigestError(r.error || 'Failed to refresh'); }
                } catch (err: any) { setDigestError(err.message); }
                finally { setDigestLoading(false); }
              }}
            />
          </motion.div>
        </div>

        {/* 4. Pattern Analyst — 1 column */}
        <div className="col-span-1">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <PatternCard
              data={parsedPatternContent}
              loading={patternLoading}
              error={patternError || undefined}
              onAnalyze={async () => {
                setPatternLoading(true); setPatternError(null);
                try {
                  const r = await window.deskflowAPI.analyzePatterns();
                  if (r.success && r.content) {
                    if (typeof r.content === 'object' && 'score' in r.content) {
                      setParsedPatternContent(r.content as ParsedPatternResponse);
                      saveJson(STORAGE_KEYS.patterns, r.content);
                    } else {
                      const parsed = fallbackParsePatternAnalysis(r.content as string);
                      setParsedPatternContent(parsed);
                      saveJson(STORAGE_KEYS.patterns, parsed);
                    }
                  } else { setPatternError(r.error || 'Failed to analyze'); }
                } catch (err: any) { setPatternError(err.message); }
                finally { setPatternLoading(false); }
              }}
            />
          </motion.div>
        </div>

        {/* 5. Sleep Optimizer — 1 column */}
        <div className="col-span-1">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <SleepCard
              data={parsedSleepContent}
              loading={sleepLoading}
              error={sleepError || undefined}
              onAnalyze={async () => {
                setSleepLoading(true); setSleepError(null);
                try {
                  const r = await window.deskflowAPI.analyzeSleep();
                  if (r.success && r.content) {
                    if (typeof r.content === 'object' && 'score' in r.content) {
                      setParsedSleepContent(r.content as ParsedSleepResponse);
                      saveJson(STORAGE_KEYS.sleep, r.content);
                    } else {
                      const parsed = fallbackParseSleepAnalysis(r.content as string);
                      setParsedSleepContent(parsed);
                      saveJson(STORAGE_KEYS.sleep, parsed);
                    }
                  } else { setSleepError(r.error || 'Failed to analyze'); }
                } catch (err: any) { setSleepError(err.message); }
                finally { setSleepLoading(false); }
              }}
            />
          </motion.div>
        </div>

        {/* 6. Anomalies — 1 column */}
        <div className="col-span-1">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard accent accentColor="#ef4444">
              <SectionHeader
                icon={AlertTriangle}
                accent="#ef4444"
                title="Activity Alerts"
                description="Unusual patterns in your tracked activity"
                action={anomalies.length > 0 ? (
                  <button
                    onClick={() => setAnomalies([])}
                    className="text-sm px-4 py-2 rounded-lg transition-colors duration-150 bg-red-400/10 text-red-400 border border-red-400/20"
                  >
                    Dismiss All
                  </button>
                ) : undefined}
              />

              {anomaliesLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-red-400 rounded-full animate-spin" />
                </div>
              )}

              {!anomaliesLoading && anomalies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <AlertTriangle className="w-10 h-10 text-zinc-700 mb-4" />
                  <p className="text-sm text-zinc-400 font-medium">All Clear</p>
                  <p className="text-xs text-zinc-600 mt-2">No anomalies detected.</p>
                </div>
              )}

              {anomalies.length > 0 && (
                <div className="space-y-3">
                  {anomalies.map((a, i) => (
                    <div key={i} className="p-4 rounded-xl flex items-start gap-3 bg-red-400/4 border border-red-400/15">
                      <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                      <div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{a.detail}</p>
                        <span className="text-xs uppercase tracking-wider mt-1 inline-block font-medium" style={{ color: a.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                          {a.severity} severity
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>

        {/* 7. Chat — 1 column */}
        <div className="col-span-1">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <div className="rounded-xl p-5 border flex flex-col bg-amber-400/3 border-amber-400/15">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-zinc-800">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-400/12">
                  <MessageCircle className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">Ask Your Stats</h3>
                  <p className="text-xs text-zinc-500">Ask questions about your tracked data</p>
                </div>
                <button
                  onClick={() => setChatMessages([{ role: 'assistant', content: 'Hi! Ask me anything about your tracked activity.' }])}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
                  title="Clear chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 min-h-[200px] max-h-[360px] overflow-y-auto mb-4 pr-1">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' ? 'text-zinc-900 font-medium' : 'text-zinc-300'
                      }`}
                      style={msg.role === 'user' ? { backgroundColor: '#f59e0b' } : { backgroundColor: 'rgba(63, 63, 70, 0.4)' }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ backgroundColor: 'rgba(63, 63, 70, 0.4)' }}>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatMessages.length === 1 && !chatLoading && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  {QUICK_PROMPTS.map(text => (
                    <button
                      key={text}
                      onClick={() => setChatInput(text)}
                      className="h-7 px-3 rounded-md text-xs font-medium transition-colors duration-150 bg-amber-400/8 text-[#d4a047] border border-amber-400/15"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="e.g. How much YouTube this week?"
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-zinc-900/80 border border-zinc-700/60 text-white placeholder-zinc-500 outline-none focus:border-amber-600/50 transition-colors"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2.5 rounded-xl transition-colors duration-150 disabled:opacity-30 bg-amber-400 text-[#0a0a0a]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
```

### IPC Handler Changes (main.ts)

Update the `analyze-patterns` and `analyze-sleep` IPC handlers to pass through the already-parsed object (AIService now returns the parsed object directly):

```typescript
// analyze-patterns handler (around line 9559) — minimal change:
const result = await AIService.analyzePatterns(apiKey, { dailySummary }, model);
return { success: true, content: result.content };
// content is now ParsedPatternResponse (object) instead of raw string

// analyze-sleep handler (around line 9599) — minimal change:
const result = await AIService.analyzeSleep(apiKey, { sleepSummary, productivitySummary }, model);
return { success: true, content: result.content };
// content is now ParsedSleepResponse (object) instead of raw string
```

No IPC handler changes needed for `generateDailyBriefAndCache` — the `content.summary` field will now contain a `ParsedDailyBrief` object instead of a raw string. The handler only needs to stringify it before storing in the DB.
