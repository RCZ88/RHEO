import { motion } from 'framer-motion';
import { FileText, Download, Trash2, Clock } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../../../components/ui/number-ticker';
import type { ResumeVersion } from '../../../types/resume';

interface VersionCardProps {
  version: ResumeVersion;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: string) => void;
}

export function VersionCard({ version, isActive, onSelect, onDelete, onExport }: VersionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => onSelect(version.id)}
      className={`relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border p-5 cursor-pointer transition-all duration-150 overflow-hidden ${
        isActive
          ? 'border-[var(--page-accent)]/40 shadow-lg shadow-[var(--page-accent)]/5'
          : 'border-zinc-800/60 hover:border-zinc-700/60'
      }`}
    >
      {/* Top accent */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
        isActive ? 'via-[var(--page-accent)]/40' : 'via-zinc-600/20'
      } to-transparent`} />

      <div className="flex items-start gap-4">
        <AnimatedCircularProgressBar
          value={version.score}
          size={56}
          strokeWidth={5}
          gaugePrimaryColor={version.score >= 75 ? '#16a34a' : version.score >= 50 ? '#ca8a04' : '#dc2626'}
          gaugeSecondaryColor="color-mix(in srgb, var(--color-foreground) 14%, transparent)"
        >
          <NumberTicker value={version.score} className="text-xs font-bold text-[var(--color-foreground)] tabular-nums" />
        </AnimatedCircularProgressBar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">{version.versionName}</h4>
            {version.isCurrent && <Badge>Current</Badge>}
          </div>
          {version.targetRole && (
            <p className="text-xs text-zinc-400">{version.targetRole}</p>
          )}
          {version.targetCompany && (
            <p className="text-[10px] text-zinc-500">{version.targetCompany}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-500">
            <Clock className="w-2.5 h-2.5" />
            {new Date(version.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800/40">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onExport(version.id, 'pdf'); }} className="flex-1 text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 hover:bg-[var(--page-accent-10)]">
          <Download className="w-3.5 h-3.5 mr-1" /> PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onExport(version.id, 'markdown'); }} className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800/50">
          <Download className="w-3.5 h-3.5 mr-1" /> MD
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onDelete(version.id); }} className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
