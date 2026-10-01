import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';

type Tone = 'info' | 'error' | 'success' | 'busy';

const TONES: Record<Tone, { wrap: string; icon: ReactNode }> = {
  info: { wrap: 'border-sky-300/20 bg-sky-300/5 text-sky-100/90', icon: <Info className="w-3.5 h-3.5 shrink-0 mt-px" /> },
  error: { wrap: 'border-red-400/25 bg-red-500/10 text-red-100/90', icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> },
  success: { wrap: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100/90', icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> },
  busy: { wrap: 'border-white/10 bg-white/[0.04] text-white/70', icon: <Loader2 className="w-3.5 h-3.5 shrink-0 mt-px animate-spin" /> },
};

/**
 * Inline, dismissible-free status line. The lecture pages used `alert()` and bare
 * `.catch(() => {})`, which meant a failed save looked identical to a successful
 * one and every backend error vanished. Errors now stay on screen with their
 * original message.
 */
export default function InlineNotice({
  tone = 'info', children, className = '',
}: { tone?: Tone; children: ReactNode; className?: string }) {
  if (!children) return null;
  const t = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${t.wrap} ${className}`}>
      {t.icon}
      <div className="min-w-0 whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}
