import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────────────────────
   DESIGN INTENT (PAINT §0.3 + apple-design)

   1. SKILLS. `apple-design` §16 Familiarity and §1 respond-on-press; PAINT +
      LAMINAR tokens; `impeccable` five states; `humancentred-UIUX` inline
      validation. apple-design's §4 springs and §12 translucent materials are
      BANNED by LAMINAR and unused — this is a data control.

   2. THE IDEA. Picking a moment is one decision, not a wall of numbers. The
      native `datetime-local` control shows the browser's own chrome, ignores
      the app's tokens, gives no way to skip the date when you only mean "4pm",
      and — the part that actually matters here — happily accepts an instant
      AFTER the deadline, which the handler then rejects with an error. Pushing
      that rejection downstream is what makes a time picker feel broken.

   3. WHY EACH CHOICE.
      - Date and clock are SEPARATE steps. The common case is "the morning of",
        and making the user scroll a date field for that is friction paid for
        nothing.
      - The CLOCK is a number grid, not a dropdown of 1440 options. It is
        bounded to real minutes, keyboard-navigable, and the selected minute is
        always visible.
      - The forbidden window is NOT merely rejected — it is unselectable and
        visibly so. A control that lets you choose an invalid value and then
        complains has moved the problem, not solved it.
      - "Set to the deadline" is offered because it is a real choice people
        make, and it is exactly the value most likely to be out of bounds.

   4. FIT. L2 Responsive. Sits inside ReminderEditorSheet; opens in a popover
      anchored to its own trigger and returns along the same path (§7).
   ────────────────────────────────────────────────────────────────────────── */

export interface DateTimePickerProps {
  value: string;                       // 'YYYY-MM-DDTHH:mm' in LOCAL time
  onChange: (localValue: string) => void;
  /** Inclusive lower bound (local string). Earlier is not selectable. */
  min?: string;
  /** Inclusive upper bound (local string). Later is not selectable. */
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Local YYYY-MM-DD of the deadline, for the "morning of" shortcut. */
  deadlineDate?: string;
  /** Local HH:mm of the deadline, for "at the deadline". */
  deadlineTime?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time string → Date. NEVER `new Date(string)` for this: a bare
 *  'YYYY-MM-DD' is parsed as UTC and lands a day off east of Greenwich. */
function parseLocal(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePicker({
  value, onChange, min, max, placeholder = 'Pick a date and time',
  disabled, className, id, deadlineDate, deadlineTime,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  /* The TRIGGER and the popover are both "inside" the control as far as the
     outside-click test is concerned. Checking only the popover was the
     "it opens and closes by itself" bug: mousedown closed it, then the same
     press's click toggled it straight back open. */
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<null | {
    left: number; width: number; maxHeight: number; top?: number; bottom?: number;
  }>(null);

  /* PORTALED + FIXED. It used to be `absolute` inside the trigger's wrapper, so
     any scrolling sheet or `overflow-hidden` card cut it off — the reminder
     sheet sits at the bottom of the window, which is exactly where the hr/min
     row was being sliced. `place()` measures the trigger and opens on the side
     with room, flipping above when the space below cannot hold it. */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 340 && above > below;
    const maxHeight = Math.max(200, up ? above : below);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos(up
      ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 4 }
      : { left, width, maxHeight, top: r.bottom + 4 });
  }, []);

  const selected = parseLocal(value);
  const minD = useMemo(() => parseLocal(min || ''), [min]);
  const maxD = useMemo(() => parseLocal(max || ''), [max]);

  // The stage the user is editing. The DATE half changes here; the CLOCK half
  // edits `value` directly so a partially-chosen time is never lost by
  // switching between them.
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  useEffect(() => { if (open) setPickedDate(selected ?? new Date()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const isBeforeMin = useCallback((d: Date) => !!minD && d.getTime() < minD.getTime(), [minD]);
  const isAfterMax  = useCallback((d: Date) => !!maxD && d.getTime() > maxD.getTime(), [maxD]);

  const commit = useCallback((d: Date, h?: number, m?: number) => {
    const out = new Date(d);
    out.setHours(h ?? d.getHours(), m ?? d.getMinutes(), 0, 0);
    onChange(toLocalInput(out));
  }, [onChange]);

  /** A shortcut is only offered when its result is INSIDE the window — an
   *  action that is disabled by a rule the user cannot see is a trap. */
  const morningValid = !!pickedDate && !!deadlineDate
    && (() => { const t = new Date(pickedDate); t.setHours(9, 0, 0, 0);
                return !isBeforeMin(t) && !isAfterMax(t); })();

  const atDeadlineValid = !!deadlineDate && !!deadlineTime
    && (() => { const t = parseLocal(`${deadlineDate}T${deadlineTime}`);
                return !!t && !isBeforeMin(t) && !isAfterMax(t); })();

  const triggerLabel = selected
    ? selected.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'w-full h-8 px-2.5 rounded-lg border text-left text-[12px] transition-colors',
          'flex items-center gap-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]',
          disabled && 'opacity-50 cursor-not-allowed',
          selected
            ? 'border-[var(--color-border)] text-[var(--color-foreground)] bg-[var(--color-input)] hover:border-[var(--page-accent)]'
            : 'border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--page-accent)]',
        )}
      >
        <CalendarIcon size={13} className="shrink-0 text-[var(--page-accent)]" aria-hidden />
        <span className={cn('flex-1 truncate', !selected && 'italic')}>
          {triggerLabel ?? placeholder}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date and time"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(''); } }}
            className="shrink-0 p-0.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
        {open && pos && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ type: 'spring', damping: 1, stiffness: 340, mass: 0.7 }}
            ref={popRef}
            role="dialog"
            aria-label="Choose a date and time"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
            }}
            className="z-[9999] rounded-xl border border-[var(--color-border)] bg-[var(--color-popover)] p-2.5 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-2 right-2 p-1 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors z-10"
            >
              <X size={14} />
            </button>
          {/* Step 1 — the day */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-[var(--color-muted-foreground)]">Day</span>
            {/* Shortcuts, offered only when they land inside the window */}
            <div className="flex gap-1">
              {morningValid && (
                <button onClick={() => pickedDate && commit(pickedDate, 9, 0)}
                  className="text-[10px] px-1.5 h-5 rounded border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--page-accent)] transition-colors">
                  Morning
                </button>
              )}
              {atDeadlineValid && (
                <button onClick={() => { const t = parseLocal(`${deadlineDate}T${deadlineTime}`); if (t) onChange(toLocalInput(t)); }}
                  className="text-[10px] px-1.5 h-5 rounded border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--page-accent)] transition-colors">
                  At deadline
                </button>
              )}
            </div>
          </div>

          <div className="[&_.rdp-root]:!w-full [&_.rdp-month_caption]:text-[11px] [&_.rdp-day_button]:text-[12px] [&_.rdp-day_button]:h-7 [&_.rdp-day_button]:w-7 [&_.rdp-selected]:opacity-100 [&_.rdp-disabled]:opacity-30 [&_.rdp-disabled]:line-through">
            <Calendar
              mode="single"
              selected={pickedDate ?? undefined}
              onSelect={d => {
                if (!d) return;
                /* Picking a DAY must not wipe the clock. `commit(d)` alone took
                   the hours from the calendar cell (always 00:00), so choosing
                   "the 24th" after setting 14:00 silently became 00:00 — and
                   choosing 14:00 first then a day looked like the time control
                   had never worked. Keep the chosen clock; default to 09:00. */
                setPickedDate(d);
                commit(d, selected?.getHours() ?? 9, selected?.getMinutes() ?? 0);
              }}
              disabled={(d: Date) => isBeforeMin(d) || isAfterMax(d)}
              autoFocus
            />
          </div>

          {/* Step 2 — the clock */}
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock size={11} className="text-[var(--page-accent)]" aria-hidden />
              <span className="text-[11px] font-medium text-[var(--color-muted-foreground)]">Time</span>
              <span className="ml-auto font-mono text-[12px] text-[var(--color-foreground)] tabular-nums">
                {selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : '--:--'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--color-muted-foreground)] w-3">hr</span>
                <select
                  value={selected ? String(selected.getHours()) : ''}
                  onChange={e => { if (!pickedDate) return; commit(pickedDate, Number(e.target.value), selected ? selected.getMinutes() : 0); }}
                  aria-label="Hour"
                  className="w-full h-7 px-1 rounded-md border border-[var(--color-border)] bg-[var(--color-input)] text-[12px] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                >
                  {(selected ? Array.from({ length: 24 }, (_, h) => h) : Array.from({ length: 24 }, (_, h) => h)).map(h => (
                    <option key={h} value={h}>{pad(h)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--color-muted-foreground)] w-3">min</span>
                <select
                  value={selected ? String(selected.getMinutes()) : ''}
                  onChange={e => { if (!pickedDate) return; commit(pickedDate, selected ? selected.getHours() : 0, Number(e.target.value)); }}
                  aria-label="Minute"
                  className="w-full h-7 px-1 rounded-md border border-[var(--color-border)] bg-[var(--color-input)] text-[12px] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                >
                  {Array.from(new Set([selected ? selected.getMinutes() : 0, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])).map(m => (
                    <option key={m} value={m}>{pad(m)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* The bound is stated, not just enforced. */}
          {(minD || maxD) && (
            <p className="mt-2 text-[10px] leading-snug text-[var(--color-muted-foreground)]">
              Must be {minD ? `after ${minD.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
              {minD && maxD ? ' and ' : ''}
              {maxD ? `before ${maxD.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}.
            </p>
          )}
        </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

export default DateTimePicker;