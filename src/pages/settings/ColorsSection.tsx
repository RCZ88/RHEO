import { motion } from 'framer-motion';
import { Settings, Globe, Monitor, Sun, Moon, Check, ChevronRight, Palette, Eye, EyeOff, Key, Save, Loader2, X, Sparkles, AlertTriangle, Clock, Download, Trash2, RefreshCw, Terminal, Activity, Database, Lock, LockOpen, History, Undo2, Pencil, Upload, FileText, SearchX, Search, Inbox, Keyboard, MousePointer, ChevronDown, ChevronUp, HandMetal, WandSparkles, BadgeInfo, Volume2, Mic, Headphones, MapPin, Package, TrendingUp, Shield, ShieldCheck, CircleHelp, BookOpen, Target, Wifi, WifiOff, Bluetooth, Gamepad, Calculator, PieChart, BarChart3, Gauge, ArrowRight, ArrowUp, Plus, GripVertical, Zap, FileJson, FileSpreadsheet, FolderDown, HardDrive, MessageSquare, Brain, Bot, Wand2, Compass, Route, Network, Cpu, Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSection, ColorPicker } from './shared';
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, PRESET_COLORS } from './constants';
import { SectionHeader } from '../../components/SectionHeader';
import { GlassCard } from '../../components/GlassCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useMemo, useRef, useState, useEffect } from 'react';

const DatabasePage = lazy(() => import('../DatabasePage'));

export function ColorsSection(props: any) {
  const {
    activeTab, settingsSearch, hasChanges, onHasChangesChange,
    localAppColors, setLocalAppColors, appColors, setAppColors,
    categoryOrder, setCategoryOrder, setHasChanges,
    allCategories, getCategoryColor, getAppDisplayCategory, changeAppCategory,
    DEFAULT_CATEGORIES, saveChanges,
    colorTab, setColorTab, colorSearchFilter, setColorSearchFilter,
    appStats, domainStats,
    generatingColors, setGeneratingColors, pendingColors, setPendingColors,
    preAiColors, setPreAiColors, aiRun, setAiRun,
    showRunLogs, setShowRunLogs,
    handleAppColorChange, handleCategoryColorChange, getCategoryColor: getCatColor,
  } = props;

  const isDark = (() => { try { return localStorage.getItem('df-theme') || 'dark'; } catch { return 'dark'; } })() === 'dark';

  return (
    <div data-section="settings.colors" className="space-y-4">
      {aiRun?.purpose === 'colors' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${aiRun.error ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          {aiRun.error ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : aiRun.done ? <Check className="w-4 h-4 flex-shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
          <span className="flex-1">{aiRun.error || aiRun.phase}</span>
          {aiRun.provider && !aiRun.error && <span className="text-xs text-zinc-400 font-mono">via {aiRun.provider}</span>}
        </div>
      )}
      {/* Category Colors Section */}
      <SearchableSection terms={['category', 'colors', 'category color', 'palette']} search={settingsSearch}>
      <GlassCard>
        <SectionHeader title="Category Colors" icon={<Palette className="w-5 h-5" />} />
        <p className="text-xs text-zinc-500 mb-4">Solar system colors</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {allCategories.map((category) => (
            <div key={category} className="flex items-center gap-2 p-2.5 bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 rounded-lg border border-zinc-700/30 hover:border-zinc-600 transition-colors duration-150 group">
              <ColorPicker value={getCategoryColor(category)} onChange={(color) => handleCategoryColorChange(category, color)} size="sm" />
              <span className="text-sm text-zinc-300 group-hover:text-white font-medium truncate">{category}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      </SearchableSection>

      {/* App/Website Colors Section */}
      <SearchableSection terms={['application', 'website', 'app color', 'website color']} search={settingsSearch}>
      <GlassCard>
        <SectionHeader
          title={`${colorTab === 'apps' ? 'Application' : 'Website'} Colors`}
          icon={<Palette className="w-5 h-5" />}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 bg-zinc-800/50 light:bg-zinc-100/50 px-2 py-1 rounded-md">
                {(colorTab === 'apps' ? appStats : domainStats).length} {colorTab}
              </span>
              <button
                onClick={async () => {
                  setPreAiColors({ ...localAppColors });
                  setGeneratingColors(true);
                  setAiRun({ purpose: 'colors', phase: 'Starting...' });
                  try {
                    const appsToColor = colorTab === 'apps'
                      ? appStats.map((a: any) => a.app)
                      : domainStats.map((d: any) => d.domain);
                    if (window.deskflowAPI?.generateAIColors) {
                      const generated = await window.deskflowAPI.generateAIColors(appsToColor);
                      const validColors: Record<string, string> = {};
                      Object.entries(generated).forEach(([appName, color]) => {
                        if (color && typeof color === 'string' && color.startsWith('#')) validColors[appName] = color;
                      });
                      setLocalAppColors(prev => ({ ...prev, ...validColors }));
                      setHasChanges(true); onHasChangesChange(true);
                      setAiRun(prev => prev?.error ? prev : ({ purpose: 'colors', phase: `${Object.keys(validColors).length} color${Object.keys(validColors).length === 1 ? '' : 's'} generated`, done: true, provider: prev?.provider, error: '' }));
                      setGeneratingColors(false);
                    }
                  } catch (err) {
                    console.error('Magic Color failed:', err);
                    setAiRun({ purpose: 'colors', phase: '', error: err instanceof Error ? err.message : String(err), done: false });
                    setGeneratingColors(false);
                  }
                }}
                disabled={generatingColors}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generatingColors ? 'Generating...' : 'Magic Color'}
              </button>
            </div>
          }
        />
        <p className="text-xs text-zinc-500 mb-3">Individual colors</p>

        <div className="flex gap-1 bg-zinc-900/50 light:bg-white/50 p-1 rounded-xl mb-4 w-fit">
          <button onClick={() => setColorTab('apps')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${colorTab === 'apps' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'}`}>Apps</button>
          <button onClick={() => setColorTab('websites')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${colorTab === 'websites' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'}`}>Websites</button>
        </div>

        <div className="mb-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" placeholder={`Search ${colorTab}...`} value={colorSearchFilter} onChange={(e) => setColorSearchFilter(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {(colorTab === 'apps' ? appStats : domainStats)
            .filter((item: any) => colorSearchFilter === '' || (colorTab === 'apps' ? item.app : item.domain).toLowerCase().includes(colorSearchFilter.toLowerCase()))
            .map((item: any) => {
              const name = colorTab === 'apps' ? item.app : item.domain;
              const color = localAppColors[name] || '#888888';
              const category = colorTab === 'apps' ? item.category : (item.category || 'Other');
              const categoryColor = getCategoryColor(category);
              return (
                <div key={name} className="relative flex flex-col p-3 bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 rounded-xl border border-zinc-700/30 hover:border-zinc-600 transition-colors duration-150 group">
                  <button onClick={async () => {
                    try { if (window.deskflowAPI?.generateAIColors) { const generated = await window.deskflowAPI.generateAIColors([name]); if (generated[name]) handleAppColorChange(name, generated[name]); } } catch (err) { console.error('Individual AI color failed:', err); }
                  }} className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 text-white/40 hover:text-white transition-colors duration-150 opacity-60 hover:opacity-100 z-10" title="AI Color">
                    <Sparkles className="w-3 h-3" />
                  </button>
                  <div className="mb-2"><ColorPicker value={color} onChange={(newColor) => handleAppColorChange(name, newColor)} size="sm" /></div>
                  <div className="text-xs text-zinc-300 group-hover:text-white font-medium truncate mb-1 pr-5">{name}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md self-start" style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}>{category}</span>
                </div>
              );
            })}
        </div>
      </GlassCard>
      </SearchableSection>

      {/* Voice & Speech Section */}
      <SearchableSection terms={['voice', 'speech', 'dictation', 'microphone', 'stt', 'speech api key', 'whisper', 'windows speech']} search={settingsSearch}>
      <GlassCard className="space-y-4">
        <div><h2 className="text-lg font-semibold mb-1">Voice & Speech</h2><p className="text-xs text-zinc-500">Dictation engine order: Cloud API → Windows speech → Browser speech</p></div>
        <div>
          <label className="text-sm font-medium text-zinc-400 mb-2 block">Speech API Key</label>
          <div className="relative">
            <input type={props.showSttKey ? 'text' : 'password'} placeholder="gsk_..." value={props.sttApiKey} onChange={(e) => { props.setSttApiKey(e.target.value); if (window.deskflowAPI?.setPreference) window.deskflowAPI.setPreference('sttApiKey', e.target.value.trim()); }}
              className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono pr-10" />
            <button onClick={() => props.setShowSttKey(prev => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors">{props.showSttKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">Any OpenAI-compatible speech-to-text API key (Groq, OpenAI, etc.). When set, dictation uses the cloud API first.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-zinc-400 mb-2 block">Model</label><input type="text" value={props.sttModel} onChange={(e) => { props.setSttModel(e.target.value); if (window.deskflowAPI?.setPreference) window.deskflowAPI.setPreference('sttModel', e.target.value.trim() || 'whisper-large-v3-turbo'); }} className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono" /></div>
          <div><label className="text-sm font-medium text-zinc-400 mb-2 block">API URL</label><input type="text" value={props.sttBaseUrl} onChange={(e) => { props.setSttBaseUrl(e.target.value); if (window.deskflowAPI?.setPreference) window.deskflowAPI.setPreference('sttBaseUrl', e.target.value.trim()); }} className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono" /></div>
        </div>
      </GlassCard>
      </SearchableSection>
    </div>
  );
}