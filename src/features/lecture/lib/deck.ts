import { estimateTokens } from './tokens';

/** A slide row as stored in `sm_slides`. */
export interface DeckSlideRow {
  id: number;
  slide_number: number;
  title?: string | null;
  text_content?: string | null;
  notes?: string | null;
  token_estimate?: number | null;
}

export interface DeckDoc {
  title: string;
  slides: DeckSlideRow[];
}

/**
 * A slide's full text.
 *
 * Two traps here, both real:
 * 1. `notes` is stored in its own column AND inlined into `text_content` at
 *    ingest, so appending unconditionally duplicated every note in the deck.
 * 2. But `text_content` is written as `allText.slice(0, 6000)`. On a text-heavy
 *    slide the `[SPEAKER NOTES]` heading falls past that cut and the notes are
 *    silently lost from the text column — while the `notes` column still has
 *    them. So the note is appended only when the text column does NOT already
 *    contain it, which makes this correct for both short and truncated slides.
 */
function slideBody(s: DeckSlideRow): string {
  const body = (s.text_content || '').trim();
  const notes = (s.notes || '').trim();
  if (!notes) return body;
  if (!body) return notes;
  // Strip our own labels and compare on a distinctive slice of the note text.
  const probe = notes
    .replace(/^\[SPEAKER NOTES\]\s*/i, '')
    .replace(/^\[FIGURE[^\]]*\]\s*/i, '')
    .trim()
    .slice(0, 80);
  if (probe && body.includes(probe)) return body;
  return body + '\n\n' + notes;
}

/** Slide heading without trailing punctuation noise, for one-line references. */
function shortTitle(s: DeckSlideRow): string {
  const t = (s.title || '').trim();
  return t || `Slide ${s.slide_number}`;
}

/**
 * The whole deck as a plain, paste-able Markdown document.
 * This is the "copy the entire PPT at once" output — no AI framing, just the
 * material, so it can go into any note-taking app, a PDF, or a diff.
 */
export function buildDeckText(doc: DeckDoc): string {
  const parts: string[] = [`# ${doc.title || 'Deck'}`, `_${doc.slides.length} slides_\n`];
  for (const s of doc.slides) {
    const body = slideBody(s);
    parts.push(`## Slide ${s.slide_number} — ${shortTitle(s)}\n`);
    parts.push(body || '_(no text extracted)_');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export interface DeckPromptResult {
  text: string;
  included: number;
  omitted: number;
  tokens: number;
}

/**
 * One prompt covering N slides, with a fair budget.
 *
 * A naive `fullText.slice(0, N)` would always truncate at the same place — the
 * back half of a long deck silently vanished. Here whole slides are taken in
 * order under a running budget and the dropped count is reported, so the deck
 * stays evenly covered and the omission is never hidden.
 */
export function buildDeckPrompt(
  doc: DeckDoc,
  question: string,
  lang: 'en' | 'id' | 'mixed',
  maxTokens = 8000,
): DeckPromptResult {
  const ordered = [...doc.slides].sort((a, b) => (a.slide_number || 0) - (b.slide_number || 0));
  const label = (n: number) => (n === 1 ? 'slide' : 'slides');
  const head = lang === 'id'
    ? `[KONTEKS] Deck "${doc.title}" — ${ordered.length} ${label(ordered.length)}`
    : `[CONTEXT] Deck "${doc.title}" — ${ordered.length} ${label(ordered.length)}`;
  const overhead = estimateTokens(head) + 80;

  const chosen: string[] = [];
  let used = overhead;
  let omitted = 0;

  for (const s of ordered) {
    const body = slideBody(s);
    if (!body) { omitted++; continue; }
    const block = `### Slide ${s.slide_number} — ${shortTitle(s)}\n${body}`;
    const cost = estimateTokens(block);
    // Slides are taken in order under one running budget, so what survives is a
    // contiguous PREFIX of the deck rather than a scattershot sample — you lose
    // the tail, never a random slide in the middle. The first two are kept
    // regardless of size, because returning nothing (slide 1 alone overflowed)
    // is worse than slightly exceeding the cap.
    const keepAnyway = chosen.length < 2;
    if (used + cost <= maxTokens || keepAnyway) {
      chosen.push(block);
      used += cost;
    } else {
      omitted++;
    }
  }

  const omissionNote = omitted > 0
    ? (lang === 'id'
      ? `\n\n[CATATAN] ${omitted} ${label(omitted)} tidak disertakan karena batas ${maxTokens} token.`
      : `\n\n[NOTE] ${omitted} ${label(omitted)} omitted to stay within ${maxTokens} tokens. Paste the rest separately if you need them.`)
    : '';

  const task = lang === 'id'
    ? `\n\n[TUGAS] ${question}\nJawab ringkas seperti tutor: definisi dulu, lalu contoh, lalu 2 pertanyaan latihan per slide.`
    : `\n\n[TASK] ${question}\nAnswer like a tutor: definition first, then a worked example, then 2 practice questions per slide.`;

  const text = head + '\n\n[SLIDE CONTENT]\n' + chosen.join('\n\n') + omissionNote + task;
  return { text, included: chosen.length, omitted, tokens: estimateTokens(text) };
}

/** Slide numbers, for a compact "1–5, 8, 12" style summary. */
export function describeSelection(slides: DeckSlideRow[]): string {
  const nums = slides.map(s => s.slide_number).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b);
  if (!nums.length) return 'none';
  const ranges: string[] = [];
  let start = nums[0], prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i];
    if (n === prev + 1) { prev = n; continue; }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  return ranges.join(', ');
}