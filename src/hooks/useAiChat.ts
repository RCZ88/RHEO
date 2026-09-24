import { useCallback, useEffect, useRef, useState } from "react"
import { generateUUID } from '../lib/uuid'
import type { DeskflowAPI } from '../types/deskflow-api'
import { aiAgentService } from '../services/ai'
import { toolRegistry } from '../services/ai'
import '../../services/ai/canvasTools'
import {
  parseAssistantContent,
  serializeParsed,
  type ParsedMessage,
} from "../components/ai/chat/parsed"
import { buildContextBundleDetailed, todayIso } from "../services/aiContextBundle"
import { parseNlAutomation, stripAutomationBlock } from "../components/ai/automations/lib/nlParser"
import { generateDsl } from "../components/ai/automations/lib/dslGenerator"

export interface AgentStep { id: string; label: string; status: 'pending' | 'active' | 'done' }

export interface ChatMsg {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp?: number
  parsed?: ParsedMessage
}

export interface ChatThreadMeta {
  threadDate: string
  title?: string
  messageCount: number
  lastMessageAt?: number
  preview?: string
}

type AnyRec = Record<string, unknown>

function bridge(): DeskflowAPI | undefined {
  const w = window as unknown as { deskflowAPI?: DeskflowAPI }
  return w.deskflowAPI
}

function uid(): string {
  return generateUUID()
}

function getThreadDate(ts = Date.now()) {
  return new Date(ts).toISOString().split("T")[0]
}

interface ProviderState {
  providers?: Array<{ id: string; enabled?: boolean; models?: string[] }>
  routing?: { default?: { providerId?: string; model?: string } }
}

function pickTarget(state: ProviderState | null): { provider: unknown; model: string } | null {
  const providers = state?.providers || []
  const enabled = providers.filter((p) => p.enabled)
  if (enabled.length === 0) return null
  const def = state?.routing?.default
  const target = def?.providerId ? enabled.find((p) => p.id === def.providerId) || enabled[0] : enabled[0]
  const model = def?.model || target.models?.[0] || "gpt-3.5-turbo"
  return { provider: target, model }
}

export interface UseAiChat {
  messages: ChatMsg[]
  input: string
  setInput: (v: string) => void
  streaming: boolean
  thinking: boolean
  connecting: boolean
  error: string | null
  contextWarnings: string[]
  hasProvider: boolean
  send: (text?: string) => Promise<void>
  stop: () => void
  reset: () => Promise<void>
  dismissError: () => void
  setAssistantMessage: (id: string, patch: Partial<ChatMsg>) => void
  addMessage: (msg: ChatMsg) => void
  // History
  threads: ChatThreadMeta[]
  currentThreadDate: string
  loadThread: (threadDate: string) => Promise<void>
  deleteThread: (threadDate: string) => Promise<void>
  renameThread: (threadDate: string, newTitle: string) => void
  refreshThreads: () => Promise<void>
  startNewThread: () => void
  // Memory
  memories: { id: string; text: string; category: string }[]
}

export function useAiChat(): UseAiChat {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextWarnings, setContextWarnings] = useState<string[]>([])
  const [hasProvider, setHasProvider] = useState(true)
  const [threads, setThreads] = useState<ChatThreadMeta[]>([])
  const [currentThreadDate, setCurrentThreadDate] = useState(getThreadDate())
  const [memories, setMemories] = useState<{ id: string; text: string; category: string }[]>([])
  const [agentSteps, setAgentSteps] = useState<Array<{id:string;label:string;status:'pending'|'active'|'done'}>>([])
  const [agentStatus, setAgentStatus] = useState<string | undefined>()
  const [pendingConfirm, setPendingConfirm] = useState<{toolName:string;args:any}|null>(null)

  const cleanupRef = useRef<null | (() => void)>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingRef = useRef(false)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const threadDateRef = useRef(currentThreadDate)
  threadDateRef.current = currentThreadDate

  const persist = useCallback(
    (msgs: ChatMsg[], threadDate?: string) => {
      const b = bridge()
      const td = threadDate ?? threadDateRef.current
      if (!b || typeof b.aiChatSave !== "function") return
      try {
        (b.aiChatSave as (a: AnyRec) => unknown)({
          threadDate: td,
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            parsed_json: serializeParsed(m.parsed),
            timestamp: m.timestamp,
          })),
        })
      } catch (e) {
        console.error('[useAiChat] persist:', e)
      }
    },
    [],
  )

  // Debounced persist — saves messages whenever they change, so navigating away never loses data
  useEffect(() => {
    if (messages.length === 0) return
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persist(messages)
    }, 500)
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current) }
  }, [messages, persist])

  // Load threads list
  const refreshThreads = useCallback(async () => {
    try {
      const b = bridge()
      if (!b || typeof b.aiChatListThreads !== "function") return
      const raw = await (b.aiChatListThreads as () => Promise<unknown>)()
      const list = Array.isArray(raw) ? raw : (raw as any)?.threads || []
      if (Array.isArray(list)) {
        setThreads(list.map((t: any) => ({
          threadDate: t.threadDate,
          title: t.title,
          messageCount: t.messageCount ?? 0,
          lastMessageAt: t.lastMessageAt,
          preview: t.preview,
        })))
      }
    } catch (e) {
      console.error('[useAiChat] refreshThreads:', e)
    }
  }, [])

  useEffect(() => { refreshThreads() }, [refreshThreads])

  // Subscribe to aiAgentService progress
  useEffect(() => {
    aiAgentService.setProgressCallback(p => {
      setAgentStatus(p.message);
      setStreaming(prev => prev);
      if (p.status === 'executing' && p.toolName) {
        setAgentSteps(s => [...s.filter(x => x.status !== 'active'), { id: p.toolName! + Date.now(), label: 'Running ' + p.toolName, status: 'active' }]);
      }
      if (p.status === 'completed' || p.status === 'error') {
        setAgentSteps(s => s.map(x => x.status === 'active' ? { ...x, status: 'done' } : x));
      }
    });
    return () => aiAgentService.clearProgressCallback();
  }, []);

  // Listen for canvas-add events from tool handler
  useEffect(() => {
    const h = (e: any) => { const { title, body, kind } = e.detail || {}; if (title) addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '### ' + title + '\n' + (body || ''), timestamp: Date.now() }); };
    window.addEventListener('deskflow:ai-canvas-add', h);
    return () => window.removeEventListener('deskflow:ai-canvas-add', h);
  }, []);

  // Load memories for a thread
  const loadMemories = useCallback(async (threadDate: string) => {
    try {
      const b = bridge()
      if (!b || typeof b.aiChatGetMemories !== "function") return
      const mems = await (b.aiChatGetMemories as (d: string) => Promise<unknown>)(threadDate)
      if (Array.isArray(mems)) {
        setMemories(mems.map((m: any) => ({
          id: m.id,
          text: m.content,
          category: m.category,
        })))
      }
    } catch (e) {
      console.error('[useAiChat] loadMemories:', e)
    }
  }, [])

  // Load specific thread
  const loadThread = useCallback(async (threadDate: string) => {
    try {
      const b = bridge()
      if (!b || typeof b.aiChatLoad !== "function") return
      const raw = await (b.aiChatLoad as (d: string) => Promise<unknown>)(threadDate) as
        | Array<AnyRec>
        | { messages?: Array<AnyRec> }
        | null
      const list = Array.isArray(raw) ? raw : raw?.messages || []
      if (list.length) {
        setMessages(
          list.map((m) => {
            const content = String(m.content ?? "")
            const { text, parsed } = parseAssistantContent(
              content,
              (m.parsed_json as string | undefined) ?? null,
            )
return {
      id: String(m.id ?? uid()),
      role: (m.role as "user" | "assistant") || "assistant",
      content: parsed && parsed.type !== "text" ? text : content,
      parsed: parsed && parsed.type !== "text" ? parsed : undefined,
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : Number(m.timestamp) || undefined,
    }
          }),
        )
      } else {
        setMessages([])
      }
      setCurrentThreadDate(threadDate)
      setError(null)
      setContextWarnings([])
      await loadMemories(threadDate)
    } catch (e) {
      console.error('[useAiChat] loadThread:', e)
      setError("Failed to load thread")
    }
  }, [loadMemories])

  // Load today's thread on mount
  useEffect(() => {
    const today = getThreadDate()
    setCurrentThreadDate(today)
    loadThread(today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check provider
  useEffect(() => {
    const b = bridge()
    let cancelled = false
    ;(async () => {
      try {
        if (b && typeof b.getAiProviders === "function") {
          const st = (await (b.getAiProviders as () => Promise<unknown>)()) as ProviderState
          if (!cancelled) setHasProvider(Boolean(pickTarget(st)))
        }
      } catch (e) {
        console.error('[useAiChat] checkProvider:', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const setAssistantMessage = useCallback((id: string, patch: Partial<ChatMsg>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const stop = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    streamingRef.current = false
    setStreaming(false)
    setThinking(false)
    setConnecting(false)
  }, [])

  const reset = useCallback(async () => {
    stop()
    setMessages([])
    setError(null)
    const b = bridge()
    try {
      if (b && typeof b.aiChatReset === "function") {
        await (b.aiChatReset as (d: string) => Promise<unknown>)(threadDateRef.current)
      }
    } catch (e) {
      console.error('[useAiChat] reset:', e)
    }
    await refreshThreads()
  }, [stop, refreshThreads])

  const deleteThread = useCallback(async (threadDate: string) => {
    const b = bridge()
    try {
      if (b && typeof b.aiChatReset === "function") {
        await (b.aiChatReset as (d: string) => Promise<unknown>)(threadDate)
      }
    } catch (e) {
      console.error('[useAiChat] deleteThread:', e)
    }
    if (threadDate === threadDateRef.current) {
      const newDate = getThreadDate()
      setCurrentThreadDate(newDate)
      setMessages([])
      setError(null)
      setContextWarnings([])
      setMemories([])
    }
    await refreshThreads()
  }, [refreshThreads])

  const startNewThread = useCallback(() => {
    const newDate = getThreadDate()
    setCurrentThreadDate(newDate)
    setMessages([])
    setError(null)
    setContextWarnings([])
    setMemories([])
  }, [])

  const renameThread = useCallback((threadDate: string, newTitle: string) => {
    try {
      const b = bridge()
      if (b && typeof b.aiChatRenameThread === "function") {
        (b.aiChatRenameThread as (d: string, t: string) => Promise<unknown>)(threadDate, newTitle)
      }
    } catch (e) {
      console.error('[useAiChat] renameThread:', e)
    }
    setThreads(prev => prev.map(t => t.threadDate === threadDate ? { ...t, title: newTitle } : t))
  }, [])

  // Extract memories from completed conversation
  const extractMemories = useCallback(async (threadDate: string, msgs: ChatMsg[]) => {
    try {
      const b = bridge()
      if (!b || typeof b.aiChatExtractMemories !== "function") return
      const assistantMsgs = msgs.filter(m => m.role === "assistant" && m.content.length > 20)
      if (assistantMsgs.length === 0) return
      await (b.aiChatExtractMemories as (a: AnyRec) => Promise<unknown>)({
        threadDate,
        messages: assistantMsgs.map(m => ({ content: m.content, parsed: m.parsed })),
      })
      await loadMemories(threadDate)
    } catch (e) {
      console.error('[useAiChat] extractMemories:', e)
    }
  }, [loadMemories])

  const send = useCallback(
    async (textArg?: string, images?: string[]) => {
      const text = (textArg ?? input).trim()
      if (!text || streamingRef.current) return
      const b = bridge()
      if (!b || typeof b.getAiProviders !== "function" || typeof b.providerChatCall !== "function") {
        setError("Chat backend unavailable.")
        return
      }

      setError(null)
      setInput("")

      const userMsg: ChatMsg = { id: uid(), role: "user", content: text, timestamp: Date.now() }
      const assistantId = uid()
      const assistantMsg: ChatMsg = { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }

      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setConnecting(true)
      setThinking(false)

      const useAgentLoop = true;

      // Agent loop path
      if (useAgentLoop) {
        aiAgentService.currentRequestId = crypto.randomUUID();
        setStreaming(true); setAgentSteps([]); setAgentStatus('Starting agent...');
        try {
          const reply = await aiAgentService.processMessage(text);
          setAssistantMessage(assistantId, { content: reply });
          await finish(reply);
        } catch (e: any) {
          setAssistantMessage(assistantId, { parsed: { type: 'error', message: 'Agent failed', recovery: String(e?.message || e) } });
          stop();
        }
        return;
      }

      let target: { provider: unknown; model: string } | null = null
      let providerState: ProviderState | null = null
      try {
        providerState = (await (b.getAiProviders as () => Promise<unknown>)()) as ProviderState
        target = pickTarget(providerState)
      } catch (e) {
        console.error('[useAiChat] pickTarget:', e)
        target = null
      }
      if (!target) {
        setHasProvider(false)
        setConnecting(false)
        setThinking(false)
        setAssistantMessage(assistantId, {
          parsed: {
            type: "error",
            message: "No AI provider configured",
            recovery: "Open the provider selector and enable a model to start chatting.",
          },
        })
        setStreaming(false)
        return
      }
      setHasProvider(true)

      // Vision routing: if images are attached and a dedicated vision provider is configured, use it.
      if (images?.length && providerState?.routing?.vision) {
        const vp = providerState.providers.find(pr => pr.id === providerState!.routing.vision!.providerId)
        if (vp) target = { provider: vp, model: providerState.routing.vision.model }
      }



      let systemPrompt = ""
      try {
        const bundle = await buildContextBundleDetailed()
        systemPrompt = bundle.content
        if (bundle.warnings.length) setContextWarnings(bundle.warnings)
      } catch (e) {
        console.error('[useAiChat] buildContextBundle:', e)
        systemPrompt = "You are DeskFlow AI."
      }

      // Inject relevant memories into system prompt
      const relevantMemories = memories
        .filter(m => m.category === "preference" || m.category === "goal")
        .map(m => m.text)
        .slice(0, 5)

      const memorySuffix = relevantMemories.length > 0
        ? `\n\n[Relevant memories from past conversations]:\n${relevantMemories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
        : ""

      const userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> =
        images?.length
          ? [
              { type: "text", text },
              ...images.map((d) => ({ type: "image_url", image_url: { url: d } })),
            ]
          : text

      const payloadMessages = [
        { role: "system", content: systemPrompt + memorySuffix },
        ...history,
        { role: "user", content: userContent },
      ]

      let full = ""
      streamingRef.current = true
      setStreaming(true)

      const finish = async (finalText: string) => {
        // §11 — Natural Language → Automation. Detect fenced ```automation
        // JSON, create the rule via IPC, strip the block from the visible text.
        let displayText = finalText
        const nl = parseNlAutomation(finalText)
        if (nl) {
          try {
            await bridge()?.compositionsCreate?.({
              id: generateUUID(),
              name: nl.config.name,
              description: nl.narration || nl.config.name,
              dsl_source: generateDsl(nl.config),
              enabled: 1,
              priority: nl.config.priority,
              category: nl.config.category,
              lifecycle: nl.config.lifecycle,
            })
            displayText = `${stripAutomationBlock(finalText)}\n\n${nl.narration}`
          } catch (e) {
            console.error("[useAiChat] automation create:", e)
            displayText = stripAutomationBlock(finalText)
          }
        }
        const { text: prose, parsed } = parseAssistantContent(displayText)
        try {
          const api = (window as any).deskflowAPI
          if (api?.aiDebugLog) {
            api.aiDebugLog({ source: "ai-assistant", event: "parsed", provider: target?.provider?.id, model: target?.model, contextId: threadDateRef.current, role: "assistant", payload: { parsed, displayText } })
          }
        } catch { /* vault push is best-effort */ }
setMessages((prev) => {
           const next = prev.map((m) =>
             m.id === assistantId
               ? { ...m, content: parsed && parsed.type !== "text" ? prose : displayText, parsed: parsed && parsed.type !== "text" ? parsed : undefined }
               : m,
           )
           persist(next)
           void extractMemories(threadDateRef.current, next)
           return next
         })
        stop()
      }

      if (typeof b.onProviderChunk === "function") {
        cleanupRef.current = (b.onProviderChunk as (cb: (d: AnyRec) => void) => () => void)((d) => {
          if (d.error) {
            setConnecting(false)
            setThinking(false)
            setAssistantMessage(assistantId, {
              parsed: {
                type: "error",
                message: "The model returned an error",
                recovery: String(d.error),
              },
            })
            stop()
            return
          }
          if (typeof d.delta === "string" && d.delta) {
            setConnecting(false)
            setThinking(false)
            full += d.delta
            setAssistantMessage(assistantId, { content: full })
          }
          if (d.done) finish(typeof d.full === "string" && d.full ? d.full : full)
        })
      }

      timeoutRef.current = setTimeout(() => {
        if (!full) {
          setAssistantMessage(assistantId, {
            parsed: { type: "error", message: "Request timed out", recovery: "Try again or pick another model." },
          })
        }
        stop()
      }, 60000)

      try {
        await (b.providerChatCall as (a: AnyRec) => Promise<unknown>)({
          provider: target.provider,
          messages: payloadMessages,
          model: target.model,
        })
      } catch (e) {
        setConnecting(false)
        setThinking(false)
        setAssistantMessage(assistantId, {
          parsed: {
            type: "error",
            message: "Could not reach the model",
            recovery: e instanceof Error ? e.message : "Check your provider settings.",
          },
        })
        stop()
      }

      // Extract memories after completion
      const finalThreadDate = threadDateRef.current
      await extractMemories(finalThreadDate, [...messages, userMsg, { id: assistantId, role: "assistant", content: full }])
      await refreshThreads()

      // Auto-context: extract signals from user message
      try {
        const api = (window as any).deskflowAPI
        if (api?.contextAddSignal) {
          // Extract interests from user message
          const lowerText = text.toLowerCase()
          const interestKeywords = ['learn', 'study', 'read', 'watch', 'research', 'explore', 'build', 'create', 'design', 'code', 'program', 'develop', 'plan', 'organize', 'track', 'manage']
          for (const kw of interestKeywords) {
            if (lowerText.includes(kw)) {
              await api.contextAddSignal('interest', `User expressed interest in: ${kw}`, 'chat', 0.3)
            }
          }
          // Extract communication style signals
          if (text.length > 200) {
            await api.contextAddSignal('communication', 'Writes detailed messages', 'chat', 0.2)
          } else if (text.length < 50) {
            await api.contextAddSignal('communication', 'Prefers concise messages', 'chat', 0.2)
          }
          // Extract task-related signals
          if (lowerText.includes('todo') || lowerText.includes('task') || lowerText.includes('need to') || lowerText.includes('should')) {
            await api.contextAddSignal('habit', 'Uses task-oriented language', 'chat', 0.3)
          }
          if (lowerText.includes('feel') || lowerText.includes('think') || lowerText.includes('opinion') || lowerText.includes('prefer')) {
            await api.contextAddSignal('trait', 'Expresses opinions and preferences', 'chat', 0.3)
          }
          // Rebuild profile periodically (every 10 signals)
          const signals = await api.contextGetSignals(undefined, undefined, 1)
          if (signals && signals.length > 0 && signals[0].occurrenceCount % 10 === 0) {
            await api.contextRebuild()
          }
        }
      } catch { /* context signal extraction is best-effort */ }
    },
    [input, messages, persist, setAssistantMessage, stop, memories, extractMemories, refreshThreads],
  )

  const addMessage = useCallback((msg: ChatMsg) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  useEffect(() => () => stop(), [stop])

  // Poll for pending confirmation
  useEffect(() => {
    if (!streaming) return
    const id = setInterval(() => { setPendingConfirm(aiAgentService.getPendingConfirm()) }, 500)
    return () => clearInterval(id)
  }, [streaming])

  // Reset agent on reset/startNewThread/loadThread
  const resetWrapped = useCallback(async () => { aiAgentService.resetConversation(); await reset(); }, [reset])
  const startNewThreadWrapped = useCallback(() => { aiAgentService.resetConversation(); startNewThread(); }, [startNewThread])
  const loadThreadWrapped = useCallback(async (d: string) => { aiAgentService.resetConversation(); await loadThread(d); }, [loadThread])

  return {
    messages,
    input,
    setInput,
    streaming,
    thinking,
    connecting,
    error,
    contextWarnings,
    hasProvider,
    agentSteps,
    agentStatus,
    pendingConfirm,
    send,
    stop,
    reset: resetWrapped,
    dismissError,
    setAssistantMessage,
    addMessage,
    threads,
    currentThreadDate,
    loadThread: loadThreadWrapped,
    deleteThread,
    renameThread,
    refreshThreads,
    startNewThread: startNewThreadWrapped,
    memories,
  }
}
