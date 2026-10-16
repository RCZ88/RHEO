import type { ConnectorAdapter, AdapterContext, SyncReport } from './types'

export function makeStubAdapter(provider: string, type: string): ConnectorAdapter {
  const cap = { pull: false, push: false, send: false, markRead: false, history: 'none' as const }
  const adapter: ConnectorAdapter = {
    provider,
    type,
    capabilities: cap,
    validateConfig: (raw: unknown) => raw,
    test: async (_ctx: AdapterContext) => ({ success: false, message: `${provider} connector not implemented yet` }),
    sync: async (_ctx: AdapterContext): Promise<SyncReport> => {
      throw new Error(`${provider} sync not implemented yet`)
    },
  }
  return adapter
}
