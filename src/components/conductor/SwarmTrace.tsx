import { useEffect, useRef } from 'react';

export interface SwarmTraceMessageVM {
  id: string;
  ts: number;
  from: string;
  to: string;
  type: string;
  summary: string;
}

const TYPE_COLOR: Record<string, string> = {
  TASK: '#3b82f6',
  REPORT: '#f59e0b',
  ESCALATE: '#ef4444',
  DIRECTIVE: '#8b5cf6',
  MERGE_OK: '#10b981',
  MERGE_CONFLICT: '#ef4444',
  INFO: '#71717a',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SwarmTrace({
  messages, onSelectActor,
}: {
  messages: SwarmTraceMessageVM[];
  onSelectActor?: (actorId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wide px-1 pb-1.5">Swarm trace</div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
        {messages.length === 0 && (
          <div className="text-[11px] text-zinc-500 italic px-1">No activity yet.</div>
        )}
        {messages.map((m) => {
          const color = TYPE_COLOR[m.type] || '#71717a';
          const dotStyle: React.CSSProperties = { background: color };
          const typeStyle: React.CSSProperties = { color };
          return (
            <div key={m.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-900/70 light:bg-[var(--ws-surface-raised)] text-[11px]">
              <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={dotStyle} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onSelectActor && onSelectActor(m.from)}
                    className="font-medium text-zinc-300 hover:underline"
                  >
                    {m.from}
                  </button>
                  <span className="text-zinc-600">→</span>
                  <button
                    onClick={() => onSelectActor && onSelectActor(m.to)}
                    className="font-medium text-zinc-300 hover:underline"
                  >
                    {m.to}
                  </button>
                  <span className="text-[9.5px] uppercase tracking-wide" style={typeStyle}>{m.type}</span>
                  <span className="text-[9.5px] text-zinc-600 ml-auto">{formatTime(m.ts)}</span>
                </div>
                <div className="text-zinc-500 truncate">{m.summary}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
