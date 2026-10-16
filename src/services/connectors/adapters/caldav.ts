import type { ConnectorAdapter, AdapterContext, SyncReport } from '../types'
import { syncCalDavConnector } from '../sync-caldav'
import { register } from '../registry'

export const caldavAdapter: ConnectorAdapter = {
  provider: 'caldav',
  type: 'calendar',
  capabilities: { pull: true, push: false, send: true, markRead: false, history: 'full' },
  validateConfig: (raw: unknown) => raw,
  test: async (_ctx: AdapterContext) => ({ success: false, message: 'use existing connectors:test' }),
  sync: async (ctx: AdapterContext): Promise<SyncReport> => {
    const r = await syncCalDavConnector(ctx.db, ctx.connectorId, ctx.row)
    return { itemsNew: r.itemsAdded, itemsUpdated: r.itemsUpdated, deadLettered: 0, conversationsTouched: 0 }
  },
}
register(caldavAdapter)
export default caldavAdapter
