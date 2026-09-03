$ErrorActionPreference = 'Stop'
$script:DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:SHOTS = Join-Path $DIR 'design\media\shots'
$script:CLIPS = Join-Path $DIR 'design\media\clips'

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
Ensure-Dir $SHOTS
Ensure-Dir $CLIPS

Write-Host "=== RHEO App Media Capture ===" -ForegroundColor Cyan
Write-Host "Shots -> $SHOTS" -ForegroundColor DarkGray
Write-Host "Clips -> $CLIPS" -ForegroundColor DarkGray

# Kill stale RHEO instances
Write-Host "[preflight] Killing stale instances..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -Filter "Name = 'electron.exe' OR Name = 'RHEO.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.ExecutablePath -and $_.ExecutablePath -like "*$DIR*") {
    Write-Host "  kill PID $($_.ProcessId)" -ForegroundColor DarkYellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Milliseconds 500

$nodeScript = @"
const { electron: electronPw } = require('playwright');
const path = require('path');

(async () => {
  const projectPath = process.argv[1];
  const shotsDir = process.argv[2];
  const clipsDir = process.argv[3];

  const app = await electronPw.launch({
    args: [projectPath],
  });
  const page = await app.firstWindow();

  await page.setViewportSize({ width: 1280, height: 800 });

  // Wait for app to render
  await page.waitForTimeout(4000);

  async function shot(name) {
    const p = path.join(shotsDir, name + '.png');
    await page.screenshot({ path: p, fullPage: false });
    console.log('shot: ' + name);
  }

  async function videoClip(name, fn, ms = 10000) {
    const p = path.join(clipsDir, name + '.webm');
    await page.video.startRecording({ path: p });
    await fn(page);
    await page.waitForTimeout(ms);
    await page.video.stopRecording();
    console.log('clip: ' + name);
  }

  // --- Screenshots ---
  await shot('app-1280x800');

  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(500);
  await shot('app-375x800');

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.waitForTimeout(500);
  await shot('app-og-hero');

  await page.setViewportSize({ width: 1280, height: 800 });

  // --- Recordings ---
  await videoClip('app-idle-10s', async (p) => {
    // just hold the frame for 10s
  }, 10000);

  console.log('DONE');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
"@

$nodeScriptPath = Join-Path $DIR 'capture-app-pw.js'
Set-Content -Path $nodeScriptPath -Value $nodeScript -Encoding UTF8

Push-Location $DIR
$env:PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
$out = node $nodeScriptPath $DIR $SHOTS $CLIPS 2>&1
Pop-Location

Write-Host "[capture] Playwright output:" -ForegroundColor Cyan
$out | ForEach-Object { Write-Host "  $_" }

Remove-Item $nodeScriptPath -ErrorAction SilentlyContinue

Write-Host "`nDone. Shots in $SHOTS" -ForegroundColor Green
Write-Host "Clips in $CLIPS" -ForegroundColor Green
