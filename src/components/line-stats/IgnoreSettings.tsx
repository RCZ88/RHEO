/**
 * IgnoreSettings — the "which directories to ignore" setting (bug 3).
 *
 * Persisted through the EXISTING `get-preference` / `set-preference` pair
 * (already exposed on `window.deskflowAPI` at src/preload.ts:274/277) under the
 * key `lineStatsFilterSettings`, with a localStorage mirror as fallback. No
 * preload/main edit was needed, so nothing outside this slice was touched.
 */

import { useState } from 'react';
import { FolderX, RotateCcw, Plus, X } from 'lucide-react';
import { DEFAULT_IGNORE_DIRS, normaliseIgnoreEntry, type FilterSettings } from './lineStatsFilter';

interface Props {
  settings: FilterSettings;
  ready: boolean;
  onChange: (patch: Partial<FilterSettings>) => void;
  onReset: () => void;
  accent?: 'cyan' | 'purple';
  /** Compact = one-line summary; full = the editor. */
  mode?: 'full' | 'summary';
}

const ACCENT = {
  cyan: { check: 'accent-cyan-500', btn: 'text-cyan-400', border: 'border-cyan-500/30' },
  purple: { check: 'accent-purple-500', btn: 'text-purple-400', border: 'border-purple-500/30' },
};

/** Grouped for display so 43 defaults are readable instead of a wall of text. */
const GROUPS: { title: string; dirs: string[] }[] = [
  { title: 'Dependencies', dirs: ['node_modules', 'bower_components', 'jspm_packages', 'vendor', 'Pods', 'flow-typed'] },
  { title: 'Build output', dirs: ['dist', 'dist-electron', 'dist-tmp', 'build', 'out', 'target', 'bin', 'obj', '.next', '.nuxt', '.svelte-kit', '.astro', '.docusaurus', '.angular', '.turbo', '.parcel-cache'] },
  { title: 'Version control & caches', dirs: ['.git', '.cache', '.yarn', '.pnpm-store', '.gradle', '.nyc_output'] },
  { title: 'Backups', dirs: ['agent/backups', '.opencode-backups', 'backups'] },
  { title: 'Virtualenvs & Python caches', dirs: ['.venv', 'venv', '__pycache__', '.tox', '.mypy_cache', '.pytest_cache'] },
  { title: 'Tests & reports', dirs: ['coverage'] },
  { title: 'Editors & scratch', dirs: ['.idea', '.vscode', 'tmp', 'temp', 'logs'] },
];

export default function IgnoreSettings({ settings, ready, onChange, onReset, accent = 'cyan', mode = 'full' }: Props) {
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const c = ACCENT[accent];

  const toggleDir = (dir: string, on: boolean) => {
    const d = normaliseIgnoreEntry(dir);
    const next = on
      ? Array.from(new Set([...settings.ignoreDirs, d])).sort()
      : settings.ignoreDirs.filter(x => x !== d);
    onChange({ ignoreDirs: next });
  };

  const addCustom = () => {
    const parts = draft.split(',').map(normaliseIgnoreEntry).filter(Boolean);
    if (!parts.length) return;
    onChange({ ignoreDirs: Array.from(new Set([...settings.ignoreDirs, ...parts])).sort() });
    setDraft('');
    setShowAll(true);
  };

  const custom = settings.ignoreDirs.filter(d => !DEFAULT_IGNORE_DIRS.includes(d));
  const activeCount = settings.ignoreDirs.length;

  if (mode === 'summary') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <FolderX className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[10px] text-zinc-500">
          Ignoring <span className="text-zinc-300 tabular-nums">{activeCount}</span> directories
          {custom.length > 0 && <span className="text-zinc-600"> (+{custom.length} custom: {custom.join(', ')})</span>}
        </span>
        <button onClick={() => setShowAll(v => !v)} className={`text-[10px] ${c.btn} underline underline-offset-2`}>
          {showAll ? 'done' : 'edit'}
        </button>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={settings.excludeBackups} onChange={e => onChange({ excludeBackups: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-500">backups</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={settings.excludeDigitCopies} onChange={e => onChange({ excludeDigitCopies: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-500">digit copies</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={settings.dedupe} onChange={e => onChange({ dedupe: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-500">dedupe</span>
        </label>
      </div>
    );
  }

  if (!ready) return <div className="text-[10px] text-zinc-600">Loading ignore settings…</div>;
  if (!showAll) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <FolderX className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[10px] text-zinc-500">
          Ignoring <span className="text-zinc-300 tabular-nums">{activeCount}</span> directories
          {custom.length > 0 && <span className="text-zinc-600"> (+{custom.length} custom)</span>}
        </span>
        <button onClick={() => setShowAll(true)} className={`text-[10px] ${c.btn} underline underline-offset-2`}>edit</button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl bg-zinc-950/40 light:bg-[var(--ws-surface-40)] border border-zinc-800/70 p-2.5">
      {/* rule toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={settings.dedupe} onChange={e => onChange({ dedupe: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-400">Deduplicate same resolved path</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={settings.excludeBackups} onChange={e => onChange({ excludeBackups: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-400">Exclude backup files (*.bak, *.backup, *~, …)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={settings.excludeDigitCopies} onChange={e => onChange({ excludeDigitCopies: e.target.checked })} className={`${c.check} w-3 h-3`} />
          <span className="text-[10px] text-zinc-400">Exclude digit-suffixed copies (name2.ts when name.ts exists)</span>
        </label>
        <button onClick={onReset} className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
          <RotateCcw className="w-3 h-3" /> reset to defaults
        </button>
      </div>

      {/* directory editor */}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="add directories, comma separated — e.g. fixtures, .venv2"
          className={`flex-1 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border ${c.border} rounded-lg px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-700 focus:outline-none`}
        />
        <button onClick={addCustom} disabled={!draft.trim()}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${c.btn} bg-zinc-800/60 hover:bg-zinc-800 disabled:opacity-40 transition-colors`}>
          <Plus className="w-3 h-3" /> add
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
        {GROUPS.map(g => (
          <div key={g.title}>
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">{g.title}</div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
              {g.dirs.filter(d => DEFAULT_IGNORE_DIRS.includes(d)).map(d => (
                <label key={d} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ignoreDirs.includes(d)}
                    onChange={e => toggleDir(d, e.target.checked)}
                    className={`${c.check} w-2.5 h-2.5`}
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">{d}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {custom.length > 0 && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Custom</div>
            <div className="flex flex-wrap gap-1">
              {custom.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/70 text-[10px] font-mono text-zinc-300">
                  {d}
                  <button onClick={() => toggleDir(d, false)} className="text-zinc-600 hover:text-zinc-300"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}