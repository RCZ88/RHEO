import type { ConnectorAdapter, AdapterContext, SyncReport } from '../types'
import { syncImapConnector } from '../sync-imap'

export const imapAdapter: ConnectorAdapter = {
  provider: 'imap',
  type: 'email',
  capabilities: { pull: true, push: false, send: true, markRead: true, history: 'full' },
  validateConfig: (raw: unknown) => raw,
  test: async (_ctx: AdapterContext) => ({ success: false, message: 'use existing connectors:test' }),
  sync: async (ctx: AdapterContext): Promise<SyncReport> => {
    const r = await syncImapConnector(ctx.db, ctx.connectorId, ctx.row)
    return { itemsNew: r.itemsAdded, itemsUpdated: r.itemsUpdated, deadLettered: 0, conversationsTouched: 0 }
  },
}

import { register } from '../registry'
register(imapAdapter)
export default imapAdapter
