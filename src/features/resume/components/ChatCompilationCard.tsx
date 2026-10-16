import { motion } from 'framer-motion';
import { MessageSquare, CheckCircle, Clock, XCircle, Trash2, Eye } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import type { ChatCompilation } from '../../types/resume';

interface ChatCompilationCardProps {
  compilation: ChatCompilation;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

const sourceColors: Record<string, string> = {
  chatgpt: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  claude: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
  cursor: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  manual: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20',
  mobile_scan: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
  document_upload: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20',
};

const statusConfig = {
  processing: { icon: Clock, color: 'text-amber-400', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
};

export function ChatCompilationCard({ compilation, onView, onDelete }: ChatCompilationCardProps) {
  const status = statusConfig[compilation.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5 hover:border-zinc-700/60 transition-all duration-150 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--page-accent)]/20 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--page-accent-15)] flex items-center justify-center ring-1 ring-[var(--page-accent)]/20 shrink-0">
          <MessageSquare className="w-5 h-5 text-[var(--page-accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">{compilation.sessionName}</h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${sourceColors[compilation.source] || sourceColors.manual}`}>
              {compilation.source}
            </span>
          </div>
          <p className="text-xs text-zinc-400 line-clamp-2 mb-2 leading-relaxed">{compilation.transcriptPreview}</p>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span>{compilation.takeawayCount} takeaways</span>
            <span className="text-emerald-400">{compilation.confirmedCount} confirmed</span>
            <span>{new Date(compilation.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
          <Button variant="ghost" size="icon-xs" onClick={() => onView(compilation.id)} title="View details">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onDelete(compilation.id)} title="Delete" className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
