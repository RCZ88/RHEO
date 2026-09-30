import { type FC } from 'react';
import { Bot } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

export const ThinkingIndicator: FC = () => {
  return (
    <div className="group flex gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded-lg shrink-0 grid place-items-center ring-1 ring-zinc-700 bg-zinc-800 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-zinc-300" />
      </div>
      <div className="flex items-center py-2">
        <ThinkingOrb
          state="working"
          size={32}
          theme="auto"
          color="#a78bfa"
          aria-label="AI is thinking"
        />
      </div>
    </div>
  );
};
