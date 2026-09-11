// Shared types for the Lyceum "Learn" module — used by both main and renderer

export type MasteryLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** Human-readable labels for mastery levels — use these in UI instead of raw L0-L5 codes */
export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  L0: 'Beginner',
  L1: 'Aware',
  L2: 'Apprentice',
  L3: 'Practitioner',
  L4: 'Proficient',
  L5: 'Expert',
};

/** Short labels for tight UI spaces */
export const MASTERY_SHORT: Record<MasteryLevel, string> = {
  L0: 'New',
  L1: 'Heard of it',
  L2: 'Can do it',
  L3: 'Independent',
  L4: 'Deep knowledge',
  L5: 'Can teach it',
};
export type BlockType = 'prose' | 'math' | 'mermaid' | 'code' | 'image' | 'video' | 'widget' | 'quiz' | 'callout' | 'layer' | 'chart' | 'table' | 'flow' | 'finchart' | 'svg' | 'html' | 'figure' | 'tutor' | 'proposal' | 'conversation' | 'notes'
  | 'viz_heatmap' | 'viz_graph' | 'viz_timeline' | 'viz_concept_map'
  | 'flashcard' | 'flashcard_occlusion' | 'layer_reveal' | 'whiteboard'
  | 'illustration'
  | 'animation' | 'video_asset'
  | 'annotated-code' | 'annotated-math';
export type QuizFormat = 'mcq' | 'numeric' | 'open';
export type LessonStatus = 'draft' | 'valid' | 'published';
export type EvidenceSource = 'tutor' | 'quiz' | 'self-report';
export type EvidenceOutcome = 'demonstrated' | 'partial' | 'wrong';
export type NodeType = 'lesson' | 'node';

export interface LdocDocument {
  doc: 'ldoc/1.0';
  lesson: LdocLesson;
  nodes: LdocNode[];
}

export interface LdocLesson {
  id: string;
  title: string;
  part: number;
  version: string;
  summary?: string;
  chapter?: string;
  branch_id?: string;
  subtopic?: string;
  authored_by?: 'human' | 'ai' | 'hybrid';
}

export interface LdocNode {
  id: string;
  title: string;
  mastery_target: MasteryLevel;
  prereq?: string[];
  content_hash?: string;
  blocks: LdocBlock[];
  grounding: LdocGrounding;
}

export type LdocBlock =
  | ProseBlock
  | MathBlock
  | MermaidBlock
  | CodeBlock
  | ImageBlock
  | VideoBlock
  | WidgetBlock
  | QuizBlock
  | CalloutBlock
  | LayerBlock
  | ChartBlock
  | TableBlock
  | FlowBlock
  | FinChartBlock
  | SvgBlock
  | HtmlBlock
  | FigureBlock
  | TutorBlock
  | ProposalBlock
  | ConversationBlock
  | NotesBlock
  | VizHeatmapBlock
  | VizGraphBlock
  | VizTimelineBlock
  | VizConceptMapBlock
  | FlashcardBlockType
  | LayerRevealBlockType
  | WhiteboardBlockType
  | IllustrationBlockType
  | AnnotatedCodeBlock
  | AnnotatedMathBlock
  | AnimationBlock
  | VideoAssetBlock;

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface ProseBlock extends BaseBlock {
  type: 'prose';
  md: string;
}

export interface MathBlock extends BaseBlock {
  type: 'math';
  tex: string;
  caption?: string;
}

export interface MermaidBlock extends BaseBlock {
  type: 'mermaid';
  src: string;
  caption?: string;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  lang: string;
  src: string;
  runnable?: boolean;
  stage?: 1 | 2 | 3;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt: string;
  source: string;
  license: string;
  caption?: string;
  fallback_url?: string;
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  provider: 'youtube' | 'vimeo' | 'file';
  ref: string;
  source: string;
  license: string;
  caption?: string;
}

export interface WidgetBlock extends BaseBlock {
  type: 'widget';
  kind: 'template' | 'html';
  template?: string;
  params?: Record<string, unknown>;
  html?: string;
  io_contract?: Record<string, unknown>;
  capabilities?: { network?: string[]; storage?: boolean };
  caption?: string;
}

export interface QuizBlock extends BaseBlock {
  type: 'quiz';
  format: QuizFormat;
  q: string;
  options?: string[];
  answer_key?: unknown;
  rubric?: Record<string, string>;
  level: MasteryLevel;
  grounding_ref?: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  md: string;
  icon?: string;
  tone?: string;
}

export interface ChartBlock extends BaseBlock {
  type: 'chart';
  spec: string;
  parsed?: Record<string, unknown>;
  caption?: string;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  columns: { title: string; field: string }[];
  rows: Record<string, unknown>[];
  options?: Record<string, unknown>;
  caption?: string;
}

export interface FlowBlock extends BaseBlock {
  type: 'flow';
  variant: 'sankey' | 'waterfall';
  spec: string;
  edges?: { from: string; to: string; value: number }[];
  caption?: string;
}

export interface FinChartBlock extends BaseBlock {
  type: 'finchart';
  spec: string;
  parsed?: { type?: string; data?: Record<string, unknown>[]; indicators?: string[] };
  caption?: string;
}

export interface LayerBlock extends BaseBlock {
  type: 'layer';
  reveal_at: MasteryLevel;
  mode: 'deeper' | 'remedial';
  blocks: LdocBlock[];
}

export interface SvgBlock extends BaseBlock {
  type: 'svg';
  svg: string;
  caption?: string;
}

export interface HtmlBlock extends BaseBlock {
  type: 'html';
  html: string;
  caption?: string;
}

export interface FigureBlock extends BaseBlock {
  type: 'figure';
  svg: string;
  caption?: string;
}

export interface LdocGrounding {
  must_know: { claim: string; source_id: string }[];
  canonical_answers?: Record<string, string>;
  misconceptions?: { wrong: string; correct: string }[];
  scope: { includes: string; excludes?: string[] };
  rubric_ref?: string;
  escalate_if?: string[];
  sources: { id: string; url: string; title: string; kind?: string; license?: string; retrieved?: string }[];
}

// IPC request/response DTOs

export interface ImportResult {
  lessonId: string;
  nodes: { id: string; title: string }[];
  warnings: ValidationIssue[];
  validation: ValidationReport;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  rule: string;
  nodeId?: string;
  blockId?: string;
  message: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  part: number;
  version: string;
  status: LessonStatus;
  nodeCount: number;
  chapter: string;
  branch_id: string;
  subtopic: string;
  original_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface LessonWithNodes {
  lesson: LdocLesson;
  nodes: RenderableNode[];
}

export interface RenderableNode {
  id: string;
  title: string;
  mastery_target: MasteryLevel;
  prereq?: string[];
  blocks: LdocBlock[];
  grounding: LdocGrounding;
  progress?: NodeProgress;
}

export interface NodeProgress {
  node_id: string;
  level: MasteryLevel;
  stability: number;
  last_seen?: string;
  due_at?: string;
  belief: Record<string, { alpha: number; beta: number }>;
}

export interface TutorAnswer {
  answer_md: string;
  used_source_ids: string[];
  used_fact_ids: string[];
  citations: { id: string; url: string; title: string }[];
  scope: string;
  assessment: { target_level: MasteryLevel; outcome: EvidenceOutcome; rationale: string; suggested_next: string };
  escalated: boolean;
  confidence: number;
}

export interface ProgressMap {
  [nodeId: string]: NodeProgress;
}

export interface NodeRef {
  id: string;
  title: string;
  lesson_id: string;
  due_at: string;
}

export interface GraphData {
  nodes: { id: string; title: string; mastery_target: MasteryLevel; part: number }[];
  edges: { from: string; to: string }[];
}

export interface MediaReport {
  url: string;
  status: number | null;
  ok: boolean;
}

export type Result<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
};

// Mastery estimator types

export interface BetaBelief {
  alpha: number;
  beta: number;
}

export interface BeliefState {
  L0: BetaBelief;
  L1: BetaBelief;
  L2: BetaBelief;
  L3: BetaBelief;
  L4: BetaBelief;
  L5: BetaBelief;
}

export interface Evidence {
  node_id: string;
  ts: string;
  source: EvidenceSource;
  target_level: MasteryLevel;
  outcome: EvidenceOutcome;
  detail?: Record<string, unknown>;
}

// Learner Profile types

export type Density = 'terse' | 'balanced' | 'thorough';
export type ModalityBias = 'diagram_first' | 'balanced' | 'text_ok';
export type ExampleStance = 'worked_first' | 'balanced' | 'discovery_first';
export type MathDepth = 'applied_only' | 'intuition_first' | 'derive_everything';
export type CodeStaging = 'framework_only' | 'numpy_plus' | 'scratch_first';
export type QuizAppetite = 'light' | 'normal' | 'heavy';
export type ChunkSize = 'micro' | 'standard' | 'deep';
export type Tone = 'gentle' | 'balanced' | 'demanding';

export interface KnowledgeEntry {
  id: string;
  statement: string;
  topic?: string;
  partIds?: number[];
  linkedLessons?: string[];
  keywords?: string[];
  level?: MasteryLevel;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerProfile {
  version: 1;
  density: Density;
  modalityBias: ModalityBias;
  exampleStance: ExampleStance;
  mathDepth: MathDepth;
  handsOn: 0 | 1 | 2 | 3;
  codeStagingDepth: CodeStaging;
  quizAppetite: QuizAppetite;
  chunkSize: ChunkSize;
  layerRevealDefault: MasteryLevel;
  tone: Tone;
  priorKnowledge: Partial<Record<number, MasteryLevel>>;
  knowledgeBase: KnowledgeEntry[];
  confidence: Record<string, number>;
  customChapters: string[];
  updatedAt: string;
}

export const PROFILE_KNOBS = [
  'density', 'modalityBias', 'exampleStance', 'mathDepth', 'handsOn',
  'codeStagingDepth', 'quizAppetite', 'chunkSize', 'layerRevealDefault', 'tone',
] as const;
export type ProfileKnob = typeof PROFILE_KNOBS[number];

export const DEFAULT_PROFILE: LearnerProfile = {
  version: 1,
  density: 'balanced', modalityBias: 'balanced', exampleStance: 'balanced',
  mathDepth: 'intuition_first', handsOn: 2, codeStagingDepth: 'numpy_plus',
  quizAppetite: 'normal', chunkSize: 'standard', layerRevealDefault: 'L3',
  tone: 'demanding', priorKnowledge: {},
  knowledgeBase: [],
  confidence: Object.fromEntries(PROFILE_KNOBS.map((k) => [k, 0.3])) as Record<string, number>,
  customChapters: [],
  updatedAt: new Date(0).toISOString(),
};

// ── Tutor V2 Types ──

export type TutorBlockType = 'tutor' | 'proposal' | 'conversation' | 'notes';

export interface TutorBlock extends BaseBlock {
  type: 'tutor';
  question: string;
  answer_md?: string;
  status: 'waiting' | 'streaming' | 'complete' | 'error';
  citations?: { id: string; url: string; title: string }[];
  confidence?: number;
  suggested_next?: string;
}

export interface ProposalBlock extends BaseBlock {
  type: 'proposal';
  title: string;
  body_md: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  actions: string[];
}

export interface ConversationBlock extends BaseBlock {
  type: 'conversation';
  messages: ConversationAction[];
  status: 'active' | 'resolved';
}

export interface NotesBlock extends BaseBlock {
  type: 'notes';
  entries: NoteEntry[];
}

// ── Visualization Block Types ──

export interface VizHeatmapBlock extends BaseBlock {
  type: 'viz_heatmap';
  meta: {
    data_source?: string;
    date_range?: string;
    color_scale?: string;
    cell_size?: number;
    data?: Array<{
      date: string;
      value: number;
      details: { nodesStudied: number; quizzesTaken: number; cardsReviewed: number; masteryGain: number };
    }>;
  };
}

export interface VizGraphBlock extends BaseBlock {
  type: 'viz_graph';
  meta: {
    graph_type?: string;
    layout?: string;
    nodes_source?: string;
    nodes?: Array<{ id: string; label: string; mastery_level?: string; part?: number; type?: string }>;
    edges?: Array<{ id: string; source: string; target: string; label?: string; type?: string }>;
    highlight_mastery?: boolean;
  };
}

export interface VizTimelineBlock extends BaseBlock {
  type: 'viz_timeline';
  meta: {
    node_id?: string;
    lesson_id?: string;
    date_range?: string;
    show_events?: boolean;
    show_target_line?: boolean;
    target_level?: MasteryLevel;
    height?: number;
    events?: Array<{ date: string; type: string; score?: number; description?: string; from_level?: string; to_level?: string }>;
    series?: Array<{ date: string; value: number; target: number }>;
  };
}

export interface VizConceptMapBlock extends BaseBlock {
  type: 'viz_concept_map';
  meta: {
    root: {
      id: string;
      label: string;
      description?: string;
      mastery_target?: string;
      misconception?: string;
      children?: any[];
      collapsed?: boolean;
    };
    max_depth?: number;
    color_by_mastery?: boolean;
    collapsible?: boolean;
    layout?: string;
  };
}

export interface FlashcardBlockType extends BaseBlock {
  type: 'flashcard' | 'flashcard_occlusion';
  meta: {
    deck_id: string;
    card_type: string;
    front: string;
    back: string;
    front_media?: { image?: string };
    back_media?: { image?: string };
    tags?: string[];
    occlusions?: Array<{ x: number; y: number; width: number; height: number; label: string }>;
    due?: string;
    stability?: number;
    difficulty?: number;
    reps?: number;
    lapses?: number;
  };
}

export interface LayerRevealBlockType extends BaseBlock {
  type: 'layer_reveal';
  meta: {
    title: string;
    steps: Array<{ id: string; label: string; content: string; hint?: string; mastery_unlock?: MasteryLevel }>;
    reveal_mode: 'sequential' | 'free' | 'mastery_gated';
    default_unlocked?: number;
    show_progress?: boolean;
    allow_backtrack?: boolean;
  };
}

export interface WhiteboardBlockType extends BaseBlock {
  type: 'whiteboard';
  meta: {
    initial_data?: string;
    read_only?: boolean;
    allow_export?: boolean;
    width?: string;
    height?: string;
  };
}

export interface IllustrationBlockType extends BaseBlock {
  type: 'illustration';
  meta: {
    prompt: string;
    concept?: string;
    image_path?: string;
    generated: boolean;
    annotations?: string[];
    error?: string;
  };
}

export interface AnimationBlock extends BaseBlock {
  type: 'animation';
  meta: {
    engine: 'elucim';
    dsl: Record<string, unknown> | null;
    title?: string;
    concept?: string;
    preset?: string;
    generated: boolean;
    poster?: string;
    error?: string;
  };
}

export interface VideoAssetBlock extends BaseBlock {
  type: 'video_asset';
  meta: {
    engine: 'manim';
    python_source: string;
    scene_name?: string;
    quality?: 'low' | 'medium' | 'high';
    video_path?: string;
    poster_path?: string;
    generated: boolean;
    render_status: 'pending' | 'rendering' | 'done' | 'error' | 'unavailable';
    error?: string;
    caption?: string;
  };
}

export interface AnnotatedCodeBlock extends BaseBlock {
  type: 'annotated-code';
  lang: string;
  code: string;
  targets: Array<{
    id: string;
    line: number;
    label: string;
    entries: string[];
  }>;
}

export interface AnnotatedMathBlock extends BaseBlock {
  type: 'annotated-math';
  latex: string;
  targets: Array<{
    id: string;
    symbol: string;
    entries: string[];
  }>;
}

export interface ConversationAction {
  role: 'user' | 'ai' | 'system';
  ts: string;
  text: string;
  block_id?: string;
  meta?: Record<string, unknown>;
}

export interface LearnPermission {
  resource: 'ai_provider' | 'file_system' | 'network' | 'node_edit';
  grant: 'ask' | 'always' | 'never';
  rationale?: string;
}

export interface NoteEntry {
  id: string;
  ts: string;
  text: string;
  tags?: string[];
  pinned?: boolean;
  block_ref?: string;
}

export interface TutorConfigV2 {
  provider: string;
  model: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  streaming: boolean;
}

// ── Proposal / Approval Types ──

export interface ProposalCard {
  id: string;
  block_id: string;
  node_id: string;
  title: string;
  body_md: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  actions: string[];
  created_at: string;
  decided_at?: string;
}

export interface ApprovalResponse {
  proposal_id: string;
  approved: boolean;
  reason?: string;
  decided_by?: string;
}

// ── Dashboard Types ──

export interface TutorDashboardData {
  total_answers: number;
  total_questions: number;
  avg_confidence: number;
  recent_notes: NoteEntry[];
  open_proposals: ProposalCard[];
  active_conversations: number;
  streak_days: number;
  top_nodes: { node_id: string; title: string; count: number }[];
}
