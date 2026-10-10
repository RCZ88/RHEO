import { useEffect, useMemo, useState } from 'react';
import { Search, X, Layers, FolderPlus, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

/**
 * AppUsageGoalPicker — CLOSED-ended application selector for app-usage goals.
 *
 * Unlike the old free-text keyword box, this only lets the user pick from apps
 * that have actually been detected/tracked by the OS-level tracker (via the
 * `get-known-apps` IPC). The user can type to SEARCH the detected list, but
 * cannot enter arbitrary text — keeping app-usage goals grounded in real data.
 *
 * It also surfaces a clear distinction from Focus Groups and offers to bundle
 * the selected apps into a Focus Group (so the same set can be reused for
 * distraction-free focus sessions, which is a different concept: focus groups
 * track time *inside* a curated set, whereas app-usage goals track time spent
 * in specific apps across the day).
 */

interface KnownApp {
  app: string;
  category: string | null;
  last_used: string | number;
  is_browser_tracking: number | null;
}

export interface AppUsageGoalPickerValue {
  /** Selected app names (closed-ended — must exist in known apps). */
  apps: string[];
  /** Whether the user chose to also bundle these into a Focus Group. */
  groupAsFocus?: boolean;
  /** Name for the new Focus Group (only used when groupAsFocus is true). */
  focusGroupName?: string;
}

interface AppUsageGoalPickerProps {
  value: AppUsageGoalPickerValue;
  onChange: (next: AppUsageGoalPickerValue) => void;
  /** Optional existing focus groups, used to suggest reuse instead of creating a new one. */
  existingFocusGroups?: { id: number; name: string; allowed_apps?: string[] }[];
}

function appInitials(name: string): string {
  const clean = name.replace(/\.(exe|app)$/i, '').trim();
  const parts = clean.split(/[\s_\-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function appColor(name: string): string {
  // Deterministic accent from the app name so each chip is stable.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 60%)`;
}

export function AppUsageGoalPicker({ value, onChange, existingFocusGroups = [] }: AppUsageGoalPickerProps) {
  const [apps, setApps] = useState<KnownApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = (window as any).deskflowAPI?.getKnownApps?.();
        const list = (await raw) || [];
        if (!cancelled) setApps(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setApps([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? apps.filter(a => a.app.toLowerCase().includes(q)) : apps;
    // Selected apps always bubble to the top.
    return [...list].sort((a, b) => {
      const as = value.apps.includes(a.app) ? 0 : 1;
      const bs = value.apps.includes(b.app) ? 0 : 1;
      if (as !== bs) return as - bs;
      return String(b.last_used).localeCompare(String(a.last_used));
    });
  }, [apps, query, value.apps]);

  const toggleApp = (app: string) => {
    const has = value.apps.includes(app);
    const nextApps = has ? value.apps.filter(a => a !== app) : [...value.apps, app];
    onChange({ ...value, apps: nextApps });
  };

  const selectedFocusMatch = useMemo(() => {
    if (value.apps.length === 0) return null;
    return existingFocusGroups.find(g =>
      g.allowed_apps &&
      value.apps.every(a => g.allowed_apps!.includes(a))
    ) || null;
  }, [existingFocusGroups, value.apps]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search detected apps…"
          className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 focus-visible:ring-amber-500/50 text-[13px] h-8 pl-8"
        />
      </div>

      {loading ? (
        <div className="text-[11px] text-zinc-500 py-2">Loading detected apps…</div>
      ) : apps.length === 0 ? (
        <div className="text-[11px] text-zinc-500 py-2">
          No apps detected yet. Track some app usage first, then come back to pick them here.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
          {filtered.map(a => {
            const selected = value.apps.includes(a.app);
            return (
              <button
                type="button"
                key={a.app}
                onClick={() => toggleApp(a.app)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] transition-all duration-150 ${selected
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 text-zinc-300 hover:border-zinc-600'}`}
              >
                <span
                  className="w-4 h-4 rounded grid place-items-center text-[8px] font-bold text-black/80"
                  style={{ backgroundColor: appColor(a.app) }}
                >
                  {appInitials(a.app)}
                </span>
                <span className="truncate max-w-[140px]">{a.app}</span>
                {selected && <Check size={11} className="text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {value.apps.length > 0 && (
        <div className="p-3 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-zinc-400">
            <Layers size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <span>
              These apps are tracked as <span className="text-amber-300">app-usage</span> — i.e. time
              spent in them counts toward this goal. This is different from a{' '}
              <span className="text-violet-300">Focus Group</span>, which curates a set for
              distraction-free focus sessions.
            </span>
          </div>

          {selectedFocusMatch ? (
            <div className="text-[11px] text-violet-300 flex items-center gap-1.5">
              <FolderPlus size={12} /> Already in Focus Group “{selectedFocusMatch.name}”.
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={value.groupAsFocus ? 'default' : 'outline'}
                onClick={() => onChange({ ...value, groupAsFocus: !value.groupAsFocus })}
                className={`text-[11px] h-7 ${value.groupAsFocus
                  ? 'bg-violet-500/20 text-violet-200 border-violet-500/30'
                  : 'text-zinc-400 border-zinc-700/50 hover:border-violet-500/30'}`}
              >
                <FolderPlus size={12} className="mr-1" />
                Group these as a Focus Group
              </Button>
              {value.groupAsFocus && (
                <Input
                  value={value.focusGroupName || ''}
                  onChange={e => onChange({ ...value, focusGroupName: e.target.value })}
                  placeholder="Focus Group name"
                  className="flex-1 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 text-[12px] h-7"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AppUsageGoalPicker;
