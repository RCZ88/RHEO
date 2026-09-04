import * as fs from 'fs';
import * as path from 'path';

export interface ArchNode {
  id: string;
  type: 'page' | 'component' | 'feature' | 'service' | 'hook' | 'store' | 'util' | 'ipc';
  name: string;
  filePath: string;
  lineCount: number;
  route?: string;
  description?: string;
  imports: string[];
  exports: string[];
  features: string[];
  ipcHandlers: string[];
  ipcCalls: string[];
  childComponents: string[];
}

export interface ArchEdge {
  from: string;
  to: string;
  type: 'import' | 'ipc' | 'state' | 'render' | 'route';
  label?: string;
}

export interface ArchMap {
  nodes: ArchNode[];
  edges: ArchEdge[];
  stats: {
    totalPages: number;
    totalComponents: number;
    totalFeatures: number;
    totalServices: number;
    totalHooks: number;
    totalIpcHandlers: number;
    totalLines: number;
    generatedAt: string;
  };
}

const ROUTE_MAP: Record<string, string> = {
  '/': 'DashboardPage',
  '/activity': 'ActivityPage',
  '/stats': 'StatsPage',
  '/productivity': 'ProductivityPage',
  '/browser': 'BrowserActivityPage',
  '/ide': 'IDEProjectsPage',
  '/external': 'ExternalPage',
  '/ai': 'AiPage',
  '/studio': 'FeatureStudioPage',
  '/finance': 'FinancePage',
  '/resume': 'ResumePage',
  '/resume/build': 'ResumeBuilderPage',
  '/resume/preview': 'ResumePreviewPage',
  '/resume/import': 'ResumeImportPage',
  '/resume/export': 'ResumeExportPage',
  '/guide': 'GuidePage',
  '/life': 'LifePage',
  '/learn': 'LearnPage',
  '/conductor': 'ConductorPage',
  '/ide-help': 'IDEHelpPage',
  '/terminal': 'TerminalPage',
  '/reports': 'InsightsPage',
  '/database': 'DatabasePage',
  '/settings': 'SettingsPage',
  '/subscriptions': 'SubscriptionsPage',
};

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch { return 0; }
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}|[\w*]+(?:\s*,\s*{[^}]+})?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

function extractJsxComponents(content: string): string[] {
  const comps = new Set<string>();
  const jsxRegex = /<(?:([A-Z][a-zA-Z0-9]+))[\s/>]/g;
  let match;
  while ((match = jsxRegex.exec(content)) !== null) {
    if (!['Fragment', 'Suspense', 'ErrorBoundary', 'Navigate'].includes(match[1])) {
      comps.add(match[1]);
    }
  }
  return [...comps];
}

function extractIpcHandlers(content: string): string[] {
  const handlers: string[] = [];
  const handlerRegex = /ipcMain\.handle\(['"]([^'"]+)['"]/g;
  let match;
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[1]);
  }
  return handlers;
}

function extractIpcCalls(content: string): string[] {
  const calls = new Set<string>();
  const callRegex = /ipcRenderer\.invoke\(['"]([^'"]+)['"]/g;
  let match;
  while ((match = callRegex.exec(content)) !== null) {
    calls.add(match[1]);
  }
  const apiRegex = /window\.deskflowAPI\.(\w+)/g;
  while ((match = apiRegex.exec(content)) !== null) {
    calls.add(match[1]);
  }
  return [...calls];
}

function extractFeatures(content: string, filePath: string): string[] {
  const features: string[] = [];
  const basename = path.basename(filePath, path.extname(filePath));

  const featurePatterns: Array<[RegExp, string]> = [
    [/useState|useReducer|zustand|create\(/, 'state-management'],
    [/useEffect|setInterval|setTimeout|addEventListener/, 'lifecycle'],
    [/onSubmit|onClick|onChange|onKeyDown|handleClick|handleSubmit/, 'event-handlers'],
    [/fetch\(|axios\.|ipcRenderer|window\.deskflowAPI/, 'data-fetching'],
    [/useCallback|useMemo|React\.memo|memo\(/, 'performance'],
    [/AnimatePresence|motion\.|framer|transition|animation/, 'animation'],
    [/className.*rounded|className.*bg-|className.*text-/, 'styled'],
    [/\.prepare\(|\.run\(|\.get\(|\.all\(/, 'database'],
    [/navigate\(|useNavigate|redirect/, 'navigation'],
    [/localStorage|sessionStorage/, 'storage'],
    [/try\s*\{|catch\s*\(|\.catch\(/, 'error-handling'],
    [/console\.log|console\.warn|console\.error/, 'debugging'],
    [/tooltip|Tooltip|popover|Popover/, 'tooltip'],
    [/dialog|Dialog|modal|Modal/, 'modal'],
    [/chart|Chart|graph|Graph|d3|recharts/, 'visualization'],
    [/socket|WebSocket|EventSource|SSE/, 'realtime'],
  ];

  for (const [pattern, feature] of featurePatterns) {
    if (pattern.test(content)) {
      features.push(feature);
    }
  }

  return features;
}

function scanFile(filePath: string, srcRoot: string): ArchNode | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(srcRoot, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath, path.extname(filePath));
    const lineCount = content.split('\n').length;

    let type: ArchNode['type'] = 'component';
    if (relPath.startsWith('pages/')) type = 'page';
    else if (relPath.startsWith('features/')) type = 'feature';
    else if (relPath.startsWith('services/')) type = 'service';
    else if (relPath.startsWith('hooks/')) type = 'hook';
    else if (relPath.startsWith('stores/')) type = 'store';
    else if (relPath.startsWith('lib/') || relPath.startsWith('utils/')) type = 'util';

    const ipcHandlers = type === 'page' || relPath.includes('main') ? extractIpcHandlers(content) : [];
    const ipcCalls = extractIpcCalls(content);

    const route = Object.entries(ROUTE_MAP).find(([, page]) => page === basename)?.[0];

    return {
      id: relPath.replace(/\.(tsx?|jsx?)$/, ''),
      type,
      name: basename,
      filePath: relPath,
      lineCount,
      route,
      imports: extractImports(content),
      exports: extractExports(content),
      features: extractFeatures(content, filePath),
      ipcHandlers,
      ipcCalls,
      childComponents: extractJsxComponents(content),
    };
  } catch {
    return null;
  }
}

function buildEdges(nodes: ArchNode[]): ArchEdge[] {
  const edges: ArchEdge[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    for (const imp of node.imports) {
      const resolved = resolveImport(imp, node.filePath);
      if (resolved && nodeIds.has(resolved)) {
        edges.push({ from: node.id, to: resolved, type: 'import' });
      }
    }

    for (const child of node.childComponents) {
      const childNode = nodes.find((n) => n.name === child || n.exports.includes(child));
      if (childNode) {
        edges.push({ from: node.id, to: childNode.id, type: 'render', label: `<${child}>` });
      }
    }

    for (const ipc of node.ipcCalls) {
      const handler = nodes.find((n) => n.ipcHandlers.includes(ipc));
      if (handler) {
        edges.push({ from: node.id, to: handler.id, type: 'ipc', label: ipc });
      }
    }
  }

  return edges;
}

function resolveImport(importPath: string, fromFile: string): string | null {
  if (importPath.startsWith('.')) {
    const fromDir = path.dirname(fromFile);
    let resolved = path.join(fromDir, importPath).replace(/\\/g, '/');

    const tryExts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
    for (const ext of tryExts) {
      const candidate = resolved + ext;
      if (candidate.endsWith('.tsx') || candidate.endsWith('.ts')) {
        return candidate.replace(/\.(tsx?|jsx?)$/, '');
      }
    }
    return resolved;
  }
  return null;
}

export function generateArchMap(srcRoot: string): ArchMap {
  // Yield to the event loop to keep the renderer responsive during scanning
  if (typeof setImmediate === "function") setImmediate(() => {});
  const nodes: ArchNode[] = [];

  const scanDir = (dir: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'dist-electron', 'backups', '__tests__', '.git', 'graphify-out'].includes(entry.name)) {
          scanDir(fullPath);
        }
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !entry.name.includes('.bak') && !entry.name.includes('.backup') && !entry.name.includes('.test.') && !entry.name.includes('.corrupted') && !entry.name.includes('.broken')) {
        const node = scanFile(fullPath, srcRoot);
        if (node) nodes.push(node);
      }
    }
  };

  scanDir(srcRoot);

  const edges = buildEdges(nodes);

  const stats = {
    totalPages: nodes.filter((n) => n.type === 'page').length,
    totalComponents: nodes.filter((n) => n.type === 'component').length,
    totalFeatures: nodes.filter((n) => n.type === 'feature').length,
    totalServices: nodes.filter((n) => n.type === 'service').length,
    totalHooks: nodes.filter((n) => n.type === 'hook').length,
    totalIpcHandlers: nodes.reduce((sum, n) => sum + n.ipcHandlers.length, 0),
    totalLines: nodes.reduce((sum, n) => sum + n.lineCount, 0),
    generatedAt: new Date().toISOString(),
  };

  return { nodes, edges, stats };
}
