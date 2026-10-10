import { useState } from 'react';
import { Palette, Import, Check, Plus, X } from 'lucide-react';

interface ColorEntry {
  id: string;
  color: string;
  role: string;
  label: string;
}

const COLOR_ROLES = [
  { value: 'primary', label: 'Primary', desc: 'Main brand color' },
  { value: 'accent', label: 'Accent', desc: 'Highlight / interactive' },
  { value: 'background', label: 'Background', desc: 'Page / card base' },
  { value: 'surface', label: 'Surface', desc: 'Elevated cards / panels' },
  { value: 'text', label: 'Text', desc: 'Body / heading color' },
  { value: 'muted', label: 'Muted', desc: 'Secondary / disabled text' },
  { value: 'success', label: 'Success', desc: 'Positive states' },
  { value: 'warning', label: 'Warning', desc: 'Caution states' },
  { value: 'error', label: 'Error', desc: 'Error / destructive' },
  { value: 'border', label: 'Border', desc: 'Divider / outline' },
  { value: 'custom', label: 'Custom', desc: 'Other' },
];

interface ColorScheme {
  name: string;
  desc: string;
  colors: { role: string; color: string; label: string }[];
}

const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: 'Galaxy Dark',
    desc: 'Deep zinc + pink/rose accents',
    colors: [
      { role: 'background', color: '#09090b', label: 'Bg' },
      { role: 'surface', color: '#18181b', label: 'Surface' },
      { role: 'primary', color: '#ec4899', label: 'Primary' },
      { role: 'accent', color: '#f43f5e', label: 'Accent' },
      { role: 'text', color: '#f4f4f5', label: 'Text' },
      { role: 'muted', color: '#71717a', label: 'Muted' },
      { role: 'border', color: '#27272a', label: 'Border' },
    ],
  },
  {
    name: 'Cyberpunk',
    desc: 'Neon magenta, cyan, deep purple',
    colors: [
      { role: 'background', color: '#0a0a1a', label: 'Bg' },
      { role: 'primary', color: '#d946ef', label: 'Primary' },
      { role: 'accent', color: '#22d3ee', label: 'Accent' },
      { role: 'surface', color: '#1a1a2e', label: 'Surface' },
      { role: 'text', color: '#e0e0ff', label: 'Text' },
      { role: 'success', color: '#10b981', label: 'Success' },
      { role: 'error', color: '#ef4444', label: 'Error' },
    ],
  },
  {
    name: 'Warm Earth',
    desc: 'Terracotta, cream, warm brown',
    colors: [
      { role: 'background', color: '#faf5f0', label: 'Bg' },
      { role: 'surface', color: '#f0e6d8', label: 'Surface' },
      { role: 'primary', color: '#c2410c', label: 'Primary' },
      { role: 'accent', color: '#d97706', label: 'Accent' },
      { role: 'text', color: '#292524', label: 'Text' },
      { role: 'muted', color: '#a8a29e', label: 'Muted' },
      { role: 'border', color: '#d6d3d1', label: 'Border' },
    ],
  },
  {
    name: 'Ocean',
    desc: 'Deep blues, teal, white',
    colors: [
      { role: 'background', color: '#0f172a', label: 'Bg' },
      { role: 'surface', color: '#1e293b', label: 'Surface' },
      { role: 'primary', color: '#3b82f6', label: 'Primary' },
      { role: 'accent', color: '#14b8a6', label: 'Accent' },
      { role: 'text', color: '#f1f5f9', label: 'Text' },
      { role: 'success', color: '#22c55e', label: 'Success' },
      { role: 'warning', color: '#eab308', label: 'Warning' },
    ],
  },
  {
    name: 'Minimal Light',
    desc: 'Clean white/gray with emerald',
    colors: [
      { role: 'background', color: '#ffffff', label: 'Bg' },
      { role: 'surface', color: '#f8fafc', label: 'Surface' },
      { role: 'primary', color: '#10b981', label: 'Primary' },
      { role: 'accent', color: '#059669', label: 'Accent' },
      { role: 'text', color: '#0f172a', label: 'Text' },
      { role: 'muted', color: '#94a3b8', label: 'Muted' },
      { role: 'border', color: '#e2e8f0', label: 'Border' },
    ],
  },
  {
    name: 'Sunset',
    desc: 'Warm orange, purple, dark base',
    colors: [
      { role: 'background', color: '#1c1917', label: 'Bg' },
      { role: 'surface', color: '#292524', label: 'Surface' },
      { role: 'primary', color: '#f97316', label: 'Primary' },
      { role: 'accent', color: '#a855f7', label: 'Accent' },
      { role: 'text', color: '#fafaf9', label: 'Text' },
      { role: 'warning', color: '#f59e0b', label: 'Warning' },
      { role: 'error', color: '#dc2626', label: 'Error' },
    ],
  },
];

interface ColorPickerProps {
  colors: ColorEntry[];
  onChange: (colors: ColorEntry[]) => void;
}

export function ColorPicker({ colors, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState('');
  const [roleInput, setRoleInput] = useState('accent');
  const [labelInput, setLabelInput] = useState('');
  const [hexError, setHexError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const isValidHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);

  const handleAdd = () => {
    const raw = hexInput.trim();
    if (!raw) return;
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    if (!isValidHex(withHash)) {
      setHexError('Invalid hex color (e.g. #ec4899)');
      return;
    }
    setHexError('');
    onChange([...colors, { id: `${Date.now()}`, color: withHash, role: roleInput, label: labelInput || roleInput }]);
    setHexInput('');
    setLabelInput('');
  };

  const handleRemove = (id: string) => onChange(colors.filter(c => c.id !== id));
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  const applyScheme = (scheme: ColorScheme) => {
    onChange(scheme.colors.map(c => ({ id: `${Date.now()}-${c.role}`, ...c })));
    setShowPresets(false);
  };

  const handleImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText.trim());
      let imported: { role: string; color: string; label: string }[] = [];
      if (Array.isArray(parsed)) {
        imported = parsed.filter((c: any) => c.color && c.role);
      } else if (parsed.colors) {
        imported = parsed.colors.filter((c: any) => c.color && c.role);
      } else {
        imported = Object.entries(parsed)
          .filter(([_, v]) => typeof v === 'string' && isValidHex(v.startsWith('#') ? v : `#${v}`))
          .map(([k, v]) => ({ role: k, color: v as string, label: k }));
      }
      if (!imported.length) { setImportError('No valid colors found. Use JSON array or object.'); return; }
      onChange(imported.map(c => ({ id: `${Date.now()}-${c.role}`, ...c })));
      setShowImport(false);
      setImportText('');
    } catch { setImportError('Invalid JSON. Paste a color scheme object or array.'); }
  };

  return (
    <div className="p-4 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Color Scheme</h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowPresets(!showPresets)} className="px-2 py-1 text-[9px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors inline-flex items-center gap-1">
            <Palette className="w-3 h-3" />
            Presets
          </button>
          <button onClick={() => setShowImport(!showImport)} className="px-2 py-1 text-[9px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors inline-flex items-center gap-1">
            <Import className="w-3 h-3" />
            Import
          </button>
          <span className="text-[9px] text-zinc-600">{colors.length} color{colors.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg">
          {COLOR_SCHEMES.map(scheme => (
            <button
              key={scheme.name}
              onClick={() => applyScheme(scheme)}
              className="p-2 rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-left group"
            >
              {/* Swatch row */}
              <div className="flex gap-0.5 mb-1.5 overflow-hidden rounded-md">
                {scheme.colors.slice(0, 6).map((c, i) => (
                  <div key={i} className="h-4 flex-1 first:rounded-l-md last:rounded-r-md" style={{ backgroundColor: c.color }} />
                ))}
              </div>
              <div className="text-[10px] font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{scheme.name}</div>
              <div className="text-[8px] text-zinc-600">{scheme.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div className="p-3 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg space-y-2">
          <div className="text-[9px] text-zinc-500">
            Paste a JSON color scheme. Formats: <code className="text-zinc-400">[{'{'}"role":"primary","color":"#..."{'}'}]</code> or <code className="text-zinc-400">{'{'}"primary":"#..."{'}'}</code>
          </div>
          <textarea
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportError(''); }}
            placeholder='[{"role":"primary","color":"#ec4899","label":"Pink"}]'
            rows={3}
            className="w-full px-2.5 py-1.5 text-[10px] font-mono bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 resize-none"
          />
          {importError && <div className="text-[8px] text-red-400">{importError}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowImport(false); setImportText(''); }} className="px-2 py-1 text-[9px] text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button onClick={handleImport} disabled={!importText.trim()} className="px-3 py-1 text-[9px] font-medium bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors inline-flex items-center gap-1">
              <Check className="w-3 h-3" />
              Apply Import
            </button>
          </div>
        </div>
      )}

      {/* Added colors */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {colors.map(c => (
            <div key={c.id} className="group relative">
              <div className="w-10 h-10 rounded-lg border border-zinc-700/50 cursor-pointer" style={{ backgroundColor: c.color }} title={`${c.label}: ${c.color}`} />
              <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleRemove(c.id)} className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center hover:bg-red-500/80 transition-colors">
                  <X className="w-2.5 h-2.5 text-zinc-300" />
                </button>
              </div>
              <div className="mt-0.5 text-[7px] text-zinc-500 text-center truncate max-w-10">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add color form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          {hexInput && isValidHex(hexInput.startsWith('#') ? hexInput : `#${hexInput}`) && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded border border-zinc-700/50 flex-shrink-0" style={{ backgroundColor: hexInput.startsWith('#') ? hexInput : `#${hexInput}` }} />
              <span className="text-[9px] text-zinc-500 font-mono">{hexInput.startsWith('#') ? hexInput : `#${hexInput}`}</span>
            </div>
          )}
          <input type="text" value={hexInput} onChange={e => { setHexInput(e.target.value); setHexError(''); }} onKeyDown={handleKeyDown} placeholder="#ec4899" className="w-full px-2.5 py-1.5 text-[10px] font-mono bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-700/50 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50" />
          {hexError && <div className="text-[8px] text-red-400 mt-0.5">{hexError}</div>}
        </div>
        <select value={roleInput} onChange={e => setRoleInput(e.target.value)} className="px-2 py-1.5 text-[9px] bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-700/50 rounded text-zinc-300 focus:outline-none focus:border-pink-500/50">
          {COLOR_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input type="text" value={labelInput} onChange={e => setLabelInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="label" className="w-16 px-2 py-1.5 text-[9px] bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-700/50 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50" />
        <button onClick={handleAdd} disabled={!hexInput.trim()} className="px-3 py-1.5 text-[9px] font-medium bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors flex-shrink-0 inline-flex items-center gap-1">
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {colors.length === 0 && (
        <p className="text-[9px] text-zinc-600">No colors added. Pick a preset, import a scheme, or add hex colors manually.</p>
      )}
    </div>
  );
}

export type { ColorEntry };
export { COLOR_ROLES, COLOR_SCHEMES };
