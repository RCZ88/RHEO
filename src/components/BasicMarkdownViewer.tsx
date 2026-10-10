import React, { useMemo } from 'react';

interface BasicMarkdownViewerProps {
  content: string;
  maxHeight?: string;
  fileName?: string;
}

/**
 * BasicMarkdownViewer — Lightweight markdown renderer
 * Handles: headers, bold, italic, code blocks, lists, links
 * No external deps — pure React/Tailwind
 */
export const BasicMarkdownViewer: React.FC<BasicMarkdownViewerProps> = ({
  content,
  maxHeight = 'max-h-96',
  fileName,
}) => {
  const rendered = useMemo(() => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code block (``` markers)
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLanguage = trimmed.replace(/^```/, '').trim();
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          result.push(
            <div key={`code-${i}`} className="my-2 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-700 overflow-hidden">
              {codeBlockLanguage && (
                <div className="px-3 py-1 bg-zinc-800 text-[9px] text-zinc-500 font-mono border-b border-zinc-700">
                  {codeBlockLanguage}
                </div>
              )}
              <pre className="px-3 py-2 text-[9px] text-amber-200 font-mono whitespace-pre-wrap break-words overflow-x-auto">
                {codeBlockContent.join('\n')}
              </pre>
            </div>
          );
          codeBlockContent = [];
          codeBlockLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Headers (# ## ### etc)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const sizeClasses: Record<number, string> = {
          1: 'text-lg font-bold text-white mt-3 mb-2',
          2: 'text-base font-bold text-zinc-100 mt-2 mb-1.5',
          3: 'text-sm font-semibold text-zinc-200 mt-2 mb-1',
          4: 'text-xs font-semibold text-zinc-300 mt-1 mb-0.5',
          5: 'text-xs font-medium text-zinc-400 mt-1 mb-0.5',
          6: 'text-xs font-medium text-zinc-500 mt-1 mb-0.5',
        };
        result.push(
          <div key={`header-${i}`} className={sizeClasses[level]}>
            {renderInline(text)}
          </div>
        );
        continue;
      }

      // Horizontal rule (---, ***, ___)
      if (trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        result.push(
          <div key={`hr-${i}`} className="my-2 border-t border-zinc-700" />
        );
        continue;
      }

      // Lists (- [ ] * or digits)
      const listMatch = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const indent = listMatch[1].length;
        const isCheckbox = line.includes('[ ]') || line.includes('[x]');
        const isChecked = line.includes('[x]');
        const text = listMatch[3];
        const paddingClass = indent === 0 ? 'pl-3' : indent === 2 ? 'pl-6' : indent === 4 ? 'pl-9' : 'pl-3';

        result.push(
          <div key={`list-${i}`} className={`text-xs text-zinc-300 ${paddingClass} py-0.5 flex items-center gap-2`}>
            {isCheckbox ? (
              <input
                type="checkbox"
                checked={isChecked}
                readOnly
                className="w-3 h-3 rounded accent-cyan-500"
              />
            ) : (
              <span className="text-zinc-500">•</span>
            )}
            <span>{renderInline(text)}</span>
          </div>
        );
        continue;
      }

      // Blockquote (>)
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        result.push(
          <div key={`quote-${i}`} className="my-1 pl-3 border-l-2 border-cyan-500/50 text-xs text-zinc-400 italic">
            {renderInline(quoteText)}
          </div>
        );
        continue;
      }

      // Empty lines (render as small spacing)
      if (!trimmed) {
        result.push(<div key={`empty-${i}`} className="h-1" />);
        continue;
      }

      // Regular paragraph
      result.push(
        <div key={`para-${i}`} className="text-xs text-zinc-300 py-0.5 leading-relaxed">
          {renderInline(line)}
        </div>
      );
    }

    // Handle unclosed code block
    if (inCodeBlock && codeBlockContent.length > 0) {
      result.push(
        <div key="code-unclosed" className="my-2 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-700 overflow-hidden">
          <pre className="px-3 py-2 text-[9px] text-amber-200 font-mono whitespace-pre-wrap break-words overflow-x-auto">
            {codeBlockContent.join('\n')}
          </pre>
        </div>
      );
    }

    return result;
  }, [content]);

  return (
    <div className={`${maxHeight} overflow-y-auto bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-700/50 p-3 space-y-0.5`}>
      {fileName && (
        <div className="text-[9px] text-zinc-500 font-mono mb-2 pb-2 border-b border-zinc-700/50">
          📄 {fileName}
        </div>
      )}
      {rendered.length === 0 ? (
        <div className="text-xs text-zinc-600 italic">No content</div>
      ) : (
        rendered
      )}
    </div>
  );
};

/**
 * renderInline — Handle inline markdown: **bold**, *italic*, `code`, [links], etc
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Regex for inline patterns: **bold**, *italic*, `code`, [link](url), [link]
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\[([^\]]+)\])/g;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];

    // **bold**
    if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      parts.push(
        <span key={parts.length} className="font-semibold text-white">
          {fullMatch.slice(2, -2)}
        </span>
      );
    }
    // *italic* or _italic_
    else if ((fullMatch.startsWith('*') && fullMatch.endsWith('*')) || (fullMatch.startsWith('_') && fullMatch.endsWith('_'))) {
      parts.push(
        <span key={parts.length} className="italic text-zinc-200">
          {fullMatch.slice(1, -1)}
        </span>
      );
    }
    // __bold__ (alternative syntax)
    else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
      parts.push(
        <span key={parts.length} className="font-semibold text-white">
          {fullMatch.slice(2, -2)}
        </span>
      );
    }
    // `code`
    else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      parts.push(
        <code key={parts.length} className="bg-zinc-800 px-1 rounded text-amber-300 font-mono text-[9px]">
          {fullMatch.slice(1, -1)}
        </code>
      );
    }
    // [link](url)
    else if (fullMatch.includes('](')) {
      const linkMatch = fullMatch.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={parts.length}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    // [plain link]
    else if (fullMatch.startsWith('[') && fullMatch.endsWith(']')) {
      const linkText = fullMatch.slice(1, -1);
      // Check if it's a URL-like reference
      if (linkText.match(/^https?:\/\//)) {
        parts.push(
          <a
            key={parts.length}
            href={linkText}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(linkText);
      }
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}
