import { motion } from 'framer-motion';
import { Award, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import type { CertificationScan } from '../../../types/resume';

interface CertificationCardProps {
  scan: CertificationScan;
  onConfirm: (id: string) => void;
  onAddToResume: (id: string) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', badge: 'outline' as const },
  extracted: { icon: Award, color: 'text-blue-400', badge: 'secondary' as const },
  confirmed: { icon: CheckCircle, color: 'text-emerald-400', badge: 'default' as const },
  added: { icon: CheckCircle, color: 'text-emerald-400', badge: 'default' as const },
};

export function CertificationCard({ scan, onConfirm, onAddToResume }: CertificationCardProps) {
  const status = statusConfig[scan.status];
  const StatusIcon = status.icon;
  const data = scan.extractedData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5 hover:border-zinc-700/60 transition-all duration-150 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/20 shrink-0">
          <Award className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">{data.name || scan.fileName}</h4>
            <Badge variant={status.badge} className="text-[10px]">
              <StatusIcon className={`w-2.5 h-2.5 mr-1 ${status.color}`} />
              {scan.status}
            </Badge>
          </div>
          {data.issuer && <p className="text-xs text-zinc-400">{data.issuer}</p>}
          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-zinc-500">
            {data.dateEarned && <span>Earned: {data.dateEarned}</span>}
            {data.expiryDate && <span>Expires: {data.expiryDate}</span>}
            {data.credentialId && <span className="font-mono">ID: {data.credentialId}</span>}
          </div>
          {data.verificationUrl && (
            <a href={data.verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 mt-1.5 transition-colors">
              Verify <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {scan.status === 'extracted' && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800/40">
          <Button variant="ghost" size="sm" onClick={() => onConfirm(scan.id)} className="flex-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirm
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddToResume(scan.id)} className="flex-1 text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 hover:bg-[var(--page-accent-10)]">
            <Award className="w-3.5 h-3.5 mr-1" /> Add to Resume
          </Button>
        </div>
      )}
    </motion.div>
  );
}
