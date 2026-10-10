/**
 * Settings Panel — Context Maintenance Configuration
 * 
 * Allows users to configure:
 * - Auto-compaction settings
 * - Token budgets
 * - RAG search modes
 * - Context inclusion preferences
 * 
 * Location: src/components/context-ui/SettingsPanel.tsx
 */

import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';

import type { SettingsPanelProps, ContextMaintenanceConfig } from '@/types/context';

// ──────────────────────────────────────────────────────────────
// Settings Panel Component
// ──────────────────────────────────────────────────────────────

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<ContextMaintenanceConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track if config has changed
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(localConfig);
    setHasChanges(changed);
  }, [localConfig, config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localConfig);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalConfig(config);
    setHasChanges(false);
  };

  const updateConfig = (updates: Partial<ContextMaintenanceConfig>) => {
    setLocalConfig({ ...localConfig, ...updates });
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Auto-Compaction Section */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase">Auto-Compaction</h3>

        {/* Enable/Disable */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localConfig.autoCompactionEnabled}
            onChange={e =>
              updateConfig({ autoCompactionEnabled: e.target.checked })
            }
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-pointer accent-emerald-500"
          />
          <span className="text-sm text-gray-300">Enable automatic message compaction</span>
        </label>

        {/* Compaction triggers */}
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-400">Compact when:</p>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Message count exceeds:{' '}
              <span className="font-mono text-emerald-400">
                {localConfig.compactionTrigger.messageCount}
              </span>
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={localConfig.compactionTrigger.messageCount}
              onChange={e =>
                updateConfig({
                  compactionTrigger: {
                    ...localConfig.compactionTrigger,
                    messageCount: parseInt(e.target.value),
                  },
                })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>50</span>
              <span>500</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Time interval:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map(interval => (
                <button
                  key={interval}
                  onClick={() =>
                    updateConfig({
                      compactionTrigger: {
                        ...localConfig.compactionTrigger,
                        interval,
                      },
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    localConfig.compactionTrigger.interval === interval
                      ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                      : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {interval.charAt(0).toUpperCase() + interval.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RAG Search Section */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase">Search Configuration</h3>

        <p className="text-xs text-gray-400">Search modes to include:</p>

        <div className="space-y-2">
          {(['semantic', 'fulltext'] as const).map(mode => (
            <label key={mode} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.ragSearchMode.includes(mode)}
                onChange={e => {
                  const newMode = e.target.checked
                    ? [...localConfig.ragSearchMode, mode]
                    : localConfig.ragSearchMode.filter(m => m !== mode);
                  updateConfig({ ragSearchMode: newMode });
                }}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-pointer accent-indigo-500"
              />
              <span className="text-sm text-gray-300 capitalize">{mode} Search</span>
              <span className="text-xs text-gray-600">
                {mode === 'semantic' ? '(embeddings)' : '(keywords)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Context Inclusion Section */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase">Context Inclusion</h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localConfig.includeRAGInPrompt}
            onChange={e =>
              updateConfig({ includeRAGInPrompt: e.target.checked })
            }
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-pointer accent-indigo-500"
          />
          <span className="text-sm text-gray-300">Include RAG search results in agent prompt</span>
        </label>

        <p className="text-xs text-gray-500">
          When enabled, relevant recent messages will be prepended to the agent's system prompt.
        </p>
      </div>

      {/* Token Budget Section */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase">Token Budgets</h3>

        {/* Project Context Budget */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Project Context:{' '}
            <span className="font-mono text-emerald-400">
              {localConfig.tokenBudgets.projectContext}
            </span>
            {' '}tokens
          </label>
          <input
            type="range"
            min="1000"
            max="12000"
            step="500"
            value={localConfig.tokenBudgets.projectContext}
            onChange={e =>
              updateConfig({
                tokenBudgets: {
                  ...localConfig.tokenBudgets,
                  projectContext: parseInt(e.target.value),
                },
              })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>1K</span>
            <span>12K</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Maximum tokens available for project-wide contexts
          </p>
        </div>

        {/* Session Context Budget */}
        <div className="pt-3 border-t border-gray-700">
          <label className="text-xs text-gray-400 block mb-1">
            Session Context:{' '}
            <span className="font-mono text-indigo-400">
              {localConfig.tokenBudgets.sessionContext}
            </span>
            {' '}tokens
          </label>
          <input
            type="range"
            min="2000"
            max="16000"
            step="500"
            value={localConfig.tokenBudgets.sessionContext}
            onChange={e =>
              updateConfig({
                tokenBudgets: {
                  ...localConfig.tokenBudgets,
                  sessionContext: parseInt(e.target.value),
                },
              })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>2K</span>
            <span>16K</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Maximum tokens available for current session context
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg font-medium text-sm transition-colors"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      {/* Info footer */}
      <div className="p-3 bg-gray-700/30 rounded border border-gray-700 text-xs text-gray-400">
        <p>
          Changes are saved locally. Adjust token budgets to balance context richness vs. token efficiency.
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
