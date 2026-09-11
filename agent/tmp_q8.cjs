const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
// local day = UTC+7. label = date of (timestamp + 7h)
console.log("=== Per LOCAL day (UTC+7) totals, last 10 days ===");
const rows = db.prepare("SELECT timestamp, app, duration_ms, is_browser_tracking, domain FROM logs ORDER BY timestamp").all();
const days = new Map();
for (const r of rows) {
  const d = new Date(new Date(r.timestamp).getTime() + 7*3600000).toISOString().slice(0,10);
  if (!days.has(d)) days.set(d, {app:0, browser:0, n:0});
  const day = days.get(d);
  day.n++;
  if (r.is_browser_tracking) day.browser += r.duration_ms; else day.app += r.duration_ms;
}
[...days.entries()].slice(-10).forEach(([d,v]) => console.log(`${d}  app ${(v.app/3600000).toFixed(2)}h  browser ${(v.browser/3600000).toFixed(2)}h  total ${((v.app+v.browser)/3600000).toFixed(2)}h  (${v.n} entries)`));
console.log("\n=== Aug 3 local-day logs with 5+ min gaps (sorted) ===");
const dayStart = new Date('2026-08-02T17:00:00Z').getTime();
const dayEnd = new Date('2026-08-03T17:00:00Z').getTime();
const dayRows = rows.filter(r => { const t = new Date(r.timestamp).getTime(); return t >= dayStart && t < dayEnd; }).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
let prev=null, gaps=[];
for (const r of dayRows) {
  const t = new Date(r.timestamp).getTime();
  if (prev!==null) { const g=(t-prev)/60000; if (g>5) gaps.push({g: Math.round(g), t: r.timestamp}); }
  prev = t;
}
console.log(`total day logs: ${dayRows.length}, gaps>5min: ${gaps.length}`);
gaps.forEach(x=>console.log(`  +${x.g}min gap ending ${x.t.slice(11,16)}Z`));
db.close();
