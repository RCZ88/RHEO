import { useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2, Cpu, Mic2, Eye, Globe2, Layers } from 'lucide-react';
import api from '../lib/api';
const CATS = [
  { id: 'all', label: 'All', icon: FlaskConical },
  { id: 'stack', label: 'Stack', icon: Layers },
  { id: 'vision', label: 'Vision/OCR', icon: Eye },
  { id: 'stt', label: 'Speech', icon: Mic2 },
  { id: 'scrape', label: 'Scrape', icon: Globe2 },
  { id: 'ml', label: 'ML/Lang', icon: Cpu },
];
const COMPARE = [
  { use: 'PPTX parse', pick: 'JSZip + DOMParser (client)', alt: 'python-pptx microservice', why: 'Zero upload, instant, private' },
  { use: 'Image OCR', pick: 'Tesseract.js eng+ind', alt: 'PaddleOCR / Qwen2-VL local', why: 'In-browser, bilingual, free' },
  { use: 'Vision caption', pick: 'Moondream / LLaVA (Ollama)', alt: 'GPT-4o-mini API', why: 'Local = 0 tokens for pixels' },
  { use: 'Lecture STT', pick: 'Web Speech API (live)', alt: 'Whisper small-id (local)', why: 'Free live; Whisper for files' },
  { use: 'Lang detect', pick: 'Stopword + n-gram hybrid', alt: 'CLD3 / fastText', why: 'Tiny, EN/ID tuned' },
  { use: 'Auth scrape', pick: 'Playwright storageState', alt: 'Puppeteer + cookies', why: 'SSO-proof sessions' },
];
export default function Research() {
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState('all');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tools, setTools] = useState('');
  const fetchAll = async () => setItems(await api.get('/api/research').catch(() => []));
  useEffect(() => { fetchAll(); }, []);
  const add = async () => {
    if (!title.trim()) { alert('Title required'); return; }
    await api.post('/api/research', { category: cat === 'all' ? 'stack' : cat, title, description: desc, tools, status: 'planned', priority: items.length + 1 });
    setTitle(''); setDesc(''); setTools(''); fetchAll();
  };
  const remove = async (id: number) => { await api.del('/api/research', { id }); fetchAll(); };
  const cycle = async (it: any) => {
    const order = ['planned', 'researching', 'prototype', 'shipped'];
    const next = order[(order.indexOf(it.status) + 1) % order.length];
    await api.put('/api/research', { id: it.id, status: next }); fetchAll();
  };
  const filtered = items.filter(i => cat === 'all' || i.category === cat);
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Research and roadmap</h1><p className="text-sm text-white/50 mt-1">Technology picks, speech/vision trade-offs, and planned improvements — tracked as living data.</p></div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Tooling decisions — why this stack</h3>
        <table className="w-full text-xs min-w-[560px]">
          <thead><tr className="text-left text-white/35 uppercase tracking-wider text-[10px]"><th className="pb-2 pr-3">Use</th><th className="pb-2 pr-3">Chosen</th><th className="pb-2 pr-3">Alternative</th><th className="pb-2">Why</th></tr></thead>
          <tbody>{COMPARE.map(c => <tr key={c.use} className="border-t border-white/5"><td className="py-2 pr-3 text-white/70 font-medium">{c.use}</td><td className="py-2 pr-3 text-emerald-300 font-mono text-[11px]">{c.pick}</td><td className="py-2 pr-3 text-white/40 font-mono text-[11px]">{c.alt}</td><td className="py-2 text-white/55">{c.why}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex gap-1.5 flex-wrap">{CATS.map(c => <button key={c.id} onClick={() => setCat(c.id)} className={'inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-2 border transition-all ' + (cat === c.id ? 'border-amber-300/50 bg-amber-300/10 text-amber-100' : 'border-white/10 text-white/50 hover:text-white')}><c.icon className="w-3.5 h-3.5" />{c.label}</button>)}</div>
      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map(it => (
          <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono rounded-lg bg-violet-500/15 border border-violet-400/20 text-violet-200 px-2 py-1">{it.category}</span>
              <button onClick={() => cycle(it)} className="text-[10px] font-bold rounded-lg border border-white/15 px-2 py-1 text-white/60 hover:text-white uppercase">{it.status}</button>
              <button onClick={() => remove(it.id)} className="ml-auto text-white/25 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="mt-2 font-semibold text-white text-sm">{it.title}</div>
            <div className="mt-1 text-xs text-white/55 leading-relaxed">{it.description}</div>
            {it.tools && <div className="mt-2 text-[11px] font-mono text-sky-300">{it.tools}</div>}
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-sm text-white/35 rounded-xl border border-white/5 p-6 text-center">Nothing here yet — log the next experiment below.</div>}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="text-sm font-semibold text-white">Log research / improvement</div>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Whisper small-id fine-tune on math speech" className="rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25 sm:col-span-2" />
          <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Tools — e.g. faster-whisper, Ollama, Tesseract" className="rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25 sm:col-span-2" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Finding / hypothesis / next step..." className="rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25 sm:col-span-2" />
        </div>
        <button onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold px-4 py-2.5"><Plus className="w-3.5 h-3.5" /> Add to roadmap</button>
      </div>
    </div>
  );
}
