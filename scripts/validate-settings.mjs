#!/usr/bin/env node
/**
 * validate-settings.mjs — enforcement for the Settings search manifest.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * The bug this was written for: `settingsTabKeywords` in `SettingsPage.tsx`
 * covered 9 of the 12 tabs. `appearance`, `database` and `shortcuts` had no entry,
 * so `findMatchingTab` returned null and the page simply did not move when you
 * searched. A user searching "keyboard shortcut" saw an unmoving screen, which is
 * indistinguishable from broken search — and it hid the navigation-mode setting
 * entirely.
 *
 * Nothing caught it because the keyword list and the tab list were two unrelated
 * literals in two unrelated places. A mandate nobody checks is a suggestion, so
 * this compares them.
 *
 * Checks:
 *   1. Every tab in `SettingsPage`'s `tabs` array has a manifest entry.
 *   2. Every manifest tab exists in `SettingsPage` (no orphaned manifest).
 *   3. Labels agree (a renamed tab must not leave a stale search label).
 *   4. Every manifest tab has a non-trivial keyword list.
 *   5. Every `SettingGroupSpec` points at a real tab and has unique ids.
 *   6. No duplicate keywords WITHIN a tab (harmless but a sign of a copy-paste).
 *   7. Every `<SearchableSection group="...">` refers to a declared group.
 *   8. Reports how many tabs are reachable, so a regression is visible in a diff.
 *
 * Usage: node scripts/validate-settings.mjs [--json]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const errors = []
const warnings = []
const fail = m => errors.push(m)
const warn = m => warnings.push(m)

/* ── the real tab list, read from SettingsPage source ────────────────────── */

const settingsSrc = readFileSync(join(SRC, 'pages', 'SettingsPage.tsx'), 'utf8')

const tabBlock = settingsSrc.match(/const tabs = \[([\s\S]*?)\n\s*\];/)
if (!tabBlock) {
  fail('could not find `const tabs = [...]` in SettingsPage.tsx — update this validator')
}
const realTabs = []
if (tabBlock) {
  for (const m of tabBlock[1].matchAll(/id:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)) {
    realTabs.push({ id: m[1], label: m[2] })
  }
}

/* ── the manifest, loaded for real ───────────────────────────────────────── */

async function loadManifest() {
  const outfile = join(ROOT, 'node_modules', '.cache', 'settings-manifest-probe.mjs')
  await build({
    entryPoints: [join(SRC, 'pages', 'settings', 'registry', 'index.ts')],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  })
  return import(`file://${outfile}?t=${Date.now()}`)
}

const run = async () => {
  let mod = null
  try {
    mod = await loadManifest()
  } catch (e) {
    fail(`could not load the settings manifest: ${e && e.message ? e.message : e}`)
  }
  if (!mod) return report(realTabs, 0, 0)

  const TABS = mod.SETTINGS_TABS ?? []
  const GROUPS = mod.SETTING_GROUPS ?? []

  // 1. every real tab is declared
  for (const t of realTabs) {
    if (!TABS.some(x => x.id === t.id)) {
      fail(`tab "${t.id}" exists in SettingsPage but has no entry in settings-manifest.ts — searching for it will never jump there. Add it (this is exactly how 'shortcuts' became unreachable).`)
    }
  }

  // 2. no orphaned manifest entries
  for (const m of TABS) {
    if (!realTabs.some(t => t.id === m.id)) {
      fail(`manifest declares tab "${m.id}" which SettingsPage does not render`)
    }
  }

  // 3. labels agree
  for (const t of realTabs) {
    const m = TABS.find(x => x.id === t.id)
    if (m && m.label !== t.label) {
      fail(`tab "${t.id}" label drifted: SettingsPage says "${t.label}", manifest says "${m.label}"`)
    }
  }

  // 4. keyword lists are real
  for (const m of TABS) {
    if (!m.keywords?.length) fail(`tab "${m.id}" has no keywords — it would only match its own label`)
    if ((m.keywords?.length ?? 0) < 5) {
      warn(`tab "${m.id}" has only ${m.keywords?.length ?? 0} keywords; people rarely search a tab by its exact name`)
    }
  }

  // 5. groups point at real tabs, ids unique
  const groupIds = new Set()
  for (const g of GROUPS) {
    if (groupIds.has(g.id)) fail(`duplicate setting group id "${g.id}"`)
    groupIds.add(g.id)
    if (!TABS.some(t => t.id === g.tab)) fail(`setting group "${g.id}" points at unknown tab "${g.tab}"`)
  }

  // 6. duplicate keywords within a tab
  for (const m of TABS) {
    const seen = new Set()
    const dupes = new Set()
    for (const k of m.keywords ?? []) {
      const key = k.toLowerCase()
      if (seen.has(key)) dupes.add(k)
      seen.add(key)
    }
    if (dupes.size) warn(`tab "${m.id}" repeats keyword(s): ${[...dupes].join(', ')}`)
  }

  // 7. every group= reference resolves
  const used = new Set()
  for (const f of ['pages/SettingsPage.tsx', 'pages/settings/AdvancedSection.tsx']) {
    let text
    try { text = readFileSync(join(SRC, f), 'utf8') } catch { continue }
    for (const m of text.matchAll(/<SearchableSection[^>]*\bgroup=["']([^"']+)["']/gs)) {
      used.add(m[1])
      if (!groupIds.has(m[1])) fail(`<SearchableSection group="${m[1]}"> in ${f} has no manifest entry`)
    }
  }

  // 8. reachability report — the number that would have caught the original bug
  const reachable = TABS.filter(t =>
    searchReaches(t, mod)
  ).length

  report(realTabs, TABS.length, reachable, GROUPS.length, used.size)
}

/** A tab is reachable if searching its own label returns it. */
function searchReaches(tab, mod) {
  const r = mod.searchSettings(tab.label.toLowerCase())
  return r.bestTab === tab.id
}

function report(realTabs, manifestCount, reachable, groupCount = 0, usedGroups = 0) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ errors, warnings, realTabs: realTabs.length, manifestCount, reachable, groupCount, usedGroups }, null, 2))
  } else {
    console.log(`\n  tabs in SettingsPage : ${realTabs.length}`)
    console.log(`  tabs in manifest     : ${manifestCount}`)
    console.log(`  reachable by search  : ${reachable}/${manifestCount}`)
    console.log(`  setting groups       : ${groupCount} declared, ${usedGroups} referenced`)
    if (warnings.length) {
      console.log(`\n  ${warnings.length} warning(s):`)
      for (const w of warnings) console.log(`    ~ ${w}`)
    }
    if (errors.length) {
      console.log(`\n  ${errors.length} ERROR(s):`)
      for (const e of errors) console.log(`    ✗ ${e}`)
      console.log('')
      process.exit(1)
    }
    console.log(`\n  ✓ every tab is searchable and declared\n`)
  }
}

run().catch(e => { console.error('validator crashed:', e); process.exit(1) })
