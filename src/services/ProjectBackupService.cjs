"use strict";
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

let archiver, globModule, extractZip;
function loadDeps() {
  if (!archiver) {
    try { archiver = require('archiver'); } catch { archiver = null; }
  }
  if (!globModule) {
    try { globModule = require('glob'); } catch { globModule = null; }
  }
  if (!extractZip) {
    try { extractZip = require('extract-zip'); } catch { extractZip = null; }
  }
}

/**
 * Resolve the glob entry point across the v7/v9+ API split.
 *
 * `glob` is NOT a declared dependency of this app — it only resolves
 * transitively, and the resolved major version decides the API:
 *   v7  → glob.sync(pattern, opts)
 *   v9+ → glob.globSync(pattern, opts)
 * The previous code hardcoded globSync, so on the v7 that actually resolves
 * here it threw "g.globSync is not a function". That throw was swallowed by
 * createProjectBackup's catch, which returned {success:false} — so the Backups
 * tab silently found ZERO files and never reported why.
 */
function globSyncCompat(pattern, opts) {
  if (!globModule) throw new Error('glob module is not available');
  if (typeof globModule.globSync === 'function') return globModule.globSync(pattern, opts);
  if (typeof globModule.sync === 'function') return globModule.sync(pattern, opts);
  throw new Error('glob exposes neither globSync nor sync');
}

const BACKUPS_DIR = path.join(app.getPath('userData'), 'project-backups');
const BACKUP_DB_FILE = path.join(BACKUPS_DIR, 'backups.json');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function loadManifest() {
  ensureBackupsDir();
  try {
    if (fs.existsSync(BACKUP_DB_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_DB_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveManifest(manifest) {
  ensureBackupsDir();
  fs.writeFileSync(BACKUP_DB_FILE, JSON.stringify(manifest, null, 2));
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function getBackupPath(id) {
  return path.join(BACKUPS_DIR, `${id}.zip`);
}

function getProjectFiles(projectPath) {
  if (!projectPath || !fs.existsSync(projectPath)) return [];
  const ignorePatterns = [
    '**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**',
    '**/build/**', '**/target/**', '**/__pycache__/**', '**/.cache/**',
    '**/*.zip', '**/*.tar.gz', '**/.env', '**/.env.local',
    '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml',
  ];
  return globSyncCompat('**/*', {
    cwd: projectPath,
    nodir: true,
    dot: true,
    ignore: ignorePatterns,
    absolute: true,
  }) || [];
}

function registerProjectBackupIPC(db) {
  const { ipcMain } = require('electron');

  ipcMain.handle('projectBackup:create', async (_event, projectId, projectPath, label, extra) => {
    return createProjectBackup(projectId, projectPath, label, extra);
  });

  ipcMain.handle('projectBackup:list', async (_event, projectId) => {
    try {
      const manifest = loadManifest();
      const filtered = projectId ? manifest.filter(e => e.projectId === projectId) : manifest;
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { success: true, data: filtered };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });

  ipcMain.handle('projectBackup:get', async (_event, backupId) => {
    try {
      const manifest = loadManifest();
      const entry = manifest.find(e => e.id === backupId);
      if (!entry) return { success: false, error: 'Backup not found' };
      return { success: true, data: entry };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('projectBackup:delete', async (_event, backupId, projectId) => {
    try {
      let manifest = loadManifest();
      const index = manifest.findIndex(e => e.id === backupId);
      if (index === -1) return { success: false, error: 'Backup not found' };
      const entry = manifest[index];
      if (entry.projectId !== projectId) return { success: false, error: 'Backup does not belong to project' };
      const zipPath = getBackupPath(backupId);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      manifest.splice(index, 1);
      saveManifest(manifest);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('projectBackup:restore', async (_event, projectId, backupId) => {
    try {
      loadDeps();
      if (!extractZip) return { success: false, error: 'extract-zip package not installed' };

      const manifest = loadManifest();
      const entry = manifest.find(e => e.id === backupId);
      if (!entry) return { success: false, error: 'Backup not found' };
      if (entry.projectId !== projectId) return { success: false, error: 'Backup does not belong to project' };

      const zipPath = getBackupPath(backupId);
      if (!fs.existsSync(zipPath)) return { success: false, error: 'Backup zip file not found' };

      // Look up project path from DB
      let projectPath = '';
      if (db) {
        const row = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId);
        if (row) projectPath = row.path;
      }
      if (!projectPath) return { success: false, error: 'Project path not found' };

      await extractZip(zipPath, { dir: projectPath });
      return { success: true, data: { restoredCount: entry.fileCount } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('projectBackup:diff', async (_event, projectId, backupId) => {
    try {
      const manifest = loadManifest();
      const entry = manifest.find(e => e.id === backupId);
      if (!entry) return { success: false, error: 'Backup not found' };
      if (entry.projectId !== projectId) return { success: false, error: 'Backup does not belong to project' };

      const zipPath = getBackupPath(backupId);
      if (!fs.existsSync(zipPath)) return { success: false, error: 'Backup zip file not found' };

      // Look up project path from DB
      let projectPath = '';
      if (db) {
        const row = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId);
        if (row) projectPath = row.path;
      }
      if (!projectPath) return { success: false, error: 'Project path not found' };

      loadDeps();
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      const zipFiles = new Set(zipEntries.map(e => e.entryName).filter(e => !e.startsWith('__MACOSX')));

      const currentFiles = getProjectFiles(projectPath);
      const currentRel = new Set(currentFiles.map(f => path.relative(projectPath, f).replace(/\\/g, '/')));

      const added = [];
      const deleted = [];
      const modified = [];
      const unchanged = [];

      for (const relPath of currentRel) {
        if (!zipFiles.has(relPath)) {
          added.push(relPath);
        }
      }

      for (const relPath of zipFiles) {
        if (!currentRel.has(relPath)) {
          deleted.push(relPath);
        }
      }

      for (const relPath of currentRel) {
        if (zipFiles.has(relPath)) {
          const currentAbs = path.join(projectPath, relPath);
          try {
            const currentContent = fs.readFileSync(currentAbs, 'utf-8');
            const zipEntry = zip.getEntry(relPath);
            if (zipEntry) {
              const zipContent = zipEntry.getData().toString('utf-8');
              if (currentContent !== zipContent) {
                modified.push(relPath);
              } else {
                unchanged.push(relPath);
              }
            } else {
              modified.push(relPath);
            }
          } catch {
            modified.push(relPath);
          }
        }
      }

      return {
        success: true,
        data: { added, deleted, modified, unchanged, totalChanged: added.length + modified.length + deleted.length },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('projectBackup:schedule', async (_event, projectId, minutes, projectPath) => {
    return setProjectSchedule(projectId, minutes, projectPath);
  });

  ipcMain.handle('projectBackup:getSchedules', async () => {
    return { success: true, data: getSchedules() };
  });
}

const SCHEDULE_DB_FILE = path.join(BACKUPS_DIR, 'schedules.json');
const schedules = new Map();

function loadSchedules() {
  try {
    if (fs.existsSync(SCHEDULE_DB_FILE)) {
      const rows = JSON.parse(fs.readFileSync(SCHEDULE_DB_FILE, 'utf-8'));
      for (const r of rows) schedules.set(r.projectId, r);
    }
  } catch {}
}

function saveSchedules() {
  ensureBackupsDir();
  const rows = [...schedules.values()].map(({ timer, ...r }) => r);
  fs.writeFileSync(SCHEDULE_DB_FILE, JSON.stringify(rows, null, 2));
}

function getSchedules() {
  return [...schedules.values()];
}

function setProjectSchedule(projectId, minutes, projectPath) {
  try {
    minutes = Math.floor(Number(minutes) || 0);
    if (!projectId || minutes <= 0) {
      const existing = schedules.get(projectId);
      if (existing && existing.timer) clearInterval(existing.timer);
      schedules.delete(projectId);
      saveSchedules();
      return { success: true, data: { projectId, minutes: 0, enabled: false } };
    }
    minutes = Math.max(5, minutes);
    const existing = schedules.get(projectId);
    if (existing && existing.timer) clearInterval(existing.timer);

    const entry = {
      projectId,
      minutes,
      projectPath: projectPath || (existing && existing.projectPath) || '',
      enabled: true,
      lastRunAt: (existing && existing.lastRunAt) || null,
    };
    entry.timer = setInterval(() => {
      const cur = schedules.get(projectId);
      if (!cur || !cur.enabled) return;
      createProjectBackup(projectId, cur.projectPath, `Auto (every ${cur.minutes}m)`, { autoBackup: true })
        .then((res) => {
          if (res.success) {
            cur.lastRunAt = new Date().toISOString();
            saveSchedules();
          } else {
            console.error(`[ProjectBackup] schedule ${projectId} failed:`, res.error);
          }
        });
    }, minutes * 60 * 1000);
    entry.timer.unref();
    schedules.set(projectId, entry);
    saveSchedules();
    return { success: true, data: { projectId, minutes, enabled: true } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function createProjectBackup(projectId, projectPath, label, extra) {
  return new Promise((resolve) => {
  try {
    loadDeps();
    if (!archiver) {
      return resolve({ success: false, error: 'archiver package not installed — cannot create a backup zip' });
    }
    if (!projectPath || !fs.existsSync(projectPath)) {
      return resolve({ success: false, error: `project path not found: ${projectPath}` });
    }

    // Enumerate BEFORE opening the archive so a discovery failure is reported
    // with its reason instead of silently producing an empty backup.
    let files;
    try {
      files = getProjectFiles(projectPath);
    } catch (e) {
      return resolve({ success: false, error: `could not read project files: ${e && e.message ? e.message : e}` });
    }
    if (files.length === 0) {
      return resolve({
        success: false,
        error: `no files found under ${projectPath} — nothing to back up`,
      });
    }

    const id = generateId();
    const timestamp = new Date().toISOString();
    const manifest = loadManifest();
    const zipPath = getBackupPath(id);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      try {
        const stats = fs.statSync(zipPath);
        const entry = {
          id,
          projectId,
          label: label || `Backup ${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`,
          timestamp,
          fileCount: files.length,
          totalSize: stats.size,
          compressionRatio: stats.length > 0 && files.length > 0 ? stats.size / (files.length * 4096) : 0,
          autoBackup: !!(extra && extra.autoBackup),
          trigger: (extra && extra.trigger) || 'manual',
        };
        manifest.push(entry);
        saveManifest(manifest);
        resolve({ success: true, data: entry });
      } catch (e) {
        resolve({ success: false, error: `finalising backup manifest failed: ${e && e.message ? e.message : e}` });
      }
    });
    archive.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    archive.pipe(output);
    // `files` was already enumerated above — do not re-glob here.
    for (const f of files) {
      archive.file(f, { name: path.relative(projectPath, f) });
    }
    archive.finalize();
  } catch (err) {
    resolve({ success: false, error: String(err) });
  }
  });
}

module.exports = { registerProjectBackupIPC, createProjectBackup, getSchedules, setProjectSchedule };

loadSchedules();
for (const s of schedules.values()) {
  if (s.enabled && s.projectPath) {
    const minutes = s.minutes;
    const projectId = s.projectId;
    s.timer = setInterval(() => {
      const cur = schedules.get(projectId);
      if (!cur || !cur.enabled) return;
      createProjectBackup(projectId, cur.projectPath, `Auto (every ${cur.minutes}m)`, { autoBackup: true })
        .then((res) => {
          if (res.success) {
            cur.lastRunAt = new Date().toISOString();
            saveSchedules();
          } else {
            console.error(`[ProjectBackup] schedule ${projectId} failed:`, res.error);
          }
        });
    }, minutes * 60 * 1000);
    s.timer.unref();
  }
}
