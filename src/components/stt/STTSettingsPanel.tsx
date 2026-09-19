/**
 * STTSettingsPanel.tsx — STT settings panel (inline, opened from overlay gear)
 * R-46: settings embedded in overlay, not SettingsPage.
 * R-47: Engine tab READ-ONLY (no set-config IPC).
 * R-48: token colors, {6,10,16} radii, no shadow/blur/spring.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Brain, Activity, Keyboard, Check, Sparkles, X, Download, Upload } from 'lucide-react';
import { useLocalStt } from '../../hooks/useLocalStt';
import { STTVocabManager } from './STTVocabManager';
import { SttCategoryColors } from '../../lib/sttStore';

type Tab = 'engine' | 'vocab' | 'shortcut';

export function STTSettingsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('engine');
  const stt = useLocalStt();
  const [captureKey, setCaptureKey] = useState(false);
  const [capturedKeys, setCapturedKeys] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  // Load current shortcut on mount
  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.deskflowAPI?.sttGetRegisteredShortcut();
        if (result) setRegistered(result.shortcut);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  // Capture key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!captureKey) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');

    const keyMap: Record<string, string> = {
      ' ': 'Space', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
      Enter: 'Enter', Escape: 'Escape', Tab: 'Tab',
      Delete: 'Delete', Backspace: 'Backspace',
      Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
      Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
      KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F',
      KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
      KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R',
      KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
      KeyY: 'Y', KeyZ: 'Z',
      F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
      F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
    };

    const rawKey = e.key;
    const mapped = keyMap[rawKey] || rawKey;
    if (parts.length === 0 && ['Control', 'Shift', 'Alt', 'Meta', ''].includes(mapped)) return;

    parts.push(mapped);
    setCapturedKeys(parts);

    if (parts.length >= 1 && (mapped === 'Enter' || mapped === 'Escape')) return;
    // Stop capturing after we have a usable combo
    if (parts.length >= 2 || (parts.length === 1 && mapped.length === 1)) {
      // Don't auto-register; user clicks Register
    }
  }, [captureKey]);

  useEffect(() => {
    if (!captureKey) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captureKey, handleKeyDown]);

  const startCapture = useCallback(() => {
    setCapturedKeys([]);
    setCaptureKey(true);
  }, []);

  const cancelCapture = useCallback(() => {
    setCaptureKey(false);
    setCapturedKeys([]);
  }, []);

  const doRegister = useCallback(async () => {
    if (capturedKeys.length === 0) return;
    setRegistering(true);
    try {
      const shortcut = capturedKeys.join('+');
      const result = await window.deskflowAPI?.sttRegisterShortcut(shortcut);
      if (result?.ok) {
        setRegistered(shortcut);
        setCaptureKey(false);
      } else {
        console.error('[STT Settings] Failed to register shortcut:', result?.error);
      }
    } finally {
      setRegistering(false);
    }
  }, [capturedKeys]);

  const getShortcutLabel = (keys: string[]) => {
    if (keys.length === 0) return 'Not set';
    return keys.map(k => (
      <span key={k} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <kbd style={{
          padding: '1px 5px',
          background: 'var(--color-card)',
          border: '1px solid var(--ws-border)',
          borderRadius: '3px',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          marginRight: keys.length > 1 && k !== keys[keys.length - 1] ? 3 : 0,
        }}>
          {k}
        </kbd>
        {keys.indexOf(k) < keys.length - 1 && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 2, marginRight: 2 }}>+</span>
        )}
      </span>
    ));
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--color-card)',
        border: '1px solid var(--ws-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--ws-border)',
          background: 'rgb(0 0 0 / 0.1)',
        }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '4px', background: 'rgb(0 0 0 / 0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Settings style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>STT Settings</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            display: 'grid', placeItems: 'center',
            width: 22, height: 22,
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
          aria-label="Close settings"
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)' }}>
        {(['engine', 'vocab', 'shortcut'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--resume-info)' : 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: t === tab ? 600 : 400,
              color: t === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              textTransform: 'capitalize',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (tab !== t) (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { if (tab !== t) (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <AnimatePresence mode="wait">
          {tab === 'engine' && (
            <motion.div
              key="engine"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {/* Status display */}
              <div style={{ padding: '8px 10px', background: 'rgb(0 0 0 / 0.15)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 6, height: 6, borderRadius: '50%', background: 'var(--resume-success)' }} />
                  Engine status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Model</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{stt.model}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Device</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>cpu</span>
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ASR Model
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {[
                    { id: 'tiny', label: 'Tiny', ram: '~39MB' },
                    { id: 'base', label: 'Base', ram: '~74MB' },
                    { id: 'small', label: 'Small', ram: '~244MB' },
                    { id: 'medium', label: 'Medium', ram: '~488MB' },
                    { id: 'large-v3', label: 'Large', ram: '~1.5GB' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        // Read-only: no set-config IPC
                        console.warn('[STT Settings] Model change not available — no set-config IPC. Use daemon config file.');
                      }}
                      style={{
                        padding: '6px 4px',
                        background: stt.model === m.id ? 'rgb(0 0 0 / 0.3)' : 'transparent',
                        border: stt.model === m.id ? '1px solid var(--resume-info)' : '1px solid var(--ws-border)',
                        borderRadius: '6px',
                        cursor: 'not-allowed',
                        textAlign: 'center',
                        opacity: 0.6,
                        transition: 'none',
                      }}
                      aria-label={`Model: ${m.label}`}
                      title="Model selection not available in this build (no set-config IPC)"
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.ram}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                  Engine changes are deferred — no set-config IPC available. Edit daemon config file directly.
                </div>
              </div>

              {/* Read-only config */}
              <div style={{ padding: '8px 10px', background: 'rgb(0 0 0 / 0.1)', borderRadius: '6px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current configuration
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>VAD</span>
                  <span style={{ color: 'var(--text-primary)' }}>Enabled</span>
                  <span style={{ color: 'var(--text-muted)' }}>Beam size</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>5</span>
                  <span style={{ color: 'var(--text-muted)' }}>Silence</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>800ms</span>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'vocab' && (
            <motion.div
              key="vocab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 120 }}
            >
              <STTVocabManager />
              <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgb(0 0 0 / 0.1)', borderRadius: '4px', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 12, height: 12, borderRadius: '3px', background: 'rgb(0 0 0 / 0.2)' }}>
                  <Download style={{ width: 8, height: 8, color: 'var(--text-muted)' }} />
                </span>
                <span>Load from file: sttLocalVocabLoad (uses vocab.json)</span>
              </div>
            </motion.div>
          )}

          {tab === 'shortcut' && (
            <motion.div
              key="shortcut"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {/* Current shortcut */}
              <div style={{ padding: '8px 10px', background: 'rgb(0 0 0 / 0.15)', borderRadius: '6px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current shortcut
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                  {registered ? getShortcutLabel(registered.split('+')) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Ctrl+Shift+V (default)</span>
                  )}
                </div>
              </div>

              {/* Capture control */}
              <div style={{ padding: '8px 10px', background: 'rgb(0 0 0 / 0.1)', borderRadius: '6px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Change shortcut
                </div>

                {!captureKey ? (
                  <button
                    onClick={startCapture}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: 'rgb(0 0 0 / 0.2)',
                      border: '1px solid var(--resume-info)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      minHeight: 28,
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.35)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.2)'}
                    aria-label="Start capturing shortcut"
                  >
                    <Keyboard style={{ width: 12, height: 12 }} />
                    Click to capture key combination
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--resume-info)', fontSize: 11 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--resume-info)' }} />
                      Press keys…
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                      {capturedKeys.length > 0 ? getShortcutLabel(capturedKeys) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>Waiting…</span>
                      )}
                    </div>
                    <button
                      onClick={cancelCapture}
                      style={{
                        display: 'grid', placeItems: 'center',
                        width: 22, height: 22,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                      aria-label="Cancel capture"
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                )}

                {capturedKeys.length > 0 && (
                  <button
                    onClick={doRegister}
                    disabled={registering}
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      background: 'var(--resume-success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: registering ? 'not-allowed' : 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                      opacity: registering ? 0.5 : 1,
                    }}
                    aria-label="Register shortcut"
                  >
                    {registering ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ borderRadius: '50%', border: '1.5px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        Registering…
                      </>
                    ) : (
                      <>
                        <Check style={{ width: 10, height: 10 }} />
                        Register
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Info */}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0', lineHeight: 1.5 }}>
                The shortcut works globally — press it anywhere to toggle the STT overlay. Default is <kbd style={{ padding: '0 3px', background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', margin: '0 2px' }}>Ctrl+Shift+V</kbd>.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
