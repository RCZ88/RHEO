const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
console.log("=== ALL Aug 4 (today) logs ===");
db.prepare("SELECT timestamp, app, category, ROUND(duration_ms/1000,0) secs, is_browser_tracking, domain FROM logs WHERE date(timestamp)='2026-08-04' ORDER BY timestamp").all().forEach(r=>console.log(`${r.timestamp}  ${r.app}  ${r.category}  ${r.secs}s  browser=${r.is_browser_tracking}  domain=${r.domain??''}`));
console.log("\n=== last 5 logs overall ===");
db.prepare("SELECT timestamp, app, category, ROUND(duration_ms/1000,0) secs, is_browser_tracking FROM logs ORDER BY timestamp DESC LIMIT 5").all().forEach(r=>console.log(`${r.timestamp}  ${r.app}  ${r.secs}s  browser=${r.is_browser_tracking}`));
console.log("\n=== distinct apps today ===");
db.prepare("SELECT app, COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,3) hrs FROM logs WHERE date(timestamp)='2026-08-04' GROUP BY app").all().forEach(r=>console.log(`${r.app}: ${r.n} entries, ${r.hrs}h`));
db.close();
