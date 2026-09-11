// ============================================================
// RHEO Dashboard — Dashboard Data Context
// Provides all dashboard data to widgets without prop drilling
// LAMINAR: design.md wins over all skill defaults
// ============================================================

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Goal, Deadline, ScheduleEntry, Reminder, LongTermGoal } from './types';
import type { DashboardInsights, MomentumScore } from './types';

/** All data consumed by dashboard widgets */
export interface DashboardData {
  // Goals
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  suggestions: Goal[];
  insights: DashboardInsights | null;
  streak: number;
  productivityScore: number;

  // Deadlines & Reminders
  deadlines: Deadline[];
  reminders: Reminder[];

  // Schedule
  schedule: ScheduleEntry[];

  // Overview stats
  overview: {
    totalSeconds: number;
    productiveSeconds: number;
    neutralSeconds: number;
    distractingSeconds: number;
  } | null;

  // Activity
  recentSessions: any[];
  activityFeed: any[];

  // Focus
  focusMinutes: number;
  focusProgress: number;
  isPaused: boolean;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  displayTimeMs: number;
  totalFocusedMs: number;
  currentAppName: string;

  // Sleep
  sleepData: { label: string; hours: number }[];
  avgSleep: number;
  sleepDebt: number;

  // Mastery
  masteryMastered: number;
  masteryTotal: number;

  // Finance
  ftData: { totalExpense: number; breakdown: any[] } | null;
  ftPersons: { id: number; name: string }[];
  lastTxDate: { lastUpdated: string; lastDate: string } | null;
  dashboardCurrency: string;

  // Heatmap
  weeklyHeatmap: { date: string; productiveHours: number }[];

  // AI Insights
  aiInsights: any[];

  // Momentum
  momentum: MomentumScore | null;

  // Gaps
  unfilledMinutes: number;
  gapCount: number;

  // Loading states
  loading: boolean;
  error: string | null;
}

const DashboardDataContext = createContext<DashboardData | null>(null);

export function useDashboardDataContext(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error('useDashboardDataContext must be used within DashboardDataProvider');
  }
  return ctx;
}

interface DashboardDataProviderProps {
  children: ReactNode;
  value: DashboardData;
}

export function DashboardDataProvider({ children, value }: DashboardDataProviderProps) {
  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}
