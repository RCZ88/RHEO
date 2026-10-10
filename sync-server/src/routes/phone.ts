// routes/phone.ts — Phone telemetry (battery, DeskFlow usage, device info)
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { randomUUID } from "crypto"
import { requireAuth } from "../auth.js"
import { getDb } from "../db/client.js"

const pushSchema = z.object({
  device_id: z.string(),
  recorded_at: z.string(),
  deskflow_usage: z.object({
    session_started_at: z.string().optional(),
    foreground_seconds: z.number().int().min(0).default(0),
    background_seconds: z.number().int().min(0).default(0),
  }).optional(),
  battery: z.object({
    level_percent: z.number().min(0).max(100).optional(),
    state: z.string().optional(),
  }).optional(),
  device: z.object({
    platform: z.string().optional(),
    platform_version: z.string().optional(),
  }).optional(),
})

export async function phoneRoutes(app: FastifyInstance) {
  // POST /v1/phone/telemetry/push — receive telemetry batch from mobile
  app.post("/telemetry/push", { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = (req as any).user
    const parsed = pushSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid payload", details: parsed.error.flatten() })
    }
    const { device_id, recorded_at, deskflow_usage, battery, device } = parsed.data
    const db = getDb()

    try {
      // Verify device belongs to user
      const check = await db.execute({
        sql: "SELECT id FROM devices WHERE id = ? AND user_id = ?",
        args: [device_id, userId],
      })
      if (check.rows.length === 0) {
        return reply.status(404).send({ error: "device not found" })
      }

      const id = randomUUID()
      await db.execute({
        sql: `INSERT INTO phone_telemetry (id, user_id, device_id, recorded_at, deskflow_foreground_sec, deskflow_background_sec, battery_level, battery_state, platform, platform_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          userId,
          device_id,
          recorded_at,
          deskflow_usage?.foreground_seconds ?? 0,
          deskflow_usage?.background_seconds ?? 0,
          battery?.level_percent ?? null,
          battery?.state ?? null,
          device?.platform ?? null,
          device?.platform_version ?? null,
        ],
      })

      // Update device last_seen
      await db.execute({
        sql: "UPDATE devices SET last_seen = unixepoch() WHERE id = ? AND user_id = ?",
        args: [device_id, userId],
      })

      // Audit log
      await db.execute({
        sql: "INSERT INTO audit_log (user_id, event, entity_type, entity_id, detail) VALUES (?, 'phone_telemetry_push', 'device', ?, ?)",
        args: [userId, device_id, JSON.stringify({ recorded_at })],
      })

      return { received: true }
    } catch (err: any) {
      req.log.error(err, "phone:push failed")
      return reply.status(500).send({ error: "failed to store telemetry" })
    }
  })

  // GET /v1/phone/telemetry/summary?from=ISO&to=ISO — daily aggregates for desktop
  app.get("/telemetry/summary", { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = (req as any).user
    const { from, to } = req.query as { from?: string; to?: string }
    const db = getDb()

    try {
      const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const toDate = to || new Date().toISOString().slice(0, 10)

      // `latest_battery` used to be SUBSTRING(MAX(recorded_at || '|' || battery_level), 22).
      // A recorded_at of "2026-10-05T10:00:00.000Z" is 24 chars, so index 22 lands
      // INSIDE the timestamp: the expression evaluated to the text "00Z|85", which
      // CAST(... AS REAL) then silently turned into 0. The chart read "0% battery"
      // for every phone. A correlated subquery is both correct and readable.
      const result = await db.execute({
        sql: `SELECT
          date(recorded_at) as date,
          SUM(deskflow_foreground_sec) as deskflow_foreground_sec,
          SUM(deskflow_background_sec) as deskflow_background_sec,
          AVG(battery_level) as avg_battery,
          (SELECT battery_level FROM phone_telemetry p2
             WHERE p2.user_id = phone_telemetry.user_id
               AND date(p2.recorded_at) = date(phone_telemetry.recorded_at)
             ORDER BY p2.recorded_at DESC LIMIT 1) as latest_battery
        FROM phone_telemetry
        WHERE user_id = ? AND date(recorded_at) >= ? AND date(recorded_at) <= ?
        GROUP BY date(recorded_at)
        ORDER BY date DESC`,
        args: [userId, fromDate, toDate],
      })

      return { daily: result.rows }
    } catch (err: any) {
      req.log.error(err, "phone:summary failed")
      return reply.status(500).send({ error: "failed to get summary" })
    }
  })

  // GET /v1/phone/telemetry/live — current live state for desktop dashboard card
  app.get("/telemetry/live", { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = (req as any).user
    const db = getDb()

    try {
      // Latest telemetry row
      const latest = await db.execute({
        sql: `SELECT t.*, d.name as device_name, d.platform as device_platform
        FROM phone_telemetry t
        JOIN devices d ON d.id = t.device_id
        WHERE t.user_id = ?
        ORDER BY t.recorded_at DESC
        LIMIT 1`,
        args: [userId],
      })

      if (latest.rows.length === 0) {
        return {
          device_name: null,
          device_platform: null,
          device_platform_version: null,
          current_battery: null,
          battery_state: null,
          today_deskflow_foreground_sec: 0,
          today_deskflow_background_sec: 0,
          last_seen: null,
          is_online: false,
        }
      }

      const row = latest.rows[0]

      // Today's totals
      const today = new Date().toISOString().slice(0, 10)
      const todaySum = await db.execute({
        sql: `SELECT
          COALESCE(SUM(deskflow_foreground_sec), 0) as fg,
          COALESCE(SUM(deskflow_background_sec), 0) as bg
        FROM phone_telemetry
        WHERE user_id = ? AND date(recorded_at) = ?`,
        args: [userId, today],
      })

      const t = todaySum.rows[0]
      const lastSeen = row.recorded_at as string
      const isOnline = (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000

      return {
        device_name: row.device_name || null,
        device_platform: row.device_platform || null,
        device_platform_version: row.platform_version || null,
        current_battery: row.battery_level,
        battery_state: row.battery_state,
        today_deskflow_foreground_sec: t ? Number(t.fg) : 0,
        today_deskflow_background_sec: t ? Number(t.bg) : 0,
        last_seen: lastSeen,
        is_online: isOnline,
      }
    } catch (err: any) {
      req.log.error(err, "phone:live failed")
      return reply.status(500).send({ error: "failed to get live state" })
    }
  })
}
