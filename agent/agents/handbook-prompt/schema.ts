// 3. Parsing Schema — Handbook Command Prompt Response

export interface ParamBreakdown {
  flag?: string;
  arg?: string;
  meaning: string;
  type: 'boolean' | 'path' | 'pattern' | 'value' | 'placeholder';
}

export interface Exercise {
  title: string;
  command: string;
  explanation: string;
}

export interface RelatedCommand {
  command: string;
  relation: string;
}

export interface SafetyInfo {
  level: 'safe' | 'careful' | 'destructive';
  note: string;
}

export interface ContextUsed {
  chatHistoryLength: number;
  sectionId: string;
  userLevel: string;
}

export interface CommandExplanation {
  what: string;
  when: string;
  gotcha?: string;
}

export interface HandbookCommandResponse {
  type: 'handbook_command_response';
  version: string;
  command: string;
  title: string;
  estimatedMinutes: number;
  explanation: CommandExplanation;
  params: ParamBreakdown[];
  safety: SafetyInfo;
  exercises: Exercise[];
  related: RelatedCommand[];
  contextUsed: ContextUsed;
}

// ── UI State ──

export interface PromptState {
  status: 'idle' | 'loading' | 'success' | 'error';
  response: HandbookCommandResponse | null;
  error: string | null;
  rawOutput: string | null;
}

// ── Copy prompt payload (sent to AI) ──

export interface CopyPromptPayload {
  command: string;
  context: {
    section: {
      id: string;
      title: string;
      why: string;
    };
    commandData: {
      depth: string;
      description: string;
      gotchas: string[];
      params: {
        base: string;
        subcommands: string[];
        flags: { flag: string; value: string | null }[];
        args: { type: string; value: string }[];
      };
      badges: { type: string; label: string }[];
    };
    chatHistory: { role: string; content: string }[];
    userLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  userQuestion?: string;
}
