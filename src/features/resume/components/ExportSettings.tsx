import { FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { ExportSettings as ExportSettingsType } from '../../../types/resume';

interface ExportSettingsProps {
  settings: ExportSettingsType;
  onSettingsChange: (s: ExportSettingsType) => void;
  onExport: () => void;
  isExporting: boolean;
}

const formats = [
  { value: 'pdf', label: 'PDF', desc: 'ATS-safe, standard format' },
  { value: 'markdown', label: 'Markdown', desc: 'Plain text, easy to edit' },
  { value: 'json', label: 'JSON', desc: 'Structured data, for API' },
];

export function ExportSettings({ settings, onSettingsChange, onExport, isExporting }: ExportSettingsProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-zinc-400 mb-2 block">Export Format</label>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => onSettingsChange({ ...settings, format: f.value as any })}
              className={`p-3 rounded-xl ring-1 text-center transition-all duration-150 ${
                settings.format === f.value
                  ? 'ring-[var(--page-accent)]/40 bg-[var(--page-accent-10)] text-[var(--page-accent)]'
                  : 'ring-zinc-700/50 text-zinc-400 hover:ring-zinc-600/50 hover:bg-zinc-800/30'
              }`}
            >
              <FileText className="w-5 h-5 mx-auto mb-1.5" />
              <p className="text-xs font-semibold">{f.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Target Role (for tailoring)</label>
        <Input
          value={settings.targetRole}
          onChange={(e) => onSettingsChange({ ...settings, targetRole: e.target.value })}
          placeholder="e.g., Senior Software Engineer"
          className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Target Company</label>
        <Input
          value={settings.targetCompany}
          onChange={(e) => onSettingsChange({ ...settings, targetCompany: e.target.value })}
          placeholder="e.g., Google, Meta, Stripe"
          className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40"
        />
      </div>

      <Button
        onClick={onExport}
        disabled={isExporting}
        className="w-full"
        size="lg"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" /> Export Resume
          </>
        )}
      </Button>
    </div>
  );
}
