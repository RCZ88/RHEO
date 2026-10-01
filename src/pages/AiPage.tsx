import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { getToastDurationMs, isSticky } from '../lib/toastDuration';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, BookOpen, Newspaper, Bell, History, Library, Brain, Sparkles, ListTodo, Bug, MessageSquare, Eye, Download } from 'lucide-react';
import { useCanvasState } from '../hooks/useCanvasState';
import { loadDefaultSetup, BUILTIN_DEFAULT_SETUP } from '../services/canvasPersistence';
import type { CardType } from '../types/canvas';
import type { Intent } from '../services/intentParser';
import { parseChecklist } from '../services/planningParser';
import { getProviderBadge } from '../components/AiProviderSelectModal';
import type { DataState, Goal, GoalDay, Mode, LongTermGoal } from '../components/ai/types';
import { useAiChat } from '../hooks/useAiChat';
import { useAutomationActions } from '../components/ai/automations/lib/useAutomationActions';
import { parseNlAutomation, stripAutomationBlock } from '../components/ai/automations/lib/nlParser';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { useAutoSync } from '../hooks/useAutoSync';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { DebugVaultPanel } from '../components/ai/DebugVaultPanel';
import { AiContextPanel } from '../components/ai/AiContextPanel';
import type { CardAction } from '../components/ai/chat/parsed';
import type { ChatSuggestion } from '../components/ai/chat/ChatEmptyState';
import { useAiActions } from '../hooks/useAiActions';
import { useDynamicUI } from '../hooks/useDynamicUI';
import { actionBus } from '../components/ai/lib/actionBus';
import type { ActionType } from '../components/ai/tokens';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderCellular } from '../lib/renderers/cellular';
import { startPhaseClock } from '../lib/currentPhase';

// Eagerly load the page-shell + deck styles. The dk-* classes (dk-root,
// dk-topbar, dk-chip, ...) are used by AiPage in every mode, but deck.css is
// also imported by the lazy AiPageDeck — without this import the shell renders
// unstyled on first load until DECK mode happens to inject the CSS.
import '../components/ai/deck/deck.css';

// Lazy-loaded canvas components (imported on demand when canvas mode is active)
import '../components/ai/canvas/canvas.css';

// Lazy-loaded mode-specific components (only loaded when needed)
const AiPageDeck = lazy(() => import('../components/ai/deck/AiPageDeck').then(m => ({ default: m.AiPageDeck })));
const CanvasContainer = lazy(() => import('../components/ai/canvas/CanvasContainer').then(m => ({ default: m.CanvasContainer })));
const CompositionPanel = lazy(() => import('../components/ai/compositions/CompositionPanel').then(m => ({ default: m.CompositionPanel })));
const FocusBoard = lazy(() => import('../components/ai/focus/FocusBoard').then(m => ({ default: m.FocusBoard })));
const PlanBoard = lazy(() => import('../components/ai/plan/PlanBoard').then(m => ({ default: m.PlanBoard })));
const ReflectFeed = lazy(() => import('../components/ai/reflect/ReflectFeed').then(m => ({ default: m.ReflectFeed })));
const SummaryGrid = lazy(() => import('../components/ai/summary/SummaryGrid').then(m => ({ default: m.SummaryGrid })));
const DailyDigestBoard = lazy(() => import('../components/ai/digest/DailyDigestBoard').then(m => ({ default: m.DailyDigestBoard })));
const ConnectorsPanel = lazy(() => import('../components/ai/connectors/ConnectorsPanel').then(m => ({ default: m.ConnectorsPanel })));
const AutomationList = lazy(() => import('../components/ai/automations/AutomationList').then(m => ({ default: m.AutomationList })));
const AIFeaturesModal = lazy(() => import('../components/AIFeaturesModal').then(m => ({ default: m.AIFeaturesModal })));
const AiProviderSelectModal = lazy(() => import('../components/AiProviderSelectModal').then(m => ({ default: m.AiProviderSelectModal })));
const ConnectorSetupModal = lazy(() => import('../components/ConnectorSetupModal').then(m => ({ default: m.ConnectorSetupModal })));
const GoalsRemindersDrawer = lazy(() => import('../components/ai/reminders/GoalsRemindersDrawer').then(m => ({ default: m.GoalsRemindersDrawer })));
const ChatHistory = lazy(() => import('../components/ai/chat/ChatHistory').then(m => ({ default: m.ChatHistory })));
const ChatLibrary = lazy(() => import('../components/ai/chat/ChatLibrary').then(m => ({ default: m.ChatLibrary })));
const BrainSurface = lazy(() => import('../components/ai/chat/BrainSurface').then(m => ({ default: m.BrainSurface })));
const ChatExportBridge = lazy(() => import('../components/ai/chat/ChatExportBridge').then(m => ({ default: m.ChatExportBridge })));
const ActionOverlay = lazy(() => import('../components/ai/primitives/ActionOverlay').then(m => ({ default: m.ActionOverlay })));
const AiBuildingIndicator = lazy(() => import('../components/ai/primitives/AiBuildingIndicator').then(m => ({ default: m.AiBuildingIndicator })));
const CanvasGrid = lazy(() => import('../components/ai/canvas/CanvasGrid').then(m => ({ default: m.CanvasGrid })));
const CanvasInput = lazy(() => import('../components/ai/canvas/CanvasInput').then(m => ({ default: m.CanvasInput })));
const CommandPalette = lazy(() => import('../components/ai/canvas/CommandPalette').then(m => ({ default: m.CommandPalette })));
const DailyPlannerCard = lazy(() => import('../components/ai/canvas/cards/DailyPlannerCard').then(m => ({ default: m.DailyPlannerCard })));
const WeeklyScheduleCard = lazy(() => import('../components/ai/canvas/cards/WeeklyScheduleCard').then(m => ({ default: m.WeeklyScheduleCard })));
const DeadlineTrackerCard = lazy(() => import('../components/ai/canvas/cards/DeadlineTrackerCard').then(m => ({ default: m.DeadlineTrackerCard })));
const SlashCommandManager = lazy(() => import('../components/ai/chat/SlashCommandManager').then(m => ({ default: m.SlashCommandManager })));

function LazyFallback() {
  return <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">Loading...</div>
}

// Toast system for transient feedback
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }
let toastCounter = 0;

function getToday() { return new Date().toISOString().slice(0, 10); }

function timeAgoStr(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function determineMode(goals: Goal[]): Mode {
  if (goals.length === 0) return 'morning';
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 20) return 'review';
  const allDone = goals.every(g => g.status === 'done' || g.status === 'missed');
  if (allDone && goals.length > 0) return 'review';
  return 'in-progress';
}

const modeLabelMap: Record<Mode, string> = {
  morning: 'Morning Planning',
  'in-progress': 'In Progress',
  review: 'Evening Review',
};

export function AiPage() {
  useEffect(() => { startPhaseClock(); }, []);
  const today = getToday();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [review, setReview] = useState<string | null>(null);
  const [goalsState, setGoalsState] = useState<DataState>('loading');
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Goal[]>([]);
  const [planGoals, setPlanGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [planningNotes, setPlanningNotes] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const navigate = useNavigate();
  const openSettings = useCallback(() => {
    try { localStorage.setItem('settings-activeTab', 'ai'); } catch (e) { console.error('[AiPage] save activeTab:', e); }
    navigate('/settings');
  }, [navigate]);

  const [digestTopics, setDigestTopics] = useState<any[]>([]);
  const [digestState, setDigestState] = useState<DataState>('loading');
  const [digestReason, setDigestReason] = useState<string | null>(null);
  const digestPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [aiProviders, setAiProviders] = useState<Array<{ id: string; label: string; models: string[]; enabled: boolean }>>([]);
  const [aiRouting, setAiRouting] = useState<Record<string, { providerId: string; model: string; smallProviderId?: string; smallModel?: string } | null>>({});
  const [configuringFeature, setConfiguringFeature] = useState<'default' | 'researchDigest' | 'goalAssistant' | 'vision' | null>(null);
  const [aiSubPage, setAiSubPage] = useState<'assistant' | 'vault' | 'context' | 'brain'>('assistant');
  const [showConnectorSetup, setShowConnectorSetup] = useState(false);
  const [connectorsState, setConnectorsState] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; status: string; detail?: string; itemCount?: number; type?: string }>>([]);

  const chat = useAiChat();
  const slash = useSlashCommands();
  const voice = useVoiceInput({
    onTranscript: useCallback((text: string) => {
      if (text.trim()) chat.send(text.trim());
    }, [chat]),
  });
  const [actionResults, setActionResults] = useState<Record<string, 'running' | 'done' | 'error'>>({});
  const [connectorSyncing, setConnectorSyncing] = useState<Record<string, true>>({});
  const [reflectDays, setReflectDays] = useState<GoalDay[]>([]);
  const [connectorStatus, setConnectorStatus] = useState({
    unreadCount: 0,
    todayEventCount: 0,
    lastSyncTime: undefined as string | undefined,
    syncing: false,
  });
  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++toastCounter}`;
    setToasts(prev => [...prev, { id, message, type }]);
    const ms = getToastDurationMs();
    // The max preset means "sticky": leave it up until dismissed.
    if (!isSticky(ms)) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // Goals & Reminders state
  const [reminders, setReminders] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);

  // Focus board per-action errors
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toggleErrors, setToggleErrors] = useState<Record<number, string>>({});
  const [acceptErrors, setAcceptErrors] = useState<Record<string, string>>({});

  // Chat context warnings
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const dismissError = useCallback((index: number) => {
    setContextWarnings(prev => prev.filter((_, i) => i !== index));
  }, []);

  const [dayWindow, setDayWindow] = useState(5);
  const handleLoadOlder = useCallback(() => setDayWindow(prev => prev + 5), []);

  // History drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatLibraryOpen, setChatLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [canvasMode, setCanvasMode] = useState<'deck' | 'canvas' | 'compositions'>('canvas');
  const location = useLocation();
  useEffect(() => {
    const mode = (location.state as any)?.tab;
    if (mode === 'canvas' || mode === 'deck' || mode === 'compositions') setCanvasMode(mode);
  }, []);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const canvas = useCanvasState();
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const automationActions = useAutomationActions();
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoFocus, setAutoFocus] = useState(true);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const aiActions = useAiActions();
  const dynamicUI = useDynamicUI();

  // ── Bridge: ParsedMessage → CanvasCard helpers ──
  const processedMsgIds = useRef<Set<string>>(new Set());
  const msgContentLengths = useRef<Map<string, number>>(new Map());
  const msgCardIds = useRef<Map<string, string>>(new Map());
  const lastCardId = useRef<string | null>(null);
  const automationMsgIds = useRef<Set<string>>(new Set());
  const recentCardSpawns = useRef<Map<string, number>>(new Map());
  const CARD_DEDUP_MS = 5000;

  function mapParsedToCardType(parsedType: string): CardType {
    switch (parsedType) {
      case 'goal_suggestion': return 'focus'
      case 'plan_update': return 'plan'
      case 'stats_summary': return 'finance'
      case 'digest_item': return 'digest'
      case 'action_list': return 'approval'
      case 'connector_status': return 'connectors'
      case 'form_fill': return 'response'
      case 'chart_data': return 'response'
      case 'reminder_create': return 'annotation'
      case 'goal_event_link': return 'annotation'
      case 'error': return 'response'
      default: return 'response'
    }
  }

  function isDuplicate(type: string, dataHash: string): boolean {
    const key = `${type}:${dataHash}`
    const last = recentCardSpawns.current.get(key)
    if (last && Date.now() - last < CARD_DEDUP_MS) return true
    recentCardSpawns.current.set(key, Date.now())
    return false
  }

  // Lanes keep related card families separated instead of one shared grid
  // (fixes "goals and schedule mixed together in one ui")
  const LANE_OF: Record<string, number> = {
    focus: 0, goal: 0, plan: 0, longterm: 0,            // Goals lane
    dailyplanner: 1, weeklyschedule: 1, deadline: 1,    // Schedule lane
    finance: 2,                                         // Finance lane
    digest: 3,                                          // Digest lane
    connectors: 4, automation: 4,                       // Automation/Connectors lane
    annotation: 5, approval: 5, response: 5,            // Misc lane
  }
  const LANE_X = [40, 540, 1040, 1540, 2040, 2540, 3040]
  function getCardPosition(type: CardType): { x: number; y: number } {
      // Centered spawn positioning to avoid off-screen cards
      const container = document.querySelector('.dk-canvas-container')
      if (container) {
        const { width, height } = container.getBoundingClientRect()
        const centerX = width / 2 - 160
        const centerY = height / 2 - 100
        const offsetX = (Math.random() - 0.5) * 100
        const offsetY = (Math.random() - 0.5) * 100
        return {
          x: Math.max(0, Math.min(width - 320, centerX + offsetX)),
          y: Math.max(0, Math.min(height - 200, centerY + offsetY))
        }
      }
      const lane = LANE_OF[type] ?? 6
      const laneCards = Object.values(canvas.allCards).filter((c: any) => (LANE_OF[c.type] ?? 6) === lane)
      const idx = laneCards.length
      const x = LANE_X[lane] ?? 40 + lane * 500
      const y = 40 + idx * 260
      return { x, y }
    }

  // Canvas-mode automation cards: sync automations into the canvas store as first-class cards
  const { toggleAutomation, deleteAutomation, testRun } = automationActions;

  useEffect(() => {
    canvas.syncAutomations(automationActions.automations)
  }, [automationActions.automations, canvas.syncAutomations])

  // Inject live closures into automation cards before rendering
  const enrichedCards = useMemo(() => {
    return canvas.cards.map((c: any) => {
      if (c.type === 'automation' && c.data?.automation) {
        const auto = automationActions.automations.find((a: any) => a.ruleId === c.data.automation.ruleId)
        if (auto) {
          return {
            ...c,
            data: {
              ...c.data,
              automation: auto,
              onToggle: () => toggleAutomation(auto.ruleId, auto.enabled),
              onDelete: () => deleteAutomation(auto.ruleId, auto.name),
              onTestRun: () => testRun(auto.ruleId, auto.name),
            }
          }
        }
      }
      return c
    })
  }, [canvas.cards, automationActions.automations, toggleAutomation, deleteAutomation, testRun])

  // Map parsed type → canvas card type for finding existing cards
  const PARSED_TO_CARD_TYPE: Record<string, string> = {
    goal_suggestion: 'focus',
    plan_update: 'plan',
    stats_summary: 'finance',
    digest_item: 'digest',
    action_list: 'approval',
    connector_status: 'connectors',
    form_fill: 'response',
    chart_data: 'response',
    reminder_create: 'annotation',
    goal_event_link: 'annotation',
    error: 'response',
  }

  function spawnTypedCard(parsed: any, pos: { x: number; y: number }, msgId: string): string | null {
    // Use message ID for dedup — each message is unique, content hash can false-positive
    if (recentCardSpawns.current.has(msgId)) return null
    recentCardSpawns.current.set(msgId, Date.now())

    const cardType = PARSED_TO_CARD_TYPE[parsed.type]

    // FIND existing card of this type (non-dismissed, non-user)
    const existingCard = Object.values(canvas.allCards).find((c: any) =>
      c.type === cardType && !c.dismissedAt && c.source !== 'user' && c.data?.msgId !== msgId
    )

    // ── UPDATE existing card with merged data ──
    if (existingCard) {
      const d = existingCard.data || {}
      let patch: Record<string, any> = { msgId }

      switch (parsed.type) {
        case 'goal_suggestion': {
          // Merge goals by title (dedup)
          const oldGoals = d.goals || []
          const newGoals = parsed.goals || []
          const merged = [...oldGoals]
          for (const g of newGoals) {
            if (!merged.some((eg: any) => eg.title === g.title)) merged.push(g)
          }
          patch.goals = merged
          break
        }
        case 'plan_update': {
          const oldGoals = d.goals || []
          const newChanges = parsed.changes || []
          const merged = [...oldGoals]
          for (const ch of newChanges) {
            if (ch.action === 'add') {
              if (!merged.some((g: any) => g.title === ch.goal?.title)) merged.push(ch.goal)
            } else if (ch.action === 'complete') {
              const idx = merged.findIndex((g: any) => g.title === ch.goal?.title)
              if (idx >= 0) merged[idx] = { ...merged[idx], status: 'done' }
            } else if (ch.action === 'modify') {
              const idx = merged.findIndex((g: any) => g.title === ch.goal?.title)
              if (idx >= 0) merged[idx] = { ...merged[idx], ...ch.goal }
            }
          }
          patch.goals = merged
          if (parsed.note) patch.notes = d.notes ? d.notes + '\n\n' + parsed.note : parsed.note
          break
        }
        case 'stats_summary': {
          const metrics = parsed.metrics || []
          const balance = metrics.find((m: any) => m.label?.toLowerCase().includes('balance'))?.value ?? d.summary?.totalBalance ?? 0
          const income = metrics.find((m: any) => m.label?.toLowerCase().includes('income'))?.value ?? d.summary?.monthlyBudget ?? 0
          const expense = metrics.find((m: any) => m.label?.toLowerCase().includes('expense'))?.value ?? d.summary?.monthlySpent ?? 0
          patch.summary = { totalBalance: balance, monthlySpent: expense, monthlyBudget: income, subscriptions: d.summary?.subscriptions || [] }
          patch.metrics = [...(d.metrics || []), ...metrics]
          break
        }
        case 'digest_item': {
          const oldTopics = d.topics || []
          const newTopic = { topic: parsed.topic, summary: parsed.summary, sources: parsed.sources }
          if (!oldTopics.some((t: any) => t.topic === newTopic.topic)) {
            patch.topics = [...oldTopics, newTopic]
          } else {
            patch.topics = oldTopics // already exists
          }
          break
        }
        case 'action_list': {
          const oldActions = d.actions || []
          const newActions = parsed.actions || []
          const merged = [...oldActions]
          for (const a of newActions) {
            if (!merged.some((ea: any) => ea.label === a.label)) merged.push(a)
          }
          patch.actions = merged
          patch.title = parsed.actions?.[0]?.label || d.title
          patch.description = parsed.note || d.description
          break
        }
        case 'connector_status': {
          patch.connectors = parsed.connectors
          break
        }
        default:
          // For response/annotation types, don't merge — always create new
          canvas.updateCard(existingCard.id, { data: { ...d, ...patch } })
          return existingCard.id
      }

      canvas.updateCard(existingCard.id, { data: { ...d, ...patch } })
      setFocusedCardId(existingCard.id)
      return existingCard.id
    }

    // ── CREATE new card ──
    switch (parsed.type) {
      case 'goal_suggestion':
        return canvas.addCard('focus', { goals: parsed.goals, source: parsed.source, msgId },
          { size: { w: 8, h: 6 }, pinned: false, source: 'ai', position: pos })
      case 'plan_update': {
        const goals = parsed.changes?.filter((c: any) => c.action === 'add').map((c: any) => c.goal) || []
        return canvas.addCard('plan', { goals, notes: parsed.note, msgId },
          { size: { w: 8, h: 6 }, pinned: false, source: 'ai', position: pos })
      }
      case 'stats_summary': {
        const metrics = parsed.metrics || []
        const balance = metrics.find((m: any) => m.label?.toLowerCase().includes('balance'))?.value || 0
        const income = metrics.find((m: any) => m.label?.toLowerCase().includes('income'))?.value || 0
        const expense = metrics.find((m: any) => m.label?.toLowerCase().includes('expense'))?.value || 0
        return canvas.addCard('finance', { summary: { totalBalance: balance, monthlySpent: expense, monthlyBudget: income, subscriptions: [] }, metrics: parsed.metrics, msgId },
          { size: { w: 6, h: 4 }, pinned: false, source: 'ai', position: pos })
      }
      case 'digest_item':
        return canvas.addCard('digest', { topics: [{ topic: parsed.topic, summary: parsed.summary, sources: parsed.sources }], msgId },
          { size: { w: 6, h: 4 }, pinned: false, source: 'ai', position: pos })
      case 'action_list':
        return canvas.addCard('approval', { title: parsed.actions?.[0]?.label || 'Action Required', description: parsed.note || parsed.actions?.map((a: any) => a.label).join(', '), actions: parsed.actions, msgId },
          { size: { w: 6, h: 4 }, pinned: true, source: 'ai', position: pos })
      case 'connector_status':
        return canvas.addCard('connectors', { connectors: parsed.connectors, msgId },
          { size: { w: 10, h: 8 }, pinned: false, source: 'ai', position: pos })
      case 'form_fill': {
        const title = parsed.title || 'Form'
        const fields = parsed.fields || []
        const md = `### ${title}\n\n` + fields.map((f: any) => `**${f.label}:** ${f.value || '*(empty)*'}`).join('\n')
        return canvas.addCard('response', { content: md, isToolOutput: false, parsed, msgId },
          { size: { w: 8, h: Math.max(5, 3 + fields.length) }, pinned: false, source: 'ai', position: pos })
      }
      case 'chart_data': {
        const chartTitle = parsed.title || 'Chart'
        const chartType = parsed.chartType || 'bar'
        const labels = parsed.labels || []
        const datasets = parsed.datasets || []
        const maxVal = Math.max(...(datasets.flatMap((ds: any) => ds.data || [])), 1)
        const barLines = labels.map((label: string, i: number) => {
          const vals = datasets.map((ds: any) => ds.data?.[i] || 0)
          const bars = vals.map((v: number) => `${'█'.repeat(Math.max(1, Math.round((v / maxVal) * 20)))} ${v}`).join('  ')
          return `${label.padEnd(12)} ${bars}`
        }).join('\n')
        const legend = datasets.map((ds: any, i: number) => `**${ds.label || `Series ${i + 1}`}**`).join('  ')
        const md = `### ${chartTitle}\n\n*Type: ${chartType}*\n\n\`\`\`\n${barLines}\n\`\`\`\n\n${legend}`
        return canvas.addCard('response', { content: md, isToolOutput: false, parsed, msgId },
          { size: { w: 10, h: Math.max(5, 4 + labels.length) }, pinned: false, source: 'ai', position: pos })
      }
      case 'reminder_create':
        return canvas.addCard('annotation', { text: `Reminder: ${parsed.text}${parsed.dueDate ? ` (due ${parsed.dueDate})` : ''}`, parentType: 'reminder', msgId },
          { size: { w: 6, h: 3 }, pinned: false, source: 'ai', position: pos })
      case 'goal_event_link':
        return canvas.addCard('annotation', { text: `Linked event: ${parsed.eventTitle}`, parentType: 'goal link', msgId },
          { size: { w: 6, h: 3 }, pinned: false, source: 'ai', position: pos })
      case 'error':
        return canvas.addCard('response', { content: `**Error:** ${parsed.message}\n\n${parsed.recovery ? `Recovery: ${parsed.recovery}` : ''}`, isToolOutput: false, msgId },
          { size: { w: 8, h: 4 }, pinned: false, source: 'ai', position: pos })
      default: return null
    }
  }

  // ── Main bridge useEffect ──
  // Remount-safe: cards are keyed by message id (data.msgId), so navigating
  // away and back can NEVER re-spawn duplicates at default positions. On
  // remount, historical messages are matched to their persisted cards and
  // only genuinely new messages get cards.
  useEffect(() => {
    if (canvasMode !== 'canvas') return;

    // Map message id → existing card ids (survives remounts via the saved layout)
    const cardsByMsgId = new Map<string, string[]>();
    Object.values(canvas.allCards).forEach((c: any) => {
      if (c.data?.msgId) {
        const arr = cardsByMsgId.get(c.data.msgId) || [];
        arr.push(c.id);
        cardsByMsgId.set(c.data.msgId, arr);
      }
    });

    // Restore per-message refs from persisted cards so merge/append logic
    // keeps working after a remount (lastCardId = last message's card).
    let lastMatched: string | null = null;
    chat.messages.forEach(msg => {
      const ids = cardsByMsgId.get(msg.id);
      if (!ids || ids.length === 0) return;
      processedMsgIds.current.add(msg.id);
      if (msg.content) msgContentLengths.current.set(msg.id, msg.content.length);
      const cardId = ids[ids.length - 1];
      if (cardId && canvas.allCards[cardId]) {
        msgCardIds.current.set(msg.id, cardId);
        lastMatched = cardId;
      }
    });
    if (lastMatched) lastCardId.current = lastMatched;

    // Streaming content updates to existing assistant cards (works after remount).
    // Also live-updates a PAIRED user-input card's aiResponse as the assistant
    // message streams — without this the canvas only ever shows the first chunk.
    let changed = false;
    chat.messages.forEach(msg => {
      const ids = cardsByMsgId.get(msg.id) || [];
      for (const cardId of ids) {
        const card = canvas.allCards[cardId];
        if (!card) continue;
        const prevLen = msgContentLengths.current.get(msg.id) || 0;
        if (msg.content && msg.content.length > prevLen) {
          const clean = stripAutomationBlock(msg.content);
          if (card.data?.isUserInput) {
            canvas.updateCard(cardId, {
              data: {
                ...card.data,
                aiResponse: clean,
                aiTimestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : card.data?.aiTimestamp,
              },
              size: { w: 10, h: 8 },
            });
          } else {
            canvas.updateCard(cardId, {
              data: { ...card.data, content: clean },
            });
          }
          msgContentLengths.current.set(msg.id, msg.content.length);
          setFocusedCardId(cardId);
          changed = true;
        }
      }
    });

    const newMsgs = chat.messages.filter(m => !processedMsgIds.current.has(m.id));
    if (newMsgs.length === 0 && !changed) return;

    newMsgs.forEach(msg => {
      if (msg.role === 'user') {
        processedMsgIds.current.add(msg.id);
        msgContentLengths.current.set(msg.id, msg.content.length);
        const cardId = canvas.addCard('response', {
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          isUserInput: true,
          msgId: msg.id,
        }, {
          size: { w: 10, h: 4 },
          pinned: true,
          source: 'user',
          position: getCardPosition('response'),
        });
        setFocusedCardId(cardId);
        return;
      }

      if (msg.role !== 'assistant') return;

      // Skip empty assistant messages — they're placeholder slots before streaming fills content
      if (!msg.content && !msg.parsed) return;

      processedMsgIds.current.add(msg.id);
      msgContentLengths.current.set(msg.id, msg.content.length);

      const parsed = msg.parsed;
      const isStructured = parsed && parsed.type !== 'text';

      // ── CANVAS CONTROL ACTIONS (highlight, save, arrange, clear) ──
      if (isStructured && parsed && (parsed.type === 'highlight' || parsed.type === 'canvas_action')) {
        processedMsgIds.current.add(msg.id);
        if (parsed.type === 'highlight' && parsed.cardType) {
          // Find and highlight the matching card
          const targetCard = Object.values(canvas.allCards).find((c: any) =>
            c.type === parsed.cardType && !c.dismissedAt
          );
          if (targetCard) {
            setFocusedCardId(targetCard.id);
            // Flash effect — briefly set status to highlight
            canvas.updateCard(targetCard.id, { status: 'loading' });
            setTimeout(() => canvas.updateCard(targetCard.id, { status: 'live' }), 1500);
          }
        } else if (parsed.type === 'canvas_action') {
          if (parsed.action === 'save') {
            canvas.forceSave();
          } else if (parsed.action === 'arrange') {
            canvas.arrangeCards(
              Object.fromEntries(
                canvas.cards.map((c: any, i: number) => {
                  const col = i % 4;
                  const row = Math.floor(i / 4);
                  return [c.id, { x: 40 + col * 220, y: 40 + row * 220 }];
                })
              )
            );
          } else if (parsed.action === 'clear') {
            canvas.clearAll();
          }
        }
        return;
      }

      // ── STRUCTURED → typed card + optional prose card ──
      if (isStructured && parsed) {
        const prose = stripAutomationBlock(msg.content);
        const typedPos = getCardPosition(mapParsedToCardType(parsed.type));
        const typedCardId = spawnTypedCard(parsed, typedPos, msg.id);
        if (typedCardId) {
          lastCardId.current = typedCardId;
          msgCardIds.current.set(msg.id, typedCardId);
        }

        if (prose && prose.trim().length > 10) {
          const prosePos = { x: typedPos.x, y: typedPos.y + (parsed.type === 'connector_status' ? 320 : 240) };
          const proseCardId = canvas.addCard('response', {
            content: prose,
            timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            isToolOutput: false,
            msgId: msg.id,
          }, {
            size: { w: 10, h: 5 },
            pinned: false,
            source: 'ai',
            position: prosePos,
          });
          lastCardId.current = proseCardId;
          msgCardIds.current.set(msg.id, proseCardId);
        }
        return;
      }

      // ── PLAIN TEXT → merge into existing card or create new ──
      if (lastCardId.current && canvas.allCards[lastCardId.current]) {
        const existing = canvas.allCards[lastCardId.current];
        // If previous card is a user input, pair the AI response with it
        if (existing.type === 'response' && existing.data?.isUserInput) {
          canvas.updateCard(lastCardId.current, {
            data: {
              ...existing.data,
              aiResponse: stripAutomationBlock(msg.content),
              aiTimestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            },
            size: { w: 10, h: 8 },
          });
          msgCardIds.current.set(msg.id, lastCardId.current);
          return;
        }
        // If previous card is an AI response, append to it (merge conversation)
        if (existing.type === 'response' && !existing.data?.isUserInput) {
          const prevContent = existing.data?.content || '';
          const cleanContent = stripAutomationBlock(msg.content);
          const newContent = prevContent ? prevContent + '\n\n' + cleanContent : cleanContent;
          canvas.updateCard(lastCardId.current, {
            data: {
              ...existing.data,
              content: newContent,
              timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : existing.data?.timestamp,
            },
          });
          msgCardIds.current.set(msg.id, lastCardId.current);
          setFocusedCardId(lastCardId.current);
          return;
        }
      }

      const cleanContent = stripAutomationBlock(msg.content);
      const standaloneCardId = canvas.addCard('response', {
        content: cleanContent,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        isToolOutput: /```tool\b/i.test(cleanContent),
        msgId: msg.id,
      }, {
        size: { w: 10, h: 6 },
        pinned: false,
        source: 'ai',
        position: getCardPosition('response'),
      });
      lastCardId.current = standaloneCardId;
      msgCardIds.current.set(msg.id, standaloneCardId);
      setFocusedCardId(standaloneCardId);
    });
  }, [chat.messages, canvasMode]);

  // ── AI automation creation (spec §11): fenced ```automation blocks ──
  // Mode-independent: parses assistant messages for automation blocks and
  // persists the rule via the backend, so the card appears on Deck/Canvas
  // through the live automations list. Idempotent per message id + rule name.
  useEffect(() => {
    const existingNames = new Set(automationActions.automations.map(a => a.name));
    chat.messages.forEach(msg => {
      if (msg.role !== 'assistant' || !msg.content || !msg.content.includes('```automation')) return;
      if (automationMsgIds.current.has(msg.id)) return;
      automationMsgIds.current.add(msg.id);

      const parsed = parseNlAutomation(msg.content);
      if (!parsed || existingNames.has(parsed.config.name)) return;
      existingNames.add(parsed.config.name);
      automationActions.createAutomation(parsed.config);
    });
  }, [chat.messages, automationActions]);

  // Connectors card is now handled by the unified core card seeding effect above.
  // Keep the ref for legacy code that references it.
  const connectorsCardIdRef = useRef<string | null>(null);

  // Schedule and planner cards are now handled by the unified core card seeding effect.

  const unfinishedCount = goals.filter(g => g.status !== 'done' && g.status !== 'missed').length;
  const mode = determineMode(goals);

  const goalsDataState = (() => {
    if (goalsState === 'loading') return 'loading';
    if (goalsError) return 'error';
    if (goals.length === 0) return 'empty';
    return 'ready';
  })();

  const digestDataState = (() => {
    if (digestState === 'loading') return 'loading';
    if (digestTopics.length === 0) return 'empty';
    return 'ready';
  })();

  const focusMetrics = {
    doneToday: goals.filter(g => g.status === 'done').length,
    inProgress: goals.filter(g => g.status === 'active').length,
    focusSeconds: 0,
  };

  const summaryStats = {
    goalsCompleted: goals.filter(g => g.status === 'done').length,
    focusSeconds: 0,
    streakDays: 0,
    activeGoals: goals.filter(g => g.status === 'active').length,
  };

  const glanceMetrics = [
    { label: 'Done today', value: String(summaryStats.goalsCompleted) },
    { label: 'Active', value: String(summaryStats.activeGoals) },
    { label: 'Unfinished', value: String(unfinishedCount) },
    { label: 'Focus', value: '—' },
  ];

  // Dynamic suggestions based on time + context
  const chatSuggestions = useMemo<ChatSuggestion[]>(() => {
    const hour = new Date().getHours();
    const base: ChatSuggestion[] = [];

    if (hour < 12) {
      base.push({ id: "morning-plan", label: "Plan my morning", prompt: "Help me plan my morning based on my goals and calendar." });
    } else if (hour < 17) {
      base.push({ id: "afternoon-focus", label: "Afternoon focus", prompt: "What should I focus on for the rest of the day?" });
    } else {
      base.push({ id: "evening-review", label: "Review today", prompt: "Review my progress today and suggest tomorrow's priorities." });
    }

    base.push(
      { id: "goal-check", label: "Check goal progress", prompt: "How am I doing on my active goals this week?" },
      { id: "summarize", label: "Summarize week", prompt: "Give me a summary of my week so far." },
      { id: "deep-work", label: "Deep work session", prompt: "Help me plan a 90-minute deep work session." },
    );

    return base;
  }, [chat.currentThreadDate]);

  const loadGoals = useCallback(async () => {
    setGoalsState('loading');
    setGoalsError(null);
    try {
      const day: GoalDay = await window.deskflowAPI!.getGoals(today);
      setGoals(day.goals || []);
      setReview(day.reviewSummary || null);
      setGoalsState(day.goals?.length ? 'ready' : 'empty');
    } catch (err: any) {
      setGoalsError(err.message || 'Failed to load goals');
      setGoalsState('error');
    }
  }, [today]);

  const loadDigest = useCallback(async (showLoader = true, force = false) => {
    if (showLoader) setDigestState('loading');
    try {
      const r = await window.deskflowAPI!.getTopicDigest(force ? { force: true } : undefined);
      if (r.success) { setDigestTopics(r.topics || []); setDigestReason(r.reason || null); setDigestState(r.topics?.length ? 'ready' : 'empty'); }
      else { setDigestState('error'); setDigestReason(null); }
    } catch (err: any) {
      console.error('[AiPage] loadDigest:', err);
      setDigestState('error');
    }
  }, []);

  const loadPlanGoals = useCallback(async () => {
    try {
      const r = await window.deskflowAPI!.readPlanningMd();
      if (r.content) {
        const items = parseChecklist(r.content).filter(i => !i.checked);
        setPlanGoals(items.map(i => ({ id: crypto.randomUUID(), title: i.title, targetSeconds: i.targetSeconds, category: 'work' as const, status: 'active' as const, period: 'daily', date: today, source: 'planning', links: [], createdAt: new Date().toISOString(), target: { type: 'completion' as const } })));
        setPlanningNotes(r.content);
      }
    } catch (e) { console.error('[AiPage] loadPlanGoals:', e); }
  }, [today]);

  const loadLongTermGoals = useCallback(async () => {
    try {
      const r = await window.deskflowAPI!.getLongtermGoals();
      if (r.success && r.goals) {
        setLongTermGoals(r.goals.map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          category: g.category,
          status: g.status === 'completed' ? 'done' : g.status,
          priority: g.priority ?? 3,
          createdAt: g.createdAt,
          completedAt: g.completedAt,
          links: g.links || [],
          target: g.target || { type: 'completion' },
        })));
      }
    } catch (e) { console.error('[AiPage] loadLongTermGoals:', e); }
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      const result = await window.deskflowAPI!.getReminders();
      if (result?.success) setReminders(result.reminders || []);
    } catch (e: any) {
      setRemindersError(e.message);
    }
  }, []);

  const loadCalendarEvents = useCallback(async () => {
    if (!connectors.length) return;
    setRemindersLoading(true);
    try {
      const allEvents: any[] = [];
      for (const connector of connectors) {
        if (connector.type === "calendar") {
          const result = await (window.deskflowAPI! as any).connectors?.items?.(connector.id, { type: "event", limit: 20 });
          if (result?.items) {
            allEvents.push(...result.items.map((item: any) => ({
              id: item.id,
              title: item.subject || "Untitled Event",
              date: item.date,
              connectorName: connector.name,
              connectorId: connector.id,
            })));
          }
        }
      }
      setCalendarEvents(allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (e: any) {
      setRemindersError(e.message);
    } finally {
      setRemindersLoading(false);
    }
  }, [connectors]);

  useEffect(() => { loadReminders(); }, [loadReminders]);
  useEffect(() => { loadCalendarEvents(); }, [loadCalendarEvents]);

  const loadReflect = useCallback(async () => {
    try {
      const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const r = await window.deskflowAPI!.getGoalsBatch(start, today);
      if (r?.success && Array.isArray(r.days)) {
        setReflectDays(r.days.map((d: any) => ({ date: d.date, goals: d.goals || [], reviewSummary: d.reviewSummary || undefined })));
      }
    } catch (e) { console.error('[AiPage] loadReflect:', e); }
  }, [today]);

  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const loadBoot = useCallback(async () => {
    setBootState('loading');
    setBootError(null);
    try {
      await Promise.all([
        loadGoals(),
        loadPlanGoals(),
        loadLongTermGoals(),
        loadReflect(),
      ]);
      setBootState('ready');
    } catch (e: any) {
      console.error('[AiPage] boot failed:', e);
      setBootError(e.message || 'Failed to initialize');
      setBootState('error');
    }
  }, [loadGoals, loadPlanGoals, loadLongTermGoals, loadReflect]);

  useEffect(() => {
    loadBoot();
    const initDigest = async () => {
      const generating = await window.deskflowAPI!.isDigestGenerating();
      if (generating) {
        setDigestState('loading');
        digestPollRef.current = setInterval(async () => {
          try {
            const r = await window.deskflowAPI!.getTopicDigest();
            if (r.success && r.topics?.length > 0) {
              setDigestTopics(r.topics);
              setDigestState('ready');
              if (digestPollRef.current) { clearInterval(digestPollRef.current); digestPollRef.current = null; }
            }
          } catch (e) { console.error('[AiPage] digest poll:', e); }
        }, 3000);
      } else {
        await loadDigest();
      }
    };
    initDigest();
    const cleanup = window.deskflowAPI?.onDigestGenerationComplete?.((data: any) => {
      if (digestPollRef.current) { clearInterval(digestPollRef.current); digestPollRef.current = null; }
      const c = canvasRef.current
      const digestCard = Object.values(c.cards).find((card: any) => card.type === 'digest')
      if (data.success && data.topics) {
        setDigestTopics(data.topics); setDigestState('ready');
        if (digestCard) c.updateCard(digestCard.id, { status: 'live', data: { ...digestCard.data, topics: data.topics, error: undefined } })
      } else {
        const message = data?.error || 'Digest generation failed — try again or configure topic sources in Settings.'
        setDigestState('idle')
        if (digestCard) c.updateCard(digestCard.id, { status: 'error', data: { ...digestCard.data, error: message } })
        else showToast(message, 'error')
      }
    });

    return () => {
      if (digestPollRef.current) { clearInterval(digestPollRef.current); digestPollRef.current = null; }
      cleanup?.();
    };
  }, [loadBoot, loadDigest]);

  // ⌘K / Ctrl+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
      // ⌘⇧L / Ctrl+Shift+L to toggle transcript rail
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        setRailOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ensure core cards exist on canvas (seed missing ones, update existing data).
  // Seeds from saved Default Canvas Setup or BUILTIN_DEFAULT_SETUP. Re-runs after
  // New Canvas (clearAll bumps canvasEpoch) so freshly seeded cards get live data.
  useEffect(() => {
    if (canvasMode !== 'canvas') return
    // Bail out only when the canvas was loaded from storage AND actually has
    // cards — an empty saved canvas still needs seeding. A fresh canvas (wasLoaded
    // false) always seeds. Bump canvasEpoch via clearAll() to re-run after New Canvas.
    if (canvas.wasLoaded && canvas.cards.length > 0) return
    const existing = canvas.cards
    const existingByType = new Map<string, any>()
    Object.values(existing).forEach((c: any) => {
      if (!existingByType.has(c.type)) existingByType.set(c.type, c)
    })

    // Live data attached to seeded cards per type (used for both the built-in
    // seed list and the user's saved Default Canvas Setup).
    const liveDataForType = (type: string): Record<string, any> => {
      switch (type) {
        case 'focus': return { goals }
        case 'plan': return { goals: longTermGoals, notes: planningNotes }
        case 'digest': return { topics: digestTopics }
        case 'reflect': return { days: reflectDays }
        case 'connectors': return { state: connectorsState, connectors, syncing: connectorSyncing }
        default: return {}
      }
    }

    // Seed from the user's saved Default Canvas Setup when one exists,
    // otherwise fall back to the built-in core card layout.
    const userSetup = loadDefaultSetup()
    const setupCards = (userSetup && userSetup.cards.length > 0)
      ? userSetup.cards.filter(c => c.enabled)
      : BUILTIN_DEFAULT_SETUP;

    const seeds: Array<{ type: string; data: Record<string, any>; pos: { x: number; y: number }; size: { w: number; h: number }; pinned?: boolean }> = setupCards.map(entry => {
      const liveData = liveDataForType(entry.type)
      return {
        type: entry.type,
        data: liveData,
        pos: entry.position,
        size: entry.size,
        pinned: entry.pinned !== false,
      }
    })

    seeds.forEach(({ type, data, pos, size, pinned }) => {
      const existingCard = existingByType.get(type)
      if (existingCard) {
        // Update stale data on existing cards (goals, topics, connectors, etc.)
        const hasStaleData = JSON.stringify(data) !== '{}'
        if (hasStaleData) {
          canvas.updateCard(existingCard.id, { data: { ...existingCard.data, ...data } })
        }
      } else {
        canvas.addCard(type as any, data, { position: pos, size, pinned: pinned !== false, source: 'system' })
      }
    })
  }, [canvasMode, canvas.canvasEpoch, canvas.wasLoaded, goals, longTermGoals, planningNotes, digestTopics, reflectDays, connectorsState, connectors, connectorSyncing])

  const handlePaletteIntent = useCallback((intent: Intent) => {
    switch (intent.type) {
      case 'open_card': {
        const cardType = intent.cardType as any
        const defaultSizes: Record<string, { w: number; h: number }> = {
          focus: { w: 8, h: 5 }, plan: { w: 8, h: 5 }, finance: { w: 8, h: 4 },
          digest: { w: 6, h: 4 }, reflect: { w: 6, h: 4 },
        }
        const size = defaultSizes[cardType] || { w: 8, h: 5 }
        const existingCount = canvas.cards.filter(c => c.type === cardType).length
        const offset = existingCount * 40
        canvas.addCard(cardType, {}, { position: { x: 40 + offset, y: 40 + offset }, size, pinned: true, source: 'user' })
        break
      }
      case 'run_command': chat.send(`/${intent.command} ${intent.args || ''}`.trim()); break
      case 'send_to_ai': chat.send(intent.prompt || ''); break
      case 'custom_command': chat.send(intent.prompt || ''); break
      case 'error': showToast(intent.message || 'Unknown command', 'error'); break
    }
  }, [canvas, chat, showToast]);

  useEffect(() => {
    (async () => {
      try {
        const state = await window.deskflowAPI!.getAiProviders();
        if (state?.providers) {
          setAiProviders(state.providers.map((p: any) => ({ id: p.id, label: p.label, models: p.models || [], enabled: p.enabled })));
          setAiRouting(state.routing || {});
        }
      } catch (e) { console.error('[AiPage] getAiProviders:', e); }
    })();
  }, []);

  const loadConnectors = useCallback(async () => {
    setConnectorsState('loading');
    try {
      const r = await window.deskflowAPI!.connectors?.list?.();
      if (r?.success && Array.isArray(r.connectors)) {
        const enriched = await Promise.all(r.connectors.map(async (c: any) => {
          let itemCount: number | undefined;
          try {
            const items = await window.deskflowAPI!.connectors?.items?.(c.id, { limit: 100 });
            itemCount = items?.items?.length;
          } catch {}
          return {
            id: c.id,
            name: c.display_name || c.name || c.provider,
            status: (c.status === 'connected' ? 'ready' : c.status === 'error' ? 'error' : c.last_sync ? 'ready' : 'idle') as 'ready' | 'error' | 'idle',
            detail: c.type === 'email' ? 'IMAP · ' + (c.config?.host || '') : 'CalDAV',
            itemCount,
            type: c.type,
          };
        }));
        setConnectors(enriched);
        setConnectorsState(enriched.length === 0 ? 'empty' : 'ready');
      } else {
        setConnectors([]);
        setConnectorsState('empty');
      }
    } catch (e) {
      console.error('[AiPage] loadConnectors:', e);
      setConnectorsState('error');
    }
  }, []);

  useEffect(() => { loadConnectors(); }, [loadConnectors]);

  // Update connector status bar
  const updateConnectorStatus = useCallback(async () => {
    let unread = 0;
    let todayEvents = 0;
    let lastSync: string | undefined;

    for (const c of connectors) {
      if (c.type === 'email' && (c.status === 'ready' || c.status === 'idle')) {
        try {
          const r = await window.deskflowAPI!.connectors?.items?.(c.id, { unreadOnly: true, limit: 50 });
          if (r?.success) unread += r.items?.length || 0;
        } catch {}
      }
      if (c.type === 'calendar' && (c.status === 'ready' || c.status === 'idle')) {
        try {
          const r = await window.deskflowAPI!.connectors?.items?.(c.id, { limit: 20, type: 'event' });
          if (r?.success) {
            const now = new Date();
            const today = (r.items || []).filter((item: any) => {
              const d = new Date(item.date);
              return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            todayEvents += today.length;
          }
        } catch {}
      }
    }

    // Get the most recent lastSync from any connector
    try {
      const r = await window.deskflowAPI!.connectors?.list?.();
      if (r?.success && r.connectors) {
        for (const c of r.connectors) {
          if (c.lastSync && (!lastSync || new Date(c.lastSync) > new Date(lastSync))) {
            lastSync = c.lastSync;
          }
        }
      }
    } catch {}

    setConnectorStatus(prev => ({
      ...prev,
      unreadCount: unread,
      todayEventCount: todayEvents,
      lastSyncTime: lastSync ? timeAgoStr(new Date(lastSync)) : undefined,
    }));
  }, [connectors]);

  useEffect(() => { updateConnectorStatus(); }, [connectors, updateConnectorStatus]);

  // Auto-sync
  useAutoSync({
    connectors: connectors.map(c => ({ id: c.id, status: c.status })),
    enabled: true,
    onSyncAll: async () => {
      setConnectorStatus(prev => ({ ...prev, syncing: true }));
      for (const c of connectors.filter(c => c.status === 'ready' || c.status === 'idle')) {
        try { await window.deskflowAPI!.connectors?.sync?.(c.id); } catch {}
      }
      await loadConnectors();
      await updateConnectorStatus();
      setConnectorStatus(prev => ({ ...prev, syncing: false }));
    },
  });

  // Listen for new-email notifications from main process
  useEffect(() => {
    const api = window.deskflowAPI as any
    if (!api?.connectors?.onNewEmails) return
    const cleanup = api.connectors.onNewEmails((data: { connectorId: string; connectorName: string; unreadCount: number; newItems: any[] }) => {
      // Surface as a system message in the current chat
      const itemList = (data.newItems || []).map((item: any) => {
        const meta = JSON.parse(item.metadata || '{}')
        const from = meta.from || 'Unknown'
        return `- **${item.subject}** from ${from} (${new Date(item.date).toLocaleString()})`
      }).join('\n')
      chat.addMessage({
        role: 'assistant',
        content: `📬 **New emails** from ${data.connectorName} (${data.unreadCount} unread):\n${itemList}\n\n_I can help you reply, schedule, or create deadlines from these. Just ask._`,
        timestamp: new Date().toISOString(),
      })
      // Update connector status counts
      updateConnectorStatus()
    })
    return () => cleanup?.()
  }, [chat, updateConnectorStatus])

  // Intercept send for slash commands + Knowledge Base context injection (R5)
  const handleSend = useCallback(async (text: string, images?: string[]) => {
    const result = await slash.parseAndExecute(text, { connectors, currentThreadDate: chat.currentThreadDate });
    if (result.handled && result.messages) {
      for (const msg of result.messages) {
        chat.addMessage(msg);
      }
      return;
    }
    // R5: retrieve the most relevant KB chunks and prepend them as context.
    if (window.deskflowAPI?.kbQuery && text.trim() && !images?.length) {
      try {
        const chunks = await window.deskflowAPI.kbQuery(text.trim(), 3);
        if (chunks && chunks.length > 0) {
          const contextString = chunks.map(c => c.content).join('\n---\n');
          chat.send(`Context:\n${contextString}\n\nUser Query:\n${text.trim()}`);
          return;
        }
      } catch (e) { console.warn('[AiPage] KB context injection failed:', e); }
    }
    chat.send(text, images);
  }, [slash, connectors, chat]);

  const [suggesting, setSuggesting] = useState(false);
  const handleSuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const [plan, contextStats, longterm] = await Promise.all([
        window.deskflowAPI!.readPlanningMd(),
        window.deskflowAPI!.getGoalContext(),
        window.deskflowAPI!.getLongtermGoals(),
      ]);
      const ctx: Record<string, any> = {};
      if (plan.content) ctx.planningContent = plan.content;
      if (contextStats?.success) ctx.stats = { last7dByCategory: contextStats.last7dByCategory };
      if (longterm?.success && longterm.goals?.length > 0) {
        ctx.longtermGoals = longterm.goals.filter((g: any) => g.status !== 'completed').map((g: any) => ({ title: g.title, category: g.category }));
      }
      const r = await window.deskflowAPI!.suggestGoals(today, ctx);
      if (r.success && r.suggestions?.length > 0) {
        setSuggestions(r.suggestions.map((s: any) => ({ id: crypto.randomUUID(), title: s.title, category: s.category, status: 'active' as const, period: s.period || 'daily', date: today, source: 'ai', links: [], createdAt: new Date().toISOString(), target: s.target || { type: 'completion' as const }, description: s.description, parentId: s.parentId })));
        showToast(`${r.suggestions.length} goal suggestion${r.suggestions.length > 1 ? 's' : ''} ready`, 'success');
      } else if (r.success) {
        showToast('No suggestions available — try adding more context', 'info');
      } else {
        showToast(r.error || 'Failed to get suggestions', 'error');
      }
    } catch (e: any) {
      console.error('[AiPage] handleSuggest:', e);
      showToast(e.message || 'Failed to get suggestions', 'error');
    }
    setSuggesting(false);
  }, [today, showToast]);

  const handleRoutingSave = useCallback(async (feature: 'default' | 'researchDigest' | 'goalAssistant', entry: { providerId: string; model: string; smallProviderId?: string; smallModel?: string } | null) => {
    try {
      const state = await window.deskflowAPI!.getAiProviders();
      const providers = state?.providers || [];
      const routing = { ...(state?.routing || {}) };
      routing[feature] = entry;
      await window.deskflowAPI!.saveAiProviders({ providers, routing });
      setAiRouting(routing);
    } catch (e) { console.error('[AiPage] handleRoutingSave:', e); }
  }, []);

  const handleToggleGoal = useCallback(async (goal: Goal) => {
    const snapshot = [...goals];
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    const actionId = `goal-toggle-${goal.id}-${Date.now()}`
    actionBus.start(actionId, 'goal-toggle', `${newStatus === 'done' ? 'Completing' : 'Activating'} goal`, { targetSlot: 'focus' })
    try {
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : undefined } : g));
      await window.deskflowAPI!.saveGoal(today, { ...goal, status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : undefined });
      setToggleErrors(prev => { const n = { ...prev }; delete n[goal.id]; return n; });
      actionBus.complete(actionId)
      showToast(`Goal ${newStatus === 'done' ? 'completed' : 'activated'}`, 'success');
    } catch (e: any) {
      setGoals(snapshot);
      actionBus.fail(actionId, e?.message)
      setToggleErrors(prev => ({ ...prev, [goal.id]: e.message || 'Update failed' }));
      showToast(e.message || 'Failed to update goal', 'error');
    }
  }, [today, goals, showToast]);

  const handleSaveReview = useCallback(async (msg: string) => {
    try {
      const r = await window.deskflowAPI!.saveGoalReview(today, msg);
      if (r.success) { setReview(msg); setReviewError(null); }
      else { setReviewError(r.error || 'Save failed'); }
    } catch (e: any) {
      console.error('[AiPage] handleSaveReview:', e);
      setReviewError(e.message || 'Save failed');
    }
  }, [today]);

  const handleAcceptSuggestion = useCallback(async (goal: Goal) => {
    const suggestionSnapshot = [...suggestions];
    const goalsSnapshot = [...goals];
    const newGoal: Goal = { id: crypto.randomUUID(), title: goal.title, category: goal.category, target: goal.target || { type: 'completion' }, status: 'active', period: goal.period || 'daily', date: today, source: 'ai', links: goal.links || [], createdAt: new Date().toISOString(), description: goal.description };
    try {
      await window.deskflowAPI!.saveGoal(today, { id: newGoal.id, title: newGoal.title, category: newGoal.category, target: goal.target || { type: 'completion' }, status: 'active', period: goal.period || 'daily', date: today, source: 'ai', links: goal.links || [], createdAt: new Date().toISOString(), description: goal.description });
      setSuggestions(prev => prev.filter(x => x.title !== goal.title));
      setGoals(prev => [...prev, newGoal]);
      setAcceptErrors(prev => { const n = { ...prev }; delete n[goal.title]; return n; });
      showToast('Goal saved', 'success');
    } catch (e: any) {
      setSuggestions(suggestionSnapshot);
      setGoals(goalsSnapshot);
      setAcceptErrors(prev => ({ ...prev, [goal.title]: e.message || 'Failed to save' }));
      showToast(e.message || 'Failed to save goal', 'error');
    }
  }, [today, suggestions, goals, showToast]);

  const handleDismissSuggestion = useCallback((goal: Goal) => { setSuggestions(prev => prev.filter(x => x.title !== goal.title)); }, []);

  const onCardAction = useCallback(async (action: CardAction) => {
    const api = window.deskflowAPI!;
    switch (action.kind) {
      case 'accept-goal': {
        try {
          await api.saveGoal(today, { id: crypto.randomUUID(), title: action.goal.title, category: (action.goal.category as any) || 'work', target: action.goal.target || { type: 'completion' }, status: 'active', period: action.goal.period || 'daily', date: today, source: 'ai', links: action.goal.links || [], createdAt: new Date().toISOString(), description: action.goal.description });
          await loadGoals();
        } catch (e) { console.error('[AiPage] onCardAction accept-goal:', e); }
        break;
      }
      case 'dismiss-goal':
        break;
      case 'apply-plan': {
        try {
          const goals = action.changes.filter(c => c.action !== 'complete').map(c => ({ title: c.goal.title, category: c.goal.category, priority: c.goal.priority }));
          if (goals.length) await api.saveGoalsBatch(goals as any);
          await loadLongTermGoals();
        } catch (e) { console.error('[AiPage] onCardAction apply-plan:', e); }
        break;
      }
      case 'run-ipc': {
        const label = action.label || action.ipc;
        setActionResults(prev => ({ ...prev, [label]: 'running' }));
        try {
          const fn = (api as any)[action.ipc];
          if (typeof fn === 'function') await fn(action.payload);
          setActionResults(prev => ({ ...prev, [label]: 'done' }));
          loadGoals();
          loadDigest(false);
        } catch (e) {
          console.error('[AiPage] onCardAction run-ipc:', e);
          setActionResults(prev => ({ ...prev, [label]: 'error' }));
        }
        break;
      }
      case 'submit-form': {
        const summary = Object.entries(action.values).map(([k, v]) => k + ': ' + String(v)).join(', ');
        if (chat) chat.send(summary);
        break;
      }
      case 'sync-connector': {
        setConnectorSyncing(prev => ({ ...prev, [action.name]: true }));
        try {
          const connectors: any = (api as any).connectors;
          if (connectors?.sync) await connectors.sync(action.id || action.name);
        } catch (e) { console.error('[AiPage] onCardAction sync-connector:', e); }
        setConnectorSyncing(prev => { const n = { ...prev }; delete n[action.name]; return n; });
        break;
      }
      case 'open-url': {
        try { window.open(action.url, '_blank'); } catch (e) { console.error('[AiPage] onCardAction open-url:', e); }
        break;
      }
      case 'send-text': {
        if (chat) chat.send(action.text);
        break;
      }
      case 'retry': {
        const last = chat.messages.filter(m => m.role === 'user').at(-1);
        if (last) chat.send(last.content);
        break;
      }
      case 'create-reminder': {
        try {
          await window.deskflowAPI!.createReminder({ text: action.text, due_date: action.dueDate, goal_id: action.goalId });
          showToast('Reminder created', 'success');
          loadReminders();
        } catch (e: any) {
          showToast(e.message || 'Failed to create reminder', 'error');
        }
        break;
      }
      case 'link-goal-event': {
        const goal = longTermGoals.find(g => g.id === action.goalId) || goals.find(g => g.id === action.goalId);
        if (goal) {
          const links = [...(goal.links || [])];
          links.push({ type: 'event', title: action.eventTitle, eventId: action.eventId });
          await window.deskflowAPI!.saveGoalsBatch([{ ...goal, links, period: goal.period || 'daily', date: goal.date || '' }]);
          showToast('Goal linked to calendar event', 'success');
          loadGoals();
          loadLongTermGoals();
        }
        break;
      }
    }
  }, [today, loadGoals, loadLongTermGoals, loadDigest, chat, loadReminders, showToast, longTermGoals, goals]);

  const [savingNotes, setSavingNotes] = useState(false);
  const handleSaveNotes = useCallback(async (content: string) => {
    setSavingNotes(true);
    try {
      await window.deskflowAPI!.writePlanningMd({ content });
      setPlanningNotes(content);
      showToast('Notes saved', 'success');
    } catch (e: any) {
      console.error('[AiPage] handleSaveNotes:', e);
      showToast(e.message || 'Failed to save notes', 'error');
    }
    setSavingNotes(false);
  }, [showToast]);

  const handleAnalyzeDump = useCallback(async (text: string) => {
    try {
      const r = await window.deskflowAPI!.parseGoalDump(text);
      if (r.success && r.goals) {
        return r.goals.map((g: any) => ({ title: g.title, category: g.category || 'work', priority: g.priority || 3, description: g.description }));
      }
    } catch (e) { console.error('[AiPage] handleAnalyzeDump:', e); }
    return [];
  }, []);

  const handleSaveGoals = useCallback(async (goals: Partial<LongTermGoal>[]) => {
    try {
      const enriched = goals.map((g) => ({
        ...g,
        id: g.id || crypto.randomUUID(),
        date: g.date || today,
        status: g.status || 'active',
        period: g.period || 'longterm',
        source: g.source || 'planning',
        links: g.links || [],
        createdAt: new Date().toISOString(),
      }));
      await window.deskflowAPI!.saveGoalsBatch(enriched as any);
      await loadLongTermGoals();
    } catch (e) { console.error('[AiPage] handleSaveGoals:', e); }
  }, [loadLongTermGoals, today]);

  const handleToggleLongTermGoal = useCallback(async (goal: LongTermGoal) => {
    try {
      const newStatus = goal.status === 'done' ? 'active' : 'done';
      await window.deskflowAPI!.saveGoal(today, { id: goal.id, title: goal.title, category: goal.category, priority: goal.priority, status: newStatus, period: 'longterm', date: today, source: 'planning', links: [], createdAt: new Date().toISOString(), completedAt: newStatus === 'done' ? new Date().toISOString() : undefined, target: { type: 'completion' } });
      await loadLongTermGoals();
    } catch (e) { console.error('[AiPage] handleToggleLongTermGoal:', e); }
  }, [today, loadLongTermGoals]);

  const handleDeleteLongTermGoal = useCallback(async (id: string) => {
    try {
      await window.deskflowAPI!.deleteGoal(id);
      showToast('Goal deleted', 'success');
      loadLongTermGoals();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete goal', 'error');
    }
  }, [loadLongTermGoals, showToast]);

  const handleUpdateLongTermGoal = useCallback(async (goal: LongTermGoal) => {
    try {
      await window.deskflowAPI!.saveGoalsBatch([{ ...goal, period: 'longterm', date: '' }]);
      showToast('Goal updated', 'success');
      loadLongTermGoals();
    } catch (e: any) {
      showToast(e.message || 'Failed to update goal', 'error');
    }
  }, [loadLongTermGoals, showToast]);

  const handleCreateReminder = useCallback(async (text: string, dueDate?: string) => {
    try {
      await window.deskflowAPI!.createReminder({ text, due_date: dueDate, goal_id: undefined });
      showToast('Reminder created', 'success');
      loadReminders();
    } catch (e: any) {
      showToast(e.message || 'Failed to create reminder', 'error');
    }
  }, [loadReminders, showToast]);

  const handleToggleReminder = useCallback(async (id: string, done: boolean) => {
    try {
      await window.deskflowAPI!.toggleReminder(id, done);
      loadReminders();
    } catch (e: any) {
      showToast(e.message || 'Failed to update reminder', 'error');
    }
  }, [loadReminders, showToast]);

  const handleDeleteReminder = useCallback(async (id: string) => {
    try {
      await window.deskflowAPI!.deleteReminder(id);
      showToast('Reminder deleted', 'success');
      loadReminders();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete reminder', 'error');
    }
  }, [loadReminders, showToast]);

  const digestBadge = getProviderBadge(aiProviders, aiRouting.researchDigest);
  const defaultBadge = getProviderBadge(aiProviders, aiRouting.default);

  const handleLoadThread = useCallback(async (date: string) => {
    await chat.loadThread(date);
    setChatHistoryOpen(false);
  }, [chat]);

  const handleDeleteThread = useCallback(async (date: string) => {
    await chat.deleteThread(date);
  }, [chat]);

  return (
    <>
      {bootState === 'loading' ? (
        <div className="dk-root">
          <div className="dk-wrap flex items-center justify-center min-h-[70vh]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Loading DeskFlow AI…</p>
            </div>
          </div>
        </div>
      ) : bootState === 'error' ? (
        <div className="dk-root">
          <div className="dk-wrap flex items-center justify-center min-h-[70vh]">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center">
              <div className="rounded-full bg-red-500/10 p-3">
                <span className="text-xl text-red-400">!</span>
              </div>
              <p className="text-sm text-red-400">{bootError || 'Failed to initialize'}</p>
              <button
                onClick={loadBoot}
                className="rounded-lg bg-zinc-800 light:bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 light:bg-zinc-200 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="dk-root">
        <div className="dk-wrap">
          <CurrentCanvas accent="#8b5cf6" render={renderCellular} />
          <div className="relative z-10 dk-topbar">
            <div className="dk-brand">
              <div className="dk-logo">D</div>
              
            </div>
            <div className="dk-barR">
              <span className="dk-chip dk-mode"><span className="dk-dot" />{modeLabelMap[mode]}</span>
              <button className="dk-chip dk-prov hover:bg-zinc-800 light:bg-zinc-100/40 light:bg-zinc-100/40 transition-colors" onClick={() => setConfiguringFeature('default')}><span className="dk-dot" />{defaultBadge?.label ?? "Claude Sonnet"}</button>
              <span className="dk-chip dk-live"><span className="dk-dot" />{chat.hasProvider ? "Connected" : "Offline"}</span>
              <button
                onClick={() => setChatHistoryOpen(true)}
                title="Chat History"
                className="dk-topbar-btn dk-topbar-btn--sm"
              >
                <History size={12} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>History</span>
              </button>
              <button
                onClick={() => setChatLibraryOpen(true)}
                title="Search and group every conversation"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--amber"
              >
                <Library size={12} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Library</span>
              </button>
              <div className="flex items-center bg-zinc-900 light:bg-white/60 light:bg-white/40 rounded-lg p-0.5 border border-zinc-800 light:border-zinc-200/50 light:border-zinc-200/50">
                {(['canvas', 'deck', 'compositions'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCanvasMode(mode)}
                    className={`relative px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${canvasMode === mode ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    {canvasMode === mode && (
                      <motion.div layoutId="mode-pill" className="absolute inset-0 bg-zinc-700 light:bg-zinc-200/60 rounded-md" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />
                    )}
                    <span className="relative z-10">{mode === 'canvas' ? 'CANVAS' : mode === 'deck' ? 'DECK' : 'COMPS'}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setHistoryOpen(v => !v)}
                title="Goals & Reminders"
                className="dk-topbar-btn dk-topbar-btn--sm"
              >
                <Bell size={12} className="text-amber-400" />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Goals</span>
                {reminders.filter(r => !r.done).length > 0 && (
                  <span style={{ marginLeft: 4, borderRadius: 999, background: "rgba(251,191,36,.15)", padding: "0 5px", fontSize: 9, color: "#fbbf24" }}>
                    {reminders.filter(r => !r.done).length}
                  </span>
                )}
              </button>
              <button
                onClick={chat.startNewThread}
                title="New Thread"
                className="dk-topbar-btn dk-topbar-btn--sm"
              >
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>+ New</span>
              </button>
              <button
                onClick={() => setShowFeatures(true)}
                title="AI Features"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--violet"
              >
                <Sparkles size={11} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Features</span>
              </button>
              {/* Group: Navigation */}
              <button
                onClick={() => setHistoryOpen(v => !v)}
                title="Goals & Reminders"
                className="dk-topbar-btn dk-topbar-btn--sm"
              >
                <Bell size={12} className="text-amber-400" />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Goals</span>
                {reminders.filter(r => !r.done).length > 0 && (
                  <span style={{ marginLeft: 4, borderRadius: 999, background: "rgba(251,191,36,.15)", padding: "0 5px", fontSize: 9, color: "#fbbf24" }}>
                    {reminders.filter(r => !r.done).length}
                  </span>
                )}
              </button>
              <button
                onClick={chat.startNewThread}
                title="New Thread"
                className="dk-topbar-btn dk-topbar-btn--sm"
              >
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>+ New</span>
              </button>
              <span className="dk-topbar-sep" />
              {/* Group: AI Tools */}
              <button
                onClick={() => setShowFeatures(true)}
                title="AI Features"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--violet"
              >
                <Sparkles size={11} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Features</span>
              </button>
              {aiSubPage === 'vault' ? (
                <button
                  onClick={() => setAiSubPage(p => (p === 'vault' ? 'assistant' : 'vault'))}
                  title="AI Debug Vault"
                  className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--amber"
                >
                  <Bug size={11} />
                  <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Vault</span>
                </button>
              ) : null}
              {aiSubPage === 'context' ? (
                <button
                  onClick={() => setAiSubPage(p => (p === 'context' ? 'assistant' : 'context'))}
                  title="AI Context Captures"
                  className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--cyan"
                >
                  <MessageSquare size={11} />
                  <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Context</span>
                </button>
              ) : null}
              <button
                onClick={() => setAiSubPage(p => (p === 'brain' ? 'assistant' : 'brain'))}
                title="Context Brain — knowledge graph, search, external AI trail"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--amber"
              >
                <Brain size={11} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Brain</span>
              </button>
              <button
                onClick={() => setConfiguringFeature('vision')}
                title="Configure Vision Model"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--pink"
              >
                <Eye size={11} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Vision</span>
              </button>
              <span className="dk-topbar-sep" />
              {/* Group: Utilities */}
              <button
                onClick={() => setExportOpen(true)}
                title="Export, import, or save this conversation to the brain"
                className="dk-topbar-btn dk-topbar-btn--sm dk-topbar-btn--green"
              >
                <Download size={11} />
                <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Export</span>
              </button>
            </div>
          </div>

          <Suspense fallback={<LazyFallback />}>
          {aiSubPage === 'vault' ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <DebugVaultPanel open={true} />
            </div>
          ) : aiSubPage === 'context' ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <AiContextPanel open={true} />
            </div>
          ) : aiSubPage === 'brain' ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <BrainSurface onOpenLibrary={() => setChatLibraryOpen(true)} />
            </div>
          ) : canvasMode === 'compositions' ? (
            <div style={{ flex: 1, minHeight: 0, padding: 20 }} data-section="ai.compositions">
              <CompositionPanel />
            </div>
          ) : canvasMode === 'deck' ? (
          <div data-section="ai.deck">
          <AiPageDeck
              messages={chat.messages.map((m): import('../components/ai/chat/ChatPanel').ChatMessage => ({
                id: m.id,
                role: m.role,
                content: stripAutomationBlock(m.content),
                parsed: m.parsed,
                timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
              }))}
              streaming={chat.streaming}
              thinking={chat.thinking}
              connecting={chat.connecting}
              provider={defaultBadge?.label}
              online={chat.hasProvider}
              input={chat.input}
              onInputChange={chat.setInput}
              onSend={handleSend}
              onStop={chat.stop}
              onReset={chat.reset}
              onCardAction={onCardAction}
actionResults={actionResults}
               connectorSyncing={connectorSyncing}
               contextWarnings={contextWarnings}
               dismissError={dismissError}
               modeLabel={modeLabelMap[mode]}
               glanceMetrics={glanceMetrics}
               agentSteps={chat.agentSteps}
               agentStatus={chat.agentStatus}
               pendingConfirm={chat.pendingConfirm}
               connectorsSlot={
                <ActionOverlay
                  status={aiActions.isSlotActive('connectors') ? 'executing' : aiActions.lastCompleted?.targetSlot === 'connectors' ? 'complete' : null}
                  actionType="email-send"
                  label={aiActions.getActionForSlot('connectors')?.label}
                >
                <ConnectorsPanel
                  state={connectorsState}
                  connectors={connectors}
                  errorMessage={goalsError || undefined}
                  onRetry={loadGoals}
                  onAdd={() => setShowConnectorSetup(true)}
                  onSync={async (id) => {
                    setConnectorSyncing(prev => ({ ...prev, [id]: true }));
                    try {
                      const r = await window.deskflowAPI!.connectors?.sync?.(id);
                      if (r?.success) {
                        showToast(`Synced — ${r.itemsAdded || 0} items`, 'success');
                      } else {
                        showToast(r?.error || 'Sync failed', 'error');
                      }
                      await loadConnectors();
                    } catch (e: any) {
                      showToast(e.message || 'Sync failed', 'error');
                    }
                    setConnectorSyncing(prev => { const n = { ...prev }; delete n[id]; return n; });
                  }}
                  onReply={async (connectorId: string, itemId: string, draft: string) => {
                    const actionId = `email-send-${Date.now()}`
                    actionBus.start(actionId, 'email-send', 'Sending email', { targetSlot: 'connectors' })
                    try {
                      const r = await (window.deskflowAPI!.connectors as any)?.sendEmail?.(connectorId, { to: '', subject: '', body: draft, inReplyTo: itemId });
                      if (r?.success) { actionBus.complete(actionId); showToast('Reply sent', 'success'); }
                      else { actionBus.fail(actionId, r?.error); showToast(r?.error || 'Send failed', 'error'); }
                    } catch (e: any) { actionBus.fail(actionId, e?.message); showToast(e.message || 'Send failed', 'error'); }
                  }}
                  onMarkRead={async (connectorId: string, itemId: string, read: boolean) => {
                    try {
                      await (window.deskflowAPI!.connectors as any)?.markRead?.(itemId, read);
                      await loadConnectors();
                    } catch (e: any) { showToast(e.message || 'Mark failed', 'error'); }
                  }}
                  onDelete={async (connectorId: string) => {
                    try {
                      const r = await (window.deskflowAPI!.connectors as any)?.remove?.(connectorId);
                      if (r?.success) { showToast('Connector deleted', 'success'); await loadConnectors(); }
                      else showToast(r?.error || 'Delete failed', 'error');
                    } catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
                  }}
                  onAddToSchedule={async (connectorId: string, data: { title: string; day_of_week: number; start_time: string; end_time: string }) => {
                    const actionId = `schedule-add-${Date.now()}`
                    actionBus.start(actionId, 'schedule-add', 'Adding to schedule', { targetSlot: 'schedule' })
                    try {
                      const r = await (window.deskflowAPI as any)?.addScheduleEntry?.({
                        title: data.title, day_of_week: data.day_of_week, start_time: data.start_time, end_time: data.end_time, category: 'email', color: '#8b5cf6',
                      });
                      if (r?.success) { actionBus.complete(actionId); showToast('Added to schedule', 'success'); }
                      else { actionBus.fail(actionId, r?.error); showToast(r?.error || 'Failed to add', 'error'); }
                    } catch (e: any) { actionBus.fail(actionId, e?.message); showToast(e.message || 'Failed to add', 'error'); }
                  }}
                  onCreateDeadline={async (connectorId: string, data: { title: string; due_date: string; priority: string }) => {
                    const actionId = `deadline-add-${Date.now()}`
                    actionBus.start(actionId, 'deadline-add', 'Creating deadline', { targetSlot: 'deadline' })
                    try {
                      const r = await (window.deskflowAPI as any)?.addDeadline?.({
                        title: data.title, due_date: data.due_date, priority: data.priority,
                        category: 'email',
                      });
                      if (r?.success) { actionBus.complete(actionId); showToast('Deadline created', 'success'); }
                      else { actionBus.fail(actionId, r?.error); showToast(r?.error || 'Failed to create', 'error'); }
                    } catch (e: any) { actionBus.fail(actionId, e?.message); showToast(e.message || 'Failed to create', 'error'); }
                  }}
                  onToast={showToast}
                  onRefresh={loadConnectors}
                  onTest={async (id) => {
                    try {
                      const r = await window.deskflowAPI!.connectors?.test?.(id);
                      await loadConnectors();
                      if (r?.success) {
                        return { success: true, message: r.message || `Connected (${r.latencyMs || '?'}ms)` };
                      }
                      return { success: false, message: r?.message || 'Test failed' };
                    } catch (e: any) {
                      return { success: false, message: e.message || 'Test failed' };
                    }
                  }}
                />
                </ActionOverlay>
              }
              focusSlot={
                <ActionOverlay
                  status={aiActions.isSlotActive('focus') ? 'executing' : aiActions.lastCompleted?.targetSlot === 'focus' ? 'complete' : null}
                  actionType="goal-toggle"
                  label={aiActions.getActionForSlot('focus')?.label}
                >
                  <FocusBoard
                  state={goalsDataState}
                  mode={mode}
                  goals={goals}
                  planGoals={planGoals}
                  suggestions={suggestions}
                  metrics={focusMetrics}
                  reviewSummary={review || undefined}
                  onToggleGoal={handleToggleGoal}
                  onAcceptSuggestion={handleAcceptSuggestion}
                  onDismissSuggestion={handleDismissSuggestion}
                  onSuggestGoals={handleSuggest}
                  onSaveReview={handleSaveReview}
                  errorMessage={goalsError || undefined}
                  onRetry={loadGoals}
                  onConfigure={() => setConfiguringFeature('goalAssistant')}
                  reviewError={reviewError}
                  toggleErrors={toggleErrors}
                  acceptErrors={acceptErrors}
                  onRetryReview={() => { setReviewError(null); handleSaveReview(review || ''); }}
                  onDismissReviewError={() => setReviewError(null)}
                />
                </ActionOverlay>
              }
              planSlot={
                <PlanBoard
                  state={goalsDataState}
                  goals={longTermGoals}
                  notes={planningNotes}
                  savingNotes={savingNotes}
                  onSaveNotes={handleSaveNotes}
                  onAnalyzeDump={handleAnalyzeDump}
                  onSaveGoals={handleSaveGoals}
                  onToggleGoal={handleToggleLongTermGoal}
                  onDeleteGoal={handleDeleteLongTermGoal}
                  onUpdateGoal={handleUpdateLongTermGoal}
                  errorMessage={goalsError || undefined}
                  onRetry={loadGoals}
                />
              }
              reflectSlot={
                <ReflectFeed
                  state={goalsDataState}
                  days={reflectDays.length ? reflectDays : [{ date: today, goals, reviewSummary: review || undefined }]}
                  errorMessage={goalsError || undefined}
                  onRetry={loadGoals}
                  dayWindow={dayWindow}
                  onLoadOlder={handleLoadOlder}
                />
              }
              dailyPlannerSlot={
                <div style={{ padding: 16 }}>
                  <DailyPlannerCard date={today} />
                </div>
              }
              scheduleSlot={
                <div style={{ padding: 16 }}>
                  <WeeklyScheduleCard />
                </div>
              }
              deadlineSlot={
                <div style={{ padding: 16 }}>
                  <DeadlineTrackerCard />
                </div>
              }
               automationsSlot={
                <ActionOverlay
                  status={aiActions.isSlotActive('automations') ? 'executing' : aiActions.lastCompleted?.targetSlot === 'automations' ? 'complete' : null}
                  actionType="composition-create"
                  label={aiActions.getActionForSlot('automations')?.label}
                >
                  <AutomationList />
                </ActionOverlay>
              }
               historySlot={undefined}
              memoryChips={chat.memories.slice(0, 6)}
              onNewThread={chat.startNewThread}
              connectorStatus={connectorStatus}
               expandedCardIds={expandedCardIds}
               onExpandedCardChange={(ids: Set<string>) => setExpandedCardIds(ids)}
               onOpenHistory={() => setChatHistoryOpen(true)}
               onOpenCommands={() => setCommandsOpen(true)}
               onExpandConnectors={() => {
                requestAnimationFrame(() => {
                  document.getElementById("deck-card-connectors")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                })
              }}
              listening={voice.state === 'listening'}
              onToggleVoice={voice.state === 'listening' ? voice.stop : voice.start}
              voiceSupported={voice.supported}
              autoApprove={autoApprove}
              onToggleAutoApprove={() => setAutoApprove(v => !v)}
              onAddGoal={() => {
                setExpandedCardIds(new Set(['daily-planner']))
                showToast('Add a goal using the form in Daily Planner', 'info')
              }}
              onAddSchedule={() => {
                setExpandedCardIds(new Set(['schedule']))
                showToast('Add a schedule entry using the form in Schedule', 'info')
              }}
              onAddDeadline={() => {
                setExpandedCardIds(new Set(['deadlines']))
                showToast('Add a deadline using the Deadline Tracker', 'info')
              }}
              onAddReminder={() => setHistoryOpen(true)}
              onOpenFeatures={() => setShowFeatures(true)}
              digestSlot={
                <DailyDigestBoard
                  variant="inset"
                  state={digestDataState}
                  topics={digestTopics.map(t => ({ topic: t.topic || t.title || '', summary: t.summary || '', sources: t.sources, date: t.date, confidence: t.confidence, source: t.source, stats: t.stats, tags: t.tags, mentions: t.mentions, headline: t.headline }))}
                  generating={digestState === 'loading'}
                  provider={digestBadge?.label}
                  readyToGenerate={digestTopics.length === 0}
                  errorMessage={digestReason || undefined}
                  onRefresh={() => loadDigest(true, true)}
                  onConfigure={() => setConfiguringFeature('researchDigest')}
                  onGenerate={() => loadDigest(true, true)}
                  onDismissError={() => { setDigestState('ready'); setDigestReason(null); }}
                />
              }
            />
          </div>
          ) : (
          <div data-tutorial="ai.canvas" data-section="ai.canvas" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CanvasContainer
              cards={enrichedCards}
              onMoveCard={canvas.moveCard}
              onDismissCard={canvas.dismissCard}
              onArrangeCards={canvas.arrangeCards}
              onPinCard={canvas.pinCard}
              onResizeCard={canvas.resizeCard}
              onCardClick={(id) => setSelectedCardId(id)}
              onUpdateCard={canvas.updateCard}
              groups={canvas.groups}
              onUpdateGroup={canvas.updateGroup}
              onUngroup={canvas.ungroup}
              onRemoveFromGroup={canvas.removeFromGroup}
              saveStatus={canvas.saveStatus}
              onSaveCanvas={canvas.forceSave}
              onSend={handleSend}
              onStop={chat.stop}
              streaming={chat.streaming}
              thinking={chat.thinking}
              connecting={chat.connecting}
              focusedCardId={focusedCardId}
              autoFocus={autoFocus}
              onToggleAutoFocus={() => setAutoFocus(v => !v)}
              onOpenPalette={() => setPaletteOpen(true)}
              onGroupCards={(cardIds) => {
                if (cardIds.length < 2) return
                const groupedCards = cardIds.map(id => canvas.allCards[id]).filter(Boolean)
                if (groupedCards.length < 2) return

                // Compute center position
                const avgX = groupedCards.reduce((sum, c) => sum + c.position.x, 0) / groupedCards.length
                const avgY = groupedCards.reduce((sum, c) => sum + c.position.y, 0) / groupedCards.length

                // Use the hook's createGroup which handles everything
                canvas.createGroup(`Group (${groupedCards.length})`, cardIds, 'violet')
              }}
              canvasList={canvas.canvasList}
              activeCanvasId={null}
              onLoadCanvas={canvas.loadCanvas}
              onRenameCanvas={canvas.rename}
              onDeleteCanvas={canvas.removeCanvas}
              onSaveAs={canvas.saveAs}
              onSetPanZoom={canvas.setPanZoom}
              onNewCanvas={() => canvas.clearAll()}
              onAddCard={(type) => {
                canvas.addCard(type, {}, {
                  position: { x: 40 + Math.random() * 200, y: 40 + Math.random() * 200 },
                  size: { w: 8, h: 5 },
                  pinned: false,
                  source: 'user',
                })
              }}
              onUndo={canvas.undo}
              onRedo={canvas.redo}
              canUndo={canvas.canUndo}
              canRedo={canvas.canRedo}
            />
          </div>
          )}
          </Suspense>

        </div>
      </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onIntent={handlePaletteIntent} />

      <AIFeaturesModal open={showFeatures} onClose={() => setShowFeatures(false)} onTryIt={(prompt) => { chat.setInput(prompt); setShowFeatures(false); }} />
      <ConnectorSetupModal open={showConnectorSetup} onClose={() => setShowConnectorSetup(false)} onCreated={() => { setShowConnectorSetup(false); loadConnectors(); }} />

      <AiProviderSelectModal open={configuringFeature === 'researchDigest'} onClose={() => setConfiguringFeature(null)} featureKey="researchDigest" featureLabel="Research Digest" accentColor="from-cyan-500 to-blue-500" providers={aiProviders} currentRouting={aiRouting.researchDigest} onSave={(e) => handleRoutingSave('researchDigest', e)} />
      <AiProviderSelectModal open={configuringFeature === 'goalAssistant'} onClose={() => setConfiguringFeature(null)} featureKey="goalAssistant" featureLabel="Daily Plan" accentColor="from-emerald-500 to-teal-500" providers={aiProviders} currentRouting={aiRouting.goalAssistant} onSave={(e) => handleRoutingSave('goalAssistant', e)} />
      <AiProviderSelectModal open={configuringFeature === 'default'} onClose={() => setConfiguringFeature(null)} featureKey="default" featureLabel="AI Chat" accentColor="from-violet-500 to-purple-500" providers={aiProviders} currentRouting={aiRouting.default} onSave={(e) => handleRoutingSave('default', e)} />
      <AiProviderSelectModal open={configuringFeature === 'vision'} onClose={() => setConfiguringFeature(null)} featureKey="vision" featureLabel="Vision Model" accentColor="from-pink-500 to-rose-500" providers={aiProviders} currentRouting={aiRouting.vision} onSave={(e) => handleRoutingSave('vision', e)} />

      {/* Chat History Modal */}
      <ChatHistory
        open={chatHistoryOpen}
        onClose={() => setChatHistoryOpen(false)}
        threads={chat.threads || []}
        currentThreadDate={chat.currentThreadDate}
        onLoadThread={handleLoadThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={chat.renameThread}
        onNewThread={chat.startNewThread}
      />

      {/* Chat Library — search, group and browse every conversation */}
      <ChatLibrary
        open={chatLibraryOpen}
        onClose={() => setChatLibraryOpen(false)}
        onOpenThread={(threadDate) => {
          setChatLibraryOpen(false);
          void handleLoadThread(threadDate);
        }}
      />

      {/* Export / Import / Save-to-brain */}
      <ChatExportBridge
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        threadDate={chat.currentThreadDate}
        threadTitle={(chat.threads || []).find((t: any) => t.threadDate === chat.currentThreadDate)?.title}
        messageCount={chat.messages?.length}
      />

      <SlashCommandManager
        open={commandsOpen}
        onClose={() => setCommandsOpen(false)}
      />

      {/* Goals & Reminders Modal */}
      <GoalsRemindersDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        goals={goals}
        longTermGoals={longTermGoals}
        events={calendarEvents}
        reminders={reminders}
        onToggleReminder={handleToggleReminder}
        onCreateReminder={handleCreateReminder}
        onDeleteReminder={handleDeleteReminder}
        onOpenGoal={(id) => {
          setHistoryOpen(false);
          setExpandedCardId("focus");
        }}
        onOpenHistory={() => {
          setHistoryOpen(false);
          setChatHistoryOpen(true);
        }}
        loading={remindersLoading}
        error={remindersError || undefined}
      />

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all ${
              t.type === 'success' ? 'border-l-[3px] border-emerald-500 bg-emerald-500/10 text-emerald-200' :
              t.type === 'error' ? 'border-l-[3px] border-red-500 bg-red-500/10 text-red-200' :
              'border-l-[3px] border-indigo-500 bg-indigo-500/10 text-indigo-200'
            }`}
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <span className="text-base">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="ml-2 text-current opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
