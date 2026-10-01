import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Check, Cpu, Zap } from 'lucide-react';

interface ProviderOption {
  id: string;
  label: string;
  models: string[];
  enabled: boolean;
}

interface RoutingEntry {
  providerId: string;
  model: string;
  smallModel?: string;
  smallProviderId?: string;
}

interface AiProviderSelectModalProps {
  open: boolean;
  onClose: () => void;
  featureKey: 'researchDigest' | 'goalAssistant' | 'resumeBuilder';
  featureLabel: string;
  accentColor: string;
  providers: ProviderOption[];
  currentRouting: RoutingEntry | null | undefined;
  onSave: (entry: RoutingEntry | null) => void;
}

function getEffectiveLabel(providers: ProviderOption[], entry: RoutingEntry | null | undefined): string {
  if (!entry) return 'Default';
  const p = providers.find(x => x.id === entry.providerId);
  return p ? p.label : 'Default';
}

function getEffectiveColor(providers: ProviderOption[], entry: RoutingEntry | null | undefined): string {
  if (!entry) return 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30';
  const p = providers.find(x => x.id === entry.providerId);
  if (!p) return 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30';
  return 'bg-violet-500/15 text-violet-300 border-violet-500/25';
}

export function getProviderBadge(providers: ProviderOption[], entry: RoutingEntry | null | undefined) {
  if (!entry) return null;
  const p = providers.find(x => x.id === entry.providerId);
  if (!p) return null;
  return { label: entry.model ? `${p.label} · ${entry.model}` : p.label, color: getEffectiveColor(providers, entry) };
}

export function AiProviderSelectModal({
  open, onClose, featureKey, featureLabel, accentColor,
  providers, currentRouting, onSave,
}: AiProviderSelectModalProps) {
  const enabledProviders = providers.filter(p => p.enabled);
  const [viewMode, setViewMode] = useState<'provider' | 'model'>('provider');
  const [selectedId, setSelectedId] = useState<string | null>(currentRouting?.providerId || null);
  const [selectedModel, setSelectedModel] = useState(currentRouting?.model || '');
  const [smallSelectedId, setSmallSelectedId] = useState<string | null>(currentRouting?.smallProviderId || null);
  const [smallSelectedModel, setSmallSelectedModel] = useState(currentRouting?.smallModel || '');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedId(currentRouting?.providerId || null);
      setSelectedModel(currentRouting?.model || '');
      setSmallSelectedId(currentRouting?.smallProviderId || null);
      setSmallSelectedModel(currentRouting?.smallModel || '');
      setLoadError(null);
      setSaveError(null);
    }
  }, [open, currentRouting]);

  const activeProvider = enabledProviders.find(p => p.id === selectedId);

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id) {
      const p = enabledProviders.find(x => x.id === id);
      if (p && p.models.length > 0) {
        setSelectedModel(p.models[0]);
      } else {
        setSelectedModel('');
      }
    } else {
      setSelectedModel('');
    }
  }

  function handleModelSelect(providerId: string, model: string) {
    setSelectedId(providerId);
    setSelectedModel(model);
  }

  const modelEntries = useMemo(() => {
    const seen = new Map<string, { providerId: string; providerLabel: string }[]>();
    for (const p of enabledProviders) {
      for (const m of p.models) {
        if (!seen.has(m)) seen.set(m, []);
        seen.get(m)!.push({ providerId: p.id, providerLabel: p.label });
      }
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [enabledProviders]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      if (!selectedId || !selectedModel) {
        onSave(null);
      } else {
        onSave({
          providerId: selectedId,
          model: selectedModel,
          smallProviderId: smallSelectedId || undefined,
          smallModel: smallSelectedModel || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save provider selection');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[90]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800/60 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accentColor} flex items-center justify-center`}>
                  <Cpu className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">{featureLabel}</h2>
                  <p className="text-[10px] text-zinc-500">Choose provider &amp; model</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 pt-3">
              <div className="flex bg-zinc-900/60 rounded-lg p-0.5 flex-1">
                {(['provider', 'model'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      viewMode === mode
                        ? 'bg-violet-500/15 text-violet-300 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode === 'provider' ? 'By Provider' : 'By Model'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {(loadError || saveError) && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
                  <span className="flex-1">{loadError || saveError}</span>
                  <button className="rounded bg-red-500/15 px-2 py-1 font-medium text-red-200 hover:bg-red-500/25" onClick={() => { setLoadError(null); setSaveError(null); }}>Dismiss</button>
                </div>
              )}
              {enabledProviders.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs text-zinc-500">No providers enabled.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Enable a provider in Settings → AI Providers first.</p>
                </div>
              )}

              {viewMode === 'provider' && enabledProviders.map((p) => {
                const isSelected = selectedId === p.id;
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSelect(isSelected ? null : p.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                      isSelected
                        ? 'bg-violet-500/8 border-violet-500/30'
                        : 'bg-zinc-900/50 border-zinc-800/40 hover:border-zinc-700/50 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-violet-400' : 'border-zinc-600'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isSelected ? 'text-violet-200' : 'text-zinc-300'}`}>
                            {p.label}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {p.models.length > 0 ? p.models.join(', ') : 'No models configured'}
                        </p>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    </div>

                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-violet-500/15">
                          <label className="text-[10px] text-zinc-500 block mb-1.5">Model</label>
                          <div className="relative">
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full appearance-none bg-zinc-800 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-violet-500/40 cursor-pointer"
                            >
                              {p.models.length === 0 && (
                                <option value="">No models — add one in Settings</option>
                              )}
                              {p.models.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}

              {viewMode === 'model' && modelEntries.map(([modelName, providers]) => {
                const isSelected = selectedId != null && selectedModel === modelName;
                return (
                  <div key={modelName} className="p-3 rounded-xl border bg-zinc-900/50 border-zinc-800/40">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-zinc-300">{modelName}</span>
                      <span className="text-[10px] text-zinc-500 ml-auto">{providers.length} provider{providers.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.map((pr) => {
                        const active = selectedId === pr.providerId && isSelected;
                        return (
                          <button
                            key={pr.providerId}
                            onClick={() => handleModelSelect(pr.providerId, modelName)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              active
                                ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40 hover:border-zinc-600/50 hover:text-zinc-300'
                            }`}
                          >
                            {active && <Check className="w-2.5 h-2.5" />}
                            {pr.providerLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {currentRouting && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleSelect(null)}
                  className="w-full text-left p-2.5 rounded-lg border border-dashed border-zinc-800/40 hover:border-zinc-700/50 transition-colors mt-2"
                >
                  <div className="flex items-center gap-2.5 justify-center">
                    <span className="text-[11px] text-zinc-500">Reset to default fallback chain</span>
                  </div>
                </motion.button>
              )}

              {/* ── Small Model Section ── */}
              {selectedId && selectedModel && (
                <div className="mt-3 pt-3 border-t border-zinc-800/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-medium text-zinc-300">Small Model</span>
                    <span className="text-[10px] text-zinc-500">for quick tasks (email checks, classifications)</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Provider</label>
                      <div className="relative">
                        <select
                          value={smallSelectedId || ''}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setSmallSelectedId(v);
                            if (v) {
                              const p = enabledProviders.find(x => x.id === v);
                              setSmallSelectedModel(p?.models[0] || '');
                            } else {
                              setSmallSelectedModel('');
                            }
                          }}
                          className="w-full appearance-none bg-zinc-800 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40 cursor-pointer"
                        >
                          <option value="">Same as main (default)</option>
                          {enabledProviders.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                    {smallSelectedId && (
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Model</label>
                        <div className="relative">
                          <select
                            value={smallSelectedModel}
                            onChange={(e) => setSmallSelectedModel(e.target.value)}
                            className="w-full appearance-none bg-zinc-800 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40 cursor-pointer"
                          >
                            {enabledProviders.find(p => p.id === smallSelectedId)?.models.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            )) || <option value="">No models</option>}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800/40 bg-zinc-900/20">
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 hover:text-violet-200 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="px-4 py-2 border-t border-zinc-800/30 bg-zinc-900/10">
              <button
                type="button"
                onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('navigate', { detail: '/settings' })), 100); }}
                className="w-full text-center text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                + Add provider in Settings
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
