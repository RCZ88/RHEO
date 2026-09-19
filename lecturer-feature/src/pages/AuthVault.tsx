import { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check, ShieldCheck, CircleDashed } from 'lucide-react';
import api from '../lib/api';
const SCRIPT = (service: string, loginUrl: string) => '// Playwright authenticated-session recipe — ' + service + '\n// 1) npm i playwright && npx playwright install chromium\n// 2) Run once per service to capture storage state (cookies + localStorage).\n// 3) Reuse auth.json for headless scraping of login-walled pages.\n\nimport { chromium } from \'playwright\';\n\n// --- one-time interactive login ---\nconst browser = await chromium.launch({ headless: false });\nconst ctx = await browser.newContext();\nconst page = await ctx.newPage();\nawait page.goto(\'' + loginUrl + '\');\nconsole.log(\'Log in as the student, solve CAPTCHA/SSO, then press ENTER here.\');\nawait new Promise(r => process.stdin.once(\'data\', r));\nawait ctx.storageState({ path: \'auth-' + service.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json\' });\nawait browser.close();\n\n// --- headless reuse for SlideMind digests ---\n// const b2 = await chromium.launch();\n// const c2 = await b2.newContext({ storageState: \'auth-' + service.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json\' });\n// const p2 = await c2.newPage();\n// await p2.goto(targetUrl); // LMS page / journal / video transcript panel\n// const html = await p2.content(); // feed into SlideMind chunker\n';
export default function AuthVault() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [user, setUser] = useState('');
  const [loginUrl, setLoginUrl] = useState('https://');
  const [copied, setCopied] = useState<number | null>(null);
  const [view, setView] = useState<number | null>(null);
  const fetchAll = async () => setProfiles(await api.get('/api/auth-profiles').catch(() => []));
  useEffect(() => { fetchAll(); }, []);
  const add = async () => {
    if (!name.trim()) { alert('Service name required.'); return; }
    await api.post('/api/auth-profiles', { service_name: name, username_label: user || 'student account', status: 'not_connected', script: SCRIPT(name, loginUrl || 'https://'), notes: 'Run the recipe, then mark connected.' });
    setName(''); setUser(''); setLoginUrl('https://'); fetchAll();
  };
  const cycle = async (p: any) => {
    const next = p.status === 'connected' ? 'expired' : p.status === 'expired' ? 'not_connected' : 'connected';
    await api.put('/api/auth-profiles', { id: p.id, status: next, session_expires: next === 'connected' ? new Date(Date.now() + 7 * 864e5).toISOString() : null });
    fetchAll();
  };
  const remove = async (id: number) => { if (!confirm('Delete profile?')) return; await api.del('/api/auth-profiles', { id }); fetchAll(); };
  const copy = async (p: any) => { await navigator.clipboard.writeText(p.script || ''); setCopied(p.id); setTimeout(() => setCopied(null), 1500); };
  const badge = (s: string) => s === 'connected' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' : s === 'expired' ? 'text-red-300 border-red-400/30 bg-red-400/10' : 'text-white/50 border-white/15 bg-white/5';
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Auth Vault — Playwright sessions</h1><p className="text-sm text-white/50 mt-1">University LMS pages, journals and some video transcripts sit behind logins. Store one profile per service, capture its session with Playwright, then reuse it for authenticated digests. Secrets never leave your machine.</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Plus className="w-4 h-4 text-amber-300" /> New service profile</div>
        <div className="mt-3 grid sm:grid-cols-4 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Service — e.g. Campus LMS" className="rounded-xl bg-black/30 border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25" />
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Account label" className="rounded-xl bg-black/30 border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25" />
          <input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="Login URL" className="rounded-xl bg-black/30 border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40 placeholder:text-white/25 sm:col-span-2" />
        </div>
        <button onClick={add} className="mt-2 rounded-xl bg-white text-black text-xs font-semibold px-4 py-2.5">Create profile + recipe</button>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        {profiles.map(p => (
          <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/40 to-violet-600/40 grid place-items-center shrink-0"><KeyRound className="w-4 h-4 text-white" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white text-sm">{p.service_name}</div>
                <div className="text-[11px] text-white/40 font-mono">{p.username_label} {p.session_expires ? '- expires ' + new Date(p.session_expires).toLocaleDateString() : ''}</div>
              </div>
              <span className={'text-[10px] font-bold rounded-lg border px-2 py-1 ' + badge(p.status)}>{p.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => cycle(p)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 text-white text-[11px] font-semibold py-2 hover:bg-white/5">{p.status === 'connected' ? <CircleDashed className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}{p.status === 'connected' ? 'Mark expired' : p.status === 'expired' ? 'Reset' : 'Mark connected'}</button>
              <button onClick={() => setView(view === p.id ? null : p.id)} className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold py-2">Recipe</button>
              <button onClick={() => copy(p)} className="rounded-xl bg-white text-black text-[11px] font-semibold px-3 py-2 inline-flex items-center gap-1">{copied === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</button>
              <button onClick={() => remove(p.id)} className="text-white/25 hover:text-red-300 px-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            {view === p.id && <pre className="mt-2 max-h-[280px] overflow-y-auto whitespace-pre-wrap text-[11px] font-mono text-emerald-100/80 leading-relaxed rounded-xl bg-black/50 border border-white/10 p-3">{p.script}</pre>}
            {p.notes && <div className="mt-2 text-[11px] text-white/40">{p.notes}</div>}
          </div>
        ))}
        {profiles.length === 0 && <div className="col-span-full text-sm text-white/35 rounded-2xl border border-white/5 p-6 text-center">No profiles yet — add your LMS, library proxy, or video platform above.</div>}
      </div>
      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4 text-xs text-amber-100/80 leading-relaxed">Security notes: storage-state JSON contains live cookies — keep it git-ignored, rotate sessions weekly, and prefer university SSO on a private machine. SlideMind only stores the recipe + status, never your password.</div>
    </div>
  );
}
