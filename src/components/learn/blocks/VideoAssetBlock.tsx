import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, AlertTriangle, Code, Film } from 'lucide-react';
import type { VideoAssetBlock as VideoAssetBlockType } from '../../../shared/learn/types';

const api = (window as any).deskflowAPI;

interface Props {
  block: VideoAssetBlockType;
  nodeId?: string;
}

export function VideoAssetBlock({ block, nodeId }: Props) {
  const [rendering, setRendering] = useState(false);
  const [meta, setMeta] = useState(block.meta);

  const handleRender = async () => {
    if (!meta.python_source) return;
    setRendering(true);
    setMeta({ ...meta, render_status: 'rendering' });
    try {
      const result = await api?.learnRenderVideoAsset?.({
        lessonId: nodeId || 'unknown',
        nodeId: nodeId || '',
        blockId: block.id,
      });
      if (result?.ok && result.video_path) {
        setMeta({
          ...meta,
          video_path: result.video_path,
          poster_path: result.poster_path,
          generated: true,
          render_status: 'done',
        });
      } else {
        setMeta({
          ...meta,
          render_status: 'error',
          error: result?.error || 'Render failed',
        });
      }
    } catch (e: any) {
      setMeta({
        ...meta,
        render_status: 'error',
        error: e.message || 'Render failed',
      });
    } finally {
      setRendering(false);
    }
  };

  // Done — show video
  if (meta.render_status === 'done' && meta.video_path) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] overflow-hidden"
      >
        <video
          controls
          poster={meta.poster_path ? `file://${meta.poster_path}` : undefined}
          src={`file://${meta.video_path}`}
          className="w-full rounded-lg"
          preload="metadata"
        />
        {meta.caption && (
          <div className="px-4 py-2 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500">{meta.caption}</p>
          </div>
        )}
      </motion.div>
    );
  }

  // Rendering — spinner
  if (meta.render_status === 'rendering' || rendering) {
    return (
      <div className="my-4 rounded-xl border border-clay-500/30 bg-clay-500/5 p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-clay-400 animate-spin" />
        <span className="text-sm text-zinc-400">Rendering with Manim… may take a minute</span>
      </div>
    );
  }

  // Error — show source fallback
  if (meta.render_status === 'error' || meta.render_status === 'unavailable') {
    return (
      <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {meta.render_status === 'unavailable' ? 'Manim Not Installed' : 'Render Failed'}
            </p>
            {meta.error && <p className="text-xs text-amber-400/80 mt-1">{meta.error}</p>}
          </div>
        </div>
        {meta.python_source && (
          <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)]">
              <Code className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Manim Source</span>
            </div>
            <pre className="p-3 text-xs text-zinc-300 overflow-x-auto max-h-64 font-mono leading-relaxed">
              {meta.python_source}
            </pre>
          </div>
        )}
        {meta.render_status === 'unavailable' && (
          <p className="mt-3 text-xs text-zinc-500">
            Install Manim to render: <code className="text-zinc-400">pip install manim</code>
          </p>
        )}
      </div>
    );
  }

  // Pending — show summary card with render button
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-clay-500/10 border border-clay-500/20 flex items-center justify-center shrink-0">
          <Film className="w-5 h-5 text-clay-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200">Animation Video</p>
          {meta.caption && <p className="text-xs text-zinc-500 mt-1">{meta.caption}</p>}
          {meta.scene_name && (
            <p className="text-xs text-zinc-600 mt-0.5">Scene: {meta.scene_name}</p>
          )}
          <button
            onClick={handleRender}
            disabled={rendering || !meta.python_source}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-clay-500/15 text-clay-300 border border-clay-500/25 hover:bg-clay-500/25 transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Render Animation
          </button>
        </div>
      </div>
      {meta.python_source && (
        <details className="mt-3">
          <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400">Show source code</summary>
          <pre className="mt-2 p-3 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800 text-xs text-zinc-400 overflow-x-auto max-h-48 font-mono">
            {meta.python_source}
          </pre>
        </details>
      )}
    </motion.div>
  );
}
