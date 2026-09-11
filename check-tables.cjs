const sqlite3 = require('sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbCandidates = ['RHEO', 'DeskFlow', 'deskflow'].map((d) => path.join(appDataDir, d, 'deskflow-data.db'));
const dbFile = dbCandidates.find((p) => fs.existsSync(p)) || dbCandidates[0];
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.each('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', (err, row) => {
    console.log('Table:', row.name);
  });
});