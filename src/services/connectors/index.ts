import './adapters/line'
import './adapters/teams'
import './adapters/imap'
import './adapters/caldav'
import { register, resolve, listRegistered } from './registry'
// re-exports for external callers
export { register, resolve, listRegistered }
export type { AdapterContext, SyncReport } from './types'

export function ensureRegistered() {
  // Adapters self-register on import. Calling this is idempotent.
  return listRegistered()
}
