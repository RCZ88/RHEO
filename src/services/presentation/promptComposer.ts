import { MODES } from './modeRegistry';
// Prompt Composer — Converts content into structured slide plans
// Follows RESULT.md spec: content → PlannedSlide[] → compiled prompt

import { PROMPT_GENERATE_DECK } from './prompts'

export interface PlannedSlide {
  index: number
  frame: 'hook' | 'value' | 'transition' | 'call_to_action' | 'visual_only'
  purpose: string
  headlineHint?: string
  layoutHint?: 'split-left' | 'split-right' | 'full-bleed' | 'minimal'
  visualHint?: string
  interactivityHint?: string
  group?: string // optional grouping label (e.g. "Core Concepts", "Visual Examples")
}

export interface SlidePlan {
  goal: string
  audience: string
  tone: string
  slides: PlannedSlide[]
  groups: { label: string; slideIndices: number[] }[]
}

export interface ContentInput {
  source: 'topic' | 'episode' | 'external-chat'
  topic?: string
  topicMode?: 'specific' | 'ai-decides'
  episodeTitle?: string
  episodeFrames?: any[]
  externalChat?: string
  slideCount: number
  mode: string
  customGroups?: { label: string; count: number }[]
}

// Build a structured slide plan from content input
export function buildSlidePlan(input: ContentInput): SlidePlan {
  const { source, slideCount, customGroups } = input

  // If custom groups are provided, use them
  if (customGroups && customGroups.length > 0) {
    return buildCustomGroupPlan(input)
  }

  // Otherwise, auto-generate plan based on source type
  if (source === 'episode' && input.episodeFrames) {
    return buildEpisodePlan(input)
  }
  if (source === 'external-chat' && input.externalChat) {
    return buildChatPlan(input)
  }
  return buildTopicPlan(input)
}

function buildTopicPlan(input: ContentInput): SlidePlan {
  const { topic, topicMode, slideCount, mode } = input
  const isCreative = topicMode === 'ai-decides'

  const slides: PlannedSlide[] = []

  // Hook slide
  slides.push({
    index: 0,
    frame: 'hook',
    purpose: 'Attention-grabbing headline that states the core topic',
    headlineHint: isCreative ? undefined : topic?.split(' ').slice(0, 4).join(' '),
    layoutHint: 'full-bleed',
    group: 'Opening',
  })

  // Middle slides — distribute based on slide count
  const middleCount = slideCount - 2 // minus hook and CTA
  for (let i = 0; i < middleCount; i++) {
    const progress = (i + 1) / (middleCount + 1)
    let frame: PlannedSlide['frame'] = 'value'
    let purpose = ''
    let layoutHint: PlannedSlide['layoutHint'] = 'split-left'

    if (progress < 0.3) {
      purpose = `Introduce the first key concept of ${topic}`
      layoutHint = 'split-left'
    } else if (progress < 0.6) {
      frame = 'value'
      purpose = `Deep dive into a core mechanism or component`
      layoutHint = i % 2 === 0 ? 'split-right' : 'split-left'
    } else if (progress < 0.85) {
      frame = 'visual_only'
      purpose = `Visual demonstration — diagram, chart, or code example`
      layoutHint = 'full-bleed'
    } else {
      frame = 'transition'
      purpose = `Bridge to the conclusion`
      layoutHint = 'minimal'
    }

    slides.push({
      index: i + 1,
      frame,
      purpose,
      layoutHint,
      visualHint: frame === 'visual_only' ? `Diagram or chart illustrating ${topic}` : undefined,
      interactivityHint: frame === 'value' && i % 3 === 0 ? 'step-through or hover-reveal' : undefined,
      group: i < middleCount * 0.4 ? 'Core Concepts' : i < middleCount * 0.8 ? 'Visual Examples' : 'Summary',
    })
  }

  // CTA slide
  slides.push({
    index: slideCount - 1,
    frame: 'call_to_action',
    purpose: 'Key takeaway and call to action',
    layoutHint: 'full-bleed',
    group: 'Conclusion',
  })

  return buildGroups(slides, input)
}

function buildEpisodePlan(input: ContentInput): SlidePlan {
  const { episodeFrames, episodeTitle, slideCount } = input

  const slides: PlannedSlide[] = []

  if (episodeFrames && episodeFrames.length > 0) {
    // Use actual script frames
    const framesToUse = episodeFrames.slice(0, slideCount)
    for (let i = 0; i < framesToUse.length; i++) {
      const f = framesToUse[i]
      slides.push({
        index: i,
        frame: f.frame_type || 'value',
        purpose: f.text || '',
        headlineHint: f.text?.split(' ').slice(0, 5).join(' '),
        layoutHint: f.frame_type === 'hook' ? 'full-bleed' : f.frame_type === 'visual_only' ? 'full-bleed' : 'split-left',
        visualHint: f.visual,
        group: f.frame_type === 'hook' ? 'Opening' : f.frame_type === 'call_to_action' ? 'Conclusion' : 'Content',
      })
    }
  } else {
    // Fallback: generate placeholder plan
    return buildTopicPlan({ ...input, source: 'topic', topic: episodeTitle || 'Episode Content' })
  }

  return buildGroups(slides, input)
}

function buildChatPlan(input: ContentInput): SlidePlan {
  const { externalChat, slideCount } = input

  // For external chat, we create a plan that tells the AI to extract key insights
  const slides: PlannedSlide[] = []

  slides.push({
    index: 0,
    frame: 'hook',
    purpose: 'Extract the main topic/question from the discussion and present it as a bold headline',
    layoutHint: 'full-bleed',
    group: 'Discussion Overview',
  })

  const middleCount = slideCount - 2
  for (let i = 0; i < middleCount; i++) {
    const progress = (i + 1) / (middleCount + 1)
    slides.push({
      index: i + 1,
      frame: progress < 0.7 ? 'value' : 'visual_only',
      purpose: progress < 0.7
        ? `Extract a key insight or explanation from the discussion`
        : `Create a visual diagram summarizing a concept from the chat`,
      layoutHint: progress < 0.7 ? (i % 2 === 0 ? 'split-left' : 'split-right') : 'full-bleed',
      visualHint: progress >= 0.7 ? 'Diagram, chart, or visual summary of discussed concepts' : undefined,
      interactivityHint: i % 4 === 0 ? 'hover-reveal or step-through' : undefined,
      group: i < middleCount * 0.5 ? 'Key Insights' : 'Visual Summaries',
    })
  }

  slides.push({
    index: slideCount - 1,
    frame: 'call_to_action',
    purpose: 'Synthesize the main takeaways from the discussion',
    layoutHint: 'full-bleed',
    group: 'Conclusion',
  })

  return buildGroups(slides, input)
}

function buildCustomGroupPlan(input: ContentInput): SlidePlan {
  const { customGroups, source, topic, episodeTitle } = input
  const slides: PlannedSlide[] = []
  let index = 0

  for (const group of customGroups!) {
    for (let i = 0; i < group.count; i++) {
      const isFirst = index === 0
      const isLast = index === (customGroups!.reduce((s, g) => s + g.count, 0) - 1)

      slides.push({
        index,
        frame: isFirst ? 'hook' : isLast ? 'call_to_action' : 'value',
        purpose: `${group.label} — slide ${i + 1} of ${group.count}`,
        layoutHint: i % 2 === 0 ? 'split-left' : 'split-right',
        group: group.label,
      })
      index++
    }
  }

  return {
    goal: topic || episodeTitle || 'Presentation',
    audience: 'General audience',
    tone: 'educational',
    slides,
    groups: customGroups!.map((g, i) => ({
      label: g.label,
      slideIndices: Array.from({ length: g.count }, (_, j) => {
        let idx = 0
        for (let k = 0; k < i; k++) idx += customGroups![k].count
        return idx + j
      }),
    })),
  }
}

function buildGroups(slides: PlannedSlide[], input: ContentInput): SlidePlan {
  const groupMap = new Map<string, number[]>()
  for (const s of slides) {
    const g = s.group || 'Content'
    if (!groupMap.has(g)) groupMap.set(g, [])
    groupMap.get(g)!.push(s.index)
  }

  return {
    goal: input.topic || input.episodeTitle || 'Presentation',
    audience: 'General audience',
    tone: input.mode === 'youtube_shorts' ? 'punchy' : input.mode === 'pitch' ? 'persuasive' : 'educational',
    slides,
    groups: Array.from(groupMap.entries()).map(([label, indices]) => ({ label, slideIndices: indices })),
  }
}

// ═══════════════════════════════════════════════════════════════
// External Chat — Topic Extraction & Prompt Generation
// ═══════════════════════════════════════════════════════════════

export interface ExtractedTopic {
  title: string
  description: string
  concepts: string[]
  source: 'question' | 'explanation' | 'code' | 'example' | 'concept'
}

// Parse external chat text and extract key topics, themes, concepts
export function extractChatTopics(chatText: string): ExtractedTopic[] {
  const topics: ExtractedTopic[] = []
  const seen = new Set<string>()

  // Normalize lines
  const lines = chatText.split('\n').map(l => l.trim()).filter(Boolean)

  // Pattern 1: Lines starting with question marks or "how/what/why/when/where/which"
  for (const line of lines) {
    const qMatch = line.match(/^(?:[\w\s]*:\s*)?(?:how|what|why|when|where|which|can|could|should|is|are|do|does)\s+(.+)/i)
    if (qMatch && qMatch[1].length > 10 && qMatch[1].length < 200) {
      const key = qMatch[1].toLowerCase().slice(0, 50)
      if (!seen.has(key)) {
        seen.add(key)
        topics.push({
          title: qMatch[1].slice(0, 80),
          description: qMatch[1],
          concepts: extractConceptsFromLine(qMatch[1]),
          source: 'question',
        })
      }
    }
  }

  // Pattern 2: Lines with technical terms (capitalized words, code-like patterns)
  const techPattern = /\b(?:API|SDK|function|class|method|algorithm|protocol|framework|library|module|component|interface|pattern|architecture|system|engine|pipeline|database|server|client|render|compile|deploy|optimize|debug|test|refactor)\b/gi
  for (const line of lines) {
    const matches = line.match(techPattern)
    if (matches && line.length > 20 && line.length < 300) {
      const key = line.toLowerCase().slice(0, 60)
      if (!seen.has(key) && topics.length < 20) {
        seen.add(key)
        topics.push({
          title: line.slice(0, 80),
          description: line,
          concepts: [...new Set(matches.map(m => m.toLowerCase()))],
          source: 'concept',
        })
      }
    }
  }

  // Pattern 3: Code blocks or inline code references
  const codePattern = /`([^`]+)`/g
  let codeMatch
  const codeTerms = new Set<string>()
  while ((codeMatch = codePattern.exec(chatText)) !== null) {
    const term = codeMatch[1].trim()
    if (term.length > 2 && term.length < 60) codeTerms.add(term)
  }
  if (codeTerms.size > 0) {
    topics.push({
      title: 'Code & Implementation',
      description: `Key code concepts discussed: ${[...codeTerms].slice(0, 8).join(', ')}`,
      concepts: [...codeTerms].slice(0, 10),
      source: 'code',
    })
  }

  // Pattern 4: Look for "for example" / "such as" / "like" patterns (examples)
  for (const line of lines) {
    const exMatch = line.match(/(?:for example|such as|like|e\.g\.|including)\s+(.+)/i)
    if (exMatch && exMatch[1].length > 10 && exMatch[1].length < 200) {
      const key = exMatch[1].toLowerCase().slice(0, 50)
      if (!seen.has(key) && topics.length < 20) {
        seen.add(key)
        topics.push({
          title: exMatch[1].slice(0, 80),
          description: exMatch[1],
          concepts: extractConceptsFromLine(exMatch[1]),
          source: 'example',
        })
      }
    }
  }

  // Pattern 5: Lines that look like explanations (contain "is" / "means" / "refers to" / "involves")
  for (const line of lines) {
    const expMatch = line.match(/^(.+?)\s+(?:is|means|refers to|involves|requires|uses)\s+(.+)/i)
    if (expMatch && expMatch[1].length > 3 && expMatch[2].length > 10) {
      const key = expMatch[1].toLowerCase().slice(0, 50)
      if (!seen.has(key) && topics.length < 20) {
        seen.add(key)
        topics.push({
          title: expMatch[1].trim(),
          description: `${expMatch[1].trim()} — ${expMatch[2].trim()}`,
          concepts: extractConceptsFromLine(expMatch[1] + ' ' + expMatch[2]),
          source: 'explanation',
        })
      }
    }
  }

  // Deduplicate by concept overlap
  const deduped: ExtractedTopic[] = []
  const usedConcepts = new Set<string>()
  for (const topic of topics) {
    const overlap = topic.concepts.filter(c => usedConcepts.has(c)).length
    if (overlap < topic.concepts.length * 0.5 || deduped.length < 3) {
      deduped.push(topic)
      topic.concepts.forEach(c => usedConcepts.add(c))
    }
  }

  // Limit to top 10 most distinct topics
  return deduped.slice(0, 10)
}

function extractConceptsFromLine(text: string): string[] {
  const words = text.split(/[\s,;:.!?]+/)
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'against', 'up', 'down', 'out', 'off', 'over', 'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their'])
  const concepts: string[] = []
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase()
    if (clean.length > 2 && !stopWords.has(clean)) concepts.push(clean)
  }
  return [...new Set(concepts)].slice(0, 8)
}

// Generate a compact, copy-ready prompt for external AI that creates slides from extracted topics
export function compileExternalChatPrompt(
  topics: ExtractedTopic[],
  chatText: string,
  theme: any,
  mode: string,
  slideCount: number,
): string {
  const modeInfo = MODES[mode] || MODES.educational
  const topicList = topics.map((t, i) =>
    `${i + 1}. **${t.title}**\n   ${t.description}\n   Key concepts: ${t.concepts.join(', ')}`
  ).join('\n\n')

  const chatSummary = chatText.length > 800
    ? chatText.slice(0, 400) + '\n...\n' + chatText.slice(-400)
    : chatText

  return `You are a Principal Frontend Architect & Motion Designer at Vercel/Framer. Generate ONE self-contained HTML file that renders EXACTLY ONE slide. The SlidePlan describes the whole deck for context, but ONLY the CURRENT slide is rendered.

═══════════════════════════════════════════════
TOPICS TO COVER (extracted from an AI discussion):
═══════════════════════════════════════════════

${topicList}

═══════════════════════════════════════════════
SOURCE DISCUSSION (for context — derive slide content from this):
═══════════════════════════════════════════════

${chatSummary}

═══════════════════════════════════════════════
GENERATION RULES
═══════════════════════════════════════════════

- The deck contains ${slideCount} slides covering the ${topics.length} topics above (the host issues one generation request per slide).
- Each topic gets ${Math.max(1, Math.floor(slideCount / topics.length))} slide(s) of coverage across the deck.
- YOU render ONLY the CURRENT slide. Do NOT output all ${slideCount} slides in one document.
- Style: ${modeInfo.label} — ${modeInfo.promptPreset}
- All content MUST be derived from the SOURCE DISCUSSION above.
- Output ONLY valid raw HTML. No markdown fences, no explanations.

═══════════════════════════════════════════════
THEME (use CSS variables):
═══════════════════════════════════════════════

:root {
  --bg: ${theme.bg}; --surface: ${theme.surface}; --border: ${theme.border};
  --fg: ${theme.fg}; --muted: ${theme.muted};
  --accent: ${theme.accent}; --accent-2: ${theme.accent2}; --warning: ${theme.warning};
  --accent-glow: ${theme.accentGlow};
  --font-header: ${theme.fontHeader}; --font-body: ${theme.fontBody}; --font-mono: ${theme.fontMono};
}

═══════════════════════════════════════════════
DESIGN TOKENS
═══════════════════════════════════════════════

- Canvas: responsive viewport; verify 1080×1920 (9:16), 1080×1080 (1:1), and 1080×960 (9:8). Do not permanently lock body to 1080×960.
- Typography: display 48px/600, h1 32px/600, h2 24px/500, body 16px/400, caption 13px/400, overline 10px/600 uppercase.
- Spacing: 8px grid. Card padding 32px. Section margins 24–48px.
- Radius: badges 8px, buttons 12px, cards 24px max.
- Components: glass-card, btn, badge, tabs, code block, icon grid, data table, chart, diagram, progress ring.
- Micro-interactions: blurInUp stagger, mouse glow on key cards, number tickers, gradient text (ONE per deck max).
- The HOST application owns all navigation (prev/next buttons, arrow keys, slide counter, dots). Your output is ONE standalone slide with NO deck navigation.
- NO native <select>, NO <input type="range">, NO emoji icons, NO lorem ipsum.
- Google Fonts only as external resource. Zero other dependencies.

═══════════════════════════════════════════════
VISUAL GROUNDING — ONE visual per slide occupying 50–70% of viewport:
═══════════════════════════════════════════════

metric/KPI → hero-number · code/API → code-block · process/pipeline → diagram · trend/comparison → chart · before/after → comparison · chronological → timeline · algorithm/stages → step-through · percentage → progress-ring · feature list → icon-grid · specs → data-table · expert statement → quote

═══════════════════════════════════════════════
SLIDE STRUCTURE (ONE slide only)
═════════════════════════════════════════════════

This prompt produces a SINGLE slide. Frame types map to composition, not to deck sections:
Hook slides: bold headline + gradient text + badge.
Value slides: split grid 1.5fr/1fr alternating copy + integrated widget.
Visual-only slides: full-bleed diagram/chart + minimal overlay caption.
CTA slides: key takeaway + recap chips + action button.
Transition slides: one muted phrase centered.

The host application generates slides independently (one invocation per slide) and stores each as its own artifact. There is NO <main class="deck">, NO <nav>, NO <section class="slide"> deck, NO slide counter, NO show(i)/ArrowLeft/ArrowRight logic in your output.

═════════════════════════════════════════════════
OUTPUT FORMAT (ONE self-contained slide)
═════════════════════════════════════════════════

<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>…</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"><style>/* responsive tokens, resets, components, micro-interactions */</style></head><body><div class="slide-stage"><!-- ONE slide only: the current slide's content --></div></body></html>

Output ONLY the raw HTML. No markdown fences. No explanation. No commentary.`
}

// ─── Shared content-block builder ───
// Builds the SlidePlan→text block used by BOTH the per-slide prompt and the
// deck prompt. The deck prompt omits {{CURRENT_SLIDE}} because it emits all
// slides in one document.
// `ratio` is the numeric width/height target the user can drag (e.g. 0.5625 = 9:16,
// 1.0 = 1:1, 1.125 = 9:8). Kept numeric so the slider is free, not 3 fixed stops.
function ratioCloseTo(r: number, target: number, eps = 0.02): boolean {
  return Math.abs(r - target) <= eps
}

function buildContentBlock(plan: SlidePlan, theme: any, ratio: number = 9 / 16): string {
  const slideDescriptions = plan.slides.map(s =>
    `Slide ${s.index + 1} [${s.frame}] — Group: "${s.group || 'Content'}"\n  Purpose: ${s.purpose}\n  ${s.headlineHint ? `Headline: "${s.headlineHint}"` : ''}\n  Layout: ${s.layoutHint || 'split-left'}\n  ${s.visualHint ? `Visual: ${s.visualHint}` : ''}\n  ${s.interactivityHint ? `Interactivity: ${s.interactivityHint}` : ''}`
  ).join('\n\n')

  const groupSummary = plan.groups.map(g =>
    `• "${g.label}" → Slides ${g.slideIndices.map(i => i + 1).join(', ')}`
  ).join('\n')

  // Human-readable ratio label (e.g. "9:16") only for the canonical snaps.
  const ratioLabel = ratioCloseTo(ratio, 9 / 16) ? '9:16' : ratioCloseTo(ratio, 1) ? '1:1' : ratioCloseTo(ratio, 9 / 8) ? '9:8' : `${Math.round(ratio * 100) / 100}`
  const w = Math.round(1080 * ratio)
  const h = 1080

  // Build the actual theme CSS block with real hex values
  const themeBlock = theme ? `
:root {
  --bg: ${theme.bg || '#0A0A0B'}; --surface: ${theme.surface || 'rgba(255,255,255,0.03)'}; --border: ${theme.border || 'rgba(255,255,255,0.08)'};
  --fg: ${theme.fg || '#FAFAFA'}; --muted: ${theme.muted || '#8B8B8B'};
  --accent: ${theme.accent || '#10b981'}; --accent-2: ${theme.accent2 || '#a855f7'}; --warning: ${theme.warning || '#f59e0b'};
  --accent-glow: ${theme.accentGlow || 'rgba(16,185,129,0.15)'};
  --font-header: ${theme.fontHeader || 'Inter'}; --font-body: ${theme.fontBody || 'Inter'}; --font-mono: ${theme.fontMono || 'JetBrains Mono'};
}` : ''

  return `Goal: ${plan.goal}\nAudience: ${plan.audience}\nTone: ${plan.tone}\n\n` +
    `TARGET ASPECT RATIO: ${ratioLabel} (${w}×${h}, numeric ratio ${Math.round(ratio * 1000) / 1000})\n` +
    `Compose primarily for this target ratio. The selected ratio is a composition target, not a crop setting. Reflow major layout with responsive CSS and keep headings, equations, diagrams, callouts, and controls readable. Also verify the same document at 9:16 (1080x1920), 1:1 (1080x1080), and 9:8 (1080x960).\n\n` +
    `THEME — USE THESE EXACT COLORS:\n${themeBlock}\n\n` +
    `CRITICAL CONTRAST RULES:\n` +
    `- ALL text MUST be clearly visible against its background\n` +
    `- Body text: use --fg color on --bg or --surface backgrounds\n` +
    `- Headings: use --fg or --accent color, NEVER use --muted on dark backgrounds\n` +
    `- Captions/subtitles: use --muted ONLY on light surfaces (opacity sufficient), otherwise use --fg at reduced size\n` +
    `- NEVER place text with the same color family as its background (e.g. dark text on dark bg, light on light)\n` +
    `- Every text element must pass WCAG AA contrast (4.5:1 minimum)\n` +
    `- Before emitting any text, verify: "Can I read this clearly from 3 feet away?"\n\n` +
    `SLIDE PLAN (${plan.slides.length} slides):\n\n${slideDescriptions}\n\n` +
    `CONTENT FIDELITY — NON-NEGOTIABLE:\n` +
    `The supplied slide-by-slide content is the authoritative source of truth.\n` +
    `Do NOT invent, expand, reinterpret, replace, reorder, or omit the conceptual content specified for any slide.\n` +
    `Do NOT decide independently what information belongs on a slide.\n` +
    `For every slide:\n` +
    `1. Preserve the exact intended concept.\n` +
    `2. Preserve all required equations, relationships, terminology, and claims.\n` +
    `3. Preserve the intended visual demonstration.\n` +
    `4. You may improve visual hierarchy, spacing, typography, animation, and responsive layout.\n` +
    `5. You may NOT introduce new technical concepts or teaching points that are not present in the supplied content.\n` +
    `6. You may NOT remove required content merely because it is difficult to fit.\n` +
    `7. If content must be adapted for a different aspect ratio, change ONLY its spatial arrangement, never its meaning.\n` +
    `The model's job is to DESIGN and IMPLEMENT the supplied content, not to AUTHOR or reinterpret it. CONTENT > DESIGN FREEDOM. When visual creativity conflicts with supplied content, supplied content wins.\n\n` +
    `GROUPS:\n${groupSummary}\n\n` +
    `Follow the slide plan exactly. Each slide must match its frame type, purpose, and layout hint. USE THE THEME COLORS ABOVE — every element must use the CSS variables from the :root block.`
}

// Compile a slide plan into the per-slide final prompt text (one invocation = one slide)
export function compilePrompt(plan: SlidePlan, systemPrompt: string, theme: any, ratio: number = 9 / 16, currentSlide: number = 1): string {
  const contentBlock = buildContentBlock(plan, theme, ratio)
  return systemPrompt
    .replace('{{CONTENT}}', contentBlock)
    .replace('{{SLIDE_COUNT}}', String(plan.slides.length))
    .replace('{{CURRENT_SLIDE}}', String(currentSlide))
    .replace('{{MODE}}', `Structured — ${plan.slides.length} slides in ${plan.groups.length} groups`)
}

// Compile a slide plan into the DECK prompt text (one invocation = whole deck).
// Does NOT fill {{CURRENT_SLIDE}} — the deck prompt contains no such placeholder;
// the model renders ALL planned slides as <article data-slide="N"> blocks.
export function compileDeckPrompt(plan: SlidePlan, theme: any, ratio: number = 9 / 16): string {
  const contentBlock = buildContentBlock(plan, theme, ratio)
  return PROMPT_GENERATE_DECK
    .replace('{{CONTENT}}', contentBlock)
    .replace('{{SLIDE_COUNT}}', String(plan.slides.length))
    .replace('{{MODE}}', `Structured deck — ${plan.slides.length} slides in ${plan.groups.length} groups`)
}
