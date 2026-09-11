import type { CardAction } from "../components/ai/chat/parsed"

const COMMANDS: { icon: string; color: string; label: string; cmd: string }[] = [
  { icon: "◎", color: "#fcd34d", label: "Plan my day",        cmd: "/plan" },
  { icon: "▤", color: "#67e8f9", label: "Generate digest",    cmd: "/digest" },
  { icon: "◷", color: "#6ee7b7", label: "Reflect on today",   cmd: "/reflect" },
  { icon: "⚡", color: "#f9a8d4", label: "Start focus session", cmd: "/focus" },
]

export function QuickCommands({ onAction }: { onAction?: (a: CardAction) => void }) {
  return (
    <>
      <div className="dk-microlabel">Quick commands</div>
      <div className="dk-card dk-acc dk-amber dk-sec">
        {COMMANDS.map((c) => (
          <button
            key={c.cmd}
            className="dk-conn"
            style={{ width: "100%", background: "transparent", border: 0, borderTop: "1px solid var(--line)", cursor: "pointer" }}
            onClick={() => onAction?.({ kind: "send-text", text: c.cmd })}
          >
            <div className="dk-conn-l">
              <span className="dk-conn-ci" style={{ color: c.color }}>{c.icon}</span>
              <div className="dk-conn-nm">{c.label}</div>
            </div>
            <span className="dk-conn-st">{c.cmd}</span>
          </button>
        ))}
      </div>
    </>
  )
}
