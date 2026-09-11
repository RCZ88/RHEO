import { getSystemPromptForSlug, getCoachingNoteForSlug } from './topicPrompts';
import { CURRICULUM_TOPICS } from './curriculum';
import type { CurriculumTopic } from './curriculum';
import type { LearnerProfile, MasteryLevel, KnowledgeEntry } from '../../shared/learn/types';

// ── Prompt library types ──

export interface PromptLibrary {
  format: string;           // author-guide.md
  capabilities: string;     // capabilities-manifest.md
  style: string;            // master-prompt.md
  persona: string;          // coach-persona.md
  guardrails: string;       // guardrails.md
  visualGrounding: string;  // visual-grounding.md
  pedagogy: string;         // pedagogy.md
}

export interface PromptRecipe {
  name: string;
  slug: string;
  description: string;
  build: (topic?: string, userInput?: string) => { system: string; user: string };
}

// ── L0-L5 mastery ladder (§3.1) ──

const MASTERY_LADDER = [
  'L0 (Novice): No exposure — never heard of it.',
  'L1 (Aware): Heard the term, can define it at dictionary level.',
  'L2 (Apprentice): Can follow a recipe / reproduce with guidance.',
  'L3 (Practitioner): Can apply independently in familiar contexts.',
  'L4 (Proficient): Deep understanding; can teach it, tune it, combine it.',
  'L5 (Expert): Can innovate, extend the framework, publish new results.',
].join('\n');

// ── Segmentation procedure (§3.2) embedded in user prompt ──

const SEGMENTATION_INSTRUCTION = [
  '## Learner Segmentation Procedure',
  'Assess the learner against each checklist item using the L0-L5 ladder above.',
  '',
  'For each item, produce a 4-part assessment:',
  '1. **Demonstrated** — what the learner already shows at this level.',
  '2. **Gaps** — what is missing or fragile.',
  '3. **Verdict** — which level (L0-L5) this item lands at.',
  '4. **Next step** — a single actionable recommendation to advance one level.',
  '',
  'Then group adjacent items by level proximity into segments.',
  'Output ONE `::assess` block per segment group:',
  '',
  '```lmd',
  '::assess',
  'level: "L0-L2"',
  'title: "Novice → Apprentice"',
  'demonstrated:',
  '  - can define the term',
  'gaps:',
  '  - cannot apply independently',
  'verdict: "L1 (Aware)"',
  'next_step: "Work through guided exercises in sections 2-3"',
  '::',
  '```',
  '',
  'Order segments from lowest to highest level.',
  'Do NOT make up progress the learner has not shown.',
  'If evidence is insufficient, flag it in gaps and ask for more.',
].join('\n');

// ── Learner Profile → authoring directives ──

export function composeLearnerProfileBlock(p: LearnerProfile): string {
  const lines: string[] = ['## Learner Profile (authoring directives — obey unless Guardrails conflict)'];

  lines.push({
    terse: '- DENSITY: Terse. Lead with the diagram or worked example; move supporting prose into `::: layer` blocks. Short paragraphs.',
    balanced: '- DENSITY: Balanced prose and visuals.',
    thorough: '- DENSITY: Thorough. Full explanations welcome; still chunk with headings.',
  }[p.density]);

  lines.push({
    diagram_first: '- MODALITY: Diagram-first. Emit a mermaid/figure BEFORE the prose for each concept. Never drop the math — place heavier derivations in a `::: layer`.',
    balanced: '- MODALITY: Balance figures and prose.',
    text_ok: '- MODALITY: Prose-forward is fine, but every L2+ node still needs at least one visual per the format rules.',
  }[p.modalityBias]);

  lines.push({
    worked_first: '- EXAMPLES: Worked-example-first. Show a fully worked, runnable example before the abstraction.',
    balanced: '- EXAMPLES: Mix worked examples and guided discovery.',
    discovery_first: '- EXAMPLES: Discovery-first. Pose a "try it" prompt before revealing the solution.',
  }[p.exampleStance]);

  lines.push({
    applied_only: '- MATH: Applied only. State results + when to use them; skip derivations.',
    intuition_first: '- MATH: Intuition first, then put full derivations in an optional `::: layer L4`.',
    derive_everything: '- MATH: Derive from first principles inline with `$$` blocks.',
  }[p.mathDepth]);

  lines.push([
    '- BUILD: No required build project; keep exercises light.',
    '- BUILD: Include one small hands-on exercise.',
    '- BUILD: Center a build-to-learn project the learner ships.',
    '- BUILD: The build-to-learn project is the SPINE of the lesson; theory serves it.',
  ][p.handsOn]);

  lines.push({
    framework_only: '- CODE: Framework-level only (e.g. PyTorch/NumPy high-level APIs).',
    numpy_plus: '- CODE: Show NumPy-level implementation, then the framework equivalent.',
    scratch_first: '- CODE: Build from scratch first (pure Python/loops), then NumPy, then framework.',
  }[p.codeStagingDepth]);

  lines.push({
    light: '- CHECKS: 3–4 quiz items total.',
    normal: '- CHECKS: 5–6 quiz items across the lesson.',
    heavy: '- CHECKS: 6–10 quiz items; test each major node.',
  }[p.quizAppetite]);

  lines.push({
    micro: '- CHUNKING: Micro. Split aggressively into ~10-min nodes.',
    standard: '- CHUNKING: Standard node length.',
    deep: '- CHUNKING: Deep. Fewer, longer nodes are acceptable.',
  }[p.chunkSize]);

  lines.push(`- LAYERS: Author \`::: layer\` content up to ${p.layerRevealDefault}; deeper material stays collapsed until mastery rises.`);

  lines.push({
    gentle: '- TONE: Encouraging and patient.',
    balanced: '- TONE: Warm but direct.',
    demanding: '- TONE: Demanding senior-engineer voice; call out gaps bluntly.',
  }[p.tone]);

  // Dynamic pedagogical adaptation based on learner's native language
  lines.push('');
  lines.push('### Active Pedagogical Tactics (apply these during this lesson)');
  lines.push('- **Known vs. Unknown:** Always bridge from the learner\'s strongest language/framework. Show comparison tables.');
  lines.push('- **Crash First:** Show the WRONG code the learner would write, then the failure, then the fix.');
  lines.push('- **Project Anchor:** Every example must connect to the learner\'s goal project. Never teach in a vacuum.');
  lines.push('- **Practice Gate:** After each concept, the learner must produce a code snippet, prediction, or design decision. If not produced, loop back.');
  lines.push('- **Switch Modalities:** If text fails, use a diagram. If a diagram fails, use an analogy. If an analogy fails, use a minimal code experiment.');
  lines.push('- **No "it\'s simple":** Never dismiss complexity. If they\'re asking, it\'s not simple to them.');

  lines.push('\nNOTE: These change EMPHASIS, DIFFICULTY, ORDER, SCAFFOLDING, and PACING only. Never remove a modality or the required rigor for the topic.');
  return lines.join('\n');
}

// ── Compose system prompt from layers ──

export function loadPromptLibrary(readResource: (rel: string) => string | null): PromptLibrary {
  return {
    format: readResource('author-guide.md') ?? '',
    capabilities: '', // deprecated — author-guide.md is the authoritative format reference
    style: readResource('prompts/master-prompt.md') ?? '',
    persona: readResource('prompts/coach-persona.md') ?? '',
    guardrails: readResource('prompts/guardrails.md') ?? '',
    visualGrounding: readResource('prompts/visual-grounding.md') ?? '',
    pedagogy: readResource('prompts/pedagogy.md') ?? '',
  };
}

export function composeAuthorSystemPrompt(
  lib: PromptLibrary,
  opts?: { part?: number; profile?: LearnerProfile },
): string {
  const parts: string[] = [];

  // 1. Format layer (always first — must win)
  parts.push(`## Format\n${lib.format}`);

  // 2. Style / master prompt
  parts.push(`## Teaching Style\n${lib.style}`);

  // 2b. Visual Grounding — integrated widget authoring guide
  if (lib.visualGrounding) {
    parts.push(`## Visual Grounding\n${lib.visualGrounding}`);
  }

  // 2c. Pedagogical method — adaptive teaching engine
  if (lib.pedagogy) {
    parts.push(`## Pedagogical Method\n${lib.pedagogy}`);
  }

  // 3. Persona — profile block REPLACES the static persona when present
  parts.push(`## Persona\n${opts?.profile ? composeLearnerProfileBlock(opts.profile) : lib.persona}`);

  // 4. Subject — per-topic brief when part is given
  if (opts?.part != null) {
    const curriculum = CURRICULUM_TOPICS[opts.part];
    const slug = curriculum?.slug;
    const subject = slug ? getSystemPromptForSlug(slug) : '';
    if (subject) parts.push(`## Topic Brief\n${subject}`);
  }

  // 4b. Mastery Ladder — embedded so model can assess learner level (§3.1)
  parts.push(`## Learner Level Definitions\n${MASTERY_LADDER}`);

  // 5. Guardrails (always last — can't be overridden)
  parts.push(`## Guardrails\n${lib.guardrails}`);

  return parts.join('\n\n---\n\n');
}

export function composeTopicUserPrompt(part: number, profile?: LearnerProfile): string {
  const curriculum = CURRICULUM_TOPICS[part];
  if (!curriculum) return '';

  const coachingNote = getCoachingNoteForSlug(curriculum.slug) ?? '';
  const target = profile?.priorKnowledge?.[part] ?? curriculum.defaultMasteryTarget;
  const parts = [
    `Topic: ${curriculum.title}`,
    curriculum.intro,
    `\nRequired coverage — the lesson MUST help the learner demonstrate each of these:`,
    ...curriculum.checklist.map((c, i) => `${i + 1}. ${c}`),
    coachingNote ? `\n## Coaching note\n${coachingNote}` : '',
    target !== curriculum.defaultMasteryTarget
      ? `\nCalibrate to the learner's current level for this part: ${target}. Author to move them ONE level beyond it.`
      : '',
    `\n${SEGMENTATION_INSTRUCTION}`,
    `\nOutput as .lmd (lyceum markdown) with "---" frontmatter. Include a "Check Your Understanding" section.`,
  ];
  return parts.filter(Boolean).join('\n');
}

export function composeTutorPersona(lib: PromptLibrary, profile?: LearnerProfile): string {
  const persona = profile ? composeLearnerProfileBlock(profile) : lib.persona;
  return [persona, lib.guardrails].filter(Boolean).join('\n\n---\n\n');
}

/**
 * Single-block prompt for copy-paste into generic AI chat UIs (ChatGPT, Claude, etc.).
 * Combines the fixed teaching rules, the topic section, and the learner profile directives
 * into one block. This is the "manual/portable equivalent" described in SYSTEM_PROMPT_v3_dynamic.md.
 */
export function composeCombinedPrompt(topic: string, profile: LearnerProfile): string {
  const preamble = `# Lyceum Personal Learning System — System Prompt (v3)

You are my personal curriculum author and tutor. You teach in a mastery-learning
style: concepts are broken into nodes, each targeting an explicit mastery level
(L0 Novice → L1 Aware → L2 Apprentice → L3 Practitioner → L4 Proficient → L5
Expert), each grounded (cite what's true, flag common misconceptions), and each
checked with a quiz before moving on.

## How to teach — pick the right visual, don't default to one
- Diagrams (flows, architectures, trees, state machines) → describe/draw them
  clearly (Mermaid-style or ASCII if I can't render images).
- Data/quantitative relationships → a described chart or table, not prose.
- A bespoke illustration or labeled schematic → describe it richly, or produce
  it as inline SVG/diagram code if I can render that.
- Something better taught by *seeing it move* (an algorithm stepping through,
  gradient descent, data flowing) → describe the animation/sequence step by
  step, or produce it as a small interactive HTML snippet if I can run one.
- Plain tables → use real Markdown tables, not prose describing a table.
- Vary your visuals across a lesson — don't make everything the same format.

## Depth and length — this is a full learning journey, not a summary
Do not compress, summarize-and-stop, or hold back for brevity. Teach each
concept as if it were a real chapter: full explanations, worked examples, the
"why" behind every claim, enough scaffolding to go from confusion to competence
without leaving the conversation. Never truncate, never use "..." as a
placeholder, never end early because it's "long enough." Thoroughness is the
goal, not brevity.

## Grounding
Every concept must include: the core claims (stated plainly), at least one
common misconception addressed explicitly, and (when relevant) where this
knowledge comes from. Prefer being precise and citing real sources over sounding
confident with invented ones.

## Personalization: tone and delivery yes, subject-matter scope no
Use my Learner Profile below to shape HOW you teach me — voice, pacing, choice
of examples, how much scaffolding I need. Do NOT use it to limit WHAT you teach:
draw facts, examples, and depth from the full breadth of the subject, not only
from whatever I've mentioned about myself. My background is a lens for
personalization, never a ceiling on the material.

---

## WHAT I WANT TO LEARN
${topic}

---

## MY LEARNER PROFILE (from my onboarding survey — obey unless it conflicts with anything above)
${composeLearnerProfileBlock(profile)}`;

  return preamble;
}

// ── Knowledge Base: relevance selection + prompt injection ──

export interface KnowledgeSelection {
  entries: KnowledgeEntry[];
  relatedParts: CurriculumTopic[];
}

const KNOWLEDGE_TOP_N = 6;

function tokenize(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Select ONLY the knowledge entries relevant to the topic being learned.
 * Scores by: explicit curriculum-part match, keyword overlap, topic-token overlap,
 * statement-token overlap. Never returns everything — unrelated knowledge is
 * deliberately excluded to avoid wasting context/tokens.
 */
export function selectKnowledgeForTopic(
  profile: LearnerProfile | null | undefined,
  opts: { part?: number; topic?: string } = {},
): KnowledgeSelection {
  const entries = profile?.knowledgeBase ?? [];
  const relatedParts: CurriculumTopic[] = [];

  if (!entries.length && !profile?.priorKnowledge) return { entries: [], relatedParts };

  const topicTokens = new Set(tokenize(opts.topic ?? ''));
  const targetPartMeta = opts.part != null
    ? CURRICULUM_TOPICS.find((p) => p.part === opts.part)
    : undefined;
  const targetTokens = new Set(tokenize(targetPartMeta?.title ?? ''));

  const scored = entries
    .map((e) => {
      let score = 0;
      if (opts.part != null && e.partIds?.includes(opts.part)) score += 4;
      const eKw = new Set((e.keywords ?? []).flatMap(tokenize));
      for (const t of topicTokens) if (eKw.has(t)) score += 2;
      const eTopic = tokenize(e.topic ?? '');
      for (const t of eTopic) if (topicTokens.has(t) || targetTokens.has(t)) score += 2;
      const eLinked = (e.linkedLessons ?? []).flatMap(tokenize);
      for (const t of eLinked) if (topicTokens.has(t) || targetTokens.has(t)) score += 2;
      const eStmt = tokenize(e.statement);
      for (const t of eStmt) if (topicTokens.has(t) || targetTokens.has(t)) score += 1;
      return { e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, KNOWLEDGE_TOP_N)
    .map((s) => s.e);

  // Related topics: only surfaced when the learner has NO relevant entries —
  // the user's rule: "if you say none for a topic, only refer to related topics".
  if (scored.length === 0) {
    for (const cp of CURRICULUM_TOPICS) {
      if (cp.part === opts.part) continue;
      const lvl = profile?.priorKnowledge?.[cp.part];
      if (lvl && lvl !== 'L0' && lvl !== 'L1') relatedParts.push(cp);
    }
  }

  return { entries: scored, relatedParts };
}

export function composeKnowledgeContextBlock(k: KnowledgeSelection): string {
  const lines: string[] = ["## Learner's Existing Knowledge (build on these; verify — never invent)"];
  if (k.entries.length) {
    lines.push('The learner has recorded these knowledge items that RELATE to this topic. Treat them as already-known foundation, reuse their concepts, and connect new material to them:');
    k.entries.forEach((e, i) => {
      const tags = [
        e.level ? `level ${e.level}` : '',
        e.topic ? `topic "${e.topic}"` : '',
      ].filter(Boolean).join(', ');
      lines.push(`${i + 1}. ${e.statement}${tags ? ` (${tags})` : ''}`);
    });
  } else {
    lines.push('The learner has NO recorded knowledge relevant to this topic. Do not assume any prior knowledge here; teach from first principles.');
    if (k.relatedParts.length) {
      const parts = k.relatedParts.map((p) => `${p.emoji} ${p.title}`).join('; ');
      lines.push(`\nRelated topics the learner already knows (reference ONLY as bridges to those domains — do not assume their content): ${parts}`);
    }
  }
  return lines.join('\n');
}

const recipes: PromptRecipe[] = [
  {
    name: 'Generate Lesson',
    slug: 'generate-lesson',
    description: 'Create a new .lmd lesson for a curriculum topic, coached for the learner\u2019s profile.',
    build: (topic?: string) => {
      const masterPrompt = topic ? getSystemPromptForSlug(topic) : '';
      const coachingNote = topic ? getCoachingNoteForSlug(topic) : '';
      return {
        system: `You are a curriculum authoring AI. Your output is always raw .lmd format — never JSON, never wrapped in fences. Start with "---" frontmatter.

Topic: ${topic ?? 'General'}
${masterPrompt ? `\n\n## Master prompt\n${masterPrompt}` : ''}
${coachingNote ? `\n\n## Coaching note\n${coachingNote}` : ''}

Output ONLY the .lmd lesson content. No commentary, no code fences, no JSON wrapper.`,
        user: `Create a ${topic ?? 'general'} lesson in .lmd format. Write for a self-taught engineer with strong math fundamentals who ships Electron/React apps. Include a "Check Your Understanding" section with multiple-choice questions.`,
      };
    },
  },
  {
    name: 'Test Knowledge',
    slug: 'test-knowledge',
    description: 'Generate a quiz or knowledge check for a specific curriculum part.',
    build: (topic?: string) => ({
      system: `You generate .lmd-formatted knowledge checks. Output ONLY raw .lmd starting with "---".${topic ? `\nTopic: ${topic}` : ''}`,
      user: `Generate a knowledge check quiz for ${topic ?? 'the given topic'}. Include: 3 multiple-choice, 1 short-answer, 1 code-reading. Output in .lmd format.`,
    }),
  },
  {
    name: 'Coach Response',
    slug: 'coach-response',
    description: 'Respond to a learner question with Socratic coaching.',
    build: (topic?: string, userInput?: string) => ({
      system: `You are a Socratic coach. Never give direct answers — guide the learner to discover the answer themselves.

Role: Senior AI/ML engineer mentoring a self-taught coder with strong math fundamentals.
Tone: Warm, direct, a little amused. Like a senior dev over coffee.
Method: Ask a clarifying question first, then offer a scaffold. If they\u2019re close, say so and nudge. If they\u2019re wrong, show the contradiction gently.

Know when to break character: if they are stuck after 3 exchanges, explain directly. The goal is learning, not gamesmanship.`,
      user: `The learner asked: ${userInput ?? '[no question provided]'}\n\n${topic ? `Context: studying "${topic}".` : ''}\n\nCoach them Socratically. Output in .lmd format.`,
    }),
  },
  {
    name: 'Generate Check Your Understanding',
    slug: 'generate-cyu',
    description: 'Add a "Check Your Understanding" block to an existing lesson.',
    build: (topic?: string, userInput?: string) => ({
      system: `You generate "Check Your Understanding" blocks in .lmd format.

Include:
- 2-3 multiple-choice questions with 4 options each and correct answer indicated
- 1 open-ended reflection question
- An answer key at the bottom

Output ONLY raw .lmd starting with "---". Never JSON, never fenced.`,
      user: `Generate a CYU block for this lesson:\n\n"""\n${userInput ?? 'No lesson content provided.'}\n"""\n\n${topic ? `\nTopic: ${topic}` : ''}`,
    }),
  },
];

const recipeIndex = new Map<string, PromptRecipe>();
recipes.forEach((r) => {
  recipeIndex.set(r.slug, r);
  recipeIndex.set(r.name.toLowerCase(), r);
});

export function getRecipe(slugOrName: string): PromptRecipe | undefined {
  return recipeIndex.get(slugOrName.toLowerCase());
}

export function buildPrompt(
  recipeSlug: string,
  topic?: string,
  userInput?: string,
): { system: string; user: string } | null {
  const recipe = getRecipe(recipeSlug);
  if (!recipe) return null;
  return recipe.build(topic, userInput);
}

export function listRecipes(): Omit<PromptRecipe, 'build'>[] {
  return recipes.map(({ build: _, ...rest }) => rest);
}
