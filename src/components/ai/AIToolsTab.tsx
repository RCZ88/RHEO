import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Code2,
  Sparkles,
  RefreshCw,
  Clock,
  Download,
  Lock,
  Unlock,
  TrendingUp,
  Activity,
  BarChart3,
  Layers,
  X,
  ChevronDown,
  FolderOpen,
  Hash,
  Coins,
  Loader2,
  Monitor,
  CalendarDays,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { format, subDays, eachDayOfInterval, formatDistanceToNow, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { GlassCard } from '../GlassCard'
import { SectionHeader } from '../SectionHeader'
import { StatsDashboard } from '../stats/StatsDashboard'
import { AISessionHistory } from './AISessionHistory'
import { WordTrackerPanel } from './WordTrackerPanel'
import { MOTION, SURFACE, RING, TEXT } from './tokens'
import { cn } from './lib/cn'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)

// beautiful-charts: neon palette + glassmorphic tooltip defaults
ChartJS.defaults.font.family = "Space Grotesk, sans-serif"
ChartJS.defaults.font.size = 10
ChartJS.defaults.color = "#71717a"
const NEON_CHART_COLORS = { lime: "#00FF66", cyan: "#00F0FF", magenta: "#FF007A", crimson: "#FF2A4B" }
const glassTooltip = {
  backgroundColor: "rgba(20, 22, 30, 0.75)",
  titleColor: "#FFFFFF",
  bodyColor: "#8E95A5",
  borderColor: "rgba(255, 255, 255, 0.12)",
  borderWidth: 1,
  cornerRadius: 8,
  padding: { top: 10, bottom: 10, left: 14, right: 14 },
  usePointStyle: true,
  backdropFilter: "blur(16px)",
}

// ai_usage can contain corrupt timestamps (e.g. a codex parser bug once wrote
// dates like '+058462-06-04', year 58462). isNaN alone is NOT enough — those
// strings parse as valid extended-ISO dates. Guard all date math with isSaneDay.
const isSaneDay = (t: number): boolean => {
  if (!isFinite(t) || isNaN(t)) return false
  const y = new Date(t).getFullYear()
  return y >= 2000 && y <= new Date().getFullYear() + 1
}

const AIUsageCityscape = lazy(() =>
  import('../AICityscape').then((m) => ({ default: m.default }))
)

// ─── Types ──────────────────────────────────────────────────────────────────

interface Overview {
  ides: any[]
  tools: any[]
  projects: any[]
  aiUsage: {
    totalTokens: number
    totalCost: number
    totalMessages?: number
    byTool: Record<string, any>
  }
  commits: {
    totalCommits: number
    totalAdditions: number
    totalDeletions: number
  }
}

interface AIAgent {
  id: string
  name: string
  icon: string
  color: string
  tokens: number
  tokensIn: number
  tokensOut: number
  cost: number
  sessions: number
  messageCount: number
  status: 'active' | 'idle' | 'inactive' | 'error'
  lastUsed?: Date
  models: string[]
}

interface AIToolsTabProps {
  overview: Overview | null
  workspaceAnalytics: {
    aiUsage: any
    sessions: any[]
    problems: any[]
    requests: any[]
    promptHistory: any[]
  } | null
  analyticsLoading: boolean
  analyticsError: string | null
  onRetryAnalytics: () => void
  selectedPeriod: string
  onDataRefresh: () => Promise<void>
  timeLock: boolean
  onToggleTimeLock: () => void
}

// ─── Config ─────────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<
  string,
  { name: string; icon: string; color: string }
> = {
  'claude-code': { name: 'Claude Code', icon: 'claude', color: '#f97316' },
  cursor: { name: 'Cursor AI', icon: 'cursor', color: '#a855f7' },
  opencode: { name: 'OpenCode', icon: 'opencode', color: '#3b82f6' },
  gemini: { name: 'Gemini CLI', icon: 'gemini', color: '#22c55e' },
  codex: { name: 'Codex CLI', icon: 'codex', color: '#10b981' },
  qwen: { name: 'Qwen CLI', icon: 'qwen', color: '#f59e0b' },
  aider: { name: 'Aider', icon: 'aider', color: '#f59e0b' },
  kilocode: { name: 'KiloCode', icon: 'kilocode', color: '#22c55e' },
  hermes: { name: 'Hermes', icon: 'hermes', color: '#8b5cf6' },
}

const MODEL_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
]

function getAgentColor(agentId: string): string {
  try {
    const saved = localStorage.getItem('deskflow-agent-colors')
    if (saved) {
      const overrides = JSON.parse(saved)
      if (overrides[agentId]) return overrides[agentId]
    }
  } catch {}
  return AGENT_CONFIG[agentId]?.color || '#6366f1'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1e15) return `${(tokens / 1e15).toFixed(1)}Qi`
  if (tokens >= 1e12) return `${(tokens / 1e12).toFixed(1)}T`
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)}B`
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`
  return tokens.toString()
}

function formatCurrency(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`
  if (amount >= 1) return `$${amount.toFixed(2)}`
  return `$${amount.toFixed(4)}`
}

function TokenValue({ value }: { value: number }) {
  const [showFull, setShowFull] = useState(false)
  return (
    <span
      className="inline-flex flex-col items-center leading-tight cursor-pointer"
      onClick={() => setShowFull(!showFull)}
      title={showFull ? 'Click for abbreviated' : 'Click for full number'}
    >
      {showFull ? (
        <span className="text-[10px] text-zinc-400 font-normal">
          {value.toLocaleString()}
        </span>
      ) : (
        <span>{formatTokens(value)}</span>
      )}
      {value > 0 && (
        <span className="text-[9px] text-zinc-600 font-normal opacity-50 hover:opacity-100 transition-opacity">
          {showFull ? 'abbreviated' : 'full'}
        </span>
      )}
    </span>
  )
}

function CostValue({ value }: { value: number }) {
  const [showFull, setShowFull] = useState(false)
  return (
    <span
      className="inline-flex flex-col items-center leading-tight cursor-pointer"
      onClick={() => setShowFull(!showFull)}
      title={showFull ? 'Click for abbreviated' : 'Click for full amount'}
    >
      {showFull ? (
        <span className="text-[10px] text-zinc-400 font-normal">
          ${value.toFixed(value >= 1 ? 2 : 4)}
        </span>
      ) : (
        <span>{formatCurrency(value)}</span>
      )}
      {value > 0 && (
        <span className="text-[9px] text-zinc-600 font-normal opacity-50 hover:opacity-100 transition-opacity">
          {showFull ? 'abbreviated' : 'full'}
        </span>
      )}
    </span>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIToolsTab({
  overview,
  workspaceAnalytics,
  analyticsLoading,
  analyticsError,
  onRetryAnalytics,
  selectedPeriod,
  onDataRefresh,
  timeLock,
  onToggleTimeLock,
}: AIToolsTabProps) {
  // ── Sync state ──
  const [syncingAI, setSyncingAI] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)
  const [aiSyncResult, setAiSyncResult] = useState<{
    success: boolean
    agents: Record<string, number>
  } | null>(null)
  const [aiLastSyncAt, setAiLastSyncAt] = useState<string | null>(null)
  const progressThrottleRef = useRef(0)

  // ── Tool selection state ──
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedAgentDetail, setSelectedAgentDetail] =
    useState<AIAgent | null>(null)
  const [showAgentDebug, setShowAgentDebug] = useState(false)
  const [agentDebugInfo, setAgentDebugInfo] = useState<any>(null)

  // ── Chart state ──
  const [aiChartMode, setAiChartMode] = useState<
    'tokens' | 'messages' | 'cost' | 'sessions'
  >('tokens')
  const [tokenDisplayMode, setTokenDisplayMode] = useState<
    'combined' | 'input' | 'output'
  >('combined')
  const [compareAgents, setCompareAgents] = useState<string[]>([])
  const [logScale, setLogScale] = useState(
    () => localStorage.getItem('ide-projects-log-scale') === 'true'
  )
  const [excludeOutliers, setExcludeOutliers] = useState(
    () => localStorage.getItem('ide-projects-exclude-outliers') === 'true'
  )
  const [showCityView, setShowCityView] = useState(false)
  const [viewMode, setViewMode] = useState<'tool' | 'model'>('tool')
  const [topViewMode, setTopViewMode] = useState<'tools' | 'models'>('tools')
  const [showDataOnly, setShowDataOnly] = useState(false)
  const [heatmapToolFilter, setToolFilter] = useState<string>('all')

  // ── Chart type toggle (line vs bar) ──
  const [chartType, setChartType] = useState<'line' | 'bar'>(() => {
    try { return (localStorage.getItem('ide-ai-chart-type') as 'line' | 'bar') || 'line' }
    catch { return 'line' }
  })

  // ── Model selection for timeline filtering ──
  const [selectedTimelineModels, setSelectedTimelineModels] = useState<string[]>([])

  // ── Popup-internal period override ──
  const [modalPeriod, setModalPeriod] = useState<'week' | 'month' | 'all'>('week')

  // ── Popup-internal model filter ──
  const [modalSelectedModels, setModalSelectedModels] = useState<string[]>([])

  // ── Session history tool selection ──
  const [sessionTool, setSessionTool] = useState<string | null>(null)

  // ── Detail view mode (popup modal vs inline dropdown) ──
  const [detailViewMode, setDetailViewMode] = useState<'popup' | 'dropdown'>(() => {
    try {
      return (localStorage.getItem('ide-projects-detail-view') as 'popup' | 'dropdown') || 'popup'
    } catch { return 'popup' }
  })

  // ── Language distribution + response time data ──
  const [usageDetails, setUsageDetails] = useState<{
    languageDistribution: Record<string, { count: number; tokens: number }>
    avgResponseTime: number
    responseTimeByDay: Record<string, number>
  } | null>(null)

  // ── Derived period ──
  const effectiveAiPeriod = useMemo<'week' | 'month' | 'all'>(() => {
    if (timeLock) return 'all'
    switch (selectedPeriod) {
      case 'all':
        return 'all'
      case 'month':
      case '30day':
        return 'month'
      case '7day':
        return 'week'
      default:
        return 'week'
    }
  }, [selectedPeriod, timeLock])

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const details = await window.deskflowAPI?.getAIUsageDetails(effectiveAiPeriod === 'all' ? 'all' : effectiveAiPeriod === 'week' ? 'week' : 'month')
        if (details) setUsageDetails(details)
      } catch {}
    }
    fetchDetails()
  }, [effectiveAiPeriod])

  // ── AI agents computation ──
  const aiAgentsRef = useRef<AIAgent[]>([])
  const aiAgentsFingerprintRef = useRef('')
  const aiAgents = useMemo((): AIAgent[] => {
    const agents: AIAgent[] = []
    const wsByTool = workspaceAnalytics?.aiUsage?.byTool
    const ovByTool = overview?.aiUsage?.byTool
    const byTool =
      wsByTool && Object.keys(wsByTool).length > 0 ? wsByTool : ovByTool || {}

    for (const [agentId, data] of Object.entries(byTool)) {
      const config = AGENT_CONFIG[agentId] || {
        name: agentId,
        icon: agentId,
        color: '#6366f1',
      }
      agents.push({
        id: agentId,
        name: config.name,
        icon: config.icon,
        color: getAgentColor(agentId),
        tokens: (data as any).tokens || 0,
        tokensIn: (data as any).tokens_in || 0,
        tokensOut: (data as any).tokens_out || 0,
        cost: (data as any).cost || 0,
        sessions: (data as any).sessions || 0,
        messageCount: (data as any).messageCount || 0,
        status: (data as any).lastUsed ? 'active' : 'idle',
        lastUsed: (data as any).lastUsed
          ? new Date((data as any).lastUsed)
          : undefined,
        models: (data as any).models || [],
      })
    }

    for (const [agentId, config] of Object.entries(AGENT_CONFIG)) {
      if (!byTool[agentId]) {
        agents.push({
          id: agentId,
          name: config.name,
          icon: config.icon,
          color: getAgentColor(agentId),
          tokens: 0,
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          sessions: 0,
          messageCount: 0,
          status: 'inactive',
          models: [],
        })
      }
    }

    const fp = agents
      .map(
        (a) =>
          `${a.id}:${a.tokens}:${a.sessions}:${a.cost}:${a.messageCount}:${a.status}`
      )
      .join('|')
    if (fp === aiAgentsFingerprintRef.current) return aiAgentsRef.current
    aiAgentsFingerprintRef.current = fp
    aiAgentsRef.current = agents
    return agents
  }, [workspaceAnalytics?.aiUsage?.byTool, overview?.aiUsage?.byTool])

  const activeToolIds = useMemo(
    () => aiAgents.filter((a) => a.status !== 'inactive').map((a) => a.id),
    [aiAgents]
  )

  // Set default session tool
  useEffect(() => {
    if (activeToolIds.length > 0 && !sessionTool) {
      setSessionTool(activeToolIds[0])
    }
  }, [activeToolIds, sessionTool])

  const displayedAgents = useMemo(() => {
    if (viewMode === 'tool') return aiAgents
    const byTool = overview?.aiUsage?.byTool || {}
    const modelMap: Record<
      string,
      {
        tokens: number
        tokensIn: number
        tokensOut: number
        cost: number
        sessions: number
        messageCount: number
        agents: string[]
        lastUsed?: number
      }
    > = {}
    for (const [agentId, data] of Object.entries(byTool)) {
      const modelDaily = (data as any).modelDaily || {}
      for (const [modelName, dayRecords] of Object.entries(modelDaily)) {
        if (!modelMap[modelName])
          modelMap[modelName] = {
            tokens: 0,
            tokensIn: 0,
            tokensOut: 0,
            cost: 0,
            sessions: 0,
            messageCount: 0,
            agents: [],
            lastUsed: 0,
          }
        const entry = modelMap[modelName]
        for (const [dayStr, dayData] of Object.entries(
          dayRecords as Record<string, any>
        )) {
          entry.tokens += dayData.tokens || 0
          entry.tokensIn += dayData.tokens_in || 0
          entry.tokensOut += dayData.tokens_out || 0
          entry.cost += dayData.cost || 0
          entry.sessions += dayData.sessions || 0
          entry.messageCount += dayData.messageCount || 0
          const t = new Date(dayStr).getTime()
          if (isSaneDay(t) && t > entry.lastUsed!) entry.lastUsed = t
        }
        if (!entry.agents.includes(agentId)) entry.agents.push(agentId)
      }
    }
    const models = Object.entries(modelMap).sort(
      (a, b) => b[1].tokens - a[1].tokens
    )
    const modelAgents: AIAgent[] = models.map(([modelName, md], idx) => ({
      id: `model-${modelName}`,
      name:
        modelName.length > 28 ? modelName.slice(0, 25) + '...' : modelName,
      icon: 'model',
      color: MODEL_COLORS[idx % MODEL_COLORS.length],
      tokens: md.tokens,
      tokensIn: md.tokensIn,
      tokensOut: md.tokensOut,
      cost: md.cost,
      sessions: md.sessions,
      messageCount: md.messageCount,
      status: md.tokens > 0 ? 'active' : 'idle',
      lastUsed: md.lastUsed ? new Date(md.lastUsed) : undefined,
      models: [modelName],
    }))
    if (modelAgents.length === 0) return aiAgents
    return modelAgents
  }, [viewMode, aiAgents, overview?.aiUsage?.byTool])

  const allModelData = useMemo(() => {
    const ovByTool = overview?.aiUsage?.byTool || {}
    const modelMap: Record<
      string,
      {
        tokens: number
        tokensIn: number
        tokensOut: number
        cost: number
        sessions: number
        messageCount: number
        agents: string[]
        lastUsed?: number
      }
    > = {}
    for (const [agentId, data] of Object.entries(ovByTool)) {
      const modelDaily = (data as any).modelDaily || {}
      for (const [modelName, dayRecords] of Object.entries(modelDaily)) {
        if (!modelMap[modelName])
          modelMap[modelName] = {
            tokens: 0,
            tokensIn: 0,
            tokensOut: 0,
            cost: 0,
            sessions: 0,
            messageCount: 0,
            agents: [],
            lastUsed: 0,
          }
        const entry = modelMap[modelName]
        for (const [dayStr, dayData] of Object.entries(
          dayRecords as Record<string, any>
        )) {
          entry.tokens += dayData.tokens || 0
          entry.tokensIn += dayData.tokens_in || 0
          entry.tokensOut += dayData.tokens_out || 0
          entry.cost += dayData.cost || 0
          entry.sessions += dayData.sessions || 0
          entry.messageCount += dayData.messageCount || 0
          const t = new Date(dayStr).getTime()
          if (isSaneDay(t) && t > entry.lastUsed!) entry.lastUsed = t
        }
        if (!entry.agents.includes(agentId)) entry.agents.push(agentId)
      }
    }
    return Object.entries(modelMap).sort((a, b) => b[1].tokens - a[1].tokens)
  }, [overview?.aiUsage?.byTool])

  const providerModelData = useMemo(() => {
    const ovByTool = overview?.aiUsage?.byTool || {}
    const result: Record<
      string,
      { models: { name: string; tokens: number }[]; totalTokens: number }
    > = {}
    for (const agent of aiAgents.filter((a) => a.status !== 'inactive')) {
      const toolData = ovByTool[agent.id]
      const modelBreakdown = (toolData as any)?.modelBreakdown || []
      const models = modelBreakdown
        .map((m: any) => ({
          name: m.model,
          tokens: m.tokens || 0,
        }))
        .sort((a: any, b: any) => b.tokens - a.tokens)
      result[agent.id] = { models, totalTokens: agent.tokens }
    }
    return result
  }, [aiAgents, overview?.aiUsage?.byTool])

  useEffect(() => {
    const activeIds = aiAgents
      .filter((a) => a.status !== 'inactive')
      .map((a) => a.id)
    if (compareAgents.length === 0 && activeIds.length > 0) {
      setCompareAgents(activeIds)
    }
  }, [aiAgents])

  // Sync compareAgents when viewMode changes (tool IDs ≠ model IDs)
  useEffect(() => {
    const activeIds = displayedAgents
      .filter((a) => a.status !== 'inactive' && a.tokens > 0)
      .map((a) => a.id)
    if (activeIds.length > 0) {
      setCompareAgents(activeIds)
    }
  }, [viewMode])

  function filterOutlierValues(
    values: number[],
    stddevMultiplier = 3
  ): number[] {
    if (!excludeOutliers || values.length < 3) return values
    const nonZero = values.filter((v) => v > 0)
    if (nonZero.length < 2) return values
    const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length
    const variance =
      nonZero.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nonZero.length
    const stddev = Math.sqrt(variance)
    const threshold = mean + stddevMultiplier * stddev
    return values.map((v) => (v > threshold ? 0 : v))
  }

  const agentChartsData = useMemo(() => {
    const daysMap: Record<string, number> = { week: 7, month: 30, all: 90 }
    const numDays =
      effectiveAiPeriod === 'all'
        ? (() => {
            const byTool = overview?.aiUsage?.byTool || {}
            let minDate = Infinity
            let maxDate = -Infinity
            for (const tool of Object.values(byTool) as any[]) {
              const daily = tool?.daily
              if (!daily) continue
              for (const d of Object.keys(daily)) {
                const t = new Date(d).getTime()
                if (isSaneDay(t)) {
                  if (t < minDate) minDate = t
                  if (t > maxDate) maxDate = t
                }
              }
            }
            if (maxDate > 0 && minDate < Infinity) {
              return Math.min(
                365,
                Math.max(
                  7,
                  Math.ceil((maxDate - minDate) / 86400000) + 14
                )
              )
            }
            return 60
          })()
        : daysMap[effectiveAiPeriod] || 7

    const startDate = effectiveAiPeriod === 'all'
      ? (() => {
          const byTool = overview?.aiUsage?.byTool || {}
          let minDate = Infinity
          for (const tool of Object.values(byTool) as any[]) {
            const daily = tool?.daily
            if (!daily) continue
            for (const d of Object.keys(daily)) {
              const t = new Date(d).getTime()
              if (isSaneDay(t) && t < minDate) minDate = t
            }
          }
          if (minDate < Infinity) {
            return subDays(new Date(minDate), 3)
          }
          return subDays(new Date(), numDays - 1)
        })()
      : subDays(new Date(), numDays - 1)

    const lastDays = eachDayOfInterval({
      start: startDate,
      end: new Date(),
    })

    const activeAgents = displayedAgents.filter(
      (a) => a.status !== 'inactive' && a.tokens > 0
    )

    const getMetricValue = (agent: AIAgent, dayStr: string) => {
      if (viewMode === 'model') {
        const byTool = overview?.aiUsage?.byTool || {}
        const modelName = agent.models[0]
        if (!modelName) return 0
        let total = 0
        for (const tool of Object.values(byTool) as any[]) {
          const dayData = tool?.modelDaily?.[modelName]?.[dayStr]
          if (!dayData) continue
          if (aiChartMode === 'tokens') {
            if (tokenDisplayMode === 'input') total += dayData.tokens_in || 0
            else if (tokenDisplayMode === 'output')
              total += dayData.tokens_out || 0
            else total += dayData.tokens || 0
          } else if (aiChartMode === 'messages')
            total += dayData.messageCount || 0
          else if (aiChartMode === 'sessions') total += dayData.sessions || 0
          else if (aiChartMode === 'cost') total += dayData.cost || 0
        }
        return total
      }
      const dayData = overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr]
      if (!dayData) return 0
      if (aiChartMode === 'tokens') {
        if (tokenDisplayMode === 'input') return dayData.tokens_in || 0
        if (tokenDisplayMode === 'output') return dayData.tokens_out || 0
        return dayData.tokens || 0
      }
      if (aiChartMode === 'messages') return dayData.messageCount || 0
      if (aiChartMode === 'sessions') return dayData.sessions || 0
      if (aiChartMode === 'cost') return dayData.cost || 0
      return 0
    }

    const metricLabel =
      aiChartMode === 'tokens'
        ? tokenDisplayMode === 'input'
          ? 'Input Tokens'
          : tokenDisplayMode === 'output'
            ? 'Output Tokens'
            : 'Tokens'
        : aiChartMode === 'messages'
          ? 'Messages'
          : aiChartMode === 'sessions'
            ? 'Sessions'
            : 'Cost'

    const dayLabels = lastDays.map((d) => format(d, numDays <= 14 ? 'MMM dd' : 'MMM dd'))
    const dayStrs = lastDays.map((d) => format(d, 'yyyy-MM-dd'))

    // In data-only mode, find which days have ANY data across all agents
    const daysWithData = new Set<number>()
    if (showDataOnly) {
      for (const agent of activeAgents) {
        for (let i = 0; i < dayStrs.length; i++) {
          const val = getMetricValue(agent, dayStrs[i])
          if (val > 0) daysWithData.add(i)
        }
      }
    }

    return activeAgents.map((agent) => {
      const rawData = lastDays.map((_, i) => getMetricValue(agent, dayStrs[i]))
      let data = excludeOutliers ? filterOutlierValues(rawData) : rawData
      // Always map zeros to null so line breaks at gaps
      const pointData = data.map((v) => (v === 0 ? null : v)) as (number | null)[]
      if (logScale) {
        data = data.map((v) => (v === 0 ? null : v)) as number[]
      }

      // In data-only mode, filter to only days with data
      let filteredLabels = dayLabels
      let filteredData = logScale ? data : pointData
      if (showDataOnly && daysWithData.size > 0) {
        const indices = Array.from(daysWithData).sort((a, b) => a - b)
        filteredLabels = indices.map(i => dayLabels[i])
        filteredData = indices.map(i => (logScale ? data : pointData)[i]) as (number | null)[]
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        color: agent.color,
        metricLabel,
        chartData: {
          labels: filteredLabels,
          datasets: [
            {
              label: `${agent.name} - ${metricLabel}`,
              data: filteredData,
              backgroundColor: (ctx: any) => {
                const chart = ctx.chart
                const { ctx: canvasCtx, chartArea } = chart
                if (!chartArea) return agent.color + '25'
                const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                g.addColorStop(0, agent.color + '45')
                g.addColorStop(0.4, agent.color + '18')
                g.addColorStop(0.8, agent.color + '05')
                g.addColorStop(1, agent.color + '00')
                return g
              },
              borderColor: agent.color,
              borderWidth: 2.5,
              pointRadius: (ctx: any) => {
                const val = ctx.raw
                return val !== null && val !== 0 ? 5 : 0
              },
              pointBackgroundColor: '#FFFFFF',
              pointBorderColor: agent.color,
              pointBorderWidth: 2.5,
              pointHoverRadius: 8,
              pointHoverBackgroundColor: '#FFFFFF',
              pointHoverBorderColor: agent.color,
              pointHoverBorderWidth: 3,
              pointStyle: 'circle' as const,
              fill: true,
              tension: 0.4,
              spanGaps: false,
            },
          ],
        },
      }
    })
  }, [
    displayedAgents,
    overview?.aiUsage?.byTool,
    effectiveAiPeriod,
    aiChartMode,
    tokenDisplayMode,
    logScale,
    excludeOutliers,
    viewMode,
    showDataOnly,
  ])

  const agentDistributionData = useMemo(() => {
    const activeAgents = displayedAgents.filter(
      (a) => a.status !== 'inactive'
    )
    const getAgentDisplayName = (id: string) => {
      if (id.startsWith('model-')) return id.slice(6)
      return AGENT_CONFIG[id]?.name || id
    }
    const getValue = (agent: AIAgent) => {
      if (aiChartMode === 'tokens') {
        if (tokenDisplayMode === 'input') return agent.tokensIn
        if (tokenDisplayMode === 'output') return agent.tokensOut
        return agent.tokens
      }
      if (aiChartMode === 'cost') return agent.cost
      if (aiChartMode === 'messages') return agent.messageCount
      return agent.sessions
    }
    const getLabel = (agent: AIAgent) => {
      const displayName = getAgentDisplayName(agent.id)
      if (aiChartMode === 'tokens') {
        const val =
          tokenDisplayMode === 'input'
            ? agent.tokensIn
            : tokenDisplayMode === 'output'
              ? agent.tokensOut
              : agent.tokens
        return `${displayName}: ${formatTokens(val)}`
      }
      if (aiChartMode === 'cost')
        return `${displayName}: ${formatCurrency(agent.cost)}`
      if (aiChartMode === 'messages')
        return `${displayName}: ${agent.messageCount} msgs`
      return `${displayName}: ${agent.sessions} sessions`
    }
    activeAgents.sort((a, b) => getValue(b) - getValue(a))
    return {
      labels: activeAgents.map((a) => getLabel(a)),
      datasets: [
        {
          data: activeAgents.map((a) => getValue(a)),
          backgroundColor: activeAgents.map((a) => a.color),
          borderColor: '#0a0a0a',
          borderWidth: 2,
        },
      ],
    }
  }, [displayedAgents, aiChartMode, tokenDisplayMode])

  // ── Handlers ──
  const handleSyncAI = async () => {
    setSyncingAI(true)
    setSyncProgress('Starting AI sync...')
    setAiSyncResult(null)
    let cleanup: (() => void) | undefined
    try {
      cleanup = window.deskflowAPI!.onAISyncProgress((data: any) => {
        const now = Date.now()
        if (now - progressThrottleRef.current < 100) return
        progressThrottleRef.current = now
        if (data.status === 'detecting') {
          setSyncProgress(`Detecting ${data.name}...`)
        } else if (data.status === 'parsing') {
          setSyncProgress(`Parsing ${data.name} data...`)
        } else if (data.status === 'saving') {
          setSyncProgress(
            `Saving ${data.count} sessions from ${data.name}...`
          )
        }
      })
      const result = (await window.deskflowAPI!.syncAIUsage()) as any
      if (result.success) {
        const agents: Record<string, number> = {}
        for (const [key, value] of Object.entries(result)) {
          if (key !== 'success' && typeof value === 'number') {
            agents[key] = value
          }
        }
        setAiSyncResult({ success: true, agents })
        setSyncProgress('Refreshing data...')
        await onDataRefresh()
        const status = await window.deskflowAPI?.getAISyncStatus()
        if (status?.lastRunAt) {
          setAiLastSyncAt(status.lastRunAt)
        }
      } else {
        setAiSyncResult({ success: false, agents: {} })
      }
    } catch (err) {
      console.error('AI sync failed:', err)
    } finally {
      if (cleanup) cleanup()
      setSyncingAI(false)
      setSyncProgress(null)
    }
  }

  const handleForceResyncAI = async () => {
    setSyncingAI(true)
    setSyncProgress('Clearing cache...')
    try {
      await window.deskflowAPI!.clearAISyncState()
      await handleSyncAI()
    } catch (e) {
      console.error('Force resync failed:', e)
      setSyncProgress('Force resync failed')
      setSyncingAI(false)
    }
  }

  const handleDebugAgents = async () => {
    setShowAgentDebug(true)
    try {
      const info = (await window.deskflowAPI!.debugAIAgents()) as any
      setAgentDebugInfo(info)
    } catch (err) {
      console.error('Debug failed:', err)
    }
  }

  const activeCount = aiAgents.filter((a) => a.status !== 'inactive').length

  return (
    <div data-section="ide.ai-tools" className="space-y-5">
      {/* ── Summary Bar ── */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-100">
                AI Tools
              </h2>
              <p className="text-[11px] text-zinc-500">
                {activeCount} active tool{activeCount !== 1 ? 's' : ''} detected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAI}
              disabled={syncingAI}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-200 rounded-lg text-xs ring-1 ring-zinc-700/60 disabled:opacity-50 transition-colors duration-150"
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${syncingAI ? 'animate-spin' : ''}`}
              />
              {syncingAI ? syncProgress || 'Syncing...' : 'Sync AI'}
            </button>
            <button
              onClick={handleForceResyncAI}
              disabled={syncingAI}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-lg ring-1 ring-red-500/20 disabled:opacity-50 transition-colors duration-150"
            >
              <RefreshCw className="w-3 h-3" />
              Force Resync
            </button>
            <div className="w-px h-5 bg-zinc-700/60" />
            <button
              onClick={onToggleTimeLock}
              className={cn(
                'flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors duration-150 ring-1',
                timeLock
                  ? 'bg-indigo-500/15 ring-indigo-500/30 text-indigo-300'
                  : 'text-zinc-500 bg-zinc-800/50 hover:text-zinc-200 ring-zinc-700/40'
              )}
            >
              {timeLock ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
              {timeLock ? 'All Time' : 'Lock'}
            </button>
            <div className="w-px h-5 bg-zinc-700/60" />
            <button
              onClick={() => {
                const next = detailViewMode === 'popup' ? 'dropdown' : 'popup'
                setDetailViewMode(next)
                try { localStorage.setItem('ide-projects-detail-view', next) } catch {}
              }}
              className={cn(
                'flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors duration-150 ring-1',
                detailViewMode === 'dropdown'
                  ? 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-300'
                  : 'text-zinc-500 bg-zinc-800/50 hover:text-zinc-200 ring-zinc-700/40'
              )}
            >
              {detailViewMode === 'dropdown' ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <Monitor className="w-3 h-3" />
              )}
              {detailViewMode === 'dropdown' ? 'Dropdown' : 'Popup'}
            </button>
            <div className="w-px h-5 bg-zinc-700/60" />
            <button
              onClick={handleDebugAgents}
              className="px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/70 hover:bg-zinc-700/70 rounded-lg ring-1 ring-zinc-700/60 transition-colors duration-150"
            >
              {showAgentDebug ? 'Hide Details' : 'Details'}
            </button>
            <button
              onClick={() => {
                const rows: string[] = [
                  'Tool,Tokens,Messages,Sessions,Cost,Tokens/Msg,Cost/Session',
                ]
                aiAgents
                  .filter((a) => a.status !== 'inactive')
                  .forEach((a) => {
                    rows.push(
                      `${a.name},${a.tokens},${a.messageCount},${a.sessions},${a.cost.toFixed(4)},${a.messageCount > 0 ? Math.round(a.tokens / a.messageCount) : 0},${a.sessions > 0 ? (a.cost / a.sessions).toFixed(4) : 0}`
                    )
                  })
                const csv = rows.join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `ai-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/70 hover:bg-zinc-700/70 rounded-lg ring-1 ring-zinc-700/60 transition-colors duration-150"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ── Chart Controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
          <button
            onClick={() => { setChartType('line'); try { localStorage.setItem('ide-ai-chart-type', 'line') } catch {} }}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
              chartType === 'line'
                ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2,12 5,6 9,9 14,3" /></svg>
              Line
            </span>
          </button>
          <button
            onClick={() => { setChartType('bar'); try { localStorage.setItem('ide-ai-chart-type', 'bar') } catch {} }}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
              chartType === 'bar'
                ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              Bar
            </span>
          </button>
        </div>
        <div className="w-px h-5 bg-zinc-700/40" />
        <button
          onClick={() => {
            setLogScale(!logScale)
            try {
              localStorage.setItem(
                'ide-projects-log-scale',
                String(!logScale)
              )
            } catch {}
          }}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-medium ring-1 transition-colors duration-150',
            logScale
              ? 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30'
              : 'text-zinc-500 hover:text-zinc-300 ring-zinc-700/40'
          )}
        >
          Log
        </button>
        <button
          onClick={() => {
            setExcludeOutliers(!excludeOutliers)
            try {
              localStorage.setItem(
                'ide-projects-exclude-outliers',
                String(!excludeOutliers)
              )
            } catch {}
          }}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-medium ring-1 transition-colors duration-150',
            excludeOutliers
              ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
              : 'text-zinc-500 hover:text-zinc-300 ring-zinc-700/40'
          )}
        >
          Outliers
        </button>
        <div className="w-px h-5 bg-zinc-700/40" />
        <button
          onClick={() => setShowDataOnly(!showDataOnly)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-medium ring-1 transition-colors duration-150',
            showDataOnly
              ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
              : 'text-zinc-500 hover:text-zinc-300 ring-zinc-700/40'
          )}
        >
          {showDataOnly ? 'Data Only' : 'All Days'}
        </button>
      </div>

      {/* ── Stats Dashboard ── */}
      <StatsDashboard
        rawData={workspaceAnalytics}
        loading={analyticsLoading}
        error={analyticsError || undefined}
        onRetry={onRetryAnalytics}
        timeframeDays={effectiveAiPeriod === 'all' ? undefined : effectiveAiPeriod === 'month' ? 30 : 7}
      />

      {/* ── Word Tracker ── */}
      <WordTrackerPanel overview={overview} />

      {/* ── Debug Panel ── */}
      <AnimatePresence>
        {showAgentDebug && agentDebugInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Tool Detection Details" icon={<Bot />} />
                <button
                  onClick={() => setShowAgentDebug(false)}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors duration-150 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {agentDebugInfo.database && (
                <div className="mb-4 p-4 bg-zinc-950/60 rounded-xl ring-1 ring-zinc-800/50">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Database State
                  </h4>
                  {agentDebugInfo.database.error ? (
                    <p className="text-red-400 text-sm">
                      {agentDebugInfo.database.error}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-500">Total Records:</span>
                        <span className="text-zinc-100 ml-2">
                          {agentDebugInfo.database.totalRecords}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Total Tokens:</span>
                        <span className="text-violet-400 ml-2">
                          <TokenValue
                            value={agentDebugInfo.database.totalTokens || 0}
                          />
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">By Tool:</span>
                        <span className="text-zinc-100 ml-2">
                          {Array.isArray(agentDebugInfo.database.byTool)
                            ? agentDebugInfo.database.byTool
                                .map((t: any) => `${t.tool}: ${t.count}`)
                                .join(', ') || 'None'
                            : 'None'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(agentDebugInfo.agents || {}).map(
                  ([agentId, info]: [string, any]) => (
                    <div
                      key={agentId}
                      className="bg-zinc-950/60 rounded-xl p-4 ring-1 ring-zinc-800/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-2.5 h-2.5 rounded-full',
                              info.detected
                                ? 'bg-emerald-400'
                                : 'bg-red-400'
                            )}
                          />
                          <span className="text-zinc-100 text-sm font-medium">
                            {agentId}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            info.detected
                              ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                              : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/20'
                          )}
                        >
                          {info.detected ? 'Detected' : 'Not Found'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                            Paths
                          </span>
                          <div className="text-[11px] text-zinc-400 font-mono mt-1">
                            {(info.paths || []).map((p: string, i: number) => (
                              <div key={i} className="truncate" title={p}>
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>
                        {info.sampleFiles &&
                          info.sampleFiles.length > 0 && (
                            <div>
                              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                                Files Found
                              </span>
                              {info.totalFiles > 0 && (
                                <span className="text-[10px] text-violet-400 ml-2">
                                  ({info.totalFiles} total)
                                </span>
                              )}
                              <div className="text-[11px] text-zinc-400 font-mono mt-1 max-h-24 overflow-y-auto">
                                {info.sampleFiles
                                  .slice(0, 5)
                                  .map((f: string, i: number) => (
                                    <div key={i} className="truncate">
                                      {f}
                                    </div>
                                  ))}
                                {info.sampleFiles.length > 5 && (
                                  <div className="text-zinc-600">
                                    ...and {info.sampleFiles.length - 5} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sync Result ── */}
      <AnimatePresence>
        {aiSyncResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <GlassCard variant="compact">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-zinc-100 font-medium">
                    Sync Complete
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {Object.keys(aiSyncResult.agents).length > 0 ? (
                      Object.entries(aiSyncResult.agents).map(
                        ([agent, count]) => (
                          <span key={agent} className="mr-3">
                            {agent}:{' '}
                            <span className="text-violet-400">
                              {count as number} records
                            </span>
                          </span>
                        )
                      )
                    ) : (
                      <span>
                        No new records found. Click "Details" to debug.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Language Distribution + Response Time ── */}
      {usageDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Language Distribution */}
          {Object.keys(usageDetails.languageDistribution).length > 0 && (
            <GlassCard>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-zinc-100">
                    Language Distribution
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    By project type detection
                  </p>
                </div>
              </div>
              <div className="h-48">
                <Doughnut
                  data={{
                    labels: Object.entries(usageDetails.languageDistribution)
                      .sort(([, a], [, b]) => b.tokens - a.tokens)
                      .map(([lang]) => lang),
                    datasets: [
                      {
                        data: Object.entries(usageDetails.languageDistribution)
                          .sort(([, a], [, b]) => b.tokens - a.tokens)
                          .map(([, v]) => v.tokens),
                        backgroundColor: [
                          '#3b82f6', '#f97316', '#22c55e', '#a855f7',
                          '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
                        ],
                        borderColor: 'rgba(0,0,0,0.3)',
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: {
                          color: '#a1a1aa',
                          font: { size: 11 },
                          padding: 8,
                          usePointStyle: true,
                          pointStyleWidth: 8,
                        },
                      },
                      tooltip: {
                        backgroundColor: 'rgba(9, 9, 11, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#a1a1aa',
                        borderColor: '#27272a',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                          label: (ctx) => {
                            const val = ctx.parsed || 0
                            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0)
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
                            return ` ${formatTokens(val)} tokens (${pct}%)`
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </GlassCard>
          )}

          {/* Response Time */}
          {usageDetails.avgResponseTime > 0 && (
            <GlassCard>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-zinc-100">
                    Avg Response Time
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {usageDetails.avgResponseTime}ms average
                  </p>
                </div>
              </div>
              <div className="h-48">
                {Object.keys(usageDetails.responseTimeByDay).length > 0 ? (
                  <Line
                    data={{
                      labels: Object.keys(usageDetails.responseTimeByDay).sort().map(d => format(new Date(d), 'MMM dd')),
                      datasets: [
                        {
                          label: 'Response Time (ms)',
                          data: Object.keys(usageDetails.responseTimeByDay).sort().map(d => usageDetails.responseTimeByDay[d]),
                          borderColor: '#06b6d4',
                          backgroundColor: 'rgba(6, 182, 212, 0.1)',
                          borderWidth: 2,
                          pointRadius: 3,
                          pointBackgroundColor: '#06b6d4',
                          fill: true,
                          tension: 0.3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(9, 9, 11, 0.95)',
                          titleColor: '#fff',
                          bodyColor: '#a1a1aa',
                          borderColor: '#27272a',
                          borderWidth: 1,
                          cornerRadius: 8,
                          callbacks: {
                            label: (ctx) => ` ${ctx.parsed.y}ms`,
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: { display: false },
                          border: { color: 'rgba(113,113,122,0.12)' },
                          ticks: { color: '#71717a', font: { size: 10 } },
                        },
                        y: {
                          grid: { color: 'rgba(113,113,122,0.06)' },
                          border: { color: 'rgba(113,113,122,0.12)' },
                          ticks: {
                            color: '#71717a',
                            font: { size: 10 },
                            callback: (v) => `${v}ms`,
                          },
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    No response time data yet
                  </div>
                )}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ── Tool Selector ── */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-100">
              Tools
            </span>
          </div>
          <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
            <button
              onClick={() => setTopViewMode('tools')}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
                topViewMode === 'tools'
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3 h-3" />
                Tools
              </span>
            </button>
            <button
              onClick={() => setTopViewMode('models')}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
                topViewMode === 'models'
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Models
              </span>
            </button>
          </div>
        </div>

        {/* Tool Pills */}
        {topViewMode === 'tools' && (
          <div className="flex flex-wrap gap-2">
            {aiAgents.map((agent) => {
              const dailyData = overview?.aiUsage?.byTool?.[agent.id]?.daily || {}
              const last7 = eachDayOfInterval({
                start: subDays(new Date(), 6),
                end: new Date(),
              })
              const sparkData = last7.map((d) => {
                const dayStr = format(d, 'yyyy-MM-dd')
                return dailyData[dayStr]?.tokens || 0
              })
              const hasSparkData = sparkData.some((v) => v > 0)
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(
                      selectedAgent === agent.id ? null : agent.id
                    )
                    if (agent.status !== 'inactive')
                      setSelectedAgentDetail(agent)
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ring-1',
                    selectedAgent === agent.id
                      ? 'ring-violet-500/50 bg-violet-500/10 text-zinc-100'
                      : 'ring-zinc-700/40 bg-zinc-800/30 text-zinc-400 hover:ring-zinc-600/60 hover:bg-zinc-800/60 hover:text-zinc-200'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: agent.color + '20' }}
                  >
                    <Code2
                      className="w-3 h-3"
                      style={{ color: agent.color }}
                    />
                  </div>
                  <span>{agent.name}</span>
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      agent.status === 'active'
                        ? 'bg-emerald-400'
                        : agent.status === 'idle'
                          ? 'bg-amber-400'
                          : agent.status === 'error'
                            ? 'bg-red-400'
                            : 'bg-zinc-600'
                    )}
                  />
                  {hasSparkData && agent.status !== 'inactive' && (
                    <div className="w-10 h-2.5 flex-shrink-0">
                      <Line
                        data={{
                          labels: sparkData.map((_, i) => String(i)),
                          datasets: [
                            {
                              data: sparkData,
                              borderColor: agent.color,
                              backgroundColor: 'transparent',
                              borderWidth: 1.5,
                              pointRadius: 0,
                              fill: false,
                              tension: 0.4,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false }, tooltip: { enabled: false } },
                          scales: {
                            x: { display: false },
                            y: { display: false },
                          },
                          layout: { padding: 0 },
                        }}
                      />
                    </div>
                  )}
                  {agent.status !== 'inactive' && agent.models.length > 0 && (
                    <span className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                      {agent.models.length === 1
                        ? agent.models[0]
                        : `${agent.models.length} models`}
                    </span>
                  )}
                  {agent.status !== 'inactive' && (
                    <span className="text-[10px] text-zinc-600 tabular-nums ml-0.5">
                      <TokenValue value={agent.tokens} />
                    </span>
                  )}
                </button>
              )
            })}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs ring-1 ring-zinc-800/40 bg-zinc-900/20 text-zinc-600">
              <Monitor className="w-3 h-3 text-indigo-400/50" />
              <span>Copilot</span>
              <span className="text-[9px] bg-amber-500/10 text-amber-400/60 px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          </div>
        )}

        {/* Model Pills */}
        {topViewMode === 'models' && (
          <div className="flex flex-wrap gap-2">
            {allModelData.length === 0 ? (
              <span className="text-xs text-zinc-500 py-2">
                No model data detected yet. Click "Sync AI" to scan.
              </span>
            ) : (
              allModelData.map(([modelName, data], idx) => (
                <div
                  key={modelName}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs ring-1 ring-zinc-700/30 bg-zinc-800/20 hover:bg-zinc-800/50 transition-colors duration-150"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        MODEL_COLORS[idx % MODEL_COLORS.length],
                    }}
                  />
                  <span
                    className="text-zinc-300 font-medium truncate max-w-[160px]"
                    title={modelName}
                  >
                    {modelName}
                  </span>
                  <span className="text-[10px] text-zinc-600 tabular-nums">
                    <TokenValue value={data.tokens} />
                  </span>
                  <span className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                    {data.agents
                      .map((a) => AGENT_CONFIG[a]?.name || a)
                      .join(', ')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </GlassCard>

      {/* ── Selected Tool Detail Modal ── */}
      <AnimatePresence>
        {selectedAgent &&
          selectedAgentDetail &&
          (() => {
            const agent = selectedAgentDetail
            const toolDaily = overview?.aiUsage?.byTool?.[agent.id]?.daily || {}
            const toolModelDaily = overview?.aiUsage?.byTool?.[agent.id]?.modelDaily || {}
            const periodDays = eachDayOfInterval({
              start: (() => {
                if (modalPeriod === 'all') {
                  const dateStrs = Object.keys(toolDaily).filter(
                    (d) => isSaneDay(new Date(d).getTime())
                  )
                  if (dateStrs.length > 0) {
                    const sorted = dateStrs.sort()
                    return subDays(new Date(sorted[0]), 3)
                  }
                  return subDays(new Date(), 60)
                }
                return subDays(
                  new Date(),
                  modalPeriod === 'week'
                    ? 6
                    : 29
                )
              })(),
              end: new Date(),
            })
            const periodDayStrs = periodDays.map((d) => format(d, 'yyyy-MM-dd'))
            const periodData = periodDayStrs.map((ds) => toolDaily[ds] || {})
            const totalTokens = periodData.reduce(
              (s, d) => s + (d.tokens || 0),
              0
            )
            const totalIn = periodData.reduce(
              (s, d) => s + (d.tokens_in || 0),
              0
            )
            const totalOut = periodData.reduce(
              (s, d) => s + (d.tokens_out || 0),
              0
            )
            const totalCost = periodData.reduce(
              (s, d) => s + (d.cost || 0),
              0
            )
            const totalMessages = periodData.reduce(
              (s, d) => s + (d.messageCount || 0),
              0
            )
            const totalSessions = periodData.reduce(
              (s, d) => s + (d.sessions || 0),
              0
            )
            const inPct = totalTokens > 0 ? ((totalIn / totalTokens) * 100).toFixed(1) : '0.0'
            const outPct = totalTokens > 0 ? ((totalOut / totalTokens) * 100).toFixed(1) : '0.0'
            const inOutRatio = totalIn > 0 ? (totalOut / totalIn).toFixed(2) : '—'
            const tokensPerMsg = totalMessages > 0 ? Math.round(totalTokens / totalMessages) : 0

            const modalChartLabels = periodDays.map((d) =>
              format(d, modalPeriod === 'week' ? 'EEE' : 'MMM dd')
            )
            const modalMetricField =
              aiChartMode === 'tokens'
                ? tokenDisplayMode === 'input'
                  ? 'tokens_in'
                  : tokenDisplayMode === 'output'
                    ? 'tokens_out'
                    : 'tokens'
                : aiChartMode === 'messages'
                  ? 'messageCount'
                  : aiChartMode === 'sessions'
                    ? 'sessions'
                    : 'cost'
            const modalChartRaw = periodDayStrs.map((ds) => {
              const dayData = toolDaily[ds] || {}
              return dayData[modalMetricField] || 0
            })
            const modalChartClean = excludeOutliers
              ? filterOutlierValues(modalChartRaw)
              : modalChartRaw
            const modalChartLabel =
              aiChartMode === 'tokens'
                ? tokenDisplayMode === 'input'
                  ? 'Input Tokens'
                  : tokenDisplayMode === 'output'
                    ? 'Output Tokens'
                    : 'Tokens'
                : aiChartMode === 'messages'
                  ? 'Messages'
                  : aiChartMode === 'sessions'
                    ? 'Sessions'
                    : 'Cost'

            return detailViewMode === 'popup' ? (
              <motion.div
                key="detail-popup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedAgent(null)
                    setSelectedAgentDetail(null)
                  }
                }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
                >
                  <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: agent.color + '22' }}
                        >
                          <Code2
                            className="w-5 h-5"
                            style={{ color: agent.color }}
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-100">
                            {agent.name}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <div
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                agent.status === 'active'
                                  ? 'bg-emerald-400'
                                  : agent.status === 'idle'
                                    ? 'bg-amber-400'
                                    : agent.status === 'error'
                                      ? 'bg-red-400'
                                      : 'bg-zinc-600'
                              )}
                            />
                            <span>
                              {agent.status === 'active'
                                ? 'Active'
                                : agent.status === 'idle'
                                  ? 'Idle'
                                  : agent.status === 'error'
                                    ? 'Error'
                                    : 'Not detected'}
                            </span>
                            {agent.lastUsed && (
                              <>
                                <span className="text-zinc-700">·</span>
                                <Clock className="w-3 h-3" />
                                <span>
                                  {format(agent.lastUsed, 'MMM dd, HH:mm')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                          {([
                            { key: 'week' as const, label: '7D' },
                            { key: 'month' as const, label: '30D' },
                            { key: 'all' as const, label: 'All' },
                          ]).map((p) => (
                            <button
                              key={p.key}
                              onClick={() => setModalPeriod(p.key)}
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                                modalPeriod === p.key
                                  ? 'bg-violet-500/20 text-violet-400'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedAgent(null)
                            setSelectedAgentDetail(null)
                          }}
                          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors duration-150 text-zinc-500 hover:text-zinc-200"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {agent.status !== 'inactive' ? (
                      <div className="space-y-5">
                        {/* Period-aware metrics grid (6 cols) */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                          {[
                            { label: 'Total Tokens', value: totalTokens, color: 'text-zinc-100', comp: <TokenValue value={totalTokens} /> },
                            { label: 'Input (You)', value: totalIn, color: 'text-blue-400', comp: <TokenValue value={totalIn} /> },
                            { label: 'Output (AI)', value: totalOut, color: 'text-emerald-400', comp: <TokenValue value={totalOut} /> },
                            { label: 'In:Out Ratio', value: 0, color: 'text-amber-400', comp: <span>{inOutRatio}</span> },
                            { label: 'Input %', value: 0, color: 'text-blue-400', comp: <span>{inPct}%</span> },
                            { label: 'Output %', value: 0, color: 'text-emerald-400', comp: <span>{outPct}%</span> },
                          ].map((stat) => (
                            <div
                              key={stat.label}
                              className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50"
                            >
                              <div className={cn('text-base font-bold tabular-nums', stat.color)}>
                                {stat.comp}
                              </div>
                              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Secondary stats row (4 cols) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Messages', value: totalMessages.toLocaleString(), color: 'text-blue-400' },
                            { label: 'Cost', value: '', color: 'text-emerald-400', comp: <CostValue value={totalCost} /> },
                            { label: 'Sessions', value: totalSessions.toLocaleString(), color: 'text-cyan-400' },
                            { label: 'Tokens/Msg', value: '', color: 'text-amber-400', comp: <TokenValue value={tokensPerMsg} /> },
                          ].map((stat) => (
                            <div
                              key={stat.label}
                              className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50"
                            >
                              <div className={cn('text-base font-bold tabular-nums', stat.color)}>
                                {stat.comp || stat.value}
                              </div>
                              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Daily Averages row */}
                        {(() => {
                          const timeframeDays = periodDays.length
                          const dTokens = totalTokens / timeframeDays
                          const dCost = totalCost / timeframeDays
                          const dMsgs = totalMessages / timeframeDays
                          return (
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-amber-500/20">
                                <div className="text-base font-bold text-amber-400 tabular-nums"><TokenValue value={Math.round(dTokens)} /></div>
                                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Tokens/Day ({timeframeDays}d)</div>
                              </div>
                              <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-cyan-500/20">
                                <div className="text-base font-bold text-cyan-400 tabular-nums"><CostValue value={dCost} /></div>
                                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Cost/Day</div>
                              </div>
                              <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-pink-500/20">
                                <div className="text-base font-bold text-pink-400 tabular-nums">{Math.round(dMsgs).toLocaleString()}</div>
                                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Msgs/Day</div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Daily Usage Timeline Chart */}
                        <div className="bg-zinc-950/60 rounded-xl p-4 ring-1 ring-zinc-800/50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">
                              Daily Usage Timeline
                            </div>
                            <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                              {(['tokens', 'messages', 'sessions', 'cost'] as const).map((mode) => (
                                <button
                                  key={mode}
                                  onClick={() => setAiChartMode(mode)}
                                  className={cn(
                                    'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                                    aiChartMode === mode
                                      ? 'bg-violet-500/20 text-violet-400'
                                      : 'text-zinc-500 hover:text-zinc-300'
                                  )}
                                >
                                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                              ))}
                              {aiChartMode === 'tokens' && (
                                <>
                                  <div className="w-px h-3 bg-zinc-700/60 mx-0.5" />
                                  {(['combined', 'input', 'output'] as const).map((sub) => (
                                    <button
                                      key={sub}
                                      onClick={() => setTokenDisplayMode(sub)}
                                      className={cn(
                                        'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                                        tokenDisplayMode === sub
                                          ? sub === 'input'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : sub === 'output'
                                              ? 'bg-emerald-500/20 text-emerald-400'
                                              : 'bg-zinc-700/50 text-zinc-300'
                                          : 'text-zinc-600 hover:text-zinc-400'
                                      )}
                                    >
                                      {sub === 'combined' ? 'All' : sub === 'input' ? 'In' : 'Out'}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                              <button
                                onClick={() => { setChartType('line'); try { localStorage.setItem('ide-ai-chart-type', 'line') } catch {} }}
                                className={cn(
                                  'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                                  chartType === 'line' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
                                )}
                              >Line</button>
                              <button
                                onClick={() => { setChartType('bar'); try { localStorage.setItem('ide-ai-chart-type', 'bar') } catch {} }}
                                className={cn(
                                  'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                                  chartType === 'bar' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
                                )}
                              >Bar</button>
                            </div>
                          </div>
                          <div className="h-56">
                            {(() => {
                              const lineData = {
                                labels: modalChartLabels,
                                datasets: [
                                  {
                                    label: `${agent.name} - ${modalChartLabel}`,
                                    data: modalChartClean.map((v) => logScale && v === 0 ? null : v) as (number | null)[],
                                    borderColor: agent.color,
                                    backgroundColor: (ctx: any) => {
                                      const chart = ctx.chart
                                      const { ctx: canvasCtx, chartArea } = chart
                                      if (!chartArea) return agent.color + '20'
                                      const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                                      g.addColorStop(0, agent.color + '30')
                                      g.addColorStop(0.6, agent.color + '10')
                                      g.addColorStop(1, agent.color + '00')
                                      return g
                                    },
                                    borderWidth: 2,
                                    pointRadius: (ctx: any) => { const val = ctx.raw; return val !== null && val !== 0 ? 3 : 0 },
                                    pointBackgroundColor: agent.color,
                                    pointBorderColor: agent.color,
                                    pointHoverRadius: 5,
                                    spanGaps: false,
                                    fill: true,
                                    tension: 0.35,
                                  },
                                ],
                              }
                              const barData = {
                                labels: modalChartLabels,
                                datasets: [{
                                  label: `${agent.name} - ${modalChartLabel}`,
                                  data: modalChartClean.map((v) => logScale && v === 0 ? null : v) as (number | null)[],
                                  backgroundColor: agent.color + '80',
                                  borderColor: agent.color,
                                  borderWidth: 1.5,
                                  borderRadius: 4,
                                  borderSkipped: false,
                                }],
                              }
                              const tooltipCfg = { backgroundColor: 'rgba(9, 9, 11, 0.95)', titleColor: '#fff', bodyColor: '#a1a1aa', borderColor: '#27272a', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx: any) => { const val = ctx.parsed?.y ?? 0; if (aiChartMode === 'tokens') return ` ${formatTokens(val)} tokens`; if (aiChartMode === 'cost') return ` ${formatCurrency(val)}`; if (aiChartMode === 'messages') return ` ${val} messages`; return ` ${val} sessions` } } }
                              const scaleCfg = {
                                x: { grid: { display: false }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#71717a', maxTicksLimit: 10, font: { size: 10, weight: '500' as const } } },
                                y: { type: logScale ? ('logarithmic' as const) : ('linear' as const), grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#71717a', font: { size: 10 }, padding: 8, callback: (v: any) => { if (v === null) return ''; if (aiChartMode === 'tokens') return formatTokens(v as number); if (aiChartMode === 'cost') return `$${(v as number).toFixed(2)}`; return String(v) } }, ...(logScale ? {} : { beginAtZero: true }) },
                              }
                              if (chartType === 'line') {
                                return <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipCfg }, scales: scaleCfg }} />
                              }
                              return <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipCfg }, scales: scaleCfg, barPercentage: 0.82, categoryPercentage: 0.85 }} />
                            })()}
                          </div>
                        </div>

                        {/* Per-Model Breakdown */}
                        {Object.keys(toolModelDaily).length > 0 && (() => {
                          const modelNames = Object.keys(toolModelDaily).sort((a, b) => {
                            const aT = Object.values(toolModelDaily[a] as Record<string, any>).reduce((s: number, d: any) => s + (d.tokens || 0), 0)
                            const bT = Object.values(toolModelDaily[b] as Record<string, any>).reduce((s: number, d: any) => s + (d.tokens || 0), 0)
                            return bT - aT
                          })
                          const filteredModels = modalSelectedModels.length > 0
                            ? modelNames.filter(m => modalSelectedModels.includes(m))
                            : modelNames
                          const modelMetricField = aiChartMode === 'tokens' ? (tokenDisplayMode === 'input' ? 'tokens_in' : tokenDisplayMode === 'output' ? 'tokens_out' : 'tokens') : aiChartMode === 'messages' ? 'messageCount' : aiChartMode === 'cost' ? 'cost' : 'sessions'
                          const modelMetricLabel = aiChartMode === 'tokens' ? (tokenDisplayMode === 'input' ? 'Input Tokens' : tokenDisplayMode === 'output' ? 'Output Tokens' : 'Tokens') : aiChartMode.charAt(0).toUpperCase() + aiChartMode.slice(1)

                          const modelDatasets = filteredModels.slice(0, 8).map((modelName, idx) => {
                            const color = MODEL_COLORS[idx % MODEL_COLORS.length]
                            return {
                              label: modelName.length > 22 ? modelName.slice(0, 19) + '...' : modelName,
                              data: periodDays.map(d => {
                                const dayStr = format(d, 'yyyy-MM-dd')
                                const dayData = (toolModelDaily[modelName] as Record<string, any>)?.[dayStr]
                                return dayData ? Number(dayData[modelMetricField]) || 0 : 0
                              }),
                              backgroundColor: color + '80',
                              borderColor: color,
                              borderWidth: 1.5,
                              borderRadius: 4,
                              borderSkipped: false,
                            }
                          })

                          if (modelDatasets.length === 0) return null

                          return (
                            <div className="bg-zinc-950/60 rounded-xl p-4 ring-1 ring-zinc-800/50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">
                                  Models — {modelMetricLabel}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setModalSelectedModels([])}
                                    className={cn(
                                      'px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors duration-150',
                                      modalSelectedModels.length === 0 ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
                                    )}
                                  >All</button>
                                  {modelNames.slice(0, 6).map((m, i) => {
                                    const isActive = modalSelectedModels.length === 0 || modalSelectedModels.includes(m)
                                    return (
                                      <button
                                        key={m}
                                        onClick={() => setModalSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                                        className={cn(
                                          'px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors duration-150 max-w-[90px] truncate',
                                          isActive ? 'bg-zinc-700/60 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                                        )}
                                        title={m}
                                      >
                                        <span className="flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                                          {m.length > 10 ? m.slice(0, 8) + '..' : m}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div className="h-44">
                                <Bar
                                  data={{ labels: periodDays.map(d => format(d, modalPeriod === 'week' ? 'EEE' : 'MMM dd')), datasets: modelDatasets }}
                                  options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: true, position: 'bottom', labels: { color: '#71717a', font: { size: 9 }, boxWidth: 10, padding: 8, usePointStyle: true } },
                                      tooltip: { backgroundColor: 'rgba(20,22,30,0.85)', titleColor: '#fff', bodyColor: '#8E95A5', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, cornerRadius: 8, usePointStyle: true,
                                        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${aiChartMode === 'tokens' ? formatTokens(ctx.parsed.y) : aiChartMode === 'cost' ? formatCurrency(ctx.parsed.y) : ctx.parsed.y}` }
                                      },
                                    },
                                    scales: {
                                      x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: '#71717a', maxTicksLimit: modalPeriod === 'week' ? 7 : 10, font: { size: 9 }, maxRotation: 0 } },
                                      y: { stacked: true, grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false }, border: { display: false }, ticks: { color: '#71717a', font: { size: 9 }, padding: 6, callback: (v: any) => aiChartMode === 'tokens' ? formatTokens(v) : aiChartMode === 'cost' ? `$${v.toFixed(2)}` : String(v) }, beginAtZero: true },
                                    },
                                    barPercentage: 0.82, categoryPercentage: 0.85,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })()}

                        {/* Models list */}
                        {agent.models.length > 0 && (
                          <div className="bg-zinc-950/60 rounded-xl p-4 ring-1 ring-zinc-800/50">
                            <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3 font-semibold">
                              Models Used
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(
                                providerModelData[agent.id]?.models || []
                              ).map((m, i) => (
                                <div
                                  key={m.name}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ring-1 ring-zinc-700/30 bg-zinc-800/30"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor:
                                        MODEL_COLORS[i % MODEL_COLORS.length],
                                    }}
                                  />
                                  <span className="text-zinc-400">
                                    {m.name}
                                  </span>
                                  <span className="text-zinc-600 tabular-nums">
                                    <TokenValue value={m.tokens} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <span className="text-sm text-zinc-500">
                          Not detected
                        </span>
                        {agentDebugInfo?.agents?.[agent.id]?.paths ? (
                          <p
                            className="text-[11px] text-zinc-600 mt-1 truncate mx-2"
                            title={agentDebugInfo.agents[agent.id].paths[0]}
                          >
                            Looking in:{' '}
                            {agentDebugInfo.agents[agent.id].paths[0]}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-600 mt-1">
                            Install {agent.name} to start tracking
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="detail-dropdown"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: agent.color + '22' }}
                      >
                        <Code2 className="w-4 h-4" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold text-zinc-100">{agent.name}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <div className={cn('w-1.5 h-1.5 rounded-full', agent.status === 'active' ? 'bg-emerald-400' : agent.status === 'idle' ? 'bg-amber-400' : 'bg-zinc-600')} />
                          <span>{agent.status === 'active' ? 'Active' : agent.status === 'idle' ? 'Idle' : 'Not detected'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedAgent(null); setSelectedAgentDetail(null) }}
                      className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors duration-150 text-zinc-500 hover:text-zinc-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {agent.status !== 'inactive' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {[
                          { label: 'Tokens', comp: <TokenValue value={totalTokens} />, color: 'text-zinc-100' },
                          { label: 'Input', comp: <TokenValue value={totalIn} />, color: 'text-blue-400' },
                          { label: 'Output', comp: <TokenValue value={totalOut} />, color: 'text-emerald-400' },
                          { label: 'Ratio', comp: <span>{inOutRatio}</span>, color: 'text-amber-400' },
                          { label: 'Messages', comp: <span>{totalMessages.toLocaleString()}</span>, color: 'text-blue-400' },
                          { label: 'Cost', comp: <CostValue value={totalCost} />, color: 'text-emerald-400' },
                        ].map((s) => (
                          <div key={s.label} className="bg-zinc-950/60 rounded-lg p-2 text-center ring-1 ring-zinc-800/50">
                            <div className={cn('text-sm font-bold tabular-nums', s.color)}>{s.comp}</div>
                            <div className="text-[8px] text-zinc-600 uppercase tracking-wider mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="h-48">
                        <Line
                          data={{
                            labels: modalChartLabels,
                            datasets: [{
                              label: `${agent.name} - ${modalChartLabel}`,
                              data: modalChartClean.map((v) => logScale && v === 0 ? null : v) as (number | null)[],
                              borderColor: agent.color,
                              backgroundColor: (ctx: any) => {
                                const chart = ctx.chart
                                const { ctx: canvasCtx, chartArea } = chart
                                if (!chartArea) return agent.color + '20'
                                const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                                g.addColorStop(0, agent.color + '30')
                                g.addColorStop(1, agent.color + '00')
                                return g
                              },
                              borderWidth: 2,
                              pointRadius: (ctx: any) => ctx.raw !== null && ctx.raw !== 0 ? 2 : 0,
                              pointBackgroundColor: agent.color,
                              fill: true,
                              tension: 0.35,
                              spanGaps: false,
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(20, 22, 30, 0.85)', titleColor: '#FFFFFF', bodyColor: '#8E95A5', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, cornerRadius: 10, padding: { top: 12, bottom: 12, left: 16, right: 16 }, usePointStyle: true } },
                            scales: {
                              x: { grid: { display: false }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#71717a', maxTicksLimit: 8, font: { size: 9 } } },
                              y: { type: logScale ? ('logarithmic' as const) : ('linear' as const), grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#71717a', font: { size: 9 }, padding: 6 }, ...(logScale ? {} : { beginAtZero: true }) },
                            },
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })()}
      </AnimatePresence>

      {/* ── AI Usage Heatmap — Calendar Grid ── */}
      {(() => {
        const ovByTool = overview?.aiUsage?.byTool || {}
        const heatmapAgents = aiAgents.filter(a => {
          if (a.status === 'inactive' || a.tokens <= 0) return false
          const daily = ovByTool[a.id]?.daily
          return daily && typeof daily === 'object' && Object.keys(daily).length > 0
        })

        if (heatmapAgents.length === 0 || !overview) {
          return (
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl !p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
              <CalendarDays className="w-8 h-8 text-zinc-500 mb-2" />
              <p className="text-sm text-zinc-400 font-medium">No daily usage data available</p>
              <p className="text-[10px] text-zinc-500 mt-1">Try selecting a specific tool or refreshing the data.</p>
            </div>
          )
        }

        const selectedHeatmapTool = heatmapToolFilter
        const filteredAgents = selectedHeatmapTool === 'all'
          ? heatmapAgents
          : heatmapAgents.filter(a => a.id === selectedHeatmapTool)
        if (filteredAgents.length === 0) {
          return (
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl !p-5 text-center text-sm text-zinc-500">
              No data for the selected tool filter.
            </div>
          )
        }

        const dateMap: Record<string, Record<string, { tokens: number; cost: number; messages: number; sessions: number }>> = {}
        const allDateStrs = new Set<string>()
        let maxVal = 0

        for (const agent of filteredAgents) {
          const daily = ovByTool[agent.id]?.daily || {}
          for (const [dateStr, dayData] of Object.entries(daily) as [string, any][]) {
            const dt = new Date(dateStr)
            if (!isSaneDay(dt.getTime())) continue
            allDateStrs.add(dateStr)
            if (!dateMap[dateStr]) dateMap[dateStr] = {}
            dateMap[dateStr][agent.id] = {
              tokens: dayData.tokens || 0,
              cost: dayData.cost || 0,
              messages: dayData.messageCount || 0,
              sessions: dayData.sessions || 0,
            }
          }
        }

        if (allDateStrs.size === 0) {
          return (
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl !p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
              <CalendarDays className="w-8 h-8 text-zinc-500 mb-2" />
              <p className="text-sm text-zinc-400 font-medium">No daily usage data available</p>
              <p className="text-[10px] text-zinc-500 mt-1">Try selecting a specific tool or refreshing the data.</p>
            </div>
          )
        }

        const sortedDates = Array.from(allDateStrs).sort()
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const days: {
          date: Date; dateStr: string
          raw: number
          details: { agent: string; tokens: number; cost: number; messages: number; sessions: number }[]
          isToday: boolean
        }[] = []

        for (const ds of sortedDates) {
          const dayData = dateMap[ds]
          let tokens = 0, cost = 0, messages = 0, sessions = 0
          const details: typeof days[0]['details'] = []
          for (const [agentId, data] of Object.entries(dayData)) {
            tokens += data.tokens; cost += data.cost; messages += data.messages; sessions += data.sessions
            const agent = filteredAgents.find(a => a.id === agentId)
            details.push({ agent: agent?.name || agentId, tokens: data.tokens, cost: data.cost, messages: data.messages, sessions: data.sessions })
          }
          const raw = aiChartMode === 'tokens' ? tokens : aiChartMode === 'cost' ? cost : aiChartMode === 'messages' ? messages : sessions
          if (raw > maxVal) maxVal = raw
          days.push({
            date: new Date(ds), dateStr: ds, raw,
            details: details.filter(d => {
              const v = aiChartMode === 'tokens' ? d.tokens : aiChartMode === 'cost' ? d.cost : aiChartMode === 'messages' ? d.messages : d.sessions
              return v > 0
            }),
            isToday: ds === todayStr,
          })
        }

        if (days.length === 0) return heatmapEmpty

        const cellColor = (b: number) => {
          if (b === 0) return 'rgba(255,255,255,0.04)'
          if (b < 0.2) return 'rgba(16, 185, 129, 0.15)'
          if (b < 0.4) return 'rgba(16, 185, 129, 0.3)'
          if (b < 0.6) return 'rgba(16, 185, 129, 0.5)'
          if (b < 0.8) return 'rgba(16, 185, 129, 0.7)'
          return 'rgba(16, 185, 129, 0.9)'
        }

        const dayLookup = new Map<string, typeof days[0]>()
        for (const day of days) dayLookup.set(day.dateStr, day)

        const firstDate = days[0].date
        const lastDate = days[days.length - 1].date
        const gridStart = startOfWeek(firstDate, { weekStartsOn: 1 })
        const gridEnd = endOfWeek(lastDate, { weekStartsOn: 1 })

        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const CELL = 14, GAP = 3, STEP = CELL + GAP

        const weeks: { days: Date[]; monthLabel?: string }[] = []
        let cur = gridStart
        let lastMonth = -1
        while (cur <= gridEnd) {
          const wd: Date[] = []
          for (let d = 0; d < 7; d++) wd.push(addDays(cur, d))
          const m = cur.getMonth()
          weeks.push({ days: wd, monthLabel: m !== lastMonth ? format(cur, 'MMM') : undefined })
          lastMonth = m
          cur = addDays(cur, 7)
        }

        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.8" />
                    <rect x="5" y="1" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.4" />
                    <rect x="9" y="1" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.15" />
                    <rect x="13" y="1" width="2" height="3" rx="0.5" fill="#10b981" fillOpacity="0.05" />
                    <rect x="1" y="5" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.6" />
                    <rect x="5" y="5" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.9" />
                    <rect x="9" y="5" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.3" />
                    <rect x="1" y="9" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.2" />
                    <rect x="5" y="9" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.5" />
                    <rect x="9" y="9" width="3" height="3" rx="0.5" fill="#10b981" fillOpacity="0.7" />
                    <rect x="1" y="13" width="3" height="2" rx="0.5" fill="#10b981" fillOpacity="0.1" />
                    <rect x="5" y="13" width="3" height="2" rx="0.5" fill="#10b981" fillOpacity="0.35" />
                    <rect x="9" y="13" width="3" height="2" rx="0.5" fill="#10b981" fillOpacity="0.55" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-zinc-100">Usage Pattern</h3>
                  <p className="text-[11px] text-zinc-600">
                    {selectedHeatmapTool === 'all' ? 'All tools' : heatmapAgents.find(a => a.id === selectedHeatmapTool)?.name || selectedHeatmapTool} · {days.length} days · {aiChartMode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                  <button onClick={() => setToolFilter('all')} className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors duration-150', selectedHeatmapTool === 'all' ? 'bg-zinc-700/60 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>All</button>
                  {heatmapAgents.slice(0, 8).map(a => (
                    <button key={a.id} onClick={() => setToolFilter(a.id)} className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors duration-150', selectedHeatmapTool === a.id ? 'bg-zinc-700/60 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>{a.name.split(' ')[0]}</button>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                  {(['tokens', 'messages', 'cost', 'sessions'] as const).map((mode) => (
                    <button key={mode} onClick={() => setAiChartMode(mode)} className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors duration-150', aiChartMode === mode ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300')}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl p-4 overflow-visible relative"
              style={{
                background: 'linear-gradient(135deg, rgba(20,22,30,0.9) 0%, rgba(11,12,16,0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0px 20px 40px -10px rgba(0,0,0,0.5)',
              }}
            >
              <div className="overflow-x-auto max-w-full pb-1">
                <div className="inline-block min-w-full">
                  <div className="flex" style={{ marginLeft: 30, marginBottom: 2 }}>
                    {weeks.map((w, i) => (
                      <div key={i} style={{ width: STEP, textAlign: 'center' }}>
                        {w.monthLabel && <span className="text-[9px] text-zinc-500">{w.monthLabel}</span>}
                      </div>
                    ))}
                  </div>

                  {dayLabels.map((label, di) => (
                    <div key={label} className="flex items-center" style={{ height: STEP }}>
                      <span className="text-[9px] text-zinc-500 w-[26px] text-right mr-1 flex-shrink-0">{label}</span>
                      <div className="flex">
                        {weeks.map((w, wi) => {
                          const date = w.days[di]
                          const dateStr = format(date, 'yyyy-MM-dd')
                          const dayData = dayLookup.get(dateStr)
                          const b = dayData ? (maxVal === 0 ? 0 : dayData.raw / maxVal) : 0
                          const isToday = dateStr === todayStr
                          return (
                            <div key={wi} className="relative group" style={{ width: STEP, height: STEP }}>
                              <div
                                className="w-[14px] h-[14px] rounded-[3px] transition-all duration-100 group-hover:scale-[1.4] cursor-default"
                                style={{
                                  backgroundColor: cellColor(dayData ? b : 0),
                                  outline: isToday ? '1px solid rgba(255,255,255,0.3)' : 'none',
                                  outlineOffset: '1px',
                                }}
                              />
                              {dayData && dayData.details.length > 0 && (
                                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg invisible group-hover:visible pointer-events-none"
                                  style={{
                                    background: 'rgba(15, 17, 24, 0.96)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                                    minWidth: 110,
                                  }}
                                >
                                  <div className="text-[9px] font-medium text-white whitespace-nowrap">
                                    {format(dayData.date, 'MMM d')} · <span className="text-emerald-400">
                                      {aiChartMode === 'tokens' ? formatTokens(dayData.raw)
                                        : aiChartMode === 'cost' ? formatCurrency(dayData.raw)
                                        : aiChartMode === 'messages' ? dayData.raw
                                        : dayData.raw}
                                    </span>
                                  </div>
                                  {selectedHeatmapTool === 'all' && dayData.details.length > 1 && (
                                    <div className="border-t border-zinc-700/40 mt-0.5 pt-0.5 space-y-0.5">
                                      {dayData.details.slice(0, 5).map((det) => (
                                        <div key={det.agent} className="flex items-center justify-between gap-2">
                                          <span className="text-[8px] text-zinc-500 truncate max-w-[60px]">{det.agent}</span>
                                          <span className="text-[8px] text-zinc-400 tabular-nums">
                                            {aiChartMode === 'tokens' ? formatTokens(det.tokens)
                                              : aiChartMode === 'cost' ? formatCurrency(det.cost)
                                              : aiChartMode === 'messages' ? det.messages
                                              : det.sessions}
                                          </span>
                                        </div>
                                      ))}
                                      {dayData.details.length > 5 && <div className="text-[7px] text-zinc-600 text-center">+{dayData.details.length - 5} more</div>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center gap-1.5 mt-3" style={{ paddingLeft: 30 }}>
                    <span className="text-[8px] text-zinc-600">Less</span>
                    {[0, 0.2, 0.4, 0.6, 0.8].map(intensity => (
                      <div key={intensity} className="w-[12px] h-[12px] rounded-[3px]" style={{ backgroundColor: cellColor(intensity) }} />
                    ))}
                    <span className="text-[8px] text-zinc-600">More</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })()}

      {/* ── Session History ── */}
      {activeToolIds.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-100">
                Session History
              </h3>
              <p className="text-[11px] text-zinc-600">
                Recent sessions per tool
              </p>
            </div>
          </div>

          {/* Tool pill bar for session filtering */}
          <div className="flex flex-wrap gap-1.5">
            {activeToolIds.map((toolId) => {
              const meta =
                AGENT_CONFIG[toolId] || {
                  name: toolId,
                  color: '#a1a1aa',
                }
              const isActive = sessionTool === toolId
              return (
                <button
                  key={toolId}
                  onClick={() => setSessionTool(toolId)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 ring-1',
                    isActive
                      ? 'bg-zinc-800/80 text-zinc-100 ring-zinc-600/60'
                      : 'text-zinc-500 hover:text-zinc-300 ring-transparent hover:ring-zinc-700/40'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.name}
                </button>
              )
            })}
          </div>

          {/* Session list for selected tool */}
          {sessionTool && (
            <AISessionHistory
              activeToolIds={activeToolIds}
              selectedTool={sessionTool}
            />
          )}
        </div>
      )}

      {/* ── Charts Section ── */}
      {aiAgents.filter((a) => a.status !== 'inactive').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Trend Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  Usage Trend
                </h3>
                <p className="text-[11px] text-zinc-600">
                  {viewMode === 'model'
                    ? 'Per model, daily breakdown'
                    : 'Per tool, daily breakdown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* City/Charts toggle */}
              <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                <button
                  onClick={() => setShowCityView(true)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                    showCityView
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  City
                </button>
                <button
                  onClick={() => setShowCityView(false)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                    !showCityView
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Charts
                </button>
              </div>
              {/* Tool/Model toggle */}
              <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                <button
                  onClick={() => setViewMode('tool')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                    viewMode === 'tool'
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Tool
                </button>
                <button
                  onClick={() => setViewMode('model')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                    viewMode === 'model'
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Model
                </button>
              </div>
              {/* Metric selector */}
              <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-1 ring-1 ring-zinc-800/50">
                {(
                  ['tokens', 'messages', 'sessions', 'cost'] as const
                ).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAiChartMode(mode)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                      aiChartMode === mode
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
                {aiChartMode === 'tokens' && (
                  <>
                    <div className="w-px h-4 bg-zinc-700/60 mx-0.5" />
                    {(
                      ['combined', 'input', 'output'] as const
                    ).map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setTokenDisplayMode(sub)}
                        className={cn(
                          'px-2 py-1 rounded-md text-[10px] font-medium transition-colors duration-150',
                          tokenDisplayMode === sub
                            ? sub === 'input'
                              ? 'bg-blue-500/20 text-blue-400'
                              : sub === 'output'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-zinc-700/50 text-zinc-300'
                            : 'text-zinc-600 hover:text-zinc-400'
                        )}
                      >
                        {sub === 'combined'
                          ? 'All'
                          : sub === 'input'
                            ? 'In'
                            : 'Out'}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* City View */}
          {showCityView && (
            <Suspense
              fallback={
                <GlassCard>
                  <div className="h-[500px] flex items-center justify-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                      <span className="text-sm">Loading cityscape...</span>
                    </div>
                  </div>
                </GlassCard>
              }
            >
              <div className="rounded-xl overflow-hidden ring-1 ring-zinc-800/50">
                <AIUsageCityscape
                  agents={displayedAgents}
                  overview={overview}
                  metric={aiChartMode}
                  tokenDisplayMode={tokenDisplayMode}
                  loading={false}
                  period={effectiveAiPeriod}
                />
              </div>
            </Suspense>
          )}

          {/* Input/Output Ratio */}
          {(() => {
            const activeAgents = displayedAgents.filter(
              (a) => a.status !== 'inactive' && a.tokens > 0
            )
            const totalIn = activeAgents.reduce(
              (s, a) => s + a.tokensIn,
              0
            )
            const totalOut = activeAgents.reduce(
              (s, a) => s + a.tokensOut,
              0
            )
            const total = totalIn + totalOut
            if (total === 0) return null
            const inRatio = total > 0 ? (totalIn / total) * 100 : 0
            const outRatio = total > 0 ? (totalOut / total) * 100 : 0
            const ratioValue =
              totalIn > 0 ? (totalOut / totalIn).toFixed(1) : '\u221E'
            return (
              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 flex items-center justify-center ring-1 ring-blue-500/10">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-zinc-100">
                        Human vs AI Tokens
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        Input (you) vs Output (AI) across all tools
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 rounded-lg ring-1 ring-zinc-800/50">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                      In:Out
                    </span>
                    <span className="text-sm font-bold text-zinc-100 font-mono">
                      1:{ratioValue}
                    </span>
                  </div>
                </div>

                <div className="relative h-10 bg-zinc-900/60 rounded-xl overflow-hidden mb-4 ring-1 ring-zinc-800/40">
                  <div className="absolute inset-0 flex">
                    <div
                      className="h-full flex items-center justify-end px-3 transition-all"
                      style={{
                        width: `${inRatio}%`,
                        background:
                          'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(59,130,246,0.3))',
                      }}
                    >
                      {inRatio > 8 && (
                        <span className="text-[10px] font-semibold text-white drop-shadow-md">
                          {inRatio.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div
                      className="h-full flex items-center px-3 transition-all"
                      style={{
                        width: `${outRatio}%`,
                        background:
                          'linear-gradient(90deg, rgba(16,185,129,0.3), rgba(16,185,129,0.6))',
                      }}
                    >
                      {outRatio > 8 && (
                        <span className="text-[10px] font-semibold text-white drop-shadow-md">
                          {outRatio.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-500/5 rounded-xl p-3 ring-1 ring-blue-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        Human Input
                      </span>
                    </div>
                    <div className="text-sm font-bold text-blue-400">
                      {formatTokens(totalIn)}
                    </div>
                    <div className="text-[9px] text-zinc-700 mt-0.5">
                      {inRatio.toFixed(1)}% of total
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 rounded-xl p-3 ring-1 ring-emerald-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        AI Output
                      </span>
                    </div>
                    <div className="text-sm font-bold text-emerald-400">
                      {formatTokens(totalOut)}
                    </div>
                    <div className="text-[9px] text-zinc-700 mt-0.5">
                      {outRatio.toFixed(1)}% of total
                    </div>
                  </div>
                  <div className="bg-zinc-900/60 rounded-xl p-3 ring-1 ring-zinc-800/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        Avg Ratio
                      </span>
                    </div>
                    <div className="text-sm font-bold text-zinc-100 font-mono">
                      1:
                      {(() => {
                        const agents = activeAgents.filter(
                          (a) => a.tokensIn > 0
                        )
                        if (agents.length === 0) return '\u2014'
                        const avgOut =
                          agents.reduce(
                            (s, a) => s + a.tokensOut / a.tokensIn,
                            0
                          ) / agents.length
                        return avgOut.toFixed(1)
                      })()}
                    </div>
                    <div className="text-[9px] text-zinc-700 mt-0.5">
                      output per 1 input
                    </div>
                  </div>
                </div>

                {activeAgents.length > 1 && (
                  <div className="mt-4 space-y-1.5">
                    <div className="text-[9px] text-zinc-700 uppercase tracking-wider mb-2">
                      Per Tool
                    </div>
                    {activeAgents.map((agent) => {
                      const aIn = agent.tokensIn
                      const aOut = agent.tokensOut
                      const aTotal = aIn + aOut
                      if (aTotal === 0) return null
                      const aRatio =
                        aIn > 0 ? (aOut / aIn).toFixed(1) : '\u221E'
                      const aInPct = (aIn / aTotal) * 100
                      return (
                        <div
                          key={agent.id}
                          className="flex items-center gap-3 p-2 bg-zinc-950/40 rounded-lg ring-1 ring-zinc-800/30"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: agent.color }}
                          />
                          <span className="text-[11px] text-zinc-400 min-w-[80px]">
                            {agent.name}
                          </span>
                          <div className="flex-1 h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                            <div className="h-full flex">
                              <div
                                className="h-full bg-blue-500/60 rounded-l-full"
                                style={{ width: `${aInPct}%` }}
                              />
                              <div
                                className="h-full bg-emerald-500/60 rounded-r-full"
                                style={{ width: `${100 - aInPct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-600 font-mono min-w-[60px] text-right">
                            {formatTokens(aIn)}{' '}
                            <span className="text-zinc-700">/</span>{' '}
                            {formatTokens(aOut)}
                          </span>
                          <span className="text-[10px] text-amber-400 font-mono min-w-[40px] text-right">
                            1:{aRatio}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </GlassCard>
            )
          })()}

          {/* Charts (hidden when city view is active) */}
          {!showCityView && (
            <>
              {/* Per-Tool Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {agentChartsData.map((agentChart) => (
                  <GlassCard key={agentChart.agentId}>
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: agentChart.color }}
                      />
                      <span className="text-[13px] font-medium text-zinc-100">
                        {agentChart.agentName}
                      </span>
                      <span className="text-[11px] text-zinc-600 ml-auto">
                        {agentChart.metricLabel}
                      </span>
                    </div>
                    <div className="h-48">
                      {chartType === 'line' ? (
                        <Line
                          data={agentChart.chartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                              mode: 'index',
                              intersect: false,
                            },
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                backgroundColor: 'rgba(20, 22, 30, 0.85)',
                                titleColor: '#FFFFFF',
                                bodyColor: '#8E95A5',
                                borderColor: 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                cornerRadius: 10,
                                padding: { top: 12, bottom: 12, left: 16, right: 16 },
                                titleFont: { weight: '700' as const, size: 13 },
                                bodyFont: { size: 12 },
                                displayColors: true,
                                boxPadding: 4,
                                usePointStyle: true,
                                callbacks: {
                                  label: (ctx) => {
                                    const val = ctx.parsed?.y ?? 0
                                    if (aiChartMode === 'tokens') {
                                      const mode =
                                        tokenDisplayMode === 'input'
                                          ? ' input'
                                          : tokenDisplayMode === 'output'
                                            ? ' output'
                                            : ''
                                      return ` ${formatTokens(val)}${mode} tokens`
                                    }
                                    if (aiChartMode === 'cost')
                                      return ` ${formatCurrency(val)}`
                                    if (aiChartMode === 'messages')
                                      return ` ${val} messages`
                                    return ` ${val} sessions`
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                  color: '#71717a',
                                  maxTicksLimit: effectiveAiPeriod === 'week' ? 7 : 10,
                                  font: { size: 10, weight: '500' as const },
                                  maxRotation: 0,
                                },
                              },
                              y: {
                                type: logScale
                                  ? ('logarithmic' as const)
                                  : ('linear' as const),
                                grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                                border: { display: false },
                                ticks: {
                                  color: '#71717a',
                                  font: { size: 10 },
                                  padding: 8,
                                  callback: (v) => {
                                    if (v === null) return ''
                                    if (aiChartMode === 'tokens')
                                      return formatTokens(v as number)
                                    if (aiChartMode === 'cost')
                                      return `$${(v as number).toFixed(2)}`
                                    return String(v)
                                  },
                                },
                                ...(logScale
                                  ? {}
                                  : { beginAtZero: true }),
                              },
                            },
                          }}
                        />
                      ) : (
                        <Bar
                          data={{
                            labels: agentChart.chartData.labels,
                            datasets: [{
                              ...agentChart.chartData.datasets[0],
                              backgroundColor: agentChart.color + '80',
                              borderColor: agentChart.color,
                              borderWidth: 1.5,
                              borderRadius: 4,
                              borderSkipped: false,
                              fill: undefined,
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                backgroundColor: 'rgba(20, 22, 30, 0.85)',
                                titleColor: '#FFFFFF',
                                bodyColor: '#8E95A5',
                                borderColor: 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                cornerRadius: 10,
                                padding: { top: 12, bottom: 12, left: 16, right: 16 },
                                callbacks: {
                                  label: (ctx) => {
                                    const val = ctx.parsed?.y ?? 0
                                    if (aiChartMode === 'tokens') {
                                      const mode = tokenDisplayMode === 'input' ? ' input' : tokenDisplayMode === 'output' ? ' output' : ''
                                      return ` ${formatTokens(val)}${mode} tokens`
                                    }
                                    if (aiChartMode === 'cost') return ` ${formatCurrency(val)}`
                                    if (aiChartMode === 'messages') return ` ${val} messages`
                                    return ` ${val} sessions`
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                border: { display: false },
                                ticks: { color: '#71717a', maxTicksLimit: effectiveAiPeriod === 'week' ? 7 : 10, font: { size: 10, weight: '500' as const }, maxRotation: 0 },
                              },
                              y: {
                                type: logScale ? ('logarithmic' as const) : ('linear' as const),
                                grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                                border: { display: false },
                                ticks: { color: '#71717a', font: { size: 10 }, padding: 8, callback: (v) => { if (v === null) return ''; if (aiChartMode === 'tokens') return formatTokens(v as number); if (aiChartMode === 'cost') return `$${(v as number).toFixed(2)}`; return String(v) } },
                                ...(logScale ? {} : { beginAtZero: true }),
                              },
                            },
                            barPercentage: 0.82,
                            categoryPercentage: 0.85,
                          }}
                        />
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Distribution Doughnut */}
              <GlassCard>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-zinc-100">
                        Usage Distribution
                      </h3>
                      <p className="text-[11px] text-zinc-600">
                        {viewMode === 'model' ? 'By model' : 'By tool'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-48 flex items-center justify-center">
                  {agentDistributionData.labels.length > 0 ? (
                    <Doughnut
                      data={agentDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: '#71717a',
                              padding: 16,
                              usePointStyle: true,
                            },
                          },
                          tooltip: {
                            backgroundColor: 'rgba(9, 9, 11, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#a1a1aa',
                            borderColor: '#27272a',
                            borderWidth: 1,
                            callbacks: {
                              label: (ctx) => {
                                const label = ctx.label || ''
                                const value = ctx.parsed || 0
                                if (aiChartMode === 'tokens') {
                                  const labelSuffix =
                                    tokenDisplayMode === 'input'
                                      ? ' input tokens'
                                      : tokenDisplayMode === 'output'
                                        ? ' output tokens'
                                        : ' tokens'
                                  return ` ${label}: ${formatTokens(value)}${labelSuffix}`
                                }
                                if (aiChartMode === 'cost')
                                  return ` ${label}: ${formatCurrency(value)}`
                                if (aiChartMode === 'messages')
                                  return ` ${label}: ${value} messages`
                                return ` ${label}: ${value} sessions`
                              },
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="text-zinc-600 text-sm">No data yet</p>
                  )}
                </div>
              </GlassCard>

              {/* Cost Projection & Free Model Indicator */}
              {(() => {
                const activeAgents = aiAgents.filter(a => a.status !== 'inactive' && a.cost > 0)
                if (activeAgents.length === 0) return null
                const totalCostAll = activeAgents.reduce((s, a) => s + a.cost, 0)
                const byTool = overview?.aiUsage?.byTool || {}
                const dailyCosts: Record<string, number> = {}
                for (const tool of Object.values(byTool) as any[]) {
                  const daily = tool?.daily || {}
                  for (const [dayStr, dayData] of Object.entries(daily) as [string, any][]) {
                    const t = new Date(dayStr).getTime()
                    if (!isSaneDay(t)) continue
                    dailyCosts[dayStr] = (dailyCosts[dayStr] || 0) + (dayData.cost || 0)
                  }
                }
                const dailyCostDays = Object.values(dailyCosts).filter(v => v > 0)
                const sortedCostDays = Object.keys(dailyCosts).sort()
                let costTimeframeDays = 0
                if (sortedCostDays.length >= 2) {
                  const first = new Date(sortedCostDays[0]).getTime()
                  const last = new Date(sortedCostDays[sortedCostDays.length - 1]).getTime()
                  costTimeframeDays = Math.max(1, Math.round((last - first) / 86400000) + 1)
                } else if (sortedCostDays.length === 1) {
                  costTimeframeDays = 1
                } else {
                  costTimeframeDays = effectiveAiPeriod === 'week' ? 7 : effectiveAiPeriod === 'month' ? 30 : 7
                }
                const avgDailyCost = dailyCostDays.length > 0
                  ? dailyCostDays.reduce((s, v) => s + v, 0) / costTimeframeDays
                  : 0
                const projectedMonthly = avgDailyCost * 30
                const projectedYearly = avgDailyCost * 365

                const allModelCosts: Record<string, { cost: number; tokens: number; tool: string }> = {}
                for (const [toolId, toolData] of Object.entries(byTool)) {
                  const modelDaily = (toolData as any)?.modelDaily || {}
                  for (const [modelName, dayRecords] of Object.entries(modelDaily)) {
                    if (!allModelCosts[modelName]) allModelCosts[modelName] = { cost: 0, tokens: 0, tool: toolId }
                    for (const dayData of Object.values(dayRecords as Record<string, any>)) {
                      allModelCosts[modelName].cost += dayData.cost || 0
                      allModelCosts[modelName].tokens += dayData.tokens || 0
                    }
                  }
                }
                const freeModels = Object.entries(allModelCosts)
                  .filter(([, v]) => v.cost === 0 && v.tokens > 0)
                  .map(([name, v]) => ({ name, tokens: v.tokens, tool: AGENT_CONFIG[v.tool]?.name || v.tool }))

                return (
                  <GlassCard>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold text-zinc-100">
                          Cost Insights
                        </h3>
                        <p className="text-[11px] text-zinc-600 mt-1">
                          Projections based on {dailyCostDays.length} active day{dailyCostDays.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50">
                        <div className="text-base font-bold text-rose-400 tabular-nums">{formatCurrency(avgDailyCost)}</div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Avg/Day</div>
                      </div>
                      <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50">
                        <div className="text-base font-bold text-amber-400 tabular-nums">{formatCurrency(projectedMonthly)}</div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Projected Month</div>
                      </div>
                      <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50">
                        <div className="text-base font-bold text-orange-400 tabular-nums">{formatCurrency(projectedYearly)}</div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Projected Year</div>
                      </div>
                      <div className="bg-zinc-950/60 rounded-xl p-3 text-center ring-1 ring-zinc-800/50">
                        <div className="text-base font-bold text-emerald-400 tabular-nums">{freeModels.length}</div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Free Models</div>
                      </div>
                    </div>
                    {freeModels.length > 0 && (
                      <div className="p-3 bg-emerald-500/5 rounded-xl ring-1 ring-emerald-500/15">
                        <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold mb-2">Free Models (no cost recorded)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {freeModels.map(m => (
                            <span key={m.name} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-[10px] text-emerald-300 ring-1 ring-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="truncate max-w-[140px]" title={m.name}>{m.name}</span>
                              <span className="text-emerald-500/60">({formatTokens(m.tokens)})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )
              })()}

              {/* Model Usage Timeline */}
              {(() => {
                const activeAgents = aiAgents.filter(
                  (a) => a.status !== 'inactive' && a.tokens > 0
                )
                const allModelNames = new Set<string>()
                for (const agent of activeAgents) {
                  const modelDaily =
                    overview?.aiUsage?.byTool?.[agent.id]?.modelDaily || {}
                  for (const modelName of Object.keys(modelDaily)) {
                    allModelNames.add(modelName)
                  }
                }
                if (allModelNames.size === 0) return null

                let numDays =
                  effectiveAiPeriod === 'week'
                    ? 7
                    : effectiveAiPeriod === 'month'
                      ? 30
                      : 7
                let modelAnchorDate: Date | null = null
                if (effectiveAiPeriod === 'all') {
                  const byTool = overview?.aiUsage?.byTool || {}
                  let allDates: string[] = []
                  let minDate = Infinity
                  for (const tool of Object.values(byTool) as any[]) {
                    const toolDates = Object.keys(tool?.daily || {})
                    for (const d of toolDates) {
                      const t = new Date(d).getTime()
                      if (!isSaneDay(t)) continue
                      allDates.push(d)
                      if (t < minDate) minDate = t
                    }
                  }
                  if (allDates.length > 0) {
                    const sorted = allDates.sort()
                    const span =
                      Math.ceil(
                        (new Date(sorted[sorted.length - 1]).getTime() -
                          new Date(sorted[0]).getTime()) /
                          86400000
                      ) + 14
                    numDays = Math.min(365, Math.max(span, 60))
                    if (minDate < Infinity) {
                      modelAnchorDate = subDays(new Date(minDate), 3)
                    }
                  } else {
                    numDays = 60
                  }
                }
                const periodDays = eachDayOfInterval({
                  start: modelAnchorDate || subDays(new Date(), numDays - 1),
                  end: new Date(),
                })
                const modelColors = [
                  '#3b82f6',
                  '#f97316',
                  '#22c55e',
                  '#a855f7',
                  '#f59e0b',
                  '#ef4444',
                  '#06b6d4',
                  '#ec4899',
                  '#14b8a6',
                  '#8b5cf6',
                ]

                const metricField =
                  aiChartMode === 'tokens'
                    ? tokenDisplayMode === 'input'
                      ? 'tokens_in'
                      : tokenDisplayMode === 'output'
                        ? 'tokens_out'
                        : 'tokens'
                    : aiChartMode === 'messages'
                      ? 'messageCount'
                      : aiChartMode === 'cost'
                        ? 'cost'
                        : 'sessions'
                const metricLabel =
                  aiChartMode === 'tokens'
                    ? tokenDisplayMode === 'input'
                      ? 'Input Tokens'
                      : tokenDisplayMode === 'output'
                        ? 'Output Tokens'
                        : 'Tokens'
                    : aiChartMode.charAt(0).toUpperCase() +
                      aiChartMode.slice(1)

                const allModelsMap = new Map<string, { agent: string; model: string; color: string }>()
                for (const agent of activeAgents) {
                  const modelDaily =
                    overview?.aiUsage?.byTool?.[agent.id]?.modelDaily || {}
                  for (const model of Object.keys(modelDaily)) {
                    if (!allModelsMap.has(model)) {
                      allModelsMap.set(model, {
                        agent: agent.name,
                        model,
                        color: agent.color,
                      })
                    }
                  }
                }
                const allModels = Array.from(allModelsMap.values())

                const datasets = allModels
                  .filter(m => selectedTimelineModels.length === 0 || selectedTimelineModels.includes(m.model))
                  .slice(0, 10)
                  .map((entry, idx) => {
                  const byTool = overview?.aiUsage?.byTool || {}
                  const modelColor = modelColors[idx % modelColors.length]
                  return {
                    label:
                      entry.model.length > 25
                        ? entry.model.slice(0, 22) + '...'
                        : entry.model,
                    data: periodDays.map((d) => {
                      const dayStr = format(d, 'yyyy-MM-dd')
                      let total = 0
                      for (const tool of Object.values(byTool) as any[]) {
                        const dayData = tool?.modelDaily?.[entry.model]?.[dayStr]
                        if (!dayData) continue
                        if (aiChartMode === 'tokens') {
                          if (tokenDisplayMode === 'input') total += dayData.tokens_in || 0
                          else if (tokenDisplayMode === 'output') total += dayData.tokens_out || 0
                          else total += dayData.tokens || 0
                        } else if (aiChartMode === 'messages') total += dayData.messageCount || 0
                        else if (aiChartMode === 'sessions') total += dayData.sessions || 0
                        else if (aiChartMode === 'cost') total += dayData.cost || 0
                      }
                      return total
                    }),
                    backgroundColor: modelColor + '60',
                    borderColor: modelColor,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: false,
                  }
                })

                return (
                  <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-[13px] font-semibold text-zinc-100">
                            Model Usage Timeline
                          </h3>
                          <p className="text-[11px] text-zinc-600">
                            Per-model {metricLabel.toLowerCase()} \u2014 all
                            tools
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                        <button
                          onClick={() => setSelectedTimelineModels([])}
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150',
                            selectedTimelineModels.length === 0
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'text-zinc-500 hover:text-zinc-300'
                          )}
                        >
                          All
                        </button>
                        {allModels.slice(0, 6).map((m, i) => {
                          const isActive = selectedTimelineModels.length === 0 || selectedTimelineModels.includes(m.model)
                          return (
                            <button
                              key={m.model}
                              onClick={() => {
                                setSelectedTimelineModels(prev => {
                                  if (prev.includes(m.model)) return prev.filter(x => x !== m.model)
                                  return [...prev, m.model]
                                })
                              }}
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-150 max-w-[100px] truncate',
                                isActive
                                  ? 'bg-zinc-700/60 text-zinc-200'
                                  : 'text-zinc-600 hover:text-zinc-400'
                              )}
                              title={m.model}
                            >
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: modelColors[i % modelColors.length] }} />
                                {m.model.length > 12 ? m.model.slice(0, 10) + '...' : m.model}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {(() => {
                      const winnerPerDay = periodDays.map((_, i) => {
                        let best = 0
                        let bestIdx = -1
                        datasets.forEach((ds, di) => {
                          const v = ds.data[i] || 0
                          if (v > best) {
                            best = v
                            bestIdx = di
                          }
                        })
                        return { idx: bestIdx, total: best }
                      })
                      const runs: {
                        start: number
                        end: number
                        idx: number
                        total: number
                      }[] = []
                      for (let i = 0; i < winnerPerDay.length; i++) {
                        const w = winnerPerDay[i]
                        if (w.idx < 0 || w.total <= 0) continue
                        const last = runs[runs.length - 1]
                        if (last && last.idx === w.idx && last.end === i - 1) {
                          last.end = i
                          last.total += w.total
                        } else {
                          runs.push({
                            start: i,
                            end: i,
                            idx: w.idx,
                            total: w.total,
                          })
                        }
                      }
                      if (runs.length === 0 || runs.length > 6) return null
                      const grandTotal = runs.reduce(
                        (s, r) => s + r.total,
                        0
                      )
                      const fmtDay = (i: number) =>
                        format(
                          periodDays[i],
                          numDays <= 7 ? 'EEE' : 'MMM dd'
                        )
                      return (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {runs.map((r) => {
                            const ds = datasets[r.idx]
                            return (
                              <span
                                key={`${r.start}-${r.end}-${ds.label}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/60 ring-1 ring-zinc-800/40 text-[10px] text-zinc-400"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: ds.backgroundColor,
                                  }}
                                />
                                <span className="font-medium text-zinc-300 truncate max-w-[160px]">
                                  {ds.label}
                                </span>
                                <span>
                                  {fmtDay(r.start)}
                                  {r.end > r.start
                                    ? ` - ${fmtDay(r.end)}`
                                    : ''}
                                </span>
                                <span className="text-zinc-500">
                                  ·{' '}
                                  {Math.round(
                                    (r.total / grandTotal) * 100
                                  )}
                                  %
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      )
                    })()}
                    <div className="h-56">
                      <Bar
                        data={{
                          labels: periodDays.map((d) =>
                            format(
                              d,
                              numDays <= 7 ? 'EEE' : 'MMM dd'
                            )
                          ),
                          datasets,
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: true,
                              position: 'bottom',
                              labels: {
                                color: '#71717a',
                                font: { size: 10 },
                                boxWidth: 12,
                                padding: 12,
                                usePointStyle: true,
                              },
                            },
                            tooltip: {
                              backgroundColor: 'rgba(20, 22, 30, 0.85)',
                              titleColor: '#FFFFFF',
                              bodyColor: '#8E95A5',
                              borderColor: 'rgba(255,255,255,0.12)',
                              borderWidth: 1,
                              cornerRadius: 10,
                              padding: { top: 12, bottom: 12, left: 16, right: 16 },
                              usePointStyle: true,
                              callbacks: {
                                label: (ctx) => {
                                  const val = ctx.parsed.y || 0
                                  if (aiChartMode === 'tokens') {
                                    const mode =
                                      tokenDisplayMode === 'input'
                                        ? ' input'
                                        : tokenDisplayMode === 'output'
                                          ? ' output'
                                          : ''
                                    return ` ${formatTokens(val)}${mode} tokens`
                                  }
                                  if (aiChartMode === 'cost')
                                    return ` ${formatCurrency(val)}`
                                  if (aiChartMode === 'messages')
                                    return ` ${val} messages`
                                  return ` ${val} sessions`
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                maxTicksLimit: numDays <= 7 ? 7 : 12,
                                font: { size: 10, weight: '500' as const },
                                maxRotation: 0,
                              },
                              grid: { display: false },
                              border: { display: false },
                            },
                            y: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                font: { size: 10 },
                                padding: 8,
                                callback: (v) => {
                                  if (aiChartMode === 'tokens')
                                    return formatTokens(v as number)
                                  if (aiChartMode === 'cost')
                                    return `$${(v as number).toFixed(2)}`
                                  return String(v)
                                },
                              },
                              grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                              border: { display: false },
                              beginAtZero: true,
                            },
                          },
                          barPercentage: 0.82,
                          categoryPercentage: 0.85,
                        }}
                      />
                    </div>
                  </GlassCard>
                )
              })()}

              {/* Tool Usage Timeline */}
              {(() => {
                const byToolAll = (overview?.aiUsage?.byTool ||
                  {}) as Record<string, any>
                const toolIds = Object.keys(byToolAll).filter((tid) => {
                  const daily = byToolAll[tid]?.daily || {}
                  return Object.keys(daily).length > 0
                })
                if (toolIds.length === 0) return null

                let numDays =
                  effectiveAiPeriod === 'week'
                    ? 7
                    : effectiveAiPeriod === 'month'
                      ? 30
                      : 7
                let toolAnchorDate: Date | null = null
                if (effectiveAiPeriod === 'all') {
                  let allDates: string[] = []
                  let minDate = Infinity
                  for (const tid of toolIds) {
                    const toolDates = Object.keys(
                      byToolAll[tid]?.daily || {}
                    )
                    for (const d of toolDates) {
                      const t = new Date(d).getTime()
                      if (!isSaneDay(t)) continue
                      allDates.push(d)
                      if (t < minDate) minDate = t
                    }
                  }
                  if (allDates.length > 0) {
                    const sorted = allDates.sort()
                    const span =
                      Math.ceil(
                        (new Date(sorted[sorted.length - 1]).getTime() -
                          new Date(sorted[0]).getTime()) /
                          86400000
                      ) + 14
                    numDays = Math.min(365, Math.max(span, 60))
                    if (minDate < Infinity) {
                      toolAnchorDate = subDays(new Date(minDate), 3)
                    }
                  } else {
                    numDays = 60
                  }
                }
                const periodDays = eachDayOfInterval({
                  start: toolAnchorDate || subDays(new Date(), numDays - 1),
                  end: new Date(),
                })

                const toolName = (tid: string) => {
                  if (tid.startsWith('model-')) return tid.slice(6)
                  return AGENT_CONFIG[tid]?.name || tid
                }
                const toolColors = [
                  '#3b82f6',
                  '#f97316',
                  '#22c55e',
                  '#a855f7',
                  '#f59e0b',
                  '#ef4444',
                  '#06b6d4',
                  '#ec4899',
                  '#14b8a6',
                  '#8b5cf6',
                ]

                const toolMetricField =
                  aiChartMode === 'tokens'
                    ? tokenDisplayMode === 'input'
                      ? 'tokens_in'
                      : tokenDisplayMode === 'output'
                        ? 'tokens_out'
                        : 'tokens'
                    : aiChartMode === 'messages'
                      ? 'messageCount'
                      : aiChartMode === 'cost'
                        ? 'cost'
                        : 'sessions'
                const toolMetricLabel =
                  aiChartMode === 'tokens'
                    ? tokenDisplayMode === 'input'
                      ? 'Input Tokens'
                      : tokenDisplayMode === 'output'
                        ? 'Output Tokens'
                        : 'Tokens'
                    : aiChartMode.charAt(0).toUpperCase() +
                      aiChartMode.slice(1)

                const toolDatasets = toolIds
                  .slice(0, 10)
                  .map((tid, idx) => {
                    const color =
                      toolColors[idx % toolColors.length]
                    return {
                      label: toolName(tid),
                      data: periodDays.map((d) => {
                        const dayStr = format(d, 'yyyy-MM-dd')
                        const dayData =
                          byToolAll[tid]?.daily?.[dayStr]
                        if (!dayData) return 0
                        return Number(dayData[toolMetricField]) || 0
                      }),
                      backgroundColor: color + '60',
                      borderColor: color,
                      borderWidth: 1.5,
                      borderRadius: 4,
                      borderSkipped: false,
                    }
                  })

                const toolWinnerPerDay = periodDays.map((_, i) => {
                  let best = 0
                  let bestIdx = -1
                  toolDatasets.forEach((ds, di) => {
                    const v = ds.data[i] || 0
                    if (v > best) {
                      best = v
                      bestIdx = di
                    }
                  })
                  return { idx: bestIdx, total: best }
                })
                const toolRuns: {
                  start: number
                  end: number
                  idx: number
                  total: number
                }[] = []
                for (let i = 0; i < toolWinnerPerDay.length; i++) {
                  const w = toolWinnerPerDay[i]
                  if (w.idx < 0 || w.total <= 0) continue
                  const last = toolRuns[toolRuns.length - 1]
                  if (
                    last &&
                    last.idx === w.idx &&
                    last.end === i - 1
                  ) {
                    last.end = i
                    last.total += w.total
                  } else {
                    toolRuns.push({
                      start: i,
                      end: i,
                      idx: w.idx,
                      total: w.total,
                    })
                  }
                }
                const toolGrandTotal = toolRuns.reduce(
                  (s, r) => s + r.total,
                  0
                )
                const toolFmtDay = (i: number) =>
                  format(
                    periodDays[i],
                    numDays <= 7 ? 'EEE' : 'MMM dd'
                  )

                return (
                  <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <h3 className="text-[13px] font-semibold text-zinc-100">
                            Tool Usage Timeline
                          </h3>
                          <p className="text-[11px] text-zinc-600">
                            Per-tool {toolMetricLabel.toLowerCase()}{' '}
                            \u2014 all models
                          </p>
                        </div>
                      </div>
                    </div>
                    {toolRuns.length > 0 &&
                      toolRuns.length <= 6 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {toolRuns.map((r) => {
                            const ds = toolDatasets[r.idx]
                            return (
                              <span
                                key={`${r.start}-${r.end}-${ds.label}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/60 ring-1 ring-zinc-800/40 text-[10px] text-zinc-400"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: ds.backgroundColor,
                                  }}
                                />
                                <span className="font-medium text-zinc-300 truncate max-w-[160px]">
                                  {ds.label}
                                </span>
                                <span>
                                  {toolFmtDay(r.start)}
                                  {r.end > r.start
                                    ? ` - ${toolFmtDay(r.end)}`
                                    : ''}
                                </span>
                                <span className="text-zinc-500">
                                  ·{' '}
                                  {Math.round(
                                    (r.total / toolGrandTotal) * 100
                                  )}
                                  %
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    <div className="h-56">
                      <Bar
                        data={{
                          labels: periodDays.map((d) =>
                            format(
                              d,
                              numDays <= 7 ? 'EEE' : 'MMM dd'
                            )
                          ),
                          datasets: toolDatasets,
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: true,
                              position: 'bottom',
                              labels: {
                                color: '#71717a',
                                font: { size: 10 },
                                boxWidth: 12,
                                padding: 12,
                                usePointStyle: true,
                              },
                            },
                            tooltip: {
                              backgroundColor: 'rgba(20, 22, 30, 0.85)',
                              titleColor: '#FFFFFF',
                              bodyColor: '#8E95A5',
                              borderColor: 'rgba(255,255,255,0.12)',
                              borderWidth: 1,
                              cornerRadius: 10,
                              padding: {
                                top: 12,
                                bottom: 12,
                                left: 16,
                                right: 16,
                              },
                              usePointStyle: true,
                              callbacks: {
                                label: (ctx) => {
                                  const val = ctx.parsed.y || 0
                                  if (aiChartMode === 'tokens') {
                                    const mode =
                                      tokenDisplayMode === 'input'
                                        ? ' input'
                                        : tokenDisplayMode === 'output'
                                          ? ' output'
                                          : ''
                                    return ` ${formatTokens(
                                      val
                                    )}${mode} tokens`
                                  }
                                  if (aiChartMode === 'cost')
                                    return ` ${formatCurrency(val)}`
                                  if (aiChartMode === 'messages')
                                    return ` ${val} messages`
                                  return ` ${val} sessions`
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                maxTicksLimit: numDays <= 7 ? 7 : 12,
                                font: {
                                  size: 10,
                                  weight: '500' as const,
                                },
                                maxRotation: 0,
                              },
                              grid: { display: false },
                              border: { display: false },
                            },
                            y: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                font: { size: 10 },
                                padding: 8,
                                callback: (v) => {
                                  if (aiChartMode === 'tokens')
                                    return formatTokens(v as number)
                                  if (aiChartMode === 'cost')
                                    return `$${(v as number).toFixed(2)}`
                                  return String(v)
                                },
                              },
                              grid: {
                                color: 'rgba(39,39,42,0.5)',
                                drawTicks: false,
                              },
                              border: { display: false },
                              beginAtZero: true,
                            },
                          },
                          barPercentage: 0.82,
                          categoryPercentage: 0.85,
                        }}
                      />
                    </div>
                  </GlassCard>
                )
              })()}

              {/* Multi-Agent Comparison Chart */}
              {(() => {
                const activeForCompare = viewMode === 'model'
                  ? displayedAgents.filter((a) => a.status !== 'inactive' && a.tokens > 0)
                  : aiAgents.filter((a) => a.status !== 'inactive' && a.tokens > 0)
                if (activeForCompare.length < 1) return null
                return (
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold text-zinc-100">
                          Compare {viewMode === 'model' ? 'Models' : 'AI Tools'}
                        </h3>
                        <p className="text-[11px] text-zinc-600">
                          Grouped daily breakdown
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-600 bg-zinc-900/60 px-2 py-1 rounded-lg ring-1 ring-zinc-800/40">
                      {timeLock
                        ? 'All Time'
                        : selectedPeriod === 'today'
                          ? 'Today'
                          : selectedPeriod === 'week'
                            ? 'This Week'
                            : selectedPeriod === '7day'
                              ? '7 Days'
                              : selectedPeriod === 'month'
                                ? 'This Month'
                                : selectedPeriod === '30day'
                                  ? '30 Days'
                                  : 'All Time'}{' '}
                      ·{' '}
                      {aiChartMode.charAt(0).toUpperCase() +
                        aiChartMode.slice(1)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {activeForCompare.map((agent) => (
                        <label
                          key={agent.id}
                          className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/60 rounded-lg cursor-pointer hover:bg-zinc-800/60 transition-colors duration-150 ring-1 ring-zinc-800/40"
                        >
                          <input
                            type="checkbox"
                            checked={compareAgents.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCompareAgents((prev) => [
                                  ...prev,
                                  agent.id,
                                ])
                              } else {
                                setCompareAgents((prev) =>
                                  prev.filter((id) => id !== agent.id)
                                )
                              }
                            }}
                            className="w-3 h-3 rounded border-zinc-600"
                          />
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          <span className="text-[11px] text-zinc-400">
                            {agent.name}
                          </span>
                        </label>
                      ))}
                  </div>

                  <div className="h-56">
                    {(() => {
                      let numDays =
                        effectiveAiPeriod === 'week'
                          ? 7
                          : effectiveAiPeriod === 'month'
                            ? 30
                            : 7
                      let anchorDate: Date | null = null
                      if (effectiveAiPeriod === 'all') {
                        const byTool =
                          overview?.aiUsage?.byTool || {}
                        let allDates: string[] = []
                        let minDate = Infinity
                        for (const toolId of Object.keys(byTool)) {
                          const toolDates = Object.keys(
                            byTool[toolId]?.daily || {}
                          )
                          for (const d of toolDates) {
                            const t = new Date(d).getTime()
                            if (!isSaneDay(t)) continue
                            allDates.push(d)
                            if (t < minDate) minDate = t
                          }
                        }
                        if (allDates.length > 0) {
                          const sorted = allDates.sort()
                          const span =
                            Math.ceil(
                              (new Date(
                                sorted[sorted.length - 1]
                              ).getTime() -
                                new Date(sorted[0]).getTime()) /
                                  86400000
                            ) + 14
                          numDays = Math.min(
                            365,
                            Math.max(span, 60)
                          )
                          if (minDate < Infinity) {
                            anchorDate = subDays(new Date(minDate), 3)
                          }
                        } else {
                          numDays = 60
                        }
                      }
                      const periodDays = eachDayOfInterval({
                        start: anchorDate || subDays(new Date(), numDays - 1),
                        end: new Date(),
                      })
                      const labels = periodDays.map((d) =>
                        format(
                          d,
                          numDays <= 7 ? 'EEE' : 'MMM dd'
                        )
                      )

                      const selected = activeForCompare.filter(
                        (a) => compareAgents.includes(a.id)
                      )
                      const datasets = selected.map((agent) => {
                        let data: number[]
                        if (viewMode === 'model') {
                          const modelName = agent.models[0]
                          if (!modelName) return { label: agent.name, data: [], backgroundColor: agent.color + 'CC', borderColor: agent.color, borderWidth: 1, borderRadius: 2 }
                          data = periodDays.map((d) => {
                            const dayStr = format(d, 'yyyy-MM-dd')
                            const byTool = overview?.aiUsage?.byTool || {}
                            let total = 0
                            for (const tool of Object.values(byTool) as any[]) {
                              const dayData = tool?.modelDaily?.[modelName]?.[dayStr]
                              if (!dayData) continue
                              if (aiChartMode === 'tokens') {
                                if (tokenDisplayMode === 'input') total += dayData.tokens_in || 0
                                else if (tokenDisplayMode === 'output') total += dayData.tokens_out || 0
                                else total += dayData.tokens || 0
                              } else if (aiChartMode === 'messages') total += dayData.messageCount || 0
                              else if (aiChartMode === 'sessions') total += dayData.sessions || 0
                              else if (aiChartMode === 'cost') total += dayData.cost || 0
                            }
                            return total
                          })
                        } else {
                          data = periodDays.map((d) => {
                            const dayStr = format(d, 'yyyy-MM-dd')
                            const dayData =
                              overview?.aiUsage?.byTool?.[
                                agent.id
                              ]?.daily?.[dayStr]
                            if (!dayData) return 0
                            if (aiChartMode === 'tokens') {
                              if (tokenDisplayMode === 'input')
                                return dayData.tokens_in || 0
                              if (tokenDisplayMode === 'output')
                                return dayData.tokens_out || 0
                              return dayData.tokens || 0
                            }
                            if (aiChartMode === 'messages')
                              return dayData.messageCount || 0
                            if (aiChartMode === 'sessions')
                              return dayData.sessions || 0
                            if (aiChartMode === 'cost')
                              return dayData.cost || 0
                            return 0
                          })
                        }
                        if (excludeOutliers)
                          data = filterOutlierValues(data)
                        if (logScale)
                          data = data.map((v) =>
                            v === 0 ? null : v
                          ) as number[]
                        return {
                          label: agent.name,
                          data,
                          backgroundColor: agent.color + 'CC',
                          borderColor: agent.color,
                          borderWidth: 1,
                          borderRadius: 2,
                        }
                      })

                      return (
                        <Bar
                          data={{ labels, datasets }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  color: '#71717a',
                                  padding: 12,
                                  usePointStyle: true,
                                  font: { size: 11 },
                                },
                              },
                              tooltip: {
                                backgroundColor:
                                  'rgba(20, 22, 30, 0.85)',
                                titleColor: '#FFFFFF',
                                bodyColor: '#8E95A5',
                                borderColor: 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                cornerRadius: 10,
                                padding: { top: 12, bottom: 12, left: 16, right: 16 },
                                usePointStyle: true,
                                callbacks: {
                                  label: (ctx) => {
                                    const val =
                                      ctx.parsed.y || 0
                                    if (aiChartMode === 'tokens') {
                                      const mode =
                                        tokenDisplayMode ===
                                        'input'
                                          ? ' input'
                                          : tokenDisplayMode ===
                                              'output'
                                            ? ' output'
                                            : ''
                                      return ` ${ctx.dataset.label}: ${formatTokens(val)}${mode} tokens`
                                    }
                                    if (aiChartMode === 'cost')
                                      return ` ${ctx.dataset.label}: ${formatCurrency(val)}`
                                    if (aiChartMode === 'messages')
                                      return ` ${ctx.dataset.label}: ${val} messages`
                                    return ` ${ctx.dataset.label}: ${val} sessions`
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                  color: '#71717a',
                                  maxTicksLimit: 12,
                                  font: { size: 10, weight: '500' as const },
                                  maxRotation: 0,
                                },
                              },
                              y: {
                                type: logScale
                                  ? ('logarithmic' as const)
                                  : ('linear' as const),
                                grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                                border: { display: false },
                                ticks: {
                                  color: '#71717a',
                                  font: { size: 10 },
                                  padding: 8,
                                  callback: (v) => {
                                    if (v === null) return ''
                                    if (aiChartMode === 'tokens')
                                      return formatTokens(
                                        v as number
                                      )
                                    if (aiChartMode === 'cost')
                                      return `$${(v as number).toFixed(2)}`
                                    return String(v)
                                  },
                                },
                                ...(logScale
                                  ? {}
                                  : { beginAtZero: true }),
                              },
                            },
                            barPercentage: 0.82,
                            categoryPercentage: 0.85,
                          }}
                        />
                      )
                    })()}
                  </div>
                </GlassCard>
                )
              })()}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
