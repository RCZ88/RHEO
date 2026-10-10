// routes/auth.ts — Register, login, pair, pair/generate, refresh endpoints
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import crypto from "crypto"
import { signAccess, signRefresh, verifyToken, requireAuth } from "../auth.js"
import { getDb } from "../db/client.js"
import { randomUUID } from "crypto"

// ── Password hashing (Node built-in scrypt, no extra deps) ───────
const SALT_BYTES = 32
const HASH_BYTES = 64

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_BYTES)
    crypto.scrypt(password, salt, HASH_BYTES, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(salt.toString("hex") + ":" + derivedKey.toString("hex"))
    })
  })
}

function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [saltHex, hashHex] = stored.split(":")
    if (!saltHex || !hashHex) return resolve(false)
    const salt = Buffer.from(saltHex, "hex")
    crypto.scrypt(password, salt, HASH_BYTES, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), derivedKey))
    })
  })
}

const PairBody = z.object({
  code: z.string().regex(/^[A-Z0-9]{8}$/).optional(),
  email: z.string().email().optional(),
  // Only meaningful together with `email`, and only used to PROVE ownership of an
  // existing account. It was absent before, which is part of why reusing an email
  // was unauthenticated: the endpoint had no way to check a password even in
  // principle.
  password: z.string().min(8).max(200).optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
})

const RefreshBody = z.object({
  refreshToken: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /v1/auth/pair — create or retrieve a user + device, return tokens
  //
  // Two modes:
  //   1. With `code` — phone pairing flow. Validates 8-char code against
  //      pairing_codes table. If user_id is set (from pair/generate), joins
  //      that user. Otherwise creates anonymous user + device (legacy).
  //   2. Without `code` — legacy email flow (backward compat).
  app.post("/pair", async (req, reply) => {
    const parsed = PairBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const { code, email, password, deviceName, platform } = parsed.data
    const db = getDb()

    let relayHost: string | null = null
    let relayPort = 8788
    let terminalId: string | null = null
    let userId: string

    // ── Code-based pairing (phone flow) ───────────────────────────
    if (code) {
      const codeHash = crypto.createHash("sha256").update(code).digest("hex")
      const now = Math.floor(Date.now() / 1000)

      const row = await db.execute({
        sql: "SELECT terminal_id, relay_host, relay_port, expires_at, user_id FROM pairing_codes WHERE code_hash = ? AND used = 0 AND expires_at > ?",
        args: [codeHash, now],
      })

      if (row.rows.length === 0) {
        return reply.status(401).send({ error: "invalid, expired, or already-used pairing code" })
      }

      const match = row.rows[0]
      terminalId = match.terminal_id as string
      relayHost = match.relay_host as string
      relayPort = (match.relay_port as number) || 8788

      // If pairing code has a user_id (from pair/generate), join that user
      const codeUserId = match.user_id as string | null

      // Mark code as used (one-time)
      await db.execute({
        sql: "UPDATE pairing_codes SET used = 1 WHERE code_hash = ?",
        args: [codeHash],
      })

      if (codeUserId) {
        // Join existing user (phone pairs to desktop's account)
        userId = codeUserId
        const userExists = await db.execute({
          sql: "SELECT id FROM users WHERE id = ?",
          args: [userId],
        })
        if (userExists.rows.length === 0) {
          // Fallback: create user if somehow missing
          userId = randomUUID()
          await db.execute({
            sql: "INSERT INTO users (id) VALUES (?)",
            args: [userId],
          })
        }
      } else {
        // Legacy flow: create anonymous user
        userId = randomUUID()
        await db.execute({
          sql: "INSERT INTO users (id) VALUES (?)",
          args: [userId],
        })
      }
    } else {
      // ── Find or create user (legacy flow) ─────────────────────────
      //
      // SECURITY: this branch used to do `SELECT id FROM users WHERE email = ?` and
      // hand that user_id straight back, with no password check. Since /v1/auth/pair
      // is unauthenticated by design, knowing someone's email address was enough to
      // be issued a valid token FOR THEIR ACCOUNT — verified live: a request with
      // only {"email":"victim@example.com"} got a token for the victim's user_id,
      // read their synced rows, and injected a row of its own.
      //
      // An email is a lookup key, not a credential. Reusing an account therefore
      // requires proving ownership of it:
      //   • password present on the account -> require the correct password
      //   • no password yet (legacy/anonymous account) -> allow, and SET one so the
      //     next join must present it
      // A fresh email still creates a new account, which is what pairing is for.
      if (email) {
        const existing = await db.execute({
          sql: "SELECT id, password_hash FROM users WHERE email = ?",
          args: [email],
        })
        if (existing.rows.length > 0) {
          const found = existing.rows[0] as unknown as { id: string; password_hash: string | null }
          const hasPassword = !!found.password_hash

          if (hasPassword && !password) {
            // Do NOT create a device or a token for someone who cannot prove who
            // they are. This is the account-takeover path.
            return reply.status(401).send({
              error: "password_required",
              hint: "This account has a password. Sign in with /v1/auth/login, or use a pairing code.",
            })
          }

          if (hasPassword && !(await verifyPassword(password as string, found.password_hash as string))) {
            return reply.status(401).send({ error: "invalid_credentials" })
          }

          userId = found.id

          if (!hasPassword && password) {
            // Legacy account being upgraded to a password-protected one.
            await db.execute({
              sql: "UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?",
              args: [await hashPassword(password as string), userId],
            })
          }
        } else {
          userId = randomUUID()
          await db.execute({
            sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
            args: [
              userId,
              email,
              password ? await hashPassword(password) : null,
            ],
          })
        }
      } else {
        userId = randomUUID()
        await db.execute({
          sql: "INSERT INTO users (id) VALUES (?)",
          args: [userId],
        })
      }
    }

    // ── Create device ─────────────────────────────────────────────
    const deviceId = randomUUID()
    await db.execute({
      sql: "INSERT INTO devices (id, user_id, name, platform) VALUES (?, ?, ?, ?)",
      args: [deviceId, userId, deviceName || "unknown", platform || "unknown"],
    })

    // If code-based pairing, update consumed_by_device_id
    if (code) {
      const codeHash = crypto.createHash("sha256").update(code).digest("hex")
      await db.execute({
        sql: "UPDATE pairing_codes SET consumed_by_device_id = ?, consumed_at = ? WHERE code_hash = ?",
        args: [deviceId, Math.floor(Date.now() / 1000), codeHash],
      })
    }

    // ── Sign tokens ───────────────────────────────────────────────
    const accessToken = await signAccess(userId, deviceId, "1h")
    const refreshToken = await signRefresh(userId, deviceId, "30d")

    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
    await db.execute({
      sql: "INSERT INTO refresh_tokens (token, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)",
      args: [refreshToken, userId, deviceId, expiresAt],
    })

    // Audit
    await db.execute({
      sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'pair', 'device', ?, ?)",
      args: [userId, deviceId, JSON.stringify({ code: !!code, deviceName, platform })],
    })

    const response: Record<string, any> = { accessToken, refreshToken, userId, deviceId }
    if (code && relayHost) {
      response.relayUrl = `ws://${relayHost}:${relayPort}`
      response.terminalId = terminalId
    }
    return response
  })

  // POST /v1/auth/refresh — exchange refresh token for new access token
  app.post("/refresh", async (req, reply) => {
    const parsed = RefreshBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const db = getDb()

    try {
      const payload = await verifyToken(parsed.data.refreshToken)
      if (payload.type !== "refresh") {
        return reply.status(401).send({ error: "not a refresh token" })
      }

      // Check token exists in DB
      const row = await db.execute({
        sql: "SELECT user_id, device_id, expires_at FROM refresh_tokens WHERE token = ?",
        args: [parsed.data.refreshToken],
      })
      if (row.rows.length === 0) {
        return reply.status(401).send({ error: "refresh token revoked" })
      }

      const { user_id, device_id } = row.rows[0]
      const newAccessToken = await signAccess(user_id as string, device_id as string, "1h")

      return { accessToken: newAccessToken }
    } catch {
      return reply.status(401).send({ error: "invalid refresh token" })
    }
  })

  // ── Register ─────────────────────────────────────────────────────
  // POST /v1/auth/register — create user with email + password
  const RegisterBody = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    deviceName: z.string().optional(),
    platform: z.string().optional(),
  })

  app.post("/register", async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const { email, password, deviceName, platform } = parsed.data
    const db = getDb()

    // Check if email already registered
    const existing = await db.execute({
      sql: "SELECT id, password_hash FROM users WHERE email = ?",
      args: [email],
    })
    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      // If user exists but has no password (anonymous pair), allow setting password
      if (row.password_hash) {
        return reply.status(409).send({ error: "email already registered" })
      }
      // Upgrade anonymous user: set password
      const passwordHash = await hashPassword(password)
      await db.execute({
        sql: "UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?",
        args: [passwordHash, row.id as string],
      })
      // Create device + tokens for this user
      const deviceId = randomUUID()
      await db.execute({
        sql: "INSERT INTO devices (id, user_id, name, platform) VALUES (?, ?, ?, ?)",
        args: [deviceId, row.id as string, deviceName || "desktop", platform || "win32"],
      })
      const accessToken = await signAccess(row.id as string, deviceId, "1h")
      const refreshToken = await signRefresh(row.id as string, deviceId, "30d")
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
      await db.execute({
        sql: "INSERT INTO refresh_tokens (token, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)",
        args: [refreshToken, row.id as string, deviceId, expiresAt],
      })
      await db.execute({
        sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'register_upgrade', 'device', ?, ?)",
        args: [row.id as string, deviceId, JSON.stringify({ email, deviceName, platform })],
      })
      return { accessToken, refreshToken, userId: row.id as string, deviceId }
    }

    // New user
    const userId = randomUUID()
    const passwordHash = await hashPassword(password)
    await db.execute({
      sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      args: [userId, email, passwordHash],
    })

    const deviceId = randomUUID()
    await db.execute({
      sql: "INSERT INTO devices (id, user_id, name, platform) VALUES (?, ?, ?, ?)",
      args: [deviceId, userId, deviceName || "desktop", platform || "win32"],
    })

    const accessToken = await signAccess(userId, deviceId, "1h")
    const refreshToken = await signRefresh(userId, deviceId, "30d")
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
    await db.execute({
      sql: "INSERT INTO refresh_tokens (token, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)",
      args: [refreshToken, userId, deviceId, expiresAt],
    })

    await db.execute({
      sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'register', 'device', ?, ?)",
      args: [userId, deviceId, JSON.stringify({ email, deviceName, platform })],
    })

    return { accessToken, refreshToken, userId, deviceId }
  })

  // ── Login ────────────────────────────────────────────────────────
  // POST /v1/auth/login — authenticate with email + password
  const LoginBody = z.object({
    email: z.string().email(),
    password: z.string(),
    deviceName: z.string().optional(),
    platform: z.string().optional(),
  })

  app.post("/login", async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const { email, password, deviceName, platform } = parsed.data
    const db = getDb()

    const row = await db.execute({
      sql: "SELECT id, password_hash FROM users WHERE email = ?",
      args: [email],
    })
    if (row.rows.length === 0) {
      return reply.status(401).send({ error: "invalid email or password" })
    }

    const user = row.rows[0]
    if (!user.password_hash) {
      return reply.status(401).send({ error: "account has no password — register first" })
    }

    const valid = await verifyPassword(password, user.password_hash as string)
    if (!valid) {
      return reply.status(401).send({ error: "invalid email or password" })
    }

    const userId = user.id as string
    const deviceId = randomUUID()
    await db.execute({
      sql: "INSERT INTO devices (id, user_id, name, platform) VALUES (?, ?, ?, ?)",
      args: [deviceId, userId, deviceName || "desktop", platform || "win32"],
    })

    const accessToken = await signAccess(userId, deviceId, "1h")
    const refreshToken = await signRefresh(userId, deviceId, "30d")
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
    await db.execute({
      sql: "INSERT INTO refresh_tokens (token, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)",
      args: [refreshToken, userId, deviceId, expiresAt],
    })

    await db.execute({
      sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'login', 'device', ?, ?)",
      args: [userId, deviceId, JSON.stringify({ email, deviceName, platform })],
    })

    return { accessToken, refreshToken, userId, deviceId }
  })

  // ── Pair Generate ────────────────────────────────────────────────
  // POST /v1/auth/pair/generate — server generates an 8-char pairing code
  // Requires Bearer auth. Returns { code, expiresAt, expiresAtMs }.
  const PairGenerateBody = z.object({
    terminalId: z.string().optional(),
    relayHost: z.string().optional(),
    relayPort: z.number().int().optional(),
  })

  app.post("/pair/generate", { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = (req as any).user
    const parsed = PairGenerateBody.safeParse(req.body || {})
    const { terminalId, relayHost, relayPort } = parsed.data || {}

    const db = getDb()

    // Generate 8-char uppercase alphanumeric code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I/0/O/1 to avoid confusion
    let code = ""
    const bytes = crypto.randomBytes(8)
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length]
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex")
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 5 * 60 // 5 minutes

    // Get device info for relay defaults
    const deviceRow = await db.execute({
      sql: "SELECT id FROM devices WHERE user_id = ? ORDER BY paired_at DESC LIMIT 1",
      args: [userId],
    })
    const deviceId = deviceRow.rows.length > 0 ? deviceRow.rows[0].id as string : ""

    // Get sync server host from env or default
    const serverHost = process.env.SYNC_HOST || "0.0.0.0"
    const serverPort = parseInt(process.env.PORT || "8787", 10)

    await db.execute({
      sql: `INSERT INTO pairing_codes (code_hash, terminal_id, relay_host, relay_port, expires_at, used, user_id)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [
        codeHash,
        terminalId || "default",
        relayHost || serverHost,
        relayPort || serverPort,
        expiresAt,
        userId,
      ],
    })

    // Audit
    await db.execute({
      sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'pair_generate', 'pairing', ?, ?)",
      args: [userId, codeHash, JSON.stringify({ expiresAt })],
    })

    return { code, expiresAt, expiresAtMs: expiresAt * 1000 }
  })
}
