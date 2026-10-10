"use client"
import { useState } from 'react'
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper'

interface Props {
  phaseId?: string
  onClose: () => void
}

export function InlineCovenantForm({ phaseId, onClose }: Props) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('personal')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await (window as any).deskflowAPI.saveGoal(new Date().toISOString().slice(0, 10), {
        id: `covenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: text.trim(),
        category,
        status: 'active',
        period: 'daily',
        date: new Date().toISOString().slice(0, 10),
        source: 'manual',
        links: [],
      })
    } catch (e) { console.error(e) }
    setSaving(false)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
          <span>Commitment</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/50"><span className="w-2.5 h-2.5">🎤</span> voice</span>
        </label>
        <VoiceInputWrapper>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="I will..." autoFocus rows={3}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-rose-500/40 focus:outline-none resize-none" />
        </VoiceInputWrapper>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1.5 block">Category</label>
        <div className="flex flex-wrap gap-2">
          {['personal', 'relational', 'spiritual', 'professional'].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-all capitalize ${category === cat ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={!text.trim() || saving}
          className="flex-1 px-4 py-2 text-sm bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 transition-colors disabled:opacity-40">
          {saving ? 'Saving...' : 'Save Covenant'}
        </button>
      </div>
    </div>
  )
}
