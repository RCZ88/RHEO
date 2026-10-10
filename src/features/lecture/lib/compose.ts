import { estimateTokens, optimizePrompt } from './tokens';

export type SourceKind = 'deck' | 'slide' | 'image' | 'transcript' | 'web' | 'prompt' | 'research' | 'recipe';

/**
 * One selectable thing. Everything is flattened to this shape so a PowerPoint
 * slide, a YouTube digest and a raw transcript can sit in the same list and be
 * combined in one pass — mixing source types was the whole point.
 */
export interface SourceItem {
  /** Stable composite key, e.g. "deck:3", "slide:12", "web:5". */
  id: string;
  kind: SourceKind;
  title: string;
  sub?: string;
  /** Payload actually pasted into the prompt. */
  text: string;
  /** Tokens this source would consume on its own. */
  tokens?: number;
  /** Extra provenance for the header line (e.g. deck name for a slide). */
  origin?: string;
}

export const KIND_LABEL: Record<SourceKind, string> = {
  deck: 'Deck',
  slide: 'Slide',
  image: 'Figure',
  transcript: 'Transcript',
  web: 'Web / YouTube',
  prompt: 'Saved prompt',
  research: 'Research note',
  recipe: 'Recipe',
};

export const KIND_ORDER: SourceKind[] = ['deck', 'slide', 'image', 'transcript', 'web', 'prompt', 'research', 'recipe'];

export function tokenOf(s: SourceItem): number {
  return s.tokens != null && s.tokens > 0 ? s.tokens : estimateTokens(s.text);
}

export interface ComposeOptions {
  task: string;
  lang?: 'en' | 'id' | 'mixed';
  maxTokens?: number;
  /** Truncate each source's payload to this many tokens (0/undefined = no cap). */
  perSourceCap?: number;
}

export interface ComposeResult {
  text: string;
  included: SourceItem[];
  dropped: SourceItem[];
  tokens: number;
  budget: number;
}

/**
 * Combine N heterogeneous sources into ONE prompt.
 *
 * Rules that matter:
 * - Every source keeps a numbered, attributed header, so the model can cite
 *   which piece of evidence a claim came from.
 * - Order is the caller's order (default: as selected), never silently sorted.
 * - A source that will not fit is DROPPED WHOLE and named in the output. It is
 *   never sliced mid-sentence, because a half-quoted definition is worse than a
 *   missing one — the model will happily answer from the fragment.
 * - The single first source is always kept, so a deck of huge slides can never
 *   reduce the prompt to nothing (but only one, to avoid 2x budget blowout).
 */
export function composePrompt(sources: SourceItem[], opts: ComposeOptions): ComposeResult {
  const budget = opts.maxTokens ?? 8000;
  const lang = opts.lang ?? 'en';
  const cap = opts.perSourceCap && opts.perSourceCap > 0 ? opts.perSourceCap : 0;

  const list = sources.filter(s => s && (s.text || '').trim());
  const head = lang === 'id'
    ? `[KONTEKS] ${list.length} sumber dipilih`
    : `[CONTEXT] ${list.length} selected source${list.length === 1 ? '' : 's'}`;
  const task = opts.task?.trim() || (lang === 'id' ? 'Jelaskan seluruh materi ini.' : 'Explain all of this material.');
  const tail = lang === 'id'
    ? `\n\n[TUGAS] ${task}\nGunakan hanya materi di atas. K summonsumber di setiap klaim penting, lalu beri 3 pertanyaan latihan.`
    : `\n\n[TASK] ${task}\nUse only the material above. Cite the source number for every substantive claim, then give me 3 practice questions.`;

  let used = estimateTokens(head + tail);
  const included: { item: SourceItem; body: string; block: string }[] = [];
  const dropped: SourceItem[] = [];

  for (const s of list) {
    const body = trimToTokenCap(s.text.trim(), cap);
    const block = `[SOURCE ${included.length + 1} — ${KIND_LABEL[s.kind]}: ${s.title}${s.origin ? ` (from ${s.origin})` : ''}]\n${body}`;
    const cost = estimateTokens(block);
    // Force-keep exactly ONE source, so an over-budget selection still returns
    // something rather than an empty prompt. Forcing two let a pair of huge
    // slides overshoot the budget by 2x, which is worse than dropping one.
    const keepAnyway = included.length === 0;
    if (used + cost <= budget || keepAnyway) {
      included.push({ item: s, body, block });
      used += cost;
    } else {
      dropped.push(s);
    }
  }

  const dropNote = dropped.length
    ? (lang === 'id'
      ? `\n\n[CATATAN] Tidak disertakan karena batas token: ${dropped.map(d => `${KIND_LABEL[d.kind]} "${d.title}"`).join('; ')}.`
      : `\n\n[NOTE] Omitted to stay within ${budget} tokens: ${dropped.map(d => `${KIND_LABEL[d.kind]} "${d.title}"`).join('; ')}.`)
    : '';

  const text = included.length
    ? head + '\n\n' + included.map(e => e.block).join('\n\n') + dropNote + tail
    : head + '\n\n(no source content)' + tail;

  return {
    text: optimizePrompt(text),
    included: included.map(e => e.item),
    dropped,
    tokens: estimateTokens(text),
    budget,
  };
}

/**
 * Trim to a token cap on LINE boundaries.
 * Never cuts mid-sentence — a half-quoted definition is worse than none, because
 * the model will still answer from the fragment.
 */
function trimToTokenCap(body: string, cap: number): string {
  if (!cap || cap <= 0) return body;
  const out: string[] = [];
  let n = 0;
  for (const line of body.split('\n')) {
    const c = estimateTokens(line);
    if (n + c > cap && out.length) break;
    out.push(line);
    n += c;
  }
  return out.join('\n');
}

/** Total tokens of a selection, shown live in the tray. */
export function selectionTokens(sources: SourceItem[]): number {
  return sources.reduce((a, s) => a + tokenOf(s), 0);
}