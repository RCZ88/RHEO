import { type FC, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ConnectorConfig } from '../../types/connectors';

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
}

interface ChatEmptyStateProps {
  onPick: (text: string) => void;
  connectors?: ConnectorConfig[];
}

export const ChatEmptyState: FC<ChatEmptyStateProps> = ({ onPick, connectors }) => {
  const timeOfDay = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }, []);

  const hasEmail = connectors?.some(c => c.type === 'email');
  const hasCalendar = connectors?.some(c => c.type === 'calendar');

  const suggestions: Suggestion[] = useMemo(() => {
    const base: Suggestion[] = [
      { id: 'day', label: 'Summarize my day', prompt: 'Summarize my day' },
      { id: 'focus', label: 'What should I focus on?', prompt: 'What should I focus on today?' },
    ];
    if (hasEmail) base.push({ id: 'inbox', label: 'What\u2019s in my inbox?', prompt: 'What\'s in my inbox today?' });
    if (hasCalendar) base.push({ id: 'meetings', label: 'What meetings do I have?', prompt: 'What meetings do I have today?' });
    base.push({ id: 'goals', label: 'Review my goals', prompt: 'Review my goals' });
    return base;
  }, [hasEmail, hasCalendar]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="h-12 w-12 rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20 grid place-items-center">
        <Sparkles className="h-6 w-6 text-pink-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-100">Good {timeOfDay}, ready when you are</h3>
      <p className="mt-1 text-xs text-zinc-500 max-w-[280px]">Ask about your tracked time, goals, projects, or connected inbox &amp; calendar.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-[420px]">
        {suggestions.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onPick(s.prompt)}
            className="rounded-lg px-3 py-1.5 text-xs bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 text-zinc-300 hover:ring-pink-500/40 hover:text-zinc-100 hover:-translate-y-0.5 transition-all duration-150"
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
