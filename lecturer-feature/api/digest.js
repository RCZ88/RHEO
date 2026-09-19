export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    const target = String(url);
    const isYT = /youtube\.com|youtu\.be/i.test(target);
    let videoId = '';
    if (isYT) {
      const m = target.match(/(?:v=|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
      if (m) videoId = m[1].split('&')[0];
    }
    if (isYT) {
      let title = 'YouTube video ' + (videoId || '');
      let author = 'Unknown channel';
      try {
        const o = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(target) + '&format=json');
        if (o.ok) { const j = await o.json(); title = j.title || title; author = j.author_name || author; }
      } catch {}
      let chapters = '';
      try {
        const page = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await page.text();
        const descM = html.match(/<meta name="description" content="([^"]{0,2000})/);
        if (descM) chapters = descM[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").slice(0, 3000);
        const kwM = html.match(/<meta name="keywords" content="([^"]{0,1000})/);
        if (kwM) chapters += '\n\nKeywords: ' + kwM[1];
      } catch {}
      const extracted = ('VIDEO: ' + title + '\nChannel: ' + author + '\nURL: ' + target + '\nVideoID: ' + videoId + '\n\nDescription/meta:\n' + (chapters || '(description unavailable — fetch transcript via Playwright authenticated session or YouTube timedtext API)')).slice(0, 8000);
      const summary = 'Lecture/video "' + title + '" by ' + author + '. Digested for token-efficient prompting. Attach transcript chunks (see Playwright recipe) for deep Q&A.';
      const promptPack = '[CONTEXT] YouTube lecture digest\nTitle: ' + title + '\nChannel: ' + author + '\nURL: ' + target + '\n\n[EXTRACTED META]\n' + extracted.slice(0, 2500) + '\n\n[TASK] Explain the key concepts in this lecture as if tutoring a CS/math undergrad. First list 5 key ideas, then deep-dive each with a worked example. Keep answers grounded in the transcript chunks I will paste next.\n\n[FOLLOW-UP QUESTIONS]\n1. Summarize this video in 8 bullet points.\n2. What definitions/theorems appear? Quote them.\n3. Generate 5 exam-style questions with solutions.';
      return res.status(200).json({ source_type: 'youtube', title, extracted_text: extracted, summary, prompt_pack: promptPack, videoId, author });
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (SlideMind DigestBot)' }, signal: ctrl.signal });
    clearTimeout(t);
    const html = await r.text();
    const getMeta = (re) => { const m = html.match(re); return m ? m[1].slice(0, 500) : ''; };
    const title = getMeta(/<title[^>]*>([^<]{1,300})<\/title>/i) || getMeta(/<meta property="og:title" content="([^"]+)"/i) || target;
    const desc = getMeta(/<meta name="description" content="([^"]+)"/i) || getMeta(/<meta property="og:description" content="([^"]+)"/i);
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    text = text.slice(0, 8000);
    const extracted = ('PAGE: ' + title + '\nURL: ' + target + (desc ? '\nMeta: ' + desc : '') + '\n\n' + text).slice(0, 8000);
    const summary = 'Article/page "' + title + '" digested (' + text.split(' ').length + ' words sampled). Ready to chunk into prompt packs.';
    const promptPack = '[CONTEXT] Web article digest\nTitle: ' + title + '\nURL: ' + target + '\n\n[EXTRACTED CONTENT — chunk 1]\n' + extracted.slice(0, 2500) + '\n\n[TASK] Act as my study tutor. Summarize the article, extract definitions/formulas, and flag anything that conflicts with my lecture slides. Then ask me 3 retrieval-practice questions.';
    return res.status(200).json({ source_type: 'website', title, extracted_text: extracted, summary, prompt_pack: promptPack });
  } catch (err) { console.error('digest api:', err); return res.status(500).json({ error: 'Could not digest URL: ' + err.message }); }
}
