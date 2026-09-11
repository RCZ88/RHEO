import { type FC } from 'react';
import { Bot } from 'lucide-react';

export const ThinkingIndicator: FC = () => {
  return (
    <div className="group flex gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded-lg shrink-0 grid place-items-center ring-1 ring-zinc-700 bg-zinc-800 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-zinc-300" />
      </div>
      <div className="flex items-center gap-1.5 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400/70 animate-[breathe_1.2s_ease-in-out_infinite] translate-y-0" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400/70 animate-[breathe_1.2s_ease-in-out_infinite] translate-y-0" style={{ animationDelay: '40ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400/70 animate-[breathe_1.2s_ease-in-out_infinite] translate-y-0" style={{ animationDelay: '80ms' }} />
      </div>
    </div>
  );
};
