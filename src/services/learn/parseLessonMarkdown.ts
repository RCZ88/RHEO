// Lyceum Learn — Lesson Markdown (.lmd) -> .ldoc compiler
//
// WHY THIS EXISTS
// --------------
// Asking an LLM to emit a large, strict JSON object whose string values contain
// code (backticks, newlines, quotes) is the single most failure-prone way to get
// structured content out of a model. The errors you saw -
//   Unexpected token '`', "```python ..." is not valid JSON
//   Expected ',' or '}' after property value in JSON at position ...
// are the model leaking a code fence / trailing comma INTO the JSON string. No
// amount of "sanitise harder" fixes the open-ended class of these bugs.
//
// THE FIX: invert the format. The model writes Lesson Markdown (.lmd) - which it
// is extremely good at, code fences and all - and THIS compiler turns it into the
// exact LdocDocument shape deterministically. A ```python fence and a trailing
// comma are now impossible by construction, because the model never writes JSON.
//
// The output is validated by the existing validateFull() and imported unchanged.

import type {
  LdocDocument,
  LdocLesson,
  LdocNode,
  LdocBlock,
  LdocGrounding,
  MasteryLevel,
  QuizFormat,
} from '../../shared/learn/types';

export class LessonMarkdownError extends Error {
  constructor(message: string, public line?: number) {
    super(line != null ? `Line ${line}: ${message}` : message);
    this.name = 'LessonMarkdownError';
  }
}

const MASTERY: ReadonlySet<string> = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
// Must match validateFull()'s visual rule exactly: mermaid/image/widget/math.
const VISUAL_TYPES: ReadonlySet<string> = new Set(['mermaid', 'image', 'html', 'figure', 'math', 'annotated-math', 'code', 'annotated-code', 'chart', 'finchart', 'flow', 'layer', 'table', 'illustration', 'viz_heatmap', 'viz_graph', 'viz_timeline', 'viz_concept_map', 'flashcard', 'layer_reveal', 'whiteboard']);

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '') || 'node';
}

function asMastery(v: string, line?: number): MasteryLevel {
  const up = v.trim().toUpperCase();
  if (!MASTERY.has(up)) {
    throw new LessonMarkdownError(`"${v}" is not a mastery level (use L0-L5)`, line);
  }
  return up as MasteryLevel;
}

// ── Lightweight line cursor ────────────────────────────────────────────────

interface Line {
  raw: string;
  text: string; // trimmed
  no: number; // 1-based
}

function toLines(src: string): Line[] {
  return src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map((raw, i) => ({ raw, text: raw.trim(), no: i + 1 }));
}

// ── Frontmatter ────────────────────────────────────────────────────────────

interface Frontmatter {
  title: string;
  id?: string;
  part?: number;
  version?: string;
  summary?: string;
  authored_by?: 'human' | 'ai' | 'hybrid';
  rest: Line[]; // lines after the frontmatter block
}

function tryParseFrontmatter(lines: Line[], start: number): Frontmatter | null {
  let i = start + 1; // consume opening ---
  const fm: Record<string, string> = {};
  while (i < lines.length && lines[i].text !== '---') {
    const m = lines[i].text.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (m) fm[m[1].toLowerCase()] = m[2].trim();
    i++;
  }
  if (i >= lines.length || !fm.title) return null;
  i++; // consume closing ---
  const ab = (fm.authored_by || '').toLowerCase();
  return {
    title: fm.title,
    id: fm.id ? slug(fm.id) : undefined,
    part: fm.part != null && fm.part !== '' ? Number(fm.part) : undefined,
    version: fm.version || undefined,
    summary: fm.summary || undefined,
    authored_by: ab === 'human' || ab === 'ai' || ab === 'hybrid' ? ab : undefined,
    rest: lines.slice(i),
  };
}

function parseFrontmatter(lines: Line[]): Frontmatter {
  let i = 0;
  while (i < lines.length && lines[i].text === '') i++;
  // Tolerate preamble text / a leaked fence line before the frontmatter
  // (e.g. "Here is your lesson:" or ```lmd from a chat UI) by scanning
  // forward to the first '---' and retrying later ones if no title found.
  while (i < lines.length) {
    if (lines[i].text !== '---') { i++; continue; }
    const attempt = tryParseFrontmatter(lines, i);
    if (attempt) return attempt;
    i++;
  }
  // Fallback: bare frontmatter (no opening '---' delimiter).
  // Scan the first ~12 lines for a 'key: value' line — if found, treat that
  // as the start of a frontmatter block (key lines until a closing '---'
  // or a non-key-value line).
  const cap = Math.min(lines.length, 12);
  for (let j = 0; j < cap; j++) {
    if (/^([A-Za-z_]+)\s*:\s*/.test(lines[j].text)) {
      const attempt = tryParseBareFrontmatter(lines, j);
      if (attempt) return attempt;
      break;
    }
  }
  throw new LessonMarkdownError('Lesson must start with a frontmatter block containing a title (either "---" delimited or as simple "key: value" lines). Make sure you paste the lesson itself, not the prompt or instructions.');
}

/** Parse a frontmatter block that starts with a 'key: value' line (no opening '---'). */
function tryParseBareFrontmatter(lines: Line[], start: number): Frontmatter | null {
  const fm: Record<string, string> = {};
  let i = start;
  for (; i < lines.length; i++) {
    const text = lines[i].text;
    if (text === '---') { i++; break; }                  // consume closing ---
    const m = text.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (!m) break;                                       // end of key block
    fm[m[1].toLowerCase()] = m[2].trim();
  }
  if (!fm.title) return null;
  const ab = (fm.authored_by || '').toLowerCase();
  return {
    title: fm.title,
    id: fm.id ? slug(fm.id) : undefined,
    part: fm.part != null && fm.part !== '' ? Number(fm.part) : undefined,
    version: fm.version || undefined,
    summary: fm.summary || undefined,
    authored_by: ab === 'human' || ab === 'ai' || ab === 'hybrid' ? ab : undefined,
    rest: lines.slice(i),
  };
}

// ── Node splitting (fence/directive aware) ─────────────────────────────────
// A node starts at a top-level "# Heading". We must NOT treat "#" lines inside
// code fences, math blocks, or ::: directives as headings (that bug - Python
// comments like "# VULNERABLE" being read as nodes - is exactly what a naive
// splitter gets wrong).

interface RawNode {
  title: string;
  startLine: number;
  body: Line[];
}

function splitNodes(lines: Line[]): RawNode[] {
  const nodes: RawNode[] = [];
  let current: RawNode | null = null;
  let fence: string | null = null; // active code fence marker (``` or ~~~ run)
  let inMath = false;
  let directiveDepth = 0;

  for (const ln of lines) {
    const fenceMatch = ln.text.match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (fenceMatch && ln.text.startsWith(fence)) fence = null;
      current?.body.push(ln);
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      current?.body.push(ln);
      continue;
    }
    if (ln.text === '$$') {
      inMath = !inMath;
      current?.body.push(ln);
      continue;
    }
    if (inMath) { current?.body.push(ln); continue; }
    if (/^:{3,}/.test(ln.text)) {
      if (/^:{3,}\s*$/.test(ln.text)) directiveDepth = Math.max(0, directiveDepth - 1);
      else directiveDepth++;
      current?.body.push(ln);
      continue;
    }
    if (directiveDepth === 0) {
      const h = ln.text.match(/^#\s+(.+)$/);
      if (h) {
        if (current) nodes.push(current);
        current = { title: h[1].trim(), startLine: ln.no, body: [] };
        continue;
      }
    }
    current?.body.push(ln);
  }
  if (current) nodes.push(current);
  if (nodes.length === 0) {
    throw new LessonMarkdownError('No nodes found. Each concept must start with a top-level "# Heading".');
  }
  return nodes;
}

// ── Block parsing within a node body ───────────────────────────────────────

function parseBlocks(body: Line[], nodeId: string): { blocks: LdocBlock[]; grounding?: LdocGrounding } {
  const blocks: LdocBlock[] = [];
  let grounding: LdocGrounding | undefined;
  let bn = 0;
  const id = () => `${nodeId}-b${++bn}`;
  let prose: string[] = [];

  const flushProse = () => {
    const md = prose.join('\n').trim();
    if (md) blocks.push({ id: id(), type: 'prose', md });
    prose = [];
  };

  for (let i = 0; i < body.length; i++) {
    const ln = body[i];

    // node attributes
    const at = ln.text.match(/^@(mastery|prereq)\s+(.*)$/);
    if (at) { (body as any).__attrs = (body as any).__attrs || {}; (body as any).__attrs[at[1]] = at[2].trim(); continue; }

    // fenced code / mermaid (preserve interior verbatim - backticks safe)
    const fence = ln.text.match(/^(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fence) {
      flushProse();
      const marker = fence[1];
      const lang = (fence[2] || '').toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < body.length && !body[i].text.startsWith(marker)) { buf.push(body[i].raw); i++; }
      const code = buf.join('\n');
      if (lang === 'mermaid') blocks.push({ id: id(), type: 'mermaid', src: code });
      else blocks.push({ id: id(), type: 'code', lang: lang || 'text', src: code, runnable: false });
      continue;
    }

    // GitHub-style Markdown table: | h | h | / | --- | --- | / rows
    const isTableRow = (s: string) => /^\s*\|(.+)\|\s*$/.test(s);
    const isDivider = (s: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
    if (isTableRow(ln.text) && i + 1 < body.length && isDivider(body[i + 1].text)) {
      flushProse();
      const splitCells = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const headers = splitCells(ln.text);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < body.length && isTableRow(body[i].text)) {
        bodyRows.push(splitCells(body[i].text));
        i++;
      }
      i--;
      const columns = headers.map((title, idx) => ({ title, field: `c${idx}` }));
      const rows = bodyRows.map((cells) => {
        const row: Record<string, unknown> = {};
        headers.forEach((_, idx) => { row[`c${idx}`] = cells[idx] ?? ''; });
        return row;
      });
      blocks.push({ id: id(), type: 'table', columns, rows });
      continue;
    }

    // math $$ ... $$
    if (ln.text === '$$') {
      flushProse();
      const buf: string[] = [];
      i++;
      while (i < body.length && body[i].text !== '$$') { buf.push(body[i].raw); i++; }
      blocks.push({ id: id(), type: 'math', tex: buf.join('\n').trim() });
      continue;
    }

    // standalone image  ![alt](url)
    const img = ln.text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      flushProse();
      blocks.push({ id: id(), type: 'image', url: img[2], alt: img[1], source: '', license: '' });
      continue;
    }

    // directive blocks ::: kind ... (space after ::: is OPTIONAL — `:::flow sankey`
    // and `:::illustration {...}` must parse exactly like `::: flow sankey`)
    const dir = ln.text.match(/^:{3,}(?:\s+)?(\w+)\s*(.*)$/);
    if (dir) {
      flushProse();
      const kind = dir[1].toLowerCase();
      const args = dir[2].trim();
      const openLine = ln.no;
      const inner: Line[] = [];
      let depth = 1;
      i++;
      while (i < body.length && depth > 0) {
        if (/^:{3,}(?:\s+)?\w/.test(body[i].text)) depth++;
        else if (/^:{3,}\s*$/.test(body[i].text)) { depth--; if (depth === 0) break; }
        inner.push(body[i]);
        i++;
      }
      if (depth > 0) {
        throw new LessonMarkdownError(
          `Unclosed "::: ${kind}" block: never found its matching ":::" closing line. ` +
            `Add a bare ":::" line right after this block's content. ` +
            `(An unclosed block silently swallows everything after it in the node, including a later "::: grounding" block.)`,
          openLine,
        );
      }
      if (depth > 0) {
        throw new LessonMarkdownError(
          `Unclosed "::: ${kind}" block at line ${ln.no} — never found its matching ":::" closing line. ` +
          `Add a bare ":::" line right after this block's content. ` +
          `(An unclosed block silently swallows everything after it in the node, ` +
          `including a later "::: grounding" block.)`,
          ln.no,
        );
      }
      if (kind === 'grounding') grounding = parseGrounding(inner);
      else if (kind === 'callout') blocks.push({ id: id(), type: 'callout', tone: args || 'info', md: inner.map((l) => l.raw).join('\n').trim() });
      else if (kind === 'quiz') blocks.push(parseQuiz(inner, args, id(), ln.no));
      else if (kind === 'annotated-code') {
        // ::: annotated-code <lang>
        // Lines with // @id <target> become annotation targets
        // Lines after the code block with "- @id: explanation" become entries
        const lang = args?.trim() || 'text';
        const codeLines: string[] = [];
        const targets: Array<{ id: string; line: number; label: string; entries: string[] }> = [];
        let inEntries = false;
        let currentTarget: { id: string; line: number; label: string; entries: string[] } | null = null;
        for (const line of inner) {
          const raw = line.raw;
          const idMatch = raw.match(/\/\/\s*@id\s+(\S+)/);
          if (idMatch) {
            if (currentTarget) targets.push(currentTarget);
            currentTarget = { id: idMatch[1], line: codeLines.length + 1, label: '', entries: [] };
            inEntries = false;
          } else if (currentTarget && raw.match(/^-\s+@\w+:?\s*/)) {
            inEntries = true;
            const entryText = raw.replace(/^-\s+@\w+:?\s*/, '').trim();
            if (entryText) currentTarget.entries.push(entryText);
          } else if (currentTarget && inEntries && raw.trim().startsWith('-')) {
            currentTarget.entries.push(raw.trim().replace(/^-\s*/, ''));
          } else if (!inEntries) {
            codeLines.push(raw);
          }
        }
        if (currentTarget) targets.push(currentTarget);
        blocks.push({
          id: id(),
          type: 'annotated-code',
          lang,
          code: codeLines.join('\n'),
          targets,
        } as any);
      } else if (kind === 'annotated-math') {
        // ::: annotated-math
        // LaTeX with \htmlId{m-x}{symbol} targets
        // Lines after the math block with "- @m-x: explanation" become entries
        const mathLines: string[] = [];
        const targets: Array<{ id: string; symbol: string; entries: string[] }> = [];
        let inEntries = false;
        let currentTarget: { id: string; symbol: string; entries: string[] } | null = null;
        for (const line of inner) {
          const raw = line.raw;
          const htmlIdMatch = raw.match(/\\htmlId\{(\w+)\}\{([^}]+)\}/);
          const entryMatch = raw.match(/^-\s+@(\w+):\s*(.+)/);
          if (entryMatch) {
            inEntries = true;
            const targetId = entryMatch[1];
            const entryText = entryMatch[2].trim();
            if (!currentTarget || currentTarget.id !== targetId) {
              if (currentTarget) targets.push(currentTarget);
              currentTarget = { id: targetId, symbol: '', entries: entryText ? [entryText] : [] };
            } else {
              currentTarget.entries.push(entryText);
            }
          } else if (!inEntries) {
            mathLines.push(raw);
            if (htmlIdMatch && currentTarget && currentTarget.id === htmlIdMatch[1]) {
              currentTarget.symbol = htmlIdMatch[2];
            }
          }
        }
        if (currentTarget) targets.push(currentTarget);
        blocks.push({
          id: id(),
          type: 'annotated-math',
          latex: mathLines.join('\n').trim(),
          targets,
        } as any);
      } else if (kind === 'layer') {
        const [revealRaw, modeRaw] = args.split(/\s+/);
        const sub = parseBlocks(inner, `${nodeId}-l${bn}`);
        blocks.push({
          id: id(),
          type: 'layer',
          reveal_at: asMastery(revealRaw || 'L4', ln.no),
          mode: modeRaw === 'remedial' ? 'remedial' : 'deeper',
          blocks: sub.blocks,
        });
      } else if (kind === 'chart') {
        const spec = inner.map((l) => l.raw).join('\n').trim();
        let parsed: Record<string, unknown> | undefined;
        try { parsed = JSON.parse(spec); } catch { /* keep raw */ }
        blocks.push({ id: id(), type: 'chart', spec, parsed, caption: args || undefined });
      } else if (kind === 'table') {
        const lines = inner.map((l) => l.raw);
        let columns: { title: string; field: string }[] = [];
        let rows: Record<string, unknown>[] = [];
        let parsing = 'columns';
        for (const ln of lines) {
          if (/^rows:/i.test(ln.trim())) { parsing = 'rows'; continue; }
          if (/^options:/i.test(ln.trim())) { parsing = 'options'; continue; }
          if (parsing === 'columns') {
            const cm = ln.trim().match(/^-\s*\[([^|]+)\|([^\]]+)\]\s*$/);
            if (cm) columns.push({ title: cm[1].trim(), field: cm[2].trim() });
          } else if (parsing === 'rows') {
            try { rows.push(JSON.parse(ln.trim())); } catch { /* skip bad row */ }
          }
        }
        blocks.push({ id: id(), type: 'table', columns, rows, caption: args || undefined });
      } else if (kind === 'flow') {
        const spec = inner.map((l) => l.raw).join('\n').trim();
        const variant = args.toLowerCase() === 'waterfall' ? 'waterfall' : 'sankey';
        const edges: { from: string; to: string; value: number }[] = [];
        for (const ln of inner) {
          const em = ln.text.match(/^-\s*(.+?)\s*->\s*(.+?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
          if (em) edges.push({ from: em[1].trim(), to: em[2].trim(), value: Number(em[3]) });
        }
        blocks.push({ id: id(), type: 'flow', variant, spec, edges: edges.length ? edges : undefined, caption: args || undefined });
      } else if (kind === 'finchart') {
        const spec = inner.map((l) => l.raw).join('\n').trim();
        let parsed: { type?: string; data?: Record<string, unknown>[]; indicators?: string[] } | undefined;
        try { parsed = JSON.parse(spec); } catch { /* keep raw */ }
        blocks.push({ id: id(), type: 'finchart', spec, parsed, caption: args || undefined });
      } else if (kind === 'figure') {
        // ::: figure — strictly for static SVG diagrams
        const svgContent = inner.map((l) => l.raw).join('\n').trim();
        if (!svgContent.includes('<svg')) {
          throw new LessonMarkdownError(
            `::: figure block must contain SVG content (found no <svg> tag). Use ::: html for non-SVG interactive content.`,
            ln.no,
          );
        }
        blocks.push({ id: id(), type: 'figure', svg: svgContent, caption: args || undefined });
      } else if (kind === 'html') {
        // ::: html — strictly for HTML/CSS/JS sandboxed content
        const htmlContent = inner.map((l) => l.raw).join('\n').trim();
        blocks.push({ id: id(), type: 'html', html: htmlContent, caption: args || undefined });
      } else if (kind === 'layer_reveal') {
        // :::layer_reveal {"title": "..."} or :::layer_reveal Title here
        let title = args;
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); title = (meta.title as string) || args; } catch { /* use raw args as title */ }
        const steps: Array<{ id: string; label: string; content: string; hint?: string; mastery_unlock?: string }> = [];
        let currentStep: { id: string; label: string; content: string; hint?: string; mastery_unlock?: string } | null = null;
        for (const line of inner) {
          const stepMatch = line.text.match(/^Step\s+(\d+):\s*(.+)/i);
          const hintMatch = line.text.match(/^Hint:\s*(.+)/i);
          const unlockMatch = line.text.match(/^Unlock:\s*(.+)/i);
          if (stepMatch) {
            if (currentStep) steps.push(currentStep);
            currentStep = { id: `step-${stepMatch[1]}`, label: stepMatch[2].trim(), content: '' };
          } else if (hintMatch && currentStep) {
            currentStep.hint = hintMatch[1].trim();
          } else if (unlockMatch && currentStep) {
            currentStep.mastery_unlock = unlockMatch[1].trim();
          } else if (currentStep) {
            currentStep.content += (currentStep.content ? '\n' : '') + line.text;
          }
        }
        if (currentStep) steps.push(currentStep);
        blocks.push({
          id: id(),
          type: 'layer_reveal',
          meta: {
            title: title || 'Steps',
            steps: steps.map(s => ({ ...s, content: s.content.trim(), mastery_unlock: (s.mastery_unlock || 'L0') as any })),
            reveal_mode: ((meta.reveal_mode as string) || 'sequential') as 'sequential' | 'free' | 'mastery_gated',
            default_unlocked: (meta.default_unlocked as number) || 1,
            allow_backtrack: (meta.allow_backtrack as boolean) !== false,
          },
        });
      } else if (kind === 'viz_concept_map' || kind === 'concept_map') {
        // :::viz_concept_map {"title": "..."} or :::viz_concept_map Title
        let title = args;
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); title = (meta.title as string) || args; } catch { /* use raw args */ }
        // Parse indented tree from inner content
        const root = parseConceptMapTree(inner);
        blocks.push({
          id: id(),
          type: 'viz_concept_map',
          meta: {
            root: { id: 'root', label: title || 'Concept Map', ...root },
            max_depth: (meta.max_depth as number) || 5,
            color_by_mastery: (meta.color_by_mastery as boolean) !== false,
            collapsible: (meta.collapsible as boolean) !== false,
          },
        });
      } else if (kind === 'flashcard') {
        // :::flashcard {"deck_id": "...", "card_type": "basic"}
        let cardMeta: Record<string, unknown> = {};
        try { cardMeta = JSON.parse(args); } catch { /* empty meta */ }
        let front = '';
        let back = '';
        for (const line of inner) {
          const frontMatch = line.text.match(/^Front:\s*(.+)/i);
          const backMatch = line.text.match(/^Back:\s*(.+)/i);
          if (frontMatch) front = frontMatch[1].trim();
          else if (backMatch) back = backMatch[1].trim();
          else if (!front) front += (front ? '\n' : '') + line.text;
          else back += (back ? '\n' : '') + line.text;
        }
        blocks.push({
          id: id(),
          type: 'flashcard',
          meta: {
            deck_id: (cardMeta.deck_id as string) || 'default',
            card_type: (cardMeta.card_type as string) || 'basic',
            front: front.trim(),
            back: back.trim(),
            tags: (cardMeta.tags as string[]) || [],
          },
        });
      } else if (kind === 'viz_heatmap' || kind === 'heatmap') {
        // :::viz_heatmap or :::viz_heatmap {"date_range": "last_90_days"}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        blocks.push({
          id: id(),
          type: 'viz_heatmap',
          meta: {
            data_source: (meta.data_source as string) || 'study_sessions',
            date_range: (meta.date_range as string) || 'last_90_days',
            cell_size: (meta.cell_size as number) || 13,
          },
        });
      } else if (kind === 'viz_graph' || kind === 'knowledge_graph') {
        // :::viz_graph or :::viz_graph {"layout": "force"}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        const nodes: Array<{ id: string; label: string; mastery_level?: string }> = [];
        const edges: Array<{ id: string; source: string; target: string; label?: string }> = [];
        for (const line of inner) {
          const nodeMatch = line.text.match(/^-\s*node:\s*(.+?)\s*(?:\((.+?)\))?\s*$/i);
          const edgeMatch = line.text.match(/^-\s*edge:\s*(.+?)\s*->\s*(.+?)(?:\s*\[(.+?)\])?\s*$/i);
          if (nodeMatch) {
            nodes.push({ id: nodeMatch[1].trim().toLowerCase().replace(/\s+/g, '-'), label: nodeMatch[1].trim(), mastery_level: nodeMatch[2]?.trim() });
          } else if (edgeMatch) {
            edges.push({ id: `e-${edges.length}`, source: edgeMatch[1].trim().toLowerCase().replace(/\s+/g, '-'), target: edgeMatch[2].trim().toLowerCase().replace(/\s+/g, '-'), label: edgeMatch[3]?.trim() });
          }
        }
        blocks.push({
          id: id(),
          type: 'viz_graph',
          meta: {
            graph_type: (meta.graph_type as string) || 'force',
            layout: (meta.layout as string) || 'force',
            nodes,
            edges,
            highlight_mastery: (meta.highlight_mastery as boolean) !== false,
          },
        });
      } else if (kind === 'viz_timeline' || kind === 'timeline') {
        // :::viz_timeline or :::viz_timeline {"target_level": "L3"}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        const events: Array<{ date: string; type: string; score?: number; description?: string }> = [];
        const series: Array<{ date: string; value: number; target: number }> = [];
        for (const line of inner) {
          const eventMatch = line.text.match(/^-\s*(\d{4}-\d{2}-\d{2}):\s*(\w+)\s*(?:@\s*(\d+))?\s*[-–]\s*(.+)/i);
          const seriesMatch = line.text.match(/^(\d{4}-\d{2}-\d{2}):\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
          if (eventMatch) {
            events.push({ date: eventMatch[1], type: eventMatch[2], score: eventMatch[3] ? Number(eventMatch[3]) : undefined, description: eventMatch[4].trim() });
          } else if (seriesMatch) {
            series.push({ date: seriesMatch[1], value: Number(seriesMatch[2]), target: Number(seriesMatch[3]) });
          }
        }
        blocks.push({
          id: id(),
          type: 'viz_timeline',
          meta: {
            node_id: (meta.node_id as string) || undefined,
            date_range: (meta.date_range as string) || 'last_30_days',
            show_events: (meta.show_events as boolean) !== false,
            show_target_line: (meta.show_target_line as boolean) !== false,
            target_level: ((meta.target_level as string) || 'L3') as any,
            height: (meta.height as number) || 200,
            events,
            series,
          },
        });
      } else if (kind === 'illustration') {
        // :::illustration {"prompt": "...", "concept": "..."}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        // Also check inner content for prompt if not in args
        let prompt = (meta.prompt as string) || '';
        let concept = (meta.concept as string) || '';
        if (!prompt) {
          // Try to extract from inner content
          for (const line of inner) {
            const promptMatch = line.text.match(/^prompt:\s*(.+)/i);
            const conceptMatch = line.text.match(/^concept:\s*(.+)/i);
            if (promptMatch) prompt = promptMatch[1].trim();
            else if (conceptMatch) concept = conceptMatch[1].trim();
            else if (!prompt) prompt += (prompt ? '\n' : '') + line.text;
          }
        }
        blocks.push({
          id: id(),
          type: 'illustration',
          meta: {
            prompt: prompt.trim(),
            concept: concept.trim() || undefined,
            image_path: (meta.image_path as string) || undefined,
            generated: false,
          },
        });
      } else if (kind === 'whiteboard') {
        // :::whiteboard {"read_only": true}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        blocks.push({
          id: id(),
          type: 'whiteboard',
          meta: {
            read_only: (meta.read_only as boolean) || false,
            allow_export: (meta.allow_export as boolean) !== false,
            width: (meta.width as string) || '100%',
            height: (meta.height as string) || '400px',
          },
        });
      } else if (kind === 'animation') {
        // :::animation {"dsl": {...}, "title": "...", "concept": "...", "preset": "..."}
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(args); } catch { /* empty */ }
        let dsl: Record<string, unknown> | null = null;
        let title = '';
        let concept = '';
        let preset = '';
        if (meta.dsl && typeof meta.dsl === 'object') {
          dsl = meta.dsl as Record<string, unknown>;
        } else if (Object.keys(meta).length > 0) {
          dsl = meta;
        }
        // Also check inner content for fields not in args
        for (const line of inner) {
          const titleMatch = line.text.match(/^title:\s*(.+)/i);
          const conceptMatch = line.text.match(/^concept:\s*(.+)/i);
          const presetMatch = line.text.match(/^preset:\s*(.+)/i);
          if (titleMatch) title = titleMatch[1].trim();
          else if (conceptMatch) concept = conceptMatch[1].trim();
          else if (presetMatch) preset = presetMatch[1].trim();
        }
        if (!title && meta.title) title = String(meta.title);
        if (!concept && meta.concept) concept = String(meta.concept);
        if (!preset && meta.preset) preset = String(meta.preset);
        blocks.push({
          id: id(),
          type: 'animation',
          meta: {
            engine: 'elucim',
            dsl,
            title: title || undefined,
            concept: concept || undefined,
            preset: preset || undefined,
            generated: dsl !== null,
          },
        });
      } else if (kind === 'video_asset') {
        // :::video_asset
        // ```python
        // <manim source>
        // ```
        // scene: SlopeScene
        // quality: low
        // caption: The secant line approaches the tangent
        let pythonSource = '';
        let sceneName = '';
        let quality: 'low' | 'medium' | 'high' = 'medium';
        let caption = '';
        // Extract fenced python code from inner content
        let inFence = false;
        let fenceLang = '';
        for (const line of inner) {
          const fenceMatch = line.text.match(/^```(\w*)/);
          if (fenceMatch && !inFence) {
            inFence = true;
            fenceLang = fenceMatch[1];
            continue;
          }
          if (line.text.trim() === '```' && inFence) {
            inFence = false;
            continue;
          }
          if (inFence && (fenceLang === 'python' || fenceLang === 'py' || !fenceLang)) {
            pythonSource += (pythonSource ? '\n' : '') + line.text;
          } else if (!inFence) {
            const sceneMatch = line.text.match(/^scene:\s*(.+)/i);
            const qualityMatch = line.text.match(/^quality:\s*(low|medium|high)/i);
            const captionMatch = line.text.match(/^caption:\s*(.+)/i);
            if (sceneMatch) sceneName = sceneMatch[1].trim();
            else if (qualityMatch) quality = qualityMatch[1].toLowerCase() as 'low' | 'medium' | 'high';
            else if (captionMatch) caption = captionMatch[1].trim();
          }
        }
        // Fallback: detect scene name from class declaration
        if (!sceneName && pythonSource) {
          const classMatch = pythonSource.match(/class\s+(\w+)\s*\(\s*Scene\s*\)/);
          if (classMatch) sceneName = classMatch[1];
        }
        blocks.push({
          id: id(),
          type: 'video_asset',
          meta: {
            engine: 'manim',
            python_source: pythonSource,
            scene_name: sceneName || undefined,
            quality,
            generated: false,
            render_status: 'pending' as const,
            caption: caption || undefined,
          },
        });
      } else {
        // unknown directive -> keep as prose so nothing is silently lost
        prose.push(inner.map((l) => l.raw).join('\n'));
      }
      continue;
    }

    prose.push(ln.raw);
  }
  flushProse();
  return { blocks, grounding };
}

// ── Concept Map Tree Parser ────────────────────────────────────────────────

function parseConceptMapTree(inner: Line[]): { label: string; description?: string; mastery_target?: string; misconception?: string; children?: any[] } {
  const root: { label: string; children: any[] } = { label: '', children: [] };
  const stack: { node: any; indent: number }[] = [{ node: root, indent: -1 }];

  for (const line of inner) {
    const text = line.text.replace(/\t/g, '  ');
    const indent = text.length - text.trimStart().length;
    const trimmed = text.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Parse node: "- Label" or "- Label (L2)" or "- Label | description"
    const nodeMatch = trimmed.match(/^-\s+(.+)/);
    if (!nodeMatch) continue;

    let label = nodeMatch[1].trim();
    let description: string | undefined;
    let mastery_target: string | undefined;
    let misconception: string | undefined;

    // Check for mastery level: "- Label (L2)"
    const levelMatch = label.match(/\((L[0-5])\)\s*$/);
    if (levelMatch) {
      mastery_target = levelMatch[1];
      label = label.replace(/\s*\([Ll]\d\)\s*$/, '').trim();
    }

    // Check for description: "- Label — description" or "- Label | description"
    const descMatch = label.match(/^(.+?)\s*[—|]\s*(.+)/);
    if (descMatch) {
      label = descMatch[1].trim();
      description = descMatch[2].trim();
    }

    // Check for misconception: "- Label !wrong belief → correction"
    const miscMatch = label.match(/^(.+?)\s*!(.+?)\s*→\s*(.+)/);
    if (miscMatch) {
      label = miscMatch[1].trim();
      misconception = `${miscMatch[2].trim()} → ${miscMatch[3].trim()}`;
    }

    const node: any = { id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label };
    if (description) node.description = description;
    if (mastery_target) node.mastery_target = mastery_target;
    if (misconception) node.misconception = misconception;
    node.children = [];

    // Find parent based on indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    parent.children.push(node);
    stack.push({ node, indent });
  }

  // Return first child of root, or root itself
  return root.children.length > 0 ? root.children[0] : { label: 'Concept Map', children: [] };
}

// ── Quiz ───────────────────────────────────────────────────────────────────

function parseQuiz(inner: Line[], args: string, blockId: string, line: number): LdocBlock {
  const parts = args.split(/\s+/).filter(Boolean);
  const format = (parts[0] || 'mcq').toLowerCase() as QuizFormat;
  const level = asMastery(parts[1] || 'L2', line);
  let q = '';
  const options: string[] = [];
  let answerIndex = -1;
  let numericAnswer: number | undefined;
  const rubric: Record<string, string> = {};
  let explain = '';

  for (const ln of inner) {
    const opt = ln.text.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (opt) {
      if (opt[1].toLowerCase() === 'x') answerIndex = options.length;
      options.push(opt[2].trim());
      continue;
    }
    const ans = ln.text.match(/^answer\s*:\s*(.+)$/i);
    if (ans) { numericAnswer = Number(ans[1].trim()); continue; }
    const exp = ln.text.match(/^(?:explain|explanation)\s*:\s*(.+)$/i);
    if (exp) { explain = exp[1].trim(); continue; }
    const rub = ln.text.match(/^rubric\s*:\s*(.+)$/i);
    if (rub) { rubric.criteria = rub[1].trim(); continue; }
    if (ln.text && !q) {
      // Strip question/Q prefix if present
      const stripped = ln.text.replace(/^(?:question|Q)\s*:\s*/i, '');
      q = stripped;
    }
    else if (ln.text) q += ' ' + ln.text;
  }
  if (!q) throw new LessonMarkdownError('A quiz needs a question line.', line);

  const block: any = { id: blockId, type: 'quiz', format, q, level };
  if (format === 'mcq') {
    if (options.length < 2) throw new LessonMarkdownError('An mcq quiz needs at least two "- [ ]" options.', line);
    if (answerIndex < 0) throw new LessonMarkdownError('Mark the correct mcq option with "- [x]".', line);
    block.options = options;
    block.answer_key = answerIndex; // zero-based index
  } else if (format === 'numeric') {
    if (numericAnswer == null || Number.isNaN(numericAnswer)) throw new LessonMarkdownError('A numeric quiz needs "answer: <number>".', line);
    block.answer_key = numericAnswer;
  } else {
    block.rubric = Object.keys(rubric).length ? rubric : { criteria: 'A good answer addresses the question accurately and completely.' };
  }
  if (explain) (block as any).explain = explain;
  return block as LdocBlock;
}

// ── Grounding ──────────────────────────────────────────────────────────────

function parseGrounding(inner: Line[]): LdocGrounding {
  const must_know: { claim: string; source_id: string }[] = [];
  const sources: { id: string; url: string; title: string }[] = [];
  const misconceptions: { wrong: string; correct: string }[] = [];
  let includes = '';
  let excludes: string[] = [];

  for (const ln of inner) {
    const inc = ln.text.match(/^includes?\s*:\s*(.+)$/i);
    if (inc) { includes = inc[1].trim(); continue; }
    const exc = ln.text.match(/^excludes?\s*:\s*(.+)$/i);
    if (exc) { excludes = exc[1].split(';').map((s) => s.trim()).filter(Boolean); continue; }
    const know = ln.text.match(/^know\s*:\s*(.+?)\s*\[([^\]]+)\]\s*$/i);
    if (know) { must_know.push({ claim: know[1].trim(), source_id: know[2].trim() }); continue; }
    // Strict check: know: with trailing punctuation after bracket
    const knowBad = ln.text.match(/^know\s*:\s*(.+?)\s*\[([^\]]+)\]\s*[.!?,;:]+/i);
    if (knowBad) {
      throw new LessonMarkdownError(
        `know: line must end exactly with the closing bracket [${knowBad[2]}]. No trailing punctuation (.!?,;:) allowed.`,
        ln.no,
      );
    }
    const src = ln.text.match(/^source\s*:\s*([^|]+)\|([^|]+)\|(.+)$/i);
    if (src) { sources.push({ id: src[1].trim(), title: src[2].trim(), url: src[3].trim() }); continue; }
    const mis = ln.text.match(/^misconception\s*:\s*([^|]+)\|(.+)$/i);
    if (mis) { misconceptions.push({ wrong: mis[1].trim(), correct: mis[2].trim() }); continue; }
  }

  const g: LdocGrounding = {
    must_know,
    scope: { includes, excludes: excludes.length ? excludes : undefined },
    sources,
  };
  if (misconceptions.length) g.misconceptions = misconceptions;
  return g;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parseLessonMarkdown(source: string): LdocDocument {
  const lines = toLines(source);
  const fm = parseFrontmatter(lines);
  const rawNodes = splitNodes(fm.rest);

  const usedIds = new Set<string>();
  const nodes: LdocNode[] = rawNodes.map((rn) => {
    let nodeId = slug(rn.title);
    while (usedIds.has(nodeId)) nodeId = `${nodeId}-x`;
    usedIds.add(nodeId);

    const { blocks, grounding } = parseBlocks(rn.body, nodeId);
    const attrs: Record<string, string> = (rn.body as any).__attrs || {};
    const mastery = asMastery(attrs.mastery || 'L2', rn.startLine);
    const prereq = attrs.prereq ? attrs.prereq.split(/\s+/).map(slug).filter(Boolean) : undefined;

    if (!grounding) {
      throw new LessonMarkdownError(`Node "${rn.title}" is missing its "::: grounding" block (required).`, rn.startLine);
    }
    if (grounding.must_know.length === 0) throw new LessonMarkdownError(`Node "${rn.title}" grounding needs at least one "know: ... [src]" fact.`, rn.startLine);
    if (!grounding.scope.includes) throw new LessonMarkdownError(`Node "${rn.title}" grounding needs an "includes:" scope line.`, rn.startLine);
    if (grounding.sources.length === 0) throw new LessonMarkdownError(`Node "${rn.title}" grounding needs at least one "source: id | Title | url" line.`, rn.startLine);

    const node: LdocNode = { id: nodeId, title: rn.title, mastery_target: mastery, blocks, grounding };
    if (prereq && prereq.length) node.prereq = prereq;

    // Rule: L2+ nodes need at least one visual block.
    if (mastery !== 'L0' && mastery !== 'L1' && !blocks.some((b) => VISUAL_TYPES.has(b.type))) {
      throw new LessonMarkdownError(`Node "${rn.title}" targets ${mastery} and needs at least one visual block (mermaid, image, math, or widget).`, rn.startLine);
    }
    return node;
  });

  const lesson: LdocLesson = {
    id: fm.id || slug(fm.title),
    title: fm.title,
    part: fm.part ?? 0,
    version: fm.version || '1.0.0',
    summary: fm.summary,
    authored_by: fm.authored_by || 'ai',
  };

  return { doc: 'ldoc/1.0', lesson, nodes };
}
