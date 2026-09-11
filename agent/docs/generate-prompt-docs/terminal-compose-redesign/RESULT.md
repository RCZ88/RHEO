# Phase 1 Implementation: SkillPlugin Interface + WorkspaceRegistry

I'll implement Phase 1 with 2 new files and 2 modified files. Let me walk through each.

## File 1: `src/types/SkillPlugin.ts`

```typescript
/**
 * SkillPlugin — Type definitions for the workspace plugin architecture.
 *
 * Skills can become workspace plugins by:
 * 1. Including workspace config in SKILL.md frontmatter
 * 2. Providing a plugin.json in their skill directory
 * 3. Being programmatically registered via WorkspaceRegistry
 *
 * Phase 1 establishes the type contracts. Phase 2+ wires them into UI.
 */

// ─── Sidebar ────────────────────────────────────────────────

/** Sidebar entry for a workspace-enabled skill */
export interface SkillSidebarEntry {
  /** Display label in the sidebar */
  label: string;
  /** Lucide icon name (e.g. 'palette', 'bug', 'search') */
  icon: string;
  /** Route path, e.g. '/workspace/design' */
  route: string;
  /** Position in sidebar — lower numbers appear higher */
  order: number;
  /** Optional badge text (e.g. "3" for active items) */
  badge?: string;
}

// ─── Workspace ──────────────────────────────────────────────

/** Workspace component configuration for a skill */
export interface SkillWorkspaceConfig {
  /** Component registry key — maps to a React component registered later */
  componentKey: string;
  /** Minimum panel width in pixels */
  minWidth?: number;
}

// ─── Descriptors ────────────────────────────────────────────

/**
 * Serializable descriptor for a workspace-enabled skill.
 * This is what crosses the IPC boundary from main process.
 * Contains NO functions — only data.
 */
export interface SkillPluginDescriptor {
  /** Unique ID matching SKILL.md frontmatter `id` */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Category grouping: 'design' | 'debug' | 'research' | etc */
  category: SkillCategory;
  /** Semantic version from SKILL.md frontmatter */
  version?: string;
  /** One-line description of what this workspace provides */
  description?: string;
  /** Sidebar entry config — if present, the skill gets a sidebar item */
  sidebarEntry?: SkillSidebarEntry;
  /** Workspace component config — if present, the skill provides a UI */
  workspace?: SkillWorkspaceConfig;
  /** Absolute path to the skill directory on disk */
  skillPath?: string;
}

/**
 * Full skill plugin with runtime capabilities.
 * The composeContext function is attached after IPC, either:
 * - From a built-in default
 * - Registered by a workspace React component on mount
 */
export interface SkillPlugin extends SkillPluginDescriptor {
  /** Returns a context snippet string for the Compose Hub */
  composeContext: () => Promise<string>;
}

// ─── Component Props ───────────────────────────────────────

/** Props passed to workspace React components */
export interface SkillWorkspaceProps {
  /** The skill plugin descriptor (data only, no functions) */
  skill: SkillPluginDescriptor;
  /** Current project path (from session/terminal context) */
  projectPath?: string;
  /** Current project ID (from session/terminal context) */
  projectId?: string;
  /** Send assembled context to the Compose Hub */
  onCompose: (context: string) => void;
  /** Report errors from the workspace */
  onError: (error: Error) => void;
}

// ─── Compose Hub ───────────────────────────────────────────

/** Compose source entry for the universal prompt assembler */
export interface ComposeSource {
  id: string;
  label: string;
  type: 'workspace' | 'problems' | 'requests' | 'checklists' | 'skills' | 'custom';
  enabled: boolean;
  /** Preview of what this source contributes */
  contextSnippet?: string;
}

// ─── Observers ─────────────────────────────────────────────

/** Listener callback for registry changes */
export type WorkspaceRegistryListener = () => void;

// ─── Categories ────────────────────────────────────────────

/** Skill categories that can host workspace plugins */
export type SkillCategory =
  | 'design'
  | 'debug'
  | 'research'
  | 'writing'
  | 'testing'
  | 'automation'
  | 'custom';

/** Default lucide icons per category */
export const CATEGORY_ICONS: Record<SkillCategory, string> = {
  design: 'palette',
  debug: 'bug',
  research: 'search',
  writing: 'pen-tool',
  testing: 'test-tubes',
  automation: 'zap',
  custom: 'puzzle',
};

// ─── Built-in Plugin IDs ───────────────────────────────────

/**
 * Well-known plugin IDs for built-in workspaces.
 * These exist independent of any SKILL.md files.
 */
export const BUILTIN_PLUGIN_IDS = {
  /** The frontend design workspace — always available */
  DESIGN_WORKSPACE: 'design-workspace',
} as const;

export type BuiltinPluginId = (typeof BUILTIN_PLUGIN_IDS)[keyof typeof BUILTIN_PLUGIN_IDS];

// ─── IPC Payloads ──────────────────────────────────────────

/** Request payload for get-workspace-skills IPC */
export interface GetWorkspaceSkillsRequest {
  projectPath?: string;
}

/** Response payload for get-workspace-skills IPC */
export interface GetWorkspaceSkillsResponse {
  success: boolean;
  data?: SkillPluginDescriptor[];
  error?: string;
}
```

---

## File 2: `src/services/WorkspaceRegistry.ts`

```typescript
/**
 * WorkspaceRegistry — Singleton service that manages workspace-enabled skill plugins.
 *
 * Lifecycle:
 * 1. App starts → WorkspaceRegistry.initialize() called from App.tsx
 * 2. Built-in plugins registered immediately (Design Workspace, etc.)
 * 3. IPC discovery runs in background → additional plugins added
 * 4. React components subscribe via .subscribe() for reactive updates
 * 5. Workspace components register their composeContext on mount
 *
 * Phase 1: Types + registry + built-in design workspace + IPC discovery
 * Phase 2: Wire into Sidebar + App router
 */

import type {
  SkillPlugin,
  SkillPluginDescriptor,
  SkillSidebarEntry,
  SkillCategory,
  WorkspaceRegistryListener,
  BUILTIN_PLUGIN_IDS,
} from '../types/SkillPlugin';

// ─── Built-in Plugin Definitions ───────────────────────────

/**
 * Plugins that ship with the app itself.
 * They don't require SKILL.md files — they're core features.
 */
const BUILT_IN_DESCRIPTORS: SkillPluginDescriptor[] = [
  {
    id: 'design-workspace',
    name: 'Design Workspace',
    category: 'design',
    version: '1.0.0',
    description:
      'Frontend design workspace with taste knobs, style references, and compose outlet',
    sidebarEntry: {
      label: 'Design',
      icon: 'palette',
      route: '/workspace/design',
      order: 50, // After Sessions (~40), before Compose Hub (~60)
    },
    workspace: {
      componentKey: 'DesignWorkspace',
      minWidth: 800,
    },
  },
];

// ─── Known Design Skill IDs ────────────────────────────────

/**
 * Skills from agent/skills/ that are known to be design-related.
 * Used for IPC discovery when SKILL.md frontmatter doesn't declare workspace config.
 */
const KNOWN_DESIGN_SKILL_IDS: string[] = [
  'frontend-design',
  'impeccable',
  'ui-ux-pro-max',
  'taste-skill',
  'design-taste',
];

// ─── Registry Service ──────────────────────────────────────

class WorkspaceRegistryService {
  /** All registered plugins, keyed by ID */
  private plugins: Map<string, SkillPlugin> = new Map();

  /** Compose context functions registered by workspace components */
  private composeContextFns: Map<string, () => Promise<string>> = new Map();

  /** Change listeners (React components, etc.) */
  private listeners: Set<WorkspaceRegistryListener> = new Set();

  /** Whether initialize() has completed at least once */
  private initialized = false;

  /** Last project path used for discovery */
  private projectPath: string | undefined;

  // ─── Initialization ────────────────────────────────────

  /**
   * Initialize the registry. Safe to call multiple times.
   * 1. Registers built-in plugins
   * 2. Discovers workspace-enabled skills via IPC
   * 3. Notifies listeners
   */
  async initialize(projectPath?: string): Promise<void> {
    this.projectPath = projectPath;

    // Register built-in plugins (always present, never overwritten by discovery)
    for (const descriptor of BUILT_IN_DESCRIPTORS) {
      if (!this.plugins.has(descriptor.id)) {
        this.addPlugin(descriptor);
      }
    }

    // Discover workspace-enabled skills from the main process
    try {
      const discovered = await this.discoverFromIPC(projectPath);
      for (const descriptor of discovered) {
        // Don't overwrite built-ins with discovered versions
        if (!this.plugins.has(descriptor.id)) {
          this.addPlugin(descriptor);
        }
      }
    } catch (error) {
      console.warn('[WorkspaceRegistry] IPC discovery failed (non-fatal):', error);
    }

    this.initialized = true;
    this.notify();
  }

  /**
   * Re-run discovery. Useful after skill files are installed.
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    await this.initialize(this.projectPath);
  }

  // ─── Plugin Registration ───────────────────────────────

  /**
   * Register a plugin descriptor programmatically.
   * Useful for tests or dynamic plugin loading.
   */
  register(descriptor: SkillPluginDescriptor): void {
    this.addPlugin(descriptor);
    this.notify();
  }

  /**
   * Unregister a plugin by ID.
   * Also removes any associated composeContext function.
   */
  unregister(id: string): void {
    this.plugins.delete(id);
    this.composeContextFns.delete(id);
    this.notify();
  }

  // ─── Queries ───────────────────────────────────────────

  /** Get a specific plugin by ID */
  getPlugin(id: string): SkillPlugin | undefined {
    return this.plugins.get(id);
  }

  /** Get all registered plugins */
  getAllPlugins(): SkillPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Get plugins filtered by category */
  getPluginsByCategory(category: SkillCategory): SkillPlugin[] {
    return this.getAllPlugins().filter((p) => p.category === category);
  }

  /** Get all sidebar entries, sorted by order (ascending) */
  getSidebarEntries(): SkillSidebarEntry[] {
    return this.getAllPlugins()
      .filter((p) => p.sidebarEntry)
      .map((p) => p.sidebarEntry!)
      .sort((a, b) => a.order - b.order);
  }

  /** Check if a plugin with the given ID exists */
  hasPlugin(id: string): boolean {
    return this.plugins.has(id);
  }

  /** Number of registered plugins */
  get size(): number {
    return this.plugins.size;
  }

  /** Whether initialize() has completed */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ─── Compose Context ───────────────────────────────────

  /**
   * Register a composeContext function for a plugin.
   * Called by workspace React components when they mount.
   *
   * Example:
   * ```tsx
   * useEffect(() => {
   *   WorkspaceRegistry.registerComposeContext('design-workspace', async () => {
   *     return `Variance: ${variance}, Density: ${density}...`;
   *   });
   *   return () => WorkspaceRegistry.unregisterComposeContext('design-workspace');
   * }, [variance, density]);
   * ```
   */
  registerComposeContext(pluginId: string, fn: () => Promise<string>): void {
    this.composeContextFns.set(pluginId, fn);
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.composeContext = fn;
    }
  }

  /**
   * Unregister a composeContext function.
   * Called by workspace React components when they unmount.
   */
  unregisterComposeContext(pluginId: string): void {
    this.composeContextFns.delete(pluginId);
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.composeContext = this.defaultComposeContext(plugin.name);
    }
  }

  /**
   * Get the composeContext function for a plugin.
   * Used by the Compose Hub (Phase 6).
   */
  getComposeContext(pluginId: string): (() => Promise<string>) | undefined {
    return this.composeContextFns.get(pluginId);
  }

  /**
   * Collect compose context from ALL registered plugins.
   * Used by the Compose Hub to assemble the full prompt.
   */
  async collectAllContext(): Promise<string> {
    const snippets: string[] = [];
    for (const plugin of this.getAllPlugins()) {
      try {
        const context = await plugin.composeContext();
        if (context && context.trim()) {
          snippets.push(context);
        }
      } catch (error) {
        console.warn(`[WorkspaceRegistry] composeContext failed for ${plugin.id}:`, error);
      }
    }
    return snippets.join('\n\n');
  }

  // ─── Subscription ──────────────────────────────────────

  /**
   * Subscribe to registry changes.
   * Returns an unsubscribe function for cleanup.
   *
   * Example:
   * ```tsx
   * useEffect(() => {
   *   const unsub = WorkspaceRegistry.subscribe(() => forceUpdate());
   *   return unsub;
   * }, []);
   * ```
   */
  subscribe(listener: WorkspaceRegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ─── Internal ──────────────────────────────────────────

  /**
   * Add a plugin from a descriptor, attaching a default composeContext.
   */
  private addPlugin(descriptor: SkillPluginDescriptor): void {
    const existingFn = this.composeContextFns.get(descriptor.id);
    const plugin: SkillPlugin = {
      ...descriptor,
      composeContext: existingFn ?? this.defaultComposeContext(descriptor.name),
    };
    this.plugins.set(descriptor.id, plugin);
  }

  /**
   * Default composeContext — returns a placeholder indicating the workspace
   * hasn't registered its context provider yet.
   */
  private defaultComposeContext(name: string): () => Promise<string> {
    return async () => `[${name}] Workspace context not yet configured`;
  }

  /**
   * Discover workspace-enabled skills from the main process via IPC.
   * Returns an empty array if IPC is unavailable (e.g., during testing).
   */
  private async discoverFromIPC(projectPath?: string): Promise<SkillPluginDescriptor[]> {
    // Attempt to use the dedicated workspace skills IPC endpoint
    try {
      const api = (window as any).deskflowAPI;
      if (api?.getWorkspaceSkills) {
        const result = await api.getWorkspaceSkills(projectPath);
        if (result?.success && Array.isArray(result.data)) {
          return result.data as SkillPluginDescriptor[];
        }
      }
    } catch {
      // IPC endpoint not available yet — this is fine for Phase 1
    }

    // Fallback: try using existing get-skills IPC and filter for design skills
    try {
      const api = (window as any).deskflowAPI;
      if (api?.getSkills) {
        const result = await api.getSkills();
        if (result?.success && Array.isArray(result.data)) {
          return this.filterWorkspaceSkills(result.data);
        }
      }
    } catch {
      // Existing skills IPC also unavailable
    }

    return [];
  }

  /**
   * Filter the existing skills list for workspace-capable entries.
   * Used as a fallback when the dedicated workspace IPC isn't available.
   */
  private filterWorkspaceSkills(skills: any[]): SkillPluginDescriptor[] {
    return skills
      .filter((skill) => {
        // Include if explicitly marked as workspace-enabled
        if (skill.sidebarEntry || skill.workspace) return true;
        // Include known design skills
        if (KNOWN_DESIGN_SKILL_IDS.includes(skill.id)) return true;
        // Include if category is design
        if (skill.category === 'design') return true;
        return false;
      })
      .map((skill) => this.skillToDescriptor(skill));
  }

  /**
   * Convert a generic skill object to a SkillPluginDescriptor.
   * Applies default workspace config for known design skills.
   */
  private skillToDescriptor(skill: any): SkillPluginDescriptor {
    const isKnownDesign = KNOWN_DESIGN_SKILL_IDS.includes(skill.id);
    const category: SkillCategory = skill.category || (isKnownDesign ? 'design' : 'custom');

    const descriptor: SkillPluginDescriptor = {
      id: skill.id,
      name: skill.name || skill.id,
      category,
      version: skill.version,
      description: skill.description,
      skillPath: skill.path || skill.skillPath,
    };

    // For known design skills, auto-assign to the design workspace
    // (they don't get their own sidebar entries — they're sub-panels)
    if (isKnownDesign && !skill.sidebarEntry) {
      descriptor.workspace = {
        componentKey: 'DesignWorkspace',
      };
    }

    // Copy explicit workspace/sidebar config if present
    if (skill.sidebarEntry) {
      descriptor.sidebarEntry = skill.sidebarEntry;
    }
    if (skill.workspace) {
      descriptor.workspace = skill.workspace;
    }

    return descriptor;
  }

  /**
   * Notify all subscribers that the registry has changed.
   */
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[WorkspaceRegistry] Listener error:', error);
      }
    }
  }
}

// ─── Singleton Export ──────────────────────────────────────

/** Singleton instance — import this everywhere */
export const WorkspaceRegistry = new WorkspaceRegistryService();

export default WorkspaceRegistry;
```

---

## File 3: Modification to `src/main.ts`

Add the `get-workspace-skills` IPC handler. Insert this near the existing `get-skills` handler. Find the `ipcMain.handle('get-skills', ...)` block and add the new handler after it:

```typescript
// ─── Workspace Skills IPC ──────────────────────────────────

/**
 * get-workspace-skills
 * Discovers skills that declare workspace/sidebar capability.
 * Scans agent/skills/*/ for SKILL.md frontmatter + plugin.json files.
 */
ipcMain.handle('get-workspace-skills', async (_event, args) => {
  try {
    const { projectPath } = args || {};
    const skillsBasePath = projectPath
      ? path.join(projectPath, 'agent', 'skills')
      : path.join(app.getPath('userData'), 'agent', 'skills');

    if (!fs.existsSync(skillsBasePath)) {
      return { success: true, data: [] };
    }

    const entries = fs.readdirSync(skillsBasePath, { withFileTypes: true });
    const workspaceSkills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(skillsBasePath, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const pluginJsonPath = path.join(skillDir, 'plugin.json');

      // Base descriptor from directory name
      let descriptor: Record<string, any> = {
        id: entry.name,
        name: entry.name,
        category: 'custom',
        skillPath: skillDir,
      };

      // Read SKILL.md frontmatter for skill metadata
      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, 'utf8');
          const fm = parseSimpleFrontmatter(content);
          if (fm) {
            descriptor.id = fm.id || descriptor.id;
            descriptor.name = fm.name || descriptor.name;
            descriptor.category = fm.category || descriptor.category;
            descriptor.version = fm.version || descriptor.version;
            descriptor.description = fm.description || descriptor.description;

            // Frontmatter can declare workspace config directly
            if (fm.sidebar) {
              try {
                descriptor.sidebarEntry = typeof fm.sidebar === 'string'
                  ? JSON.parse(fm.sidebar)
                  : fm.sidebar;
              } catch { /* ignore malformed sidebar */ }
            }
            if (fm.workspace) {
              try {
                descriptor.workspaceConfig = typeof fm.workspace === 'string'
                  ? JSON.parse(fm.workspace)
                  : fm.workspace;
              } catch { /* ignore malformed workspace */ }
            }
          }
        } catch (e) {
          console.warn(`[WorkspaceRegistry] Failed to read SKILL.md for ${entry.name}:`, e.message);
        }
      }

      // plugin.json takes precedence over SKILL.md for workspace config
      if (fs.existsSync(pluginJsonPath)) {
        try {
          const pluginConfig = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
          descriptor = { ...descriptor, ...pluginConfig, skillPath: skillDir };
        } catch (e) {
          console.warn(`[WorkspaceRegistry] Failed to parse plugin.json for ${entry.name}:`, e.message);
        }
      }

      // Only include skills that declare workspace or sidebar capability
      if (descriptor.sidebarEntry || descriptor.workspace || descriptor.workspaceConfig) {
        // Normalize workspaceConfig → workspace
        if (descriptor.workspaceConfig && !descriptor.workspace) {
          descriptor.workspace = descriptor.workspaceConfig;
          delete descriptor.workspaceConfig;
        }
        workspaceSkills.push(descriptor);
      }
    }

    return { success: true, data: workspaceSkills };
  } catch (error: any) {
    console.error('[WorkspaceRegistry] get-workspace-skills error:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

/**
 * Simple YAML frontmatter parser.
 * Handles key: value pairs on single lines.
 * Does NOT handle nested objects, arrays, or multi-line values.
 */
function parseSimpleFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, any> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    // Skip if key is empty or looks like a nested object start
    if (!key || rawValue.startsWith('|') || rawValue.startsWith('>')) continue;

    // Simple type coercion
    if (rawValue === 'true') result[key] = true;
    else if (rawValue === 'false') result[key] = false;
    else if (rawValue === 'null') result[key] = null;
    else if (/^-?\d+$/.test(rawValue)) result[key] = parseInt(rawValue, 10);
    else if (/^-?\d+\.\d+$/.test(rawValue)) result[key] = parseFloat(rawValue);
    else result[key] = rawValue;
  }

  return result;
}
```

**Important:** The `parseSimpleFrontmatter` function should be placed at the module level (not inside the IPC handler). If `main.ts` already has a frontmatter parser, use that instead and skip this function. Also, make sure `fs` and `path` are already imported at the top of `main.ts` — they should be since it's the main Electron process.

---

## File 4: Modification to `src/preload.ts`

Add the `getWorkspaceSkills` method to the `deskflowAPI` object exposed via `contextBridge.exposeInMainWorld`. Find the existing API object and add this entry:

```typescript
getWorkspaceSkills: (projectPath?: string) =>
  ipcRenderer.invoke('get-workspace-skills', { projectPath }),
```

It should be added alongside the existing skill-related bridges. For example, if you see:

```typescript
getSkills: () => ipcRenderer.invoke('get-skills'),
```

Add the new method right after it.

---

## Verification

After implementing all 4 changes, run:

```bash
npm run build
```

This should compile without errors. The registry won't visibly change the UI yet — that's Phase 2. But you can verify Phase 1 works by adding a temporary console log in `App.tsx`:

```typescript
// Temporary — remove after verifying Phase 1
import { WorkspaceRegistry } from './services/WorkspaceRegistry';
// Inside a useEffect:
useEffect(() => {
  WorkspaceRegistry.initialize().then(() => {
    console.log('[Phase 1] Registered plugins:', WorkspaceRegistry.getAllPlugins().map(p => p.id));
    console.log('[Phase 1] Sidebar entries:', WorkspaceRegistry.getSidebarEntries());
  });
}, []);
```

Expected output:
```
[Phase 1] Registered plugins: ['design-workspace']
[Phase 1] Sidebar entries: [{ label: 'Design', icon: 'palette', route: '/workspace/design', order: 50 }]
```

---

## Summary of Phase 1

| Item | Status | File |
|------|--------|------|
| SkillPlugin types | ✅ Created | `src/types/SkillPlugin.ts` |
| WorkspaceRegistry service | ✅ Created | `src/services/WorkspaceRegistry.ts` |
| IPC handler (scan skills) | ✅ Added | `src/main.ts` |
| Preload bridge | ✅ Added | `src/preload.ts` |
| Built-in Design Workspace plugin | ✅ Registered | In `WorkspaceRegistry.ts` |
| composeContext architecture | ✅ Designed | Register/unregister pattern |

**What Phase 2 will build on top of this:**
- `Sidebar.tsx` reads `WorkspaceRegistry.getSidebarEntries()` → renders "Design" entry
- `App.tsx` adds `/workspace/design` route → renders `DesignWorkspacePage`
- `DesignWorkspacePage.tsx` calls `WorkspaceRegistry.registerComposeContext(...)` on mount