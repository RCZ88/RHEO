# Collaboration Request: Mobile ↔ Desktop Communication Protocol

## Your Role
You are the Specialist AI. I am the Project Owner AI working in Clement Zhao's App Tracker (RHEO Electron+React+Vite) codebase. I know the desktop code; you know how to design and architect solutions. The external mobile AI agent has full codebase access to the MOBILE repo — you will ask questions and they will paste code back to you.

## The Idea (verbatim from user)
"The mobile phone connection is broken. There's no actual communication between the desktop and mobile. The QR code modal generates a code and a URL but nobody consumes it. The WebSocket relay exists but nobody knows what protocol to speak. Figure out what's missing and make it work."

## Current Context (What I Have — Desktop Codebase)

### Project
- **Name**: App Tracker (RHEO — "Real-time Heroic Operations" / Electron+React+Vite)
- **Stack**: Electron main process (TypeScript) + Vite dev server + React renderer
- **Domain**: Desktop app that pairs with a mobile phone for terminal relay and device sync

### What Exists on the Desktop Side

**1. QR Code Modals (renderer)**

`src/components/PairPhoneModal.tsx` (12,485 chars):
- Calls `pairGenerateCode(terminalId)` from `window.deskflowAPI`
- Generates 8-char code + QR code (from `result.syncUrl`)
- Shows QR code UI for scanning
- listens for `relay:paired` callback to show "Phone Connected!"
- QR encodes `result.syncUrl` (HTTP sync server URL with `?code=XXXXXXX`)

`src/components/SyncPairModal.tsx` (11,268 chars):
- Calls `authPairGenerate()` from `window.deskflowAPI` 
- Generates QR with `result.syncUrl?code=result.code`
- **REQUIRES AUTH TOKEN** — calls `auth:pair-generate` IPC which fails without login
- Used in DevicesPanel "Pair New Device" button

**2. WebSocket Relay Server (main process)**

`src/main/terminalRelay.ts` (10,420 chars):
- `WebSocketServer` on port 8788, bound to `0.0.0.0`
- Connection handler at line 170: parses `?code=` or `?ticket=` from query string
- Verifies JWT ticket signature with `RELAY_TICKET_SECRET`
- On valid connection: attaches to terminal session, forwards stdin/stdout
- `onRelayPaired` callback fires when phone connects successfully

**3. IPC Handlers (main.ts)**

| Channel | Handler | Auth Required | What It Does |
|---------|---------|---------------|--------------|
| `pair:generate-code` | line 9417 | NO | Generates 8-char code, returns `{ code, wsUrl, syncUrl, port }`. Falls back to local `pairingStore.createPairingCode()` if sync server unreachable |
| `pair:revoke` | line 9457 | NO | Revokes a specific pairing code |
| `pair:revoke-all` | line 9461 | NO | Revokes all pairing codes |
| `pair:list-active` | line 9466 | NO | Lists active pairings |
| `relay:request-ticket` | line 9401 | NO | Issues JWT ticket for QR code flow |
| `relay:status` | line 9386 | NO | Returns `{ active, port }` |
| `auth:pair-generate` | line 9519 | **YES** | Same as pair:generate-code but requires auth token in header |
| `list-devices` | line 9555 | **YES** | Lists devices registered with sync server |
| `relay:paired` | event | NO | Fired when phone connects via WebSocket |

**4. Preloaded API (preload.ts)**

`window.deskflowAPI` exposes:
- `api.pairGenerateCode(terminalId)` → triggers `pair:generate-code` IPC
- `api.relayStatus()` → triggers `relay:status` IPC  
- `api.relayRequestTicket()` → triggers `relay:request-ticket` IPC
- `api.authPairGenerate()` → triggers `auth:pair-generate` IPC (requires auth)

**5. Sidebar Integration**

`src/components/Sidebar.tsx`:
- Instrument strip shows phone status: "SYNCED" (green) or "NO PHONE" (red)
- "PAIR" button opens PairPhoneModal via `open-pair-modal` event
- "NO PHONE" state also clickable → opens PairPhoneModal
- Auth-gated: shows "AUTH" button instead of PAIR when not authenticated, opens auth settings tab

**6. Device Management**

`src/components/DevicesPanel.tsx`:
- Shows list of paired devices from `list-devices` IPC
- Empty state: prompts user to pair (auth-gated or QR)
- "Pair New Device" button opens SyncPairModal

### The Architecture (What the Desktop Expects)

```
Desktop App                          Mobile Phone
     |                                    |
     |--- QR Code (syncUrl?code=CODE) --->|
     |                                    |
     |<-- User scans QR with phone ------|
     |                                    |
     |--- WebSocket connect -------------->|
     |    ws://<ip>:8788?code=CODE        |
     |                                    |
     |<-- Terminal I/O streaming -------->|
     |                                    |
     |--- OR HTTP sync ----------------->|
     |    http://<ip>:8787?code=CODE      |
     |                                    |
```

### What the User Reported
- "Not authenticated with sync server" — appears in DevicesPanel when `list-devices` called without auth
- "NO PHONE" — sidebar shows this when no device connected
- "mobile authentication doesnt work at all" — the AUTH button doesn't do anything useful
- "the button lock button on the sidebar doesnt work at all" — auth button was broken
- "wheres the qr code button to pair?" — QR button exists but auth-gated
- "Suspense is not defined" — SettingsPage uses `<Suspense>` without importing it
- "ILLEGAL CONSTRUCTOR" — multiple runtime errors from missing imports and bad useState patterns

## Context Gaps (What I Don't Have — The Mobile Side)

**This is the critical gap.** I do NOT have access to the mobile app codebase. The mobile AI agent DOES have it. I need you to ask the mobile AI agent for:

1. **Does the mobile app even exist?** What's in the mobile repo? React Native? Flutter? Native iOS/Android?
2. **How does the mobile app consume the QR code?** Does it have a QR scanner? Does it parse `syncUrl?code=XXX`?
3. **What WebSocket protocol does the mobile speak?** What messages does it send/receive on `ws://<ip>:8788`? What's the message format?
4. **What HTTP endpoints does the mobile call?** If using the sync server at port 8787, what endpoints exist?
5. **Is there any shared protocol spec?** A protobuf, JSON schema, or hand-written doc that both sides follow?
6. **Does the mobile app have a "pair" screen?** What does the user see on the phone?
7. **What's the terminal relay protocol?** When the phone connects to port 8788 with a code, what happens next? How does stdin/stdout flow?
8. **Is the `RELAY_TICKET_SECRET` shared with the mobile?** How does the mobile verify or use JWT tickets?
9. **What pairing code format is expected?** 8-char alphanumeric? UUID? Something else?
10. **Are there any existing mobile↔desktop tests?** Integration tests that prove the communication works?

**ASK THESE QUESTIONS TO THE MOBILE AI AGENT.** Do not assume any of this exists. Fetch the actual code.

## Conversation Protocol

**How we (you + me) communicate through the CZ (human) relay:**

1. **You ask specific questions.** Format: `REQUEST: [specific file/protocol/clarification]`
2. **I fetch from desktop codebase** (I have it) OR **CZ relays to mobile AI agent** (they have mobile code) and back
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.** Format follows our standard specification.

**Rules:**
- Do NOT assume the mobile side exists or works. Verify with the mobile AI agent.
- Do NOT design for features whose desktop backend doesn't exist. Flag them.
- Do NOT produce a monolithic answer. Iterate with me and the mobile AI agent.
- When you need to see mobile code, ask the CZ to relay to the mobile AI agent.

## Scope
- **IN**: Desktop side is known. Mobile side is unknown — MUST be fetched from mobile AI agent. Design the complete communication protocol between them.
- **OUT**: Mobile app UI design (unless it blocks the protocol). Backend server (unless it's the sync server at 8787).

## Expected Output
After our conversation converges, produce:
1. **RESULT.md** — The complete communication protocol specification
2. **Implementation Plan** — What needs to be built/changed on BOTH desktop and mobile sides
3. **Desktop Changes** — Specific file changes needed on the desktop side
4. **Mobile Changes** — Specific file changes needed on the mobile side  
5. **Protocol Definition** — The actual message format, WebSocket frames, HTTP endpoints, error handling
6. **Backend Audit** — Any missing IPC channels, relay features, or sync endpoints flagged

## First Question
**Ask the mobile AI agent (via CZ relay): "Does the mobile app repo exist and have any code related to QR scanning, WebSocket connection, or terminal relay? If yes, what files are relevant? If no, what would need to be built from scratch?"**

Also ask: **"What is the current state of mobile↔desktop communication? Does anything work end-to-end right now, or is it all stub/placeholder?"**
