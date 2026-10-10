import { useState, useEffect, useCallback } from "react"
import { X, Plus, Pencil, Trash2, Zap, Loader2, Check } from "lucide-react"
import {
  getAllCommands,
  addCommand,
  updateCommand,
  deleteCommand,
  type CustomSlashCommand,
} from "../../../services/customSlashCommands"

interface SlashCommandManagerProps {
  open: boolean
  onClose: () => void
}

export function SlashCommandManager(props: SlashCommandManagerProps) {
  const [commands, setCommands] = useState<CustomSlashCommand[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", prompt: "" })
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (props.open) {
      setCommands(getAllCommands())
      setShowAdd(false)
      setEditing(null)
      setForm({ name: "", description: "", prompt: "" })
    }
  }, [props.open])

  const handleAdd = useCallback(() => {
    if (!form.name.trim() || !form.prompt.trim()) return
    const cmd = addCommand(form.name, form.description, form.prompt)
    setCommands(prev => [...prev, cmd])
    setForm({ name: "", description: "", prompt: "" })
    setShowAdd(false)
  }, [form])

  const handleUpdate = useCallback(() => {
    if (!editing || !form.name.trim() || !form.prompt.trim()) return
    updateCommand(editing, form)
    setCommands(prev => prev.map(c => c.id === editing ? { ...c, ...form, name: form.name.replace(/^\//, '').toLowerCase() } : c))
    setEditing(null)
    setForm({ name: "", description: "", prompt: "" })
  }, [editing, form])

  const handleDelete = useCallback((id: string) => {
    deleteCommand(id)
    setCommands(prev => prev.filter(c => c.id !== id))
  }, [])

  const startEdit = useCallback((cmd: CustomSlashCommand) => {
    setEditing(cmd.id)
    setForm({ name: cmd.name, description: cmd.description, prompt: cmd.prompt })
    setShowAdd(false)
  }, [])

  const startAdd = useCallback(() => {
    setShowAdd(true)
    setEditing(null)
    setForm({ name: "", description: "", prompt: "" })
  }, [])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-zinc-900 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-pink-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Manage Slash Commands</h2>
          </div>
          <button onClick={props.onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {commands.length === 0 && !showAdd && (
            <div className="text-center py-8">
              <Zap size={24} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-xs text-zinc-500 mb-3">No custom commands yet</p>
              <button
                onClick={startAdd}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 hover:bg-pink-500/20 transition-colors"
              >
                <Plus size={12} /> Create your first command
              </button>
            </div>
          )}

          {/* Command List */}
          <div className="space-y-2">
            {commands.map(cmd => (
              <div key={cmd.id} className="rounded-lg bg-zinc-800/40 ring-1 ring-zinc-700/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-pink-400">/{cmd.name}</span>
                    {cmd.description && (
                      <span className="text-[11px] text-zinc-500">— {cmd.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(cmd)}
                      className="p-1 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(cmd.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono truncate">{cmd.prompt}</p>
              </div>
            ))}
          </div>

          {/* Add/Edit Form */}
          {(showAdd || editing) && (
            <div className="mt-4 rounded-lg bg-zinc-800/30 ring-1 ring-zinc-700/30 p-4 space-y-3">
              <div className="text-xs font-medium text-zinc-400">{editing ? 'Edit Command' : 'New Command'}</div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Command name</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pink-400 text-sm">/</span>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="standup"
                    className="w-full rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] pl-6 pr-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Description <span className="text-zinc-600">(optional)</span></label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Generate standup summary"
                  className="w-full rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Prompt template</label>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                  rows={3}
                  placeholder="Write a standup based on my recent activity: {args}"
                  className="w-full rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] px-3 py-2 text-sm text-zinc-100 font-mono ring-1 ring-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 placeholder:text-zinc-600 resize-none"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Use {'{args}'} where user input should go</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setEditing(null); setShowAdd(false); setForm({ name: "", description: "", prompt: "" }) }}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editing ? handleUpdate : handleAdd}
                  disabled={!form.name.trim() || !form.prompt.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 hover:bg-pink-500/20 transition-colors disabled:opacity-40"
                >
                  {editing ? <><Check size={12} /> Save Changes</> : <><Plus size={12} /> Add Command</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showAdd && !editing && commands.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 hover:bg-pink-500/20 transition-colors"
            >
              <Plus size={12} /> Add Command
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
