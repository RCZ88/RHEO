/**
 * Labs — the single declarative registry behind the /labs hub page.
 *
 * WHY THIS FILE EXISTS
 * Three surfaces in this app (Content Engine, Resume, Lecture/SlideMind) were
 * built outside the app's design system: each invented its own palette, its own
 * card component and its own accent. Grouping them under one hub is only
 * honest if the hub is itself native. This file is that hub's source of truth —
 * add a lab here and the page renders it.
 *
 * THE COUNTS ARE DERIVED WHERE THE SOURCE WILL ALLOW IT, NOT TYPED.
 * Deriving a count from the real module is what stops this page from lying the
 * way ContentEngineWorkspace's own header does — it reads "8-stage pipeline"
 * while PIPELINE_STAGES holds 9 entries, a caption that drifted from its source
 * and was invisible to every type check and to the bundler.
 *
 * So: 2 of the 3 are read from their real source module, and the 1 that cannot
 * be is marked. Content Engine is the exception because its component graph does
 * not currently resolve — PromptBuilder.tsx imports and CALLS
 * `getSectionsForPromptType` from ./PromptSectionToggle, where that function is
 * neither defined nor exported anywhere in the repo. Importing the module to
 * count its stages would make this hub un-loadable, so the count lives here
 * instead, with the blocker named. When the missing function is restored, delete
 * CONTENT_ENGINE_STAGES and import PIPELINE_STAGES from the workspace instead.
 *
 * Import-weight note: SlideSidebar pulls only react-router-dom + lucide-react,
 * and src/types/resume.ts is a pure types module, so both derivations are free.
 */
import { items as LECTURE_TOOLS } from '@/features/lecture/components/SlideSidebar';
import { SttCategoryColors } from '@/lib/sttStore';
import { PHASE_NAMES } from '@/types/resume';

/**
 * Content Engine's stage count, held here only because its module cannot be
 * imported yet. See the file header. Kept adjacent to a deliberately unused
 * variable so this stays the single obvious place to fix.
 */
const CONTENT_ENGINE_STAGES = 9;

/**
 * Where a lab's AI actually runs. This is the single most decision-relevant
 * fact about each lab — it determines cost, privacy and whether you need a
 * second application open — so it is surfaced on the card rather than buried
 * in each lab's own settings.
 */
export type LabAiPath = 'on-device' | 'in-app' | 'hybrid';

/**
 * One leg of the round trip every lab shares: raw input, the machinery that
 * transforms it, and the artifact that comes out.
 */
export interface LabRoundTrip {
  /** What the user puts in. */
  input: string;
  /** The machinery that transforms it, with a count derived from source. */
  forge: string;
  /** The artifact that exists afterwards. */
  output: string;
}


/**
 * How this lab's entry affordance on the /labs card is dressed. Every agent
 * adding a lab MUST pick from these options — the card chrome stays uniform,
 * but the affordance is allowed to speak the feature's own color and verb, so
 * the hub is a family of plates, not three identical white buttons.
 *
 * style:
 *  - 'solid'   filled accent chip — the lab's primary action is obvious
 *  - 'outline' accent-bordered chip on the elevated surface
 *  - 'mono'    mono uppercase label + arrow, for reference-style surfaces
 *  - 'ghost'   quiet text link, for labs that should not shout
 */
export interface LabEntry {
  /** CTA label — default 'Open'. Use the lab's verb, e.g. 'Enter Studio'. */
  label?: string;
  style: 'solid' | 'outline' | 'mono' | 'ghost';
  /**
   * The destination page's own accent hue (its [data-page] --page-accent).
   * Lets the affordance preview the feature's signal color. Required for
   * 'solid', 'outline' and 'mono'; ignored for 'ghost', which stays neutral.
   */
  accent?: string;
}

export interface Lab {
  /** Mono specimen ID. Stable, and the visual differentiator between plates. */
  id: string;
  /** The name the rest of the app uses for it (matches the old nav labels). */
  name: string;
  /** The lab's own internal product name, when it differs from the nav label. */
  brand?: string;
  /** One line: what this lab produces. The card's subtitle. */
  makes: string;
  /** Where the user lands. */
  route: string;
  /**
   * lucide icon — never emoji (§7.5).
   *
   * `gauge` was added for LB-04 (Performance). The union is intentionally a
   * closed set rather than `string`: it is what lets `LAB_ICON` in LabsPage.tsx
   * be a total `Record<Lab['icon'], …>`, so adding a lab with a typo'd or
   * unmapped icon is a TYPE ERROR instead of an undefined component that renders
   * a blank hole in the plate.
   */
  icon: 'clapperboard' | 'file-text' | 'presentation' | 'gauge' | 'timer';
  aiPath: LabAiPath;
  /** Rendered next to the specimen ID in the plate header. */
  aiPathLabel: string;
  roundTrip: LabRoundTrip;
  /** Implementation surface, so "why does this one feel different" is answered. */
  backing: string;
  /** Honest, checkable structural facts. Never a quality claim. */
  facts: readonly string[];
  /**
   * The card's entry affordance. Mandatory — pick a style and, for
   * solid/outline, the destination page's own accent hue.
   */
  entry: LabEntry;
}

/** Human-readable phrase for an AI path. Kept out of the cards for symmetry. */
export const AI_PATH_LABEL: Record<LabAiPath, string> = {
  'on-device': 'On-device only',
  'in-app': 'Runs inside the app',
  hybrid: 'App chain or paste-back',
};

export const LABS: readonly Lab[] = [
  {
    id: 'LB-01',
    name: 'Content Engine',
    brand: 'Content Engine',
    makes: 'Scripted short-form video episodes',
    route: '/studio',
    icon: 'clapperboard',
    aiPath: 'in-app',
    aiPathLabel: 'Runs inside the app',
    roundTrip: {
      input: 'A half-formed thought',
      forge: `${CONTENT_ENGINE_STAGES} stages, idea to playbook`,
      output: 'A scored episode with a shot-by-shot script',
    },
    backing: 'SQLite · 18 tables',
    entry: { style: 'solid', label: 'Enter Studio', accent: '#8b5cf6' },
    facts: [
      // Held in this registry, not derived — see CONTENT_ENGINE_STAGES above.
      `${CONTENT_ENGINE_STAGES} pipeline stages`,
      'Per-frame retention evidence',
      'Gate checks: scroll stop, hard cut, asset ready',
    ],
  },
  {
    id: 'LB-02',
    name: 'Resume',
    brand: 'Career Forge',
    makes: 'A scored, evidence-backed résumé',
    route: '/resume',
    icon: 'file-text',
    aiPath: 'hybrid',
    aiPathLabel: 'App chain or paste-back',
    roundTrip: {
      input: 'A chat transcript or an answer',
      forge: `${Object.keys(PHASE_NAMES).length} phases, scored as you go`,
      output: 'A résumé with ATS and keyword scoring',
    },
    backing: 'JSON file · 4 routes',
    entry: { style: 'outline', label: 'Open Resume', accent: '#6366f1' },
    facts: [
      `${Object.keys(PHASE_NAMES).length} interview phases`,
      'Styled, ATS-raw and heatmap views',
      'Saved versions you can diff',
    ],
  },
  {
    id: 'LB-03',
    name: 'Lecture',
    brand: 'SlideMind',
    makes: 'Token-cheap prompts from heavy material',
    route: '/lecture',
    icon: 'presentation',
    aiPath: 'on-device',
    aiPathLabel: 'On-device only',
    roundTrip: {
      input: 'A .pptx, a recording or a URL',
      forge: `${LECTURE_TOOLS.length} tools, parsed and chunked locally`,
      output: 'A compact prompt to paste into a free AI',
    },
    backing: 'SQLite · 9 tables',
    entry: { style: 'mono', label: 'Open SlideMind', accent: '#f59e0b' },
    facts: [
      `${LECTURE_TOOLS.length} tools incl. OCR and speech-to-text`,
      'Embedded figures and speaker notes are read',
      'Built for CS and Math, English and Indonesian',
    ],
  },
  {
    id: 'LB-04',
    name: 'Transcripts',
    brand: 'Dictation',
    makes: 'Every dictation you have spoken',
    route: '/transcripts',
    // The icon union is clapperboard | file-text | presentation (§B). A saved
    // transcript is a document, so file-text is the honest pick.
    icon: 'file-text',
    // The most decision-relevant fact about this lab: the audio never leaves the
    // machine. faster-whisper runs locally on CPU with int8 quantisation.
    aiPath: 'on-device',
    aiPathLabel: 'On-device only',
    roundTrip: {
      input: 'Your voice, through the floating dictation widget',
      forge: `${Object.keys(SttCategoryColors).length} categories, transcribed locally`,
      output: 'A saved transcript, already on your clipboard',
    },
    backing: 'SQLite · stt_transcripts',
    entry: {
      style: 'outline',
      label: 'Open Transcripts',
      // index.css already declares `[data-page="stt"] { --page-accent: #8b5cf6 }`,
      // so this is the destination page's own hue, not an invented one.
      accent: '#8b5cf6',
    },
    facts: [
      `${Object.keys(SttCategoryColors).length} categories, derived from sttStore`,
      'faster-whisper on CPU, int8 — no key, no upload',
      'Every finished recording also lands on the clipboard',
    ],
  },
  {
    id: 'LB-05',
    name: 'Performance',
    brand: 'Profiler',
    makes: 'Frame time, blocking tasks and per-page cost for the whole app',
    route: '/profiler',
    icon: 'gauge',
    // Measured entirely on this machine with the platform's own instruments —
    // there is no model and no network call anywhere in the pipeline, so
    // 'on-device' is the literal truth rather than the closest available option.
    aiPath: 'on-device',
    aiPathLabel: 'On-device only',
    roundTrip: {
      input: 'An arm command, then ordinary use of the app',
      // NO ROUTE COUNT HERE, deliberately. An earlier revision imported
      // `PAGE_MANIFESTS` from `@/pages/registry/manifests` to derive it, which
      // type-checked and esbuilded cleanly and then crashed the running app with
      // `ReferenceError: PAGE_MANIFESTS is not defined`: Vite/Rollup deconflicted
      // the definition to `PAGE_MANIFESTS$1` while this template literal kept the
      // bare name, so the bundle referenced a binding that did not exist. Only
      // grepping the SHIPPED bundle finds that class of bug — tsc proves types and
      // esbuild proves parse, and neither proves runtime bindings.
      //
      // A hand-typed count would be the other failure mode (it drifts the moment a
      // page is added). Stating no number avoids both, and costs this card
      // nothing: what matters here is WHICH instruments, not how many routes
      // exist today. The live count is on /profiler itself.
      forge: 'Long Tasks API · rAF · V8 heap · IPC round-trip',
      output: 'A ranked ledger naming which page blocks, and for how long',
    },
    backing: 'Chromium Long Tasks API · rAF · performance.memory · IPC round-trip',
    entry: {
      // 'outline' not 'solid': this is a diagnostic. It should be findable but it
      // must not out-shout the three creation surfaces it sits beside.
      style: 'outline',
      label: 'Open Profiler',
      // index.css declares `[data-page="profiler"] { --page-accent: #a78bfa }`,
      // so this is that page's own dark hue, not an invented one.
      accent: '#a78bfa',
    },
    facts: [
      'Every route ranked by share of wall-clock blocked',
      'Main-thread blocks over 50ms attributed to the active route',
      'Off by default — arms on demand, so it never taxes what it measures',
    ],
  },
  {
    id: 'LB-06',
    name: 'Time Tools',
    brand: 'Stopwatch · Timer · Alarms',
    makes: 'Unified time controls across the app',
    route: '/time-tools',
    icon: 'timer',
    aiPath: 'in-app',
    aiPathLabel: 'Runs inside the app',
    roundTrip: {
      input: 'A click on the top-bar clock',
      forge: 'Stopwatches + timers + alarms, shared state',
      output: 'Live on AI canvas, Life page, and Labs',
    },
    backing: 'React state · localStorage',
    entry: { style: 'solid', label: 'Open Time Tools', accent: '#06b6d4' },
    facts: [
      '3 tabs: stopwatch, timer, alarms',
      'Shared store syncs to AI deck card and Life page',
      'Persists across restarts via localStorage',
    ],
  },
];