import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, BarChart3, Clock, TrendingUp, AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown, Activity, Terminal, Save, Play, Pause, TrendingUp as TrendingUpIcon, Layers, Search, Filter, Monitor, Tags, ListOrdered, AppWindow, Zap, Award, Timer, LayoutGrid, Pencil, Trash2, Check, X as XIcon, Plus, Link } from 'lucide-react';
import { MagicCard } from '../components/ui/magic-card';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { SectionState } from '../components/SectionState';
import { Input } from '../components/ui/input';
import { Select, SelectItem } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Toggle } from '../components/ui/toggle';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { BorderBeam } from '../components/ui/border-beam';
import { NumberTicker } from '../components/ui/number-ticker';
import { DotPattern } from '../components/ui/dot-pattern';
import { format as dateFormat, format } from 'date-fns';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { getDateRange, isInRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { glassBackdrop, centerText, makeGradient, sharedTooltipStyle, sharedScales, formatAxisTick, barAnimation, pieAnimation } from '../lib/chart-plugins';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler, glassBackdrop, centerText);

// Category colors matching the app's planet color system
const CATEGORY_COLORS: Record<string, string> = {
  'Developer Tools': '#10b981',
  'AI Tools': '#8b5cf6',
  'Social Media': '#f97316',
  'Entertainment': '#ef4444',
  'News': '#eab308',
  'Shopping': '#ec4899',
  'Productivity': '#3b82f6',
  'Design': '#a855f7',
  'Search Engine': '#64748b',
  'Communication': '#14b8a6',
  'Education': '#06b6d4',
  'Uncategorized': '#78716c',
  'Other': '#78716c'
};

const CATEGORIES = ['Developer Tools', 'AI Tools', 'Social Media', 'Entertainment', 'News', 'Shopping', 'Productivity', 'Design', 'Search Engine', 'Communication', 'Education', 'Uncategorized', 'Other'];

function formatDuration(ms: number): string {
  if (ms < 60000) {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  }
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

interface BrowserActivityPageProps {
  embedded?: boolean;
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  timeMode?: 'focus' | 'total';
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
  allLogs?: unknown[];
  platformFilter?: string;
  compareMode?: boolean;
  availablePlatforms?: string[];
}

interface BrowserProfile {
  id: number;
  browser_name: string;
  profile_id: string;
  profile_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  browser_version: string;
  last_seen_at: string;
  total_duration_ms: number;
  is_connected: number;
  color_tag: string;
}

const PROFILE_COLORS = [
  '#22c55e', '#3b82f6', '#a855f7', '#ef4444',
  '#f59e0b', '#06b6d4', '#ec4899', '#10b981',
  '#6366f1', '#f97316', '#14b8a6', '#8b5cf6'
];

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function BrowserActivityPage({ embedded, selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange, timeMode = 'total', tierAssignments: tierAssignmentsProp, allLogs, platformFilter = 'all', compareMode = false, availablePlatforms = [] }: BrowserActivityPageProps) {
  const [domainStats, setDomainStats] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [browserLogs, setBrowserLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDomainDetail, setSelectedDomainDetail] = useState<any>(null);
  const [detailPeriod, setDetailPeriod] = useState<Period>('week');
  const [detailDateOffset, setDetailDateOffset] = useState(0);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [liveLogs, setLiveLogs] = useState<Array<{id: string; timestamp: number; domain: string; url?: string; title?: string; type: string; level?: string}>>([]);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveLevelFilter, setLiveLevelFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [mainBrowser, setMainBrowser] = useState<string>('');
  const [availableBrowsers, setAvailableBrowsers] = useState<string[]>([]);
  const [extensionBrowser, setExtensionBrowser] = useState<string>('');
  const [hourlyChartMode, setHourlyChartMode] = useState<'bar' | 'line'>('bar');
  const [selectedBrowserProfile, setSelectedBrowserProfile] = useState<string>('all');
  const [availableBrowserProfiles, setAvailableBrowserProfiles] = useState<string[]>([]);
  const [showLiveDetection, setShowLiveDetection] = useState(false);
  const [browserProfiles, setBrowserProfiles] = useState<BrowserProfile[]>([]);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [knownApps, setKnownApps] = useState<Array<{app: string; category: string; last_used: string}>>([]);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [addProfileAppName, setAddProfileAppName] = useState('');
  const [linkingProfileId, setLinkingProfileId] = useState<number | null>(null);
  const scrollPosRef = useRef(0);

  // Save scroll position continuously
  useEffect(() => {
    const handleScroll = () => {
      scrollPosRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position when selectedPeriod or dateOffset changes
  useLayoutEffect(() => {
    if (scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current);
    }
  }, [selectedPeriod, dateOffset]);

  const displayedLiveLogs = useMemo(() => {
    let filtered = liveLogs.slice().reverse();
    if (liveLevelFilter !== 'all') {
      filtered = filtered.filter(l => (l.level || 'info') === liveLevelFilter);
    }
    if (liveSearchQuery.trim()) {
      const q = liveSearchQuery.toLowerCase();
      filtered = filtered.filter(l => l.domain.toLowerCase().includes(q) || (l.title || '').toLowerCase().includes(q));
    }
    return filtered;
  }, [liveLogs, liveLevelFilter, liveSearchQuery]);

  const currentRange = useMemo(() =>
    getDateRange(selectedPeriod, dateOffset),
    [selectedPeriod, dateOffset]
  );

  const getViewLabel = () => currentRange.label;

  // Detect browsers and load tracking browser preference
  useEffect(() => {
    const init = async () => {
      console.log('[BrowserActivity] Initializing browser tracking...');
      try {
        // Load browser with extension from preferences first
        let extBrowser = '';
        if (window.deskflowAPI?.getPreferences) {
          const prefs = await window.deskflowAPI.getPreferences();
          console.log('[BrowserActivity] Preferences loaded: {browserWithExtension:', prefs?.browserWithExtension, '}');
          if (prefs?.browserWithExtension) {
            extBrowser = prefs.browserWithExtension;
            setExtensionBrowser(extBrowser);
            setMainBrowser(extBrowser);
            console.log('[BrowserActivity] Extension browser from prefs:', extBrowser);
          }
        } else {
          console.log('[BrowserActivity] No getPreferences API');
        }
        
        // Load available browsers from DB only - ONLY show browsers user actually has
        if (window.deskflowAPI?.getTrackedBrowsers) {
          const tracked = await window.deskflowAPI.getTrackedBrowsers();
          console.log('[BrowserActivity] Tracked browsers from DB (user has these):', tracked);
          
          if (tracked && tracked.length > 0) {
            // Remove duplicates (case-insensitive)
            const seen = new Set<string>();
            const uniqueBrowsers = tracked.filter(b => {
              const key = b.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            
            console.log('[BrowserActivity] User browser apps:', uniqueBrowsers);
            setAvailableBrowsers(uniqueBrowsers);
            
            // If no extension browser set, use first browser from user's list
            if (!extBrowser && uniqueBrowsers.length > 0) {
              setMainBrowser(uniqueBrowsers[0]);
              console.log('[BrowserActivity] Set main browser to:', uniqueBrowsers[0]);
            }
          } else {
            console.log('[BrowserActivity] No browser apps found in DB');
            setAvailableBrowsers([]);
          }
        } else {
          console.log('[BrowserActivity] No getTrackedBrowsers API');
        }
      } catch (err) {
        console.error('[BrowserActivity] Error initializing browser tracking:', err);
      }
    };
    init();
  }, []);
  
  // Set page visibility for on-view recording mode
  useEffect(() => {
    if (window.deskflowAPI?.setPageVisibility) {
      window.deskflowAPI.setPageVisibility('browser', true);
    }
    return () => {
      if (window.deskflowAPI?.setPageVisibility) {
        window.deskflowAPI.setPageVisibility('browser', false);
      }
    };
  }, []);
  
  // Ref to track if component is still mounted - prevents state updates after unmount
  const isMountedRef = useRef(true);
  const liveLogsRef = useRef<Array<{id: string; timestamp: number; domain: string; url?: string; title?: string; type: string; level?: string}>>([]);

  // Listen for live browser tracking events
  useEffect(() => {
    if (!isLiveMode || !window.deskflowAPI?.onBrowserTrackingEvent) return;

    const handleEvent = (data: any) => {
      if (!isMountedRef.current) return;
      
      const newLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: data.timestamp || Date.now(),
        domain: data.domain || data.message?.split(' ')[0] || 'unknown',
        url: data.url,
        title: data.title,
        type: data.type,
        level: data.level
      };
      
      // Keep last 50 logs only
      liveLogsRef.current = [...liveLogsRef.current.slice(-49), newLog];
      setLiveLogs([...liveLogsRef.current]);
    };

    window.deskflowAPI.onBrowserTrackingEvent(handleEvent);
  }, [isLiveMode]);

  const handleSaveLogs = () => {
    const content = liveLogs
      .map(log => `[${dateFormat(new Date(log.timestamp), 'HH:mm:ss.SSS')}] ${log.level || 'INFO'}: ${log.domain} ${log.url ? `(${log.url})` : ''} ${log.title ? `- ${log.title}` : ''}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-tracking-logs-${dateFormat(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpanded = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  };

  // Platform-filtered browser logs
  const platformBrowserLogs = useMemo(() => {
    if (platformFilter === 'all') return browserLogs;
    return browserLogs.filter((l: any) => l.platform === platformFilter);
  }, [browserLogs, platformFilter]);

  // Aggregate browser logs by domain
  const aggregatedLogs = useMemo(() => {
    const grouped: Record<string, { sessions: any[]; totalDuration: number }> = {};
    
    platformBrowserLogs.forEach(log => {
      const domain = log.domain;
      if (!grouped[domain]) {
        grouped[domain] = { sessions: [], totalDuration: 0 };
      }
      grouped[domain].sessions.push(log);
      grouped[domain].totalDuration += log.duration_ms || 0;
    });
    
    return Object.entries(grouped)
      .map(([domain, data]) => ({
        domain,
        sessions: data.sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        totalDuration: data.totalDuration,
        category: data.sessions[0]?.category || 'Other'
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);
  }, [platformBrowserLogs]);

  // Build a lookup from browser_name or known_app_name to profile data
  const profileByBrowser = useMemo(() => {
    const map = new Map<string, BrowserProfile>();
    for (const p of browserProfiles) {
      map.set(p.browser_name, p);
      if (p.known_app_name) {
        map.set(p.known_app_name, p);
      }
    }
    return map;
  }, [browserProfiles]);

  // Filter domain stats by selected browser profile
  const filteredDomainStats = useMemo(() => {
    if (selectedBrowserProfile === 'all') return domainStats;
    const profile = profileByBrowser.get(selectedBrowserProfile);
    const filterBrowserName = profile ? profile.browser_name : selectedBrowserProfile;
    return domainStats.filter((d: any) => d.browser_name === filterBrowserName);
  }, [domainStats, selectedBrowserProfile, profileByBrowser]);

  // Filter browser logs by selected browser profile
  const filteredBrowserLogs = useMemo(() => {
    if (selectedBrowserProfile === 'all') return platformBrowserLogs;
    return platformBrowserLogs.filter((l: any) => l.browser_name === selectedBrowserProfile);
  }, [platformBrowserLogs, selectedBrowserProfile]);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);
    try {
      if (!window.deskflowAPI) {
        if (!isMountedRef.current) return;
        setError('DeskFlow API not available');
        setLoading(false);
        return;
      }

      const [domains, categories, logs] = await Promise.all([
        window.deskflowAPI!.getBrowserDomainStats(selectedPeriod, dateOffset),
        window.deskflowAPI!.getBrowserCategoryStats(selectedPeriod, dateOffset),
        window.deskflowAPI!.getBrowserLogs(selectedPeriod, dateOffset)
      ]);

      if (!isMountedRef.current) return;
      setDomainStats(domains || []);
      setCategoryStats(categories || []);
      setBrowserLogs(logs || []);
      // Extract unique browser names from domain stats
      const profileSet = new Set<string>();
      (domains || []).forEach((d: any) => { if (d.browser_name) profileSet.add(d.browser_name); });
      setAvailableBrowserProfiles(Array.from(profileSet).sort());
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[BrowserActivity] Error fetching data:', err);
      setError(err.message || 'Failed to load browser data');
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  }, [selectedPeriod, dateOffset]);

  const loadBrowserProfiles = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.getBrowserProfiles) return;
      const data = await api.getBrowserProfiles();
      if (isMountedRef.current) setBrowserProfiles(data || []);
    } catch (err) {
      // silent
    }
  }, []);

  const loadKnownApps = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.getKnownApps) return;
      const data = await api.getKnownApps();
      if (isMountedRef.current) setKnownApps(data || []);
    } catch (err) {
      // silent
    }
  }, []);

  const handleProfileToggle = async (profile: BrowserProfile) => {
    try {
      await (window as any).deskflowAPI.toggleBrowserProfile({ profileId: profile.id, isActive: !profile.is_active });
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Toggle profile failed:', err);
    }
  };

  const handleProfileRename = async (profile: BrowserProfile) => {
    if (!editingProfileName.trim()) return;
    try {
      await (window as any).deskflowAPI.renameBrowserProfile({ profileId: profile.id, newName: editingProfileName.trim() });
      setEditingProfileId(null);
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Rename profile failed:', err);
    }
  };

  const handleProfileDelete = async (profile: BrowserProfile) => {
    try {
      await (window as any).deskflowAPI.deleteBrowserProfile({ profileId: profile.id });
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Delete profile failed:', err);
    }
  };

  const handleProfileColorChange = async (profile: BrowserProfile, color: string) => {
    try {
      await (window as any).deskflowAPI.setBrowserProfileColor({ profileId: profile.id, color });
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Color change failed:', err);
    }
  };

  const handleAddProfile = async (appName?: string) => {
    const name = appName || addProfileAppName;
    if (!name.trim()) return;
    try {
      const api = (window as any).deskflowAPI;
      const profileId = `manual-${Date.now()}`;
      await api.upsertBrowserProfile({
        browserName: name,
        profileId,
        profileName: name,
      });
      const profiles = await api.getBrowserProfiles();
      const created = profiles.find((p: any) => p.browser_name === name && p.profile_id === profileId);
      if (created) {
        await api.updateBrowserProfileApp({ profileId: created.id, knownAppName: name });
      }
      setShowAddProfile(false);
      setAddProfileAppName('');
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Add profile failed:', err);
    }
  };

  const handleSetProfileApp = async (profile: any, knownAppName: string) => {
    try {
      await (window as any).deskflowAPI.updateBrowserProfileApp({ profileId: profile.id, knownAppName });
      setLinkingProfileId(null);
      loadBrowserProfiles();
    } catch (err) {
      console.error('[BrowserActivity] Link app failed:', err);
    }
  };

  // Fetch data on mount and when period or dateOffset changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    loadBrowserProfiles();
    loadKnownApps();
    
    // Auto-refresh every 30 seconds (skip for 'all' to avoid heavy re-fetches)
    const interval = setInterval(() => {
      if (isMountedRef.current && !loading && selectedPeriod !== 'all') {
        fetchData();
        loadBrowserProfiles();
        loadKnownApps();
      }
    }, 30000);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData, selectedPeriod]);

  const handleCategoryChange = async (domain: string, category: string) => {
    try {
      if (window.deskflowAPI?.setDomainCategory) {
        await window.deskflowAPI.setDomainCategory(domain, category);
        console.log(`[BrowserActivity] Updated ${domain} to ${category}`);
        // Refresh data to see changes
        fetchData();
      }
    } catch (err) {
      console.error('[BrowserActivity] Failed to update category:', err);
    }
    setEditingDomain(null);
    setSelectedCategory('');
  };

  const startEditCategory = (domain: string, currentCategory: string) => {
    setEditingDomain(domain);
    setSelectedCategory(currentCategory);
  };

  // Domain breakdown chart data
  const domainChartData = useMemo(() => {
    const top10 = filteredDomainStats.slice(0, 10);
    return {
      labels: top10.map(d => d.domain),
      datasets: [{
        label: 'Time Spent',
        data: top10.map(d => Math.round(d.total_ms / 60000)), // Convert to minutes
        backgroundColor: (ctx: any) => {
          const cat = top10[ctx.dataIndex]?.category || 'Other';
          return makeGradient(ctx, CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']);
        },
        borderColor: top10.map(d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
        categoryPercentage: 0.7,
        barPercentage: 0.8,
      }]
    };
  }, [filteredDomainStats]);

  // Category pie chart data
  const categoryChartData = useMemo(() => {
    return {
      labels: categoryStats.map(c => c.category),
      datasets: [{
        data: categoryStats.map(c => Math.round(c.total_ms / 1000)),
        backgroundColor: categoryStats.map(c => CATEGORY_COLORS[c.category] || CATEGORY_COLORS['Other']),
        borderColor: '#18181b',
        borderWidth: 2
      }]
    };
  }, [categoryStats]);

  const domainBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: { display: false },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => `${formatDuration(ctx.raw * 60000)}`, title: (items: any) => items[0]?.label || '' } }
    },
    scales: {
      ...sharedScales,
      y: { ...sharedScales.y, ticks: { ...sharedScales.y.ticks, callback: (v: any) => formatAxisTick(v * 60) } },
    },
    animation: barAnimation,
  };

  const categoryPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      glassBackdrop: true,
      centerText: { enabled: true },
      legend: {
        position: 'right' as const,
        labels: {
          color: '#a1a1aa',
          padding: 15,
          font: { size: 12, family: '"JetBrains Mono", monospace' },
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                return {
                  text: `${label}: ${formatDuration(value * 1000)}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor,
                  lineWidth: 2,
                  hidden: false,
                  index: i,
                  fontColor: '#a1a1aa',
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${formatDuration(ctx.raw * 1000)}` } }
    },
    animation: pieAnimation,
    hover: { mode: 'index' as const, intersect: false },
  };

  // Hourly/daily distribution computed from browserLogs based on selectedPeriod
  const hourlyDistribution = useMemo(() => {
    const now = new Date();
    const range = currentRange;
    const filteredLogs = (platformBrowserLogs as any[]).filter((log: any) =>
      isInRange(log.timestamp, range)
    );

    if (selectedPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);
      for (const log of filteredLogs) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + (log.duration_ms || 0);
        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const currentHour = new Date(currentMs).getHours();
          const currentDate = new Date(currentMs);
          const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour).getTime();
          const hourEnd = hourStart + 3600000;
          const segmentStart = Math.max(currentMs, hourStart);
          const segmentEnd = Math.min(sessionEnd, hourEnd);
          const segmentMs = Math.max(0, segmentEnd - segmentStart);
          if (segmentMs > 0 && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += segmentMs;
          }
          currentMs = hourStart + 3600000;
        }
      }
      return hourBuckets.map((ms, hour) => ({
        label: `${hour.toString().padStart(2, '0')}:00`,
        ms
      }));
    }

    // For 'all', aggregate by month
    if (selectedPeriod === 'all') {
      const monthBuckets = new Map<string, number>();
      for (const log of filteredLogs) {
        const d = new Date(log.timestamp);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + (log.duration_ms || 0));
      }
      return Array.from(monthBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, ms]) => {
          const [y, m] = monthKey.split('-');
          const d = new Date(parseInt(y), parseInt(m) - 1);
          return { label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), ms };
        });
    }

    const buckets = new Map<string, number>();
    for (const log of filteredLogs) {
      const dayStr = new Date(log.timestamp).toISOString().split('T')[0];
      buckets.set(dayStr, (buckets.get(dayStr) || 0) + (log.duration_ms || 0));
    }

    const totalDays = Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
    const daysBack = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? totalDays : 90;
    const result: { label: string; ms: number }[] = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(range.start.getTime() + i * 86400000);
      const dayStr = d.toISOString().split('T')[0];
      result.push({
        label: d.toLocaleDateString('en-US', selectedPeriod === 'week' ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
        ms: buckets.get(dayStr) || 0,
      });
    }
    return result;
  }, [platformBrowserLogs, selectedPeriod, currentRange]);

  // Bar chart data
  const hourlyChartData = {
    labels: hourlyDistribution.map(h => h.label),
    datasets: [{
      label: 'Duration',
      data: hourlyDistribution.map(h => h.ms),
      backgroundColor: (ctx: any) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return ctx.dataIndex === currentHour ? makeGradient(ctx, '#10b981') : makeGradient(ctx, '#3b82f6');
        }
        return makeGradient(ctx, '#3b82f6');
      },
      borderColor: hourlyDistribution.map((_, i) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return i === currentHour ? '#059669' : '#3b82f6';
        }
        return '#3b82f6';
      }),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
    }]
  };

  const hourlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: { display: false },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}` } }
    },
    scales: {
      ...sharedScales,
      y: { ...sharedScales.y, ticks: { ...sharedScales.y.ticks, callback: (v: any) => formatAxisTick(v / 1000) } },
    },
    animation: barAnimation,
  };

  // Line chart version
  const hourlyLineChartData = {
    labels: hourlyDistribution.map(h => h.label),
    datasets: [{
      label: 'Duration',
      data: hourlyDistribution.map(h => h.ms),
      borderColor: '#3b82f6',
      backgroundColor: (ctx: any) => makeGradient(ctx, '#3b82f6'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#3b82f6',
      pointBorderColor: '#3b82f6',
      borderWidth: 2,
    }]
  };

  // Total browser time (filtered by profile)
  const totalBrowserTime = filteredDomainStats.reduce((sum, d) => sum + d.total_ms, 0);
  const totalSessions = filteredDomainStats.reduce((sum, d) => sum + d.sessions, 0);

  // Detail daily breakdown for selected domain
  const selectedDomainName = selectedDomainDetail?.domain || '';
  const detailDomainLogs = useMemo(() => {
    if (!selectedDomainName) return [];
    const source = (allLogs as any[]) || [];
    const range = getDateRange(detailPeriod, detailDateOffset);
    return source
      .filter((log: any) => {
        const name = log.app || log.domain || log.title || '';
        return name.toLowerCase().includes(selectedDomainName.toLowerCase())
          && log.timestamp >= range.start && log.timestamp < range.end;
      })
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedDomainName, detailPeriod, detailDateOffset, allLogs]);

  const detailDailyChart = useMemo(() => {
    if (!selectedDomainName || detailDomainLogs.length === 0) return null;
    const logsByDate = new Map<string, number>();
    for (const log of detailDomainLogs) {
      const key = format(new Date(log.timestamp), 'yyyy-MM-dd');
      logsByDate.set(key, (logsByDate.get(key) || 0) + (log.duration || 0));
    }

    if (detailPeriod === 'all') {
      const monthMap = new Map<string, number>();
      for (const log of detailDomainLogs) {
        const key = format(new Date(log.timestamp), 'yyyy-MM');
        monthMap.set(key, (monthMap.get(key) || 0) + (log.duration || 0));
      }
      const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      return { labels: sorted.map(([k]) => format(new Date(k + '-01'), 'MMM yy')), data: sorted.map(([, v]) => v * 1000) };
    }

    if (detailPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);
      for (const log of detailDomainLogs) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + ((log.duration || 0) * 1000);
        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const hourStart = Math.floor(currentMs / 3600000) * 3600000;
          const hourEnd = hourStart + 3600000;
          const currentHour = new Date(hourStart).getHours();
          const segStart = Math.max(currentMs, hourStart);
          const segEnd = Math.min(sessionEnd, hourEnd);
          if (segEnd > segStart && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += (segEnd - segStart);
          }
          currentMs = hourEnd;
        }
      }
      return { labels: hourBuckets.map((_, i) => `${i.toString().padStart(2, '0')}:00`), data: hourBuckets };
    }

    const range = getDateRange(detailPeriod, detailDateOffset);
    const labels: string[] = [];
    const data: number[] = [];
    const cursor = new Date(range.start);
    while (cursor < range.end) {
      const dayStr = format(cursor, 'yyyy-MM-dd');
      labels.push(detailPeriod === 'week' || detailPeriod === '7day' ? format(cursor, 'EEE') : format(cursor, 'MMM dd'));
      data.push((logsByDate.get(dayStr) || 0) * 1000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return { labels, data };
  }, [selectedDomainName, detailDomainLogs, detailPeriod, detailDateOffset]);

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: '7day', label: '7 Day' },
    { key: 'month', label: 'Month' },
    { key: '30day', label: '30 Day' },
    { key: 'all', label: 'All' },
  ];

  const wrapPage = (content: React.ReactNode) => {
    if (embedded) return <>{content}</>;
    return <PageShell page="browser"><DotPattern className="z-0" opacity={0.04} /><div className="relative z-1">{content}</div></PageShell>;
  };

  if (loading) {
    return wrapPage(<LoadingState variant="spinner" className="py-24" />);
  }

  if (error) {
    return wrapPage(
      <GlassCard>
        <div className="text-center py-8">
          <AlertCircle className="mx-auto w-12 h-12 mb-4 text-red-500" />
          <div className="text-red-400 font-medium">Error loading browser data</div>
          <div className="text-sm text-zinc-500 mt-2">{error}</div>
            <button onClick={fetchData} className="mt-4 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-sm transition">Retry</button>
          </div>
        </GlassCard>
    );
  }

  const mainContent = (
    <div className={embedded ? 'space-y-6' : ''}>
      {!embedded && (
        <div className="sticky top-0 z-30 -mx-5 px-5 bg-zinc-900/20 backdrop-blur-md border-b border-zinc-800/50 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl grid place-items-center bg-[rgba(59,130,246,0.14)]">
                <Layers className="w-5 h-5 text-[#3b82f6]" />
              </div>
              <div>
                <div className="text-lg font-semibold">Browser Activity</div>
                <div className="text-xs text-zinc-500">Track your browsing habits by domain and category</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select data-tutorial="browser.selector"
              value={mainBrowser}
              onValueChange={async (newBrowser: string) => {
                setMainBrowser(newBrowser);
                if (window.deskflowAPI?.setBrowserWithExtension) {
                  await window.deskflowAPI.setBrowserWithExtension(newBrowser);
                  setExtensionBrowser(newBrowser);
                  console.log('[BrowserActivity] Saved extension browser:', newBrowser);
                }
              }}
            >
              {availableBrowsers.length === 0 ? (
                <SelectItem value="">No browsers found</SelectItem>
              ) : (
                availableBrowsers.map(browser => {
                  const isExtensionBrowser = browser.toLowerCase() === extensionBrowser.toLowerCase();
                  return (
                    <SelectItem key={browser} value={browser}>
                      {browser.charAt(0).toUpperCase() + browser.slice(1)}{isExtensionBrowser ? ' ★' : ''}
                    </SelectItem>
                  );
                })
              )}
            </Select>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      )}
      {/* Daily Usage Trend — hero chart on top for uniform layout */}
      <GlassCard className="relative overflow-hidden">
        <DotPattern className="absolute inset-0 text-[var(--page-accent)]" opacity={0.05} radius={1} gap={26} />
        <div className="relative">
        <SectionHeader title={selectedPeriod === 'today' ? 'Hourly Activity' : 'Daily Usage Trend'}
          titleClassName="font-display font-extrabold tracking-tight"
          icon={hourlyChartMode === 'bar' ? <BarChart3 className="w-5 h-5" /> : <TrendingUpIcon className="w-5 h-5" />}
          action={
            <div data-tutorial="browser.toggle" className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
              <Toggle pressed={hourlyChartMode === 'bar'} onPressedChange={() => setHourlyChartMode('bar')}
                className={`${hourlyChartMode === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
                aria-label="Bar Chart"><BarChart3 className="w-4 h-4" /></Toggle>
              <Toggle pressed={hourlyChartMode === 'line'} onPressedChange={() => setHourlyChartMode('line')}
                className={`${hourlyChartMode === 'line' ? 'bg-indigo-500/20 text-indigo-400' : ''}`}
                aria-label="Line Chart"><TrendingUpIcon className="w-4 h-4" /></Toggle>
            </div>
          } />
        <p className="text-sm text-zinc-500 mb-4">
          {selectedPeriod === 'today' ? 'Activity by hour of day' : 'Activity over time'}
        </p>
        <div className="relative h-48">
          {hourlyChartMode === 'bar' ? (
            hourlyChartData?.labels?.length ? <Bar data={hourlyChartData} options={hourlyChartOptions} /> : <SectionState kind="empty" chart="bar" message="No hourly data yet" />
          ) : (
            hourlyLineChartData?.labels?.length ? <Line data={hourlyLineChartData} options={hourlyChartOptions} /> : <SectionState kind="empty" chart="line" message="No hourly data yet" />
          )}
        </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Browsing Time', value: totalBrowserTime, display: formatDuration(totalBrowserTime), numeric: false, sub: 'Across all sessions', icon: Clock, chipBg: 'rgba(59,130,246,0.14)', iconColor: '#3b82f6', gradientFrom: '#3b82f6', gradientTo: '#6366f1' },
          { label: 'Unique Domains', value: filteredDomainStats.length, display: String(filteredDomainStats.length), numeric: true, sub: 'Different websites visited', icon: Globe, chipBg: 'rgba(16,185,129,0.14)', iconColor: '#10b981', gradientFrom: '#10b981', gradientTo: '#34d399' },
          { label: 'Browsing Sessions', value: totalSessions, display: String(totalSessions), numeric: true, sub: null, icon: Activity, chipBg: 'rgba(139,92,246,0.14)', iconColor: '#8b5cf6', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <MagicCard gradientFrom={stat.gradientFrom} gradientTo={stat.gradientTo} gradientSize={300} className="rounded-xl">
              <div className="relative p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: stat.chipBg }}>
                    <stat.icon className="w-4.5 h-4.5" style={{ color: stat.iconColor }} />
                  </div>
                </div>
                <div className="text-3xl font-semibold tabular-nums tracking-tight text-white">
                  {stat.numeric ? <NumberTicker value={stat.value as number} /> : stat.display}
                </div>
                <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500 mt-1">{stat.label}</div>
                {stat.sub && <div className="text-xs text-zinc-600 mt-0.5">{stat.sub}</div>}
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </div>

      {/* Browser Profiles Section (between stats and charts) */}
      <GlassCard>
        <SectionHeader title="Browser Profiles" icon={<Monitor className="w-5 h-5 text-emerald-400" />}
          action={<div className="flex items-center gap-2">
            <button onClick={() => setShowAddProfile(true)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition">
              <Plus className="w-3 h-3" /> Add Profile
            </button>
            {browserProfiles.length > 0 && <span className="text-xs text-zinc-500">{browserProfiles.filter(p => p.is_active).length} active / {browserProfiles.length} total</span>}
          </div>}
        />
        {browserProfiles.length === 0 ? (
          <SectionState kind="empty" message="No browser profiles detected" hint="Install the DeskFlow Browser Tracker extension to start tracking per-profile activity" />
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}>
            {browserProfiles.map(profile => (
              <motion.div
                key={profile.id}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  profile.is_active
                    ? 'bg-[rgba(24,24,27,0.60)] border-zinc-700/60 hover:border-zinc-600'
                    : 'bg-[rgba(24,24,27,0.30)] border-zinc-800/40 opacity-60'
                }`}
              >
                {/* Color indicator */}
                <div className="relative group">
                  <div
                    className="w-3 h-3 rounded-full cursor-pointer ring-2 ring-white/10"
                    style={{ backgroundColor: profile.color_tag }}
                  />
                  <div className="absolute top-full left-0 mt-1 hidden group-hover:flex gap-1 bg-zinc-900 border border-white/10 rounded-lg p-1.5 z-10 shadow-xl">
                    {PROFILE_COLORS.map(c => (
                      <button
                        key={c}
                        className="w-4 h-4 rounded-full ring-1 ring-white/20 hover:ring-white/40 transition"
                        style={{ backgroundColor: c }}
                        onClick={() => handleProfileColorChange(profile, c)}
                      />
                    ))}
                  </div>
                </div>

                {/* Browser icon letter */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: profile.color_tag + '22', color: profile.color_tag }}
                >
                  {profile.browser_name[0]?.toUpperCase()}
                </div>

                {/* Profile name + browser */}
                <div className="flex-1 min-w-0">
                  {editingProfileId === profile.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingProfileName}
                        onChange={e => setEditingProfileName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleProfileRename(profile);
                          if (e.key === 'Escape') setEditingProfileId(null);
                        }}
                        className="flex-1 bg-zinc-800 border border-white/10 rounded-md px-2 py-0.5 text-sm text-white outline-none focus:border-sky-500/50"
                        autoFocus
                      />
                      <button onClick={() => handleProfileRename(profile)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingProfileId(null)} className="text-zinc-500 hover:text-zinc-300"><XIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div
                      className="text-sm font-medium text-zinc-200 truncate cursor-pointer hover:text-white"
                      onClick={() => { setEditingProfileId(profile.id); setEditingProfileName(profile.profile_name); }}
                      title="Click to rename"
                    >
                      {profile.profile_name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">{profile.browser_name}</span>
                    <span className="text-[10px] text-zinc-600">•</span>
                    <span className="text-xs text-zinc-500">{profile.browser_version || ''}</span>
                    {profile.known_app_name && (
                      <>
                        <span className="text-[10px] text-zinc-600">•</span>
                        <span className="text-xs text-emerald-500 font-medium">→ {profile.known_app_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Connection + duration */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.is_connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-xs text-zinc-500">
                      {profile.is_connected ? 'connected' : `last ${relativeTime(profile.last_seen_at)}`}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">{formatDuration(profile.total_duration_ms)} tracked</div>
                </div>

                {/* Link to App */}
                <div className="relative flex-shrink-0">
                  {linkingProfileId === profile.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value=""
                        onChange={e => {
                          if (e.target.value) handleSetProfileApp(profile, e.target.value);
                        }}
                        onBlur={() => setLinkingProfileId(null)}
                        className="bg-zinc-800 border border-white/10 rounded-md px-1.5 py-1 text-xs text-white outline-none focus:border-sky-500/50 max-w-[120px]"
                        autoFocus
                      >
                        <option value="">Link to app...</option>
                        {knownApps.map((ka, i) => (
                          <option key={i} value={ka.app}>{ka.app}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLinkingProfileId(profile.id)}
                      className="p-1 rounded-md text-zinc-600 hover:text-sky-400 hover:bg-sky-500/10 transition"
                      title="Link to tracked app"
                    >
                      <Link className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleProfileToggle(profile)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                      profile.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700'
                    }`}
                  >
                    {profile.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => handleProfileDelete(profile)}
                    className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </GlassCard>

      {/* Charts Row — Category + Top Domains (prominent, first after stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <SectionHeader title="Time by Category" icon={<BarChart3 className="w-5 h-5" />} />
          <div className="h-72">
            {categoryStats.length > 0 ? (
              <Pie data={categoryChartData} options={categoryPieOptions} />
            ) : (
              <SectionState kind="empty" chart="pie" message="No category data" hint="Browse websites to see category breakdown" />
            )}
          </div>
        </GlassCard>

        {/* Add Profile Dialog */}
        {showAddProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddProfile(false)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-zinc-200 mb-3">Add Browser Profile</h3>
              <p className="text-xs text-zinc-500 mb-3">Select a tracked app to create a profile for it</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {knownApps.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No tracked apps detected yet. Use some apps first.</p>
                ) : (
                  knownApps.map((ka, i) => (
                    <button
                      key={i}
                      onClick={() => handleAddProfile(ka.app)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                    >
                      {ka.app}
                      <span className="text-xs text-zinc-600 ml-2">{ka.category}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddProfile(false)} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <GlassCard>
          <SectionHeader title="Top Domains" icon={<TrendingUp className="w-5 h-5" />} />
          <div className="h-72">
            {filteredDomainStats.length > 0 ? (
              <Bar data={domainChartData} options={domainBarOptions} />
            ) : (
              <SectionState kind="empty" chart="bar" message="No domain data" hint="Browse websites to see top domains" />
            )}
          </div>
        </GlassCard>
      </div>

      {/* Recent Activity - Aggregated by domain with dropdown */}
      <GlassCard>
        <SectionHeader title="Recent Activity"
          icon={<Globe className="w-5 h-5 text-blue-400" />}
          action={aggregatedLogs.length > 0 && <span className="text-xs text-zinc-500">{aggregatedLogs.length} sites</span>} />
        {aggregatedLogs.length === 0 ? (
          <SectionState kind="empty" message="No recent browsing activity" hint="Visit websites to see them here" />
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}>
            {aggregatedLogs.slice(0, 6).map((item, idx) => {
              const isExpanded = expandedDomains.has(item.domain);
              return (
                <motion.div
                  key={item.domain}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
                  className="group relative"
                >
                  <GlassCard variant="compact" className="p-0 hover:border-zinc-700/60 transition-colors duration-200">
                  <div 
                    className="flex items-center justify-between py-2 px-4 cursor-pointer"
                    onClick={() => toggleExpanded(item.domain)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Other'] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{item.domain}</div>
                        {item.sessions.length > 1 && (
                          <div className="text-xs text-zinc-500">{item.sessions.length} sessions</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 flex items-center gap-3">
                      <div>
                        <div className="text-sm font-mono text-white">{formatDuration(item.totalDuration)}</div>
                        <div className="text-xs text-zinc-500">
                          {format(new Date(item.sessions[0]?.timestamp || Date.now()), 'HH:mm')}
                        </div>
                      </div>
                      <ChevronRight 
                        className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                      />
                    </div>
                  </div>
                  {isExpanded && item.sessions.length > 1 && (
                    <div className="px-4 pb-3 border-t border-zinc-800/50">
                      <div className="pt-2 space-y-1">
                        {item.sessions.slice(0, 5).map((session, sidx) => (
                          <div key={sidx} className="flex items-center justify-between text-xs">
                            <div className="text-zinc-400 truncate max-w-[200px]">
                              {session.title || session.url || session.domain}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-300">{formatDuration(session.duration_ms)}</span>
                              <span className="text-zinc-600">
                                {format(new Date(session.timestamp), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))}
                        {item.sessions.length > 5 && (
                          <div className="text-xs text-zinc-500 pt-1">
                            +{item.sessions.length - 5} more sessions
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </GlassCard>

      {/* Domain Breakdown - Grid Layout */}
      <GlassCard data-tutorial="browser.domains">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[rgba(99,102,241,0.14)] grid place-items-center">
              <Globe className="w-4 h-4 text-[#6366f1]" />
            </div>
            <div>
              <div className="text-xl font-semibold">Domain Breakdown</div>
              <div className="text-sm text-zinc-500">All websites by total time</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
              <button
                onClick={() => setSelectedBrowserProfile('all')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition ${
                  selectedBrowserProfile === 'all'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All
              </button>
              {browserProfiles.map(p => {
                const profileColor = p.color_tag || '#6b7280';
                const filterKey = p.known_app_name || p.browser_name;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedBrowserProfile(filterKey)}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md font-medium transition ${
                      selectedBrowserProfile === filterKey
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: profileColor }} />
                    {p.known_app_name || p.profile_name}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-zinc-500">{filteredDomainStats.length} domains</div>
          </div>
        </div>
        {filteredDomainStats.length === 0 ? (
          <SectionState
            kind="empty"
            message={timeMode === 'focus' ? 'No productive browsing data' : availableBrowserProfiles.length === 0 && selectedBrowserProfile === 'all' ? 'No browser profiles detected yet' : 'No browsing data yet'}
            hint={timeMode === 'focus' ? 'Switch to Total mode to see all websites' : availableBrowserProfiles.length === 0 && selectedBrowserProfile === 'all' ? 'Install the browser extension to start tracking profiles' : 'Install the browser extension and start browsing'}
          />
        ) : (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}>
            {filteredDomainStats.map((d, i) => (
              <motion.div
                key={d.domain}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
              >
                <GlassCard className="cursor-pointer hover:border-zinc-700 transition-all duration-200" onClick={() => setSelectedDomainDetail(d)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']) + '22' }}
                    >
                      <Globe className="w-3.5 h-3.5" style={{ color: CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other'] }} />
                    </div>
                    <div className="font-medium text-sm text-white truncate">{d.domain}</div>
                    {d.browser_name && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        title={d.browser_name}
                        style={{
                          backgroundColor:
                            d.browser_name === 'chrome' ? '#3b82f6' :
                            d.browser_name === 'firefox' ? '#ff6611' :
                            d.browser_name === 'edge' ? '#0078d4' :
                            d.browser_name === 'brave' ? '#fb542b' :
                            d.browser_name === 'opera' ? '#ff1b2d' :
                            d.browser_name === 'comet' ? '#8b5cf6' : '#6b7280'
                        }}
                      />
                    )}
                  </div>
                  <Badge
                    variant="default"
                    className="shrink-0 text-[10px]"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']}20`,
                      color: CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other'],
                      borderColor: `${CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']}40`,
                    }}
                  >
                    {d.category}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Time</span>
                    <span className="font-mono text-white tabular-nums">{formatDuration(d.total_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Sessions</span>
                    <span className="font-mono tabular-nums" style={{ color: CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other'] }}>{d.sessions}</span>
                  </div>
                </div>
              </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </GlassCard>

      {/* Live Detection — collapsed by default, developer/debug tool */}
      <GlassCard>
        <button
          onClick={() => setShowLiveDetection(!showLiveDetection)}
          className="w-full flex items-center justify-between py-1 text-left group"
        >
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${showLiveDetection ? 'rotate-0' : '-rotate-90'}`} />
            <SectionHeader title="Live Detection" icon={<Terminal className="w-5 h-5" />}
            action={
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-zinc-500">{liveLogs.length} events</span>
                {showLiveDetection && (
                  <>
                    <button onClick={() => setIsLiveMode(!isLiveMode)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                        isLiveMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isLiveMode ? <Pause size={12} /> : <Play size={12} />}
                      {isLiveMode ? 'Live' : 'Paused'}
                    </button>
                    <button onClick={handleSaveLogs} disabled={liveLogs.length === 0}
                      className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      <Save size={12} /> Save
                    </button>
                  </>
                )}
              </div>
            } />
          </div>
        </button>
        <AnimatePresence>
          {showLiveDetection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <VoiceInputWrapper>
                    <Input
                      placeholder="Search domains..."
                      value={liveSearchQuery}
                      onChange={e => setLiveSearchQuery(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </VoiceInputWrapper>
                </div>
                <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                  {(['all', 'info', 'warning', 'error'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setLiveLevelFilter(level)}
                      className={`px-2.5 py-1.5 text-xs rounded-md capitalize ${
                        liveLevelFilter === level
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-950 rounded-xl border border-zinc-800/50 p-3 h-48 overflow-y-auto font-mono text-xs">
                {displayedLiveLogs.length === 0 ? (
                  <div className="text-zinc-500 text-center py-8">
                    {liveLogs.length === 0 ? 'No browser tracking events yet' : 'No matching events'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {displayedLiveLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2">
                        <span className="text-zinc-600 shrink-0">
                          {dateFormat(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded ${
                          log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {(log.level || 'INFO').toUpperCase()}
                        </span>
                        <span className="text-blue-400">{log.domain}</span>
                        {log.title && <span className="text-zinc-500 truncate">{log.title}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Domain Detail Modal */}
      <AnimatePresence>
        {selectedDomainDetail && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-5"
            onClick={() => setSelectedDomainDetail(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            >
            <div className="relative overflow-hidden rounded-xl">
              <BorderBeam size={120} duration={8} colorFrom="#3b82f6" colorTo="#8b5cf6" />
              <GlassCard variant="elevated">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: (CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other']) + '22' }}
                  >
                    <Globe
                      className="w-7 h-7"
                      style={{ color: CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other'] }}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">{selectedDomainDetail.domain}</h2>
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other']}20`,
                        color: CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other'],
                        borderColor: `${CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other']}40`,
                      }}
                    >
                      {selectedDomainDetail.category}
                    </Badge>
                  </div>
                </div>
                <button onClick={() => setSelectedDomainDetail(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Time', value: formatDuration(selectedDomainDetail.total_ms), icon: Clock, chipBg: 'rgba(16,185,129,0.14)', iconColor: '#10b981' },
                  { label: 'Sessions', value: selectedDomainDetail.sessions, icon: Activity, chipBg: 'rgba(99,102,241,0.14)', iconColor: '#6366f1' },
                  { label: 'Avg Session', value: formatDuration(selectedDomainDetail.total_ms / selectedDomainDetail.sessions), icon: Timer, chipBg: 'rgba(245,158,11,0.14)', iconColor: '#f59e0b' },
                  { label: 'First Seen', value: selectedDomainDetail.first_seen ? format(new Date(selectedDomainDetail.first_seen), 'MMM dd') : 'N/A', icon: Award, chipBg: 'rgba(139,92,246,0.14)', iconColor: '#8b5cf6' },
                ].map((metric, idx) => (
                  <GlassCard key={idx} className="space-y-0">
                    <div className="h-8 w-8 rounded-lg grid place-items-center mb-2.5" style={{ background: metric.chipBg }}>
                      <metric.icon className="w-4.5 h-4.5" style={{ color: metric.iconColor }} />
                    </div>
                    <div className="text-xl font-semibold tabular-nums text-white">{metric.value}</div>
                    <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500 mt-1">{metric.label}</div>
                  </GlassCard>
                ))}
              </div>

              {/* Period selector + daily chart */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailDateOffset(d => d - 1)}
                    className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex gap-1">
                    {PERIOD_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setDetailPeriod(opt.key); setDetailDateOffset(0); }}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                          detailPeriod === opt.key
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setDetailDateOffset(d => d + 1)}
                    className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {detailDailyChart && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Daily Usage</h3>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: detailDailyChart.labels,
                        datasets: [{
                          label: 'Duration',
                          data: detailDailyChart.data,
                          backgroundColor: (CATEGORY_COLORS[selectedDomainDetail.category] || '#6366f1') + '88',
                          borderColor: CATEGORY_COLORS[selectedDomainDetail.category] || '#6366f1',
                          borderWidth: 1,
                          borderRadius: 4,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: '#18181b',
                            borderColor: '#3f3f46',
                            borderWidth: 1,
                            titleColor: '#e4e4e7',
                            bodyColor: '#a1a1aa',
                            padding: 10,
                            cornerRadius: 8,
                            callbacks: {
                              label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
                            }
                          }
                        },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 10 } },
                          y: {
                            grid: { color: '#27272a' },
                            ticks: { color: '#71717a', callback: (v: any) => formatDuration(v) },
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </GlassCard>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return wrapPage(mainContent);
}
