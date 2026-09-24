// GAS Integration — Persisted Secrets Reader
// Reads GAS webapp URL + auth token from the persisted-secrets mechanism.
// Pattern matches authStore.ts: sync-auth.json style.
// Never hardcoded. Never exposed to renderer.

import { app } from 'electron'
import fs from 'fs'
import path from 'path'

interface GasSecrets {
  webappUrl: string
  authToken: string
}

function getSecretsPath(): string {
  return path.join(app.getPath('userData'), 'gas-secrets.json')
}

export function loadGasSecrets(): GasSecrets | null {
  try {
    const raw = fs.readFileSync(getSecretsPath(), 'utf-8')
    const data = JSON.parse(raw)
    if (data.webappUrl && data.authToken) {
      return { webappUrl: data.webappUrl, authToken: data.authToken }
    }
  } catch {
    // File doesn't exist or is malformed
  }
  return null
}

export function saveGasSecrets(secrets: GasSecrets): void {
  const dir = path.dirname(getSecretsPath())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(getSecretsPath(), JSON.stringify(secrets, null, 2), 'utf-8')
}

export function hasGasSecrets(): boolean {
  return loadGasSecrets() !== null
}
