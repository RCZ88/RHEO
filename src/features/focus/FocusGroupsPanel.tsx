import { Layers, Plus, Pencil, Trash2, AppWindow, Globe, Tag, Check, ChevronRight } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Badge } from '../../components/ui/badge';
import type { FocusGroup } from '../../hooks/useFocusGroups';
import { groupAccent } from './focusHelpers';
import { cn } from '@/lib/utils';

interface FocusGroupsPanelProps {
  groups: FocusGroup[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onCreate: () => void;
  onEdit: (g: FocusGroup) => void;
  onDelete: (g: FocusGroup) => void;
}

function GroupRow({
  group,
  active,
  selected,
  onSelect,
  onToggleMulti,
  onEdit,
  onDelete,
}: {
  group: FocusGroup;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleMulti: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = groupAccent(group.name);
  const appCount = group.allowed_apps.length;
  const siteCount = group.allowed_domains.length;
  const categoryCount = group.allowed_categories.length;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
        active
          ? 'bg-[var(--page-accent)]/10 border border-[var(--page-accent)]/20'
          : 'border border-transparent hover:bg-zinc-800/40 hover:border-zinc-800/60'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: accent }} />
      )}

      {/* Multi-select checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${group.name} for combined focus`}
        onClick={e => { e.stopPropagation(); onToggleMulti(); }}
        className={cn(
          'w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors flex-shrink-0',
          selected
            ? 'border-clay-400 bg-clay-500/80'
            : 'border-zinc-600 hover:border-zinc-400 bg-transparent'
        )}
      >
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Accent dot + name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: accent }}
        />
        <span className="text-[13px] font-medium text-zinc-200 truncate">{group.name}</span>
        {active && (
          <Badge variant="secondary" className="text-[9px] shrink-0" style={{ color: accent, background: `${accent}18` }}>
            active
          </Badge>
        )}
      </div>

      {/* Meta badges */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-shrink-0">
        {appCount > 0 && (
          <span className="flex items-center gap-1">
            <AppWindow className="w-3 h-3" style={{ color: accent }} />
            {appCount}
          </span>
        )}
        {siteCount > 0 && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" style={{ color: accent }} />
            {siteCount}
          </span>
        )}
        {categoryCount > 0 && (
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" style={{ color: accent }} />
            {categoryCount}
          </span>
        )}
      </div>

      {/* Chevron for active */}
      {active && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-clay-300 transition-colors"
          aria-label={`Edit ${group.name}`}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
          aria-label={`Delete ${group.name}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function FocusGroupsPanel({ groups, selectedId, onSelect, selectedIds, onToggleSelect, onCreate, onEdit, onDelete }: FocusGroupsPanelProps) {
  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-clay-400" />
          Focus groups
        </h3>
        <span className="text-[10px] text-zinc-500">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
      </div>

      {groups.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="border-dashed border-zinc-700/70 rounded-lg py-6 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors w-full"
        >
          <Layers className="w-4 h-4" />
          <span className="text-[12px] font-medium">Create your first focus group</span>
          <span className="text-[10px]">A named set of apps, sites and categories</span>
        </button>
      ) : (
        <>
          <div className="space-y-1 max-h-[380px] overflow-y-auto ws-scroll pr-1 flex-1">
            {groups.map(g => (
              <GroupRow
                key={g.id}
                group={g}
                active={g.id === selectedId}
                selected={selectedIds.includes(g.id)}
                onSelect={() => onSelect(g.id === selectedId ? null : g.id)}
                onToggleMulti={() => onToggleSelect(g.id)}
                onEdit={() => onEdit(g)}
                onDelete={() => onDelete(g)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-clay-400 hover:text-clay-300 text-[12px] font-semibold py-2 rounded-lg border border-zinc-800/60 hover:border-clay-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New group
          </button>
        </>
      )}
    </GlassCard>
  );
}
