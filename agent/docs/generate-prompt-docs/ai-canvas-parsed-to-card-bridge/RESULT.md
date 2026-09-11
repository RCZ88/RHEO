**Stop.** This is a critical blocker that must be fixed before Phase 4 card wrappers mean anything. Without this bridge, your canvas is blind to structured AI responses — the entire reason you built the canvas.

The uploaded files confirm: `AiPage.tsx` line 178 explicitly skips structured messages. `ParsedMessageRouter` renders inline chat cards, but `canvas.addCard()` is never called for them. Two parallel systems, zero connection.

**Fix the bridge first. Then Phase 4 wraps existing components into cards.**

---

## Bridge Implementation: `ParsedMessage` → `CanvasCard`

**Only file to change:** `src/pages/AiPage.tsx` (the useEffect at lines 155-208)

### The Complete Replacement

```typescript
// In AiPage.tsx, replace the entire useEffect that watches chat.messages (lines 155-208)

// --- Deduplication + position helpers ---
const recentCardSpawns = useRef<Map<string, number>>(new Map()) // key -> timestamp
const CARD_DEDUP_MS = 5000

function getDedupKey(type: string, dataHash: string): string {
  return `${type}:${dataHash}`
}

function isDuplicate(type: string, dataHash: string): boolean {
  const key = getDedupKey(type, dataHash)
  const last = recentCardSpawns.current.get(key)
  if (last && Date.now() - last < CARD_DEDUP_MS) return true
  recentCardSpawns.current.set(key, Date.now())
  return false
}

function getCardPosition(type: CardType, canvas: any): { x: number; y: number } {
  const existing = Object.values(canvas.allCards).filter((c: any) => c.type === type && c.pinned)
  const offset = existing.length * 40
  const basePositions: Record<CardType, { x: number; y: number }> = {
    focus: { x: 40, y: 40 },
    plan: { x: 40, y: 320 },
    finance: { x: 360, y: 40 },
    digest: { x: 360, y: 320 },
    approval: { x: 200, y: 200 },
    connectors: { x: 40, y: 600 },
    response: { x: 40, y: 40 },
    group: { x: 40, y: 40 },
    annotation: { x: 40, y: 40 },
    reflect: { x: 360, y: 600 },
    transient: { x: 40, y: 40 },
  }
  const base = basePositions[type] || { x: 40, y: 40 }
  return { x: base.x + offset, y: base.y + offset }
}

// --- The useEffect ---
useEffect(() => {
  if (!canvasMode) return

  const newMsgs = chat.messages.filter(m => !processedMsgIds.current.has(m.id))
  if (newMsgs.length === 0) return

  newMsgs.forEach(msg => {
    processedMsgIds.current.add(msg.id)

    if (msg.role === 'user') {
      // User message → response card (for continuity)
      lastCardId.current = canvas.addCard('response', {
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        isUserInput: true,
      }, {
        size: { w: 10, h: 4 },
        pinned: true,
        source: 'user',
        position: getCardPosition('response', canvas),
      })
      return
    }

    if (msg.role !== 'assistant') return

    const parsed = msg.parsed
    const isStructured = parsed && parsed.type !== 'text'

    // ── STRUCTURED RESPONSE → TYPED CARD + OPTIONAL PROSE CARD ──
    if (isStructured && parsed) {
      const prose = msg.content // This is already the prose portion (parseAssistantContent strips JSON)
      const pos = getCardPosition(mapParsedToCardType(parsed.type), canvas)

      // 1. Create the typed card
      const typedCardId = spawnTypedCard(parsed, canvas, pos)
      if (typedCardId) lastCardId.current = typedCardId

      // 2. If there's prose text alongside the JSON, create a response card below it
      if (prose && prose.trim().length > 10) {
        const prosePos = { x: pos.x, y: pos.y + (parsed.type === 'connector_status' ? 320 : 240) }
        lastCardId.current = canvas.addCard('response', {
          content: prose,
          timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          isToolOutput: false,
          relatedTo: typedCardId,
        }, {
          size: { w: 10, h: 5 },
          pinned: false, // prose is transient
          source: 'ai',
          position: prosePos,
        })
      }
      return
    }

    // ── PLAIN TEXT / TOOL OUTPUT → RESPONSE CARD (existing logic, preserved) ──
    if (lastCardId.current && canvas.allCards[lastCardId.current]) {
      const existing = canvas.allCards[lastCardId.current]
      if (existing.type === 'response' && existing.data?.isUserInput) {
        // Append AI response to last user card
        canvas.updateCard(lastCardId.current, {
          data: {
            ...existing.data,
            aiResponse: msg.content,
            aiTimestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          },
          size: { w: 10, h: 8 },
        })
        return
      }
    }

    // Standalone response card
    lastCardId.current = canvas.addCard('response', {
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      isToolOutput: msg.content.includes('```tool') || msg.content.includes('```'),
    }, {
      size: { w: 10, h: 6 },
      pinned: false,
      source: 'ai',
      position: getCardPosition('response', canvas),
    })
  })
}, [chat.messages, canvasMode])
```

### The Mapping Function

```typescript
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

function spawnTypedCard(parsed: any, canvas: any, pos: { x: number; y: number }): string | null {
  const dataHash = JSON.stringify(parsed).slice(0, 100) // Simple hash for dedup
  if (isDuplicate(parsed.type, dataHash)) return null

  switch (parsed.type) {
    case 'goal_suggestion':
      return canvas.addCard('focus', {
        goals: parsed.goals,
        source: parsed.source,
      }, {
        size: { w: 8, h: 6 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'plan_update':
      return canvas.addCard('plan', {
        goals: parsed.changes.map((c: any) => c.goal),
        notes: parsed.note,
      }, {
        size: { w: 8, h: 6 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'stats_summary':
      // Map metrics to finance summary shape
      const metrics = parsed.metrics || []
      const balance = metrics.find((m: any) => m.label.toLowerCase().includes('balance'))?.value || 0
      const income = metrics.find((m: any) => m.label.toLowerCase().includes('income'))?.value || 0
      const expense = metrics.find((m: any) => m.label.toLowerCase().includes('expense'))?.value || 0
      return canvas.addCard('finance', {
        summary: {
          totalBalance: balance,
          monthlySpent: expense,
          monthlyBudget: income,
          subscriptions: [],
        },
        metrics: parsed.metrics,
      }, {
        size: { w: 6, h: 4 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'digest_item':
      return canvas.addCard('digest', {
        topics: [{ topic: parsed.topic, summary: parsed.summary, sources: parsed.sources }],
      }, {
        size: { w: 6, h: 4 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'action_list':
      return canvas.addCard('approval', {
        title: parsed.actions?.[0]?.label || 'Action Required',
        description: parsed.note || parsed.actions?.map((a: any) => a.label).join(', '),
        actions: parsed.actions,
      }, {
        size: { w: 6, h: 4 },
        pinned: true, // approvals should persist until acted on
        source: 'ai',
        position: pos,
      })

    case 'connector_status':
      return canvas.addCard('connectors', {
        connectors: parsed.connectors,
      }, {
        size: { w: 10, h: 8 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'form_fill':
      return canvas.addCard('response', {
        content: `**Form:** ${parsed.title || 'Untitled'}\n\n` + parsed.fields.map((f: any) => `- ${f.label}: ${f.value || '(empty)'}`).join('\n'),
        isToolOutput: false,
      }, {
        size: { w: 8, h: 5 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'chart_data':
      return canvas.addCard('response', {
        content: `**Chart:** ${parsed.title || 'Data Visualization'}\n\nType: ${parsed.chartType}\nLabels: ${parsed.labels?.join(', ') || 'N/A'}\nDatasets: ${parsed.datasets?.length || 0}`,
        isToolOutput: false,
      }, {
        size: { w: 8, h: 5 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'reminder_create':
      return canvas.addCard('annotation', {
        text: `Reminder: ${parsed.text}${parsed.dueDate ? ` (due ${parsed.dueDate})` : ''}`,
        parentType: 'reminder',
      }, {
        size: { w: 6, h: 3 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'goal_event_link':
      return canvas.addCard('annotation', {
        text: `Linked event: ${parsed.eventTitle}`,
        parentType: 'goal link',
      }, {
        size: { w: 6, h: 3 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    case 'error':
      return canvas.addCard('response', {
        content: `**Error:** ${parsed.message}\n\n${parsed.recovery ? `Recovery: ${parsed.recovery}` : ''}`,
        isToolOutput: false,
      }, {
        size: { w: 8, h: 4 },
        pinned: false,
        source: 'ai',
        position: pos,
      })

    default:
      return null
  }
}
```

---

## What This Solves

| Problem | Fix |
|---|---|
| Structured responses create no canvas cards | `spawnTypedCard()` maps every `ParsedMessage` type to a `CanvasCard` |
| Duplicate cards from retry/refresh | `recentCardSpawns` Map with 5s dedup window |
| Cards overlap | `getCardPosition()` offsets by 40px per existing card of same type |
| Prose alongside JSON is lost | Creates a `response` card below the typed card when prose exists |
| Approval cards auto-dismiss | Set `pinned: true` for `action_list` so they persist until acted on |
| Inline chat cards still work | `ParsedMessageRouter` untouched — this is additive, not replacement |

---

## After the Bridge: Phase 4 Continues

Once the bridge is wired, Phase 4 card wrappers actually receive data. The `FocusCard` gets `goals` from the bridge. The `FinanceCard` gets `summary` from the bridge. Without the bridge, Phase 4 cards are empty shells.

**Priority:**
1. **Apply the bridge** (AiPage.tsx useEffect replacement)
2. **Build Phase 4 card wrappers** (FocusCard, PlanCard, FinanceCard, etc.) — they now have real data flowing in
3. **Test:** Send a message that triggers `goal_suggestion` → Focus card appears on canvas with goals

---

## Test Checklist for Bridge

- [ ] Send message triggering goal suggestion → `focus` card appears with goals
- [ ] Send message triggering plan update → `plan` card appears with changes
- [ ] Send message triggering stats summary → `finance` card appears with metrics
- [ ] Send message triggering digest → `digest` card appears with topic
- [ ] Send message triggering action list → `approval` card appears with Approve/Reject
- [ ] Send message triggering connector status → `connectors` card appears
- [ ] Send plain text message → `response` card appears (existing behavior preserved)
- [ ] Rapid retry same message → no duplicate cards within 5s
- [ ] Structured response with prose → typed card + prose response card both appear
- [ ] Deck mode → inline cards still render via ParsedMessageRouter (no regression)

---

**Tell your agent: Implement the bridge FIRST. Then continue Phase 4 wrappers.** The bridge is ~150 lines in one file. Phase 4 wrappers are the components I already spec'd above — they just need the data flowing, which the bridge provides.