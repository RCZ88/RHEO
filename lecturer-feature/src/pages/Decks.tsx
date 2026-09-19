import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileUp, Loader2, Trash2, ChevronRight, Presentation } from 'lucide-react';
import api from '../lib/api';
import { parsePptx, slideTokens } from '../lib/pptx';
import { detectLanguage } from '../lib/lang';
export default function Decks() {
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const fetchDecks = async () => { try { setLoading(true); setDecks(await api.get('/api/decks')); } catch (e: any) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { fetchDecks(); }, []);
  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files).find(f => f.name.toLowerCase().endsWith('.pptx'));
    if (!file) { setError('Please drop a .pptx file.'); return; }
    setError(''); setBusy('Parsing ' + file.name + ' ...');
    try {
      const parsed = await parsePptx(file);
      const allText = parsed.slides.map(s => s.allText).join('\n');
      const lang = detectLanguage(allText).lang;
      const total = parsed.slides.reduce((a, s) => a + slideTokens(s), 0);
      setBusy('Saving ' + parsed.slides.length + ' slides ...');
      const deck = await api.post('/api/decks', { title: file.name.replace(/\.pptx$/i, ''), filename: file.name, slide_count: parsed.slides.length, status: 'ready', total_tokens: total, language: lang });
      const slideRows = parsed.slides.map(s => ({ deck_id: deck.id, slide_number: s.number, title: s.title, text_content: s.allText.slice(0, 6000), shapes_json: s.shapes.slice(0, 40), notes: '', token_estimate: slideTokens(s) }));
      const saved = await api.post('/api/slides', slideRows);
      const elRows: any[] = [];
      saved.forEach((sv: any, i: number) => {
        parsed.slides[i].shapes.slice(0, 20).forEach(sh => elRows.push({ slide_id: sv.id, element_type: sh.kind, content: sh.text.slice(0, 1500), position_json: { level: sh.level }, token_estimate: Math.max(1, Math.round(sh.text.length / 4)) }));
      });
      if (elRows.length) await api.post('/api/slide-elements', elRows);
      setBusy('');
      fetchDecks();
    } catch (e: any) { setBusy(''); setError('Parse failed: ' + e.message); }
  };
  const remove = async (id: number) => { if (!confirm('Delete this deck and its slides?')) return; await api.del('/api/decks', { id }); fetchDecks(); };
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Slide decks</h1><p className="text-sm text-white/50 mt-1">PPTX files are parsed in your browser (JSZip + XML) — text, bullets, tables — then compressed into per-slide prompts.</p></div>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }} className={'rounded-3xl border-2 border-dashed p-8 text-center transition-all ' + (drag ? 'border-amber-300 bg-amber-300/5' : 'border-white/15 bg-white/[0.02]')}>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center shadow-lg shadow-violet-600/30"><Upload className="w-6 h-6 text-white" /></div>
        <div className="mt-3 font-display font-semibold text-white">Drop a .pptx here</div>
        <div className="text-xs text-white/45 mt-1">or click to browse - parsed locally, only digested text is stored</div>
        <label className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 cursor-pointer hover:bg-amber-200 transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {busy || 'Choose PPTX'}
          <input type="file" accept=".pptx" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </label>
        {error && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2 inline-block">{error}</div>}
      </div>
      {loading ? <div className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading decks...</div> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {decks.map(d => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/40 to-violet-600/40 border border-white/10 grid place-items-center shrink-0"><Presentation className="w-5 h-5 text-amber-100" /></div>
                <div className="min-w-0 flex-1"><div className="font-semibold text-white text-sm truncate">{d.title}</div><div className="text-[11px] text-white/40 font-mono mt-0.5">{d.filename || '—'}</div></div>
                <button onClick={() => remove(d.id)} className="text-white/30 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 flex gap-2 text-[11px] font-mono">
                <span className="rounded-lg bg-white/5 px-2 py-1 text-white/70">{d.slide_count} slides</span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-emerald-300">{(d.total_tokens || 0).toLocaleString()} tok</span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-sky-300">{d.language}</span>
              </div>
              <Link to={'/decks/' + d.id} className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-2 transition-colors">Open and question slides <ChevronRight className="w-3.5 h-3.5" /></Link>
            </div>
          ))}
          {decks.length === 0 && <div className="col-span-full text-sm text-white/35 rounded-2xl border border-white/5 p-6 text-center">No decks yet. Drop a PPTX above to see per-slide questioning in action.</div>}
        </div>
      )}
    </div>
  );
}
