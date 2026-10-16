import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MoreVertical, Eye, Pencil, Trash2, X, Check, Loader2,
  Lightbulb, FileText, Plus, Flag, Sparkles, Target, Save
} from "lucide-react"
import { GlassCard } from "../GlassCard"
import { SectionHead } from "../SectionHead"
import { StateShell, EmptyState } from "../StateShell"
import { Segmented } from "../primitives/Segmented"
import { SkeletonRow } from "../primitives/Skeleton"
import { useMotionProps } from "../lib/motion"
import { cn } from "../lib/cn"
import { ACCENT, TEXT } from "../tokens"
import { CATEGORY_ACCENT, type DataState, type LongTermGoal, type GoalCategory } from "../types"
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

export interface PlanBoardProps {
  state: DataState
  goals: LongTermGoal[]
  notes: string
  savingNotes?: boolean
  onSaveNotes?: (content: string) => void
  onAnalyzeDump: (text: string) => Promise<Partial<LongTermGoal>[]>
  onSaveGoals: (goals: Partial<LongTermGoal>[]) => void
  onToggleGoal?: (goal: LongTermGoal) => void
  onDeleteGoal?: (id: string) => Promise<void>
  onUpdateGoal?: (goal: LongTermGoal) => Promise<void>
  errorMessage?: string
  onRetry?: () => void
}

type Pane = "goals" | "notes"

export function PlanBoard(props: PlanBoardProps) {
  const { state, goals, notes } = props
  const [activeTab, setActiveTab] = useState<Pane>("goals")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [dumpText, setDumpText] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [parsedGoals, setParsedGoals] = useState<Partial<LongTermGoal>[]>([])
  const [notesDraft, setNotesDraft] = useState(notes)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const m = useMotionProps()

  // CRUD state
  const [detailGoal, setDetailGoal] = useState<LongTermGoal | null>(null)
  const [editGoal, setEditGoal] = useState<LongTermGoal | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [crudLoading, setCrudLoading] = useState(false)

  const longTermState: DataState =
    state === 'loading' || state === 'error' ? state :
    goals.length === 0 ? 'empty' : 'ready'

  const active = goals.filter((g) => g.status !== "done").length

  useEffect(() => { setNotesDraft(notes) }, [notes])
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleDraftChange = (value: string) => {
    setNotesDraft(value)
    setSaveState("idle")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveState("saving")
      try {
        await props.onSaveNotes?.(value)
        setSaveState("saved")
        setTimeout(() => setSaveState(s => s === "saved" ? "idle" : s), 2000)
      } catch {
        setSaveState("error")
      }
    }, 600)
  }

  const handleAnalyze = useCallback(async () => {
    if (!dumpText.trim()) return
    setAnalyzing(true)
    try {
      const parsed = await props.onAnalyzeDump(dumpText)
      setParsedGoals(parsed)
    } finally { setAnalyzing(false) }
  }, [dumpText, props.onAnalyzeDump])

  const handleDelete = useCallback(async () => {
    if (!deleteId || !props.onDeleteGoal) return
    setCrudLoading(true)
    try {
      await props.onDeleteGoal(deleteId)
      setDeleteId(null)
    } catch (e) {
      // parent handles toast
    } finally {
      setCrudLoading(false)
    }
  }, [deleteId, props.onDeleteGoal])

  const handleUpdate = useCallback(async (goal: LongTermGoal) => {
    if (!props.onUpdateGoal) return
    setCrudLoading(true)
    try {
      await props.onUpdateGoal(goal)
      setEditGoal(null)
    } catch (e) {
      // parent handles toast
    } finally {
      setCrudLoading(false)
    }
  }, [props.onUpdateGoal])

  const goalToDelete = goals.find(g => g.id === deleteId)

  return (
    <GlassCard accent="violet" bar className="flex flex-col">
      <SectionHead
        accent="violet"
        icon={<Flag size={16} />}
        title="Plan"
        desc="Long-term goals & planning notes"
        right={
          <Segmented
            value={activeTab}
            onChange={setActiveTab}
            aria-label="Plan view"
            options={[
              { value: "goals", label: "Goals", count: goals.length },
              { value: "notes", label: "Notes" },
            ]}
          />
        }
      />

      {activeTab === "goals" ? (
        <>
          <div className="flex items-center justify-between px-1 mb-3">
            <span className={cn("text-[12px]", TEXT.muted)}>
              <span className="tabular-nums text-zinc-300">{active}</span> active
            </span>
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-violet-300 transition-colors hover:bg-violet-500/10"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <StateShell
            state={longTermState}
            errorMessage={props.errorMessage}
            onRetry={props.onRetry}
            loading={
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
              </div>
            }
            empty={
              <EmptyState
                icon={<Target size={20} />}
                title="No long-term goals yet"
                message="Add a few goals to steer your daily focus."
                cta={
                  <button
                    type="button"
                    onClick={() => setAddDialogOpen(true)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
                      ACCENT.violet.pill,
                    )}
                  >
                    <Plus size={13} /> Add goals
                  </button>
                }
              />
            }
          >
            <motion.div variants={m.parent} initial="hidden" animate="show" className="space-y-1.5">
              {goals.map((g) => (
                <motion.div key={g.id} variants={m.item}>
                  <LongTermRow
                    goal={g}
                    onToggle={props.onToggleGoal}
                    onViewDetail={setDetailGoal}
                    onEdit={setEditGoal}
                    onDelete={setDeleteId}
                  />
                </motion.div>
              ))}
            </motion.div>
          </StateShell>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <FileText size={13} /> Markdown · saved to your planning file
          </div>
          <VoiceInputWrapper>
            <textarea
              value={notesDraft}
              onChange={(e) => handleDraftChange(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder="# This week\n- …"
              className="w-full resize-none rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-60)] p-3 text-[13px] leading-6 text-zinc-100 placeholder:text-zinc-600 ring-1 ring-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            />
          </VoiceInputWrapper>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">
              {saveState === "saving" ? (
                <span className="inline-flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-zinc-500 animate-pulse" /> Saving…</span>
              ) : saveState === "saved" ? (
                <span className="text-emerald-400 inline-flex items-center gap-1"><Check size={11} /> Saved</span>
              ) : saveState === "error" ? (
                <span className="text-red-400">Save failed</span>
              ) : notesDraft !== notes ? (
                "Unsaved changes"
              ) : (
                "All changes saved"
              )}
            </span>
            <button
              type="button"
              onClick={() => props.onSaveNotes?.(notesDraft)}
              disabled={notesDraft === notes || saveState === "saving"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-40",
                ACCENT.violet.pill,
              )}
            >
              <Save size={13} /> {saveState === "saving" ? "Saving…" : "Save notes"}
            </button>
          </div>
        </div>
      )}

      {/* Add Goal Dialog */}
      <AnimatePresence>
        {addDialogOpen && (
          <AddGoalDialog
            parsedGoals={parsedGoals}
            dumpText={dumpText}
            analyzing={analyzing}
            onDumpChange={setDumpText}
            onAnalyze={handleAnalyze}
            onSave={() => { props.onSaveGoals(parsedGoals); setAddDialogOpen(false); setParsedGoals([]); setDumpText("") }}
            onClose={() => setAddDialogOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailGoal && (
          <GoalDetailModal goal={detailGoal} onClose={() => setDetailGoal(null)} />
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editGoal && (
          <GoalEditModal
            goal={editGoal}
            onSave={handleUpdate}
            onClose={() => setEditGoal(null)}
            loading={crudLoading}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteId && goalToDelete && (
          <DeleteConfirmDialog
            goalTitle={goalToDelete.title}
            onConfirm={handleDelete}
            onCancel={() => setDeleteId(null)}
            loading={crudLoading}
          />
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

/* ─── LongTermRow with action menu ─── */

function LongTermRow({
  goal,
  onToggle,
  onViewDetail,
  onEdit,
  onDelete,
}: {
  goal: LongTermGoal
  onToggle?: (g: LongTermGoal) => void
  onViewDetail?: (g: LongTermGoal) => void
  onEdit?: (g: LongTermGoal) => void
  onDelete?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const done = goal.status === "done"
  const accentKey = (CATEGORY_ACCENT[goal.category] ?? "violet") as keyof typeof ACCENT

  return (
    <div className="relative rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50 transition-[box-shadow] duration-150 hover:ring-zinc-700 group">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT[accentKey].dot)} />
        <button
          type="button"
          onClick={() => onToggle?.(goal)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[13px] font-medium",
            done ? cn(TEXT.muted, "line-through") : TEXT.primary,
          )}
        >
          {goal.title}
        </button>

        {/* Action Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
            aria-label="Actions"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={14} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-1 z-50 min-w-[150px] overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl py-1 shadow-xl"
              >
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                  onClick={() => { onViewDetail?.(goal); setMenuOpen(false) }}
                >
                  <Eye size={12} /> View Detail
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                  onClick={() => { onEdit?.(goal); setMenuOpen(false) }}
                >
                  <Pencil size={12} /> Edit
                </button>
                <div className="mx-2 my-1 h-px bg-zinc-800/60" />
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => { onDelete?.(goal.id); setMenuOpen(false) }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {typeof goal.priority === "number" ? (
          <span className="shrink-0 rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            P{goal.priority}
          </span>
        ) : null}
      </div>
      {goal.description ? (
        <p className={cn("mt-1.5 pl-4.5 text-[12px] leading-5", TEXT.muted)}>{goal.description}</p>
      ) : null}
    </div>
  )
}

/* ─── Goal Detail Modal ─── */

function GoalDetailModal({ goal, onClose }: { goal: LongTermGoal; onClose: () => void }) {
  const accentKey = (CATEGORY_ACCENT[goal.category] ?? "violet") as keyof typeof ACCENT
  const createdAt = goal.createdAt ? new Date(goal.createdAt).toLocaleDateString() : "Unknown"
  const completedAt = goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ACCENT[accentKey].dot)} />
            <h3 className="text-[15px] font-semibold text-zinc-100">Goal Detail</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Title</div>
            <p className="text-[13px] text-zinc-200 font-medium">{goal.title}</p>
          </div>

          {goal.description && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Description</div>
              <p className="text-[12px] text-zinc-400 leading-5">{goal.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Category</div>
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", ACCENT[accentKey].dot)} />
                <span className="text-[12px] text-zinc-300 capitalize">{goal.category}</span>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Priority</div>
              <span className="text-[12px] text-zinc-300">P{goal.priority}</span>
            </div>
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Status</div>
              <span className={cn("text-[12px] capitalize font-medium",
                goal.status === "done" ? "text-emerald-400" :
                goal.status === "missed" ? "text-red-400" : "text-zinc-300"
              )}>
                {goal.status}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Created</div>
              <span className="text-[12px] text-zinc-300">{createdAt}</span>
            </div>
          </div>

          {goal.target_seconds ? (
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Target</div>
              <span className="text-[12px] text-zinc-300">{Math.round(goal.target_seconds / 3600)} hours</span>
            </div>
          ) : null}

          {completedAt && (
            <div className="rounded-lg bg-emerald-500/5 p-3 ring-1 ring-emerald-500/15">
              <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-400 mb-1.5">Completed</div>
              <span className="text-[12px] text-emerald-300">{completedAt}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Goal Edit Modal ─── */

function GoalEditModal({
  goal,
  onSave,
  onClose,
  loading,
}: {
  goal: LongTermGoal
  onSave: (goal: LongTermGoal) => Promise<void>
  onClose: () => void
  loading?: boolean
}) {
  const [form, setForm] = useState<LongTermGoal>({ ...goal })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    await onSave(form)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold text-zinc-100">Edit Goal</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Title</label>
            <VoiceInputWrapper>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] border border-zinc-800/60 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 transition-all"
                required
              />
            </VoiceInputWrapper>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Description</label>
            <VoiceInputWrapper>
              <textarea
                value={form.description || ""}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] border border-zinc-800/60 px-3 py-2 text-[12px] text-zinc-400 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 resize-none transition-all"
              />
            </VoiceInputWrapper>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as GoalCategory }))}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] border border-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-zinc-600 transition-all"
              >
                {(["work", "personal", "health", "learning", "finance", "relationships"] as GoalCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] border border-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-zinc-600 transition-all"
              >
                {[1, 2, 3, 4, 5].map(p => (
                  <option key={p} value={p}>P{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Status</label>
            <div className="flex gap-2">
              {(["active", "done", "missed"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[12px] capitalize transition-all",
                    form.status === s
                      ? s === "done" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : s === "missed" ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-zinc-600 bg-zinc-800/60 text-zinc-200"
                      : "border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] px-4 py-2 text-[12px] text-zinc-400 hover:bg-zinc-800/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="flex-1 rounded-lg bg-violet-500/15 border border-violet-500/30 px-4 py-2 text-[12px] text-violet-300 hover:bg-violet-500/25 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 size={11} className="spin inline mr-1" /> : null}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

/* ─── Delete Confirm Dialog ─── */

function DeleteConfirmDialog({
  goalTitle,
  onConfirm,
  onCancel,
  loading,
}: {
  goalTitle: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-xl border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)] p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 size={14} className="text-red-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-zinc-100">Delete Goal</h3>
        </div>
        <p className="text-[12px] text-zinc-400 mb-5 leading-5">
          Are you sure you want to delete <span className="text-zinc-200 font-medium">&ldquo;{goalTitle}&rdquo;</span>? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] px-4 py-2 text-[12px] text-zinc-400 hover:bg-zinc-800/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-2 text-[12px] text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={11} className="spin inline mr-1" /> : null}
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Add Goal Dialog ─── */

function AddGoalDialog({
  parsedGoals,
  dumpText,
  analyzing,
  onDumpChange,
  onAnalyze,
  onSave,
  onClose,
}: {
  parsedGoals: Partial<LongTermGoal>[]
  dumpText: string
  analyzing: boolean
  onDumpChange: (v: string) => void
  onAnalyze: () => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-xl border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={15} className="text-violet-400" />
            <h3 className="text-[15px] font-semibold text-zinc-100">Add Goals</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-[12px] text-zinc-400 mb-3">Paste a brain-dump and the AI will extract structured goals.</p>
        <VoiceInputWrapper>
          <textarea
            value={dumpText}
            onChange={e => onDumpChange(e.target.value)}
            rows={5}
            placeholder="I want to learn Rust, run a marathon, save $10k..."
            className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] border border-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-zinc-600 resize-none mb-3"
          />
        </VoiceInputWrapper>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)] px-4 py-2 text-[12px] text-zinc-400 hover:bg-zinc-800/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing || !dumpText.trim()}
            className="rounded-lg bg-violet-500/15 border border-violet-500/30 px-4 py-2 text-[12px] text-violet-300 hover:bg-violet-500/25 transition-colors disabled:opacity-40"
          >
            {analyzing ? <Loader2 size={11} className="spin inline mr-1" /> : <Sparkles size={11} className="inline mr-1" />}
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {parsedGoals.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Extracted Goals</div>
            {parsedGoals.map((g, i) => (
              <div key={i} className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-40)] p-3 ring-1 ring-zinc-800/50">
                <div className="text-[13px] text-zinc-200 font-medium">{g.title}</div>
                {g.description && <p className="text-[11px] text-zinc-400 mt-1">{g.description}</p>}
              </div>
            ))}
            <button
              type="button"
              onClick={onSave}
              className="w-full rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-[12px] text-emerald-300 hover:bg-emerald-500/25 transition-colors mt-2"
            >
              <Check size={11} className="inline mr-1" /> Save {parsedGoals.length} Goal{parsedGoals.length !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
