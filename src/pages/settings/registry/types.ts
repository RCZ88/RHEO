/**
 * types.ts — the vocabulary for "a setting".
 *
 * Same reasoning as `src/pages/registry/types.ts`, and for the same reason: the
 * Settings search used to have THREE independent hand-maintained keyword lists
 * (see `settings-manifest.ts` for the autopsy), which is the exact shape of bug
 * this file exists to prevent.
 */

export type SettingsTabId =
  | 'category'
  | 'appearance'
  | 'colors'
  | 'ai'
  | 'general'
  | 'tracking'
  | 'prompts'
  | 'finance'
  | 'devices'
  | 'database'
  | 'auth'
  | 'shortcuts'

/**
 * A tab. The unit search jumps to.
 *
 * `keywords` is REQUIRED and is the reason this file exists: the old
 * `settingsTabKeywords` object simply forgot three tabs, so searching for
 * anything in Keyboard Shortcuts, Appearance or Database could never jump to
 * them, and the user was left staring at an unchanged page which reads exactly
 * like a broken search.
 */
export interface SettingsTabSpec {
  id: SettingsTabId
  label: string
  /** One-line description, shown in the no-results state. */
  hint?: string
  /**
   * Every word a person might plausibly type to find this tab.
   *
   * Include SYNONYMS and the words the UI actually shows, not just the tab name:
   * people search "dark" not "appearance", "hotkey" not "keyboard shortcuts",
   * "cv" not "resume". Also include the ids of neighbouring concepts people
   * conflate, so a near miss still lands somewhere sensible.
   */
  keywords: string[]
}

/**
 * A group of related controls inside a tab — the thing that gets hidden or shown
 * as the user types.
 *
 * Declaring groups (rather than passing a `terms` array at each call site) is
 * what makes the index "always updated": a control added inside an EXISTING group
 * is searchable the moment it renders, because the group's corpus is harvested
 * from its own rendered text. A brand new group needs one manifest entry, in the
 * same commit as the control.
 */
export interface SettingGroupSpec {
  /** Stable id, referenced by `<SearchableSection group="...">`. */
  id: string
  /** Tab this group lives in. */
  tab: SettingsTabId
  /** Heading shown in results. Defaults to the tab label. */
  title?: string
  /** Extra synonyms for this group specifically, beyond the tab's. */
  keywords?: string[]
}
