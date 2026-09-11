# Terminal Integration & Project Page Enhancement Plan

## Overview

I'll provide a comprehensive plan that your AI agent can follow to fix the persistence issues and integrate terminals into the project workspace experience.

---

## Phase 1: Fix Terminal Layout Persistence

### Problem
`TerminalPage` uses local React state that resets on tab switch. The `useTerminalLayout` hook exists but isn't connected.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW - LAYOUT PERSISTENCE               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TerminalPage.tsx                                                │
│       │                                                          │
│       │  onLayoutChange(layout, projectId)                       │
│       ▼                                                          │
│  useTerminalLayout.ts (Enhanced)                                 │
│       │                                                          │
│       │  IPC invoke('layout:save', {...})                        │
│       ▼                                                          │
│  main.ts (IPC Handler)                                           │
│       │                                                          │
│       │  INSERT OR REPLACE INTO terminal_layouts                 │
│       ▼                                                          │
│  SQLite (terminal_layouts table)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1.1: Enhance `useTerminalLayout.ts`

```typescript
// src/hooks/useTerminalLayout.ts

import { useState, useCallback, useEffect } from 'react';
import { PaneNode } from '../components/TerminalWindow';

interface UseTerminalLayoutOptions {
  projectId: string | null;
  autoSave?: boolean;
  autoLoad?: boolean;
}

interface LayoutRecord {
  id: string;
  name: string;
  layoutData: PaneNode;
  isActive: boolean;
  updatedAt: string;
}

export function useTerminalLayout(options: UseTerminalLayoutOptions) {
  const { projectId, autoSave = true, autoLoad = true } = options;
  
  const [layout, setLayout] = useState<PaneNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load layout for a specific project
  const loadLayout = useCallback(async () => {
    if (!projectId) {
      setLayout(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.deskflowAPI.getLayout(projectId);
      if (result && result.layoutData) {
        setLayout(result.layoutData);
      } else {
        // No saved layout, create default single pane
        setLayout(createDefaultLayout());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layout');
      setLayout(createDefaultLayout());
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Save current layout
  const saveLayout = useCallback(async (layoutToSave: PaneNode) => {
    if (!projectId || !layoutToSave) return;

    try {
      await window.deskflowAPI.saveLayout({
        projectId,
        layoutData: layoutToSave,
        name: `Project ${projectId} Layout`,
      });
      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save layout');
      console.error('Failed to save layout:', err);
    }
  }, [projectId]);

  // Update layout and optionally auto-save
  const updateLayout = useCallback((newLayout: PaneNode) => {
    setLayout(newLayout);
    if (autoSave) {
      // Debounce save to avoid excessive writes
      debouncedSave(newLayout);
    }
  }, [autoSave]);

  // Debounced save helper
  const debouncedSave = useDebounce(saveLayout, 500);

  // Auto-load when project changes
  useEffect(() => {
    if (autoLoad && projectId) {
      loadLayout();
    }
  }, [projectId, autoLoad, loadLayout]);

  // Reset layout to default
  const resetLayout = useCallback(() => {
    const defaultLayout = createDefaultLayout();
    setLayout(defaultLayout);
    saveLayout(defaultLayout);
  }, [saveLayout]);

  return {
    layout,
    setLayout: updateLayout,
    loadLayout,
    saveLayout,
    resetLayout,
    isLoading,
    error,
    lastSaved,
  };
}

// Helper: Create a default single-pane layout
function createDefaultLayout(): PaneNode {
  return {
    id: generateId(),
    type: 'leaf',
    terminalId: generateId(),
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Helper: Debounce hook
function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}
```

#### Step 1.2: Add IPC Handlers in `main.ts`

```typescript
// src/main.ts (add to existing IPC handlers)

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

// Initialize database
const db = new Database('deskflow.db');

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS terminal_layouts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT,
    layout_data TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id)
  );
`);

// IPC: Get layout for project
ipcMain.handle('layout:get', async (event, projectId: string) => {
  const stmt = db.prepare(`
    SELECT id, name, layout_data, is_active, updated_at 
    FROM terminal_layouts 
    WHERE project_id = ?
  `);
  const row = stmt.get(projectId) as any;
  
  if (row) {
    return {
      id: row.id,
      name: row.name,
      layoutData: JSON.parse(row.layout_data),
      isActive: row.is_active === 1,
      updatedAt: row.updated_at,
    };
  }
  return null;
});

// IPC: Save layout
ipcMain.handle('layout:save', async (event, data: {
  projectId: string;
  layoutData: any;
  name?: string;
}) => {
  const stmt = db.prepare(`
    INSERT INTO terminal_layouts (id, project_id, name, layout_data, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET
      layout_data = excluded.layout_data,
      name = excluded.name,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  const id = `layout_${data.projectId}`;
  stmt.run(
    id,
    data.projectId,
    data.name || 'Default Layout',
    JSON.stringify(data.layoutData)
  );
  
  return { success: true, id };
});

// IPC: Delete layout
ipcMain.handle('layout:delete', async (event, projectId: string) => {
  const stmt = db.prepare('DELETE FROM terminal_layouts WHERE project_id = ?');
  stmt.run(projectId);
  return { success: true };
});

// IPC: Get all layouts (for templates/sharing)
ipcMain.handle('layout:getAll', async () => {
  const stmt = db.prepare(`
    SELECT id, project_id, name, layout_data, updated_at 
    FROM terminal_layouts 
    ORDER BY updated_at DESC
  `);
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    layoutData: JSON.parse(row.layout_data),
    updatedAt: row.updated_at,
  }));
});
```

#### Step 1.3: Update Preload Script

```typescript
// src/preload.ts (add to existing exposeInMainWorld)

contextBridge.exposeInMainWorld('deskflowAPI', {
  // ... existing methods ...
  
  // Layout management
  getLayout: (projectId: string) => ipcRenderer.invoke('layout:get', projectId),
  saveLayout: (data: { projectId: string; layoutData: any; name?: string }) => 
    ipcRenderer.invoke('layout:save', data),
  deleteLayout: (projectId: string) => ipcRenderer.invoke('layout:delete', projectId),
  getAllLayouts: () => ipcRenderer.invoke('layout:getAll'),
});
```

#### Step 1.4: Update `TerminalPage.tsx`

```typescript
// src/pages/TerminalPage.tsx

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom'; // If using routing
import { TerminalWindow, PaneNode } from '../components/TerminalWindow';
import { useTerminalLayout } from '../hooks/useTerminalLayout';
import { TerminalSidebar } from '../components/TerminalSidebar';

interface TerminalPageProps {
  projectId?: string; // Can come from props or route
}

export function TerminalPage({ projectId: propProjectId }: TerminalPageProps) {
  // Get project ID from route params or props
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || routeProjectId || null;

  // Use the enhanced persistence hook
  const {
    layout,
    setLayout,
    saveLayout,
    resetLayout,
    isLoading,
    error,
    lastSaved,
  } = useTerminalLayout({ 
    projectId,
    autoSave: true,
    autoLoad: true 
  });

  // Handle layout changes from TerminalWindow
  const handleLayoutChange = (newLayout: PaneNode) => {
    setLayout(newLayout);
  };

  // Manual save (optional, since auto-save is on)
  const handleManualSave = () => {
    if (layout) {
      saveLayout(layout);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  // No project selected
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
          <p className="text-muted-foreground">
            Select a project from the sidebar to open its workspace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <TerminalSidebar
        projectId={projectId}
        onResetLayout={resetLayout}
        onSaveLayout={handleManualSave}
        lastSaved={lastSaved}
      />

      {/* Main Terminal Area */}
      <div className="flex-1 flex flex-col">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Project: {projectId}
          </span>
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Terminal Window */}
        <div className="flex-1">
          {layout && (
            <TerminalWindow
              initialLayout={layout}
              onLayoutChange={handleLayoutChange}
              projectId={projectId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 2: Integrate Terminals with IDE Projects Page

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT WORKSPACE FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IDE Projects Page                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Project Card                              │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │ Project Name                  [●●●]    │    │    │
│  │  │ Path: ~/projects/my-app                 │    │    │
│  │  │ Health: ████████░░ 80%                  │    │    │
│  │  │                                          │    │    │
│  │  │ Active Terminals: 2  [Open Workspace]   │◄───┼────┤ Click to enter
│  │  └─────────────────────────────────────────┘    │    │    workspace
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  [Open Workspace] ──────────────────────────────────────►│
│                                                          │
│  Workspace View (Modal or Full Page)                      │
│  ┌─────────────────────────────────────────────────┐      │
│  │ ┌─────────────┬─────────────────────────────────┤      │
│  │ │ Project     │     TERMINAL SPLIT VIEW         │      │
│  │ │ Details     │  ┌───────────┬───────────┐     │      │
│  │ │             │  │ Terminal  │ Terminal  │     │      │
│  │ │ ○ Stats     │  │ (Claude)  │ (Tests)   │     │      │
│  │ │ ○ Presets   │  └───────────┴───────────┘     │      │
│  │ │ ○ History   │                                 │      │
│  │ │             │  ┌─────────────────────────┐   │      │
│  │ │ [Back]      │  │ Terminal (Logs)         │   │      │
│  │ └─────────────┴──┴─────────────────────────┴───┘      │
│  └─────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 2.1: Update Project Cards

```typescript
// src/components/ProjectCard.tsx (or within IDEProjectsPage.tsx)

import React from 'react';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  onOpenWorkspace: (projectId: string) => void;
  activeTerminalsCount: number;
}

export function ProjectCard({ project, onOpenWorkspace, activeTerminalsCount }: ProjectCardProps) {
  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">{project.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{project.path}</p>
        </div>
        <div className="flex gap-2">
          <span className={`w-3 h-3 rounded-full ${
            project.healthScore > 80 ? 'bg-green-500' :
            project.healthScore > 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-muted-foreground" /* icon */ />
          <span>{project.tools?.length || 0} tools</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-muted-foreground" /* icon */ />
          <span>{project.sessions?.length || 0} sessions</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-blue-500" /* terminal icon */ />
          <span className="text-blue-500 font-medium">{activeTerminalsCount} active</span>
        </div>
      </div>

      {/* Health Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Health</span>
          <span>{project.healthScore}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all"
            style={{ width: `${project.healthScore}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onOpenWorkspace(project.id)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 
                     bg-primary text-primary-foreground rounded-md 
                     hover:bg-primary/90 transition-colors"
        >
          <svg className="w-4 h-4" /* terminal icon */ />
          <span>Open Workspace</span>
        </button>
        <button
          onClick={() => {/* Open details modal */}}
          className="px-3 py-2 border rounded-md hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" /* info icon */ />
        </button>
      </div>
    </div>
  );
}
```

#### Step 2.2: Create Workspace View Component

```typescript
// src/components/ProjectWorkspace.tsx

import React, { useState, useEffect } from 'react';
import { PaneNode, TerminalWindow } from './TerminalWindow';
import { useTerminalLayout } from '../hooks/useTerminalLayout';
import { Project } from '../types';

interface ProjectWorkspaceProps {
  project: Project;
  onClose: () => void;
}

type SidebarTab = 'overview' | 'presets' | 'history' | 'analytics';

export function ProjectWorkspace({ project, onClose }: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Persistent layout for this project
  const {
    layout,
    setLayout,
    resetLayout,
    isLoading,
  } = useTerminalLayout({ 
    projectId: project.id,
    autoSave: true,
    autoLoad: true 
  });

  // Fetch project-specific data
  const { presets, sessions, analytics } = useProjectData(project.id);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <svg className="w-5 h-5" /* back icon */ />
          </button>
          <div>
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.path}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active terminals indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>{countActiveTerminals(layout)} active</span>
          </div>

          {/* Reset layout button */}
          <button
            onClick={resetLayout}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            Reset Layout
          </button>

          {/* Toggle sidebar */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isSidebarCollapsed && (
          <aside className="w-72 border-r bg-card/50 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b">
              {(['overview', 'presets', 'history', 'analytics'] as SidebarTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2 text-sm capitalize transition-colors ${
                    activeTab === tab 
                      ? 'border-b-2 border-primary text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'overview' && (
                <ProjectOverview project={project} analytics={analytics} />
              )}
              {activeTab === 'presets' && (
                <PresetList 
                  presets={presets} 
                  onRun={(preset) => handleRunPreset(preset)} 
                />
              )}
              {activeTab === 'history' && (
                <SessionHistory sessions={sessions} />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsView analytics={analytics} />
              )}
            </div>
          </aside>
        )}

        {/* Terminal Area */}
        <main className="flex-1 flex flex-col">
          {/* Terminal Mini Map (Visual Blueprint) */}
          <TerminalMiniMap 
            layout={layout} 
            onSelectPane={(paneId) => {/* Focus pane */}}
          />

          {/* Terminal Window */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">Loading workspace...</span>
              </div>
            ) : layout ? (
              <TerminalWindow
                initialLayout={layout}
                onLayoutChange={setLayout}
                projectId={project.id}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <button 
                  onClick={resetLayout}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  Start New Session
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Helper: Count active terminals in layout tree
function countActiveTerminals(layout: PaneNode | null): number {
  if (!layout) return 0;
  if (layout.type === 'leaf') return 1;
  return layout.children.reduce((sum, child) => sum + countActiveTerminals(child), 0);
}
```

#### Step 2.3: Update `IDEProjectsPage.tsx`

```typescript
// src/pages/IDEProjectsPage.tsx

import React, { useState, useEffect } from 'react';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectWorkspace } from '../components/ProjectWorkspace';
import { useProjects } from '../hooks/useProjects';
import { useActiveTerminals } from '../hooks/useActiveTerminals';

export function IDEProjectsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  const { projects, isLoading } = useProjects();
  const { getActiveCount } = useActiveTerminals();

  // Handle opening workspace
  const handleOpenWorkspace = (project: Project) => {
    setSelectedProject(project);
    setIsWorkspaceOpen(true);
  };

  // Handle closing workspace
  const handleCloseWorkspace = () => {
    setIsWorkspaceOpen(false);
    // Don't clear selectedProject immediately - allows for smooth transition
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b bg-card">
        {['overview', 'ides', 'tools', 'projects', 'ai-tools', 'git'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'projects' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Projects</h2>
                <p className="text-muted-foreground">
                  Manage your development projects and terminal workspaces
                </p>
              </div>
              <button
                onClick={() => {/* Open new project modal */}}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                <svg className="w-4 h-4" /* plus icon */ />
                Add Project
              </button>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpenWorkspace={() => handleOpenWorkspace(project)}
                  activeTerminalsCount={getActiveCount(project.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Other tabs content */}
        {activeTab !== 'projects' && (
          <div className="text-center py-12 text-muted-foreground">
            {activeTab} content here
          </div>
        )}
      </div>

      {/* Workspace Modal/Overlay */}
      {isWorkspaceOpen && selectedProject && (
        <ProjectWorkspace
          project={selectedProject}
          onClose={handleCloseWorkspace}
        />
      )}
    </div>
  );
}
```

---

## Phase 3: Enhance the Workspace Experience

### Step 3.1: Terminal Mini Map (Visual Blueprint)

```typescript
// src/components/TerminalMiniMap.tsx

import React from 'react';
import { PaneNode } from './TerminalWindow';

interface TerminalMiniMapProps {
  layout: PaneNode | null;
  onSelectPane: (paneId: string) => void;
  highlightedPaneId?: string;
}

export function TerminalMiniMap({ layout, onSelectPane, highlightedPaneId }: TerminalMiniMapProps) {
  if (!layout) return null;

  return (
    <div className="h-16 border-b bg-muted/30 px-4 py-2">
      <div className="text-xs text-muted-foreground mb-1">Layout Map</div>
      <div className="h-10 bg-muted rounded overflow-hidden">
        <MiniMapNode 
          node={layout} 
          onSelect={onSelectPane}
          highlightedId={highlightedPaneId}
        />
      </div>
    </div>
  );
}

// Recursive component to render the tree
function MiniMapNode({ 
  node, 
  onSelect, 
  highlightedId,
  depth = 0 
}: { 
  node: PaneNode; 
  onSelect: (id: string) => void;
  highlightedId?: string;
  depth?: number;
}) {
  if (node.type === 'leaf') {
    const isHighlighted = node.id === highlightedId;
    return (
      <div
        onClick={() => onSelect(node.id)}
        className={`
          h-full min-w-[40px] cursor-pointer transition-colors
          ${isHighlighted 
            ? 'bg-primary/30 border border-primary' 
            : 'bg-card hover:bg-card/80 border border-border'}
          rounded-sm
        `}
        title={`Terminal ${node.terminalId}`}
      />
    );
  }

  // It's a split
  const direction = node.direction === 'horizontal' ? 'flex-row' : 'flex-col';
  const totalRatio = node.children.reduce((sum, c) => sum + (c.ratio || 1), 0);

  return (
    <div className={`flex ${direction} h-full gap-0.5`}>
      {node.children.map((child, index) => (
        <div 
          key={child.id} 
          style={{ 
            flex: `${(child.ratio || 1) / totalRatio * 100}%`,
          }}
        >
          <MiniMapNode 
            node={child} 
            onSelect={onSelect}
            highlightedId={highlightedId}
            depth={depth + 1}
          />
        </div>
      ))}
    </div>
  );
}
```

### Step 3.2: Project-Specific Data Hook

```typescript
// src/hooks/useProjectData.ts

import { useState, useEffect } from 'react';

interface Preset {
  id: string;
  name: string;
  command: string;
  category: string;
}

interface Session {
  id: string;
  agent: string;
  topic: string;
  resumeId: string;
  totalTokens: number;
  totalCost: number;
  startedAt: string;
}

interface Analytics {
  totalTokens: number;
  totalCost: number;
  dailyUsage: { date: string; tokens: number; cost: number }[];
  byAgent: { agent: string; tokens: number; sessions: number }[];
}

export function useProjectData(projectId: string) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load presets for this project
        const presetsData = await window.deskflowAPI.getPresets(projectId);
        setPresets(presetsData);

        // Load sessions for this project
        const sessionsData = await window.deskflowAPI.getSessions(projectId);
        setSessions(sessionsData);

        // Load analytics for this project
        const analyticsData = await window.deskflowAPI.getProjectAnalytics(projectId);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Failed to load project data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  return { presets, sessions, analytics, isLoading };
}
```

### Step 3.3: Preset List Component

```typescript
// src/components/PresetList.tsx

import React, { useState } from 'react';
import { Preset } from '../types';

interface PresetListProps {
  presets: Preset[];
  onRun: (preset: Preset) => void;
  onEdit?: (preset: Preset) => void;
}

export function PresetList({ presets, onRun, onEdit }: PresetListProps) {
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Group presets by category
  const grouped = presets.reduce((acc, preset) => {
    const cat = preset.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(preset);
    return acc;
  }, {} as Record<string, Preset[]>);

  // Filter presets
  const filteredGroups = Object.entries(grouped).reduce((acc, [cat, items]) => {
    const filtered = items.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.command.toLowerCase().includes(filter.toLowerCase())
    );
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {} as Record<string, Preset[]>);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search presets..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-background border rounded-md text-sm"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-2 py-1 text-xs rounded-full transition-colors ${
            categoryFilter === null 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {Object.keys(grouped).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-2 py-1 text-xs rounded-full capitalize transition-colors ${
              categoryFilter === cat 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset Groups */}
      <div className="space-y-4">
        {Object.entries(filteredGroups)
          .filter(([cat]) => categoryFilter === null || categoryFilter === cat)
          .map(([category, items]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
              {category}
            </h4>
            <div className="space-y-1">
              {items.map(preset => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-2 bg-background border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{preset.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {preset.command}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => onRun(preset)}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      Run
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(preset)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <svg className="w-4 h-4" /* edit icon */ />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Preset Button */}
      <button
        onClick={() => {/* Open preset editor */}}
        className="w-full py-2 border-2 border-dashed rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add Preset
      </button>
    </div>
  );
}
```

---

## Summary: Implementation Order

| Step | What | Priority |
|------|------|----------|
| 1.1 | Enhance `useTerminalLayout` hook | 🔴 Critical |
| 1.2 | Add IPC handlers in main.ts | 🔴 Critical |
| 1.3 | Update preload script | 🔴 Critical |
| 1.4 | Update `TerminalPage.tsx` | 🔴 Critical |
| 2.1 | Create `ProjectCard` component | 🟡 High |
| 2.2 | Create `ProjectWorkspace` component | 🟡 High |
| 2.3 | Update `IDEProjectsPage.tsx` | 🟡 High |
| 3.1 | Add `TerminalMiniMap` | 🟢 Medium |
| 3.2 | Create `useProjectData` hook | 🟡 High |
| 3.3 | Create `PresetList` component | 🟢 Medium |

---

This plan provides your AI agent with concrete implementation steps while maintaining flexibility for improvements. The key architectural decisions are:

1. **Per-project persistence** - Each project gets its own layout saved to SQLite
2. **Auto-save with debounce** - Layouts save automatically without performance issues
3. **Workspace overlay** - Full-screen workspace that feels like entering a project
4. **Visual map integration** - Mini map for quick navigation of split layouts