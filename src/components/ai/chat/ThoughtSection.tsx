import { useState, useEffect, useRef } from "react"
import { Brain, ChevronRight, ChevronDown } from "lucide-react"

interface ThoughtSectionProps {
  thoughts: string[]
  forceOpen?: boolean
}

export function ThoughtSection({ thoughts, forceOpen }: ThoughtSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const prevCountRef = useRef(thoughts.length)

  // Auto-expand when new thoughts arrive (streaming or not)
  useEffect(() => {
    if (thoughts.length > prevCountRef.current) {
      setExpanded(true)
    }
    prevCountRef.current = thoughts.length
  }, [thoughts.length])

  // During streaming, force open so user sees thinking text
  useEffect(() => {
    if (forceOpen) setExpanded(true)
  }, [forceOpen])

  // When streaming ends, collapse after a short delay
  useEffect(() => {
    if (!forceOpen && expanded && thoughts.length > 0) {
      const t = setTimeout(() => setExpanded(false), 2000)
      return () => clearTimeout(t)
    }
  }, [forceOpen, expanded, thoughts.length])

  if (!thoughts.length) return null

  return (
    <div className="dk-thought">
      <div
        className="dk-thought-header"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Brain size={12} className="text-zinc-500" />
        <span>Thinking{thoughts.length > 1 ? ` (${thoughts.length})` : ""}</span>
        {forceOpen && (
          <span className="ml-auto flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-400/80 animate-pulse" />
            <span className="text-[10px] text-[var(--text-muted)]">streaming</span>
          </span>
        )}
      </div>
      {expanded && (
        <div className="dk-thought-content">
          {thoughts.map((t, i) => (
            <div key={i} style={{ marginBottom: i < thoughts.length - 1 ? 8 : 0 }}>
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function extractThoughts(content: string): { thoughts: string[]; cleanContent: string } {
  if (!content) return { thoughts: [], cleanContent: content }

  const thoughts: string[] = []
  let cleanContent = content

  // Support multiple thinking tag formats:
  // <thought>...</thought>, <thinking>...</thinking>, <think>...</</think>, [thinking]...[/thinking]
  const tagPatterns = [
    { open: /<thought>/gi, close: /<\/thought>/gi, full: /<thought>([\s\S]*?)<\/thought>/gi, partial: /<thought>([\s\S]*?)$/i },
    { open: /<thinking>/gi, close: /<\/thinking>/gi, full: /<thinking>([\s\S]*?)<\/thinking>/gi, partial: /<thinking>([\s\S]*?)$/i },
    { open: /<think>/gi, close: /<\/think>/gi, full: /<think>([\s\S]*?)<\/think>/gi, partial: /<think>([\s\S]*?)$/i },
  ]

  for (const pattern of tagPatterns) {
    // Extract complete pairs
    let match
    while ((match = pattern.full.exec(cleanContent)) !== null) {
      thoughts.push(match[1].trim())
      cleanContent = cleanContent.replace(match[0], '')
    }

    // Handle partial/incomplete tags during streaming
    const partialMatch = pattern.partial.exec(cleanContent)
    if (partialMatch) {
      const partialContent = partialMatch[1].trim()
      if (partialContent) {
        thoughts.push(partialContent)
      }
      cleanContent = cleanContent.slice(0, partialMatch.index).trim()
    }
  }

  // Also handle [thinking]...[/thinking] bracket format
  const bracketFull = /\[thinking\]([\s\S]*?)\[\/thinking\]/gi
  const bracketPartial = /\[thinking\]([\s\S]*?)$/i
  let bMatch
  while ((bMatch = bracketFull.exec(cleanContent)) !== null) {
    thoughts.push(bMatch[1].trim())
    cleanContent = cleanContent.replace(bMatch[0], '')
  }
  const bPartial = bracketPartial.exec(cleanContent)
  if (bPartial) {
    const bContent = bPartial[1].trim()
    if (bContent) thoughts.push(bContent)
    cleanContent = cleanContent.slice(0, bPartial.index).trim()
  }

  return { thoughts, cleanContent: cleanContent.trim() }
}
