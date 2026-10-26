import { useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Check, ChevronRight, Clock, Target, AppWindow, Globe, Tag } from 'lucide-react';
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
  expanded,
  onSelect,
  onToggleMulti,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  group: FocusGroup;
  active: boolean;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleMulti: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = groupAccent(group.name);
  const appCount = group.allowed_apps.length;
  const siteCount = group.allowed_domains.length;
  const categoryCount = group.allowed_categories.length;
  const sitePreviewCount = appCount === 0 ? 2 : 1;

  return (
    <div
      className={cn(
        'group relative rounded-lg transition-colors',
        active
          ? 'bg-[var(--page-accent-10)] border border-[var(--page-accent)]/20'
          : 'border border-transparent hover:bg-zinc-800/40 hover:border-zinc-800/60'
      )}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: accent }} />
      )}

      {/* Main row */}
      <div
        className="px-3 py-2.5 cursor-pointer"
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
        {/* Line 1 — identity + controls */}
        <div className="flex items-center gap-2.5">
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
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
            <span className="text-[13px] font-medium text-zinc-200 truncate">{group.name}</span>
            {active && (
              <Badge variant="secondary" className="text-[9px] shrink-0" style={{ color: accent, background: `${accent}18` }}>
                active
              </Badge>
            )}
          </div>

          {/* Expand toggle — larger, more prominent */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleExpand(); }}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-md transition-colors flex-shrink-0',
              expanded
                ? 'bg-zinc-700/50 text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/30'
            )}
            aria-label={expanded ? 'Collapse details' : 'Show details'}
            aria-expanded={expanded}
          >
            <ChevronRight className={cn(
              'w-4 h-4 transition-transform duration-150',
              expanded && 'rotate-90'
            )} />
          </button>

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

        {/* Line 2 — always-visible content preview: real names, not just counts */}
        {!expanded && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 pl-[26px]">
            {appCount + siteCount + categoryCount === 0 ? (
              <span className="text-[10px] text-zinc-600">No apps or sites configured</span>
            ) : (
              <>
                {group.allowed_apps.slice(0, 3).map((app, i) => (
                  <span
                    key={`app-${i}-${app}`}
                    className="inline-flex items-center gap-1 max-w-[104px] px-1.5 py-0.5 rounded text-[9px]"
                    style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}
                    title={app}
                  >
                    <AppWindow className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate min-w-0">{app}</span>
                  </span>
                ))}
                {appCount > 3 && (
                  <span className="text-[9px] text-zinc-500" title={group.allowed_apps.slice(3).join(', ')}>
                    +{appCount - 3} more
                  </span>
                )}

                {group.allowed_domains.slice(0, sitePreviewCount).map((domain, i) => (
                  <span
                    key={`site-${i}-${domain}`}
                    className="inline-flex items-center gap-1 max-w-[104px] px-1.5 py-0.5 rounded text-[9px]"
                    style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}
                    title={domain}
                  >
                    <Globe className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate min-w-0">{domain}</span>
                  </span>
                ))}
                {siteCount > sitePreviewCount && (
                  <span className="text-[9px] text-zinc-500" title={group.allowed_domains.slice(sitePreviewCount).join(', ')}>
                    +{siteCount - sitePreviewCount} sites
                  </span>
                )}

                {categoryCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-zinc-500" title={group.allowed_categories.join(', ')}>
                    <Tag className="w-2.5 h-2.5" />
                    {categoryCount} cat{categoryCount !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
            {group.strictness === 'non_allowed' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">strict</span>
            )}
            {group.default_duration != null && (
              <span className="inline-flex items-center gap-1 text-[9px] text-zinc-500">
                <Clock className="w-2.5 h-2.5" />
                {Math.round(group.default_duration / 60)}m default
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <GroupDetail group={group} />
      )}
    </div>
  );
}

function GroupDetail({ group }: { group: FocusGroup }) {
  const accent = groupAccent(group.name);
  const appCount = group.allowed_apps.length;
  const siteCount = group.allowed_domains.length;
  const categoryCount = group.allowed_categories.length;

  return (
    <div className="border-t border-zinc-800/60 mx-3 mb-3 mt-1 pt-3 space-y-2.5">
      {/* Apps */}
      {appCount > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Apps ({appCount})</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {group.allowed_apps.map((app, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
              >
                {app}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sites */}
      {siteCount > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Sites ({siteCount})</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {group.allowed_domains.map((domain, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {categoryCount > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Categories ({categoryCount})</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {group.allowed_categories.map((cat, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {group.description && (
        <p className="text-[11px] text-zinc-500 leading-relaxed italic">{group.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 pt-1.5 border-t border-zinc-800/40">
        <span className="flex items-center gap-1.5 text-[11px]">
          {group.strictness === 'non_allowed' ? (
            <span className="text-amber-400">Strict</span>
          ) : (
            <span className="text-zinc-400">Lenient</span>
          )}
        </span>
        {group.default_duration != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Clock className="w-3.5 h-3.5" style={{ color: accent }} />
            {Math.round(group.default_duration / 60)}m default
          </span>
        )}
        {group.daily_goal_sec != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Target className="w-3.5 h-3.5" style={{ color: accent }} />
            {Math.round(group.daily_goal_sec / 60)}m/day goal
          </span>
        )}
      </div>
    </div>
  );
}

export function FocusGroupsPanel({
  groups,
  selectedId,
  onSelect,
  selectedIds,
  onToggleSelect,
  onCreate,
  onEdit,
  onDelete,
}: FocusGroupsPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

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
        <div className="space-y-0 max-h-[420px] overflow-y-auto ws-scroll pr-1 flex-1">
          {groups.map(g => (
            <GroupRow
              key={g.id}
              group={g}
              active={g.id === selectedId}
              selected={selectedIds.includes(g.id)}
              expanded={expandedId === g.id}
              onSelect={() => onSelect(g.id === selectedId ? null : g.id)}
              onToggleMulti={() => onToggleSelect(g.id)}
              onToggleExpand={() => toggleExpand(g.id)}
              onEdit={() => onEdit(g)}
              onDelete={() => onDelete(g)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onCreate}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-clay-400 hover:text-clay-300 text-[12px] font-semibold py-2 rounded-lg border border-zinc-800/60 hover:border-clay-500/30 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        New group
      </button>
    </GlassCard>
  );
}
