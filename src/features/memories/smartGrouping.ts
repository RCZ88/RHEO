import type { MemoryItem, GroupSuggestion } from './types';
import { parseDateStr } from '../../lib/week';

const CLUSTER_GAP_DAYS = 3;
const MIN_CLUSTER_SIZE = 8;
const MAX_SUGGESTIONS = 4;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const SEASON_OF = ['Winter','Winter','Spring','Spring','Spring',
                   'Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter'];

function daysBetween(a: string, b: string): number {
  const da = parseDateStr(a);
  const db = parseDateStr(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function monthName(m: number): string { return MONTHS[m - 1]; }

function toSuggestion(cluster: MemoryItem[]): GroupSuggestion {
  const sorted = [...cluster].sort((a, b) => a.date.localeCompare(b.date));
  const dateFrom = sorted[0].date;
  const dateTo = sorted[sorted.length - 1].date;
  const [fy, fm] = dateFrom.split('-').map(Number);
  const [ty, tm] = dateTo.split('-').map(Number);

  let title: string;
  if (fy === ty && fm === tm) {
    title = `${monthName(fm)} ${fy}`;
  } else if (fy === ty && (tm - fm) <= 2) {
    title = `${SEASON_OF[fm - 1]} ${fy}`;
  } else if (fy === ty) {
    title = `${monthName(fm)} – ${monthName(tm)} ${fy}`;
  } else {
    title = `${monthName(fm).slice(0, 3)} ${fy} – ${monthName(tm).slice(0, 3)} ${ty}`;
  }

  // Location: one location shared by >= 70% of members
  const locCounts = new Map<string, number>();
  for (const m of sorted) {
    if (m.location) locCounts.set(m.location, (locCounts.get(m.location) ?? 0) + 1);
  }
  let location: string | undefined;
  for (const [loc, count] of locCounts) {
    if (count / sorted.length >= 0.7) { location = loc; break; }
  }

  // People: names present on >= 70% of members, capped at 3
  const personCounts = new Map<string, number>();
  for (const m of sorted) {
    for (const p of m.people) {
      personCounts.set(p, (personCounts.get(p) ?? 0) + 1);
    }
  }
  const people: string[] = [];
  for (const [name, count] of personCounts) {
    if (count / sorted.length >= 0.7 && people.length < 3) people.push(name);
  }

  // Key: first 10 hex chars of SHA-1 over sorted memberIds joined by |
  const ids = sorted.map(m => m.id).sort().join('|');
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    hash = ((hash << 5) - hash + ids.charCodeAt(i)) | 0;
  }
  const key = Math.abs(hash).toString(16).padStart(10, '0').slice(0, 10);

  return {
    key,
    title,
    memberIds: sorted.map(m => m.id),
    dateFrom,
    dateTo,
    location,
    people: people.length > 0 ? people : undefined,
  };
}

export function suggestGroups(ungrouped: MemoryItem[]): GroupSuggestion[] {
  const sorted = [...ungrouped].sort((a, b) => a.date.localeCompare(b.date));
  const clusters: MemoryItem[][] = [];
  for (const m of sorted) {
    const cur = clusters[clusters.length - 1];
    if (cur && daysBetween(cur[cur.length - 1].date, m.date) <= CLUSTER_GAP_DAYS) {
      cur.push(m);
    } else {
      clusters.push([m]);
    }
  }
  return clusters
    .filter(c => c.length >= MIN_CLUSTER_SIZE)
    .slice(-MAX_SUGGESTIONS)
    .reverse()
    .map(toSuggestion);
}