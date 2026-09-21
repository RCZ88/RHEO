import { motion } from 'framer-motion';
import { Bell, AlertTriangle, Volume2, Mic } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';

interface NotificationSectionProps {
  filterTransientApps: boolean;
  setFilterTransientApps: (v: boolean) => void;
  browserRecordingMode: string;
  setBrowserRecordingMode: (v: string) => void;
  appRecordingMode: string;
  setAppRecordingMode: (v: string) => void;
  sleepGapMs: number;
  setSleepGapMs: (v: number) => void;
  maxSessionMs: number;
  setMaxSessionMs: (v: number) => void;
  trackingPollInterval: number;
  setTrackingPollInterval: (v: number) => void;
  availableBrowsers: string[];
  selectedBrowsers: string[];
  setSelectedBrowsers: (v: string[]) => void;
  serverStatus: any;
  settingsSearch: string;
}

export function NotificationSection({ filterTransientApps, setFilterTransientApps, browserRecordingMode, setBrowserRecordingMode, appRecordingMode, setAppRecordingMode, sleepGapMs, setSleepGapMs, maxSessionMs, setMaxSessionMs, trackingPollInterval, setTrackingPollInterval, availableBrowsers, selectedBrowsers, setSelectedBrowsers, serverStatus, settingsSearch }: NotificationSectionProps) {
  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionHeader title="Tracking" icon={<Bell className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div className="text-sm text-zinc-400">Notification and tracking settings content</div>
      </GlassCard>
    </div>
  );
}
