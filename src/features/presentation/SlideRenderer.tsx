// SlideRenderer — Canonical renderer using spec.ts types
// Implements all visual primitives, motion, and responsive composition

import React, { useState, useEffect, useId } from 'react'
import { cn } from '@/lib/utils'
import type { SlideSpec, MotionSpec, VisualType, VisualDataMap } from '@/services/presentation/spec'

// ─── Motion ───

function useMotionClasses(motion: MotionSpec, isActive: boolean) {
  if (!isActive) return ''
  const entry = motion.entry === 'blur-fade' ? 'animate-[blurInUp_0.6s_cubic-bezier(.16,1,.3,1)_both]' :
                motion.entry === 'slide-up' ? 'animate-[slideUp_0.4s_cubic-bezier(.16,1,.3,1)_both]' : ''
  return entry
}

// ─── Visual Primitives ───

function HeroNumber({ data }: { data: VisualDataMap['hero-number'] }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!data?.value) return
    const target = Number(data.value) || 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1200, 1)
      setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [data?.value])
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="text-6xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-header)', color: 'var(--accent)' }}>
        {data?.prefix || ''}{display.toLocaleString()}{data?.suffix || ''}
      </div>
      {data?.label && <div className="text-sm" style={{ color: 'var(--muted)' }}>{data.label}</div>}
    </div>
  )
}

function CodeBlock({ data }: { data: VisualDataMap['code-block'] }) {
  const lines = (data?.code || '').split('\n')
  const highlights = new Set(data?.highlightLines || [])
  return (
    <pre className="rounded-xl border p-5 text-sm overflow-x-auto" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
      <code>{lines.map((line: string, i: number) => (
        <div key={i} className={cn(highlights.size > 0 && highlights.has(i + 1) && 'bg-[var(--accent-10)] -mx-5 px-5')}>{line || ' '}</div>
      ))}</code>
      {data?.language && <div className="text-[10px] mt-2 opacity-50">{data.language}</div>}
    </pre>
  )
}

function Diagram({ data }: { data: VisualDataMap['diagram'] }) {
  const nodes = data?.nodes || []
  const edges = data?.edges || []
  const markerId = useId()
  const dir = data?.direction || 'forward'
  return (
    <svg viewBox="0 0 600 400" className="w-full h-auto">
      <defs>
        <marker id={`${markerId}-fwd`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="var(--accent)" />
        </marker>
        <marker id={`${markerId}-bwd`} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto">
          <path d="M6,0 L0,3 L6,6" fill="var(--accent-2)" />
        </marker>
      </defs>
      {edges.map((e: any, i: number) => {
        const from = nodes.find((n: any) => n.id === e.from)
        const to = nodes.find((n: any) => n.id === e.to)
        if (!from || !to) return null
        const isBackward = dir === 'backward' || e.direction === 'backward'
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={e.highlighted ? 'var(--warning)' : isBackward ? 'var(--accent-2)' : 'var(--accent)'}
              strokeWidth={e.highlighted ? 2.5 : 1.5}
              strokeDasharray={isBackward && !e.highlighted ? '4,4' : undefined}
              markerEnd={`url(#${isBackward ? `${markerId}-bwd` : `${markerId}-fwd`})`} />
            {e.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} fill="var(--muted)" fontSize="11" textAnchor="middle">{e.label}</text>}
          </g>
        )
      })}
      {nodes.map((n: any, i: number) => (
        <g key={i}>
          <rect x={n.x - 60} y={n.y - 20} width="120" height="40" rx="10"
            fill={n.highlighted ? 'var(--accent)' : 'var(--surface)'}
            stroke={n.highlighted ? 'var(--accent)' : 'var(--border)'} />
          <text x={n.x} y={n.y + 4} fill={n.highlighted ? 'var(--bg)' : 'var(--fg)'} fontSize="13" textAnchor="middle" fontFamily="var(--font-body)">{n.label}</text>
        </g>
      ))}
    </svg>
  )
}

function Chart({ data }: { data: VisualDataMap['chart'] }) {
  const items = data?.data || []
  const kind = data?.kind || 'bar'
  const maxVal = Math.max(...items.map((d: any) => d.value || 0), 1)
  const color = data?.color || 'var(--accent)'

  if (kind === 'line' || kind === 'area') {
    const points = items.map((d: any, i: number) => {
      const x = (i / Math.max(items.length - 1, 1)) * 100
      const y = 100 - ((d.value || 0) / maxVal) * 100
      return `${x},${y}`
    }).join(' ')
    return (
      <div className="h-48 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {kind === 'area' && <polygon points={`0,100 ${points} 100,100`} fill={color} opacity="0.2" />}
          <polyline points={points} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          {items.map((d: any, i: number) => {
            const x = (i / Math.max(items.length - 1, 1)) * 100
            const y = 100 - ((d.value || 0) / maxVal) * 100
            return <circle key={i} cx={x} cy={y} r="1" fill={color} />
          })}
        </svg>
        <div className="flex justify-between mt-1">{items.map((d: any, i: number) => <span key={i} className="text-[10px]" style={{ color: 'var(--muted)' }}>{d.label}</span>)}</div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 h-48">
      {items.map((d: any, i: number) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${((d.value || 0) / maxVal) * 100}%`, background: color, minHeight: 4 }} />
          <span className="text-xs truncate w-full text-center" style={{ color: 'var(--muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function ProgressRing({ data }: { data: VisualDataMap['progress-ring'] }) {
  const pct = data?.max ? Math.min((data.value / data.max) * 100, 100) : 0
  const circumference = 2 * Math.PI * 52
  const offset = circumference * (1 - pct / 100)
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)' }} />
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fill="var(--fg)" fontSize="20" fontWeight="700">{Math.round(pct)}{data?.suffix || '%'}</text>
      </svg>
      {data?.label && <span className="text-sm" style={{ color: 'var(--muted)' }}>{data.label}</span>}
    </div>
  )
}

function Comparison({ data }: { data: VisualDataMap['comparison'] }) {
  const left = data?.left || { title: '', items: [] }
  const right = data?.right || { title: '', items: [] }
  return (
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      {[left, right].map((side: any, i: number) => (
        <div key={i} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="text-sm font-semibold mb-2" style={{ color: i === 0 ? 'var(--accent)' : 'var(--accent-2)' }}>{side.title}</div>
          {(side.items || []).map((item: string, j: number) => (
            <div key={j} className="text-xs py-1" style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border)' }}>{item}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Timeline({ data }: { data: VisualDataMap['timeline'] }) {
  const events = data?.events || []
  return (
    <div className="flex flex-col gap-4 pl-6" style={{ borderLeft: '2px solid var(--border)' }}>
      {events.map((e: any, i: number) => (
        <div key={i} className="relative">
          <div className="absolute -left-8 top-1 w-3 h-3 rounded-full" style={{ background: 'var(--accent)' }} />
          <div className="text-xs font-mono mb-0.5" style={{ color: 'var(--muted)' }}>{e.time}</div>
          <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{e.title}</div>
          {e.description && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{e.description}</div>}
        </div>
      ))}
    </div>
  )
}

function Quote({ data }: { data: VisualDataMap['quote'] }) {
  return (
    <blockquote className="relative pl-6" style={{ borderLeft: '3px solid var(--accent)' }}>
      <div className="text-xl font-semibold leading-relaxed" style={{ fontFamily: 'var(--font-header)', color: 'var(--fg)' }}>"{data?.text || ''}"</div>
      <cite className="block mt-3 text-sm not-italic" style={{ color: 'var(--muted)' }}>— {data?.author || 'Unknown'}{data?.role ? `, ${data.role}` : ''}</cite>
    </blockquote>
  )
}

function IconGrid({ data }: { data: VisualDataMap['icon-grid'] }) {
  const items = data?.items || []
  const ICONS: Record<string, string> = {
    'check': 'M20 6L9 17l-5-5', 'arrow-right': 'M5 12h14M12 5l7 7-7 7',
    'star': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    'heart': 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    'zap': 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', 'target': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    'globe': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 4.9 17.5M12 4a8 8 0 0 0-4.9 17.5M2 12h20',
    'code': 'M16 18l6-6-6-6M8 6l-6 6 6 6', 'database': 'M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z',
    'layers': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    'play': 'M5 3l14 9-14 9V3z', 'refresh': 'M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15',
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item: any, i: number) => {
        const path = ICONS[item.icon] || ICONS['check']
        return (
          <div key={i} className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <svg className="w-6 h-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={path} />
            </svg>
            <div className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>{item.label}</div>
            {item.description && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.description}</div>}
          </div>
        )
      })}
    </div>
  )
}

function DataTable({ data }: { data: VisualDataMap['data-table'] }) {
  const columns = data?.columns || []
  const rows = data?.rows || []
  return (
    <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
      <thead><tr>{columns.map((c: string, i: number) => (
        <th key={i} className="text-left px-3 py-2 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{c}</th>
      ))}</tr></thead>
      <tbody>{rows.map((row: string[], i: number) => (
        <tr key={i}>{row.map((cell: string, j: number) => (
          <td key={j} className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)', color: 'var(--fg)' }}>{cell}</td>
        ))}</tr>
      ))}</tbody>
    </table>
  )
}

function StepThrough({ data }: { data: VisualDataMap['step-through'] }) {
  const [step, setStep] = useState(0)
  const states = data?.states || []
  const current = states[step] || states[0] || {}
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{current.label || ''}</div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>{current.description || ''}</div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="px-3 py-1 rounded text-xs border disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}>Prev</button>
        <span className="text-xs self-center" style={{ color: 'var(--muted)' }}>{step + 1} / {states.length}</span>
        <button onClick={() => setStep(Math.min(states.length - 1, step + 1))} disabled={step >= states.length - 1} className="px-3 py-1 rounded text-xs border disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}>Next</button>
      </div>
    </div>
  )
}

function InteractiveDemo({ data }: { data: VisualDataMap['interactive-demo'] }) {
  const inputs = data?.inputs || []
  const outputs = data?.outputs || []
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Interactive Demo</div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>{data?.description || ''}</div>
      {inputs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Inputs</div>
          {inputs.map((inp: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg)' }}>
              <span className="w-20 truncate">{inp.label}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'var(--border)', color: 'var(--muted)' }}>{inp.type}</span>
            </div>
          ))}
        </div>
      )}
      {outputs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Outputs</div>
          {outputs.map((out: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg)' }}>
              <span className="w-20 truncate">{out.label}</span>
              {out.formula && <span className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>{out.formula}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Visual Router ───

function VisualRenderer({ type, data }: { type: VisualType; data: any }) {
  switch (type) {
    case 'hero-number': return <HeroNumber data={data} />
    case 'code-block': return <CodeBlock data={data} />
    case 'diagram': return <Diagram data={data} />
    case 'chart': return <Chart data={data} />
    case 'progress-ring': return <ProgressRing data={data} />
    case 'comparison': return <Comparison data={data} />
    case 'timeline': return <Timeline data={data} />
    case 'quote': return <Quote data={data} />
    case 'icon-grid': return <IconGrid data={data} />
    case 'data-table': return <DataTable data={data} />
    case 'step-through': return <StepThrough data={data} />
    case 'interactive-demo': return <InteractiveDemo data={data} />
    case 'none': return null
    default: return <div className="text-xs" style={{ color: 'var(--muted)' }}>Unknown visual: {type}</div>
  }
}

// ─── Responsive Layout ───

function ResponsiveLayout({ slide, content, visual, motionClass }: { slide: SlideSpec; content: React.ReactNode; visual: React.ReactNode; motionClass: string }) {
  // The renderer decides layout based on slide.layout and content density
  // For 9:16 (default container): always vertical stack
  // For 9:8 (wider container): split layouts work
  // The container aspect ratio is controlled by the parent

  const isSplit = slide.layout === 'split-left' || slide.layout === 'split-right'
  if (isSplit) {
    const reversed = slide.layout === 'split-right'
    return (
      <div className={cn('grid gap-6 h-full items-center p-8', reversed ? 'grid-cols-[1fr_1.5fr] max-md:grid-cols-1' : 'grid-cols-[1.5fr_1fr] max-md:grid-cols-1')}>
        {reversed ? <>{visual}{content}</> : <>{content}{visual}</>}
      </div>
    )
  }

  if (slide.visual.type !== 'none' && slide.layout === 'full-bleed') {
    return (
      <div className="relative h-full">
        <div className="absolute inset-0 p-8 flex items-center justify-center">{visual}</div>
        {slide.body && (
          <div className="absolute bottom-6 left-6 right-6 rounded-xl border p-3" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
            <div className="text-xs" style={{ color: 'var(--fg)' }}>{slide.headline}</div>
          </div>
        )}
      </div>
    )
  }

  // minimal / transition / default
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
      {content}
      {visual}
    </div>
  )
}

// ─── Main Renderer ───

export function SlideRenderer({ slide, theme, isActive }: { slide: SlideSpec; theme: any; isActive: boolean }) {
  const motionClass = useMotionClasses(slide.motion, isActive)

  const content = (
    <div className={cn('flex flex-col gap-3', motionClass)}>
      {slide.badge && (
        <span className="self-start px-2 py-0.5 rounded-lg text-xs font-semibold uppercase tracking-wider" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
          {slide.badge}
        </span>
      )}
      <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-header)', color: 'var(--fg)' }}>
        {slide.headline}
      </h2>
      {slide.subheadline && <p className="text-sm" style={{ color: 'var(--muted)' }}>{slide.subheadline}</p>}
      {slide.body && <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>{slide.body}</p>}
      {slide.equation && (
        <div className="rounded-lg px-4 py-2 text-base font-mono" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
          {slide.equation}
        </div>
      )}
      {slide.recap && slide.recap.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {slide.recap.map((r: string, i: number) => (
            <span key={i} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}>{r}</span>
          ))}
        </div>
      )}
    </div>
  )

  const visual = slide.visual.type !== 'none' ? (
    <div className={cn('rounded-xl border p-4 min-h-[200px]', motionClass)} style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <VisualRenderer type={slide.visual.type} data={slide.visual.data} />
    </div>
  ) : null

  return (
    <ResponsiveLayout slide={slide} content={content} visual={visual} motionClass={motionClass} />
  )
}

export default SlideRenderer
