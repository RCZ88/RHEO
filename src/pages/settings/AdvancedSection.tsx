import { motion } from "motion/react";
import { Settings, Database, Clock, Download, Trash2, RefreshCw, Terminal, ChevronRight, X, Plus, GripVertical, Palette, Check, ChevronDown, Globe, ChevronLeft, Search, AlertTriangle, Sparkles, ChevronUp, Loader2, Eye, EyeOff, DollarSign, Shield, Key, Save, Lock, LockOpen, History, Undo2, Pencil, Upload, FileText, SearchX, Inbox, Keyboard, Monitor, WandSparkles, Brain, Compass, Route, Network, Cpu, Activity, MapPin, Package, TrendingUp, BadgeInfo, Volume2, Mic, Headphones, Gamepad, Calculator, PieChart, BarChart3, Gauge, ArrowRight, ArrowUp } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { SectionHeader } from '../../components/SectionHeader';
import { ProviderDiagnostics } from '../../components/ProviderDiagnostics';
import { GlassCard } from '../../components/GlassCard';
import { PageShell } from '../../components/PageShell';
import { DevicesPanel } from '../../components/DevicesPanel';
import { AuthSettings } from '../../components/AuthSettings';
import BrowserProfileSettings from '../../components/BrowserProfileSettings';
import { BorderBeam } from '../../components/ui/border-beam';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { SearchableSection, TierContainer, SortableChip } from './shared';
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, DEFAULT_TIER_ASSIGNMENTS, PRESET_COLORS } from './constants';
import { useMemo, useRef, useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DatabasePage = lazy(() => import('../DatabasePage'));

interface AdvancedSectionProps {
  activeTab: string;
  settingsSearch: string;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
  setHasChanges: (v: boolean) => void;
  onRegisterSave: (fn: () => void) => void;
  onReloadData?: () => void;
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
  onCategoryOverridesChange?: (v: any) => void;
  appColors: Record<string, string>;
  setAppColors: (v: Record<string, string>) => void;
  categoryOrder: string[];
  setCategoryOrder: (v: string[]) => void;
  tierAssignments: any;
  setTierAssignments: (v: any) => void;
  localAppColors: Record<string, string>;
  setLocalAppColors: (v: Record<string, string>) => void;
  localCategoryOrder: string[];
  setLocalCategoryOrder: (v: string[]) => void;
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
  onExternalActivityTiersChange?: (v: Record<number, string>) => void;
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
  bootAnimEnabled: boolean;
  setBootAnimEnabled: (v: boolean) => void;
  bootAnimVariant: string;
  setBootAnimVariant: (v: string) => void;
  bootAnimWarm: boolean;
  setBootAnimWarm: (v: boolean) => void;
  bootAnimLoading: boolean;
  tbModeState: string;
  setTbModeState: (v: string) => void;
  systemPrompts?: any;
  setSystemPrompts?: (v: any) => void;
  promptProjectId?: string;
  setPromptProjectId?: (v: string) => void;
  promptProjects?: any[];
  setPromptProjects?: (v: any[]) => void;
  resumeCommands?: any;
  setResumeCommands?: (v: any) => void;
  financeCurrency?: string;
  setFinanceCurrency?: (v: string) => void;
  autoSave?: boolean;
  setAutoSave?: (v: boolean) => void;
  autoRecalc?: boolean;
  setAutoRecalc?: (v: boolean) => void;
  securitySettings?: any;
  setSecuritySettings?: (v: any) => void;
  originalSecuritySettings?: any;
  passwordReqs?: Record<string, boolean>;
  setPasswordReqs?: (v: Record<string, boolean>) => void;
  newPassword?: string;
  setNewPassword?: (v: string) => void;
  confirmPassword?: string;
  setConfirmPassword?: (v: string) => void;
  currentPassword?: string;
  setCurrentPassword?: (v: string) => void;
  passwordError?: string;
  setPasswordError?: (v: string) => void;
  passwordSuccess?: boolean;
  setPasswordSuccess?: (v: boolean) => void;
  handleSetFinanceCurrency?: () => void;
  handleSetRememberDevice?: () => void;
  handleSetLockTimeout?: () => void;
  handleChangePassword?: () => void;
}

export function AdvancedSection({ activeTab, settingsSearch, ...props }: AdvancedSectionProps) {
  const { idleThreshold, setIdleThreshold, autoExport, setAutoExport, autoStartEnabled, setAutoStartEnabled, timerBehavior, setLocalTimerBehavior, trackerAppMode, setTrackerAppMode, animationSpeed, setAnimationSpeed, dataSyncMode, setDataSyncMode, storageStatus, onExportData, onClearData, onCategoryOverridesChange, appColors, setAppColors, categoryOrder, setCategoryOrder, tierAssignments, setTierAssignments, localAppColors, setLocalAppColors, localCategoryOrder, setLocalCategoryOrder, appCategoryOverrides, setAppCategoryOverrides, domainCategoryOverrides, setDomainCategoryOverrides, customCategories, setCustomCategories, newCategoryName, setNewCategoryName, appStats, domainStats, externalActivities, externalActivityTiers, onExternalActivityTiersChange, allCategories, getCategoryColor, getAppDisplayCategory, changeAppCategory, DEFAULT_CATEGORIES, saveChanges, findTier, removeCategoryFromTier, getUnassignedCategories, handleAddCategory, handleSaveSystemPrompt, bootAnimEnabled, setBootAnimEnabled, bootAnimVariant, setBootAnimVariant, bootAnimWarm, setBootAnimWarm, bootAnimLoading, tbModeState, setTbModeState, systemPrompts, setSystemPrompts, promptProjectId, setPromptProjectId, promptProjects, setPromptProjects, resumeCommands, setResumeCommands, financeCurrency, setFinanceCurrency, autoSave, setAutoSave, autoRecalc, setAutoRecalc, securitySettings, setSecuritySettings, originalSecuritySettings, passwordReqs, setPasswordReqs, newPassword, setNewPassword, confirmPassword, setConfirmPassword, currentPassword, setCurrentPassword, passwordError, setPasswordError, passwordSuccess, setPasswordSuccess, handleSetFinanceCurrency, handleSetRememberDevice, handleSetLockTimeout, handleChangePassword } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const findTierLocal = (id: string): 'productive' | 'neutral' | 'distracting' | null => { if (tierAssignments.productive.includes(id)) return 'productive'; if (tierAssignments.neutral.includes(id)) return 'neutral'; if (tierAssignments.distracting.includes(id)) return 'distracting'; return null; };
  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string); setActiveContainer(findTierLocal(event.active.id as string)); };
  const handleDragOver = (event: DragOverEvent) => { const { active, over } = event; if (!over) return; const activeId = active.id as string; const overId = over.id as string; let overContainer: string | null = null; if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') overContainer = overId; else overContainer = findTierLocal(overId); if (!overContainer || overContainer === activeContainer) return; setTierAssignments(prev => { const src = activeContainer as 'productive' | 'neutral' | 'distracting'; const dst = overContainer as 'productive' | 'neutral' | 'distracting'; if (!prev[src].includes(activeId)) return prev; const newTiers = { ...prev }; newTiers[src] = newTiers[src].filter(c => c !== activeId); newTiers[dst] = [...newTiers[dst], activeId]; return newTiers; }); setActiveContainer(overContainer); };
  const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; setActiveId(null); setActiveContainer(null); if (!over) return; const activeId = active.id as string; const overId = over.id as string; const sourceTier = findTierLocal(activeId); let destTier: 'productive' | 'neutral' | 'distracting' | null = null; if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') destTier = overId; else destTier = findTierLocal(overId); if (!sourceTier || !destTier || sourceTier === destTier) return; setTierAssignments(prev => { const newTiers = { ...prev }; newTiers[sourceTier] = newTiers[sourceTier].filter(c => c !== activeId); newTiers[destTier] = [...newTiers[destTier], activeId]; return newTiers; }); props.setHasChanges(true); props.onHasChangesChange(true); };

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab {...props} sensors={sensors} />;
      case 'category': return <CategoryTab {...props} sensors={sensors} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragEnd={handleDragEnd} customCategories={customCategories} setCustomCategories={setCustomCategories} />;
      case 'finance': return <FinanceTab {...props} />;
      case 'database': return <Suspense fallback={<div className="py-24 flex items-center justify-center text-zinc-500 text-sm">Loading database…</div>}><DatabasePage /></Suspense>;
      case 'devices': return <DevicesPanel />;
      case 'auth': return <AuthSettings />;
      default: return null;
    }
  };
  return <div className="space-y-4">{renderContent()}</div>;
}

function GeneralTab(props: any) {
  const { settingsSearch, idleThreshold, setIdleThreshold, autoExport, setAutoExport, autoStartEnabled, setAutoStartEnabled, timerBehavior, setLocalTimerBehavior, trackerAppMode, setTrackerAppMode, animationSpeed, setAnimationSpeed, dataSyncMode, setDataSyncMode, storageStatus, onExportData, onClearData, hasChanges, onHasChangesChange, saveChanges, bootAnimEnabled, setBootAnimEnabled, bootAnimVariant, setBootAnimVariant, bootAnimWarm, setBootAnimWarm, bootAnimLoading, tbModeState, setTbModeState } = props;
  return (
    <div data-section="settings.general" className="space-y-4">
      <SearchableSection terms={['behavior', 'idle', 'threshold', 'neutral', 'distracting', 'pause', 'reset', 'ignore', 'auto-start', 'auto-export', 'animation', 'window mode']} search={settingsSearch}>
      <GlassCard className="space-y-4">
        <div><h2 className="text-lg font-semibold mb-3">App Tracker Behavior</h2></div>
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">App Tracker Window Mode</label><div className="flex gap-2">{(['show-other', 'pause', 'track'] as const).map(mode => <button key={mode} onClick={() => { setTrackerAppMode(mode); props.setTrackerAppModeProp?.(mode); props.onHasChangesChange(true); }} className={`px-3 py-2 rounded-lg text-sm font-medium transition flex-1 ${trackerAppMode === mode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}>{mode === 'show-other' ? 'Show Other Apps' : mode === 'pause' ? 'Pause Timer' : 'Track as Normal'}</button>)}</div></div>
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">Idle Threshold</label><div className="flex gap-2">{[3, 5, 10].map(m => <button key={m} onClick={() => { setIdleThreshold(m); props.onHasChangesChange(true); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${idleThreshold === m ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}>{m} min</button>)}</div></div>
        <div className="flex items-center justify-between py-2"><div><div className="text-sm font-medium">Auto-Export</div><div className="text-xs text-zinc-500">Export data periodically</div></div><button onClick={() => { setAutoExport(!autoExport); props.onHasChangesChange(true); }} className={`w-12 h-6 rounded-full transition-colors duration-150 relative ${autoExport ? 'bg-emerald-500' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-colors duration-150 ${autoExport ? 'left-7' : 'left-1'}`} /></button></div>
        <div className="flex items-center justify-between py-2"><div><div className="text-sm font-medium">Auto-Start</div><div className="text-xs text-zinc-500">Launch on system startup</div></div><button onClick={async () => { const newValue = !autoStartEnabled; setAutoStartEnabled(newValue); props.setAutoStartEnabledProp?.(newValue); props.onHasChangesChange(true); if (window.deskflowAPI?.setAutoStart) await window.deskflowAPI.setAutoStart(newValue); }} className={`w-12 h-6 rounded-full transition-colors duration-150 relative ${autoStartEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-colors duration-150 ${autoStartEnabled ? 'left-7' : 'left-1'}`} /></button></div>
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">Animation Speed</label><div className="flex gap-1.5">{(['slow', 'normal', 'instant'] as const).map((speed) => <button key={speed} onClick={() => { setAnimationSpeed(speed); props.onHasChangesChange(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${animationSpeed === speed ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}>{speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal' : 'Off'}</button>)}</div></div>
      </GlassCard>
      </SearchableSection>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"><div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30"><div className="flex items-center gap-2 mb-2"><Database className="w-3.5 h-3.5 text-zinc-400" /><span className="text-sm font-medium">Storage</span></div><div className="space-y-1 text-xs text-zinc-400"><div className="flex justify-between"><span className="text-zinc-500">Type:</span><span>{storageStatus.type === 'sqlite' ? 'SQLite' : storageStatus.type === 'json' ? 'JSON' : 'None'}</span></div><div className="flex justify-between"><span className="text-zinc-500">Records:</span><span>{storageStatus.logCount.toLocaleString()}</span></div></div></div><div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30"><div className="flex items-center gap-2 mb-2"><Download className="w-3.5 h-3.5 text-zinc-400" /><span className="text-sm font-medium">Export</span></div><div className="flex gap-1.5"><button onClick={() => onExportData('csv')} className="flex-1 px-2 py-1.5 bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 rounded-md text-xs font-medium transition">CSV</button><button onClick={() => onExportData('json')} className="flex-1 px-2 py-1.5 bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 rounded-md text-xs font-medium transition">JSON</button></div></div></div>
    </div>
  );
}

function CategoryTab(props: any) {
  const { tierAssignments, setTierAssignments, allCategories, getCategoryColor, findTier, removeCategoryFromTier, getUnassignedCategories, handleAddCategory, newCategoryName, setNewCategoryName, customCategories, setCustomCategories, settingsSearch, hasChanges, onHasChangesChange, appStats, domainStats } = props;
  return (
    <div data-section="settings.category" className="space-y-4">
      <SearchableSection terms={['custom', 'categories', 'add category', 'new category']} search={settingsSearch}>
      <GlassCard><div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-semibold">Custom Categories</h2><p className="text-xs text-zinc-500">Add new categories beyond the defaults</p></div></div>{customCategories.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{customCategories.map(cat => <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: `${getCategoryColor(cat)}20`, color: getCategoryColor(cat) }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(cat) }} /><span>{cat}</span><button onClick={async () => { if (window.deskflowAPI?.removeCategory) await window.deskflowAPI.removeCategory(cat); setCustomCategories(prev => prev.filter(c => c !== cat)); setTierAssignments(prev => ({ ...prev, neutral: prev.neutral.filter(c => c !== cat) })); props.onHasChangesChange(true); }} className="ml-1 p-0.5 hover:bg-white/10 rounded transition-colors"><X className="w-3 h-3" /></button></div>)}</div>}<div className="flex gap-2"><input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }} placeholder="New category name..." className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500" /><button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button></div></GlassCard></SearchableSection>
      <SearchableSection terms={['productivity', 'tier', 'productive', 'neutral', 'distracting', 'drag', 'drop']} search={settingsSearch}>
      <GlassCard><div className="mb-4"><h2 className="text-lg font-semibold">Productivity</h2><p className="text-xs text-zinc-500">Drag categories between tiers</p></div><DndContext sensors={props.sensors} collisionDetection={closestCenter} onDragStart={props.handleDragStart} onDragOver={props.handleDragOver} onDragEnd={props.handleDragEnd}><div className="grid grid-cols-1 lg:grid-cols-3 gap-3"><TierContainer tier="productive" color="#22c55e" label="Productive" description="Full productivity credit." creditLabel="100%"><SortableContext items={tierAssignments.productive} strategy={verticalListSortingStrategy}>{tierAssignments.productive.map(id => <SortableChip key={id} id={id} color="#22c55e" onRemove={() => removeCategoryFromTier('productive', id)} />)}</SortableContext></TierContainer><TierContainer tier="neutral" color="#3b82f6" label="Neutral" description="Partial credit." creditLabel="50%"><SortableContext items={tierAssignments.neutral} strategy={verticalListSortingStrategy}>{tierAssignments.neutral.map(id => <SortableChip key={id} id={id} color="#3b82f6" onRemove={() => removeCategoryFromTier('neutral', id)} />)}</SortableContext></TierContainer><TierContainer tier="distracting" color="#ef4444" label="Distracting" description="No credit." creditLabel="0%"><SortableContext items={tierAssignments.distracting} strategy={verticalListSortingStrategy}>{tierAssignments.distracting.map(id => <SortableChip key={id} id={id} color="#ef4444" onRemove={() => removeCategoryFromTier('distracting', id)} />)}</SortableContext></TierContainer></div></DndContext></GlassCard></SearchableSection>
    </div>
  );
}

function FinanceTab(props: any) {
  const { financeCurrency, setFinanceCurrency, autoSave, setAutoSave, autoRecalc, setAutoRecalc, securitySettings, setSecuritySettings, originalSecuritySettings, passwordReqs, setPasswordReqs, newPassword, setNewPassword, confirmPassword, setConfirmPassword, currentPassword, setCurrentPassword, passwordError, setPasswordError, passwordSuccess, setPasswordSuccess, handleSetFinanceCurrency, handleSetRememberDevice, handleSetLockTimeout, handleChangePassword } = props;
  return (
    <div data-section="settings.finance" className="space-y-4">
      <div><h2 className="text-lg font-semibold">Finance Currency</h2><p className="text-xs text-zinc-500">Set the base display currency</p></div>
      <div className="pt-2 border-t border-zinc-700/50" />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5">{[['USD', '$', 'US Dollar'], ['IDR', 'Rp', 'Rupiah'], ['EUR', '€', 'Euro'], ['GBP', '£', 'Pound']].map(([code, symbol, name]) => <button key={code} onClick={() => handleSetFinanceCurrency(code)} className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs transition-colors ${financeCurrency === code ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800/50 light:bg-zinc-100/50 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700/50'}`}><span className="text-sm font-medium">{symbol}</span><span className="text-[10px]">{code}</span></button>)}</div>
      <div className="flex items-center justify-between py-2"><div><div className="text-sm font-medium">Auto-save</div><div className="text-[10px] text-zinc-600 mt-0.5">Automatically save changes</div></div><button onClick={() => { const next = !autoSave; setAutoSave(next); if (window.deskflowAPI?.financeSetAutoSave) window.deskflowAPI.financeSetAutoSave(next); }} className={`w-10 h-5 rounded-full transition-colors ${autoSave ? 'bg-emerald-500' : 'bg-zinc-700'}`}><div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${autoSave ? 'translate-x-5' : ''}`} /></button></div>
      {securitySettings && <GlassCard className="space-y-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center"><Shield className="w-4 h-4 text-amber-400" /></div><div><h2 className="text-lg font-semibold">Password Protection</h2><p className="text-xs text-zinc-500">Choose which actions require password</p></div></div><div className="pt-2 border-t border-zinc-700/50" /><div className="space-y-3">{[['password_req_delete_account', 'Delete accounts'], ['password_req_delete_wallet', 'Delete wallets'], ['password_req_delete_transaction', 'Delete transactions']].map(([key, label]) => <div key={key} className="flex items-center justify-between"><span className="text-[11px] text-zinc-400">{label}</span><button onClick={() => { const next = !passwordReqs[key]; setPasswordReqs(prev => ({ ...prev, [key]: next })); props.onHasChangesChange(true); }} className={`w-10 h-5 rounded-full transition-colors ${passwordReqs[key] ? 'bg-emerald-500' : 'bg-zinc-700'}`}><div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${passwordReqs[key] ? 'translate-x-5' : ''}`} /></button></div>)}</div></GlassCard>}
    </div>
  );
}
