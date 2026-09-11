// DEPRECATED: This page has been replaced by CompositionPanel in the AI assistant page.
// The /compositions route now redirects to /ai. This file is kept for backward compatibility only.
// All composition UI is now in src/components/ai/compositions/CompositionPanel.tsx

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Pencil, Trash2, CheckCircle, XCircle, AlertTriangle, RotateCcw, Shield, FileCode, Loader2, X, Save, AlertCircle } from 'lucide-react';

const API = (window as any).deskflowAPI;

interface CompositionRule {
  id: string;
  name: string;
  description: string | null;
  dsl_source: string;
  version: number;
  enabled: number;
  priority: number;
  category: string;
  lifecycle: string;
  schedule_cron: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionStatus {
  rule_id: string;
  last_status: string;
  last_error: string | null;
  consecutive_failures: number;
  last_run_at: string | null;
}

interface ExecutionLog {
  id: number;
  rule_id: string;
  action_name: string;
  status: string;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    idle: { color: 'text-zinc-400 bg-zinc-800', label: 'Idle' },
    success: { color: 'text-emerald-400 bg-emerald-500/10', label: 'Success' },
    failure: { color: 'text-red-400 bg-red-500/10', label: 'Failure' },
    error: { color: 'text-red-400 bg-red-500/10', label: 'Error' },
    skipped: { color: 'text-amber-400 bg-amber-500/10', label: 'Skipped' },
    running: { color: 'text-blue-400 bg-blue-500/10', label: 'Running' },
    pending: { color: 'text-zinc-400 bg-zinc-800', label: 'Pending' },
    active: { color: 'text-emerald-400 bg-emerald-500/10', label: 'Active' },
  };
  const c = config[status] || { color: 'text-zinc-400 bg-zinc-800', label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>;
}

function DSL_EDITOR_TEMPLATE() {
  return `# Create a composition rule
# on <source>.<event> if <condition> do <action>:<params>
#
# Example:
# on finance.transaction.created if amount > 100 do notify:message 'Large transaction'
`;
}

export default function CompositionPage() {
  const [rules, setRules] = useState<CompositionRule[]>([]);
  const [statuses, setStatuses] = useState<Map<string, ExecutionStatus>>(new Map());
  const [history, setHistory] = useState<ExecutionLog[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<CompositionRule | null>(null);
  const [dslSource, setDslSource] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState('general');
  const [ruleLifecycle, setRuleLifecycle] = useState('manual');
  const [rulePriority, setRulePriority] = useState(500);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadRules();
    loadStatuses();
    loadHistory();
  }, []);

  async function loadRules() {
    try {
      const r = await API?.compositionsList();
      if (r) setRules(r);
    } catch { setRules([]); }
  }

  async function loadStatuses() {
    try {
      const s = await API?.compositionsStatus();
      if (s) {
        const map = new Map<string, ExecutionStatus>();
        for (const row of s) map.set(row.rule_id, row);
        setStatuses(map);
      }
    } catch {}
  }

  async function loadHistory(ruleId?: string) {
    try {
      const h = await API?.compositionsHistory(ruleId || null, 50);
      if (h) setHistory(h);
    } catch { setHistory([]); }
  }

  function openNewRule() {
    setEditingRule(null);
    setRuleName('');
    setRuleCategory('general');
    setRuleLifecycle('manual');
    setRulePriority(500);
    setDslSource(DSL_EDITOR_TEMPLATE());
    setValidationResult(null);
    setError(null);
    setShowEditor(true);
  }

  function openEditRule(rule: CompositionRule) {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleCategory(rule.category);
    setRuleLifecycle(rule.lifecycle);
    setRulePriority(rule.priority);
    setDslSource(rule.dsl_source);
    setValidationResult(null);
    setError(null);
    setShowEditor(true);
  }

  async function validateDsl() {
    try {
      const result = await API?.compositionsValidate(dslSource, ruleName || 'preview');
      setValidationResult(result);
    } catch {}
  }

  async function saveRule() {
    if (!ruleName.trim() || !dslSource.trim()) {
      setError('Name and DSL source are required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (editingRule) {
        await API?.compositionsUpdate(editingRule.id, {
          name: ruleName,
          category: ruleCategory,
          lifecycle: ruleLifecycle,
          priority: rulePriority,
          dsl_source: dslSource,
          changelog: 'updated from editor',
        });
      } else {
        await API?.compositionsCreate({
          id: crypto.randomUUID(),
          name: ruleName,
          category: ruleCategory,
          lifecycle: ruleLifecycle,
          priority: rulePriority,
          dsl_source: dslSource,
          enabled: 1,
        });
      }
      setShowEditor(false);
      await loadRules();
      await loadStatuses();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRule(id: string) {
    try {
      await API?.compositionsDelete(id);
      await loadRules();
      await loadStatuses();
    } catch {}
  }

  async function evaluateRule(id: string) {
    setRunningRuleId(id);
    try {
      await API?.compositionsEvaluate(id, {});
      await loadHistory(id);
      await loadStatuses();
    } catch {}
    setRunningRuleId(null);
  }

  function viewHistory(ruleId: string) {
    setSelectedRuleId(ruleId);
    loadHistory(ruleId);
    setShowHistory(true);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-medium text-white">Compositions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">DSL-driven automation rules</p>
        </div>
        <button onClick={openNewRule} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <FileCode className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No composition rules yet</p>
            <p className="text-xs mt-1">Create rules with the DSL engine to automate workflows</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {rules.map(rule => {
              const status = statuses.get(rule.id);
              return (
                <motion.div
                  key={rule.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium text-white truncate">{rule.name}</h3>
                        {status && <StatusBadge status={status.last_status} />}
                        {rule.enabled ? (
                          <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Enabled</span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Disabled</span>
                        )}
                      </div>
                      {rule.description && <p className="text-xs text-zinc-500 mt-1 truncate">{rule.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                        <span>v{rule.version}</span>
                        <span>{rule.category}</span>
                        <span>{rule.lifecycle}</span>
                        {rule.schedule_cron && <span className="font-mono">{rule.schedule_cron}</span>}
                        <span>Priority: {rule.priority}</span>
                      </div>
                      {status?.consecutive_failures > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          {status.consecutive_failures} consecutive failure{status.consecutive_failures > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      <button onClick={() => evaluateRule(rule.id)} disabled={runningRuleId === rule.id}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Evaluate">
                        {runningRuleId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEditRule(rule)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => viewHistory(rule.id)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="History">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteRule(rule.id)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEditor && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowEditor(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl w-[680px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-medium">{editingRule ? 'Edit Rule' : 'New Rule'}</h2>
                <button onClick={() => setShowEditor(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Name</label>
                    <input value={ruleName} onChange={e => setRuleName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors" placeholder="My Rule" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                    <select value={ruleCategory} onChange={e => setRuleCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors">
                      <option value="general">General</option>
                      <option value="finance">Finance</option>
                      <option value="focus">Focus</option>
                      <option value="goals">Goals</option>
                      <option value="learning">Learning</option>
                      <option value="ide">IDE</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Lifecycle</label>
                    <select value={ruleLifecycle} onChange={e => setRuleLifecycle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors">
                      <option value="manual">Manual</option>
                      <option value="forever">Forever</option>
                      <option value="once">Once</option>
                      <option value="schedule">Schedule</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Priority</label>
                    <input type="number" value={rulePriority} onChange={e => setRulePriority(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-zinc-400">DSL Source</label>
                    <button onClick={validateDsl} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Validate
                    </button>
                  </div>
                  <textarea value={dslSource} onChange={e => setDslSource(e.target.value)}
                    className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 outline-none focus:border-emerald-500/50 transition-colors resize-none" />
                </div>

                {validationResult && (
                  <div className={`rounded-xl p-3 text-xs ${validationResult.valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {validationResult.valid ? (
                      <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> Valid — {validationResult.warnings?.length || 0} warnings</div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1"><XCircle className="w-3.5 h-3.5" /> {validationResult.errors?.length || 0} error(s)</div>
                        {validationResult.errors?.map((e: any, i: number) => (
                          <div key={i} className="text-red-400/70 ml-5">[{e.code}] {e.message}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl p-3">
                    <AlertTriangle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
                <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-xl">Cancel</button>
                <button onClick={saveRule} disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl w-[600px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-medium">Execution History</h2>
                <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {history.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">No executions yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 50).map(h => (
                      <div key={h.id} className="flex items-center justify-between bg-zinc-900/50 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={h.status} />
                          <span className="text-xs text-zinc-300 font-mono">{h.action_name}</span>
                          {h.duration_ms != null && <span className="text-[10px] text-zinc-500">{h.duration_ms}ms</span>}
                        </div>
                        <div className="text-[10px] text-zinc-500">{h.started_at}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
