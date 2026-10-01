import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Trash2, Sparkles, Wand2, Search } from 'lucide-react';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { estimateTokens, optimizePrompt, compressionStats } from '../lib/tokens';
export default function PromptForge() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [copied, setCopied] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('chatgpt');
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchAll = async () => {
    try { setLoading(true); const rows = await api.get('/api/prompts'); setPrompts(Array.isArray(rows) ? rows : []); }
    catch (e: any) { setNotice({ tone: 'error', text: 'Could not load prompts: ' + (e?.message || String(e)) }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  // The filter list used to be a hardcoded constant that included an `element`
  // type nothing ever writes, so it always returned an empty list and read as a
  // broken filter. Derive it from what is actually stored instead.
  const types = useMemo(() => {
    const seen = new Set<string>();
    for (const p of prompts) if (p?.prompt_type) seen.add(String(p.prompt_type));
    return ['all', ...Array.from(seen).sort()];
  }, [prompts]);

  // Keep the active filter valid when the underlying set changes.
  useEffect(() => { if (type !== 'all' && !types.includes(type)) setType('all'); }, [types, type]);

  const copy = async (p: any) => {
    try { await navigator.clipboard.writeText(p.content); setCopied(p.id); setTimeout(() => setCopied(null), 1500); }
    catch { setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' }); }
  };
  const remove = async (id: number) => { if (!confirm('Delete prompt?')) return; try { await api.del('/api/prompts', { id }); await fetchAll(); } catch (e: any) { setNotice({ tone: 'error', text: 'Delete failed: ' + (e?.message || String(e)) }); } };
  const create = async () => {
    if (!title.trim() || !content.trim()) { setNotice({ tone: 'error', text: 'Title + content are required.' }); return; }
    const opt = optimizePrompt(content);
    try {
      await api.post('/api/prompts', { title, prompt_type: 'custom', source_ref: 'manual', content: opt, token_estimate: estimateTokens(opt), target_ai: target });
      setTitle(''); setContent('');
      await fetchAll();
      setNotice({ tone: 'success', text: 'Prompt saved.' });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Save failed: ' + (e?.message || String(e)) });
    }
  };
  const stats = content ? compressionStats(content, optimizePrompt(content)) : null;
  const optimize = () => {
    const next = optimizePrompt(content);
    const s = compressionStats(content, next);
    setContent(next);
    setNotice({ tone: 'success', text: `Compacted ${s.before} → ${s.after} tokens (${s.saved} saved, ${s.pct}%). Code blocks, tables and indentation are left intact.` });
  };
  const filtered = prompts.filter(p => (type === 'all' || p.prompt_type === type) && ((p.title || '') + (p.content || '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Prompt Forge</h1><p className="text-sm text-white/50 mt-1">Every digest lands here — compressed, slide-referenced, and ready to paste into free AI sites.</p></div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs font-semibold text-white mb-2">Ask anywhere</div><AIBridge />
      </div>
      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 h-fit">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="w-4 h-4 text-amber-300" /> Forge custom prompt</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Slide 7 follow-up" className="mt-3 w-full rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="[CONTEXT] ... [TASK] ..." className="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/10 text-[13px] font-mono text-white/85 p-3 outline-none focus:border-amber-300/40" />
          <div className="mt-2"><TokenMeter value={estimateTokens(content)} max={4000} /></div>
          {stats && stats.saved > 0 && (
            <div className="mt-1 text-[10px] font-mono text-emerald-300">
              Compact would save {stats.saved} tokens ({stats.pct}%) — {stats.before} → {stats.after}
            </div>
          )}
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white p-2.5 outline-none">
            <option value="chatgpt" className="bg-black">ChatGPT</option><option value="gemini" className="bg-black">Gemini</option><option value="claude" className="bg-black">Claude</option><option value="kimi" className="bg-black">Kimi</option><option value="glm" className="bg-black">GLM</option>
          </select>
          <div className="mt-2 flex gap-2">
            <button onClick={optimize} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 text-white text-xs font-semibold py-2.5 hover:bg-white/5"><Wand2 className="w-3.5 h-3.5" /> Optimize</button>
            <button onClick={create} className="flex-1 rounded-xl bg-white text-black text-xs font-semibold py-2.5">Save</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3"><Search className="w-4 h-4 text-white/35" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts..." className="flex-1 bg-transparent text-sm text-white py-2.5 outline-none placeholder:text-white/25" /></div>
            <div className="flex gap-1.5 flex-wrap">{types.map(t => <button key={t} onClick={() => setType(t)} className={'text-[11px] font-mono rounded-lg px-2.5 py-1.5 border ' + (type === t ? 'border-amber-300/50 bg-amber-300/10 text-amber-100' : 'border-white/10 text-white/45')}>{t}</button>)}</div>
          </div>
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><div className="font-semibold text-white text-sm">{p.title}</div><div className="text-[10px] font-mono text-white/40 mt-0.5">{p.prompt_type} - {p.target_ai} - {(p.token_estimate || 0).toLocaleString()} tok - {p.source_ref}</div></div>
                <button onClick={() => copy(p)} className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold px-2.5 py-1.5 transition-colors">{copied === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied === p.id ? 'Copied' : 'Copy'}</button>
                <button onClick={() => remove(p.id)} className="text-white/25 hover:text-red-300 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <pre className="mt-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/65 leading-relaxed rounded-xl bg-black/30 border border-white/5 p-3">{p.content}</pre>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div className="text-sm text-white/35 rounded-xl border border-white/5 p-6 text-center">{prompts.length === 0 ? 'No prompts yet. Forge one on the left, or digest a deck / image / lecture first.' : 'No prompts match this search.'}</div>}
          {loading && <div className="text-sm text-white/40">Loading prompts…</div>}
        </div>
      </div>
    </div>
  );
}
