import type { PageManifest } from '../types'

/**
 * /profiler — app-wide performance measurement, attributed per page.
 *
 * This page exists because the app had NO renderer instrumentation at all:
 * `PerformanceObserver` appeared zero times across `src/`, so "the app feels
 * laggy" had no number attached to it anywhere. What existed was
 * `console:metrics` — host CPU/RSS/GPU and the MAIN-process heap — plus a
 * single FPS counter scoped to one 3D component in `OrbitControls.tsx`.
 *
 * Three deliberate constraints on this manifest:
 *
 * 1. NO TAB. An earlier draft had `tabs` for Overview/Timeline/Ledger. Tabs hide
 *    the comparison: the whole value of a per-page profiler is that the ledger
 *    sits UNDER the live trace, so you can watch a page get slow and see which
 *    row it landed on. Tabs would have destroyed the only correlation the page
 *    is built around.
 * 2. Every `sections` id below has a real `data-section` in `ProfilerPage.tsx`.
 *    Both halves are required — `npm run validate:pages` fails if only one
 *    exists, which is the point: 12 of the old palette's anchors pointed at
 *    `data-section` values no component ever wrote.
 * 3. No sidebar entry, matching Database. The nav rail is user-facing
 *    navigation; a profiler is a diagnostic surface, and 26 of 38 registry
 *    pages have no rail entry. ⌘K is the designed discovery path.
 */
const profiler: PageManifest = {
  id: 'profiler',
  route: '/profiler',
  label: 'Performance',
  icon: 'Gauge',
  group: 'System',
  keywords: [
    'profiler',
    'performance',
    'lag',
    'slow',
    'jank',
    'frame',
    'fps',
    'long task',
    'blocking',
    'memory',
    'heap',
    'ipc latency',
    'stall',
    'freeze',
    'render time',
    'stutter',
  ],
  hint: 'Frame time, blocking tasks, renderer heap and per-page cost',

  sections: [
    {
      id: 'profiler.vitals',
      label: 'Performance — Vitals',
      icon: 'Gauge',
      keywords: ['vitals', 'health', 'blocking', 'fps', 'heap', 'verdict'],
      hint: 'Blocking share of wall-clock, frame rate, heap and host load',
    },
    {
      id: 'profiler.trace',
      label: 'Performance — Frame Trace',
      icon: 'Activity',
      keywords: ['trace', 'timeline', 'frame', 'scope', 'stall', 'spike'],
      hint: 'Live frame-time scope with the 16.7ms and 50ms thresholds drawn',
    },
    {
      id: 'profiler.ledger',
      label: 'Performance — Page Ledger',
      icon: 'List',
      keywords: ['ledger', 'pages', 'ranking', 'slowest', 'per page', 'compare'],
      hint: 'Every page ranked by blocking share, sortable and click-to-filter',
    },
    {
      id: 'profiler.tasks',
      label: 'Performance — Blocking Tasks',
      icon: 'AlertTriangle',
      keywords: ['tasks', 'long tasks', 'stalls', 'blocking', 'worst', 'list'],
      hint: 'Individual blocking tasks with route attribution and provenance',
    },
    {
      id: 'profiler.blame',
      label: 'Performance — Where The Time Went',
      icon: 'Wrench',
      keywords: ['blame', 'attribution', 'cause', 'operations', 'ipc', 'time', 'slowest'],
      hint: 'Blocking time attributed to the operations that caused it',
    },
    {
      id: 'profiler.memory',
      label: 'Performance — Memory',
      icon: 'HardDrive',
      keywords: ['memory', 'heap', 'leak', 'growth', 'rss', 'gc'],
      hint: 'Renderer heap over time and its growth rate — the leak detector',
    },
    {
      id: 'profiler.sources',
      label: 'Performance — Sources',
      icon: 'FileText',
      keywords: ['sources', 'provenance', 'layers', 'capabilities', 'method'],
      hint: 'Which measurement channel produced each number in this build',
    },
  ],
}

export default profiler