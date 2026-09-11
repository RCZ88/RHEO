import type { DynamicUIComponent, DynamicComponentData } from '../../../types/dynamicUI'
import { ACCENT, TEXT } from '../../tokens'
import { cn } from '../../lib/cn'
import { motion } from 'framer-motion'
import { cardEnterVariants } from '../../lib/motion'
import { X, Sparkles } from 'lucide-react'

interface DynamicCardRendererProps {
  component: DynamicUIComponent
  onDismiss?: (id: string) => void
  onAction?: (id: string, actionId: string) => void
  isBuilding?: boolean
}

export function DynamicCardRenderer({ component, onDismiss, onAction, isBuilding }: DynamicCardRendererProps) {
  const accent = ACCENT[component.accent] || ACCENT.violet

  return (
    <motion.div
      variants={cardEnterVariants}
      initial="hidden" animate="show" exit="exit"
      className="relative h-full flex flex-col bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl overflow-hidden light:bg-[var(--color-card)] light:border-[var(--ws-border)]"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accent.hex }} />
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 light:border-[var(--ws-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={12} style={{ color: accent.hex }} />
          <span className="text-xs font-semibold text-white truncate light:text-stone-900">{component.title}</span>
          {component.subtitle && <span className="text-[10px] text-zinc-500 truncate light:text-stone-500">{component.subtitle}</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">AI</span>
          {onDismiss && (
            <button onClick={() => onDismiss(component.id)} className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors light:hover:bg-stone-100">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <DataRenderer data={component.data} accent={accent.hex} />
      </div>
      {component.actions && component.actions.length > 0 && (
        <div className="flex gap-2 px-4 py-2 border-t border-zinc-800/50 light:border-[var(--ws-border)]">
          {component.actions.map(a => (
            <button key={a.id} onClick={() => onAction?.(component.id, a.id)}
              className={cn('text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors',
                a.variant === 'primary' ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30' :
                a.variant === 'danger' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' :
                'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white light:bg-stone-100 light:text-stone-600 light:hover:bg-stone-200/70'
              )}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function DataRenderer({ data, accent }: { data: DynamicComponentData; accent: string }) {
  switch (data.kind) {
    case 'card':
      return (
        <div className="space-y-2">
          <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed light:text-stone-700">{data.body}</p>
          {data.footer && <p className="text-[10px] text-zinc-500 light:text-stone-500">{data.footer}</p>}
          {data.badge && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full" style={{ background: data.badge.color + '20', color: data.badge.color }}>
              {data.badge.label}
            </span>
          )}
        </div>
      )
    case 'stat':
      return (
        <div className="space-y-1">
          <div className="text-2xl font-bold tabular-nums" style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}>
            {data.format === 'currency' ? `$${data.value.toLocaleString()}` : data.format === 'percent' ? `${data.value}%` : data.value.toLocaleString()}
          </div>
          {data.trend && (
            <div className={cn('text-[10px] font-medium', data.trend.direction === 'up' ? 'text-emerald-400' : data.trend.direction === 'down' ? 'text-red-400' : 'text-zinc-500 light:text-stone-500')}>
              {data.trend.direction === 'up' ? '↑' : data.trend.direction === 'down' ? '↓' : '→'} {data.trend.delta}
            </div>
          )}
          {data.sparkline && <MiniSparkline values={data.sparkline} color={accent} />}
        </div>
      )
    case 'list':
      return (
        <div className="space-y-1.5">
          {data.items.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              <span className={cn('w-1.5 h-1.5 rounded-full', item.done ? 'bg-emerald-400' : 'bg-zinc-600 light:bg-stone-300')} />
              <span className="text-zinc-300 flex-1 light:text-stone-700">{item.label}</span>
              {item.meta && <span className="text-zinc-500 text-[10px] light:text-stone-500">{item.meta}</span>}
            </div>
          ))}
        </div>
      )
    case 'chart':
      return <ChartRenderer data={data} accent={accent} />
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-zinc-800 light:border-[var(--ws-border)]">
              {data.columns.map(col => <th key={col.key} className="text-left text-zinc-500 font-medium py-1 px-2 light:text-stone-500">{col.label}</th>)}
            </tr></thead>
            <tbody>{data.rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-800/50 light:border-[var(--ws-border)]">
                {data.columns.map(col => <td key={col.key} className="text-zinc-300 py-1 px-2 light:text-stone-700">{row[col.key]}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )
    case 'timeline':
      return (
        <div className="space-y-2">
          {data.events.map(ev => (
            <div key={ev.id} className="flex items-start gap-2">
              <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0',
                ev.status === 'done' ? 'bg-emerald-400' : ev.status === 'active' ? 'bg-violet-400' : 'bg-zinc-600 light:bg-stone-300')} />
              <div>
                <div className="text-xs text-zinc-300 light:text-stone-700">{ev.label}</div>
                <div className="text-[10px] text-zinc-500 light:text-stone-500">{ev.time}</div>
              </div>
            </div>
          ))}
        </div>
      )
    case 'form':
      return (
        <div className="space-y-3">
          {data.fields.map(f => (
            <div key={f.name}>
              <label className="text-[10px] text-zinc-500 mb-1 block light:text-stone-500">{f.label}</label>
              <div className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800 light:bg-[var(--ws-surface-sunken)] light:text-stone-600 light:border-[var(--ws-border)]">
                {f.placeholder || '—'}
              </div>
            </div>
          ))}
        </div>
      )
    default:
      return <div className="text-[10px] text-zinc-500 light:text-stone-500">Unknown component type</div>
  }
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 80
  const h = 20
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartRenderer({ data, accent }: { data: import('../../../types/dynamicUI').ChartData; accent: string }) {
  const maxVal = Math.max(...data.series.flatMap(s => s.values), 1)
  const barW = 24
  const gap = 8
  const h = 80
  const totalBars = data.series[0]?.values.length || 0
  const w = totalBars * (barW + gap)

  return (
    <svg width={Math.min(w, 300)} height={h + 20} className="w-full">
      {data.series[0]?.values.map((val, i) => {
        const barH = (val / maxVal) * h
        const x = i * (barW + gap)
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={3} fill={data.series[0]?.color || accent} opacity={0.8} />
            {data.xLabels?.[i] && <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={8} fill="#71717a">{data.xLabels[i]}</text>}
          </g>
        )
      })}
    </svg>
  )
}
