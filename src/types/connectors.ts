// ============================================================================
// Connector types
// - Backward-compatible enrichment from RESULT(3).md (Teams + LINE connectors).
// - Existing fields preserved: components keep compiling unchanged.
// ============================================================================

// ---------- config ----------

export type ConnectorType = 'email' | 'calendar' | 'messaging';
export type ProviderId = 'imap' | 'caldav' | 'line' | 'teams';
export type LiveMode = 'live' | 'poll' | 'off';

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  tls: boolean
  folder?: string
}

export interface CalDavConfig {
  url: string
  username: string
  password: string
  calendarName?: string
}

export interface LineConfig {
  channelId: string
  relayUrl: string
  botUserId?: string
  // secrets (channelSecret, relay.token, relay.boxPrivateKey) live in the vault only
}

export interface TeamsConfig {
  tenantId: string
  clientId: string
  myUserId?: string
  backfillDays: number
  relayUrl?: string
  // secrets (msalCache, relay.token, relay.boxPrivateKey) live in the vault only
}

export interface ConnectorConfig {
  id: string
  // Widened to include 'messaging' (additive). Existing consumers compare literal
  // values, so this is a safe widening rather than a rename.
  type: ConnectorType | string
  provider: ProviderId | string
  displayName: string
  config: ImapConfig | CalDavConfig | LineConfig | TeamsConfig | any
  // Widened to include 'needs_setup' (additive).
  status: 'connected' | 'error' | 'disconnected' | 'needs_setup' | string
  lastSync?: string
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
  liveMode?: LiveMode
}

// ---------- items ----------

export type ItemBaseKind = 'email' | 'event' | 'reminder' | 'message'
export type MessageContentType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'html' | 'other'

export type ConnectorItemSubjectStructured = unknown

export interface ItemBase {
  id: string
  connectorId: string
  itemType: ItemBaseKind | string
  date: string
  read: boolean
  subject?: string
  summary?: string
  remoteId?: string | null
  metadata?: Record<string, any>
}

export interface EmailItem extends ItemBase {
  itemType: 'email'
  metadata?: { from?: string; sequenceNumber?: number } | Record<string, any>
}

export interface EventItem extends ItemBase {
  itemType: 'event'
  metadata?: Record<string, any>
}

export interface ReminderItem extends ItemBase {
  itemType: 'reminder'
  metadata?: Record<string, any>
}

export interface LineMessageMeta {
  platform: 'line'
  sourceType: 'user' | 'group' | 'room'
  webhookEventId: string
  isRedelivery: boolean
  quoteToken?: string
  media?: { path?: string; mediaExpired?: boolean; durationMs?: number; fileName?: string; fileSize?: number }
  location?: { title?: string; address?: string; latitude: number; longitude: number }
  sticker?: { packageId: string; stickerId: string; keywords?: string[] }
  flex?: { altText: string; json: unknown }
}

export interface TeamsMessageMeta {
  platform: 'teams'
  chatType: 'oneOnOne' | 'group' | 'meeting'
  importance?: 'normal' | 'high' | 'urgent'
  htmlBody?: string
  mentions?: { id: number; text: string; userId?: string }[]
  attachments?: { id: string; name?: string; contentType?: string; contentUrl?: string }[]
  reactions?: { type: string; userId?: string }[]
  webUrl?: string
}

export type MessageMeta = LineMessageMeta | TeamsMessageMeta

export interface MessageItem extends ItemBase {
  itemType: 'message'
  platform: 'line' | 'teams'
  conversationId: string
  direction: 'in' | 'out'
  sender: { id: string; name: string; avatarPath?: string | null }
  body: string | null
  contentType: MessageContentType
  replyToRemoteId?: string | null
  editedAt?: string | null
  deletedAt?: string | null
  metadata: LineMessageMeta | TeamsMessageMeta | Record<string, any>
}

// Backward-compat alias for any code reading leaf fields. Existing components
// only touch subject/summary/date/read/metadata, which ItemBase covers.
export type ConnectorItem = EmailItem | EventItem | ReminderItem | MessageItem

// ---------- conversations ----------

export interface ConversationSummary {
  id: string
  connectorId: string
  platform: 'line' | 'teams'
  kind: 'dm' | 'group' | 'room' | 'meeting' | 'channel'
  title: string
  avatarPath?: string | null
  participantCount?: number
  lastMessageAt: string
  lastMessagePreview: string
  lastSenderName?: string
  unreadCount: number
  leftAt?: string | null
}

export type InboxRow =
  | { rowKind: 'item'; item: EmailItem | EventItem | ReminderItem }
  | { rowKind: 'conversation'; conversation: ConversationSummary }

// ---------- test result ----------

export interface ConnectorTestResult {
  success: boolean
  message: string
  latencyMs?: number
}

export interface ConnectorSyncResult {
  success: boolean
  itemsAdded: number
  itemsUpdated: number
  error?: string
}
