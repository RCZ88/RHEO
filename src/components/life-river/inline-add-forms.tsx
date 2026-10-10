"use client"

import * as React from 'react'
import { useState } from 'react'
import { Images, Target } from 'lucide-react'
import type { LifePhase } from '@/lib/riverMath'
import { cn } from '@/lib/utils'

export interface GoldDraft {
  title: string
  kind: 'daily' | 'longterm'
  targetDate?: string | null
  phaseId?: string | null
}

export interface MemoryDraft {
  title: string
  date: string
  note?: string | null
  phaseId?: string | null
  file?: File | null
  filePath?: string | null
}

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 light:bg-[var(--ws-surface)]/60 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600'

const labelClass = 'mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500'

export function InlineGoldForm({
  phaseId,
  phases,
  onClose,
  onSave,
}: {
  phaseId?: string
  phases: LifePhase[]
  onClose: () => void
  onSave: (draft: GoldDraft) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'daily' | 'longterm'>('longterm')
  const [targetDate, setTargetDate] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) {
      setError('Give this goal a name.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        title: title.trim(),
        kind,
        targetDate: targetDate || null,
        phaseId: selectedPhaseId || null,
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Goal</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this branch reaching toward?"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Type</label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind('longterm')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              kind === 'longterm'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                : 'border-zinc-800 bg-zinc-950 light:bg-[var(--ws-surface)]/40 text-zinc-400'
            )}
          >
            Long-term branch
          </button>

          <button
            type="button"
            onClick={() => setKind('daily')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              kind === 'daily'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                : 'border-zinc-800 bg-zinc-950 light:bg-[var(--ws-surface)]/40 text-zinc-400'
            )}
          >
            Daily goal
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Target date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Connect to phase</label>
          <select
            value={selectedPhaseId}
            onChange={(e) => setSelectedPhaseId(e.target.value)}
            className={inputClass}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-rose-400">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>

        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-sm text-amber-100 disabled:opacity-60"
        >
          <Target className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save goal'}
        </button>
      </div>
    </div>
  )
}

export function InlineMemoryForm({
  phaseId,
  phases,
  onClose,
  onSave,
}: {
  phaseId?: string
  phases: LifePhase[]
  onClose: () => void
  onSave: (draft: MemoryDraft) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFileChange = (nextFile: File | null) => {
    setFile(nextFile)

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    if (nextFile) {
      setPreview(URL.createObjectURL(nextFile))
    } else {
      setPreview(null)
    }
  }

  const submit = async () => {
    if (!title.trim()) {
      setError('Give this memory a name.')
      return
    }

    if (!date) {
      setError('Choose a date.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        title: title.trim(),
        date,
        note: note.trim() || null,
        phaseId: selectedPhaseId || null,
        file,
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save memory.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Memory</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did you keep?"
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Connect to phase</label>
          <select
            value={selectedPhaseId}
            onChange={(e) => setSelectedPhaseId(e.target.value)}
            className={inputClass}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — why this moment matters."
          className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 light:bg-[var(--ws-surface)]/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
        />
      </div>

      <div>
        <label className={labelClass}>Image</label>

        <div className="flex items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-zinc-500">
            Choose image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <span className="truncate text-[12px] text-zinc-500">
              {file.name}
            </span>
          )}
        </div>

        {preview && (
          <div className="mt-3 overflow-hidden rounded-lg border border-emerald-500/20">
            <img
              src={preview}
              alt="Memory preview"
              className="h-32 w-full object-cover"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-rose-400">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>

        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-sm text-emerald-100 disabled:opacity-60"
        >
          <Images className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save memory'}
        </button>
      </div>
    </div>
  )
}
