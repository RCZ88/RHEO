import { ExternalLink } from 'lucide-react';
const AIS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/', grad: 'from-emerald-400 to-teal-600' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', grad: 'from-sky-400 to-blue-600' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', grad: 'from-orange-300 to-amber-600' },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/', grad: 'from-slate-500 to-slate-800' },
  { id: 'glm', name: 'GLM', url: 'https://chat.z.ai/', grad: 'from-violet-500 to-fuchsia-600' },
];
export default function AIBridge({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'grid gap-2 ' + (compact ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-5')}>
      {AIS.map(a => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className={'group rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all p-3 flex items-center gap-2 ' + (compact ? 'justify-center' : '')}>
          <span className={'w-2.5 h-2.5 rounded-full bg-gradient-to-br shrink-0 ' + a.grad} />
          <span className={compact ? 'text-[11px] font-semibold text-white/80' : 'text-xs font-semibold text-white'}>{a.name}</span>
          {!compact && <ExternalLink className="w-3 h-3 text-white/30 ml-auto group-hover:text-white/70" />}
        </a>
      ))}
    </div>
  );
}
