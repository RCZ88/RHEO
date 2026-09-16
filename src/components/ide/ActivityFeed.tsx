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
  items: ActivityItem[]
}

const typeConfig = {
  commit: { icon: GitCommit, color: 'text-[var(--page-accent)]' },
  pr: { icon: GitPullRequest, color: 'text-violet-400' },
  issue: { icon: AlertCircle, color: 'text-amber-400' },
  ai: { icon: Sparkles, color: 'text-emerald-400' },
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)]">Activity Feed</h3>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-2 text-sm text-[var(--text-muted)]">No recent activity</p>
            <p className="text-xs text-[var(--text-muted)]">Sync your projects to see updates</p>
          </div>
        ) : (
          items.map((item) => {
            const config = typeConfig[item.type]
            const Icon = config.icon
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-[8px] p-2 transition-colors duration-150 hover:bg-[var(--color-card-sunken)]">
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {item.project && <span>{item.project}</span>}
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
