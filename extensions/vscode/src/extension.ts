import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { appendFile } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

function ingestPath(): string {
  return process.env.RHEO_INGEST_FILE ?? (
    platform() === 'win32' ? join(process.env.APPDATA ?? '', 'RHEO', 'changes.jsonl')
    : platform() === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'RHEO', 'changes.jsonl')
    : join(homedir(), '.config', 'RHEO', 'changes.jsonl'));
}
type Ev = Record<string, unknown>;
const last = new Map<string, string>();          // path -> last emitted hash (client-side dedupe)
let queue: Ev[] = [], timer: NodeJS.Timeout | undefined;

export function activate(ctx: vscode.ExtensionContext) {
  const FILE = ingestPath();
  const emit = (e: Ev) => {
    queue.push({ v: 1, timestamp: new Date().toISOString(), ...e });
    timer ??= setTimeout(flush, 2000);
    if (queue.length >= 20) flush();
  };
  const flush = () => {
    timer && clearTimeout(timer); timer = undefined;
    if (!queue.length) return;
    const payload = queue.splice(0).map(e => JSON.stringify(e)).join('\n') + '\n';
    appendFile(FILE, payload, { mode: 0o600 }, () => { /* next event retries; scan heals */ });
  };
  const rootOf = (p: string) =>
    vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p))?.uri.fsPath;

  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
    const root = rootOf(doc.uri.fsPath); if (!root) return;           // outside a workspace ⇒ skip
    const text = doc.getText();
    const sha = createHash('sha1').update(text, 'utf8').digest('hex');
    if (last.get(doc.uri.fsPath) === sha) return;                     // autosave echo
    last.set(doc.uri.fsPath, sha);
    emit({ type: 'save', source: 'vscode', projectPath: root, filePath: doc.uri.fsPath,
           contentSha1: sha, totalLines: text.split('\n').length, bytes: Buffer.byteLength(text) });
  }));
  const w = vscode.workspace.createFileSystemWatcher('**');
  w.onDidChange(u => { /* content events are covered by save; keep watcher for deletes: */ });
  w.onDidDelete(u => { const root = rootOf(u.fsPath);
    if (root) emit({ type: 'delete', source: 'vscode', projectPath: root, filePath: u.fsPath }); });
  ctx.subscriptions.push(w, { dispose: flush });
  emit({ type: 'hello', source: 'vscode', editor: 'vscode', version: '0.1.0' });
  setInterval(() => emit({ type: 'hello', source: 'vscode', editor: 'vscode', version: '0.1.0' }), 300_000);
}

export function deactivate() { /* flush handled by dispose */ }
