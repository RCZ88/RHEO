import { useEffect, useState } from 'react';
import { Globe2, Youtube, Loader2, Copy, Check, Save, Trash2, Link2 } from 'lucide-react';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import api from '../lib/api';
import { estimateTokens, chunkText } from '../lib/tokens';
export default function WebDigest() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [chunkIdx, setChunkIdx] = useState(0);
  useEffect(() => { api.get('/api/web-sources').then(setHistory).catch(() => {}); }, []);
  const isYT = /youtube\.com|youtu\.be/i.test(url);
  const digest = async () => {
    if (!/^https?:\/\//i.test(url)) { setError('Paste a full https:// URL first.'); return; }
    setBusy(true); setError(''); setResult(null); setChunkIdx(0);
    try { setResult(await api.get('/api/digest?url=' + encodeURIComponent(url))); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const chunks = result ? chunkText(result.extracted_text || '', 1500) : [];
  const activePack = result ? (result.prompt_pack || '') + (chunks.length > 1 ? '\n\n[NOTE] Content split into ' + chunks.length + ' chunks — paste chunk ' + (chunkIdx + 1) + ' next:\n' + (chunks[chunkIdx] || '').slice(0, 1500) : '') : '';
  const copy = async () => { await navigator.clipboard.writeText(activePack); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const save = async () => {
    if (!result) return;
    await api.post('/api/web-sources', { url, source_type: result.source_type, title: result.title, extracted_text: (result.extracted_text || '').slice(0, 8000), summary: result.summary, prompt_pack: activePack.slice(0, 6000), status: 'ready' });
    await api.post('/api/prompts', { title: 'Web: ' + result.title.slice(0, 60), prompt_type: 'web', source_ref: url, content: activePack.slice(0, 6000), token_estimate: estimateTokens(activePack), target_ai: 'kimi' });
    setHistory(await api.get('/api/web-sources')); alert('Digest + prompt saved');
  };
  const remove = async (id: number) => { await api.del('/api/web-sources', { id }); setHistory(await api.get('/api/web-sources')); };
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Web and YouTube digester</h1><p className="text-sm text-white/50 mt-1">Paste a lecture video or article URL — SlideMind scrapes metadata + content, then compresses it into paste-ready prompt packs.</p></div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3">
            {isYT ? <Youtube className="w-4 h-4 text-red-400 shrink-0" /> : <Globe2 className="w-4 h-4 text-sky-300 shrink-0" />}
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && digest()} placeholder="https://youtube.com/watch?v=... or https://article..." className="flex-1 bg-transparent text-sm text-white py-3 outline-none placeholder:text-white/30" />
          </div>
          <button onClick={digest} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-5 py-3 disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}{busy ? 'Digesting...' : 'Digest URL'}</button>
        </div>
        {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        <div className="mt-2 text-[11px] text-white/35">Tip: for login-walled pages (LMS, journals), save a Playwright session in the Auth Vault, then re-run the digest recipe.</div>
      </div>
      {result && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase">{result.source_type} - digested</div>
            <h3 className="mt-1 font-display font-semibold text-white">{result.title}</h3>
            <p className="mt-1 text-xs text-white/55 leading-relaxed">{result.summary}</p>
            {chunks.length > 1 && <div className="mt-2 flex gap-1.5 flex-wrap">{chunks.map((_: string, i: number) => <button key={i} onClick={() => setChunkIdx(i)} className={'text-[11px] font-mono rounded-lg px-2.5 py-1 border ' + (i === chunkIdx ? 'border-amber-300/50 bg-amber-300/10 text-amber-100' : 'border-white/10 text-white/50')}>chunk {i + 1}</button>)}</div>}
            <pre className="mt-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/70 leading-relaxed rounded-xl bg-white/[0.03] border border-white/10 p-3">{(chunks[chunkIdx] || result.extracted_text || '').slice(0, 4000)}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold text-white mb-2">Prompt pack</div>
            <TokenMeter value={estimateTokens(activePack)} max={4000} />
            <pre className="mt-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/75 leading-relaxed rounded-xl bg-black/30 border border-white/10 p-3">{activePack}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy pack'}</button>
              <button onClick={save} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5"><Save className="w-3.5 h-3.5" /> Save all</button>
            </div>
            <div className="mt-3"><AIBridge compact /></div>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Digest history</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {history.map(h => (
            <div key={h.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-xs font-medium text-white truncate">{h.title}</div><div className="text-[10px] font-mono text-white/35 truncate mt-0.5">{h.url}</div></div><button onClick={() => remove(h.id)} className="text-white/25 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button></div>
              <div className="mt-1.5 text-[10px] font-mono"><span className="text-sky-300">{h.source_type}</span><span className="text-white/30"> - {(h.extracted_text || '').length} chars</span></div>
            </div>
          ))}
          {history.length === 0 && <div className="text-xs text-white/35">No digests yet.</div>}
        </div>
      </div>
    </div>
  );
}
