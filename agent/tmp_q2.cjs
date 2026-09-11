const Database = require("better-sqlite3");
const db = new Database(process.env.APPDATA + "\\DeskFlow\\deskflow-data.db", { readonly: true });
console.log("=== all tables ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(tables.map(t=>t.name).join(", "));
console.log("\n=== logs row count + last entry ===");
console.log("count:", db.prepare("SELECT COUNT(*) c FROM logs").get().c);
try { const r = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 3").all(); console.log(r); } catch(e){ console.log(e.message); }
db.close();
