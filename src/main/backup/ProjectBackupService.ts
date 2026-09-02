import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import archiver from 'archiver';
import extractZip from 'extract-zip';
import { glob } from 'glob';

export interface ProjectBackupManifest {
  id: string;
  projectId: string;
  label: string;
  timestamp: string;
  fileCount: number;
  totalSize: number;
  compressionRatio: number;
  autoBackup: boolean;
}

export interface ProjectBackupDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'target/**',
  'build/**',
  '__pycache__/**',
  '.next/**',
  '*.log',
  '.DS_Store',
  'backup/**',
  'project-backups/**',
];

function getBackupDir(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'backups', 'project-backups');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getManifestPath(projectId: string): string {
  return path.join(getBackupDir(), projectId, 'manifests.json');
}

function readManifests(projectId: string): ProjectBackupManifest[] {
  const manifestPath = getManifestPath(projectId);
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const data = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeManifests(projectId: string, manifests: ProjectBackupManifest[]): void {
  const manifestPath = getManifestPath(projectId);
  ensureDir(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify(manifests, null, 2));
}

function getTotalSize(filePaths: string[]): number {
  return filePaths.reduce((total, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return total + (stat.isFile() ? stat.size : 0);
    } catch {
      return total;
    }
  }, 0);
}

async function createZipArchive(sourceDir: string, outPath: string): Promise<{ fileCount: number; totalSize: number }> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    let fileCount = 0;
    let totalSize = 0;

    output.on('close', () => {
      resolve({ fileCount, totalSize });
    });

    archive.on('error', (err) => reject(err));
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') reject(err); });
    archive.on('entry', (entry) => {
      if (entry.stats && entry.stats.isFile()) {
        fileCount++;
        totalSize += entry.stats.size;
      }
    });

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: EXCLUDE_PATTERNS,
      dot: true,
    }, {});
    archive.finalize();
  });
}

export async function createProjectBackup(projectId: string, projectPath: string, label?: string): Promise<{ success: boolean; data?: { id: string; label: string; timestamp: string; fileCount: number }; error?: string }> {
  try {
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project path does not exist' };
    }

    const backupDir = getBackupDir();
    const projectBackupDir = path.join(backupDir, projectId);
    ensureDir(projectBackupDir);

    const timestamp = new Date().toISOString();
    const backupId = generateId();
    const safeLabel = (label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${backupId}_${safeLabel}.zip`;
    const zipPath = path.join(projectBackupDir, zipName);

    const { fileCount, totalSize } = await createZipArchive(projectPath, zipPath);
    const zipStat = fs.statSync(zipPath);
    const compressionRatio = totalSize > 0 ? zipStat.size / totalSize : 0;

    const manifest: ProjectBackupManifest = {
      id: backupId,
      projectId,
      label: label || 'Manual Backup',
      timestamp,
      fileCount,
      totalSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      autoBackup: false,
    };

    const manifests = readManifests(projectId);
    manifests.unshift(manifest);
    writeManifests(projectId, manifests);

    return {
      success: true,
      data: { id: backupId, label: manifest.label, timestamp, fileCount },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function listProjectBackups(projectId: string): Promise<{ success: boolean; data?: ProjectBackupManifest[]; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    return { success: true, data: manifests };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function restoreProjectBackup(projectId: string, backupId: string, projectPath: string): Promise<{ success: boolean; data?: { restoredCount: number }; error?: string }> {
  try {
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project path does not exist' };
    }

    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (!fs.existsSync(zipPath)) {
      return { success: false, error: 'Backup archive not found' };
    }

    const preRestoreDir = `${projectPath}.bak_${Date.now()}`;
    fs.cpSync(projectPath, preRestoreDir, { recursive: true, filter: (src) => !src.includes('node_modules') && !src.includes('.git') });

    await extractZip(zipPath, { dir: projectPath });

    const restoredFiles = await glob('**/*', { cwd: projectPath, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });

    return { success: true, data: { restoredCount: restoredFiles.length } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteProjectBackup(backupId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const updated = manifests.filter(m => m.id !== backupId);
    writeManifests(projectId, updated);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function diffProjectBackup(projectId: string, backupId: string, projectPath: string): Promise<{ success: boolean; data?: ProjectBackupDiff; error?: string }> {
  try {
    const manifests = readManifests(projectId);
    const manifest = manifests.find(m => m.id === backupId);
    if (!manifest) {
      return { success: false, error: 'Backup not found' };
    }

    const backupDir = path.join(getBackupDir(), projectId);
    const zipName = `${backupId}_${manifest.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const zipPath = path.join(backupDir, zipName);

    if (!fs.existsSync(zipPath)) {
      return { success: false, error: 'Backup archive not found' };
    }

    const tempDir = path.join(app.getPath('temp'), `df-diff-${backupId}`);
    ensureDir(tempDir);
    await extractZip(zipPath, { dir: tempDir });

    const currentFiles = await glob('**/*', { cwd: projectPath, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });
    const backupFiles = await glob('**/*', { cwd: tempDir, ignore: EXCLUDE_PATTERNS, dot: true, nodir: true });

    const currentSet = new Set(currentFiles);
    const backupSet = new Set(backupFiles);

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    for (const file of currentFiles) {
      if (!backupSet.has(file)) {
        added.push(file);
      } else {
        try {
          const currentStat = fs.statSync(path.join(projectPath, file));
          const backupStat = fs.statSync(path.join(tempDir, file));
          if (currentStat.mtime.getTime() !== backupStat.mtime.getTime() || currentStat.size !== backupStat.size) {
            modified.push(file);
          } else {
            unchanged.push(file);
          }
        } catch {
          modified.push(file);
        }
      }
    }

    for (const file of backupFiles) {
      if (!currentSet.has(file)) {
        deleted.push(file);
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });

    return { success: true, data: { added, modified, deleted, unchanged } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

let _db: any = null;

const schedulerMap = new Map<string, ReturnType<typeof setInterval>>();

export async function scheduleProjectBackup(projectId: string, projectPath: string, intervalMinutes: number): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = schedulerMap.get(projectId);
    if (existing) {
      clearInterval(existing);
      schedulerMap.delete(projectId);
    }

    if (intervalMinutes <= 0) {
      return { success: true };
    }

    const interval = setInterval(async () => {
      await createProjectBackup(projectId, projectPath, 'Auto Backup');
    }, intervalMinutes * 60 * 1000);
    interval.unref();
    schedulerMap.set(projectId, interval);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export function clearProjectBackupScheduler(projectId: string): void {
  const existing = schedulerMap.get(projectId);
  if (existing) {
    clearInterval(existing);
    existing.unref();
    schedulerMap.delete(projectId);
  }
}

export function registerProjectBackupIPC(database?: any): void {
  _db = database || _db;

  ipcMain.handle('projectBackup:create', async (_, projectId: string, projectPath: string, label?: string) => {
    return createProjectBackup(projectId, projectPath, label);
  });

  ipcMain.handle('projectBackup:list', async (_, projectId?: string) => {
    return listProjectBackups(projectId || '');
  });

  ipcMain.handle('projectBackup:get', async (_, backupId: string) => {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) return { success: false, error: 'No backups found' };
    const projectDirs = fs.readdirSync(backupDir).filter(d => fs.statSync(path.join(backupDir, d)).isDirectory());
    for (const pid of projectDirs) {
      const manifests = readManifests(pid);
      const found = manifests.find(m => m.id === backupId);
      if (found) return { success: true, data: found };
    }
    return { success: false, error: 'Backup not found' };
  });

  ipcMain.handle('projectBackup:delete', async (_, backupId: string, projectId: string) => {
    return deleteProjectBackup(backupId, projectId);
  });

  ipcMain.handle('projectBackup:restore', async (_, projectId: string, backupId: string) => {
    if (!_db) return { success: false, error: 'Database not initialized' };
    const project = _db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined;
    return restoreProjectBackup(projectId, backupId, project?.path || '');
  });

  ipcMain.handle('projectBackup:diff', async (_, projectId: string, backupId: string) => {
    if (!_db) return { success: false, error: 'Database not initialized' };
    const project = _db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined;
    return diffProjectBackup(projectId, backupId, project?.path || '');
  });

  ipcMain.handle('projectBackup:schedule', async (_, projectId: string, intervalMinutes: number, projectPath?: string) => {
    if (!projectPath && _db) {
      const project = _db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined;
      projectPath = project?.path;
    }
    if (!projectPath) return { success: false, error: 'Project path not found' };
    return scheduleProjectBackup(projectId, projectPath, intervalMinutes);
  });

  ipcMain.handle('projectBackup:getSchedules', async () => {
    return { success: true, data: Array.from(schedulerMap.keys()) };
  });
}
