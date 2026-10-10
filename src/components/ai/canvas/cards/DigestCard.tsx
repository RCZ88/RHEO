import type { CanvasCard } from '../../../../types/canvas'
import { StateView, type ViewState } from '../shared/StateView'
import { Newspaper } from 'lucide-react'

interface DigestCardProps {
  card: CanvasCard
  topics?: any[]
  loading?: boolean
  error?: string
  onGenerate?: () => void
  onConfigure?: () => void
}

export function DigestCard({ card, topics = [], loading, error, onGenerate, onConfigure }: DigestCardProps) {
  const data = card.data || {}
  const items = data.topics || topics

  const state: ViewState = loading ? 'loading' : error ? 'error' : items.length === 0 ? 'empty' : 'populated'

  return (
    <StateView
      state={state}
      loadingType="chart"
      emptyProps={{
        icon: Newspaper,
        title: 'No research topics',
        description: 'Configure research topics in Settings → AI, then refresh the digest.',
        ctaLabel: 'Configure in Settings',
        onCta: onConfigure,
      }}
      errorProps={{ message: error || data.error || 'Digest generation failed' }}
    >
      <div className="card-digest">
        <ul className="card-digest-list">
          {items.slice(0, 8).map((t: any, i: number) => (
            <li key={i} className="card-digest-item">
              <span className="card-digest-topic">{t.topic || t.title}</span>
              {t.summary ? (
                <span className="card-digest-summary">{t.summary.slice(0, 100)}...</span>
              ) : (
                <span className="card-digest-summary" style={{ fontStyle: 'italic', opacity: 0.5 }}>No summary for this range. Summaries are generated after a session completes. — refresh to generate</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </StateView>
  )
}