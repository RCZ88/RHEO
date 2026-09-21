import { motion } from 'framer-motion';
import { Settings, User, Mail, Shield, Bell, Globe, Image, Edit3 } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';
import { Button } from '../../components/ui/button';
import { AuthSettings } from '../../components/AuthSettings';

export function ProfileSection() {
  return (
    <div data-section="settings.profile" className="space-y-6">
      <GlassCard className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Profile</h2>
          <p className="text-sm text-zinc-400 mb-4">Manage your account details and preferences</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            <User className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-200">User Account</h3>
            <p className="text-sm text-zinc-500">Manage your profile information</p>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="space-y-4">
        <SectionHeader title="Authentication" icon={<Shield className="w-5 h-5" />} />
        <AuthSettings />
      </GlassCard>
    </div>
  );
}
