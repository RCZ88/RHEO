import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

// Minimal encrypted key/value vault for connector secrets. AES-256-GCM,
// master key loaded from env CONNECTORS_MASTER_KEY or a 0600 key file. This is
// the connectors-side analogue of ai-gateway/CredentialVault; the step-8
// migration will route IMAP/CalDAV passwords through it.
export class ConnectorVault {
  private dir: string
  private key: Buffer | null = null
  constructor(dataDir: string) { this.dir = dataDir; try { fs.mkdirSync(this.dir, { recursive: true }) } catch {} }

  private loadKey(): Buffer {
    if (this.key) return this.key
    const env = process.env.CONNECTORS_MASTER_KEY
    if (env) {
      this.key = /^[0-9a-fA-F]{64}$/.test(env.trim()) ? Buffer.from(env.trim(), 'hex') : crypto.scryptSync(env, 'connectors-v1', 32)
      return this.key
    }
    const kp = path.join(this.dir, '.masterkey')
    try { const r = fs.readFileSync(kp); if (r.length === 32) { this.key = r; return r } } catch {}
    const fresh = crypto.randomBytes(32)
    try { fs.writeFileSync(kp, fresh, { mode: 0o600 }) } catch {}
    this.key = fresh
    return fresh
  }

  private file() { return path.join(this.dir, 'connectors.enc') }
  private readAll(): Record<string, string> {
    const p = this.file(); let b: Buffer
    try { b = fs.readFileSync(p) } catch { return {} }
    if (b.length < 12 + 16 + 1) return {}
    try {
      const key = this.loadKey()
      const iv = b.subarray(0, 12); const tag = b.subarray(b.length - 16); const data = b.subarray(12, b.length - 16)
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag)
      const json = Buffer.concat([d.update(data), d.final()]).toString('utf-8')
      const parsed = JSON.parse(json)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch { return {} }
  }
  private writeAll(all: Record<string, string>) {
    const key = this.loadKey()
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([c.update(JSON.stringify(all), 'utf-8'), c.final()])
    const tag = c.getAuthTag()
    const p = this.file(); const tmp = p + '.tmp'
    fs.writeFileSync(tmp, Buffer.concat([iv, data, tag]), { mode: 0o600 })
    fs.renameSync(tmp, p)
  }

  get(key: string): Promise<string | null> { return Promise.resolve(this.readAll()[key] ?? null) }
  set(key: string, value: string): Promise<void> { const all = this.readAll(); all[key] = value; this.writeAll(all); return Promise.resolve() }
  delete(key: string): Promise<void> { const all = this.readAll(); delete all[key]; this.writeAll(all); return Promise.resolve() }
}
