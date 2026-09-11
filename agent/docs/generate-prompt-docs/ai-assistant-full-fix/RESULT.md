<aside>
🔧

Lead Architect execution against `CONTEXT_BUNDLE.md`. Every fix below is exact — real code, real UI copy, real error strings. Hand to the opencode agent and implement top-to-bottom. Companion to DeskFlow — Prompt Composition Infrastructure Audit & Exact Fixes; use the relay protocol in the DeskFlow Workspace — Context Handoff (2026-06-28).

</aside>

## 1. Executive Summary

The AI Assistant returns empty output for two concrete reasons, not just “bad logging.” **(a)** The Ollama template hits the **native** endpoint `http://localhost:11434/api/chat` but parses the **OpenAI** shape `raw.choices[0].message.content`, so the parser always extracts `undefined` → `content len=0`. **(b)** The chat path (`aiAgentService.callLLM`) runs its **own** fetch + its **own** templates and logs **nothing** about the request or response, so failures are invisible. The fix is one **main-process** provider client (`callProvider`) that is streaming-aware, logs full request/response under `[PROV-UNIFIED]`, records the last 50 calls in a ring buffer exposed over IPC, and is the single path for digest, test, and chat. The renderer keeps progressive streaming via chunk IPC (constraint satisfied), `templates.ts` becomes the single source of truth, and every failure produces a human-readable, actionable message.

## 2. Issue Inventory

| ID | Sev | Issue | Location | Fix |
| --- | --- | --- | --- | --- |
| H1 | HIGH | Ollama endpoint/parse mismatch (`/api/chat` native URL parsed as OpenAI) → always empty | templates.ts (ollama) | Use `/v1/chat/completions` (F7) |
| H2 | HIGH | Chat path has its own fetch + own templates, no req/resp logging | aiAgentService.ts 281-368, 370-395 | Route through `callProvider` (F2/F6) |
| H3 | HIGH | No APM-grade logging; user can’t see what was sent/received | both paths | `[PROV-UNIFIED]` logger (F1/F2) |
| H4 | HIGH | No diagnostics surfaced to the UI | renderer | Ring buffer + IPC + panel (F1/F4/F8) |
| H5 | HIGH | Errors swallowed → “Unknown error” / silent empty | both paths | `ProviderError.userMessage` (F2/F10) |
| M1 | MED | Two HTTP paths diverge (URL, auth, model handling) | callProvider.ts vs aiAgentService.ts | Single client (F2/F6) |
| M2 | MED | `migrateProviderNames` misses variants & doesn’t repair stored bad Ollama URL | main.ts 12773-12799 | Expand map + URL repair (F7) |
| M3 | MED | Raw response truncated to 2000 chars in log (mandate wants full) | callProvider.ts:57 | Full body log (F2) |
| M4 | MED | Fallback chain + token tiers not available to chat | router.ts | Forward opts; chat can use fallback (F3/F4) |
| M5 | MED | 10s timeout, indefinite spinner on hang, no timeout message | callProvider.ts | AbortController + timeout msg (F2) |
| M6 | MED | API key risk in logs | both paths | `maskHeaders` first-12 mask (F1) |
| L1 | LOW | `AIFeaturesModal` is static marketing; can misrepresent real capability | AIFeaturesModal.tsx | Gate copy by live tool registry (F9 note) |
| L2 | LOW | toolRegistry `admin` security level unimplemented | toolRegistry.ts | Treat `admin` as `confirm` until built (F9 note) |

## 3. Exact Fixes

### F1 — NEW `src/services/providers/providerLog.ts` (main process)

Ring buffer + masking + the shared diagnostic record. This is imported by `callProvider` and the diagnostics IPC.

```tsx
export interface ProviderCallRecord {
	id: string
	ts: number
	path: 'A-digest' | 'A-test' | 'B-chat'
	provider: string
	model: string
	request: { url: string; method: string; headers: Record<string, string>; body: unknown }
	response?: { status: number; headers: Record<string, string>; body: unknown }
	error?: { status?: number; message: string; raw?: string }
	parse?: { ok: boolean; extracted?: string; discarded?: string }
	durationMs?: number
	streamed?: boolean
}

const RING: ProviderCallRecord[] = []
const MAX = 50

export function pushDiag(rec: ProviderCallRecord): void {
	RING.push(rec)
	while (RING.length > MAX) RING.shift()
}
export function getDiagnostics(): ProviderCallRecord[] {
	return [...RING].reverse() // newest first
}
export function clearDiagnostics(): void {
	RING.length = 0
}

export function maskKey(v?: string): string {
	if (!v) return ''
	const s = String(v)
	return s.length <= 12 ? s : s.slice(0, 12) + '…(+' + (s.length - 12) + ')'
}

const SENSITIVE = /(authorization|api[-_]?key|x-api-key|token|bearer)/i
export function maskHeaders(h: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {}
	for (const k of Object.keys(h)) out[k] = SENSITIVE.test(k) ? maskKey(h[k]) : h[k]
	return out
}
```

### F2 — REWRITE `src/services/providers/callProvider.ts` (the single client)

Streaming-aware, full logging, typed errors, diagnostics push. Replaces all 66 lines.

```tsx
import { providerTemplates } from './templates'
import { pushDiag, maskHeaders, type ProviderCallRecord } from './providerLog'

const TAG = '[PROV-UNIFIED]'

export interface ProviderRequest {
	messages: Array<{ role: string; content: string }>
	model: string
	maxTokens?: number
	temperature?: number
	tools?: unknown
}
export interface ProviderConfig {
	id: string
	templateId: string
	label: string
	baseUrl?: string
	apiKey?: string
	extraConfig?: Record<string, unknown>
}
export interface CallProviderOptions {
	onChunk?: (delta: string) => void
	signal?: AbortSignal
	pathTag?: ProviderCallRecord['path']
	timeoutMs?: number
}
export interface CallProviderResult {
	content: string
	usage?: unknown
	raw: unknown
	diagId: string
	durationMs: number
	status: number
	streamed: boolean
}

export class ProviderError extends Error {
	userMessage: string
	detail: { status?: number; raw?: string; provider: string; url: string; diagId?: string }
	constructor(userMessage: string, detail: ProviderError['detail']) {
		super(userMessage)
		this.name = 'ProviderError'
		this.userMessage = userMessage
		this.detail = detail
	}
}

function humanError(provider: string, url: string, status: number | undefined, raw: string): string {
	if (status === 401 || status === 403) return provider + ' returned ' + status + ' Unauthorized. Check your API key in Settings.'
	if (status === 402) return provider + ' returned 402 — out of credits/quota. Switch providers or top up, in Settings.'
	if (status === 404) return provider + ' returned 404 for ' + url + '. Check the base URL and model name in Settings.'
	if (status === 429) return provider + ' is rate-limited (429). Wait and retry, or switch providers.'
	if (status && status >= 500) return provider + ' server error ' + status + '. Try again later or switch providers.'
	return provider + ' call failed' + (status ? ' (' + status + ')' : '') + '. Raw: ' + raw.slice(0, 500)
}

export async function callProvider(
	config: ProviderConfig,
	req: ProviderRequest,
	opts: CallProviderOptions = {},
): Promise<CallProviderResult> {
	const tpl = providerTemplates[config.templateId] || providerTemplates.custom
	const baseUrl = config.baseUrl || tpl.defaultBaseUrl
	let finalUrl = tpl.interpolateUrl ? tpl.interpolateUrl(baseUrl, config) : baseUrl
	const streaming = !!opts.onChunk
	const canStream = streaming && tpl.supportsStream !== false
	const timeoutMs = opts.timeoutMs ?? (streaming ? 60000 : 15000)

	const baseBody = tpl.buildBody
		? tpl.buildBody(req)
		: { model: req.model, messages: req.messages, max_tokens: req.maxTokens, temperature: req.temperature }
	const body: Record<string, unknown> = { ...baseBody }
	if (req.tools) body.tools = req.tools
	if (canStream) body.stream = true

	const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(tpl.staticHeaders || {}) }
	if (tpl.auth?.type === 'bearer' && config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey
	else if (tpl.auth?.type === 'header' && config.apiKey && tpl.auth.headerName) headers[tpl.auth.headerName] = config.apiKey
	else if (tpl.auth?.type === 'query' && config.apiKey && tpl.auth.queryParam)
		finalUrl += (finalUrl.includes('?') ? '&' : '?') + tpl.auth.queryParam + '=' + encodeURIComponent(config.apiKey)

	const diagId = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
	const started = Date.now()
	const rec: ProviderCallRecord = {
		id: diagId, ts: started, path: opts.pathTag || 'A-digest',
		provider: config.label || config.id, model: req.model,
		request: { url: finalUrl, method: 'POST', headers: maskHeaders(headers), body },
		streamed: canStream,
	}

	console.log(TAG + ' → REQUEST ' + (config.label || config.id) + ' POST ' + finalUrl)
	console.log(TAG + '   headers=' + JSON.stringify(maskHeaders(headers)))
	console.log(TAG + '   body=' + JSON.stringify(body))

	const ctrl = new AbortController()
	const to = setTimeout(() => ctrl.abort(), timeoutMs)
	const signal = opts.signal ?? ctrl.signal

	let res: Response
	try {
		res = await fetch(finalUrl, { method: 'POST', headers, body: JSON.stringify(body), signal })
	} catch (e) {
		clearTimeout(to)
		const err = e as { name?: string; message?: string }
		const isAbort = err?.name === 'AbortError'
		const msg = isAbort
			? config.label + ' timed out after ' + timeoutMs + 'ms at ' + finalUrl + '.'
			: config.label + ' is not reachable at ' + finalUrl + '. ' +
			  (config.templateId === 'ollama' ? 'Start Ollama or check the URL in Settings.' : 'Check your network and the URL in Settings.')
		rec.error = { message: msg, raw: String(err?.message || e) }
		rec.durationMs = Date.now() - started
		console.error(TAG + ' ✗ NETWORK ' + msg)
		pushDiag(rec)
		throw new ProviderError(msg, { provider: config.label, url: finalUrl, diagId })
	}
	clearTimeout(to)

	const respHeaders: Record<string, string> = {}
	res.headers.forEach((v, k) => { respHeaders[k] = v })

	if (!res.ok) {
		const errText = await res.text()
		const msg = humanError(config.label, finalUrl, res.status, errText)
		rec.response = { status: res.status, headers: respHeaders, body: errText }
		rec.error = { status: res.status, message: msg, raw: errText }
		rec.durationMs = Date.now() - started
		console.error(TAG + ' ✗ HTTP ' + res.status + ' ' + config.label)
		console.error(TAG + '   respHeaders=' + JSON.stringify(respHeaders))
		console.error(TAG + '   respBody=' + errText)
		pushDiag(rec)
		throw new ProviderError(msg, { status: res.status, raw: errText, provider: config.label, url: finalUrl, diagId })
	}

	if (canStream && res.body) {
		const reader = res.body.getReader()
		const decoder = new TextDecoder()
		let full = ''
		let buf = ''
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			buf += decoder.decode(value, { stream: true })
			const lines = buf.split('\n')
			buf = lines.pop() || ''
			for (const line of lines) {
				const t = line.trim()
				if (!t.startsWith('data:')) continue
				const data = t.slice(5).trim()
				if (data === '[DONE]') continue
				try {
					const j = JSON.parse(data)
					const delta = j.choices?.[0]?.delta?.content ?? j.message?.content ?? ''
					if (delta) { full += delta; opts.onChunk?.(delta) }
				} catch { /* partial frame; wait for more */ }
			}
		}
		rec.response = { status: res.status, headers: respHeaders, body: '[streamed]' }
		rec.parse = { ok: full.length > 0, extracted: full.slice(0, 4000) }
		rec.durationMs = Date.now() - started
		console.log(TAG + ' ✓ STREAM ' + config.label + ' status=' + res.status + ' len=' + full.length + ' ' + rec.durationMs + 'ms')
		pushDiag(rec)
		if (!full) throw new ProviderError('The AI returned an empty response (0 streamed tokens).', { status: res.status, raw: '', provider: config.label, url: finalUrl, diagId })
		return { content: full, raw: '[streamed]', diagId, durationMs: rec.durationMs, status: res.status, streamed: true }
	}

	const raw = await res.json()
	const parsed = tpl.parseResponse ? tpl.parseResponse(raw) : { content: raw?.choices?.[0]?.message?.content, usage: raw?.usage }
	const content = (parsed?.content ?? '').toString()
	rec.response = { status: res.status, headers: respHeaders, body: raw }
	rec.parse = { ok: content.length > 0, extracted: content.slice(0, 4000), discarded: content ? undefined : JSON.stringify(raw).slice(0, 1500) }
	rec.durationMs = Date.now() - started
	console.log(TAG + ' ✓ RESPONSE ' + config.label + ' status=' + res.status + ' ' + rec.durationMs + 'ms')
	console.log(TAG + '   rawBody=' + JSON.stringify(raw))
	console.log(TAG + '   parsed len=' + content.length)
	pushDiag(rec)
	if (!content) throw new ProviderError('The AI returned an empty response. Raw: ' + JSON.stringify(raw).slice(0, 800), { status: res.status, raw: JSON.stringify(raw), provider: config.label, url: finalUrl, diagId })
	if (opts.onChunk) opts.onChunk(content) // non-streaming provider: emit one chunk so UI still updates
	return { content, usage: parsed?.usage, raw, diagId, durationMs: rec.durationMs, status: res.status, streamed: false }
}
```

<aside>
⚠️

**Add two optional fields to each template in `templates.ts`:** `supportsStream?: boolean` (set `false` on `cloudflare`, since its `buildBody` forces `stream:false`) and keep `parseResponse` as-is. When `supportsStream` is false, `callProvider` skips SSE and emits one final `onChunk(content)` so the chat UI still shows progressive-then-complete content.

</aside>

### F3 — `src/services/providers/router.ts` (forward streaming/diag opts; chat can reuse fallback)

```tsx
import { callProvider, ProviderError, type CallProviderOptions, type CallProviderResult } from './callProvider'

export async function callWithTokenTiers(provider, req, opts: CallProviderOptions = {}): Promise<CallProviderResult> {
	const tiers = [req.maxTokens, 100, 50, 40].filter((n) => typeof n === 'number') as number[]
	let lastErr: unknown
	for (const t of tiers) {
		try { return await callProvider(provider, { ...req, maxTokens: t }, opts) }
		catch (e) { lastErr = e; const st = (e as ProviderError)?.detail?.status; if (st !== 402) throw e }
	}
	throw lastErr
}

export async function runWithFallback(chain, req, opts: CallProviderOptions = {}): Promise<CallProviderResult> {
	let lastErr: unknown
	for (const link of chain) {
		try { return await callWithTokenTiers(link.provider, { ...req, model: link.model }, opts) }
		catch (e) { lastErr = e }
	}
	if (lastErr instanceof ProviderError) throw lastErr
	throw new ProviderError('All providers failed. Check Settings → AI Assistant and the Diagnostics panel.', { provider: 'chain', url: '' })
}
```

### F4 — `src/main.ts` (chat IPC + diagnostics IPC + pathTags)

```tsx
import { callProvider, ProviderError } from './services/providers/callProvider'
import { buildChain, runWithFallback } from './services/providers/router'
import { getDiagnostics, clearDiagnostics } from './services/providers/providerLog'

// Unified chat entry for the renderer. Streams chunks back over a per-call channel.
ipcMain.handle('provider-chat-call', async (event, payload) => {
	const { config, feature, req, streamId } = payload
	const onChunk = (delta: string) => { try { event.sender.send('provider-chunk:' + streamId, delta) } catch { /* window gone */ } }
	try {
		const result = feature
			? await runWithFallback(buildChain(getProviderState(), feature), req, { onChunk, pathTag: 'B-chat' })
			: await callProvider(config, req, { onChunk, pathTag: 'B-chat' })
		return { ok: true, content: result.content, diagId: result.diagId, durationMs: result.durationMs }
	} catch (e) {
		const pe = e as ProviderError
		return { ok: false, userMessage: pe?.userMessage || String(e), detail: pe?.detail }
	}
})

ipcMain.handle('get-provider-diagnostics', () => getDiagnostics())
ipcMain.handle('clear-provider-diagnostics', () => { clearDiagnostics(); return { ok: true } })
```

`getProviderState()` = the existing helper that loads `userPreferences.aiProviders` (post-migration). In **`test-ai-provider`** (12830) pass `{ pathTag: 'A-test', timeoutMs: 10000 }` and return the diagId:

```tsx
try {
	const r = await callProvider(cfg, testReq, { pathTag: 'A-test', timeoutMs: 10000 })
	return { success: true, content: r.content, diagId: r.diagId, durationMs: r.durationMs }
} catch (e) {
	const pe = e as ProviderError
	return { success: false, error: pe?.userMessage || String(e), diagId: pe?.detail?.diagId }
}
```

In **`get-topic-digest`** (12200) pass `{ pathTag: 'A-digest' }` into `runWithFallback(..., { pathTag: 'A-digest' })`, and on `ProviderError` return `{ error: pe.userMessage, diagId: pe.detail?.diagId }` instead of an empty `{ topicCount: 0 }`.

### F5 — `src/preload.ts` (expose chat call + chunk listener + diagnostics)

```tsx
providerChatCall: (payload) => ipcRenderer.invoke('provider-chat-call', payload),
onProviderChunk: (streamId, cb) => {
	const ch = 'provider-chunk:' + streamId
	const listener = (_e, delta) => cb(delta)
	ipcRenderer.on(ch, listener)
	return () => ipcRenderer.removeListener(ch, listener)
},
getProviderDiagnostics: () => ipcRenderer.invoke('get-provider-diagnostics'),
clearProviderDiagnostics: () => ipcRenderer.invoke('clear-provider-diagnostics'),
```

### F6 — `src/services/ai/aiAgentService.ts` (delete own fetch+templates; use the IPC client)

**Delete** the SSE fetch (281-368) and the local template block (370-395). Replace `callLLM` body; **keep the signature** `callLLM(systemPrompt, tools, round, totalRounds, onChunk?)` and keep feeding `streamedContent`/`progressCallback`:

```tsx
private async callLLM(systemPrompt: string, tools: unknown[], round: number, totalRounds: number, onChunk?: (d: string) => void): Promise<string> {
	const target = this.pickProvider() // existing: first enabled or routing default
	const req = {
		model: target.model,
		messages: this.buildMessages(systemPrompt),
		maxTokens: this.maxTokens,
		temperature: 0.2,
		tools: tools && tools.length ? tools : undefined,
	}
	const streamId = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
	let acc = ''
	const off = window.deskflowAPI.onProviderChunk(streamId, (delta: string) => {
		acc += delta
		this.streamedContent = acc       // preserve existing progressive display
		onChunk?.(delta)
		this.progressCallback?.(acc)
	})
	try {
		const r = await window.deskflowAPI.providerChatCall({ config: target, req, streamId })
		if (!r.ok) { this.lastError = r.userMessage; throw new Error(r.userMessage) }
		this.lastDiagId = r.diagId  // for the chat “Show raw” panel
		return acc || r.content
	} finally {
		off()
	}
}
```

<aside>
✅

**Constraint satisfied:** streaming/progressive display is preserved — chunks flow main→renderer over `provider-chunk:<streamId>` into `streamedContent`/`progressCallback`. The mandate’s “make callProvider streaming-aware” is exactly what F2 does; the renderer no longer parses SSE itself, but the UI behavior is identical.

</aside>

### F7 — `src/main.ts` `migrateProviderNames()` (expand variants + repair Ollama URL + fix H1)

```tsx
function migrateProviderNames(state) {
	if (!state || !Array.isArray(state.providers)) return state
	const ALIASES = {
		cloudflayer: 'cloudflare', cloudflair: 'cloudflare', cloudfalre: 'cloudflare', cloudflar: 'cloudflare', cloudflre: 'cloudflare',
		ollamah: 'ollama', olamah: 'ollama', olama: 'ollama', ollamma: 'ollama', ollma: 'ollama', oolama: 'ollama', ollamai: 'ollama',
		openrouters: 'openrouter', openroute: 'openrouter', openrouterai: 'openrouter', openroutr: 'openrouter',
	}
	const LABELS = { cloudflare: 'Cloudflare', ollama: 'Ollama', openrouter: 'OpenRouter', custom: 'Custom' }
	const norm = (s) => String(s || '').trim().toLowerCase().replace(/[ _-]+/g, '')
	state.providers = state.providers
		.filter((p) => p && norm(p.id) !== 'invilier' && norm(p.templateId) !== 'invilier')
		.map((p) => {
			const canon = ALIASES[norm(p.id)] || ALIASES[norm(p.templateId)] || (LABELS[norm(p.id)] ? norm(p.id) : null)
			if (canon) {
				p.id = canon
				p.templateId = canon
				if (LABELS[canon]) p.label = LABELS[canon]
				// H1 repair: native /api/chat is parsed as OpenAI shape -> force OpenAI-compatible endpoint
				if (canon === 'ollama' && (!p.baseUrl || p.baseUrl.endsWith('/api/chat'))) {
					p.baseUrl = 'http://localhost:11434/v1/chat/completions'
				}
			}
			return p
		})
	return state
}
```

Also change the **`ollama` template** `defaultBaseUrl` in `templates.ts` from `http://localhost:11434/api/chat` to `http://localhost:11434/v1/chat/completions` so fresh configs are correct too.

### F8 — NEW `src/components/ProviderDiagnostics.tsx` (the panel)

Collapsible, `zinc-950` bg, monospace, expandable per call. Filter by path; highlight a specific call.

```tsx
import { useCallback, useEffect, useState } from 'react'

interface DiagRec {
	id: string; ts: number; path: string; provider: string; model: string
	request: { url: string; method: string; headers: Record<string, string>; body: unknown }
	response?: { status: number; headers: Record<string, string>; body: unknown }
	error?: { status?: number; message: string; raw?: string }
	parse?: { ok: boolean; extracted?: string; discarded?: string }
	durationMs?: number; streamed?: boolean
}

const fmt = (v: unknown) => { try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2) } catch { return String(v) } }

function Section({ title, lines, tone }: { title: string; lines: string[]; tone?: 'error' }) {
	return (
		<div>
			<div className={'mb-1 text-[10px] uppercase tracking-wide ' + (tone === 'error' ? 'text-red-400' : 'text-zinc-500')}>{title}</div>
			{lines.filter(Boolean).map((l, i) => (
				<pre key={i} className='mb-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-zinc-300'>{l}</pre>
			))}
		</div>
	)
}

export function ProviderDiagnostics({ filterPath, highlightDiagId }: { filterPath?: string; highlightDiagId?: string }) {
	const [recs, setRecs] = useState<DiagRec[]>([])
	const [open, setOpen] = useState(false)
	const [exp, setExp] = useState<string | null>(highlightDiagId ?? null)
	const load = useCallback(async () => {
		const all: DiagRec[] = await window.deskflowAPI.getProviderDiagnostics()
		setRecs(filterPath ? all.filter((r) => r.path === filterPath) : all)
	}, [filterPath])
	useEffect(() => { if (open) load() }, [open, load])
	useEffect(() => { if (highlightDiagId) { setOpen(true); setExp(highlightDiagId); load() } }, [highlightDiagId, load])
	return (
		<div className='mt-3 rounded-lg border border-zinc-800/60 bg-zinc-950 text-zinc-100'>
			<button onClick={() => setOpen((o) => !o)} className='flex w-full items-center justify-between px-3 py-2 text-xs font-medium'>
				<span>Diagnostics <span className='text-zinc-500'>({recs.length})</span></span>
				<span className='text-zinc-500'>{open ? '▾' : '▸'}</span>
			</button>
			{open && (
				<div className='border-t border-zinc-800/60 p-2'>
					<div className='mb-2 flex gap-2'>
						<button onClick={load} className='rounded-md bg-zinc-800 px-2 py-1 text-[11px]'>Refresh</button>
						<button onClick={async () => { await window.deskflowAPI.clearProviderDiagnostics(); load() }} className='rounded-md bg-zinc-800 px-2 py-1 text-[11px]'>Clear</button>
					</div>
					{recs.length === 0 && <div className='px-1 py-2 text-[11px] text-zinc-500'>No provider calls recorded yet.</div>}
					{recs.map((r) => {
						const ok = !r.error && (r.parse?.ok ?? true)
						const isOpen = exp === r.id
						return (
							<div key={r.id} className={'mb-1 rounded-md border ' + (highlightDiagId === r.id ? 'border-emerald-500' : 'border-zinc-800/60')}>
								<button onClick={() => setExp(isOpen ? null : r.id)} className='flex w-full items-center justify-between px-2 py-1 text-[11px]'>
									<span className='truncate'>
										<span className={ok ? 'text-emerald-400' : 'text-red-400'}>{ok ? '●' : '✕'}</span> {r.provider} · {r.model} · {r.path}
									</span>
									<span className='text-zinc-500'>{r.error?.status ?? r.response?.status ?? '—'} · {r.durationMs ?? '?'}ms</span>
								</button>
								{isOpen && (
									<div className='space-y-2 border-t border-zinc-800/60 p-2 font-mono text-[10px] leading-relaxed'>
										<Section title={'REQUEST ' + r.request.method + ' ' + r.request.url} lines={[fmt(r.request.headers), fmt(r.request.body)]} />
										{r.response && <Section title={'RESPONSE ' + r.response.status} lines={[fmt(r.response.headers), fmt(r.response.body)]} />}
										{r.error && <Section title={'ERROR ' + (r.error.status ?? '')} lines={[r.error.message, r.error.raw ?? '']} tone='error' />}
										{r.parse && <Section title={'PARSE ' + (r.parse.ok ? 'ok' : 'EMPTY')} lines={[r.parse.extracted ?? '', r.parse.discarded ? 'discarded: ' + r.parse.discarded : '']} />}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
```

### F9 — Wire the panel into the three surfaces

- **Settings → AI Assistant page:** after the Test button, store the result’s `diagId` (`setLastTestDiagId(r.diagId)`) and render `<ProviderDiagnostics filterPath='A-test' highlightDiagId={lastTestDiagId} />`. On `success:false`, show `r.error` in a red `text-[11px]` line above the panel.
- **AI Chat window:** store `diagId` on each assistant message (`msg.diagId = aiAgentService.lastDiagId`). Under each AI bubble add a `Show raw` toggle that renders `<ProviderDiagnostics filterPath='B-chat' highlightDiagId={msg.diagId} />` plus the accumulated tool-call list for that turn.
- **Digest pane (AiPage):** below the digest render `<ProviderDiagnostics filterPath='A-digest' />`; when `get-topic-digest` returns `{ error }`, show the human message and auto-open the panel.
- **L1/L2 notes:** drive `AIFeaturesModal` group items from the live `toolRegistry` categories (so the overlay can’t claim tools that aren’t registered); in `toolRegistry`, treat `securityLevel: 'admin'` as `'confirm'` until admin gating exists, so admin tools aren’t silently allowed.

### F10 — Error messages (exact strings, produced by `humanError` + network/empty branches)

| Condition | User-facing message |
| --- | --- |
| Provider unreachable (Ollama) | Ollama is not reachable at http://localhost:11434/v1/chat/completions. Start Ollama or check the URL in Settings. |
| Timeout | &lt;Provider&gt; timed out after 60000ms at &lt;url&gt;. |
| 401/403 | &lt;Provider&gt; returned 401 Unauthorized. Check your API key in Settings. |
| 402 | &lt;Provider&gt; returned 402 — out of credits/quota. Switch providers or top up, in Settings. |
| 404 | &lt;Provider&gt; returned 404 for &lt;url&gt;. Check the base URL and model name in Settings. |
| Empty body | The AI returned an empty response. Raw: &lt;first 800 chars of raw JSON&gt; |
| Parse/format | Shown via the PARSE section (extracted vs discarded) in the Diagnostics panel. |

## 4. Harmonized Architecture

### File map

| File | Responsibility |
| --- | --- |
| `providers/templates.ts` | **Single source** of URL/auth/body/parse per provider (+ `supportsStream`) |
| `providers/callProvider.ts` | **The only** HTTP client — streaming-aware, logs `[PROV-UNIFIED]`, pushes diagnostics, throws `ProviderError` |
| `providers/providerLog.ts` (NEW) | Ring buffer (50), masking, diag record type |
| `providers/router.ts` | `buildChain` / `callWithTokenTiers` / `runWithFallback`, forwarding stream+diag opts |
| `main.ts` | IPC: `provider-chat-call`, `get/clear-provider-diagnostics`; digest & test pass pathTags |
| `preload.ts` | Bridges chat call, chunk listener, diagnostics |
| `ai/aiAgentService.ts` | Builds messages/tools, calls main via IPC, accumulates chunks (no own fetch/templates) |
| `components/ProviderDiagnostics.tsx` (NEW) | Shared panel for Settings / Chat / Digest |

### Data flow (one client, three callers)

```
DIGEST   get-topic-digest  -> buildChain -> runWithFallback -> callWithTokenTiers -> callProvider --\
TEST     test-ai-provider  --------------------------------------------------------> callProvider ---> templates.ts
CHAT     aiAgentService.callLLM -> IPC provider-chat-call -> (callProvider | runWithFallback) ------/        |
                                                                                                            v
  every call: [PROV-UNIFIED] req/resp/err/timing logs  +  pushDiag(record)  +  ProviderError on failure
                                                                                                            v
  renderer: window.deskflowAPI.getProviderDiagnostics() -> <ProviderDiagnostics/> (Settings/Chat/Digest)
  chat chunks: callProvider.onChunk -> event.sender.send('provider-chunk:<id>') -> streamedContent/progressCallback
```

### Key interfaces

See `ProviderCallRecord` (F1), `ProviderRequest` / `ProviderConfig` / `CallProviderOptions` / `CallProviderResult` / `ProviderError` (F2). All callers consume these; no other request/response shapes exist after this change.

### Why chat routes through main (design decision)

The mandate requires logging to the **main** console; a renderer-side `callProvider` would log to DevTools only. Routing chat through `provider-chat-call` keeps one client in main (one log stream, one ring buffer, API keys never exposed to the renderer, no renderer CORS), while streaming is preserved via the chunk channel. This is how “`callLLM` uses `callProvider`” is honored without duplicating the client in two processes.

### Migration

`migrateProviderNames` (F7) is idempotent and already runs on every `get-ai-providers` and `save-ai-providers`. It now (a) canonicalizes more misspellings, (b) drops `invilier`, and (c) repairs any stored Ollama `baseUrl` ending in `/api/chat`. No preference version bump needed; existing data is healed on next load. No new dependencies.

## 5. Implementation Order

1. **F1** `providerLog.ts` (ring buffer + masking). *Test:* unit-push 60 records → length caps at 50, newest-first.
2. **F2** rewrite `callProvider.ts` (logging, streaming, errors). *Test:* non-stream digest still works; logs show full body.
3. **F7** `templates.ts` Ollama URL + `supportsStream` on cloudflare + `migrateProviderNames`. *Test:* Ollama returns content (H1 gone); stored bad URL repaired.
4. **F4** main IPC (`provider-chat-call`, diagnostics) + pathTags on test/digest. *Test:* `get-provider-diagnostics` returns records.
5. **F5** preload bridges. *Test:* renderer can call them.
6. **F3** router opts forwarding. *Test:* 402 retries tiers; fallback advances providers.
7. **F6** `aiAgentService.callLLM` refactor. *Test:* chat streams progressively; on error shows human message.
8. **F8** `ProviderDiagnostics.tsx`. *Test:* renders, expands, masks key.
9. **F9** wire into Settings/Chat/Digest. *Test:* each surface shows the matching calls.
10. **F10** verify all error strings appear for forced failures.
11. Full matrix: OpenRouter, Cloudflare, Ollama, Custom — test + digest + chat each.

## 6. Feature end-to-end verification

| Feature | Path after fix | Pass criteria |
| --- | --- | --- |
| Daily digest refresh | get-topic-digest → runWithFallback → callProvider (A-digest) | Digest renders; raw + parsed visible in panel; error string on failure (not topicCount:0) |
| Chat processing / step processing | callLLM → IPC → callProvider (B-chat) | Streaming text appears; tool rounds run; “Show raw” shows req/resp + tool calls |
| Click handling (confirm) | requestConfirm/resolveConfirm queue | Write tools prompt for confirm; approve/deny resolves the round |
| Provider test | test-ai-provider → callProvider (A-test) | Panel shows full request/response + timing; diagId highlighted |
| Goals access/control/edit/display | getGoals/saveGoal (direct IPC) | CRUD works; `checkAccess('goals')` gates correctly; UI lists/edits/saves |
| Provider list + name fix | get-ai-providers → migrateProviderNames | “Olamah”/variants show as “Ollama”; no `invilier`; Ollama URL = /v1/chat/completions |

## 7. What to test (verification checklist)

<aside>
🧪

- **Ollama (H1):** start Ollama, run a chat + a digest → content appears; panel REQUEST url ends `/v1/chat/completions`, PARSE = ok.
- **Logs:** main console shows `[PROV-UNIFIED] → REQUEST` with full body and `✓ RESPONSE` with full raw JSON (no 2000-char truncation) for every call.
- **Key masking:** Authorization in logs and panel shows only first 12 chars + `…(+N)`.
- **Empty/parse:** point a provider at a wrong model → see the empty-response message with raw JSON, and PARSE shows discarded.
- **Auth/timeout/404:** force 401, a dead port, and a bad path → exact strings from F10; no infinite spinner.
- **Streaming preserved:** chat text renders progressively; Cloudflare (non-stream) still shows content via the single final chunk.
- **Fallback:** disable primary / force 402 → chain advances; token tiers retried only on 402.
- **Diagnostics surfaces:** Test (A-test), Digest (A-digest), Chat (B-chat) each show only their calls; Clear empties the buffer.
- **Migration:** seed prefs with ids `olamah`, `ollamah`, `cloudflayer`, `invilier`, and a `/api/chat` Ollama URL → after load all canonicalized/healed/dropped.
- **All four providers:** OpenRouter, Cloudflare, Ollama, Custom — test + digest + chat green.
</aside>