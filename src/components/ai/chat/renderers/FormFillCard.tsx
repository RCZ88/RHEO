import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { CardShell } from "./CardShell"
import type { CardAction, FormField } from "../parsed"

function initialValues(fields: FormField[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const f of fields) {
    if (f.value !== undefined) out[f.name] = f.value
    else if (f.type === "toggle") out[f.name] = false
    else if (f.type === "number") out[f.name] = ""
    else if (f.type === "select") out[f.name] = f.options?.[0]?.value ?? ""
    else out[f.name] = ""
  }
  return out
}

export function FormFillCard({
  title,
  submitLabel,
  fields,
  onAction,
}: {
  title?: string
  submitLabel?: string
  fields: FormField[]
  onAction?: (a: CardAction) => void
}) {
  const [values, setValues] = useState(() => initialValues(fields))
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (name: string, v: string | number | boolean) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => {
    const missing = fields.find((f) => f.required && (values[f.name] === "" || values[f.name] === undefined))
    if (missing) { setError(missing.label + " is required"); return }
    setError(null)
    setSubmitted(true)
    onAction?.({ kind: "submit-form", values })
  }

  return (
    <CardShell title={title || "Fill in details"} badge="form_fill" accent="violet" icon={<ClipboardList size={14} />}>
      <div className="flex flex-col gap-2.5">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--ts)]">
              {f.label}
              {f.required ? <span className="text-[var(--red)]"> *</span> : null}
            </span>
            {f.type === "toggle" ? (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(values[f.name])}
                disabled={submitted}
                onClick={() => set(f.name, !values[f.name])}
                className={"relative inline-flex h-5 w-9 items-center rounded-full transition-colors" + (values[f.name] ? " bg-[var(--violet)]" : " bg-zinc-700")}
              >
                <span className={"inline-block h-4 w-4 rounded-full bg-white transition-transform" + (values[f.name] ? " translate-x-4" : " translate-x-0.5")} />
              </button>
            ) : f.type === "select" ? (
              <select
                disabled={submitted}
                value={String(values[f.name] ?? "")}
                onChange={(e) => set(f.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-60)] px-2.5 py-1.5 text-[13px] text-zinc-100 ring-1 ring-zinc-800/60"
              >
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                disabled={submitted}
                value={String(values[f.name] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-60)] px-2.5 py-1.5 text-[13px] text-zinc-100 ring-1 ring-zinc-800/60 placeholder:text-zinc-600"
              />
            )}
          </label>
        ))}
        {error ? <div className="text-[11px] text-[var(--red)]">{error}</div> : null}
        <button
          className="dk-btn dk-pri"
          disabled={submitted}
          onClick={submit}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {submitted ? "Submitted" : submitLabel || "Submit"}
        </button>
      </div>
    </CardShell>
  )
}
