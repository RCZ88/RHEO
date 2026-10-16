import type { ConnectorAdapter } from './types'

const adapters = new Map<string, ConnectorAdapter>()
export const register = (a: ConnectorAdapter) => adapters.set(a.provider, a)
export function resolve(provider: string): ConnectorAdapter {
  const a = adapters.get(provider)
  if (!a) throw new Error(`No connector adapter for provider "${provider}"`)
  return a
}
export function listRegistered(): string[] { return Array.from(adapters.keys()) }
export { adapters }
