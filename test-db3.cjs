const path = require('path');
const os = require('os');
const fs = require('fs');
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbCandidates = ['RHEO', 'DeskFlow', 'deskflow'].map((d) => path.join(appDataDir, d, 'deskflow-data.db'));
const dbFile = dbCandidates.find((p) => fs.existsSync(p)) || dbCandidates[0];
const db = require('better-sqlite3')(dbFile);

console.log('=== Database Check ===');
console.log('Activities:', db.prepare('SELECT COUNT(*) as cnt FROM external_activities').get().cnt);
console.log('Sessions:', db.prepare('SELECT COUNT(*) as cnt FROM external_sessions').get().cnt);

// Check today
console.log('\n=== Today Data (using started_at) ===');
const today = db.prepare("SELECT COUNT(*) as cnt FROM external_sessions WHERE date(started_at) = date('now')").get();
console.log('Today sessions:', today.cnt);

// Check this week
console.log('\n=== This Week Data ===');
const week = db.prepare("SELECT COUNT(*) as cnt FROM external_sessions WHERE started_at >= date('now', 'weekday 0', '-7 days')").get();
console.log('Week sessions:', week.cnt);

// Show some sessions
console.log('\n=== Recent Sessions ===');
const sessions = db.prepare('SELECT id, activity_id, started_at, ended_at FROM external_sessions ORDER BY started_at DESC LIMIT 5').all();
sessions.forEach(s => console.log(`  ${s.id}: ${s.activity_id} | ${s.started_at} → ${s.ended_at || 'null'}`));

db.close();
