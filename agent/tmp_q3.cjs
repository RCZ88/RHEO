const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\DeskFlow\\deskflow-data.db", { readonly: true });
console.log("=== stats_hourly last 5 ===");
try { console.log(db.prepare("SELECT * FROM stats_hourly ORDER BY day DESC, hour DESC LIMIT 5").all()); } catch(e){ console.log(e.message); }
console.log("=== daily_rollup last 5 ===");
try { console.log(db.prepare("SELECT * FROM daily_rollup ORDER BY date DESC LIMIT 5").all()); } catch(e){ console.log(e.message); }
console.log("=== app_totals recent ===");
try { console.log(db.prepare("SELECT * FROM app_totals ORDER BY id DESC LIMIT 5").all()); } catch(e){ console.log(e.message); }
console.log("=== logs Aug 1-4 summary ===");
try { console.log(db.prepare("SELECT date(timestamp) d, COUNT(*) n, ROUND(SUM(duration_ms)/3600000.0,2) hrs FROM logs WHERE date(timestamp)>='2026-08-01' GROUP BY d ORDER BY d").all()); } catch(e){ console.log(e.message); }
db.close();
