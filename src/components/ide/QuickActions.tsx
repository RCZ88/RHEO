import { Plus, FolderGit2, RefreshCw, Trash2, Scan } from 'lucide-react'

interface QuickAction {
  label: string
  icon: React.ElementType
  onClick: () => void
  variant?: 'default' | 'outline'
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { label: 'New Project', icon: Plus, onClick: () => {}, variant: 'default' },
  { label: 'Scan', icon: Scan, onClick: () => {}, variant: 'outline' },
  { label: 'Sync', icon: RefreshCw, onClick: () => {}, variant: 'outline' },
]

interface QuickActionsProps {
  actions?: QuickAction[]
}

export function QuickActions({ actions = DEFAULT_ACTIONS }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.15)] ${
              action.variant === 'outline'
                ? 'border border-[var(--border-hairline)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--color-card-sunken)] hover:text-[var(--text-primary)]'
                : 'bg-[var(--page-accent)] text-[var(--text-muted)] hover:opacity-90'
            }`}
          >
            <Icon className="h-4 w-4" />
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
