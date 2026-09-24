export interface DigestItem { url: string; title: string; body: string; publishedAt: number; source: string }
export interface DigestProfile { keywords: Record<string, number> }
export function scoreItem(item: DigestItem, profile: DigestProfile): number {
  const tokens = (item.title + ' ' + item.body).toLowerCase(); let s = 0;
  for (const [k, w] of Object.entries(profile.keywords)) { if (tokens.includes(k.toLowerCase())) s += w; }
  const ageH = Math.max(0, (Date.now() - item.publishedAt) / 3.6e6);
  return s * Math.exp(-ageH / 72);
}
export function topItems(items: DigestItem[], profile: DigestProfile, n = 10) { return items.map(i => ({ i, s: scoreItem(i, profile) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.i); }
