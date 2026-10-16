import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Tag } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import type { Takeaway } from '../../../types/resume';

interface TakeawayCardProps {
  takeaway: Takeaway;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onUseInResume: (id: string) => void;
}

const confidenceConfig = {
  HIGH: { variant: 'default' as const, label: 'High Confidence' },
  MEDIUM: { variant: 'secondary' as const, label: 'Medium' },
  LOW: { variant: 'outline' as const, label: 'Low' },
};

const typeLabels: Record<string, string> = {
  PROJECT: 'Project',
  SKILL: 'Skill',
  PROBLEM_SOLVED: 'Problem Solved',
  OPTIMIZATION: 'Optimization',
  ARCHITECTURE_DECISION: 'Architecture',
  CERTIFICATION: 'Certification',
  CREDENTIAL: 'Credential',
};

export function TakeawayCard({ takeaway, onConfirm, onReject, onUseInResume }: TakeawayCardProps) {
  const confidence = confidenceConfig[takeaway.confidence];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border p-5 transition-all duration-150 overflow-hidden ${
        takeaway.status === 'confirmed'
          ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5'
          : takeaway.status === 'rejected'
          ? 'border-red-500/30 opacity-60'
          : 'border-zinc-800/60 hover:border-zinc-700/60'
      }`}
    >
      {/* Status accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
        takeaway.status === 'confirmed' ? 'via-emerald-500/40' : takeaway.status === 'rejected' ? 'via-red-500/40' : 'via-zinc-600/30'
      } to-transparent`} />

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="text-[10px]">{typeLabels[takeaway.takeawayType] || takeaway.takeawayType}</Badge>
        <Badge variant={confidence.variant} className="text-[10px]">{confidence.label}</Badge>
        <span className="text-[10px] text-zinc-500 ml-auto">{takeaway.source}</span>
      </div>

      <h4 className="text-sm font-semibold text-white mb-1.5">{takeaway.title}</h4>
      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">{takeaway.context}</p>

      {takeaway.techStack && takeaway.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {takeaway.techStack.map((tech) => (
            <span key={tech} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400 ring-1 ring-zinc-700/30 font-mono">
              {tech}
            </span>
          ))}
        </div>
      )}

      {takeaway.xyzBulletDraft && (
        <div className="p-3 rounded-lg bg-zinc-800/30 ring-1 ring-zinc-700/20 mb-4">
          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">XYZ Bullet</p>
          <p className="text-xs text-white font-mono leading-relaxed">{takeaway.xyzBulletDraft}</p>
        </div>
      )}

      {takeaway.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t border-zinc-800/40">
          <Button variant="ghost" size="sm" onClick={() => onConfirm(takeaway.id)} className="flex-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirm
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onReject(takeaway.id)} className="flex-1 text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
        </div>
      )}

      {takeaway.status === 'confirmed' && (
        <div className="pt-3 border-t border-zinc-800/40">
          <Button variant="ghost" size="sm" onClick={() => onUseInResume(takeaway.id)} className="w-full text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 hover:bg-[var(--page-accent-10)]">
            <Tag className="w-3.5 h-3.5 mr-1" /> Use in Resume
          </Button>
        </div>
      )}
    </motion.div>
  );
}
