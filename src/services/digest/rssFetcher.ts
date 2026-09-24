import { scoreItem, topItems } from './digestScorer'
import type { DigestItem, DigestProfile } from './digestScorer'

export async function fetchRss(url: string): Promise<DigestItem[]> {
  try {
    const resp = await fetch(url); const text = await resp.text();
    const items: DigestItem[] = [];
    for (const block of text.split('<item>')) {
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
      const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
      const desc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.trim() || '';
      if (!title) continue;
      items.push({ url: link, title, body: desc, publishedAt: new Date(pubDate).getTime() || 0, source: url });
    }
    return items;
  } catch { return []; }
}

export function buildProfileFromTopics(topics: string[]): DigestProfile {
  const keywords: Record<string, number> = {};
  for (const t of topics) { keywords[t.toLowerCase()] = 5; }
  return { keywords };
}

export async function runDigest(profile: DigestProfile, sources: string[]): Promise<DigestItem[]> {
  const allItems: DigestItem[] = [];
  for (const url of sources) { allItems.push(...await fetchRss(url)); }
  const scored = topItems(allItems, profile, 20);
  return scored;
}
