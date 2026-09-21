import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, Globe, Database, Clock, Download, Trash2, Filter } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';

interface PrivacySectionProps {
  activeTab: string;
  settingsSearch: string;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
  tierAssignments: any;
  setTierAssignments: (v: any) => void;
  localAppColors: Record<string, string>;
  setLocalAppColors: (v: Record<string, string>) => void;
  localCategoryOrder: string[];
  setLocalCategoryOrder: (v: string[]) => void;
  categoryOrder: string[];
  setCategoryOrder: (v: string[]) => void;
  appCategoryOverrides: Record<string, string>;
  setAppCategoryOverrides: (v: Record<string, string>) => void;
  domainCategoryOverrides: Record<string, string>;
  setDomainCategoryOverrides: (v: Record<string, string>) => void;
  customCategories: string[];
  setCustomCategories: (v: string[]) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  appStats: any[];
  domainStats: any[];
  externalActivities: any[];
  externalActivityTiers: Record<number, string>;
  onExternalActivityTiersChange: (v: Record<number, string>) => void;
  allCategories: string[];
  getCategoryColor: (cat: string) => string;
  getAppDisplayCategory: (app: any) => string;
  changeAppCategory: () => void;
  DEFAULT_CATEGORIES: string[];
  saveChanges: () => void;
  findTier: (id: string) => string | null;
  removeCategoryFromTier: (tier: string, category: string) => void;
  getUnassignedCategories: () => string[];
  handleAddCategory: () => void;
  handleSaveSystemPrompt: () => void;
  idleThreshold: number;
  setIdleThreshold: (v: number) => void;
  autoExport: boolean;
  setAutoExport: (v: boolean) => void;
  autoStartEnabled: boolean;
  setAutoStartEnabled: (v: boolean) => void;
  timerBehavior: any;
  setLocalTimerBehavior: (v: any) => void;
  trackerAppMode: string;
  setTrackerAppMode: (v: string) => void;
  animationSpeed: string;
  setAnimationSpeed: (v: string) => void;
  dataSyncMode: string;
  setDataSyncMode: (v: string) => void;
  storageStatus: any;
  onExportData: () => void;
  onClearData: () => void;
  onCategoryOverridesChange: (v: any) => void;
  appColors: Record<string, string>;
  setAppColors: (v: Record<string, string>) => void;
  onReloadData: () => void;
}

export function PrivacySection(props: PrivacySectionProps) {
  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionHeader title="Privacy & Data" icon={<Shield className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div className="text-sm text-zinc-400">Privacy and data settings content</div>
      </GlassCard>
    </div>
  );
}
