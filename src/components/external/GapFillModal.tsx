import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Clock,
  GripVertical,
  Monitor,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ExternalActivity, ExternalSession } from "@/types/external";
import {
  createId,
  scaleSegmentsToGap,
  suggestGapActivities,
  type Gap,
  type GapSegment,
} from "@/lib/external/gaps";

const MIN_SEGMENT_SECONDS = 60;

interface InternalSegment {
  id: string;
  activityId: string | null;
  durationSeconds: number;
}

function SortableSegmentRow({
  id,
  canDrag,
  children,
}: {
  id: string;
  canDrag: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10" : ""}
    >
      <div
        className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 ${
          isDragging ? "opacity-70 ring-1 ring-amber-500/40" : ""
        }`}
      >
        {canDrag && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }
  return `${minutes}m`;
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

function redistributeEven(total: number, count: number): number[] {
  if (count === 0) return [];
  const per = Math.floor(total / count);
  const rem = total - per * count;
  return Array.from({ length: count }, (_, i) => per + (i === count - 1 ? rem : 0));
}

export function GapFillModal({
  open,
  gap,
  multiGaps,
  activities,
  sessions,
  onClose,
  onFillGap,
  zClass = "z-50",
}: {
  open: boolean;
  gap: Gap | null;
  multiGaps?: Gap[];
  activities: ExternalActivity[];
  sessions: ExternalSession[];
  onClose: () => void;
  onFillGap: (gap: Gap, segments: GapSegment[]) => Promise<void>;
  zClass?: string;
}) {
  const [segments, setSegments] = useState<InternalSegment[]>([]);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fillProgress, setFillProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedGaps, setFailedGaps] = useState<Gap[]>([]);
  const segCounter = useRef(1);

  const referenceGap = gap ?? multiGaps?.[0] ?? null;
  const multiCount = multiGaps?.length ?? 0;
  const isMulti = !gap && multiCount > 0;
  const gapSeconds = referenceGap ? referenceGap.duration_seconds : 0;

  const pickableActivities = useMemo(() => {
    return activities.filter((activity) => activity.type !== "sleep");
  }, [activities]);

  const suggestions = useMemo(() => {
    if (!referenceGap) return [];
    return suggestGapActivities(referenceGap, sessions, activities, 4);
  }, [referenceGap, sessions, activities]);

  useEffect(() => {
    if (!referenceGap) return;
    const initial: InternalSegment = {
      id: createId("segment"),
      activityId: suggestions[0]?.id != null ? String(suggestions[0].id) : null,
      durationSeconds: referenceGap.duration_seconds,
    };
    segCounter.current += 1;
    setSegments([initial]);
    setPickingFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceGap]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const getActivity = useCallback(
    (id: string | null): ExternalActivity | undefined => {
      if (!id) return undefined;
      return pickableActivities.find((activity) => String(activity.id) === id);
    },
    [pickableActivities]
  );

  const setSegmentDuration = useCallback((segId: string, newSeconds: number) => {
    setSegments((current) => {
      const otherCount = current.length - 1;
      if (otherCount === 0) {
        return current.map((segment) =>
          segment.id === segId
            ? { ...segment, durationSeconds: Math.max(MIN_SEGMENT_SECONDS, Math.round(newSeconds)) }
            : segment
        );
      }
      const maxAllowed = gapSeconds - otherCount * MIN_SEGMENT_SECONDS;
      const clamped = Math.max(MIN_SEGMENT_SECONDS, Math.min(maxAllowed, Math.round(newSeconds)));
      const remaining = gapSeconds - clamped;
      const perOther = Math.floor(remaining / otherCount);
      const remainder = remaining - perOther * otherCount;
      let remainderAssigned = false;
      return current.map((segment) => {
        if (segment.id === segId) return { ...segment, durationSeconds: clamped };
        if (!remainderAssigned) {
          remainderAssigned = true;
          return { ...segment, durationSeconds: perOther + remainder };
        }
        return { ...segment, durationSeconds: perOther };
      });
    });
  }, [gapSeconds]);

  const addSegment = useCallback(() => {
    segCounter.current += 1;
    setSegments((current) => {
      const counts = redistributeEven(gapSeconds, current.length + 1);
      return [
        ...current,
        { id: createId("segment"), activityId: null, durationSeconds: 0 },
      ].map((segment, index) => ({ ...segment, durationSeconds: counts[index] }));
    });
  }, [gapSeconds]);

  const removeSegment = useCallback((segId: string) => {
    setSegments((current) => {
      const filtered = current.filter((segment) => segment.id !== segId);
      if (filtered.length === 0) return current;
      const counts = redistributeEven(gapSeconds, filtered.length);
      return filtered.map((segment, index) => ({ ...segment, durationSeconds: counts[index] }));
    });
    setPickingFor((prev) => (prev === segId ? null : prev));
  }, [gapSeconds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSegmentDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSegments((current) => {
      const oldIndex = current.findIndex((segment) => segment.id === String(active.id));
      const newIndex = current.findIndex((segment) => segment.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, []);

  const pickActivity = useCallback((segId: string, activity: ExternalActivity) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === segId ? { ...segment, activityId: String(activity.id) } : segment
      )
    );
    setPickingFor(null);
  }, []);

  const autoFill = useCallback(() => {
    if (!suggestions.length) return;
    let suggestionIndex = 0;
    setSegments((current) =>
      current.map((segment) => {
        if (segment.activityId) return segment;
        const activity = suggestions[suggestionIndex % suggestions.length];
        suggestionIndex += 1;
        return { ...segment, activityId: String(activity.id) };
      })
    );
  }, [suggestions]);

  const onDividerMouseDown = useCallback(
    (segIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const bar = document.getElementById("gap-timeline-bar");
      if (!bar) return;

      function onMouseMove(ev: MouseEvent) {
        const rect = bar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        setSegments((current) => {
          if (segIndex >= current.length - 1) return current;
          const sumPrev = current
            .slice(0, segIndex)
            .reduce((sum, segment) => sum + segment.durationSeconds, 0);
          const pairTotal =
            current[segIndex].durationSeconds + current[segIndex + 1].durationSeconds;
          const midRaw = Math.round(pct * gapSeconds - sumPrev);
          const clamped = Math.max(
            MIN_SEGMENT_SECONDS,
            Math.min(pairTotal - MIN_SEGMENT_SECONDS, midRaw)
          );
          return current.map((segment, index) => {
            if (index === segIndex) return { ...segment, durationSeconds: clamped };
            if (index === segIndex + 1) {
              return { ...segment, durationSeconds: pairTotal - clamped };
            }
            return segment;
          });
        });
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [gapSeconds]
  );

  const filledCount = segments.filter((segment) => segment.activityId).length;

  const submit = async () => {
    if (!referenceGap || saving || filledCount === 0) return;

    const allTargets = isMulti && multiGaps ? multiGaps : [referenceGap];
    const targets = failedGaps.length > 0 ? failedGaps : allTargets;

    const payload: GapSegment[] = segments.map((segment) => ({
      id: segment.id,
      activityId: segment.activityId,
      minutes: Math.max(1, Math.round(segment.durationSeconds / 60)),
    }));

    setSaving(true);
    setFillProgress({ done: 0, total: targets.length });

    const nextFailed: Gap[] = [];

    for (let i = 0; i < targets.length; i += 1) {
      try {
        const scaled = isMulti
          ? scaleSegmentsToGap(payload, targets[i].duration_seconds)
          : payload;
        await onFillGap(targets[i], scaled);
        setFillProgress({ done: i + 1, total: targets.length });
      } catch {
        nextFailed.push(targets[i]);
      }
    }

    setSaving(false);
    setFillProgress(null);
    setFailedGaps(nextFailed);

    if (nextFailed.length > 0) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {open && referenceGap && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/70 backdrop-blur-sm p-4`}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
            className="flex w-full max-w-2xl max-h-[min(700px,85vh)] flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-amber-500/40 via-emerald-500/40 to-amber-500/40" />

            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    {isMulti ? `Fill ${multiCount} Gaps` : "Fill Gap"}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {isMulti
                      ? `${multiCount} gaps • ${formatMinutes(Math.round(multiGaps!.reduce((sum, g) => sum + g.duration_seconds, 0) / 60))} untracked total`
                      : `${formatTime(referenceGap.start)} – ${formatTime(referenceGap.end)} • ${formatMinutes(Math.round(gapSeconds / 60))} untracked`}
                  </p>
                  {isMulti && (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                      <Sparkles className="h-3 w-3" />
                      Same composition, scaled to each gap's length
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Auto-fill all segments */}
            <div className="px-5 pb-3 shrink-0">
              <button
                onClick={autoFill}
                disabled={!suggestions.length || filledCount === segments.length}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-600/20 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                Auto-fill activities
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {/* Timeline bar with draggable dividers */}
              <div className="mb-2">
                <div
                  id="gap-timeline-bar"
                  className="flex h-7 select-none overflow-hidden rounded-lg bg-white/[0.04]"
                >
                  {segments.flatMap((segment, index) => {
                    const activity = getActivity(segment.activityId);
                    const pct =
                      gapSeconds > 0 ? segment.durationSeconds / gapSeconds : 0;
                    const elements = [
                      <div
                        key={segment.id}
                        className="flex h-full items-center justify-center truncate px-1 text-[10px] font-medium text-white/80 transition-colors"
                        style={{
                          flex: `${pct} 1 0%`,
                          backgroundColor: activity?.color || (segment.activityId ? "#6366f1" : "#52525b"),
                        }}
                      >
                        <span className="truncate">
                          {pct > 0.1 ? formatElapsed(segment.durationSeconds) : ""}
                        </span>
                      </div>,
                    ];
                    if (index < segments.length - 1) {
                      elements.push(
                        <div
                          key={`d${segment.id}`}
                          className="flex w-[7px] shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-white/[0.07] active:bg-white/[0.12]"
                          onMouseDown={(e) => onDividerMouseDown(index, e)}
                        >
                          <div className="pointer-events-none h-4 w-px rounded-full bg-white/25" />
                        </div>
                      );
                    }
                    return elements;
                  })}
                </div>
                {/* Edge times */}
                <div className="relative mt-1 h-3 text-[10px] text-zinc-500">
                  {(() => {
                    if (!referenceGap) return null;
                    const gapStart = new Date(referenceGap.start).getTime();
                    const edges: { time: string; pct: number }[] = [
                      { time: formatTime(referenceGap.start), pct: 0 },
                    ];
                    let cumulative = 0;
                    for (let i = 0; i < segments.length - 1; i++) {
                      cumulative += segments[i].durationSeconds;
                      edges.push({
                        time: formatTime(new Date(gapStart + cumulative * 1000)),
                        pct: gapSeconds > 0 ? (cumulative / gapSeconds) * 100 : 0,
                      });
                    }
                    edges.push({ time: formatTime(referenceGap.end), pct: 100 });
                    return edges.map((edge, i) => (
                      <span
                        key={i}
                        className={`absolute ${i === 0 ? "text-left" : i === edges.length - 1 ? "text-right" : "text-center"}`}
                        style={{
                          left: `${edge.pct}%`,
                          transform: "translateX(-50%)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {edge.time}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Segments */}
              <div className="space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSegmentDragEnd}
                >
                  <SortableContext
                    items={segments.map((segment) => segment.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {segments.map((segment) => {
                      const activity = getActivity(segment.activityId);
                      const isPicking = pickingFor === segment.id;
                      return (
                        <div key={segment.id}>
                          <SortableSegmentRow id={segment.id} canDrag={segments.length > 1}>
                            {/* Duration control */}
                            <div className="flex w-[5.5rem] shrink-0 items-center gap-1">
                              <button
                                onClick={() => setSegmentDuration(segment.id, segment.durationSeconds - 60)}
                                className="rounded p-0.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                                aria-label="Decrease duration"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={Math.floor(gapSeconds / 60)}
                                value={Math.round(segment.durationSeconds / 60)}
                                onChange={(e) => {
                                  const mins = parseInt(e.target.value) || 1;
                                  setSegmentDuration(segment.id, mins * 60);
                                }}
                                className="w-12 rounded border border-white/10 bg-transparent px-1 py-0.5 text-center font-mono text-[11px] tabular-nums text-zinc-400 focus:border-zinc-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <span className="w-5 text-[10px] text-zinc-600">min</span>
                              <button
                                onClick={() => setSegmentDuration(segment.id, segment.durationSeconds + 60)}
                                className="rounded p-0.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                                aria-label="Increase duration"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Activity picker button */}
                            <button
                              onClick={() => setPickingFor(isPicking ? null : segment.id)}
                              className="flex flex-1 items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left transition hover:bg-white/[0.08]"
                            >
                              <div
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: activity?.color || "#52525b" }}
                              />
                              <span className={`truncate text-xs ${activity ? "text-zinc-200" : "italic text-zinc-500"}`}>
                                {activity ? activity.name : "Choose activity"}
                              </span>
                            </button>

                            {segments.length > 1 && (
                              <button
                                onClick={() => removeSegment(segment.id)}
                                className="shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                                aria-label="Remove segment"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </SortableSegmentRow>

                          {/* Inline activity picker */}
                          {isPicking && (
                            <ActivityPickerGrid
                              activities={pickableActivities}
                              currentId={segment.activityId}
                              onPick={(activity) => pickActivity(segment.id, activity)}
                              onClose={() => setPickingFor(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </SortableContext>
                </DndContext>

                {/* Split time */}
                <button
                  onClick={addSegment}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Split time</span>
                </button>
              </div>

              {/* Used / remaining */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
                Used: {formatMinutes(Math.round(segments.reduce((sum, s) => sum + s.durationSeconds, 0) / 60))} / Total: {formatMinutes(Math.round(gapSeconds / 60))}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="shrink-0 space-y-2 border-t border-white/10 px-5 py-3">
              {failedGaps.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                  Couldn't fill {failedGaps.length === 1 ? "this gap" : `these gaps`}:{" "}
                  {failedGaps.map((g) => formatTime(g.start)).join(", ")}. The rest were
                  filled — retry to fill the remaining.
                </div>
              )}
              <button
                onClick={submit}
                disabled={filledCount === 0 || saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Check className="h-4 w-4" />
                    {isMulti && fillProgress
                      ? `Filling ${fillProgress.done}/${fillProgress.total}…`
                      : "Filling…"}
                  </>
                ) : isMulti ? (
                  <>
                    <Check className="h-4 w-4" />
                    Fill {failedGaps.length || multiCount}{" "}
                    {failedGaps.length === 1 ? "gap" : "gaps"}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Fill {filledCount} {filledCount === 1 ? "segment" : "segments"}
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-xl px-4 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-400"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActivityPickerGrid({
  activities,
  currentId,
  onPick,
  onClose,
}: {
  activities: ExternalActivity[];
  currentId: string | null;
  onPick: (activity: ExternalActivity) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const lq = query.toLowerCase();

  const filtered = activities.filter((activity) =>
    activity.name.toLowerCase().includes(lq)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mt-1.5 border-l-2 border-white/10 pl-3 ml-16"
    >
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activities…"
            className="w-full rounded-lg border border-white/10 bg-zinc-900/60 py-1.5 pl-8 pr-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
            autoFocus
          />
        </div>

        {filtered.length > 0 && (
          <>
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <Monitor className="h-3 w-3 text-indigo-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Activities</span>
            </div>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
              {filtered.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => onPick(activity)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    currentId === String(activity.id)
                      ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                  }`}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: activity.color }}
                  />
                  <span className="truncate">{activity.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <p className="py-3 text-center text-xs text-zinc-600">No matching activities</p>
        )}

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg py-1 text-[10px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          Close picker
        </button>
      </div>
    </motion.div>
  );
}
