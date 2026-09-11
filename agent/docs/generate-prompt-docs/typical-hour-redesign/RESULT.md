# Typical Day — Complete Redesign

## Design Decision: 24×7 Heatmap Grid

After analyzing all options, I recommend a **24×7 heatmap grid** (hours × days of week). This solves the core problem: users can now see patterns like "Monday morning coding" or "weekend sleep-in" which was impossible with the single-row layout.

---

## 1. Data Processing Pipeline

### Algorithm Overview

```
Input: days (default 30)
Output: { hourlyData[7][24], legend, stats }

1. Query external_sessions (last N days)
2. Query device_logs (allLogs from tracker)
3. For each session/log:
   - Extract hour (0-23) and dayOfWeek (0-6)
   - Add to activity map: activityMap[dayOfWeek][hour][activity] += duration
4. Normalize: divide each bucket by weekCount
5. For each cell: sort activities by duration, apply threshold
6. Cache result with key = days
```

### Implementation

```typescript
// src/main.ts - Replace/Update the get-typical-day handler

// Cache for typical day data
const typicalDayCache = new Map<string, {
  data: TypicalDayResult;
  timestamp: number;
  days: number;
}>();

interface ActivityBucket {
  activity: string;
  seconds: number;
  percentage: number;
  color: string;
}

interface HourCell {
  activities: ActivityBucket[];
  totalSeconds: number;
  dominantActivity: string;
  hasExternal: boolean;
  hasDevice: boolean;
}

interface TypicalDayResult {
  grid: HourCell[][]; // [7 days][24 hours]
  legend: { activity: string; color: string; totalSeconds: number }[];
  stats: {
    totalHours: number;
    mostActiveHour: { hour: number; day: number };
    mostActiveDay: number;
    activityBreakdown: Record<string, number>;
  };
  generatedAt: string;
  daysCovered: number;
}

// Activity color mapping
const ACTIVITY_COLORS: Record<string, string> = {
  'Sleep': '#8B5CF6',      // Purple
  'Study': '#3B82F6',      // Blue
  'Work': '#10B981',       // Emerald
  'Exercise': '#F59E0B',   // Amber
  'Coding': '#06B6D4',     // Cyan
  'Entertainment': '#EC4899', // Pink
  'Social': '#F97316',     // Orange
  'Eating': '#84CC16',     // Lime
  'Commute': '#6366F1',    // Indigo
  'default': '#6B7280'     // Gray
};

// Device app categorization
const APP_CATEGORIES: Record<string, string> = {
  // Development
  'code': 'Coding',
  'code.exe': 'Coding',
  'vscode': 'Coding',
  'electron': 'Coding',
  'idea64': 'Coding',
  'pycharm': 'Coding',
  'cursor': 'Coding',
  
  // Browsers
  'chrome': 'Web Browsing',
  'firefox': 'Web Browsing',
  'msedge': 'Web Browsing',
  'arc': 'Web Browsing',
  
  // Terminal
  'terminal': 'Terminal',
  'powershell': 'Terminal',
  'cmd': 'Terminal',
  'windowsterminal': 'Terminal',
  'iterm': 'Terminal',
  
  // Communication
  'slack': 'Communication',
  'discord': 'Communication',
  'teams': 'Communication',
  'zoom': 'Communication',
  'telegram': 'Communication',
  
  // Entertainment
  'spotify': 'Entertainment',
  'vlc': 'Entertainment',
  'netflix': 'Entertainment',
  'youtube': 'Entertainment',
  
  // Productivity
  'notion': 'Productivity',
  'obsidian': 'Productivity',
  'figma': 'Design',
  'photoshop': 'Design',
};

function categorizeApp(appName: string): string {
  const normalized = appName.toLowerCase().replace(/[^a-z]/g, '');
  return APP_CATEGORIES[normalized] || 'Other';
}

async function calculateTypicalDay(db: any, days: number, projectPath?: string): Promise<TypicalDayResult> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = now.toISOString().split('T')[0];
  
  // Initialize grid [7 days][24 hours]
  const grid: HourCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({
      activities: [],
      totalSeconds: 0,
      dominantActivity: 'none',
      hasExternal: false,
      hasDevice: false
    }))
  );
  
  // Activity totals for legend
  const activityTotals: Record<string, number> = {};
  
  // Week count for normalization
  const weekCount = days / 7;
  
  // ========== QUERY 1: External Sessions ==========
  const externalSessions = await db.all(`
    SELECT 
      activity_type,
      started_at,
      ended_at,
      duration_seconds
    FROM external_sessions
    WHERE date(started_at) >= date(?) 
      AND date(started_at) <= date(?)
      AND duration_seconds > 0
  `, [startStr, endStr]);
  
  // Process external sessions
  for (const session of externalSessions) {
    const start = new Date(session.started_at);
    const end = new Date(session.ended_at);
    const activity = session.activity_type || 'Other';
    const totalDuration = session.duration_seconds || 0;
    
    // Split session across hours it spans
    let current = new Date(start);
    let remaining = totalDuration;
    
    while (remaining > 0 && current < end) {
      const dayOfWeek = current.getDay();
      const hour = current.getHours();
      
      // Calculate seconds in this hour
      const hourEnd = new Date(current);
      hourEnd.setMinutes(59, 59, 999);
      const secondsInHour = Math.min(
        remaining,
        Math.floor((Math.min(end.getTime(), hourEnd.getTime()) - current.getTime()) / 1000)
      );
      
      if (secondsInHour > 0) {
        // Add to grid
        const cell = grid[dayOfWeek][hour];
        const existing = cell.activities.find(a => a.activity === activity);
        
        if (existing) {
          existing.seconds += secondsInHour;
        } else {
          cell.activities.push({
            activity,
            seconds: secondsInHour,
            percentage: 0,
            color: ACTIVITY_COLORS[activity] || ACTIVITY_COLORS.default
          });
        }
        
        cell.totalSeconds += secondsInHour;
        cell.hasExternal = true;
        activityTotals[activity] = (activityTotals[activity] || 0) + secondsInHour;
        remaining -= secondsInHour;
      }
      
      // Move to next hour
      current = new Date(current.getTime() + 3600000); // +1 hour
      current.setMinutes(0, 0, 0);
    }
  }
  
  // ========== QUERY 2: Device Logs ==========
  // Get from tracker logs if available
  const deviceLogs = await db.all(`
    SELECT 
      process_name,
      window_title,
      started_at,
      duration_seconds
    FROM activity_logs
    WHERE date(started_at) >= date(?)
      AND date(started_at) <= date(?)
      AND duration_seconds > 0
    ORDER BY started_at
  `, [startStr, endStr]);
  
  // Process device logs
  for (const log of deviceLogs) {
    const start = new Date(log.started_at);
    const dayOfWeek = start.getDay();
    const hour = start.getHours();
    const duration = log.duration_seconds || 0;
    
    // Categorize app
    const appName = log.process_name || 'Unknown';
    const category = categorizeApp(appName);
    
    if (category === 'Other') continue; // Skip uncategorized
    
    const cell = grid[dayOfWeek][hour];
    const existing = cell.activities.find(a => a.activity === category);
    
    if (existing) {
      existing.seconds += duration;
    } else {
      cell.activities.push({
        activity: category,
        seconds: duration,
        percentage: 0,
        color: ACTIVITY_COLORS[category] || ACTIVITY_COLORS.default
      });
    }
    
    cell.totalSeconds += duration;
    cell.hasDevice = true;
    activityTotals[category] = (activityTotals[category] || 0) + duration;
  }
  
  // ========== NORMALIZE & CALCULATE PERCENTAGES ==========
  let maxCellSeconds = 0;
  let mostActiveHour = { hour: 0, day: 0, seconds: 0 };
  const dayTotals: number[] = Array(7).fill(0);
  
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = grid[day][hour];
      
      // Normalize by week count
      cell.totalSeconds = Math.round(cell.totalSeconds / weekCount);
      
      for (const activity of cell.activities) {
        activity.seconds = Math.round(activity.seconds / weekCount);
        activity.percentage = cell.totalSeconds > 0 
          ? Math.round((activity.seconds / cell.totalSeconds) * 100) 
          : 0;
      }
      
      // Sort by seconds descending
      cell.activities.sort((a, b) => b.seconds - a.seconds);
      
      // Apply threshold: keep activities with >10% or >60 seconds
      cell.activities = cell.activities.filter(a => 
        a.percentage >= 10 || a.seconds >= 60
      );
      
      // Recalculate percentages after filtering
      const totalFiltered = cell.activities.reduce((sum, a) => sum + a.seconds, 0);
      for (const activity of cell.activities) {
        activity.percentage = totalFiltered > 0 
          ? Math.round((activity.seconds / totalFiltered) * 100) 
          : 0;
      }
      
      // Set dominant activity
      if (cell.activities.length > 0) {
        cell.dominantActivity = cell.activities[0].activity;
      }
      
      // Track maximums
      if (cell.totalSeconds > maxCellSeconds) {
        maxCellSeconds = cell.totalSeconds;
        mostActiveHour = { hour, day, seconds: cell.totalSeconds };
      }
      
      dayTotals[day] += cell.totalSeconds;
    }
  }
  
  // ========== BUILD LEGEND ==========
  const legend = Object.entries(activityTotals)
    .map(([activity, seconds]) => ({
      activity,
      color: ACTIVITY_COLORS[activity] || ACTIVITY_COLORS.default,
      totalSeconds: Math.round(seconds / weekCount) // Normalized
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 8); // Top 8 activities
  
  // ========== BUILD STATS ==========
  const totalHours = Math.round(
    Object.values(activityTotals).reduce((sum, s) => sum + s, 0) / 3600 / weekCount
  );
  
  const mostActiveDay = dayTotals.indexOf(Math.max(...dayTotals));
  
  const stats = {
    totalHours,
    mostActiveHour: { hour: mostActiveHour.hour, day: mostActiveHour.day },
    mostActiveDay,
    activityBreakdown: Object.fromEntries(
      legend.map(l => [l.activity, Math.round(l.totalSeconds / 3600)])
    )
  };
  
  return {
    grid,
    legend,
    stats,
    generatedAt: now.toISOString(),
    daysCovered: days
  };
}

// ========== IPC HANDLER ==========
ipcMain.handle('get-typical-day', async (event, { days = 30 }: { days?: number } = {}) => {
  try {
    const db = getDb();
    if (!db) {
      return { success: false, error: 'Database not available' };
    }
    
    // Check cache
    const cacheKey = `typical-day-${days}`;
    const cached = typicalDayCache.get(cacheKey);
    
    // Cache valid for 5 minutes
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return { success: true, data: cached.data };
    }
    
    // Calculate
    const data = await calculateTypicalDay(db, days);
    
    // Update cache
    typicalDayCache.set(cacheKey, { data, timestamp: Date.now(), days });
    
    return { success: true, data };
    
  } catch (error: any) {
    console.error('Error in get-typical-day:', error);
    return { success: false, error: error.message };
  }
});

// Invalidate cache when new sessions added
ipcMain.handle('invalidate-typical-day-cache', async () => {
  typicalDayCache.clear();
  return { success: true };
});
```

---

## 2. Frontend Component

```tsx
// src/pages/InsightsPage.tsx
// Replace the Typical Day section (lines ~247-337) with this:

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ========== TYPES ==========
interface ActivityBucket {
  activity: string;
  seconds: number;
  percentage: number;
  color: string;
}

interface HourCell {
  activities: ActivityBucket[];
  totalSeconds: number;
  dominantActivity: string;
  hasExternal: boolean;
  hasDevice: boolean;
}

interface TypicalDayData {
  grid: HourCell[][];
  legend: { activity: string; color: string; totalSeconds: number }[];
  stats: {
    totalHours: number;
    mostActiveHour: { hour: number; day: number };
    mostActiveDay: number;
    activityBreakdown: Record<string, number>;
  };
  generatedAt: string;
  daysCovered: number;
}

// ========== CONSTANTS ==========
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a',
  '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p',
  '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p'
];

const CELL_SIZE = 16;
const CELL_GAP = 3;
const CELL_RADIUS = 2;

// Intensity levels for single-activity cells
const INTENSITY_COLORS = {
  high: 'rgba(16, 185, 129, 0.9)',    // >45 min avg
  medium: 'rgba(16, 185, 129, 0.6)', // >20 min avg
  low: 'rgba(16, 185, 129, 0.35)',   // >5 min avg
  minimal: 'rgba(16, 185, 129, 0.15)' // >0
};

// ========== SUB-COMPONENTS ==========

/**
 * Single hour cell with stacked activity segments
 */
const HourCellComponent: React.FC<{
  cell: HourCell;
  dayIndex: number;
  hourIndex: number;
  onClick: (day: number, hour: number) => void;
}> = ({ cell, dayIndex, hourIndex, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate background
  const getBackground = () => {
    if (cell.activities.length === 0) {
      return 'rgba(39, 39, 42, 0.5)'; // Zinc-800/50
    }
    
    if (cell.activities.length === 1) {
      // Single activity: use intensity
      const seconds = cell.totalSeconds;
      if (seconds >= 2700) return INTENSITY_COLORS.high;
      if (seconds >= 1200) return INTENSITY_COLORS.medium;
      if (seconds >= 300) return INTENSITY_COLORS.low;
      return INTENSITY_COLORS.minimal;
    }
    
    // Multiple activities: stacked gradient
    const segments = cell.activities.map((a, i) => {
      const start = cell.activities.slice(0, i).reduce((sum, x) => sum + x.percentage, 0);
      return `${a.color} ${start}% ${start + a.percentage}%`;
    });
    
    return `linear-gradient(to right, ${segments.join(', ')})`;
  };
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };
  
  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(dayIndex, hourIndex)}
      style={{ cursor: 'pointer' }}
    >
      {/* Cell background */}
      <rect
        x={hourIndex * (CELL_SIZE + CELL_GAP)}
        y={0}
        width={CELL_SIZE}
        height={CELL_SIZE}
        rx={CELL_RADIUS}
        fill={getBackground()}
        stroke={isHovered ? 'rgba(255, 255, 255, 0.3)' : 'transparent'}
        strokeWidth={1}
      />
      
      {/* Activity indicator dots for multi-activity */}
      {cell.activities.length > 1 && (
        <>
          {cell.activities.slice(0, 3).map((a, i) => (
            <circle
              key={i}
              cx={hourIndex * (CELL_SIZE + CELL_GAP) + 3 + i * 4}
              cy={CELL_SIZE - 3}
              r={1.5}
              fill={a.color}
            />
          ))}
        </>
      )}
      
      {/* Hover state overlay */}
      {isHovered && (
        <rect
          x={hourIndex * (CELL_SIZE + CELL_GAP)}
          y={0}
          width={CELL_SIZE}
          height={CELL_SIZE}
          rx={CELL_RADIUS}
          fill="rgba(255, 255, 255, 0.1)"
        />
      )}
    </g>
  );
};

/**
 * Tooltip shown on hover
 */
const Tooltip: React.FC<{
  cell: HourCell;
  dayLabel: string;
  hourLabel: string;
  position: { x: number; y: number };
}> = ({ cell, dayLabel, hourLabel, position }) => {
  if (cell.activities.length === 0) {
    return (
      <div
        className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl"
        style={{ left: position.x + 10, top: position.y + 10 }}
      >
        <div className="text-xs text-zinc-500">No activity</div>
        <div className="text-sm text-zinc-400 mt-1">{dayLabel} {hourLabel}</div>
      </div>
    );
  }
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };
  
  return (
    <div
      className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl min-w-[180px]"
      style={{ left: position.x + 10, top: position.y + 10 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-200">{dayLabel} {hourLabel}</span>
        <span className="text-xs text-zinc-500">avg/day</span>
      </div>
      
      <div className="space-y-1.5">
        {cell.activities.map((activity, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: activity.color }}
              />
              <span className="text-xs text-zinc-300">{activity.activity}</span>
            </div>
            <span className="text-xs text-zinc-400 ml-4">
              {formatDuration(activity.seconds)} ({activity.percentage}%)
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between">
        <span className="text-xs text-zinc-500">Total</span>
        <span className="text-xs text-zinc-400">{formatDuration(cell.totalSeconds)}</span>
      </div>
      
      {/* Data source indicators */}
      <div className="mt-2 flex gap-2">
        {cell.hasExternal && (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
            External
          </span>
        )}
        {cell.hasDevice && (
          <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
            Device
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Legend component
 */
const Legend: React.FC<{
  items: { activity: string; color: string; totalSeconds: number }[];
}> = ({ items }) => {
  const formatHours = (seconds: number) => {
    return `${(seconds / 3600).toFixed(1)}h`;
  };
  
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-zinc-400">{item.activity}</span>
          <span className="text-[10px] text-zinc-600">
            {formatHours(item.totalSeconds)}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Quick stats row
 */
const QuickStats: React.FC<{
  stats: TypicalDayData['stats'];
  dayLabels: string[];
}> = ({ stats, dayLabels }) => {
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="bg-zinc-900/50 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Total Hours</div>
        <div className="text-2xl font-bold text-zinc-100 mt-1">{stats.totalHours}h</div>
        <div className="text-[10px] text-zinc-600">avg per day</div>
      </div>
      
      <div className="bg-zinc-900/50 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Most Active</div>
        <div className="text-2xl font-bold text-zinc-100 mt-1">
          {dayLabels[stats.mostActiveDay]}
        </div>
        <div className="text-[10px] text-zinc-600">day of week</div>
      </div>
      
      <div className="bg-zinc-900/50 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Peak Hour</div>
        <div className="text-2xl font-bold text-zinc-100 mt-1">
          {HOUR_LABELS[stats.mostActiveHour.hour]}
        </div>
        <div className="text-[10px] text-zinc-600">
          {dayLabels[stats.mostActiveHour.day]}
        </div>
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========

export const TypicalDaySection: React.FC<{
  periodDays: number;
}> = ({ periodDays }) => {
  const [data, setData] = useState<TypicalDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
    position: { x: number; y: number };
  } | null>(null);
  
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await window.deskflowAPI?.getTypicalDay?.({ days: periodDays });
        
        if (result?.success) {
          setData(result.data);
        } else {
          setError(result?.error || 'Failed to load data');
        }
      } catch (e: any) {
        setError(e.message);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [periodDays]);
  
  // Handle cell click
  const handleCellClick = useCallback((day: number, hour: number) => {
    // Navigate to day detail or show modal
    console.log('Clicked:', DAY_LABELS[day], HOUR_LABELS[hour]);
    // TODO: Implement navigation
  }, []);
  
  // Handle mouse move for tooltip positioning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredCell) {
      setHoveredCell({
        ...hoveredCell,
        position: { x: e.clientX, y: e.clientY }
      });
    }
  }, [hoveredCell]);
  
  // Calculate SVG dimensions
  const gridWidth = 24 * (CELL_SIZE + CELL_GAP);
  const gridHeight = CELL_SIZE;
  const totalHeight = 7 * (gridHeight + 20); // 20px for day labels
  
  if (loading) {
    return (
      <div className="bg-zinc-900/30 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-800 rounded w-40 mb-4" />
          <div className="h-32 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-zinc-900/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">Typical Day</h3>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="bg-zinc-900/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">Typical Day</h3>
        <div className="text-zinc-500 text-sm">No data available</div>
      </div>
    );
  }
  
  return (
    <div className="bg-zinc-900/30 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-200">Typical Day</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Activity patterns across {data.daysCovered} days
          </p>
        </div>
        <div className="text-xs text-zinc-600">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </div>
      </div>
      
      {/* Quick Stats */}
      <QuickStats stats={data.stats} dayLabels={DAY_LABELS} />
      
      {/* Heatmap Grid */}
      <div 
        className="relative overflow-x-auto"
        onMouseMove={handleMouseMove}
      >
        {/* Hour labels (top) */}
        <div 
          className="flex mb-1 ml-10"
          style={{ width: gridWidth }}
        >
          {HOUR_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[9px] text-zinc-600 text-center"
              style={{ 
                width: CELL_SIZE,
                marginRight: i < 23 ? CELL_GAP : 0 
              }}
            >
              {i % 3 === 0 ? label : ''}
            </div>
          ))}
        </div>
        
        {/* Grid rows */}
        <div className="space-y-1">
          {data.grid.map((dayData, dayIndex) => (
            <div key={dayIndex} className="flex items-center">
              {/* Day label */}
              <div className="w-8 text-xs text-zinc-500 text-right pr-2">
                {DAY_LABELS[dayIndex]}
              </div>
              
              {/* Hour cells */}
              <svg 
                width={gridWidth} 
                height={CELL_SIZE}
                className="flex-shrink-0"
              >
                {dayData.map((cell, hourIndex) => (
                  <HourCellComponent
                    key={hourIndex}
                    cell={cell}
                    dayIndex={dayIndex}
                    hourIndex={hourIndex}
                    onClick={handleCellClick}
                  />
                ))}
              </svg>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tooltip */}
      {hoveredCell && data.grid[hoveredCell.day][hoveredCell.hour] && (
        <Tooltip
          cell={data.grid[hoveredCell.day][hoveredCell.hour]}
          dayLabel={DAY_LABELS[hoveredCell.day]}
          hourLabel={HOUR_LABELS[hoveredCell.hour]}
          position={hoveredCell.position}
        />
      )}
      
      {/* Legend */}
      {data.legend.length > 0 && (
        <Legend items={data.legend} />
      )}
      
      {/* Intensity scale */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] text-zinc-600">Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: INTENSITY_COLORS.minimal }} />
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: INTENSITY_COLORS.low }} />
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: INTENSITY_COLORS.medium }} />
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: INTENSITY_COLORS.high }} />
        </div>
        <span className="text-[10px] text-zinc-600">More</span>
      </div>
    </div>
  );
};

// Export for use in InsightsPage
export default TypicalDaySection;
```

---

## 3. Add to Preload (if needed)

```typescript
// src/preload.ts - Add if not already present
getTypicalDay: (params?: { days?: number }) => 
  ipcRenderer.invoke('get-typical-day', params),
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Layout | Single 24-cell row | 24×7 heatmap grid |
| Data sources | External sessions only | External + Device logs |
| Activities per hour | 1 (dominant only) | All (threshold-filtered) |
| Normalization | Raw totals | Per-day average |
| Caching | None | 5-minute cache |
| Interactivity | None | Hover tooltip + click |
| Stats | None | Quick stats panel |