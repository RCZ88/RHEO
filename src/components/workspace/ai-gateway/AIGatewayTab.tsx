// AI Gateway — tab router (mirrors ConductorWorkspaceTab pattern).
import { useState } from 'react';
import { StatusTab } from './StatusTab';
import { ChatTab } from './ChatTab';
import { ProvidersTab } from './ProvidersTab';
import { SessionsTab } from './SessionsTab';
import { SettingsTab } from './SettingsTab';

export function AIGatewayTab({ activeTab }: { activeTab: string }) {
  const [providerId, setProviderId] = useState('chatgpt');

  switch (activeTab) {
    case 'status':
      return <StatusTab onSelectProvider={(id) => setProviderId(id)} />;
    case 'chat':
      return <ChatTab providerId={providerId} onProviderChange={setProviderId} />;
    case 'providers':
      return <ProvidersTab providerId={providerId} onProviderChange={setProviderId} />;
    case 'runs':
      return <SessionsTab providerId={providerId} onProviderChange={setProviderId} />;
    case 'settings':
      return <SettingsTab />;
    default:
      return <StatusTab onSelectProvider={(id) => setProviderId(id)} />;
  }
}
