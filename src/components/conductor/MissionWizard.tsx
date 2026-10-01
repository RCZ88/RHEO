import { useState, useCallback, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Bot, Settings, Coins, Play, Save, Check, Loader2, GitBranch, Folder, Zap, Search, Bug, Hammer, RefreshCw } from 'lucide-react';

interface WizardStep {
  key: 'objective' | 'template' | 'workflow' | 'agents' | 'review';
  label: string;
  icon: any;
}

const STEPS: WizardStep[] = [
  { key: 'objective', label: 'Objective', icon: Zap },
  { key: 'template', label: 'Template', icon: Search },
  { key: 'workflow', label: 'Workflow', icon: Sparkles },
  { key: 'agents', label: 'Agents', icon: Bot },
  { key: 'review', label: 'Launch', icon: Play },
];

const TEMPLATE_CARDS = [
  { id: 'tpl-code-review', name: 'Code Review', icon: Search, desc: 'Systematic review with director oversight', time: '30 min', cost: '$15', color: 'text-cyan-300', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/30' },
  { id: 'tpl-bug-fix', name: 'Bug Fix', icon: Bug, desc: 'Investigation and resolution pipeline', time: '45 min', cost: '$25', color: 'text-rose-300', bg: 'bg-rose-500/10', ring: 'ring-rose-500/30' },
  { id: 'tpl-feature-build', name: 'Feature Build', icon: Hammer, desc: 'Parallel implementation with QA', time: '90 min', cost: '$40', color: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  { id: 'tpl-refactor', name: 'Refactoring', icon: RefreshCw, desc: 'Safe refactoring with regression prevention', time: '60 min', cost: '$20', color: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
];

export function MissionWizard({ projectId, repoPath, userBranch, onLaunch, onClose }: {
  projectId: string;
  repoPath: string;
  userBranch: string;
  onLaunch: (config: any) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [engineeredWorkflow, setEngineeredWorkflow] = useState<any>(null);
  const [isEngineering, setIsEngineering] = useState(false);
  const [agentAssignments, setAgentAssignments] = useState<Record<string, any>>({});
  const [budgetTotal, setBudgetTotal] = useState(550000);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    (window as any).deskflowAPI?.conductorListProviders?.().then((r: any) => {
      if (r?.success) setProviders(r.data || []);
    });
  }, []);

  const engineerWorkflow = useCallback(async () => {
    if (!selectedTemplate || !objective.trim()) return;
    setIsEngineering(true);
    const result = await (window as any).deskflowAPI?.conductorEngineerWorkflow?.(objective, selectedTemplate);
    if (result?.success) {
      setEngineeredWorkflow(result.data);
      const assignments: Record<string, any> = {};
      for (const role of result.data.roles || []) {
        assignments[role.role] = providers.find(p => p.isDefault) || providers[0];
      }
      setAgentAssignments(assignments);
    }
    setIsEngineering(false);
  }, [objective, selectedTemplate, providers]);

  const currentStep = STEPS[step];
  const canNext = step === 0 ? objective.trim().length > 10 : step === 1 ? selectedTemplate !== null : step === 2 ? engineeredWorkflow !== null : step === 3 ? Object.keys(agentAssignments).length > 0 : true;

  const totalBudget = Object.values(agentAssignments).reduce((sum: number, provider: any, idx: number) => {
    const role = engineeredWorkflow?.roles?.[idx];
    return sum + (role?.budgetTokens || 100000) * ((provider?.costPer1kOutput || 0.015) / 1000);
  }, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[720px] max-h-[90vh] rounded-xl bg-zinc-950 ring-1 ring-inset ring-zinc-800/70 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-semibold text-zinc-100">New Mission</h2>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`flex items-center gap-1 ${i > 0 ? 'ml-2' : ''}`}>
                {i > 0 && <div className={`w-4 h-px ${i <= step ? 'bg-rose-500/50' : 'bg-zinc-800'}`} />}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  i === step ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30' :
                  i < step ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-600'
                }`}>
                  <s.icon className="w-3 h-3" />
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">Mission Objective</label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Describe what you want to accomplish. Be specific about the feature, bug, or refactoring task."
                  className="w-full h-32 bg-zinc-950/50 border border-zinc-800/70 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500/40 resize-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1.5">{objective.length} chars · {objective.trim().split(/\s+/).filter(Boolean).length} words</p>
              </div>
              <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">Project Context</label>
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <div className="flex items-center gap-1.5"><Folder className="w-3.5 h-3.5 text-zinc-500" /><span>{repoPath}</span></div>
                  <div className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-zinc-500" /><span>{userBranch}</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_CARDS.map((tpl) => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all ${
                      isSelected ? `${tpl.bg} ring-1 ${tpl.ring}` : 'bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${tpl.color}`} />
                      <span className={`text-sm font-semibold ${isSelected ? tpl.color : 'text-zinc-200'}`}>{tpl.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{tpl.desc}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-zinc-500">{tpl.time}</span>
                      <span className="text-[10px] text-zinc-500">{tpl.cost}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              {!engineeredWorkflow && !isEngineering && (
                <button onClick={engineerWorkflow} className="flex items-center justify-center gap-2 py-8 rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 hover:bg-zinc-800/40 transition-colors">
                  <Sparkles className="w-5 h-5 text-rose-400" />
                  <span className="text-sm font-medium text-zinc-200">Generate Workflow from Objective</span>
                </button>
              )}
              {isEngineering && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
                  <p className="text-xs text-zinc-400">AI is engineering the optimal workflow...</p>
                </div>
              )}
              {engineeredWorkflow && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                    <h3 className="text-xs font-semibold text-zinc-300 mb-3">Generated Role Hierarchy</h3>
                    <div className="flex flex-col gap-2">
                      {engineeredWorkflow.roles?.map((role: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-zinc-950/50">
                          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-200">{role.customName || role.role}</p>
                            <p className="text-[10px] text-zinc-500">{role.canSpawnChildren ? 'Can spawn children' : 'Leaf agent'} · {role.fileAccess} access</p>
                          </div>
                          <span className="text-[10px] text-zinc-500">{role.maxChildren || 0} max children</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                    <h3 className="text-xs font-semibold text-zinc-300 mb-2">File Boundaries</h3>
                    <div className="flex flex-wrap gap-1">
                      {engineeredWorkflow.boundaries?.map((b: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] text-zinc-400">{b}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && engineeredWorkflow && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                <h3 className="text-xs font-semibold text-zinc-300 mb-3">Agent Provider Assignment</h3>
                <div className="flex flex-col gap-2">
                  {engineeredWorkflow.roles?.map((role: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-zinc-950/50">
                      <div className="w-24 shrink-0">
                        <p className="text-xs font-medium text-zinc-200">{role.customName || role.role}</p>
                      </div>
                      <select
                        value={agentAssignments[role.role]?.id || ''}
                        onChange={(e) => {
                          const provider = providers.find(p => p.id === e.target.value);
                          setAgentAssignments(prev => ({ ...prev, [role.role]: provider }));
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40"
                      >
                        {providers.length === 0 && <option value="">No providers configured</option>}
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                        ))}
                      </select>
                      <div className="w-24 text-right">
                        <p className="text-[10px] text-zinc-500">{role.budgetTokens?.toLocaleString() || '100k'} tok</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-300">Budget</h3>
                  <span className="text-xs text-zinc-400">${totalBudget.toFixed(2)} estimated</span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={2000000}
                  step={50000}
                  value={budgetTotal}
                  onChange={(e) => setBudgetTotal(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>100k tokens</span>
                  <span>{budgetTotal.toLocaleString()} tokens</span>
                  <span>2M tokens</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-4">
                <h3 className="text-xs font-semibold text-zinc-300 mb-3">Mission Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-950/50 p-3">
                    <p className="text-[10px] text-zinc-500 uppercase">Objective</p>
                    <p className="text-xs text-zinc-200 mt-1 line-clamp-3">{objective}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/50 p-3">
                    <p className="text-[10px] text-zinc-500 uppercase">Template</p>
                    <p className="text-xs text-zinc-200 mt-1">{TEMPLATE_CARDS.find(t => t.id === selectedTemplate)?.name || 'Custom'}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/50 p-3">
                    <p className="text-[10px] text-zinc-500 uppercase">Agents</p>
                    <p className="text-xs text-zinc-200 mt-1">{engineeredWorkflow?.roles?.length || 0} agents</p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/50 p-3">
                    <p className="text-[10px] text-zinc-500 uppercase">Budget</p>
                    <p className="text-xs text-zinc-200 mt-1">{budgetTotal.toLocaleString()} tokens · ${totalBudget.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-rose-500/10 ring-1 ring-inset ring-rose-500/30 p-4">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-rose-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-rose-200">Ready to Launch</p>
                    <p className="text-[11px] text-rose-300/70 mt-0.5">The AI will engineer the workflow, assign roles, and begin execution. You can monitor progress in real-time.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800/60">
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 text-xs font-medium hover:bg-zinc-700/60">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-xs font-medium hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed">
                Next <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <button onClick={() => onLaunch({ objective, templateId: selectedTemplate, repoPath, userBranch, projectId, budgetTokens: budgetTotal, agentAssignments })} className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600">
                <Play className="w-3 h-3" /> Launch Mission
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
