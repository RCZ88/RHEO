// ============================================================
// CANONICAL APP IDENTITIES — one app, one name
// ============================================================
//
// The KDE foreground detector has two ways to answer: native kdotool (returns
// the Wayland app_id, e.g. `jetbrains-idea`, `app.zen_browser.zen`,
// `org.kde.dolphin`) and the X11 fallbacks (which return the binary/window
// class, e.g. `idea`, `zen`, `dolphin`). kdotool occasionally misses under
// load and the fallback runs, so the SAME window alternates between two names
// from one poll to the next. The tracker treats a name change as an app change,
// which produced hundreds of 1-3 second "sessions" for one app and split its
// totals across duplicate rows.
//
// This table is intentionally small and evidence-based: every entry below was
// observed in the live logs. It is shared by the app's poll loop and the
// rheo-tracker daemon so both writers agree on identity.
//
// NOT included on purpose: `org.kde.konsole`. The user has two explicit,
// conflicting category overrides for it (`konsole` → AI Tools,
// `org.kde.konsole` → IDE). Collapsing the names would silently pick one of
// their decisions, so leave that pair alone until the user resolves it.

export const APP_IDENTITY_ALIASES: Readonly<Record<string, string>> = {
  // JetBrains IDEA: kdotool app_id vs binary name
  'jetbrains-idea': 'idea',
  idea64: 'idea',
  // Zen Browser: Wayland app_id vs process name
  'app.zen_browser.zen': 'zen',
  zen_browser: 'zen',
  // KDE apps: reverse-DNS app_id vs binary name
  'org.kde.dolphin': 'dolphin',
  'org.kde.okular': 'okular',
  'org.kde.kwrite': 'kwrite',
};

/**
 * Resolve one display/process name to a stable identity.
 *
 * Case is preserved for names that are not aliases, so Windows apps such as
 * "Visual Studio Code" keep their existing display spelling. The daemon already
 * lowercases before calling this, so its stored values remain lowercase.
 */
export function canonicalAppName(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const alias = APP_IDENTITY_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}
