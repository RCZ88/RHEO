import { useEffect, useRef, type ReactNode } from "react"
import { Command } from "lucide-react"

export interface SlashCommand {
  id: string
  name: string
  desc: string
  icon: ReactNode
  category: string
}

interface SlashCommandPaletteProps {
  commands: SlashCommand[]
  activeIndex: number
  onSelect: (cmd: SlashCommand) => void
  onClose: () => void
}

export function SlashCommandPalette(props: SlashCommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const active = el.children[props.activeIndex] as HTMLElement
    if (active) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [props.activeIndex])

  const grouped = props.commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, SlashCommand[]>)

  const categoryLabels: Record<string, string> = {
    email: "Email",
    calendar: "Calendar",
    combined: "Combined",
    action: "Actions",
    ai: "AI Assist",
    custom: "Custom",
  }

  return (
    <div className="dk-cmd-palette">
      <div className="dk-cmd-palette-head">
        <Command size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
        Commands - Arrow keys to navigate, Enter to select, Esc to close
      </div>
      <div ref={listRef} style={{ maxHeight: 280, overflowY: "auto" }}>
        {Object.entries(grouped).map(([category, cmds]) => (
          <div key={category}>
            <div style={{
              padding: "6px 14px 2px",
              fontSize: 9,
              color: "var(--tm)",
              fontFamily: "var(--mono)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}>
              {categoryLabels[category] || category}
            </div>
            {cmds.map((cmd) => {
              const globalIdx = props.commands.indexOf(cmd)
              const isActive = globalIdx === props.activeIndex
              return (
                <div
                  key={cmd.id}
                  className={`dk-cmd-item ${isActive ? "active" : ""}`}
                  onClick={() => props.onSelect(cmd)}
                >
                  <div className="dk-cmd-item-icon">{cmd.icon}</div>
                  <div className="dk-cmd-item-text">
                    <div className="dk-cmd-item-name">{cmd.name}</div>
                    <div className="dk-cmd-item-desc">{cmd.desc}</div>
                  </div>
                  {isActive && (
                    <span className="dk-cmd-item-shortcut">Enter</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
