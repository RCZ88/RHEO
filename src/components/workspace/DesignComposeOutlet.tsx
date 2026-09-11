import { useState } from 'react';
import { Send, Check, Copy, FileText, Sparkles } from 'lucide-react';

interface SourceCount {
  source: string;
  count: number;
  accentColor: string;
}

interface DesignComposeOutletProps {
  contextSnippet: string;
  onSend: () => void;
  onCopy: () => void;
  isSending?: boolean;
  lastSent?: string | null;
  terminalMissing?: boolean;
  importedCounts?: SourceCount[];
  totalImported?: number;
}

export function DesignComposeOutlet({
  contextSnippet,
  onSend,
  onCopy,
  isSending,
  lastSent,
  terminalMissing,
  importedCounts = [],
  totalImported = 0,
}: DesignComposeOutletProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasImportedItems = totalImported > 0;

  return (
    <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Compose Design Context</h3>
        </div>
        <div className={`text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {terminalMissing && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-400 flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1 .0 1.5-1.5.884-8.5-.5-4.5-4.5-8.5-8-8.5-.7.0-1.5.5-2 1.5L4.5 19.5c-.7 1.3-.1 2.5.8 2.5z" />
              </svg>
              Open a terminal tab first to send design context
            </div>
          )}

          {/* Source attribution badges */}
          {hasImportedItems && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span>Sources:</span>
              {importedCounts.map(({ source, count, accentColor }) => count > 0 && (
                <span
                  key={source}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5
                    rounded bg-zinc-800/60 text-zinc-400 text-[10px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  {source} ({count})
                </span>
              ))}
            </div>
          )}

          <div className="bg-zinc-950 rounded border border-zinc-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/30">
              <div className="flex items-center gap-1.5">
                <FileText className="w-2.5 h-2.5 text-zinc-500" />
                <span className="text-[9px] text-zinc-500">Prompt Preview</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>
            <pre className="p-3 text-[9px] text-zinc-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
              {contextSnippet || 'No design context configured yet. Adjust taste knobs and select style references above.'}
            </pre>
          </div>

          {lastSent && (
            <div className="text-[9px] text-emerald-400/80 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              Sent at {lastSent}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onSend}
              disabled={isSending || !contextSnippet || terminalMissing}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-pink-600 to-rose-600
                hover:from-pink-500 hover:to-rose-500
                disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500
                text-white text-[10px] rounded flex items-center justify-center gap-1.5
                transition-all"
            >
              {isSending ? (
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {isSending ? 'Sending...' : 'Send Design Context to Terminal'}
            </button>
            {hasImportedItems && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400 text-xs font-medium">
                +{totalImported} added
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}