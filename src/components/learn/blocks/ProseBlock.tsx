import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import type { ProseBlock } from '../../../shared/learn/types';

interface Props {
  block: ProseBlock;
  onAsk?: (blockId: string, question: string) => void;
}

export const ProseBlock = React.memo(function ProseBlock({ block, onAsk }: Props) {
  const rendered = useMemo(() => DOMPurify.sanitize(renderMarkdown(block.md)), [block.md]);

  return (
    <div
    className="my-4 group relative text-[1.0625rem] leading-[1.7] text-zinc-200 max-w-[68ch] font-serif select-text prose prose-invert prose-p:text-zinc-300 prose-headings:text-white prose-a:text-pink-400 prose-block"
    data-block-id={block.id}
    >
    <div dangerouslySetInnerHTML={{ __html: rendered }} />
    {onAsk && (
        <button
          onClick={() => {
            const sel = window.getSelection()?.toString().trim();
            if (sel) onAsk(block.id, sel);
          }}
          className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}, (prev, next) => prev.block.id === next.block.id && prev.block.md === next.block.md);

function renderMarkdown(md: string): string {
  let text = md;

  // Protect inline code spans from further transforms
  const codeSpans: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code class="bg-zinc-800/60 rounded px-1 py-0.5 text-sm font-mono text-cyan-300 select-text">${code}</code>`);
    return `%%CODE${codeSpans.length - 1}%%`;
  });

  // Detect contiguous pipe-table line runs → real <table> HTML
  const lines = text.split('\n');
  const result: string[] = [];
  let tableBuf: string[] = [];
  const isTableRow = (s: string) => /^\s*\|(.+)\|\s*$/.test(s);
  const isDivider = (s: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
  const splitCells = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  const flushTable = () => {
    if (tableBuf.length < 2) { result.push(...tableBuf); tableBuf = []; return; }
    const headerLine = tableBuf[0];
    const dividerLine = tableBuf[1];
    if (!isDivider(dividerLine)) { result.push(...tableBuf); tableBuf = []; return; }
    const headers = splitCells(headerLine);
    const bodyRows = tableBuf.slice(2).map(splitCells);
    let html = '<table class="w-full my-4 text-[0.95rem] border-collapse select-text"><thead><tr class="border-b border-zinc-600">';
    headers.forEach((h) => { html += `<th class="text-left py-2 px-3 font-semibold text-zinc-100">${h}</th>`; });
    html += '</tr></thead><tbody>';
    bodyRows.forEach((cells) => {
      html += '<tr class="border-b border-zinc-800">';
      cells.forEach((c) => { html += `<td class="py-2 px-3 text-zinc-300">${c}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    result.push(html);
    tableBuf = [];
  };

  for (const line of lines) {
    if (isTableRow(line)) {
      tableBuf.push(line);
    } else {
      flushTable();
      result.push(line);
    }
  }
  flushTable();
  text = result.join('\n');

  // Inline math $...$ (protect code placeholders first)
  text = text.replace(/%%CODE(\d+)%%/g, (_, idx) => `%%C${idx}%%`);
  text = text.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_m, tex) => {
    try { return katex.renderToString(tex, { throwOnError: false, displayMode: false }); }
    catch { return _m; }
  });
  text = text.replace(/%%C(\d+)%%/g, (_, idx) => codeSpans[Number(idx)]);

  // Restore code placeholders (code blocks are handled by CodeBlock, not here)
  text = text.replace(/%%CODE(\d+)%%/g, (_, idx) => codeSpans[Number(idx)]);

  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white select-text">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="select-text">$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2 select-text">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-4 mb-2 select-text">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-semibold text-white mt-4 mb-2 select-text">$1</h1>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-amber-400 hover:text-amber-300 underline select-text" target="_blank" rel="noopener">$1</a>')
    // Paragraph wrapping — use <div> instead of <p> to prevent browser selection snapping to <p> boundaries
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h')) return trimmed;
      return `<div class="mb-4 last:mb-0 select-text">${trimmed.replace(/\n/g, '<br/>')}</div>`;
    })
    .join('\n');
}
