/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeCalDavUrl(urlStr: string, username: string): string {
  let url = urlStr;
  // Support CalDAV service discovery via /.well-known/caldav
  if (url.includes('@') && !url.startsWith('http')) {
    let domain: string;
    if (username.includes('@')) {
      domain = username.split('@')[1];
    } else if (username.includes('@')) {
      domain = username.split('@')[1];
    } else {
      domain = url;
    }
    return `https://${domain}`;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    let domain = url;
    if (username.includes('@')) {
      domain = username.split('@')[1];
    }
    url = 'https://' + (domain.endsWith('/') ? domain.slice(0, -1) : domain);
  }
  return url;
}

export function calDavRequest(opts: any): Promise<any> {
  return new Promise((resolve) => {
    const https = require('https')
    const http = require('http')
    const url = new URL(opts.url)
    const lib = url.protocol === 'https:' ? https : http
    const auth = Buffer.from(`${opts.username}:${opts.password}`).toString('base64')
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: opts.method || 'GET',
        headers: { 'Authorization': `Basic ${auth}`, ...(opts.headers || {}) },
        timeout: opts.timeoutMs || 15000,
      },
      (res: any) => {
        let body = '';
        res.on('data', (c: any) => body += c)
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      }
    )
    req.on('error', (e: any) => resolve({ status: 0, headers: {}, body: String(e?.message || e) }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: {}, body: 'timeout' }) })
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

export async function syncCalDavConnector(db: any, id: string, row: any): Promise<{ itemsAdded: number; itemsUpdated: number }> {
  const config = JSON.parse(row.config)
  let itemsAdded = 0
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const fmtDt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const calBody = `<?xml version="1.0" encoding="utf-8"?><C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:getetag/><C:calendar-data/></D:prop><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:time-range start="${fmtDt(now)}" end="${fmtDt(weekLater)}"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>`
  const report = await calDavRequest(normalizeCalDavUrl(config.url, config.username), {
    method: 'REPORT',
    username: config.username,
    password: config.password,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
    body: calBody,
    timeoutMs: 15000,
  })
  if (report.status < 200 || report.status >= 300) {
    const detail = report.body.length < 200 ? report.body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : ''
    throw new Error(`Calendar sync failed (HTTP ${report.status})${detail ? ' — ' + detail : ''}`)
  }
  const body = report.body
  const unfolded = body.replace(/\r?\n[ \t]/g, '')
  const icalUnescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_m, c) => (c === 'n' || c === 'N' ? '\n' : c))
  const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
  const matches = unfolded.match(veventRegex) || []
  const ins = db.prepare(`INSERT OR REPLACE INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`)
  for (const ve of matches) {
    const uidMatch = ve.match(/UID:(.*)/)
    const summaryMatch = ve.match(/SUMMARY[^:]*:(.*)/)
    const dtStartMatch = ve.match(/DTSTART[^:]*:(.*)/)
    const dtEndMatch = ve.match(/DTEND[^:]*:(.*)/)
    if (summaryMatch && dtStartMatch) {
      const summary = icalUnescape(summaryMatch[1].trim())
      ins.run(`ci_${id}_${uidMatch?.[1]?.trim() || Date.now()}`, id, summary, summary, dtStartMatch[1].trim(), JSON.stringify({ startTime: dtStartMatch[1]?.trim(), endTime: dtEndMatch?.[1]?.trim() }))
      itemsAdded++
    }
  }
  db.prepare("UPDATE connectors SET last_sync = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id)
  try {
    const episodeWriters = require('../../main/ai/episodeWriters')
    episodeWriters.writeConnectorEpisode(row, Array.from({ length: Math.min(itemsAdded, 5) }), itemsAdded > 0 ? 'synced' : 'new_items')
  } catch {}
  return { itemsAdded, itemsUpdated: 0 }
}
