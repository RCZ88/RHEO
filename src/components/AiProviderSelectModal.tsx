// AiProviderSelectModal — ONE dialog for everything about models.
//
// What this replaced: a routing picker (this file) whose "Add or manage
// providers" link stacked a SECOND modal (AiProviderManager, z-100 over z-90).
// The user's report: "why is there two separate windows panel popup to like
// separate the model selection and like the selecting and configuring the
// models and providers". Now there is one window with two in-place views:
//
//   Assign model       — which provider + model serves this feature
//   Providers & models — add/edit/enable/remove providers, store their models
//
// The provider manager renders INLINE in the second view (no popup, no
// z-index ladder). Model fields are type-then-select comboboxes, and each
// provider's model list is stored as a real list — see ModelCombobox.
//
// House rules: radii {8px, 12px, pill}, ONE signal hue (var(--page-accent);
// the per-feature gradient survives only as the header identity chip), no
// glassmorphism, no spring motion, framer-motion entrance obeys
// prefers-reduced-motion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ChevronDown, Check, Cpu, Zap } from 'lucide-react';
import { AiProviderManager } from './ai/AiProviderManager';
import { ModelSelect } from './ai/ModelCombobox';

export interface ProviderOption {
  id: string;
  label: string;
  models: string[];
  enabled: boolean;
}

export interface RoutingEntry {
  providerId: string;
  model: string;
  smallModel?: string;
  smallProviderId?: string;
}

interface AiProviderSelectModalProps {
  open: boolean;
  onClose: () => void;
  featureKey: 'default' | 'researchDigest' | 'goalAssistant' | 'vision' | 'resumeBuilder';
  featureLabel: string;
  accentColor: string;
  providers: ProviderOption[];
  currentRouting: RoutingEntry | null | undefined;
  onSave: (entry: RoutingEntry | null) => void;
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

type View = 'assign' | 'providers';

const softBtn = { border: '1px solid var(--ws-border)', color: 'var(--color-muted-foreground)' } as const;
const accentBtn = {
  background: 'var(--page-accent-14)',
  border: '1px solid color-mix(in srgb, var(--page-accent) 32%, transparent)',
  color: 'var(--page-accent)',
} as const;
const fieldStyle = {
  background: 'var(--color-background)',
  border: '1px solid var(--ws-border)',
  color: 'var(--color-foreground)',
} as const;

export function AiProviderSelectModal({
  open, onClose, featureLabel, accentColor,
  providers, currentRouting, onSave,
}: AiProviderSelectModalProps) {
  const reducedMotion = useReducedMotion();
  const enabledProviders = providers.filter(p => p.enabled);
  const [view, setView] = useState<View>('assign');
  const [viewMode, setViewMode] = useState<'provider' | 'model'>('provider');
  const [selectedId, setSelectedId] = useState<string | null>(currentRouting?.providerId || null);
  const [selectedModel, setSelectedModel] = useState(currentRouting?.model || '');
  const [smallSelectedId, setSmallSelectedId] = useState<string | null>(currentRouting?.smallProviderId || null);
  const [smallSelectedModel, setSmallSelectedModel] = useState(currentRouting?.smallModel || '');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset to a clean state on the OPEN EDGE only. Deliberately not on every
  // currentRouting change: AiPage rebuilds that object after a providers save
  // (`rheo:providers-changed`), and reacting to it would yank the user out of
  // the Providers view they are still working in.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setView('assign');
      setSelectedId(currentRouting?.providerId || null);
      setSelectedModel(currentRouting?.model || '');
      setSmallSelectedId(currentRouting?.smallProviderId || null);
      setSmallSelectedModel(currentRouting?.smallModel || '');
      setLoadError(null);
      setSaveError(null);
    }
    wasOpenRef.current = open;
  }, [open, currentRouting]);

  // If the provider list changes while the dialog is open (e.g. saved in the
  // Providers view), keep the assignment valid: a removed/disabled provider
  // must not leave a stale selection behind. The length guard matters — the
  // list is briefly empty while AiPage loads it.
  useEffect(() => {
    if (!open || providers.length === 0 || !selectedId) return;
    const p = enabledProviders.find((x) => x.id === selectedId);
    if (!p) {
      setSelectedId(null);
      setSelectedModel('');
      return;
    }
    if (selectedModel && !p.models.includes(selectedModel)) {
      setSelectedModel(p.models[0] || '');
    }
  }, [open, providers, enabledProviders, selectedId, selectedModel]);

  const handleProvidersSaved = useCallback(() => {
    // AiPage listens for this and re-reads getAiProviders — badges and the
    // assign view refresh without a reload.
    window.dispatchEvent(new CustomEvent('rheo:providers-changed'));
  }, []);

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
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, black 70%, transparent)' }}
          onClick={onClose}
        >
          <motion.div
            initial={reducedMotion ? false : { scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="mx-4 flex w-full max-w-2xl flex-col overflow-hidden"
            style={{
              maxHeight: 'min(86vh, 720px)',
              background: 'var(--color-card)',
              border: '1px solid var(--ws-border-strong)',
              borderRadius: 12,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${featureLabel} — provider & model`}
          >
            {/* Header — feature identity chip + one subtitle per view */}
            <div className="flex shrink-0 items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--ws-border)' }}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accentColor}`}>
                <Cpu className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>{featureLabel}</h2>
                <p className="truncate text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  {view === 'assign' ? 'Choose the provider & model for this feature' : 'Add providers and store their models'}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--color-background) 60%, transparent)' }}
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
              </button>
            </div>

            {/* ONE window, two in-place views — the manager is NOT a second popup */}
            <div className="flex shrink-0 items-center px-4 pt-3">
              <div
                className="flex flex-1 rounded-lg p-0.5"
                style={{ background: 'color-mix(in srgb, var(--color-background) 55%, transparent)', border: '1px solid var(--ws-border)' }}
              >
                {(['assign', 'providers'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className="flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium"
                    style={view === v ? { background: 'var(--page-accent-12)', color: 'var(--page-accent)' } : { color: 'var(--color-muted-foreground)' }}
                  >
                    {v === 'assign' ? 'Assign model' : 'Providers & models'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── View: assign ── */}
            <div className="min-h-0 flex-1 flex-col" style={{ display: view === 'assign' ? 'flex' : 'none' }}>
              <div className="flex shrink-0 items-center gap-1.5 px-4 pt-3 text-[10px]">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Browse</span>
                {(['provider', 'model'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className="rounded-lg px-2 py-0.5 font-medium"
                    style={viewMode === mode ? { background: 'var(--page-accent-12)', color: 'var(--page-accent)' } : { color: 'var(--color-muted-foreground)' }}
                  >
                    {mode === 'provider' ? 'by provider' : 'by model'}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {(loadError || saveError) && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-destructive) 22%, transparent)',
                      color: 'var(--color-destructive)',
                    }}
                  >
                    <span className="flex-1">{loadError || saveError}</span>
                    <button
                      className="rounded-lg px-2 py-1 font-medium"
                      style={{ background: 'color-mix(in srgb, var(--color-destructive) 14%, transparent)' }}
                      onClick={() => { setLoadError(null); setSaveError(null); }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {enabledProviders.length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>No providers enabled.</p>
                    <p className="mt-1 text-[10px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
                      A provider must exist and be enabled before it can serve this feature.
                    </p>
                    <button onClick={() => setView('providers')} className="mt-2 rounded-lg px-2.5 py-1 text-[10px]" style={accentBtn}>
                      Set up providers
                    </button>
                  </div>
                )}

                {viewMode === 'provider' && (
                  <div role="radiogroup" aria-label="Providers" className="space-y-2">
                    {enabledProviders.map((p) => {
                      const isSelected = selectedId === p.id;
                      return (
                        <div
                          key={p.id}
                          className="w-full rounded-xl border"
                          style={isSelected
                            ? { background: 'var(--page-accent-10)', borderColor: 'color-mix(in srgb, var(--page-accent) 30%, transparent)' }
                            : { background: 'color-mix(in srgb, var(--color-background) 50%, transparent)', borderColor: 'var(--ws-border)' }}
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleSelect(isSelected ? null : p.id)}
                            className="flex w-full items-center gap-3 p-3 text-left"
                          >
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                              style={{ borderColor: isSelected ? 'var(--page-accent)' : 'var(--ws-border-strong)' }}
                            >
                              {isSelected && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--page-accent)' }} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: isSelected ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}>
                                  {p.label}
                                </span>
                                {isSelected && (
                                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--page-accent-14)', color: 'var(--page-accent)' }}>
                                    Active
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                {p.models.length > 0 ? `${p.models.length} model${p.models.length === 1 ? '' : 's'} stored` : 'No models stored yet'}
                              </span>
                            </span>
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--page-accent)' }} />}
                          </button>

                          {isSelected && (
                            <div className="border-t px-3 pb-3 pt-3" style={{ borderColor: 'color-mix(in srgb, var(--page-accent) 18%, transparent)' }}>
                              {p.models.length > 0 ? (
                                <div>
                                  <label className="mb-1.5 block text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Model — type to filter, Enter selects
                                  </label>
                                  <ModelSelect value={selectedModel} options={p.models} onChange={setSelectedModel} placeholder="Select a model" />
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                    No models stored for this provider yet.
                                  </span>
                                  <button onClick={() => setView('providers')} className="rounded-lg px-2 py-0.5 text-[10px]" style={accentBtn}>
                                    Add models
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {viewMode === 'model' && modelEntries.map(([modelName, provs]) => {
                  const isSelected = selectedId != null && selectedModel === modelName;
                  return (
                    <div
                      key={modelName}
                      className="rounded-xl border p-3"
                      style={isSelected
                        ? { background: 'var(--page-accent-10)', borderColor: 'color-mix(in srgb, var(--page-accent) 30%, transparent)' }
                        : { background: 'color-mix(in srgb, var(--color-background) 50%, transparent)', borderColor: 'var(--ws-border)' }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-mono)' }}>{modelName}</span>
                        <span className="ml-auto text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                          {provs.length} provider{provs.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {provs.map((pr) => {
                          const active = selectedId === pr.providerId && isSelected;
                          return (
                            <button
                              key={pr.providerId}
                              onClick={() => handleModelSelect(pr.providerId, modelName)}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                              style={active
                                ? { background: 'var(--page-accent-14)', borderColor: 'color-mix(in srgb, var(--page-accent) 25%, transparent)', color: 'var(--page-accent)' }
                                : { background: 'color-mix(in srgb, var(--color-background) 60%, transparent)', borderColor: 'var(--ws-border)', color: 'var(--color-muted-foreground)' }}
                            >
                              {active && <Check className="h-2.5 w-2.5" />}
                              {pr.providerLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {currentRouting && (
                  <button
                    onClick={() => handleSelect(null)}
                    className="mt-2 w-full rounded-lg border border-dashed p-2.5"
                    style={{ borderColor: 'var(--ws-border-strong)' }}
                  >
                    <span className="flex items-center justify-center gap-2.5 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                      Reset to default fallback chain
                    </span>
                  </button>
                )}

                {/* ── Small Model Section ── */}
                {selectedId && selectedModel && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--ws-border)' }}>
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-3 w-3" style={{ color: 'var(--page-accent)' }} />
                      <span className="text-[11px] font-medium" style={{ color: 'var(--color-foreground)' }}>Small model</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>for quick tasks (email checks, classifications)</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Provider</label>
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
                            className="w-full appearance-none rounded-lg px-3 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                            style={fieldStyle}
                          >
                            <option value="">Same as main (default)</option>
                            {enabledProviders.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }} />
                        </div>
                      </div>
                      {smallSelectedId && (
                        <div>
                          <label className="mb-1 block text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Model</label>
                          <ModelSelect
                            value={smallSelectedModel}
                            options={enabledProviders.find(p => p.id === smallSelectedId)?.models || []}
                            onChange={setSmallSelectedModel}
                            placeholder="Select a model"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--ws-border)' }}>
                <button onClick={onClose} className="flex-1 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--color-background) 60%, transparent)', ...softBtn }}>
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || (!selectedId && !currentRouting)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40"
                  style={accentBtn}
                >
                  {saving ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </div>

            {/* ── View: providers — the manager renders INLINE, same window ── */}
            <div className="min-h-0 flex-1 flex-col" style={{ display: view === 'providers' ? 'flex' : 'none' }}>
              {/* open={true}: this subtree only exists while the dialog is open,
                  so the manager renders through the exit animation instead of
                  blanking mid-fade; it reloads on the next mount. */}
              <AiProviderManager open={true} inline onClose={() => setView('assign')} onSaved={handleProvidersSaved} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
