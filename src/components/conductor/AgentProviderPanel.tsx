import { useState, useEffect } from 'react';
import { Bot, Key, Globe, Zap, Trash2, Plus, Check, AlertTriangle } from 'lucide-react';

const PROVIDER_OPTIONS = [
  { value: 'opencode', label: 'OpenCode', defaultModel: 'opencode-default', defaultEndpoint: 'internal' },
  { value: 'claude', label: 'Claude (Anthropic)', defaultModel: 'claude-3-5-sonnet-20241022', defaultEndpoint: 'https://api.anthropic.com' },
  { value: 'gemini', label: 'Gemini (Google)', defaultModel: 'gemini-1.5-pro', defaultEndpoint: 'https://generativelanguage.googleapis.com' },
  { value: 'codex', label: 'Codex (OpenAI)', defaultModel: 'codex-latest', defaultEndpoint: 'https://api.openai.com' },
  { value: 'custom', label: 'Custom API', defaultModel: 'custom', defaultEndpoint: '' },
];

export function AgentProviderPanel() {
  const [providers, setProviders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    (window as any).deskflowAPI?.conductorListProviders?.().then((r: any) => {
      if (r?.success) setProviders(r.data || []);
    });
  }, []);

  const saveProvider = async (config: any) => {
    await (window as any).deskflowAPI?.conductorRegisterProvider?.(config);
    const r = await (window as any).deskflowAPI?.conductorListProviders?.();
    if (r?.success) setProviders(r.data || []);
    setEditing(null);
  };

  const deleteProvider = async (id: string) => {
    await (window as any).deskflowAPI?.conductorDeleteProvider?.(id);
    setProviders(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">AI Providers</h3>
        <button onClick={() => setEditing({ id: `new-${Date.now()}`, isDefault: false, capabilities: ['file-access', 'terminal-access', 'git-access'] })} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-medium hover:bg-rose-500/25">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {providers.map((p) => (
        <div key={p.id} className="rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className={`w-4 h-4 ${p.isDefault ? 'text-rose-400' : 'text-zinc-500'}`} />
              <span className="text-xs font-medium text-zinc-200">{p.name}</span>
              {p.isDefault && <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-medium">Default</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(p)} className="p-1 rounded hover:bg-zinc-800 text-zinc-500"><Zap className="w-3 h-3" /></button>
              {!p.isDefault && <button onClick={() => deleteProvider(p.id)} className="p-1 rounded hover:bg-zinc-800 text-zinc-500"><Trash2 className="w-3 h-3" /></button>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span>{p.provider}</span>
            <span>{p.model}</span>
            <span>{p.maxTokens?.toLocaleString()} tokens</span>
            <span>${p.costPer1kOutput}/1k out</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {p.capabilities?.map((c: string) => (
              <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-[10px] text-zinc-400">{c}</span>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[480px] rounded-xl bg-zinc-950 ring-1 ring-inset ring-zinc-800/70 shadow-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">{editing.id?.startsWith('new-') ? 'Add Provider' : 'Edit Provider'}</h3>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Name</label>
                  <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Provider</label>
                  <select value={editing.provider || 'custom'} onChange={e => {
                    const opt = PROVIDER_OPTIONS.find(o => o.value === e.target.value);
                    setEditing({ ...editing, provider: e.target.value, model: opt?.defaultModel || '', endpoint: opt?.defaultEndpoint || '' });
                  }} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40">
                    {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Model</label>
                <input value={editing.model || ''} onChange={e => setEditing({ ...editing, model: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">API Key</label>
                  <div className="relative">
                    <input type="password" value={editing.apiKey || ''} onChange={e => setEditing({ ...editing, apiKey: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                    <Key className="absolute right-2 top-1.5 w-3 h-3 text-zinc-600" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Endpoint</label>
                  <div className="relative">
                    <input value={editing.endpoint || ''} onChange={e => setEditing({ ...editing, endpoint: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                    <Globe className="absolute right-2 top-1.5 w-3 h-3 text-zinc-600" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Max Tokens</label>
                  <input type="number" value={editing.maxTokens || 4000} onChange={e => setEditing({ ...editing, maxTokens: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">$/1k In</label>
                  <input type="number" step="0.001" value={editing.costPer1kInput || 0.003} onChange={e => setEditing({ ...editing, costPer1kInput: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">$/1k Out</label>
                  <input type="number" step="0.001" value={editing.costPer1kOutput || 0.015} onChange={e => setEditing({ ...editing, costPer1kOutput: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Capabilities</label>
                <div className="flex flex-wrap gap-1">
                  {['file-access', 'terminal-access', 'git-access', 'web-access', 'mcp-access', 'image-access'].map(cap => (
                    <button
                      key={cap}
                      onClick={() => {
                        const caps = new Set(editing.capabilities || []);
                        caps.has(cap) ? caps.delete(cap) : caps.add(cap);
                        setEditing({ ...editing, capabilities: Array.from(caps) });
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        (editing.capabilities || []).includes(cap)
                          ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
                          : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/60'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" checked={editing.isDefault} onChange={e => setEditing({ ...editing, isDefault: e.target.checked })} className="accent-rose-500" />
                <span className="text-[11px] text-zinc-400">Set as default provider</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 text-xs font-medium hover:bg-zinc-700/60">Cancel</button>
              <button onClick={() => saveProvider(editing)} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600">Save Provider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
