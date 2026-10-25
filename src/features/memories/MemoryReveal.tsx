import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Tag, CalendarDays, StickyNote, FolderOpen, MapPin } from 'lucide-react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { PersonChip } from './PersonChip';
import { LocationAutocomplete } from '../../components/ui/LocationAutocomplete';
import { GroupSelect } from './GroupSelect';

interface MemoryRevealProps {
  memory: LoadedMemory;
  onClose: () => void;
  onDelete: () => void;
  onUpdatePeople: (people: string[]) => void;
  onUpdateCaption: (caption: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateLocation: (location: string) => void;
  onUpdateGroup: (groupId: string | undefined) => void;
  onUpdateTags: (tags: string[]) => void;
  /** meta.date drives the timeline grouping AND On This Day — it was writable
      via updateMeta but no UI ever exposed it, so a wrong EXIF date was
      permanently wrong. */
  onUpdateDate: (date: string) => void;
  onUpdateNotes: (noteIds: string[]) => void;
  groups: MemoryGroup[];
  onCreateGroup: (title: string) => Promise<MemoryGroup>;
  allTags: string[];
}

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 } };
const layoutTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };
const panelMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: 0.15 },
};

export function MemoryReveal({ memory, onClose, onDelete, onUpdatePeople, onUpdateCaption, onUpdateTitle, onUpdateLocation, onUpdateGroup, onUpdateTags, onUpdateDate, onUpdateNotes, groups, onCreateGroup, allTags }: MemoryRevealProps) {
  const [caption, setCaption] = useState(memory.meta.caption || '');
  const [title, setTitle] = useState(memory.meta.title || '');
  const [location, setLocation] = useState(memory.meta.location || '');
  const [tags, setTags] = useState<string[]>(memory.meta.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [personInput, setPersonInput] = useState('');
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);
  const [noteQuery, setNoteQuery] = useState('');
  const linkedNotes = memory.meta.noteIds || [];

  /* Notes the memory can attach to. Loaded lazily so the overlay stays cheap. */
  useEffect(() => {
    let alive = true;
    const api = (window as any).deskflowAPI;
    if (!api?.notesList) return;
    api.notesList({ includeDrafts: true })
      .then((r: any) => {
        if (!alive) return;
        const rows = Array.isArray(r) ? r : (r?.data ?? r?.notes ?? []);
        if (Array.isArray(rows)) setNotes(rows.filter((n: any) => n?.id));
      })
      .catch(() => { if (alive) setNotes([]); });
    return () => { alive = false; };
  }, [memory.meta.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        initial={overlayMotion.initial}
        animate={overlayMotion.animate}
        exit={overlayMotion.initial}
        onClick={onClose}
      >
        <motion.div
          layoutId={`memory-${memory.meta.id}`}
          onClick={e => e.stopPropagation()}
          transition={layoutTransition}
          className="relative w-full max-w-3xl max-h-[85vh] rounded-xl overflow-hidden bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 flex flex-col"
        >
          <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center">
            {memory.meta.kind === 'video' ? (
              <video src={memory.url} controls autoPlay className="max-h-[60vh] w-full" />
            ) : (
              <img src={memory.url} alt={memory.meta.caption || ''} className="max-h-[60vh] w-full object-contain" />
            )}
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <motion.div
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            transition={panelMotion.transition}
            className="p-4 space-y-2 warmth-serif"
          >
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => onUpdateTitle(title)}
              onKeyDown={e => { if (e.key === 'Enter') { onUpdateTitle(title); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Untitled"
              className="w-full bg-transparent pb-1 font-['Space_Grotesk'] text-[18px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none border-b border-transparent focus:border-[var(--border-subtle)]"
            />
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              onBlur={() => onUpdateCaption(caption)}
              placeholder="Add a caption for this memory"
              className="w-full bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-zinc-600 focus:outline-none"
            />
            {/* Date — writable but previously unreachable from the UI. */}
            <label className="flex items-center gap-2 pt-1">
              <CalendarDays className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
              <span className="text-[11px] text-[var(--text-muted)]">Date</span>
              <input
                type="date"
                value={memory.meta.date || ''}
                onChange={e => e.target.value && onUpdateDate(e.target.value)}
                aria-label="Memory date"
                className="bg-transparent text-[12px] text-[var(--text-primary)] focus:outline-none"
              />
            </label>

            {/* Location */}
            <div className="flex items-center gap-2 pt-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
              <span className="text-[11px] text-[var(--text-muted)] w-16">Location</span>
              <LocationAutocomplete
                value={location}
                onChange={v => { setLocation(v); onUpdateLocation(v); }}
                placeholder="Where was this?"
                className="flex-1"
              />
            </div>

            {/* Album */}
            <div className="flex items-center gap-2 pt-1">
              <FolderOpen className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
              <span className="text-[11px] text-[var(--text-muted)] w-16">Album</span>
              <GroupSelect
                groups={groups}
                value={memory.meta.groupId}
                onChange={gid => onUpdateGroup(gid)}
                onCreate={async (title) => {
                  const g = await onCreateGroup(title);
                  return g;
                }}
                onAssign={gid => onUpdateGroup(gid)}
              />
            </div>

            {/* Tags */}
            <div className="pt-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
                <span className="text-[11px] text-[var(--text-muted)]">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-[11px] text-[var(--text-primary)]">
                    {t}
                    <button
                      type="button"
                      onClick={() => { const next = tags.filter(x => x !== t); setTags(next); onUpdateTags(next); }}
                      className="text-zinc-500 hover:text-zinc-200"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      const trimmed = tagInput.trim();
                      if (!tags.includes(trimmed) && tags.length < 12 && trimmed.length <= 24) {
                        const next = [...tags, trimmed];
                        setTags(next);
                        onUpdateTags(next);
                      }
                      setTagInput('');
                    }
                  }}
                  placeholder="Add tag…"
                  list="memory-tag-suggestions"
                  className="bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-zinc-600 focus:outline-none w-24"
                />
                <datalist id="memory-tag-suggestions">
                  {allTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 5).map(t => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Notes this memory belongs to. */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
                <span className="text-[11px] text-[var(--text-muted)]">Notes</span>
              </div>
              {linkedNotes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {linkedNotes.map(id => {
                    const n = notes.find(x => x.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md border border-zinc-700 bg-zinc-900/60 text-[11px]">
                        <span className="truncate">{n?.title || 'Note'}</span>
                        <button
                          type="button"
                          aria-label="Detach note"
                          onClick={() => onUpdateNotes(linkedNotes.filter(x => x !== id))}
                          className="text-zinc-500 hover:text-zinc-200"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                value={noteQuery}
                onChange={e => setNoteQuery(e.target.value)}
                placeholder="Attach a note by title"
                aria-label="Search notes to attach"
                className="w-full bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-zinc-600 focus:outline-none"
              />
              {noteQuery.trim() && (
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {notes
                    .filter(n => !linkedNotes.includes(n.id))
                    .filter(n => (n.title || '').toLowerCase().includes(noteQuery.trim().toLowerCase()))
                    .slice(0, 6)
                    .map(n => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => { onUpdateNotes([...linkedNotes, n.id]); setNoteQuery(''); }}
                        className="w-full text-left px-1.5 py-1 rounded text-[11px] text-[var(--text-primary)] hover:bg-[var(--color-muted)]"
                      >
                        {n.title || 'Untitled'}
                      </button>
                    ))}
                  {notes.filter(n => !linkedNotes.includes(n.id))
                    .filter(n => (n.title || '').toLowerCase().includes(noteQuery.trim().toLowerCase())).length === 0 && (
                    <p className="px-1.5 py-1 text-[11px] text-zinc-600">No matching note.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
              {memory.meta.people.map(p => (
                <PersonChip key={p} name={p} onRemove={() => onUpdatePeople(memory.meta.people.filter(x => x !== p))} />
              ))}
              <input
                value={personInput}
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && personInput.trim()) {
                    onUpdatePeople([...memory.meta.people, personInput.trim()]);
                    setPersonInput('');
                  }
                }}
                placeholder="Add person..."
                className="bg-transparent text-[11px] text-zinc-400 placeholder:text-zinc-600 focus:outline-none w-24"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-500">{memory.meta.date}</span>
              <button onClick={onDelete} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
