import { useState } from 'react';
import { Shield, Terminal, GitBranch, Users, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_ROLES = [
  { role: 'director', label: 'Director', color: '#8b5cf6', desc: 'Orchestrates the mission, assigns tasks, makes decisions' },
  { role: 'planner', label: 'Planner', color: '#3b82f6', desc: 'Analyzes requirements and creates implementation plans' },
  { role: 'worker', label: 'Worker', color: '#22d3ee', desc: 'Implements changes, writes code, executes tasks' },
  { role: 'qa', label: 'QA', color: '#14b8a6', desc: 'Verifies correctness, tests, ensures no regressions' },
  { role: 'auditor', label: 'Auditor', color: '#f59e0b', desc: 'Final review for completeness, security, quality' },
  { role: 'resolver', label: 'Resolver', color: '#f43f5e', desc: 'Fixes merge conflicts and integration issues' },
];

export function RoleEditor({ roles, onChange }: { roles: any[]; onChange: (roles: any[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateRole = (index: number, updates: any) => {
    const next = [...roles];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addRole = () => {
    onChange([...roles, {
      role: 'custom',
      customName: 'New Role',
      agentTypeId: 'default',
      canSpawnChildren: false,
      maxDepth: 0,
      maxChildren: 0,
      fileAccess: 'read',
      terminalAccess: false,
      gitAccess: true,
      autoAudit: false,
      promptTemplate: 'custom',
    }]);
  };

  return (
    <div className="flex flex-col gap-2 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Role Configuration</h3>
        <button onClick={addRole} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-medium hover:bg-rose-500/25">
          <Plus className="w-3 h-3" /> Custom Role
        </button>
      </div>

      {roles.map((role, i) => {
        const isOpen = expanded === `${role.role}-${i}`;
        const meta = DEFAULT_ROLES.find(r => r.role === role.role) || { label: role.customName || 'Custom', color: '#a855f7', desc: 'Custom role' };
        return (
          <div key={`${role.role}-${i}`} className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : `${role.role}-${i}`)} className="w-full flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="text-xs font-medium text-zinc-200">{meta.label}</span>
                <span className="text-[10px] text-zinc-500">{meta.desc}</span>
              </div>
              <div className="flex items-center gap-1">
                {role.role === 'custom' && (
                  <button onClick={(e) => { e.stopPropagation(); onChange(roles.filter((_, idx) => idx !== i)); }} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t border-zinc-800/40 pt-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Agent Provider</label>
                    <select value={role.agentTypeId} onChange={e => updateRole(i, { agentTypeId: e.target.value })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40">
                      <option value="default">Default</option>
                      <option value="claude">Claude</option>
                      <option value="gemini">Gemini</option>
                      <option value="opencode">OpenCode</option>
                      <option value="codex">Codex</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase mb-1 block">File Access</label>
                    <select value={role.fileAccess} onChange={e => updateRole(i, { fileAccess: e.target.value })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40">
                      <option value="none">None</option>
                      <option value="read">Read Only</option>
                      <option value="write">Read + Write</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={role.canSpawnChildren} onChange={e => updateRole(i, { canSpawnChildren: e.target.checked })} className="accent-rose-500" />
                    <Users className="w-3 h-3" /> Spawn Children
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={role.terminalAccess} onChange={e => updateRole(i, { terminalAccess: e.target.checked })} className="accent-rose-500" />
                    <Terminal className="w-3 h-3" /> Terminal
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={role.gitAccess} onChange={e => updateRole(i, { gitAccess: e.target.checked })} className="accent-rose-500" />
                    <GitBranch className="w-3 h-3" /> Git
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Max Depth</label>
                    <input type="number" value={role.maxDepth} onChange={e => updateRole(i, { maxDepth: Number(e.target.value) })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Max Children</label>
                    <input type="number" value={role.maxChildren} onChange={e => updateRole(i, { maxChildren: Number(e.target.value) })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
