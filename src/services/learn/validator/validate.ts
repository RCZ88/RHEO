// AJV-based validator for .ldoc documents (JSON Schema 2020-12)
// Compiles the schema once and exports validate + validateFull (with DAG/link/visual rules)

import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import type { LdocDocument, ValidationReport, ValidationIssue } from '../../shared/learn/types';

let ajv: Ajv | null = null;
let validateFn: Ajv.ValidateFunction | null = null;

function getAjv(): Ajv {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  }
  return ajv;
}

function getValidateFn(): Ajv.ValidateFunction {
  if (!validateFn) {
    const schemaPath = path.join(__dirname, '../../../schemas/ldoc-1.0.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    validateFn = getAjv().compile(schema);
  }
  return validateFn;
}

/**
 * Validate a .ldoc document against the JSON schema.
 * Returns a ValidationReport with all errors (not just the first).
 */
export function validateSchema(doc: unknown): ValidationReport {
  if (doc === null || doc === undefined || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: [{ rule: 'schema', message: `root must be an object, got ${typeof doc}` }], warnings: [] };
  }
  const fn = getValidateFn();
  const valid = fn(doc) as boolean;

  if (valid) {
    return { ok: true, errors: [], warnings: [] };
  }

  const errors: ValidationIssue[] = (fn.errors || []).map((e) => ({
    rule: 'schema',
    message: `${e.instancePath || 'root'} ${e.message || 'invalid'}`,
  }));

  return { ok: false, errors, warnings: [] };
}

/**
 * Check that all prereq IDs resolve (within this lesson or published lessons).
 */
function checkPrereqIds(doc: LdocDocument, publishedIds: Set<string>): ValidationIssue[] {
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    if (!node.prereq) continue;
    for (const pid of node.prereq) {
      if (!nodeIds.has(pid) && !publishedIds.has(pid)) {
        // Build a helpful error with sample valid IDs
        const sampleIds = [...nodeIds].slice(0, 3);
        const samplePublished = [...publishedIds].slice(0, 5);
        const allSamples = [...sampleIds, ...samplePublished];
        const sampleStr = allSamples.length > 0
          ? ` Valid IDs include: ${allSamples.join(', ')}${publishedIds.size > 5 ? ` (and ${publishedIds.size - 5} more)` : ''}`
          : ' No valid IDs found in database.';
        issues.push({
          rule: 'prereq-resolve',
          nodeId: node.id,
          message: `prereq "${pid}" does not resolve to any node in this lesson or a published lesson.${sampleStr}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Kahn's algorithm — detect cycles in the prereq DAG.
 */
function checkDag(doc: LdocDocument): ValidationIssue[] {
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  const inDegree: Map<string, number> = new Map();
  const adj: Map<string, string[]> = new Map();

  for (const node of doc.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const node of doc.nodes) {
    if (!node.prereq) continue;
    for (const pid of node.prereq) {
      if (!nodeIds.has(pid)) continue; // external prereq — skip
      adj.get(pid)!.push(node.id);
      inDegree.set(node.id, inDegree.get(node.id)! + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visited++;
    for (const neighbor of adj.get(curr) || []) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (visited < doc.nodes.length) {
    const cycleNodes = doc.nodes
      .filter((n) => inDegree.get(n.id)! > 0)
      .map((n) => n.id);
    return [{
      rule: 'dag-cycle',
      message: `prereq graph has a cycle involving: ${cycleNodes.join(', ')}`,
    }];
  }

  return [];
}

/**
 * Visual rule: mastery_target >= L2 requires at least one visual block.
 * Visual types match the parser's VISUAL_TYPES exactly.
 */
function checkVisual(doc: LdocDocument): ValidationIssue[] {
  const visualTypes = new Set([
    'mermaid', 'image', 'html', 'figure', 'math', 'annotated-math', 'code',
    'annotated-code', 'chart', 'finchart', 'flow', 'layer', 'table',
    'illustration', 'viz_heatmap', 'viz_graph', 'viz_timeline',
    'viz_concept_map', 'flashcard', 'layer_reveal', 'whiteboard',
  ]);
  const levelOrder = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    const targetIdx = levelOrder.indexOf(node.mastery_target);
    if (targetIdx < 2) continue; // L0 or L1 — no visual required

    const hasVisual = node.blocks.some((b) => visualTypes.has(b.type));
    if (!hasVisual) {
      issues.push({
        rule: 'visual-required',
        nodeId: node.id,
        message: `node "${node.id}" targets ${node.mastery_target} (>= L2) but has no visual block`,
      });
    }
  }

  return issues;
}

/**
 * @ref resolution: every @ref[id] must resolve to a target_id in the same node,
 * and every target_id must be referenced at least once.
 */
function checkRefs(doc: LdocDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    // Collect target_ids from annotated-code, annotated-math, figure, html blocks
    const targetIds = new Set<string>();
    for (const block of node.blocks) {
      if (block.type === 'annotated-code' && 'targets' in block) {
        for (const t of (block as any).targets) targetIds.add(t.id);
      } else if (block.type === 'annotated-math' && 'targets' in block) {
        for (const t of (block as any).targets) targetIds.add(t.id);
      }
    }

    // Collect referenced IDs from prose blocks
    const referencedIds = new Set<string>();
    for (const block of node.blocks) {
      if (block.type === 'prose' && 'md' in block) {
        const matches = (block as any).md.matchAll(/@ref\[([a-zA-Z0-9_-]+)\]/g);
        for (const m of matches) referencedIds.add(m[1]);
      }
    }

    // Rule 1: every @ref must resolve
    for (const refId of referencedIds) {
      if (!targetIds.has(refId)) {
        issues.push({
          rule: 'unresolved-ref',
          nodeId: node.id,
          message: `Unresolved @ref target: "${refId}" in node "${node.id}". No annotated-code, annotated-math, figure, or html block defines this ID.`,
        });
      }
    }

    // Rule 2: every target must be referenced (orphaned target)
    for (const targetId of targetIds) {
      if (!referencedIds.has(targetId)) {
        issues.push({
          rule: 'orphaned-target',
          nodeId: node.id,
          message: `Orphaned visual target: "${targetId}" in node "${node.id}". All visual parts must be referenced via @ref[${targetId}].`,
        });
      }
    }
  }

  return issues;
}

/**
 * Fact grounding: every must_know.source_id must resolve to a sources[].id.
 */
function checkFactGrounding(doc: LdocDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    const sourceIds = new Set(node.grounding.sources.map((s) => s.id));
    for (let i = 0; i < node.grounding.must_know.length; i++) {
      const fact = node.grounding.must_know[i];
      if (!sourceIds.has(fact.source_id)) {
        issues.push({
          rule: 'fact-grounding',
          nodeId: node.id,
          message: `must_know[${i}].source_id "${fact.source_id}" does not resolve to any source`,
        });
      }
    }
  }

  return issues;
}

/**
 * Quiz keys: closed quiz (mcq/numeric) must have answer_key; open quiz must have rubric.
 */
function checkQuizKeys(doc: LdocDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    for (const block of node.blocks) {
      if (block.type !== 'quiz') continue;
      if ((block.format === 'mcq' || block.format === 'numeric') && block.answer_key == null) {
        issues.push({
          rule: 'quiz-keys',
          nodeId: node.id,
          blockId: block.id,
          message: `closed quiz "${block.id}" (format=${block.format}) is missing answer_key`,
        });
      }
      if (block.format === 'open' && !block.rubric) {
        issues.push({
          rule: 'quiz-keys',
          nodeId: node.id,
          blockId: block.id,
          message: `open quiz "${block.id}" is missing rubric`,
        });
      }
    }
  }

  return issues;
}

/**
 * Scope present: every node grounding.scope.includes must be non-empty.
 */
function checkScope(doc: LdocDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of doc.nodes) {
    if (!node.grounding.scope || !node.grounding.scope.includes) {
      issues.push({
        rule: 'scope-present',
        nodeId: node.id,
        message: `node "${node.id}" is missing grounding.scope.includes`,
      });
    }
  }

  return issues;
}

/**
 * Full validation: schema + DAG + prereq resolve + visual + fact grounding + quiz keys + scope.
 */
export function validateFull(doc: unknown, publishedIds: Set<string> = new Set()): ValidationReport {
  const schemaReport = validateSchema(doc);
  if (!schemaReport.ok) {
    return schemaReport; // schema errors block everything else
  }

  const ldoc = doc as LdocDocument;
  const allErrors: ValidationIssue[] = [...schemaReport.errors];
  const allWarnings: ValidationIssue[] = [...schemaReport.warnings];

  allErrors.push(...checkDag(ldoc));
  allErrors.push(...checkPrereqIds(ldoc, publishedIds));
  allErrors.push(...checkVisual(ldoc));
  allErrors.push(...checkRefs(ldoc));
  allErrors.push(...checkFactGrounding(ldoc));
  allErrors.push(...checkQuizKeys(ldoc));
  allErrors.push(...checkScope(ldoc));

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Recompute content_hash for a node (sha256 of canonicalized JSON).
 */
export function computeContentHash(node: { blocks: unknown; grounding: unknown; mastery_target: string }): string {
  const crypto = require('crypto');
  const canonical = JSON.stringify({
    blocks: node.blocks,
    grounding: node.grounding,
    mastery_target: node.mastery_target,
  });
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
}
