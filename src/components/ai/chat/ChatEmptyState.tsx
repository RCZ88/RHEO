import { useMemo, type ReactNode } from "react"
import { Plus, Moon, Sun, CloudSun, Sunset, PenLine, BarChart3, Target } from "lucide-react"

export interface ChatSuggestion {
  id: string
  label: string
  prompt: string
  icon?: ReactNode
}

interface ChatEmptyStateProps {
  suggestions?: ChatSuggestion[]
  onPick?: (prompt: string) => void
  onNewThread?: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return "Up late?"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 22) return "Good evening"
  return "Good night"
}

function getTimeIcon(): ReactNode {
  const hour = new Date().getHours()
  if (hour < 6) return <Moon size={24} />
  if (hour < 12) return <Sun size={24} />
  if (hour < 17) return <CloudSun size={24} />
  if (hour < 22) return <Sunset size={24} />
  return <Moon size={24} />
}

const DEFAULTS: ChatSuggestion[] = [
  { id: "plan", label: "Plan my day", prompt: "Help me plan my day based on my goals.", icon: <PenLine size={14} /> },
  { id: "summary", label: "Summarize progress", prompt: "Summarize my progress this week.", icon: <BarChart3 size={14} /> },
  { id: "focus", label: "What should I focus on?", prompt: "What is the most important thing to focus on right now?", icon: <Target size={14} /> },
]

export function ChatEmptyState(props: ChatEmptyStateProps) {
  const greeting = useMemo(getGreeting, [])
  const timeIcon = useMemo(getTimeIcon, [])

  const suggestions = props.suggestions ?? DEFAULTS

  return (
    <div className="dk-empty">
      <div className="dk-empty-icon">{timeIcon}</div>
      <h3>{greeting} — How can I help?</h3>
      <p>
        I can plan your day, check your emails, manage your calendar, summarize progress, or answer questions about your work.
      </p>

      <div className="dk-suggestions">
        {suggestions.map((s, i) => (
          <button
            key={s.id}
            className="dk-chip"
            onClick={() => props.onPick?.(s.prompt)}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {s.icon && <span style={{ marginRight: 4 }}>{s.icon}</span>}
            {s.label}
          </button>
        ))}
      </div>

      {props.onNewThread && (
        <button
          onClick={props.onNewThread}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            padding: "7px 14px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--ts)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            letterSpacing: "0.5px",
            marginTop: 4,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--line-2)"
            e.currentTarget.style.color = "var(--tp)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line)"
            e.currentTarget.style.color = "var(--ts)"
          }}
        >
          <Plus size={12} />
          New Thread
        </button>
      )}
    </div>
  )
}
