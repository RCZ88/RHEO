import { useEffect, useMemo, useState } from 'react';
import { Target, Pencil, Eye, EyeOff, Save } from 'lucide-react';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../../components/ui/number-ticker';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import type { FocusHistoryRow } from './focusHelpers';
import { fmtDuration } from './focusHelpers';
import { cn } from '@/lib/utils';

export interface FocusGoalConfig {
  lenient_goal_sec: number;
  strict_goal_sec: number;
  updated_at: string | null;
}

function computeModeDaily(
  history: FocusHistoryRow[],
  strictness: 'distracting' | 'non_allowed',
  goalSec: number,
): { currentSec: number; pct: number } {
  if (!goalSec || goalSec <= 0) return { currentSec: 0, pct: 0 };
  const today = new Date().toDateString();
  const currentSec = history
    .filter(
      h =>
        h.outcome === 'completed' &&
        h.strictness === strictness &&
        new Date(h.started_at).toDateString() === today,
    )
    .reduce((sum, h) => sum + (h.actual_sec || 0), 0);
  return { currentSec, pct: Math.min(100, Math.round((currentSec / goalSec) * 100)) };
}

interface GoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: FocusGoalConfig;
  onSave: (cfg: { lenient_goal_sec: number; strict_goal_sec: number }) => Promise<boolean>;
}

function GoalsDialog({ open, onOpenChange, config, onSave }: GoalsDialogProps) {
  const [lenientMin, setLenientMin] = useState('');
  const [strictMin, setStrictMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLenientMin(config.lenient_goal_sec > 0 ? String(Math.round(config.lenient_goal_sec / 60)) : '');
    setStrictMin(config.strict_goal_sec > 0 ? String(Math.round(config.strict_goal_sec / 60)) : '');
    setErr(null);
  }, [open, config]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave({
      lenient_goal_sec: (Math.max(0, Number(lenientMin)) || 0) * 60,
      strict_goal_sec: (Math.max(0, Number(strictMin)) || 0) * 60,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
    else setErr('Could not save goals. Check the console for details.');
  };

  const numInput = (value: string, setValue: (v: string) => void, accent: string) => (
    <input
      type="number"
      min={0}
      step={5}
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder="0 = no goal"
      className={cn(
        'w-20 px-2 py-1.5 rounded-lg bg-zinc-800/40 border outline-none text-[13px] text-zinc-200 placeholder:text-zinc-600 transition-colors',
        `focus:border-${accent}-500/40 focus:ring-1 focus:ring-${accent}-500/20`
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-zinc-950 border border-zinc-800/60">
        <DialogHeader>
          <DialogTitle className="flex ites-center gap-2">
            <Target className="w-4 h-4 text-[var(--page-accent)]" />
            Daily focus goals
          </DialogTitle>
          <DialogDescription>
            Set a daily time target for each mode. Only completed sessions count.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-300">
              <EyeOff className="w-3.5 h-3.5 text-[var(--page-accent)]" />
              Lenient
            </span>
            <div className="flex items-center gap-2">
              {numInput(lenientMin, setLenientMin, 'clay')}
              <span className="text-[11px] text-zinc-500">min/day</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-300">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Strict
            </span>
            <div className="flex items-center gap-2">
              {numInput(strictMin, setStrictMin, 'amber')}
              <span className="text-[11px] text-zinc-500">min/day</span>
            </div>
          </div>
          {err && <p className="text-[11px] text-rose-400">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400 hover:text-zinc-200">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 rounded-lg">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save goals'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FocusGoals({ history }: { history: FocusHistoryRow[] }) {
  const [config, setConfig] = useState<FocusGoalConfig>({ lenient_goal_sec: 0, strict_goal_sec: 0, updated_at: null });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api?.focusGoal?.get) return;
    api
      .focusGoal.get()
      .then((cfg: any) => {
        if (cfg?.lenient_goal_sec != null) {
          setConfig({
            lenient_goal_sec: Number(cfg.lenient_goal_sec) || 0,
            strict_goal_sec: Number(cfg.strict_goal_sec) || 0,
            updated_at: cfg.updated_at ?? null,
          });
        }
      })
      .catch((e: any) => console.error('[Focus] Failed to load goal config:', e));
  }, []);

  const lenient = useMemo(
    () => computeModeDaily(history, 'distracting', config.lenient_goal_sec),
    [history, config.lenient_goal_sec],
  );
  const strict = useMemo(
    () => computeModeDaily(history, 'non_allowed', config.strict_goal_sec),
    [history, config.strict_goal_sec],
  );

  const hasGoals = config.lenient_goal_sec > 0 || config.strict_goal_sec > 0;

  const handleSave = async (cfg: { lenient_goal_sec: number; strict_goal_sec: number }): Promise<boolean> => {
    const api = (window as any).deskflowAPI;
    if (!api?.focusGoal?.save) return false;
    try {
      const res = await api.focusGoal.save(cfg);
      if (res?.lenient_goal_sec != null && res?.strict_goal_sec != null) {
        setConfig({
          lenient_goal_sec: Number(res.lenient_goal_sec),
          strict_goal_sec: Number(res.strict_goal_sec),
          updated_at: res.updated_at ?? null,
        });
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('[Focus] Failed to save goal config:', e);
      return false;
    }
  };

  return (
    <GlassCard className="bg-zinc-900/95 border-zinc-800/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--page-accent)]" />
          Focus goals
        </h3>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            'flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors',
            'bg-zinc-800/60 text-zinc-400 hover:text-[var(--page-accent)] hover:border-[var(--page-accent)]/30'
          )}
        >
          <Pencil className="w-2.5 h-2.5" />
          Set goals
        </button>
      </div>

      {!hasGoals ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 flex items-center gap-2 px-3 py-2.5">
          <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-emerald-300">
            Set daily focus-time goals per mode — e.g. 20 min in strict, 1 hour in lenient.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Lenient mode */}
          <div className="relative overflow-hidden rounded-lg p-3 bg-zinc-800/40 border border-zinc-800/50">
            <div className="absolute top-0 left-3 right-3 h-px bg-[var(--accent-primary)]/30" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.2)' }}>
                <EyeOff className="w-4 h-4 text-[var(--page-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Lenient</p>
                <div className="flex items-center gap-3">
                  <AnimatedCircularProgressBar
                    value={lenient.pct}
                    size={44}
                    strokeWidth={4}
                    gaugePrimaryColor="var(--accent-primary)"
                    gaugeSecondaryColor="rgba(255,255,255,0.06)"
                    linear
                    linearDurationMs={800}
                  />
                  <div className="space-y-0.5 min-w-0">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-zinc-500">Goal</p>
                      <p className="text-[12px] font-bold tabular-nums font-mono text-white truncate">
                        {fmtDuration(config.lenient_goal_sec)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-zinc-500">Done</p>
                      <p className="text-[12px] font-bold tabular-nums font-mono text-clay-300">
                        {fmtDuration(lenient.currentSec)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strict mode */}
          <div className="relative overflow-hidden rounded-lg p-3 bg-zinc-800/40 border border-zinc-800/50">
            <div className="absolute top-0 left-3 right-3 h-px bg-[var(--amber-400)]/30" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Eye className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Strict</p>
                <div className="flex items-center gap-3">
                  <AnimatedCircularProgressBar
                    value={strict.pct}
                    size={44}
                    strokeWidth={4}
                    gaugePrimaryColor="var(--amber-400)"
                    gaugeSecondaryColor="rgba(255,255,255,0.06)"
                    linear
                    linearDurationMs={800}
                  />
                  <div className="space-y-0.5 min-w-0">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-zinc-500">Goal</p>
                      <p className="text-[12px] font-bold tabular-nums font-mono text-white truncate">
                        {fmtDuration(config.strict_goal_sec)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-zinc-500">Done</p>
                      <p className="text-[12px] font-bold tabular-nums font-mono text-amber-300">
                        {fmtDuration(strict.currentSec)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[9px] text-zinc-600 mt-2.5">Completed sessions only · resets daily</p>

      <GoalsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={config}
        onSave={handleSave}
      />
    </GlassCard>
  );
}
