import { useEffect, useState } from 'react';

export interface ActiveFocusGroup {
  sessionId: number;
  groupId: number;
  allowedCategories: string[];
  startedAt: number;
  name?: string;
  strictness?: 'distracting' | 'non_allowed';
  allowedApps?: string[];
  allowedDomains?: string[];
  groupIds?: number[];
  groupNames?: string[];
}

let activeGroup: ActiveFocusGroup | null = null;
const listeners = new Set<() => void>();

export function setActiveGroup(g: ActiveFocusGroup | null) {
  activeGroup = g;
  listeners.forEach(l => l());
}

export function getActiveGroup(): ActiveFocusGroup | null {
  return activeGroup;
}

export function useActiveFocusGroup(): ActiveFocusGroup | null {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return activeGroup;
}
