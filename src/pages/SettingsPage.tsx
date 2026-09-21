import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Clock, Download, Trash2, RefreshCw, Terminal, ChevronRight, X, Plus, GripVertical, Palette, Check, ChevronDown, Globe, ChevronLeft, Search, AlertTriangle, Sparkles, ChevronUp, Loader2, Eye, EyeOff, DollarSign, Shield, Key, Save, Lock, LockOpen, History, Undo2, Pencil, Upload, FileText, SearchX, Inbox, Keyboard, Monitor } from 'lucide-react';
import { lazy } from 'react';
import {
  DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_SYSTEM_PROMPT } from '../lib/defaults';
import { migrateSystemPrompts, projectKey } from '../lib/promptAssembly';
import { useLocation } from 'react-router-dom';
import { useNumberMask } from '../context/NumberMaskContext';
import { SectionHeader } from '../components/SectionHeader';
import { ProviderDiagnostics } from '../components/ProviderDiagnostics';
import { GlassCard } from '../components/GlassCard';
import { PageShell } from '../components/PageShell';
import { DevicesPanel } from '../components/DevicesPanel';
import { AuthSettings } from '../components/AuthSettings';
import BrowserProfileSettings from '../components/BrowserProfileSettings';
import { BorderBeam } from '../components/ui/border-beam';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { SearchableSection } from './settings/shared';
const DatabasePage = lazy(() => import('./DatabasePage'));
import { DEFAULT_CATEGORIES, DEFAULT_TIER_ASSIGNMENTS } from './settings/constants';
import { ProfileSection } from './settings/ProfileSection';
import { AppearanceSection } from './settings/AppearanceSection';
import { NotificationSection } from './settings/NotificationSection';
import { PrivacySection } from './settings/PrivacySection';
import { IntegrationSection } from './settings/IntegrationSection';
import { ShortcutSection } from './settings/ShortcutSection';
import { AdvancedSection } from './settings/AdvancedSection';
import type { TabId } from './settings/types';

export default function SettingsPage({
  logs = [], appStats = [], storageStatus = { type: 'none', working: false, path: '', logCount: 0 },
  idleThreshold = 5, setIdleThreshold = () => {}, autoExport = false, setAutoExport = () => {},
  onClearData, onExportData, onViewDatabase, onRegisterSave, onRequestNavigate,
  onHasChangesChange, onReloadData, onCategoryOverridesChange,
  appColors = {}, setAppColors, categoryOrder = DEFAULT_CATEGORIES.slice(0, 9), setCategoryOrder,
  autoStartEnabled: autoStartEnabledProp = false, setAutoStartEnabled: setAutoStartEnabledProp = () => {},
  timerBehavior: timerBehaviorProp = { neutralAction: 'pause', distractingAction: 'reset' },
  setTimerBehavior: setTimerBehaviorProp = () => {},
  trackerAppMode: trackerAppModeProp = 'track', setTrackerAppMode: setTrackerAppModeProp = () => {},
  externalActivities = [], externalActivityTiers = {}, onExternalActivityTiersChange,
}: any) {
  const [activeTab, setActiveTab] = useState<TabId>(() => { const saved = localStorage.getItem('settings-activeTab'); return (saved as any) || 'category'; });
  const location = useLocation();
  useEffect(() => { const tab = (location.state as any)?.tab; if (tab) setActiveTab(tab); }, []);
  const [tierAssignments, setTierAssignments] = useState(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-tier-assignments'); if (saved) { try { return JSON.parse(saved); } catch {} } } return DEFAULT_TIER_ASSIGNMENTS; });
  const [hasChanges, setHasChanges] = useState(false);
  const [localAppColors, setLocalAppColors] = useState<Record<string, string>>(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-planet-colors'); if (saved) { try { return JSON.parse(saved); } catch {} } } return appColors; });
  const [localCategoryOrder, setLocalCategoryOrder] = useState<string[]>(categoryOrder);
  const [autoStartEnabled, setAutoStartEnabled] = useState(autoStartEnabledProp);
  const [localTimerBehavior, setLocalTimerBehavior] = useState(timerBehaviorProp);
  const [trackerAppMode, setTrackerAppMode] = useState(trackerAppModeProp);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localExternalTiers, setLocalExternalTiers] = useState<Record<number, string>>(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-external-activity-tiers'); if (saved) { try { return JSON.parse(saved); } catch {} } } return externalActivityTiers; });
  const [agentColorOverrides, setAgentColorOverrides] = useState<Record<string, string>>(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-agent-colors'); if (saved) { try { return JSON.parse(saved); } catch {} } } return {}; });
  const [financePasswordSettings, setFinancePasswordSettings] = useState({ overview: true, accounts: true, transactions: true, categories: true, masterPassword: '' });
  const { showNumbers, setShowNumbers, maskMode, setMaskMode, maskFixedValue, setMaskFixedValue } = useNumberMask();
  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  useEffect(() => { if (trackerAppModeProp !== trackerAppMode) setTrackerAppMode(trackerAppModeProp); }, [trackerAppModeProp]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const savedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedNoticeTimer = () => { if (savedNoticeTimerRef.current) { clearTimeout(savedNoticeTimerRef.current); savedNoticeTimerRef.current = null; } };
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const DEFAULT_SHORTCUTS = { voiceInput: 'Ctrl+Shift+V', commandPalette: 'Ctrl+K', aiChatVoice: 'Ctrl+Shift+M', aiPageTranscript: 'Ctrl+Shift+L', aiPagePalette: 'Ctrl+K', designWorkspacePalette: 'Cmd+K', externalSelect: 'Enter', externalDeselect: 'Escape', canvasUndo: 'Ctrl+Z', canvasRedo: 'Ctrl+Shift+Z', financeNewTx: 'Ctrl+N', chatSend: 'Ctrl+Enter', pageContextSearch: 'Ctrl+F', ideAddProject: 'Ctrl+A', ideRefresh: 'Ctrl+R', resumeSubmit: 'Ctrl+Enter', terminalNewTab: 'Ctrl+Shift+T', terminalCloseTab: 'Ctrl+Shift+W', terminalRename: 'Ctrl+Shift+R', terminalPin: 'Ctrl+Shift+P', terminalNextTab: 'Ctrl+Tab', terminalPrevTab: 'Ctrl+Shift+Tab', terminalSplitH: 'Ctrl+Shift+H', terminalSplitV: 'Ctrl+Shift+V', terminalNextPane: 'Ctrl+Shift+ArrowRight', terminalPrevPane: 'Ctrl+Shift+ArrowLeft', terminalZoom: 'Ctrl+Shift+Z', terminalBroadcast: 'Ctrl+Shift+B', terminalPalette: 'Ctrl+K', terminalClear: 'Ctrl+L', terminalWorkspace: 'Ctrl+Shift+S', terminalFind: 'Ctrl+Shift+F', terminalSaveCmd: 'Ctrl+Shift+D', terminalCycleTheme: 'Ctrl+Shift+Y', terminalFindInPanes: 'Ctrl+Shift+T', terminalBalance: 'Ctrl+Shift+Space', terminalExport: 'Ctrl+Shift+E', terminalSplitFind: 'Ctrl+Shift+J', terminalSplitFindHist: 'Ctrl+Shift+K', terminalEnter: 'Enter', lyceumHome: 'g h', lyceumLibrary: 'g l', lyceumStudy: 'g s', lyceumNext: 'j / ↓', lyceumPrev: 'k / ↑', lyceumTutor: 'a', lyceumGraph: 'g', lyceumCompose: 'c', lyceumImport: 'i', lyceumShortcuts: '?', lyceumClose: 'Esc' };
  useEffect(() => { if (window.deskflowAPI?.getKeyboardShortcuts) { window.deskflowAPI.getKeyboardShortcuts().then(sc => { if (sc && typeof sc === 'object') setShortcuts({ ...DEFAULT_SHORTCUTS, ...sc }); else setShortcuts({ ...DEFAULT_SHORTCUTS }); }).catch(() => setShortcuts({ ...DEFAULT_SHORTCUTS })); } else { setShortcuts({ ...DEFAULT_SHORTCUTS }); } }, []);
  const restoreDefaults = () => setShortcuts({ ...DEFAULT_SHORTCUTS });
  const startRecording = (key: string) => setRecordingKey(key);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const findTier = (id: string): 'productive' | 'neutral' | 'distracting' | null => { if (tierAssignments.productive.includes(id)) return 'productive'; if (tierAssignments.neutral.includes(id)) return 'neutral'; if (tierAssignments.distracting.includes(id)) return 'distracting'; return null; };
  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string); setActiveContainer(findTier(event.active.id as string)); };
  const handleDragOver = (event: DragOverEvent) => { const { active, over } = event; if (!over) return; const activeId = active.id as string; const overId = over.id as string; let overContainer: string | null = null; if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') overContainer = overId; else overContainer = findTier(overId); if (!overContainer || overContainer === activeContainer) return; setTierAssignments(prev => { const src = activeContainer as 'productive' | 'neutral' | 'distracting'; const dst = overContainer as 'productive' | 'neutral' | 'distracting'; if (!prev[src].includes(activeId)) return prev; const newTiers = { ...prev }; newTiers[src] = newTiers[src].filter(c => c !== activeId); newTiers[dst] = [...newTiers[dst], activeId]; return newTiers; }); setActiveContainer(overContainer); };
  const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; setActiveId(null); setActiveContainer(null); if (!over) return; const activeId = active.id as string; const overId = over.id as string; const sourceTier = findTier(activeId); let destTier: 'productive' | 'neutral' | 'distracting' | null = null; if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') destTier = overId; else destTier = findTier(overId); if (!sourceTier || !destTier || sourceTier === destTier) return; setTierAssignments(prev => { const newTiers = { ...prev }; newTiers[sourceTier] = newTiers[sourceTier].filter(c => c !== activeId); newTiers[destTier] = [...newTiers[destTier], activeId]; return newTiers; }); setHasChanges(true); onHasChangesChange(true); };
  const [animationSpeed, setAnimationSpeed] = useState<'slow' | 'normal' | 'instant'>(() => { if (typeof window !== 'undefined') return (localStorage.getItem('deskflow-animation-speed') as 'slow' | 'normal' | 'instant') || 'normal'; return 'normal'; });
  const [bootAnimEnabled, setBootAnimEnabled] = useState(true);
  const [bootAnimVariant, setBootAnimVariant] = useState<'meridian' | 'minimal'>('meridian');
  const [bootAnimWarm, setBootAnimWarm] = useState(false);
  const [bootAnimLoading, setBootAnimLoading] = useState(true);
  useEffect(() => { (async () => { try { if (window.deskflowAPI?.getPreference) { const cfg = await window.deskflowAPI.getPreference('boot_animation'); if (cfg && typeof cfg === 'object') { setBootAnimEnabled(cfg.enabled !== false); setBootAnimVariant(cfg.variant === 'minimal' ? 'minimal' : 'meridian'); setBootAnimWarm(!!cfg.warmStart); } } } catch {} setBootAnimLoading(false); })(); }, []);
  const [tbModeState, setTbModeState] = useState<'always' | 'hover' | 'auto'>('always');
  useEffect(() => { (async () => { try { if ((window as any)?.deskflowAPI?.getTitleBarMode) { const mode = await (window as any).deskflowAPI.getTitleBarMode(); if (mode && typeof mode === 'string') setTbModeState(mode as 'always' | 'hover' | 'auto'); } } catch {} })(); }, []);
  const [appCategoryOverrides, setAppCategoryOverrides] = useState<Record<string, string>>({});
  const [domainCategoryOverrides, setDomainCategoryOverrides] = useState<Record<string, string>>({});
  useEffect(() => { const loadOverrides = async () => { const overrides: Record<string, string> = {}; const domainOverrides: Record<string, string> = {}; if (typeof window !== 'undefined') { try { const saved = localStorage.getItem('deskflow-app-category-overrides'); if (saved) Object.assign(overrides, JSON.parse(saved)); } catch {} try { const saved = localStorage.getItem('deskflow-domain-category-overrides'); if (saved) Object.assign(domainOverrides, JSON.parse(saved)); } catch {} } if (window.deskflowAPI?.getCategoryConfig) { try { const config = await window.deskflowAPI.getCategoryConfig(); if (config?.appCategoryMap) Object.assign(overrides, config.appCategoryMap); if (config?.domainCategoryMap) Object.assign(domainOverrides, config.domainCategoryMap); if (config?.customCategories) setCustomCategories(config.customCategories); } catch {} } if (window.deskflowAPI?.getTierAssignments) { try { const backendTiers = await window.deskflowAPI.getTierAssignments(); if (backendTiers) setTierAssignments(prev => { const merged = { productive: [...new Set([...prev.productive, ...(backendTiers.productive || [])])], neutral: [...new Set([...prev.neutral, ...(backendTiers.neutral || [])])], distracting: [...new Set([...prev.distracting, ...(backendTiers.distracting || [])])] }; return merged; }); } catch {} } setAppCategoryOverrides(overrides); setDomainCategoryOverrides(domainOverrides); }; loadOverrides(); }, []);
  const [dataSyncMode, setDataSyncMode] = useState<'forward' | 'refactor'>(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-data-sync-mode'); if (saved === 'refactor' || saved === 'forward') return saved; } return 'forward'; });
  useEffect(() => { localStorage.setItem('deskflow-data-sync-mode', dataSyncMode); }, [dataSyncMode]);
  const [refactorPhase, setRefactorPhase] = useState<string>('idle');
  const [refactorPreview, setRefactorPreview] = useState<any>(null);
  const [refactorMessage, setRefactorMessage] = useState('');
  const [refactorConfirmOpen, setRefactorConfirmOpen] = useState(false);
  const [refactorDoneCount, setRefactorDoneCount] = useState(0);
  const buildOverrideMaps = () => { const appOverrides: Record<string, string> = {}; const domainOverrides: Record<string, string> = {}; for (const [app, category] of Object.entries(appCategoryOverrides)) { if (app && typeof category === 'string' && category.trim()) appOverrides[app.toLowerCase()] = category.trim(); } for (const [domain, category] of Object.entries(domainCategoryOverrides)) { if (domain && typeof category === 'string' && category.trim()) domainOverrides[domain.toLowerCase()] = category.trim(); } return { appOverrides, domainOverrides }; };
  const analyzeRefactor = async () => { if (!window.deskflowAPI?.previewCategoriesFromOverrides) { setRefactorPhase('error'); setRefactorMessage('Category preview is not available.'); return; } const { appOverrides, domainOverrides } = buildOverrideMaps(); setRefactorPhase('analyzing'); setRefactorMessage(''); try { const result = await window.deskflowAPI.previewCategoriesFromOverrides(appOverrides, domainOverrides); if (result.success) setRefactorPreview({ success: true, totalMismatch: typeof result.totalMismatch === 'number' ? result.totalMismatch : 0, mismatches: Array.isArray(result.mismatches) ? result.mismatches : [], byCategory: result.byCategory && typeof result.byCategory === 'object' ? result.byCategory : {} }); setRefactorPhase('preview'); } catch (err) { setRefactorPhase('error'); setRefactorMessage('Analysis error: ' + (err as Error).message); } };
  const applyRefactor = async () => { if (!window.deskflowAPI?.updateCategoriesFromOverrides) { setRefactorPhase('error'); setRefactorMessage('Database sync is not available.'); return; } const { appOverrides, domainOverrides } = buildOverrideMaps(); setRefactorConfirmOpen(false); setRefactorPhase('running'); setRefactorMessage(''); try { const result = await window.deskflowAPI.updateCategoriesFromOverrides(appOverrides, domainOverrides); if (result.success) { setRefactorDoneCount(typeof result.updatedCount === 'number' ? result.updatedCount : 0); setRefactorPhase('done'); if (onReloadData) setTimeout(() => onReloadData(), 400); setTimeout(() => { if (dataSyncMode === 'refactor') analyzeRefactor(); }, 2600); } else { setRefactorPhase('error'); setRefactorMessage(result.error || 'Refactor failed.'); } } catch (err) { setRefactorPhase('error'); setRefactorMessage('Refactor error: ' + (err as Error).message); } };
  const getAssignedCategories = () => new Set([...tierAssignments.productive, ...tierAssignments.neutral, ...tierAssignments.distracting]);
  const removeCategoryFromTier = (tier: string, category: string) => { setTierAssignments(prev => ({ ...prev, [tier]: prev[tier].filter(c => c !== category) })); setHasChanges(true); onHasChangesChange(true); };
  const getUnassignedCategories = () => { const assigned = getAssignedCategories(); return allCategories.filter(cat => !assigned.has(cat)); };
  const handleAddCategory = async () => { const name = newCategoryName.trim(); if (!name) return; if (allCategories.includes(name)) return; if (window.deskflowAPI?.addCategory) await window.deskflowAPI.addCategory(name); setCustomCategories(prev => [...prev, name]); setTierAssignments(prev => ({ ...prev, neutral: [...prev.neutral, name] })); setNewCategoryName(''); setHasChanges(true); onHasChangesChange(true); };
  const saveChanges = async () => { clearSavedNoticeTimer(); try { if (window.deskflowAPI?.setTierAssignments) await window.deskflowAPI.setTierAssignments(tierAssignments); localStorage.setItem('deskflow-tier-assignments', JSON.stringify(tierAssignments)); localStorage.setItem('deskflow-planet-colors', JSON.stringify(localAppColors)); if (setAppColors) setAppColors(localAppColors); if (setCategoryOrder) { setCategoryOrder(localCategoryOrder); localStorage.setItem('deskflow-category-order', JSON.stringify(localCategoryOrder)); } localStorage.setItem('deskflow-app-category-overrides', JSON.stringify(appCategoryOverrides)); localStorage.setItem('deskflow-domain-category-overrides', JSON.stringify(domainCategoryOverrides)); if (window.deskflowAPI?.setAppCategory) await Promise.all(Object.entries(appCategoryOverrides).map(([appName, category]) => window.deskflowAPI!.setAppCategory(appName, category))); if (window.deskflowAPI?.setDomainCategory) await Promise.all(Object.entries(domainCategoryOverrides).map(([domain, category]) => window.deskflowAPI!.setDomainCategory(domain, category))); localStorage.setItem('deskflow-animation-speed', animationSpeed); localStorage.setItem('deskflow-agent-colors', JSON.stringify(agentColorOverrides)); if (window.deskflowAPI?.setPreference) await window.deskflowAPI.setPreference('boot_animation', { enabled: bootAnimEnabled, variant: bootAnimVariant, warmStart: bootAnimWarm }); if (window.deskflowAPI?.setPreference) await window.deskflowAPI.setPreference('trackerAppMode', trackerAppMode); try { if (typeof onCategoryOverridesChange === 'function') onCategoryOverridesChange(appCategoryOverrides); } catch (e) { console.error('[Settings] Error:', e); } try { if (typeof onReloadData === 'function') onReloadData(); } catch (e) { console.error('[Settings] Error:', e); } if (window.deskflowAPI?.financeSetDisplayCurrency) await window.deskflowAPI.financeSetDisplayCurrency(financeCurrency); } catch (err) { console.error('[Settings] Save failed:', err); } finally { setHasChanges(false); onHasChangesChange(false); setSavedNotice(true); clearSavedNoticeTimer(); savedNoticeTimerRef.current = setTimeout(() => setSavedNotice(false), 2500); } };
  useEffect(() => { if (onRegisterSave) onRegisterSave(saveChanges); }, [tierAssignments, localAppColors, localCategoryOrder, animationSpeed, appCategoryOverrides, domainCategoryOverrides, agentColorOverrides, onRegisterSave, saveChanges]);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [originalSecuritySettings, setOriginalSecuritySettings] = useState<any>(null);
  const [financeCurrency, setFinanceCurrency] = useState('USD');
  const [originalFinanceCurrency, setOriginalFinanceCurrency] = useState('USD');
  const [autoSave, setAutoSave] = useState(true);
  const [autoRecalc, setAutoRecalc] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordReqs, setPasswordReqs] = useState<Record<string, boolean>>({ password_req_delete_account: true, password_req_delete_wallet: true, password_req_delete_transaction: true });
  useEffect(() => { (async () => { try { if (window.deskflowAPI?.financeGetDisplayCurrency) { const r = await window.deskflowAPI.financeGetDisplayCurrency(); if (r?.currency) { setFinanceCurrency(r.currency); setOriginalFinanceCurrency(r.currency); } } } catch {} if (window.deskflowAPI?.financeGetSecuritySettings) { const s = await window.deskflowAPI.financeGetSecuritySettings(); setSecuritySettings(s); setOriginalSecuritySettings(s); } if (window.deskflowAPI?.financeGetPasswordRequirements) { const reqs = await window.deskflowAPI.financeGetPasswordRequirements(); if (reqs && Object.keys(reqs).length > 0) setPasswordReqs(reqs); } })(); }, []);
  const handleSetFinanceCurrency = (code: string) => { setFinanceCurrency(code); setHasChanges(true); onHasChangesChange(true); };
  const handleSetRememberDevice = async (remember: boolean, days: number) => { if (!securitySettings) return; const expires = remember ? Date.now() + days * 24 * 60 * 60 * 1000 : null; const updated = { ...securitySettings, rememberDevice: remember, rememberDeviceExpiry: expires }; setSecuritySettings(updated); setHasChanges(true); onHasChangesChange(true); if (window.deskflowAPI?.financeSetRememberDevice) await window.deskflowAPI.financeSetRememberDevice(remember, days); };
  const handleSetLockTimeout = async (timeoutMs: number) => { if (!securitySettings) return; const updated = { ...securitySettings, lockTimeout: timeoutMs }; setSecuritySettings(updated); setHasChanges(true); onHasChangesChange(true); if (window.deskflowAPI?.financeSetLockTimeout) await window.deskflowAPI.financeSetLockTimeout(timeoutMs); };
  const handleChangePassword = async () => { setPasswordError(''); setPasswordSuccess(''); try { const result = securitySettings?.hasPassword ? await window.deskflowAPI?.financeChangePassword?.(currentPassword, newPassword) : await window.deskflowAPI?.financeSetPassword?.(newPassword); if (result?.success) { setPasswordSuccess('Password updated'); setNewPassword(''); setConfirmPassword(''); setCurrentPassword(''); } else { setPasswordError((result as any)?.error || 'Failed'); } } catch (e: any) { setPasswordError(e?.message || 'Failed'); } };
  const tabs = [{ id: 'category', label: 'Category' }, { id: 'appearance', label: 'Appearance' }, { id: 'colors', label: 'Colors' }, { id: 'ai', label: 'AI Assistant' }, { id: 'general', label: 'General' }, { id: 'tracking', label: 'Tracking' }, { id: 'prompts', label: 'System Prompts' }, { id: 'finance', label: 'Finance' }, { id: 'devices', label: 'Devices' }, { id: 'database', label: 'Database' }, { id: 'auth', label: 'Auth' }, { id: 'shortcuts', label: 'Keyboard Shortcuts' }];
  const [domainStats, setDomainStats] = useState<any[]>([]);
  useEffect(() => { if (window.deskflowAPI?.getBrowserDomainStats && activeTab === 'category') { window.deskflowAPI.getBrowserDomainStats('all').then(stats => setDomainStats(stats || [])); } }, [activeTab]);
  useEffect(() => { localStorage.setItem('settings-activeTab', activeTab); }, [activeTab]);
  useEffect(() => { const handleOpenTab = (event: CustomEvent) => { const tab = event.detail; if (tab && tabs.some(t => t.id === tab)) setActiveTab(tab as any); }; window.addEventListener('settings:open-tab', handleOpenTab as any); return () => window.removeEventListener('settings:open-tab', handleOpenTab as any); }, [tabs]);
  const [editingAppCategory, setEditingAppCategory] = useState<string | null>(null);
  const [editingDomainCategory, setEditingDomainCategory] = useState<string | null>(null);
  const [appCarouselIndex, setAppCarouselIndex] = useState(0);
  const [domainCarouselIndex, setDomainCarouselIndex] = useState(0);
  const [appCarouselExpanded, setAppCarouselExpanded] = useState(false);
  const [domainCarouselExpanded, setDomainCarouselExpanded] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [domainSearchQuery, setDomainSearchQuery] = useState('');
  const [appSearchFilter, setAppSearchFilter] = useState('');
  const [editingExtActivity, setEditingExtActivity] = useState<number | null>(null);
  const [extCarouselIndex, setExtCarouselIndex] = useState(0);
  const [extCarouselExpanded, setExtCarouselExpanded] = useState(false);
  const [domainSearchFilter, setDomainSearchFilter] = useState('');
  const [colorTab, setColorTab] = useState<'apps' | 'websites'>('apps');
  const [colorSearchFilter, setColorSearchFilter] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [generatingColors, setGeneratingColors] = useState(false);
  const [generatingCategories, setGeneratingCategories] = useState(false);
  const [lockedApps, setLockedApps] = useState<Record<string, boolean>>({});
  const [lockedDomains, setLockedDomains] = useState<Record<string, boolean>>({});
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [changeHistory, setChangeHistory] = useState<any[]>([]);
  const [showChangeHistory, setShowChangeHistory] = useState(false);
  const [lockedSkipped, setLockedSkipped] = useState<string[]>([]);
  const [aiRun, setAiRun] = useState<any>(null);
  const [showRunLogs, setShowRunLogs] = useState(false);
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [apiKeyTestStatus, setApiKeyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiKeyTestMessage, setApiKeyTestMessage] = useState('');
  const [sttApiKey, setSttApiKey] = useState('');
  const [sttModel, setSttModel] = useState('whisper-large-v3-turbo');
  const [sttBaseUrl, setSttBaseUrl] = useState('https://api.groq.com/openai/v1/audio/transcriptions');
  const [showSttKey, setShowSttKey] = useState(false);
  const [interestTopics, setInterestTopics] = useState<string[]>([]);
  const [kbDocs, setKbDocs] = useState<any[]>([]);
  const [kbIngesting, setKbIngesting] = useState(false);
  const [kbQueryText, setKbQueryText] = useState('');
  const [kbResults, setKbResults] = useState<any[]>([]);
  const [kbQuerying, setKbQuerying] = useState(false);
  const kbFileInputRef = useRef<HTMLInputElement>(null);
  const [newTopic, setNewTopic] = useState('');
  const [aiUsageStats, setAiUsageStats] = useState({ totalCalls: 0, totalCost: 0 });
  const [aiConfig, setAiConfig] = useState({ briefModel: 'google/gemini-2.0-flash-001', weeklyModel: 'google/gemini-2.0-flash-001', digestModel: 'google/gemini-2.0-flash-001', anomalyModel: 'google/gemini-2.0-flash-001', autoGenerateBrief: true });
  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [aiProviderRouting, setAiProviderRouting] = useState<any>({ default: { providerId: '', model: '' }, researchDigest: null, goalAssistant: null });
  const [providerTestStatus, setProviderTestStatus] = useState<Record<string, string>>({});
  const [providerTestMessages, setProviderTestMessages] = useState<Record<string, string>>({});
  const [showProviderApiKeys, setShowProviderApiKeys] = useState<Record<string, boolean>>({});
  const [dataAccess, setDataAccess] = useState<Record<string, boolean>>({ projects: true, problems: true, requests: true, aiUsage: true, dashboardStats: true, goals: true, checklist: true, finance: true });
  const [keywordEnabledDomains, setKeywordEnabledDomains] = useState<string[]>([]);
  const [editingKeywordDomain, setEditingKeywordDomain] = useState<string | null>(null);
  const [domainKeywordSets, setDomainKeywordSets] = useState<Record<string, { category: string; keywords: string[] }[]>>({});
  const [newKeywordDomain, setNewKeywordDomain] = useState('');
  const [sleepGapMs, setSleepGapMs] = useState(10000);
  const [maxSessionMs, setMaxSessionMs] = useState(300000);
  const [trackingPollInterval, setTrackingPollInterval] = useState(1000);
  const [filterTransientApps, setFilterTransientApps] = useState(true);
  const [promptHistoryLimit, setPromptHistoryLimit] = useState(5);
  const [browserRecordingMode, setBrowserRecordingMode] = useState<'always' | 'on-view'>('always');
  const [appRecordingMode, setAppRecordingMode] = useState<'always' | 'on-view'>('always');
  const [availableBrowsers, setAvailableBrowsers] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({ claude: '', opencode: '', custom: '', generalAdditions: '' });
  const [promptProjectId, setPromptProjectId] = useState('');
  const [promptProjects, setPromptProjects] = useState<{ id: string; name: string }[]>([]);
  const [resumeCommands, setResumeCommands] = useState<Record<string, string>>({});
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);
  const setTrackerAppModeProp = (v: any) => {};
  const setTimerBehaviorProp = (v: any) => {};
  return (
    <PageShell page="settings">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold flex items-center gap-2.5"><Settings className="w-5 h-5 text-zinc-400" />Settings<p className="text-xs text-zinc-500 mt-1">Track and customize your app usage</p></div></div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" /><input type="text" value={settingsSearch} onChange={e => setSettingsSearch(e.target.value)} placeholder="Search settings..." className="w-full bg-zinc-900/50 light:bg-white/50 border border-zinc-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors" />{settingsSearch && <button onClick={() => setSettingsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>}</div>
      <div className="flex gap-1 bg-zinc-900/50 light:bg-white/50 p-1 rounded-xl">{tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${activeTab === tab.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'}`}>{tab.label}</button>)}</div>
      {activeTab === 'category' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} setHasChanges={setHasChanges} onRegisterSave={onRegisterSave} onReloadData={onReloadData} idleThreshold={idleThreshold} setIdleThreshold={setIdleThreshold} autoExport={autoExport} setAutoExport={setAutoExport} autoStartEnabled={autoStartEnabled} setAutoStartEnabled={setAutoStartEnabled} timerBehavior={localTimerBehavior} setLocalTimerBehavior={setLocalTimerBehavior} trackerAppMode={trackerAppMode} setTrackerAppMode={setTrackerAppMode} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} dataSyncMode={dataSyncMode} setDataSyncMode={setDataSyncMode} storageStatus={storageStatus} onExportData={onExportData} onClearData={onClearData} onCategoryOverridesChange={onCategoryOverridesChange} appColors={appColors} setAppColors={setAppColors} categoryOrder={categoryOrder} setCategoryOrder={setCategoryOrder} tierAssignments={tierAssignments} setTierAssignments={setTierAssignments} localAppColors={localAppColors} setLocalAppColors={setLocalAppColors} localCategoryOrder={localCategoryOrder} setLocalCategoryOrder={setLocalCategoryOrder} appCategoryOverrides={appCategoryOverrides} setAppCategoryOverrides={setAppCategoryOverrides} domainCategoryOverrides={domainCategoryOverrides} setDomainCategoryOverrides={setDomainCategoryOverrides} customCategories={customCategories} setCustomCategories={setCustomCategories} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} appStats={appStats} domainStats={domainStats} externalActivities={externalActivities} externalActivityTiers={externalActivityTiers} onExternalActivityTiersChange={onExternalActivityTiersChange} allCategories={allCategories} getCategoryColor={(cat: string) => cat} getAppDisplayCategory={(app: any) => app.category || 'Other'} changeAppCategory={() => {}} DEFAULT_CATEGORIES={DEFAULT_CATEGORIES} saveChanges={saveChanges} findTier={findTier} removeCategoryFromTier={removeCategoryFromTier} getUnassignedCategories={getUnassignedCategories} handleAddCategory={handleAddCategory} handleSaveSystemPrompt={() => {}} />}
      {activeTab === 'appearance' && <AppearanceSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} bootAnimEnabled={bootAnimEnabled} setBootAnimEnabled={setBootAnimEnabled} bootAnimVariant={bootAnimVariant} setBootAnimVariant={setBootAnimVariant} bootAnimWarm={bootAnimWarm} setBootAnimWarm={setBootAnimWarm} bootAnimLoading={bootAnimLoading} tbModeState={tbModeState} setTbModeState={setTbModeState} />}
      {activeTab === 'colors' && <AppearanceSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} localAppColors={localAppColors} setLocalAppColors={setLocalAppColors} appColors={appColors} setAppColors={setAppColors} categoryOrder={categoryOrder} setCategoryOrder={setCategoryOrder} getCategoryColor={() => ''} appStats={appStats} domainStats={domainStats} colorTab={colorTab} setColorTab={setColorTab} colorSearchFilter={colorSearchFilter} setColorSearchFilter={setColorSearchFilter} generatingColors={generatingColors} setGeneratingColors={setGeneratingColors} showUncategorizedOnly={showUncategorizedOnly} setShowUncategorizedOnly={setShowUncategorizedOnly} />}
      {activeTab === 'general' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} setHasChanges={setHasChanges} onRegisterSave={onRegisterSave} onReloadData={onReloadData} idleThreshold={idleThreshold} setIdleThreshold={setIdleThreshold} autoExport={autoExport} setAutoExport={setAutoExport} autoStartEnabled={autoStartEnabled} setAutoStartEnabled={setAutoStartEnabled} timerBehavior={localTimerBehavior} setLocalTimerBehavior={setLocalTimerBehavior} trackerAppMode={trackerAppMode} setTrackerAppMode={setTrackerAppMode} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} dataSyncMode={dataSyncMode} setDataSyncMode={setDataSyncMode} storageStatus={storageStatus} onExportData={onExportData} onClearData={onClearData} />}
      {activeTab === 'tracking' && <PrivacySection filterTransientApps={filterTransientApps} setFilterTransientApps={setFilterTransientApps} browserRecordingMode={browserRecordingMode} setBrowserRecordingMode={setBrowserRecordingMode} appRecordingMode={appRecordingMode} setAppRecordingMode={setAppRecordingMode} sleepGapMs={sleepGapMs} setSleepGapMs={setSleepGapMs} maxSessionMs={maxSessionMs} setMaxSessionMs={setMaxSessionMs} trackingPollInterval={trackingPollInterval} setTrackingPollInterval={setTrackingPollInterval} availableBrowsers={availableBrowsers} selectedBrowsers={selectedBrowsers} setSelectedBrowsers={setSelectedBrowsers} serverStatus={serverStatus} settingsSearch={settingsSearch} />}
      {activeTab === 'prompts' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} systemPrompts={systemPrompts} setSystemPrompts={setSystemPrompts} handleSaveSystemPrompt={() => {}} promptProjectId={promptProjectId} setPromptProjectId={setPromptProjectId} promptProjects={promptProjects} setPromptProjects={setPromptProjects} resumeCommands={resumeCommands} setResumeCommands={setResumeCommands} handleSaveResumeCommand={() => {}} handleSaveTrackingSetting={() => {}} settingsSearch={settingsSearch} />}
      {activeTab === 'ai' && <IntegrationSection openRouterApiKey={openRouterApiKey} setOpenRouterApiKey={setOpenRouterApiKey} apiKeyTestStatus={apiKeyTestStatus} setApiKeyTestStatus={setApiKeyTestStatus} apiKeyTestMessage={apiKeyTestMessage} setApiKeyTestMessage={setApiKeyTestMessage} aiConfig={aiConfig} setAiConfig={setAiConfig} aiProviders={aiProviders} setAiProviders={setAiProviders} aiProviderRouting={aiProviderRouting} setAiProviderRouting={setAiProviderRouting} providerTestStatus={providerTestStatus} setProviderTestStatus={setProviderTestStatus} providerTestMessages={providerTestMessages} setProviderTestMessages={setProviderTestMessages} showProviderApiKeys={showProviderApiKeys} setShowProviderApiKeys={setShowProviderApiKeys} interestTopics={interestTopics} setInterestTopics={setInterestTopics} newTopic={newTopic} setNewTopic={setNewTopic} kbDocs={kbDocs} setKbDocs={setKbDocs} kbIngesting={kbIngesting} setKbIngesting={setKbIngesting} kbQueryText={kbQueryText} setKbQueryText={setKbQueryText} kbResults={kbResults} setKbResults={setKbResults} kbQuerying={kbQuerying} setKbQuerying={setKbQuerying} dataAccess={dataAccess} setDataAccess={setDataAccess} agentColorOverrides={agentColorOverrides} setAgentColorOverrides={setAgentColorOverrides} sttApiKey={sttApiKey} setSttApiKey={setSttApiKey} sttModel={sttModel} setSttModel={setSttModel} sttBaseUrl={sttBaseUrl} setSttBaseUrl={setSttBaseUrl} showSttKey={showSttKey} setShowSttKey={setShowSttKey} settingsSearch={settingsSearch} />}
      {activeTab === 'finance' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} financeCurrency={financeCurrency} setFinanceCurrency={setFinanceCurrency} autoSave={autoSave} setAutoSave={setAutoSave} autoRecalc={autoRecalc} setAutoRecalc={setAutoRecalc} securitySettings={securitySettings} setSecuritySettings={setSecuritySettings} originalSecuritySettings={originalSecuritySettings} passwordReqs={passwordReqs} setPasswordReqs={setPasswordReqs} newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} currentPassword={currentPassword} setCurrentPassword={setCurrentPassword} passwordError={passwordError} setPasswordError={setPasswordError} passwordSuccess={passwordSuccess} setPasswordSuccess={setPasswordSuccess} handleSetFinanceCurrency={handleSetFinanceCurrency} handleSetRememberDevice={handleSetRememberDevice} handleSetLockTimeout={handleSetLockTimeout} handleChangePassword={handleChangePassword} />}
      {activeTab === 'devices' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} />}
      {activeTab === 'database' && <AdvancedSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} />}
      {activeTab === 'auth' && <ProfileSection activeTab={activeTab} settingsSearch={settingsSearch} hasChanges={hasChanges} onHasChangesChange={onHasChangesChange} />}
      {activeTab === 'shortcuts' && <ShortcutSection shortcuts={shortcuts} setShortcuts={setShortcuts} recordingKey={recordingKey} setRecordingKey={setRecordingKey} SHORTCUT_CONFIG={{}} restoreDefaults={restoreDefaults} settingsSearch={settingsSearch} />}
      <AnimatePresence><{hasChanges && <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-700/50 shadow-black/50"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /><span className="text-sm text-zinc-300">You have unsaved changes</span></div><div className="flex items-center gap-3"><button onClick={() => { setTierAssignments(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-tier-assignments'); if (saved) { try { return JSON.parse(saved); } catch {} } } return DEFAULT_TIER_ASSIGNMENTS; }); setLocalAppColors(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('deskflow-planet-colors'); if (saved) { try { return JSON.parse(saved); } catch {} } } return appColors; }); setLocalCategoryOrder(categoryOrder); setAppCategoryOverrides({}); setDomainCategoryOverrides({}); setHasChanges(false); onHasChangesChange(false); }} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Discard</button><button onClick={saveChanges} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors duration-150 shadow-emerald-500/25 flex items-center gap-2"><Check className="w-4 h-4" />OK</button></div></div></motion.div>}</AnimatePresence>
      <AnimatePresence><{savedNotice && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-4 right-4 z-[60] bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg"><div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div><span className="text-sm text-emerald-300 font-medium">Settings saved</span></motion.div>}</AnimatePresence>
    </PageShell>
  );
}
