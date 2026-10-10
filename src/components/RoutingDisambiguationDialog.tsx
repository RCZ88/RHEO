import { X, Plus, Sparkles } from 'lucide-react';

interface CandidateSession {
  sessionId: string;
  sessionName: string;
  summary: string;
  confidence: number;
}

interface RoutingDisambiguationDialogProps {
  candidates: CandidateSession[];
  onCreateNew: (suggestedName: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCancel: () => void;
  suggestedName?: string;
}

export function RoutingDisambiguationDialog({
  candidates,
  onCreateNew,
  onSelectSession,
  onCancel,
  suggestedName = 'New Session',
}: RoutingDisambiguationDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      onClick={onCancel}
    >
      <div
        className="bg-zinc-800 rounded-xl p-5 w-full max-w-md border border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Route Prompt</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-4">
          Which session should handle this prompt?
        </p>

        <div className="space-y-2 mb-4">
          {candidates.map((c) => (
            <button
              key={c.sessionId}
              onClick={() => onSelectSession(c.sessionId)}
              className="w-full text-left p-3 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded-lg border border-zinc-700/50 hover:border-cyan-500/30 hover:bg-zinc-800/80 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                  {c.sessionName}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {Math.round(c.confidence * 100)}% match
                </span>
              </div>
              {c.summary && (
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{c.summary}</p>
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => onCreateNew(suggestedName)}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Create New: {suggestedName}</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
