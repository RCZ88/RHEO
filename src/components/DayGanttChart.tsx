import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TimelineItem {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
  category: 'external' | 'app' | 'browser' | 'log';
  color: string;
  duration: number;
  details?: string;
}

interface DayGanttChartProps {
  date: string;
  items: TimelineItem[];
  height?: number;
  onHourClick?: (hour: number) => void;
}

export function DayGanttChart({ date, items, height = 300, onHourClick }: DayGanttChartProps) {
  const startHour = 6; // 6 AM
  const endHour = 23; // 11 PM

  const filteredItems = useMemo(() => {
    return items.filter(item => item.endHour > startHour && item.startHour < endHour);
  }, [items]);

  const totalDuration = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.duration, 0);
  }, [filteredItems]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'external': return '◆';
      case 'app': return '●';
      case 'browser': return '■';
      case 'log': return '○';
      default: return '○';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'external': return '#8b5cf6';
      case 'app': return '#3b82f6';
      case 'browser': return '#10b981';
      case 'log': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'rgba(18, 18, 18, 0.95)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
        <div>
          <div className="text-sm font-semibold text-zinc-200">
            {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {formatDuration(totalDuration)} tracked • {filteredItems.length} activities
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <span style={{ color: '#8b5cf6' }}>◆ External</span>
          <span style={{ color: '#3b82f6' }}>● App</span>
          <span style={{ color: '#10b981' }}>■ Browser</span>
          <span style={{ color: '#f59e0b' }}>○ Log</span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="relative" style={{ height }}>
        {/* Hour markers with click zones */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-2 text-xs text-zinc-500 font-mono">
          {[6, 9, 12, 15, 18, 21].map(hour => (
            <div key={hour} className="text-right pr-2">{hour.toString().padStart(2, '0')}</div>
          ))}
        </div>

        {/* Clickable hour zones */}
        <div className="absolute left-12 right-0 top-0 bottom-0 flex">
          {[6, 9, 12, 15, 18, 21, 23].map((hour, idx) => {
            const nextHour = hour === 23 ? 24 : [9, 12, 15, 18, 21, 23][idx + 1] || 24;
            return (
              <div 
                key={hour} 
                className="flex-1 border-l border-zinc-800 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                onClick={() => onHourClick?.(hour)}
                title={`Click to view ${hour}:00 - ${nextHour}:00`}
              />
            );
          })}
        </div>

        {/* Current time indicator */}
        <div className="absolute left-12 right-0 top-0 bottom-0 pointer-events-none">
          {new Date().toDateString() === new Date(date).toDateString() && (
            <div 
              className="absolute h-0.5 bg-emerald-400 z-10"
              style={{ 
                left: `${((new Date().getHours() - 6) / 18) * 100}%`,
                right: 0
              }}
            />
          )}
        </div>

        {/* Timeline Items */}
        <div className="absolute left-12 right-0 top-2 bottom-2 overflow-y-auto">
          <div className="relative h-full">
            {filteredItems.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
                No tracked activity for this day
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const left = Math.max(0, ((item.startHour - startHour) / (endHour - startHour)) * 100);
                const width = Math.min(100 - left, ((item.endHour - item.startHour) / (endHour - startHour)) * 100);
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="absolute h-8 rounded-md flex items-center px-2 cursor-pointer group"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 2)}%`,
                      backgroundColor: item.color + '30',
                      borderLeft: `3px solid ${item.color}`,
                      top: `${index * 36}px`
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span style={{ color: item.color }} className="text-xs">{getCategoryIcon(item.category)}</span>
                      <span className="text-xs text-zinc-200 truncate">{item.label}</span>
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-1 px-2 py-1 rounded bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <div className="text-zinc-200 font-medium">{item.label}</div>
                      <div className="text-zinc-400">
                        {Math.floor(item.startHour)}:00 - {Math.floor(item.endHour)}:00 ({formatDuration(item.duration)})
                      </div>
                      {item.details && <div className="text-zinc-500 text-xs mt-1">{item.details}</div>}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 border-t flex items-center gap-6 text-xs" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500/30 border-l-2 border-purple-500" />
          <span className="text-zinc-400">
            External: {formatDuration(filteredItems.filter(i => i.category === 'external').reduce((s, i) => s + i.duration, 0))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500/30 border-l-2 border-blue-500" />
          <span className="text-zinc-400">
            Apps: {formatDuration(filteredItems.filter(i => i.category === 'app').reduce((s, i) => s + i.duration, 0))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500/30 border-l-2 border-emerald-500" />
          <span className="text-zinc-400">
            Browser: {formatDuration(filteredItems.filter(i => i.category === 'browser').reduce((s, i) => s + i.duration, 0))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/30 border-l-2 border-amber-500" />
          <span className="text-zinc-400">
            Logs: {formatDuration(filteredItems.filter(i => i.category === 'log').reduce((s, i) => s + i.duration, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

interface HourDetailProps {
  hour: number;
  date: string;
  items: TimelineItem[];
}

export function HourDetail({ hour, date, items }: HourDetailProps) {
  const hourItems = items.filter(item => 
    (item.startHour <= hour && item.endHour > hour) ||
    (item.startHour > hour && item.startHour < hour + 1)
  );
  const totalDuration = hourItems.reduce((sum, item) => sum + item.duration, 0);
  
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'rgba(18, 18, 18, 0.95)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
        <div className="text-sm font-semibold text-zinc-200">
          {hour.toString().padStart(2, '0')}:00 - {(hour + 1).toString().padStart(2, '0')}:00
        </div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {formatDuration(totalDuration)} total
        </div>
      </div>

      <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto">
        {hourItems.length === 0 ? (
          <div className="text-center text-zinc-500 py-4 text-xs">No activity this hour</div>
        ) : (
          hourItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-2 rounded-md"
              style={{ backgroundColor: item.color + '15' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-200">{item.label}</span>
                  {item.details && <span className="text-xs text-zinc-500">{item.details}</span>}
                </div>
              </div>
              <span className="text-xs text-zinc-400">{formatDuration(item.duration)}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// Convert all session types to timeline items
export function sessionsToTimelineItems(
  externalSessions: any[],
  appSessions: any[],
  browserSessions: any[],
  logs: any[] = []
): TimelineItem[] {
  const items: TimelineItem[] = [];

  externalSessions.forEach((session: any) => {
    const start = new Date(session.started_at);
    const end = session.ended_at ? new Date(session.ended_at) : new Date();
    items.push({
      id: `ext-${session.id}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      label: session.activity_name || session.name,
      category: 'external',
      color: session.color || '#8b5cf6',
      duration: session.duration_seconds || 0
    });
  });

  appSessions.forEach((session: any) => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : new Date();
    const duration = session.duration_sec || Math.floor((end.getTime() - start.getTime()) / 1000);
    items.push({
      id: `app-${session.id || Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      label: session.app,
      category: 'app',
      color: '#3b82f6',
      duration,
      details: session.domain || session.title
    });
  });

  browserSessions.forEach((session: any) => {
    const start = new Date(session.start_time || Date.now() - session.total_sec * 1000);
    const end = new Date(session.end_time || Date.now());
    items.push({
      id: `browser-${session.id || Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      label: session.domain || session.app,
      category: 'browser',
      color: '#10b981',
      duration: session.total_sec || 0
    });
  });

  logs.forEach((log: any) => {
    const start = new Date(log.timestamp);
    const durationSec = Math.floor((log.duration_ms || 0) / 1000);
    const end = new Date(start.getTime() + durationSec * 1000);
    items.push({
      id: `log-${log.id || Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      label: log.app,
      category: 'log',
      color: '#f59e0b',
      duration: durationSec,
      details: log.title || log.domain || log.category
    });
  });

  return items.sort((a, b) => a.startHour - b.startHour);
}

// Convert logs from get-day-detail directly to timeline items
export function logsToTimelineItems(logs: any[]): TimelineItem[] {
  return logs.map((log: any) => {
    const start = new Date(log.timestamp);
    const durationSec = Math.floor((log.duration_ms || 0) / 1000);
    const end = new Date(start.getTime() + durationSec * 1000);
    return {
      id: `log-${log.id}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      label: log.app,
      category: 'log' as const,
      color: '#f59e0b',
      duration: durationSec,
      details: log.title || log.domain || log.category
    };
  });
}