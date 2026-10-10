export type MemoryKind = 'photo' | 'video';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  date: string;
  capturedAt: string;
  caption?: string;
  phaseId?: string;
  /** Notes this memory belongs to. Lets a photo anchor a written thought. */
  noteIds?: string[];
  people: string[];
  createdAt: number;
  width?: number;
  height?: number;
  durationSec?: number;
}
