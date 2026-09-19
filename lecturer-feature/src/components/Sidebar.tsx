import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Layers, ScanSearch, Mic, Globe2, Sparkles, KeyRound, FlaskConical, BrainCircuit } from 'lucide-react';
const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/decks', label: 'Slide Decks', icon: Layers },
  { to: '/image-lab', label: 'Image Lab', icon: ScanSearch },
  { to: '/transcriber', label: 'Lecture STT', icon: Mic },
  { to: '/web-digest', label: 'Web & YouTube', icon: Globe2 },
  { to: '/prompts', label: 'Prompt Forge', icon: Sparkles },
  { to: '/auth-vault', label: 'Auth Vault', icon: KeyRound },
  { to: '/research', label: 'Research', icon: FlaskConical },
];
export default function Sidebar() {
  return (
    <aside className="w-[248px] shrink-0 h-screen sticky top-0 hidden md:flex flex-col border-r border-white/10 bg-[#0b0d16]/90 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-orange-500 to-violet-600 grid place-items-center shadow-lg shadow-orange-500/20">
          <BrainCircuit className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-display font-bold text-[17px] tracking-tight text-white">SlideMind</div>
          <div className="text-[11px] text-white/50 tracking-widest uppercase">AI Digest Studio</div>
        </div>
      </div>
      <div className="mx-4 mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-emerald-200/90">Token-saver engine online</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {items.map(it => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' + (isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/55 hover:text-white hover:bg-white/5')}>
            <it.icon className="w-[18px] h-[18px]" />
            <span className="font-medium">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-600/25 to-orange-500/15 border border-white/10">
          <div className="text-xs font-semibold text-white">Free-AI bridge</div>
          <div className="text-[11px] text-white/60 mt-1 leading-relaxed">Paste efficient prompts into ChatGPT, Gemini, Claude, Kimi, GLM</div>
        </div>
        <div className="text-[10px] text-white/30 mt-3 px-1">Built for CS and Math students, EN + ID</div>
      </div>
    </aside>
  );
}
