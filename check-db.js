import Database from 'better-sqlite3';

import path from 'path';
import os from 'os';
import fs from 'fs';
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbCandidates = ['RHEO', 'DeskFlow', 'deskflow'].map((d) => path.join(appDataDir, d, 'deskflow-data.db'));
const dbPath = dbCandidates.find((p) => fs.existsSync(p)) || dbCandidates[0];

console.log('Opening:', dbPath);

const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

const logCount = db.prepare("SELECT COUNT(*) as count FROM logs").get();
console.log('Logs count:', logCount.count);

const recentLogs = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 5").all();
console.log('Recent logs:', JSON.stringify(recentLogs, null, 2));

db.close();