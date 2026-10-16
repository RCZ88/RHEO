/* eslint-disable @typescript-eslint/no-explicit-any */
export async function syncImapConnector(db: any, id: string, row: any): Promise<{ itemsAdded: number; itemsUpdated: number }> {
  const config = JSON.parse(row.config)
  const imapCfg = {
    user: config.username, password: config.password,
    host: config.host, port: config.port, tls: config.tls,
    tlsOptions: { rejectUnauthorized: false },
  }
  const Imap = require('node-imap')
  const { simpleParser } = require('mailparser')
  const rawItems: any[] = await new Promise((resolve, reject) => {
    const imap = new Imap(imapCfg)
    const results: any[] = []
    imap.once('ready', () => {
      imap.openBox(config.folder || 'INBOX', true, (err: any, box: any) => {
        if (err) { imap.end(); reject(err); return }
        const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 19)}:*`, { bodies: '', markSeen: false })
        fetch.on('message', (msg: any, seqno: number) => {
          let raw = ''
          msg.on('body', (stream: any) => { stream.on('data', (chunk: any) => { raw += chunk.toString('utf8') }) })
          msg.on('attributes', (attrs: any) => { msg._attrs = attrs })
          msg.on('end', () => { results.push({ seqno, raw, attrs: msg._attrs }) })
        })
        fetch.once('error', (e: any) => { imap.end(); reject(e) })
        fetch.once('end', () => { imap.end(); resolve(results) })
      })
    })
    imap.once('error', reject)
    imap.connect()
  })
  const ins = db.prepare(`INSERT OR REPLACE INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'email', ?, ?, ?, ?, ?)`)
  let itemsAdded = 0
  for (const item of rawItems) {
    try {
      const parsed = await simpleParser(item.raw)
      const itemId = `ci_${id}_${item.seqno}`
      const dateStr = parsed.date ? parsed.date.toISOString() : new Date().toISOString()
      const fromAddr = parsed.from?.text || ''
      const subject = parsed.subject || '(no subject)'
      const snippet = (parsed.text || '').slice(0, 200).replace(/\s+/g, ' ').trim()
      const isRead = item.attrs?.flags?.includes('\\Seen') ? 1 : 0
      ins.run(itemId, id, subject, snippet, dateStr, isRead, JSON.stringify({ from: fromAddr, sequenceNumber: item.seqno }))
      itemsAdded++
    } catch {}
  }
  db.prepare("UPDATE connectors SET last_sync = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id)
  try {
    const episodeWriters = require('../../main/ai/episodeWriters')
    episodeWriters.writeConnectorEpisode(row, Array.from({ length: Math.min(itemsAdded, 5) }), itemsAdded > 0 ? 'synced' : 'new_items')
  } catch {}
  if (itemsAdded > 0) {
    const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM connector_items WHERE connector_id = ? AND item_type = ? AND is_read = 0').get(id, 'email') as any
    if (unreadCount?.cnt > 0) {
      const latestItems = db.prepare('SELECT id, subject, summary, date, metadata FROM connector_items WHERE connector_id = ? AND item_type = ? AND is_read = 0 ORDER BY date DESC LIMIT 5').all(id, 'email')
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((win: any) => {
        win.webContents.send('connectors:new-emails', { connectorId: id, connectorName: row.display_name, unreadCount: unreadCount.cnt, newItems: latestItems })
      })
    }
  }
  return { itemsAdded, itemsUpdated: 0 }
}
