# Research Summary — Teams + LINE Connector Integration

I researched both APIs you linked and mapped them onto your real codebase.
Everything below is measured from the repo or quoted from the official docs.

## The finding that determines the whole design

Your connector subsystem is **pull-only**. Both platforms you want are
**push-only**. That is the entire difficulty.

| | IMAP / CalDAV (yours) | LINE | Teams |
|---|---|---|---|
| Direction | You poll **out** | They POST **in** | They POST **in** |
| Needs public HTTPS URL | No | **Yes** | **Yes** |
| Works on `127.0.0.1` | Yes | **No** | **No** |

An Electron app listening on localhost **cannot receive either webhook**. You
need a tunnel (Cloudflare Tunnel, ngrok, Tailscale Funnel) or a small relay.
There is no way to design around this.

Worse: the machine sleeps. A webhook that fires while DeskFlow is closed is
**lost forever** — there is no queue behind it. So a webhook can only ever be a
*low-latency accelerator*. The source of truth has to be a durable cursor plus
a poll that backfills.

## What actually exists in your code (verified, not assumed)

- `connectors` / `connector_items` tables — `src/main.ts:4125-4152`
- IPC handlers live in `src/infrastructure/ipc/goal-handlers.ts`
  (`connectors:list` at :2899, `connectors:sync` at :3135), **not** `src/main.ts`
- The backend is **real** — it genuinely connects to IMAP and does a CalDAV
  `REPORT`. Not a stub. I verified the actual fetch code.
- Local HTTP servers already exist in main (`54321` at `main.ts:6750`, another at
  `:21941`), so a webhook receiver isn't architecturally alien here.

## Three concrete problems I found while reading

1. **`type: 'email' | 'calendar'`** — a chat platform is *neither*. There's no
   value to add Teams or LINE to. Needs a third axis.

2. **The existing dedup is fake and will not survive contact.** IMAP items get
   id `ci_${id}_${seqno}` — a **sequence number**, which renumbers whenever
   anything is deleted from the mailbox. LINE and Teams both give you *real
   stable* message ids, so if you copy that pattern you'll silently corrupt
   history. The `INSERT OR REPLACE` masks it.

3. **`itemsAdded` lies.** It increments on every write, including no-op
   replacements, so your "N new" numbers are wrong today. And every per-item
   parse failure is swallowed by `catch {}` — malformed messages vanish with no
   trace and no dead-letter.

## Platform specifics that shape the build

**LINE** — POSTs a JSON event array to your HTTPS webhook. Must return **200
within seconds** or LINE disables the bot, so ack first and process after.
Validate `X-Line-Signature` against the **raw body** (HMAC-SHA256 with the
channel secret) — re-serializing the JSON breaks it. Redelivers events, so dedup
on `messageId`. Flex/template messages are JSON and are the biggest UI surface.

**Teams** — the SDK's `api` object is **activity-scoped**: it only exists inside
an activity handler. Pulling history proactively is a *different* auth path via
`app.api.graph.call(...)` → Microsoft Graph. Reading existing chat history needs
`Chat.Read` **plus admin consent**, and the SDK isn't built for bulk retrieval.
Also needs a Bot Framework registration: Azure AD app + secret + a public
messaging endpoint. Delivery is at-least-once with retries.

## Deliverables

- `agent/docs/generate-prompt-docs/teams-line-connectors-14102026/CONTEXT_BUNDLE.md`
- `agent/docs/generate-prompt-docs/teams-line-connectors-14102026/PROMPT.md`

The bundle contains verbatim source (real types, real DDL, real IPC surface, the
real sync handler), both platforms' API facts, and the constraints. The prompt
tasks the receiving AI with one comprehensive design and forbids an
Options A/B/C menu — per your skill's "request a design, not a menu."

## The one thing I'd flag before you send it

The prompt's first requirement is deliberately a question I can't answer for you:

> How does an offline desktop app that sleeps for hours reconcile messages a
> webhook delivered to nobody?

Everything else follows from that answer. If you already know how you want
tunnels and backfill to work, add it to the bundle — it'll save the Architect a
round trip. Otherwise the prompt forces them to confront it first, which is the
point.

**Not done:** I haven't implemented any of it. Per your skill, `RESULT.md` comes
back raw, then we run the completeness check and build an implementation plan
before any code gets written.