export type MemoryKind = 'photo' | 'video';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  date: string;
  capturedAt: string;
  caption?: string;
  phaseId?: string;
  noteIds?: string[];
  people: string[];
  createdAt: number;
  width?: number;
  height?: number;
  durationSec?: number;
  // --- revamp additions ---
  groupId?: string;
  location?: string;
  tags?: string[];
  title?: string;
}

export type GroupAccent =
  | 'rose' | 'amber' | 'emerald' | 'blue' | 'violet' | 'pink' | 'teal' | 'orange';

export interface MemoryGroup {
  id: string;
  title: string;
  coverId?: string;
  accent: GroupAccent;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
  people?: string[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface GroupSuggestion {
  key: string;
  title: string;
  memberIds: string[];
  dateFrom: string;
  dateTo: string;
  location?: string;
  people?: string[];
}
