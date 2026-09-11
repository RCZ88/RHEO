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

// Check columns
console.log('\n=== Sessions Table Columns ===');
const cols = db.prepare('PRAGMA table_info(external_sessions)').all();
console.log(cols.map(c => c.name).join(', '));

// Check today
console.log('\n=== Today Data ===');
const today = db.prepare("SELECT COUNT(*) as cnt FROM external_sessions WHERE date(startTime) = date('now')").get();
console.log('Today sessions:', today.cnt);

// Check this week
console.log('\n=== This Week Data ===');
const week = db.prepare("SELECT COUNT(*) as cnt FROM external_sessions WHERE startTime >= date('now', 'weekday 0', '-7 days')").get();
console.log('Week sessions:', week.cnt);

// Show some sessions
console.log('\n=== Recent Sessions ===');
const sessions = db.prepare('SELECT id, activityId, startTime, endTime FROM external_sessions ORDER BY startTime DESC LIMIT 5').all();
sessions.forEach(s => console.log(`  ${s.id}: ${s.activityId} | ${s.startTime} → ${s.endTime || 'null'}`));

db.close();
