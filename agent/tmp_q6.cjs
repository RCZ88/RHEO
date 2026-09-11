const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\RHEO\\deskflow-data.db", { readonly: true });
console.log("=== Aug 3 raw logs total ===");
console.log(db.prepare("SELECT ROUND(SUM(duration_ms)/3600000.0,2) hrs, COUNT(*) n FROM logs WHERE date(timestamp)='2026-08-03'").all());
console.log("\n=== Aug 3 stats_daily total ===");
try { console.log(db.prepare("SELECT ROUND(SUM(total_seconds)/3600.0,2) hrs, COUNT(*) n FROM stats_daily WHERE date='2026-08-03'").all()); } catch(e){ console.log(e.message); }
console.log("\n=== Aug 3 stats_daily by type ===");
try { console.log(db.prepare("SELECT app_type, ROUND(SUM(total_seconds)/3600.0,2) hrs, COUNT(*) n FROM stats_daily WHERE date='2026-08-03' GROUP BY app_type").all()); } catch(e){ console.log(e.message); }
console.log("\n=== Aug 3 daily_aggregates total ===");
try { console.log(db.prepare("SELECT ROUND(SUM(total_sec)/3600.0,2) hrs, COUNT(*) n FROM daily_aggregates WHERE date='2026-08-03'").all()); } catch(e){ console.log(e.message); }
console.log("\n=== Aug 3 browser_sessions total ===");
try { console.log(db.prepare("SELECT ROUND(SUM(total_sec)/3600.0,2) hrs, COUNT(*) n FROM browser_sessions WHERE date='2026-08-03'").all()); } catch(e){ console.log(e.message); }
console.log("\n=== Aug 3 app_totals ===");
try { console.log(db.prepare("SELECT * FROM app_totals WHERE date='2026-08-03'").all()); } catch(e){ console.log(e.message); }
console.log("\n=== Aug 3 daily_stats total ===");
try { console.log(db.prepare("SELECT ROUND(SUM(total_sec)/3600.0,2) hrs, COUNT(*) n FROM daily_stats WHERE date='2026-08-03'").all()); } catch(e){ console.log(e.message); }
console.log("\n=== stats_daily schema ===");
try { console.log(db.prepare("PRAGMA table_info(stats_daily)").all()); } catch(e){ console.log(e.message); }
db.close();
