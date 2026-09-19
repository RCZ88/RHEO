/**
 * TranscriptLibraryPage.tsx — Transcript library page
 * R-46: records-list section, /transcripts route.
 * R-47: App-layer record persistence. No localStorage.
 * R-48: token colors, {6,10,16} radii, no shadow/blur/spring, static waveform, RM→static.
 * External app-layer persistence boundary — impl is in-memory + SQLite-sink stub.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, Trash2, Pencil, ChevronDown, ChevronUp,
  Sparkles, Clock, Tags, Folder, Quote, Pen, MessageSquare,
  Play, Check, X, Download, Upload
} from 'lucide-react';
import { useLocalStt } from '../hooks/useLocalStt';
import { sttStore } from '../lib/sttStore';
import { SttCategoryColors, getCategoryLabel } from '../lib/sttStore';
import type { TranscriptEntry } from '../lib/sttStore';
import type { SttCategory } from '../lib/sttStore';

type EditState = {
  open: boolean;
  id: string;
  title: string;
  note: string;
  prompt: string;
  project: string;
  category: SttCategory;
  tags: string[];
};

const CATEGORY_ICONS: Record<SttCategory, React.ReactNode> = {
  idea: <Sparkles style={{ width: 11, height: 11 }} />,
  prompt: <Pen style={{ width: 11, height: 11 }} />,
  meeting: <MessageSquare style={{ width: 11, height: 11 }} />,
  general: <Tags style={{ width: 11, height: 11 }} />,
};

const DEFAULT_CATEGORIES: { id: SttCategory; label: string; colorKey: keyof typeof SttCategoryColors }[] = [
  { id: 'general', label: 'General', colorKey: 'general' },
  { id: 'idea', label: 'Idea', colorKey: 'idea' },
  { id: 'prompt', label: 'Prompt', colorKey: 'prompt' },
  { id: 'meeting', label: 'Meeting', colorKey: 'meeting' },
];

export function TranscriptLibraryPage() {
  const stt = useLocalStt();
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [filterCategory, setFilterCategory] = useState<SttCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    const load = async () => {
      const all = await sttStore.getAll();
      setEntries(all);
    };
    load();
  }, []);

  // Persist externally-managed store: no local write, just refresh from store
  // The store's saveToLibrary/removeFromLibrary/favorite already persist.
  // We sync our local list from the store after each mutation.
  const refreshEntries = useCallback(async () => {
    const all = await sttStore.getAll();
    setEntries(all);
  }, []);

  const handleSave = useCallback(async (text: string, category: SttCategory, tags: string[]) => {
    await sttStore.saveToLibrary({
      id: crypto.randomUUID(),
      text,
      title: '',
      note: '',
      prompt: '',
      project: '',
      category,
      tags,
      createdAt: new Date().toISOString(),
      durationMs: 0,
    });
    await refreshEntries();
  }, [refreshEntries]);

  const handleEdit = useCallback(async (id: string, patch: Partial<TranscriptEntry>) => {
    await sttStore.updateInLibrary(id, patch);
    await refreshEntries();
  }, [refreshEntries]);

  const handleFavorite = useCallback(async (id: string, fav: boolean) => {
    await sttStore.updateInLibrary(id, { favorite: fav });
    await refreshEntries();
  }, [refreshEntries]);

  const handleDelete = useCallback(async (id: string) => {
    await sttStore.removeFromLibrary(id);
    setDeleteConfirm(null);
    await refreshEntries();
  }, [refreshEntries]);

  // Filter
  const filtered = entries.filter(entry => {
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
    if (showFavorites && !entry.favorite) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        entry.text.toLowerCase().includes(q)
        || (entry.title ?? '').toLowerCase().includes(q)
        || (entry.tags ?? []).some(t => t.toLowerCase().includes(q))
        || (entry.project ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Sort by createdAt desc
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  const handleEditOpen = useCallback((entry: TranscriptEntry) => {
    setEditing({
      open: true,
      id: entry.id,
      title: entry.title ?? '',
      note: entry.note ?? '',
      prompt: entry.prompt ?? '',
      project: entry.project ?? '',
      category: entry.category,
      tags: [...(entry.tags ?? [])],
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editing) return;
    await handleEdit(editing.id, {
      title: editing.title || undefined,
      note: editing.note || undefined,
      prompt: editing.prompt || undefined,
      project: editing.project || undefined,
      category: editing.category,
      tags: editing.tags.length > 0 ? editing.tags : undefined,
    });
    setEditing(null);
  }, [editing, handleEdit]);

  const toggleTag = useCallback((tag: string) => {
    if (!editing) return;
    const idx = editing.tags.indexOf(tag);
    if (idx >= 0) {
      editing.tags.splice(idx, 1);
    } else {
      editing.tags.push(tag);
    }
    setEditing({ ...editing });
  }, [editing]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--ws-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgb(0 0 0 / 0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Sparkles style={{ width: 14, height: 14, color: 'var(--resume-warning)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-sans)' }}>
              Transcript Library
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 1 }}>
              {entries.length} transcript{entries.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Load from file */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => stt.loadVocab()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 9px',
              background: 'transparent',
              border: '1px solid var(--ws-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontFamily: 'inherit',
              minHeight: 28,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
            aria-label="Load vocabulary from file"
            title="Load vocab.json"
          >
            <Upload style={{ width: 12, height: 12 }} />
            Load vocab
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 300 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transcripts, tags, projects…"
            style={{
              padding: '7px 10px 7px 32px',
              background: 'rgb(0 0 0 / 0.2)',
              border: '1px solid var(--ws-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
              width: '100%',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
          />
        </div>

        {/* Category tabs + view toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {DEFAULT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.id ? 'all' : cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                background: filterCategory === cat.id ? 'rgb(0 0 0 / 0.3)' : 'transparent',
                border: `1px solid ${filterCategory === cat.id ? SttCategoryColors[cat.colorKey] : 'var(--ws-border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: filterCategory === cat.id ? 600 : 400,
                color: filterCategory === cat.id ? SttCategoryColors[cat.colorKey] : 'var(--text-secondary)',
                fontFamily: 'inherit',
                minHeight: 28,
              }}
              onMouseEnter={e => {
                if (filterCategory !== cat.id) {
                  (e.target as HTMLElement).style.color = 'var(--text-primary)';
                  (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)';
                }
              }}
              onMouseLeave={e => {
                if (filterCategory !== cat.id) {
                  (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.target as HTMLElement).style.background = 'transparent';
                }
              }}
              aria-label={`Filter by ${cat.label}`}
              aria-pressed={filterCategory === cat.id}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: SttCategoryColors[cat.colorKey], flexShrink: 0 }} />
              {cat.label}
            </button>
          ))}

          <div style={{ width: 1, height: 16, background: 'var(--ws-border)', margin: '0 4px' }} />

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavorites(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px',
              background: showFavorites ? 'rgb(0 0 0 / 0.3)' : 'transparent',
              border: `1px solid ${showFavorites ? SttCategoryColors['idea'] : 'var(--ws-border)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: showFavorites ? 600 : 400,
              color: showFavorites ? SttCategoryColors['idea'] : 'var(--text-secondary)',
              fontFamily: 'inherit',
              minHeight: 28,
            }}
            onMouseEnter={e => {
              if (!showFavorites) { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }
            }}
            onMouseLeave={e => {
              if (!showFavorites) { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }
            }}
            aria-label="Show favorites only"
            aria-pressed={showFavorites}
          >
            <Star style={{ width: 12, height: 12, fill: showFavorites ? SttCategoryColors['idea'] : 'none', flexShrink: 0 }} />
            Favorites
          </button>

          <div style={{ flex: 1 }} />

          {/* Count */}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Entries list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <AnimatePresence mode="popLayout">
          {sorted.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: '16px', background: 'rgb(0 0 0 / 0.2)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                <Sparkles style={{ width: 22, height: 22, color: 'var(--text-muted)', opacity: 0.5 }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {search || filterCategory !== 'all' || showFavorites ? 'No matching transcripts' : 'No transcripts yet'}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto' }}>
                {search || filterCategory !== 'all' || showFavorites
                  ? 'Try different search terms or filters.'
                  : 'Start recording with Ctrl+Shift+V to capture your first transcript.'}
              </p>
            </motion.div>
          ) : (
            sorted.map((entry, idx) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12, ease: 'var(--ws-ease)' }}
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
              >
                {/* Card content */}
                <div
                  style={{
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = SttCategoryColors[entry.category] || 'var(--ws-border)';
                    el.style.background = 'rgb(0 0 0 / 0.15)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--ws-border)';
                    el.style.background = 'var(--color-card)';
                  }}
                >
                  {/* Top row: category + favorite + actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* Category badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 7px',
                        background: 'rgb(0 0 0 / 0.2)',
                        border: `1px solid ${SttCategoryColors[entry.category]}`,
                        borderRadius: '4px',
                        flexShrink: 0,
                        height: 'fit-content',
                      }}
                    >
                      {CATEGORY_ICONS[entry.category]}
                      <span style={{ fontSize: 10, fontWeight: 600, color: SttCategoryColors[entry.category] }}>
                        {getCategoryLabel(entry.category)}
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {entry.title ?? entry.text.slice(0, 100) + (entry.text.length > 100 ? '…' : '')}
                      </div>
                      {entry.note && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.note}
                        </div>
                      )}
                    </div>

                    {/* Favorite */}
                    <button
                      onClick={() => handleFavorite(entry.id, !entry.favorite)}
                      style={{
                        display: 'grid', placeItems: 'center',
                        width: 28, height: 28,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: entry.favorite ? SttCategoryColors['idea'] : 'var(--text-muted)',
                        opacity: entry.favorite ? 1 : 0.6,
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => {
                        if (!entry.favorite) (e.target as HTMLElement).style.color = 'var(--resume-warning)';
                      }}
                      onMouseLeave={e => {
                        if (!entry.favorite) (e.target as HTMLElement).style.color = 'var(--text-muted)';
                      }}
                      aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                      title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star style={{ width: 14, height: 14, fill: entry.favorite ? SttCategoryColors['idea'] : 'none' }} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteConfirm(entry.id)}
                      style={{
                        display: 'grid', placeItems: 'center',
                        width: 28, height: 28,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        opacity: 0.6,
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--resume-danger)'; (e.target as HTMLElement).style.opacity = '1'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.opacity = '0.6'; }}
                      aria-label="Delete transcript"
                      title="Delete"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* Edit | Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => handleEditOpen(entry)}
                        style={{
                          display: 'grid', placeItems: 'center',
                          width: 28, height: 28,
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          opacity: 0.6,
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.opacity = '1'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.opacity = '0.6'; }}
                        aria-label="Edit transcript"
                        title="Edit"
                      >
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingTop: 4, borderTop: '1px solid var(--ws-border)' }}>
                      {entry.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: '2px 6px',
                            background: 'rgb(0 0 0 / 0.3)',
                            border: '1px solid var(--ws-border)',
                            borderRadius: '3px',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Prompt / project preview (if applicable) */}
                  {(entry.prompt || entry.project) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--text-secondary)', paddingTop: 2 }}>
                      {entry.project && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Folder style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
                          <span style={{ color: 'var(--resume-info)' }}>{entry.project}</span>
                        </span>
                      )}
                      {entry.prompt && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Quote style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{entry.prompt}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Hover action strip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 12px',
                    borderTop: '1px solid var(--ws-border)',
                    background: 'rgb(0 0 0 / 0.05)',
                    opacity: 0,
                    transition: 'opacity 0.15s ease',
                    height: 32,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                >
                  <button
                    onClick={() => handleEditOpen(entry)}
                    style={{
                      display: 'grid', placeItems: 'center',
                      width: 24, height: 24,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                    aria-label="Edit transcript"
                  >
                    <Pencil style={{ width: 12, height: 12 }} />
                  </button>
                  <button
                    onClick={() => handleFavorite(entry.id, !entry.favorite)}
                    style={{
                      display: 'grid', placeItems: 'center',
                      width: 24, height: 24,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = entry.favorite ? SttCategoryColors['idea'] : 'var(--resume-warning)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                    aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star style={{ width: 12, height: 12, fill: entry.favorite ? SttCategoryColors['idea'] : 'none' }} />
                  </button>
                  <div style={{ flex: 1 }} />
                  {/* Copy */}
                  <button
                    onClick={() => navigator.clipboard.writeText(entry.text)}
                    style={{
                      display: 'grid', placeItems: 'center',
                      width: 24, height: 24,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                    aria-label="Copy transcript"
                    title="Copy text"
                  >
                    <Download style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            key="delete-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgb(0 0 0 / 0.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 99998,
            }}
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--ws-border)',
                borderRadius: '10px',
                padding: '16px 20px',
                width: '100%',
                maxWidth: 320,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '4px', background: 'rgb(0 0 0 / 0.3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Trash2 style={{ width: 12, height: 12, color: 'var(--resume-danger)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Delete transcript?</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                This transcript will be permanently removed from the library.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid var(--ws-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    minHeight: 28,
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--resume-danger)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    minHeight: 28,
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.9'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            key="edit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgb(0 0 0 / 0.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 99997,
            }}
            onClick={() => setEditing(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--ws-border)',
                borderRadius: '10px',
                width: '100%',
                maxWidth: 480,
                maxHeight: '80vh',
                overflowY: 'auto',
                padding: '0',
              }}
            >
              {/* Modal header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--ws-border)',
                  background: 'rgb(0 0 0 / 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Pencil style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Edit transcript</span>
                </div>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setEditing(null)}
                  style={{
                    display: 'grid', placeItems: 'center',
                    width: 22, height: 22,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                  aria-label="Close edit"
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {/* Form */}
              <div style={{ padding: '12px' }}>
                {/* Title */}
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Title
                  </label>
                  <input
                    value={editing.title}
                    onChange={e => setEditing({ ...editing, title: e.target.value })}
                    placeholder="Summarize this transcript…"
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      background: 'rgb(0 0 0 / 0.2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
                  />
                </div>

                {/* Note */}
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Note
                  </label>
                  <textarea
                    value={editing.note}
                    onChange={e => setEditing({ ...editing, note: e.target.value })}
                    placeholder="Context, ideas, next steps…"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      background: 'rgb(0 0 0 / 0.2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
                  />
                </div>

                {/* Prompt */}
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Prompt
                  </label>
                  <textarea
                    value={editing.prompt}
                    onChange={e => setEditing({ ...editing, prompt: e.target.value })}
                    placeholder="Base prompt for future ASR runs…"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      background: 'rgb(0 0 0 / 0.2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
                  />
                </div>

                {/* Project */}
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Project
                  </label>
                  <input
                    value={editing.project}
                    onChange={e => setEditing({ ...editing, project: e.target.value })}
                    placeholder="e.g. DSL Audit, Dashboard Redesign"
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      background: 'rgb(0 0 0 / 0.2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
                  />
                </div>

                {/* Category */}
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Category
                  </label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {DEFAULT_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setEditing({ ...editing, category: cat.id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 9px',
                          background: editing.category === cat.id ? 'rgb(0 0 0 / 0.3)' : 'transparent',
                          border: `1px solid ${editing.category === cat.id ? SttCategoryColors[cat.colorKey] : 'var(--ws-border)'}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: editing.category === cat.id ? 600 : 400,
                          color: editing.category === cat.id ? SttCategoryColors[cat.colorKey] : 'var(--text-secondary)',
                          fontFamily: 'inherit',
                          minHeight: 24,
                        }}
                        onMouseEnter={e => {
                          if (editing.category !== cat.id) {
                            (e.target as HTMLElement).style.color = 'var(--text-primary)';
                            (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (editing.category !== cat.id) {
                            (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                            (e.target as HTMLElement).style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: SttCategoryColors[cat.colorKey], flexShrink: 0 }} />
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Tags
                    </label>
                    {editing.tags.length > 0 && (
                      <button
                        onClick={() => setEditing({ ...editing, tags: [] })}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          color: 'var(--resume-danger)',
                          fontFamily: 'inherit',
                          textDecoration: 'underline',
                          textDecorationColor: 'var(--resume-danger)',
                        }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {editing.tags.map(tag => (
                      <span
                        key={tag}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 7px 2px 8px',
                          background: 'rgb(0 0 0 / 0.3)',
                          border: '1px solid var(--ws-border)',
                          borderRadius: '4px',
                          fontSize: 10,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{tag}</span>
                        <button
                          onClick={() => toggleTag(tag)}
                          style={{
                            display: 'grid', placeItems: 'center',
                            width: 14, height: 14,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--resume-danger)'; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X style={{ width: 8, height: 8 }} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      value=""
                      placeholder="Add tag…"
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !editing.tags.includes(val)) {
                            setEditing({
                              ...editing,
                              tags: [...editing.tags, val],
                            });
                          }
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        background: 'rgb(0 0 0 / 0.2)',
                        border: '1px solid var(--ws-border)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: 11,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
                      onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
                    />
                    <button
                      onClick={() => {
                        // TODO: prompt for new tag
                      }}
                      style={{
                        padding: '5px 8px',
                        background: 'rgb(0 0 0 / 0.2)',
                        border: '1px solid var(--ws-border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                      }}
                      aria-label="Add tag"
                      title="Add tag (enter key or click)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '8px 12px',
                  borderTop: '1px solid var(--ws-border)',
                  background: 'rgb(0 0 0 / 0.1)',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={() => setEditing(null)}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid var(--ws-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    minHeight: 28,
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--resume-info)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    minHeight: 28,
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.9'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
