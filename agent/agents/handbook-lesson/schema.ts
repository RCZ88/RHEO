// 3. Parsing Schema — Terminal Handbook Lesson Output

export type DepthLevel = 'core' | 'daily' | 'power' | 'rescue' | 'sudo';
export type CalloutType = 'tip' | 'danger';
export type FlagShort = { flag: string; value: string | null; short?: true };
export type FlagLong = { flag: string; value: string | null; short?: never };
export type Flag = FlagShort | FlagLong;

export interface CommandParam {
  base: string;
  subcommands: string[];
  flags: Flag[];
  args: Array<{ type: 'path' | 'literal' | 'placeholder' | 'special'; value: string }>;
  pipe_to?: string | null;
  is_sudo?: boolean;
}

export interface RawCommand {
  section: string;
  sectionTitle: string;
  sectionNum: string;
  command: string;
  isRoot: boolean;
  depth: DepthLevel;
  badges: Array<{ type: string; label: string }>;
  description: string;
  whenToUse: string;
  gotchas: string[];
  notes: string[];
  params: CommandParam;
}

export interface HandbookSection {
  id: string;
  number: string;
  title: string;
  crumb: string;
  why: string;
  commands: RawCommand[];
  callouts: Array<{ type: CalloutType; title: string; body: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
}

// ── Generated Lesson Output ──

export interface CommandCard {
  command: string;
  depth: DepthLevel;
  isRoot: boolean;
  description: string;
  params: {
    base: string;
    subcommands: string[];
    flags: Array<{ flag: string; meaning: string; value?: string }>;
    args: Array<{ type: string; value: string; meaning: string }>;
    pipe_to?: string;
    is_sudo?: boolean;
  };
  whenToUse: string;
  gotchas: string[];
  notes: string[];
  copyBlock: string;
}

export interface Exercise {
  title: string;
  instructions: string;
  solution: string;
  commandsUsed: string[];
}

export interface QuickRef {
  headers: string[];
  rows: string[][];
}

export interface LessonContent {
  objective: string;
  whyItMatters: string;
  narrative: string;
  commandCards: CommandCard[];
  exercises: Exercise[];
  quickRef: QuickRef;
  callouts: Array<{ type: CalloutType; title: string; body: string }>;
}

export interface HandbookLessonOutput {
  type: 'handbook_lesson';
  title: string;
  sectionId: string;
  sectionNumber: string;
  estimatedMinutes: number;
  lesson: LessonContent;
  metadata: {
    generated_at: string;
    agent_version: string;
    data_sources: string[];
    commandCount: number;
    depthsRepresented: DepthLevel[];
  };
}

// ── Factory Function Input ──

export interface LessonRequest {
  sectionId: string;
  userContext?: {
    os?: 'fedora' | 'windows' | 'mac';
    experience?: 'beginner' | 'intermediate' | 'advanced';
    focus?: string;
  };
}
