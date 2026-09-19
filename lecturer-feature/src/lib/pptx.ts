import JSZip from 'jszip';
import { estimateTokens } from './tokens';

export interface ParsedShape { kind: string; text: string; level: number; }
export interface ParsedSlide { number: number; title: string; shapes: ParsedShape[]; allText: string; tableCells: number; imageCount: number; }

function textsOf(paragraph: Element): string {
  const runs = Array.from(paragraph.getElementsByTagName('a:t'));
  return runs.map(r => r.textContent || '').join('').trim();
}

export async function parsePptx(file: File): Promise<{ slides: ParsedSlide[]; meta: { images: number; fileName: string } }> {
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => {
    const na = Number(a.match(/slide(\d+)/)?.[1] || 0); const nb = Number(b.match(/slide(\d+)/)?.[1] || 0); return na - nb;
  });
  const mediaCount = Object.keys(zip.files).filter(n => n.startsWith('ppt/media/')).length;
  const slides: ParsedSlide[] = [];
  let idx = 0;
  for (const name of slideFiles) {
    idx++;
    const xmlStr = await zip.files[name].async('string');
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    const paras = Array.from(doc.getElementsByTagName('a:p'));
    const shapes: ParsedShape[] = [];
    for (const p of paras) {
      const t = textsOf(p);
      if (!t) continue;
      const first = p.firstElementChild;
      const lvlRaw = first?.getAttribute('lvl');
      const lvl = lvlRaw ? Number(lvlRaw) : 0;
      shapes.push({ kind: lvl === 0 && shapes.length === 0 ? 'title' : 'body', text: t.slice(0, 1200), level: isNaN(lvl) ? 0 : lvl });
    }
    const pics = doc.getElementsByTagName('p:pic').length + doc.getElementsByTagName('pic:pic').length;
    const title = shapes.find(s => s.kind === 'title')?.text || shapes[0]?.text?.slice(0, 90) || ('Slide ' + idx);
    const rest = shapes.length > 1 ? shapes.slice(1) : [];
    const firstShape = shapes[0] ? [{ ...shapes[0] }] : [];
    const allText = shapes.map(s => s.text).join('\n');
    slides.push({
      number: idx,
      title: title.slice(0, 140),
      shapes: firstShape.concat(rest.map(s => ({ ...s, kind: s.kind === 'title' ? 'body' : s.kind }))),
      allText,
      tableCells: doc.getElementsByTagName('a:tc').length,
      imageCount: pics,
    });
  }
  return { slides, meta: { images: mediaCount, fileName: file.name } };
}

export function slideTokens(s: ParsedSlide): number { return estimateTokens(s.allText); }

export function buildSlidePrompt(deckTitle: string, s: ParsedSlide, question: string, lang: 'en' | 'id' | 'mixed'): string {
  const head = lang === 'id'
    ? '[KONTEKS] Slide ' + s.number + ' dari deck "' + deckTitle + '"\nJudul: ' + s.title
    : '[CONTEXT] Slide ' + s.number + ' from deck "' + deckTitle + '"\nTitle: ' + s.title;
  const body = '\n\n[SLIDE CONTENT]\n' + s.allText.slice(0, 3000);
  const task = lang === 'id'
    ? '\n\n[TUGAS] ' + question + '\nJawab ringkas seperti tutor: definisi dulu, lalu contoh, lalu 2 pertanyaan latihan.'
    : '\n\n[TASK] ' + question + '\nAnswer like a tutor: definition first, then a worked example, then 2 practice questions.';
  return head + body + task;
}
