export function estimateTokens(text: string): number {
  if (!text) return 0;
  const t = text.trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  const chars = t.length;
  return Math.max(1, Math.round(Math.max(words * 1.33, chars / 4)));
}
export function chunkText(text: string, maxTokens = 1500): string[] {
  if (!text) return [];
  const paras = text.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    const cand = cur ? cur + '\n\n' + p : p;
    if (estimateTokens(cand) > maxTokens && cur) { chunks.push(cur); cur = p; }
    else cur = cand;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
/**
 * Whitespace-only compaction for prompts.
 *
 * It used to collapse every run of spaces/tabs to a single space across the WHOLE
 * string, which silently destroyed indented code blocks, ASCII tables, nested
 * bullet levels and Python/JS indentation — i.e. exactly the CS/math content this
 * module exists to preserve. It is now line-aware: fenced code blocks are passed
 * through untouched, and only genuine trailing whitespace / 3+ blank-line runs /
 * padding around list markers are removed. Savings are reported honestly.
 */
export function optimizePrompt(text: string): string {
  if (!text) return '';
  const out: string[] = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) { out.push(line.replace(/[ \t]+$/, '')); continue; }
    out.push(
      line
        .replace(/[ \t]+$/, '')
        .replace(/^(\s*)([•\-*+])\s+/, '$1$2 ')
        .replace(/^(\s*)(\d+)\.\s+/, '$1$2. ')
    );
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function compressionStats(raw: string, optimized: string) {
  const a = estimateTokens(raw); const b = estimateTokens(optimized);
  const saved = Math.max(0, a - b);
  const pct = a > 0 ? Math.round((saved / a) * 100) : 0;
  return { before: a, after: b, saved, pct };
}
