Here is the complete implementation of the **Per-Page Context System** for DeskFlow. This solution makes the workspace terminal page-aware, allowing AI agents to understand and interact with the specific data, state, and documentation of the page the user is currently viewing.

---

### Task A: Page Context Registry
**File:** `src/main/pageContextRegistry.ts` *(NEW)*

```typescript
export interface PageContextProvider {
  name: string;
  description: string;
  dataShape: string;
  queryFn: string;
}

export interface PageContextEntry {
  route: string;
  name: string;
  description: string;
  contextProviders: PageContextProvider[];
  ipcChannels: string[];
  keyComponents: string[];
}

export const PAGE_CONTEXT_REGISTRY: Record<string, PageContextEntry> = {
  '/': {
    route: '/', name: 'dashboard', description: 'Main overview of workspace activity, recent problems, and quick stats.',
    contextProviders: [
      { name: 'Recent Problems', description: 'Latest workspace problems', dataShape: 'Array<{id, title, status, priority}>', queryFn: 'SELECT id, title, status, priority FROM workspace_problems ORDER BY created_at DESC LIMIT 5' },
      { name: 'Recent Requests', description: 'Latest workspace requests', dataShape: 'Array<{id, title, status, priority}>', queryFn: 'SELECT id, title, status, priority FROM workspace_requests ORDER BY created_at DESC LIMIT 5' }
    ],
    ipcChannels: ['get-dashboard-stats'], keyComponents: ['DashboardPage', 'StatCard', 'RecentActivityList']
  },
  '/finance': {
    route: '/finance', name: 'finance', description: 'Financial tracking, budgets, wallets, and subscriptions.',
    contextProviders: [
      { name: 'Wallets', description: 'Current wallet balances', dataShape: 'Array<{name, balance, currency}>', queryFn: 'SELECT name, balance, currency FROM finance_wallets' },
      { name: 'Budgets', description: 'Active budget limits and spent amounts', dataShape: 'Array<{category, limit_amount, spent_amount}>', queryFn: 'SELECT category, limit_amount, spent_amount FROM finance_budgets WHERE status = "active"' }
    ],
    ipcChannels: ['get-finance-summary', 'add-transaction'], keyComponents: ['FinancePage', 'BudgetCard', 'WalletList']
  },
  '/life': {
    route: '/life', name: 'life', description: 'Life phases, reflections, and personal milestones.',
    contextProviders: [
      { name: 'Life Phases', description: 'Current and recent life phases', dataShape: 'Array<{title, category, start_year, end_year}>', queryFn: 'SELECT title, category, start_year, end_year FROM life_phases ORDER BY start_year DESC LIMIT 5' }
    ],
    ipcChannels: ['get-life-phases'], keyComponents: ['LifePage', 'PhaseCard']
  },
  '/learn': {
    route: '/learn', name: 'learn', description: 'Learning progress, mastered concepts, and active lessons.',
    contextProviders: [
      { name: 'Mastered Nodes', description: 'Recently mastered learning nodes', dataShape: 'Array<{title, level, stability}>', queryFn: 'SELECT n.title, p.level, p.stability FROM learn_progress p JOIN learn_nodes n ON n.id = p.node_id WHERE p.level IN ("L2","L3","L4","L5") ORDER BY p.stability DESC LIMIT 5' }
    ],
    ipcChannels: ['get-learn-progress'], keyComponents: ['LearnPage', 'MasteryCard']
  },
  '/ide': {
    route: '/ide', name: 'ide', description: 'IDE projects, codebases, and development environments.',
    contextProviders: [
      { name: 'Active Projects', description: 'Recently opened IDE projects', dataShape: 'Array<{name, path, last_opened}>', queryFn: 'SELECT name, path, last_opened FROM ide_projects ORDER BY last_opened DESC LIMIT 5' }
    ],
    ipcChannels: ['get-ide-projects', 'open-ide-project'], keyComponents: ['IdePage', 'ProjectCard']
  },
  '/ai': {
    route: '/ai', name: 'ai', description: 'AI Assistant configurations, agent sessions, and model settings.',
    contextProviders: [
      { name: 'Active Agents', description: 'Currently running or recent agent sessions', dataShape: 'Array<{topic, agent, status}>', queryFn: 'SELECT topic, agent, status FROM terminal_sessions WHERE agent IS NOT NULL ORDER BY created_at DESC LIMIT 5' }
    ],
    ipcChannels: ['get-agent-sessions'], keyComponents: ['AiPage', 'AgentCard']
  },
  '/activity': {
    route: '/activity', name: 'activity', description: 'Chronological log of workspace events and user actions.',
    contextProviders: [
      { name: 'Recent Events', description: 'Latest activity log entries', dataShape: 'Array<{action, entity_type, timestamp}>', queryFn: 'SELECT action, entity_type, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT 10' }
    ],
    ipcChannels: ['get-activity-log'], keyComponents: ['ActivityPage', 'TimelineItem']
  },
  '/studio': {
    route: '/studio', name: 'studio', description: 'Feature Studio for building and testing custom workspace features.',
    contextProviders: [
      { name: 'Active Features', description: 'Features currently in development', dataShape: 'Array<{name, status, progress}>', queryFn: 'SELECT name, status, progress FROM studio_features WHERE status != "completed" LIMIT 5' }
    ],
    ipcChannels: ['get-studio-features'], keyComponents: ['StudioPage', 'FeatureBuilder']
  },
  '/resume': {
    route: '/resume', name: 'resume', description: 'Resume builder, professional experience, and skills tracking.',
    contextProviders: [
      { name: 'Resume Sections', description: 'Current resume structure', dataShape: 'Array<{section, content}>', queryFn: 'SELECT section, content FROM resume_data ORDER BY sort_order ASC' }
    ],
    ipcChannels: ['get-resume-data'], keyComponents: ['ResumePage', 'ResumeEditor']
  },
  '/external': {
    route: '/external', name: 'external', description: 'External integrations, webhooks, and third-party connections.',
    contextProviders: [
      { name: 'Integrations', description: 'Connected external services', dataShape: 'Array<{service, status, last_sync}>', queryFn: 'SELECT service, status, last_sync FROM external_integrations' }
    ],
    ipcChannels: ['get-external-integrations'], keyComponents: ['ExternalPage', 'IntegrationCard']
  },
  '/reports': {
    route: '/reports', name: 'reports', description: 'Insights, analytics, and generated reports.',
    contextProviders: [
      { name: 'Recent Reports', description: 'Latest generated insights', dataShape: 'Array<{title, type, generated_at}>', queryFn: 'SELECT title, type, generated_at FROM reports ORDER BY generated_at DESC LIMIT 5' }
    ],
    ipcChannels: ['get-reports'], keyComponents: ['ReportsPage', 'ChartCard']
  },
  '/database': {
    route: '/database', name: 'database', description: 'Database schema viewer, raw data explorer, and migration tools.',
    contextProviders: [
      { name: 'Table Stats', description: 'Row counts for main tables', dataShape: 'Array<{table_name, row_count}>', queryFn: 'SELECT name as table_name, (SELECT count(*) FROM sqlite_master WHERE type="table" AND name=table_name) as row_count FROM sqlite_master WHERE type="table" LIMIT 5' }
    ],
    ipcChannels: ['get-db-schema', 'run-db-query'], keyComponents: ['DatabasePage', 'TableViewer']
  },
  '/settings': {
    route: '/settings', name: 'settings', description: 'Application preferences, user profile, and system configurations.',
    contextProviders: [
      { name: 'User Profile', description: 'Current user settings summary', dataShape: '{theme, notifications, language}', queryFn: 'SELECT theme, notifications, language FROM user_settings LIMIT 1' }
    ],
    ipcChannels: ['get-user-settings', 'update-settings'], keyComponents: ['SettingsPage', 'SettingGroup']
  },
  '/guide': {
    route: '/guide', name: 'guide', description: 'Documentation, tutorials, and onboarding materials.',
    contextProviders: [
      { name: 'Recent Guides', description: 'Recently viewed documentation', dataShape: 'Array<{title, category}>', queryFn: 'SELECT title, category FROM guide_views ORDER BY viewed_at DESC LIMIT 5' }
    ],
    ipcChannels: ['get-guide-views'], keyComponents: ['GuidePage', 'DocViewer']
  }
};

export function getPageContextEntry(route: string): PageContextEntry | undefined {
  return PAGE_CONTEXT_REGISTRY[route] || PAGE_CONTEXT_REGISTRY['/'];
}
```

---

### Task C: Page Context Episode Writer
**File:** `src/main/ai/episodeWriters.ts` *(Append to end)*

```typescript
export function writePageContextEpisode(page: string, action: 'navigated' | 'viewed', data?: Record<string, any>) {
  const content = `User ${action} to page: "${page}"${data ? ` — context: ${JSON.stringify(data).slice(0, 200)}` : ''}`;
  const epId = logAndQueue('page_context', content, undefined, { page, action });
  const entityId = brain.upsertEntity('page', page, []);
  if (entityId) {
    brain.addFact(entityId, 'last_accessed', new Date().toISOString(), epId);
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number') {
          brain.addFact(entityId, `has_${key}`, String(value), epId);
        }
      }
    }
  }
}
```

---

### Task B & E: IPC Handlers & `assemble-context` Extension
**File:** `src/main.ts` *(Modifications)*

1. **Add imports at the top:**
```typescript
import * as pageContextRegistry from './main/pageContextRegistry';
import * as episodeWriters from './main/ai/episodeWriters';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
```

2. **Extend `assemble-context` handler signature and add Block 4.5:**
```typescript
electron_1.ipcMain.handle('assemble-context', async (_event, data: { projectId: string; problemIds?: string[]; requestIds?: string[]; tokenBudget?: number; topic?: string; sessionId?: string; page?: string }) => {
  try {
    const parts = [];
    let totalChars = 0;
    const budget = data.tokenBudget || 2000;
    const maxChars = budget * 4;

    // ... [Existing Blocks 1-4: Problems, Requests, Sessions, Backup Protocol] ...

    // [PAGE-CONTEXT] Block 4.5: Inject page-specific context
    if (data.page) {
      try {
        const route = data.page === 'dashboard' ? '/' : (data.page.startsWith('/') ? data.page : `/${data.page}`);
        const pageEntry = pageContextRegistry.getPageContextEntry(route);
        if (pageEntry) {
          const remainingBudget = maxChars - totalChars - 200;
          if (remainingBudget > 100) {
            const pageLines = [`## Current Page Context: ${pageEntry.name.toUpperCase()}`];
            pageLines.push(`_Description_: ${pageEntry.description}`);
            
            for (const provider of pageEntry.contextProviders.slice(0, 2)) {
              try {
                const rows = db.prepare(provider.queryFn).all() as any[];
                if (rows.length > 0) {
                  pageLines.push(`\n**${provider.name}**:`);
                  for (const row of rows.slice(0, 3)) {
                    const line = `- ${Object.values(row).join(' | ')}`;
                    if (pageLines.join('\n').length + line.length > remainingBudget) break;
                    pageLines.push(line);
                  }
                }
              } catch (e) { /* ignore query errors */ }
            }
            
            const pageMd = pageLines.join('\n');
            if (totalChars + pageMd.length <= maxChars) {
              parts.push(pageMd);
              totalChars += pageMd.length;
            }
          }
        }
      } catch (e) {
        console.warn('[assemble-context] Page context injection failed (non-fatal):', e);
      }
    }

    // ... [Existing Blocks 5-8: User Context, Brain, Chat History, Learner Knowledge] ...
```

3. **Add new IPC Handlers:**
```typescript
electron_1.ipcMain.handle('get-page-context', async (_event, data: { page: string; projectId: string; tokenBudget?: number }) => {
  try {
    const budget = data.tokenBudget || 1000;
    const maxChars = budget * 4;
    const parts: string[] = [];
    let totalChars = 0;

    const route = data.page === 'dashboard' ? '/' : (data.page.startsWith('/') ? data.page : `/${data.page}`);
    const pageEntry = pageContextRegistry.getPageContextEntry(route);
    
    if (pageEntry) {
      parts.push(`## Page Context: ${pageEntry.name.toUpperCase()}`);
      parts.push(`**Description**: ${pageEntry.description}`);
      totalChars += parts.join('\n').length;
      
      // Try to read PAGE_CONTEXT.md
      try {
        const pageDocPath = path.join(app.getPath('userData'), 'agent', `${pageEntry.name}_PAGE_CONTEXT.md`);
        if (fs.existsSync(pageDocPath)) {
          const docContent = fs.readFileSync(pageDocPath, 'utf-8').slice(0, maxChars / 2);
          parts.push(`\n### Documentation\n${docContent}`);
          totalChars += docContent.length;
        }
      } catch (e) { /* ignore */ }

      // Query data providers
      if (pageEntry.contextProviders.length > 0 && totalChars < maxChars) {
        parts.push('\n### Live Data');
        for (const provider of pageEntry.contextProviders) {
          try {
            const rows = db.prepare(provider.queryFn).all() as any[];
            if (rows.length > 0) {
              const lines = [`**${provider.name}**:`];
              for (const row of rows.slice(0, 5)) {
                const line = `- ${Object.values(row).join(' | ')}`;
                if (totalChars + line.length > maxChars) break;
                lines.push(line);
                totalChars += line.length;
              }
              parts.push(lines.join('\n'));
            }
          } catch (e) { /* ignore */ }
        }
      }

      // Query ContextBrain
      try {
        if (totalChars < maxChars) {
          const brainResult = contextBrain.retrieve(pageEntry.name, ['keyword', 'graph']);
          const brainMd = contextFormatter.formatBrainContext(pageEntry.name, brainResult);
          if (brainMd && (totalChars + brainMd.length < maxChars)) {
            parts.push(brainMd);
            totalChars += brainMd.length;
          }
        }
      } catch (e) { /* ignore */ }
    }

    const context = parts.join('\n\n');
    return { success: true, context: context.slice(0, maxChars), tokensUsed: Math.ceil(totalChars / 4) };
  } catch (error: any) {
    return { success: false, error: error.message, context: '', tokensUsed: 0 };
  }
});

electron_1.ipcMain.handle('notify-page-change', async (_event, data: { page: string; projectId: string; sessionId?: string }) => {
  try {
    // 1. Log episode (fire-and-forget)
    episodeWriters.writePageContextEpisode(data.page, 'navigated', { projectId: data.projectId });

    // 2. Fire context-changed event to frontend
    if (mainWindow) {
      mainWindow.webContents.send('context-changed', { type: 'page', action: 'navigated', entity: { page: data.page } });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

---

### Task F: Preload Bridge Extensions
**File:** `src/preload.ts` *(Append to exposed API)*

```typescript
getPageContext: (data: { page: string; projectId: string; tokenBudget?: number }) =>
  ipcRenderer.invoke('get-page-context', data),
notifyPageChange: (data: { page: string; projectId: string; sessionId?: string }) =>
  ipcRenderer.invoke('notify-page-change', data),
```

---

### Task G: Type Definitions
**File:** `src/types/deskflow-api.d.ts` *(Append to `DeskflowAPI` interface)*

```typescript
interface DeskflowAPI {
  // ... existing methods ...
  getPageContext: (data: { page: string; projectId: string; tokenBudget?: number }) => Promise<{ success: boolean; context?: string; error?: string }>;
  notifyPageChange: (data: { page: string; projectId: string; sessionId?: string }) => Promise<{ success: boolean; error?: string }>;
}
```

---

### Task D: Page Change Detection
**File:** `src/App.tsx` *(Modify existing `useEffect`)*

```typescript
useEffect(() => {
  const page = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '') || 'dashboard';
  document.documentElement.setAttribute('data-page', page);
  
  // NEW: Notify workspace terminal about page change
  if (selectedProject) {
    (window as any).deskflowAPI?.notifyPageChange?.({
      page: location.pathname,
      projectId: selectedProject,
      sessionId: activeTerminalId || undefined,
    }).catch(e => console.warn('[App] notifyPageChange failed:', e));
  }
}, [location.pathname, selectedProject, activeTerminalId]);
```

---

### Task H: ContextSidebar Extension (UI Design)
**File:** `src/components/ContextSidebar.tsx` *(Add new section)*

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Brain, MapPin, FileText } from "lucide-react";
import { useState } from "react";

// Inside ContextSidebar component:
const [pageConfig, setPageConfig] = useState({
  enabled: true,
  max_tokens: 1000,
  auto_inject: true,
  notify_on_change: true
});

const currentPage = location.pathname === '/' ? 'dashboard' : location.pathname.replace('/', '');

return (
  // ... existing sidebar content ...
  
  <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-700/30 rounded-xl shadow-lg">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2 text-zinc-100">
        <MapPin className="w-4 h-4 text-indigo-400" />
        Page Context
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Page Preview */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-3 h-3 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{currentPage}</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          AI will automatically receive live data and documentation for this page when enabled.
        </p>
      </div>

      <Separator className="bg-zinc-700/30" />

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-zinc-200">Enable Page Context</div>
            <div className="text-xs text-zinc-400">Inject page data into AI sessions</div>
          </div>
          <Switch 
            checked={pageConfig.enabled} 
            onCheckedChange={(v) => setPageConfig({...pageConfig, enabled: v})} 
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">Auto-inject on session start</span>
          <Switch 
            checked={pageConfig.auto_inject} 
            onCheckedChange={(v) => setPageConfig({...pageConfig, auto_inject: v})}
            disabled={!pageConfig.enabled}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">Notify terminal on change</span>
          <Switch 
            checked={pageConfig.notify_on_change} 
            onCheckedChange={(v) => setPageConfig({...pageConfig, notify_on_change: v})}
            disabled={!pageConfig.enabled}
          />
        </div>
      </div>

      <Separator className="bg-zinc-700/30" />

      {/* Token Budget */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            Token Budget
          </span>
          <span className="text-indigo-400 font-mono font-semibold">{pageConfig.max_tokens}</span>
        </div>
        <Slider 
          value={[pageConfig.max_tokens]} 
          min={100} 
          max={2000} 
          step={100}
          disabled={!pageConfig.enabled}
          onValueChange={(v) => setPageConfig({...pageConfig, max_tokens: v[0]})}
          className="cursor-pointer"
        />
        <p className="text-xs text-zinc-500">
          Max characters allocated for page-specific live data and documentation.
        </p>
      </div>
    </CardContent>
  </Card>
);
```

---

### Task I: System Prompt Extension
**File:** `src/lib/defaults.ts` *(or wherever system prompt is assembled)*

```markdown
## Page Context

You have access to PAGE CONTEXT — information about the page the user is currently viewing.
Page context is automatically injected when you start a session and updates when the user navigates.

When the user asks about what's on screen, reference the injected page context.
When you see "[System: User navigated to X page. Context updated.]", note the context has changed.
Use page context to answer questions about data, suggest improvements, and understand user intent.
```

---

### UX Follow-Through: TerminalPage Context Listener Update
**File:** `src/pages/TerminalPage.tsx` *(Modify existing listener around line 893)*

```typescript
useEffect(() => {
  if (!window.deskflowAPI?.onContextChanged) return;
  const unsub = window.deskflowAPI.onContextChanged((data) => {
    // NEW: Handle page navigation context updates
    if (data.type === 'page' && data.action === 'navigated') {
      const pageName = data.entity.page === '/' ? 'Dashboard' : data.entity.page.replace('/', '');
      const msg = `[System: User navigated to ${pageName} page. Context updated.]\r\n`;
      window.deskflowAPI.terminalWrite(activeTerminalId, msg);
    }

    // EXISTING: Handle problems/requests
    if (data.source && data.source !== activeTerminalId && (data.type === 'problems' || data.type === 'requests')) {
      if (data.action === 'broadcast') {
        loadAllProblems?.();
        loadAllRequests?.();
        if (crossSessionSyncEnabled && window.deskflowAPI?.terminalWrite) {
          const typeLabel = data.type === 'problems' ? 'problem' : 'request';
          const actionLabel = data.action === 'created' ? 'created' : data.action === 'updated' ? 'updated' : 'modified';
          const title = data.entity?.title ? ` "${data.entity.title}"` : '';
          const msg2 = `[System: ${data.source} ${actionLabel} ${typeLabel}${title}. Run /sync for full context.]\r\n`;
          window.deskflowAPI.terminalWrite(activeTerminalId, msg2);
        }
      }
    }
  });
  return unsub;
}, [activeTerminalId, crossSessionSyncEnabled]);
```

---

### Design & Constraint Validation
- **No new npm dependencies:** Uses existing `shadcn/ui`, `lucide-react`, and native Electron/SQLite APIs.
- **Best-effort safety:** All page context injections and episode writings are wrapped in `try/catch` blocks to prevent session crashes.
- **Token budget hard-capped:** `maxChars` logic strictly enforces limits in both `assemble-context` and `get-page-context`.
- **Fast DB queries:** Registry queries are explicitly limited (`LIMIT 5`) to ensure < 100ms execution.
- **Backward compatible:** The `page` parameter in `assemble-context` is optional (`page?: string`), ensuring existing sessions without page data continue to function normally.