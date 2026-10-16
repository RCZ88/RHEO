# PROMPT — Teams + LINE Messaging Connectors

## Read this first

`CONTEXT_BUNDLE.md` in this same folder is the **source of truth for all code
structure, types, DB schema, IPC surface and platform API facts**. It contains
the verbatim current source of every file you will touch. Read it completely
before designing anything. Do not guess at the existing code's shape.

You do not have access to the codebase. The bundle replaces that.

---

## Raw Request

> https://learn.microsoft.com/en-us/microsoftteams/platform/teams-sdk/essentials/api?tabs=legacy%2Ccore&pivots=typescript
> https://developers.line.biz/en/services/messaging-api/
> i would like to integrate this into my connector, figure out how to
> pulling both data

---

## Context

DeskFlow has a working connector subsystem. It is real, not mocked: it connects
over IMAP and CalDAV, fetches the last 20 messages / the next 7 days of events,
parses them, and writes them to `connector_items`. The UI lists them, supports
unread counts, search, and read/unread marking.

The user wants **Microsoft Teams** and **LINE** added, so their chat messages
appear in that same connector UI.

**The problem nobody has solved yet, stated plainly:** the existing subsystem
pulls. Both platforms push. An Electron app on `127.0.0.1` cannot receive an
HTTPS webhook. The machine also sleeps.

---

## Your Role

Act as **Lead Designer and Engineer**. You own this end to end — the data model,
the reconciliation algorithm, the API contracts, the UI, and the failure modes.
Produce **one** comprehensive design. Do not offer options A, B and C for the
user to choose from. Commit to the best answer and justify it.

---

## The Mandate

Design a complete solution that adds Teams and LINE as first-class connectors,
unifying push-delivered messaging with the existing pull-based subsystem, and
surfaces their messages in the existing connector UI with real processing
rather than a raw dump.

---

## Requirement Checklist

### A. Answer the offline question first
State explicitly and concretely: **how does a desktop app that was offline for
six hours discover messages a webhook delivered to nobody?**

Design the reconciliation mechanism. Consider, and commit to: a durable cursor
per connector, a poll that backfills from the cursor, webhook delivery as a
low-latency *accelerator* rather than the source of truth, and how the two are
made idempotent so a message arriving by both paths is stored once. Give the
actual algorithm and the actual SQL.

### B. Data model
Design the schema changes. You must cover, with real DDL:
- How `type` and `provider` gain messaging values without breaking existing rows
- The stable remote-message identity for LINE and Teams, and where it is
  enforced (this is the dedup guarantee)
- Conversation/thread identity — messages are not flat, they belong to
  conversations, and both platforms model this
- Webhook delivery receipts, for at-least-once redelivery
- The composite index that makes the list query fast
- Migration steps that are safe on a live database with one writer

State plainly which of these need new tables vs. new columns, and why.

### C. Platform integration
For **each** of LINE and Teams, specify:
- Credential acquisition and storage (name the exact vault)
- Webhook registration and signature verification, including the raw-body
  requirement
- The outbound send path, with the exact endpoints and auth headers
- Rate limits and the backoff behaviour on 429
- What the platform's own history-retention limits are, and how you compensate
- **Teams specifically:** the Teams SDK's `api` object is activity-scoped, so
  state exactly how proactive/history retrieval differs, what Microsoft Graph
  permissions and admin consent are required, and what happens when the bot is
  not in a conversation
- **LINE specifically:** the 200-within-seconds ack requirement, the verify
  handshake, and flex/template message rendering

### D. Unified item abstraction
The current `ConnectorItem` has no sender, conversation, direction, or
threading. Design how an email, an event, a LINE message, and a Teams message
coexist in one list without one of them being a second-class citizen. Specify
the exact union type, the discriminator, and how the UI renders each kind.

### E. Connector registry
The current sync dispatch is an `if/else if` chain on `type`/`provider`. Two
more providers makes it worse. Design a registry/adapter interface that the
existing IMAP and CalDAV implementations also conform to, with the exact
interface and the migration path for the two existing providers.

### F. Real data processing — not a raw dump
The user explicitly asked for processed insight, not raw rows. Design the
processing pipeline with real specifics:
- Conversation threading and grouping
- Unread semantics that differ per platform (LINE has no read receipts from
  users in the same sense as email; Teams has different semantics again) —
  define what `is_read` actually means per platform
- Deduplication and stitching of a message sent on both paths
- Snippet/preview generation, participant resolution, and avatar strategy
- The aggregation that produces the existing "N unread · M today" header
  numbers correctly across four item kinds
- What gets written into `metadata` per platform

### G. UI/UX
Design the interaction, specifying states (empty / loading / error / populated)
for each new surface:
- The **setup flow** for a messaging connector, which is categorically
  different from the IMAP host/port/password form — including webhook URL
  display and copy, token entry, and a connection test with a real result
- The **message list**, including conversation grouping and how a LINE group
  chat differs from a 1:1 chat
- The **item detail** view, including the reply affordance and rich/flex content
- How the user knows whether a connector is push-live, poll-only, or
  needs-setup — three genuinely different states that must be legible at a glance
- What happens when a tunnel dies mid-session

### H. Failure modes
Enumerate and specify behaviour for each: tunnel unavailable, webhook signature
mismatch, platform token revoked, message received twice, message received out
of order, conversation deleted mid-sync, rate limited, and the app quitting
during delivery.

### I. Migration & rollout
Specify how this ships without breaking the two existing connectors, how a user
adds their first messaging connector, and what the migration order must be.

---

## Output Format

Produce `RESULT.md` with these sections, in this order:

1. **The Offline Answer** — the reconciliation design, stated first, because
   everything depends on it
2. **Data Model** — full DDL, migration order, and the dedup guarantee
3. **Platform Integration** — LINE, then Teams, with real endpoints and headers
4. **Unified Item Abstraction** — exact types
5. **Connector Registry** — exact interface + migration path
6. **Data Processing Pipeline** — the actual algorithms and SQL
7. **UI/UX Specification** — states, layout, copy
8. **Failure Modes** — the full table
9. **Migration & Rollout**
10. **Backend Audit Table** — for every feature: IPC channel, handler location,
    service, DB support, and status (real / stub / missing)

Write TypeScript and SQL, not pseudocode. Every DDL statement complete. Every
endpoint a real URL. Every auth header a real header. Name actual files from
the context bundle.

---

## Constraints

- Must work offline-first; webhook is an accelerator, never the only path
- Must not break IMAP or CalDAV
- New `type`/`provider` values must not require rewriting existing rows
- Secrets in the encrypted vault, never in plaintext `config` or `localStorage`
- Must not require the app to be running for messages to be captured
- One DB writer; DDL only when the app is stopped
- Do not modify or delete `dist/` or `dist-electron/`

---

## Definition of done

The design is complete when a developer who has never seen this codebase could
implement it from `RESULT.md` plus `CONTEXT_BUNDLE.md` alone, without asking a
follow-up question.