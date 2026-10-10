import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldOff, AlertTriangle, Terminal, Plus, X, CheckCircle2 } from 'lucide-react';
import type { GitSafetySettings, GitSafetyCheckResult } from '../types/deskflow-api';

export default function GitSafetyPanel() {
  const [settings, setSettings] = useState<GitSafetySettings | null>(null);
  const [testCommand, setTestCommand] = useState('');
  const [testResult, setTestResult] = useState<GitSafetyCheckResult | null>(null);
  const [customPatternInput, setCustomPatternInput] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const s = await window.deskflowAPI?.gitSafety.getSettings();
    setSettings(s || null);
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const updateSetting = async (key: string, value: boolean | string[]) => {
    await window.deskflowAPI?.gitSafety.setSettings({ [key]: value });
    await loadSettings();
  };

  const handleTestCommand = async () => {
    if (!testCommand.trim()) return;
    const result = await window.deskflowAPI?.gitSafety.check(testCommand);
    setTestResult(result || null);
  };

  const addCustomPattern = () => {
    if (!customPatternInput.trim() || !settings) return;
    const newPatterns = [...(settings.customPatterns || []), customPatternInput.trim()];
    updateSetting('customPatterns', newPatterns);
    setCustomPatternInput('');
  };

  const removeCustomPattern = (index: number) => {
    if (!settings) return;
    const newPatterns = settings.customPatterns.filter((_, i) => i !== index);
    updateSetting('customPatterns', newPatterns);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">
        Loading...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {settings.enabled ? (
            <Shield className="w-4 h-4 text-green-400" />
          ) : (
            <ShieldOff className="w-4 h-4 text-zinc-500" />
          )}
          <span className="text-xs font-semibold text-zinc-200">Git Safety Layer</span>
        </div>
        <button
          onClick={() => updateSetting('enabled', !settings.enabled)}
          className={`relative w-9 h-5 rounded-full transition-all duration-200 ${
            settings.enabled ? 'bg-green-600' : 'bg-zinc-700'
          }`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
            settings.enabled ? 'left-4' : 'left-0.5'
          }`} />
        </button>
      </div>

      <div className="text-[10px] text-zinc-500 leading-relaxed">
        Intercepts dangerous git commands before they reach the terminal PTY.
        Blocks patterns like <code className="text-zinc-400">git reset --hard</code>,{' '}
        <code className="text-zinc-400">git push --force</code>, and{' '}
        <code className="text-zinc-400">rm -rf</code>. User must type CONFIRM to authorize.
      </div>

      {/* Pattern Toggles */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Dangerous Patterns</div>
        <ToggleRow
          label="Block git reset --hard"
          enabled={settings.blockHardReset}
          onChange={(v) => updateSetting('blockHardReset', v)}
        />
        <ToggleRow
          label="Block git push --force"
          enabled={settings.blockForcePush}
          onChange={(v) => updateSetting('blockForcePush', v)}
        />
        <ToggleRow
          label="Block destructive commands (rm -rf, git clean -fd)"
          enabled={settings.blockDestructive}
          onChange={(v) => updateSetting('blockDestructive', v)}
        />
        <ToggleRow
          label="Block git branch -D"
          enabled={settings.blockBranchDelete}
          onChange={(v) => updateSetting('blockBranchDelete', v)}
        />
      </div>

      {/* Custom Patterns */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Custom Patterns (regex)</div>
        <div className="flex gap-1">
          <input
            type="text"
            value={customPatternInput}
            onChange={(e) => setCustomPatternInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomPattern(); }}
            placeholder="e.g., ^drop\s+database"
            className="flex-1 px-2 py-1.5 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/60 rounded text-xs text-zinc-200 placeholder-zinc-600 font-mono"
          />
          <button
            onClick={addCustomPattern}
            className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {settings.customPatterns.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {settings.customPatterns.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1 bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-800/40">
                <code className="text-[10px] text-zinc-400 font-mono truncate">{p}</code>
                <button onClick={() => removeCustomPattern(i)} className="text-zinc-600 hover:text-red-400 transition shrink-0 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Command */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Test Command</div>
        <div className="flex gap-1">
          <input
            type="text"
            value={testCommand}
            onChange={(e) => setTestCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTestCommand(); }}
            placeholder="Type a command to test..."
            className="flex-1 px-2 py-1.5 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/60 rounded text-xs text-zinc-200 placeholder-zinc-600 font-mono"
          />
          <button
            onClick={handleTestCommand}
            className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition flex items-center gap-1"
          >
            <Terminal className="w-3.5 h-3.5" />
            Test
          </button>
        </div>
        {testResult && (
          <div className={`flex items-start gap-2 px-2 py-1.5 rounded text-[10px] ${
            testResult.dangerous ? 'bg-red-950/40 border border-red-900/40' : 'bg-green-950/40 border border-green-900/40'
          }`}>
            {testResult.dangerous ? (
              <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
            )}
            <div>
              <div className={testResult.dangerous ? 'text-red-300' : 'text-green-300'}>
                {testResult.dangerous ? 'Blocked' : 'Safe'}
              </div>
              {testResult.dangerous && (
                <div className="text-zinc-400 mt-0.5">
                  Patterns: {testResult.patterns.join(', ')}
                  {testResult.suggestion && <div className="mt-0.5 text-zinc-500">Suggestion: {testResult.suggestion}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-800/30">
      <span className="text-xs text-zinc-300">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-8 h-4 rounded-full transition-all duration-200 ${
          enabled ? 'bg-green-600' : 'bg-zinc-700'
        }`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${
          enabled ? 'left-4' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}
