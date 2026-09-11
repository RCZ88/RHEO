import { useState, useCallback, useEffect } from 'react';
import { Palette, Package, Grid, Zap, Paintbrush, LayoutPanelTop, Code2, Sparkles, Rabbit, Wind, Image, Loader2, Sparkle } from 'lucide-react';
import { TasteKnobs, type TasteKnobValues } from '../components/workspace/TasteKnobs';
import DesignLibrarySources from '../components/workspace/DesignLibrarySources';
import { StyleReferences } from '../components/workspace/StyleReferences';
import { DesignComposeOutlet } from '../components/workspace/DesignComposeOutlet';
import { StyleDescription } from '../components/workspace/StyleDescription';
import ComponentBrowserModal from '../components/workspace/ComponentBrowserModal';
import LibraryConfigModal from '../components/workspace/LibraryConfigModal';
import { ColorPicker } from '../components/workspace/ColorPicker';
import CultUIRegistry from '../components/workspace/CultUIRegistry';
import { MotionExplorer } from '../components/workspace/MotionExplorer';
import { GlobalSearch } from '../components/workspace/GlobalSearch';
import { MoodboardTab } from '../components/workspace/MoodboardTab';
import { TokensTab } from '../components/workspace/TokensTab';
import { TerminalCommandPalette } from '../components/workspace/TerminalCommandPalette';
import { DesignSuiteStatus, logDesignCommand } from '../components/workspace/DesignSuiteStatus';

export interface DesignLibraryDef {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: any;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  itemCount: number;
  accentColor: string;
  group: 'mcp' | 'registry' | 'web-tool' | 'motion';
}

interface ImportedComponent {
  slug: string;
  name: string;
  source: string;
  category: string;
  code?: string;
  tokens?: Record<string, any>;
  addedAt: string;
}

interface ColorEntry {
  role: string;
  color: string;
  label: string;
}

interface DesignWorkspacePageProps {
  projectPath?: string;
  activeTerminalId?: string | null;
}

const DEFAULT_TASTE: TasteKnobValues = {
  designVariance: 5,
  motionIntensity: 5,
  visualDensity: 5,
};

const SKILL_DIRS = ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill', 'design-taste', 'motion-alive', 'humancentred-UIUX'];
const REF_NAMES = ['Claude', 'Linear', 'Vercel', 'Stripe', 'Supabase', 'Sentry', 'PostHog', 'Raycast'];

const DEFAULT_LIBRARIES: DesignLibraryDef[] = [
  {
    id: '21st-dev', label: '21st.dev', icon: Package, group: 'mcp',
    description: 'Search and generate React components via MCP',
    enabled: true, status: 'idle', itemCount: 0, accentColor: '#22d3ee',
  },
  {
    id: 'aceternity', label: 'Aceternity UI', icon: Grid, group: 'registry',
    description: 'Browse and install UI components from Aceternity',
    enabled: true, status: 'idle', itemCount: 0, accentColor: '#a78bfa',
  },
  {
    id: 'refero', label: 'Refero', icon: Zap, group: 'mcp',
    description: 'Design system components via MCP (Pro)',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#34d399',
  },
  {
    id: 'cult-ui', label: 'Cult UI', icon: Paintbrush, group: 'registry',
    description: 'Premium motion components via shadcn registry — Dynamic Islands, Family Buttons',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#f97316',
  },
  {
    id: 'fragments-ui', label: 'Fragments UI', icon: LayoutPanelTop, group: 'mcp',
    description: '66 accessible components, 80 tokens, 11 MCP tools. AI-native.',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#06b6d4',
  },
  {
    id: 'shadcn-ui-mcp', label: 'shadcn/ui MCP', icon: Code2, group: 'mcp',
    description: 'Multi-framework component docs with smart caching',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#38bdf8',
  },
  {
    id: 'aidesigner', label: 'AIDesigner', icon: Sparkles, group: 'mcp',
    description: 'Generate, clone, and refine web designs via MCP',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#c084fc',
  },
  {
    id: 'reactbits', label: 'React Bits', icon: Rabbit, group: 'registry',
    description: '135+ animated Tailwind/CSS components, no API key needed',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#f472b6',
  },
  {
    id: 'swishy-motion', label: 'Swishy Motion', icon: Wind, group: 'motion',
    description: 'Kinetic typography and Framer Motion curve presets',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#2dd4bf',
  },
  {
    id: 'variant', label: 'Variant', icon: Image, group: 'web-tool',
    description: 'Visual theme exploration canvas — infinite layout ideas',
    enabled: false, status: 'idle', itemCount: 0, accentColor: '#fb923c',
  },
];

const REGISTRY_SOURCES = new Set(['aceternity', 'cult-ui', 'reactbits']);
const MCP_SOURCES = new Set(['21st-dev', 'refero', 'fragments-ui', 'shadcn-ui-mcp', 'aidesigner']);

async function readFileContent(relativePath: string, projectPath?: string): Promise<string | null> {
  try {
    const dapi = (window as any).deskflowAPI;
    const result = await dapi?.readProjectFile?.(relativePath, projectPath);
    if (result?.success && result.data) return result.data;
    return null;
  } catch {
    return null;
  }
}

function buildColorSchemeXml(colors: ColorEntry[]): string {
  if (colors.length === 0) return '';
  const lines: string[] = ['  <color_palette>'];
  for (const c of colors) {
    lines.push(`    <color role="${c.role}" hex="${c.color}" label="${c.label}" />`);
  }
  lines.push('  </color_palette>');
  return lines.join('\n');
}

function buildImportedComponentsXml(components: ImportedComponent[]): string {
  if (components.length === 0) return '';
  const lines: string[] = ['  <imported_components>'];
  for (const comp of components) {
    lines.push(`    <component name="${comp.name}" source="${comp.source}" slug="${comp.slug}" category="${comp.category}">`);
    if (comp.code) {
      lines.push(`      <description>${comp.name}</description>`);
      lines.push(`      <code><![CDATA[${comp.code}]]></code>`);
    }
    if (comp.tokens) {
      lines.push(`      <tokens>`);
      for (const [key, value] of Object.entries(comp.tokens)) {
        if (typeof value === 'string') {
          lines.push(`        <${key} value="${value}" />`);
        }
      }
      lines.push(`      </tokens>`);
    }
    lines.push(`    </component>`);
  }
  lines.push('  </imported_components>');
  return lines.join('\n');
}

function buildDesignLibraryAccessXml(enabledLibraries: DesignLibraryDef[]): string {
  if (enabledLibraries.length === 0) return '';
  const parts: string[] = ['  <design_library_access>'];
  parts.push('    Available design libraries (ask the user to browse and add more from the Design tab):');
  for (const lib of enabledLibraries) {
    let description = '';
    switch (lib.id) {
      case '21st-dev':
        description = 'Search and generate React components (search_components, get_component, generate_component, search_logos)';
        break;
      case 'aceternity':
        description = '200+ Tailwind CSS + Framer Motion components (hero sections, cards, backgrounds, animations)';
        break;
      case 'refero':
        description = '2000+ design systems with structured tokens (colors, typography, spacing, border-radius)';
        break;
      case 'fragments-ui':
        description = '66 accessible React components + 80 design tokens + .fragment.tsx metadata (11 MCP tools)';
        break;
      case 'cult-ui':
        description = 'Premium shadcn registry components: Dynamic Islands, Family Buttons, rich animations. Install via npx shadcn@latest';
        break;
      case 'shadcn-ui-mcp':
        description = 'Multi-framework shadcn/ui component documentation with usage examples (React, Svelte, Vue, React Native)';
        break;
      case 'aidesigner':
        description = 'Generate, clone, and refine production-ready web designs via MCP from a live URL';
        break;
      case 'reactbits':
        description = '135+ animated React components (CSS + Tailwind variants) — text animations, particles, hover effects';
        break;
      case 'swishy-motion':
        description = 'Text-to-motion kinetic typography with CSS keyframes and Framer Motion curve settings';
        break;
      case 'variant':
        description = 'Infinite layout ideas based on visual themes — feed canvas screenshots into agent vision';
        break;
    }
    parts.push(`    - ${lib.label}: ${description}`);
  }
  parts.push('  </design_library_access>');
  return parts.join('\n');
}

async function buildFullContext(
  taste: TasteKnobValues,
  selectedRefs: string[],
  projectPath?: string,
  styleDescription?: string,
  colors?: ColorEntry[],
  importedComponents?: ImportedComponent[],
  enabledLibraries?: DesignLibraryDef[],
  moodboardItems?: any[],
): Promise<string> {
  const parts: string[] = [];
  parts.push(`<design_taste>`);
  parts.push(`  design_variance="${taste.designVariance}"`);
  parts.push(`  motion_intensity="${taste.motionIntensity}"`);
  parts.push(`  visual_density="${taste.visualDensity}"`);
  parts.push(`</design_taste>`);
  parts.push('');

  if (styleDescription) {
    parts.push(`<style_notes>${styleDescription}</style_notes>`);
    parts.push('');
  }

  if (colors && colors.length > 0) {
    parts.push(buildColorSchemeXml(colors));
    parts.push('');
  }

  parts.push('<design_skills>');
  for (const dir of SKILL_DIRS) {
    const content = await readFileContent(`agent/skills/${dir}/SKILL.md`, projectPath);
    if (content) {
      const stripped = content.replace(/---[\s\S]*?---/, '').trim();
      parts.push(stripped.slice(0, 1500));
      parts.push('');
    }
  }
  parts.push('</design_skills>');
  parts.push('');

  const selectedNames = REF_NAMES.filter(r => selectedRefs.includes(r));
  if (selectedNames.length > 0) {
    parts.push('<design_references>');
    for (const name of selectedNames) {
      const content = await readFileContent(`agent/design-references/${name.toLowerCase()}/DESIGN.md`, projectPath);
      if (content) {
        const stripped = content.replace(/---[\s\S]*?---/, '').trim();
        parts.push(`<reference name="${name}">`);
        parts.push(stripped.slice(0, 2000));
        parts.push('</reference>');
        parts.push('');
      }
    }
    parts.push('</design_references>');
  }

  if (importedComponents && importedComponents.length > 0) {
    parts.push(buildImportedComponentsXml(importedComponents));
    parts.push('');
  }

  if (enabledLibraries && enabledLibraries.length > 0) {
    parts.push(buildDesignLibraryAccessXml(enabledLibraries));
    parts.push('');
  }

  if (moodboardItems && moodboardItems.length > 0) {
    parts.push('<moodboard>');
    for (const item of moodboardItems) {
      parts.push(`  <aesthetic title="${item.title}" source="${item.source}" url="${item.imageUrl}">`);
      if (item.description) parts.push(`    <description>${item.description}</description>`);
      parts.push('  </aesthetic>');
    }
    parts.push('</moodboard>');
    parts.push('');
  }

  if (colors && colors.length > 0) {
    const cssVars = colors.map(c => `  --${c.role}: ${c.color};`).join('\n');
    parts.push(`<design_tokens>\n<css_variables>\n:root {\n${cssVars}\n}\n</css_variables>\n</design_tokens>`);
    parts.push('');
  }

  parts.push('[END DESIGN CONTEXT]');
  return parts.join('\n');
}

export default function DesignWorkspacePage({ projectPath, activeTerminalId }: DesignWorkspacePageProps) {
  const [taste, setTaste] = useState<TasteKnobValues>(DEFAULT_TASTE);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [styleDescription, setStyleDescription] = useState('');
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [libraries, setLibraries] = useState(DEFAULT_LIBRARIES.map(l => ({ ...l })));
  const [loadingContext, setLoadingContext] = useState(true);
  const [preview, setPreview] = useState<string>('');
  const [activeBrowseLibrary, setActiveBrowseLibrary] = useState<string | null>(null);
  const [activeConfigLibrary, setActiveConfigLibrary] = useState<string | null>(null);
  const [importedComponents, setImportedComponents] = useState<ImportedComponent[]>([]);
  const [showCultRegistry, setShowCultRegistry] = useState(false);
  const [showMotionExplorer, setShowMotionExplorer] = useState(false);
  const [activeTab, setActiveTab] = useState<'moodboard' | 'tokens' | 'sources' | 'motion' | 'registry'>('sources');
  const [startAllLoading, setStartAllLoading] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moodboardItems, setMoodboardItems] = useState<any[]>([]);

  const openBrowse = (id: string) => setActiveBrowseLibrary(id);
  const closeBrowse = () => setActiveBrowseLibrary(null);
  const openConfig = (id: string) => setActiveConfigLibrary(id);
  const closeConfig = () => setActiveConfigLibrary(null);

  const handleStartAll = async () => {
    setStartAllLoading(true);
    const mcpLibs = libraries.filter(l => (MCP_SOURCES.has(l.id) || REGISTRY_SOURCES.has(l.id)) && l.status === 'idle');
    for (const lib of mcpLibs) {
      const dapi = (window as any).deskflowAPI;
      try {
        if (REGISTRY_SOURCES.has(lib.id)) {
          if (lib.id === 'aceternity') {
            const result = await dapi?.aceternityFetchRegistry?.();
            if (result?.success) {
              setLibraries(prev => prev.map(l => l.id === lib.id ? { ...l, status: 'connected', itemCount: result.total || 0 } : l));
            }
          }
        } else if (MCP_SOURCES.has(lib.id)) {
          const result = await dapi?.mcpStartServer?.(lib.id);
          if (result?.success) {
            const status = await dapi?.mcpServerStatus?.(lib.id);
            if (status?.status === 'running') {
              setLibraries(prev => prev.map(l => l.id === lib.id ? { ...l, status: 'connected', itemCount: status.toolCount || 0 } : l));
            }
          }
        }
      } catch {}
    }
    setStartAllLoading(false);
  };

  const handleToggle = (libraryId: string, enabled: boolean) => {
    setLibraries(prev => prev.map(lib => 
      lib.id === libraryId ? { ...lib, enabled } : lib
    ));
  };

  const handleAddComponent = (component: any) => {
    const newComponent: ImportedComponent = {
      slug: component.slug || component.id,
      name: component.name,
      source: component.source,
      category: component.category || 'General',
      code: component.code,
      tokens: component.tokens,
      addedAt: new Date().toISOString(),
    };
    setImportedComponents(prev => [...prev, newComponent]);
    closeBrowse();
  };

  const handleRemoveComponent = (slug: string) => {
    setImportedComponents(prev => prev.filter(c => c.slug !== slug));
  };

  const handleStartServer = async (id: string) => {
    setLibraries(prev => prev.map(l => l.id === id ? { ...l, status: 'connecting' as const } : l));
    const dapi = (window as any).deskflowAPI;
    try {
      if (REGISTRY_SOURCES.has(id)) {
        let result;
        if (id === 'aceternity') {
          result = await dapi?.aceternityFetchRegistry?.();
        }
        if (result?.success) {
          setLibraries(prev => prev.map(l =>
            l.id === id ? { ...l, status: 'connected' as const, itemCount: result.total || 0 } : l
          ));
          return;
        }
      }
      if (MCP_SOURCES.has(id)) {
        const result = await dapi?.mcpStartServer?.(id);
        if (result?.success) {
          const status = await dapi?.mcpServerStatus?.(id);
          if (status?.status === 'running') {
            setLibraries(prev => prev.map(l =>
              l.id === id ? { ...l, status: 'connected' as const, itemCount: status.toolCount || 0 } : l
            ));
            return;
          }
        }
      }
      setLibraries(prev => prev.map(l =>
        l.id === id ? { ...l, status: 'error' as const } : l
      ));
    } catch {
      setLibraries(prev => prev.map(l =>
        l.id === id ? { ...l, status: 'error' as const } : l
      ));
    }
  };

  const handleStopServer = async (id: string) => {
    const dapi = (window as any).deskflowAPI;
    try {
      if (MCP_SOURCES.has(id)) {
        await dapi?.mcpStopServer?.(id);
      }
    } catch {}
    setLibraries(prev => prev.map(l =>
      l.id === id ? { ...l, status: 'idle' as const, itemCount: 0 } : l
    ));
  };

  const handleSaveConfig = async (cfg: any) => {
    if (cfg?.sources) {
      Object.entries(cfg.sources).forEach(([id, src]: [string, any]) => {
        setLibraries(prev => prev.map(lib =>
          lib.id === id ? { ...lib, enabled: src.enabled ?? lib.enabled } : lib
        ));
      });
    }
    const dapi = (window as any).deskflowAPI;
    try {
      await dapi?.setDesignLibraryConfig?.(cfg);
    } catch {}
    checkLibraryStatuses();
  };

  const refreshPreview = useCallback(async () => {
    setLoadingContext(true);
    const enabledLibs = libraries.filter(lib => lib.enabled);
    const ctx = await buildFullContext(
      taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs, moodboardItems
    );
    setPreview(ctx);
    setLoadingContext(false);
  }, [taste, selectedRefs, styleDescription, colors, projectPath, importedComponents, libraries, moodboardItems]);

  const handleSend = async () => {
    if (!activeTerminalId) return;
    setIsSending(true);
    try {
      const enabledLibs = libraries.filter(lib => lib.enabled);
      const ctx = await buildFullContext(
        taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs, moodboardItems
      );
      const dapi = (window as any).deskflowAPI;
      await dapi?.agentSend?.(activeTerminalId, ctx, 'claude');
      await dapi?.saveTerminalBinding?.({
        terminalId: activeTerminalId,
        problemId: null,
        sessionContext: JSON.stringify({
          design_variance: taste.designVariance,
          motion_intensity: taste.motionIntensity,
          visual_density: taste.visualDensity,
          style_references: selectedRefs,
          style_description: styleDescription,
          color_scheme: colors,
          imported_components: importedComponents,
        }),
        status: 'active',
      });
      setLastSent(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('[DesignWorkspace] send failed', e);
    }
    setIsSending(false);
  };

  const handleCopy = async () => {
    const enabledLibs = libraries.filter(lib => lib.enabled);
    const ctx = await buildFullContext(
      taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs, moodboardItems
    );
    navigator.clipboard?.writeText(ctx);
  };

  const checkLibraryStatuses = useCallback(async () => {
    const dapi = (window as any).deskflowAPI;
    for (const id of libraries.map(l => l.id)) {
      try {
        if (MCP_SOURCES.has(id)) {
          const status = await dapi?.mcpServerStatus?.(id);
          if (status?.status === 'running') {
            setLibraries(prev => prev.map(l =>
              l.id === id ? { ...l, status: 'connected' as const, itemCount: status.toolCount || 0 } : l
            ));
          } else if (status?.status === 'error') {
            setLibraries(prev => prev.map(l => l.id === id ? { ...l, status: 'error' as const } : l));
          }
        }
      } catch {}
    }
    try {
      const reg = await dapi?.aceternityFetchRegistry?.();
      if (reg?.success) {
        setLibraries(prev => prev.map(l =>
          l.id === 'aceternity' ? { ...l, status: 'connected' as const, itemCount: reg.total } : l
        ));
      }
    } catch {}
  }, [libraries]);

  useEffect(() => {
    checkLibraryStatuses();
    const interval = setInterval(checkLibraryStatuses, 10000);
    return () => clearInterval(interval);
    (async () => {
      const dapi = (window as any).deskflowAPI;
      try {
        const saved = await dapi?.getDesignLibraryConfig?.();
        if (saved?.sources) {
          Object.entries(saved.sources).forEach(([id, cfg]: [string, any]) => {
            setLibraries(prev => prev.map(l =>
              l.id === id ? { ...l, enabled: cfg.enabled ?? l.enabled } : l
            ));
          });
        }
      } catch {}
    })();
    refreshPreview();
  }, []);

  // Cmd+K keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleInjectContext = useCallback((item: any) => {
    setMoodboardItems(prev => [...prev, item]);
  }, []);

  const handleExecuteCommand = useCallback(async (command: string) => {
    const dapi = (window as any).deskflowAPI;
    if (!dapi || !activeTerminalId) return;

    try {
      logDesignCommand(command);
      await dapi.terminalWriteRaw?.(activeTerminalId, command + '\n');
    } catch (e) {
      console.error('[DesignWorkspace] command failed', e);
    }
  }, [activeTerminalId]);

  const importedCounts = libraries
    .filter(lib => importedComponents.some(c => c.source === lib.id))
    .map(lib => ({
      source: lib.label,
      count: importedComponents.filter(c => c.source === lib.id).length,
      accentColor: lib.accentColor,
    }));

  const mcpLibraries = libraries.filter(l => l.group === 'mcp' || l.group === 'registry');
  const motionLibraries = libraries.filter(l => l.group === 'motion');
  const webLibraries = libraries.filter(l => l.group === 'web-tool');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
          <Palette className="w-4.5 h-4.5 text-pink-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Design Workspace</h2>
          <p className="text-[10px] text-zinc-500">Compose design taste + skills + references + color scheme</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TasteKnobs values={taste} onChange={(v) => { setTaste(v); refreshPreview(); }} />
        <StyleReferences
          selectedRefs={selectedRefs}
          onChange={(r) => { setSelectedRefs(r); refreshPreview(); }}
          projectPath={projectPath}
        />
      </div>

      {/* Global Search + Start All */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <GlobalSearch libraries={libraries} onAddComponent={handleAddComponent} />
        </div>
        <button
          onClick={handleStartAll}
          disabled={startAllLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium
            bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 disabled:opacity-50
            transition-colors duration-150 shrink-0"
        >
          {startAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {startAllLoading ? 'Starting...' : 'Start All'}
        </button>
      </div>

      {/* Tabs: Moodboard / Tokens / Design Sources / Motion Explorer / Registry Browser */}
      <div className="flex gap-1 border-b border-zinc-800/40 pb-1">
        {[
          { key: 'moodboard' as const, label: 'Moodboard', icon: Sparkle },
          { key: 'tokens' as const, label: 'Tokens', icon: Palette },
          { key: 'sources' as const, label: 'Design Sources', icon: Package },
          { key: 'motion' as const, label: 'Motion Explorer', icon: Wind },
          { key: 'registry' as const, label: 'Registry Browser', icon: Paintbrush },
        ].map(t => {
          const active = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition-all duration-150 ${
                active
                  ? 'text-pink-300 bg-pink-950/20 border border-zinc-800/60 border-b-0 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}

        {/* Cmd+K hint */}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-600">
          <kbd className="px-1 py-0.5 rounded bg-zinc-800/60 text-zinc-500 font-mono text-[9px]">⌘K</kbd>
          <span>Commands</span>
        </div>
      </div>

      {/* Moodboard Tab */}
      {activeTab === 'moodboard' && (
        <MoodboardTab activeTerminalId={activeTerminalId} onInjectContext={handleInjectContext} />
      )}

      {/* Tokens Tab */}
      {activeTab === 'tokens' && (
        <TokensTab colorEntries={colors} projectPath={projectPath} />
      )}

      {activeTab === 'sources' && (
        <>
          <DesignLibrarySources
            libraries={libraries}
            onBrowse={openBrowse}
            onToggle={handleToggle}
            onConfigure={openConfig}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StyleDescription value={styleDescription} onChange={(v) => { setStyleDescription(v); refreshPreview(); }} />
            <ColorPicker colors={colors} onChange={(c) => { setColors(c); refreshPreview(); }} />
          </div>
        </>
      )}

      {activeTab === 'motion' && (
        <MotionExplorer onAddMotionSnippet={(snippet) => {
          setImportedComponents(prev => [...prev, {
            slug: `motion-${Date.now()}`,
            name: snippet.name,
            source: 'swishy-motion',
            category: 'Animation',
            code: snippet.code,
            addedAt: new Date().toISOString(),
          }]);
        }} />
      )}

      {activeTab === 'registry' && (
        <CultUIRegistry
          onAddComponent={handleAddComponent}
          onInstall={projectPath ? (url) => {
            const dapi = (window as any).deskflowAPI;
            dapi?.designSuiteInstallComponent?.(url, projectPath);
          } : undefined}
        />
      )}

      <DesignComposeOutlet
        contextSnippet={loadingContext ? 'Loading...' : preview}
        onSend={handleSend}
        onCopy={handleCopy}
        isSending={isSending}
        lastSent={lastSent}
        terminalMissing={!activeTerminalId}
        importedCounts={importedCounts}
        totalImported={importedComponents.length}
      />

      <ComponentBrowserModal
        open={!!activeBrowseLibrary}
        onClose={closeBrowse}
        libraryId={activeBrowseLibrary || ''}
        onAddComponent={handleAddComponent}
      />

      <LibraryConfigModal
        open={!!activeConfigLibrary}
        onClose={closeConfig}
        config={{
          version: 1,
          sources: Object.fromEntries(libraries.map(l => [l.id, {
            enabled: l.enabled,
            autoStart: false,
          }])),
        }}
        onSave={handleSaveConfig}
        onConnectionChanged={(id, status, itemCount) => {
          setLibraries(prev => prev.map(l =>
            l.id === id ? { ...l, status: status as any, itemCount: itemCount ?? l.itemCount } : l
          ));
        }}
      />

      {/* Terminal Command Palette */}
      <TerminalCommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecute={handleExecuteCommand}
      />

      {/* Design Suite Status Bar */}
      <DesignSuiteStatus className="border-t border-zinc-800/40 bg-zinc-900/30" />
    </div>
  );
}
