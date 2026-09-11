# RESULT.md — Complete Content Engine System Design

## 1. Executive Summary

The Content Engine is a **complete computational media pipeline** — not an editor, not a planner, but the entire lifecycle from raw thought to published video to extracted lesson and back again. Every script bullet point carries **machine-checkable retention evidence** proving which criteria its exact wording satisfies. Every video is displayed as a **beautiful, auditable process** — from the first brainstorm message through AI classification, script generation, per-bullet proof validation, gate checks, filming, publishing, analytics ingestion, human reflection, lesson extraction, and framework evolution. The system operates on two inseparable layers: **objective data** (retention curves, completion rates, audience demographics) and **human intuition** (the creator's felt sense of what worked, why, and what characteristics made this specific video unique). All intelligence flows through prompts to external AI tools, with structured results inserted back into the application — creating a self-improving loop where every video makes the next one better.

---

## 2. System Architecture

### 2.1 Master Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE COMPLETE PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

RAW THOUGHT ("yap")
    │
    ▼
┌─────────────────────────────────┐
│  BRAINSTORM CLASSIFIER          │ ← PROMPT_CLASSIFY_IDEA
│  content_idea | framework_update│
│  system_improvement | analytics │
│  general_thought                │
└───────────────┬─────────────────┘
                │ routes to
                ▼
┌─────────────────────────────────┐
│  IDEA POOL (raw→refined→       │
│  approved→used)                 │
│  + 3-Gate Validator             │ ← PROMPT_GATE_VALIDATOR
│  + Idea Synthesis Engine        │ ← PROMPT_SYNTHESIZE_IDEAS
└───────────────┬─────────────────┘
                │ compiled into episode
                ▼
┌─────────────────────────────────┐
│  SCRIPT GENERATION              │ ← PROMPT_SCRIPT_FRAMES
│  Frames[] with per-frame        │   (system prompt: CONTENT_ENGINE_SYSTEM)
│  RetentionEvidence{}            │
│  + Framework injection          │
│  + Lesson injection             │
│  + Theme hook injection         │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  EVIDENCE VALIDATION            │ ← PROMPT_VALIDATE_SCRIPT_EVIDENCE
│  AI re-verifies every claim     │
│  score < 0.6 → REJECT + regen  │ ← PROMPT_REGENERATE_LINE
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  3-GATE CHECK + SEO INJECTION   │ ← PROMPT_GATE_VALIDATOR
│  scroll_stop / hard_cut /       │   PROMPT_SEO_INJECTOR
│  asset_ready                    │
└───────────────┬─────────────────┘
                │ gates pass (or override)
                ▼
┌─────────────────────────────────┐
│  PUBLISHED VIDEO                │
│  External platform data import  │
│  (CSV/JSON/paste → AI parse)    │ ← PROMPT_ANALYTICS_IMPORT
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  ANALYTICS + INSIGHT            │ ← PROMPT_ANALYTICS_INSIGHT
│  Objective: retention, likes,   │
│  saves, audience, completion    │
│  ─────────────────────────────  │
│  HUMAN REFLECTION LAYER         │ ← user input (guided prompts)
│  Intuition, characteristics,    │
│  felt sense, lessons not in     │
│  the numbers                    │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  LESSON EXTRACTION              │ ← PROMPT_LESSON_EXTRACTOR
│  + Human-annotated lessons      │
│  + Confidence scoring           │
│  + Auto-promotion to frameworks │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  FRAMEWORK REGISTRY             │ ← PROMPT_FRAMEWORK_UPDATE
│  Versioned rules                │
│  Injected into NEXT script gen  │
│  (loop closes)                  │
└─────────────────────────────────┘
```

### 2.2 The Two Layers (Objective + Human)

```
┌────────────────────────────────────────────────────────────────┐
│                    PER-VIDEO DUAL LAYER                         │
├────────────────────────────┬───────────────────────────────────┤
│    OBJECTIVE LAYER         │    HUMAN REFLECTION LAYER          │
│    (Machine-measured)      │    (Creator intuition)             │
├────────────────────────────┼───────────────────────────────────┤
│ • Retention curve          │ • "This felt flat because..."     │
│ • Completion %             │ • "The audience here doesn't      │
│ • Skip rate at 1s/3s       │   respond to storytelling"        │
│ • Likes/Saves/Shares       │ • "I noticed the spike when I     │
│ • Audience age/country     │   changed my expression at 0:12"  │
│ • Engagement velocity      │ • "This hook worked because of    │
│ • Replay rate              │   the specific pain it named"     │
│ • Follower conversion      │ • "Storytelling requires charisma │
│ • Drop-off timestamps      │   I don't have — pivot format"    │
├────────────────────────────┼───────────────────────────────────┤
│ Source: Platform import    │ Source: User input (guided)        │
│ Storage: content_videos    │ Storage: video_reflections         │
│ Processing: AI insight     │ Processing: AI pattern detection   │
│ Display: Charts + numbers  │ Display: Journal + tags + links    │
└────────────────────────────┴───────────────────────────────────┘
```

### 2.3 The Process Timeline (Beauty of Process)

Every episode carries a **ProcessTimeline** — an ordered log of every event from conception to lesson extraction. This is the app's core marketing feature: showing the user their own growth, their own process, the beauty of each step.

```
ProcessTimeline Entry:
{
  id, episode_id, timestamp,
  event_type: 'brainstorm_message' | 'idea_created' | 'idea_refined' |
              'episode_created' | 'script_generated' | 'bullet_evidence_added' |
              'bullet_rejected' | 'bullet_regenerated' | 'evidence_validated' |
              'gate_checked' | 'gate_overridden' | 'seo_injected' |
              'filming_started' | 'video_published' | 'analytics_imported' |
              'human_reflection_added' | 'insight_generated' | 'lesson_extracted' |
              'framework_updated',
  actor: 'user' | 'ai' | 'system',
  summary: "one-line description",
  detail: JSON,  // the actual payload (prompt sent, response received, score, etc.)
  ai_model_used: string | null,
  duration_ms: number | null
}
```

---

## 3. Backend Specification

### 3.1 The Content Engine System Prompt (NEW — gap §9.2)

This replaces the generic `JSON_SYSTEM` for ALL content engine prompts:

```
You are the RHEO Content Engine — a short-form video retention engineer and script validator.

IDENTITY:
You are not a creative writer. You are an ENGINEER of attention. Every word you produce must satisfy measurable retention criteria. You do not write "nice scripts." You construct frame-by-frame attention architectures.

EVIDENCE CONTRACT (non-negotiable):
For every script frame you generate, you MUST provide:
- criteria: array of criterion IDs from the active rubric that this frame satisfies
- mechanism: HOW the exact wording satisfies each criterion (not what it says, but how it works)
- evidence: a QUOTE from the frame's own text that proves the claim. The evidence must be a substring of the frame's text. If you cannot quote the proof, the claim is invalid.
- score: 0.0–1.0. Below 0.6 = REJECTED. Never output a frame with score < 0.6.

ANTI-HALLUCINATION RULE:
Evidence must be quotable from the frame text. Never write evidence like "the hook creates curiosity" without pointing to the EXACT words that create it. If the frame says "3 mistakes killing your ML progress", evidence must reference "3 mistakes" (specificity) and "killing" (stakes/urgency).

RUBRIC AWARENESS:
The active rubric criteria are provided as data. Never hardcode criterion names. Reference them by ID. The rubric version may change — your logic must be version-agnostic.

JSON-ONLY OUTPUT:
Respond in valid JSON only. No markdown. No code fences. No explanation outside JSON. No commentary.

TONE RULES PER TEMPLATE:
- Script generation: punchy, 12 words max per spoken line, no filler
- Evidence validation: clinical, precise, quote-based
- Analytics insight: data-driven, reference exact numbers, no vague advice
- Lesson extraction: durable rules, not one-off observations
- Framework updates: prescriptive, testable, falsifiable

CURRENT RUBRIC (version {{rubric_version}}, threshold {{threshold}}):
{{criteria_list}}
```

### 3.2 Updated Retention Rubric (v2.0.0 — incorporating Non-Negotiable Traits + Research Report)

The existing 7 criteria expand to **14 criteria** incorporating the user's non-negotiable traits and the 2026 research report:

```typescript
// src/services/contentEngine/rubric.ts — v2.0.0
export const RETENTION_RUBRIC = {
  version: '2.0.0',
  threshold: 0.6,
  criteria: [
    // === SCROLL-STOPPING OPENING STACK (0-3s) ===
    {
      id: 'visual_hook',
      name: 'Visual Hook (0-0.5s)',
      definition: 'Immediate onscreen movement, surprising frame, bold title, or dramatic before/after that communicates a hook purely on mute.',
      scoring: '0.0-1.0: strength of visual pattern interrupt without audio',
      timeline: '0-0.5s',
      non_negotiable: true,
    },
    {
      id: 'verbal_hook',
      name: 'Verbal Hook (0.5-1.5s)',
      definition: 'Single spoken sentence establishing clear outcome, removing objection, signaling credibility. No greeting, no intro.',
      scoring: '0.0-1.0: outcome clarity + objection removal + credibility signal',
      timeline: '0.5-1.5s',
      non_negotiable: true,
    },
    {
      id: 'context_lock',
      name: 'Context Lock (1.5-3.0s)',
      definition: 'Explicitly calls out who the video is for and what they will get. Triggers self-selection for algorithm targeting.',
      scoring: '0.0-1.0: specificity of audience callout + value promise',
      timeline: '1.5-3.0s',
      non_negotiable: true,
    },
    // === ATTENTION-SUSTAINING MECHANICS (Middle) ===
    {
      id: 'curiosity_gap',
      name: 'Curiosity / Expectation Gap',
      definition: 'Reveals partial information and withholds payoff. Contrasts common-sense failure with counterintuitive solution.',
      scoring: '0.0-1.0: strength of the gap between revealed and withheld',
      timeline: '3-60s',
      non_negotiable: true,
    },
    {
      id: 'pattern_interrupt',
      name: 'Pattern Interrupt (Mid-Video)',
      definition: 'Visual/audio/perspective shift every 30-45s. Hard cuts, smart zooms (1.5-2x), graphics, conversational asides.',
      scoring: '0.0-1.0: frequency + effectiveness of interrupts',
      timeline: 'every 30-45s',
      non_negotiable: true,
    },
    {
      id: 'value_loop',
      name: 'Value Loop (What/How/Why)',
      definition: 'Every sub-point delivers: What it is (concept), How to do it (tactical code/action), Why it matters (ties to outcome).',
      scoring: '0.0-1.0: completeness of the What/How/Why triad per sub-point',
      timeline: 'per segment',
      non_negotiable: true,
    },
    {
      id: 'three_cs',
      name: '3 Cs: Clarity, Conciseness, Conversational',
      definition: 'No unexplained jargon. Zero filler words. Speaks as if to a friend, not an audience. No stiff on-air voice.',
      scoring: '0.0-1.0: absence of jargon + filler + formality',
      timeline: 'entire script',
      non_negotiable: true,
    },
    // === HUMAN KINETICS & DELIVERY ===
    {
      id: 'facial_expression',
      name: 'Facial Expression Engineering',
      definition: 'Physical expressions matched to cognitive context. Furrowed brow during problem phase. Widened eyes + raised brows during resolution. Duchenne eye-markers for sincerity.',
      scoring: '0.0-1.0: specificity of expression directions matched to content phases',
      timeline: 'per frame',
      non_negotiable: false,
    },
    {
      id: 'pacing_pauses',
      name: 'Pacing & Strategic Pauses',
      definition: '125-150 WPM speaking velocity. 0.3-0.5s pauses before critical reveals to signal importance and allow processing.',
      scoring: '0.0-1.0: WPM compliance + pause placement at reveal moments',
      timeline: 'entire script',
      non_negotiable: false,
    },
    // === POST-PRODUCTION DYNAMICS ===
    {
      id: 'acoustic_ducking',
      name: 'Acoustic Sidechain Ducking',
      definition: 'Background music ducked -3dB to -6dB when voiceover speaks. Music cushions dialogue, never competes.',
      scoring: '0.0-1.0: ducking specified at correct moments + correct depth',
      timeline: 'audio layer',
      non_negotiable: false,
    },
    {
      id: 'seamless_loop',
      name: 'Seamless Loop',
      definition: 'Final CTA sentence flows grammatically back into opening hook. Tricks brain into rewatch. Multiplies replay signal.',
      scoring: '0.0-1.0: grammatical continuity from last frame to first frame',
      timeline: 'final frame → frame 0',
      non_negotiable: false,
    },
    // === ALGORITHMIC SIGNALS ===
    {
      id: 'hook_at_3_4s',
      name: 'Hook Payoff at 3-4s',
      definition: 'The hook payoff lands at 3-4s — exactly where viewers drop off. Not at second 0.',
      scoring: '0.0-1.0: payoff placement AND stakes clarity at the 3-4s mark',
      timeline: '3-4s',
      non_negotiable: true,
    },
    {
      id: 'value_speed',
      name: 'Value Delivery Speed',
      definition: 'First payoff lands within 8 seconds. Quick win / trust deposit before 10s.',
      scoring: '0.0-1.0: how fast value arrives',
      timeline: '0-8s',
      non_negotiable: true,
    },
    {
      id: 'specific_pain',
      name: 'Specific Pain / Stakes First',
      definition: 'Names a concrete pain, person, or risk the viewer immediately recognizes as theirs. States what is at risk.',
      scoring: '0.0-1.0: concreteness of pain + urgency of loss',
      timeline: '0-10s',
      non_negotiable: true,
    },
  ],
  nicheRule: 'All criteria must be re-expressed for the target niche/topic — never paste verbatim cross-niche.',
  nonNegotiableRule: 'Frames scoring < 0.6 on ANY non_negotiable criterion are AUTO-REJECTED regardless of overall score.',
} as const;
```

### 3.3 Dynamic Scoring Schemes (NEW)

Criteria are fixed. **Weights vary by format type and video tier:**

```typescript
// src/services/contentEngine/scoringSchemes.ts
export interface ScoringScheme {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>; // criterion_id → weight (0-1, sum = 1.0)
  applies_to: {
    format_types?: string[];
    duration_tier?: 'signal_builder' | 'audience_builder' | 'media_operator';
    series?: string[];
  };
}

export const SCORING_SCHEMES: ScoringScheme[] = [
  {
    id: 'signal_builder',
    name: 'Signal Builder (11-18s)',
    description: 'Optimized for rapid algorithmic feedback. Hook and visual dominate.',
    weights: {
      visual_hook: 0.20,
      verbal_hook: 0.18,
      context_lock: 0.12,
      hook_at_3_4s: 0.15,
      value_speed: 0.15,
      specific_pain: 0.10,
      pattern_interrupt: 0.05,
      seamless_loop: 0.05,
    },
    applies_to: { duration_tier: 'signal_builder' },
  },
  {
    id: 'audience_builder',
    name: 'Audience Builder (30-90s)',
    description: 'Engagement sweet spot. Value loops and curiosity gaps dominate.',
    weights: {
      visual_hook: 0.10,
      verbal_hook: 0.10,
      context_lock: 0.08,
      curiosity_gap: 0.15,
      pattern_interrupt: 0.12,
      value_loop: 0.18,
      three_cs: 0.10,
      pacing_pauses: 0.07,
      specific_pain: 0.05,
      hook_at_3_4s: 0.05,
    },
    applies_to: { duration_tier: 'audience_builder' },
  },
  {
    id: 'media_operator',
    name: 'Media Operator (60s+)',
    description: 'Monetization and deep-dive. Completeness and delivery dominate.',
    weights: {
      visual_hook: 0.08,
      verbal_hook: 0.08,
      context_lock: 0.06,
      curiosity_gap: 0.12,
      pattern_interrupt: 0.12,
      value_loop: 0.20,
      three_cs: 0.10,
      facial_expression: 0.06,
      pacing_pauses: 0.06,
      acoustic_ducking: 0.04,
      seamless_loop: 0.08,
    },
    applies_to: { duration_tier: 'media_operator' },
  },
];

export function computeFrameScore(
  frame: ScriptFrame,
  scheme: ScoringScheme
): number {
  const retention = frame.retention;
  if (!retention || !retention.criteria?.length) return 0;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const criterionId of retention.criteria) {
    const weight = scheme.weights[criterionId] || 0;
    weightedSum += retention.score * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : retention.score;
}

export function getSchemeForEpisode(episode: ContentEpisode, idea?: ContentIdea): ScoringScheme {
  const duration = estimateDuration(episode.script || []);
  if (duration <= 18) return SCORING_SCHEMES.find(s => s.id === 'signal_builder')!;
  if (duration <= 90) return SCORING_SCHEMES.find(s => s.id === 'audience_builder')!;
  return SCORING_SCHEMES.find(s => s.id === 'media_operator')!;
}
```

### 3.4 New Prompt Templates

#### 3.4.1 Human Reflection Prompt (NEW)

```typescript
export const PROMPT_HUMAN_REFLECTION = `You are a content introspection coach. The creator just published a video and is reflecting on it.

Their raw reflection: {{reflection_text}}
Video performance data: {{performance_json}}
Script that was used: {{script_frames_json}}

Analyze their reflection and extract:
1. CHARACTERISTICS: What unique variables did this video have? (hook style, format, energy, topic angle, visual approach, delivery style)
2. INTUITIONS: What did the creator FEEL worked or didn't, that the numbers might not show?
3. CONTRADICTIONS: Where does their gut feeling DISAGREE with the data? (This is the most valuable signal.)
4. FORMAT_FIT: Did this content type suit their delivery style? (e.g., "storytelling requires charisma/authority they don't have yet")
5. ACTIONABLE_PATTERNS: What reusable rule can be extracted?

Return:
{
  "characteristics": ["list of unique variables for this video"],
  "intuitions": ["what the creator felt worked/failed"],
  "contradictions": ["where gut ≠ data"],
  "format_fit": {
    "suited": true|false,
    "reason": "why or why not",
    "better_format": "suggested alternative if not suited"
  },
  "actionable_patterns": ["reusable rules extracted"],
  "confidence": 0-1,
  "suggested_lesson": "one-sentence lesson for the framework"
}
${JSON_ONLY}`;
```

#### 3.4.2 Analytics Import Prompt (NEW — gap §9.3)

```typescript
export const PROMPT_ANALYTICS_IMPORT = `You are a social media analytics parser. The user has pasted or uploaded raw platform data.

Raw input: {{raw_data}}
Platform: {{platform}}
Expected fields: views, likes, saves, shares, comments, completion_pct, retention_curve (array of {t, pct}), audience (ages + countries), dropoffs

Parse this into structured JSON. If data is missing, set to null. If retention curve is described in text (e.g., "78% at 3s, 45% at 10s"), convert to array format.

Return:
{
  "title": "video title if identifiable",
  "views": number|null,
  "likes": number|null,
  "saves": number|null,
  "shares": number|null,
  "comments": number|null,
  "completion_pct": number|null,
  "retention_curve": [{"t": seconds, "pct": 0-100}]|null,
  "audience": {
    "ages": [{"range": "18-24", "pct": 45}]|null,
    "countries": [{"code": "US", "name": "United States", "pct": 35}]|null
  },
  "dropoffs": [{"t": seconds, "pct": drop_percentage}]|null,
  "confidence": 0-1,
  "parse_notes": "any ambiguities resolved"
}
${JSON_ONLY}`;
```

#### 3.4.3 Score Calibration Prompt (NEW)

```typescript
export const PROMPT_SCORE_CALIBRATION = `You are a prediction accuracy analyst. Compare the PREDICTED retention scores against ACTUAL performance.

Predicted scores (from script generation):
{{predicted_scores_json}}

Actual performance (from analytics):
{{actual_performance_json}}

For each criterion that was scored:
1. Did the high-scoring elements actually retain viewers?
2. Did low-scoring elements actually cause drop-offs?
3. Which criterion's score was most accurate?
4. Which criterion's score was most wrong?
5. What adjustment should be made to the scoring weights?

Return:
{
  "accuracy_by_criterion": [
    {"criterion_id": "string", "predicted": 0-1, "actual_correlation": 0-1, "accuracy": 0-1, "adjustment": "increase_weight|decrease_weight|maintain"}
  ],
  "overall_accuracy": 0-1,
  "biggest_surprise": "what performed opposite to prediction",
  "weight_adjustments": [{"criterion_id": "string", "new_weight": number}],
  "verdict": "one paragraph summary"
}
${JSON_ONLY}`;
```

#### 3.4.4 Process Timeline Summary Prompt (NEW)

```typescript
export const PROMPT_PROCESS_SUMMARY = `You are a process narrator. Given the complete process timeline of a video, generate a beautiful, concise narrative of how this video came to life.

Timeline events: {{timeline_json}}
Final performance: {{performance_json}}

Generate:
{
  "title": "one-line title for this process story",
  "narrative": "3-5 sentences telling the story of this video's creation journey",
  "key_turning_point": "the single moment that changed everything",
  "growth_signal": "what the creator learned/improved vs previous videos",
  "process_steps_count": number,
  "ai_interactions_count": number,
  "total_iterations": number
}
${JSON_ONLY}`;
```

### 3.5 New IPC Channels

| Channel | Purpose | Payload | Response |
|---------|---------|---------|----------|
| `content:reflection:save` | Save human reflection for a video | `{episodeId, reflectionText, formatFeel, characteristics[]}` | `{ok, id}` |
| `content:reflection:get` | Get reflections for episode | `{episodeId}` | `{reflections[], aiAnalysis}` |
| `content:reflection:analyze` | AI analyze reflection | `{episodeId, reflectionText}` | `{characteristics, intuitions, contradictions, format_fit, patterns}` |
| `content:analytics:import-raw` | Import raw platform data (paste/upload) | `{episodeId, platform, rawData}` | `{ok, parsedVideo, confidence}` |
| `content:scoring:scheme` | Get active scoring scheme | `{episodeId}` | `{scheme, weights}` |
| `content:scoring:calibrate` | Run score calibration | `{episodeId}` | `{accuracy_by_criterion, adjustments}` |
| `content:process:timeline` | Get full process timeline | `{episodeId}` | `{events[]}` |
| `content:process:log` | Log a process event | `{episodeId, eventType, actor, summary, detail}` | `{ok, id}` |
| `content:process:summary` | AI summarize process | `{episodeId}` | `{title, narrative, turning_point, growth_signal}` |
| `content:video:characteristics` | Get/set video characteristics | `{episodeId}` | `{characteristics[]}` |

### 3.6 New Database Tables

```sql
-- Human reflection layer
CREATE TABLE IF NOT EXISTS video_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  reflection_text TEXT NOT NULL,
  characteristics JSON,
  intuitions JSON,
  contradictions JSON,
  format_fit JSON,
  actionable_patterns JSON,
  suggested_lesson TEXT,
  confidence REAL DEFAULT 0.5,
  ai_analyzed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
);

-- Video characteristics (unique variables per video)
CREATE TABLE IF NOT EXISTS video_characteristics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  category TEXT NOT NULL, -- 'hook_style' | 'format' | 'energy' | 'topic_angle' | 'visual' | 'delivery' | 'audio'
  value TEXT NOT NULL,
  impact_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
);

-- Process timeline
CREATE TABLE IF NOT EXISTS process_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('user', 'ai', 'system')),
  summary TEXT NOT NULL,
  detail JSON,
  ai_model_used TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
);

-- Score calibration history
CREATE TABLE IF NOT EXISTS score_calibrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  predicted_scores JSON,
  actual_performance JSON,
  accuracy_by_criterion JSON,
  overall_accuracy REAL,
  weight_adjustments JSON,
  verdict TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (episode_id) REFERENCES content_episodes(id)
);

-- Scoring schemes (dynamic weights)
CREATE TABLE IF NOT EXISTS scoring_schemes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  weights JSON NOT NULL,
  applies_to JSON,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.7 Script Generation Pipeline (Updated)

```
INPUT COMPOSITION for PROMPT_SCRIPT_FRAMES:
{
  idea: {title, hook, format_type, frames_plan},
  active_framework: {name, rules[]},          // from content_frameworks WHERE is_active
  validated_lessons: [{lesson, evidence, confidence}],  // from content_lessons WHERE status='active' AND confidence > 0.7
  theme_hooks: [{hook, format_type, reason}],  // from themes if episode has theme_id
  scoring_scheme: {id, name, weights},         // dynamic based on estimated duration
  rubric: {version, threshold, criteria[]},    // current rubric (version-agnostic)
  human_reflections_from_previous: [{patterns, format_fit}],  // last 3 reflections
}
```

The prompt is composed dynamically. Framework rules are injected as constraints. Lessons are injected as "MANDATORY rules from past experience." Theme hooks are injected as inspiration. Previous reflections are injected as "avoid what didn't work before."

### 3.8 Learning Loop Auto-Promotion

```
TRIGGER: content:lessons:extract succeeds AND lesson.confidence >= 0.8

ACTION:
1. Check if lesson.applies_to matches an existing framework
2. If yes → create framework UPDATE (new version) with lesson as new rule
3. If no → create new framework entry
4. Set framework.is_active = 1
5. Log to process_timeline: {event_type: 'framework_updated', actor: 'system'}
6. Next script generation call INCLUDES this new rule in its prompt

INJECTION FORMAT in PROMPT_SCRIPT_FRAMES:
"MANDATORY RULES FROM PAST EXPERIENCE (violating these = automatic rejection):
- Rule 1: [lesson text] (confidence: 0.85, evidence: completion dropped 40% when violated)
- Rule 2: [lesson text] (confidence: 0.92, evidence: saves increased 3x when applied)
..."
```

---

## 4. UI Specification

### 4.1 Component Tree

```
ContentEngineWorkspace
├── Header (mode toggle: Overlay Studio | Content Engine)
├── Navigation Tabs
│   ├── Brainstorm
│   ├── Idea Pool
│   ├── Episodes
│   ├── Themes
│   ├── Analytics
│   ├── Lessons
│   ├── Frameworks
│   └── Process (NEW)
└── View Containers
    ├── BrainstormView
    ├── IdeaPoolView
    ├── EpisodeDetailView
    │   ├── ScriptProofView (THE CENTERPIECE)
    │   ├── GatesPanel
    │   ├── SEOPanel
    │   ├── MetricsPanel
    │   ├── ReflectionPanel (NEW)
    │   ├── ProcessTimelineView (NEW)
    │   └── CharacteristicsPanel (NEW)
    ├── ThemesView
    ├── AnalyticsDashboard
    ├── LessonsView
    ├── FrameworksView
    └── ProcessGalleryView (NEW)
```

### 4.2 ScriptProofView — THE CENTERPIECE (Per-Bullet Retention Proof)

This is the core UI. Every single bullet point of the script is displayed with its full retention evidence.

#### Component: `ScriptProofCard`

```
Props:
- frame: ScriptFrame
- scheme: ScoringScheme
- rubricVersion: string
- onAccept: () => void
- onReject: () => void
- onRegenerate: (instruction: string) => void
- isRejected: boolean

Layout (per bullet):
┌─────────────────────────────────────────────────────────────────┐
│ FRAME #2 — "value" — 0:08-0:15                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "You copied. You didn't build."                          │    │
│  │ [EXACT TEXT — rendered in JetBrains Mono, 14px, zinc-100]│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  VISUAL: Split screen — Jupyter notebook + red X                │
│                                                                  │
│  ─── RETENTION EVIDENCE ─────────────────────────────────────── │
│                                                                  │
│  Criteria: [specific_pain] [three_cs] [value_loop]              │
│            (chips — amber bg, 10px uppercase, rounded)           │
│                                                                  │
│  Mechanism:                                                     │
│  "The word 'copied' names the exact behavior (specific_pain).   │
│   Two sentences, 7 words total (three_cs: conciseness).         │
│   Delivers the What — the mistake — before the How (value_loop)."│
│  [zinc-300, 12px, italic]                                       │
│                                                                  │
│  Evidence:                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ QUOTE: "You copied" → proves specific_pain              │    │
│  │ QUOTE: "You didn't build" → proves value_loop (What)    │    │
│  │ Both lines < 6 words → proves three_cs (conciseness)    │    │
│  └─────────────────────────────────────────────────────────┘    │
│  [bg-white/[0.03], border-l-2 border-[#f5c518], p-3, mono 11px]│
│                                                                  │
│  Score: ████████████░░ 0.82                                     │
│  [ScoreBar — emerald since > 0.8]                               │
│                                                                  │
│  Scheme Weight: value_loop = 0.18 (Audience Builder)            │
│  Weighted Contribution: 0.82 × 0.18 = 0.148                    │
│                                                                  │
│  ─── ACTIONS ─────────────────────────────────────────────────── │
│  [✓ Accept]  [✗ Reject]  [↻ Regenerate]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Rejected Bullet Visual:

```
┌─────────────────────────────────────────────────────────────────┐
│ FRAME #4 — "value" — 0:25-0:32 — ⚠️ REJECTED (score: 0.48)     │
├─────────────────────────────────────────────────────────────────┤
│ [bg-rose-950/20, border border-rose-500/30, rounded-xl]         │
│                                                                  │
│  "The framework abstracts you from the logic underneath"         │
│  [strikethrough, zinc-500]                                       │
│                                                                  │
│  REJECTION REASON:                                              │
│  ❌ specific_pain: "the framework" is abstract. No concrete     │
│     pain named. Cannot quote specific evidence.                 │
│  ❌ three_cs: "abstracts" is jargon without explanation.        │
│                                                                  │
│  [↻ Regenerate with instruction: _______________]               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Episode-Level Score Summary:

```
┌─────────────────────────────────────────────────────────────────┐
│ EPISODE SCORE — Audience Builder Scheme                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overall: ████████████████░░ 0.87                               │
│                                                                  │
│  Per-Criterion Breakdown:                                       │
│  visual_hook:      ████████████████████ 0.95 (weight: 0.10)    │
│  verbal_hook:      ████████████████░░░░ 0.80 (weight: 0.10)    │
│  context_lock:     ██████████████░░░░░░ 0.70 (weight: 0.08)    │
│  curiosity_gap:    ████████████████████ 0.92 (weight: 0.15)    │
│  pattern_interrupt:████████████████░░░░ 0.85 (weight: 0.12)    │
│  value_loop:       ████████████████████ 0.90 (weight: 0.18)    │
│  three_cs:         ██████████████████░░ 0.88 (weight: 0.10)    │
│  pacing_pauses:    ████████████████░░░░ 0.75 (weight: 0.07)    │
│  specific_pain:    ████████████████████ 0.93 (weight: 0.05)    │
│  hook_at_3_4s:     ████████████████████ 0.91 (weight: 0.05)    │
│                                                                  │
│  Non-Negotiable Check: ✅ ALL PASS                              │
│  Frames: 6 total | 5 accepted | 1 rejected (regenerating)       │
│                                                                  │
│  Scoring Accuracy (from last calibration): 78%                   │
│  [Link: "View calibration details"]                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 ReflectionPanel (NEW — Human Intuition Layer)

```
┌─────────────────────────────────────────────────────────────────┐
│ HUMAN REFLECTION — "How did this video feel?"                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [TextArea — "Write your reflection. What felt right?     │    │
│  │  What felt wrong? What did you notice that the numbers   │    │
│  │  might not show?"]                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Analyze with AI]                                               │
│                                                                  │
│  ─── AI ANALYSIS (after click) ─────────────────────────────── │
│                                                                  │
│  Characteristics of this video:                                 │
│  [hook_style: listicle] [format: proof-first]                   │
│  [energy: high] [topic: ML learning] [delivery: direct]         │
│  (colored chips, each clickable to filter similar videos)       │
│                                                                  │
│  Your Intuitions:                                               │
│  • "The hook landed because it named their exact behavior"      │
│  • "Felt too fast in the middle — viewers didn't have time"     │
│                                                                  │
│  Contradictions (Gut ≠ Data):                                   │
│  ⚡ You felt the middle was too fast, but retention actually     │
│     HELD at 72% through the middle. The data says pacing was    │
│     fine. The feeling of "too fast" may be your own anxiety,    │
│     not viewer experience.                                       │
│                                                                  │
│  Format Fit:                                                     │
│  ✅ This format (listicle) SUITS your delivery style.           │
│  Storytelling does NOT suit you yet (requires authority/charisma│
│  you're still building). Stick to proof-first + listicle.       │
│                                                                  │
│  Extracted Pattern:                                             │
│  "Direct accusation hooks ('you're doing it wrong') outperform  │
│   narrative hooks ('let me tell you about...') for this audience"│
│                                                                  │
│  [Save as Lesson] [Dismiss]                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 ProcessTimelineView (NEW — Beauty of Process)

```
┌─────────────────────────────────────────────────────────────────┐
│ PROCESS — "3 Mistakes Killing Your ML Progress"                  │
│ 12 steps | 4 AI interactions | 2 iterations | shipped in 45min  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ● ─── Brainstorm ─────────────────────────────── Aug 17, 14:02 │
│  │   "if this is how you're learning ML..."                     │
│  │   [user] classified → content_idea [ai]                      │
│  │                                                               │
│  ● ─── Idea Created ───────────────────────────── Aug 17, 14:03 │
│  │   Title: "3 mistakes killing your ML progress"               │
│  │   Series: SVM/Math | Priority: 4                             │
│  │                                                               │
│  ● ─── Format Pivot ───────────────────────────── Aug 17, 14:45 │
│  │   Original: Framework Explanation (4 stages)                  │
│  │   Pivoted to: Listicle (3 mistakes)                           │
│  │   Reason: "1.5 hours invested, format was wrong"             │
│  │   [ai] gate check FAILED → format reassignment               │
│  │                                                               │
│  ● ─── Script Generated ───────────────────────── Aug 17, 15:02 │
│  │   6 frames | Audience Builder scheme                          │
│  │   Model: claude-3.5-sonnet                                   │
│  │                                                               │
│  ● ─── Evidence Validation ────────────────────── Aug 17, 15:05 │
│  │   5/6 frames passed | 1 rejected (score: 0.48)              │
│  │   Rejected: "framework abstracts you" → too abstract         │
│  │                                                               │
│  ● ─── Bullet Regenerated ─────────────────────── Aug 17, 15:06 │
│  │   "You copied. You didn't build." (score: 0.82)              │
│  │                                                               │
│  ● ─── Gates Passed ───────────────────────────── Aug 17, 15:08 │
│  │   scroll_stop ✅ | hard_cut ✅ | asset_ready ✅              │
│  │                                                               │
│  ● ─── SEO Injected ───────────────────────────── Aug 17, 15:09 │
│  │   15 hidden phrases | 3 flash-text cards                     │
│  │                                                               │
│  ● ─── Published ──────────────────────────────── Aug 17, 18:30 │
│  │   Instagram + TikTok                                         │
│  │                                                               │
│  ● ─── Analytics Imported ─────────────────────── Aug 19, 09:15 │
│  │   Views: 1,540 | Completion: 68% | Saves: 89                 │
│  │                                                               │
│  ● ─── Human Reflection ───────────────────────── Aug 19, 09:30 │
│  │   "The direct accusation hook worked. Storytelling doesn't   │
│  │    suit me yet. Listicle format is my strength."             │
│  │                                                               │
│  ● ─── Lesson Extracted ───────────────────────── Aug 19, 09:45 │
│  │   "Direct accusation hooks > narrative hooks for this        │
│  │    audience" (confidence: 0.88)                               │
│  │   → Promoted to Framework: Hook Constraints v3               │
│  │                                                               │
│  ◉ ─── Process Complete ───────────────────────── Aug 19, 09:46 │
│      Total time: 45 min | AI calls: 4 | Iterations: 1           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 ProcessGalleryView (NEW — The Marketing View)

A gallery of all videos displayed as **process cards** — showing the journey, not just the result. This is the "beauty of process" view.

```
┌─────────────────────────────────────────────────────────────────┐
│ PROCESS GALLERY — Your Growth, Visualized                        │
│ "Every video is a journey. Every step is proof of your work."    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ VIDEO 15 │  │ VIDEO 14 │  │ VIDEO 13 │  │ VIDEO 12 │       │
│  │          │  │          │  │          │  │          │       │
│  │ 3 Mistakes│  │ Guardrails│ │ SVM Ep 2 │  │ Zero-Cost│       │
│  │          │  │          │  │          │  │          │       │
│  │ 12 steps │  │ 9 steps  │  │ 14 steps │  │ 8 steps  │       │
│  │ 45 min   │  │ 30 min   │  │ 90 min   │  │ 25 min   │       │
│  │ 1 pivot  │  │ 0 pivots │  │ 2 pivots │  │ 0 pivots │       │
│  │          │  │          │  │          │  │          │       │
│  │ Score:87%│  │ Score:91%│  │ Score:72%│  │ Score:68%│       │
│  │ Views:1.5K│ │ Views:2.3K│ │ Views:890│  │ Views:640│       │
│  │          │  │          │  │          │  │          │       │
│  │ Growth:  │  │ Growth:  │  │ Growth:  │  │ Growth:  │       │
│  │ "Direct  │  │ "Proof   │  │ "Math    │  │ "Setup   │       │
│  │  hooks > │  │  first   │  │  needs   │  │  videos  │       │
│  │  story"  │  │  works"  │  │  visuals"│  │  need    │       │
│  │          │  │          │  │          │  │  hooks"  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ─── GROWTH TREND ────────────────────────────────────────────  │
│  Avg Process Time: 90min → 45min → 30min (improving)           │
│  Avg Score: 62% → 72% → 87% (improving)                       │
│  Pivots per video: 3 → 1 → 0 (reducing)                       │
│                                                                  │
│  "You are getting faster. You are getting better.               │
│   The process is the proof."                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Analytics Dashboard (Updated with Dual Layer)

```
┌─────────────────────────────────────────────────────────────────┐
│ ANALYTICS — Objective + Human                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ─── OBJECTIVE LAYER ───────────────────────────────────────── │
│                                                                  │
│  [NumberTicker: Views 1,540] [NumberTicker: Saves 89]           │
│  [NumberTicker: Completion 68%] [NumberTicker: Followers +12]   │
│                                                                  │
│  [RetentionCurveChart with frame markers]                       │
│  [AudienceBreakdown: ages + countries]                          │
│  [DropoffHeatmap: where viewers leave]                          │
│                                                                  │
│  ─── AI INSIGHTS ───────────────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 💡 "Videos with visual assets get 6× views"             │    │
│  │ 💡 "Direct accusation hooks have 23% higher 3s hold"    │    │
│  │ 💡 "Your completion rate improves when video < 40s"     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─── HUMAN REFLECTION LAYER ────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ YOUR OBSERVATIONS (last 3 videos):                       │    │
│  │ • "Storytelling doesn't work for my audience"            │    │
│  │ • "I need to be a figure of authority, not a narrator"   │    │
│  │ • "Listicle + proof-first = my strongest formats"        │    │
│  │                                                          │    │
│  │ AI DETECTED PATTERN:                                    │    │
│  │ "Your intuition about storytelling is CONFIRMED by data: │    │
│  │  storytelling videos have 34% lower completion than      │    │
│  │  listicle videos. Your gut is calibrated."              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─── SCORE CALIBRATION ─────────────────────────────────────── │
│                                                                  │
│  Prediction Accuracy: 78%                                       │
│  Most Accurate Criterion: specific_pain (92%)                   │
│  Least Accurate: acoustic_ducking (45%)                         │
│  [View Full Calibration Report]                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.7 All Views: 4-State Requirement

Every view MUST implement:

| State | Visual |
|-------|--------|
| **Empty** | Dashed border container, icon, "No [X] yet" + action button. E.g., "No reflections yet. Watch your video, then write how it felt." |
| **Loading** | `LoadingBlock` with spinner + context text. E.g., "AI is analyzing your reflection..." |
| **Error** | `ErrorState` with rose border, error message, Retry button. Never silent. |
| **Populated** | Full content as specified above. |

---

## 5. Interaction & UX Specification

### 5.1 Script Journey (End-to-End)

```
1. User creates Episode from Idea Pool
   → ProcessTimeline logs: 'episode_created'

2. User clicks "Generate Script"
   → Loading state: "Composing script with Audience Builder scheme..."
   → AI call: PROMPT_SCRIPT_FRAMES (with framework + lessons + theme injected)
   → ProcessTimeline logs: 'script_generated' (with model name, duration)

3. Script appears as ScriptProofCards
   → Each frame shows: text, visual, criteria chips, mechanism, evidence, score
   → Episode-level score summary at top
   → User reviews each bullet

4. For each bullet:
   → Accept (✓): card turns emerald border, locks
   → Reject (✗): card turns rose, shows rejection reason, prompts regeneration
   → Regenerate (↻): opens instruction input, AI rewrites that one frame
   → ProcessTimeline logs each action

5. User clicks "Validate Evidence"
   → AI re-checks all claims (PROMPT_VALIDATE_SCRIPT_EVIDENCE)
   → Any frame whose evidence doesn't hold → flagged
   → ProcessTimeline logs: 'evidence_validated'

6. User clicks "Run Gates"
   → 3-Gate check + SEO injection
   → Gates panel shows pass/fail with reasons
   → If fail: "Override" button (logs: 'gate_overridden')
   → If pass: status → 'scripted'

7. User films, publishes
   → Status → 'published'
```

### 5.2 Post-Publish Journey (End-to-End)

```
1. User pastes platform analytics (or uploads CSV)
   → "Paste your Instagram/TikTok analytics data"
   → AI parses (PROMPT_ANALYTICS_IMPORT)
   → Confirm dialog: "Detected: 1,540 views, 68% completion. Correct?"
   → Saved to content_videos
   → ProcessTimeline logs: 'analytics_imported'

2. User writes Human Reflection
   → ReflectionPanel: "How did this video feel?"
   → User types freely
   → Clicks "Analyze with AI"
   → AI extracts characteristics, intuitions, contradictions, format_fit
   → ProcessTimeline logs: 'human_reflection_added'

3. AI generates Insights
   → Combines objective data + human reflection
   → Produces verdict + actionable changes
   → ProcessTimeline logs: 'insight_generated'

4. User extracts Lessons
   → "Extract Lessons" button
   → AI combines analytics + reflection → lessons with confidence
   → User confirms/dismisses each lesson
   → Confirmed lessons → promoted to framework
   → ProcessTimeline logs: 'lesson_extracted', 'framework_updated'

5. Next video generation INHERITS everything
   → New script prompt includes: updated framework + active lessons + reflection patterns
```

### 5.3 AI Call States (Every AI Interaction)

```
IDLE → GENERATING (spinner + context text) → DONE (result rendered) → ERROR (retry)

Never silent. Always:
- Show what's being generated ("Analyzing your reflection...")
- Show which model is being used (from provider chain)
- Show duration when complete ("Analyzed in 3.2s")
- On error: show error message + Retry button + toast
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1) — MUST SHIP FIRST

- [ ] Update rubric to v2.0.0 (14 criteria + non_negotiable flags)
- [ ] Create scoring schemes (3 dynamic schemes)
- [ ] Write Content Engine system prompt (replace JSON_SYSTEM)
- [ ] Add `video_reflections` table + `process_timeline` table + `video_characteristics` table + `score_calibrations` table + `scoring_schemes` table
- [ ] Register new IPC handlers: `content:reflection:*`, `content:process:*`, `content:scoring:*`
- [ ] Add preload bridge methods for all new channels
- [ ] Update d.ts types

**Verification:** Console shows `[ContentEngine] v2.0.0 registered — 14 criteria, 3 schemes, 5 new tables`. All new IPC channels respond to invoke without error.

### Phase 2: Script Proof UI (Week 2)

- [ ] Build `ScriptProofCard` component (per-bullet proof display)
- [ ] Build `EpisodeScoreSummary` component (weighted score breakdown)
- [ ] Build rejected bullet visual state
- [ ] Build Accept/Reject/Regenerate interaction
- [ ] Connect to `content:validate-script-evidence` IPC
- [ ] All 4 states (empty/loading/error/populated)

**Verification:** Generate a script → every bullet shows criteria chips + mechanism + evidence + score. Rejecting a bullet shows rejection reason. Regenerating updates the card in-place.

### Phase 3: Human Reflection + Process Timeline (Week 3)

- [ ] Build `ReflectionPanel` component
- [ ] Build `ProcessTimelineView` component
- [ ] Build `ProcessGalleryView` component
- [ ] Connect reflection AI analysis (PROMPT_HUMAN_REFLECTION)
- [ ] Auto-log process events on every AI call and user action
- [ ] All 4 states

**Verification:** Write a reflection → AI analyzes → shows characteristics, intuitions, contradictions, format_fit. Process timeline shows every step from brainstorm to lesson.

### Phase 4: Analytics Import + Calibration (Week 4)

- [ ] Build analytics import UI (paste/upload → AI parse → confirm)
- [ ] Build score calibration view
- [ ] Build dual-layer analytics dashboard (objective + human)
- [ ] Connect PROMPT_ANALYTICS_IMPORT + PROMPT_SCORE_CALIBRATION
- [ ] All 4 states

**Verification:** Paste raw analytics text → AI parses → confirm → saved. Calibration shows predicted vs actual accuracy per criterion.

### Phase 5: Learning Loop + Framework Injection (Week 5)

- [ ] Auto-promotion: lesson with confidence ≥ 0.8 → framework update
- [ ] Script generation prompt dynamically injects: framework rules + active lessons + reflection patterns + scoring scheme
- [ ] Process summary generation (PROMPT_PROCESS_SUMMARY)
- [ ] Growth trend visualization in ProcessGalleryView
- [ ] All 4 states

**Verification:** Extract a lesson → confirm it → next script generation prompt includes it. ProcessGalleryView shows improvement over time.

---

## 7. Verification Checklist

### Phase 1 Verification
```
[ ] Console: "[ContentEngine] v2.0.0 registered"
[ ] DB: SELECT COUNT(*) FROM content_frameworks WHERE is_builtin=1 → 5
[ ] DB: PRAGMA table_info(video_reflections) → all columns present
[ ] IPC: window.deskflowAPI.contentEngine.reflectionSave({episodeId: 1, reflectionText: "test"}) → {ok: true}
[ ] IPC: window.deskflowAPI.contentEngine.processTimeline({episodeId: 1}) → []
```

### Phase 2 Verification
```
[ ] Generate script → 6+ frames render as ScriptProofCards
[ ] Each card shows: text, criteria chips, mechanism, evidence, score
[ ] Evidence block quotes the frame's own text (verify manually)
[ ] Score < 0.6 → card shows rose border + REJECTED badge
[ ] Click Regenerate → instruction input appears → AI rewrites → card updates
[ ] Episode summary shows weighted score per criterion
```

### Phase 3 Verification
```
[ ] Write reflection → click Analyze → AI response renders in < 10s
[ ] Reflection shows: characteristics, intuitions, contradictions, format_fit
[ ] Process timeline shows events in chronological order
[ ] ProcessGalleryView shows all episodes as process cards
[ ] Growth trend line updates after each new video
```

### Phase 4 Verification
```
[ ] Paste raw analytics → AI parses → confirm dialog shows parsed values
[ ] Confirm → saved to content_videos → analytics dashboard updates
[ ] Calibration report shows accuracy per criterion
[ ] Dual-layer view shows objective numbers AND human reflections side by side
```

### Phase 5 Verification
```
[ ] Extract lesson → confirm → framework version increments
[ ] Generate new script → prompt includes "MANDATORY RULES FROM PAST EXPERIENCE"
[ ] Process summary generates: title, narrative, turning_point, growth_signal
[ ] Full pipeline: brainstorm → script → proof → gates → publish → analytics → reflection → lesson → framework → NEXT script inherits all
```

---

## Appendix A: Non-Negotiable Traits → Rubric Mapping

| Non-Negotiable Trait | Criterion ID | Non-Negotiable? |
|---|---|---|
| Visual Hook (0-0.5s) | `visual_hook` | ✅ YES |
| Verbal Hook (0.5-1.5s) | `verbal_hook` | ✅ YES |
| Context Lock (1.5-3.0s) | `context_lock` | ✅ YES |
| Curiosity/Expectation Gap | `curiosity_gap` | ✅ YES |
| Pattern Interrupts (30-45s) | `pattern_interrupt` | ✅ YES |
| Value Loops (What/How/Why) | `value_loop` | ✅ YES |
| 3 Cs (Clarity/Concise/Conversational) | `three_cs` | ✅ YES |
| Facial Expression Engineering | `facial_expression` | ❌ NO |
| Pacing & Pauses (125-150 WPM) | `pacing_pauses` | ❌ NO |
| Acoustic Sidechain Ducking | `acoustic_ducking` | ❌ NO |
| Seamless Loop | `seamless_loop` | ❌ NO |
| Hook Payoff at 3-4s | `hook_at_3_4s` | ✅ YES |
| Value Speed (first payoff < 8s) | `value_speed` | ✅ YES |
| Specific Pain / Stakes First | `specific_pain` | ✅ YES |

**Rule:** If ANY non-negotiable criterion scores < 0.6, the frame is AUTO-REJECTED regardless of overall weighted score.

## Appendix B: Research Report Integration

| Research Finding | System Implementation |
|---|---|
| 5-7 second retention barrier | `hook_at_3_4s` + `value_speed` criteria enforce payoff within 8s |
| Creator Length Maturity Model (3 tiers) | Dynamic scoring schemes: signal_builder / audience_builder / media_operator |
| 8-Step Scripting Process | Encoded in PROMPT_SCRIPT_FRAMES as generation rules |
| Safe Zones (IG: 820×1270, TT: 810×1306) | Stored in themes + injected into visual overlay plan |
| Pattern interrupts every 30-45s | `pattern_interrupt` criterion + script frames must include interrupt markers |
| Zeigarnik Effect (curiosity loops) | `curiosity_gap` criterion |
| Acoustic ducking -3dB to -6dB | `acoustic_ducking` criterion + CapCut edit notes |
| Completion rate >50% for 60s+ | Analytics insight prompt references this threshold |
| Saves weighted 3× likes | Content Equation scoring + analytics dashboard highlights saves |
| Originality multiplier 40-60% | Process timeline tracks originality; analytics insight references it |
| Trial Reels as testbeds | Episode status pipeline supports 'trial' status before 'published' |

---

*This document is complete and implementable. Every directive from the Raw Request, Engineering Task, Design Task, UX Task, and the user's additional requirements (human reflection, process beauty, non-negotiable traits, research report, dynamic schemes, score calibration) is addressed. No gaps. No stubs. No options A/B/C.*