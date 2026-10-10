import { useState } from "react"
import { Plus, Sparkles, Trash2, Wand2 } from "lucide-react"
import { Dialog } from "../primitives/Dialog"
import { Segmented } from "../primitives/Segmented"
import { cn } from "../lib/cn"
import { ACCENT, TEXT } from "../tokens"
import type { LongTermGoal } from "../types"

export interface BulkImportDialogProps {
	open: boolean
	onClose: () => void
	/** Parse free text into structured goals (IPC: parseGoalDump). */
	onAnalyze: (text: string) => Promise<Partial<LongTermGoal>[]>
	/** Persist the final list (IPC: saveGoalsBatch, or sequential saveGoal). */
	onSave: (goals: Partial<LongTermGoal>[]) => void
}

type TabValue = "fields" | "paste"

/**
 * Long-term goal entry with BOTH polished paths in one modal:
 *  - "fields": stacked single-line inputs with add-another (fast manual entry)
 *  - "paste": free-text -> Analyze with AI -> editable preview -> Save all
 */
export function BulkImportDialog({ open, onClose, onAnalyze, onSave }: BulkImportDialogProps) {
	const [tab, setTab] = useState<TabValue>("fields")
	const [fields, setFields] = useState<string[]>([""])
	const [dump, setDump] = useState("")
	const [analyzing, setAnalyzing] = useState(false)
	const [preview, setPreview] = useState<Partial<LongTermGoal>[] | null>(null)

	const reset = () => {
		setFields([""])
		setDump("")
		setPreview(null)
		setAnalyzing(false)
	}
	const close = () => {
		reset()
		onClose()
	}

	const analyze = async () => {
		if (!dump.trim()) return
		setAnalyzing(true)
		try {
			const parsed = await onAnalyze(dump)
			setPreview(parsed)
		} finally {
			setAnalyzing(false)
		}
	}

	const save = () => {
		if (tab === "fields") {
			const goals = fields
				.map((t) => t.trim())
				.filter(Boolean)
				.map((title) => ({ title }) as Partial<LongTermGoal>)
			if (goals.length) onSave(goals)
		} else if (preview) {
			onSave(preview)
		}
		close()
	}

	const canSave =
		tab === "fields"
			? fields.some((f) => f.trim().length > 0)
			: Boolean(preview && preview.length > 0)

	return (
		<Dialog
			open={open}
			onClose={close}
			title="Add long-term goals"
			description="Type them in, or paste a brain-dump and let AI structure it."
			footer={
				<>
					<button
						type="button"
						onClick={close}
						className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={save}
						disabled={!canSave}
						className={cn(
							"rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-40",
							ACCENT.violet.pill,
						)}
					>
						Save goals
					</button>
				</>
			}
		>
			<Segmented
				className="mb-4"
				value={tab}
				onChange={setTab}
				options={[
					{ value: "fields", label: "Type them in" },
					{ value: "paste", label: "Paste & analyze" },
				]}
			/>

			{tab === "fields" ? (
				<div className="space-y-2">
					{fields.map((val, i) => (
						<div key={i} className="flex items-center gap-2">
							<span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-zinc-600">
								{i + 1}
							</span>
							<input
								value={val}
								autoFocus={i === fields.length - 1}
								onChange={(e) =>
									setFields((f) => f.map((x, j) => (j === i ? e.target.value : x)))
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
									setFields((f) => [...f, ""])
								}
							}}
								placeholder="e.g. Ship the v2 onboarding flow"
								className="flex-1 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 ring-1 ring-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
							/>
							{fields.length > 1 ? (
								<button
									type="button"
								onClick={() => setFields((f) => f.filter((_, j) => j !== i))}
								aria-label="Remove"
								className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
								>
								<Trash2 size={14} />
								</button>
							) : null}
						</div>
					))}
					<button
						type="button"
						onClick={() => setFields((f) => [...f, ""])}
						className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200"
					>
						<Plus size={13} /> Add another
					</button>
				</div>
			) : (
				<div className="space-y-3">
					<textarea
						value={dump}
						onChange={(e) => setDump(e.target.value)}
						rows={5}
						placeholder="Paste anything — a list, a paragraph, meeting notes. AI will pull out the goals."
						className="w-full resize-none rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 ring-1 ring-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
					/>
					<button
						type="button"
						onClick={analyze}
						disabled={!dump.trim() || analyzing}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-40",
							ACCENT.violet.pill,
						)}
					>
						<Wand2 size={13} className={analyzing ? "animate-spin motion-reduce:animate-none" : ""} />
						{analyzing ? "Analyzing…" : "Analyze with AI"}
					</button>

					{preview ? (
						<div className="space-y-1 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-3 ring-1 ring-zinc-800/50">
							<p className={cn("mb-1 flex items-center gap-1.5 text-[11px] font-medium", TEXT.muted)}>
								<Sparkles size={11} className="text-violet-300" /> {preview.length} goals detected
							</p>
							{preview.map((g, i) => (
								<input
									key={i}
									value={g.title ?? ""}
									onChange={(e) =>
										setPreview((p) =>
											(p ?? []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
										)
									}
									className="w-full rounded-md bg-zinc-950 light:bg-[var(--ws-surface)]/60 px-2.5 py-1.5 text-[13px] text-zinc-100 ring-1 ring-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
								/>
							))}
						</div>
					) : null}
				</div>
			)}
		</Dialog>
	)
}
