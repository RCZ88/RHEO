import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { ParsedMessageRouter } from "./ParsedMessageRouter"
import { TypewriterText } from "./TypewriterText"
import { ThoughtSection, extractThoughts } from "./ThoughtSection"
import { MarkdownRenderer } from "./MarkdownRenderer"
import type { CardAction, ParsedMessage } from "./parsed"

export interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  streaming?: boolean
  timestamp?: string
  parsed?: ParsedMessage
  onAction?: (a: CardAction) => void
  actionResults?: Record<string, "running" | "done" | "error">
  connectorSyncing?: Record<string, true>
  autoApprove?: boolean
}

export function MessageBubble(props: MessageBubbleProps) {
  const { role, content, streaming, timestamp, parsed, onAction, actionResults, connectorSyncing, autoApprove } = props
  const isUser = role === "user"
  const isSystem = role === "system"
  const isTool = role === "tool"
  const hasCard = !!parsed && parsed.type !== "text"

  const { thoughts, cleanContent } = useMemo(() => {
    if (isUser || isSystem || isTool || !content) return { thoughts: [], cleanContent: content }
    return extractThoughts(content)
  }, [content, isUser, isSystem, isTool])

  const renderedContent = useMemo(() => {
    if (!cleanContent && !hasCard) return null
    if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{cleanContent}</span>
    if (isSystem) return <span style={{ fontStyle: "italic" }}>{cleanContent}</span>
    if (isTool) return <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{cleanContent}</pre>
    // For assistant messages: show content even if empty (card-only message)
    if (!cleanContent && hasCard) return null
    if (streaming) return <TypewriterText text={cleanContent} />
    return <MarkdownRenderer content={cleanContent} settled={!streaming} />
  }, [cleanContent, isUser, isSystem, isTool, streaming, hasCard])

  if (isSystem) {
    return (
      <div className="dk-msg-system">
        <div className="dk-system-text">{renderedContent}</div>
      </div>
    )
  }

  if (isTool) {
    return (
      <div className="dk-msg-tool">
        <div className="dk-tool-header">Tool Output</div>
        <div className="dk-tool-content">{renderedContent}</div>
      </div>
    )
  }

  return (
    <div className={`dk-msg ${isUser ? "dk-user" : "dk-ai"}`}>
      <div className={`dk-av ${isUser ? "dk-me" : "dk-ai"}`}>
        {isUser ? "CZ" : <Sparkles size={12} />}
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", maxWidth: "85%" }}>
        {!isUser && thoughts.length > 0 && (
          <ThoughtSection thoughts={thoughts} forceOpen={Boolean(streaming)} />
        )}
        {renderedContent && (
          <div className={`dk-bubble ${!isUser ? "dk-bubble-ai" : "dk-bubble-user"}`}>
            {renderedContent}
          </div>
        )}
        {hasCard && (
          <div style={{ width: "100%", marginTop: cleanContent ? 11 : 0 }}>
            <ParsedMessageRouter
              parsed={parsed as ParsedMessage}
              onAction={onAction}
              actionResults={actionResults}
              connectorSyncing={connectorSyncing}
              autoApprove={autoApprove}
            />
          </div>
        )}
        {timestamp && (
          <div className="dk-msg-time" style={{ textAlign: isUser ? "right" : "left" }}>
            {timestamp}
          </div>
        )}
      </div>
    </div>
  )
}
