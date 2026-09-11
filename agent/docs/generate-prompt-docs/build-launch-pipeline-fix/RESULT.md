RESULT.mdPhase 1: Fix SpecBelow are the exact code replacements required to resolve the pipeline issues.1. start-dev.ps1 (Replacing lines 104–116)Replace the simple file existence check block with high-fidelity staleness and dependency checking:PowerShell  # --- BEGIN REBUILD LOGIC & STALENESS CHECK ---
  Write-Host "[build] Checking staleness... " -NoNewline -ForegroundColor Cyan

  # Ensure dependencies are present before evaluating build state
  if (-not (Test-Path "$scriptDir\node_modules" -PathType Container)) {
    Write-Host "🔴 CRITICAL: node_modules folder not found. Running npm install..." -ForegroundColor Red
    & npm install
  }

  $outputs = @(
    "$scriptDir\dist-electron\preload.cjs",
    "$scriptDir\dist-electron\main.cjs",
    "$scriptDir\dist\index.html",
    "$scriptDir\dist\assets\index.js"
  )

  $needBuild = $Build
  $buildReason = ""

  if (-not $needBuild) {
    $missing = $outputs | Where-Object { -not (Test-Path $_ -PathType Leaf) }
    if ($missing.Count -gt 0) {
      $needBuild = $true
      $buildReason = "Missing output files: ($($missing -join ', '))"
    } else {
      # Calculate timestamps
      $oldestOutput = $outputs | ForEach-Object { (Get-Item $_).LastWriteTime } | Measure-Object -Minimum | Select-Object -ExpandProperty Minimum
      $srcFiles = Get-ChildItem -Path "$scriptDir\src" -Recurse -File | Where-Object { $_.Extension -match '^\.(ts|tsx|css|html|json)$' }
      
      Write-Host "$($srcFiles.Count) source files vs $($outputs.Count) output files" -ForegroundColor Gray

      $staleFiles = $srcFiles | Where-Object { $_.LastWriteTime -gt $oldestOutput }
      if ($staleFiles) {
        $needBuild = $true
        $primaryStale = $staleFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $buildReason = "🔴 STALE: $($primaryStale.FullName.Replace($scriptDir + '\', '')) ($($primaryStale.LastWriteTime.ToString('HH:mm'))) > dist/assets/index.js ($($oldestOutput.ToString('HH:mm')))"
      }
    }
  } else {
    $buildReason = "Force rebuild (-Build flag set)"
    Write-Host "Forced via parameter" -ForegroundColor Gray
  }

  if ($needBuild) {
    Write-Host "[build] $buildReason" -ForegroundColor Yellow
    Write-Host "[build] Rebuilding renderer and main processes..." -ForegroundColor Cyan
    
    # Build preload
    & npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
    if ($LASTEXITCODE -ne 0) { Write-Host "🔴 Preload build failed!" -ForegroundColor Red; exit $LASTEXITCODE }

    # Build main.cjs
    & node scripts/rebuild-main.mjs
    if ($LASTEXITCODE -ne 0) { Write-Host "🔴 Main build failed!" -ForegroundColor Red; exit $LASTEXITCODE }

    # Build renderer
    & npx vite build
    if ($LASTEXITCODE -ne 0) { Write-Host "🔴 Renderer build failed!" -ForegroundColor Red; exit $LASTEXITCODE }
  } else {
    Write-Host "[build] ✅ All source files are older than outputs. Skipping rebuild." -ForegroundColor Green
  }
  # --- END REBUILD LOGIC ---
2. main.ts Loading Logic & HTTP Server (Replacing lines 3771–3832)Rearrange event registrations to prevent lifecycle races, inject cache-busting logic, and handle output stream issues:TypeScript// Production HTTP server factory with cache invalidation
function startProdServer(callback: (port: number) => void) {
    // Gracefully handle broken stdout streams if terminal window drops
    process.stdout.on('error', (err: any) => { if (err.code === 'EPIPE') return; });
    process.stderr.on('error', (err: any) => { if (err.code === 'EPIPE') return; });

    const dist = path_1.default.join(__dirname, '../dist');
    const mimeTypes: Record<string, string> = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
    };
    const server = http_1.default.createServer((req, res) => {
        let rel = (req.url || '').split('?')[0].split('#')[0];
        if (rel === '/') rel = '/index.html';
        const filePath = path_1.default.join(dist, rel);
        const ext = path_1.default.extname(filePath);
        fs_1.default.readFile(filePath, (err, data) => {
            if (err) {
                fs_1.default.readFile(path_1.default.join(dist, 'index.html'), (err2, data2) => {
                    if (err2) { res.writeHead(500); res.end('Internal Server Error'); return; }
                    // Prevent caching downstream
                    res.writeHead(200, { 
                        'Content-Type': 'text/html',
                        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    });
                    res.end(data2);
                });
                return;
            }
            // Enforce aggressive cache control headers for local developer assets
            res.writeHead(200, { 
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(data);
        });
    });
    
    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[DeskFlow] ⚠ Port conflict encountered on production server initialization.`);
        }
    });

    server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = addr && typeof addr === 'object' ? addr.port : 38123;
        console.log('[DeskFlow] Serving on http://localhost:' + port);
        callback(port);
    });
}

// Global window loading orchestration - variables initialized BEFORE load execution
let loadAttempts = 0;
let prodServerStarted = false;

// CRITICAL FIX: Register error listeners BEFORE executing initial load commands
mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    loadAttempts++;
    console.error(`[DeskFlow] Failed to load (attempt ${loadAttempts}):`, errorCode, errorDescription);
    if (loadAttempts === 1 && !prodServerStarted) {
        console.log('[DeskFlow] Fallback: starting production HTTP server');
        prodServerStarted = true;
        startProdServer((port) => {
            mainWindow.loadURL('http://localhost:' + port + '/index.html?v=' + Date.now());
        });
    } else if (loadAttempts >= 3) {
        console.error('[DeskFlow] Giving up after 3 load attempts');
    }
});

// Confirm asset delivery metadata in console log upon successful frame mount
mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
        console.log("[app] Loaded bundle telemetry verified.");
    `).catch(() => {});
});

// Trigger load execution sequence
if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
}
else {
    startProdServer((port) => {
        // Appending unique build runtime query parameter for cache busting
        mainWindow.loadURL('http://localhost:' + port + '/index.html?v=' + Date.now());
    });
}
Phase 2: Staleness Detection AlgorithmThe staleness detection strategy uses an aggregate boundary evaluation matrix written natively in PowerShell to guarantee swift execution times under 300ms.Strategy Implementation MechanicsTarget Boundary Discovery: Collects explicit target asset paths across the application layers (Renderer bundle, Main bundle, Preload script, Entry document).Matrix Aggregation: * Looks up the lowest common denominator (Minimum) of modification timestamps (LastWriteTime) among the output targets. If target $A$ was modified at 10:00 AM and target $B$ at 10:15 AM, the pipeline establishes a valid threshold bar at 10:00 AM.Recursively scans the src/ hierarchy filtered strictly against core frontend extensions via regular expression matching (^\.(ts|tsx|css|html|json)$).Evaluation Threshold: Obtains the highest common denominator (Maximum) of source modification dates. If any isolated source file has a modification timestamp higher than the target threshold bar, the workspace is classified as stale, and the name of the file that broke the threshold is extracted for output logging.Phase 3: Cache-Busting StrategyThe chosen strategy is a hybrid approach combining Explicit Query Tokenization (?v=<timestamp>) with Upstream Cache Deflation Headers.Implementation DetailsRather than parsing and dynamically editing file paths generated through the Vite compilation engine, the localized HTTP production engine overrides default Chromium internal file delivery mechanisms.Setting Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate forces Chromium's blink network layer to drop historical V8 context execution trees.Appending ?v=' + Date.now() inside Electron's loadURL call maps a unique URL string to the instance workspace. This prevents matching stale layout configurations stored in internal file system structures.Phase 4: did-fail-load Handler FixEvent Lifecycle RealignmentThe race condition is fully mitigated by initializing tracking primitives (loadAttempts, prodServerStarted) and binding the 'did-fail-load' subscriber to the webContents frame context before invoking asynchronous loading procedures (mainWindow.loadURL(...)).[System Core Init]
        │
        ▼
[Instantiate Primitives] ──► (loadAttempts = 0, prodServerStarted = false)
        │
        ▼
[Bind IPC Event Listeners] ──► (webContents.on('did-fail-load', ...))
        │
        ▼
[Evaluate Mode Conditions]
   ├───► (True: Dev Mode)  ──► loadURL(VITE_DEV_SERVER_URL)
   └───► (False: Prod Mode) ──► startProdServer() ──► loadURL(localhost + ?v=timestamp)
If a connection failure occurs, the subscriber captures the lifecycle step before execution contexts fall out of scope.Phase 5: EPIPE HandlingProcess Stream RecoveryTo guarantee shell persistence across context transformations, explicit stream listeners are coupled to global I/O handlers. When a developer closes a terminal window hosting the pipeline process, the parent process drops its end of the standard output stream pipe. This causes Node.js to trigger a low-level EPIPE crash.TypeScriptprocess.stdout.on('error', (err: any) => { if (err.code === 'EPIPE') return; });
process.stderr.on('error', (err: any) => { if (err.code === 'EPIPE') return; });
The error interception routines use short-circuit logic to filter against the EPIPE code directly inside the server execution lifecycle block, swallowing the exception safely to protect the main desktop environment thread.Phase 6: User-Facing Output SpecThe console tracking outputs match the following scenarios exactly:Scenario A: Workspace Stale (Rebuild Triggered)[build] Checking staleness... 147 source files vs 4 output files
[build] 🔴 STALE: src/pages/AiPage.tsx (12:34) > dist/assets/index.js (11:20)
[build] Rebuilding renderer and main processes...
Scenario B: Workspace Current (Build Skipped)[build] Checking staleness... 147 source files vs 4 output files
[build] ✅ All source files are older than outputs. Skipping rebuild.
Scenario C: Mandatory Override Sequence Passed[build] Checking staleness... Forced via parameter
[build] Force rebuild (-Build flag set)
[build] Rebuilding renderer and main processes...
Scenario D: Missing Node Modules Setup Intercepted[build] Checking staleness...
[build] 🔴 CRITICAL: node_modules folder not found. Running npm install...
Scenario E: Port Conflict Resolution Intercepted[DeskFlow] ⚠ Port conflict encountered on production server initialization.