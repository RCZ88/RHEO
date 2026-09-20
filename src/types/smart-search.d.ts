/// <reference types="react" />
/// <reference types="react-dom" />

// Smart Search IPC API exposed via preload contextBridge
declare global {
  interface Window {
    deskflowAPI: {
      // Existing API...
      onForegroundChange: (cb: (data: any) => void) => () => void;
      onTrackingHeartbeat: (cb: (data: any) => void) => () => void;
      onBrowserTrackingEvent: (cb: (data: any) => void) => () => void;
      onBrowserIdentified: (cb: (data: { browser: string }) => void) => () => void;
      onSleepDetection: (cb: (data: any) => void) => void;
      getLogs: () => Promise<any>;
      updateAppLog: (id: number, data: any) => Promise<any>;
      deleteAppLog: (id: number) => Promise<any>;
      getDashboardAggregates: (r: any) => Promise<any>;
      getAppStats: (r: any) => Promise<any>;
      getDomainStats: (r: any) => Promise<any>;
      getPeriodRankings: (r: any) => Promise<any>;
      getDashboardData: (p: any) => Promise<any>;
      getPageStats: (p: any) => Promise<any>;
      backfillAggregations: () => Promise<any>;
      getLogsByPeriod: (p: any) => Promise<any>;
      getStats: () => Promise<any>;
      getDailyStats: (p: 'week' | 'month' | 'all') => Promise<any>;
      toggleTracking: () => Promise<any>;
      setTracking: (e: boolean) => Promise<any>;
      // ... (other existing methods omitted for brevity)
      smartSearchIndex: (segments: unknown[]) => Promise<{ indexed: number }>;
      smartSearchUnindexPage: (pageId: string) => Promise<{ remaining: number }>;
      smartSearchQuery: (query: string, opts?: Record<string, unknown>) => Promise<SearchHit[]>;
      smartSearchSuggest: (query: string, opts?: Record<string, unknown>) => Promise<SearchSuggestion[]>;
      smartSearchClear: () => Promise<{ indexed: number }>;
      smartSearchStats: () => Promise<{ indexed: number }>;
    };
  }
}

export interface SearchHit {
  id: string;
  pageId: string;
  title: string;
  section: string;
  snippet: string;
  score: number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  pageId: string;
}

export interface SearchableSegment {
  id: string;
  pageId: string;
  title: string;
  text: string;
  section?: string;
  keywords?: string[];
  rank?: number;
}

export {};
