import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { stopwatch } from '../lib/stopwatchStore';
import { scaleSegmentsToGap } from '../lib/external/gaps';
import { Activity, AlertCircle, BookOpen, Brain, Check, ChevronDown, Clock, Coffee, Dumbbell, GripVertical, Keyboard, Loader2, Lock, Minus, Moon, Plus, Search, Sparkles, Sun, Tv, Unlock, X } from 'lucide-react';

interface ExternalActivity {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface Segment {
  id: number;
  activityId: string | null;
  durationSeconds: number;
  /**
   * A locked slot keeps its exact duration. Adding or removing a slot
   * redistributes the gap again, and that used to overwrite EVERY duration, so a
   * carefully built 30m/45m split collapsed back to even shares the moment you
   * added a third slot. Locking pins the slots you have already decided and lets
   * the remainder be shared out around them.
   */
  locked?: boolean;
}

const ACTIVITY_ICONS: Record<string, typeof Moon> = {
  Moon, Sun, Brain, Coffee, Tv, BookOpen, Dumbbell, Sparkles,
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}



/** `1:05` when there are seconds worth showing, `45` when there are not. */
function formatDurationField(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? String(m) : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse a duration typed by a human: `45`, `1:30`, `90s`, `2m`.
 * Returns null for anything unparseable so a half-typed value is simply ignored
 * rather than snapping the slot to 1 minute on every keystroke.
 */
function parseDurationField(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const clock = t.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (clock) {
    const mins = Number(clock[1]);
    const secs = Number(clock[2]);
    // 1:99 is not a time. Without this it silently became 2:39.
    if (secs > 59) return null;
    const total = mins * 60 + secs;
    return total >= 60 ? total : null;
  }
  const unit = t.match(/^(\d+(?:\.\d+)?)\s*(h|m|s)$/);
  if (unit) {
    const n = Number(unit[1]);
    const secs = Math.round(unit[2] === 'h' ? n * 3600 : unit[2] === 'm' ? n * 60 : n);
    return secs >= 60 ? secs : null;
  }
  const plain = Number(t);
  if (Number.isFinite(plain) && plain >= 1) return Math.round(plain * 60);
  return null;
}


/**
 * A colour the user assigned to an activity, rendered so it does not fight the
 * interface.
 *
 * Activity colours are free-form data — a user picks anything, and a saturated
 * `#FF00AA` sitting on a near-black surface reads as a mistake rather than as
 * information. They were also being painted as solid blocks in the timeline bar,
 * which turned the bar into a stripe of clashing confetti.
 *
 * So: the hue stays the user's, but it is always used as a LOW-ALPHA tint with
 * the surface showing through, and the text on top stays a fixed readable zinc.
 * The result is recognisably the user's colour, sits calmly in the dark UI, and
 * keeps text contrast regardless of what hue was chosen.
 *
 * `alpha` is the tint strength; `lum` is a plain relative-luminance figure used
 * only to decide whether the swatch needs a hairline to stay visible.
 */
function tintOf(hex: string, alpha = 0.18): string {
  const c = normaliseHex(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

function solidOf(hex: string, alpha = 0.85): string {
  const c = normaliseHex(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

function normaliseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return { r: 113, g: 113, b: 126 };          // zinc-500, the neutral
  let h = m[1];
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** True when a hairline is needed for the swatch to be visible on the surface. */
function needsHairline(hex: string): boolean {
  const c = normaliseHex(hex);
  // Rec. 709 luma
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 90;
}

/**
 * The elapsed clock, in its own component so its 1Hz tick re-renders ONE text
 * node instead of the whole prompt.
 *
 * It used to be `useState` in the top-level component. That is correct React and
 * catastrophically slow here: once a second it re-rendered every segment bar, the
 * dnd-kit context, every framer `layout` element and the whole activity picker,
 * to change eight characters. That alone was the stutter — nothing was loading.
 */
const Elapsed = memo(function Elapsed({
  periodStart,
  fallback,
}: {
  periodStart?: string;
  fallback: number;
}) {
  const compute = useCallback(() => {
    if (!periodStart) return formatElapsed(fallback);
    return formatElapsed(Math.max(0, Math.floor((Date.now() - new Date(periodStart).getTime()) / 1000)));
  }, [periodStart, fallback]);
  const [text, setText] = useState(compute);
  useEffect(() => {
    setText(compute());
    if (!periodStart) return;
    const int = setInterval(() => setText(compute()), 1000);
    return () => clearInterval(int);
  }, [compute, periodStart]);
  return <span className="text-amber-300 font-mono font-medium tabular-nums">{text}</span>;
});

/**
 * One reorderable slot row.
 *
 * The grip is its OWN control rather than the whole row being draggable: the row
 * also opens the activity picker on click, so making the entire surface a drag
 * handle would make that button unreliable.
 */
function SortableSlot({
  id,
  isFocused,
  children,
}: {
  id: number;
  isFocused: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative rounded-xl transition-shadow duration-150 ${
        isDragging ? 'z-10 opacity-80 shadow-lg shadow-black/40' : ''
      } ${isFocused && !isDragging ? 'ring-1 ring-amber-400/50' : ''}`}
    >
      {/* Drag handle — pointer and keyboard operable via dnd-kit's listeners. */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Reorder this slot. Press space to pick up, arrow keys to move, space to drop."
        className={`absolute -left-7 top-1/2 -translate-y-1/2 p-1 rounded-md cursor-grab touch-none transition-colors ${
          isFocused ? 'text-amber-400/80 hover:bg-white/[0.06]' : 'text-zinc-700 hover:text-zinc-400'
        } ${isDragging ? 'cursor-grabbing' : ''}`}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {children}
    </div>
  );
}

/**
 * The shortcut sheet. Opened with `?`, dismissed with `Esc` or `?`.
 * A modal you can only learn by clicking is a modal nobody masters.
 */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '↑ ↓', action: 'Move between slots' },
  { keys: '← →', action: 'Reorder the focused slot' },
  { keys: 'Enter / Space', action: 'Open the activity picker' },
  { keys: 'type letters', action: 'Filter activities' },
  { keys: '1 – 9', action: 'Pick the Nth result' },
  { keys: ', .', action: '−/+ 1 minute' },
  { keys: 'Shift , .', action: '−/+ 5 minutes' },
  { keys: 'Ctrl , .', action: '−/+ 15 minutes' },
  { keys: 'p', action: 'Pin or unpin the slot' },
  { keys: 'a', action: 'Add a slot' },
  { keys: 'Backspace', action: 'Remove the slot' },
  { keys: 'Ctrl Enter', action: 'Save' },
  { keys: 'Esc', action: 'Close the picker, then this dialog' },
  { keys: '?', action: 'Show or hide this list' },
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="mt-4 rounded-xl border border-white/[0.10] bg-black/25 p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <Keyboard className="w-3 h-3" /> Keyboard
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          press ? to hide
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {SHORTCUTS.map((sc) => (
          <div key={sc.keys} className="flex items-baseline gap-2">
            <kbd className="shrink-0 rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-amber-200/90">
              {sc.keys}
            </kbd>
            <span className="truncate text-[11px] text-zinc-500">{sc.action}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function AfkPromptModal({
  allActivities,
  totalDurationSeconds,
  periodStart,
  periodEnd,
  idleStartMs,
  returnMs,
  queueRemaining,
  onConfirm,
  onDismiss,
  onNotAfk,
  defaultNotAfk,
  children,
  adjacentGaps = [],
  onFillGapRequest,
  onBulkFill,
  filledGapStarts = [],
  onGapsDone,
}: {
  allActivities: ExternalActivity[];
  totalDurationSeconds: number;
  periodStart: string;
  periodEnd: string;
  idleStartMs: number | null;
  returnMs: number;
  queueRemaining: number;
  /** Resolves true only when the rows were actually written. */
  onConfirm: (segments: { activityId: string; startedAt: string; endedAt: string }[]) => boolean | Promise<boolean>;
  onDismiss: () => void;
  onNotAfk: () => void;
  defaultNotAfk?: boolean;
  children?: React.ReactNode;
  adjacentGaps?: Array<{ start: string; end: string; durationSeconds: number; relation: 'before' | 'after' }>;
  onFillGapRequest?: (gaps: Array<{ start: Date; end: Date; duration_seconds: number }>) => void;
  /**
   * Write ONE composition across many gaps at once, rescaled to each length.
   * Optional so callers that only want the one-at-a-time flow keep working.
   */
  onBulkFill?: (
    gaps: Array<{ start: string; end: string; duration_seconds: number }>,
    segments: Array<{ activityId: string; minutes: number }>,
  ) => Promise<void>;
  filledGapStarts?: string[];
  onGapsDone?: () => void;
}) {
  const [showSegmentEditor, setShowSegmentEditor] = useState(!defaultNotAfk);
  const segCounter = useRef(1);
  const [segments, setSegments] = useState<Segment[]>(() => [{
    id: segCounter.current,
    activityId: null,
    durationSeconds: totalDurationSeconds,
  }]);
  const [pickingId, setPickingId] = useState<number | null>(null);

  // ── Keyboard-first state ────────────────────────────────────────────────
  // Roving focus: ONE slot is "current" and ↑↓ move between them. A modal
  // where every control is in the tab order means ~6 tab stops per slot, so
  // filling four slots meant ~30 tabs before you could reach Save.
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Type-to-filter for the activity picker. Letters are RESERVED for typing
  // (the shortcut sheet says so), which is why every action is a symbol or a
  // modifier combo instead of a bare letter.
  const [pickerQuery, setPickerQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [bulkPreview, setBulkPreview] = useState(false);
  const [bulkExcluded, setBulkExcluded] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  // Self-heal: if the host handed us no activities, fetch them rather than
  // rendering an empty picker and calling it "no activities yet".
  const [selfFetched, setSelfFetched] = useState<ExternalActivity[]>([]);
  const availableActivities = allActivities.length > 0 ? allActivities : selfFetched;

  /** Resolved list. Declared AFTER availableActivities on purpose: putting it
   *  earlier produced a temporal-dead-zone ReferenceError that esbuild happily
   *  compiled, because it only strips types and never resolves identifiers. */
  const visibleActivities = availableActivities;

  useEffect(() => {
    if (allActivities.length > 0 || selfFetched.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const acts: any[] = (await window.deskflowAPI?.getExternalActivities?.()) || [];
        if (cancelled) return;
        setSelfFetched(acts.filter((a) => a && a.type !== 'sleep'));
      } catch { /* genuinely none available */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActivities.length]);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filteredActivities = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return availableActivities;
    // Subsequence match, so "gym" finds "Gym" and "gymnastics" without needing
    // the exact prefix people rarely type.
    return availableActivities.filter((a) => {
      const n = (a.name || '').toLowerCase();
      let i = 0;
      for (const ch of q) {
        i = n.indexOf(ch, i);
        if (i === -1) return false;
        i += 1;
      }
      return true;
    });
  }, [availableActivities, pickerQuery]);
  const barRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // §7b version stamp. If this line is missing from the console, the bundle is
  // stale and you are looking at the old split logic that lost time on Split.
  console.log(
    '%c[AfkPromptModal] v2.0 unified gap prompt — split lock + no time loss',
    'color: #fbbf24; font-weight: bold',
  );

  const minPerSegment = 60;

  // The elapsed clock ticks once a second. It USED to be state in this component,
  // which meant every second React re-rendered the entire prompt: every segment
  // bar, the dnd-kit context, every framer `layout` element, and the activity
  // picker. One string, whole-tree re-render, 1Hz — that alone was the stutter.
  // It now lives in <Elapsed/>, whose own state is the only thing that updates.
  // Memoised so the surrounding row still does not re-render with it.

  function onDividerMouseDown(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current;
    if (!bar) return;

    // Arrow, not a `function` declaration: a hoisted declaration can be called
    // before the `if (!bar) return` above, so TypeScript conservatively discards
    // the narrowing and reports `bar` as possibly null inside the closure.
    const onMouseMove = (ev: MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));

      setSegments(prev => {
        if (idx >= prev.length - 1) return prev;
        // A locked slot is pinned: dragging its edge would move it, so the drag
        // is refused rather than silently overwriting the lock.
        if (prev[idx]?.locked || prev[idx + 1]?.locked) return prev;
        const sumPrev = prev.slice(0, idx).reduce((s, seg) => s + seg.durationSeconds, 0);
        const pairTotal = prev[idx].durationSeconds + prev[idx + 1].durationSeconds;
        const midRaw = Math.round(pct * totalDurationSeconds - sumPrev);
        const clamped = Math.max(minPerSegment, Math.min(pairTotal - minPerSegment, midRaw));
        return prev.map((seg, i) => {
          if (i === idx) return { ...seg, durationSeconds: clamped };
          if (i === idx + 1) return { ...seg, durationSeconds: pairTotal - clamped };
          return seg;
        });
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Share `totalDurationSeconds` across `count` slots, leaving locked ones alone.
   *
   * Replaces the old `redistributeEven`, which recomputed every slot from
   * scratch and so silently discarded the user's split whenever the number of
   * slots changed. Locked durations are subtracted first and the remainder is
   * divided only among the unlocked slots, so pinning one slot never moves it.
   *
   * Returns `null` when honouring the locks would leave an unlocked slot with
   * less than the 1 minute minimum — i.e. when the split is only possible by
   * breaking a pin. The caller refuses rather than stealing from a locked slot,
   * because "my locked slots do not move" has to be absolute to be worth having.
   *
   * The loop must run `count` times, NOT `current.length`. `addSegment` appends
   * the new slot BEFORE calling us and then maps over that longer array, so a
   * `current.length` result left the appended slot indexing past the end and
   * defaulting to 0 — which silently destroyed one share of the gap every time
   * you pressed Split (a 60m split became 30m + 0m).
   */
  function redistribute(count: number, current: Segment[]): number[] | null {
    if (count === 0) return [];
    const lockedDurations = current.filter(s => s.locked).map(s => s.durationSeconds);
    const unlockedCount = count - lockedDurations.length;
    if (unlockedCount <= 0) {
      return [...lockedDurations, ...Array.from({ length: count - lockedDurations.length }, () => 0)];
    }

    const lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
    const unlockedTotal = totalDurationSeconds - lockedTotal;
    if (unlockedTotal < unlockedCount * minPerSegment) return null;

    const per = Math.floor(unlockedTotal / unlockedCount);
    const rem = unlockedTotal - per * unlockedCount;
    const shares = Array.from({ length: unlockedCount }, (_, i) => per + (i === unlockedCount - 1 ? rem : 0));

    const out: number[] = [];
    let k = 0;
    for (let i = 0; i < count; i++) {
      // `current[i]` is undefined for the slot `addSegment` just appended — it
      // carries no lock, so it correctly falls through to its computed share.
      const seg = current[i];
      out.push(seg?.locked ? lockedDurations.shift()! : shares[k++]);
    }
    return out;
  }

  /** False when every slot is pinned and a new one would have to break a pin. */
  const canSplit = redistribute(segments.length + 1, segments) !== null;

  function setSegmentDuration(id: number, newSeconds: number) {
    setSegments(prev => {
      if (prev.find(s => s.id === id)?.locked) return prev;
      const otherCount = prev.length - 1;
      if (otherCount === 0) {
        return prev.map(s => s.id === id ? { ...s, durationSeconds: newSeconds } : s);
      }
      const maxAllowed = totalDurationSeconds - otherCount * minPerSegment;
      const clamped = Math.max(minPerSegment, Math.min(maxAllowed, Math.round(newSeconds)));
      const remaining = totalDurationSeconds - clamped;
      const perOther = Math.floor(remaining / otherCount);
      const remainder = remaining - perOther * otherCount;
      let remainderAssigned = false;
      return prev.map(s => {
        if (s.id === id) return { ...s, durationSeconds: clamped };
        if (!remainderAssigned) {
          remainderAssigned = true;
          return { ...s, durationSeconds: perOther + remainder };
        }
        return { ...s, durationSeconds: perOther };
      });
    });
  }

  function addSegment() {
    segCounter.current += 1;
    setSegments(prev => {
      const next = [...prev, { id: segCounter.current, activityId: null, durationSeconds: 0 }];
      // Distribute against the PREVIOUS segments: those are the ones carrying the
      // `locked` flags, and the newly appended slot has none.
      const shares = redistribute(next.length, prev);
      // Refuse rather than shorten a pinned slot — see redistribute().
      if (!shares) return prev;
      return next.map((seg, i) => ({ ...seg, durationSeconds: shares[i] ?? 0 }));
    });
  }

  function removeSegment(id: number) {
    setSegments(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) return filtered;
      const shares = redistribute(filtered.length, filtered);
      if (!shares) return prev;
      return filtered.map((s, i) => ({ ...s, durationSeconds: shares[i] ?? s.durationSeconds }));
    });
  }

  /**
   * Reordering is a first-class operation, not a flourish: the slots are laid out
   * in CHRONOLOGICAL order, so moving one changes what the timeline means.
   *
   * This used to live in the separate `GapFillModal`, which meant the
   * consolidation that removed that component silently removed reordering too.
   * dnd-kit is already a dependency (it was left in package.json), so this is
   * the same proven wiring rather than a new one.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSegmentDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSegments((current) => {
      const from = current.findIndex((s) => s.id === active.id);
      const to = current.findIndex((s) => s.id === over.id);
      if (from < 0 || to < 0) return current;
      const next = arrayMove(current, from, to);
      // Follow the slot the user actually moved, so the keyboard focus and the
      // arrow-key shortcuts keep operating on it instead of jumping back.
      setFocusedIndex(to);
      return next;
    });
  }, []);

  const moveFocus = useCallback((delta: number) => {
    setFocusedIndex(prev => {
      const next = Math.max(0, Math.min(segments.length - 1, prev + delta));
      slotRefs.current[next]?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  }, [segments.length]);

  const moveSlot = useCallback((delta: number) => {
    setSegments(prev => {
      const from = focusedIndex;
      const to = from + delta;
      if (to < 0 || to >= prev.length) return prev;
      setFocusedIndex(to);
      return arrayMove(prev, from, to);
    });
  }, [focusedIndex]);

  const openPicker = useCallback(() => {
    const seg = segments[focusedIndex];
    if (!seg) return;
    setPickerQuery('');
    setPickingId(seg.id);
  }, [segments, focusedIndex]);

  const chooseByIndex = useCallback((n: number) => {
    const seg = segments[focusedIndex];
    const target = filteredActivities[n - 1];
    if (!seg || !target) return;
    pickActivity(seg.id, target.id.toString());
    setPickingId(null);
    setPickerQuery('');
  }, [segments, focusedIndex, filteredActivities]);

  /**
   * The whole keyboard model in one place.
   *
   * Letters are RESERVED for typing into the activity filter, so every action is
   * a symbol or a modifier combo — that way a key never means two different
   * things depending on focus, which is the thing that makes shortcut sets
   * impossible to learn.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const typingInField =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (e.key === 'Escape') {
      if (pickingId !== null) { setPickingId(null); setPickerQuery(''); e.stopPropagation(); return; }
      if (showShortcuts) { setShowShortcuts(false); e.stopPropagation(); return; }
      return; // let the modal's own Escape handler close the dialog
    }
    if (typingInField) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleSave(); return; }

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveFocus(-1); return;
      case 'ArrowDown':  e.preventDefault(); moveFocus(1); return;
      case 'ArrowLeft':  e.preventDefault(); moveSlot(-1); return;
      case 'ArrowRight': e.preventDefault(); moveSlot(1); return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (pickingId !== null) chooseByIndex(0); else openPicker();
        return;
      case ',':
      case '.': {
        e.preventDefault();
        const seg = segments[focusedIndex];
        if (!seg) return;
        const step = (e.ctrlKey || e.metaKey) ? 900 : e.shiftKey ? 300 : 60;
        setSegmentDuration(seg.id, seg.durationSeconds + (e.key === ',' ? -step : step));
        return;
      }
      case 'Backspace':
      case 'Delete': {
        e.preventDefault();
        const seg = segments[focusedIndex];
        if (seg) removeSegment(seg.id);
        return;
      }
      case '?':
        e.preventDefault();
        setShowShortcuts(v => !v);
        return;
      default: break;
    }

    // Digits pick straight from the open list; letters filter it.
    if (pickingId !== null && /^[1-9]$/.test(e.key)) { e.preventDefault(); chooseByIndex(Number(e.key)); return; }

    const seg = segments[focusedIndex];
    if (!seg) return;
    if (e.key === 'p') { e.preventDefault(); toggleLock(seg.id); return; }
    if (e.key === 'a') { e.preventDefault(); addSegment(); setFocusedIndex(segments.length); return; }

    if (pickingId !== null && e.key.length === 1 && /\S/.test(e.key)) {
      e.preventDefault();
      setPickerQuery(q => q + e.key.toLowerCase());
    }
  };

  /**
   * Reuse the answer just given for the main gap across every other unfilled
   * gap, rescaled to each one's length.
   *
   * This is the single biggest efficiency win in the whole flow: a morning of
   * coffee breaks, commute and meetings is the SAME shape repeated, and having
   * to re-pick the activities for each one is what made filling a day tedious
   * enough to skip. It existed as "Same composition, scaled to each gap's
   * length" in the standalone GapFillModal and was lost when that component was
   * consolidated into this one.
   *
   * A preview comes first — writing N rows is not something to do on a misclick.
   */
  const buildBulkPlan = useCallback(() => {
    const composition = segments
      .filter((sg) => sg.activityId)
      .map((sg) => ({ activityId: sg.activityId as string, minutes: Math.max(1, Math.round(sg.durationSeconds / 60)) }));
    if (composition.length === 0) return [];
    return adjacentGaps
      .filter((g) => !filledGapStarts.includes(g.start) && !bulkExcluded.includes(g.start))
      .map((g) => {
        const scaled = scaleSegmentsToGap(
          composition.map((c, i) => ({ id: String(i), activityId: c.activityId, minutes: c.minutes })),
          g.durationSeconds,
        );
        return {
          start: g.start,
          end: g.end,
          duration_seconds: g.durationSeconds,
          segments: scaled.map((sc) => ({ activityId: sc.activityId as string, minutes: sc.minutes })),
        };
      });
  }, [segments, adjacentGaps, filledGapStarts, bulkExcluded]);

  const runBulkFill = useCallback(async () => {
    if (!onBulkFill || bulkSaving) return;
    const plan = buildBulkPlan();
    if (plan.length === 0) return;
    setBulkSaving(true);
    try {
      await onBulkFill(
        plan.map((p) => ({ start: p.start, end: p.end, duration_seconds: p.duration_seconds })),
        plan[0].segments,
      );
      setBulkPreview(false);
      onGapsDone?.();
    } finally {
      setBulkSaving(false);
    }
  }, [onBulkFill, buildBulkPlan, bulkSaving, onGapsDone]);

  /** Pin or unpin a slot so redistribution leaves its duration alone. */
  function toggleLock(id: number) {
    setSegments(prev => prev.map(s => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }

  function pickActivity(id: number, activityId: string) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, activityId } : s));
    setPickingId(null);
  }

  async function handleSave() {
    const filled = segments.filter(s => s.activityId);
    if (filled.length === 0) return;
    setIsSaving(true);
    setSaveError(null);

    // Walk the cursor across EVERY segment, not just the filled ones.
    //
    // This used to iterate `filled` only, so leaving the middle segment blank
    // made the third segment inherit the second one's slot: it was written with
    // timestamps overlapping segment one and with segment two's window silently
    // missing from external_sessions. Skipping a middle segment is a normal thing
    // to do ("I was in a meeting for the first half"), so this corrupted the
    // timeline exactly when the user was being selective. The cursor must track
    // wall-clock position regardless of whether a segment gets written.
    const cursor = new Date(periodStart);
    const result: { activityId: string; startedAt: string; endedAt: string }[] = [];
    for (const seg of segments) {
      const segStart = cursor.toISOString();
      cursor.setTime(cursor.getTime() + seg.durationSeconds * 1000);
      if (seg.activityId) {
        result.push({ activityId: seg.activityId, startedAt: segStart, endedAt: cursor.toISOString() });
      }
    }

    const ok = await onConfirm(result);
    setIsSaving(false);
    // Only claim success when the write actually succeeded. `onConfirm` resolves
    // false when the batch insert was rejected — previously the modal showed
    // "Saved" regardless, so a failed write was indistinguishable from a good one
    // and the user reasonably concluded the app had lost their answer.
    if (ok) {
      // The gap has now been re-attributed to the activities the user picked,
      // so the day's unfilled total must stop being counted. Gated on `ok` for
      // the same reason `setSaved` is: resetting after a REJECTED write would
      // discard the very time the user is still trying to account for.
      stopwatch.resetAfterAfkFill();
      setSaved(true);
    } else {
      setSaveError("Couldn't save. Your answer was not recorded — try again.");
    }
  }

  const totalFormatted = formatElapsed(totalDurationSeconds);
  const filledCount = segments.filter(s => s.activityId).length;
  const hasAnyActivity = segments.some(s => s.activityId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-white/[0.10] rounded-xl w-full max-w-3xl max-h-[min(760px,88vh)] overflow-y-auto shadow-2xl shadow-black/50"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Decorative gradient bar removed — single signal hue only */}

        <div className="p-5">
          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 ring-1 ring-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-100 tracking-[-0.01em]">While you were away</h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
                  {idleStartMs ? (
                    <>{formatTime(idleStartMs)} <span className="text-zinc-600">→</span> {formatTime(returnMs)}</>
                  ) : (
                    <><Elapsed periodStart={periodStart} fallback={totalDurationSeconds} /> total</>
                  )}
                  <span className="text-zinc-600 ml-1">({totalFormatted})</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {queueRemaining > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-[11px]"
                >
                  <Activity className="w-3 h-3" />
                  <span>+{queueRemaining}</span>
                </motion.div>
              )}
              <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="mb-5">
            <div
              ref={barRef}
              className="flex h-10 rounded-xl overflow-hidden bg-zinc-800 select-none border border-zinc-700/30"
            >
              {segments.flatMap((seg, i) => {
                const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
                const pct = totalDurationSeconds > 0 ? (seg.durationSeconds / totalDurationSeconds) : 0;
                const elems = [
                  <motion.div
                    key={seg.id}
                    /* No `layout` here. dnd-kit drives reordering with its own
                       transforms, and framer's `layout` re-measures the DOM on every
                       render — so the two fought, and because this component
                       re-rendered 1x/second the bar was measured constantly to
                       animate a delta that never changed. */
                    className="h-full flex items-center justify-center text-[11px] font-medium text-white/80 truncate px-1 transition-colors relative"
                    style={{
                      flex: `${pct} 1 0%`,
                      // Tinted, not solid: the surface shows through so a clash of
                      // user hues cannot turn the bar into confetti.
                      backgroundColor: act ? tintOf(act.color, 0.22) : 'var(--color-card-sunken)',
                      boxShadow: act ? `inset 0 2px 0 0 ${solidOf(act.color, 0.9)}` : undefined,
                    }}
                  >
                    <span className="truncate drop-shadow-sm">{pct > 0.1 ? formatElapsed(seg.durationSeconds) : ''}</span>
                  </motion.div>,
                ];
                if (i < segments.length - 1) {
                  elems.push(
                    <div
                      key={`d${seg.id}`}
                      className="w-[9px] cursor-col-resize shrink-0 flex items-center justify-center hover:bg-white/[0.1] active:bg-white/[0.15] transition-colors group"
                      onMouseDown={e => onDividerMouseDown(i, e)}
                    >
                      <div className="w-px h-6 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors pointer-events-none" />
                    </div>,
                  );
                }
                return elems;
              })}
            </div>
            <div className="relative text-[10px] text-zinc-500 mt-1.5 h-4">
              {(() => {
                const total = totalDurationSeconds;
                const edges: { time: string; pct: number }[] = [];
                edges.push({ time: formatTime(new Date(periodStart).getTime()), pct: 0 });
                let cum = 0;
                for (let i = 0; i < segments.length - 1; i++) {
                  cum += segments[i].durationSeconds;
                  edges.push({ time: formatTime(new Date(new Date(periodStart).getTime() + cum * 1000).getTime()), pct: total > 0 ? (cum / total) * 100 : 0 });
                }
                edges.push({ time: formatTime(new Date(periodEnd).getTime()), pct: 100 });
                return edges.map((e, i) => (
                  <span
                    key={i}
                    className={`absolute font-mono tabular-nums ${i === 0 ? 'text-left' : i === edges.length - 1 ? 'text-right' : 'text-center'}`}
                    style={{ left: `${e.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                  >
                    {e.time}
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* ── Segment Editor ── */}
          {(!defaultNotAfk || showSegmentEditor) && (
            <div className="space-y-2 mb-4">
              <div className="max-h-64 overflow-y-auto space-y-2 pl-7 -ml-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSegmentDragEnd}>
                <SortableContext items={segments.map(sg => sg.id)} strategy={verticalListSortingStrategy}>
                {segments.map((seg, segIndex) => {
                  const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
                  const isPicking = pickingId === seg.id;
                  return (
                    <SortableSlot id={seg.id} isFocused={focusedIndex === segIndex}>
                    <motion.div
                      /* layout removed: see the segment bar above. */
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      ref={(node: HTMLDivElement | null) => { slotRefs.current[segIndex] = node; }}
                      onFocus={() => setFocusedIndex(segIndex)}
                    >
                      {/* A slot is one decision, not five controls side by side.
                          The old row laid [ - 30 min + ] and [ Choose activity ]
                          on one line at equal weight, so the number that people
                          fiddle with competed with the choice they actually came
                          to make. The activity is now the hero; duration and lock
                          sit underneath it as a secondary toolbar. */}
                      <div
                        className={`relative rounded-xl border overflow-hidden transition-colors duration-150 ${
                          seg.locked
                            ? 'bg-amber-500/[0.07] border-amber-500/25'
                            : isPicking
                              ? 'bg-zinc-800/70 border-zinc-600/50'
                              : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border-white/[0.06] hover:border-white/[0.12]'
                        }`}
                      >
                        {/* activity colour rail */}
                        <div
                          className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
                          style={{ backgroundColor: act ? solidOf(act.color, 0.9) : 'transparent', opacity: act ? 1 : 0 }}
                        />

                        {/* ── hero: what were you doing? ── */}
                        <button
                          onClick={() => {
                            setPickingId(isPicking ? null : seg.id);
                            // Never reopen with the previous slot's filter still
                            // applied — that made a populated list look empty.
                            if (!isPicking) setPickerQuery('');
                          }}
                          className="w-full flex items-center gap-3 pl-5 pr-3.5 py-3 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/10"
                            style={{
                              backgroundColor: act ? tintOf(act.color, 0.2) : 'var(--color-card-sunken)',
                              boxShadow: act && needsHairline(act.color)
                                ? `inset 0 0 0 1px ${solidOf(act.color, 0.55)}`
                                : undefined,
                            }}
                          />
                          <span
                            className={`text-sm truncate transition-colors ${
                              act ? 'text-zinc-100 font-medium' : 'text-zinc-500'
                            }`}
                          >
                            {act ? act.name : 'What were you doing?'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 ml-auto shrink-0 text-zinc-600 transition-transform duration-200 group-hover:text-zinc-400 ${
                              isPicking ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* ── secondary: how long, and is it pinned? ── */}
                        <div className="flex items-center gap-1 pl-5 pr-3 pb-2.5">
                          <div className={`flex items-center gap-0.5 ${seg.locked ? 'opacity-40 pointer-events-none' : ''}`}>
                            <button
                              aria-label="Decrease by a minute"
                              onClick={() => setSegmentDuration(seg.id, seg.durationSeconds - 60)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-black/25 light:bg-black/[0.03] border border-white/[0.05]">
                              <input
                                type="text"
                                inputMode="numeric"
                                /* Accepts `45` or `1:30`. Minutes-only meant a
                                   90-minute slot took ninety clicks of `+`. */
                                value={formatDurationField(seg.durationSeconds)}
                                onChange={e => {
                                  const secs = parseDurationField(e.target.value);
                                  if (secs !== null) setSegmentDuration(seg.id, secs);
                                }}
                                onFocus={e => e.currentTarget.select()}
                                aria-label={`Duration of slot ${segIndex + 1}`}
                                className="w-14 text-center text-sm text-zinc-100 font-mono tabular-nums bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                              />
                              <span className="text-[10px] text-zinc-600">min</span>
                            </div>
                            <button
                              aria-label="Increase by a minute"
                              onClick={() => setSegmentDuration(seg.id, seg.durationSeconds + 60)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Pin this slot's duration. Adding or removing a slot
                              redistributes the gap again; a locked slot keeps its
                              length and the rest share out whatever is left. */}
                          <button
                            onClick={() => toggleLock(seg.id)}
                            role="switch"
                            aria-checked={!!seg.locked}
                            className={`ml-1 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              seg.locked
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            {seg.locked ? <Lock size={11} /> : <Unlock size={11} />}
                            {seg.locked ? 'Pinned' : 'Pin'}
                          </button>

                          {segments.length > 1 && (
                            <button
                              onClick={() => removeSegment(seg.id)}
                              aria-label="Remove this slot"
                              className="ml-auto p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline activity picker */}
                      <AnimatePresence>
                        {isPicking && (
                          <motion.div
                            // Opacity + a 4px rise instead of `height: 0 → 'auto'`.
                            // Animating height forces a layout pass on every frame,
                            // which is what made this picker feel like it stuttered;
                            // transform/opacity stay on the compositor.
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <div className="mt-1.5 ml-2 pl-4 border-l-2 border-zinc-700/30">
                              <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/30 max-h-56 overflow-y-auto">
                                {/* Type-to-filter. Focused automatically so the
                                    letters you press go somewhere useful. */}
                                <div className="relative mb-2">
                                  <Search className="pointer-events-none absolute left-2.5 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-zinc-500" />
                                  <input
                                    ref={searchRef}
                                    autoFocus
                                    value={pickerQuery}
                                    onChange={e => setPickerQuery(e.target.value)}
                                    placeholder="Type to filter…  1–9 to pick"
                                    aria-label="Filter activities"
                                    className="w-full rounded-lg border border-white/[0.10] bg-zinc-900/60 py-1.5 pl-8 pr-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40"
                                  />
                                </div>
                                {availableActivities.length === 0 ? (
                                  <div className="flex flex-col items-center py-4 text-zinc-600">
                                    <Activity className="w-8 h-8 mb-2 opacity-40" />
                                    <p className="text-xs">No activities yet</p>
                                    <p className="text-[10px] text-zinc-700">Add them on the External page</p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {filteredActivities.map((act, actIdx) => {
                                      const Icon = ACTIVITY_ICONS[act.icon] || Activity;
                                      return (
                                        <button
                                          key={act.id}
                                          onClick={() => pickActivity(seg.id, act.id.toString())}
                                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
                                            seg.activityId === act.id.toString()
                                              ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
                                              : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                                          }`}
                                        >
                                          {/* Tinted disc with a hairline rather than a solid
                                              blob, so every user-chosen hue stays calm on the
                                              dark surface and remains distinguishable. */}
                                          <span
                                            className="w-3 h-3 rounded-full shrink-0 ring-1 ring-inset"
                                            style={{
                                              backgroundColor: tintOf(act.color, 0.2),
                                              // @ts-expect-error CSS custom property for the ring
                                              '--tw-ring-color': solidOf(act.color, needsHairline(act.color) ? 0.5 : 0.35),
                                            }}
                                          />
                                          <Icon className="w-3 h-3 shrink-0 opacity-60" />
                                          <span className="truncate">{act.name}</span>
                                          {/* The digit that picks it, so the shortcut
                                              is visible instead of folklore. */}
                                          {actIdx < 9 && (
                                            <kbd className="ml-auto shrink-0 rounded border border-white/[0.10] bg-white/[0.04] px-1 font-mono text-[10px] text-zinc-500">
                                              {actIdx + 1}
                                            </kbd>
                                          )}
                                        </button>
                                      );
                                    })}
                                    {filteredActivities.length === 0 && (
                                      <p className="col-span-2 py-4 text-center text-sm text-zinc-600">
                                        Nothing matches &ldquo;{pickerQuery}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    </SortableSlot>
                  );
                })}
                </SortableContext>
                </DndContext>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setShowShortcuts(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Keyboard className="w-3 h-3" />
                  {showShortcuts ? 'hide shortcuts' : 'keyboard shortcuts'}
                  <kbd className="ml-0.5 rounded border border-white/[0.10] bg-white/[0.04] px-1 font-mono text-[10px]">?</kbd>
                </button>
                <span className="text-[10px] text-zinc-700 font-mono">
                  {segments.length} slot{segments.length === 1 ? '' : 's'}
                </span>
              </div>

              <AnimatePresence>
                {showShortcuts && <ShortcutSheet onClose={() => setShowShortcuts(false)} />}
              </AnimatePresence>

              {/* Add segment */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={addSegment}
                disabled={!canSplit}
                aria-disabled={!canSplit}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm border border-dashed transition-colors ${
                  canSplit
                    ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border-zinc-700/40 hover:border-zinc-600/50'
                    : 'text-zinc-600 border-zinc-800/40 cursor-not-allowed'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Split into another activity</span>
              </motion.button>

              {/* Say WHY the split is unavailable rather than letting the button
                  sit there disabled looking broken. Every slot is pinned, so a
                  new one would have to shorten one of them. */}
              {!canSplit && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-300/80 mt-1.5">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Every slot is pinned. Unpin one to split this gap again.</span>
                </p>
              )}
            </div>
          )}

          {/* ── Collapsed disclosure for short AFK ── */}
          {defaultNotAfk && !showSegmentEditor && (
            <button
              onClick={() => setShowSegmentEditor(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors border border-dashed border-zinc-700/30 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Actually, I did something — log it</span>
            </button>
          )}

          {children}

          {/* ── Adjacent Gaps (shown after save) ── */}
          {saved && adjacentGaps.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-1.5 text-amber-400/80 text-[10px] mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Untracked time around your session</span>
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {adjacentGaps.map((g) => {
                  const isFilled = filledGapStarts.includes(g.start);
                  const durMin = Math.round(g.durationSeconds / 60);
                  const h = Math.floor(durMin / 60);
                  const m = durMin % 60;
                  const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                  const s = new Date(g.start);
                  const e = new Date(g.end);
                  const rangeStr = `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                  return (
                    <div key={g.start} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${isFilled ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-zinc-800/40 border border-zinc-700/30'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] ${g.relation === 'before' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {g.relation === 'before' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] text-zinc-300 font-medium">{g.relation === 'before' ? 'Before idle' : 'After return'}</div>
                          <div className="text-[9px] text-zinc-500 font-mono truncate">{rangeStr}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${g.relation === 'before' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{durStr}</span>
                        {isFilled ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400"><Check className="w-3 h-3" /> Filled</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Two routes, because they are genuinely different jobs:
                  "same shape everywhere" when these gaps are the same kind of
                  interruption repeated, and "one at a time" when they are not. */}
              {onBulkFill && adjacentGaps.some(g => !filledGapStarts.includes(g.start)) && (
                <button
                  onClick={() => { setBulkExcluded([]); setBulkPreview(true); }}
                  className="w-full px-3 py-2 rounded-xl text-[12px] font-medium text-amber-200 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                >
                  Apply this to all {adjacentGaps.filter(g => !filledGapStarts.includes(g.start)).length} remaining gaps
                </button>
              )}
              {onFillGapRequest && adjacentGaps.some(g => !filledGapStarts.includes(g.start)) && (
                <button
                  onClick={() => {
                    const unfilled = adjacentGaps
                      .filter(ag => !filledGapStarts.includes(ag.start))
                      .map(ag => ({ start: new Date(ag.start), end: new Date(ag.end), duration_seconds: ag.durationSeconds }));
                    onFillGapRequest?.(unfilled);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-[11px] font-medium text-zinc-400 bg-white/[0.03] border border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.06] transition-colors mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
                >
                  Fill them one at a time instead
                </button>
              )}

              {/* Preview before writing N rows. Each gap can be excluded. */}
              <AnimatePresence>
                {bulkPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-2 rounded-xl border border-white/[0.10] bg-black/25 p-2.5"
                  >
                    <div className="mb-2 text-[11px] text-zinc-400">
                      Scaling your answer to each gap. Untick anything that differs.
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                      {buildBulkPlan().map((p) => {
                        const on = !bulkExcluded.includes(p.start);
                        return (
                          <label
                            key={p.start}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setBulkExcluded(prev =>
                                  on ? [...prev, p.start] : prev.filter(x => x !== p.start),
                                )
                              }
                              className="accent-amber-500"
                            />
                            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                              {new Date(p.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="ml-auto text-[11px] text-zinc-500">
                              {p.segments.map(sc => formatElapsed(sc.minutes * 60)).join(' + ')}
                            </span>
                          </label>
                        );
                      })}
                      {buildBulkPlan().length === 0 && (
                        <p className="py-3 text-center text-[11px] text-zinc-600">
                          Give this gap at least one activity first.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void runBulkFill()}
                        disabled={buildBulkPlan().length === 0 || bulkSaving}
                        className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {bulkSaving ? 'Filling…' : `Fill ${buildBulkPlan().length} gap${buildBulkPlan().length === 1 ? '' : 's'}`}
                      </button>
                      <button
                        onClick={() => setBulkPreview(false)}
                        className="px-3 py-2 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={onGapsDone}
                className="w-full px-3 py-2 rounded-xl text-[11px] font-medium text-zinc-300 bg-zinc-500/10 border border-zinc-700/50 hover:bg-zinc-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
              >
                {adjacentGaps.every(g => filledGapStarts.includes(g.start)) ? 'Done' : 'Skip — fill later'}
              </button>
            </div>
          )}

          {/* ── Action Bar ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 light:focus-visible:ring-offset-[var(--ws-surface-raised)]"
            >
              {queueRemaining > 0 ? `Skip (${queueRemaining} more)` : 'Discard'}
            </button>

            <div className="flex-1" />

            {/* Not AFK */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNotAfk}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                defaultNotAfk

                  ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100'

                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30'
              }`}
            >
              I wasn't AFK
            </motion.button>

            {/* Save */}
            {saved ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-5 py-2 rounded-xl text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Saved
              </motion.div>
            ) : (
              <motion.button
                onClick={handleSave}

                disabled={!hasAnyActivity || isSaving}
                className={`px-5 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
                  hasAnyActivity && !isSaving
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'

                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {isSaving ? 'Saving...' : `Save${filledCount > 0 ? ` (${filledCount})` : ''}`}
              </motion.button>
            )}
            {saveError && (

              <div className='flex items-start gap-2 px-4 pb-3'>

                <AlertCircle className='h-3.5 w-3.5 shrink-0 text-red-400 mt-px' />

                <span className='text-[11px] text-red-300'>{saveError}</span>

              </div>

            )}

          </div>

        </div>

      </motion.div>

    </motion.div>

  );

}
