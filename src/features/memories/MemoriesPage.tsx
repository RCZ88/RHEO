import { useMemo, useState } from 'react';
import { Images, Heart, ArrowUpDown } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { TabBar } from '../../components/TabBar';
import { EmptyState } from '../../components/EmptyState';
import { useMemories, type LoadedMemory } from './useMemories';
import { useMemoryGroups } from './useMemoryGroups';
import { MemoryUploader } from './MemoryUploader';
import { MemoryReveal } from './MemoryReveal';
import { AlbumShelf } from './AlbumShelf';
import { AlbumSpread } from './AlbumSpread';
import { AllPhotosView } from './AllPhotosView';
import { SuggestionStrip } from './SuggestionStrip';
import { SelectionBar } from './SelectionBar';
import { OnThisDayStrip } from './OnThisDayStrip';
import type { MemoryGroup } from './types';

interface MemoriesPageProps {
  embedded?: boolean;
}

export default function MemoriesPage({ embedded = false }: MemoriesPageProps = {}) {
  const { items, upload, remove, updateMeta, onThisDay, allTags } = useMemories();
  const { groups, loading: groupsLoading, error: groupsError, createGroup, updateGroup, deleteGroup, setCover, suggestions, acceptSuggestion, dismissSuggestion } = useMemoryGroups(items);

  const [tab, setTab] = useState<'albums' | 'all'>('albums');
  const [sortBy, setSortBy] = useState<'captured' | 'added'>('captured');
  const [active, setActive] = useState<LoadedMemory | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const people = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of items) for (const p of m.meta.people) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const openAlbum = groups.find(g => g.id === openAlbumId) || null;
  const openAlbumMembers = openAlbum ? items.filter(m => m.meta.groupId === openAlbum.id) : [];

  const handleCreateGroup = async () => {
    const group = await createGroup({ title: 'Untitled album' });
    setOpenAlbumId(group.id);
  };

  const handleAcceptSuggestion = async (s: any) => {
    const group = await acceptSuggestion(s);
    const pendingIds = (group as any)._pendingMemoryIds as string[] | undefined;
    if (pendingIds) {
      for (const id of pendingIds) {
        await updateMeta(id, { groupId: group.id });
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!openAlbum) return;
    // Clear members' groupId first
    for (const m of openAlbumMembers) {
      await updateMeta(m.meta.id, { groupId: undefined });
    }
    await deleteGroup(openAlbum.id);
    setOpenAlbumId(null);
  };

  const handleSetCover = async (memoryId: string) => {
    if (!openAlbum) return;
    await setCover(openAlbum.id, memoryId);
  };

  const handleUpdateGroup = async (patch: Partial<MemoryGroup>) => {
    if (!openAlbum) return;
    await updateGroup(openAlbum.id, patch);
  };

  const handleToggleSelect = (id: string) => {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMoveSelected = async (groupId: string | null) => {
    for (const id of selection) {
      await updateMeta(id, { groupId: groupId || undefined });
    }
    setSelection(new Set());
    setSelectMode(false);
  };

  const handleOpenMemory = (m: LoadedMemory) => {
    setActive(m);
  };

  const handleAddPhotos = () => {
    setTab('all');
    setSelectMode(true);
  };

  const body = (
    <div
      className={embedded ? 'space-y-4' : 'max-w-4xl mx-auto space-y-4'}
      onPaste={e => {
        const files = Array.from(e.clipboardData?.files || []);
        if (files.length) upload(files);
      }}
    >
      <div className="flex items-center justify-between">
        {embedded ? (
          <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
            <Heart className="w-3 h-3 text-[var(--color-clay-400)]" /> The people and moments outside the work
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-mem-400-15)] flex items-center justify-center text-[var(--color-mem-400)]">
              <Images className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Memories</h1>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Heart className="w-3 h-3 text-[var(--color-clay-400)]" /> The people and moments outside the work
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <ArrowUpDown className="w-3 h-3" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'captured' | 'added')}
              aria-label="Sort memories"
              className="bg-transparent text-[11px] text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="captured">Date it happened</option>
              <option value="added">Date added</option>
            </select>
          </div>
          <TabBar
            tabs={[{ key: 'albums', label: 'Albums' }, { key: 'all', label: 'All' }]}
            activeKey={tab}
            onTabChange={k => { setTab(k as 'albums' | 'all'); setSelection(new Set()); setSelectMode(false); }}
          />
          {tab === 'all' && (
            <button
              type="button"
              onClick={() => setSelectMode(!selectMode)}
              className="px-2 py-1 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {selectMode ? 'Done selecting' : 'Select'}
            </button>
          )}
        </div>
      </div>

      <OnThisDayStrip items={onThisDay} onOpen={setActive} />

      <MemoryUploader onFiles={upload} />

      {people.length > 0 && tab === 'all' && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by person">
          <button
            type="button"
            onClick={() => setPerson(null)}
            aria-pressed={person === null}
            className={`px-2 py-1 rounded-full border text-[11px] transition-colors ${person === null ? 'border-[var(--page-accent)] text-[var(--page-accent)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Everyone
          </button>
          {people.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setPerson(person === name ? null : name)}
              aria-pressed={person === name}
              className={`px-2 py-1 rounded-full border text-[11px] transition-colors ${person === name ? 'border-[var(--page-accent)] text-[var(--page-accent)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              {name} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No memories yet"
          description="Add a photo or video of someone or something you love. This space stays yours -- nothing leaves this device."
        />
      ) : tab === 'albums' ? (
        openAlbum ? (
          <AlbumSpread
            group={openAlbum}
            members={openAlbumMembers}
            onBack={() => setOpenAlbumId(null)}
            onUpdateGroup={handleUpdateGroup}
            onDeleteGroup={handleDeleteGroup}
            onSetCover={handleSetCover}
            onOpenMemory={handleOpenMemory}
            onAddPhotos={handleAddPhotos}
          />
        ) : (
          <>
            <SuggestionStrip
              suggestions={suggestions}
              onAccept={handleAcceptSuggestion}
              onDismiss={dismissSuggestion}
            />
            <AlbumShelf
              groups={groups}
              items={items}
              loading={groupsLoading}
              error={groupsError}
              onRetry={() => {}}
              onOpenGroup={g => setOpenAlbumId(g.id)}
              onCreateGroup={handleCreateGroup}
            />
          </>
        )
      ) : (
        <AllPhotosView
          items={items.filter(m => person ? m.meta.people.includes(person) : true)}
          groups={groups}
          sort={sortBy}
          filterPerson={person}
          selectable={selectMode}
          selected={selection}
          onToggleSelect={handleToggleSelect}
          onOpen={handleOpenMemory}
        />
      )}

      {selection.size > 0 && (
        <SelectionBar
          count={selection.size}
          groups={groups}
          onMoveTo={handleMoveSelected}
          onClear={() => { setSelection(new Set()); setSelectMode(false); }}
        />
      )}
    </div>
  );

  const overlays = (
    <>
      {active && (
        <MemoryReveal
          memory={active}
          onClose={() => setActive(null)}
          onDelete={() => { remove(active.meta.id); setActive(null); }}
          onUpdatePeople={people => { updateMeta(active.meta.id, { people }); setActive({ ...active, meta: { ...active.meta, people } }); }}
          onUpdateCaption={caption => updateMeta(active.meta.id, { caption })}
          onUpdateTitle={title => updateMeta(active.meta.id, { title })}
          onUpdateLocation={location => updateMeta(active.meta.id, { location })}
          onUpdateGroup={groupId => updateMeta(active.meta.id, { groupId })}
          onUpdateTags={tags => updateMeta(active.meta.id, { tags })}
          onUpdateDate={date => {
            updateMeta(active.meta.id, { date, capturedAt: date });
            setActive({ ...active, meta: { ...active.meta, date, capturedAt: date } });
          }}
          onUpdateNotes={noteIds => {
            updateMeta(active.meta.id, { noteIds });
            setActive({ ...active, meta: { ...active.meta, noteIds } });
          }}
          groups={groups}
          onCreateGroup={async (title) => {
            const g = await createGroup({ title });
            return g;
          }}
          allTags={allTags}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        {body}
        {overlays}
      </>
    );
  }

  return (
    <PageShell page="memories">
      {body}
      {overlays}
    </PageShell>
  );
}