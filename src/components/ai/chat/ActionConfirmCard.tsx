import { useState } from "react"
import { Check, X, Send, CalendarPlus, Trash2, Mail, Loader2 } from "lucide-react"
import { actionBus } from "../lib/actionBus"
import type { ActionType } from "../tokens"

interface ActionConfirmCardProps {
  action: {
    kind: string
    [key: string]: any
  }
  onConfirm: () => Promise<void>
  onDismiss: () => void
}

export function ActionConfirmCard(props: ActionConfirmCardProps) {
  const [executing, setExecuting] = useState(false)
  const [done, setDone] = useState(false)

  const handleConfirm = async () => {
    setExecuting(true)
    const actionId = `confirm-${props.action.kind}-${Date.now()}`
    actionBus.start(actionId, (props.action.kind || 'ai-stream') as ActionType, title)
    try {
      await props.onConfirm()
      actionBus.complete(actionId)
      setDone(true)
      setTimeout(() => props.onDismiss(), 2000)
    } catch (e: any) {
      actionBus.fail(actionId, e?.message)
      setExecuting(false)
    }
  }

  const { action } = props
  let title = "Confirm Action"
  let icon = <Send size={14} />
  let details: React.ReactNode = null

  if (action.kind === "reply-email") {
    title = "Send Email Reply"
    icon = <Mail size={14} />
    details = (
      <div style={{ fontSize: 11, color: "var(--ts)", lineHeight: 1.5 }}>
        <div><strong style={{ color: "var(--tp)" }}>To:</strong> {action.to}</div>
        <div><strong style={{ color: "var(--tp)" }}>Re:</strong> {action.subject}</div>
        <div style={{ marginTop: 6, padding: 8, background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)" }}>
          {action.draft}
        </div>
      </div>
    )
  } else if (action.kind === "create-event") {
    title = "Create Calendar Event"
    icon = <CalendarPlus size={14} />
    details = (
      <div style={{ fontSize: 11, color: "var(--ts)", lineHeight: 1.5 }}>
        <div><strong style={{ color: "var(--tp)" }}>Title:</strong> {action.title}</div>
        <div><strong style={{ color: "var(--tp)" }}>Start:</strong> {action.startTime}</div>
        {action.endTime && <div><strong style={{ color: "var(--tp)" }}>End:</strong> {action.endTime}</div>}
        {action.description && <div style={{ marginTop: 4 }}>{action.description}</div>}
      </div>
    )
  } else if (action.kind === "delete-event") {
    title = "Delete Calendar Event"
    icon = <Trash2 size={14} />
    details = <div style={{ fontSize: 11, color: "var(--red)" }}>This action cannot be undone.</div>
  } else if (action.kind === "mark-read") {
    title = action.read ? "Mark as Read" : "Mark as Unread"
    icon = <Mail size={14} />
  }

  if (done) {
    return (
      <div style={{
        padding: 12, borderRadius: 10, border: "1px solid var(--emerald)",
        background: "rgba(52,211,153,.08)", display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, color: "var(--emerald)",
      }}>
        <Check size={14} /> Action completed
      </div>
    )
  }

  return (
    <div style={{
      padding: 14, borderRadius: 12, border: "1px solid var(--line-2)",
      background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10,
      animation: "msgEnter 0.22s cubic-bezier(0.22,1,0.36,1) forwards",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--tp)" }}>
        {icon}
        {title}
      </div>
      {details}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={props.onDismiss}
          disabled={executing}
          style={{
            fontSize: 11, padding: "5px 12px", borderRadius: 6,
            border: "1px solid var(--line)", background: "transparent",
            color: "var(--ts)", cursor: "pointer", fontFamily: "var(--mono)",
          }}
        >
          <X size={11} style={{ marginRight: 4, display: "inline" }} />
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={executing}
          style={{
            fontSize: 11, padding: "5px 12px", borderRadius: 6,
            border: "none", background: "var(--emerald)",
            color: "#0b0b0d", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          {executing ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
          Confirm
        </button>
      </div>
    </div>
  )
}
