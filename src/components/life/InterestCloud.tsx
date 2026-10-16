import { useMemo } from 'react'

interface InterestCloudProps {
  data: Record<string, { content: string; confidence: number; occurrences: number }>
  accentColor?: string
}

export function InterestCloud({ data, accentColor = 'var(--color-violet-400)' }: InterestCloudProps) {
  const items = useMemo(() => {
    return Object.values(data)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 15)
      .map((item, i, arr) => ({
        ...item,
        size: Math.max(10, 18 - i * 0.8),
        opacity: Math.max(0.4, 1 - i * 0.05),
      }))
  }, [data])

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center">
      {items.map((item, i) => (
        <span
          key={i}
          className="px-2.5 py-1 rounded-lg transition-all cursor-default"
          style={{
            fontSize: `${item.size}px`,
            fontWeight: item.confidence > 0.6 ? 600 : 400,
            color: accentColor,
            opacity: item.opacity,
            background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
          }}
          title={`${item.content} (${Math.round(item.confidence * 100)}% confidence, ${item.occurrences}x)`}
        >
          {item.content}
        </span>
      ))}
    </div>
  )
}
