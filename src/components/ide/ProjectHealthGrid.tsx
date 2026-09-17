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
    <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{name}</h3>
        <StatusIcon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>{commits} commits</span>
        {issues !== undefined && <span>{issues} issues</span>}
        {lastCommit && <span>{lastCommit}</span>}
      </div>
    </div>
  )
}

interface ProjectHealthGridProps {
  overview?: { projects?: ProjectHealthCardProps[] }
}

export function ProjectHealthGrid({ overview }: ProjectHealthGridProps) {
  const projects = overview?.projects ?? []

  if (projects.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--color-card)] p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">No projects tracked yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => (
        <ProjectHealthCard key={project.id} {...project} />
      ))}
    </div>
  )
}
