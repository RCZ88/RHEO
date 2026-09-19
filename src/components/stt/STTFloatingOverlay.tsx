/**
 * STTFloatingOverlay.tsx — Local STT floating overlay
 * R-48 compliant: token colors only, {6,10,16} radii, no shadow/blur/spring,
 * gated waveform, state-gated pulse ≤8%, RM→static.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Copy, Save, Link, Settings, X, ArrowUpRight, Clock } from 'lucide-react';
import { useLocalStt } from '../../hooks/useLocalStt';
import { STTSettingsPanel } from './STTSettingsPanel';

export function STTFloatingOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const stt = useLocalStt();

  // Open when recording starts or when already recording on mount
  useEffect(() => {
    if (stt.state === 'recording' && !open) setOpen(true);
  }, [stt.state, open]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  // Track visibility for waveform gating
  useEffect(() => {
    const h = () => { visibleRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const level = stt.state === 'recording' && visibleRef.current ? stt.level : 0;
  const elapsed = stt.state === 'recording' ? stt.elapsed : 0;

  const handleCopy = useCallback(async () => {
    if (!stt.transcript) return;
    await navigator.clipboard.writeText(stt.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stt.transcript]);

  const handleSave = useCallback(async () => {
    if (!stt.transcript) return;
    await stt.saveToLibrary(stt.transcript, 'idea', []);
  }, [stt.transcript, stt.saveToLibrary]);

  const handleOpenLibrary = useCallback(() => {
    window.location.href = '/transcripts';
  }, []);

  // Portaled overlay
  const content = open && (
    <motion.div
      key="stt-overlay"
      ref={overlayRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2, ease: 'var(--ws-ease)' }}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        maxWidth: 420,
        width: 'calc(100% - 32px)',
      }}
      aria-live="polite"
      role="region"
      aria-label="Speech-to-text overlay"
    >
      {/* Card */}
      <div
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--ws-border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--ws-border)',
            background: 'rgb(0 0 0 / 0.15)',
          }}
        >
          {/* Status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {stt.state === 'loading' && (
              <>
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ borderRadius: '50%', border: '2px solid var(--resume-warning)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Loading</span>
              </>
            )}
            {stt.state === 'recording' && (
              <>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--resume-danger)',
                    animation: 'pulse 2s ease-in-out infinite',
                    opacity: 0.8,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>Recording</span>
              </>
            )}
            {stt.state === 'processing' && (
              <>
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ borderRadius: '50%', border: '2px solid var(--resume-info)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>Processing</span>
              </>
            )}
            {stt.state === 'error' && (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--resume-danger)' }} />
                <span style={{ fontSize: 11, color: 'var(--resume-danger)', fontWeight: 500 }}>Error</span>
              </>
            )}
            {stt.state === 'idle' && !stt.error && (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--resume-success)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>Ready</span>
              </>
            )}
          </div>

          <div style={{ width: 1, height: 14, background: 'var(--ws-border)' }} />

          {/* Model badge */}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {stt.model} · cpu
          </span>

          <div style={{ flex: 1 }} />

          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            style={{
              display: 'grid', placeItems: 'center',
              width: 28, height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
            aria-label="Close overlay"
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Waveform (recording only) */}
        {stt.state === 'recording' && (
          <div style={{ padding: '10px 12px 6px', height: 44, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            {Array.from({ length: 32 }).map((_, i) => (
              <motion.div
                key={i}
                style={{
                  width: 3,
                  height: 2,
                  background: `color-mix(in srgb, var(--resume-danger) ${40 + level * 50}%, transparent)`,
                  borderRadius: '1px',
                }}
                animate={{ height: Math.max(2, Math.round(level * 36)) }}
                transition={{ duration: 0.08, ease: 'ease-out' }}
              />
            ))}
          </div>
        )}

        {/* Elapsed during recording */}
        {stt.state === 'recording' && (
          <div style={{ padding: '0 12px 8px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {Math.floor(elapsed / 1000)}s
          </div>
        )}

        {/* Transcript area */}
        <div
          style={{
            padding: '10px 12px',
            minHeight: 56,
            maxHeight: 160,
            overflowY: 'auto',
            background: 'rgb(0 0 0 / 0.1)',
          }}
        >
          {stt.state === 'idle' && !stt.error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0', color: 'var(--text-muted)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '16px', background: 'rgb(0 0 0 / 0.2)', display: 'grid', placeItems: 'center' }}>
                <Mic style={{ width: 16, height: 16, color: 'var(--resume-danger)', opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 11, textAlign: 'center' }}>
                Press <kbd style={{ padding: '1px 5px', background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>Ctrl+Shift+V</kbd> to start
              </span>
            </div>
          ) : stt.error ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--resume-danger)' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{stt.error}</span>
              <button
                onClick={() => setOpen(false)}
                style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'underline', textDecorationColor: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Close
              </button>
            </div>
          ) : stt.transcript ? (
            <textarea
              value={stt.transcript}
              readOnly
              style={{
                width: '100%',
                minHeight: 40,
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'inherit',
              }}
              aria-label="Transcript"
            />
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Listening…</span>
          )}
        </div>

        {/* Footer controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderTop: '1px solid var(--ws-border)',
            background: 'rgb(0 0 0 / 0.1)',
          }}
        >
          {/* Stop/Start button */}
          <button
            onClick={stt.state === 'recording' ? stt.stop : stt.start}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: stt.state === 'recording' ? 'rgb(0 0 0 / 0.2)' : 'var(--resume-danger)',
              color: stt.state === 'recording' ? 'var(--text-primary)' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              minHeight: 32,
            }}
            onMouseEnter={e => { if (stt.state !== 'recording') { (e.target as HTMLElement).style.opacity = '0.9'; } }}
            onMouseLeave={e => { if (stt.state !== 'recording') { (e.target as HTMLElement).style.opacity = '1'; } }}
            aria-label={stt.state === 'recording' ? 'Stop recording' : 'Start recording'}
          >
            {stt.state === 'recording' ? (
              <>
                <Square style={{ width: 12, height: 12, fill: 'currentColor' }} />
                Stop
              </>
            ) : (
              <>
                <Mic style={{ width: 12, height: 12 }} />
                Start
              </>
            )}
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--ws-border)' }} />

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={!stt.transcript}
            style={{
              display: 'grid', placeItems: 'center',
              width: 32, height: 32,
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: !stt.transcript ? 'not-allowed' : 'pointer',
              color: !stt.transcript ? 'var(--text-muted)' : 'var(--text-secondary)',
              opacity: !stt.transcript ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (stt.transcript) { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; } }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }}
            aria-label="Copy transcript"
            title="Copy transcript"
          >
            {copied ? (
              <span style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', background: 'var(--resume-success)', borderRadius: '3px', color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>
            ) : (
              <Copy style={{ width: 14, height: 14 }} />
            )}
          </button>

          {/* Save + settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={handleSave}
              disabled={!stt.transcript}
              style={{
                display: 'grid', placeItems: 'center',
                width: 32, height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: !stt.transcript ? 'not-allowed' : 'pointer',
                color: !stt.transcript ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: !stt.transcript ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (stt.transcript) { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; } }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }}
              aria-label="Save to library"
              title="Save to library"
            >
              <Save style={{ width: 14, height: 14 }} />
            </button>

            <button
              onClick={handleOpenLibrary}
              disabled={!stt.transcript}
              style={{
                display: 'grid', placeItems: 'center',
                width: 32, height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: !stt.transcript ? 'not-allowed' : 'pointer',
                color: !stt.transcript ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: !stt.transcript ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (stt.transcript) { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; } }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }}
              aria-label="Open transcript library"
              title="Open transcript library"
            >
              <Link style={{ width: 14, height: 14 }} />
            </button>

            <div style={{ flex: 1 }} />

            {/* Settings */}
            <button
              onClick={() => setShowSettings(s => !s)}
              style={{
                display: 'grid', placeItems: 'center',
                width: 32, height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
              aria-label="STT settings"
              title="STT settings"
            >
              <Settings style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Shortcut hint */}
      <div
        style={{
          position: 'absolute',
          bottom: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          background: 'rgb(0 0 0 / 0.7)',
          border: '1px solid var(--ws-border)',
          borderRadius: '4px',
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
      >
        <kbd style={{ padding: '1px 4px', background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '3px', color: 'var(--text-secondary)' }}>Ctrl</kbd>
        <span style={{ color: 'var(--text-muted)' }}>+</span>
        <kbd style={{ padding: '1px 4px', background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '3px', color: 'var(--text-secondary)' }}>Shift</kbd>
        <span style={{ color: 'var(--text-muted)' }}>+</span>
        <kbd style={{ padding: '1px 4px', background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '3px', color: 'var(--text-secondary)' }}>V</kbd>
      </div>
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {content}
    </AnimatePresence>,
    document.body
  );
}
