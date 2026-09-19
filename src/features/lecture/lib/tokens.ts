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
export function optimizePrompt(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/([•\-])\s+/g, '$1 ').trim();
}
export function compressionStats(raw: string, optimized: string) {
  const a = estimateTokens(raw); const b = estimateTokens(optimized);
  const saved = Math.max(0, a - b);
  const pct = a > 0 ? Math.round((saved / a) * 100) : 0;
  return { before: a, after: b, saved, pct };
}
