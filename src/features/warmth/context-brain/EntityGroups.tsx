/**
 * EntityGroups — Context Brain entity group management (§ Entity groups feature)
 *
 * Surfaces the already-wired backend group APIs (brainCreateGroup / brainGetGroups /
 * brainUpdateGroup / brainDeleteGroup / brainSetEntityGroup) in the renderer:
 *   - GroupBadge       : a colored, reusable group pill (used by entity list + graph)
 *   - GroupsManager    : full CRUD panel for the brain's "Groups" tab
 *   - GroupPicker      : inline dropdown to assign / change / clear an entity's group
 *
 * Design: knowledge-as-themed-clusters. Each group owns a persistent color; entities
 * inherit it as a halo chip so recognition maps 1:1 to the graph's per-group tinting.
 * L2 (Responsive) motion, transform+opacity only, DeskFlow dark-chrome developer tokens.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderPlus, Folder, Trash2, Pencil, X, Check,
  Plus, ChevronDown,
} from 'lucide-react'
import { BlurFade } from '../../../components/ui/blur-fade'
import { Skeleton } from '../../../components/ui/skeleton'
import { ACCENTS } from '../ContextGraphView'

const api = () => (window as any).deskflowAPI

const cardBg    = 'rgba(24,24,27,0.55)'
const cardBorder = '1px solid rgba(255,255,255,0.06)'
const inputBg   = 'rgba(24,24,27,0.6)'
const inputBorder = '1px solid rgba(255,255,255,0.08)'
const FAINT     = ACCENTS.slate
const SECONDARY = '#e4e4e7'
const PRIMARY   = '#fafafa'
type  Group     = { id: string; name: string; description: string; color: string; createdAt: string; updatedAt: string; entityCount?: number }

export const GROUP_COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4', '#f43f5e', '#3b82f6', '#ec4899', '#84cc16']

// ── Reusable colored group pill ──
export function GroupBadge({ group, size = 'sm' }: { group: Group | null | undefined; size?: 'sm' | 'xs' }) {
  if (!group) return null
  const color = group.color || ACCENTS.purple
  const pad = size === 'xs' ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${pad} rounded-full font-medium shrink-0`}
      style={{ background: `${color}1a`, border: `1px solid ${color}40`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}70` }} />
      {group.name}
    </span>
  )
}

// ── Inline group color picker ──
function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GROUP_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
          style={{
            background: c,
            boxShadow: value === c ? `0 0 0 2px rgba(255,255,255,0.9), 0 0 8px ${c}` : 'none',
            transform: value === c ? 'scale(1.15)' : undefined,
          }}
          aria-label={`Set color ${c}`}
        />
      ))}
    </div>
  )
}

// ── Group list item with edit / delete ──
function GroupRow({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [desc, setDesc] = useState(group.description)
  const [color, setColor] = useState(group.color || ACCENTS.purple)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    await api()?.brainUpdateGroup?.(group.id, { name: name.trim(), description: desc.trim(), color })
    setBusy(false)
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (busy) return
    if (!window.confirm(`Delete group "${group.name}"? Its entities will be ungrouped (not deleted).`)) return
    setBusy(true)
    await api()?.brainDeleteGroup?.(group.id)
    setBusy(false)
    onChanged()
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 space-y-2 transition-colors hover:border-white/10"
        style={{ background: 'rgba(24,24,27,0.4)', border: cardBorder }}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Group name" autoFocus
          className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ background: inputBg, border: inputBorder, color: SECONDARY }} />
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: inputBg, border: inputBorder, color: SECONDARY }} />
        <ColorSwatches value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={busy || !name.trim()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <Check size={11} /> {busy ? '…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: FAINT }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-3 transition-colors hover:border-white/10 group"
      style={{ background: 'rgba(24,24,27,0.4)', border: cardBorder }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}70` }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: SECONDARY }}>{group.name}</div>
          {group.description && <div className="text-[10px] truncate" style={{ color: FAINT }}>{group.description}</div>}
        </div>
        <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ background: `${color}12`, color }}>
          {group.entityCount ?? 0}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="p-1.5 rounded transition-colors hover:bg-white/10" style={{ color: FAINT }} aria-label="Edit group">
            <Pencil size={11} />
          </button>
          <button onClick={remove}
            className="p-1.5 rounded transition-colors hover:bg-red-500/20" style={{ color: FAINT }} aria-label="Delete group">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Full CRUD panel ──
export function GroupsManager({ onChanged }: { onChanged?: () => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api()?.brainGetGroups?.()
    setGroups(res?.groups || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    await api()?.brainCreateGroup?.(name.trim(), desc.trim(), color)
    setBusy(false)
    setName(''); setDesc(''); setColor(GROUP_COLORS[0]); setCreating(false)
    load(); onChanged?.()
  }

  const changed = () => { load(); onChanged?.() }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px]" style={{ color: FAINT }}>
          {groups.length} group{groups.length === 1 ? '' : 's'} — colored knowledge clusters
        </div>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[rgba(139,92,246,0.2)]"
          style={{ background: 'rgba(139,92,246,0.1)', color: ACCENTS.purple, border: '1px solid rgba(139,92,246,0.2)' }}>
          <Plus size={11} /> New group
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="rounded-xl p-3 space-y-2" style={{ background: cardBg, border: cardBorder }}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: SECONDARY }}>
                <FolderPlus size={12} style={{ color: ACCENTS.purple }} /> Create group
              </div>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Name (e.g. Career, Health, Learning)" autoFocus
                className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ background: inputBg, border: inputBorder, color: SECONDARY }} />
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="What this cluster is about (optional)"
                className="w-full px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: inputBg, border: inputBorder, color: SECONDARY }} />
              <ColorSwatches value={color} onChange={setColor} />
              <button onClick={create} disabled={busy || !name.trim()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{ background: name.trim() ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', color: name.trim() ? ACCENTS.purple : FAINT }}>
                <Plus size={11} /> {busy ? '…' : 'Create'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}

      {!loading && groups.length === 0 && (
        <div className="text-xs py-8 text-center" style={{ color: FAINT }}>
          <Folder size={16} className="mx-auto mb-2 opacity-40" />
          No groups yet. Create one to start clustering your knowledge.
        </div>
      )}

      <div className="space-y-1.5">
        {groups.map((g, i) => (
          <BlurFade key={g.id} delay={Math.min(i * 0.03, 0.3)} duration={0.3} className="rounded-xl">
            <GroupRow group={g} onChanged={changed} />
          </BlurFade>
        ))}
      </div>
    </div>
  )
}

// ── Entity group assigner (native select keeps it keyboard-friendly + dense) ──
export function GroupPicker({ groups, value, onAssign }: {
  groups: Group[]
  value: string | undefined
  onAssign: (groupId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const current = groups.find(g => g.id === value)
  const color = (current?.color || ACCENTS.slate) as string

  const pick = async (id: string | null) => {
    setOpen(false)
    if (id === value) return
    setBusy(true)
    await onAssign(id)
    setBusy(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors"
        style={{
          background: current ? `${color}1a` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${current ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
          color: current ? color : FAINT,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: current ? color : FAINT }} />
        {current ? current.name : 'Group…'}
        <ChevronDown size={9} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.15 }}
              className="absolute left-0 z-50 mt-1 w-44 rounded-lg p-1"
              style={{ background: 'rgba(24,24,27,0.95)', border: cardBorder, backdropFilter: 'blur(12px)' }}
            >
              <button onClick={() => pick(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-left transition-colors hover:bg-white/5"
                style={{ color: FAINT }}>
                <X size={11} /> No group
              </button>
              {groups.length === 0 && (
                <div className="px-2 py-1.5 text-[10px]" style={{ color: FAINT }}>No groups — create one first</div>
              )}
              {groups.map(g => (
                <button key={g.id} onClick={() => pick(g.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-left transition-colors hover:bg-white/5"
                  style={{ color: SECONDARY }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color || ACCENTS.purple }} />
                  <span className="flex-1 truncate">{g.name}</span>
                  {g.id === value && <Check size={10} style={{ color: g.color || ACCENTS.purple }} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
