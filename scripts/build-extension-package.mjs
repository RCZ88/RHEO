#!/usr/bin/env node
/**
 * Package the DeskFlow Browser Bridge for Firefox / Zen sideloading.
 *
 * WHY THIS EXISTS
 * ---------------
 * Zen is Firefox-based. It has NO "Load unpacked" and NO "Developer mode" —
 * those are Chromium concepts. The only way in is:
 *     about:addons -> Extensions -> gear -> "Install Add-on From File..."
 * which takes a .zip / .xpi whose **manifest.json sits at the archive ROOT**.
 * Packing the folder itself (so it contains browser-extension/manifest.json)
 * is the single most common reason this install fails silently.
 *
 * Chrome/Chromium/Brave/Edge are unaffected: they still use
 * "Load unpacked" and point at browser-extension/ directly.
 *
 * Usage:  node scripts/build-extension-package.mjs
 * Output: release/deskflow-bridge/deskflow-bridge.zip  (+ a .xpi copy)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'browser-extension');
const OUT_DIR = join(REPO, 'release', 'deskflow-bridge');
const STAGE = join(REPO, '.extension-package-stage');

// Only what the extension actually needs at runtime. Skipping *.md keeps
// PERPLEXITY_PROMPT.md and the dev README out of the shipped package.
const RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'overlay.js',
  'popup.js',
  'popup.html',
  'focusOverlay.js',
  'ai-context-content.js',
];
const RUNTIME_DIRS = ['icons'];

function main() {
  if (!existsSync(SRC)) {
    console.error(`[build-extension-package] missing ${SRC}`);
    process.exit(1);
  }

  // The version MUST be bumped for Firefox/Zen to accept an update over an
  // already-installed copy; it silently refuses an equal or lower version.
  const version = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')).version;

  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });

  for (const f of RUNTIME_FILES) {
    const src = join(SRC, f);
    if (!existsSync(src)) {
      console.error(`[build-extension-package] MISSING required file: ${f}`);
      process.exit(1);
    }
    cpSync(src, join(STAGE, f));
  }
  for (const d of RUNTIME_DIRS) cpSync(join(SRC, d), join(STAGE, d), { recursive: true });

  mkdirSync(OUT_DIR, { recursive: true });

  // ── TWO VARIANTS, ONE PER BROWSER ENGINE ──────────────────────────────────
  // Declaring BOTH `background.scripts` and `background.service_worker` is the
  // MDN-recommended cross-browser pattern, and Chrome honours it. But Firefox
  // bug 1860304 shipped exactly that combination failing in the wild: "the
  // extension loads but the background page fails to start up" — the add-on
  // installs, the icon never appears, and nothing is ever sent. Firefox bug
  // 1991707 later reports Firefox still *demanding* `scripts` and users fixing
  // it by DELETING `service_worker`.
  //
  // So: do not gamble on which Firefox Zen is based on. Emit a manifest with
  // exactly one key per engine. Deterministic beats clever.
  const baseManifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));

  const variants = [
    // Firefox / Zen: event page. This is the one they install.
    { id: 'firefox', background: { scripts: ['background.js'] } },
    // Chromium family: MV3 service worker is mandatory; `scripts` is ignored.
    { id: 'chrome', background: { service_worker: 'background.js' } },
  ];

  const built = [];
  for (const v of variants) {
    const manifest = { ...baseManifest, background: v.background };
    writeFileSync(join(STAGE, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const zip = join(OUT_DIR, `deskflow-bridge-${v.id}.zip`);
    rmSync(zip, { force: true });
    // manifest.json FIRST: some Firefox builds peek at the first archive entry.
    execFileSync('zip', ['-qrX', zip, 'manifest.json', '.'], { cwd: STAGE });

    // Also emit a .xpi. An .xpi IS a zip; Firefox's file picker filters to
    // .xpi by default, so a .zip alone can be reported as "corrupt" purely
    // because the picker never let you choose it.
    const xpi = join(OUT_DIR, `deskflow-bridge-${v.id}.xpi`);
    rmSync(xpi, { force: true });
    cpSync(zip, xpi);

    built.push({ id: v.id, zip, xpi, size: statSync(zip).size });
  }

  // ── VALIDATE EVERY VARIANT BEFORE DECLARING SUCCESS ─────────────────────────
  // A missing referenced file, a bad manifest, or a wrong background key is the
  // difference between "installs fine" and "Firefox reports the XPI as corrupt".
  // Validate here so a broken package can never be shipped silently.
  for (const b of built) {
    const listing = execFileSync('unzip', ['-l', b.zip], { encoding: 'utf8' });
    const manifestText = execFileSync('unzip', ['-p', b.zip, 'manifest.json'], { encoding: 'utf8' });
    let manifest;
    try { manifest = JSON.parse(manifestText); }
    catch (e) { console.error(`[build-extension-package] INVALID manifest in ${b.id}: ${e.message}`); process.exit(1); }
    const required = ['manifest_version','name','version','description','permissions','icons','action','background','host_permissions','content_scripts','browser_specific_settings','data_collection_permissions'];
    for (const k of required) {
      if (!(k in manifest)) { console.error(`[build-extension-package] ${b.id}: missing manifest key '${k}'`); process.exit(1); }
    }
    if (!manifest.browser_specific_settings?.gecko?.id) {
      console.error(`[build-extension-package] ${b.id}: missing gecko.id`); process.exit(1);
    }
    const archiveFiles = new Set(listing.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(Boolean));
    const referenced = [];
    for (const v of Object.values(manifest.icons || {})) referenced.push(v);
    for (const v of Object.values(manifest.action?.default_icon || {})) referenced.push(v);
    if (manifest.action?.default_popup) referenced.push(manifest.action.default_popup);
    for (const s of manifest.background?.scripts || []) referenced.push(s);
    if (manifest.background?.service_worker) referenced.push(manifest.background.service_worker);
    for (const cs of manifest.content_scripts || []) for (const js of cs.js || []) referenced.push(js);
    for (const p of referenced) {
      if (!archiveFiles.has(p)) { console.error(`[build-extension-package] ${b.id}: referenced file MISSING from archive: ${p}`); process.exit(1); }
    }
    if (b.id === 'firefox' && !manifest.background?.scripts) { console.error(`[build-extension-package] firefox variant missing background.scripts`); process.exit(1); }
    if (b.id === 'chrome' && !manifest.background?.service_worker) { console.error(`[build-extension-package] chrome variant missing background.service_worker`); process.exit(1); }
    console.log(`[build-extension-package] validated ${b.id}: ${referenced.length} referenced files present, manifest OK`);
  }

  rmSync(STAGE, { recursive: true, force: true });

  console.log('[build-extension-package] built DeskFlow Browser Bridge');
  console.log(`  version : ${version}`);
  for (const b of built) {
    console.log(`  ${b.id.padEnd(8)}: ${b.zip} (${b.size} bytes)`);
    console.log(`  ${''.padEnd(8)}  ${b.xpi}`);
  }
  console.log('');
  console.log('  Zen / Firefox  : about:addons -> Extensions -> gear ->');
  console.log('                  "Install Add-on From File..." -> deskflow-bridge-firefox.zip');
  console.log('  Chrome/Brave/Edge : chrome://extensions -> Developer mode ->');
  console.log('                  "Load unpacked" -> the browser-extension/ FOLDER');
}

main();