# RESULT — Design Library Integration Architecture

---

## 1. Summary

DeskFlow's workspace Design tab currently offers 5 local skills, 8 local style references, taste knobs, a color picker, and free-text description — all assembled into XML context sent to AI agents via terminal write. This specification integrates three external design libraries into that pipeline:

| Library | Integration Method | Justification |
|---------|-------------------|---------------|
| **21st.dev** | `MCP_PROXY` — Main process spawns `@21st-dev/magic` as child process, speaks MCP JSON-RPC over stdio, exposes tools via IPC | Already configured in opencode.json with API key; MCP is the native access method |
| **Aceternity UI** | `HYBRID` — Registry fetch over HTTPS for catalog/browsing; CLI bridge (`npx -y aceternity-ui`) for installation; MCP for agent access | Registry is static JSON (no auth needed); CLI is the official install method; MCP server exists for agent sessions |
| **Refero** | `MCP_PROXY` — Same MCP client infrastructure as 21st.dev, plus HTTP fallback for catalog browsing | Refero's primary distribution is via MCP and DESIGN.md files; HTTP fallback for when MCP is unavailable |

The architecture introduces a **generic MCPClientService** in the main process that can spawn any MCP server, perform the JSON-RPC handshake, list tools, and call tools — then expose results to the renderer via IPC. This single infrastructure serves both 21st.dev and Refero (and any future MCP servers).

For Aceternity UI, the main process fetches the component registry over HTTPS and caches it locally. The CLI is only invoked when the user chooses to install a component into their project.

All three sources surface in a new **Design Library Sources** section in the Design tab, with status cards, a shared **Component Browser Modal**, and a **Library Configuration Modal**. Imported components are injected into the existing XML design context under a new `<imported_components>` section.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           RENDERER                                       │
│                                                                          │
│  DesignWorkspacePage                                                     │
│  ┌────────────────┬────────────────┐                                     │
│  │ TasteKnobs     │ StyleReferences│  ← existing, unchanged              │
│  ├────────────────┼────────────────┤                                     │
│  │ StyleDesc      │ ColorPicker    │  ← existing, unchanged              │
│  ├────────────────┴────────────────┤                                     │
│  │ DesignLibrarySources            │  ← NEW: 3 source cards             │
│  │ [21st.dev] [Aceternity] [Refero]│                                     │
│  ├─────────────────────────────────┤                                     │
│  │ DesignComposeOutlet             │  ← ENHANCED: shows imported count  │
│  └─────────────────────────────────┘                                     │
│                                                                          │
│  ComponentBrowserModal          ← NEW: search/browse/add components      │
│  LibraryConfigModal             ← NEW: API keys, connection test         │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │ IPC (preload.ts bridges)
┌────────────────────────▼─────────────────────────────────────────────────┐
│                        MAIN PROCESS                                      │
│                                                                          │
│  MCPClientService                ← NEW: generic MCP JSON-RPC client      │
│  ├─ servers: Map<id, MCPServerInstance>                                  │
│  ├─ spawnServer(config) → child_process                                 │
│  ├─ initialize(serverId) → JSON-RPC handshake                           │
│  ├─ listTools(serverId) → tools/list                                    │
│  ├─ callTool(serverId, name, args) → tools/call                         │
│  └─ shutdown(serverId)                                                  │
│                                                                          │
│  AceternityRegistryService       ← NEW: HTTPS registry fetcher           │
│  ├─ fetchRegistry() → GET registry JSON                                 │
│  ├─ getComponent(slug) → GET component detail                           │
│  └─ installComponent(slug, cwd) → npx CLI                               │
│                                                                          │
│  ReferoService                   ← NEW: MCP-first, HTTP fallback         │
│  ├─ fetchCatalog() → MCP call or HTTP scrape                            │
│  ├─ getDesignSystem(slug) → MCP call or HTTP fetch                      │
│  └─ searchSystems(query) → MCP call                                     │
│                                                                          │
│  DesignCacheService              ← NEW: file-based cache                 │
│  ├─ get(key) → read from agent/design-caches/                           │
│  ├─ set(key, data, ttlMs) → write to cache                              │
│  └─ isStale(key, ttlMs) → check timestamp                              │
└──────────────────────────────────────────────────────────────────────────┘

Data Flow (21st.dev example):
  Renderer: user clicks "Browse" on 21st.dev card
    → IPC: mcp-list-tools('21st-dev')
    → Main: MCPClientService.callTool('21st-dev', 'search_components', {query: ''})
    → Main: writes JSON-RPC to MCP server stdin
    → MCP server processes, writes response to stdout
    → Main: reads JSON-RPC response from stdout
    → Main: returns results via IPC
    → Renderer: displays in ComponentBrowserModal
```

---

## 3. Detailed Specifications

### 3A. 21st.dev

#### Integration Method: `MCP_PROXY`

**Justification:** 21st.dev is already configured as an MCP server in `opencode.json` with a valid API key. The MCP server provides the canonical access to component search and generation. Rather than reverse-engineering a hypothetical HTTP API, we use the MCP server directly from the main process.

#### MCP Server Configuration

Source: existing `opencode.json`:
```json
{
  "mcp": {
    "@21st-dev/magic": {
      "type": "local",
      "command": ["npx", "-y", "@21st-dev/magic@latest"],
      "environment": {
        "API_KEY": "ca1bf4b10075eb2c0c21f381a168d90db640ddb990b6c0c0d9fc06523c952f4f"
      }
    }
  }
}
```

**Internal server ID:** `21st-dev`
**Spawn command:** `npx -y @21st-dev/magic@latest`
**Environment:** `API_KEY` read from `opencode.json` or from user configuration

#### Known/Expected MCP Tools

Based on 21st.dev's public documentation and MCP conventions:

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `search_components` | Search React components by description | `{ query: string }` |
| `get_component` | Get full component code and metadata | `{ componentId: string }` |
| `search_logos` | Search brand logos | `{ query: string }` |
| `generate_component` | Generate a component from description | `{ description: string, framework?: string }` |

*Note: Exact tool names and schemas will be confirmed at implementation time by calling `tools/list` after initialization. The specification above is based on reasonable assumptions; the implementation must read actual tool definitions dynamically.*

#### IPC Channels

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `mcp-list-tools` | renderer→main | `{ serverId: string }` | `{ success: boolean, tools: MCPToolDef[], error?: string }` |
| `mcp-call-tool` | renderer→main | `{ serverId: string, toolName: string, args: Record<string, any> }` | `{ success: boolean, result: any, error?: string }` |
| `mcp-server-status` | renderer→main | `{ serverId: string }` | `{ status: 'running' \| 'stopped' \| 'error', uptime?: number, toolCount?: number }` |
| `mcp-start-server` | renderer→main | `{ serverId: string }` | `{ success: boolean, error?: string }` |
| `mcp-stop-server` | renderer→main | `{ serverId: string }` | `{ success: boolean }` |

#### TypeScript Interfaces

```typescript
// ─── MCP Infrastructure ────────────────────────────────────────────────────

interface MCPServerConfig {
  id: string;
  label: string;
  command: string[];
  environment: Record<string, string>;
  autoStart?: boolean;
}

interface MCPToolDef {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ─── 21st.dev Specific ─────────────────────────────────────────────────────

interface Component21st {
  id: string;
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  code?: string;
  source: '21st.dev';
}

interface ComponentSearchResult21st {
  components: Component21st[];
  total: number;
  query: string;
}
```

#### Connection Lifecycle

1. App starts → `MCPClientService` reads config from `opencode.json` and `design-library-config` localStorage (via IPC)
2. If `21st-dev` is enabled, main process spawns `npx -y @21st-dev/magic@latest` with API_KEY env var
3. Main process sends JSON-RPC `initialize` request, waits for response
4. Main process sends `notifications/initialized` notification
5. Server is now ready — `mcp-server-status` returns `{ status: 'running' }`
6. Renderer can call `mcp-list-tools` and `mcp-call-tool` through IPC
7. On app quit, main process sends shutdown notification and kills child process

#### Error Handling

| Error | Detection | Response |
|-------|-----------|----------|
| `npx` not found | `spawn` throws ENOENT | Return `{ status: 'error', error: 'npx not found. Install Node.js.' }` |
| API key invalid | MCP server returns error in `initialize` or tool call | Return error, show in UI as "Authentication failed" |
| Server crash | Child process `exit` event | Set status to `error`, attempt auto-restart once |
| Timeout (no response in 15s) | Request timeout | Return error, suggest checking network |
| Rate limit | MCP server returns rate limit error | Return error with retry-after hint |

---

### 3B. Aceternity UI

#### Integration Method: `HYBRID` (Registry Fetch + CLI Bridge + MCP)

**Justification:** Aceternity UI provides three access methods. The component registry is publicly accessible as JSON over HTTPS (shadcn-compatible format), requiring no authentication for browsing. The CLI is the official installation mechanism. An MCP server exists for agent access during coding sessions. We use all three:

1. **Registry Fetch** (primary for browsing) — HTTPS GET, no auth, cacheable
2. **CLI Bridge** (for installation) — `npx -y aceternity-ui@latest add [component]`
3. **MCP** (for agent access) — `@aceternity-ui/mcp` or shadcn MCP

#### Registry Format

Aceternity UI uses a shadcn-compatible registry. The registry URL pattern:

```
Base URL: https://ui.aceternity.com
Registry: https://ui.aceternity.com/registry.json
Component: https://ui.aceternity.com/registry/{slug}.json
```

**Registry index schema (shadcn format):**

```typescript
interface AceternityRegistryIndex {
  name: string;
  components: AceternityRegistryItem[];
}

interface AceternityRegistryItem {
  name: string;           // e.g., "hero-section"
  slug: string;           // URL-safe identifier
  type: 'registry:component' | 'registry:ui';
  description?: string;
  category?: string;      // e.g., "Hero Sections", "Cards", "Backgrounds"
  dependencies?: string[];
  files: Array<{
    name: string;
    path: string;         // e.g., "components/hero-section.tsx"
    content: string;      // Full source code
  }>;
}
```

*Note: The exact registry URL and schema will be confirmed at implementation time. If the public registry URL is not available, fallback to scraping the component listing page at `https://ui.aceternity.com/components` and parsing the HTML for component metadata. The component code can then be fetched via CLI `npx aceternity-ui add --dry-run [component]` to capture output without writing files.*

#### CLI Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `npx -y aceternity-ui@latest list` | List all available components | Component names (stdout) |
| `npx -y aceternity-ui@latest add [component]` | Install component to project | Files written to project directory |
| `npx -y aceternity-ui@latest add [component] --dry-run` | Preview component code without writing | Component code (stdout) |

*Note: If `--dry-run` is not supported, the alternative is to fetch the component JSON from the registry URL directly.*

#### IPC Channels

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `fetch-aceternity-registry` | renderer→main | `{ forceRefresh?: boolean }` | `{ success: boolean, components: AceternityComponent[], total: number, error?: string }` |
| `fetch-aceternity-component` | renderer→main | `{ slug: string }` | `{ success: boolean, component: AceternityComponentDetail, error?: string }` |
| `install-aceternity-component` | renderer→main | `{ slug: string, projectPath: string }` | `{ success: boolean, filesWritten: string[], error?: string }` |

#### TypeScript Interfaces

```typescript
interface AceternityComponent {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  dependencyCount: number;
  source: 'aceternity';
}

interface AceternityComponentDetail {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  code: string;               // Full component source
  dependencies: string[];     // npm package dependencies
  files: Array<{
    name: string;
    path: string;
    content: string;
  }>;
  source: 'aceternity';
}
```

#### Service: AceternityRegistryService

```
Location: src/services/AceternityRegistryService.ts (conceptual — implemented in main.ts)

Methods:
  fetchRegistry(forceRefresh?: boolean): Promise<AceternityComponent[]>
    - Check cache: agent/design-caches/aceternity/registry.json
    - If cache exists and age < 24h and !forceRefresh, return cached
    - HTTPS GET https://ui.aceternity.com/registry.json
    - Parse response into AceternityComponent[]
    - Write to cache
    - Return results

  fetchComponent(slug: string): Promise<AceternityComponentDetail>
    - Check cache: agent/design-caches/aceternity/components/{slug}.json
    - If cached, return it
    - HTTPS GET https://ui.aceternity.com/registry/{slug}.json
    - Parse into AceternityComponentDetail
    - Write to cache
    - Return result

  installComponent(slug: string, projectPath: string): Promise<{ filesWritten: string[] }>
    - Spawn: npx -y aceternity-ui@latest add {slug}
    - Set cwd to projectPath
    - Capture stdout/stderr
    - Return list of files written (parsed from CLI output)
```

---

### 3C. Refero

#### Integration Method: `MCP_PROXY` (primary) + `HTTP_FALLBACK` (secondary)

**Justification:** Refero's primary distribution method is via MCP server. The DESIGN.md files contain structured design tokens and component specifications that are perfect for AI consumption. The MCP server provides search and retrieval tools. For cases where MCP is unavailable (network issues, API key problems), we fall back to HTTP fetching from the Refero website.

#### MCP Server Configuration

**Assumed MCP package:** `@refero/mcp` (to be confirmed at implementation time)

```json
{
  "refero": {
    "type": "local",
    "command": ["npx", "-y", "@refero/mcp@latest"],
    "environment": {
      "REFERO_API_KEY": ""
    }
  }
}
```

*Note: If Refero does not offer a public MCP server package, the fallback is pure HTTP integration. The architecture supports both paths transparently.*

#### Expected MCP Tools

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `list_design_systems` | List available design systems | `{ category?: string, page?: number, limit?: number }` |
| `search_design_systems` | Search design systems by keyword | `{ query: string }` |
| `get_design_system` | Get full DESIGN.md for a system | `{ slug: string }` |
| `list_categories` | List design system categories | `{}` |

*Note: Exact tool definitions discovered dynamically via `tools/list`.*

#### HTTP Fallback Endpoints

If MCP is unavailable, these are the assumed HTTP endpoints (to be verified):

```
Base URL: https://styles.refero.design
API: https://styles.refero.design/api/v1
  GET /systems              → List design systems (paginated)
  GET /systems/{slug}       → Get design system detail + DESIGN.md
  GET /categories           → List categories
  GET /search?q={query}     → Search systems
```

*If no public API exists, the fallback is to scrape the website's HTML and extract metadata from the page structure. This is fragile and should be treated as last resort.*

#### IPC Channels

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `fetch-refero-catalog` | renderer→main | `{ forceRefresh?: boolean, category?: string, query?: string }` | `{ success: boolean, systems: ReferoSystem[], total: number, error?: string }` |
| `fetch-refero-system` | renderer→main | `{ slug: string }` | `{ success: boolean, system: ReferoDesignSystem, error?: string }` |
| `search-refero-systems` | renderer→main | `{ query: string }` | `{ success: boolean, systems: ReferoSystem[], error?: string }` |

#### TypeScript Interfaces

```typescript
interface ReferoSystem {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnailUrl?: string;
  componentCount: number;
  source: 'refero';
}

interface ReferoDesignSystem {
  slug: string;
  name: string;
  description: string;
  category: string;
  designMd: string;             // Full DESIGN.md content
  tokens: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    borderRadius: Record<string, string>;
  };
  components: Array<{
    name: string;
    category: string;
    description: string;
  }>;
  source: 'refero';
}
```

#### Service: ReferoService

```
Location: src/services/ReferoService.ts (conceptual — implemented in main.ts)

Methods:
  fetchCatalog(forceRefresh?: boolean): Promise<ReferoSystem[]>
    - Check cache: agent/design-caches/refero/catalog.json
    - If cache exists and age < 24h and !forceRefresh, return cached
    - Try MCP: callTool('refero', 'list_design_systems', {})
    - If MCP fails, try HTTP: GET https://styles.refero.design/api/v1/systems
    - If HTTP fails, try scraping
    - Parse into ReferoSystem[]
    - Write to cache
    - Return results

  fetchDesignSystem(slug: string): Promise<ReferoDesignSystem>
    - Check cache: agent/design-caches/refero/systems/{slug}.json
    - Try MCP: callTool('refero', 'get_design_system', { slug })
    - If MCP fails, try HTTP: GET /api/v1/systems/{slug}
    - Parse DESIGN.md content into structured tokens
    - Write to cache
    - Return result

  searchSystems(query: string): Promise<ReferoSystem[]>
    - Try MCP: callTool('refero', 'search_design_systems', { query })
    - If MCP fails, filter cached catalog by name/description/tags
    - Return matching systems
```

---

## 4. Backend Implementation Spec

### 4A. MCPClientService

**Location:** Logic in `src/main.ts` (or extracted to `src/services/MCPClientService.ts` if build supports it)

**Core implementation approach:**

```
MCPClientService class:
  private servers: Map<string, MCPServerInstance>
  private pendingRequests: Map<string, { resolve, reject, timeout }>

  MCPServerInstance:
    process: ChildProcess
    status: 'starting' | 'running' | 'error' | 'stopped'
    tools: MCPToolDef[]
    requestCounter: number
    buffer: string              // stdout buffer for partial reads
    initPromise: Promise<void>  // resolves when handshake complete

  startServer(config: MCPServerConfig): Promise<void>
    1. Spawn child_process with config.command, env: { ...process.env, ...config.environment }
    2. Set stdio to ['pipe', 'pipe', 'pipe']
    3. Attach data handler to stdout: buffer incoming, parse newline-delimited JSON-RPC
    4. Attach data handler to stderr: log for debugging
    5. Attach exit handler: set status to 'stopped', clean up
    6. Send initialize request:
       { jsonrpc: "2.0", id: 1, method: "initialize", params: {
         protocolVersion: "2024-11-05",
         capabilities: { tools: {} },
         clientInfo: { name: "deskflow", version: "1.0.0" }
       }}
    7. Wait for initialize response
    8. Send initialized notification:
       { jsonrpc: "2.0", method: "notifications/initialized" }
    9. Call tools/list to discover available tools
   10. Store tools in MCPServerInstance
   11. Set status to 'running'

  listTools(serverId: string): MCPToolDef[]
    - Return cached tools from MCPServerInstance

  callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<MCPCallResult>
    1. Get MCPServerInstance
    2. Verify status === 'running'
    3. Generate unique request ID (increment counter)
    4. Create pending request entry with 30s timeout
    5. Write to stdin:
       { jsonrpc: "2.0", id: requestId, method: "tools/call",
         params: { name: toolName, arguments: args } }
    6. Wait for response (resolve from pendingRequests)
    7. Parse result.content from JSON-RPC response
    8. Return MCPCallResult

  stopServer(serverId: string): void
    1. Kill child process
    2. Set status to 'stopped'
    3. Reject all pending requests

  private handleStdoutData(serverId: string, data: Buffer): void
    1. Append to buffer
    2. Split by newline
    3. For each complete line, parse as JSON-RPC
    4. If response has id: resolve pendingRequest
    5. If notification: handle accordingly

  getServerStatus(serverId: string): { status, toolCount, uptime }
```

**MCP Server Configuration Source:**

The MCP server configs are read from two sources (merged, with user config taking priority):

1. `opencode.json` — existing project configuration (read via file IPC)
2. `design-library-config` — localStorage-sourced config (read via IPC from renderer)

```typescript
const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: '21st-dev',
    label: '21st.dev',
    command: ['npx', '-y', '@21st-dev/magic@latest'],
    environment: {}, // API key loaded from opencode.json or user config
    autoStart: true,
  },
  {
    id: 'refero',
    label: 'Refero',
    command: ['npx', '-y', '@refero/mcp@latest'],
    environment: {},
    autoStart: false, // Only starts when user enables it
  },
  {
    id: 'aceternity',
    label: 'Aceternity UI',
    command: ['npx', '-y', '@aceternity-ui/mcp@latest'],
    environment: {},
    autoStart: false,
  },
];
```

### 4B. IPC Channels — Complete List

All new channels to add to `src/preload.ts` and `src/main.ts`:

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `mcp-list-tools` | renderer→main | `{ serverId: string }` | `{ success: boolean, tools: MCPToolDef[], error?: string }` |
| `mcp-call-tool` | renderer→main | `{ serverId: string, toolName: string, args: Record<string, any> }` | `{ success: boolean, result: any, error?: string }` |
| `mcp-server-status` | renderer→main | `{ serverId: string }` | `{ status: 'running' \| 'stopped' \| 'error', toolCount?: number, error?: string }` |
| `mcp-start-server` | renderer→main | `{ serverId: string }` | `{ success: boolean, error?: string }` |
| `mcp-stop-server` | renderer→main | `{ serverId: string }` | `{ success: boolean }` |
| `fetch-aceternity-registry` | renderer→main | `{ forceRefresh?: boolean }` | `{ success: boolean, components: AceternityComponent[], total: number, error?: string }` |
| `fetch-aceternity-component` | renderer→main | `{ slug: string }` | `{ success: boolean, component: AceternityComponentDetail, error?: string }` |
| `install-aceternity-component` | renderer→main | `{ slug: string, projectPath: string }` | `{ success: boolean, filesWritten: string[], error?: string }` |
| `fetch-refero-catalog` | renderer→main | `{ forceRefresh?: boolean, query?: string }` | `{ success: boolean, systems: ReferoSystem[], total: number, error?: string }` |
| `fetch-refero-system` | renderer→main | `{ slug: string }` | `{ success: boolean, system: ReferoDesignSystem, error?: string }` |
| `search-refero-systems` | renderer→main | `{ query: string }` | `{ success: boolean, systems: ReferoSystem[], error?: string }` |
| `get-design-library-config` | renderer→main | `{}` | `DesignLibraryConfig` |
| `set-design-library-config` | renderer→main | `DesignLibraryConfig` | `{ success: boolean }` |
| `get-design-cached-data` | renderer→main | `{ key: string }` | `{ success: boolean, data?: any, timestamp?: number }` |
| `test-design-library-connection` | renderer→main | `{ serverId: string }` | `{ success: boolean, latency?: number, toolCount?: number, error?: string }` |

### 4C. Preload Bridge Additions

Add to `src/preload.ts`:

```typescript
// ─── Design Library Integration ────────────────────────────────────────────

mcpListTools: (serverId: string) =>
  ipcRenderer.invoke('mcp-list-tools', { serverId }),

mcpCallTool: (serverId: string, toolName: string, args: Record<string, any>) =>
  ipcRenderer.invoke('mcp-call-tool', { serverId, toolName, args }),

mcpServerStatus: (serverId: string) =>
  ipcRenderer.invoke('mcp-server-status', { serverId }),

mcpStartServer: (serverId: string) =>
  ipcRenderer.invoke('mcp-start-server', { serverId }),

mcpStopServer: (serverId: string) =>
  ipcRenderer.invoke('mcp-stop-server', { serverId }),

fetchAceternityRegistry: (forceRefresh?: boolean) =>
  ipcRenderer.invoke('fetch-aceternity-registry', { forceRefresh }),

fetchAceternityComponent: (slug: string) =>
  ipcRenderer.invoke('fetch-aceternity-component', { slug }),

installAceternityComponent: (slug: string, projectPath: string) =>
  ipcRenderer.invoke('install-aceternity-component', { slug, projectPath }),

fetchReferoCatalog: (forceRefresh?: boolean) =>
  ipcRenderer.invoke('fetch-refero-catalog', { forceRefresh }),

fetchReferoSystem: (slug: string) =>
  ipcRenderer.invoke('fetch-refero-system', { slug }),

searchReferoSystems: (query: string) =>
  ipcRenderer.invoke('search-refero-systems', { query }),

getDesignLibraryConfig: () =>
  ipcRenderer.invoke('get-design-library-config'),

setDesignLibraryConfig: (config: any) =>
  ipcRenderer.invoke('set-design-library-config', config),

getDesignCachedData: (key: string) =>
  ipcRenderer.invoke('get-design-cached-data', { key }),

testDesignLibraryConnection: (serverId: string) =>
  ipcRenderer.invoke('test-design-library-connection', { serverId }),
```

### 4D. DesignCacheService

**File system structure:**

```
agent/design-caches/
├── aceternity/
│   ├── registry.json          # Full component catalog (cached 24h)
│   └── components/
│       ├── hero-section.json  # Individual component details
│       ├── feature-card.json
│       └── ...
├── refero/
│   ├── catalog.json           # Design system catalog (cached 24h)
│   └── systems/
│       ├── linear.json        # Individual design system details
│       ├── vercel.json
│       └── ...
└── meta.json                  # Cache metadata (timestamps, version)
```

**Cache entry format:**

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;     // Date.now() at write time
  ttl: number;           // TTL in ms
  version: string;       // Schema version for migration
}
```

**IPC handlers in main.ts:**

```typescript
ipcMain.handle('get-design-cached-data', async (_event, { key }) => {
  const cacheDir = path.join(app.getPath('userData'), 'agent', 'design-caches');
  const filePath = path.join(cacheDir, `${key}.json`);
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const entry: CacheEntry<any> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      return { success: true, data: entry.data, timestamp: entry.timestamp, stale: true };
    }
    return { success: true, data: entry.data, timestamp: entry.timestamp, stale: false };
  } catch {
    return { success: false };
  }
});
```

---

## 5. Frontend Design Spec

### 5A. Enhanced Design Tab Layout

The Design tab in the workspace sidebar currently uses a 2-column grid with 4 sections. We add a new row for Design Library Sources and enhance the Compose Outlet.

**Current layout (2×2 grid + full-width outlet):**
```
┌──────────────┬──────────────┐
│ TasteKnobs   │ StyleRefs    │
├──────────────┼──────────────┤
│ StyleDesc    │ ColorPicker  │
├──────────────┴──────────────┤
│ DesignComposeOutlet         │
└─────────────────────────────┘
```

**Enhanced layout (2×2 grid + 3-col sources + enhanced outlet):**
```
┌──────────────┬──────────────┐
│ TasteKnobs   │ StyleRefs    │
├──────────────┼──────────────┤
│ StyleDesc    │ ColorPicker  │
├──────────────┴──────────────┤
│ DesignLibrarySources        │
│ [21st] [Aceternity] [Refero]│
├─────────────────────────────┤
│ DesignComposeOutlet         │
│ (+ imported count badge)    │
└─────────────────────────────┘
```

### 5B. DesignLibrarySources Component

**New file:** `src/components/workspace/DesignLibrarySources.tsx`

```
Layout: 3 cards in a single row (grid-cols-3)
Each card: GlassCard variant with accent top border

Card structure:
┌─────────────────────────┐
│ [icon] Source Name    [⋮]│  ← header row: icon + name + menu button
│ ● Connected · 150 items │  ← status line: dot + label + count
│ [Browse] [Configure]    │  ← action buttons
└─────────────────────────┘

Disconnected state:
┌─────────────────────────┐
│ [icon] Source Name    [⋮]│
│ ○ Not Connected          │
│ [Configure]              │  ← only Configure, no Browse
└─────────────────────────┘

Loading state:
┌─────────────────────────┐
│ [icon] Source Name    [⋮]│
│ ⟳ Connecting...          │
│ [Browse] [Configure]    │  ← Browse disabled
└─────────────────────────┘
```

**Tailwind classes for each card:**

```tsx
<div className="rounded-xl p-4 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60
  flex flex-col gap-2">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <SourceIcon className="w-4 h-4" style={{ color: accentColor }} />
      <span className="text-sm font-semibold text-zinc-100">{name}</span>
    </div>
    <button className="p-1 rounded-md text-zinc-600 hover:text-zinc-400
      hover:bg-zinc-800/60 transition-colors duration-150">
      <MoreVertical className="w-3.5 h-3.5" />
    </button>
  </div>

  {/* Status */}
  <div className="flex items-center gap-1.5 text-xs">
    <span className={cn(
      "w-1.5 h-1.5 rounded-full",
      status === 'running' ? 'bg-emerald-400' :
      status === 'error' ? 'bg-red-400' :
      'bg-zinc-600'
    )} />
    <span className={cn(
      status === 'running' ? 'text-zinc-400' :
      status === 'error' ? 'text-red-400' :
      'text-zinc-600'
    )}>
      {status === 'running' ? `Connected · ${itemCount} items` :
       status === 'error' ? 'Connection error' :
       'Not connected'}
    </span>
  </div>

  {/* Actions */}
  <div className="flex gap-2 mt-1">
    <button
      disabled={status !== 'running'}
      onClick={onBrowse}
      className="px-3 py-1.5 rounded-lg text-xs font-medium
        bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors duration-150"
    >
      Browse
    </button>
    <button
      onClick={onConfigure}
      className="px-3 py-1.5 rounded-lg text-xs font-medium
        text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40
        transition-colors duration-150"
    >
      Configure
    </button>
  </div>
</div>
```

**Source-specific accent colors and icons:**

| Source | Icon (lucide-react) | Accent Color | Top Border |
|--------|---------------------|-------------|------------|
| 21st.dev | `Sparkles` | `#22d3ee` (cyan-400) | `border-t border-cyan-400/30` |
| Aceternity | `Wand2` | `#a78bfa` (violet-400) | `border-t border-violet-400/30` |
| Refero | `BookOpen` | `#34d399` (emerald-400) | `border-t border-emerald-400/30` |

### 5C. ComponentBrowserModal

**New file:** `src/components/workspace/ComponentBrowserModal.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [X] Browse Components — {sourceName}                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔍 Search components...                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [All] [Cards] [Heroes] [Backgrounds] [Layouts] [Anim]  │  ← category pills
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Hero Card   │ │ Feature     │ │ Testimonial │       │  ← component grid
│  │ Animated    │ │ Grid Bento  │ │ Card Glow   │       │
│  │ hero with.. │ │ Responsive  │ │ Card with.. │       │
│  │ [Add →]     │ │ [Add →]     │ │ [Add →]     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ ...         │ │ ...         │ │ ...         │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  ─── Expanded component detail (on click) ──────────    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Hero Card                               [Add ✓] │   │
│  │ Animated hero section with gradient background   │   │
│  │ Tags: hero, animation, gradient                  │   │
│  │ Dependencies: framer-motion, clsx                │   │
│  │ ┌──────────────────────────────────────────────┐ │   │
│  │ │ // Component code preview                    │ │   │
│  │ │ function HeroCard() {                        │ │   │
│  │ │   return <div className="...">...</div>      │ │   │
│  │ │ }                                            │ │   │
│  │ └──────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Modal wrapper:**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.97 }}
    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    className="w-full max-w-3xl max-h-[80vh] rounded-xl bg-zinc-900/95
      backdrop-blur-xl border border-zinc-800/60 flex flex-col overflow-hidden"
  >
    {/* Content */}
  </motion.div>
</div>
```

**Search input:**
```tsx
<input
  value={searchQuery}
  onChange={(e) => debouncedSetQuery(e.target.value)}
  placeholder="Search components..."
  className="w-full bg-zinc-800/60 border border-zinc-800/60 rounded-lg
    px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600
    focus:outline-none focus:border-cyan-400/40
    transition-colors duration-150"
/>
```

**Category pills:**
```tsx
<div className="flex gap-1.5 overflow-x-auto pb-1">
  {categories.map(cat => (
    <button
      key={cat}
      onClick={() => setActiveCategory(cat)}
      className={cn(
        "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap",
        "transition-colors duration-150",
        activeCategory === cat
          ? "bg-zinc-700/60 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
      )}
    >
      {cat}
    </button>
  ))}
</div>
```

**Component card:**
```tsx
<div className="rounded-lg p-3 bg-zinc-800/40 border border-zinc-800/40
  hover:border-zinc-700/60 transition-colors duration-150
  flex flex-col gap-2 cursor-pointer"
  onClick={() => setExpandedSlug(item.slug)}
>
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium text-zinc-200">{item.name}</span>
    <span className="text-[10px] uppercase tracking-wider text-zinc-600 px-1.5 py-0.5
      rounded bg-zinc-800/60">{item.category}</span>
  </div>
  <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>
  <button
    onClick={(e) => { e.stopPropagation(); handleAddToContext(item); }}
    className="self-end px-2.5 py-1 rounded-md text-xs font-medium
      text-cyan-400 hover:bg-cyan-400/10
      transition-colors duration-150"
  >
    Add →
  </button>
</div>
```

**Code preview block:**
```tsx
<pre className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800/40
  text-xs text-zinc-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
  {component.code}
</pre>
```

**Grid layout for component cards:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2
  overflow-y-auto flex-1 px-1 pb-2">
  {filteredComponents.map(item => (
    <ComponentCard key={item.slug} item={item} />
  ))}
</div>
```

### 5D. LibraryConfigModal

**New file:** `src/components/workspace/LibraryConfigModal.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [X] Configure Design Libraries                          │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 21st.dev                                     ● ON   ││
│  │ ─────────────────────────────────────────────────── ││
│  │ API Key: [••••••••••••••••]  [Show] [Test]         ││
│  │ MCP Command: npx -y @21st-dev/magic@latest         ││
│  │ Status: ● Connected · 4 tools available             ││
│  │ [Start] [Stop]                                      ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Aceternity UI                                ● ON   ││
│  │ ─────────────────────────────────────────────────── ││
│  │ Registry: https://ui.aceternity.com/registry       ││
│  │ Cached: 200 components (updated 2h ago)             ││
│  │ [Refresh Cache] [Clear Cache]                       ││
│  │ MCP: npx -y @aceternity-ui/mcp@latest              ││
│  │ MCP Status: ○ Not started                           ││
│  │ [Start MCP]                                         ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Refero                                       ○ OFF  ││
│  │ ─────────────────────────────────────────────────── ││
│  │ API Key: [          ]  [Test]                       ││
│  │ MCP Command: npx -y @refero/mcp@latest             ││
│  │ Status: ○ Not connected                             ││
│  │ [Enable]                                            ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│                              [Save Configuration]       │
└─────────────────────────────────────────────────────────┘
```

**Config section (per source):**
```tsx
<div className="rounded-lg p-4 bg-zinc-800/30 border border-zinc-800/40
  flex flex-col gap-3">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <SourceIcon className="w-4 h-4" style={{ color: accentColor }} />
      <span className="text-sm font-semibold text-zinc-100">{name}</span>
    </div>
    <button
      onClick={() => toggleEnabled(sourceId)}
      className={cn(
        "relative w-10 h-5 rounded-full transition-colors duration-150",
        enabled ? "bg-cyan-400/30" : "bg-zinc-700"
      )}
    >
      <span className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-150",
        enabled ? "translate-x-5 bg-cyan-400" : "translate-x-0.5 bg-zinc-500"
      )} />
    </button>
  </div>

  {/* Separator */}
  <div className="border-t border-zinc-800/40" />

  {/* Fields (API key, command, status) */}
  {/* ... */}

  {/* Actions */}
  <div className="flex gap-2">
    <button className="px-3 py-1.5 rounded-lg text-xs font-medium
      bg-zinc-700/60 text-zinc-300 hover:bg-zinc-600/60
      transition-colors duration-150">
      Test Connection
    </button>
    <button className="px-3 py-1.5 rounded-lg text-xs font-medium
      text-zinc-500 hover:text-zinc-300
      transition-colors duration-150">
      Refresh Cache
    </button>
  </div>
</div>
```

### 5E. Enhanced DesignComposeOutlet

The existing outlet gets two additions:

1. **Imported components count badge** next to the "Send" button
2. **Source attribution** in the preview panel

```
Current:
┌─────────────────────────────────────────────┐
│ Design Context Preview               [Copy] │
│ ┌─────────────────────────────────────────┐ │
│ │ <design_taste>...                       │ │
│ │ <design_skills>...                      │ │
│ │ <design_references>...                  │ │
│ └─────────────────────────────────────────┘ │
│ [Send Design Context to Terminal]           │
└─────────────────────────────────────────────┘

Enhanced:
┌─────────────────────────────────────────────┐
│ Design Context Preview               [Copy] │
│ Sources: 21st.dev (2) · Aceternity (1)     │  ← NEW: source badges
│ ┌─────────────────────────────────────────┐ │
│ │ <design_taste>...                       │ │
│ │ <design_skills>...                      │ │
│ │ <design_references>...                  │ │
│ │ <imported_components>                   │ │  ← NEW: imported section
│ │   <component name="..." source="...">   │ │
│ │     <code>...</code>                    │ │
│ │   </component>                          │ │
│ │ </imported_components>                  │ │
│ └─────────────────────────────────────────┘ │
│ [Send Design Context to Terminal]  3 added  │  ← NEW: count badge
└─────────────────────────────────────────────┘
```

**Source badges:**
```tsx
<div className="flex items-center gap-1.5 text-xs text-zinc-500">
  <span>Sources:</span>
  {importedCounts.map(({ source, count }) => count > 0 && (
    <span key={source} className="inline-flex items-center gap-1 px-1.5 py-0.5
      rounded bg-zinc-800/60 text-zinc-400 text-[10px]">
      <SourceDot color={sourceAccentColor} />
      {source} ({count})
    </span>
  ))}
</div>
```

**Count badge next to Send button:**
```tsx
<div className="flex items-center gap-2">
  <button onClick={handleSend} className="...">
    Send Design Context to Terminal
  </button>
  {totalImported > 0 && (
    <span className="px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400
      text-xs font-medium">
      +{totalImported} added
    </span>
  )}
</div>
```

---

## 6. UX Flow Spec

### 6A. Discovery Flow

**First-time experience:**

1. User opens workspace → navigates to Design tab
2. DesignLibrarySources section is visible with 3 cards
3. 21st.dev card shows `● Connected` (auto-started from opencode.json config)
4. Aceternity card shows `● Connected` (registry fetch requires no auth)
5. Refero card shows `○ Not connected` (requires configuration)
6. If no sources are connected, a subtle hint appears:
   ```
   "Connect design libraries to browse 2000+ components and design systems"
   ```

**Tutorial integration (see §9 for documentation spec):**

INITIALIZE.md gets a new step:
```
- [ ] Design Libraries: Connect 21st.dev, Aceternity UI, and Refero for component browsing
```

The tutorial page (TutorialPage.tsx) gets a new feature entry:
```
Category: Workspace
Title: Design Library Integration
Description: Browse and import components from 21st.dev, Aceternity UI, and Refero directly in the Design tab
Spotlight target: DesignLibrarySources section
```

### 6B. Search and Selection Flow

**Step-by-step:**

1. User clicks **"Browse"** on a source card (e.g., Aceternity)
2. ComponentBrowserModal opens with search input and category pills
3. If source is MCP-based (21st.dev, Refero with MCP): main process calls `mcp-call-tool` with search tool
4. If source is registry-based (Aceternity): uses cached registry data
5. Results populate the component grid
6. User types in search → 300ms debounce → results filter
7. User clicks a category pill → results filter by category
8. User clicks a component card → card expands showing code preview
9. User clicks **"Add →"** button:
   - Component is added to `importedComponents` state in DesignWorkspacePage
   - Preview panel updates immediately (new `<imported_components>` section)
   - Source card updates count badge ("2 items imported")
   - Toast: `"Hero Card added to design context"`
10. User can add multiple components from multiple sources
11. User clicks **"Send Design Context to Terminal"** → full context (including imported components) sent to AI agent

**Multi-source disambiguation:**

Each component card and search result shows a source badge:
```
┌─────────────────────┐
│ Card Component      │
│ Animated card with..│
│ [Aceternity] [Add →]│  ← source badge in card
└─────────────────────┘
```

If multiple sources have similar components, both appear in search results with their source badges.

**Search across all sources:**

The ComponentBrowserModal has an "All Sources" tab that searches all connected sources simultaneously:

```
[All Sources] [21st.dev] [Aceternity] [Refero]
```

When "All Sources" is active, search calls are fired to all connected sources in parallel, and results are merged with source badges.

### 6C. Configuration Flow

**Setting up Refero (example of a source requiring API key):**

1. User clicks **"Configure"** on Refero card
2. LibraryConfigModal opens, scrolled to Refero section
3. Refero shows `○ OFF` toggle
4. User toggles to `● ON`
5. API key field appears (if required by MCP server)
6. User pastes API key → field shows `••••••••`
7. User clicks **"Test Connection"**:
   - IPC: `test-design-library-connection` with serverId `'refero'`
   - Main process: spawns MCP server, sends initialize, calls tools/list
   - If success: latency and tool count returned → card shows `● Connected · 4 tools`
   - If failure: error message shown inline
8. User clicks **"Save Configuration"**
   - IPC: `set-design-library-config` with updated config
   - Config persisted to localStorage
   - "Browse" button becomes enabled on Refero card

**API key security:**
- Keys are stored in `design-library-config` in localStorage (renderer-side)
- They are passed to the main process via IPC only when spawning MCP servers
- The main process passes them as environment variables to the child process
- Keys are never logged or displayed in full in the UI
- The config modal shows a masked version with a "Show" toggle

### 6D. AI Agent Usage Flow

**How agents access design libraries:**

The primary mechanism is the enhanced design context XML. When the user sends context to the terminal, the imported components are included:

```xml
<design_taste>
  design_variance="5"
  motion_intensity="7"
  visual_density="5"
</design_taste>

<style_notes>Dark theme with pink accent on zinc background</style_notes>

<color_palette>
  <color role="primary" hex="#ec4899" label="Pink" />
  <color role="background" hex="#18181b" label="Zinc" />
</color_palette>

<design_skills>
  [existing skill content]
</design_skills>

<design_references>
  <reference name="Linear">
    [existing reference content]
  </reference>
</design_references>

<imported_components>
  <component name="Hero Card" source="Aceternity UI" slug="hero-card" category="Hero Sections">
    <description>Animated hero section with gradient background and spotlight effect</description>
    <dependencies>framer-motion, clsx</dependencies>
    <code><![CDATA[
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function HeroCard() {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", ...)}>
      <motion.div ... />
    </div>
  );
}
    ]]></code>
  </component>
  <component name="Linear Design System" source="Refero" slug="linear" category="SaaS">
    <tokens>
      <color name="primary" value="#5E6AD2" />
      <color name="background" value="#0A0A0F" />
      <typography name="heading" value="Inter 600 24px/32px" />
      <spacing name="section-padding" value="64px" />
    </tokens>
  </component>
</imported_components>

<design_library_access>
  The following design libraries are available for browsing during this session.
  If you need additional components or design references, ask the user to browse
  and add them from the Design tab:
  - 21st.dev: {toolCount} tools available (search_components, get_component, search_logos, generate_component)
  - Aceternity UI: 200+ Tailwind CSS + Framer Motion components
  - Refero: 2000+ design systems with DESIGN.md files
</design_library_access>

[END DESIGN CONTEXT]
```

**Key design decisions:**

1. **Full code is included** (not just references) — AI agents need the actual implementation to work with it. A slug reference alone is useless unless the agent can fetch the code itself.

2. **`<design_library_access>` section** tells the agent what libraries are available and what tools they have. This way, the agent knows it can ask the user to add more components.

3. **For Refero design systems**, only tokens are included (not all component code, which would be too large). The agent gets the design language (colors, typography, spacing) and can apply it.

4. **Agent cannot directly invoke MCP or IPC** — if the agent needs a component not in the context, it must ask the user to browse and add it. The `<design_library_access>` section makes this clear.

**Future enhancement (not in initial implementation):**

A "Design Library Request" IPC event could allow agents to request components:
- Agent writes a special command to the terminal (e.g., `::request-component card animation`)
- SessionContextService detects the pattern
- Fires an IPC event to the renderer
- Renderer shows a notification: "Agent requests component: card animation. [Browse] [Dismiss]"
- If user clicks Browse, ComponentBrowserModal opens pre-filtered

This is documented as a future enhancement but NOT implemented in the initial version.

### 6E. Error and Edge Case Handling

| Scenario | Detection | UI Response | Recovery |
|----------|-----------|-------------|----------|
| API key invalid | MCP `initialize` returns auth error | Inline error on source card: "Authentication failed. Check API key." | User updates key in config modal |
| API rate limit | MCP tool call returns rate limit error | Toast: "Rate limit reached. Try again in a moment." | Auto-retry after delay (not shown to user) |
| Network offline | HTTPS fetch or MCP spawn fails | Source card: "○ Offline — network unavailable" | Auto-retry when network returns |
| MCP server crash | Child process exit event | Source card: "● Error — server crashed" + [Restart] button | User clicks Restart |
| `npx` not found | `spawn` throws ENOENT | Source card: "○ Setup required — Node.js not found" | User installs Node.js |
| Aceternity registry fetch fails | HTTPS error | Use cached data if available; otherwise show "○ Unavailable" | [Retry] button on card |
| Component code incompatible with Tailwind v4 | Not detectable automatically | Include component as-is; agent will adapt | Manual review by user |
| Empty search results | No results from MCP/registry | "No components found. Try different keywords." | User changes search |
| Multiple sources with same component name | Search results show duplicates | Each result has source badge for disambiguation | User picks the one they want |
| Imported component removed from library | Cached version still exists locally | Continue using cached version | No action needed |

**Graceful degradation:**

When ALL external sources fail:
- Existing design tab features (TasteKnobs, StyleReferences, ColorPicker, StyleDescription) continue to work normally
- DesignLibrarySources section shows "All sources unavailable. Using local references only."
- The `[END DESIGN CONTEXT]` XML simply omits the `<imported_components>` section

---

## 7. Data Storage Spec

### 7A. localStorage Schema

**Key:** `design-library-config`

```typescript
interface DesignLibraryConfig {
  version: 1;
  sources: {
    '21st-dev': {
      enabled: boolean;
      apiKey?: string;           // Masked in UI, stored here
      autoStart: boolean;
    };
    aceternity: {
      enabled: boolean;
      registryUrl: string;       // Default: https://ui.aceternity.com/registry
      mcpEnabled: boolean;
    };
    refero: {
      enabled: boolean;
      apiKey?: string;
      mcpCommand?: string;       // Override default MCP command
      autoStart: boolean;
    };
  };
}
```

**Default values:**

```typescript
const DEFAULT_CONFIG: DesignLibraryConfig = {
  version: 1,
  sources: {
    '21st-dev': { enabled: true, autoStart: true },
    aceternity: { enabled: true, registryUrl: 'https://ui.aceternity.com/registry', mcpEnabled: false },
    refero: { enabled: false, autoStart: false },
  },
};
```

**Key:** `design-imported-components`

```typescript
interface ImportedComponentsState {
  components: Array<{
    slug: string;
    name: string;
    source: '21st-dev' | 'aceternity' | 'refero';
    category: string;
    code?: string;              // Full component code (for Aceternity/21st.dev)
    tokens?: Record<string, any>; // Design tokens (for Refero)
    addedAt: string;            // ISO timestamp
  }>;
}
```

This is session-scoped: cleared when the user navigates away from the Design tab or closes the workspace. No persistent storage needed — the user re-selects components each session (this keeps the context focused and relevant).

### 7B. File System Cache Structure

```
{userData}/agent/design-caches/
├── meta.json                        # Cache metadata
│   { version: 1, lastCleanup: ISO }
│
├── aceternity/
│   ├── registry.json                # CacheEntry<AceternityComponent[]>
│   │   { data: [...], timestamp: 1749... , ttl: 86400000, version: "1" }
│   └── components/
│       ├── hero-section.json        # CacheEntry<AceternityComponentDetail>
│       ├── feature-card.json
│       └── ...
│
├── refero/
│   ├── catalog.json                 # CacheEntry<ReferoSystem[]>
│   └── systems/
│       ├── linear.json              # CacheEntry<ReferoDesignSystem>
│       ├── vercel.json
│       └── ...
│
└── 21st-dev/
    └── search-cache/
        ├── "card-components".json   # CacheEntry<ComponentSearchResult21st>
        └── ...
```

**Cache TTL values:**

| Data Type | TTL | Justification |
|-----------|-----|---------------|
| Aceternity registry | 24 hours | Component list changes infrequently |
| Aceternity component detail | 7 days | Code rarely changes |
| Refero catalog | 24 hours | New systems added periodically |
| Refero design system | 7 days | DESIGN.md content is stable |
| 21st.dev search results | 1 hour | Search results may vary |
| MCP tool definitions | App session | Refreshed on server restart |

**Cache invalidation triggers:**

- User clicks "Refresh Cache" in config modal → force refresh regardless of TTL
- User clicks "Browse" and cache is stale → background refresh while showing cached data
- App starts → no invalidation, serve from cache
- Source configuration changes (API key, enable/disable) → clear that source's cache

### 7C. API Key Storage

API keys are stored in `design-library-config` in localStorage. This is acceptable because:

1. The app is a local desktop Electron app (not a web app served over HTTP)
2. localStorage is scoped to the app's origin
3. Keys are passed to the main process only when spawning MCP servers, not logged

For enhanced security (future improvement), keys could be stored in the OS keychain via `safeStorage` API. This is documented but not implemented in the initial version.

**API key display rules:**
- Never show full key in UI logs
- Config modal shows masked key: `ca1b••••2f4f`
- "Show" toggle reveals full key temporarily
- IPC payloads containing keys are not logged by the main process

---

## 8. AI Agent Integration Spec

### 8A. Enhanced XML Context Format

The existing XML format is extended, not replaced. New sections are appended before `[END DESIGN CONTEXT]`:

```xml
<!-- EXISTING SECTIONS (unchanged) -->
<design_taste>...</design_taste>
<style_notes>...</style_notes>
<color_palette>...</color_palette>
<design_skills>...</design_skills>
<design_references>...</design_references>

<!-- NEW SECTIONS (appended when components are imported) -->
<imported_components>
  <component name="Hero Card" source="Aceternity UI" slug="hero-card" category="Hero Sections">
    <description>Animated hero section with gradient background and spotlight effect</description>
    <dependencies>framer-motion, clsx</dependencies>
    <code><![CDATA[
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function HeroCard() {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-cyan-500/20"
      />
      <div className="relative z-10 p-8">
        <h2 className="text-3xl font-bold text-white">Welcome</h2>
        <p className="mt-2 text-zinc-400">Build something amazing</p>
      </div>
    </div>
  );
}
    ]]></code>
  </component>

  <system name="Linear" source="Refero" slug="linear" category="SaaS">
    <description>Linear's design system — minimal, functional, dark-first</description>
    <tokens>
      <color name="primary" value="#5E6AD2" />
      <color name="background" value="#0A0A0F" />
      <color name="surface" value="#14141F" />
      <color name="text-primary" value="#E8E8ED" />
      <color name="text-secondary" value="#8B8B9E" />
      <color name="border" value="#1C1C2A" />
      <typography name="heading" value="Inter 600 24px/32px" />
      <typography name="body" value="Inter 400 14px/20px" />
      <typography name="mono" value="JetBrains Mono 400 13px/20px" />
      <spacing name="section" value="64px" />
      <spacing name="card-padding" value="24px" />
      <spacing name="element-gap" value="12px" />
      <border-radius name="card" value="12px" />
      <border-radius name="button" value="6px" />
    </tokens>
  </system>
</imported_components>

<design_library_access>
  Available design libraries (ask the user to browse and add more from the Design tab):
  - 21st.dev: Search and generate React components (search_components, get_component, generate_component, search_logos)
  - Aceternity UI: 200+ Tailwind CSS + Framer Motion components (hero sections, cards, backgrounds, animations)
  - Refero: 2000+ design systems with structured tokens (colors, typography, spacing, border-radius)
</design_library_access>

[END DESIGN CONTEXT]
```

### 8B. Code Inclusion vs. Reference

**Decision: Include full code for individual components; include only tokens for design systems.**

**Rationale:**

- **Individual components** (from Aceternity/21st.dev): Code is typically 20-80 lines. Including the full code allows the agent to immediately use it, modify it, or combine it with other components. A reference alone would be useless — the agent cannot fetch it.

- **Design systems** (from Refero): A full DESIGN.md can be 500-2000 lines. Including all of it would bloat the context. Instead, we extract only the design tokens (colors, typography, spacing, border-radius), which are the most actionable parts. The agent can apply these tokens to style any component.

- **Maximum context budget:** 3 imported components + 1 design system = approximately 500-1000 lines of XML. This fits within reasonable terminal write limits.

**Context size limit:**

If the user imports more than 5 components, the `buildFullContext` function should:
1. Warn: "Importing many components may exceed context size. Consider selecting fewer."
2. Truncate individual component code to 1500 characters (matching the existing SKILL.md truncation)
3. Always include the full `<design_library_access>` section so the agent knows more is available

### 8C. Agent Request Flow (Future Enhancement)

**Documented but NOT implemented in v1.**

In v1, agents cannot directly request components. They can only use what the user has imported. The `<design_library_access>` section informs agents that more is available, and agents can ask the user to browse.

**v2 enhancement design:**

```
Agent writes to terminal:  "I need a testimonial card component. Can you add one from Aceternity?"
                         ↓
SessionContextService parses output, detects component request pattern
                         ↓
Fires IPC event: 'agent:component-request' { terminalId, query: 'testimonial card', source: 'aceternity' }
                         ↓
Renderer shows toast: "Agent requests: testimonial card from Aceternity UI"
  [Browse] [Dismiss]
                         ↓
User clicks Browse → ComponentBrowserModal opens pre-filtered with "testimonial card"
                         ↓
User adds component → auto-sent to terminal
```

**Component request detection pattern:**

```typescript
const COMPONENT_REQUEST_PATTERNS = [
  /(?:need|want|use|add|include|looking for)\s+(?:a\s+)?(\w[\w\s-]*?)\s+(?:component|widget|element|card|section)/i,
  /(?:can you|please)\s+(?:add|browse|find|search)\s+(?:a\s+)?(\w[\w\s-]*?)\s+(?:from|in)\s+(?:aceternity|21st|refero)/i,
];
```

---

## 9. Documentation Spec

### 9A. TERMINAL_SIDEBAR_REFERENCE.md Additions

Add a new section after the existing Design Tab documentation:

```markdown
## Design Library Sources

The Design tab integrates three external design libraries for component browsing and import.

### Available Sources

| Source | Type | Access | Items |
|--------|------|--------|-------|
| 21st.dev | MCP Server | `npx -y @21st-dev/magic@latest` | React components, logos |
| Aceternity UI | Registry + CLI | HTTPS registry + `npx -y aceternity-ui` | 200+ Tailwind + Framer Motion components |
| Refero | MCP Server + HTTP | `npx -y @refero/mcp@latest` | 2,000+ design systems |

### How It Works

1. **Connection:** MCP servers are spawned as child processes by the Electron main process. The 21st.dev server auto-starts using the API key from opencode.json. Aceternity fetches its registry over HTTPS (no auth needed). Refero requires an API key (configure in settings).

2. **Browsing:** Click "Browse" on any connected source card to open the Component Browser. Search by name, filter by category, preview code, and click "Add to context" to include a component in your design context.

3. **Context Assembly:** Imported components are included in the XML design context sent to the terminal. Individual components include their full code. Design systems (from Refero) include their design tokens.

4. **Agent Access:** AI agents see the imported components in their context. The `<design_library_access>` section tells agents what libraries are available. If an agent needs more components, it asks the user to browse and add them.

### Configuration

Click "Configure" on any source card or use the gear icon to open the Library Configuration modal. Each source can be enabled/disabled independently. MCP-based sources (21st.dev, Refero) can be started/stopped. API keys are stored locally.

### Offline Behavior

All sources fall back to cached data when offline. The Aceternity registry is cached for 24 hours. Refero catalogs are cached for 24 hours. If no cache exists and the source is unavailable, the source card shows "Offline" and browsing is disabled. Local design features (taste knobs, style references, color picker) continue to work regardless.
```

### 9B. AGENTS.md Additions

Add a new section in the workspace guidebook:

```markdown
## Design Libraries

The workspace Design tab provides access to three external design libraries. These are available to you when the user sends design context to your terminal.

### What You Receive

When the user sends design context, you may see these sections in the XML:

- `<imported_components>` — Individual components with full source code that you can use directly
- `<design_library_access>` — Lists available libraries; if you need more components, ask the user to browse and add them

### Available Libraries

**21st.dev** — React component search and generation. Useful for finding specific UI patterns (cards, dashboards, forms).

**Aceternity UI** — 200+ production-ready Tailwind CSS + Framer Motion components. Best for hero sections, animated cards, background effects, and bento grids. All components use Tailwind classes and framer-motion animations.

**Refero** — 2,000+ design systems from real products. Provides design tokens (colors, typography, spacing, border-radius) rather than component code. Use these tokens to match a specific product's visual language.

### How to Request More Components

If the user's imported components don't include what you need, ask them:

> "I need a testimonial card component with animation. Could you browse Aceternity UI from the Design tab and add one?"

The user can then browse, select, and re-send the design context with the new component included.
```

### 9C. INITIALIZE.md Addition

Add a new step to the initialization checklist:

```markdown
- [ ] **Design Libraries** — Connect external design sources in the Design tab
  - 21st.dev: Auto-connected via opencode.json (verify status is green)
  - Aceternity UI: Auto-connected via HTTPS registry (verify status is green)
  - Refero: Requires API key (optional — configure if you have one)
  - Test: Open Design tab → check source cards show "Connected"
```

### 9D. Tutorial Page Addition

Add a new feature entry to the tutorial features array in `TutorialPage.tsx`:

```typescript
{
  id: 'design-library-integration',
  title: 'Design Library Integration',
  description: 'Browse and import components from 21st.dev, Aceternity UI, and Refero directly in the Design tab. Search by name, filter by category, preview code, and add to your AI agent\'s design context.',
  category: 'workspace',
  icon: 'Library',
  spotlight: '[data-tutorial="design-library-sources"]',
  steps: [
    'Open the Design tab in the workspace sidebar',
    'Check the Design Library Sources section — connected sources show a green dot',
    'Click "Browse" on any connected source to open the component browser',
    'Search for components by name or filter by category',
    'Click "Add to context" to include a component in your design context',
    'Click "Send Design Context to Terminal" to share with your AI agent',
  ],
}
```

---

## 10. Implementation Checklist

Ordered by dependency — each item lists the file(s) to modify and what to add/change.

### Phase 1: Backend Infrastructure

| # | File | Change |
|---|------|--------|
| 1.1 | `src/main.ts` | Add `MCPClientService` class: `MCPServerInstance` interface, `servers` Map, `startServer()`, `stopServer()`, `listTools()`, `callTool()`, `handleStdoutData()`, `getServerStatus()` |
| 1.2 | `src/main.ts` | Add `AceternityRegistryService` functions: `fetchAceternityRegistry()`, `fetchAceternityComponent()`, `installAceternityComponent()` |
| 1.3 | `src/main.ts` | Add `ReferoService` functions: `fetchReferoCatalog()`, `fetchReferoSystem()`, `searchReferoSystems()` |
| 1.4 | `src/main.ts` | Add `DesignCacheService` functions: `getCachedData()`, `setCachedData()`, `isCacheStale()`, `clearCache()` |
| 1.5 | `src/main.ts` | Add 15 IPC handlers: `mcp-list-tools`, `mcp-call-tool`, `mcp-server-status`, `mcp-start-server`, `mcp-stop-server`, `fetch-aceternity-registry`, `fetch-aceternity-component`, `install-aceternity-component`, `fetch-refero-catalog`, `fetch-refero-system`, `search-refero-systems`, `get-design-library-config`, `set-design-library-config`, `get-design-cached-data`, `test-design-library-connection` |
| 1.6 | `src/main.ts` | Read 21st.dev API key from `opencode.json` on startup, pass to MCPClientService default config |
| 1.7 | `src/main.ts` | Auto-start `21st-dev` MCP server on app ready (if enabled in config) |

### Phase 2: Preload Bridge

| # | File | Change |
|---|------|--------|
| 2.1 | `src/preload.ts` | Add 15 preload bridges matching the IPC handlers from 1.5 |
| 2.2 | `src/App.tsx` | Add TypeScript declarations for all 15 new `deskflowAPI` methods in the Window interface |

### Phase 3: Frontend Components

| # | File | Change |
|---|------|--------|
| 3.1 | `src/components/workspace/DesignLibrarySources.tsx` | Create: 3 source cards (21st.dev, Aceternity, Refero) with status dots, item counts, Browse/Configure buttons |
| 3.2 | `src/components/workspace/ComponentBrowserModal.tsx` | Create: modal with search, category pills, component grid, code preview, Add-to-context button, multi-source support |
| 3.3 | `src/components/workspace/LibraryConfigModal.tsx` | Create: per-source config sections with enable toggle, API key input, connection test, cache management |
| 3.4 | `src/components/workspace/DesignComposeOutlet.tsx` | Enhance: add source attribution badges, imported component count, `<imported_components>` section in preview |

### Phase 4: Page Integration

| # | File | Change |
|---|------|--------|
| 4.1 | `src/pages/DesignWorkspacePage.tsx` | Import DesignLibrarySources, ComponentBrowserModal, LibraryConfigModal |
| 4.2 | `src/pages/DesignWorkspacePage.tsx` | Add state: `importedComponents`, `libraryConfig`, `sourceStatuses`, `browserOpen`, `configOpen`, `activeSourceId` |
| 4.3 | `src/pages/DesignWorkspacePage.tsx` | Add DesignLibrarySources section to grid layout (between ColorPicker row and ComposeOutlet) |
| 4.4 | `src/pages/DesignWorkspacePage.tsx` | Modify `buildFullContext()` to include `<imported_components>` and `<design_library_access>` sections |
| 4.5 | `src/pages/DesignWorkspacePage.tsx` | Add effect: on mount, check MCP server statuses, fetch Aceternity registry count, update source cards |
| 4.6 | `src/pages/DesignWorkspacePage.tsx` | Add handlers: `handleBrowseSource`, `handleConfigureSource`, `handleAddComponent`, `handleRemoveComponent`, `handleTestConnection`, `handleSaveConfig` |

### Phase 5: TypeScript Types

| # | File | Change |
|---|------|--------|
| 5.1 | `src/services/AIService.ts` or new `src/types/design-library.ts` | Add interfaces: `MCPServerConfig`, `MCPToolDef`, `MCPCallResult`, `AceternityComponent`, `AceternityComponentDetail`, `ReferoSystem`, `ReferoDesignSystem`, `Component21st`, `DesignLibraryConfig`, `ImportedComponent` |

### Phase 6: Documentation

| # | File | Change |
|---|------|--------|
| 6.1 | `agent/TERMINAL_SIDEBAR_REFERENCE.md` | Add "Design Library Sources" section (content from §9A) |
| 6.2 | `agent/AGENTS.md` | Add "Design Libraries" section (content from §9B) |
| 6.3 | `agent/INITIALIZE.md` | Add "Design Libraries" step (content from §9C) |
| 6.4 | `src/pages/TutorialPage.tsx` | Add `design-library-integration` feature entry (content from §9D) |

### Phase 7: File System Setup

| # | File/Dir | Change |
|---|----------|--------|
| 7.1 | `{userData}/agent/design-caches/` | Create directory structure on app first run |
| 7.2 | `{userData}/agent/design-caches/meta.json` | Create initial metadata file |
| 7.3 | `src/main.ts` | Add app `ready` handler to create cache directories if they don't exist |

---

## Appendix: MCP JSON-RPC Protocol Reference

For implementers, here is the exact protocol sequence:

### Initialization

**Client → Server:**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"deskflow","version":"1.0.0"}}}
```

**Server → Client:**
```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"21st-dev-magic","version":"1.0.0"}}}
```

**Client → Server (notification):**
```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

### Tool Discovery

**Client → Server:**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

**Server → Client:**
```json
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"search_components","description":"Search React components","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}]}}
```

### Tool Invocation

**Client → Server:**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_components","arguments":{"query":"card"}}}
```

**Server → Client:**
```json
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"components\":[{\"id\":\"card-1\",\"name\":\"Feature Card\",...}]}"}]}}
```

### Error Response

**Server → Client:**
```json
{"jsonrpc":"2.0","id":3,"error":{"code":-32603,"message":"Rate limit exceeded","data":{"retryAfter":60}}}
```

### Stdio Transport Notes

- Messages are newline-delimited (`\n`)
- Each message is a single JSON object on one line
- Client writes to child process stdin
- Client reads from child process stdout
- Stderr is used for server logging (not JSON-RPC)
- Client must buffer partial reads and split by newline before parsing