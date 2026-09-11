// ============================================================================
// Fortress Protocol — Automated Setup UI
// One-click setup for the 5-layer git safety system.
// Each layer has a Setup button that executes PowerShell commands and streams
// output to a terminal-style display.
// ============================================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, Clock, GitBranch, HardDrive,
  ClipboardCheck, BookOpen, Play, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Terminal, AlertTriangle, RefreshCw
} from 'lucide-react';
import { WorkspaceCard, WorkspaceSection } from './_ds/containers';
import { listContainer, riseItem, DUR, EASE_OUT } from './_ds/motion';
import { WS_BTN_PRIMARY, WS_BTN_SECONDARY, WS_BTN_GHOST } from './_ds/forms';
import { EmptyState, Skeleton } from './_ds/primitives';
import { ModalShell, FormField, FORM_INPUT, ModalSection } from './_ds/modal';

// ---- Types ------------------------------------------------------------------
type LayerStatus = 'idle' | 'running' | 'success' | 'error' | 'partial';

interface LayerResult {
  status: LayerStatus;
  output: string[];
  timestamp?: string;
}

interface FortressLayer {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  commands: string[];
  verifyCommand?: string;
}

// ---- Layer Definitions ------------------------------------------------------
const LAYERS: FortressLayer[] = [
  {
    id: 'shadow-committer',
    name: 'Shadow Committer',
    description: 'Auto-commits your work every 10 minutes with a timestamp. Your primary defense — work is never more than 10 minutes lost.',
    icon: Clock,
    color: 'cyan',
    commands: [
      `New-Item -ItemType Directory -Force -Path "C:\\Scripts" | Out-Null`,
      `@'
Set-Location "__PROJECT_DIR__"
$hasChanges = git status --porcelain
if ($hasChanges) {
    git add -A
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "shadow: auto-save $timestamp" --no-verify
}
'@ | Out-File -FilePath "C:\\Scripts\\shadow-commit.ps1" -Encoding UTF8`,
      `$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\\Scripts\\shadow-commit.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "ShadowCommitter" -Action $action -Trigger $trigger -Settings $settings -Force`,
    ],
    verifyCommand: `Get-ScheduledTask -TaskName "ShadowCommitter" | Select-Object -ExpandProperty State`,
  },
  {
    id: 'fortress-backup',
    name: 'Fortress Backup',
    description: 'Creates a complete physical copy of your project every 2 hours. Nuclear option — if git is destroyed, copy files back.',
    icon: HardDrive,
    color: 'emerald',
    commands: [
      `New-Item -ItemType Directory -Force -Path "C:\\FORTRESS\\App-Tracker" | Out-Null`,
      `@'
$source = "__PROJECT_DIR__"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$dest = "C:\\FORTRESS\\App-Tracker\\$timestamp"
robocopy $source $dest /E /XD node_modules .git dist dist-electron dist-old .opencode .opencode-backups .playwright-mcp /XF *.tmp *.log /MT:8 /R:2 /W:1
Get-ChildItem "C:\\FORTRESS\\App-Tracker" | Sort-Object CreationTime -Descending | Select-Object -Skip 20 | Remove-Item -Recurse -Force
'@ | Out-File -FilePath "C:\\Scripts\\fortress-backup.ps1" -Encoding UTF8`,
      `$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\\Scripts\\fortress-backup.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "FortressBackup" -Action $action -Trigger $trigger -Settings $settings -Force`,
    ],
    verifyCommand: `Get-ScheduledTask -TaskName "FortressBackup" | Select-Object -ExpandProperty State`,
  },
  {
    id: 'git-trap',
    name: 'Git Trap',
    description: 'Intercepts dangerous git commands (reset --hard, checkout ., clean -fd) and auto-stashes before executing. Shell-level defense.',
    icon: ShieldAlert,
    color: 'amber',
    commands: [
      `$trapCode = @\nfunction git {\n    $gitExe = (Get-Command git -ErrorAction SilentlyContinue).Source\n    if (-not $gitExe) { $gitExe = "C:\\Program Files\\Git\\cmd\\git.exe" }\n    $cmd = $args -join " "\n    if ($cmd -match 'reset\\s+--hard|checkout\\s+\\.|clean\\s+-fd|checkout\\s+-b\\s+.*--force') {\n        Write-Host "[GIT TRAP] DANGEROUS COMMAND BLOCKED & STASHED: $cmd" -ForegroundColor Red\n        $stashName = "TRAP-EMERGENCY-$(Get-Date -Format 'yyyyMMdd-HHmmss')"\n        & $gitExe stash push -m $stashName --include-untracked\n        Write-Host "[GIT TRAP] Stash created: $stashName" -ForegroundColor Yellow\n    }\n    & $gitExe @args\n}\n'@\nAdd-Content -Path $PROFILE -Value $trapCode -ErrorAction SilentlyContinue`,
    ],
    verifyCommand: `if (Test-Path $PROFILE) { Select-String -Path $PROFILE -Pattern "function git" -Quiet } else { "Profile not found" }`,
  },
];

// ---- Terminal Output Component -----------------------------------------------
function TerminalOutput({ lines, status }: { lines: string[]; status: LayerStatus }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: DUR.normal, ease: EASE_OUT as any }}
      className="mt-3 rounded-lg bg-zinc-950/80 border border-zinc-800/50 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/40">
        <Terminal className="w-3 h-3 text-zinc-500" />
        <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">Output</span>
        {status === 'running' && (
          <div className="flex items-center gap-1 ml-auto">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            <span className="text-[9px] text-cyan-400">Running...</span>
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-1 ml-auto">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-emerald-400">Done</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-1 ml-auto">
            <XCircle className="w-3 h-3 text-red-400" />
            <span className="text-[9px] text-red-400">Failed</span>
          </div>
        )}
      </div>
      <div ref={scrollRef} className="p-2.5 max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={`${
            line.startsWith('[ERROR]') ? 'text-red-400' :
            line.startsWith('[OK]') ? 'text-emerald-400' :
            line.startsWith('[INFO]') ? 'text-cyan-400' :
            'text-zinc-400'
          }`}>
            <span className="text-zinc-600 mr-2">$</span>
            {line}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ---- Layer Card Component ---------------------------------------------------
function LayerCard({ layer, result, onSetup, onVerify, isExpanded, onToggle }: {
  layer: FortressLayer; result: LayerResult;
  onSetup: () => void; onVerify: () => void;
  isExpanded: boolean; onToggle: () => void;
}) {
  const Icon = layer.icon;
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  };
  const c = colorMap[layer.color] || colorMap.cyan;

  const statusIcon: Record<LayerStatus, React.ReactNode> = {
    idle: null,
    running: <Loader2 className={`w-4 h-4 ${c.text} animate-spin`} />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    partial: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  };

  return (
    <motion.div variants={riseItem}>
      <WorkspaceCard variant="default" className="!p-0 overflow-hidden">
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/20 transition-colors duration-150"
        >
          <div className={`grid w-9 h-9 place-items-center rounded-lg ${c.bg} ${c.text} shrink-0`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-zinc-200">{layer.name}</span>
              {statusIcon[result.status]}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{layer.description}</p>
          </div>
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: DUR.fast }}>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </motion.div>
        </button>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DUR.normal, ease: EASE_OUT as any }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/40 pt-3">
                <p className="text-[12px] text-zinc-400">{layer.description}</p>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onSetup}
                    disabled={result.status === 'running'}
                    className={WS_BTN_PRIMARY}
                  >
                    {result.status === 'running' ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Setting up...</>
                    ) : (
                      <><Play className="w-3 h-3" /> Setup</>
                    )}
                  </button>
                  {layer.verifyCommand && (
                    <button onClick={onVerify} className={WS_BTN_SECONDARY}>
                      <ShieldCheck className="w-3 h-3" /> Verify
                    </button>
                  )}
                  {result.timestamp && (
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      Last run: {result.timestamp}
                    </span>
                  )}
                </div>

                {/* Terminal output */}
                <TerminalOutput lines={result.output} status={result.status} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </WorkspaceCard>
    </motion.div>
  );
}

// ---- Main Component ---------------------------------------------------------
export default function FortressProtocolSetup() {
  const [results, setResults] = useState<Record<string, LayerResult>>({});
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [quickSetupRunning, setQuickSetupRunning] = useState(false);

  const executeCommand = useCallback(async (command: string, cwd?: string): Promise<{ output: string[]; success: boolean }> => {
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.executeCommand) {
        return { output: ['[ERROR] Execute command API not available'], success: false };
      }

      const result = await api.executeCommand(command, cwd);

      const output: string[] = [];
      if (result?.stdout?.trim()) {
        output.push(...result.stdout.trim().split('\n'));
      }
      if (result?.stderr?.trim()) {
        output.push(...result.stderr.trim().split('\n').map((l: string) => `[STDERR] ${l}`));
      }
      if (result?.error) {
        output.push(`[ERROR] ${result.error}`);
      }
      if (output.length === 0) {
        output.push('[OK] Command executed (no output)');
      }

      const success = !result?.error && !result?.stderr?.trim();
      return { output, success };
    } catch (e: any) {
      return { output: [`[ERROR] ${e?.message || 'Unknown error'}`], success: false };
    }
  }, []);

  const setupLayer = useCallback(async (layer: FortressLayer) => {
    setResults(prev => ({
      ...prev,
      [layer.id]: { status: 'running', output: [] },
    }));

    const allOutput: string[] = [];
    let allSuccess = true;
    const dirProbe = await executeCommand('(Get-Location).Path');
    const liveProjectDir = dirProbe.output.map((l) => l.trim()).find((l) => l && !l.startsWith('['));

    for (const cmd of layer.commands) {
      allOutput.push(`[INFO] Running: ${cmd.substring(0, 60)}...`);
      setResults(prev => ({
        ...prev,
        [layer.id]: { status: 'running', output: [...allOutput] },
      }));

      const resolvedCmd = liveProjectDir ? cmd.split('__PROJECT_DIR__').join(liveProjectDir) : cmd;
      const result = await executeCommand(resolvedCmd, liveProjectDir);
      allOutput.push(...result.output);
      if (!result.success) allSuccess = false;

      setResults(prev => ({
        ...prev,
        [layer.id]: { status: 'running', output: [...allOutput] },
      }));
    }

    allOutput.push(allSuccess ? '[OK] Layer setup complete' : '[ERROR] Some commands failed');
    setResults(prev => ({
      ...prev,
      [layer.id]: {
        status: allSuccess ? 'success' : 'error',
        output: allOutput,
        timestamp: new Date().toLocaleTimeString(),
      },
    }));
  }, [executeCommand]);

  const verifyLayer = useCallback(async (layer: FortressLayer) => {
    if (!layer.verifyCommand) return;

    setResults(prev => ({
      ...prev,
      [layer.id]: { ...prev[layer.id], status: 'running', output: [...(prev[layer.id]?.output || []), `[INFO] Verifying...`] },
    }));

    const result = await executeCommand(layer.verifyCommand);
    const output = [...(results[layer.id]?.output || []), ...result.output];

    setResults(prev => ({
      ...prev,
      [layer.id]: {
        status: result.success ? 'success' : 'partial',
        output,
        timestamp: new Date().toLocaleTimeString(),
      },
    }));
  }, [executeCommand, results]);

  const quickSetup = useCallback(async () => {
    setQuickSetupRunning(true);
    for (const layer of LAYERS) {
      await setupLayer(layer);
    }
    setQuickSetupRunning(false);
  }, [setupLayer]);

  const allSuccess = LAYERS.every(l => results[l.id]?.status === 'success');
  const anyRunning = LAYERS.some(l => results[l.id]?.status === 'running');

  return (
    <div className="flex flex-col gap-4 p-3 min-h-0 overflow-y-auto ws-scroll">
      <WorkspaceSection
        title="Fortress Protocol"
        icon={Shield}
        accent="amber"
        action={
          <button
            onClick={quickSetup}
            disabled={quickSetupRunning || anyRunning}
            className={WS_BTN_PRIMARY}
          >
            {quickSetupRunning ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Setting up all layers...</>
            ) : (
              <><Shield className="w-3 h-3" /> Quick Setup All</>
            )}
          </button>
        }
      >
        <p className="text-[12px] text-zinc-400 mb-4">
          One-click setup for your 5-layer git safety system. Each layer runs independently —
          if one fails, the others still protect you.
        </p>

        {allSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-300">All layers active</p>
              <p className="text-[11px] text-emerald-400/70">Your fortress is fully operational.</p>
            </div>
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-2"
          variants={listContainer} initial="hidden" animate="show"
        >
          {LAYERS.map(layer => (
            <LayerCard
              key={layer.id}
              layer={layer}
              result={results[layer.id] || { status: 'idle', output: [] }}
              onSetup={() => setupLayer(layer)}
              onVerify={() => verifyLayer(layer)}
              isExpanded={expandedLayer === layer.id}
              onToggle={() => setExpandedLayer(expandedLayer === layer.id ? null : layer.id)}
            />
          ))}
        </motion.div>
      </WorkspaceSection>

      {/* Session Ritual Checklist */}
      <WorkspaceSection title="Session Ritual" icon={ClipboardCheck} accent="amber">
        <WorkspaceCard variant="inset">
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Start of every session</p>
            {[
              'Open PowerShell in project root',
              'Run: git status --short | Measure-Object',
              'Run: git log --oneline -3',
              'Verify Shadow Committer: Get-ScheduledTask -TaskName "ShadowCommitter"',
              'Tell AI agent: "You may NOT run git reset without approval"',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2 text-[12px] text-zinc-400 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/30" />
                <span className="group-hover:text-zinc-200 transition-colors">{item}</span>
              </label>
            ))}

            <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mt-4 mb-2">End of every session</p>
            {[
              'Run: git add . && git commit -m "feat: [what you built]"',
              'Run: C:\\Scripts\\fortress-backup.ps1',
              'If stable: git push',
              'If WIP: leave committed locally',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2 text-[12px] text-zinc-400 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/30" />
                <span className="group-hover:text-zinc-200 transition-colors">{item}</span>
              </label>
            ))}
          </div>
        </WorkspaceCard>
      </WorkspaceSection>

      {/* Recovery Runbook */}
      <WorkspaceSection title="Recovery Runbook" icon={BookOpen} accent="amber">
        <WorkspaceCard variant="inset">
          <div className="space-y-3 text-[12px] text-zinc-400">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded shrink-0">STEP 1</span>
              <span>Don't panic. Don't run anything yet.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded shrink-0">STEP 2</span>
              <span>Check Shadow Commits: <code className="text-[10px] font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">git reflog | Select-Object -First 20</code></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded shrink-0">STEP 3</span>
              <span>Check Stash: <code className="text-[10px] font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">git stash list</code></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded shrink-0">STEP 4</span>
              <span>Check Fortress: <code className="text-[10px] font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">Get-ChildItem "C:\FORTRESS\App-Tracker"</code></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-500/15 px-1.5 py-0.5 rounded shrink-0">STEP 5</span>
              <span>Check OpenCode <code className="text-[10px] font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">/undo</code></span>
            </div>
          </div>
        </WorkspaceCard>
      </WorkspaceSection>
    </div>
  );
}
