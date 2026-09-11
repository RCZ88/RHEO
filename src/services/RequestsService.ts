import * as fs from 'fs';
import * as path from 'path';
import { repairMojibakeDeep } from '../lib/mojibake';

export interface CheckFeedback {
  type: 'approved' | 'rejected' | 'text';
  value?: string;
  timestamp: string;
  session_id?: string;
  terminal_id?: string;
}

export interface CheckItem {
  id: string;
  description: string;
  instruction: string;
  status: 'pending' | 'in_progress' | 'completed';
  feedback?: CheckFeedback;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  linked_problems: string[];
  session_id: string | null;
  session_name: string | null;
  checks: CheckItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateRequestData {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  sessionId?: string;
  sessionName?: string;
}

export class RequestsService {
  private baseDir: string;
  private jsonFile: string;
  private mdFile: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || this.getDefaultBaseDir();
    this.jsonFile = path.join(this.baseDir, 'agent', 'requests.json');
    this.mdFile = path.join(this.baseDir, 'agent', 'REQUESTS.md');
  }

  private getDefaultBaseDir(): string {
    return path.join(process.cwd());
  }

  private ensureAgentDir(): void {
    const agentDir = path.join(this.baseDir, 'agent');
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
  }

  private migrateFromMd(): Request[] {
    const mdPath = this.mdFile;
    if (!fs.existsSync(mdPath)) return [];

    try {
      const content = fs.readFileSync(mdPath, 'utf-8');
      const requests = this.parseRequestsLegacy(content);
      if (requests.length > 0) {
        fs.writeFileSync(this.jsonFile, JSON.stringify(requests, null, 2), 'utf-8');
        console.log(`[RequestsService] Migrated ${requests.length} requests from markdown to JSON`);
      }
      return requests;
    } catch (e) {
      console.error('[RequestsService] Migration failed:', e);
      return [];
    }
  }

  private writeJson(requests: Request[]): void {
    this.ensureAgentDir();
    fs.writeFileSync(this.jsonFile, JSON.stringify(requests, null, 2), 'utf-8');
  }

  private writeMarkdown(requests: Request[]): void {
    this.ensureAgentDir();
    let md = '# 📋 User Requests Log\n\n';
    md += '> **DO NOT EDIT MANUALLY** - This file is managed by Tracker Mind.\n\n';
    md += '> Last sync: ' + new Date().toISOString() + '\n\n';
    md += '## 📝 How to Use This File\n\n';
    md += '### Adding New Requests:\n';
    md += '```markdown\n';
    md += '### Request #XXX - [Short Title]\n\n';
    md += '**Status:** Pending\n';
    md += '**Priority:** High\n';
    md += '**Category:** Feature\n\n';
    md += '**Request:** \n';
    md += '"What the user asked for"\n';
    md += '```\n\n';
    md += '---\n\n';

    for (const req of requests) {
      md += `### Request #${req.id} - ${req.title}\n\n`;
      md += `**Status:** ${req.status}\n`;
      md += `**Priority:** ${req.priority}\n`;
      md += `**Category:** ${req.category}\n`;
      md += `**Created:** ${req.created_at}\n`;
      md += `**Updated:** ${req.updated_at}\n`;
      if (req.session_id && req.session_name) {
        md += `**Session:** ${req.session_name} (${req.session_id})\n`;
      } else if (req.session_id) {
        md += `**Session:** ${req.session_id}\n`;
      }
      if (req.description) {
        md += `\n**Request:** \n${req.description}\n`;
      }
      if (req.linked_problems.length > 0) {
        md += `\n**Linked Issues:** ${req.linked_problems.map(p => `#${p}`).join(', ')}\n`;
      }
      md += '\n---\n\n';
    }

    fs.writeFileSync(this.mdFile, md, 'utf-8');
  }

  private repairJsonInPlace(requests: Request[]): Request[] {
    try {
      const repaired = repairMojibakeDeep(requests) as Request[];
      const before = JSON.stringify(requests);
      const after = JSON.stringify(repaired);
      if (before !== after && fs.existsSync(this.jsonFile)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const bak = `${this.jsonFile}.bak-${stamp}`;
        fs.copyFileSync(this.jsonFile, bak);
        fs.writeFileSync(this.jsonFile, after, 'utf-8');
        console.log(`[RequestsService] Repaired mojibake in requests.json (backup: ${bak})`);
      }
      return repaired;
    } catch (e) {
      console.error('[RequestsService] mojibake repair failed:', e);
      return requests;
    }
  }

  getRequests(): Request[] {
    this.ensureAgentDir();

    if (fs.existsSync(this.jsonFile)) {
      try {
        const content = fs.readFileSync(this.jsonFile, 'utf-8');
        const requests = JSON.parse(content);
        if (Array.isArray(requests) && requests.length > 0) {
          return this.repairJsonInPlace(requests).map(r => ({
            ...r,
            session_id: r.session_id || null,
            session_name: r.session_name || null,
          }));
        }
        if (Array.isArray(requests) && requests.length === 0) {
          const migrated = this.migrateFromMd();
          if (migrated.length > 0) return migrated;
        }
      } catch (e) {
        console.error('[RequestsService] Failed to parse requests.json:', e);
      }
    }

    const migrated = this.migrateFromMd();
    if (migrated.length > 0) return migrated;

    const empty: Request[] = [];
    this.writeJson(empty);
    this.writeMarkdown(empty);
    return empty;
  }

  getRequest(id: string): Request | null {
    const requests = this.getRequests();
    return requests.find(r => r.id === id) || null;
  }

  addCheck(requestId: string, description: string, instruction: string): CheckItem | null {
    const requests = this.getRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return null;
    const checks = requests[idx].checks || [];
    const checkNum = checks.length + 1;
    const now = new Date().toISOString();
    const check: CheckItem = {
      id: `${requestId}-check-${checkNum}`,
      description,
      instruction,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    checks.push(check);
    requests[idx].checks = checks;
    requests[idx].updated_at = now;
    this.writeJson(requests);
    this.writeMarkdown(requests);
    return check;
  }

  updateCheck(requestId: string, checkId: string, updates: Partial<Pick<CheckItem, 'status' | 'description' | 'instruction'>>): boolean {
    const requests = this.getRequests();
    const rIdx = requests.findIndex(r => r.id === requestId);
    if (rIdx === -1) return false;
    const checks = requests[rIdx].checks || [];
    const cIdx = checks.findIndex(c => c.id === checkId);
    if (cIdx === -1) return false;
    checks[cIdx] = { ...checks[cIdx], ...updates, updated_at: new Date().toISOString() };
    requests[rIdx].checks = checks;
    requests[rIdx].updated_at = new Date().toISOString();
    this.writeJson(requests);
    this.writeMarkdown(requests);
    return true;
  }

  completeCheck(requestId: string, checkId: string): boolean {
    return this.updateCheck(requestId, checkId, { status: 'completed' });
  }

  addCheckFeedback(requestId: string, checkId: string, feedback: CheckFeedback): CheckItem | null {
    const requests = this.getRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request?.checks) return null;

    const check = request.checks.find(c => c.id === checkId);
    if (!check) return null;

    check.feedback = feedback;
    check.updated_at = new Date().toISOString();

    this.writeJson(requests);
    this.writeMarkdown(requests);
    return check;
  }

  createRequest(data: CreateRequestData): Request {
    this.ensureAgentDir();

    const requests = this.getRequests();
    const maxId = requests.reduce((max, r) => Math.max(max, parseInt(r.id) || 0), 0);
    const id = String(maxId + 1);

    const now = new Date().toISOString();
    const request: Request = {
      id,
      title: data.title,
      description: data.description || '',
      status: 'Pending',
      priority: data.priority || 'Medium',
      category: data.category || 'Feature',
      linked_problems: [],
      session_id: data.sessionId || null,
      session_name: data.sessionName || null,
      checks: [],
      created_at: now,
      updated_at: now
    };

    requests.push(request);
    this.writeJson(requests);
    this.writeMarkdown(requests);

    return request;
  }

  updateStatus(id: string, status: string): boolean {
    const requests = this.getRequests();
    const idx = requests.findIndex(r => r.id === id);

    if (idx === -1) return false;

    requests[idx].status = status;
    requests[idx].updated_at = new Date().toISOString();
    this.writeJson(requests);
    this.writeMarkdown(requests);

    return true;
  }

  linkProblem(requestId: string, problemId: string): boolean {
    const requests = this.getRequests();
    const idx = requests.findIndex(r => r.id === requestId);

    if (idx === -1) return false;

    if (!requests[idx].linked_problems.includes(problemId)) {
      requests[idx].linked_problems.push(problemId);
      requests[idx].updated_at = new Date().toISOString();
      this.writeJson(requests);
      this.writeMarkdown(requests);
    }

    return true;
  }

  unlinkProblem(requestId: string, problemId: string): boolean {
    const requests = this.getRequests();
    const idx = requests.findIndex(r => r.id === requestId);

    if (idx === -1) return false;

    const before = requests[idx].linked_problems.length;
    requests[idx].linked_problems = requests[idx].linked_problems.filter(p => p !== problemId);
    if (requests[idx].linked_problems.length < before) {
      requests[idx].updated_at = new Date().toISOString();
      this.writeJson(requests);
      this.writeMarkdown(requests);
    }
    return true;
  }

  deleteRequest(id: string): boolean {
    const requests = this.getRequests();
    const filtered = requests.filter(r => r.id !== id);

    if (filtered.length === requests.length) return false;

    this.writeJson(filtered);
    this.writeMarkdown(filtered);
    return true;
  }

  parseRequestsLegacy(content: string): Request[] {
    const requests: Request[] = [];
    content = content.replace(/\r\n/g, '\n');

    const pattern1 = /### Request #(\d+)\s*-\s*(.+?)\n([\s\S]*?)(?=### Request #|\n## |\n---\n$|$)/gi;
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      const body = match[3] || '';

      const statusMatch = body.match(/\*\*Status:\*\*\s*(.+?)(?:\n|$)/i);
      const priorityMatch = body.match(/\*\*Priority:\*\*\s*(.+?)(?:\n|$)/i);
      const categoryMatch = body.match(/\*\*Category:\*\*\s*(.+?)(?:\n|$)/i);
      const descMatch = body.match(/\*\*(?:Request|What's Needed):\*\*\s*\n(.+?)(?=\*\*|$)/is);

      requests.push({
        id,
        title,
        description: descMatch?.[1]?.trim() || '',
        status: statusMatch?.[1]?.trim() || 'Pending',
        priority: priorityMatch?.[1]?.trim() || 'Medium',
        category: categoryMatch?.[1]?.trim() || 'Feature',
        linked_problems: [],
        session_id: null,
        session_name: null,
        checks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return requests;
  }
}
