import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, Hash, Radio, Repeat } from 'lucide-react'

interface EvidenceItem {
  content: string
  confidence: number
  occurrences: number
  source: string
}

interface EvidenceDrawerProps {
  open: boolean
  label: string
  category: string
  accent: string
  item: EvidenceItem | null
  onClose: () => void
}

export function EvidenceDrawer({ open, label, category, accent, item, onClose }: EvidenceDrawerProps) {
  const [signals, setSignals] = useState<any[]>([])
  const [loadingSignals, setLoadingSignals] = useState(false)

  const loadSignals = useCallback(async () => {
    if (!open || !item) return
    setLoadingSignals(true)
    setSignals([])
    try {
      const api = (window as any).deskflowAPI
      if (api?.contextGetSignals) {
        const raw = await api.contextGetSignals()
        const arr = Array.isArray(raw) ? raw : raw?.items || []
        const keyword = (item.content || '').toLowerCase()
        const matched = arr.filter((s: any) => {
          const text = String(s.content || s.signal_content || '').toLowerCase()
          const src = String(s.source || '').toLowerCase()
          const cat = String(s.signalType || s.signal_type || '').toLowerCase()
          return text.includes(keyword) || src.includes(keyword) || (cat === category && text.length > 0)
        })
        setSignals(matched.slice(0, 20))
      }
    } catch {
      setSignals([])
    } finally {
      setLoadingSignals(false)
    }
  }, [open, item, category])

  useEffect(() => { loadSignals() }, [loadSignals])

  return (
    <AnimatePresence>
      {open && item && (
        <>
          <motion.div
            key="drawer-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'var(--ws-scrim)', zIndex: 998 }}
          />
          <motion.div
            key="drawer"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '92vw',
              background: 'var(--ws-surface)',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid var(--ws-border)',
              zIndex: 999,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ws-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: accent }}>
                    {category} · Evidence
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {label}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, background: 'var(--ws-surface-raised)',
                    border: '1px solid var(--ws-border)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {/* Confidence summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ws-surface-raised)', border: '1px solid var(--ws-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <ShieldCheck size={11} style={{ color: accent }} />
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                    {Math.round((item.confidence || 0) * 100)}%
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ws-surface-raised)', border: '1px solid var(--ws-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Hash size={11} style={{ color: accent }} />
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mentions</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                    {item.occurrences || 1}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ws-surface-raised)', border: '1px solid var(--ws-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Radio size={11} style={{ color: accent }} />
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(item.source || 'inferred').replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* What it means */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  What this means
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                  Derived automatically from your interactions — never hand-edited. Higher confidence means
                  stronger, more explicit or more recent evidence. A contradiction closes the old fact
                  (bitemporal) and opens a new one.
                </p>
              </div>

              {/* Matching signals */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Matching signals ({signals.length})
                </div>
                {loadingSignals ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading signals…</div>
                ) : signals.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <Repeat size={11} /> No raw signals matched — this entry was inferred by the profile engine.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {signals.map((s, i) => (
                      <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--ws-surface-raised)', border: '1px solid var(--ws-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: accent, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
                            {String(s.source || 'unknown').replace(/_/g, ' ')}
                          </span>
                          {s.confidence != null && (
                            <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {Math.round(s.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                          {String(s.content || s.signal_content || '').slice(0, 220)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}