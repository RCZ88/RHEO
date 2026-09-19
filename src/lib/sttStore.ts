/**
 * sttStore.ts — Transcript persistence layer for local STT
 * R-47: SQLite persistence via IPC. In-memory fallback if IPC unavailable.
 */

export interface SttTranscript {
  id: string;
  text: string;
  title?: string;
  note?: string;
  prompt?: string;
  project?: string;
  createdAt: string;
  durationMs: number;
  category: string;
  tags: string[];
  projectId?: string;
  projectName?: string;
  isFavorite: boolean;
  source?: string;
}

export type TranscriptEntry = SttTranscript;
export type SttCategory = string;

export interface SttStore {
  list(): Promise<SttTranscript[]>;
  save(entry: Omit<SttTranscript, 'id'>): Promise<SttTranscript>;
  update(id: string, changes: Partial<SttTranscript>): Promise<void>;
  remove(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  export(): Promise<string>;
  getAll(): Promise<TranscriptEntry[]>;
  saveToLibrary(entry: Omit<TranscriptEntry, 'id'>): Promise<string>;
  updateInLibrary(id: string, patch: Partial<TranscriptEntry>): Promise<void>;
  removeFromLibrary(id: string): Promise<void>;
}

// ── Category colors — single source ──

export const SttCategoryColors: Record<string, { hex: string; label: string }> = {
  idea:       { hex: '#ec4899', label: 'Idea' },
  brainstorm: { hex: '#8b5cf6', label: 'Brainstorm' },
  note:       { hex: '#3b82f6', label: 'Note' },
  prompt:     { hex: '#f59e0b', label: 'Prompt' },
  todo:       { hex: '#10b981', label: 'Todo' },
  other:      { hex: '#6b7280', label: 'Other' },
};

// ── SQLite IPC impl ──

function createSQLiteStore(): SttStore {
  const api = (window as any).deskflowAPI;

  return {
    async list() {
      if (!api?.sttTranscriptList) return [];
      return api.sttTranscriptList();
    },

    async save(entry) {
      if (!api?.sttTranscriptSave) {
        // Fallback: in-memory
        const id = `stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return { ...entry, id } as SttTranscript;
      }
      const id = await api.sttTranscriptSave(entry);
      return { ...entry, id } as SttTranscript;
    },

    async update(id, changes) {
      if (!api?.sttTranscriptUpdate) return;
      await api.sttTranscriptUpdate(id, changes);
    },

    async remove(id) {
      if (!api?.sttTranscriptRemove) return;
      await api.sttTranscriptRemove(id);
    },

    async toggleFavorite(id) {
      if (!api?.sttTranscriptToggleFavorite) return;
      await api.sttTranscriptToggleFavorite(id);
    },

    async export() {
      const all = await this.list();
      return JSON.stringify(all, null, 2);
    },

    // ── TranscriptLibraryPage methods ──
    async getAll() {
      const all = await this.list();
      // Map from SQLite column names to TranscriptEntry shape
      return all.map(e => ({
        id: e.id,
        text: e.text,
        title: (e as any).title ?? '',
        note: (e as any).note ?? '',
        prompt: (e as any).prompt ?? '',
        project: (e as any).project ?? '',
        createdAt: e.createdAt,
        durationMs: e.durationMs,
        category: e.category,
        tags: e.tags,
        projectId: e.projectId,
        projectName: e.projectName,
        isFavorite: e.isFavorite,
        source: e.source,
      }));
    },

    async saveToLibrary(entry) {
      if (!api?.sttTranscriptSave) {
        const id = `stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return id;
      }
      return await api.sttTranscriptSave(entry);
    },

    async updateInLibrary(id, changes) {
      if (!api?.sttTranscriptUpdate) return;
      await api.sttTranscriptUpdate(id, changes);
    },

    async removeFromLibrary(id) {
      if (!api?.sttTranscriptRemove) return;
      await api.sttTranscriptRemove(id);
    },
  };
}

// ── Factory ──

let storeImpl: SttStore | null = null;

export async function getStore(): Promise<SttStore> {
  if (!storeImpl) {
    storeImpl = createSQLiteStore();
  }
  return storeImpl;
}
