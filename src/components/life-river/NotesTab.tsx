"use client"

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { WarmCard } from '../../features/warmth/WarmCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Plus, Search, X, BookOpen, Trash2, Pencil, FileClock, ChevronRight, Link2, ExternalLink, Layers, Target, ChevronDown, GripVertical, ArrowRight, FileText, Sparkles } from 'lucide-react'
import { GoalPicker } from '../goals/GoalPicker'
import { PremiumNoteEditor } from './PremiumNoteEditor'
import { NoteContent, type InspectTarget } from './NoteContent'

interface LinkItem { url: string; title?: string; open?: 'external' | 'inapp'; browser?: string }
interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  group_name: string
  group_color?: string | null
  tag_colors?: Record<string, string> | null
  created_at: string
  updated_at: string
  is_draft?: number | null
  links?: LinkItem[]
  files?: string[]
}

function formatDistanceToNow(dateStr: string): string {
  const d = new Date(dateStr + 'Z')
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const GROUP_COLORS: Record<string, string> = {
  'Personal': '#fbbf24', 'Work': '#3b82f6', 'Ideas': '#a855f7', 'Health': '#22c55e',
  'Finance': '#10b981', 'Learning': '#06b6d4', 'Projects': '#f97316',
}
function getGroupColor(name: string): string { return GROUP_COLORS[name] || '#71717a' }

// Swatch palette for picking a group/tag color (like focus-group picker).
const TAG_PALETTE = ['#fbbf24', '#3b82f6', '#a855f7', '#22c55e', '#10b981', '#06b6d4', '#f97316', '#ef4444', '#ec4899', '#eab308', '#8b5cf6', '#64748b']
// Map a tag to a stable color if none is explicitly chosen.
function getTagColor(tag: string, tagColors?: Record<string, string> | null): string {
  if (tagColors && tagColors[tag]) return tagColors[tag]
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

// ── Normalizers (handles old string[] links + new LinkItem[]) ──
function normalizeLinks(raw: any): LinkItem[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] } })()
  return arr.map((l: any) => typeof l === 'string' ? { url: l } : l)
}
function normalizeFiles(raw: any): string[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] } })()
}

// ── Preferences hook (localStorage) ──
function useNotesPrefs() {
  const get = <T,>(key: string, fallback: T): T => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
  }
  const [linkMode, setLinkMode] = useState<'external' | 'inapp'>(() => get('deskflow-notes-linkmode', 'external'))
  const [inAppStyle, setInAppStyle] = useState<'modal' | 'window'>(() => get('deskflow-notes-inappstyle', 'modal'))
  const [defaultBrowser, setDefaultBrowser] = useState<string>(() => get('deskflow-notes-defaultbrowser', ''))
  const [fileApp, setFileApp] = useState<string>(() => get('deskflow-notes-fileapp', ''))
  const [apps, setApps] = useState<{ id: string; name: string; path: string; kind: string }[]>([])

  useEffect(() => {
    ;(window as any).deskflowAPI?.getApps?.().then((res: any) => { if (res?.apps) setApps(res.apps) }).catch(() => {})
  }, [])

  const persist = (key: string, val: any) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

  const updateLinkMode = (v: 'external' | 'inapp') => { setLinkMode(v); persist('deskflow-notes-linkmode', v) }
  const updateInAppStyle = (v: 'modal' | 'window') => { setInAppStyle(v); persist('deskflow-notes-inappstyle', v) }
  const updateDefaultBrowser = (v: string) => { setDefaultBrowser(v); persist('deskflow-notes-defaultbrowser', v) }
  const updateFileApp = (v: string) => { setFileApp(v); persist('deskflow-notes-fileapp', v) }

  return { linkMode, inAppStyle, defaultBrowser, fileApp, apps, updateLinkMode, updateInAppStyle, updateDefaultBrowser, updateFileApp }
}

// ── Note Detail View ──
function NoteDetailView({ note, onClose, onEdit, onDelete, prefs }: { note: Note; onClose: () => void; onEdit: (n: Note) => void; onDelete: (id: string) => void; prefs: ReturnType<typeof useNotesPrefs> }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  // The PEEK. A chip click inspects; it does not navigate, so the note stays put.
  const [peek, setPeek] = useState<InspectTarget | null>(null)
  const safeLinks = normalizeLinks(note.links)
  const safeFiles = normalizeFiles(note.files)
  const safeTags = Array.isArray(note.tags) ? note.tags
    : typeof note.tags === 'string' && note.tags ? (() => { try { return JSON.parse(note.tags) } catch { return [] } })()
    : []

  const handleOpenLink = (link: LinkItem) => {
    const mode = link.open || prefs.linkMode
    if (mode === 'inapp') {
      if (prefs.inAppStyle === 'window') { (window as any).deskflowAPI?.openInAppWindow?.(link.url) }
      else { setViewerUrl(link.url) }
    } else {
      (window as any).deskflowAPI?.openUrlInBrowser?.(link.url, link.browser || prefs.defaultBrowser || undefined)
    }
  }

  /* Goal and phase links are INTERNAL routes, not URLs. They were rendered as a
     static <div> while URL links got a real <button>, so they looked clickable
     and did nothing. Navigating to the goal's hub is the whole point of
     attaching one. */
  const handleOpenEntityLink = (url: string) => {
    if (url.startsWith('file://')) {
      // Opens in the OS default app, same as the Files section.
      (window as any).deskflowAPI?.openPath?.(url.slice(7));
      return;
    }
    if (url.startsWith('chat://')) {
      // Jump to the AI chat thread this note references.
      const thread = url.slice(7);
      window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/ai', threadDate: thread } }));
      onClose?.();
      return;
    }
    if (url.startsWith('goal://')) {
      const id = url.slice(7);
      window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/life', tab: 'gold', goalId: id } }));
      onClose?.();
      return;
    }
    if (url.startsWith('phase://')) {
      window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/life', tab: 'self', phaseId: url.slice(8) } }));
      onClose?.();
      return;
    }
    handleOpenLink({ url });
  };

  /* A chip click INSPECTS. It deliberately does not navigate and does not close.
     Two reasons, both about not disturbing the reader: (a) they opened a note to
     read it, and leaving for a goal title is a bigger interruption than the one
     they asked for; (b) `rheo:navigate` changes the route, which unmounts this
     popup anyway — so "don't close it" could never have been satisfied by simply
     deleting the onClose call. Navigating is offered inside the peek instead. */
  const handleInspect = (t: InspectTarget) => {
    if (t.kind === 'file') { handleOpenFile(t.path); return }
    if (t.kind === 'link') { (window as any).deskflowAPI?.openUrlInBrowser?.(t.url); return }
    if (t.kind === 'image') { (window as any).deskflowAPI?.openPath?.(t.path); return }
    setPeek((prev) => (prev && prev.kind === t.kind && (prev as any).id === (t as any).id ? null : t))
  };

  const peekNavigate = () => {
    if (!peek) return
    if (peek.kind === 'goal') window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/life', tab: 'gold', goalId: (peek as any).id } }))
    else if (peek.kind === 'phase') window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/life', tab: 'self', phaseId: (peek as any).id } }))
    onClose?.()
  }

  const handleOpenFile = (filePath: string) => {
    (window as any).deskflowAPI?.openPath?.(filePath, prefs.fileApp || undefined)
  }

  return (
    // Close only on a REAL backdrop press, checked on mousedown against the
    // element itself. `onClick` fired after the mouse came up: select text that
    // began inside the note and dragged past the edge, release, and the note
    // vanished — the selection was the accident, not the intent.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-zinc-950 light:bg-[var(--ws-surface-95)] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{note.group_name || 'Ungrouped'}</span>
              <span>·</span>
              <span>Created {formatDate(note.created_at)}</span>
            </div>
            {/* It existed but had NO accessible name — a screen reader announced
                an unlabelled button, and it was 18px, well under the 44px target
                floor. Both are Gate D failures, not preferences. */}
            <button
              onClick={onClose}
              aria-label="Close note"
              title="Close"
              className="-m-2 p-2 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--page-accent)]"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <h2 className="text-2xl font-display text-zinc-100 mb-4">{note.title || 'Untitled Note'}</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {safeTags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400 border border-zinc-700/50">#{tag}</span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <NoteContent content={note.content} onInspect={handleInspect} className="mb-6" />

          {peek && (
            <div className="mb-6 rounded-xl border border-zinc-700 light:border-zinc-300 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">{peek.kind}</p>
                  <p className="text-sm text-zinc-100 light:text-zinc-900 truncate">{peek.label}</p>
                  {('id' in peek) && (
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-600 truncate">{String((peek as any).id)}</p>
                  )}
                </div>
                <button onClick={() => setPeek(null)} aria-label="Close peek"
                  className="-m-1 p-1 rounded text-zinc-500 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <X size={14} aria-hidden />
                </button>
              </div>
              {('id' in peek) && (
                <button
                  onClick={peekNavigate}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 light:border-zinc-300 light:hover:bg-zinc-100"
                >
                  Open full page <ArrowRight size={11} aria-hidden />
                </button>
              )}
            </div>
          )}
          {/* Links */}
          {safeLinks.length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Related</h4>
              {safeLinks.map((link, i) => {
                const isPhase = link.url.startsWith('phase://')
                const isGoal = link.url.startsWith('goal://')
                const isFile = link.url.startsWith('file://');
                const isChat = link.url.startsWith('chat://');
                const icon = isPhase ? <Layers size={12} className="shrink-0" />
                  : isGoal ? <Target size={12} className="shrink-0" />
                  : isFile ? <FileText size={12} className="shrink-0" />
                  : isChat ? <Sparkles size={12} className="shrink-0" />
                  : <Link2 size={12} className="shrink-0" />
                const label = link.title || (isPhase ? `Phase: ${link.url.slice(8)}` : isGoal ? `Goal: ${link.url.slice(7)}` : link.url)
                const colorClass = isPhase ? 'text-amber-400 hover:text-amber-300'
                  : isGoal ? 'text-emerald-400 hover:text-emerald-300'
                  : isFile ? 'text-zinc-300 hover:text-zinc-100'
                  : isChat ? 'text-violet-400 hover:text-violet-300'
                  : 'text-sky-400 hover:text-sky-300'
                if (isPhase || isGoal || isFile || isChat) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleOpenEntityLink(link.url)}
                      className={cn("w-full flex items-center gap-2 px-1 py-0.5 -mx-1 rounded text-[13px] transition-colors hover:bg-white/5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50", colorClass)}
                    >
                      {icon}
                      <span className="truncate">{label}</span>
                      <ArrowRight size={11} className="shrink-0 ml-auto opacity-60" aria-hidden />
                    </button>
                  );
                }
                return <button key={i} onClick={() => handleOpenLink(link)} className={cn("flex items-center gap-2 text-[13px] transition-colors break-all text-left", colorClass)}>{icon}<span className="truncate">{label}</span><ExternalLink size={11} className="shrink-0 ml-auto" /></button>
              })}
            </div>
          )}
          {/* Files */}
          {safeFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Files</h4>
              {safeFiles.map((fp, i) => {
                const name = fp.split(/[\\/]/).pop() || fp
                return (
                  <button key={i} onClick={() => handleOpenFile(fp)} className="flex items-center gap-2 text-[13px] text-zinc-300 hover:text-amber-300 transition-colors w-full text-left group">
                    <span className="shrink-0 w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">📄</span>
                    <span className="truncate">{name}</span>
                    <ExternalLink size={11} className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/60 flex items-center justify-between bg-zinc-900/50 light:bg-[var(--ws-surface-raised)]">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-[12px] text-zinc-500 hover:text-rose-400 transition-colors">Delete</button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-rose-400">Delete?</span>
              <button onClick={() => { onDelete(note.id); onClose() }} className="text-[12px] text-rose-400 font-medium hover:text-rose-300">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[12px] text-zinc-500 hover:text-zinc-300">No</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(note.content)} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">Copy</button>
            <button onClick={() => { onEdit(note); onClose() }} className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800/70 transition-colors"><Pencil size={12} /> Edit</button>
          </div>
        </div>
      </div>
      {/* In-app webview viewer */}
      {viewerUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setViewerUrl(null)}>
          <div className="w-full max-w-5xl h-[80vh] bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded-xl overflow-hidden border border-zinc-700 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
              <span className="text-[12px] text-zinc-400 truncate">{viewerUrl}</span>
              <button onClick={() => setViewerUrl(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
            </div>
            <webview src={viewerUrl} className="flex-1" style={{ minHeight: 0 }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Note Editor ──
function NoteEditor({ open, onOpenChange, initial, onSave, existingGroups = [], existingTags = [], prefs }: {
  open: boolean; onOpenChange: (open: boolean) => void; initial: Note | null
  onSave: (data: { title: string; content: string; tags: string[]; group_name: string; group_color?: string | null; tag_colors?: Record<string, string> | null; is_draft?: number; links?: LinkItem[]; files?: string[] }) => void
  existingGroups?: string[]
  existingTags?: string[]
  prefs: ReturnType<typeof useNotesPrefs>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState<string | null>(null)
  const [tagColors, setTagColors] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<LinkItem[]>([])
  const [linkUrlInput, setLinkUrlInput] = useState('')
  const [linkTitleInput, setLinkTitleInput] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [showGroups, setShowGroups] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [showLinkTitle, setShowLinkTitle] = useState(false)
  const [phases, setPhases] = useState<{ id: string; title: string }[]>([])
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([])
  const isDirty = useRef(false)

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title || '')
    setContent(initial?.content || '')
    let parsedTags: string[] = []
    if (Array.isArray(initial?.tags)) parsedTags = initial.tags
    else if (typeof initial?.tags === 'string' && initial.tags) { try { parsedTags = JSON.parse(initial.tags) } catch {} }
    setTags(parsedTags)
    setGroupName(initial?.group_name || '')
    setGroupColor(initial?.group_color || null)
    setTagColors(initial?.tag_colors || {})
    setLinks(normalizeLinks(initial?.links))
    setFiles(normalizeFiles(initial?.files))
    setLinkUrlInput('')
    setLinkTitleInput('')
    isDirty.current = false
  }, [open, initial])

  useEffect(() => { if (open) isDirty.current = true }, [title, content, tags, groupName, links, files])

    /* Load goal titles so the attached-goal chip shows a name, not a raw id. */
    useEffect(() => {
      if (!open) return;
      let alive = true;
      (async () => {
        try {
          const dsk = (window as any).deskflowAPI;
          if (!dsk?.getGoalsBatch) return;
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const end = new Date(now); end.setDate(end.getDate() + 120);
          const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
          const res = await dsk.getGoalsBatch('2000-01-01', endStr);
          const map: Record<string, string> = {};
          for (const d of (res?.days || []) as any[]) {
            for (const g of (d.goals || []) as any[]) if (g?.id) map[g.id] = g.title;
          }
          if (alive) setGoalTitles(map);
        } catch { /* non-critical */ }
      })();
      return () => { alive = false; };
    }, [open]);

  useEffect(() => {
    if (!open) return
    const api = (window as any).deskflowAPI
    if (!api) return
    ;(async () => {
      try {
        const [phasesRes, goalsRes] = await Promise.all([
          api.getLifePhases?.(),
          api.getLongtermGoals?.(),
        ])
        if (phasesRes?.phases) setPhases(phasesRes.phases.map((p: any) => ({ id: p.id, title: p.title || 'Untitled Phase' })))
        if (goalsRes?.goals) setGoals(goalsRes.goals.map((g: any) => ({ id: g.id, title: g.title || 'Untitled Goal' })))
      } catch { /* non-critical */ }
    })()
  }, [open])

  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTagColors(prev => prev[t] ? prev : { ...prev, [t]: getTagColor(t, tagColors) }); setTagInput('') } }
  const addTagFromExisting = (t: string) => { const tag = t.trim().toLowerCase(); if (tag && !tags.includes(tag)) { setTags(prev => [...prev, tag]); setTagColors(prev => prev[tag] ? prev : { ...prev, [tag]: getTagColor(tag, tagColors) }) } }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  /* Titles for goal:// chips. Populated from the same goals list the phase
     picker loads, so the chip reads "Learn C" rather than a raw id. */
  const [goalTitles, setGoalTitles] = useState<Record<string, string>>({});
  const goalTitle = (gid: string) => goalTitles[gid] || '';

  const addLink = () => {
    let url = linkUrlInput.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('phase://') && !url.startsWith('goal://')) url = 'https://' + url
    if (links.some(l => l.url === url)) return
    setLinks(prev => [...prev, { url, title: linkTitleInput.trim() || undefined }])
    setLinkUrlInput('')
    setLinkTitleInput('')
    setShowLinkTitle(false)
  }
  const removeLink = (url: string) => setLinks(prev => prev.filter(l => l.url !== url))
  const updateLink = (url: string, patch: Partial<LinkItem>) => {
    setLinks(prev => prev.map(l => l.url === url ? { ...l, ...patch } : l))
  }

  /* The bridge is `showOpenDialog` and it returns { canceled, filePaths[] }.
     This called `dialogOpenFile`, which does not exist on the preload, so the
     optional call silently did nothing — attaching a file never worked. */
  const addFile = async () => {
    const res = await (window as any).deskflowAPI?.showOpenDialog?.({ properties: ['openFile'] })
    if (!res || res.canceled || !Array.isArray(res.filePaths)) return
    const paths = (res.filePaths as string[]).filter(p => !files.includes(p))
    if (paths.length) setFiles(prev => [...prev, ...paths])
  }
  const removeFile = (fp: string) => setFiles(prev => prev.filter(f => f !== fp))

  const handleSave = async (isDraft: boolean) => {
    if (!content.trim() && !isDraft) return
    await onSave({ title: title.trim(), content: content.trim(), tags, group_name: groupName, group_color: groupColor, tag_colors: tagColors, is_draft: isDraft ? 1 : 0, links, files })
    onOpenChange(false)
  }

  const handleClose = async (isOpen: boolean) => {
    if (isOpen) return
    const hasContent = title.trim().length > 0 || content.trim().length > 0
    if (hasContent && isDirty.current && !initial?.is_draft) {
      await onSave({ title: title.trim() || 'Untitled', content: content.trim(), tags, group_name: groupName, group_color: groupColor, tag_colors: tagColors, is_draft: 1, links, files })
    } else if (!hasContent && initial?.is_draft && initial?.id) {
      await (window as any).deskflowAPI.notesDelete(initial.id)
    }
    onOpenChange(false)
  }

  const isExistingGroup = groupName.trim() !== '' && existingGroups.includes(groupName.trim())

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none")} onClick={() => handleClose(false)}>
      {/* The EDITOR was max-w-lg (512px) — narrower than the read view — so the
          surface you actually type into was the smallest thing on the page, and
          the two-column layout had ~200px of writing space. It now owns a real
          sheet: wide body column, fixed 300px config rail, and a tall viewport. */}
      <div className="w-full max-w-[min(1400px,96vw)] h-[90vh] bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-100 mb-4 shrink-0">{initial?.is_draft ? 'Resume draft' : initial ? 'Edit note' : 'New note'}</h3>
        {/* Two columns: you write on the left, everything that is metadata about
            the note lives on the right. Writing is the primary action, so it gets
            the space and the config becomes a quiet rail. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-stretch flex-1 min-h-0">
          {/* ── LEFT: title + body ── */}
          <div className="flex flex-col gap-3 min-w-0 min-h-0 h-full">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" className="w-full min-w-0 shrink-0 text-[14px]" />
          {/* PremiumNoteEditor owns its own Write/Preview switch, so there is no
              second toggle here — two competing toggles hid the toolbar. */}
          <div className="flex flex-col flex-1 min-h-0">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 shrink-0">Note</label>
            <PremiumNoteEditor
              value={content}
              onChange={setContent}
              links={links}
              onLinksChange={setLinks}
              files={files}
              onFilesChange={setFiles}
              noteId={initial?.id ?? null}
            />
          </div>
          </div>

          {/* ── RIGHT: config rail ── */}
          <div className="space-y-4 min-h-0 lg:overflow-y-auto lg:pr-1">
          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Tags</label>
            <div className="flex gap-1.5">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Add tag..." className="text-[12px] h-8" />
              <button onClick={addTag} className="h-8 px-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"><Plus size={13} /></button>
            </div>
            {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map(t => <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-zinc-300 border border-zinc-700/50" style={{ backgroundColor: `${getTagColor(t, tagColors)}1a`, color: getTagColor(t, tagColors) }}>{t}<button onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100"><X size={10} /></button></span>)}</div>}
            {/* Existing tag suggestions — same logic as existing groups */}
            {existingTags.filter(t => !tags.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingTags.filter(t => !tags.includes(t)).map(t => (
                  <button key={t} type="button" onClick={() => addTagFromExisting(t)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getTagColor(t, tagColors) }} />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Group */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Group</label>
            <div className="flex gap-1.5">
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Type or pick a group..." className="text-[12px] h-8" />
            </div>
            {/* Existing group suggestions */}
            {existingGroups.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingGroups.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroupName(g)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors",
                      groupName === g
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-300"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getGroupColor(g) }} />
                    {g}
                  </button>
                ))}
              </div>
            )}
            {isExistingGroup && <p className="text-[10px] text-amber-400/70 flex items-center gap-1">↺ Reusing existing group</p>}
            {/* Group color picker — sets the accent color for this group (like focus groups) */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-zinc-500">Color</span>
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setGroupColor(c)}
                  className={cn("w-4 h-4 rounded-full border transition-transform", (groupColor || getGroupColor(groupName)) === c ? "border-white scale-110" : "border-zinc-700 hover:scale-110")}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              {(groupColor || getGroupColor(groupName)) !== getGroupColor(groupName) && (
                <button type="button" onClick={() => setGroupColor(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-1">Reset</button>
              )}
            </div>
          </div>
          {/* Links */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Links</label>
            <div className="flex gap-1.5">
              <Input value={linkUrlInput} onChange={e => setLinkUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} placeholder="https://..." className="text-[12px] h-8" />
              <button onClick={() => setShowLinkTitle(!showLinkTitle)} className={cn("h-8 px-2 rounded-lg border text-[11px] transition-colors", showLinkTitle ? "border-amber-500/40 text-amber-300 bg-amber-500/10" : "border-zinc-700 text-zinc-400 hover:text-zinc-200")} title="Add title">T</button>
              <button onClick={addLink} className="h-8 px-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"><Plus size={13} /></button>
            </div>
            {showLinkTitle && (
              <Input value={linkTitleInput} onChange={e => setLinkTitleInput(e.target.value)} placeholder="Link title (optional)" className="text-[12px] h-8" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
            )}
            {/* Attach a goal directly. The editor already RENDERED goal:// links,
                but addLink() only accepted a raw URL, so there was no way to
                create one — the capability was display-only. */}
            <GoalPicker
              value={links.find(l => l.url.startsWith('goal://'))?.url.slice(7) ?? null}
              onChange={(gid: string | null) => setLinks(prev => {
                const without = prev.filter(l => !l.url.startsWith('goal://'));
                if (!gid) return without;
                return [...without, { url: `goal://${gid}`, title: goalTitle(gid) || `Goal ${gid}`, open: 'inapp' }];
              })}
              label="Linked goal"
            />
            {links.length > 0 && <div className="flex flex-col gap-1.5">{links.map(l => {
              const isInternal = l.url.startsWith('phase://') || l.url.startsWith('goal://')
              const icon = l.url.startsWith('phase://') ? <Layers size={10} className="shrink-0" /> : l.url.startsWith('goal://') ? <Target size={10} className="shrink-0" /> : <Link2 size={10} className="shrink-0" />
              const label = l.title || (isInternal
                ? (l.url.startsWith('phase://') ? phases.find(p => p.id === l.url.slice(8))?.title || 'Phase' : goals.find(g => g.id === l.url.slice(7))?.title || 'Goal')
                : l.url)
              const colorClass = l.url.startsWith('phase://') ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : l.url.startsWith('goal://') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
              return (
                <div key={l.url} className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border", colorClass)}>
                  {icon}
                  <span className="truncate flex-1 min-w-0">{label}</span>
                  {!isInternal && (
                    <>
                      <input value={l.title || ''} onChange={e => updateLink(l.url, { title: e.target.value || undefined })} placeholder="title" className="bg-transparent border-none outline-none text-[10px] w-16 text-zinc-400 placeholder-zinc-600" />
                      <select value={l.open || ''} onChange={e => updateLink(l.url, { open: e.target.value as any || undefined })} className="bg-transparent border-none text-[10px] text-zinc-500 outline-none cursor-pointer">
                        <option value="">default</option>
                        <option value="external">browser</option>
                        <option value="inapp">in-app</option>
                      </select>
                    </>
                  )}
                  <button onClick={() => removeLink(l.url)} className="opacity-50 hover:opacity-100 shrink-0"><X size={10} /></button>
                </div>
              )
            })}</div>}
          </div>
          {/* Internal Links */}
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowLinkPicker(!showLinkPicker)} className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors">
              Related <ChevronDown size={11} className={cn("transition-transform", showLinkPicker && "rotate-180")} />
            </button>
            {showLinkPicker && (
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface-50)] p-3 space-y-2">
                {phases.length > 0 && (
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Phases</div>
                    <div className="flex flex-wrap gap-1">{phases.slice(0, 6).map(p => {
                      const linked = links.some(l => l.url === `phase://${p.id}`)
                      return <button key={p.id} type="button" onClick={() => {
                        if (linked) removeLink(`phase://${p.id}`)
                        else setLinks(prev => [...prev, { url: `phase://${p.id}` }])
                      }} className={cn("px-2 py-0.5 rounded-full text-[10px] border transition-colors", linked ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-300")}>{p.title}</button>
                    })}</div>
                  </div>
                )}
                {goals.length > 0 && (
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Goals</div>
                    <div className="flex flex-wrap gap-1">{goals.slice(0, 6).map(g => {
                      const linked = links.some(l => l.url === `goal://${g.id}`)
                      return <button key={g.id} type="button" onClick={() => {
                        if (linked) removeLink(`goal://${g.id}`)
                        else setLinks(prev => [...prev, { url: `goal://${g.id}` }])
                      }} className={cn("px-2 py-0.5 rounded-full text-[10px] border transition-colors", linked ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-300")}>{g.title}</button>
                    })}</div>
                  </div>
                )}
                {phases.length === 0 && goals.length === 0 && <p className="text-[11px] text-zinc-500">No phases or goals yet</p>}
              </div>
            )}
          </div>
          {/* Files */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Files</label>
            <button type="button" onClick={addFile} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors">
              <Plus size={12} /> Attach file
            </button>
            {files.length > 0 && (
              <div className="flex flex-col gap-1">
                {files.map(fp => {
                  const name = fp.split(/[\\/]/).pop() || fp
                  return (
                    <div key={fp} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-[11px] text-zinc-300">
                      <span className="shrink-0 text-zinc-500">📄</span>
                      <span className="truncate flex-1">{name}</span>
                      <button onClick={() => removeFile(fp)} className="text-zinc-500 hover:text-zinc-300 shrink-0"><X size={10} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 shrink-0 mt-4 pt-4 border-t border-zinc-800">
            <button onClick={() => handleSave(true)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">Save as draft</button>
            <div className="flex gap-2">
              <button onClick={() => handleClose(false)} className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button onClick={() => handleSave(false)} disabled={!content.trim()} className="h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-4 text-sm text-amber-100 disabled:opacity-50">Save note</button>
            </div>
        </div>
      </div>
    </div>
  )
}

// ── Draft Card ──
function DraftCard({ note, onResume, onDiscard }: { note: Note; onResume: (n: Note) => void; onDiscard: (id: string) => void }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] p-4 transition-colors hover:bg-amber-500/[0.07]">
      <span className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400/60 to-transparent" />
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="warmth-serif text-[14px] text-zinc-200 line-clamp-1">{note.title || 'Untitled draft'}</h4>
        <button onClick={() => onDiscard(note.id)} className="text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
      </div>
      <p className="text-[12px] text-zinc-500 line-clamp-2 mb-3">{note.content || 'Empty draft...'}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 font-mono">{formatDistanceToNow(note.updated_at)}</span>
        <button onClick={() => onResume(note)} className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors">Resume</button>
      </div>
    </div>
  )
}

// ── Note Card ──
// Revamp: each note wears its life-domain color as a structural accent rail + hover glow,
// so grouping is felt, not just labeled. Serif title + L2 hover lift.
function NoteCard({ note, onClick, onDragStart, onDragEnd }: { note: Note; onClick: (n: Note) => void; onDragStart?: (id: string) => void; onDragEnd?: () => void }) {
  const groupColor = note.group_color || getGroupColor(note.group_name || 'Ungrouped')
  const safeTags = Array.isArray(note.tags) ? note.tags
    : typeof note.tags === 'string' && note.tags ? (() => { try { return JSON.parse(note.tags) } catch { return [] } })()
    : []
  const linkCount = normalizeLinks(note.links).filter(l => !l.url.startsWith('phase://') && !l.url.startsWith('goal://')).length
  const fileCount = normalizeFiles(note.files).length
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={() => onClick(note)}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', note.id); onDragStart?.(note.id) }}
      onDragEnd={onDragEnd}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-5 pl-6 text-left backdrop-blur-xl transition-colors hover:border-zinc-700 w-full cursor-grab active:cursor-grabbing"
    >
      {/* group-color accent rail */}
      <span className="pointer-events-none absolute left-0 top-0 h-full w-1" style={{ background: `linear-gradient(to bottom, ${groupColor}, ${groupColor}00)` }} />
      {/* hover glow in group color */}
      <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `0 0 28px -8px ${groupColor}66, inset 0 0 0 1px ${groupColor}33` }} />
      <div className="flex items-start justify-between gap-3">
        <h4 className="warmth-serif text-[15px] font-medium text-zinc-100 line-clamp-1 flex-1">{note.title || 'Untitled'}</h4>
        {note.is_draft && <FileClock className="w-4 h-4 text-zinc-500 shrink-0" />}
      </div>
      <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-3 flex-1">{note.content}</p>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
        <div className="flex items-center gap-2 min-w-0">
          {note.group_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0" style={{ backgroundColor: `${groupColor}1a`, color: groupColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: groupColor }} />
              {note.group_name}
            </span>
          )}
          <span className="text-[11px] text-zinc-500 font-mono shrink-0">{formatDistanceToNow(note.updated_at)}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          {linkCount > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-[10px] text-sky-400">🔗{linkCount}</span>}
          {fileCount > 0 && <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">📄{fileCount}</span>}
          {safeTags.slice(0, 2).map(tag => {
            const tc = getTagColor(tag, note.tag_colors)
            return <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${tc}1a`, color: tc }}>#{tag}</span>
          })}
          {safeTags.length > 2 && <span className="text-[10px] text-zinc-600">+{safeTags.length - 2}</span>}
        </div>
      </div>
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
    </motion.button>
  )
}

// ── Main NotesTab ──
export function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [draggedNote, setDraggedNote] = useState<string | null>(null)
  const prefs = useNotesPrefs()

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { includeDrafts: true }
      if (search) params.search = search
      if (filterTag) params.tag = filterTag
      if (filterGroup) params.group = filterGroup
      const res = await (window as any).deskflowAPI.notesList(params)
      if (res?.success) setNotes(res.notes || [])
    } catch { /* non-critical */ }
    setLoading(false)
  }, [search, filterTag, filterGroup])

  const loadGroups = useCallback(async () => {
    try { const res = await (window as any).deskflowAPI.notesGroups(); if (res?.success) setGroups(res.groups || []) } catch {}
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  /* A quick-captured note is written behind this tab's back, so refresh when
     one lands — otherwise the list looks stale until you switch tabs. */
  useEffect(() => {
    const onChanged = () => loadNotes();
    window.addEventListener('rheo:notes-changed', onChanged);
    return () => window.removeEventListener('rheo:notes-changed', onChanged);
  }, [loadNotes]);
  useEffect(() => { loadGroups() }, [loadGroups])

  const handleCreate = async (data: any) => { await (window as any).deskflowAPI.notesCreate(data); loadNotes(); loadGroups() }
  const handleUpdate = async (data: any) => { await (window as any).deskflowAPI.notesUpdate(data); loadNotes(); loadGroups() }
  const handleDelete = async (id: string) => { await (window as any).deskflowAPI.notesDelete(id); setSelectedNote(null); loadNotes() }

  // Group management
  const createGroup = async () => {
    const name = newGroupName.trim()
    if (!name || groups.includes(name)) return
    setGroups(prev => [...prev, name])
    setNewGroupName('')
  }

  const moveNoteToGroup = async (noteId: string, groupName: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    await handleUpdate({ id: noteId, group_name: groupName })
  }

  const drafts = notes.filter(n => n.is_draft)
  const activeNotes = notes.filter(n => !n.is_draft)
  // Parse tags from all notes (DB may store as JSON strings)
  const allTags = [...new Set(activeNotes.flatMap(n => {
    if (Array.isArray(n.tags)) return n.tags
    if (typeof n.tags === 'string' && n.tags) { try { return JSON.parse(n.tags) } catch { return [] } }
    return []
  }))].sort()

  // Group notes by group_name
  const groupedNotes = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const note of activeNotes) {
      const group = note.group_name || 'Ungrouped'
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(note)
    }
    // Sort: named groups first (alphabetical), then Ungrouped
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Ungrouped') return 1
      if (b === 'Ungrouped') return -1
      return a.localeCompare(b)
    })
    return sorted
  }, [activeNotes])

  const handleSave = async (data: any) => {
    const payload = { ...data, links: data.links || [], files: data.files || [] }
    if (editingNote) { await handleUpdate({ id: editingNote.id, ...payload }) }
    else { await handleCreate(payload) }
    setEditingNote(null)
  }

  return (
    <div className="space-y-4" data-lifephase="notes-tab">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-amber-400/10"><BookOpen size={14} className="text-amber-400" /></div>
          <h2 className="warmth-serif text-lg text-zinc-200">Notes</h2>
          <span className="text-[11px] text-zinc-600">{activeNotes.length} notes</span>
        </div>
        <button onClick={() => { setEditingNote(null); setEditorOpen(true) }} className="flex items-center gap-1.5 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-3 text-sm text-amber-100 hover:bg-amber-400/25 transition-colors"><Plus size={13} /> New note</button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." className="pl-9 text-[13px]" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X size={13} /></button>}
      </div>

      {/* Filter chips + Create Group */}
      <div className="flex flex-wrap items-center gap-1.5">
        {groups.map(g => <button key={g} onClick={() => setFilterGroup(filterGroup === g ? null : g)} className={cn('px-2 py-1 rounded-full text-[11px] font-medium border transition-colors', filterGroup === g ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-300')}><span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: getGroupColor(g) }} />{g}</button>)}
        {allTags.slice(0, 8).map(t => <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)} className={cn('px-2 py-1 rounded-full text-[11px] border transition-colors', filterTag === t ? 'border-zinc-500 bg-zinc-700/50 text-zinc-200' : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300')}>#{t}</button>)}
        {/* Create new group */}
        <div className="flex items-center gap-1 ml-1">
          <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createGroup() }} placeholder="New group..." className="w-24 h-7 text-[11px] px-2" />
          {newGroupName.trim() && <button onClick={createGroup} className="h-7 px-2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] hover:bg-amber-500/25 transition-colors">Create</button>}
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500 mb-3"><FileClock className="w-3.5 h-3.5" /> Drafts ({drafts.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drafts.map(n => <DraftCard key={n.id} note={n} onResume={(note) => { setEditingNote(note); setEditorOpen(true) }} onDiscard={handleDelete} />)}</div>
        </section>
      )}

      {/* Notes grouped by category */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]" />)}</div>
      ) : activeNotes.length === 0 ? (
        <div className="text-center py-12"><BookOpen size={32} className="mx-auto text-zinc-700 mb-3" /><p className="text-[13px] text-zinc-500">{search || filterTag || filterGroup ? 'No notes match your filters' : 'No notes yet — tap "New note" to start'}</p></div>
      ) : (
        <div className="space-y-6">
          {groupedNotes.map(([groupName, groupNotes]) => (
            <section key={groupName}>
              <div
                className={`relative flex items-center gap-2 mb-3 p-2 rounded-lg transition-colors ${draggedNote ? 'border-2 border-dashed border-amber-500/40 bg-amber-500/5' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-amber-500/10') }}
                onDragLeave={(e) => e.currentTarget.classList.remove('bg-amber-500/10')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-amber-500/10'); const noteId = e.dataTransfer.getData('text/plain'); if (noteId) moveNoteToGroup(noteId, groupName) }}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: getGroupColor(groupName) }} />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getGroupColor(groupName), boxShadow: `0 0 10px ${getGroupColor(groupName)}` }} />
                </span>
                <h3 className="warmth-serif text-sm font-medium text-zinc-200">{groupName}</h3>
                <span className="text-[11px] text-zinc-600">{groupNotes.length}</span>
                <span className="ml-1 h-px flex-1 rounded" style={{ background: `linear-gradient(to right, ${getGroupColor(groupName)}55, transparent)` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence initial={false}>
                  {groupNotes.map(note => <NoteCard key={note.id} note={note} onClick={setSelectedNote} onDragStart={setDraggedNote} onDragEnd={() => setDraggedNote(null)} />)}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Detail View */}
      {selectedNote && <NoteDetailView note={selectedNote} onClose={() => setSelectedNote(null)} onEdit={(n) => { setEditingNote(n); setEditorOpen(true); setSelectedNote(null) }} onDelete={handleDelete} prefs={prefs} />}

      {/* Editor */}
      {editorOpen && <NoteEditor open={editorOpen} onOpenChange={(open) => { if (!open) setEditingNote(null); setEditorOpen(open) }} initial={editingNote} onSave={handleSave} existingGroups={groups} existingTags={allTags} prefs={prefs} />}
    </div>
  )
}
