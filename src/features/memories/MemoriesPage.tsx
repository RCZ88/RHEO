import { useMemo, useState } from 'react';
import { Images, Heart, ArrowUpDown } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { TabBar } from '../../components/TabBar';
import { EmptyState } from '../../components/EmptyState';
import { useMemories, type LoadedMemory } from './useMemories';
import { MemoryUploader } from './MemoryUploader';
import { MemoryCollageGrid } from './MemoryCollageGrid';
import { MemoryTimeline } from './MemoryTimeline';
import { MemoryReveal } from './MemoryReveal';
import { OnThisDayCard } from './OnThisDayCard';

interface MemoriesPageProps {
  embedded?: boolean;
}

export default function MemoriesPage({ embedded = false }: MemoriesPageProps = {}) {
  const { items, upload, remove, updateMeta, onThisDay, groupedByMonth } = useMemories();
  const [tab, setTab] = useState<'collage' | 'timeline'>('collage');
  /* 'captured' = when it happened (meta.date, EXIF-aware, drives On This Day).
     'added' = when it landed in the app (createdAt). They are genuinely
     different orders and the user picked neither before. */
  const [sortBy, setSortBy] = useState<'captured' | 'added'>('captured');
  const [active, setActive] = useState<LoadedMemory | null>(null);
  const [person, setPerson] = useState<string | null>(null);

  /* `people` has been on every memory the whole time and was invisible outside
     the edit dialog. This page claims to be "the people and moments outside the
     work", so being able to ask "show me Sam" is the page's whole point. */
  const people = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of items) for (const p of m.meta.people) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const sorted = useMemo(() => {
    const arr = person ? items.filter(m => m.meta.people.includes(person)) : [...items];
    arr.sort(sortBy === 'captured'
      ? (x, y) => (y.meta.date || '').localeCompare(x.meta.date || '')
      : (x, y) => (y.meta.createdAt || 0) - (x.meta.createdAt || 0));
    return arr;
  }, [items, person, sortBy]);

  const groupedMonths = useMemo(() => {
    const map = new Map<string, LoadedMemory[]>();
    for (const m of sorted) {
      const key = (m.meta.date || '').slice(0, 7) || 'Undated';
      const arr = map.get(key);
      if (arr) arr.push(m); else map.set(key, [m]);
    }
    return [...map.entries()] as [string, LoadedMemory[]][];
  }, [sorted]);

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
            <Heart className="w-3 h-3 text-[#e8866b]" /> The people and moments outside the work
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-mem-400)]/15 flex items-center justify-center text-[var(--color-mem-400)]">
              <Images className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Memories</h1>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Heart className="w-3 h-3 text-[#e8866b]" /> The people and moments outside the work
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
            tabs={[{ key: 'collage', label: 'Collage' }, { key: 'timeline', label: 'Timeline' }]}
            activeKey={tab}
            onTabChange={k => setTab(k as 'collage' | 'timeline')}
          />
        </div>
      </div>

      <OnThisDayCard items={onThisDay} onOpen={setActive} />

      <MemoryUploader onFiles={upload} />

      {people.length > 0 && (
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
      ) : sorted.length === 0 ? (
        /* The archive is not empty, this person just has nothing in it. Saying
           "No memories yet" here would be a lie and would hide the uploader. */
        <div className="rounded-xl border border-[var(--border-subtle)] px-6 py-10 text-center">
          <p className="text-[13px] text-[var(--text-primary)]">
            No memories with {person} yet
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Pick someone else, or add a photo of them.
          </p>
          <button
            type="button"
            onClick={() => setPerson(null)}
            className="mt-3 text-[11px] text-[var(--page-accent)] hover:underline"
          >
            Show everyone
          </button>
        </div>
      ) : tab === 'collage' ? (
        <MemoryCollageGrid items={sorted} onOpen={setActive} />
      ) : (
        <MemoryTimeline groups={groupedMonths} onOpen={setActive} />
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
          onUpdateDate={date => {
            updateMeta(active.meta.id, { date, capturedAt: date });
            setActive({ ...active, meta: { ...active.meta, date, capturedAt: date } });
          }}
          onUpdateNotes={noteIds => {
            updateMeta(active.meta.id, { noteIds });
            setActive({ ...active, meta: { ...active.meta, noteIds } });
          }}
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
