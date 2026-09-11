export type WarmColorKey = 'clay' | 'sage' | 'amber' | 'sky';

export type CommitmentCadence = 'daily' | 'weekly';

export type DetectionMode = 'positive' | 'avoidance';

export interface Commitment {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: WarmColorKey;
  cadence: CommitmentCadence;
  weeklyTargetDays: number[];
  targetDays?: number;
  detection: {
    enabled: boolean;
    mode: DetectionMode;
    keywords: string[];
    minMinutes: number;
  };
  requireJournal?: boolean;
  autoConfirmWhenClean?: boolean;
  createdAt: number;
  archivedAt: number | null;
}

export interface DayCompletion {
  commitmentId: string;
  date: string;
  completedAt: number;
  source: 'manual' | 'detected';
}

export interface DayViolation {
  commitmentId: string;
  date: string;
  detectedAt: number;
}

export interface StreakStats {
  current: number;
  longest: number;
  totalCompletions: number;
  lastCompletedDate: string | null;
  justReset: boolean;
}

export interface JournalEntry {
  commitmentId: string | null;
  date: string;
  text: string;
  voiceNoteId?: string;
  voiceDurationSec?: number;
  updatedAt: number;
}

export interface PromptPack {
  id: string;
  name: string;
  builtin: boolean;
  prompts: string[];
}

export interface ReflectionPrompt {
  id: string;
  text: string;
  source: string;
}
