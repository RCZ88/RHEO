import { Play, Pause, Trash2, Bell, BellOff } from 'lucide-react';
import {
  useTimeStore, useNow, formatHms, formatAlarmAt,
  swStart, swPause, swRemove, timerPause, timerResume, timerRemove, alarmToggle,
  stopwatchMs, timerRemainingMs,
} from '@/lib/timeStore';

/** Read-only-ish live view of everything in timeStore. Used by the AI deck
 *  Time card and the Life page so both surfaces show the same numbers. */
export function TimePanel() {
  const store = useTimeStore();
  const now = useNow(500);
  const nothing = store.stopwatches.length === 0 && store.timers.length === 0 && store.alarms.length === 0;

  if (nothing) {
    return <p className="text-xs text-zinc-500 py-3">Nothing running. Start a stopwatch, timer, or alarm from the top-bar clock.</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {store.stopwatches.map(s => {
        const running = s.runningSinceMs != null;
        return (
          <div key={s.id} className="flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-2 light:border-zinc-200">
            <button onClick={() => running ? swPause(s.id) : swStart(s.id)} className="text-emerald-400" aria-label={running ? 'Pause' : 'Start'}>
              {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <span className="text-zinc-400 flex-1 truncate">{s.label}</span>
            <span className="font-mono tabular-nums text-zinc-200 light:text-zinc-800">{formatHms(stopwatchMs(s, now))}</span>
            <button onClick={() => swRemove(s.id)} className="text-zinc-600 hover:text-red-400" aria-label="Remove"><Trash2 className="w-3 h-3" /></button>
          </div>
        );
      })}
      {store.timers.map(t => {
        const remaining = timerRemainingMs(t, now);
        const done = t.finished || remaining <= 0;
        return (
          <div key={t.id} className="flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-2 light:border-zinc-200">
            {!done && (
              <button onClick={() => t.runningSinceMs != null ? timerPause(t.id) : timerResume(t.id)} className="text-emerald-400" aria-label="Toggle">
                {t.runningSinceMs != null ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            )}
            <span className="text-zinc-400 flex-1 truncate">{t.label}</span>
            <span className={`font-mono tabular-nums ${done ? 'text-amber-400' : 'text-zinc-200 light:text-zinc-800'}`}>{done ? 'Done' : formatHms(remaining)}</span>
            <button onClick={() => timerRemove(t.id)} className="text-zinc-600 hover:text-red-400" aria-label="Remove"><Trash2 className="w-3 h-3" /></button>
          </div>
        );
      })}
      {store.alarms.map(a => (
        <div key={a.id} className="flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-2 light:border-zinc-200">
          <button onClick={() => alarmToggle(a.id)} className={a.enabled ? 'text-emerald-400' : 'text-zinc-600'} aria-label="Toggle">
            {a.enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          </button>
          <span className="text-zinc-400 flex-1 truncate">{a.label}</span>
          <span className={`font-mono tabular-nums ${a.enabled ? 'text-zinc-200 light:text-zinc-800' : 'text-zinc-600 line-through'}`}>{formatAlarmAt(a.atMinute)}</span>
        </div>
      ))}
    </div>
  );
}
