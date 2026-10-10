import { useState, useEffect } from 'react';
import { Search, Clock, Coins, Users, Plus, Sparkles } from 'lucide-react';

export function TemplateGallery({ onSelect, onCreate }: { onSelect: (tpl: any) => void; onCreate: () => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (window as any).deskflowAPI?.conductorGetTemplates?.().then((r: any) => {
      if (r?.success) setTemplates(r.data || []);
    });
  }, []);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2 mb-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500/40"
          />
        </div>
        <button onClick={onCreate} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-medium hover:bg-rose-500/25">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 text-left hover:bg-zinc-800/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-zinc-200">{tpl.name}</span>
                {tpl.is_builtin && <span className="px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-[10px] text-zinc-400">Built-in</span>}
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 mb-1.5">{tpl.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tpl.expectedDurationMin} min</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> ${tpl.budgetEstimateCost}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {tpl.roles?.length || 0} roles</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(tpl); }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800/60 text-zinc-300 text-[10px] font-medium hover:bg-zinc-700/60 shrink-0"
            >
              Use
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
