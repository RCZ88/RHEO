// db/client.ts — libSQL database client
import { createClient, type Client } from "@libsql/client"

let client: Client | null = null

export function getDb(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL || "file:/tmp/rheo-sync.db"
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
