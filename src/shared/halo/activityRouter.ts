import type { IslandActivity } from './types';

/** HALO §4: at most three transient activities queue up at once. */
export const MAX_TRANSIENT = 3;

interface Entry {
  activity: IslandActivity;
  /** Set the first time this entry wins the surface, so minimumDisplayMs can be
   * measured from first perception rather than from publish time. */
  firstShownAt: number | null;
  minDisplayUntil: number;
}

export interface ResolveOptions {
  /**
   * True while the user is actively manipulating the surface. HALO §6 requires
   * that a direct interaction is never interrupted, so the incumbent keeps the
   * surface for the duration regardless of what else is published.
   */
  interactionLocked?: boolean;
}

/**
 * HALO §6 ActivityRouter.
 *
 * Authority note: this lives in the main process, not the renderer. Expiry,
 * replacement and queue bounds are business state, and HALO §198 forbids
 * depending on a React component timeout for them.
 */
export class ActivityRouter {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();

  publish(activity: IslandActivity, now: number): void {
    if (activity.replaceGroup) {
      for (const [id, entry] of this.entries) {
        if (entry.activity.replaceGroup === activity.replaceGroup) {
          this.entries.delete(id);
        }
      }
    }

    const prev = this.entries.get(activity.id);
    if (prev) {
      // A stable id means "same logical activity, newer values". createdAt is
      // preserved so age-based tie-breaks stay stable across updates.
      this.entries.set(activity.id, {
        ...prev,
        activity: { ...activity, createdAt: prev.activity.createdAt, updatedAt: now },
      });
    } else {
      this.entries.set(activity.id, {
        activity: { ...activity, createdAt: activity.createdAt || now, updatedAt: now },
        firstShownAt: null,
        minDisplayUntil:
          activity.minimumDisplayMs && activity.minimumDisplayMs > 0
            ? now + activity.minimumDisplayMs
            : 0,
      });
    }

    this.enforceBound();
    this.emit();
  }

  remove(activityId: string): void {
    if (this.entries.delete(activityId)) this.emit();
  }

  /** HALO §6: expiry is decided here, not by a renderer timeout. */
  clearExpired(now: number): void {
    let changed = false;
    for (const [id, entry] of this.entries) {
      const { expiresAt, persistent } = entry.activity;
      if (!persistent && expiresAt !== undefined && expiresAt <= now) {
        this.entries.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  get(id: string): IslandActivity | null {
    return this.entries.get(id)?.activity ?? null;
  }

  queue(): readonly IslandActivity[] {
    return [...this.entries.values()]
      .map((e) => e.activity)
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }

  get size(): number {
    return this.entries.size;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Decides which activity owns the surface.
   *
   * Three rules fight for control here and the order matters:
   *   1. an in-progress interaction is never interrupted;
   *   2. an activity that has not been seen for its minimumDisplayMs keeps the
   *      surface, so a fast event cannot be replaced before it is perceivable;
   *   3. otherwise the highest priority wins, with a stickiness bias so two
   *      equal-priority activities do not flicker back and forth.
   */
  resolveActive(currentId: string | null, now: number, opts: ResolveOptions = {}): string | null {
    this.clearExpired(now);
    const all = [...this.entries.values()];
    if (all.length === 0) return null;

    const current = currentId ? this.entries.get(currentId) : undefined;

    if (current && opts.interactionLocked) return currentId;

    if (current && current.minDisplayUntil > now) {
      // Still inside its guaranteed display window; only an outright error may
      // take the surface away.
      if (current.activity.priority >= 900) return currentId;
      const better = all.some(
        (e) =>
          e.activity.id !== currentId &&
          e.activity.priority > current.activity.priority &&
          e.activity.pinned,
      );
      if (!better) return currentId;
    }

    let best = all[0];
    for (const entry of all) {
      if (entry.activity.priority > best.activity.priority) best = entry;
      else if (
        entry.activity.priority === best.activity.priority &&
        entry.activity.createdAt < best.activity.createdAt
      ) {
        best = entry;
      }
    }

    // Stickiness: an equal-priority challenger does not take over. Without this
    // two same-priority activities flip the surface on every publish, which HALO
    // §213 calls nervous.
    if (current && best.activity.id !== currentId) {
      if (best.activity.priority <= current.activity.priority) return currentId;
    }

    if (currentId !== best.activity.id) {
      this.markShown(best.activity.id, now);
      const prev = this.entries.get(currentId ?? '');
      if (prev) prev.firstShownAt = null;
    } else if (!current?.firstShownAt) {
      this.markShown(currentId!, now);
    }

    return best.activity.id;
  }

  private markShown(id: string, now: number): void {
    const entry = this.entries.get(id);
    if (entry && entry.firstShownAt === null) entry.firstShownAt = now;
  }

  /**
   * HALO §4: the transient queue is bounded and lower-priority transients may be
   * dropped — but a pinned activity or a persistent one is never dropped.
   */
  private enforceBound(): void {
    const transient = [...this.entries.values()].filter(
      (e) => !e.activity.persistent && !e.activity.pinned,
    );
    if (transient.length <= MAX_TRANSIENT) return;

    const sorted = transient.sort(
      (a, b) => a.activity.priority - b.activity.priority || b.activity.createdAt - a.activity.createdAt,
    );
    const overflow = sorted.length - MAX_TRANSIENT;
    for (let i = 0; i < overflow; i += 1) {
      this.entries.delete(sorted[i].activity.id);
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}