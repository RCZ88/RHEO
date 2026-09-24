import { Palette, Eye, MousePointer2, Clock, Settings2 } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SectionHeader } from '../../components/SectionHeader';

interface AppearanceSectionProps {
  activeTab: string;
  settingsSearch: string;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
  animationSpeed: string;
  setAnimationSpeed: (v: string) => void;
  bootAnimEnabled: boolean;
  setBootAnimEnabled: (v: boolean) => void;
  bootAnimVariant: string;
  setBootAnimVariant: (v: string) => void;
  bootAnimWarm: boolean;
  setBootAnimWarm: (v: boolean) => void;
  bootAnimLoading: boolean;
  tbModeState: string;
  setTbModeState: (v: string) => void;
  localAppColors?: Record<string, string>;
  setLocalAppColors?: (v: Record<string, string>) => void;
  appColors?: Record<string, string>;
  setAppColors?: (v: Record<string, string>) => void;
  categoryOrder?: string[];
  setCategoryOrder?: (v: string[]) => void;
  colorTab?: string;
  setColorTab?: (v: string) => void;
  colorSearchFilter?: string;
  setColorSearchFilter?: (v: string) => void;
  generatingColors?: boolean;
  setGeneratingColors?: (v: boolean) => void;
  showUncategorizedOnly?: boolean;
  setShowUncategorizedOnly?: (v: boolean) => void;
}

export function AppearanceSection(props: AppearanceSectionProps) {
  const modeIcons: Record<string, React.ReactNode> = {
    always: <Eye size={14} />,
    hover: <MousePointer2 size={14} />,
    auto: <Clock size={14} />,
  };
  const modeLabels: Record<string, string> = {
    always: 'Always show',
    hover: 'Hide / hover to show',
    auto: 'Auto-hide after 3s',
  };
  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionHeader title="Appearance" icon={<Palette className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">Animation Speed</label><div className="flex gap-1.5">{(['slow', 'normal', 'instant'] as const).map((speed) => <button key={speed} onClick={() => { props.setAnimationSpeed(speed); props.onHasChangesChange(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${props.animationSpeed === speed ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40' : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400'}`}>{speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal' : 'Off'}</button>)}</div></div>
        <div className="flex items-center justify-between py-2"><div><div className="text-sm font-medium">Boot Animation</div><div className="text-xs text-zinc-500">Show animation on launch</div></div><button onClick={() => { props.setBootAnimEnabled(!props.bootAnimEnabled); props.onHasChangesChange(true); }} className={`w-10 h-5 rounded-full transition-colors ${props.bootAnimEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}><div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${props.bootAnimEnabled ? 'translate-x-5' : ''}`} /></button></div>
      </GlassCard>
      <GlassCard className="space-y-4">
        <SectionHeader title="Title Bar" icon={<Settings2 className="w-5 h-5" />} />
        <div className="pt-2 border-t border-zinc-700/50" />
        <div className="flex flex-col gap-2">
          {(['always', 'hover', 'auto'] as const).map((m) => (
            <button key={m}
              onClick={() => { props.setTbModeState(m); props.onHasChangesChange(true); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${props.tbModeState === m ? 'bg-zinc-800/80 text-zinc-200 border border-zinc-600/50' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              {modeIcons[m]}
              <span className="flex-1">{modeLabels[m]}</span>
              {props.tbModeState === m && <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">active</span>}
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
