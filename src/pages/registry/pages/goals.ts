import type { PageManifest } from '../types'

/**
 * /goals — the Goals feature, and /gold — the Gold (routines + phases) page.
 *
 * TWO pages, ONE domain, and they were fused by accident. GoldPage is routines
 * and long-horizon phases; GoalsPage is the actual goals system (list,
 * CriteriaBuilder, habit tracker, AI coach, long-term goals). Routing `/gold`
 * at GoldPage and leaving `/goals` unrouted is why "the goal UI is missing"
 * even though a complete 22KB GoalsPage existed on disk, imported by nothing.
 *
 * `longtermPeriodGoals` is a real SECTION on GoalsPage — those are goals whose
 * `period` is 'longterm'. It is declared here so ⌘K and Ctrl+F can reach it;
 * the anchor matches the `data-section` written in GoalsPage.tsx.
 */
const goals: PageManifest = {
  id: 'goals',
  route: '/goals',
  label: 'Goals',
  icon: 'Target',
  group: 'Navigation',
  keywords: ['goals', 'target', 'routines', 'long-term', 'criteria', 'habits', 'milestone'],
  hint: 'Goals, routines and long-term goals',

  sections: [
    { id: 'goals.longterm', label: 'Goals — Long-term goals', icon: 'Flag', keywords: ['long-term', 'longterm', 'milestone', 'horizon'] },
  ],
}

const gold: PageManifest = {
  id: 'gold',
  route: '/gold',
  label: 'Gold',
  icon: 'Sparkles',
  group: 'Navigation',
  keywords: ['gold', 'routines', 'phases', 'seal', 'warmth'],
  hint: 'Routines and life phases',
}

export { goals, gold }
