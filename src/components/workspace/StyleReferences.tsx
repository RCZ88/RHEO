import { useState, useEffect } from 'react';
import { ExternalLink, Eye } from 'lucide-react';

interface DesignReference {
  name: string;
  path: string;
  style: string;
  bestFor: string;
}

const KNOWN_REFS: DesignReference[] = [
  { name: 'Claude', path: 'agent/design-references/claude/DESIGN.md', style: 'Warm terracotta, editorial', bestFor: 'AI agent interfaces' },
  { name: 'Linear', path: 'agent/design-references/linear/DESIGN.md', style: 'Ultra-minimal, purple accent', bestFor: 'Project management' },
  { name: 'Vercel', path: 'agent/design-references/vercel/DESIGN.md', style: 'Black/white precision, Geist', bestFor: 'Dashboards' },
  { name: 'Stripe', path: 'agent/design-references/stripe/DESIGN.md', style: 'Purple gradients, weight-300', bestFor: 'Financial data' },
  { name: 'Supabase', path: 'agent/design-references/supabase/DESIGN.md', style: 'Dark emerald, code-first', bestFor: 'Developer tools' },
  { name: 'Sentry', path: 'agent/design-references/sentry/DESIGN.md', style: 'Dark dashboard, data-dense', bestFor: 'Error tracking' },
  { name: 'PostHog', path: 'agent/design-references/posthog/DESIGN.md', style: 'Playful dark, colorful charts', bestFor: 'Analytics' },
  { name: 'Raycast', path: 'agent/design-references/raycast/DESIGN.md', style: 'Sleek dark chrome, vibrant', bestFor: 'Command palettes' },
];

interface StyleReferencesProps {
  selectedRefs: string[];
  onChange: (refs: string[]) => void;
  projectPath?: string;
}

export function StyleReferences({ selectedRefs, onChange, projectPath }: StyleReferencesProps) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const handleToggle = (name: string) => {
    if (selectedRefs.includes(name)) {
      onChange(selectedRefs.filter(r => r !== name));
    } else {
      onChange([...selectedRefs, name]);
    }
  };

  const handlePreview = async (ref: DesignReference) => {
    setPreviewName(ref.name);
    setPreviewContent('Loading...');
    try {
      const dapi = (window as any).deskflowAPI;
      const result = await dapi?.readProjectFile?.(ref.path, projectPath);
      if (result?.success && result.data) {
        setPreviewContent(result.data);
      } else {
        setPreviewContent(`// ${ref.path} not found\n// Style: ${ref.style}\n// Best for: ${ref.bestFor}`);
      }
    } catch {
      setPreviewContent('Failed to load reference');
    }
  };

  useEffect(() => {
    if (KNOWN_REFS.length > 0 && selectedRefs.length === 0) {
      onChange(KNOWN_REFS.map(r => r.name));
    }
  }, []);

  return (
    <div className="p-4 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Style References</h3>
        <span className="text-[9px] text-zinc-600">{selectedRefs.length}/{KNOWN_REFS.length} active</span>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {KNOWN_REFS.map((ref) => (
          <div key={ref.name} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 transition-colors">
            <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
              <input
                type="checkbox"
                checked={selectedRefs.includes(ref.name)}
                onChange={() => handleToggle(ref.name)}
                className="accent-pink-500"
              />
              <div className="min-w-0">
                <div className="text-[10px] text-zinc-300 truncate">{ref.name}</div>
                <div className="text-[8px] text-zinc-500 truncate">{ref.style}</div>
              </div>
            </label>
            <button
              onClick={() => handlePreview(ref)}
              className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 flex-shrink-0"
              title={`View ${ref.name} style`}
            >
              <Eye className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {previewContent && previewName && (
        <div className="mt-3 bg-zinc-950 light:bg-[var(--ws-surface)] rounded border border-zinc-700/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-b border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
              <span className="text-[9px] text-zinc-500">{previewName}</span>
            </div>
            <button
              onClick={() => { setPreviewContent(null); setPreviewName(null); }}
              className="text-[9px] text-zinc-600 hover:text-zinc-400"
            >
              Close
            </button>
          </div>
          <pre className="p-3 text-[9px] text-zinc-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{previewContent}</pre>
        </div>
      )}
    </div>
  );
}
