import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw, Flag, Plus, Trash2, Bell, BellOff, Timer as TimerIcon, Zap } from 'lucide-react';
import {
  useTimeStore, useNow, formatHms, formatAlarmAt,
  swStart, swPause, swReset, swLap, swAdd, swRemove,
  timerAdd, timerPause, timerResume, timerRemove,
  alarmAdd, alarmToggle, alarmRemove,
  stopwatchMs, timerRemainingMs, checkTimerCompletions,
} from '@/lib/timeStore';

type Tab = 'stopwatch' | 'timer' | 'alarms';

export function ClockDropdown() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('stopwatch');
  const ref = useRef<HTMLDivElement>(null);
  const store = useTimeStore();
  const now = useNow(500);

  useEffect(() => {
    checkTimerCompletions();
  }, [now]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const runningCount = store.stopwatches.filter(s => s.runningSinceMs != null).length
    + store.timers.filter(t => t.runningSinceMs != null).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-mono font-semibold text-white tabular-nums hover:text-white/80 light:text-zinc-800 transition"
        title="Timers, stopwatches & alarms"
        data-section="topbar.clock"
      >
        <Clock className="w-4 h-4 text-zinc-500" />
        {runningCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-label={`${runningCount} running`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl z-50 light:bg-white light:border-zinc-200">
          <div className="flex items-center gap-1 p-2 border-b border-zinc-800 light:border-zinc-200">
            {([
              ['stopwatch', 'Stopwatch', Zap],
              ['timer', 'Timer', TimerIcon],
              ['alarms', 'Alarms', Bell],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition ${tab === id ? 'bg-zinc-800 text-white light:bg-zinc-100 light:text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-3 max-h-[320px] overflow-y-auto">
            {tab === 'stopwatch' && <StopwatchTab now={now} />}
            {tab === 'timer' && <TimerTab now={now} />}
            {tab === 'alarms' && <AlarmsTab />}
          </div>
        </div>
      )}
    </div>
  );
}

function StopwatchTab({ now }: { now: number }) {
  const store = useTimeStore();
  return (
    <div className="flex flex-col gap-2">
      {store.stopwatches.length === 0 && (
        <p className="text-xs text-zinc-500 py-4 text-center">No stopwatches. Start one to track a session.</p>
      )}
      {store.stopwatches.map(s => {
        const running = s.runningSinceMs != null;
        return (
          <div key={s.id} className="rounded-lg border border-zinc-800 p-3 light:border-zinc-200">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-400">{s.label}</span>
              <button onClick={() => swRemove(s.id)} className="text-zinc-600 hover:text-red-400" aria-label="Remove"><Trash2 className="w-3 h-3" /></button>
            </div>
            <div className="font-mono text-2xl tabular-nums text-white light:text-zinc-900 my-1">{formatHms(stopwatchMs(s, now))}</div>
            <div className="flex gap-1.5">
              <button onClick={() => running ? swPause(s.id) : swStart(s.id)} className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-500/15 text-emerald-400 text-xs py-1.5 hover:bg-emerald-500/25 transition">
                {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />} {running ? 'Pause' : 'Start'}
              </button>
              <button onClick={() => swLap(s.id)} disabled={!running} className="flex-1 flex items-center justify-center gap-1 rounded-md bg-zinc-800 text-zinc-300 text-xs py-1.5 disabled:opacity-40 light:bg-zinc-100">
                <Flag className="w-3 h-3" /> Lap
              </button>
              <button onClick={() => swReset(s.id)} className="rounded-md bg-zinc-800 text-zinc-300 px-2.5 py-1.5 text-xs light:bg-zinc-100" aria-label="Reset">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            {s.laps.length > 0 && (
              <div className="mt-2 text-[10px] font-mono text-zinc-500 space-y-0.5">
                {s.laps.slice(-5).reverse().map((l, i) => (
                  <div key={i} className="flex justify-between"><span>Lap {s.laps.length - i}</span><span>{formatHms(l)}</span></div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => swAdd()} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-xs py-2 hover:border-zinc-500 hover:text-zinc-200 transition">
        <Plus className="w-3 h-3" /> New stopwatch
      </button>
    </div>
  );
}

const PRESETS = [5, 15, 25, 45];

function TimerTab({ now }: { now: number }) {
  const store = useTimeStore();
  const [custom, setCustom] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map(m => (
          <button key={m} onClick={() => timerAdd(m * 60000)} className="px-2.5 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 light:bg-zinc-100">{m}m</button>
        ))}
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const mins = parseFloat(custom);
              if (mins > 0) { timerAdd(mins * 60000); setCustom(''); }
            }
          }}
          placeholder="mins + Enter"
          className="w-24 px-2 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none light:bg-zinc-100"
        />
      </div>
      {store.timers.length === 0 && (
        <p className="text-xs text-zinc-500 py-4 text-center">No timers. Pick a preset or type minutes.</p>
      )}
      {store.timers.map(t => {
        const remaining = timerRemainingMs(t, now);
        const running = t.runningSinceMs != null;
        const done = t.finished || remaining <= 0;
        const pct = t.totalMs > 0 ? 1 - remaining / t.totalMs : 1;
        return (
          <div key={t.id} className="rounded-lg border border-zinc-800 p-3 light:border-zinc-200">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-400">{t.label}</span>
              <button onClick={() => timerRemove(t.id)} className="text-zinc-600 hover:text-red-400" aria-label="Remove"><Trash2 className="w-3 h-3" /></button>
            </div>
            <div className={`font-mono text-2xl tabular-nums my-1 ${done ? 'text-amber-400' : 'text-white light:text-zinc-900'}`}>
              {done ? 'Done' : formatHms(remaining)}
            </div>
            <div className="h-1 rounded-full bg-zinc-800 overflow-hidden light:bg-zinc-200">
              <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${Math.min(100, pct * 100)}%` }} />
            </div>
            {!done && (
              <button onClick={() => running ? timerPause(t.id) : timerResume(t.id)} className="mt-2 w-full flex items-center justify-center gap-1 rounded-md bg-emerald-500/15 text-emerald-400 text-xs py-1.5 hover:bg-emerald-500/25 transition">
                {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />} {running ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function AlarmsTab() {
  const store = useTimeStore();
  const [time, setTime] = useState('07:30');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]);

  return (
    <div className="flex flex-col gap-2">
      {store.alarms.length === 0 && (
        <p className="text-xs text-zinc-500 py-4 text-center">No alarms. Set one and the assistant can reference it.</p>
      )}
      {store.alarms.map(a => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 p-2.5 light:border-zinc-200">
          <button onClick={() => alarmToggle(a.id)} className={a.enabled ? 'text-emerald-400' : 'text-zinc-600'} aria-label="Toggle">
            {a.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1">
            <div className={`font-mono text-sm tabular-nums ${a.enabled ? 'text-white light:text-zinc-900' : 'text-zinc-600 line-through'}`}>{formatAlarmAt(a.atMinute)}</div>
            <div className="text-[10px] text-zinc-500">{a.label}{a.repeatDays.length > 0 ? ` · ${a.repeatDays.map(d => DAY_LETTERS[d]).join(' ')}` : ' · once'}</div>
          </div>
          <button onClick={() => alarmRemove(a.id)} className="text-zinc-600 hover:text-red-400" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <div className="rounded-lg border border-dashed border-zinc-700 p-2.5 flex flex-col gap-2">
        <div className="flex gap-1.5">
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-zinc-800 text-xs text-zinc-300 rounded-md px-2 py-1 focus:outline-none light:bg-zinc-100" />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" className="flex-1 bg-zinc-800 text-xs text-zinc-300 rounded-md px-2 py-1 placeholder:text-zinc-600 focus:outline-none light:bg-zinc-100" />
        </div>
        <div className="flex gap-1">
          {DAY_LETTERS.map((d, i) => (
            <button key={i} onClick={() => setDays(ds => ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i])}
              className={`w-6 h-6 rounded-full text-[10px] ${days.includes(i) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500 light:bg-zinc-100'}`}>{d}</button>
          ))}
          <button
            onClick={() => {
              const [h, m] = time.split(':').map(Number);
              if (!Number.isFinite(h) || !Number.isFinite(m)) return;
              alarmAdd(h * 60 + m, label || 'Alarm', days);
              setLabel(''); setDays([]);
            }}
            className="ml-auto px-3 rounded-md bg-emerald-500/15 text-emerald-400 text-xs hover:bg-emerald-500/25 transition"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
