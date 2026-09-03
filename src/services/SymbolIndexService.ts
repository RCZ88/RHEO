import type { SymbolIndex, SymbolEntry, CallEdge, ModuleTreeNode, CallGraphNode } from './ContextStateTypes';

const INDEX_FILE = '.context/index/symbols.json';

/**
 * AST-based code index — NOT RAG, NOT text search
 * Uses Tree-sitter to extract precise symbols and call graphs
 */
export class SymbolIndexService {
  private index: SymbolIndex;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.index = this.loadIndex();
  }

  async buildIndex(changedFiles?: string[]): Promise<void> {
    const { symbols, callGraph } = await this.parseWithTreeSitter(changedFiles);

    if (changedFiles) {
      this.index.symbols = this.index.symbols.filter(s => !changedFiles.includes(s.file));
      this.index.symbols.push(...symbols);
      this.index.callGraph = this.index.callGraph.filter(e => !changedFiles.includes(e.file));
      this.index.callGraph.push(...callGraph);
    } else {
      this.index.symbols = symbols;
      this.index.callGraph = callGraph;
    }

    this.index.lastIndexed = new Date().toISOString();
    this.persist();
  }

  findSymbol(name: string, kind?: string): SymbolEntry[] {
    return this.index.symbols.filter(s => {
      const nameMatch = s.name === name;
      return kind ? nameMatch && s.kind === kind : nameMatch;
    });
  }

  findDefinition(file: string, line: number): SymbolEntry | undefined {
    return this.index.symbols.find(s =>
      s.file === file && s.lineStart <= line && s.lineEnd >= line
    );
  }

  getCallers(symbolId: string): CallEdge[] {
    return this.index.callGraph.filter(e => e.callee === symbolId);
  }

  getCallees(symbolId: string): CallEdge[] {
    return this.index.callGraph.filter(e => e.caller === symbolId);
  }

  getFileSymbols(file: string): SymbolEntry[] {
    return this.index.symbols.filter(s => s.file === file);
  }

  getModuleTree(): ModuleTreeNode[] {
    const tree: Record<string, ModuleTreeNode> = {};

    for (const sym of this.index.symbols) {
      const parts = sym.file.split('/');
      let current = tree;
      let path = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        path = path ? `${path}/${part}` : part;

        if (!current[path]) {
          current[path] = {
            name: part,
            path,
            type: i === parts.length - 1 ? 'file' : 'directory',
            children: i === parts.length - 1 ? undefined : {},
            symbols: i === parts.length - 1 ? [] : undefined
          };
        }

        if (i === parts.length - 1) {
          current[path].symbols!.push(sym);
        } else {
          current = current[path].children!;
        }
      }
    }

    return Object.values(tree);
  }

  getCallGraphForSymbol(symbolId: string, depth: number = 2): CallGraphNode {
    const sym = this.index.symbols.find(s => s.id === symbolId);
    if (!sym) throw new Error(`Symbol ${symbolId} not found`);

    const node: CallGraphNode = { symbol: sym, callers: [], callees: [] };

    if (depth > 0) {
      for (const edge of this.getCallers(symbolId)) {
        const callerSym = this.index.symbols.find(s => s.id === edge.caller);
        if (callerSym) node.callers.push(this.getCallGraphForSymbol(edge.caller, depth - 1));
      }
      for (const edge of this.getCallees(symbolId)) {
        const calleeSym = this.index.symbols.find(s => s.id === edge.callee);
        if (calleeSym) node.callees.push(this.getCallGraphForSymbol(edge.callee, depth - 1));
      }
    }

    return node;
  }

  getIndex(): SymbolIndex {
    return this.index;
  }

  private async parseWithTreeSitter(_files?: string[]): Promise<{ symbols: SymbolEntry[]; callGraph: CallEdge[] }> {
    // TODO: Integrate with tree-sitter CLI or MCP server
    return { symbols: [], callGraph: [] };
  }

  private loadIndex(): SymbolIndex {
    try {
      const dapi = (window as any).deskflowAPI;
      if (!dapi?.readProjectFile) return this.getDefaultIndex();
      const raw = dapi.readProjectFile(INDEX_FILE, this.projectPath);
      if (raw?.success && raw.data) return JSON.parse(raw.data);
      return this.getDefaultIndex();
    } catch {
      return this.getDefaultIndex();
    }
  }

  private persist(): void {
    const dapi = (window as any).deskflowAPI;
    if (!dapi?.writeProjectFile) return;
    dapi.writeProjectFile(INDEX_FILE, JSON.stringify(this.index, null, 2), this.projectPath);
  }

  private getDefaultIndex(): SymbolIndex {
    return {
      version: '1.0',
      lastIndexed: new Date().toISOString(),
      symbols: [],
      callGraph: []
    };
  }
}
