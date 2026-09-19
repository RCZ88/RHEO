import { uid } from '../lib/data';

export interface CommandNote {
  id: string;
  command: string;
  section: string;
  sectionTitle: string;
  title: string;
  summary: string;
  what: string;
  when: string;
  gotcha: string;
  params: Array<{ name: string; meaning: string }>;
  safety: string;
  related: string[];
  savedAt: number;
  savedBy: 'ai' | 'manual';
  aiRaw?: string;
}

const LS_KEY = 'penguin-console-command-notes';

function load(): CommandNote[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export const commandNotes = {
  list(): CommandNote[] {
    return load().sort((a, b) => b.savedAt - a.savedAt);
  },

  get(command: string): CommandNote | undefined {
    return load().find(n => n.command === command);
  },

  add(note: Omit<CommandNote, 'id' | 'savedAt' | 'savedBy'>, aiRaw?: string): CommandNote {
    const notes = load();
    const existing = notes.findIndex(n => n.command === note.command);
    const entry: CommandNote = {
      id: uid('cn'),
      ...note,
      savedAt: Date.now(),
      savedBy: 'ai',
      aiRaw,
    };
    if (existing >= 0) {
      notes[existing] = entry;
    } else {
      notes.unshift(entry);
    }
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
    return entry;
  },

  update(id: string, patch: Partial<Pick<CommandNote, 'title' | 'summary' | 'what' | 'when' | 'gotcha'>>): boolean {
    const notes = load();
    const i = notes.findIndex(n => n.id === id);
    if (i < 0) return false;
    notes[i] = { ...notes[i], ...patch };
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
    return true;
  },

  remove(id: string): boolean {
    const notes = load().filter(n => n.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
    return true;
  },

  clear(): void {
    localStorage.removeItem(LS_KEY);
  },
};
