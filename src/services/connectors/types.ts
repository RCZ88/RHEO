/* eslint-disable @typescript-eslint/no-explicit-any */
import type Database from 'better-sqlite3'

export interface VaultLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export interface AdapterContext {
  db: Database.Database
  connectorId: string
  row: { id: string; type: string; provider: string; config: any; status: string }
  vault: VaultLike
  cursors: { get(id: string): string | null; advance(id: string, cursor: string | null): void }
  live: { set(id: string, mode: string): void }
  emit(channel: string, payload: any): void
  runExclusive<T>(fn: () => Promise<T>): Promise<T>
  signal: AbortSignal
}

export interface SyncReport { itemsNew: number; itemsUpdated: number; deadLettered: number; conversationsTouched: number }

export interface PullPage { records: any[]; nextCursor: string | null; hasMore: boolean; conversationCursors?: Record<string, string> }

export interface Capability { pull: boolean; push: boolean; send: boolean; markRead: boolean; history: 'full' | 'limited' | 'none' }

export interface ConnectorAdapter<C = any> {
  readonly provider: string
  readonly type: string
  readonly capabilities: Capability
  validateConfig(raw: unknown): C
  test(ctx: AdapterContext): Promise<{ success: boolean; message: string; latencyMs?: number }>
  sync(ctx: AdapterContext): Promise<SyncReport>
  pull?: (ctx: AdapterContext, cursor: string | null, opts: { limit: number }) => Promise<PullPage>
  startLive?: (ctx: AdapterContext) => Promise<void>
  stopLive?: (ctx: AdapterContext) => Promise<void>
  send?: (ctx: AdapterContext, req: any) => Promise<any>
  setRead?: (ctx: AdapterContext, req: { conversationId?: string; itemId?: string; read: boolean }) => Promise<void>
  onRemove?: (ctx: AdapterContext) => Promise<void>
}
