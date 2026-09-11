// ============================================================================
// AI Gateway — CredentialVault: AES-256-GCM encrypted session storage
// Spec §4.2. Master key: env WEBUI_GATEWAY_MASTER_KEY, else a local random key
// file (0600) under the gateway data dir. No plaintext secrets touch the DB.
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_FILE = '.masterkey';
const VAULT_FILE = 'credentials.enc';

export interface VaultEntry {
  providerId: string;
  storageState?: string; // Playwright storageState JSON (cookies + localStorage)
  createdAt: number;
  lastUsedAt: number;
  lastValidatedAt: number;
  isValid: boolean;
  failureCount: number;
  note?: string;
}

export class CredentialVault {
  private dir: string;
  private key: Buffer | null = null;

  constructor(dataDir: string) {
    this.dir = dataDir;
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
  }

  get ready(): boolean {
    try { return !!this.loadKey(); } catch { return false; }
  }

  private loadKey(): Buffer {
    if (this.key) return this.key;
    const envKey = process.env.WEBUI_GATEWAY_MASTER_KEY;
    if (envKey) {
      // Accept hex (64 chars) or derive from passphrase via scrypt.
      this.key = /^[0-9a-fA-F]{64}$/.test(envKey.trim())
        ? Buffer.from(envKey.trim(), 'hex')
        : crypto.scryptSync(envKey, 'ai-gateway-v1', 32);
      return this.key;
    }
    const keyPath = path.join(this.dir, KEY_FILE);
    try {
      const raw = fs.readFileSync(keyPath);
      if (raw.length === 32) { this.key = raw; return this.key; }
    } catch {}
    const fresh = crypto.randomBytes(32);
    try { fs.writeFileSync(keyPath, fresh, { mode: 0o600 }); } catch {}
    this.key = fresh;
    return this.key;
  }

  private readAll(): Record<string, VaultEntry> {
    const p = path.join(this.dir, VAULT_FILE);
    let blob: Buffer;
    try { blob = fs.readFileSync(p); } catch { return {}; }
    if (blob.length < 12 + 16 + 1) return {};
    try {
      const key = this.loadKey();
      const iv = blob.subarray(0, 12);
      const tag = blob.subarray(blob.length - 16);
      const data = blob.subarray(12, blob.length - 16);
      const d = crypto.createDecipheriv(ALGO, key, iv);
      d.setAuthTag(tag);
      const json = Buffer.concat([d.update(data), d.final()]).toString('utf-8');
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeAll(all: Record<string, VaultEntry>): void {
    const key = this.loadKey();
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv(ALGO, key, iv);
    const data = Buffer.concat([c.update(JSON.stringify(all), 'utf-8'), c.final()]);
    const tag = c.getAuthTag();
    const p = path.join(this.dir, VAULT_FILE);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, Buffer.concat([iv, data, tag]), { mode: 0o600 });
    fs.renameSync(tmp, p);
    // Keep a rotating backup (spec §4.2: backupCount 3).
    try {
      for (let i = 3; i >= 1; i--) {
        const src = i === 1 ? p : `${p}.bak${i - 1}`;
        const dst = `${p}.bak${i}`;
        if (fs.existsSync(src)) fs.copyFileSync(src, dst);
      }
    } catch {}
  }

  get(providerId: string): VaultEntry | null {
    try { return this.readAll()[providerId] || null; } catch { return null; }
  }

  put(entry: VaultEntry): void {
    const all = this.readAll();
    all[entry.providerId] = entry;
    this.writeAll(all);
  }

  touch(providerId: string, patch: Partial<VaultEntry>): void {
    const all = this.readAll();
    const prev = all[providerId] || {
      providerId, createdAt: Date.now(), lastUsedAt: 0,
      lastValidatedAt: 0, isValid: false, failureCount: 0,
    };
    all[providerId] = { ...prev, ...patch };
    this.writeAll(all);
  }

  remove(providerId: string): void {
    const all = this.readAll();
    delete all[providerId];
    this.writeAll(all);
  }
}
