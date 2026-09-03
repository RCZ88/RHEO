import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'design', 'media', 'shots');
mkdirSync(OUT, { recursive: true });

// Get the main window handle of RHEO
const output = execSync(
  'powershell -Command "(Get-Process RHEO | Where-Object { $_.MainWindowTitle -ne \'\' } | Select-Object -First 1).MainWindowHandle.ToInt64()"',
  { encoding: 'utf-8' }
).trim();

console.log(`RHEO main window handle: ${output}`);

// Use PowerShell to bring it to front and take screenshot
const hwnd = parseInt(output, 10);
if (!isNaN(hwnd) && hwnd !== 0) {
  execSync(
    `powershell -Command "Add-Type @' using System; using System.Runtime.InteropServices; public static class W { [DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); } '@; [W]::ShowWindow([IntPtr]::new(${hwnd}), 9); [W]::SetForegroundWindow([IntPtr]::new(${hwnd})); Start-Sleep -Milliseconds 500"`,
    { stdio: 'inherit' }
  );
}
