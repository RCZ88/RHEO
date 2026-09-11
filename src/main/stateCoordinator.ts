import { promises as fs, watch, FSWatcher } from 'fs';
import path from 'path';

interface SpokeSummary {
  sessionId: string;
  agentType: string;
  terminalId: string;
  currentCycle: number;
  status: string;
  currentFocus: string;
  lastSeen: string;
  updatedAt: string;
}

export class StateCoordinator {
  private stateDir: string;
  private hubPath: string;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(agentDir: string = 'agent') {
    this.stateDir = path.join(agentDir, 'state');
    this.hubPath = path.join(agentDir, 'state.md');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await this.cleanupTmpFiles();
    await this.regenerateHub();
    this.startWatching();
  }

  // Crash recovery: remove leftover state.md.tmp.* files from interrupted atomic writes.
  private async cleanupTmpFiles(): Promise<void> {
    try {
      const dir = path.dirname(this.hubPath);
      const base = path.basename(this.hubPath);
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.startsWith(base) && entry.includes('.tmp.')) {
          await fs.unlink(path.join(dir, entry)).catch(() => {});
        }
      }
    } catch {}
  }

  private startWatching(): void {
    try {
      this.watcher = watch(this.stateDir, (eventType, filename) => {
        if (!filename || filename.startsWith('_') || !filename.endsWith('.md')) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.regenerateHub(), 500);
      });
    } catch {}
  }

  async regenerateHub(): Promise<void> {
    try {
      const files = await fs.readdir(this.stateDir);
      const spokeFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('_'));
      const summaries: SpokeSummary[] = [];

      for (const file of spokeFiles) {
        try {
          const content = await fs.readFile(path.join(this.stateDir, file), 'utf-8');
          const summary = this.parseSpoke(content, file);
          if (summary) summaries.push(summary);
        } catch {}
      }

      const hubContent = this.generateHubContent(summaries);
      await this.writeFileAtomic(this.hubPath, hubContent);
    } catch {}
  }

  private parseSpoke(content: string, filename: string = ''): SpokeSummary | null {
    // Session ID: HTML comment marker, else the "# Agent State — <id>" heading, else the filename stem.
    let sessionId = (content.match(/<!-- SESSION: (.+) -->/) || [])[1]?.trim();
    if (!sessionId) sessionId = (content.match(/^# Agent State[\s\u2014-]+\s*(.+?)\s*$/m) || [])[1]?.trim();
    if (!sessionId) sessionId = filename.replace(/\.md$/i, '').trim();

    // Agent type + terminal id: HTML comment marker, else derived from the session ID ({agentType}-{terminalId}-{entropy}).
    let agentType = (content.match(/<!-- AGENT: (.+?) \|/) || [])[1]?.trim();
    let terminalId = (content.match(/<!-- AGENT: .+ \| TERMINAL: (.+?) \|/) || [])[1]?.trim();
    if (!agentType && sessionId) {
      const parts = sessionId.split('-');
      agentType = parts[0] || 'unknown';
      terminalId = parts.length > 2 ? parts.slice(1, -1).join('-') : (parts[1] || 'unknown');
    }

    // Parse only the CURRENT CYCLE block (the top "> **STATUS:**" line carries the status word too).
    const cycleSection = content.match(/## CURRENT CYCLE \((\d+)\)([\s\S]*?)(?=\n## |\s*$)/);
    if (!sessionId || !cycleSection) return null;

    const cycleNum = parseInt(cycleSection[1]);
    const roleLine = cycleSection[2].match(/\*\*ROLE:\*\* (.+)/);
    const statusLine = cycleSection[2].match(/\*\*STATUS:\*\* (.+)/);
    const updatedMatch = content.match(/\*\*UPDATED:\*\* (.+)/);

    const updatedAt = updatedMatch ? updatedMatch[1].trim() : new Date().toISOString();
    const date = new Date(updatedAt);
    const lastSeen = isNaN(date.getTime())
      ? 'unknown'
      : date.toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

    // Status: first word of the current-cycle STATUS line, mapped to the canonical set.
    const statusWord = ((statusLine ? statusLine[1] : '') || 'active').split(/\s|\(|\|/)[0].toLowerCase();
    let status = ['working', 'idle', 'error', 'completed', 'active', 'paused', 'unknown'].includes(statusWord)
      ? statusWord
      : 'active';
    const ageHours = isNaN(date.getTime()) ? Infinity : (Date.now() - date.getTime()) / 3600000;
    if (ageHours > 24 && status !== 'completed' && status !== 'error') status += '·stale';

    let focus = roleLine ? roleLine[1].trim() : 'Unknown';
    if (focus.length > 90) focus = focus.slice(0, 90) + '…';

    return {
      sessionId,
      agentType: agentType || 'unknown',
      terminalId: terminalId || 'unknown',
      currentCycle: cycleNum,
      status,
      currentFocus: focus,
      lastSeen,
      updatedAt,
    };
  }

  private generateHubContent(summaries: SpokeSummary[]): string {
    const now = new Date().toISOString();
    const sorted = [...summaries].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));

    const rows = sorted.map(s =>
      `| ${s.agentType} | ${s.sessionId} | ${s.currentCycle} | ${s.status} | ${s.currentFocus} | ${s.lastSeen} |`
    ).join('\n');

    const events = sorted.map(s =>
      `- \`[${s.lastSeen}]\` ${s.sessionId} (${s.agentType}) → ${s.status}: ${s.currentFocus}`
    ).slice(0, 10).join('\n');

    return `# DeskFlow — Multi-Agent State Hub  (v2.0)

> **SYSTEM:** Multi-agent state v2.0 | **UPDATED:** ${now} | **GENERATED BY:** main-process

---

## ACTIVE SESSIONS (${sorted.length})

| AGENT | SESSION | CYCLE | STATUS | FOCUS | LAST SEEN |
|-------|---------|-------|--------|-------|-----------|
${rows || '| (none) | — | — | — | — | — |'}

---

## RECENT EVENTS (last 10)
${events || '- (no events yet)'}

---

## PROTOCOL — READ CAREFULLY

**The Hub is READ-ONLY.** The main process regenerates it from the spoke files in
\`agent/state/\`. NEVER edit this file — any manual edit is wiped on the next regeneration.

1. **FIND YOUR SPOKE** — \`agent/state/<YOUR_SESSION_ID>.md\`:
   - If the env var \`DESKFLOW_SESSION_ID\` is set, use it as your session ID.
   - Otherwise your session ID is \`{agentType}-{terminalId.slice(0,6)}-{entropy}\` — locate
     the row in ACTIVE SESSIONS whose SESSION column starts with your agent type + terminal.
   - If no spoke exists for your session yet, create one by copying \`agent/state/_template.md\`.
2. **READ your own spoke** first — it holds your full history (current + 2 previous cycles).
   Recover cycle #, role, and in-flight work. NEVER ask CZ for status you can read here.
3. **WRITE ONLY your own spoke** at cycle end — overwrite it completely (never append),
   bump the cycle number, demote the old CURRENT CYCLE into HISTORY (keep 3 cycles max),
   refresh \`**ROLE:**\` / \`**STATUS:**\` / \`**UPDATED:**\` and IN FLIGHT / NEXT ACTION.
   Keep the \`<!-- SESSION: -->\` and \`## CURRENT CYCLE (n)\` lines intact — the Hub parser needs them.
4. **NEVER touch another session's spoke.** No two agents write the same file. Context stays
   uncluttered because your spoke is the ONLY state file in your prompt (the hub is small).
5. **CROSS-AGENT awareness:** the ACTIVE SESSIONS table (this file) is the lightweight view
   of what every session is doing right now. Read another agent's spoke only when you need
   details (each spoke ≈ 300 tokens — read on demand, not by default).
6. **FORMAT:** Follow \`agent/state/_template.md\` exactly.
`;
  }

  private async writeFileAtomic(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  dispose(): void {
    if (this.watcher) { this.watcher.close(); this.watcher = null; }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }
}
