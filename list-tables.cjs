const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbCandidates = ['RHEO', 'DeskFlow', 'deskflow'].map((d) => path.join(appDataDir, d, 'deskflow-data.db'));
const dbFile = dbCandidates.find((p) => fs.existsSync(p)) || dbCandidates[0];
const db = new Database(dbFile, { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

const logCount = db.prepare('SELECT COUNT(*) as count FROM logs').get();
console.log('Total logs:', logCount.count);

db.close();