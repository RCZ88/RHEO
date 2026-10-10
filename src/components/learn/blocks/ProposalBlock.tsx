import React from 'react';
import { Lightbulb, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import type { ProposalBlock as ProposalBlockType } from '../../../shared/learn/types';

interface Props {
  block: ProposalBlockType;
  onApprove?: (blockId: string) => void;
  onReject?: (blockId: string, reason?: string) => void;
}

export function ProposalBlock({ block, onApprove, onReject }: Props) {
  const isPending = block.status === 'pending';

  return (
    <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]">
        {block.status === 'approved' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : block.status === 'rejected' ? (
          <XCircle className="w-4 h-4 text-red-400" />
        ) : (
          <Hourglass className="w-4 h-4 text-amber-400" />
        )}
        <span className="text-xs font-medium text-zinc-300">
          {block.status === 'approved' ? 'Approved' : block.status === 'rejected' ? 'Rejected' : 'Action Required'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-200">{block.title}</h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed whitespace-pre-wrap">{block.body_md}</p>
          </div>
        </div>

        {block.actions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Actions</p>
            {block.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                {a}
              </div>
            ))}
          </div>
        )}

        {block.reason && (
          <div className="p-2 rounded-lg bg-zinc-800/40">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              {block.status === 'rejected' ? 'Reason' : 'Note'}
            </p>
            <p className="text-xs text-zinc-400">{block.reason}</p>
          </div>
        )}

        {isPending && onApprove && onReject && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onApprove(block.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition border border-emerald-500/30"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
            <button
              onClick={() => onReject(block.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition border border-red-500/30"
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
