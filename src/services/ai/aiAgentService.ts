import { toolRegistry } from './toolRegistry'
import { securityGuard } from './securityGuard'
import type { AiAgentConfig, ToolCallRequest, ToolCallResult, AgentMessage, ToolParameter } from './types'

const SYSTEM_PROMPT_BASE = `You are an AI assistant integrated into a personal productivity tracker. You have access to tools that let you:

- READ goals, projects, activities, settings, stats, sleep data, workspace state, terminal sessions, checks
- CREATE/UPDATE/DELETE goals (daily + long-term), projects, external activities, categories, preferences
- DECOMPOSE long-term goals into sub-goals for milestone tracking
- START/STOP activity tracking sessions
- MANAGE problems, recording configurations, and research topics
- CHECK tutorial completion status and START feature tutorials

Navigation — When you want to take the user to a specific page or section, output a navigation block:
\`\`\`
[type: navigation]
[page: /settings]
[tab: ai]
[section: settings.ai]
[label: Go to AI Settings]
\`\`\`
Supported params: page (route), tab (tab key), section (section ID), label (button text).
Section IDs include: settings.ai, settings.finance, settings.tracking, settings.prompts, ide.ai-tools, ide.projects, ai.chat, ai.focus, ai.plan, ai.reflect, insights.weekly, finance.accounts, external.sleep, and more.

Long-term goals: Use saveLongtermGoal to create strategic goals (life objectives, milestones). Use getLongtermGoals to review them.
Goal decomposition: Break a long-term goal into smaller sub-goals with decomposeGoal(parentId, children[]). Children get parent_id linking them to the parent. Use getChildGoals(parentId) to retrieve them. For example: create a long-term goal → decompose into weekly milestones → optionally decompose weekly into daily tasks.
Goal linking: Use linkGoalToProblem / linkGoalToRequest to trace which problems or requests a goal relates to. The links appear in the goal's metadata. Use unlinkGoalFromProblem / unlinkGoalFromRequest to remove links.
Checklists: Use addProblemCheck(problemId, description, instruction) to create verification steps on problems, and addRequestCheck for feature requests. Use getProblemChecks / getRequestChecks to list existing checks. The checks live on problems and requests and can be viewed in the workspace sidebar under the Work → Issues → Checklist subtab.
Research topics: Use getInterestTopics to see what the AI tracks. Use addInterestTopic/removeInterestTopic to manage them.
Rules:
1. Use tools to answer questions — do not guess or make up data
2. When the user asks to CREATE or DELETE something, explain what you're about to do and get confirmation before acting
3. When the user asks to READ something, just fetch and show it
4. Keep responses concise and helpful
5. If a tool fails, explain the error clearly
6. Batch independent tool calls when possible
7. When showing lists, summarize totals (e.g., "You have 5 projects" instead of dumping everything)
8. NEVER make up data — use the tools to fetch real data
9. For time-based queries, use appropriate periods: "today", "week", "month", "all"
10. Format times readably (e.g., "2h 30m" instead of raw seconds)
11. When showing data, offer a navigation link to the relevant page when it helps the user
12. For long-term goal management, ask clarifying questions about priority and category before creating
13. When the user wants to break down a goal, use decomposeGoal to create sub-goals with appropriate periods (weekly for milestones, daily for actionable tasks)
14. After decomposing a goal, link sub-goals to relevant problems or requests with linkGoalToProblem / linkGoalToRequest for full traceability
15. Use addProblemCheck to create verification steps on problems — this is how the AI tracks whether a fix actually works
16. When a user confirms a fix works, use completeCheck to mark the checklist item as done`

class AiAgentService {
  private config: AiAgentConfig = {
    providerId: '',
    model: '',
    systemPrompt: SYSTEM_PROMPT_BASE,
    maxTokens: 2000,
    temperature: 0.7,
    maxToolCallsPerRound: 8,
    maxRounds: 5,
  }

  private conversationHistory: AgentMessage[] = []
  private confirmQueue: Array<{ toolName: string; args: Record<string, any>; resolve: (v: boolean) => void }> = []
  private progressCallback: ((progress: { round: number; totalRounds: number; toolName?: string; toolArgs?: Record<string, any>; status: 'thinking' | 'executing' | 'completed' | 'error'; message?: string; streamedContent?: string }) => void) | null = null
  private injectedContext = ''

  getConfig() {
    return { ...this.config }
  }

  updateConfig(partial: Partial<AiAgentConfig>) {
    this.config = { ...this.config, ...partial }
  }

  setProgressCallback(callback: (progress: { round: number; totalRounds: number; toolName?: string; toolArgs?: Record<string, any>; status: 'thinking' | 'executing' | 'completed' | 'error'; message?: string; streamedContent?: string }) => void) {
    this.progressCallback = callback
  }

  clearProgressCallback() {
    this.progressCallback = null
  }

  injectContext(text: string) {
    this.injectedContext += text;
  }

  getConversationHistory() {
    return [...this.conversationHistory]
  }

  getSystemPrompt() {
    const tools = toolRegistry.getAll()
    const readTools = tools.filter(t => t.securityLevel === 'read')
    const writeTools = tools.filter(t => t.securityLevel === 'confirm')

    return `${SYSTEM_PROMPT_BASE}

Available tools (${tools.length} total):
- READ only (${readTools.length}): ${readTools.map(t => t.name).join(', ')}
- WRITE/DELETE (${writeTools.length}, require confirmation): ${writeTools.map(t => t.name).join(', ')}

Security: ${JSON.stringify(securityGuard.getStats())}`
  }

  async getSystemPromptAsync(): Promise<string> {
    const basePrompt = this.getSystemPrompt()
    const connectorContext = await this.buildConnectorContext()

    return [
      basePrompt,
      connectorContext,
    ].filter(Boolean).join('\n\n')
  }

  private async buildConnectorContext(): Promise<string> {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.connectors) return '';
      const connectors = await api.connectors.list();
      if (!Array.isArray(connectors) || connectors.length === 0) return '';
      const lines: string[] = [];
      for (const c of connectors) {
        const result = await api.connectors.items(c.id, { limit: 5 });
        if (result?.items?.length) {
          lines.push(`\n### ${c.displayName || c.provider}`);
          for (const item of result.items) {
            lines.push(`- ${item.itemType === 'event' ? '📅' : '📧'} **${item.subject}** (${item.date})${item.summary ? ` — ${item.summary.slice(0, 120)}` : ''}`);
          }
        }
      }
      if (lines.length === 0) return '';
      return `\n## Recent Connector Items\n${lines.join('\n')}\n`;
    } catch {
      return '';
    }
  }

  async processMessage(userMessage: string): Promise<string> {
    console.log(`[AiAgent] processMessage start, userMessage="${userMessage.slice(0, 50)}", historyLen=${this.conversationHistory.length}`)
    this.conversationHistory.push({ role: 'user', content: userMessage })

    const extraContext = this.injectedContext;
    this.injectedContext = '';
    const systemPrompt = (await this.getSystemPromptAsync()) + extraContext;
    let finalResponse = ''

    this.progressCallback?.({ round: 0, totalRounds: this.config.maxRounds, status: 'thinking', message: 'Starting AI response...' })

    for (let round = 0; round < this.config.maxRounds; round++) {
      console.log(`[AiAgent] Round ${round}/${this.config.maxRounds} start`)
      this.progressCallback?.({ round, totalRounds: this.config.maxRounds, status: 'thinking', message: `Round ${round + 1} of ${this.config.maxRounds}` })

      const providerTools = toolRegistry.getOpenAISpecs()

      const response = await this.callLLM(systemPrompt, providerTools, round, this.config.maxRounds)

      if (!response?.choices?.[0]?.message) {
        console.log(`[AiAgent] Round ${round}: no response/choices`)
        const fallback = 'I encountered an error connecting to the AI provider. Please check your provider settings and try again.'
        this.conversationHistory.push({ role: 'assistant', content: fallback })
        this.progressCallback?.({ round, totalRounds: this.config.maxRounds, status: 'error', message: 'Failed to get AI response' })
        return fallback
      }

      const message = response.choices[0].message
      const toolCalls = message.tool_calls

      if (!toolCalls || toolCalls.length === 0) {
        console.log(`[AiAgent] Round ${round}: no tool calls, content="${(message.content || '').slice(0, 80)}"`)
        this.conversationHistory.push({ role: 'assistant', content: message.content || '' })
        finalResponse = message.content || 'Done.'
        this.progressCallback?.({ round, totalRounds: this.config.maxRounds, status: 'completed', message: 'AI response generated' })
        break
      }

      console.log(`[AiAgent] Round ${round}: ${toolCalls.length} tool call(s): ${toolCalls.map((tc: any) => tc.function.name).join(', ')}`)
      this.conversationHistory.push({
        role: 'assistant',
        content: message.content || `[Using ${toolCalls.length} tool(s)...]`,
        toolCalls: toolCalls.map((tc: any) => ({
          id: tc.id,
          toolName: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        })),
      })

      const batchLimit = Math.min(toolCalls.length, this.config.maxToolCallsPerRound)
      const results: ToolCallResult[] = []

      for (let i = 0; i < batchLimit; i++) {
        const tc = toolCalls[i]
        const toolName = tc.function.name
        let args: Record<string, any>
        try { args = JSON.parse(tc.function.arguments) } catch { args = {} }

        this.progressCallback?.({ round, totalRounds: this.config.maxRounds, toolName, toolArgs: args, status: 'executing', message: `Executing tool: ${toolName}` })

        const tool = toolRegistry.get(toolName)
        if (!tool) {
          console.log(`[AiAgent] Tool ${toolName}: NOT FOUND`)
          results.push({ toolCallId: tc.id, toolName, result: null, error: `Unknown tool: ${toolName}` })
          this.progressCallback?.({ round, totalRounds: this.config.maxRounds, toolName, toolArgs: args, status: 'error', message: `Unknown tool: ${toolName}` })
          continue
        }

        if (securityGuard.requiresConfirm(tool.securityLevel)) {
          console.log(`[AiAgent] Tool ${toolName}: waiting for confirm`)
          const confirmed = await this.requestConfirm(toolName, args)
          console.log(`[AiAgent] Tool ${toolName}: confirm=${confirmed}`)
          if (!confirmed) {
            results.push({ toolCallId: tc.id, toolName, result: null, error: 'User declined confirmation' })
            this.progressCallback?.({ round, totalRounds: this.config.maxRounds, toolName, toolArgs: args, status: 'error', message: 'User declined confirmation' })
            continue
          }
        }

        try {
          console.log(`[AiAgent] Tool ${toolName}: executing, args=${JSON.stringify(args)}`)
          let result = await toolRegistry.execute(toolName, args)
          if (result && result._action) {
            console.log(`[AiAgent] Tool ${toolName}: action detected (${result.kind}), executing...`)
            result = await this.executeAction(result)
            console.log(`[AiAgent] Tool ${toolName}: action result, _executed=${result._executed}`)
          }
          console.log(`[AiAgent] Tool ${toolName}: completed, result type=${typeof result}`)
          if (result && result.success && toolName === 'createDashboardCard') {
            console.log('[AiAgent] Dashboard card created:', result.cardId)
          }
          results.push({ toolCallId: tc.id, toolName, result })
          this.progressCallback?.({ round, totalRounds: this.config.maxRounds, toolName, toolArgs: args, status: 'completed', message: `Tool completed: ${toolName}` })
        } catch (err: any) {
          console.log(`[AiAgent] Tool ${toolName}: ERROR ${err.message}`)
          results.push({ toolCallId: tc.id, toolName, result: null, error: err.message })
          this.progressCallback?.({ round, totalRounds: this.config.maxRounds, toolName, toolArgs: args, status: 'error', message: `Tool error: ${err.message}` })
        }
      }

      for (const r of results) {
        this.conversationHistory.push({
          role: 'tool',
          content: r.error ? `Error: ${r.error}` : JSON.stringify(r.result).slice(0, 5000),
          toolCallId: r.toolCallId,
          toolName: r.toolName,
        })
      }
      console.log(`[AiAgent] Round ${round} end, historyLen=${this.conversationHistory.length}`)
    }

    console.log(`[AiAgent] processMessage done, finalResponse="${(finalResponse || '').slice(0, 80)}"`)
    return finalResponse || 'I completed the operation but could not generate a summary.'
  }

  private async callLLM(systemPrompt: string, tools: any[], round: number = 0, totalRounds: number = 1, onChunk?: (text: string) => void): Promise<any> {
    console.log('[AiAgent:callLLM] round=' + round + '/' + totalRounds + ' historyLen=' + this.conversationHistory.length)
    const api = (window as any).deskflowAPI

    let preferredModel = ''
    let state: any = null
    try {
      const aiConfig = await api.getAiConfig()
      if (aiConfig?.briefModel) preferredModel = aiConfig.briefModel
      state = await api.getAiProviders()
    } catch (err) {
      console.warn('[AiAgent] Failed to load provider config, falling back to OpenRouter:', err)
    }
    if (!state) {
      state = {
        providers: [
          {
            id: 'openrouter',
            templateId: 'openrouter',
            label: 'OpenRouter',
            enabled: true,
            apiKey: (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY) || '',
            baseUrl: '',
            models: ['google/gemini-2.0-flash-001'],
            priority: 0,
          },
        ],
        routing: { default: { providerId: 'openrouter', model: '' } },
      }
    }

    const enabled = state.providers.filter((p: any) => p.enabled)
    if (enabled.length === 0) throw new Error('No enabled AI providers')

    const defaultRoute = state.routing?.default
    const target = defaultRoute?.providerId
      ? enabled.find((p: any) => p.id === defaultRoute.providerId) || enabled[0]
      : enabled[0]

    const model = preferredModel || defaultRoute?.model || target.models[0] || 'gpt-3.5-turbo'

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.convertToProviderMessages(this.conversationHistory),
    ]

    if (!api.providerChatCall || !api.onProviderChunk) {
      return await this.callLLMFallback(api, target, model, messages, tools, round, totalRounds, onChunk)
    }

    return new Promise((resolve, reject) => {
      let fullContent = ''
      const streamedToolCalls: Record<number, any> = {}
      let cleanup: (() => void) | null = null
      let timeout: ReturnType<typeof setTimeout> | null = null

      cleanup = api.onProviderChunk((data: any) => {
        if (data.error) {
          cleanup?.(); if (timeout) clearTimeout(timeout)
          reject(new Error(data.error))
          return
        }
        if (data.delta) {
          fullContent += data.delta
          onChunk?.(data.delta)
          this.progressCallback?.({ round, totalRounds, status: 'thinking', message: 'Generating response...', streamedContent: fullContent })
        }
        if (data.done) {
          cleanup?.(); if (timeout) clearTimeout(timeout)
          const toolCalls = Object.keys(streamedToolCalls).length > 0
            ? Object.values(streamedToolCalls).filter((tc: any) => tc.id && tc.function.name)
            : undefined
          console.log('[AiAgent:callLLM] done, contentLen=' + fullContent.length + ' toolCalls=' + (toolCalls?.length || 0))
          resolve({
            choices: [{ message: { content: fullContent, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }],
            usage: { prompt_tokens: 0, completion_tokens: fullContent.length > 0 ? Math.ceil(fullContent.length / 4) : 0 },
          })
        }
      })

      timeout = setTimeout(() => {
        cleanup?.()
        reject(new Error('Provider call timed out after 60s'))
      }, 60000)

      api.providerChatCall({ provider: target, messages, model, maxTokens: this.config.maxTokens, temperature: this.config.temperature }).catch((err: any) => {
        cleanup?.(); if (timeout) clearTimeout(timeout)
        reject(err)
      })
    })
  }

  private async callLLMFallback(api: any, target: any, model: string, messages: Array<{ role: string; content: string }>, tools: any[], round: number, totalRounds: number, onChunk?: (text: string) => void): Promise<any> {
    console.log('[AiAgent:callLLMFallback] using providerChatBasic')
    const result = await api.providerChatBasic({ provider: target, messages, model, maxTokens: this.config.maxTokens, temperature: this.config.temperature })
    if (!result?.success) throw new Error(result?.error || 'Provider call failed')
    const fullContent = result.content || ''
    if (onChunk) onChunk(fullContent)
    this.progressCallback?.({ round, totalRounds, status: 'thinking', message: 'Generating response...', streamedContent: fullContent })
    return {
      choices: [{ message: { content: fullContent } }],
      usage: { prompt_tokens: 0, completion_tokens: fullContent.length > 0 ? Math.ceil(fullContent.length / 4) : 0 },
    }
  }

  private requestConfirm(toolName: string, args: Record<string, any>): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmQueue.push({ toolName, args, resolve })
    })
  }

  private async executeAction(result: any): Promise<any> {
    if (!result || !result._action) return result
    const api = (window as any).deskflowAPI
    if (!api) return { ...result, _executed: false, error: 'deskflowAPI not available' }

    try {
      switch (result.kind) {
        case 'reply-email': {
          const r = await api.connectors.sendEmail({
            connectorId: result.connectorId,
            to: result.to || '',
            subject: result.subject || '',
            body: result.draft || '',
            inReplyTo: result.emailId,
          })
          return { ...result, _executed: true, sendResult: r }
        }
        case 'create-event': {
          const r = await api.connectors.createEvent({
            connectorId: result.connectorId,
            title: result.title,
            startTime: result.startTime,
            endTime: result.endTime,
            description: result.description || '',
          })
          return { ...result, _executed: true, createResult: r }
        }
        case 'update-event': {
          const r = await api.connectors.updateEvent({
            connectorId: result.connectorId,
            eventId: result.eventId,
            changes: result.changes || {},
          })
          return { ...result, _executed: true, updateResult: r }
        }
        case 'delete-event': {
          const r = await api.connectors.deleteEvent({
            connectorId: result.connectorId,
            eventId: result.eventId,
          })
          return { ...result, _executed: true, deleteResult: r }
        }
        case 'mark-read': {
          const r = await api.connectors.markRead({
            connectorId: result.connectorId,
            emailId: result.emailId,
            read: result.read ?? true,
          })
          return { ...result, _executed: true, markResult: r }
        }
        case 'create-schedule-from-email': {
          const r = await api.addScheduleEntry({
            title: result.title,
            location: result.location || null,
            day_of_week: result.day_of_week,
            start_time: result.start_time,
            end_time: result.end_time,
            category: result.category || 'email',
            color: result.color || '#8b5cf6',
          })
          return { ...result, _executed: true, scheduleResult: r }
        }
        case 'create-deadline-from-email': {
          const r = await api.addDeadline({
            title: result.title,
            course: result.course || null,
            due_date: result.due_date,
            priority: result.priority || 'medium',
            description: result.description || null,
            category: result.category || 'email',
          })
          return { ...result, _executed: true, deadlineResult: r }
        }
        default:
          return { ...result, _executed: false, error: `Unknown action kind: ${result.kind}` }
      }
    } catch (err: any) {
      return { ...result, _executed: false, error: err.message }
    }
  }

  getPendingConfirm(): { toolName: string; args: Record<string, any> } | null {
    return this.confirmQueue.length > 0 ? this.confirmQueue[0] : null
  }

  resolveConfirm(approved: boolean) {
    const item = this.confirmQueue.shift()
    if (item) item.resolve(approved)
  }

  get hasPendingConfirm(): boolean {
    return this.confirmQueue.length > 0
  }

  private convertToProviderMessages(history: AgentMessage[]): any[] {
    return history.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId,
        }
      }
      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.toolName, arguments: JSON.stringify(tc.args) },
          })),
        }
      }
      return { role: msg.role, content: msg.content }
    })
  }

  resetConversation() {
    this.conversationHistory = []
    this.confirmQueue = []
  }
}

export const aiAgentService = new AiAgentService()
