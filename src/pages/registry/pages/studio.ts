import type { PageManifest } from '../types'

/**
 * /studio — Overlay Studio, which is really a three-way mode switch whose
 * `engine` mode contains a NINE-stage pipeline.
 *
 * `PIPELINE_STAGES` in `ContentEngineWorkspace.tsx:27-38` lists nine ids while
 * the header hardcodes the string "8-stage pipeline" (`CONTENT_ENGINE_STAGES = 9`
 * is even duplicated in `labs/labRegistry.ts:37` because that module cannot import
 * this one). `brainstorm` is reachable and has no button.
 *
 * Both manifests below exist so ⌘K can reach every stage, and so the stage count
 * has exactly one source of truth. If you add a stage here, the header text and
 * the Labs card both follow — which is the whole point of declaring it.
 */
const CONTENT_ENGINE_STAGES = [
  { id: 'ideas', label: 'Ideas', icon: 'Lightbulb' },
  { id: 'brainstorm', label: 'Brainstorm', icon: 'Wind' },
  { id: 'episodes', label: 'Episodes', icon: 'Video' },
  { id: 'series', label: 'Series', icon: 'Layers' },
  { id: 'themes', label: 'Themes', icon: 'Hash' },
  { id: 'analytics', label: 'Analytics', icon: 'ChartLine' },
  { id: 'lessons', label: 'Lessons', icon: 'GraduationCap' },
  { id: 'frameworks', label: 'Frameworks', icon: 'Blocks' },
  { id: 'process', label: 'Process', icon: 'Workflow' },
  { id: 'playbook', label: 'Playbook', icon: 'ListChecks' },
] as const

const studio: PageManifest = {
  id: 'studio',
  route: '/studio',
  label: 'Feature Studio',
  icon: 'Sparkles',
  group: 'Navigation',
  keywords: ['studio', 'overlay', 'design', 'features', 'builder', 'engine'],
  aliases: ['labs-content-engine'],
  hint: 'Overlay builder, content engine, presentation',

  tabs: {
    variable: 'mode',
    stateKey: 'tab',
    default: 'studio',
    items: [
      { id: 'studio', label: 'Overlay Builder', icon: 'Sparkles', keywords: ['overlay', 'builder', 'widget', 'studio'] },
      {
        id: 'engine',
        label: 'Content Engine',
        icon: 'Workflow',
        navState: { stage: 'ideas' },
        keywords: ['content', 'engine', 'pipeline', 'ideas', 'episodes', 'framework'],
      },
      { id: 'presentation', label: 'Presentation', icon: 'Presentation', keywords: ['presentation', 'slides', 'present', 'export'] },
    ],
  },

  // No `studio.templates`: the old palette declared it, but `OverlayStudioPage`
  // contains no templates UI — grepping that file for "template" returns nothing.
  sections: [
    ...CONTENT_ENGINE_STAGES.map(s => ({
      id: `engine.${s.id}`,
      label: `Engine — ${s.label}`,
      icon: s.icon,
      keywords: [s.label.toLowerCase(), 'pipeline', 'engine', 'stage'],
    })),
  ],
}

/** /labs — the hub that groups the externally-built labs. */
const labs: PageManifest = {
  id: 'labs',
  route: '/labs',
  label: 'Labs',
  icon: 'FlaskConical',
  group: 'Navigation',
  keywords: ['labs', 'experiments', 'hub', 'content engine', 'resume', 'lecture'],
  hint: 'Hub for the externally-built surfaces',

  sections: [
    { id: 'labs.content-engine', label: 'Labs — Content Engine', icon: 'Workflow', route: '/studio', tab: 'engine', keywords: ['content engine', 'pipeline', 'studio', 'framework'] },
    { id: 'labs.resume', label: 'Labs — Resume Builder', icon: 'FileText', route: '/resume', keywords: ['resume', 'cv', 'builder'] },
    { id: 'labs.lecture', label: 'Labs — Lecture', icon: 'GraduationCap', route: '/lecture', keywords: ['lecture', 'slides', 'decks', 'slidesmind'] },
  ],
}

export { studio, labs, CONTENT_ENGINE_STAGES }