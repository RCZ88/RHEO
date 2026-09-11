const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\DeskFlow\\deskflow-data.db", { readonly: true });
console.log("=== user_preferences ===");
try {
  const rows = db.prepare("SELECT key, value FROM user_preferences").all();
  for (const r of rows) console.log(r.key, "=", r.value);
} catch (e) { console.log("no user_preferences:", e.message); }
console.log("\n=== daily totals (app + browser) last 12 days ===");
try {
  const rows = db.prepare(`SELECT date(timestamp) d, COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,2) hrs, SUM(CASE WHEN is_browser_tracking=1 THEN 1 ELSE 0 END) bn, ROUND(SUM(CASE WHEN is_browser_tracking=1 THEN duration_ms ELSE 0 END)/3600000.0,2) bhrs, ROUND(SUM(CASE WHEN is_browser_tracking=0 OR is_browser_tracking IS NULL THEN duration_ms ELSE 0 END)/3600000.0,2) ahrs FROM logs WHERE date(timestamp) >= date('now','-12 days') GROUP BY d ORDER BY d DESC`).all();
  for (const r of rows) console.log(r.d, "| entries:", r.n, "| totalHrs:", r.hrs, "| browserHrs:", r.bhrs, "| appHrs:", r.ahrs);
} catch (e) { console.log(e.message); }
db.close();
