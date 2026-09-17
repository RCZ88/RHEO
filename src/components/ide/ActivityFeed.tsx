import { useState } from 'react'
import { GitCommit, GitPullRequest, Sparkles, AlertCircle } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'commit' | 'pr' | 'issue' | 'ai'
  title: string
  timestamp: string
  project?: string
}

interface ActivityFeedProps {
  items?: ActivityItem[]
}

const typeConfig = {
  commit: { icon: GitCommit, color: 'text-[var(--page-accent)]' },
  pr: { icon: GitPullRequest, color: 'text-violet-400' },
  issue: { icon: AlertCircle, color: 'text-amber-400' },
  ai: { icon: Sparkles, color: 'text-emerald-400' },
}

const DEFAULT_ITEMS: ActivityItem[] = [
  { id: '1', type: 'commit', title: 'Fix IDE layout issues', timestamp: '2h ago', project: 'rheo' },
  { id: '2', type: 'pr', title: 'Add PulseRing component', timestamp: '5h ago', project: 'rheo' },
  { id: '3', type: 'ai', title: 'AI code review completed', timestamp: '1d ago' },
]

export function ActivityFeed({ items = DEFAULT_ITEMS }: ActivityFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const config = typeConfig[item.type]
        const Icon = config.icon
        const isExpanded = expandedId === item.id
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-[10px] bg-[var(--color-card)] border border-[var(--border-hairline)] p-3 hover:border-[rgba(255,255,255,0.2)] transition-colors cursor-pointer"
            onClick={() => setExpandedId(isExpanded ? null : item.id)}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] truncate">{item.title}</p>
              <p className="text-xs text-[var(--text-muted)]">{item.project && `${item.project} · `}{item.timestamp}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
