const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
console.log("=== logs count ===", db.prepare("SELECT COUNT(*) c FROM logs").get().c);
console.log("\n=== daily totals last 14 days ===");
try {
  const rows = db.prepare(`SELECT date(timestamp) d, COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,2) hrs, SUM(CASE WHEN is_browser_tracking=1 THEN 1 ELSE 0 END) bn, ROUND(SUM(CASE WHEN is_browser_tracking=1 THEN duration_ms ELSE 0 END)/3600000.0,2) bhrs, ROUND(SUM(CASE WHEN is_browser_tracking=0 OR is_browser_tracking IS NULL THEN duration_ms ELSE 0 END)/3600000.0,2) ahrs FROM logs WHERE date(timestamp) >= date('now','-14 days') GROUP BY d ORDER BY d DESC`).all();
  for (const r of rows) console.log(r.d, "| entries:", r.n, "| totalHrs:", r.hrs, "| browserHrs:", r.bhrs, "| appHrs:", r.ahrs);
} catch (e) { console.log(e.message); }
console.log("\n=== last 5 log rows ===");
console.log(db.prepare("SELECT id, timestamp, app, category, duration_ms, is_browser_tracking, domain, url FROM logs ORDER BY id DESC LIMIT 5").all());
console.log("\n=== today's browser rows (Aug 4) ===");
console.log(db.prepare("SELECT COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,2) hrs FROM logs WHERE is_browser_tracking=1 AND date(timestamp)='2026-08-04'").all());
console.log("\n=== today's app rows (Aug 4) ===");
console.log(db.prepare("SELECT COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,2) hrs FROM logs WHERE is_browser_tracking=0 AND date(timestamp)='2026-08-04'").all());
db.close();
