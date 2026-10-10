import { AlertTriangle, Check, X } from 'lucide-react';
import type { EscalationItemVM } from './types';

interface ApprovalInboxProps {
  escalations: EscalationItemVM[];
  onResolve: (id: string, decision: 'approved' | 'rejected', note?: string) => void;
}

export default function ApprovalInbox({ escalations, onResolve }: ApprovalInboxProps) {
  if (escalations.length === 0) {
    return (
      <div className="text-xs text-zinc-500 text-center py-4">
        No pending approvals
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {escalations.map((e: EscalationItemVM) => (
        <div key={e.id} className="border border-zinc-700 rounded-lg p-2.5 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)]">
          <div className="flex items-start gap-1.5 mb-2">
            <AlertTriangle size={12} className="mt-0.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-zinc-200">{e.title || 'Pending approval'}</span>
          </div>
          {e.reason && (
            <div className="text-[10px] text-zinc-400 mb-2">
              {e.reason}
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => onResolve(e.id, 'approved')}
              className="flex-1 inline-flex items-center justify-center gap-0.5 rounded-md bg-green-500/10 text-green-400 text-[10px] py-0.5 hover:bg-green-500/20"
            >
              <Check size={10} /> Approve
            </button>
            <button
              onClick={() => onResolve(e.id, 'rejected')}
              className="flex-1 inline-flex items-center justify-center gap-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] py-0.5 hover:bg-red-500/20"
            >
              <X size={10} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}