// workspace.ts — DeskFlow Sync Server workspace routes
import { FastifyPluginAsync } from "fastify"
import { z } from "zod"

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  const createWorkspaceProblem = z.object({
    user_id: z.string(),
    device_id: z.string().optional(),
    title: z.string(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  })

  const updateWorkspaceProblem = z.object({
    id: z.string(),
    user_id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    deleted: z.boolean().optional(),
  })

  const createWorkspaceRequest = z.object({
    user_id: z.string(),
    device_id: z.string().optional(),
    title: z.string(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  })

  const updateWorkspaceRequest = z.object({
    id: z.string(),
    user_id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    deleted: z.boolean().optional(),
  })

  // Workspace problems
  app.post("/problems", async (req, reply) => {
    const body = createWorkspaceProblem.parse(req.body)
    const result = await app.db.execute({
      sql: `INSERT INTO workspace_problems (user_id, device_id, title, status, priority, category, description, created_at, updated_at)
            VALUES (?, ?, ?, COALESCE(?, 'open'), COALESCE(?, 'normal'), ?, ?, datetime('now'), datetime('now'))
            RETURNING id, user_id, device_id, title, status, priority, category, description, created_at, updated_at, deleted`,
      args: [
        body.user_id,
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

  app.get("/problems", async (req, reply) => {
    const user_id = req.query.user_id as string
    const result = await app.db.execute({
      sql: `SELECT * FROM workspace_problems WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [user_id],
    })
    return result.rows
  })

  app.put("/problems", async (req, reply) => {
    const body = updateWorkspaceProblem.parse(req.body)
    const result = await app.db.execute({
      sql: `UPDATE workspace_problems SET title = COALESCE(?, title), status = COALESCE(?, status),
            priority = COALESCE(?, priority), category = COALESCE(?, category),
            description = COALESCE(?, description), deleted = COALESCE(?, deleted),
            updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
            RETURNING *`,
      args: [
        body.title || null,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
        body.deleted !== undefined ? body.deleted : null,
        body.id,
        body.user_id,
      ],
    })
    if (!result.rows[0]) {
      reply.code(404)
      return { error: "not found" }
    }
    return result.rows[0]
  })

  // Workspace requests
  app.post("/requests", async (req, reply) => {
    const body = createWorkspaceRequest.parse(req.body)
    const result = await app.db.execute({
      sql: `INSERT INTO workspace_requests (user_id, device_id, title, status, priority, category, description, created_at, updated_at)
            VALUES (?, ?, ?, COALESCE(?, 'open'), COALESCE(?, 'normal'), ?, ?, datetime('now'), datetime('now'))
            RETURNING id, user_id, device_id, title, status, priority, category, description, created_at, updated_at, deleted`,
      args: [
        body.user_id,
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

  app.get("/requests", async (req, reply) => {
    const user_id = req.query.user_id as string
    const result = await app.db.execute({
      sql: `SELECT * FROM workspace_requests WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [user_id],
    })
    return result.rows
  })

  app.put("/requests", async (req, reply) => {
    const body = updateWorkspaceRequest.parse(req.body)
    const result = await app.db.execute({
      sql: `UPDATE workspace_requests SET title = COALESCE(?, title), status = COALESCE(?, status),
            priority = COALESCE(?, priority), category = COALESCE(?, category),
            description = COALESCE(?, description), deleted = COALESCE(?, deleted),
            updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
            RETURNING *`,
      args: [
        body.title || null,
        body.status || null,
        body.priority || null,
        body.category || null,
        body.description || null,
        body.deleted !== undefined ? body.deleted : null,
        body.id,
        body.user_id,
      ],
    })
    if (!result.rows[0]) {
      reply.code(404)
      return { error: "not found" }
    }
    return result.rows[0]
  })

  app.get("/stats", async (req, reply) => {
    const user_id = req.query.user_id as string
    const problems = await app.db.execute({
      sql: `SELECT status, COUNT(*) as count FROM workspace_problems WHERE user_id = ? GROUP BY status`,
      args: [user_id],
    })
    const requests = await app.db.execute({
      sql: `SELECT status, COUNT(*) as count FROM workspace_requests WHERE user_id = ? GROUP BY status`,
      args: [user_id],
    })
    return {
      problems: Object.fromEntries(problems.rows.map((r: any) => [r.status, r.count])),
      requests: Object.fromEntries(requests.rows.map((r: any) => [r.status, r.count])),
    }
  })
}
