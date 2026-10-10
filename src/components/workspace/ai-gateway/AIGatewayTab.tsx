// AI Gateway — tab router (mirrors ConductorWorkspaceTab pattern).
//
// EMBED-SAFE (problem 2): this component owns no height. No h-screen, no
// viewport units, no full-page-only assumptions — it drops into any panel
// because it renders a plain `flex flex-col gap-3 min-w-0` column. It can also
// render its OWN tab strip (`showTabs`) so it works when embedded somewhere that
// supplies no sub-tab bar of its own.
import { useState } from 'react';
import { Activity, MessageSquare, Globe, Clock, Settings } from 'lucide-react';
import { StatusTab } from './StatusTab';
import { ChatTab } from './ChatTab';
import { ProvidersTab } from './ProvidersTab';
import { SessionsTab } from './SessionsTab';
import { SettingsTab } from './SettingsTab';
import { TabBoundary } from './TabBoundary';

const TABS = [
  { key: 'status', label: 'Status', icon: Activity },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'providers', label: 'Providers', icon: Globe },
  { key: 'runs', label: 'Runs', icon: Clock },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabKey = typeof TABS[number]['key'];

/** Accepts 'providers', 'ai-gateway/providers', 'history', 'STATUS', '' … */
function normaliseTab(raw: string | undefined): TabKey {
  const tail = (raw || '').toString().split('/').pop()!.trim().toLowerCase();
  const alias: Record<string, TabKey> = {
    status: 'status', overview: 'status', home: 'status',
    chat: 'chat', prompt: 'chat',
    providers: 'providers', provider: 'providers', setup: 'providers',
    runs: 'runs', sessions: 'runs', history: 'runs', logs: 'runs',
    settings: 'settings', config: 'settings', about: 'settings',
  };
  return alias[tail] || 'status';
}

export function AIGatewayTab({
  activeTab,
  showTabs = false,
}: {
  activeTab: string;
  /** Render a local tab strip — required when embedded outside the workspace shell. */
  showTabs?: boolean;
}) {
  const [providerId, setProviderId] = useState('chatgpt');
  const [localTab, setLocalTab] = useState<TabKey | null>(null);

  // When `showTabs` is on this component owns navigation; otherwise the host does.
  const tab: TabKey = showTabs ? (localTab || normaliseTab(activeTab)) : normaliseTab(activeTab);
  const select = (id: string) => setProviderId(id);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {showTabs && (
        <div className="flex items-center gap-1 flex-wrap" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setLocalTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      <TabBoundary label={TABS.find((t) => t.key === tab)?.label || 'Gateway'}>
        {tab === 'status' && <StatusTab onSelectProvider={select} />}
        {tab === 'chat' && <ChatTab providerId={providerId} onProviderChange={setProviderId} />}
        {tab === 'providers' && <ProvidersTab providerId={providerId} onProviderChange={setProviderId} />}
        {tab === 'runs' && <SessionsTab providerId={providerId} onProviderChange={setProviderId} />}
        {tab === 'settings' && <SettingsTab />}
      </TabBoundary>
    </div>
  );
}