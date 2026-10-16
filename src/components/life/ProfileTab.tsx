import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, TrendingUp, Target, Brain, MessageSquare, Activity, ChevronDown, ChevronRight, RefreshCw, Download, Copy, Check, FileJson, Sparkles, ShieldCheck } from 'lucide-react'
import { RadarChart } from './RadarChart'
import { ActivityHeatmap } from './ActivityHeatmap'
import { InterestCloud } from './InterestCloud'
import { ProfileCard } from './ProfileCard'
import { EvidenceDrawer } from './EvidenceDrawer'
import { MagicCard } from '../ui/magic-card'
import { NumberTicker } from '../ui/number-ticker'
import { GlareHover } from '../ui/glare-hover'
import { SectionHeader } from '../SectionHeader'
import { confetti } from '../ui/confetti'

console.log('%c[ProfileTab] v2.0 loaded', 'color: #fbbf24; font-weight: bold')

interface ProfileData {
  traits: Record<string, { content: string; confidence: number; occurrences: number; source: string }>
  interests: Record<string, { content: string; confidence: number; occurrences: number; source: string }>
  habits: Record<string, { content: string; confidence: number; occurrences: number; source: string }>
  communicationStyle: Record<string, { content: string; confidence: number; occurrences: number; source: string }>
  goalsPattern: Record<string, any>
  activityPattern: Record<string, any>
  growthMarkers: Array<{ date: string; label: string; source: string; type: string }>
  memoryHighlights?: Array<{ content: string; source: string; importance: number }>
  summary?: string
}

interface EvidenceState {
  category: string
  label: string
  accent: string
  item: { content: string; confidence: number; occurrences: number; source: string }
}

const SKELETON = 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)'

export function ProfileTab() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))
  const [copiedJson, setCopiedJson] = useState(false)
  const [debug, setDebug] = useState<any>(null)
  const [memoryHighlights, setMemoryHighlights] = useState<Array<{ content: string; source: string; importance: number }>>([])
  const [evidence, setEvidence] = useState<EvidenceState | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      const api = (window as any).deskflowAPI
      if (api?.contextGetProfile) {
        const data = await api.contextGetProfile()
        setProfile(data)
        setMemoryHighlights(data?.memoryHighlights || [])
      }
      if (api?.contextGetDebug) {
        const d = await api.contextGetDebug()
        setDebug(d)
      }
    } catch (e) {
      console.error('[Profile] Load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleRebuild = async () => {
    try {
      setRebuilding(true)
      const api = (window as any).deskflowAPI
      if (api?.contextRebuild) {
        await api.contextRebuild()
        await loadProfile()
        try {
          confetti({ particleCount: 80, spread: 70, startVelocity: 32, colors: ['#8b5cf6', '#22c55e', '#f59e0b', '#fafafa'] })
        } catch { /* confetti optional */ }
      }
    } catch (e) {
      console.error('[Profile] Rebuild failed:', e)
    } finally {
      setRebuilding(false)
    }
  }

  const openEvidence = (category: string, label: string, accent: string, item: any) => {
    setEvidence({ category, label, accent, item })
  }

  const handleCopyJson = useCallback(async () => {
    if (!profile) return
    const exportData = {
      _meta: { exportedAt: new Date().toISOString(), source: 'DeskFlow', version: profile.growthMarkers ? 1 : 0 },
      personality: {
        traits: Object.values(profile.traits || {}).map((t: any) => ({ trait: t.content, confidence: t.confidence, count: t.occurrences })),
        communication: Object.values(profile.communicationStyle || {}).map((c: any) => ({ style: c.content, confidence: c.confidence })),
      },
      interests: Object.values(profile.interests || {}).map((i: any) => ({ topic: i.content, score: i.confidence, mentioned: i.occurrences })),
      habits: Object.values(profile.habits || {}).map((h: any) => ({ habit: h.content, confidence: h.confidence })),
      growth: (profile.growthMarkers || []).map((m: any) => ({ date: m.date, milestone: m.label, source: m.source })),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    } catch {}
  }, [profile])

  const handleDownloadJson = useCallback(() => {
    if (!profile) return
    const exportData = {
      _meta: { exportedAt: new Date().toISOString(), source: 'DeskFlow' },
      personality: {
        traits: Object.values(profile.traits || {}).map((t: any) => ({ trait: t.content, confidence: t.confidence, count: t.occurrences })),
        communication: Object.values(profile.communicationStyle || {}).map((c: any) => ({ style: c.content, confidence: c.confidence })),
      },
      interests: Object.values(profile.interests || {}).map((i: any) => ({ topic: i.content, score: i.confidence })),
      habits: Object.values(profile.habits || {}).map((h: any) => ({ habit: h.content, confidence: h.confidence })),
      growth: (profile.growthMarkers || []).map((m: any) => ({ date: m.date, milestone: m.label, source: m.source })),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deskflow-context-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [profile])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ width: 140, height: 16, borderRadius: 6, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
            <div style={{ width: 220, height: 10, marginTop: 8, borderRadius: 6, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
          </div>
          <div style={{ width: 90, height: 30, borderRadius: 8, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 16, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
          ))}
        </div>
        <div style={{ height: 96, borderRadius: 16, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
        <div style={{ height: 180, borderRadius: 16, background: SKELETON, backgroundSize: '200% 100%', animation: 'dk-shimmer 1.4s infinite' }} />
        <style>{`@keyframes dk-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div style={{ width: 72, height: 72, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <User size={30} style={{ color: '#a855f7' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: '#d4d4d8' }}>No profile data yet</p>
          <p className="text-xs mt-1" style={{ color: '#52525b' }}>Chat with the AI, set goals, or log life phases — the profile derives itself from evidence.</p>
        </div>
      </div>
    )
  }

  const totalSignals = Object.keys(profile.traits || {}).length + Object.keys(profile.interests || {}).length + Object.keys(profile.habits || {}).length

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Context Profile"
          icon={<User className="w-4 h-4" />}
          titleClassName="text-[15px]"
          action={
            <p className="text-[11px] text-zinc-500">
              Auto-derived from {totalSignals} signals · never hand-edited
            </p>
          }
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-60"
            style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.2)' }}
          >
            <RefreshCw size={11} className={rebuilding ? 'animate-spin' : ''} /> {rebuilding ? 'Rebuilding…' : 'Rebuild'}
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Traits', value: Object.keys(profile.traits || {}).length, accent: '#a855f7', icon: <Brain size={12} /> },
          { label: 'Interests', value: Object.keys(profile.interests || {}).length, accent: '#22c55e', icon: <Target size={12} /> },
          { label: 'Milestones', value: (profile.growthMarkers || []).length, accent: '#f59e0b', icon: <TrendingUp size={12} /> },
        ].map(stat => (
          <GlareHover key={stat.label} style={{ borderRadius: 16 }}>
            <div style={{ borderRadius: 16, padding: 12, background: 'rgba(9, 9, 11, 0.80)', border: `1px solid ${stat.accent}22`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 10, right: 10, color: stat.accent, opacity: 0.5 }}>{stat.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#fafafa' }}>
                <NumberTicker value={stat.value} />
              </div>
              <div style={{ fontSize: 10, marginTop: 2, color: '#71717a' }}>{stat.label}</div>
            </div>
          </GlareHover>
        ))}
      </div>

      {/* Summary — MagicCard */}
      {profile.summary && (
        <div style={{ borderRadius: 16 }}>
          <MagicCard
            gradientFrom="var(--color-violet-400)"
            gradientTo="var(--color-violet-300)"
            borderColor="rgba(var(--color-violet-400-rgb), 0.35)"
          >
            <div style={{ borderRadius: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} style={{ color: 'var(--color-violet-400)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Profile Summary</span>
                <ShieldCheck size={12} style={{ color: 'var(--color-emerald-400)', marginLeft: 'auto' }} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', margin: 0 }}>{profile.summary}</p>
            </div>
          </MagicCard>
        </div>
      )}

      {/* Personality Radar */}
      {Object.keys(profile.traits || {}).length >= 3 && (
        <ProfileCard title="Personality Radar" icon={<Brain size={14} />} accent="#8b5cf6" dot>
          <div className="flex justify-center">
            <RadarChart data={profile.traits} size={230} accentColor="#8b5cf6" />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {Object.entries(profile.traits).slice(0, 8).map(([key, item]) => (
              <button
                key={key}
                onClick={() => openEvidence('trait', item.content, '#8b5cf6', item)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: '#a78bfa' }}
                title="Click for evidence"
              >
                {item.content}
              </button>
            ))}
          </div>
        </ProfileCard>
      )}

      {/* Interest Cloud */}
      {Object.keys(profile.interests || {}).length > 0 && (
        <ProfileCard title="Interest Map" icon={<Target size={14} />} accent="#22c55e" dot>
          <InterestCloud data={profile.interests} accentColor="#22c55e" />
          <div className="text-center mt-2">
            <button
              onClick={() => {
                const first = Object.values(profile.interests)[0]
                openEvidence('interest', first.content, '#22c55e', first)
              }}
              className="text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', color: '#4ade80' }}
            >
              View evidence
            </button>
          </div>
        </ProfileCard>
      )}

      {/* Activity Heatmap */}
      <ProfileCard title="Activity Pattern" icon={<Activity size={14} />} accent="#f59e0b" dot>
        <div className="overflow-x-auto pb-1">
          <ActivityHeatmap data={profile.activityPattern} accentColor="#f59e0b" />
        </div>
      </ProfileCard>

      {/* Communication Style */}
      {Object.keys(profile.communicationStyle || {}).length > 0 && (
        <ProfileCard title="Communication Style" icon={<MessageSquare size={14} />} accent="#ef4444">
          <div className="space-y-1.5">
            {Object.values(profile.communicationStyle).map((item: any, i: number) => (
              <button
                key={i}
                onClick={() => openEvidence('communication style', item.content, '#ef4444', item)}
                className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
                title="Click for evidence"
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ef4444' }} />
                <span className="text-xs flex-1" style={{ color: '#d4d4d8' }}>{item.content}</span>
                <div className="w-16 h-1 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round((item.confidence || 0) * 100)}%`, background: '#ef4444' }} />
                </div>
              </button>
            ))}
          </div>
        </ProfileCard>
      )}

      {/* Habits */}
      {Object.keys(profile.habits || {}).length > 0 && (
        <ProfileCard title="Habits & Patterns" icon={<Activity size={14} />} accent="#06b6d4">
          <div className="space-y-1.5">
            {Object.values(profile.habits).map((item: any, i: number) => (
              <button
                key={i}
                onClick={() => openEvidence('habit', item.content, '#06b6d4', item)}
                className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
                title="Click for evidence"
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#06b6d4' }} />
                <span className="text-xs flex-1" style={{ color: '#d4d4d8' }}>{item.content}</span>
                <span className="text-[10px] shrink-0" style={{ color: '#52525b' }}>{item.occurrences || 1}x</span>
              </button>
            ))}
          </div>
        </ProfileCard>
      )}

      {/* Growth Timeline */}
      {(profile.growthMarkers || []).length > 0 && (
        <ProfileCard
          title="Growth Timeline"
          icon={<TrendingUp size={14} />}
          accent="#22c55e"
          action={
            <button onClick={() => toggleSection('growth')} className="flex items-center gap-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a' }}>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>{profile.growthMarkers.length}</span>
              {expandedSections.has('growth') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          }
        >
          <AnimatePresence>
            {expandedSections.has('growth') && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="relative pl-4 border-l-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  {profile.growthMarkers.slice(0, 20).map((marker, i) => (
                    <div key={i} className="relative mb-3 last:mb-0">
                      <div className="absolute -left-[21px] w-3 h-3 rounded-full border-2" style={{ background: marker.type === 'life_phase' ? '#22c55e' : '#8b5cf6', borderColor: '#09090b', boxShadow: `0 0 8px ${marker.type === 'life_phase' ? 'rgba(34,197,94,0.5)' : 'rgba(139,92,246,0.5)'}` }} />
                      <div className="text-[10px] font-mono" style={{ color: '#52525b' }}>{marker.date}</div>
                      <div className="text-xs" style={{ color: '#d4d4d8' }}>{marker.label}</div>
                      <div className="text-[10px]" style={{ color: '#52525b' }}>via {marker.source.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ProfileCard>
      )}

      {/* Memory Highlights */}
      {memoryHighlights.length > 0 && (
        <ProfileCard
          title="Key Memories"
          icon={<Brain size={14} />}
          accent="#f59e0b"
          action={<span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#71717a' }}>{memoryHighlights.length}</span>}
        >
          <div className="space-y-2">
            {memoryHighlights.slice(0, 8).map((m, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: m.source === 'signal' ? '#f59e0b' : m.source === 'agent_memory' ? '#8b5cf6' : '#06b6d4' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs" style={{ color: '#d4d4d8' }}>{m.content}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#52525b' }}>{m.source.replace('_', ' ')} · {Math.round(m.importance * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </ProfileCard>
      )}

      {/* Export Section */}
      <ProfileCard title="Export Context for Other AIs" icon={<FileJson size={14} />} accent="#8b5cf6">
        <p className="text-[11px]" style={{ color: '#52525b', margin: '0 0 10px' }}>
          Copy this profile as JSON to give to any AI system — Claude, GPT, Gemini, etc. It contains your personality, interests, habits, communication style, and growth timeline.
        </p>
        <div className="flex gap-2">
          <button onClick={handleCopyJson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all" style={{ background: copiedJson ? 'rgba(34, 197, 94, 0.15)' : 'rgba(139, 92, 246, 0.1)', color: copiedJson ? '#22c55e' : '#a78bfa', border: `1px solid ${copiedJson ? 'rgba(34, 197, 94, 0.3)' : 'rgba(139, 92, 246, 0.2)'}` }}>
            {copiedJson ? <Check size={11} /> : <Copy size={11} />}
            {copiedJson ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={handleDownloadJson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Download size={11} /> Download
          </button>
        </div>
      </ProfileCard>

      {/* Debug Panel */}
      {debug && (
        <ProfileCard
          title="Debug"
          icon={<Activity size={14} />}
          accent="#71717a"
          action={
            <button onClick={() => toggleSection('debug')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b' }}>
              {expandedSections.has('debug') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          }
        >
          <AnimatePresence>
            {expandedSections.has('debug') && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="text-[10px] font-mono space-y-1" style={{ color: '#52525b' }}>
                  <div>Profile v{debug.profileVersion} · {debug.signalCount} signals · {debug.sources?.length || 0} sources</div>
                  <div>Last rebuilt: {debug.lastUpdatedAt ? new Date(debug.lastUpdatedAt).toLocaleString() : 'never'}</div>
                  {debug.summary && <div className="mt-1 text-xs" style={{ color: '#a1a1aa' }}>{debug.summary}</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ProfileCard>
      )}

      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={!!evidence}
        label={evidence?.label || ''}
        category={evidence?.category || ''}
        accent={evidence?.accent || '#a855f7'}
        item={evidence?.item || null}
        onClose={() => setEvidence(null)}
      />
    </div>
  )
}