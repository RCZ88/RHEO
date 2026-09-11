// ProgressService — evidence → mastery estimate → spaced repetition
// Beta-Bernoulli model with decay + SM-2-style stability

import type Database from 'better-sqlite3';
import * as repo from '../db/repo';
import type { MasteryLevel, EvidenceOutcome, Evidence, NodeProgress, Result, ProgressMap, BetaBelief, BeliefState } from '../../shared/learn/types';

const LEVELS: MasteryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
const PROMOTION_THRESHOLD = 0.8;
const CORROBORATION_MIN = 2;
const DECAY_GAMMA = 0.98; // per day
const OUTCOME_SCORE: Record<EvidenceOutcome, number> = {
  demonstrated: 1,
  partial: 0.5,
  wrong: 0,
};

export class ProgressService {
  constructor(private db: Database) {}

  recordEvidence(evidence: {
    node_id: string; source: string; target_level: MasteryLevel;
    outcome: EvidenceOutcome; detail?: Record<string, unknown>;
  }): Result<{ evidenceId: number; newLevel: MasteryLevel }> {
    try {
      const ts = new Date().toISOString();
      const result = repo.insertEvidence(this.db, {
        node_id: evidence.node_id,
        ts,
        source: evidence.source,
        target_level: evidence.target_level,
        outcome: evidence.outcome,
        detail_json: evidence.detail ? JSON.stringify(evidence.detail) : undefined,
      });

      // Update mastery
      const newLevel = this.updateMastery(evidence.node_id, evidence.target_level, evidence.outcome);

      return { ok: true, data: { evidenceId: result.lastInsertRowid as number, newLevel } };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  getProgress(nodeId?: string): Result<NodeProgress | ProgressMap> {
    try {
      if (nodeId) {
        const row = repo.getProgress(this.db, nodeId);
        if (!row) return { ok: false, error: `No progress for node "${nodeId}"` };
        return { ok: true, data: this.parseProgress(row) };
      }
      const rows = repo.getAllProgress(this.db);
      const map: ProgressMap = {};
      for (const row of rows as any[]) {
        map[row.node_id] = this.parseProgress(row);
      }
      return { ok: true, data: map };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  getDueReviews(): Result<any[]> {
    try {
      return { ok: true, data: repo.getDueReviews(this.db) };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private updateMastery(nodeId: string, targetLevel: MasteryLevel, outcome: EvidenceOutcome): MasteryLevel {
    const existing = repo.getProgress(this.db, nodeId);
    const now = new Date();

    // Initialize or decay existing belief
    let belief: BeliefState;
    let stability = 0;

    if (existing) {
      const parsed = JSON.parse((existing as any).belief_json) as BeliefState;
      belief = this.decayBelief(parsed, (existing as any).last_seen);
      stability = (existing as any).stability || 0;
    } else {
      belief = this.initBelief();
    }

    // Update belief for the target level
    const score = OUTCOME_SCORE[outcome];
    const w = 1; // recency weight
    const targetIdx = LEVELS.indexOf(targetLevel);

    // Update the target level and all levels below it
    for (let i = 0; i <= targetIdx; i++) {
      const level = LEVELS[i];
      belief[level].alpha += w * score;
      belief[level].beta += w * (1 - score);
    }

    // Determine current level (highest where mean >= threshold AND corroborated)
    let newLevel: MasteryLevel = 'L0';
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      const level = LEVELS[i];
      const mean = belief[level].alpha / (belief[level].alpha + belief[level].beta);
      const count = belief[level].alpha + belief[level].beta - 2; // subtract prior
      if (mean >= PROMOTION_THRESHOLD && count >= CORROBORATION_MIN) {
        newLevel = level;
        break;
      }
    }

    // Update stability (SM-2-style)
    if (outcome === 'demonstrated') {
      stability = Math.max(1, stability * 2.0);
    } else if (outcome === 'wrong') {
      stability = Math.max(1, stability * 0.5);
    }

    // Compute due_at
    const dueAt = new Date(now.getTime() + stability * 24 * 60 * 60 * 1000);

    repo.upsertProgress(this.db, {
      node_id: nodeId,
      level: newLevel,
      belief_json: JSON.stringify(belief),
      stability,
      last_seen: now.toISOString(),
      due_at: dueAt.toISOString(),
    });

    return newLevel;
  }

  private initBelief(): BeliefState {
    const belief: BeliefState = {} as BeliefState;
    for (const level of LEVELS) {
      belief[level] = { alpha: 1, beta: 1 }; // Beta(1,1) uniform prior
    }
    return belief;
  }

  private decayBelief(belief: BeliefState, lastSeen?: string): BeliefState {
    if (!lastSeen) return belief;

    const last = new Date(lastSeen);
    const now = new Date();
    const days = Math.max(0, (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
    const decay = Math.pow(DECAY_GAMMA, days);

    const decayed: BeliefState = {} as BeliefState;
    for (const level of LEVELS) {
      const b = belief[level];
      decayed[level] = {
        alpha: 1 + (b.alpha - 1) * decay,
        beta: 1 + (b.beta - 1) * decay,
      };
    }
    return decayed;
  }

  private parseProgress(row: any): NodeProgress {
    return {
      node_id: row.node_id,
      level: row.level,
      stability: row.stability,
      last_seen: row.last_seen,
      due_at: row.due_at,
      belief: JSON.parse(row.belief_json),
    };
  }
}
