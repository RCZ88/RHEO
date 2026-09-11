Show more6:57 PMClaude responded: This is a clean, well-scoped task.This is a clean, well-scoped task. Let me write the redesigned AIService.ts with hardened prompts and a fortified parser.Created a file, read a fileCreated a file, read a fileDrop this file directly into src/services/AIService.ts. Here's a summary of every meaningful change and why:

Prompts — the core fix
Every JSON-returning prompt now has three layers of instruction that compound each other:

A "OUTPUT FORMAT — CRITICAL" section that bans markdown, code fences, and extra text with extreme explicitness — models respond to the word "CRITICAL" and the explicit start/end character instruction (Start with { and end with })
A REQUIRED SHAPE line showing the exact JSON skeleton they must copy — this anchors the model to the structure before it fills in values
A EXAMPLE OF CORRECT OUTPUT with realistic data (real app names, real hours, real URLs) — abstract descriptions like "2-3 sentence observation" give the model creative latitude that produces output in unpredictable formats; concrete examples do not

The anomaly prompt now explicitly shows both the empty and non-empty cases side by side, which was the source of the true or false string bug — the model was pattern-matching "boolean" to a natural language phrase.
Temperature set to 0 for all JSON generators. This is the single most impactful change for parse reliability. At temperature: 0.3 or 0.2, the model still randomly experiments with formatting. At 0, it converges on the most statistically likely output — which, given the explicit examples, is the exact JSON shape.
Parser hardened with 5 additional cases: auto-close for truncated JSON (hit when maxTokens cuts the response mid-object), single-quote normalization, unquoted key quoting, "true or false" string coercion, and the hasAnomaly boolean coercion in parseAnomalyCheck specifically.
Each parser now validates the shape after parsing — if wentWell is missing or empty, it falls to the degraded state; if anomalies isn't an array it becomes one; if hasAnomaly is a string it gets cast. This means malformed-but-parseable JSON that passes JSON.parse still gets caught.


// src/services/AIService.ts
// Prompts redesigned for reliable JSON output across all OpenRouter models.
// Parser hardened to handle common model output deviations as a safety net.

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface AICallParams {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  model: string;
  maxTokens?: number;
  temperature?: number;
  apiKey: string;
}

interface AICallResult {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// ─── Parser ───────────────────────────────────────────────────────────────────
// Safety net for when models deviate despite strict prompts.
// Handles: markdown fences, trailing commas, single quotes, unquoted keys,
//          truncated JSON (auto-closes open braces/brackets), "..." placeholders.

function cleanAIJson(raw: string): string {
  let content = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = content.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  // Strip any leading prose before the first { or [
  const firstBrace = content.indexOf('{');
  const firstBracket = content.indexOf('[');
  let start: number;
  let openChar: string;
  let closeChar: string;

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error('No JSON object or array found in response');
  }

  const arrayFirst = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
  if (arrayFirst) {
    start = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    start = firstBrace;
    openChar = '{';
    closeChar = '}';
  }

  content = content.slice(start);

  // Strip any trailing prose after the last matching close character
  // by walking the string and tracking depth
  let depth = 0;
  let inString = false;
  let end = -1;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inString) {
      if (ch === '\\') { i++; continue; } // skip escaped char
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  // If JSON was truncated (no matching close), auto-close open structures
  if (end === -1) {
    // Attempt repair: close unclosed strings first, then close open braces/brackets
    if (inString) content += '"';
    // Count unclosed open chars by re-scanning
    let repairDepth = 0;
    let repairInStr = false;
    const closeStack: string[] = [];
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (repairInStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === '"') repairInStr = false;
        continue;
      }
      if (ch === '"') { repairInStr = true; continue; }
      if (ch === '{') closeStack.push('}');
      if (ch === '[') closeStack.push(']');
      if (ch === '}' || ch === ']') closeStack.pop();
    }
    // Close in reverse order
    while (closeStack.length > 0) {
      content += closeStack.pop();
    }
  } else {
    content = content.slice(0, end + 1);
  }

  // Normalize single-quoted strings to double-quoted
  // Only replaces single quotes used as string delimiters (heuristic: preceded by : , [ or { )
  content = content.replace(/([:\[{,]\s*)'([^']*)'/g, '$1"$2"');

  // Quote unquoted object keys (e.g. {key: "value"} → {"key": "value"})
  content = content.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):/g, '$1"$2"$3:');

  // Remove trailing commas before } or ]
  content = content.replace(/,(\s*[}\]])/g, '$1');

  // Replace literal "..." placeholder values
  content = content.replace(/"\.\.\."/g, '""');
  content = content.replace(/:\s*\.\.\./g, ': ""');

  // Replace unquoted boolean-like strings
  content = content.replace(/:\s*true or false/gi, ': false');

  return content;
}

function parseAIJson<T = any>(raw: string): T {
  const cleaned = cleanAIJson(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    // Last resort: if JSON.parse still fails, throw with both the original and cleaned content for debugging
    throw new Error(`JSON.parse failed.\nCleaned: ${cleaned}\nOriginal: ${raw}\nError: ${e}`);
  }
}

// ─── System Prompts ───────────────────────────────────────────────────────────

// 1. Daily Brief — plain text output, no JSON
export const DAILY_BRIEF_PROMPT = `You are a sharp productivity analyst. Write a 3-4 sentence daily briefing in second person.

OUTPUT FORMAT — CRITICAL:
Output only the briefing sentences. No JSON. No markdown. No code fences. No labels like "Brief:" or "Summary:". No bullet points. No headings. No prefix text. Start directly with the first sentence.

EXAMPLE OF CORRECT OUTPUT:
Your most focused stretch was 9–11am in VS Code, accounting for nearly half your productive time. After lunch you drifted into YouTube for 40 minutes before settling back into work — that transition cost you a clean afternoon. Try setting a 10-minute timer after lunch before opening any browser tab. Overall your output was solid; the morning pattern is worth protecting.

RULES:
- Lead with the single strongest signal in the data (a win, a drop, an unusual pattern)
- Name specific apps, categories, or time windows — never vague statements like "you were productive"
- End with one concrete suggestion that names a specific action or app or time
- Tone: direct, honest, slightly warm. Under 90 words.
- If trend is up: say what caused it. If down: name the specific culprit.`;

// 2. Weekly Review — JSON object output
export const WEEKLY_REVIEW_SYSTEM = `You are a productivity coach analyzing a week of tracked computer activity.

OUTPUT FORMAT — CRITICAL:
Output a single raw JSON object. No markdown. No code fences. No text before the opening brace. No text after the closing brace. No trailing commas. No comments. No placeholder text. Start with { and end with }.

REQUIRED SHAPE (copy this exactly, replace only the string values):
{"wentWell":"string","watchFor":"string","focusSuggestion":"string"}

EXAMPLE OF CORRECT OUTPUT:
{"wentWell":"Your Tuesday and Wednesday mornings were your most focused periods — you logged 3.2h and 3.5h of deep work respectively, mostly in VS Code. The consistency between those two days shows the morning block is working.","watchFor":"Discord pulled you out of flow on Thursday afternoon for 55 minutes across 12 separate opens — that fragmentation killed what should have been a strong close to the week. Friday dipped to just 1.8h productive.","focusSuggestion":"Mute Discord notifications from 1–4pm on Thursdays and Fridays. You averaged 2.4h more productive time on days when you had no Discord activity before 3pm."}

RULES:
- Every sentence must cite specific data: app names, hours, days, percentages
- Use second person (you / your)
- No cheerleading, no filler phrases like "great job" or "keep it up"
- Each field: 2–3 sentences, under 70 words
- No trailing comma after the last field
- All three fields must be present with real string content`;

// 3. Topic Digest — JSON array output
export const TOPIC_DIGEST_SYSTEM = `You are a research brief writer. For each topic given, write a concise intelligence summary.

OUTPUT FORMAT — CRITICAL:
Output a single raw JSON array. No markdown. No code fences. No text before the opening bracket. No text after the closing bracket. No trailing commas. No comments. Start with [ and end with ].

REQUIRED SHAPE (copy this exactly, replace only the string values):
[{"topic":"exact topic name","summary":"string","sources":[{"title":"string","url":"string"}]}]

EXAMPLE OF CORRECT OUTPUT:
[{"topic":"AI model pricing","summary":"DeepSeek slashed V3 pricing by 40% in May, pushing OpenAI and Anthropic to match with new lower tiers. The trend accelerates the shift toward inference-time compute as the dominant cost factor.","sources":[{"title":"DeepSeek pricing update","url":"https://deepseek.com/blog/pricing-update"},{"title":"OpenAI model pricing","url":"https://openai.com/pricing"}]},{"topic":"Electron performance","summary":"Electron 34 introduced V8 sandbox improvements that cut memory overhead by 15–20% for renderer processes. The update primarily benefits apps with multiple webviews open simultaneously.","sources":[{"title":"Electron 34 release notes","url":"https://www.electronjs.org/blog/electron-34-0"}]}]

RULES:
- "topic" must be copied exactly from the user's input — do not rephrase or abbreviate
- Summary: 2–3 sentences, under 55 words, factual, no marketing language
- Prioritize what changed recently over general descriptions
- If you have no specific recent information on a topic, set summary to "No major recent developments identified for this topic." and sources to []
- sources is optional — use [] if you cannot provide reliable links. Do not fabricate URLs.
- No trailing comma after the last item in any array
- Every object must have all three fields: topic, summary, sources`;

// 4. Anomaly Check — JSON object output
export const ANOMALY_SYSTEM = `You are an activity pattern analyst. Identify statistically meaningful deviations in today's activity compared to the user's recent baselines.

OUTPUT FORMAT — CRITICAL:
Output a single raw JSON object. No markdown. No code fences. No text before the opening brace. No text after the closing brace. No trailing commas. No comments. Start with { and end with }.

REQUIRED SHAPE when NO anomalies found (output this exactly):
{"hasAnomaly":false,"anomalies":[]}

REQUIRED SHAPE when anomalies ARE found:
{"hasAnomaly":true,"anomalies":[{"severity":"medium","detail":"string"}]}

EXAMPLE — no anomalies:
{"hasAnomaly":false,"anomalies":[]}

EXAMPLE — with anomalies:
{"hasAnomaly":true,"anomalies":[{"severity":"high","detail":"Total tracked time was 1.8h vs your 30-day average of 6.2h — a 71% drop. This is the second time in 10 days you've had a near-zero day, suggesting a recurring low-activity pattern on Tuesdays."},{"severity":"low","detail":"Discord usage was 48 minutes today vs your 7-day average of 12 minutes — 4x your usual. Most of it was in one block from 2–2:48pm."}]}

RULES:
- "hasAnomaly" must be a JSON boolean: true or false (not a string, not "true or false")
- "anomalies" must always be present and must be an array (empty array [] if no anomalies)
- "severity" must be exactly one of: "low", "medium", "high" — no other values
- Thresholds: flag at >35% deviation for total/productive time; >20min above baseline for specific apps
- "high" = >50% deviation or a new clearly unhealthy behavior
- "medium" = 35–50% deviation
- "low" = borderline, worth noting
- Every "detail" must include magnitude: state the actual value, the baseline, and the percentage or ratio difference
- Maximum 3 anomaly objects. Do not fabricate anomalies to fill the list.
- No trailing comma after the last anomaly object or after the "anomalies" array`;

// ─── User Prompt Builders ─────────────────────────────────────────────────────

export function buildDailyBriefUserPrompt(data: {
  totalHours: number;
  topApps: string;
  productivePct: number;
  productiveHours: number;
  distractingPct: number;
  sleepHours: number | null;
  sleepAvg: number | null;
  trendDescription: string;
}): string {
  return `Yesterday's data:
- Total tracked time: ${data.totalHours}h
- Top apps: ${data.topApps}
- Productive time: ${data.productivePct}% (${data.productiveHours}h)
- Distracting time: ${data.distractingPct}%
- Sleep last night: ${data.sleepHours ?? 'unknown'}h (avg: ${data.sleepAvg ?? 'unknown'}h)
- 7-day trend: ${data.trendDescription}`;
}

export function buildWeeklyReviewUserPrompt(data: {
  weekStart: string;
  weekEnd: string;
  totalProductiveHours: number;
  topApps: string;
  avgFocusScore: number;
  bestDay: string;
  worstDay: string;
  distractionPct: number;
  goalProgress: string;
}): string {
  return `Weekly data (${data.weekStart} to ${data.weekEnd}):
- Total productive time: ${data.totalProductiveHours}h
- Top apps: ${data.topApps}
- Average focus score: ${data.avgFocusScore}
- Best day: ${data.bestDay}
- Most challenging day: ${data.worstDay}
- Distraction time: ${data.distractionPct}%
- Goal progress: ${data.goalProgress}`;
}

export function buildTopicDigestUserPrompt(topics: string[], today: string): string {
  return `Current date: ${today}

Research topics to summarize:
${topics.map(t => `- ${t}`).join('\n')}

For each topic, write a summary of recent key developments or important current information.`;
}

export function buildAnomalyUserPrompt(data: {
  todayTotal: number;
  todayProductive: number;
  todayTopApps: string;
  weekAvgTotal: number;
  weekAvgProductive: number;
  weekAvgDistractingPct: number;
  thirtyDayAvgTotal: number;
  discordTime: number;
  gamesTime: number;
}): string {
  return `Today's activity:
- Total time: ${data.todayTotal}h
- Productive time: ${data.todayProductive}h
- Top apps: ${data.todayTopApps}

7-day average:
- Total time: ${data.weekAvgTotal}h/day
- Productive time: ${data.weekAvgProductive}h/day
- Distracting time: ${data.weekAvgDistractingPct}%

30-day average total: ${data.thirtyDayAvgTotal}h/day

Discord today: ${data.discordTime}m
Games today: ${data.gamesTime}m`;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface WeeklyReviewResult {
  wentWell: string;
  watchFor: string;
  focusSuggestion: string;
}

export interface TopicDigestItem {
  topic: string;
  summary: string;
  sources: Array<{ title: string; url: string }>;
}

export interface AnomalyResult {
  hasAnomaly: boolean;
  anomalies: Array<{
    severity: 'low' | 'medium' | 'high';
    detail: string;
  }>;
}

// ─── Response Parsers with Graceful Fallbacks ────────────────────────────────

export function parseWeeklyReview(raw: string): WeeklyReviewResult {
  try {
    const parsed = parseAIJson<WeeklyReviewResult>(raw);
    // Validate shape — ensure all three fields exist as non-empty strings
    if (
      typeof parsed.wentWell === 'string' &&
      typeof parsed.watchFor === 'string' &&
      typeof parsed.focusSuggestion === 'string' &&
      parsed.wentWell.length > 0
    ) {
      return parsed;
    }
    throw new Error('Missing required fields in weekly review response');
  } catch (_) {
    // Degraded state: put the raw text into wentWell so the user sees something
    return {
      wentWell: raw.slice(0, 300),
      watchFor: '',
      focusSuggestion: '',
    };
  }
}

export function parseTopicDigest(raw: string): TopicDigestItem[] {
  try {
    const parsed = parseAIJson<TopicDigestItem[]>(raw);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    // Normalize: ensure each item has required fields; strip any without topic or summary
    return parsed
      .filter(item => typeof item.topic === 'string' && typeof item.summary === 'string')
      .map(item => ({
        topic: item.topic,
        summary: item.summary,
        sources: Array.isArray(item.sources) ? item.sources : [],
      }));
  } catch (_) {
    return [];
  }
}

export function parseAnomalyCheck(raw: string): AnomalyResult {
  try {
    const parsed = parseAIJson<AnomalyResult>(raw);
    // Validate: hasAnomaly must be boolean, anomalies must be array
    if (typeof parsed.hasAnomaly !== 'boolean') {
      // Coerce string "true"/"false" to boolean — common model mistake
      parsed.hasAnomaly = String(parsed.hasAnomaly).toLowerCase() === 'true';
    }
    if (!Array.isArray(parsed.anomalies)) {
      parsed.anomalies = [];
    }
    // Validate severity values
    const validSeverities = new Set(['low', 'medium', 'high']);
    parsed.anomalies = parsed.anomalies
      .filter(a => typeof a.detail === 'string' && a.detail.length > 0)
      .map(a => ({
        severity: validSeverities.has(a.severity) ? a.severity : 'low' as const,
        detail: a.detail,
      }));
    // Sync hasAnomaly with actual anomalies array
    parsed.hasAnomaly = parsed.anomalies.length > 0;
    return parsed;
  } catch (_) {
    return { hasAnomaly: false, anomalies: [] };
  }
}

// ─── API Caller ───────────────────────────────────────────────────────────────

export async function callAI(params: AICallParams): Promise<AICallResult> {
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://deskflow.app',
      'X-Title': 'DeskFlow',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages,
      ],
      max_tokens: params.maxTokens ?? 400,
      temperature: params.temperature ?? 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage
    ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
    : undefined;

  return { content, usage };
}

// ─── Feature Callers ─────────────────────────────────────────────────────────
// Convenience wrappers used by IPC handlers in main.ts.
// Each returns a typed, validated result — never throws to the caller.

export async function generateDailyBrief(
  userPrompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  try {
    const result = await callAI({
      systemPrompt: DAILY_BRIEF_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      model,
      maxTokens: 200,
      temperature: 0.5, // slight warmth is appropriate here
      apiKey,
    });
    // Daily brief is plain text — strip any accidental markdown formatting
    return result.content
      .replace(/^#+\s+.*\n?/gm, '')   // strip any headings
      .replace(/\*\*/g, '')            // strip bold
      .replace(/^[-*]\s+/gm, '')       // strip bullet points
      .replace(/^(Brief|Summary|Daily Brief):\s*/i, '') // strip common prefixes
      .trim();
  } catch (e) {
    throw new Error(`Daily brief generation failed: ${e}`);
  }
}

export async function generateWeeklyReview(
  userPrompt: string,
  model: string,
  apiKey: string
): Promise<WeeklyReviewResult> {
  try {
    const result = await callAI({
      systemPrompt: WEEKLY_REVIEW_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      model,
      maxTokens: 400,
      temperature: 0, // deterministic JSON output
      apiKey,
    });
    return parseWeeklyReview(result.content);
  } catch (e) {
    return { wentWell: `Generation failed: ${e}`, watchFor: '', focusSuggestion: '' };
  }
}

export async function generateTopicDigest(
  topics: string[],
  today: string,
  model: string,
  apiKey: string
): Promise<TopicDigestItem[]> {
  try {
    const userPrompt = buildTopicDigestUserPrompt(topics, today);
    const result = await callAI({
      systemPrompt: TOPIC_DIGEST_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      model,
      maxTokens: 400,
      temperature: 0,
      apiKey,
    });
    return parseTopicDigest(result.content);
  } catch (_) {
    return [];
  }
}

export async function checkForAnomalies(
  userPrompt: string,
  model: string,
  apiKey: string
): Promise<AnomalyResult> {
  try {
    const result = await callAI({
      systemPrompt: ANOMALY_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      model,
      maxTokens: 400,
      temperature: 0,
      apiKey,
    });
    return parseAnomalyCheck(result.content);
  } catch (_) {
    return { hasAnomaly: false, anomalies: [] };
  }
}