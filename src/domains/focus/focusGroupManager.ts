import type Database from 'better-sqlite3';
import { Tier, FocusConfig } from './focusManager';

export interface FocusGroup {
  id: number;
  name: string;
  description: string | null;
  allowed_apps: string[];
  allowed_domains: string[];
  allowed_categories: string[];
  strictness: 'distracting' | 'non_allowed';
  default_duration: number | null;
  daily_goal_sec: number | null;
  goal_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupAllowed {
  apps: string[];
  domains: string[];
  tiers: Tier[];
}

function parseList(v: string | null): string[] {
  try {
    const p = JSON.parse(v ?? '[]');
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export class FocusGroupManager {
  constructor(private db: Database.Database) {}

  list(): FocusGroup[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, description, allowed_apps, allowed_domains, allowed_categories, strictness, default_duration, daily_goal_sec, goal_category, created_at, updated_at
         FROM focus_groups ORDER BY name ASC`,
      )
      .all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      allowed_apps: parseList(r.allowed_apps),
      allowed_domains: parseList(r.allowed_domains),
      allowed_categories: parseList(r.allowed_categories),
      strictness: r.strictness ?? 'distracting',
      default_duration: r.default_duration ?? null,
      daily_goal_sec: r.daily_goal_sec ?? null,
      goal_category: r.goal_category ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  get(id: number): FocusGroup | null {
    const r = this.db
      .prepare(
        `SELECT id, name, description, allowed_apps, allowed_domains, allowed_categories, strictness, default_duration, daily_goal_sec, goal_category, created_at, updated_at
         FROM focus_groups WHERE id = ?`,
      )
      .get(id) as any | undefined;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      allowed_apps: parseList(r.allowed_apps),
      allowed_domains: parseList(r.allowed_domains),
      allowed_categories: parseList(r.allowed_categories),
      strictness: r.strictness ?? 'distracting',
      default_duration: r.default_duration ?? null,
      daily_goal_sec: r.daily_goal_sec ?? null,
      goal_category: r.goal_category ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  save(g: {
    id?: number; name: string; description?: string | null;
    allowed_apps?: string[]; allowed_domains?: string[]; allowed_categories?: string[];
    strictness?: 'distracting' | 'non_allowed'; default_duration?: number | null;
    daily_goal_sec?: number | null; goal_category?: string | null;
  }): number {
    const now = new Date().toISOString();
    if (g.id) {
      this.db
        .prepare(
          `UPDATE focus_groups SET name = ?, description = ?, allowed_apps = ?, allowed_domains = ?,
           allowed_categories = ?, strictness = ?, default_duration = ?, daily_goal_sec = ?, goal_category = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          g.name, g.description ?? null,
          JSON.stringify(g.allowed_apps ?? []),
          JSON.stringify(g.allowed_domains ?? []),
          JSON.stringify(g.allowed_categories ?? []),
          g.strictness ?? 'distracting', g.default_duration ?? null,
          g.daily_goal_sec ?? null, g.goal_category ?? null,
          now, g.id,
        );
      return g.id;
    }
    const info = this.db
      .prepare(
        `INSERT INTO focus_groups (name, description, allowed_apps, allowed_domains, allowed_categories, strictness, default_duration, daily_goal_sec, goal_category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        g.name, g.description ?? null,
        JSON.stringify(g.allowed_apps ?? []),
        JSON.stringify(g.allowed_domains ?? []),
        JSON.stringify(g.allowed_categories ?? []),
        g.strictness ?? 'distracting', g.default_duration ?? null,
        g.daily_goal_sec ?? null, g.goal_category ?? null,
        now, now,
      );
    return Number(info.lastInsertRowid);
  }

  remove(id: number): boolean {
    const r = this.db.prepare('DELETE FROM focus_groups WHERE id = ?').run(id);
    return r.changes > 0;
  }

  recordUsage(groupId: number, sessionId: number) {
    try {
      this.db
        .prepare(`INSERT OR IGNORE INTO focus_group_usage (group_id, session_id) VALUES (?, ?)`)
        .run(groupId, sessionId);
    } catch {
      /* group may not exist; ignore */
    }
  }

  linkUsage(groupId: number, sessionId: number, goalIds: string[]) {
    const json = JSON.stringify(Array.isArray(goalIds) ? goalIds.map(String) : []);
    try {
      this.db
        .prepare(`INSERT OR IGNORE INTO focus_group_usage (group_id, session_id, goal_ids) VALUES (?, ?, ?)`)
        .run(groupId, sessionId, json);
      this.db
        .prepare(`UPDATE focus_group_usage SET goal_ids = ? WHERE group_id = ? AND session_id = ?`)
        .run(json, groupId, sessionId);
    } catch {
      /* ignore — table may not exist in very old DBs */
    }
  }

  getUsage(): Array<{ group_id: number; session_id: number }> {
    try {
      return this.db
        .prepare('SELECT group_id, session_id FROM focus_group_usage')
        .all() as Array<{ group_id: number; session_id: number }>;
    } catch {
      return [];
    }
  }

  toAllowed(g: FocusGroup): GroupAllowed {
    return {
      apps: g.allowed_apps ?? [],
      domains: g.allowed_domains ?? [],
      tiers: g.strictness === 'non_allowed' ? ['productive'] : ['productive', 'neutral'],
    };
  }

  toConfig(id: number, durationSec?: number, strictness?: 'distracting' | 'non_allowed'): FocusConfig | null {
    const g = this.get(id);
    if (!g) return null;
    const a = this.toAllowed(g);
    return {
      durationSec: durationSec ?? (g.default_duration ?? 25 * 60),
      strictness: strictness ?? g.strictness,
      allowed: {
        ...a,
        categories: g.allowed_categories ?? [],
      },
    };
  }

  /**
   * Merge multiple focus groups into a single combined session config.
   * - allowed apps / domains / categories are UNIONED (deduped, case-insensitive).
   * - strictness = 'non_allowed' (strict) if ANY selected group is strict; otherwise 'distracting'.
   * - duration defaults to the first selected group's default_duration (or 25m).
   * Returns null if no valid groups were found.
   */
  toCombinedConfig(ids: number[], durationSec?: number, strictness?: 'distracting' | 'non_allowed'): { config: FocusConfig; groupIds: number[] } | null {
    const groups = ids.map(id => this.get(Number(id))).filter((g): g is FocusGroup => !!g);
    if (groups.length === 0) return null;

    const appSet = new Map<string, string>();
    const domainSet = new Map<string, string>();
    const categorySet = new Map<string, string>();
    let anyStrict = false;

    for (const g of groups) {
      if (g.strictness === 'non_allowed') anyStrict = true;
      for (const a of g.allowed_apps ?? []) appSet.set(a.toLowerCase(), a);
      for (const d of g.allowed_domains ?? []) domainSet.set(d.toLowerCase(), d);
      for (const c of g.allowed_categories ?? []) categorySet.set(c.toLowerCase(), c);
    }

    const apps = Array.from(appSet.values());
    const domains = Array.from(domainSet.values());
    const categories = Array.from(categorySet.values());

    const resolvedStrictness: 'distracting' | 'non_allowed' =
      strictness ?? (anyStrict ? 'non_allowed' : 'distracting');
    const tiers: Tier[] = resolvedStrictness === 'non_allowed' ? ['productive'] : ['productive', 'neutral'];

    return {
      groupIds: groups.map(g => g.id),
      config: {
        durationSec: typeof durationSec === 'number' ? durationSec : (groups[0].default_duration ?? 25 * 60),
        strictness: resolvedStrictness,
        allowed: { apps, domains, tiers, categories },
      },
    };
  }
}
