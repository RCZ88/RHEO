const path = require('path');
const os = require('os');
const fs = require('fs');
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbCandidates = ['RHEO', 'DeskFlow', 'deskflow'].map((d) => path.join(appDataDir, d, 'deskflow-data.db'));
const dbFile = dbCandidates.find((p) => fs.existsSync(p)) || dbCandidates[0];
const db = require('better-sqlite3')(dbFile);

console.log('=== Test get-external-stats IPC Handler Logic ===\n');

// Simulate what the IPC handler does for period='week'
const period = 'week';
let dateFilter = '';
const now = new Date();
if (period === 'today') {
    const today = now.toISOString().split('T')[0];
    dateFilter = `AND date(es.started_at) = '${today}'`;
} else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dateFilter = `AND started_at >= '${weekAgo}'`;
} else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dateFilter = `AND started_at >= '${monthAgo}'`;
}

console.log('Date filter for week:', dateFilter);

// Test query
const query = `
  SELECT 
    ea.id as activity_id,
    ea.name,
    ea.color,
    ea.icon,
    SUM(es.duration_seconds) as total_seconds
  FROM external_sessions es
  JOIN external_activities ea ON es.activity_id = ea.id
  WHERE 1=1 ${dateFilter}
  GROUP BY ea.id
`;

console.log('\nQuery:', query);

try {
    const result = db.prepare(query).all();
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    const totalSeconds = result.reduce((sum, r) => sum + r.total_seconds, 0);
    console.log('\nTotal seconds:', totalSeconds);
    console.log('Total hours:', (totalSeconds / 3600).toFixed(2));
} catch (e) {
    console.error('Query error:', e.message);
}

db.close();
