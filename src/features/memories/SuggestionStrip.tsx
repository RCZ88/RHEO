import { Sparkles, Check, X } from 'lucide-react';
import type { GroupSuggestion } from './types';

interface SuggestionStripProps {
  suggestions: GroupSuggestion[];
  onAccept: (s: GroupSuggestion) => void;
  onDismiss: (key: string) => void;
}

export function SuggestionStrip({ suggestions, onAccept, onDismiss }: SuggestionStripProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-[var(--color-mem-400)]" />
        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[var(--text-primary)]">
          Auto-group suggestions
        </span>
        <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)]">
          · {suggestions.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {suggestions.map(s => (
          <div
            key={s.key}
            className="w-56 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-2"
          >
            <div className="h-16 flex gap-0.5 overflow-hidden rounded-md mb-2">
              {/* Placeholder for member photos — in real impl, show first 3 */}
              <div className="flex-1 bg-[var(--bg-surface)]" />
              <div className="flex-1 bg-[var(--bg-surface)]" />
              <div className="flex-1 bg-[var(--bg-surface)]" />
            </div>
            <p className="text-[13px] font-['Space_Grotesk'] font-semibold text-[var(--text-primary)] truncate">
              {s.title}
            </p>
            <p className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)]">
              {s.memberIds.length} photos · {s.dateFrom.slice(5)} – {s.dateTo.slice(5)}
            </p>
            {s.location && (
              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{s.location}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => onAccept(s)}
                className="flex items-center gap-1 rounded-md border border-[var(--color-mem-400)]/30 bg-[var(--color-mem-400)]/15 px-2 py-1 text-[11px] text-[var(--color-mem-400)]"
              >
                <Check className="w-3 h-3" /> Create
              </button>
              <button
                type="button"
                onClick={() => onDismiss(s.key)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}