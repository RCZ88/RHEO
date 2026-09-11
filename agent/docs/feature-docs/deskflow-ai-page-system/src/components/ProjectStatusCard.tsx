import { FolderGit2 } from 'lucide-react';
import { MetricCard } from './ai/MetricCard';

interface ProjectStatusCardProps {
  projectCount: number;
  recentProjectName?: string;
  recentProjectLanguage?: string;
  loading?: boolean;
  error?: string | null;
  updatedAt?: number;
  onRefresh?: () => void;
}

export function ProjectStatusCard({ projectCount, recentProjectName, recentProjectLanguage, loading, error, updatedAt = Date.now(), onRefresh }: ProjectStatusCardProps) {
  return (
    <MetricCard
      accent="emerald"
      icon={FolderGit2}
      label="Projects"
      value={projectCount}
      valueUnit="active"
      loading={!!loading}
      error={error}
      updatedAt={updatedAt}
      onRefresh={onRefresh}
    >
      {recentProjectName && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="truncate max-w-[120px]">{recentProjectName}</span>
          {recentProjectLanguage && (
            <span className="rounded px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-300">{recentProjectLanguage}</span>
          )}
        </div>
      )}
    </MetricCard>
  );
}
