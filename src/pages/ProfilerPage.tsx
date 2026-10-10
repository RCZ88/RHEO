/**
 * ProfilerPage.tsx — app-wide performance, attributed per page.
 *
 * WHY A PAGE INSTEAD OF A PANEL IN THE PENGUIN CONSOLE: the console's Resources
 * tab already reports host CPU/RSS/GPU and the MAIN-process heap, and this page
 * deliberately does not duplicate it — it points at it. What the console cannot
 * do is attribute cost to a PAGE, because it has no idea which route you were
 * on. That is the gap this fills, and the gap is why it gets its own surface.
 *
 * THE COMPOSITION IS DELIBERATE: no tabs. The scope (WHEN) and the ledger
 * (WHERE) are the same investigation, and putting either behind a tab hides the
 * correlation between them — which is usually the entire answer to "why is it
 * slow?". The page scrolls; the ledger row you select filters the scope above it.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Camera,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  List,
  Play,
  Square,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { SectionHeader } from '../components/SectionHeader'
import { PAGE_MANIFESTS, usePageSurface } from '../pages/registry'
import { getManifest } from '../pages/registry/registry'
import { usePerfControl, usePerfSnapshot } from '../hooks/usePerfProfiler'
import {
  dismissCapture,
  exportCapture,
  loadedCaptureInfo,
  showCapture,
} from '../lib/perfRecorder'
import {
  SCOPE_BUCKET_MS,
  SCOPE_WINDOW_MS,
  bucketTrace,
  validateCapture,
  formatElapsed,
  formatMb,
  formatMs,
  prettifyRoute,
  scopeDomain,
} from '../shared/perfTypes'
import { FrameScope } from '../features/profiler/FrameScope'
import { PageLedger } from '../features/profiler/PageLedger'
import { BlockingTaskList } from '../features/profiler/BlockingTaskList'
import { BlameTable } from '../features/profiler/BlameTable'
import { MemoryTrend } from '../features/profiler/MemoryTrend'
import { SourcesPanel } from '../features/profiler/SourcesPanel'
import { NothingYet, Pill, StatTile, TileSkeleton } from '../features/profiler/primitives'
import profilerManifest from '../pages/registry/pages/profiler'

/**
 * Route id -> human label, resolved through the page registry.
 *
 * The recorder stores whatever `deskflow:route` handed it, which is a route slug
 * like `penguin-console` or `resume/build`. The registry is the ONE place that
 * knows a page's real name, so this looks it up rather than prettifying the slug
 * itself — a second naming authority is exactly what the registry was built to
 * prevent. `prettifyRoute` is only the fallback for ids the registry does not
 * know (e.g. `agentic`, which has no manifest yet).
 */
function useRouteLabels(): (route: string | null) => string {
  return useCallback((route: string | null): string => {
    if (!route) return 'App chrome'
    try {
      const manifest = getManifest(route)
      if (manifest?.label) return manifest.label
    } catch {
      /* registry miss — fall through to the slug prettifier */
    }
    return prettifyRoute(route)
  }, [])
}

export default function ProfilerPage() {
  usePageSurface(profilerManifest)
  const snap = usePerfSnapshot()
  const { armed, toggle, clear } = usePerfControl()
  const routeLabels = useRouteLabels()
  const [filterRoute, setFilterRoute] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const loaded = loadedCaptureInfo()

  /**
   * SAVE → a JSON file, not a database row.
   *
   * A performance problem is not reproducible on demand, so the finding has to
   * leave the app: this is the artefact you attach to a bug report. A DB table
   * would also mean a migration, a schema and a retention policy (AGENTS.md §0.5)
   * for data that is large, transient and not queried relationally.
   */
  const onSave = useCallback(() => {
    const capture = exportCapture()
    if (!capture.longTasks.length && !capture.trace.length) return
    const blob = new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rheo-perf-${capture.capturedAtIso.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoking immediately can cancel the download in some Chromium builds.
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [])

  /**
   * LOAD → parse, VALIDATE, then show.
   *
   * `validateCapture` is the security boundary: it rejects anything malformed
   * and clamps array sizes, so a hostile or corrupt file cannot hang the tab. It
   * also REBUILDS the derived numbers from the file's own contents, so a
   * hand-edited capture cannot claim to be clean while its own task list says
   * otherwise.
   */
  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setLoadError(null)
    const reader = new FileReader()
    reader.onerror = () => setLoadError('That file could not be read. Check it is a .json capture from RHEO.')
    reader.onload = () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(reader.result))
      } catch {
        setLoadError('That file is not valid JSON, so it is not a capture.')
        return
      }
      const capture = validateCapture(parsed)
      if (!capture) {
        setLoadError('That capture is not readable by this build — it may be truncated, hand-edited, or from a newer version.')
        return
      }
      showCapture(capture)
    }
    reader.readAsText(file)
  }, [])

  /**
   * THE FULL INVENTORY of routes, so the ledger can say what it did NOT measure.
   *
   * The profiler attributes cost by wall-clock observation, so it can only rank
   * pages it actually watched — which is correct and cannot be faked. But
   * showing ONLY those rows made "4 pages" read as a broken ledger rather than
   * as "4 of 40 measured". Absence was indistinguishable from a bug, so the
   * unmeasured remainder is now enumerable behind a disclosure.
   *
   * Sourced from the SAME barrel import this page already uses for
   * `usePageSurface`, so it adds no new module edge. That matters: reaching into
   * the registry from a DIFFERENT module (`labRegistry.ts`) is what produced a
   * `ReferenceError: PAGE_MANIFESTS is not defined` in the shipped bundle.
   *
   * Hidden manifests and command rows are excluded — they are not destinations a
   * user can navigate to, so listing them would pad the count with pages that
   * can never be visited.
   */
  const knownRoutes = useMemo(
    () =>
      PAGE_MANIFESTS.filter((p) => !p.hidden && !p.event).map((p) => ({
        id: p.id,
        label: p.label,
      })),
    [],
  )

  const buckets = useMemo(
    () =>
      bucketTrace({
        trace: snap.trace,
        windowMs: SCOPE_WINDOW_MS,
        bucketMs: SCOPE_BUCKET_MS,
        sessionMs: Math.max(SCOPE_WINDOW_MS, snap.sessionMs),
      }),
    [snap.trace, snap.sessionMs],
  )

  const domain = useMemo(() => scopeDomain(buckets), [buckets])
  const hasAnyData = snap.longTaskCount > 0 || snap.frameMedianMs > 0
  const verdictTone =
    snap.verdict.state === 'lagging'
      ? 'bad'
      : snap.verdict.state === 'busy'
        ? 'warn'
        : snap.verdict.state === 'smooth'
          ? 'good'
          : 'neutral'

  // Host CPU is the newest `host` sample; the recorder keeps them in the trace
  // rather than holding a separate mutable field, so there is exactly one place
  // a host number can come from.
  const hostCpu = useMemo(() => {
    for (let i = snap.trace.length - 1; i >= 0; i--) {
      const s = snap.trace[i]
      if (s.source === 'host') return s.value
    }
    return null
  }, [snap.trace])

  const worstIpc = useMemo(() => {
    const vals = snap.ledger.map((r) => r.ipcMedianMs).filter((v): v is number => v != null)
    if (!vals.length) return null
    return vals.reduce((a, b) => Math.max(a, b), 0)
  }, [snap.ledger])

  return (
    // FULL WIDTH, NO CAP. The chain above already stretches to the window:
    //   div.flex.flex-1.relative → Sidebar(fixed) + div.flex-1.overflow-hidden
    //   → div[data-page-root].flex-1.overflow-auto → stretch (cross axis)
    // so `w-full` here fills it exactly.
    //
    // Two earlier revisions are the reason this comment exists. `max-w-[1400px]`
    // with no `mx-auto` pinned the content to the LEFT and left a dead black
    // gutter on the right, which is visually identical to the UI being clipped —
    // hence "the right side is cut off". Adding `mx-auto` then made the gutters
    // symmetric, which satisfied "centered" but not "make it centered": both
    // sides went black and the ledger still had dead space beside it.
    //
    // The cap was the problem in both attempts. A profiler is the one page in
    // this app whose content is genuinely wide — a 9-column ledger and a
    // full-bleed time axis — so it should use whatever width it is given, which
    // is also what DatabasePage, LabsPage and SettingsPage do (none of them cap).
    // `min-w-0` is the only part that is load-bearing: it lets this flex item
    // shrink below its content's intrinsic min-content width, which is what stops
    // the table from forcing horizontal overflow. The rest of the shrink chain is
    // panels `min-w-0 max-w-full`, grid `[&>*]:min-w-0`, and the table scroller
    // `min-w-0 max-w-full overflow-x-auto`.
    <PageShell page="profiler" className="w-full min-w-0">
      {/* ── Masthead: the one control that matters, plus what is being measured ── */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--color-foreground)]">
              <Gauge size={17} aria-hidden className="text-[var(--page-accent)]" />
              Performance
            </h1>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--color-muted-foreground)]">
              Frame time, blocking tasks, renderer heap and per-page cost — measured with the platform&rsquo;s
              own instruments, and tagged with the layer each number came from.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-pressed={armed}
              disabled={!!loaded}
              title={loaded ? 'Dismiss the loaded capture to measure live again' : undefined}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
                armed
                  ? 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--page-accent)]'
                  : 'bg-[var(--page-accent)] text-white hover:opacity-90'
              }`}
            >
              {armed ? <Square size={13} aria-hidden /> : <Play size={13} aria-hidden />}
              {armed ? 'Stop measuring' : 'Start measuring'}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!hasAnyData}
              title={hasAnyData ? 'Download this measurement as a JSON capture' : 'Nothing collected yet'}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--page-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={13} aria-hidden />
              Save
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--page-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
            >
              <Upload size={13} aria-hidden />
              Load
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onFile}
              className="sr-only"
              aria-label="Load a saved performance capture"
            />
            <button
              type="button"
              onClick={clear}
              disabled={!hasAnyData}
              title={hasAnyData ? 'Discard collected samples and start fresh' : 'Nothing collected yet'}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-muted-foreground)]"
            >
              <Trash2 size={13} aria-hidden />
              Clear
            </button>
          </div>
        </div>

        {/* A LOADED CAPTURE IS NEVER MISTAKABLE FOR LIVE DATA. If this banner is
            showing, every number below came from a file, not from this moment.
            That distinction is the whole feature: a performance problem is not
            reproducible on demand, so you read yesterday's capture — and reading
            it must not be mistaken for watching the app now. */}
        {loaded ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[color-mix(in_oklch,var(--color-amber-400)_40%,transparent)] bg-[var(--color-card)] px-3 py-2">
            <Pill tone="warn">loaded from file</Pill>
            <span className="text-[11px] leading-relaxed text-[var(--color-foreground)]">
              Showing a saved capture taken {new Date(loaded.capturedAtIso).toLocaleString()} —{' '}
              {formatElapsed(loaded.durationMs)} of recorded activity, {loaded.longTasks.length} blocking tasks.
              This is <span className="text-[var(--color-amber-400)]">not</span> a live measurement.
            </span>
            <button
              type="button"
              onClick={dismissCapture}
              className="ml-auto inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--page-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
            >
              back to live
            </button>
          </div>
        ) : null}

        {loadError ? (
          <p className="rounded-lg border border-[color-mix(in_oklch,var(--color-destructive)_40%,transparent)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-destructive)]">
            {loadError}
          </p>
        ) : null}

        {/* Why the button exists at all. A profiler that measures by default taxes
            the app it is measuring, which would invent the lag it reports. */}
        {!armed && !loaded ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
            Measuring is <span className="text-[var(--color-foreground)]">off by default</span>. Frame
            sampling runs a callback on every frame, so a profiler left on permanently would slow the app
            and then report the slowdown as real. Arm it, use the app normally, and come back.
          </p>
        ) : null}
      </header>

      {/* ── Vitals ── */}
      <section data-section="profiler.vitals" aria-labelledby="pf-vitals">
        <SectionHeader
          title="Vitals"
          icon={<Activity size={15} aria-hidden />}
          action={
            /* The measuring duration is shown whether or not the recorder is
               running. It is the number you check before saving, and it used to
               vanish on Stop — which is exactly when you want to read it. It
               freezes the instant you stop and sums correctly across repeated
               arm/disarm cycles, because `armedMs` is banked rather than
               recomputed from a `armedSince` that was never cleared. */
            <span className="flex items-center gap-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {armed ? (
                <>
                  <span className="inline-flex items-center gap-1 text-[var(--color-foreground)]">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)] motion-safe:animate-pulse"
                    />
                    measuring {formatElapsed(snap.armedMs)}
                  </span>
                </>
              ) : snap.armedMs > 0 ? (
                <span>last run {formatElapsed(snap.armedMs)}</span>
              ) : (
                <span>not measuring</span>
              )}
            </span>
          }
        />
        <div id="pf-vitals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
          {/* Blocking share leads, and is twice as wide, because it is the number
              that actually answers "is it laggy". FPS is demoted to a tile: "57fps"
              is unreadable without knowing the budget, whereas "4% of wall-clock
              blocked" is the user's own complaint, quantified. */}
          <StatTile
            span
            icon={<AlertTriangle size={15} aria-hidden />}
            label="Time blocked"
            value={hasAnyData ? `${snap.blockingPct}` : '—'}
            unit={hasAnyData ? '%' : undefined}
            layer="longtask"
            tone={verdictTone}
            detail={
              <>
                <span className="block text-[12px] text-[var(--color-foreground)]">{snap.verdict.label}</span>
                {snap.verdict.because}
              </>
            }
          />
          <StatTile
            icon={<Camera size={15} aria-hidden />}
            label="Frames"
            value={snap.frameMedianMs ? `${snap.fps}` : '—'}
            unit={snap.frameMedianMs ? 'fps' : undefined}
            layer="frame"
            tone={snap.droppedFramePct >= 25 ? 'warn' : 'neutral'}
            detail={
              snap.frameMedianMs
                ? `${formatMs(snap.frameMedianMs)} median · ${snap.droppedFramePct}% over budget`
                : 'Sampling is off'
            }
          />
          <StatTile
            icon={<HardDrive size={15} aria-hidden />}
            label="Renderer heap"
            value={snap.heapUsedMB != null ? `${snap.heapUsedMB}` : '—'}
            unit={snap.heapUsedMB != null ? 'MB' : undefined}
            layer="memory"
            tone={snap.heapSlopeMBPerMin >= 4 ? 'warn' : 'neutral'}
            detail={
              snap.heapUsedMB != null
                ? `${formatMb(snap.heapLimitMB)} ceiling · growing ${snap.heapSlopeMBPerMin > 0 ? '+' : ''}${snap.heapSlopeMBPerMin} MB/min`
                : 'Not exposed in this build'
            }
          />
          <StatTile
            icon={<Cpu size={15} aria-hidden />}
            label="Host"
            value={hostCpu != null ? `${hostCpu}` : '—'}
            unit={hostCpu != null ? '% cpu' : undefined}
            layer="host"
            detail={
              <>
                Main process. Full breakdown in{' '}
                <span className="text-[var(--color-foreground)]">Penguin Console → Resources</span>.
              </>
            }
          />
        </div>
      </section>

      {/* ── The scope ── */}
      <section data-section="profiler.trace" aria-labelledby="pf-trace">
        <SectionHeader
          title="Frame trace"
          icon={<Activity size={15} aria-hidden />}
          action={
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              last {Math.round(SCOPE_WINDOW_MS / 1000)}s · 0–{domain[1]}ms
            </span>
          }
        />
        <div id="pf-trace" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          {!armed && !hasAnyData ? (
            <NothingYet
              title="Nothing measured yet"
              because="Start measuring, then use the app. Blocking tasks appear as amber bars the moment the main thread is held for more than 50ms, which is where you can see whether a stutter came from navigation or from the page you were already on."
              action={
                <button
                  type="button"
                  onClick={toggle}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--page-accent)] px-4 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                >
                  <Play size={13} aria-hidden />
                  Start measuring
                </button>
              }
            />
          ) : (
            <FrameScope
              buckets={buckets}
              sessionMs={snap.sessionMs}
              routeLabels={routeLabels}
              filterRoute={filterRoute}
            />
          )}
        </div>
      </section>

      {/* ── The ledger: the feature this page exists for ── */}
      <section data-section="profiler.ledger" aria-labelledby="pf-ledger">
        <SectionHeader
          title="Page ledger"
          icon={<List size={15} aria-hidden />}
          action={
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {snap.routesSeen} routes seen
            </span>
          }
        />
        <div id="pf-ledger" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          {armed && snap.routesSeen === 0 && knownRoutes.length === 0 ? (
            <TileSkeleton count={4} />
          ) : (
            <PageLedger
              rows={snap.ledger}
              routeLabels={routeLabels}
              filterRoute={filterRoute}
              onSelect={setFilterRoute}
              knownRoutes={knownRoutes}
            />
          )}
        </div>
      </section>

      {/* ── Individual tasks ── */}
      <section data-section="profiler.tasks" aria-labelledby="pf-tasks">
        <SectionHeader
          title="Blocking tasks"
          icon={<AlertTriangle size={15} aria-hidden />}
          action={
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {snap.longTaskCount} total · {formatMs(snap.worstMs)} worst
            </span>
          }
        />
        <div id="pf-tasks" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <BlockingTaskList
            tasks={snap.longTasks}
            marks={snap.marks}
            errors={snap.errors}
            routeLabels={routeLabels}
          />
        </div>
      </section>

      {/* ── Where the time went: the debugging answer ── */}
      <section data-section="profiler.blame" aria-labelledby="pf-blame">
        <SectionHeader
          title="Where the time went"
          icon={<Wrench size={15} aria-hidden />}
          action={
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {snap.marks.length} operations timed
            </span>
          }
        />
        <div id="pf-blame" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <BlameTable marks={snap.marks} tasks={snap.longTasks} />
        </div>
      </section>

      {/* ── Memory ── */}
      <section data-section="profiler.memory" aria-labelledby="pf-memory">
        <SectionHeader
          title="Memory"
          icon={<HardDrive size={15} aria-hidden />}
          action={
            worstIpc != null ? (
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                worst page IPC {formatMs(worstIpc)}
              </span>
            ) : null
          }
        />
        <div id="pf-memory" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <MemoryTrend
            trace={snap.trace}
            heapUsedMB={snap.heapUsedMB}
            heapLimitMB={snap.heapLimitMB}
            slope={snap.heapSlopeMBPerMin}
          />
        </div>
      </section>

      {/* ── Provenance ── */}
      <section data-section="profiler.sources" aria-labelledby="pf-sources">
        <SectionHeader title="Sources" icon={<Activity size={15} aria-hidden />} />
        <div id="pf-sources" className="min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <SourcesPanel capabilities={snap.capabilities} />
        </div>
      </section>
    </PageShell>
  )
}