import { motion } from 'framer-motion';
import { Bell, AlertTriangle, Volume2, Mic, Mail, Push, MessageSquare } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';
import { Button } from '../../components/ui/button';

export function NotificationSection() {
  return (
    <div data-section="settings.notifications" className="space-y-6">
      <GlassCard className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Notifications</h2>
          <p className="text-sm text-zinc-400 mb-4">Control how and when you receive alerts</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-zinc-400" /><span className="text-sm text-zinc-300">Push Notifications</span></div>
            <button className="w-10 h-5 rounded-full bg-emerald-500"><span className="block w-3.5 h-3.5 rounded-full bg-white translate-x-5" /></button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-zinc-400" /><span className="text-sm text-zinc-300">Sound Alerts</span></div>
            <button className="w-10 h-5 rounded-full bg-zinc-700"><span className="block w-3.5 h-3.5 rounded-full bg-white translate-x-0" /></button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2"><Mic className="w-4 h-4 text-zinc-400" /><span className="text-sm text-zinc-300">Voice Alerts</span></div>
            <button className="w-10 h-5 rounded-full bg-zinc-700"><span className="block w-3.5 h-3.5 rounded-full bg-white translate-x-0" /></button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
