import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Plus, X, Trash2, Clock, CalendarClock, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/input';
import { cn } from '../../lib/utils';
import {
  LEAD_PRESETS, describeLead, describeWhen, liveReminders,
  deadlineInstant, newReminderId,
  type DeadlineReminder,
} from '../../shared/deadlineReminders';

/* ──────────────────────────────────────────────────────────────────────────
   DESIGN INTENT (PAINT §0.3)

   1. SKILLS. `apple-design` §7 (spatial consistency), §1 (respond on press),
      §16 (restraint); PAINT + LAMINAR tokens; `impeccable` five states;
      `humancentred-UIUX` feedback + error recovery. apple-design's §4 springs
      and §12 translucent materials are BANNED by LAMINAR §6/§7 and are not
      used: this is a data surface, so it is flat, hairline-bordered and
      critically damped at most.

   2. THE IDEA. "When the thing happens" and "when you want to know" are two
      different clocks. The deadline's own date is never editable here — that
      belongs to the deadline. This sheet only ever edits WHEN YOU GET TOLD,
      and it says so in its own heading, because the previous UI offered one
      `remind_at` field that looked like it was editing the deadline.

   3. WHY EACH CHOICE.
      - Two modes, because the two requests are genuinely different shapes:
        relative ("1 day before") is a rule that must SURVIVE a reschedule;
        absolute ("on the 3rd at 14:00") is a fixed appointment. One column
        cannot honestly store both, which is why the table has a `mode`.
      - Many reminders, because "a week out AND the morning of" is the actual
        shape of the ask, not an edge case.
      - Each row states its lead AND when it resolves, because "1d before" is
        only meaningful next to the date it lands on.
      - Stale leads are shown greyed and marked spent rather than deleted, so
        the list does not lie about what happened.

   4. FIT. L2 Responsive. Sits inside the existing DeadlinesCard as a sheet
      anchored to the bell that opened it — enter and exit along the SAME path
      (§7), because a sheet that flies from the window edge on a row-local
      control teaches you that the row and the sheet are unrelated.
   ────────────────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  deadline: { id: string; title: string; due_date: string; due_time?: string | null } | null;
  onClose: () => void;
  onChanged?: () => void;
}

type Mode = 'relative' | 'absolute';

const api = () => (window as any).deskflowAPI;

export function ReminderEditorSheet({ open, deadline, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<DeadlineReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('relative');
  const [lead, setLead] = useState<string>('1440');
  const [when, setWhen] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const sheetRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const due = deadline ? deadlineInstant(deadline) : null;
  const { live, expired } = liveReminders(rows, deadline ?? { due_date: '' }, now);

  /* The absolute field opens bounded by the two moments that make it
     meaningful: later than now (a past time is not a reminder) and no later
     than the deadline (a reminder after the thing happens is not a reminder).
     These are the same bounds the IPC handler enforces, so the control cannot
     offer a value the handler will reject. */
  const absMin = useMemo_now();
  const absMax = due ? new Date(due.getTime() - 60_000) : null;

  const load = useCallback(async () => {
    if (!deadline) return;
    setLoading(true); setError(null);
    try {
      const res = await api()?.getDeadlineReminders?.(deadline.id);
      setRows(res?.reminders ?? []);
    } catch (e: any) {
      setError(e.message || 'Could not load reminders');
    } finally { setLoading(false); }
  }, [deadline?.id]);

  useEffect(() => { if (open) { load(); setError(null); setWhen(''); } }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const add = async () => {
    if (!deadline) return;
    setBusy('add'); setError(null);
    try {
      const payload = mode === 'relative'
        ? { mode: 'relative', lead_min: Number(lead) }
        : { mode: 'absolute', remind_at: when ? new Date(when).toISOString() : '' };
      if (location) payload.location = location;
      const res = await api()?.addDeadlineReminder?.(deadline.id, payload);
      if (res && res.success === false) setError(res.error || 'Could not add that reminder.');
      else { await load(); onChanged?.(); setWhen(''); setLocation(''); }
    } catch (e: any) {
      setError(e.message || 'Could not reach the reminder store.');
    } finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    setBusy(id); setError(null);
    try {
      await api()?.deleteDeadlineReminder?.(id);
      setRows(prev => prev.filter(r => r.id !== id));
      onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Could not remove that reminder.');
    } finally { setBusy(null); }
  };

  if (!open || !deadline) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-start sm:items-center justify-center p-3 overflow-y-auto overscroll-contain"
        onClick={onClose}
      >
        <motion.div
          ref={sheetRef}
          key="sheet"
          /* §7: the sheet is anchored to the control that opened it, and it
             returns along the same path. transform-origin is the bottom on
             mobile, where it reads as rising out of the list it belongs to. */
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', damping: 1, stiffness: 320, mass: 0.7 }}
          onClick={e => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-labelledby="rem-sheet-title"
          className="w-full max-w-md my-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-popover)] shadow-xl overflow-hidden"
        >
          {/* Header — names what this sheet is NOT editing. */}
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-[var(--color-border)]">
            <div className="min-w-0">
              <h2 id="rem-sheet-title" className="text-[13px] font-semibold text-[var(--color-foreground)] flex items-center gap-1.5">
                <Bell size={13} className="text-[var(--page-accent)]" aria-hidden />
                Reminders
              </h2>
              <p className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5 truncate">
                When to be told about <span className="text-[var(--color-foreground)]">{deadline.title}</span>
                {' · due '}
                <span className="font-mono">
                  {due ? due.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'no date'}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close reminders"
              className="shrink-0 p-1.5 -m-0.5 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3 overflow-y-auto overscroll-contain">
            {/* ── Loading: skeleton matching the row shape, not a spinner ── */}
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Loading reminders">
                {[0, 1].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-[var(--color-muted)] animate-pulse" />
                ))}
              </div>
            ) : error && rows.length === 0 ? (
              /* ── Error: cause + a recovery action, never a bare message ── */
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                <p className="text-[12px] text-[var(--color-foreground)] flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-rose-400" aria-hidden />
                  RHEO could not load your reminders.
                </p>
                <p className="text-[11px] text-[var(--color-muted-foreground)] mt-1">{error}</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={load}>
                  Try again
                </Button>
              </div>
            ) : live.length === 0 && expired.length === 0 ? (
              /* ── Empty: says what WOULD be here, not "no data" ── */
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-center">
                <Bell size={16} className="mx-auto text-[var(--color-muted-foreground)]" aria-hidden />
                <p className="text-[12px] text-[var(--color-foreground)] mt-1.5">No reminders yet</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">
                  Add one below — nothing will interrupt you for this deadline until you do.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {/* ── Populated ── */}
                {live.map(r => (
                  <li key={r.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-50)] px-2.5 py-2">
                    {r.mode === 'relative'
                      ? <Clock size={13} className="shrink-0 text-[var(--page-accent)]" aria-hidden />
                      : <CalendarClock size={13} className="shrink-0 text-[var(--page-accent)]" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[var(--color-foreground)] truncate">
                        {r.mode === 'relative' ? describeLead(r.lead_min)
                          : new Date(r.remind_at!).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)] truncate">
                        {describeWhen(r, deadline, now) ?? ''}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy === r.id}
                      aria-label={`Remove reminder ${describeLead(r.lead_min)}`}
                      className="shrink-0 p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                    >
                      {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </li>
                ))}
                {/* ── Partial/spent: shown, not hidden ── */}
                {expired.map(r => (
                  <li key={r.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] px-2.5 py-2 opacity-55">
                    <Clock size={13} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[var(--color-muted-foreground)] line-through truncate">
                        {r.mode === 'relative' ? describeLead(r.lead_min)
                          : new Date(r.remind_at!).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)] truncate">
                        {r.fired ? 'already sent' : 'no longer reachable'}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy === r.id}
                      aria-label="Remove spent reminder"
                      className="shrink-0 p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Add form. Two modes, because the two asks are different. ── */}
            <div className="pt-1 border-t border-[var(--color-border)] space-y-2">
              <div className="flex items-center gap-2">
                {/* Segmented mode switch — the choice IS the point, so it is a
                    two-way switch rather than a dropdown that hides it. */}
                <div role="radiogroup" aria-label="Reminder mode" className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
                  {(['relative', 'absolute'] as Mode[]).map(m => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={cn(
                        'px-2.5 h-7 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--page-accent)]',
                        mode === m
                          ? 'bg-[var(--page-accent)] text-[var(--color-background)]'
                          : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)]',
                      )}
                    >
                      {m === 'relative' ? 'Before it' : 'Exact time'}
                    </button>
                  ))}
                </div>

                {mode === 'relative' ? (
                  <Select
                    value={lead}
                    onValueChange={setLead}
                    valueLabel={Object.fromEntries(LEAD_PRESETS.map(p => [String(p.min), p.label]))}
                    className="flex-1 h-7 text-[12px]"
                  >
                    {LEAD_PRESETS.map(p => <SelectItem key={p.min} value={String(p.min)}>{p.label}</SelectItem>)}
                  </Select>
                ) : (
                  <DateTimePicker
                    value={when}
                    onChange={setWhen}
                    min={absMin}
                    max={absMax ? new Date(absMax.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined}
                    placeholder="Pick when to be told"
                    className="flex-1"
                    deadlineDate={absMax ? new Date(absMax.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : undefined}
                    deadlineTime={absMax ? new Date(absMax.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16) : undefined}
                  />
                )}

                {/* Location */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-[var(--color-muted-foreground)] shrink-0">Location</Label>
                  <LocationAutocomplete
                    value={location}
                    onChange={setLocation}
                    placeholder="Search or add location..."
                    className="flex-1 h-7 text-[12px]"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={add}
                  disabled={busy === 'add' || (mode === 'absolute' && !when)}
                  className="h-7 px-2 gap-1 shrink-0"
                >
                  {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </Button>
              </div>

              {/* Inline validation — checked as you go, never on submit only. */}
              <p className="text-[10px] text-[var(--color-muted-foreground)] leading-snug">
                {mode === 'relative'
                  ? 'Moves with the deadline if you reschedule it. Several reminders can fire, one after another.'
                  : 'A fixed moment. Stays put if the deadline moves.'}
                {absMax && mode === 'absolute' && ' Must be after now and before the deadline.'}
              </p>

              {error && rows.length > 0 && (
                <p role="alert" className="text-[11px] text-rose-400 flex items-start gap-1.5">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* `datetime-local` needs a local-time string, not an ISO one. */
function useMemo_now(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}