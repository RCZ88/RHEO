import type { PageManifest } from '../types'

/**
 * /learn — Lyceum.
 *
 * `LearnPage` keeps four views (`home` | `library` | `reader` | `study`) but the
 * visible `LearnTabBar` exposes only three — `reader` is a hidden state entered
 * by opening a lesson. The palette's `learn-courses` / `learn-deck` entries had
 * no `tab` at all, so both landed on `home`.
 *
 * The three views carry real keyboard shortcuts (`g h`, `g l`, `g s`); those are
 * in the keywords so ⌘K is discoverable by the same muscle memory.
 */
const learn: PageManifest = {
  id: 'learn',
  route: '/learn',
  label: 'Learn',
  icon: 'GraduationCap',
  group: 'Navigation',
  keywords: ['learn', 'lyceum', 'lessons', 'education', 'courses', 'study', 'onboarding', 'setup', 'hierarchy', 'guide'],
  hint: 'Courses, flashcards and spaced repetition',

  tabs: {
    variable: 'view',
    stateKey: 'tab',
    default: 'home',
    items: [
      { id: 'home', label: 'Home', icon: 'Home', keywords: ['home', 'start', 'overview'] },
      { id: 'library', label: 'Library', icon: 'BookOpen', keywords: ['library', 'courses', 'lessons', 'catalog', 'g l'] },
      { id: 'study', label: 'Study', icon: 'Brain', keywords: ['study', 'review', 'flashcards', 'revision', 'g s'] },
      { id: 'reader', label: 'Lesson Reader', icon: 'FileText', keywords: ['reader', 'reading', 'lesson', 'content'] },
    ],
  },

  // No `sections`. `OnboardingPanel` and `LearnerSetup` are MODALS rendered with
  // `open={...}`, and `HierarchyGuide` lives inside `LearnHome` rather than at the
  // page level. Anchoring a section to a closed modal would scroll to an
  // unmounted element — the silent no-op this whole registry exists to remove.
}

/**
 * /lecture/* — the SlideMind workspace.
 *
 * Ten real sub-ROUTES (the only nested router in the app). Each gets its own
 * manifest so ⌘K, the find bar's page scope, and the `match` pattern all agree.
 *
 * `decks/:id` has a parameter, which is exactly the case that used to mint the
 * pageId `lecture/decks/12` and match nothing on Ctrl+F. `match` fixes it.
 */
const lecture = {
  id: 'lecture',
  route: '/lecture',
  match: '/lecture',
  label: 'Lecture',
  icon: 'GraduationCap',
  group: 'Labs',
  keywords: ['lecture', 'slides', 'decks', 'transcriber', 'slidesmind', 'vision'],
  hint: 'Decks, transcription, prompt forge, research',

  children: [
    { id: 'lecture-dashboard', route: '/lecture', match: '/lecture', label: 'Dashboard', icon: 'LayoutDashboard', keywords: ['dashboard', 'home', 'overview'], group: 'Lecture' },
    { id: 'lecture-decks', route: '/lecture/decks', match: '/lecture/decks', label: 'Decks', icon: 'Layers', keywords: ['decks', 'slides', 'library'], group: 'Lecture' },
    { id: 'lecture-deck-viewer', route: '/lecture/decks', match: '/lecture/decks/:id', label: 'Slide Viewer', icon: 'Presentation', keywords: ['viewer', 'open deck', 'slides', 'present'], group: 'Lecture' },
    { id: 'lecture-image-lab', route: '/lecture/image-lab', match: '/lecture/image-lab', label: 'Image Lab', icon: 'Camera', keywords: ['image', 'lab', 'vision', 'analysis', 'ocr'], group: 'Lecture' },
    { id: 'lecture-transcriber', route: '/lecture/transcriber', match: '/lecture/transcriber', label: 'Transcriber', icon: 'Mic', keywords: ['transcribe', 'speech', 'audio', 'stt', 'whisper'], group: 'Lecture' },
    { id: 'lecture-web-digest', route: '/lecture/web-digest', match: '/lecture/web-digest', label: 'Web Digest', icon: 'Globe', keywords: ['web', 'digest', 'url', 'scrape', 'article'], group: 'Lecture' },
    { id: 'lecture-prompts', route: '/lecture/prompts', match: '/lecture/prompts', label: 'Prompt Forge', icon: 'Wand2', keywords: ['prompts', 'forge', 'templates', 'library'], group: 'Lecture' },
    { id: 'lecture-auth-vault', route: '/lecture/auth-vault', match: '/lecture/auth-vault', label: 'Auth Vault', icon: 'KeyRound', keywords: ['auth', 'vault', 'credentials', 'keys', 'secrets'] },
    { id: 'lecture-research', route: '/lecture/research', match: '/lecture/research', label: 'Research', icon: 'Search', keywords: ['research', 'search', 'sources', 'notes'], group: 'Lecture' },
  ] as PageManifest[],
} satisfies PageManifest

export { learn, lecture }