import supabase from './db-client.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const [decks, slides, prompts, transcripts, webs, imgs] = await Promise.all([
      supabase.from('decks').select('id,total_tokens,slide_count'),
      supabase.from('slides').select('id', { count: 'exact', head: true }),
      supabase.from('prompts').select('id,token_estimate'),
      supabase.from('transcripts').select('id'),
      supabase.from('web_sources').select('id'),
      supabase.from('images').select('id'),
    ]);
    const deckTokens = (decks.data || []).reduce((a, d) => a + (d.total_tokens || 0), 0);
    const promptTokens = (prompts.data || []).reduce((a, p) => a + (p.token_estimate || 0), 0);
    const rawEstimate = deckTokens * 6 + 42000;
    const saved = Math.max(0, rawEstimate - promptTokens - deckTokens);
    const savingsPct = rawEstimate > 0 ? Math.round((saved / rawEstimate) * 100) : 0;
    return res.status(200).json({
      decks: (decks.data || []).length,
      slides: slides.count || 0,
      prompts: (prompts.data || []).length,
      transcripts: (transcripts.data || []).length,
      webSources: (webs.data || []).length,
      images: (imgs.data || []).length,
      deckTokens, promptTokens, rawEstimate, saved, savingsPct,
    });
  } catch (err) { console.error('stats api:', err); return res.status(500).json({ error: err.message }); }
}
