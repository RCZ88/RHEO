import { type FC } from 'react';
import { RotateCcw, Settings, Bot } from 'lucide-react';
import { StatusDot, IconButton } from '../ai';
import type { ACCENT } from '../ai/tokens';

type Status = 'ready' | 'thinking' | 'error';

interface ProviderBadgeType {
  label: string;
  model: string;
  accent: keyof typeof ACCENT;
}

interface ChatHeaderProps {
  status: Status;
  provider?: ProviderBadgeType | null;
  onReset: () => void;
  onConfigure: () => void;
  messageCount: number;
}

const statusConfig: Record<Status, { dotColor: keyof typeof ACCENT; label: string; breathe: boolean }> = {
  ready: { dotColor: 'emerald', label: 'Ready', breathe: true },
  thinking: { dotColor: 'amber', label: 'Thinking\u2026', breathe: false },
  error: { dotColor: 'red', label: 'Connection issue', breathe: false },
};

export const ChatHeader: FC<ChatHeaderProps> = ({ status, provider, onReset, onConfigure, messageCount }) => {
  const cfg = statusConfig[status];
  return (
    <div className="relative flex items-center gap-2 px-4 h-12 border-b border-zinc-800/60 shrink-0">
      <Bot className="h-4 w-4 text-pink-400 shrink-0" />
      <span className="text-[13px] font-semibold text-zinc-100">AI Assistant</span>
      <StatusDot color={cfg.dotColor} label={cfg.label} breathe={cfg.breathe} />
      {provider && (
        <span className="rounded-md px-2 py-0.5 text-[11px] bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20 max-w-[160px] truncate shrink-0" title={`${provider.label} · ${provider.model}`}>
          {provider.label} · {provider.model}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {messageCount > 0 && (
          <span className="text-[10px] text-zinc-600 tabular-nums mr-1">{messageCount}</span>
        )}
        <IconButton icon={RotateCcw} label="New chat" onClick={onReset} />
        <IconButton icon={Settings} label="Configure AI provider" onClick={onConfigure} />
      </div>
    </div>
  );
};
