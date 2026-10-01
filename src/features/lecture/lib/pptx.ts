import JSZip from 'jszip';
import { estimateTokens } from './tokens';

export interface ParsedShape { kind: string; text: string; level: number; }
export interface SlideImage { name: string; mime: string; base64: string; }
export interface ParsedSlide {
  number: number;
  title: string;
  shapes: ParsedShape[];
  /** Slide text PLUS speaker notes, labelled — notes are real lecture content. */
  allText: string;
  bodyText: string;
  notes: string;
  tableCells: number;
  imageCount: number;
  /** Embedded slide pictures as base64, ready to hand to a local vision model. */
  images: SlideImage[];
}
export interface ParsedDeck {
  slides: ParsedSlide[];
  meta: { images: number; fileName: string; notesSlides: number };
  /** Slides whose XML the DOM parser could not read. Never silently empty. */
  warnings: string[];
}

const MEDIA_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
  svg: 'image/svg+xml', emf: 'image/emf', wmf: 'image/wmf',
};

/** Guard rails: a 40-slide deck of 4K screenshots must not OOM the renderer. */
const MAX_IMAGES_PER_SLIDE = 6;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function textsOf(paragraph: Element): string {
  const runs = Array.from(paragraph.getElementsByTagName('a:t'));
  return runs.map(r => r.textContent || '').join('').trim();
}

function mimeFor(name: string): string {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  return MEDIA_MIME[ext] || 'application/octet-stream';
}

/**
 * Parse an OOXML part, reporting failure instead of returning an empty document.
 *
 * `DOMParser.parseFromString` never throws on malformed XML — it returns a
 * <parsererror> document. Because getElementsByTagName on that returns nothing,
 * a single mis-tagged shape made the whole slide come back with zero shapes, and
 * the UI showed a blank slide titled "Slide 1" with no indication that anything
 * had gone wrong. Callers must be able to tell.
 */
function parseXml(xml: string): { doc: Document; error: string | null } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (!err) return { doc, error: null };
  const raw = (err.textContent || '').replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering.*$/s, '').trim();
  return { doc, error: raw.slice(0, 200) || 'malformed XML' };
}

/** Resolve a rels Target ("../media/image1.png") against the owning part's folder. */
function resolveTarget(relsPath: string, target: string): string {
  const base = relsPath.replace(/_rels\/[^/]+$/, ''); // "ppt/slides/"
  const stack = base.split('/').filter(Boolean);
  for (const seg of target.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack.join('/');
}

/**
 * Speaker notes for a slide, read from ppt/notesSlides/notesSlideN.xml.
 *
 * These were silently discarded before, even though for a lecture deck they are
 * frequently the highest-value text on the slide (the lecturer's own framing,
 * caveats, and the worked example they will talk through). Only the `body`
 * placeholder is read so the slide-number and date placeholders — which render
 * as stray "1" / "10/1/2026" — never pollute the transcript.
 */
function notesTextOf(doc: Document): string {
  const parts: string[] = [];
  for (const sp of Array.from(doc.getElementsByTagName('p:sp'))) {
    const ph = sp.getElementsByTagName('p:ph')[0];
    const type = ph?.getAttribute('type') || '';
    if (type && type !== 'body') continue;
    const lines: string[] = [];
    for (const p of Array.from(sp.getElementsByTagName('a:p'))) {
      const t = textsOf(p);
      if (t) lines.push(t);
    }
    if (lines.length) parts.push(lines.join(' '));
  }
  return parts.join('\n').trim();
}

export async function parsePptx(file: File): Promise<ParsedDeck> {
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (Number(a.match(/slide(\d+)/)?.[1] || 0) - Number(b.match(/slide(\d+)/)?.[1] || 0)));

  const mediaNames = Object.keys(zip.files).filter(n => n.startsWith('ppt/media/') && !zip.files[n].dir);
  const notesNames = Object.keys(zip.files)
    .filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n))
    .sort((a, b) => (Number(a.match(/notesSlide(\d+)/)?.[1] || 0) - Number(b.match(/notesSlide(\d+)/)?.[1] || 0)));

  const mediaBase64 = new Map<string, string>();
  const mediaBytes = new Map<string, number>();

  async function mediaBase64For(mediaPath: string): Promise<string | null> {
    if (mediaBase64.has(mediaPath)) return mediaBase64.get(mediaPath)!;
    const entry = zip.files[mediaPath];
    if (!entry || entry.dir) return null;
    const buf = await entry.async('uint8array');
    mediaBytes.set(mediaPath, buf.byteLength);
    if (buf.byteLength > MAX_IMAGE_BYTES) { mediaBase64.set(mediaPath, ''); return null; }
    const b64 = await entry.async('base64');
    mediaBase64.set(mediaPath, b64);
    return b64;
  }

  const slides: ParsedSlide[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const name = slideFiles[i];
    const idx = i + 1;
    const xmlStr = await zip.files[name].async('string');
    const { doc, error: xmlError } = parseXml(xmlStr);
    if (xmlError) warnings.push(`Slide ${idx}: ${xmlError}`);

    // ── shapes ──────────────────────────────────────────────────────────────
    // Prefer the real title placeholder; "first lvl-0 paragraph" mislabels slides
    // whose first text box is a kicker/subtitle rather than the heading.
    let titleFromPlaceholder = '';
    for (const sp of Array.from(doc.getElementsByTagName('p:sp'))) {
      const ph = sp.getElementsByTagName('p:ph')[0];
      const type = ph?.getAttribute('type') || '';
      if (type !== 'title' && type !== 'ctrTitle') continue;
      const lines: string[] = [];
      for (const p of Array.from(sp.getElementsByTagName('a:p'))) { const t = textsOf(p); if (t) lines.push(t); }
      if (lines.length) { titleFromPlaceholder = lines.join(' ').trim(); break; }
    }

    const shapes: ParsedShape[] = [];
    for (const p of Array.from(doc.getElementsByTagName('a:p'))) {
      const t = textsOf(p);
      if (!t) continue;
      const first = p.firstElementChild;
      const lvlRaw = first?.getAttribute('lvl');
      const lvl = lvlRaw ? Number(lvlRaw) : 0;
      shapes.push({ kind: 'body', text: t.slice(0, 1200), level: isNaN(lvl) ? 0 : lvl });
    }
    if (titleFromPlaceholder && shapes.length) shapes[0] = { ...shapes[0], kind: 'title', text: titleFromPlaceholder.slice(0, 1200) };
    else if (!titleFromPlaceholder && shapes.length) shapes[0] = { ...shapes[0], kind: 'title' };

    const bodyText = shapes.slice(1).map(s => s.text).join('\n');
    const title = titleFromPlaceholder || shapes[0]?.text?.slice(0, 90) || `Slide ${idx}`;

    // ── speaker notes (matched by notesSlide rel, falling back to index) ─────
    let notes = '';
    const relsPath = name.replace(/([^/]+)$/, '_rels/$1.rels');
    const relsEntry = zip.files[relsPath];
    let noteTarget = '';
    if (relsEntry) {
      const relsXml = await relsEntry.async('string');
      const relM = relsXml.match(/Target="([^"]*notesSlides\/[^"]*)"[^>]*Type="[^"]*notesSlide"/);
      if (relM) noteTarget = resolveTarget(relsPath, relM[1]);
    }
    if (!noteTarget && notesNames[i]) noteTarget = notesNames[i];
    if (noteTarget && zip.files[noteTarget]) {
      try {
        const parsed = parseXml(await zip.files[noteTarget].async('string'));
        notes = parsed.error ? '' : notesTextOf(parsed.doc);
        if (parsed.error) warnings.push(`Slide ${idx} speaker notes: ${parsed.error}`);
      } catch { notes = ''; }
    }

    // ── embedded pictures → base64 for a local vision model ─────────────────
    const images: SlideImage[] = [];
    if (relsEntry) {
      const relsXml = await relsEntry.async('string');
      const byId = new Map<string, string>();
      for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
        const tag = m[0];
        const id = tag.match(/Id="([^"]+)"/)?.[1];
        const target = tag.match(/Target="([^"]+)"/)?.[1];
        if (id && target && /\/image$/.test(tag.match(/Type="([^"]+)"/)?.[1] || '')) byId.set(id, resolveTarget(relsPath, target));
      }
      const embedIds: string[] = [];
      for (const m of doc.getElementsByTagName('a:blip')) {
        const rid = m.getAttribute('r:embed') || m.getAttribute('embed');
        if (rid && !embedIds.includes(rid)) embedIds.push(rid);
      }
      for (const rid of embedIds.slice(0, MAX_IMAGES_PER_SLIDE)) {
        const mediaPath = byId.get(rid);
        if (!mediaPath || !zip.files[mediaPath]) continue;
        const b64 = await mediaBase64For(mediaPath);
        if (!b64) continue;
        images.push({ name: mediaPath.split('/').pop() || 'image', mime: mimeFor(mediaPath), base64: b64 });
      }
    }

    const tableCells = doc.getElementsByTagName('a:tc').length;
    const allText = notes
      ? `${shapes.map(s => s.text).join('\n')}\n\n[SPEAKER NOTES]\n${notes}`
      : shapes.map(s => s.text).join('\n');

    slides.push({
      number: idx,
      title: title.slice(0, 140),
      shapes,
      allText,
      bodyText,
      notes,
      tableCells,
      // Fall back to the blip count when rels were unreadable, so the number the
      // user sees is never silently 0 for a slide that clearly has a picture.
      imageCount: Math.max(images.length, doc.getElementsByTagName('a:blip').length),
      images,
    });
  }

  return {
    slides,
    warnings,
    meta: { images: mediaNames.length, fileName: file.name, notesSlides: notesNames.length },
  };
}

export function slideTokens(s: ParsedSlide): number { return estimateTokens(s.allText); }

export function deckTokens(slides: ParsedSlide[]): number {
  return slides.reduce((a, s) => a + slideTokens(s), 0);
}

export function buildSlidePrompt(deckTitle: string, s: ParsedSlide, question: string, lang: 'en' | 'id' | 'mixed'): string {
  const head = lang === 'id'
    ? `[KONTEKS] Slide ${s.number} dari deck "${deckTitle}"\nJudul: ${s.title}`
    : `[CONTEXT] Slide ${s.number} from deck "${deckTitle}"\nTitle: ${s.title}`;
  const body = `\n\n[SLIDE CONTENT]\n${s.allText.slice(0, 3000)}`;
  const task = lang === 'id'
    ? `\n\n[TUGAS] ${question}\nJawab ringkas seperti tutor: definisi dulu, lalu contoh, lalu 2 pertanyaan latihan.`
    : `\n\n[TASK] ${question}\nAnswer like a tutor: definition first, then a worked example, then 2 practice questions.`;
  return head + body + task;
}
