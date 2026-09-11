const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
console.log("=== Aug 3 logs sorted by time: gaps > 3min ===");
const rows = db.prepare("SELECT id, timestamp, app, category, duration_ms, is_browser_tracking, domain FROM logs WHERE date(timestamp)='2026-08-03' ORDER BY timestamp").all();
let prev = null; let gaps = [];
for (const r of rows) {
  const t = new Date(r.timestamp).getTime();
  if (prev !== null) {
    const gapMin = (t - prev) / 60000;
    if (gapMin > 3) gaps.push({ gapMin: Math.round(gapMin), after: r.timestamp.slice(11,19), app: r.app, durMin: Math.round(r.duration_ms/60000) });
  }
  prev = t;
}
console.log("total gaps >3min:", gaps.length);
gaps.slice(0, 30).forEach(g => console.log(`+${g.gapMin}min after ${g.after} (${g.app} ${g.durMin}m)`));
console.log("\n=== Aug 3 hours coverage (UTC) ===");
const hrs = db.prepare(`SELECT substr(timestamp,12,2) h, ROUND(SUM(duration_ms)/3600000.0,2) hrs, COUNT(*) n FROM logs WHERE date(timestamp)='2026-08-03' GROUP BY h ORDER BY h`).all();
hrs.forEach(r => console.log(`UTC ${r.h}:00 -> ${r.hrs}h (${r.n} entries)`));
console.log("\n=== durations capped at 1h? (MAX_LOGGED_SESSION_MS) ===");
console.log(db.prepare("SELECT COUNT(*) n FROM logs WHERE duration_ms >= 3600000 AND date(timestamp)='2026-08-03'").all());
console.log("=== 2h capped? ===");
console.log(db.prepare("SELECT COUNT(*) n FROM logs WHERE duration_ms >= 7200000").all());
db.close();
