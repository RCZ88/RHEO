import React, { createContext, useContext, useMemo } from 'react';

interface SpokeData {
  data?: any;
}

interface Spokes {
  finance?: SpokeData;
  tracking?: SpokeData;
  goals?: SpokeData;
  schedule?: SpokeData;
}

interface HubState {
  spokes: Spokes;
  broadcast: (action: any) => void;
}

const HubContext = createContext<HubState | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<HubState>(() => ({
    spokes: {
      finance: { data: null },
      tracking: { data: null },
      goals: { data: null },
      schedule: { data: null },
    },
    broadcast: (action: any) => {
      window.dispatchEvent(new CustomEvent('rheo:hub-update', { detail: action }));
    },
  }), []);

  return (
    <HubContext.Provider value={value}>
      {children}
    </HubContext.Provider>
  );
}

export function useHubState(): HubState {
  const ctx = useContext(HubContext);
  if (!ctx) {
    // Fallback if used outside HubProvider
    return {
      spokes: { finance: {}, tracking: {}, goals: {}, schedule: {} },
      broadcast: (action: any) => {
        window.dispatchEvent(new CustomEvent('rheo:hub-update', { detail: action }));
      },
    };
  }
  return ctx;
}
