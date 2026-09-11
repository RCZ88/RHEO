const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
// Local day Aug 3 = 2026-08-02T17:00Z .. 2026-08-03T17:00Z
const dayStart = new Date('2026-08-02T17:00:00Z').getTime();
const dayEnd = new Date('2026-08-03T17:00:00Z').getTime();
const rows = db.prepare("SELECT timestamp, app, category, duration_ms, is_browser_tracking, domain FROM logs ORDER BY timestamp").all()
  .filter(r => { const t = new Date(r.timestamp).getTime(); return t >= dayStart && t < dayEnd; });
// print rows with context around the >30min gaps
const bigGapMin = 30;
let prevT = null;
const window = [];
for (const r of rows) {
  const t = new Date(r.timestamp).getTime();
  if (prevT !== null) {
    const g = (t - prevT)/60000;
    if (g > bigGapMin) {
      console.log(`\n--- ${Math.round(g)}min GAP at ${r.timestamp.slice(0,16)}Z ---`);
      window.forEach(w => console.log(`  ${w}`));
      console.log(`  >>> ${r.timestamp} ${r.app} ${r.category} ${(r.duration_ms/1000).toFixed(0)}s browser=${r.is_browser_tracking}`);
    }
  }
  prevT = t;
  window.push(`${r.timestamp.slice(11,16)} ${r.app} ${(r.duration_ms/1000).toFixed(0)}s browser=${r.is_browser_tracking}`);
  if (window.length > 6) window.shift();
}
db.close();
