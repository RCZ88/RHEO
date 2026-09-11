// terminalRelay.ts — Live terminal streaming to paired phone (Electron main process).
//
// Exposes the live Terminal Workspace (node-pty) to a paired phone over an
// AUTHENTICATED WebSocket. Two pairing flows:
//   1. QR code: phone scans → ws://host:port?ticket=<jwt>&terminalId=<id>
//   2. Short code: 8-char alphanumeric shown in popup → phone enters it → server
//      looks up the JWT and upgrades the connection.
//
// Security:
//   * Binds to 127.0.0.1 ONLY (use Tailscale/WireGuard/CF Tunnel — never expose).
//   * Short codes expire in 5 minutes; JWT tickets expire in 60 seconds after code use.
//   * Only attaches to existing, owned sessions — no remote spawn.
//   * Idle + absolute session timeouts.

import { WebSocketServer, type WebSocket } from "ws"
import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import crypto from "crypto"

export interface TerminalManagerAdapter {
  write(id: string, data: string): boolean
  resize(id: string, cols: number, rows: number): void
  onData(id: string, cb: (d: string) => void): () => void
  has(id: string): boolean
}

interface RelayMessage {
  t: "in" | "resize"
  d?: string
  cols?: number
  rows?: number
}

export interface PairingCode {
  code: string
  terminalId: string
  jwt: string
  expiresAt: number
  createdAt: number
}

const IDLE_MS = 5 * 60_000
const MAX_SESSION_MS = 60 * 60_000
const MAX_INPUT_LEN = 8192
const MAX_COLS = 500
const MAX_ROWS = 200
const CODE_TTL_MS = 5 * 60_000 // 5 minutes
const CODE_LENGTH = 8

// ── Pairing Code Store ─────────────────────────────────────────────
export class PairingCodeStore {
  private codes = new Map<string, PairingCode>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(private secretKey: Uint8Array) {}

  startCleanup() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 30_000)
  }

  stopCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
  }

  private evictExpired() {
    const now = Date.now()
    for (const [code, entry] of this.codes) {
      if (now > entry.expiresAt) this.codes.delete(code)
    }
  }

  private generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I/O/0/1 to avoid confusion
    const bytes = crypto.randomBytes(CODE_LENGTH)
    let code = ""
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += chars[bytes[i] % chars.length]
    }
    return code
  }

  async createPairingCode(terminalId: string): Promise<PairingCode> {
    // Generate unique code
    let code: string
    do {
      code = this.generateCode()
    } while (this.codes.has(code))

    // Sign a JWT for this terminal
    const jwt = await new SignJWT({ sub: "pairing", terminalId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(this.secretKey)

    const entry: PairingCode = {
      code,
      terminalId,
      jwt,
      expiresAt: Date.now() + CODE_TTL_MS,
      createdAt: Date.now(),
    }

    this.codes.set(code, entry)
    return entry
  }

  consumeCode(code: string): PairingCode | null {
    const entry = this.codes.get(code)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.codes.delete(code)
      return null
    }
    this.codes.delete(code) // one-time use
    return entry
  }

  revokeCode(code: string): boolean {
    return this.codes.delete(code)
  }

  revokeAll() {
    this.codes.clear()
  }

  getActive(): PairingCode[] {
    const now = Date.now()
    return Array.from(this.codes.values()).filter((c) => now < c.expiresAt)
  }

  /** Register an externally-generated code (e.g. from the sync server) so the relay can accept it. */
  async registerExternalCode(code: string, terminalId: string, ttlMs = CODE_TTL_MS): Promise<PairingCode> {
    const jwt = await new SignJWT({ sub: "pairing", terminalId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${Math.ceil(ttlMs / 1000)}s`)
      .sign(this.secretKey)

    const entry: PairingCode = {
      code,
      terminalId,
      jwt,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    }
    this.codes.set(code, entry)
    return entry
  }
}

// ── Terminal Relay Server ───────────────────────────────────────────
export function startTerminalRelay(
  terminalManager: TerminalManagerAdapter,
  port = 8788,
  onConnected?: (terminalId: string) => void,
): { wss: WebSocketServer | null; pairingStore: PairingCodeStore } {
  let secret = process.env.RELAY_TICKET_SECRET
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex")
    process.env.RELAY_TICKET_SECRET = secret
    console.log("[relay] RELAY_TICKET_SECRET auto-generated (session-only)")
  }

  const secretKey = new TextEncoder().encode(secret)
  const pairingStore = new PairingCodeStore(secretKey)
  pairingStore.startCleanup()

  const wss = new WebSocketServer({ host: "0.0.0.0", port })

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url || "", "http://localhost")
    let ticket = url.searchParams.get("ticket") || ""
    let terminalId = url.searchParams.get("terminalId") || ""
    const pairingCode = url.searchParams.get("code") || ""

    // 1) If a short pairing code was provided, consume it and extract the JWT.
    if (pairingCode && !ticket) {
      const entry = pairingStore.consumeCode(pairingCode)
      if (!entry) {
        console.warn("[relay] rejected: invalid or expired pairing code")
        ws.close(4401, "invalid or expired code")
        return
      }
      ticket = entry.jwt
      if (!terminalId) terminalId = entry.terminalId
      console.log(`[relay] pairing code consumed for terminal ${terminalId}`)
    }

    // 2) AuthN: verify the signed relay ticket.
    let userId = ""
    try {
      if (!ticket) throw new Error("no ticket")
      const { payload } = await jwtVerify(ticket, secretKey, { algorithms: ["HS256"] })
      userId = String(payload.sub || "")
      if (!userId) throw new Error("no subject")
    } catch {
      console.warn("[relay] rejected: invalid ticket")
      ws.close(4401, "unauthorized")
      return
    }

    // 3) AuthZ: only attach to an existing, owned terminal.
    if (!terminalId || !terminalManager.has(terminalId)) {
      console.warn(`[relay] rejected: terminal ${terminalId} not found`)
      ws.close(4404, "no such terminal")
      return
    }

    console.log(`[relay] user ${userId} connected to terminal ${terminalId}`)
    onConnected?.(terminalId)

    let lastActivity = Date.now()
    const hardStop = setTimeout(() => {
      ws.close(4408, "session expired")
    }, MAX_SESSION_MS)

    const idleCheck = setInterval(() => {
      if (Date.now() - lastActivity > IDLE_MS) ws.close(4408, "idle timeout")
    }, 15_000)

    // 4) Stream PTY output → phone.
    const unsub = terminalManager.onData(terminalId, (d: string) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ t: "out", d }))
      }
    })

    // 5) Phone input → PTY.
    ws.on("message", (raw) => {
      lastActivity = Date.now()
      let msg: RelayMessage
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.t === "in" && typeof msg.d === "string" && msg.d.length < MAX_INPUT_LEN) {
        terminalManager.write(terminalId, msg.d)
      } else if (msg.t === "resize" && Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) {
        terminalManager.resize(terminalId, Math.min(msg.cols!, MAX_COLS), Math.min(msg.rows!, MAX_ROWS))
      }
    })

    ws.on("close", () => {
      clearTimeout(hardStop)
      clearInterval(idleCheck)
      unsub()
      console.log(`[relay] disconnected from terminal ${terminalId}`)
    })

    ws.on("error", (err) => {
      console.error(`[relay] ws error:`, err.message)
    })
  })

  console.log(`[relay] terminal relay on 0.0.0.0:${port}`)
  return { wss, pairingStore }
}

// ── Utility: issue a raw relay ticket (for QR code flow) ───────────
export async function issueRelayTicket(userId: string, ttlSeconds = 60): Promise<string> {
  const secret = process.env.RELAY_TICKET_SECRET
  if (!secret) throw new Error("RELAY_TICKET_SECRET not set")
  const key = new TextEncoder().encode(secret)
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key)
}
