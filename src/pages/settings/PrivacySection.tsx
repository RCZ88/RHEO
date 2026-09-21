import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, Globe, Database, Clock, Download, Trash2, Filter, Monitor, Radio, Wifi } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';
import { SearchableSection } from './shared';

export function PrivacySection(props: any) {
  const { filterTransientApps, setFilterTransientApps, browserRecordingMode, setBrowserRecordingMode, appRecordingMode, setAppRecordingMode, sleepGapMs, setSleepGapMs, maxSessionMs, setMaxSessionMs, trackingPollInterval, setTrackingPollInterval, availableBrowsers, selectedBrowsers, setSelectedBrowsers, serverStatus, settingsSearch } = props;

  return (
    <div data-section="settings.privacy" className="space-y-4">
      <SearchableSection terms={['tracking', 'transient', 'background', 'recording', 'game', 'detection', 'browser', 'profiles', 'sleep', 'gap', 'max session']} search={settingsSearch}>
      <GlassCard className="space-y-6">
        <div><h2 className="text-lg font-semibold mb-1">Tracking Settings</h2><p className="text-xs text-zinc-500">Configure how app usage is tracked</p></div>
        <div className="flex items-center justify-between py-2">
          <div><label className="text-sm font-medium text-zinc-300">Ignore Transient System Apps</label><p className="text-xs text-zinc-500">Filter out brief system windows from tracking</p></div>
          <button onClick={() => setFilterTransientApps(!filterTransientApps)} className={`relative w-11 h-6 rounded-full transition-colors ${filterTransientApps ? 'bg-emerald-500' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${filterTransientApps ? 'translate-x-5' : ''}`} /></button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div><label className="text-sm font-medium text-zinc-300">Website Background Recording</label><p className="text-xs text-zinc-500">When OFF, website logs only appear while Browser Activity page is open</p></div>
          <button onClick={() => { const newMode = browserRecordingMode === 'always' ? 'on-view' : 'always'; setBrowserRecordingMode(newMode); }} className={`relative w-11 h-6 rounded-full transition-colors ${browserRecordingMode === 'always' ? 'bg-emerald-500' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${browserRecordingMode === 'always' ? 'translate-x-5' : ''}`} /></button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div><label className="text-sm font-medium text-zinc-300">App Background Recording</label><p className="text-xs text-zinc-500">When OFF, app logs only appear while Dashboard is open</p></div>
          <button onClick={() => { const newMode = appRecordingMode === 'always' ? 'on-view' : 'always'; setAppRecordingMode(newMode); }} className={`relative w-11 h-6 rounded-full transition-colors ${appRecordingMode === 'always' ? 'bg-emerald-500' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${appRecordingMode === 'always' ? 'translate-x-5' : ''}`} /></button>
        </div>
        <div className="pt-4 border-t border-zinc-700/50 space-y-2">
          <div className="flex items-center justify-between">
            <div><label className="text-sm font-medium text-zinc-300">Sleep Gap Detection</label><p className="text-xs text-zinc-500">Time before app is considered "sleep"</p></div>
            <div className="flex items-center gap-2"><input type="number" value={sleepGapMs} onChange={(e) => setSleepGapMs(parseInt(e.target.value) || 10000)} className="w-24 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-white text-right font-mono" /><span className="text-xs text-zinc-500">ms</span></div>
          </div>
          <div className="flex items-center justify-between">
            <div><label className="text-sm font-medium text-zinc-300">Max Session Duration</label><p className="text-xs text-zinc-500">Maximum app session length</p></div>
            <div className="flex items-center gap-2"><input type="number" value={maxSessionMs} onChange={(e) => setMaxSessionMs(parseInt(e.target.value) || 300000)} className="w-24 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-white text-right font-mono" /><span className="text-xs text-zinc-500">ms</span></div>
          </div>
        </div>
        <div className="pt-4 border-t border-zinc-700/50 grid grid-cols-2 gap-4 text-xs">
          <div className="bg-zinc-800/50 light:bg-zinc-100/50 rounded-lg p-3"><div className="text-zinc-500 mb-1">Sleep Gap</div><div className="text-white font-mono">{(sleepGapMs / 1000).toFixed(1)}s</div></div>
          <div className="bg-zinc-800/50 light:bg-zinc-100/50 rounded-lg p-3"><div className="text-zinc-500 mb-1">Max Session</div><div className="text-white font-mono">{(maxSessionMs / 60000).toFixed(1)}m</div></div>
        </div>
      </GlassCard>
      </SearchableSection>
      <SearchableSection terms={['devices', 'device', 'browser', 'extension']} search={settingsSearch}>
      <GlassCard className="space-y-3">
        <div><h3 className="text-sm font-medium text-zinc-300">Browser Extension Tracking</h3><p className="text-xs text-zinc-500">Toggle which browsers have the DeskFlow extension</p></div>
        <div className="grid grid-cols-2 gap-2">
          {availableBrowsers.map(b => {
            const isEnabled = selectedBrowsers.includes(b.toLowerCase());
            return <button key={b} onClick={() => { const lower = b.toLowerCase(); const next = isEnabled ? selectedBrowsers.filter(x => x !== lower) : [...selectedBrowsers, lower]; setSelectedBrowsers(next); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${isEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800/50 light:bg-zinc-100/50 border-zinc-700/50 text-zinc-500'}`}><span className={`w-3 h-3 rounded border-2 flex items-center justify-center ${isEnabled ? 'border-emerald-400 bg-emerald-400' : 'border-zinc-600'}`}>{isEnabled && <svg className="w-2 h-2 text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}</span>{b.charAt(0).toUpperCase() + b.slice(1)}</button>;
          })}
        </div>
      </GlassCard>
      </SearchableSection>
    </div>
  );
}
