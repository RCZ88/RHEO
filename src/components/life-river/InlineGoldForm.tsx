"use client"
import { useState } from 'react'
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper'

interface Props {
  phaseId?: string
  onClose: () => void
}

export function InlineGoldForm({ phaseId, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [category, setCategory] = useState('achievement')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await (window as any).deskflowAPI.saveGoalsBatch([{
        id: `ltg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority: 1,
        deadline: deadline || null,
        status: 'active',
        period: 'longterm',
        date: '2000-01-01',
        source: 'manual',
        links: [],
      }])
    } catch (e) { console.error(e) }
    setSaving(false)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
          <span>Goal Title</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/50"><span className="w-2.5 h-2.5">🎤</span> voice</span>
        </label>
        <VoiceInputWrapper>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to achieve?" autoFocus
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/40 focus:outline-none" />
        </VoiceInputWrapper>
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
          <span>Description</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/50"><span className="w-2.5 h-2.5">🎤</span> voice</span>
        </label>
        <VoiceInputWrapper>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Why does this matter?" rows={2}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/40 focus:outline-none resize-none" />
        </VoiceInputWrapper>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Target Date</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/40 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/40 focus:outline-none">
            {['achievement', 'skill', 'career', 'health', 'financial', 'creative'].map(cat => (
              <option key={cat} value={cat} className="capitalize">{cat}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim() || saving}
          className="flex-1 px-4 py-2 text-sm bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-40">
          {saving ? 'Saving...' : 'Save Goal'}
        </button>
      </div>
    </div>
  )
}
