"use client"
import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper'

interface Props {
  phaseId?: string
  onClose: () => void
}

export function InlineMemoryForm({ phaseId, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      // Save via notes API as a memory placeholder
      await (window as any).deskflowAPI.notesCreate({
        title: title.trim(),
        content: description.trim(),
        group: 'memories',
        tags: [phaseId || 'unlinked', date],
      })
    } catch (e) { console.error(e) }
    setSaving(false)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div onClick={() => fileInputRef.current?.click()}
        className="aspect-video w-full rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500/40 flex items-center justify-center cursor-pointer transition-colors bg-zinc-950 light:bg-[var(--ws-surface-30)] overflow-hidden">
        {imagePreview ? (
          <img src={imagePreview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center"><Upload className="w-6 h-6 text-zinc-600 mx-auto mb-1.5" /><p className="text-xs text-zinc-500">Click to upload image</p></div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      <div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
          <span>Title</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/50"><span className="w-2.5 h-2.5">🎤</span> voice</span>
        </label>
        <VoiceInputWrapper>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="A moment to remember..." autoFocus
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/40 focus:outline-none" />
        </VoiceInputWrapper>
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
          <span>Description</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/50"><span className="w-2.5 h-2.5">🎤</span> voice</span>
        </label>
        <VoiceInputWrapper>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened? How did it feel?" rows={3}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/40 focus:outline-none resize-none" />
        </VoiceInputWrapper>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1.5 block">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/40 focus:outline-none" />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim() || saving}
          className="flex-1 px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-40">
          {saving ? 'Saving...' : 'Save Memory'}
        </button>
      </div>
    </div>
  )
}
