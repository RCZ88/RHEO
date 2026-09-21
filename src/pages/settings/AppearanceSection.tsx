import { motion } from 'framer-motion';
import { Settings, Globe, Monitor, Sun, Moon, Check, ChevronRight, Palette, Eye, EyeOff, Key, Save, Loader2, X, Sparkles, AlertTriangle, Clock, Download, Trash2, RefreshCw, Terminal, Activity, Database, Lock, LockOpen, History, Undo2, Pencil, Upload, FileText, SearchX, Inbox, Keyboard, MousePointer, ChevronDown, ChevronUp, HandMetal, WandSparkles, BadgeInfo, Volume2, Mic, Headphones, MapPin, Package, TrendingUp, Shield, ShieldCheck, CircleHelp, BookOpen, Target, Wifi, WifiOff, Bluetooth, Gamepad, Calculator, PieChart, BarChart3, Gauge, ArrowRight, ArrowUp, Plus, GripVertical, Zap, FileJson, FileSpreadsheet, FolderDown, HardDrive, MessageSquare, Brain, Bot, Wand2, Compass, Route, Network, Cpu } from 'lucide-react';
import { lazy } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as m } from 'framer-motion';
import { SearchableSection, ColorPicker } from './shared';
import { DEFAULT_CATEGORIES, PRESET_COLORS } from './constants';
import { SectionHeader } from '../../components/SectionHeader';
import { GlassCard } from '../../components/GlassCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useRef, useState, useEffect } from 'react';

export function AppearanceSection(props: any) {
  const { activeTab, settingsSearch, hasChanges, onHasChangesChange, animationSpeed, setAnimationSpeed, bootAnimEnabled, setBootAnimEnabled, bootAnimVariant, setBootAnimVariant, bootAnimWarm, setBootAnimWarm, bootAnimLoading, tbModeState, setTbModeState, localAppColors, setLocalAppColors, appColors, setAppColors, categoryOrder, setCategoryOrder, setHasChanges } = props;

  // Theme mode logic
  const isDark = (() => { try { return localStorage.getItem('df-theme') || 'dark'; } catch { return 'dark'; } })() === 'dark';

  return (
    <div data-section="settings.appearance" className="space-y-6">
      <GlassCard className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Appearance</h2>
          <p className="text-sm text-zinc-400 mb-4">Choose how DeskFlow looks on your screen.</p>
          <div className="grid grid-cols-3 gap-4">
            {(['light', 'dark', 'system'] as const).map(mode => {
              const isActive = (() => { try { return localStorage.getItem('df-theme') || 'dark'; } catch { return 'dark'; } })() === mode;
              return (
                <button key={mode} onClick={() => import('../../lib/theme').then(m => m.setTheme(mode))}
                  className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 ${isActive ? mode === 'light' ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : mode === 'dark' ? 'bg-violet-500/10 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'bg-zinc-800/40 light:bg-zinc-100/40 border-zinc-700/40 hover:border-zinc-600/60 hover:bg-zinc-800/60 light:bg-zinc-100'}`}>
                  <div className={`w-16 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${isActive ? mode === 'light' ? 'border-amber-400 bg-white shadow-sm' : mode === 'dark' ? 'border-violet-400 bg-zinc-900 shadow-sm' : 'border-blue-400 bg-gradient-to-br from-white to-zinc-800 shadow-sm' : 'border-zinc-600/40 bg-zinc-800'}`}>
                    {mode === 'light' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-amber-50 via-white to-amber-50/50 border border-amber-200/30" />}
                    {mode === 'dark' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900/50 border border-zinc-700/30" />}
                    {mode === 'system' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-white via-zinc-800 to-zinc-950 border border-zinc-600/30" />}
                    {mode === 'light' && <Sun className="w-5 h-5 text-amber-500 absolute" />}
                    {mode === 'dark' && <Moon className="w-5 h-5 text-violet-400 absolute" />}
                    {mode === 'system' && <Monitor className="w-5 h-5 text-blue-400 absolute" />}
                  </div>
                  <span className="text-sm font-semibold capitalize tracking-wide">{mode}</span>
                  <span className="text-xs text-zinc-500">{mode === 'light' ? 'Bright & clean' : mode === 'dark' ? 'Easy on the eyes' : 'Follows your system'}</span>
                  {isActive && <m.div layoutId={`theme-badge-${mode}`} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg" transition={{ type: 'spring', stiffness: 300, damping: 20 }}><Check className="w-3 h-3 text-white" /></m.div>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-zinc-300">Accent Color</h3><span className="text-xs text-zinc-500">Highlights, borders, active states</span></div>
            <div className="flex flex-wrap gap-2">
              {[{ name: 'Cyan', hex: '#06b6d4' }, { name: 'Blue', hex: '#3b82f6' }, { name: 'Indigo', hex: '#6366f1' }, { name: 'Violet', hex: '#8b5cf6' }, { name: 'Pink', hex: '#ec4899' }, { name: 'Amber', hex: '#f59e0b' }, { name: 'Emerald', hex: '#10b981' }, { name: 'Rose', hex: '#f43f5e' }, { name: 'Slate', hex: '#64748b' }].map(color => {
                const saved = localStorage.getItem('deskflow-accent-color');
                const isSelected = saved === color.hex;
                return <button key={color.hex} onClick={() => { localStorage.setItem('deskflow-accent-color', color.hex); onHasChangesChange(true); }} className={`w-9 h-9 rounded-full border-2 transition-all duration-200 hover:scale-110 ${isSelected ? 'border-white/60 ring-2 ring-white/30 shadow-lg scale-110' : 'border-zinc-700/50 hover:border-zinc-500/70'}`} style={{ backgroundColor: color.hex }} title={color.name} />;
              })}
            </div>
            {localStorage.getItem('deskflow-accent-color') && <button onClick={() => { localStorage.removeItem('deskflow-accent-color'); onHasChangesChange(true); }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Reset to default (cyan)</button>}
          </div>
        </div>
      </GlassCard>
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold flex items-center gap-2"><Monitor className="w-4 h-4 text-zinc-500" />Window Title Bar</h2><p className="text-xs text-zinc-500 mt-0.5">Control when the title bar shows or hides</p></div></div>
        <div className="grid grid-cols-3 gap-3">
          {(['always', 'hover', 'auto'] as const).map((mode) => (
            <button key={mode} onClick={() => { const a = (window as any)?.deskflowAPI; if (a?.setTitleBarMode) a.setTitleBarMode(mode).catch(() => {}); setTbModeState(mode); onHasChangesChange(true); }} className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${tbModeState === mode ? 'border-emerald-500/60 bg-emerald-500/8 shadow-[0_0_24px_rgba(50,205,50,0.12)]' : 'border-zinc-700/40 hover:border-zinc-600/60 hover:bg-zinc-800/40 light:hover:bg-zinc-100/40 light:border-zinc-500/50'}`}>
              <Monitor className="w-5 h-5" />
              <span className="text-xs font-semibold capitalize">{mode === 'always' ? 'Always show' : mode === 'hover' ? 'Hide + hover' : 'Auto-hide 3s'}</span>
              {tbModeState === mode && <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/50 text-emerald-400 bg-emerald-500/10">on</span>}
            </button>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Current Theme Preview</h2><p className="text-xs text-zinc-500">How your current choice looks</p></div></div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 light:bg-white/30 p-5 space-y-3 light:border-zinc-200/40 light:bg-white/50">
          <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-zinc-700/50 light:bg-zinc-200/50 flex items-center justify-center"><Settings className="w-4 h-4 text-zinc-500" /></div><div className="flex-1 space-y-1"><div className="h-3 w-24 rounded bg-zinc-700/50 light:bg-zinc-200/50" /><div className="h-2 w-full rounded bg-zinc-700/30" /></div><div className="flex gap-1"><div className="w-6 h-6 rounded-full bg-zinc-700/50 light:bg-zinc-200/50" /><div className="w-6 h-6 rounded-full bg-zinc-700/50 light:bg-zinc-200/50" /></div></div></div>
          <div className="flex gap-2"><div className="h-8 w-full rounded-lg bg-zinc-800/60 light:bg-zinc-100 flex items-center px-3 light:bg-zinc-100"><span className="text-xs text-zinc-500 light:text-zinc-400">Sample card content</span></div><div className="h-8 w-20 rounded-lg bg-zinc-800/60 light:bg-zinc-100 flex items-center justify-center light:bg-zinc-100"><span className="text-xs text-zinc-500 light:text-zinc-400">Action</span></div></div>
        </div>
      </GlassCard>
    </div>
  );
}
