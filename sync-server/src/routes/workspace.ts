// workspace.ts — DeskFlow Sync Server workspace routes
//
// Two defects were fixed here:
//
// 1. EVERY handler called `app.db.execute(...)`, but `app.db` is never decorated
//    onto the FastifyInstance anywhere in this server — the sibling route module
//    (routes/sync.ts) correctly uses `getDb()` from db/client.js. So all 7
//    endpoints threw `TypeError: Cannot read properties of undefined (reading
//    'execute')` and returned 500. Verified live before the fix, and the TS
//    compiler flagged it as TS2339 the whole time.
//
// 2. These were the ONLY routes in the server with no `requireAuth` preHandler,
//    while the server binds 0.0.0.0 with CORS_ORIGINS=*. `user_id` was taken
//    straight off the query string (GETs) or trusted from the request body
//    (POST/PUT), so any LAN client could read or mutate ANY user's problems and
//    requests just by naming a UUID.
//
// The user id is now always derived from the verified JWT (`sub`) and a supplied
// user_id is ignored rather than honoured — trusting a client-supplied owner id
// is the actual vulnerability, not a missing header.
import { FastifyPluginAsync } from "fastify"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { requireAuth } from "../auth.js"
import { getDb } from "../db/client.js"

/** The authenticated user's id. Never read user_id from the request. */
function callerId(req: any): string {
  return req.user.sub as string
}

// `id` is a TEXT PRIMARY KEY with no DEFAULT and (unlike an INTEGER PRIMARY KEY)
// SQLite still permits NULL in it — so an INSERT that omits `id` silently creates
// an unidentifiable row that no later PUT/DELETE can ever match on `WHERE id = ?`.
// Mint the id here rather than relying on the column.
const newId = () => randomUUID()

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  const createWorkspaceProblem = z.object({
    device_id: z.string().optional(),
    title: z.string(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  })

  const updateWorkspaceProblem = z.object({
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    deleted: z.boolean().optional(),
  })

  const createWorkspaceRequest = z.object({
    device_id: z.string().optional(),
    title: z.string(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  })

  const updateWorkspaceRequest = z.object({
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    deleted: z.boolean().optional(),
  })

  // Workspace problems
  app.post("/problems", { preHandler: requireAuth }, async (req, reply) => {
    const body = createWorkspaceProblem.parse(req.body)
    const db = getDb()
    const result = await db.execute({
      sql: `INSERT INTO workspace_problems (id, user_id, device_id, title, status, priority, category, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, COALESCE(?, 'open'), COALESCE(?, 'normal'), ?, ?, datetime('now'), datetime('now'))
            RETURNING id, user_id, device_id, title, status, priority, category, description, created_at, updated_at, deleted`,
      args: [
        newId(),
        callerId(req),
        body.device_id || null,
        body.title,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
      ],
    })
    return result.rows[0]
  })

  app.get("/problems", { preHandler: requireAuth }, async (req) => {
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM workspace_problems WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [callerId(req)],
    })
    return result.rows
  })

  app.put("/problems", { preHandler: requireAuth }, async (req, reply) => {
    const body = updateWorkspaceProblem.parse(req.body)
    const db = getDb()
    const result = await db.execute({
      sql: `UPDATE workspace_problems SET title = COALESCE(?, title), status = COALESCE(?, status),
            priority = COALESCE(?, priority), category = COALESCE(?, category),
            description = COALESCE(?, description), deleted = COALESCE(?, deleted),
            updated_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [
        body.title || null,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
        body.deleted !== undefined ? body.deleted : null,
        body.id,
        callerId(req),
      ],
    })
    if (result.rowsAffected === 0) {
      reply.code(404)
      return { error: "not found" }
    }
    const read = await db.execute({
      sql: `SELECT * FROM workspace_problems WHERE id = ? AND user_id = ?`,
      args: [body.id, callerId(req)],
    })
    return read.rows[0]
  })

  // Workspace requests
  app.post("/requests", { preHandler: requireAuth }, async (req, reply) => {
    const body = createWorkspaceRequest.parse(req.body)
    const db = getDb()
    const result = await db.execute({
      sql: `INSERT INTO workspace_requests (id, user_id, device_id, title, status, priority, category, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, COALESCE(?, 'open'), COALESCE(?, 'normal'), ?, ?, datetime('now'), datetime('now'))
            RETURNING id, user_id, device_id, title, status, priority, category, description, created_at, updated_at, deleted`,
      args: [
        newId(),
        callerId(req),
        body.device_id || null,
        body.title,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
      ],
    })
    return result.rows[0]
  })

  app.get("/requests", { preHandler: requireAuth }, async (req) => {
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM workspace_requests WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [callerId(req)],
    })
    return result.rows
  })

  app.put("/requests", { preHandler: requireAuth }, async (req, reply) => {
    const body = updateWorkspaceRequest.parse(req.body)
    const db = getDb()
    const result = await db.execute({
      sql: `UPDATE workspace_requests SET title = COALESCE(?, title), status = COALESCE(?, status),
            priority = COALESCE(?, priority), category = COALESCE(?, category),
            description = COALESCE(?, description), deleted = COALESCE(?, deleted),
            updated_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [
        body.title || null,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
        body.deleted !== undefined ? body.deleted : null,
        body.id,
        callerId(req),
      ],
    })
    if (result.rowsAffected === 0) {
      reply.code(404)
      return { error: "not found" }
    }
    const read = await db.execute({
      sql: `SELECT * FROM workspace_requests WHERE id = ? AND user_id = ?`,
      args: [body.id, callerId(req)],
    })
    return read.rows[0]
  })

  app.get("/stats", { preHandler: requireAuth }, async (req) => {
    const db = getDb()
    const problems = await db.execute({
      sql: `SELECT status, COUNT(*) as count FROM workspace_problems WHERE user_id = ? GROUP BY status`,
      args: [callerId(req)],
    })
    const requests = await db.execute({
      sql: `SELECT status, COUNT(*) as count FROM workspace_requests WHERE user_id = ? GROUP BY status`,
      args: [callerId(req)],
    })
    return {
      problems: Object.fromEntries(problems.rows.map((r: any) => [r.status, r.count])),
      requests: Object.fromEntries(requests.rows.map((r: any) => [r.status, r.count])),
    }
  })
}