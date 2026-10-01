// Service: load handbook data from parsed JSON
// Data lives in agent/docs/terminal-handbook-data.json

export interface CommandParam {
  base: string;
  subcommands: string[];
  flags: Array<{ flag: string; value: string | null; short?: boolean }>;
  args: Array<{ type: string; value: string }>;
  pipe_to?: string | null;
  is_sudo?: boolean;
}

export interface HandbookCommand {
  section: string;
  sectionTitle: string;
  sectionNum: string;
  command: string;
  isRoot: boolean;
  depth: 'core' | 'daily' | 'power' | 'rescue' | 'sudo';
  badges: Array<{ type: string; label: string }>;
  description: string;
  whenToUse: string;
  gotchas: string[];
  notes: string[];
  params: CommandParam;
}

export interface HandbookSection {
  id: string;
  number: string;
  title: string;
  crumb: string;
  why: string;
  commands: HandbookCommand[];
  callouts: Array<{ type: 'tip' | 'danger'; title: string; body: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
}

export interface HandbookData {
  title: string;
  subtitle: string;
  sections: HandbookSection[];
  commands: HandbookCommand[];
  stats: {
    totalSections: number;
    totalCommands: number;
    depthCounts: Record<string, number>;
  };
}

// Cache for loaded data
let _cache: HandbookData | null = null;

// The JSON was scraped straight out of terminal-handbook.html, so its strings
// still carry raw HTML entities — "Files &amp; folders" rendered literally in
// the panel. Decode once at load rather than editing 61 strings in the source.
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  times: '×', deg: '°', laquo: '«', raquo: '»',
};
function decodeEntities(input: unknown): unknown {
  if (typeof input === 'string') {
    return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = parseInt(body.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      if (body.startsWith('#')) {
        const code = parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      const hit = ENTITIES[body.toLowerCase()];
      return hit ?? m;
    });
  }
  if (Array.isArray(input)) return input.map(decodeEntities);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = decodeEntities(v);
    return out;
  }
  return input;
}

/**
 * Lazy-load handbook data (dynamic import — only loaded when needed)
 */
async function loadData(): Promise<HandbookData> {
  if (_cache) return _cache;
  const data = await import('../../../agent/docs/terminal-handbook-data.json');
  _cache = decodeEntities(data.default) as HandbookData;
  return _cache;
}

export async function getHandbookData(): Promise<HandbookData> {
  return loadData();
}

export async function getSection(id: string): Promise<HandbookSection | undefined> {
  const data = await loadData();
  return data.sections.find(s => s.id === id);
}

export async function getSectionByNumber(num: string): Promise<HandbookSection | undefined> {
  const data = await loadData();
  return data.sections.find(s => s.number === num);
}

export async function getCommandsByDepth(depth: string): Promise<HandbookCommand[]> {
  const data = await loadData();
  return data.commands.filter(c => c.depth === depth);
}

export async function searchHandbook(query: string): Promise<HandbookCommand[]> {
  const data = await loadData();
  const q = query.toLowerCase();
  return data.commands.filter(c =>
    c.command.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.sectionTitle.toLowerCase().includes(q)
  );
}

// Depth metadata for UI
export const DEPTH_META: Record<string, { label: string; color: string; icon: string; description: string }> = {
  core: { label: 'Core', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '◆', description: 'Day one essentials' },
  daily: { label: 'Daily', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '●', description: 'Constant use' },
  power: { label: 'Power', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '▲', description: 'When core fails' },
  rescue: { label: 'Rescue', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '■', description: 'Broken system' },
  sudo: { label: 'Sudo', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '★', description: 'Admin rights' },
};

// Command param extraction for display
export function extractParamParts(cmd: HandbookCommand): {
  prefix: string;
  subcommand: string;
  flags: Array<{ flag: string; value: string | null; short: boolean }>;
  args: Array<{ type: string; value: string }>;
  pipe: string | null;
} {
  const p = cmd.params;
  const prefix = p.is_sudo ? 'sudo ' : '';
  const subcommand = p.base + (p.subcommands.length ? ' ' + p.subcommands.join(' ') : '');
  return {
    prefix,
    subcommand,
    flags: p.flags,
    args: p.args,
    pipe: p.pipe_to || null,
  };
}

// For synchronous access after data is loaded (e.g., in components that know data is loaded)
export function peekData(): HandbookData | null {
  return _cache;
}
