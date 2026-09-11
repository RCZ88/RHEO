import React, { useState } from 'react';
import { Play, Loader2, TerminalSquare, X } from 'lucide-react';
import type { CodeBlock } from '../../../shared/learn/types';

const api = (window as any).deskflowAPI;

interface Props {
  block: CodeBlock;
  onAsk?: (blockId: string, question: string) => void;
}

const RUNNABLE_LANGS = new Set(['python', 'py', 'javascript', 'js', 'shell', 'bash', 'cmd']);

export function CodeBlock({ block, onAsk }: Props) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string; error?: string } | null>(null);

  const canRun = RUNNABLE_LANGS.has((block.lang || '').toLowerCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(block.src);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRun = async () => {
    if (!canRun) return;
    setRunning(true);
    setOutput(null);
    try {
      const result = await api.learnRunCode({ lang: block.lang, code: block.src });
      setOutput({
        stdout: result?.stdout ?? '',
        stderr: result?.stderr ?? '',
        error: result?.error ?? undefined,
      });
    } catch (e: any) {
      setOutput({ stdout: '', stderr: '', error: e.message || 'Failed to run code' });
    }
    setRunning(false);
  };

  // Simple syntax highlighting via Prism
  const highlighted = highlightCode(block.src, block.lang);

  return (
    <div className="my-4 rounded-xl border border-zinc-700/60 overflow-hidden group relative" data-block-id={block.id}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">{block.lang || 'code'}</span>
          {block.stage && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              block.stage === 1 ? 'bg-blue-500/15 text-blue-400' :
              block.stage === 2 ? 'bg-amber-500/15 text-amber-400' :
              'bg-emerald-500/15 text-emerald-400'
            }`}>
              Stage {block.stage}
            </span>
          )}
          {block.runnable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">
              Runnable
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canRun && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {running ? 'Running' : 'Run'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* Code */}
      <pre className="p-4 bg-zinc-900/80 overflow-x-auto text-[13px] font-mono leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      {/* Output */}
      {output && (
        <div className="border-t border-zinc-700/40 bg-zinc-950/60">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800/60">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
              <TerminalSquare className="w-3 h-3" /> Output
            </span>
            <button onClick={() => setOutput(null)} className="text-zinc-600 hover:text-zinc-300 transition" title="Clear">
              <X className="w-3 h-3" />
            </button>
          </div>
          <pre className="px-4 py-3 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
            {output.error && <span className="text-red-400">{output.error}</span>}
            {output.stderr && <span className="text-amber-400">{output.stderr}</span>}
            {output.stdout && <span className="text-zinc-300">{output.stdout}</span>}
            {!output.error && !output.stderr && !output.stdout && <span className="text-zinc-600">(no output)</span>}
          </pre>
        </div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Explain this ${block.lang} code`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}

function highlightCode(code: string, lang: string): string {
  // Escape HTML first
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Very basic keyword highlighting for common languages
  const keywords: Record<string, string[]> = {
    python: ['def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'with', 'as', 'True', 'False', 'None', 'self', 'print', 'lambda', 'yield', 'async', 'await', 'raise', 'pass', 'break', 'continue', 'in', 'not', 'and', 'or', 'is', 'del', 'global', 'nonlocal', 'assert', 'finally'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'async', 'await', 'try', 'catch', 'new', 'this', 'true', 'false', 'null', 'undefined'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'async', 'await', 'try', 'catch', 'new', 'this', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'enum', 'extends', 'implements'],
    bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'source', 'local', 'readonly', 'declare', 'unset', 'shift', 'set', 'eval', 'exec', 'trap', 'wait', 'kill', 'cd', 'ls', 'grep', 'sed', 'awk', 'find', 'sort', 'uniq', 'wc', 'cat', 'head', 'tail', 'cut', 'tr', 'xargs', 'sudo', 'apt', 'npm', 'node', 'python', 'pip', 'git', 'docker', 'curl', 'wget', 'chmod', 'chown', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'ln', 'tar', 'zip', 'unzip'],
    shell: ['if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'source', 'local', 'readonly', 'declare', 'unset', 'shift', 'set', 'eval', 'exec', 'trap', 'wait', 'kill', 'cd', 'ls', 'grep', 'sed', 'awk', 'find', 'sort', 'uniq', 'wc', 'cat', 'head', 'tail', 'cut', 'tr', 'xargs', 'sudo', 'apt', 'npm', 'node', 'python', 'pip', 'git', 'docker', 'curl', 'wget', 'chmod', 'chown', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'ln', 'tar', 'zip', 'unzip'],
  };

  const langKeywords = keywords[lang] || keywords['javascript'] || [];
  const kwPattern = langKeywords.join('|');

  // SINGLE PASS — one alternation over the ESCAPED SOURCE ONLY. Tokens are
  // wrapped in <span> the moment they are matched, and the engine never
  // re-scans the emitted HTML. (The old multi-pass version re-scanned its own
  // inserted spans, corrupting output like `class="text-emerald-400">400"</span>`.)
  // Alternative order = precedence: strings first, then comments, then
  // numbers, then keywords — so `#` inside a string can never become a comment.
  const pattern = new RegExp(
    '("""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`|\\/\\/[^\\n]*|#[^\\n]*|\\b\\d+(?:\\.\\d+)?\\b|\\b(?:' + kwPattern + ')\\b)',
    'g',
  );

  return escaped.replace(pattern, (match) => {
    if (match.startsWith('"""') || match.startsWith("'''") || /^["'`]/.test(match)) {
      return `<span class="text-emerald-400">${match}</span>`;
    }
    if (match.startsWith('//') || match.startsWith('#')) {
      return `<span class="text-zinc-500">${match}</span>`;
    }
    if (/^\d/.test(match)) {
      return `<span class="text-amber-400">${match}</span>`;
    }
    return `<span class="text-emerald-400">${match}</span>`;
  });
}
