import { GitCommit, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

interface ProjectHealthCardProps {
  name: string
  status: 'active' | 'stale' | 'archived'
  lastCommit?: string
  commits: number
  issues?: number
}

const statusConfig = {
  active: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Active' },
  stale: { icon: Clock, color: 'text-amber-400', label: 'Stale' },
  archived: { icon: AlertCircle, color: 'text-[var(--text-muted)]', label: 'Archived' },
}

export function ProjectHealthCard({ name, status, lastCommit, commits, issues }: ProjectHealthCardProps) {
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4 transition-colors duration-200 hover:bg-[var(--color-card-sunken)]">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--text-primary)]">{name}</h4>
        <div className={`flex items-center gap-1 text-xs ${config.color}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1">
          <GitCommit className="h-3 w-3" />
          <span>{commits} commits</span>
        </div>
        {issues !== undefined && (
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>{issues} issues</span>
          </div>
        )}
      </div>
      {lastCommit && (
        <div className="mt-2 text-[10px] text-[var(--text-muted)]">
          Last commit: {lastCommit}
        </div>
      )}
    </div>
  )
}

interface ProjectHealthGridProps {
  projects: ProjectHealthCardProps[]
}

export function ProjectHealthGrid({ projects }: ProjectHealthGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectHealthCard key={project.name} {...project} />
      ))}
    </div>
  )
}
