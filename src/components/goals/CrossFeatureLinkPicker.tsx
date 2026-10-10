import { useEffect, useState } from 'react';
import { BookOpen, DollarSign, Activity, Code, Zap, Clock, CalendarDays, Bell, FileText, Globe, Moon, Brain, Settings, X, LoaderCircle } from 'lucide-react';
import type { CrossFeatureLink } from '../../types/goals';

interface CrossFeatureLinkPickerProps {
  value: CrossFeatureLink | null;
  onChange: (link: CrossFeatureLink | null) => void;
}

/* Only features with a REAL loader in preload are offered.
 *
 * `finance`, `external`, `browser` and `sleep` were listed here but their
 * loaders called methods that do not exist on window.deskflowAPI
 * (financeGoalGetAll / activityGoalGetAll / getIdeProjects / …), so selecting one
 * always produced an empty list with no explanation. `sleep` has no data model
 * at all — there is no sleep table anywhere in the schema.
 *
 * A link option that can never resolve is worse than no option: it advertises a
 * capability that does not exist. Re-add a row here when its API lands. */
const FEATURE_OPTIONS = [
  { feature: 'learn' as const, label: 'Learn', icon: BookOpen, color: 'text-cyan-400' },
  { feature: 'ide' as const, label: 'IDE Projects', icon: Code, color: 'text-violet-400' },
  { feature: 'focus' as const, label: 'Focus', icon: Zap, color: 'text-emerald-400' },
  { feature: 'schedule' as const, label: 'Schedule', icon: Clock, color: 'text-pink-400' },
  { feature: 'deadline' as const, label: 'Deadlines', icon: CalendarDays, color: 'text-red-400' },
  { feature: 'reminder' as const, label: 'Reminders', icon: Bell, color: 'text-amber-400' },
  { feature: 'note' as const, label: 'Notes', icon: FileText, color: 'text-cyan-400' },
  { feature: 'brain' as const, label: 'Context Brain', icon: Brain, color: 'text-purple-400' },
  { feature: 'composition' as const, label: 'Automations', icon: Settings, color: 'text-orange-400' },
];

interface Entity {
  id: string;
  label: string;
}

export function CrossFeatureLinkPicker({ value, onChange }: CrossFeatureLinkPickerProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(value?.feature || null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFeature) { setEntities([]); return; }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const api = (window as any).deskflowAPI;
        let items: Entity[] = [];
        if (selectedFeature === 'learn') {
          const goals = await api?.learnGetGoals?.({ type: 'daily' });
          items = (goals || []).map((g: any) => ({ id: String(g.id), label: g.metric || g.title || `Goal ${g.id}` }));
        } else if (selectedFeature === 'focus') {
          const groups = await api?.focusGroup?.list?.();
          items = (groups || []).map((g: any) => ({ id: String(g.id), label: g.name }));
        } else if (selectedFeature === 'ide') {
          // getIdeProjects does not exist; the real names are getProjects / getAllProjects.
          const res = await api?.getAllProjects?.();
          const projects = Array.isArray(res) ? res : (res?.projects || []);
          items = projects.map((p: any) => ({ id: String(p.id ?? p.path), label: p.name || p.path }));
        } else if (selectedFeature === 'schedule') {
          const res = await api?.getSchedule?.();
          items = (res?.entries || []).map((e: any) => ({ id: e.id, label: `${e.title} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][e.day_of_week]} ${e.start_time})` }));
        } else if (selectedFeature === 'deadline') {
          const res = await api?.getDeadlines?.({ days: 90 });
          items = (res?.deadlines || []).map((d: any) => ({ id: d.id, label: `${d.title} (${d.due_date})` }));
        } else if (selectedFeature === 'reminder') {
          const res = await api?.getReminders?.();
          items = (res?.reminders || []).map((r: any) => ({ id: r.id, label: r.text }));
        } else if (selectedFeature === 'note') {
          const res = await api?.notesList?.();
          items = (res || []).map((n: any) => ({ id: n.id, label: n.title || n.content?.slice(0, 50) || 'Untitled' }));
        } else if (selectedFeature === 'brain') {
          const res = await api?.brainGetEntities?.();
          items = (res?.entities || []).map((e: any) => ({ id: e.id, label: e.name }));
        } else if (selectedFeature === 'composition') {
          const res = await api?.compositionsList?.();
          items = (res?.rules || []).map((r: any) => ({ id: r.id, label: r.name }));
        }
        if (mounted) setEntities(items);
      } catch { if (mounted) setEntities([]); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [selectedFeature]);

  if (value) {
    const featureMeta = FEATURE_OPTIONS.find(f => f.feature === value.feature);
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
        {featureMeta && <featureMeta.icon size={13} className={featureMeta.color} />}
        <span className="text-[11px] text-violet-300 flex-1 truncate">{value.label}</span>
        <button type="button" onClick={() => { onChange(null); setSelectedFeature(null); }} className="text-zinc-500 hover:text-zinc-300">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-zinc-500 block">Link to another feature (optional)</label>
      <div className="flex gap-1.5 flex-wrap">
        {FEATURE_OPTIONS.map(f => (
          <button
            key={f.feature}
            type="button"
            onClick={() => setSelectedFeature(f.feature)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
              selectedFeature === f.feature
                ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
            }`}
          >
            <f.icon size={10} className={`inline mr-0.5 ${f.color}`} />{f.label}
          </button>
        ))}
      </div>
      {selectedFeature && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 p-2" aria-busy="true">
              <LoaderCircle size={10} className="animate-spin" aria-hidden /> Loading...
            </div>
          ) : entities.length === 0 ? (
            /* Say WHAT would be here, not just "no items" (PAINT P5). */
            <p className="text-[10px] text-zinc-600 p-2">
              Nothing in {FEATURE_OPTIONS.find(f => f.feature === selectedFeature)?.label} yet.
              Create one there first, then come back to link it.
            </p>
          ) : (
            entities.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => onChange({ feature: selectedFeature as CrossFeatureLink['feature'], entityId: e.id, label: e.label })}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-300 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors truncate"
              >
                {e.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
