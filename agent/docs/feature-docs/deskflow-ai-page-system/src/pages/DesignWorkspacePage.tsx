import { useState, useCallback, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { Package, Grid, Zap } from 'lucide-react';
import { TasteKnobs, type TasteKnobValues } from '../components/workspace/TasteKnobs';
import DesignLibrarySources from '../components/workspace/DesignLibrarySources';
import { StyleReferences } from '../components/workspace/StyleReferences';
import { DesignComposeOutlet } from '../components/workspace/DesignComposeOutlet';
import { StyleDescription } from '../components/workspace/StyleDescription';
import ComponentBrowserModal from '../components/workspace/ComponentBrowserModal';
import LibraryConfigModal from '../components/workspace/LibraryConfigModal';
import { ColorPicker } from '../components/workspace/ColorPicker';

type LibraryId = '21st-dev' | 'aceternity' | 'refero';

interface ImportedComponent {
  slug: string;
  name: string;
  source: '21st-dev' | 'aceternity' | 'refero';
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

const SKILL_DIRS = ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill', 'design-taste'];
const REF_NAMES = ['Claude', 'Linear', 'Vercel', 'Stripe', 'Supabase', 'Sentry', 'PostHog', 'Raycast'];

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

function buildDesignLibraryAccessXml(enabledLibraries: { id: string; label: string }[]): string {
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
  enabledLibraries?: { id: string; label: string }[],
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
  const [libraries, setLibraries] = useState([
    {
      id: '21st-dev' as const,
      label: '21st.dev',
      description: 'Search and generate React components via MCP',
      enabled: true,
      icon: Package,
      status: 'idle' as 'idle' | 'connecting' | 'connected' | 'error',
      itemCount: 0,
      accentColor: '#22d3ee',
    },
    {
      id: 'aceternity' as const,
      label: 'Aceternity UI',
      description: 'Browse and install UI components from Aceternity',
      enabled: true,
      icon: Grid,
      status: 'idle' as 'idle' | 'connecting' | 'connected' | 'error',
      itemCount: 0,
      accentColor: '#a78bfa',
    },
    {
      id: 'refero' as const,
      label: 'Refero',
      description: 'Design system components via MCP',
      enabled: false,
      icon: Zap,
      status: 'idle' as 'idle' | 'connecting' | 'connected' | 'error',
      itemCount: 0,
      accentColor: '#34d399',
    },
  ]);
  
  const [loadingContext, setLoadingContext] = useState(true);
  const [preview, setPreview] = useState<string>('');
  const [activeBrowseLibrary, setActiveBrowseLibrary] = useState<LibraryId | null>(null);
  const [activeConfigLibrary, setActiveConfigLibrary] = useState<LibraryId | null>(null);
  const [importedComponents, setImportedComponents] = useState<ImportedComponent[]>([]);

  const openBrowse = (id: LibraryId) => setActiveBrowseLibrary(id);
  const closeBrowse = () => setActiveBrowseLibrary(null);
  const openConfig = (id: LibraryId) => setActiveConfigLibrary(id);
  const closeConfig = () => setActiveConfigLibrary(null);

  const handleToggle = (libraryId: LibraryId, enabled: boolean) => {
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

  const handleStartServer = async (id: LibraryId) => {
    setLibraries(prev => prev.map(l => l.id === id ? { ...l, status: 'connecting' as const } : l));
    const dapi = (window as any).deskflowAPI;
    try {
      let result;
      if (id === 'aceternity') {
        result = await dapi?.aceternityFetchRegistry?.();
        if (result?.success) {
          setLibraries(prev => prev.map(l =>
            l.id === id ? { ...l, status: 'connected' as const, itemCount: result.total || 0 } : l
          ));
          return;
        }
      } else {
        result = await dapi?.mcpStartServer?.(id);
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

  const handleStopServer = async (id: LibraryId) => {
    const dapi = (window as any).deskflowAPI;
    try {
      if (id !== 'aceternity') {
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
    // Re-check statuses after save
    checkLibraryStatuses();
  };

  const refreshPreview = useCallback(async () => {
    setLoadingContext(true);
    const enabledLibs = libraries.filter(lib => lib.enabled);
    const ctx = await buildFullContext(
      taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs
    );
    setPreview(ctx);
    setLoadingContext(false);
  }, [taste, selectedRefs, styleDescription, colors, projectPath, importedComponents, libraries]);

  const handleSend = async () => {
    if (!activeTerminalId) return;
    setIsSending(true);
    try {
      const enabledLibs = libraries.filter(lib => lib.enabled);
      const ctx = await buildFullContext(
        taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs
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
      taste, selectedRefs, projectPath, styleDescription, colors, importedComponents, enabledLibs
    );
    navigator.clipboard?.writeText(ctx);
  };

  const checkLibraryStatuses = useCallback(async () => {
    const dapi = (window as any).deskflowAPI;
    for (const id of ['21st-dev', 'refero'] as LibraryId[]) {
      try {
        const status = await dapi?.mcpServerStatus?.(id);
        if (status?.status === 'running') {
          setLibraries(prev => prev.map(l =>
            l.id === id ? { ...l, status: 'connected' as const, itemCount: status.toolCount || 0 } : l
          ));
        } else if (status?.status === 'error') {
          setLibraries(prev => prev.map(l => l.id === id ? { ...l, status: 'error' as const } : l));
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
  }, []);

  // On mount, check MCP server status, load config, and start polling
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

  // Compute imported counts for the DesignComposeOutlet
  const importedCounts = libraries
    .filter(lib => importedComponents.some(c => c.source === lib.id))
    .map(lib => ({
      source: lib.label,
      count: importedComponents.filter(c => c.source === lib.id).length,
      accentColor: lib.accentColor,
    }));

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
        libraryId={activeBrowseLibrary as LibraryId}
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
    </div>
  );
}