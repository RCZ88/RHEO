import { DEFAULT_PROFILE, PROFILE_KNOBS } from '../../shared/learn/types';
import type { LearnerProfile, ProfileKnob, MasteryLevel, KnowledgeEntry } from '../../shared/learn/types';

const KEY = 'lyceum.learnerProfile.v1';
const SETUP_COMPLETE_KEY = 'lyceum.setupComplete.v1';
const SETUP_COMPLETE_DB_KEY = 'lyceum.setupComplete.v1';

const api = window.deskflowAPI;

export function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
  } catch { return false; }
}

// Async version that also checks DB (for startup recovery)
export async function isSetupCompleteAsync(): Promise<boolean> {
  // Check localStorage first (fast path)
  if (isSetupComplete()) return true;
  // Check DB (recovery path)
  if (api?.learnGetProfile) {
    try {
      const dbVal = await api.learnGetProfile({ key: SETUP_COMPLETE_DB_KEY });
      if (dbVal === 'true') {
        // Restore to localStorage
        try { localStorage.setItem(SETUP_COMPLETE_KEY, 'true'); } catch {}
        return true;
      }
    } catch (e) {
      console.warn('[LearnerProfile] DB setup check failed:', e);
    }
  }
  console.log('[LearnerProfile] Setup not complete — localStorage:', isSetupComplete(), ', api available:', !!api?.learnGetProfile);
  return false;
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  } catch { /* ignore */ }
  // Persist to DB — NOT fire-and-forget, await it
  if (api?.learnSetProfile) {
    api.learnSetProfile({ key: SETUP_COMPLETE_DB_KEY, value: 'true' })
      .then((res: any) => {
        if (!res?.ok) console.warn('[LearnerProfile] DB setupComplete write returned error:', res);
      })
      .catch((e: any) => {
        console.error('[LearnerProfile] DB setupComplete write FAILED:', e);
      });
  } else {
    console.warn('[LearnerProfile] learnSetProfile not available — setup flag only in localStorage');
  }
}

export function clearSetupComplete(): void {
  try {
    localStorage.removeItem(SETUP_COMPLETE_KEY);
  } catch { /* ignore */ }
}

export function hasProfile(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    return raw != null;
  } catch { return false; }
}

export function loadProfile(): LearnerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROFILE, ...parsed,
      confidence: { ...DEFAULT_PROFILE.confidence, ...(parsed.confidence ?? {}) },
      priorKnowledge: { ...(parsed.priorKnowledge ?? {}) },
      knowledgeBase: Array.isArray(parsed.knowledgeBase) ? parsed.knowledgeBase : [],
      version: 1,
    };
  } catch { return { ...DEFAULT_PROFILE }; }
}

export function saveProfile(p: LearnerProfile): LearnerProfile {
  const next = { ...p, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[LearnerProfile] localStorage write failed:', e);
  }
  // Also persist to DB (fire-and-forget)
  if (api?.learnSetProfile) {
    api.learnSetProfile({ key: KEY, value: JSON.stringify(next) }).catch((e) => {
      console.warn('[LearnerProfile] DB write failed:', e);
    });
  }
  window.dispatchEvent(new CustomEvent('lyceum:profile-changed', { detail: next }));
  return next;
}

export function updateKnob<K extends ProfileKnob>(
  knob: K, value: LearnerProfile[K], confidence?: number,
): LearnerProfile {
  const p = loadProfile();
  (p as any)[knob] = value;
  if (confidence != null) p.confidence[knob] = Math.max(0, Math.min(1, confidence));
  return saveProfile(p);
}

export function setPriorKnowledge(part: number, level: MasteryLevel): LearnerProfile {
  const p = loadProfile(); p.priorKnowledge[part] = level; return saveProfile(p);
}

export function getPartMastery(part: number): MasteryLevel | undefined {
  return loadProfile().priorKnowledge[part];
}

// ── Knowledge Base (user-maintainable "what I already know") ──

export interface KnowledgeEntryInput {
  statement: string;
  topic?: string;
  partIds?: number[];
  linkedLessons?: string[];
  keywords?: string[];
  level?: MasteryLevel;
}

function newKnowledgeId(): string {
  return `kb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadKnowledgeBase(): KnowledgeEntry[] {
  return loadProfile().knowledgeBase ?? [];
}

export function addKnowledgeEntry(input: KnowledgeEntryInput): LearnerProfile {
  const p = loadProfile();
  const now = new Date().toISOString();
  const entry: KnowledgeEntry = {
    id: newKnowledgeId(),
    statement: input.statement.trim(),
    topic: input.topic?.trim() || undefined,
    partIds: input.partIds?.length ? input.partIds : undefined,
    linkedLessons: input.linkedLessons?.map((l) => l.trim()).filter(Boolean) || undefined,
    keywords: input.keywords?.map((k) => k.trim()).filter(Boolean),
    level: input.level,
    createdAt: now,
    updatedAt: now,
  };
  p.knowledgeBase = [...(p.knowledgeBase ?? []), entry];
  return saveProfile(p);
}

export function updateKnowledgeEntry(id: string, patch: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt'>>): LearnerProfile {
  const p = loadProfile();
  p.knowledgeBase = (p.knowledgeBase ?? []).map((e) =>
    e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
  );
  return saveProfile(p);
}

export function removeKnowledgeEntry(id: string): LearnerProfile {
  const p = loadProfile();
  p.knowledgeBase = (p.knowledgeBase ?? []).filter((e) => e.id !== id);
  return saveProfile(p);
}

// ── Custom chapter groups (user-managed list of groups for lesson organization) ──

export function loadCustomChapters(): string[] {
  return loadProfile().customChapters ?? [];
}

export function addCustomChapter(name: string): LearnerProfile {
  const p = loadProfile();
  const clean = name.trim();
  if (!clean) return p;
  const cur = loadCustomChapters();
  if (cur.includes(clean)) return p;
  p.customChapters = [...cur, clean];
  return saveProfile(p);
}

export function renameCustomChapter(oldName: string, nextName: string): LearnerProfile {
  const p = loadProfile();
  const clean = nextName.trim();
  if (!clean) return p;
  p.customChapters = (p.customChapters ?? []).map((c) => (c === oldName ? clean : c));
  return saveProfile(p);
}

export function removeCustomChapter(name: string): LearnerProfile {
  const p = loadProfile();
  p.customChapters = (p.customChapters ?? []).filter((c) => c !== name);
  return saveProfile(p);
}

// ── User's own lessons = their personal curriculum ──

export interface UserLessonSummary {
  titles: string[];
  parts: number[];
}

export async function loadUserLessons(): Promise<UserLessonSummary> {
  try {
    const listApi = (api as any)?.learnListLessons;
    if (!listApi) return { titles: [], parts: [] };
    const res = await listApi();
    const rows: any[] = res?.ok ? (res.data ?? []) : [];
    const titles = Array.from(new Set(rows.map((r: any) => (r?.title ?? '').trim()).filter(Boolean)));
    const parts = Array.from(new Set(rows.map((r: any) => r?.part).filter((p: any) => typeof p === 'number')));
    return { titles, parts };
  } catch {
    return { titles: [], parts: [] };
  }
}

export function resetProfile(): void {
  localStorage.removeItem(KEY);
  clearSetupComplete();
  if (api?.learnDeleteProfile) {
    api.learnDeleteProfile({ key: KEY }).catch(() => {});
  }
  window.dispatchEvent(new CustomEvent('lyceum:profile-changed', { detail: null }));
}

// Sync from DB to localStorage on startup (DB is source of truth)
export async function syncProfileFromDB(): Promise<void> {
  if (!api?.learnGetProfile) return;
  try {
    const dbRaw = await api.learnGetProfile({ key: KEY });
    if (dbRaw) {
      const localRaw = localStorage.getItem(KEY);
      const dbParsed = JSON.parse(dbRaw);
      const localParsed = localRaw ? JSON.parse(localRaw) : null;
      // Use DB version if it's newer or localStorage is empty
      if (!localParsed || (dbParsed.updatedAt && localParsed.updatedAt && dbParsed.updatedAt > localParsed.updatedAt)) {
        localStorage.setItem(KEY, dbRaw);
        window.dispatchEvent(new CustomEvent('lyceum:profile-changed', { detail: dbParsed }));
      }
    }
  } catch { /* ignore sync errors */ }
}
