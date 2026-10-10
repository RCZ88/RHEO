import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "../lib/cn"
import { MarkdownRenderer } from "./MarkdownRenderer"

export interface TypewriterTextProps {
  text: string
  speed?: number
  onDone?: () => void
  className?: string
}

export function TypewriterText({ text, speed = 90, onDone, className }: TypewriterTextProps) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(reduce ? text.length : 0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const lastRenderRef = useRef(0)

  useEffect(() => {
    if (reduce) {
      setCount(text.length)
      return
    }
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const elapsed = (t - startRef.current) / 1000
      const next = Math.min(text.length, Math.floor(elapsed * speed))
      // Only update state every ~60ms to avoid O(n²) markdown re-parses
      if (next > count && (t - lastRenderRef.current) > 60) {
        lastRenderRef.current = t
        setCount(next)
      }
      if (next < text.length) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!doneRef.current) {
        doneRef.current = true
        setCount(text.length)
        onDone?.()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      startRef.current = null
    }
  }, [text, speed, reduce, onDone])

  const visibleText = text.slice(0, count)
  const isStreaming = count < text.length

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      <MarkdownRenderer content={visibleText} settled={!isStreaming} />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-pink-400 motion-reduce:animate-none" />
      )}
    </span>
  )
}
