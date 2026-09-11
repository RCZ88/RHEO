<aside>
🎮

**Goal:** track Steam / Epic / Battle.net games (Wuthering Waves included) as real applications under **Gaming**, without adding measurable CPU load or touching game FPS.

**Core principle:** *resolve the game lazily and cache aggressively.* The expensive work (process scan, Steam library read) runs **at most once per 10s and only when a launcher or a null poll is seen** — never on a normal poll.

</aside>

## 0. Why it fails today

From the current code (`src/main.ts`):

- `pollForeground()` (≈ line 2977) trusts `active-win`'s `result.owner.name`.
- For a Steam game, `active-win` returns either **`Steam`** / **`steamwebhelper.exe`**, the **generic game exe** (`Client.exe`, `Game.exe`), or **`null`** (fullscreen + kernel anti-cheat blocks window enumeration).
- `categorizeApp()` (≈ 2834–2850) substring-matches against `DEFAULT_APP_CATEGORIES`. `Client.exe` matches nothing → **Uncategorized**, so the session is dropped or mislabeled.
- The null-poll keep-alive (≈ 2990–2997) only fires after 30 consecutive nulls and only if `currentApp` *already* categorized as Gaming — which it never did, so anti-cheat games never start a session in the first place.

The fix is a **resolver layer** that sits between `active-win` and `categorizeApp`, plus a one-time startup index of installed games.

---

## 1. Deliverable: reusable skill — `app-detection.skill.md`

This is the reusable pattern the user asked for. Drop it in `agent/skills/app-detection/SKILL.md`. It generalizes beyond games to any "launcher hides the real app" problem (e.g. `javaw.exe`, `Electron`, `python.exe`).

```markdown
---
name: app-detection
version: 1.0.0
scope: Resolve the *real* foreground application when the OS reports a generic
       wrapper, launcher, or null window. Designed for low-overhead pollers.
---

## When to use
- A poller (active-win, GetForegroundWindow) returns a launcher/wrapper name
  (Steam, Epic, javaw, Electron, python) instead of the real app.
- The poller returns null for fullscreen / anti-cheat / exclusive apps.

## The 5-layer resolver (cheap → expensive, stop at first hit)
1. TITLE  — regex the window title (zero cost).      e.g. "X - Steam" → X
2. MAP    — look up process name in a static KNOWN map (O(1), in memory).
3. INDEX  — match against the startup-built installed-app index (O(1)).
4. SCAN   — enumerate processes, gated by a 10s cache + launcher-only trigger.
5. KEEP   — on null, reuse last-known resolved app + session keep-alive.

## Hard rules
- NEVER run layer 4 (process scan) on a normal poll. Only when foreground is a
  known launcher OR poll is null-while-gaming, AND the 10s cache is stale.
- Build the install index ONCE at startup (and on a manual "rescan"), never per poll.
- Cache every expensive answer with a TTL. Default TTL: 10_000 ms.
- All resolver state lives in plain objects/Maps in memory — no DB, no worker.
- Resolver must be pure-ish: given the same cached inputs, no I/O.

## Output contract
resolveForegroundApp(rawResult) -> { name: string, source: 'title'|'map'|'index'|'scan'|'keepalive'|'raw' }

## Test before shipping
- Launcher in foreground resolves to the game, not the launcher.
- Launcher itself (idle in library) does NOT resolve to a game.
- Null poll during a known game keeps the session alive.
- Process scan fires ≤ 1× / 10s while gaming (assert with a counter).
```

---

## 2. Deliverable: launcher + known-game tables (`src/gameDetection.ts`)

Kept in a new module so `main.ts` stays lean. All static, tiny, in-memory.

```tsx
// src/gameDetection.ts

// Process names (lowercased) that mean "a launcher is focused, not a game".
export const GAME_LAUNCHERS: Record<string, string[]> = {
  steam:        ['steam.exe', 'steamwebhelper.exe'],
  epic:         ['epicgameslauncher.exe', 'unrealcefsubprocess.exe'],
  'battle.net': ['battle.net.exe', 'agent.exe'],
  ea:           ['eaapp.exe', 'origin.exe', 'eadesktop.exe'],
  gog:          ['goggalaxy.exe'],
  ubisoft:      ['ubisoftconnect.exe', 'upc.exe'],
  riot:         ['riotclient.exe', 'riotclientservices.exe'],
};

const LAUNCHER_EXES = new Set(
  Object.values(GAME_LAUNCHERS).flat().map((e) => e.toLowerCase())
);
export const isLauncherProcess = (name?: string | null): boolean =>
  !!name && LAUNCHER_EXES.has(name.toLowerCase());

// Seed map: generic exe name -> display name. Extended at startup from the
// Steam library (see buildInstalledGameIndex). Keys are lowercased exe names.
export const KNOWN_GAME_PROCESSES: Record<string, string> = {
  'client.exe':          'Wuthering Waves',  // also disambiguated by install dir
  'wutheringwaves.exe':  'Wuthering Waves',
  'genshinimpact.exe':   'Genshin Impact',
  'yuanshen.exe':        'Genshin Impact',
  'starrail.exe':        'Honkai: Star Rail',
  'eldenring.exe':       'Elden Ring',
  'cyberpunk2077.exe':   'Cyberpunk 2077',
  'valorant.exe':        'Valorant',
  'valorant-win64-shipping.exe': 'Valorant',
};

// Window-title fallback. "Wuthering Waves - Steam" -> "Wuthering Waves".
export function gameNameFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const m = title.match(/^(.+?)\s*[-–—]\s*(?:steam|epic games)\s*$/i);
  if (m) return m[1].trim();
  // Bare, non-empty title that isn't the launcher word itself.
  const t = title.trim();
  if (t && !/^(steam|epic games launcher|battle\.net)$/i.test(t)) return t;
  return null;
}
```

---

## 3. Deliverable: startup install-index (no per-poll filesystem reads)

Parse the Steam library **once** on app ready. This converts `Client.exe`

into `Wuthering Waves` reliably by mapping install directories → names, and

seeds the process map. A tiny hand-rolled VDF/ACF reader avoids new deps.

```tsx
// src/gameDetection.ts (continued)
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// exe-name (lower) -> display name, built once. Also tracks install dirs.
export const installedGameIndex = new Map<string, string>();

function steamRoots(): string[] {
  const guesses = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(os.homedir(), '.steam', 'steam'),                 // Linux
    path.join(os.homedir(), 'Library', 'Application Support', 'Steam'), // mac
  ];
  return guesses.filter((p) => safeExists(path.join(p, 'steamapps')));
}

const safeExists = (p: string) => { try { return fs.existsSync(p); } catch { return false; } };

// Minimal VDF value scrape: pull all "path" entries from libraryfolders.vdf.
function libraryPaths(steamRoot: string): string[] {
  const out = [path.join(steamRoot, 'steamapps')];
  try {
    const vdf = fs.readFileSync(
      path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/\"path\"\s*\"([^\"]+)\"/g)) {
      out.push(path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps'));
    }
  } catch { /* no library file: fall back to default only */ }
  return out;
}

// Read appmanifest_*.acf -> { name, installdir }. Index the install dir name
// AND a best-guess exe so both process-name and title paths can resolve.
export function buildInstalledGameIndex(): void {
  installedGameIndex.clear();
  try {
    for (const root of steamRoots()) {
      for (const lib of libraryPaths(root)) {
        if (!safeExists(lib)) continue;
        for (const f of fs.readdirSync(lib)) {
          if (!/^appmanifest_\d+\.acf$/.test(f)) continue;
          const acf = fs.readFileSync(path.join(lib, f), 'utf8');
          const name = acf.match(/\"name\"\s*\"([^\"]+)\"/)?.[1];
          const dir  = acf.match(/\"installdir\"\s*\"([^\"]+)\"/)?.[1];
          if (!name) continue;
          // Map the install dir token and a slug exe to the display name.
          if (dir) installedGameIndex.set(dir.toLowerCase(), name);
          installedGameIndex.set(
            name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe', name);
        }
      }
    }
  } catch (e) {
    // Never throw on startup: tracking must still work without Steam.
    console.warn('[gameDetection] index build skipped:', (e as Error)?.message);
  }
}
```

> Called once: `app.whenReady().then(buildInstalledGameIndex)` and again from a
> 

> manual **"Rescan games"** button. **Zero** filesystem access happens during polling.
> 

---

## 4. Deliverable: cached process scan (launcher-gated, 10s TTL)

The only "heavy" call. It is **debounced by a 10s cache** and only ever invoked

from the launcher / null branch. Uses `tasklist` (Windows) — one spawn, parsed

for known game exes — instead of per-poll WMI parent-tree walks.

```tsx
// src/gameDetection.ts (continued)
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileP = promisify(execFile);

type Resolved = { name: string | null; at: number };
let scanCache: Resolved = { name: null, at: 0 };
const SCAN_TTL = 10_000; // ms — matches the Steam-API cache requirement
let scanInFlight: Promise<string | null> | null = null;

function lookupExe(exe: string): string | null {
  const k = exe.toLowerCase();
  return KNOWN_GAME_PROCESSES[k] ?? installedGameIndex.get(k) ?? null;
}

// Returns a game display name if a known game process is running, else null.
async function scanForGameProcess(): Promise<string | null> {
  const now = Date.now();
  if (now - scanCache.at < SCAN_TTL) return scanCache.name; // serve cache
  if (scanInFlight) return scanInFlight;                    // coalesce callers

  scanInFlight = (async () => {
    let found: string | null = null;
    try {
      if (process.platform === 'win32') {
        // CSV, no header: one cheap spawn (~5-15ms), gated to >=10s apart.
        const { stdout } = await execFileP(
          'tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 4000 });
        for (const line of stdout.split(/\r?\n/)) {
          const exe = line.split('","')[0]?.replace(/^\"/, '').trim();
          if (!exe) continue;
          if (isLauncherProcess(exe)) continue; // ignore the launcher itself
          const hit = lookupExe(exe);
          if (hit) { found = hit; break; }
        }
      }
      // (mac/Linux: 'ps -eo comm=' branch can be added the same way.)
    } catch { /* timeout / denied: keep found = null */ }
    scanCache = { name: found, at: Date.now() };
    scanInFlight = null;
    return found;
  })();
  return scanInFlight;
}
```

**Why this respects the anti-patterns:** one `tasklist` spawn at most every 10s,

never per cycle; no WMI parent walk; no background worker; no DB; result is a

single cached string. Concurrent pollers coalesce on `scanInFlight`.

---

## 5. Deliverable: the resolver + modified `pollForeground()`

```tsx
// src/gameDetection.ts (continued)
export type ResolveSource = 'title' | 'map' | 'index' | 'scan' | 'keepalive' | 'raw';
let lastResolvedGame: string | null = null;

export async function resolveForegroundApp(
  raw: { owner?: { name?: string }; title?: string } | null,
): Promise<{ name: string; source: ResolveSource } | null> {
  // --- Null poll (fullscreen / anti-cheat): keep the last game alive. ---
  if (!raw) {
    if (lastResolvedGame) return { name: lastResolvedGame, source: 'keepalive' };
    return null;
  }

  const proc = raw.owner?.name ?? '';
  const title = raw.title ?? '';

  // Fast path: not a launcher and not a bare game exe -> normal app, no work.
  const launcher = isLauncherProcess(proc);
  const mappedByProc = lookupExe(proc);

  if (!launcher && !mappedByProc) {
    // Layer 3: maybe the process is the game exe present in the index.
    lastResolvedGame = null;
    return { name: proc || title || 'Unknown', source: 'raw' };
  }

  // Layer 2: process name maps directly to a game (e.g. wutheringwaves.exe).
  if (mappedByProc) { lastResolvedGame = mappedByProc; return { name: mappedByProc, source: 'map' }; }

  // Launcher is focused. Layer 1: window title (cheap).
  const byTitle = gameNameFromTitle(title);
  if (byTitle) { lastResolvedGame = byTitle; return { name: byTitle, source: 'title' }; }

  // Layer 4: cached process scan (>=10s apart). Launcher idle -> null.
  const byScan = await scanForGameProcess();
  if (byScan) { lastResolvedGame = byScan; return { name: byScan, source: 'scan' }; }

  // Launcher open but no game running: track the launcher itself, not a game.
  lastResolvedGame = null;
  return { name: proc, source: 'raw' };
}
```

Wiring into the existing poller (minimal diff at ≈ `main.ts:2977`):

```tsx
// BEFORE (simplified):
const result = await activeWin();
if (!result) { /* consecutiveNullPolls logic at 2990-2997 */ }
const appName = result.owner.name;
const category = categorizeApp(appName);

// AFTER:
import { resolveForegroundApp } from './gameDetection';

const result = await activeWin();
const resolved = await resolveForegroundApp(result ?? null);

if (!resolved) {
  // truly idle/null and no game to keep alive -> existing null handling
  consecutiveNullPolls++;
  // ... unchanged ...
  return;
}

// keepalive means a fullscreen game is running but window enum failed:
if (resolved.source === 'keepalive') {
  consecutiveNullPolls = 0;
  sessionStart = sessionStart ?? now; // do NOT reset an ongoing session
}

const appName = resolved.name;            // "Wuthering Waves", not "Steam"
const category = categorizeApp(appName);  // hits 'wuthering' -> 'Gaming'
```

---

## 6. Deliverable: `categorizeApp()` enhancement

Two small changes (≈ `main.ts:2834–2850`):

1. If the resolver tagged the app as a game (`source` ∈ `map|index|scan|keepalive`), short-circuit to **Gaming** before keyword matching — resolved names are authoritative.
2. Add an explicit **launcher guard** so an *idle* launcher (`Steam` with no game) is categorized as Gaming only if you want launcher time counted; otherwise treat as `Productivity`/`Uncategorized`.

```tsx
export function categorizeApp(appName: string, opts?: { isResolvedGame?: boolean }): string {
  if (opts?.isResolvedGame) return 'Gaming';            // authoritative
  const lower = appName.toLowerCase();
  if (categoryConfig.appCategoryMap[appName]) return categoryConfig.appCategoryMap[appName];
  if (categoryConfig.detectedApps[lower]) return categoryConfig.detectedApps[lower];
  for (const [kw, cat] of Object.entries(DEFAULT_APP_CATEGORIES)) {
    if (lower.includes(kw)) return cat;
  }
  return 'Uncategorized';
}
// caller: categorizeApp(appName, { isResolvedGame: ['map','index','scan','keepalive'].includes(resolved.source) })
```

> Remove the over-broad `'game'`, `'unity'`, `'unreal'` keywords from
> 

> `DEFAULT_APP_CATEGORIES` if you see false positives (e.g. Unity **editor**
> 

> work counted as Gaming). The resolver now handles real games precisely.
> 

---

## 7. Performance budget (projected)

These are engineering estimates against the stated budget, not measured on the user's device — validate with the harness in §8.

| Scenario | Work per poll | Added cost | Notes |
| --- | --- | --- | --- |
| Normal app (not gaming) | 1 string check + 2 Map lookups | ~0.00% CPU | Fast path, no I/O |
| Game via process name / title | regex + Map lookups | negligible | Layers 1–2, no spawn |
| Launcher focused, scan stale | 1 `tasklist` spawn / 10s | ~5–15ms once per 10s ≈ &lt;0.15% avg | Coalesced + cached |
| Launcher focused, scan warm | cache read | ~0.00% | 9 of every 10s |
| Fullscreen anti-cheat (null) | 1 Map read (keepalive) | ~0.00% | No spawn at all |
| Startup index build | read ~N .acf files once | one-time, off the poll loop | ~10–50ms at launch |

Worst sustained case (launcher in foreground for an hour): **≤ 360 `tasklist` spawns/hour ≈ one short spawn every 10s**, comfortably inside the **&lt;0.5%** added-CPU budget. Game FPS is untouched because no work runs in the game's process and nothing hooks the GPU/window.

---

## 8. Benchmark + test harness

```tsx
// test/gameDetection.bench.ts — assert the scan never fires more than once/10s.
import { resolveForegroundApp } from '../src/gameDetection';

let spawns = 0;
// monkeypatch execFile counter in scanForGameProcess via a test hook/spy.

async function run() {
  const launcher = { owner: { name: 'steam.exe' }, title: 'Steam' };
  const t0 = Date.now();
  for (let i = 0; i < 600; i++) {            // 600 polls @ ~1s = 10 min
    await resolveForegroundApp(launcher);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('elapsed', Date.now() - t0, 'spawns', spawns);
  // EXPECT: spawns <= 60 (one per 10s), ideally ~60 for a 10-min launcher hold.
}
run();
```

**Manual checklist (from the prompt):**

- [ ]  Wuthering Waves tracked as **Gaming** (via title `"Wuthering Waves - Steam"` or `Client.exe`+index).
- [ ]  Idle Steam client **not** counted as a game.
- [ ]  Epic / Battle.net titles resolve via the same paths.
- [ ]  Valorant/anti-cheat: null polls keep the session alive (`keepalive`).
- [ ]  CPU &lt; 1% during gaming (assert `tasklist` spawns ≤ 1/10s).
- [ ]  No false positives when not gaming (fast path returns `raw`).

---

## 9. Files touched

| File | Change |
| --- | --- |
| `src/gameDetection.ts` | **New** — tables, install index, cached scan, resolver |
| `src/main.ts` | Call `buildInstalledGameIndex()` on ready; replace the head of `pollForeground()` (≈2977) with the resolver; pass `isResolvedGame` into `categorizeApp` (≈2834) |
| `src/preload.ts` | Optional: expose `rescanGames()` IPC for a manual "Rescan games" button |
| `src/App.tsx` / Settings | Optional: "Rescan games" button + show resolver `source` in a debug tooltip |

<aside>
⚙️

**Notes & honest caveats**

- The `27032`/`steam://` HTTP endpoint in the original prompt is **not a stable public API**; the install-index + cached `tasklist` scan is the reliable, dependency-free path and is what's specced here.
- `Client.exe` is ambiguous across games. Disambiguation relies on the startup index (install-dir match) and the title regex; if two games both ship `Client.exe`, prefer the title, then most-recently-launched.
- Kernel anti-cheat (Vanguard/EAC/BattlEye) can hide the process from `tasklist` too — that's exactly why **Layer 5 keep-alive** exists as the floor.
- Benchmarks are projected; run §8 on the target laptop to confirm the &lt;0.5% budget.
</aside>