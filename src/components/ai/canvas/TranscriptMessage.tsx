import { useState } from 'react'
import { MarkdownRenderer } from '../chat/MarkdownRenderer'
import type { ChatMsg } from '../../../hooks/useAiChat'

interface TranscriptMessageProps {
  message: ChatMsg
}

export function TranscriptMessage({ message }: TranscriptMessageProps) {
  const { role, content, timestamp } = message

  if (role === 'system') {
    return (
      <div className="dk-rail-msg-system">
        <span>{content}</span>
      </div>
    )
  }

  if (role === 'tool') {
    const [expanded, setExpanded] = useState(false)
    return (
      <div className="dk-rail-msg-tool">
        <button className="dk-rail-tool-header" onClick={() => setExpanded(!expanded)}>
          <span>Tool output</span>
          <span>{expanded ? '▾' : '▸'}</span>
        </button>
        {expanded && (
          <pre className="dk-rail-tool-body">{content}</pre>
        )}
      </div>
    )
  }

  const isUser = role === 'user'
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className={`dk-rail-msg ${isUser ? 'dk-rail-user' : 'dk-rail-ai'}`}>
      <div className="dk-rail-msg-bubble">
        {isUser ? (
          <span className="dk-rail-text">{content}</span>
        ) : (
          <MarkdownRenderer content={content} settled />
        )}
      </div>
      <div className="dk-rail-msg-meta">
        <span>{isUser ? 'You' : 'AI'}</span>
        {time && <span>{time}</span>}
      </div>
    </div>
  )
}
