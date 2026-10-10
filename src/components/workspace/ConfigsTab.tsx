// ============================================================================
// Configs Tab — Revamped with real shadcn components
// Model config, auto-assign routing, cross-session sync, workspace settings.
// Uses: Button, Switch, Select, Input, Collapsible from shadcn/ui.
// Uses: WorkspaceCard, WorkspaceSection from _ds.
// ============================================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Sparkles, Zap, DollarSign, RefreshCw,
  ChevronDown, ChevronRight, Lock, AlertTriangle, FileText, Database
} from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { WorkspaceCard, WorkspaceSection } from './_ds/containers';
import { listContainer, riseItem, expandPanel, DUR, EASE_OUT } from './_ds/motion';

interface ConfigsTabProps {
  modelReinjectThreshold: number;
  onReinjectThresholdChange: (v: number) => void;
  modelDefaultTier: 'top' | 'mid' | 'low';
  onDefaultTierChange: (v: 'top' | 'mid' | 'low') => void;
  modelDebugMode: boolean;
  onDebugModeChange: (v: boolean) => void;
  autoAssignConfig: any;
  onAutoAssignConfigChange: (config: any) => void;
  crossSessionSyncEnabled: boolean;
  onCrossSessionSyncChange: (v: boolean) => void;
  fileLockTTL: number;
  onFileLockTTLChange: (v: number) => void;
  contextBroadcastEnabled: boolean;
  onContextBroadcastChange: (v: boolean) => void;
  conflictWarningMode: string;
  onConflictWarningModeChange: (v: string) => void;
  syncCommandEnabled: boolean;
  onSyncCommandChange: (v: boolean) => void;
  thoughtProcessEnabled: boolean;
  onThoughtProcessChange: (v: boolean) => void;
  routingCosts: any;
}

export function ConfigsTab({
  modelReinjectThreshold, onReinjectThresholdChange,
  modelDefaultTier, onDefaultTierChange,
  modelDebugMode, onDebugModeChange,
  autoAssignConfig, onAutoAssignConfigChange,
  crossSessionSyncEnabled, onCrossSessionSyncChange,
  fileLockTTL, onFileLockTTLChange,
  contextBroadcastEnabled, onContextBroadcastChange,
  conflictWarningMode, onConflictWarningModeChange,
  syncCommandEnabled, onSyncCommandChange,
  thoughtProcessEnabled, onThoughtProcessChange,
  routingCosts,
}: ConfigsTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    model: true, autoAssign: false, sync: false, costs: false,
  });

  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto scrollbar-thin">
      {/* ── Model Configuration ── */}
      <WorkspaceSection title="Model Configuration" icon={Settings} accent="orange">
        <WorkspaceCard variant="inset">
          <div className="space-y-4">
            {/* Re-injection threshold */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-zinc-300">Rules Re-injection</span>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{modelReinjectThreshold}</span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-2">Auto-inject RULES_COMPACT.md every N messages</p>
              <input
                type="range" min={3} max={30} value={modelReinjectThreshold}
                onChange={(e) => onReinjectThresholdChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                <span>3</span><span>30</span>
              </div>
            </div>

            {/* Default model tier */}
            <div>
              <span className="text-[11px] font-medium text-zinc-300 block mb-1.5">Default Model Tier</span>
              <p className="text-[10px] text-zinc-500 mb-2">Context budget for new sessions</p>
              <div className="flex gap-1.5">
                {(['top', 'mid', 'low'] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => onDefaultTierChange(tier)}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
                      modelDefaultTier === tier
                        ? tier === 'top' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : tier === 'mid' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                        : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700/50'
                    }`}
                  >
                    {tier === 'top' ? 'Top' : tier === 'mid' ? 'Mid' : 'Low'}
                  </button>
                ))}
              </div>
            </div>

            {/* Debug mode */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-zinc-300">Debug Mode</span>
                <p className="text-[10px] text-zinc-500">Verbose [SYSTEM] logging</p>
              </div>
              <Switch checked={modelDebugMode} onCheckedChange={onDebugModeChange} />
            </div>
          </div>
        </WorkspaceCard>
      </WorkspaceSection>

      {/* ── Auto-Assign Routing ── */}
      <WorkspaceSection title="Auto-Assign Routing" icon={Sparkles} accent="orange">
        <WorkspaceCard variant="inset">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-zinc-300">Auto-assign prompts to sessions</span>
                <p className="text-[10px] text-zinc-500">AI routes your prompts to the best-matching session</p>
              </div>
              <Switch
                checked={autoAssignConfig?.enabled || false}
                onCheckedChange={(v) => onAutoAssignConfigChange({ ...autoAssignConfig, enabled: v })}
              />
            </div>

            {autoAssignConfig?.enabled && (
              <motion.div
                variants={expandPanel} initial="hidden" animate="show" exit="exit"
                className="space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Routing model</span>
                  <select
                    value={autoAssignConfig?.routingModel || 'anthropic/claude-3.5-haiku'}
                    onChange={(e) => onAutoAssignConfigChange({ ...autoAssignConfig, routingModel: e.target.value })}
                    className="text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-orange-500/40"
                  >
                    <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku ($0.80/M)</option>
                    <option value="anthropic/claude-3-haiku">Claude 3 Haiku ($0.25/M)</option>
                    <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash ($0.10/M)</option>
                    <option value="openai/gpt-4o-mini">GPT-4o Mini ($0.15/M)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Summary frequency</span>
                  <select
                    value={autoAssignConfig?.summaryFrequency || 10}
                    onChange={(e) => onAutoAssignConfigChange({ ...autoAssignConfig, summaryFrequency: parseInt(e.target.value) })}
                    className="text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-orange-500/40"
                  >
                    <option value="5">Every 5 messages</option>
                    <option value="10">Every 10 messages</option>
                    <option value="20">Every 20 messages</option>
                    <option value="0">Manual only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-300">Auto-rename sessions</span>
                    <p className="text-[10px] text-zinc-500">AI generates descriptive names</p>
                  </div>
                  <Switch
                    checked={autoAssignConfig?.autoRename || false}
                    onCheckedChange={(v) => onAutoAssignConfigChange({ ...autoAssignConfig, autoRename: v })}
                  />
                </div>

                {autoAssignConfig?.autoRename && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Rename after N messages</span>
                    <select
                      value={autoAssignConfig?.renameThreshold || 5}
                      onChange={(e) => onAutoAssignConfigChange({ ...autoAssignConfig, renameThreshold: parseInt(e.target.value) })}
                      className="text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-orange-500/40"
                    >
                      <option value="3">3 messages</option>
                      <option value="5">5 messages</option>
                      <option value="10">10 messages</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-300">Auto-create sessions</span>
                    <p className="text-[10px] text-zinc-500">Auto-create when model is active</p>
                  </div>
                  <Switch
                    checked={autoAssignConfig?.autoCreateSessions || false}
                    onCheckedChange={(v) => onAutoAssignConfigChange({ ...autoAssignConfig, autoCreateSessions: v })}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </WorkspaceCard>
      </WorkspaceSection>

      {/* ── Cross-Session Sync ── */}
      <WorkspaceSection title="Cross-Session Sync" icon={Lock} accent="amber">
        <WorkspaceCard variant="inset">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-amber-300">Cross-Session Sync</span>
                <p className="text-[10px] text-zinc-500">File lock detection, context broadcast</p>
              </div>
              <Switch checked={crossSessionSyncEnabled} onCheckedChange={onCrossSessionSyncChange} />
            </div>

            {crossSessionSyncEnabled && (
              <motion.div
                variants={expandPanel} initial="hidden" animate="show" exit="exit"
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400">Lock TTL</span>
                    <span className="text-[11px] text-amber-400 font-mono">{fileLockTTL}s</span>
                  </div>
                  <input
                    type="range" min={30} max={600} step={30} value={fileLockTTL}
                    onChange={(e) => onFileLockTTLChange(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                    <span>30s</span><span>10m</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Context Broadcast</span>
                  <Switch checked={contextBroadcastEnabled} onCheckedChange={onContextBroadcastChange} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Conflict Warnings</span>
                  <select
                    value={conflictWarningMode}
                    onChange={(e) => onConflictWarningModeChange(e.target.value)}
                    className="text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none"
                  >
                    <option value="both">Toast + Terminal</option>
                    <option value="toast">Toast Only</option>
                    <option value="none">Off</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">/sync Command</span>
                  <Switch checked={syncCommandEnabled} onCheckedChange={onSyncCommandChange} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                  <span className="text-[11px] text-zinc-400">Thought Process</span>
                  <Switch checked={thoughtProcessEnabled} onCheckedChange={onThoughtProcessChange} />
                </div>
              </motion.div>
            )}
          </div>
        </WorkspaceCard>
      </WorkspaceSection>

      {/* ── Routing Costs ── */}
      {routingCosts && (
        <WorkspaceSection title="Routing Costs" icon={DollarSign} accent="orange">
          <WorkspaceCard variant="inset">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Today', value: routingCosts.today?.total || 0, calls: routingCosts.today?.calls || 0 },
                { label: 'This Week', value: routingCosts.week?.total || 0, calls: routingCosts.week?.calls || 0 },
                { label: 'This Month', value: routingCosts.month?.total || 0, calls: routingCosts.month?.calls || 0 },
                { label: 'All Time', value: routingCosts.total?.total || 0, calls: routingCosts.total?.calls || 0 },
              ].map((item) => (
                <div key={item.label} className="bg-zinc-800/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500">{item.label}</span>
                  <p className="text-[13px] font-mono text-emerald-400 font-semibold">${item.value.toFixed(4)}</p>
                  <span className="text-[9px] text-zinc-600">{item.calls} calls</span>
                </div>
              ))}
            </div>
          </WorkspaceCard>
        </WorkspaceSection>
      )}
    </div>
  );
}
