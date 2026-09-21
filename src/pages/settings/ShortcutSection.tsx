import { motion } from 'framer-motion';
import { Keyboard, RefreshCw } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';

interface ShortcutSectionProps {
  shortcuts: Record<string, string>;
  setShortcuts: (v: Record<string, string>) => void;
  recordingKey: string | null;
  setRecordingKey: (v: string | null) => void;
  SHORTCUT_CONFIG: Record<string, string>;
  restoreDefaults: () => void;
  settingsSearch: string;
}

export function ShortcutSection({ shortcuts, setShortcuts, recordingKey, setRecordingKey, SHORTCUT_CONFIG, restoreDefaults, settingsSearch }: ShortcutSectionProps) {
  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionHeader title="Keyboard Shortcuts" icon={<Keyboard className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div className="text-sm text-zinc-400">Keyboard shortcut settings content</div>
      </GlassCard>
    </div>
  );
}
