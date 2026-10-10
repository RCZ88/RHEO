import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import type { AnimationBlock as AnimationBlockType } from '../../../shared/learn/types';

const api = (window as any).deskflowAPI;

interface Props {
  block: AnimationBlockType;
  concept?: string;
}

export function AnimationBlock({ block, concept }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!block.meta.dsl) {
      setStatus('error');
      setIssues(['No animation data provided']);
      return;
    }
    (async () => {
      try {
        const result = await api?.learnRenderAnimation?.({ dsl: block.meta.dsl });
        if (result?.ok && (!result.issues || result.issues.length === 0)) {
          setStatus('ready');
        } else {
          setStatus('error');
          setIssues(result?.issues || ['Validation failed']);
        }
      } catch (e: any) {
        setStatus('error');
        setIssues([e.message || 'Failed to validate animation']);
      }
    })();
  }, [block.meta.dsl]);

  if (status === 'loading') {
    return (
      <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-clay-400 animate-spin" />
        <span className="text-sm text-zinc-400">Validating animation…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-300">Animation Error</p>
            {concept && <p className="text-xs text-zinc-400 mt-1">{concept}</p>}
            <ul className="mt-2 space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="text-xs text-amber-400/80">• {issue}</li>
              ))}
            </ul>
            {block.meta.poster && (
              <img src={`file://${block.meta.poster}`} alt="Animation preview" className="mt-3 rounded-lg max-h-48 opacity-60" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Ready — render the Elucim player
  // Dynamic import to avoid SSR issues
  const ElucimPlayer = React.lazy(() =>
    import('@elucim/core').then(mod => ({ default: mod.Player }))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] overflow-hidden"
    >
      {block.meta.title && (
        <div className="px-4 py-2 border-b border-zinc-800/60">
          <span className="text-xs font-medium text-zinc-400">{block.meta.title}</span>
        </div>
      )}
      <div className="p-4">
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-clay-400 animate-spin" />
          </div>
        }>
          <ElucimPlayer dsl={block.meta.dsl} />
        </React.Suspense>
      </div>
      {block.meta.concept && (
        <div className="px-4 py-2 border-t border-zinc-800/60">
          <p className="text-xs text-zinc-500">{block.meta.concept}</p>
        </div>
      )}
    </motion.div>
  );
}
