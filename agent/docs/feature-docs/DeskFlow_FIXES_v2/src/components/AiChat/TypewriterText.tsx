import { type FC, useState, useEffect, useRef } from 'react';
import { BlockRenderer } from './BlockRenderer';
import type { ParsedResponse } from '../../services/wireFormat';
import { useNavigate } from 'react-router-dom';
import { navigateTo } from '../../lib/deepNav';

interface TypewriterTextProps {
  nodes: ParsedResponse['nodes'];
  refs?: ParsedResponse['refs'];
  onDone?: () => void;
}

const CHARS_PER_TICK = 1;
const TICK_MS = 20;

function flattenText(nodes: ParsedResponse['nodes']): string {
  const parts: string[] = [];
  function walk(n: any) {
    if (!n) return;
    if (typeof n === 'string') { parts.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.kind === 'group') { n.children?.forEach(walk); return; }
    if (n.type === 'text' && n.fields?.body) { parts.push(n.fields.body); return; }
  }
  walk(nodes);
  return parts.join(' ');
}

export const TypewriterText: FC<TypewriterTextProps> = ({ nodes, refs = {}, onDone }) => {
  const [revealed, setRevealed] = useState(0);
  const navigate = useNavigate();
  const doneRef = useRef(false);
  const fullText = flattenText(nodes);

  useEffect(() => {
    if (!fullText) { onDone?.(); return; }
    const total = fullText.length;
    const tick = () => {
      setRevealed(prev => {
        const next = prev + CHARS_PER_TICK;
        if (next >= total) {
          setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone?.(); } }, TICK_MS);
          return total;
        }
        return next;
      });
    };
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [fullText, onDone]);

  if (!fullText) return null;

  const isComplete = revealed >= fullText.length;

  if (isComplete) {
    return (
      <BlockRenderer
        nodes={nodes}
        refs={refs}
        onNavigate={(page, section, tab) => navigateTo({ route: page, section, tab }, navigate)}
      />
    );
  }

  return (
    <span className="text-sm text-zinc-100 whitespace-pre-wrap">
      {fullText.slice(0, revealed)}
      <span className="inline-block w-[2px] h-[1em] -mb-[2px] bg-pink-400 ml-0.5 align-baseline animate-pulse" />
    </span>
  );
};
