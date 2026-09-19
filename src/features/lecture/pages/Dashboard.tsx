import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Sparkles, Mic, Globe2, Upload, ScanSearch, ArrowRight, PiggyBank, Zap, Languages } from 'lucide-react';
import StatCard from '../components/StatCard';
import AIBridge from '../components/AIBridge';
import api from '../lib/api';
const steps = [
  { n: 1, t: 'Ingest', d: 'Drop PPTX, images, audio or URLs', icon: Upload },
  { n: 2, t: 'Digest', d: 'OCR, STT, scrape, chunk', icon: ScanSearch },
  { n: 3, t: 'Forge', d: 'Token-efficient prompts', icon: Sparkles },
  { n: 4, t: 'Ask', d: 'Paste into free AI sites', icon: Zap },
];
export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  useEffect(() => {
    api.get('/api/stats').then(setStats).catch(() => {});
    api.get('/api/decks').then((d: any[]) => setRecent(d.slice(0, 4))).catch(() => {});
    api.get('/api/prompts').then((d: any[]) => setPrompts(d.slice(0, 4))).catch(() => {});
  }, []);
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151a30] via-[#101528] to-[#1c1030] p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-orange-500/30 to-violet-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-amber-300/90 bg-amber-400/10 border border-amber-300/20 rounded-full px-3 py-1">
              <Languages className="w-3 h-3" /> English - Bahasa Indonesia - CS + Math tuned
            </div>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">Turn heavy slides into<br /><span className="bg-gradient-to-r from-amber-300 via-orange-400 to-violet-400 bg-clip-text text-transparent">lightweight AI prompts.</span></h1>
            <p className="mt-3 text-sm text-white/60 max-w-xl leading-relaxed">SlideMind digests PPTX decks, image regions, lecture audio and YouTube pages into compact, per-slide question packs — so free AI sites understand exactly what you mean without burning tokens.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/lecture/decks" className="inline-flex items-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 hover:bg-amber-200 transition-colors">Ingest a deck <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/lecture/prompts" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-semibold px-4 py-2.5 hover:bg-white/10 transition-colors">Open Prompt Forge</Link>
            </div>
          </div>
          <div className="w-full lg:w-[300px] rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold"><PiggyBank className="w-4 h-4" /> TOKEN SAVINGS</div>
            <div className="mt-2 font-display text-4xl font-bold text-white">{stats ? stats.savingsPct + '%' : '—'}</div>
            <div className="text-[11px] text-white/50 mt-1">fewer tokens vs pasting raw files - {(stats?.saved || 0).toLocaleString()} saved</div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all" style={{ width: (stats?.savingsPct || 0) + '%' }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-white/5 p-2"><div className="text-white/40">Raw est.</div><div className="font-mono text-white">{(stats?.rawEstimate || 0).toLocaleString()}</div></div>
              <div className="rounded-lg bg-white/5 p-2"><div className="text-white/40">Digested</div><div className="font-mono text-emerald-300">{((stats?.deckTokens || 0) + (stats?.promptTokens || 0)).toLocaleString()}</div></div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s, i) => (
          <motion.div key={s.n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/30 to-violet-500/30 border border-white/10 grid place-items-center shrink-0"><s.icon className="w-4 h-4 text-amber-200" /></div>
            <div><div className="text-[10px] font-bold tracking-widest text-white/35">STEP {s.n}</div><div className="text-sm font-semibold text-white">{s.t}</div><div className="text-[11px] text-white/50">{s.d}</div></div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Layers} label="Decks" value={stats?.decks ?? '—'} sub={(stats?.slides ?? 0) + ' slides parsed'} accent="bg-gradient-to-br from-violet-500 to-indigo-600" />
        <StatCard icon={Sparkles} label="Prompts forged" value={stats?.prompts ?? '—'} sub={(stats?.promptTokens ?? 0).toLocaleString() + ' tokens total'} accent="bg-gradient-to-br from-amber-400 to-orange-600" />
        <StatCard icon={Mic} label="Transcripts" value={stats?.transcripts ?? '—'} sub="EN + ID auto-detect" accent="bg-gradient-to-br from-rose-500 to-pink-600" />
        <StatCard icon={Globe2} label="Web digests" value={(stats?.webSources ?? 0)} sub={(stats?.images ?? 0) + ' images OCRd'} accent="bg-gradient-to-br from-sky-500 to-cyan-600" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="font-display font-semibold text-white">Recent decks</h3><Link to="/lecture/decks" className="text-xs text-amber-300 hover:underline">View all</Link></div>
          <div className="space-y-2">
            {recent.length === 0 && <div className="text-xs text-white/40">No decks yet — ingest your first PPTX.</div>}
            {recent.map(d => (
              <Link key={d.id} to={'/lecture/decks/' + d.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] p-3 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/40 to-indigo-600/40 grid place-items-center text-xs font-bold text-white">{d.slide_count}</div>
                <div className="min-w-0"><div className="text-sm font-medium text-white truncate">{d.title}</div><div className="text-[11px] text-white/40 font-mono">{(d.total_tokens || 0).toLocaleString()} tok - {d.language}</div></div>
                <ArrowRight className="w-4 h-4 text-white/30 ml-auto shrink-0" />
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="font-display font-semibold text-white">Latest prompts</h3><Link to="/lecture/prompts" className="text-xs text-amber-300 hover:underline">Forge</Link></div>
          <div className="space-y-2">
            {prompts.length === 0 && <div className="text-xs text-white/40">No prompts yet.</div>}
            {prompts.map(p => (
              <div key={p.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-sm font-medium text-white truncate">{p.title}</div>
                <div className="text-[11px] text-white/40 font-mono mt-0.5">{p.prompt_type} - {p.target_ai} - {(p.token_estimate || 0).toLocaleString()} tok</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="font-display font-semibold text-white mb-1">Ask anywhere — free AI bridge</h3>
        <p className="text-xs text-white/50 mb-3">Copy a forged prompt, then open any provider. Prompts carry slide refs + context so the AI knows exactly what you mean.</p>
        <AIBridge />
      </div>
    </div>
  );
}
