// ============================================================
// RHEO Dashboard — Widget Registry
// LAMINAR: design.md wins over all skill defaults
// ============================================================

import type { ComponentType } from 'react';

/** Widget size constraints in grid cells */
export interface WidgetSize {
  cols: number;
  rows: number;
}

/** Data source binding — widget binds to exactly ONE hook/IPC channel */
export type DataSource =
  | { type: 'hook'; name: string }
  | { type: 'ipc'; channel: string }
  | { type: 'static' };

/** Full widget configuration */
export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: 'productivity' | 'schedule' | 'finance' | 'learn' | 'health' | 'insights' | 'system';
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  component: ComponentType<any>;
  data?: DataSource;
  defaultVisible: boolean;
  /** Which page this widget originated from */
  sourcePage?: string;
}

/** User's persisted layout configuration */
export interface DashboardLayoutConfig {
  schemaVersion: number;
  columns: number; // 4-12 mosaic columns
  rows: number;
  widgetOrder: string[];
  widgetVisibility: Record<string, boolean>;
  gridPositions: Record<string, { col: number; row: number; colSpan: number; rowSpan: number }>;
}

/** Default layout — reproduces current dashboard 1:1 */
export const DEFAULT_LAYOUT: DashboardLayoutConfig = {
  schemaVersion: 2,
  columns: 12,
  rows: 8,
  widgetOrder: [
    'status-band',
    'schedule-hero',
    'insight-strip',
    'goals-card',
    'deadlines-card',
    'focus-card',
    'tier-breakdown',
    'pinned-activities',
    'productivity-chart',
    'sleep-bar',
    'mastery-ring',
    'app-ecosystem',
    'activity-feed',
    'momentum-hero',
    'follow-through',
    'vcalendar',
  ],
  widgetVisibility: {
    'status-band': true,
    'schedule-hero': true,
    'insight-strip': true,
    'goals-card': true,
    'deadlines-card': true,
    'focus-card': true,
    'tier-breakdown': true,
    'pinned-activities': true,
    'productivity-chart': true,
    'sleep-bar': true,
    'mastery-ring': false,
    'app-ecosystem': false,
    'activity-feed': true,
    'momentum-hero': false,
    'follow-through': false,
    'vcalendar': false,
  },
  gridPositions: {
    'status-band': { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
    'schedule-hero': { col: 8, row: 0, colSpan: 4, rowSpan: 2 },
    'insight-strip': { col: 0, row: 2, colSpan: 12, rowSpan: 1 },
    'goals-card': { col: 0, row: 3, colSpan: 5, rowSpan: 3 },
    'deadlines-card': { col: 5, row: 3, colSpan: 4, rowSpan: 3 },
    'focus-card': { col: 9, row: 3, colSpan: 3, rowSpan: 3 },
    'tier-breakdown': { col: 0, row: 6, colSpan: 7, rowSpan: 2 },
    'pinned-activities': { col: 7, row: 6, colSpan: 5, rowSpan: 2 },
    'productivity-chart': { col: 0, row: 8, colSpan: 8, rowSpan: 3 },
    'sleep-bar': { col: 8, row: 8, colSpan: 4, rowSpan: 2 },
    'mastery-ring': { col: 8, row: 10, colSpan: 4, rowSpan: 2 },
    'app-ecosystem': { col: 0, row: 11, colSpan: 7, rowSpan: 3 },
    'activity-feed': { col: 7, row: 12, colSpan: 5, rowSpan: 4 },
    'momentum-hero': { col: 0, row: 14, colSpan: 6, rowSpan: 2 },
    'follow-through': { col: 6, row: 14, colSpan: 6, rowSpan: 2 },
    'vcalendar': { col: 0, row: 16, colSpan: 4, rowSpan: 3 },
  },
};

/** Singleton widget registry */
class WidgetRegistryImpl {
  private widgets: Map<string, WidgetConfig> = new Map();
  private listeners: Set<() => void> = new Set();

  register(config: WidgetConfig): void {
    this.widgets.set(config.id, config);
    this.notify();
  }

  unregister(id: string): void {
    this.widgets.delete(id);
    this.notify();
  }

  get(id: string): WidgetConfig | undefined {
    return this.widgets.get(id);
  }

  getAll(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  getByCategory(category: string): WidgetConfig[] {
    return this.getAll().filter(w => w.category === category);
  }

  getVisible(layout: DashboardLayoutConfig): WidgetConfig[] {
    return layout.widgetOrder
      .map(id => this.widgets.get(id))
      .filter((w): w is WidgetConfig => w !== undefined && layout.widgetVisibility[w.id] !== false);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
