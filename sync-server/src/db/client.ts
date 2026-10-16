// db/client.ts — libSQL database client
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient, type Client } from "@libsql/client"

let client: Client | null = null

// The package root, resolved from this file rather than process.cwd(). This module
// lives at <root>/src/db (tsx) or <root>/dist/db (compiled), so two levels up is
// the root either way. A relative DATABASE_URL resolved against cwd() opens a
// DIFFERENT database depending on who launched the process.
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function resolveUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw // libsql://, http://, ws:// — remote, leave alone
  const filePath = raw.slice("file:".length)
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(PKG_ROOT, filePath)
  // libsql will create the DB file but NOT its parent directory, and reports the
  // failure as bare "SQLITE_CANTOPEN: 14" from the Rust binding with no path in
  // the message — so make the directory ourselves and fail loudly if we can't.
  mkdirSync(path.dirname(abs), { recursive: true })
  return `file:${abs}`
}

export function getDb(): Client {
  if (!client) {
    const url = resolveUrl(process.env.DATABASE_URL || "file:/tmp/rheo-sync.db")
    const authToken = process.env.DATABASE_AUTH_TOKEN
    client = createClient({ url, authToken })
    console.log("[db] connected to", url)
  }
  return client
}

export async function closeDb() {
  if (client) {
    client.close()
    client = null
  }
}
