import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageIcon, Copy, Check, Upload, Loader2, ChevronRight, Eye, Square, CheckSquare } from 'lucide-react';
import type { LessonWithNodes, LdocBlock } from '../../../shared/learn/types';

const api = (window as any).deskflowAPI;

interface IllustrationInfo {
  nodeId: string;
  nodeTitle: string;
  blockId: string;
  prompt: string;
  concept?: string;
  hasImage: boolean;
  imagePath?: string;
}

interface Props {
  lesson: LessonWithNodes;
  open: boolean;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
  onImageUploaded?: (blockId: string, imagePath: string) => void;
}

export function PendingIllustrationsPanel({ lesson, open, onClose, onNavigateToNode, onImageUploaded }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Collect all illustration blocks from all nodes
  const illustrations = useMemo((): IllustrationInfo[] => {
    const result: IllustrationInfo[] = [];
    for (const node of lesson.nodes) {
      for (const block of (node.blocks || [])) {
        if (block.type === 'illustration') {
          const meta = (block as any).meta || {};
          result.push({
            nodeId: node.id,
            nodeTitle: node.title,
            blockId: block.id,
            prompt: meta.prompt || '',
            concept: meta.concept,
            hasImage: !!meta.image_path,
            imagePath: meta.image_path,
          });
        }
      }
    }
    return result;
  }, [lesson.nodes]);

  const pending = illustrations.filter((i) => !i.hasImage);
  const done = illustrations.filter((i) => i.hasImage);

  const handleCopyPrompt = async (item: IllustrationInfo) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = item.prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(item.blockId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    const allPrompts = pending.map((item, i) => {
      return `--- Illustration ${i + 1}: ${item.concept || item.nodeTitle} ---\n${item.prompt}`;
    }).join('\n\n');
    try {
      await navigator.clipboard.writeText(allPrompts);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = allPrompts;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId('__all__');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpload = async (item: IllustrationInfo) => {
    setUploadingId(item.blockId);
    try {
      const result = await api.learnUploadIllustration({
        lessonId: item.nodeId.split('-')[0] || 'general',
        filename: `${item.blockId}.png`,
      });
      if (result.ok && result.data?.imagePath) {
        // Persist the image path into the lesson doc so it survives reload
        onImageUploaded?.(item.blockId, result.data.imagePath);
        // Refresh the page to pick up the new image
        onNavigateToNode(item.nodeId);
      }
    } catch { /* ignore */ }
    setUploadingId(null);
  };

  /* ── Shared card: EVERY illustration (pending or done) shows the prompt,
        a copy button, and an image upload/replace input. Done items also
        show the uploaded image preview. ── */
  const renderCard = (item: IllustrationInfo) => (
    <div
      key={item.blockId}
      className={`rounded-xl border overflow-hidden ${
        item.hasImage
          ? 'border-emerald-500/15 bg-emerald-500/[0.03]'
          : 'border-amber-500/15 bg-amber-500/[0.03]'
      }`}
    >
      <div className={`px-3 py-2.5 border-b ${item.hasImage ? 'border-emerald-500/10' : 'border-amber-500/10'}`}>
        <div className="flex items-center gap-2">
          {/* Checklist checkbox */}
          {item.hasImage ? (
            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-zinc-600 shrink-0" />
          )}
          <button
            onClick={() => { onNavigateToNode(item.nodeId); onClose(); }}
            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-amber-300 transition-colors group"
          >
            <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-amber-400" />
            <span className="truncate max-w-[200px]">{item.nodeTitle}</span>
          </button>
          {item.hasImage && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 uppercase tracking-wider ml-auto">
              <Eye className="w-3 h-3" /> Done
            </span>
          )}
        </div>
        {item.concept && (
          <p className="text-[11px] text-zinc-500 mt-1 truncate ml-6">{item.concept}</p>
        )}
      </div>
      {item.hasImage && item.imagePath && (
        <img
          src={`file://${item.imagePath}`}
          alt={item.concept || 'Illustration'}
          className="w-full max-h-44 object-cover"
          style={{ background: '#FFFFFF' }}
        />
      )}
      <div className="px-3 py-2.5">
        <pre className="text-[10px] leading-relaxed text-zinc-500 whitespace-pre-wrap max-h-20 overflow-y-auto font-mono mb-2.5">
          {item.prompt}
        </pre>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleCopyPrompt(item)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
              copiedId === item.blockId
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200'
            }`}
          >
            {copiedId === item.blockId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedId === item.blockId ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => handleUpload(item)}
            disabled={uploadingId === item.blockId}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200 transition-all disabled:opacity-50"
          >
            {uploadingId === item.blockId ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            {item.hasImage ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[440px] max-w-[90vw] flex-col border-l border-white/10 bg-[#1c1917]/95 backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-amber-400" />
                <h2 className="font-serif text-xl text-zinc-100">Illustrations</h2>
                <span className="text-xs text-zinc-500">
                  {done.length}/{illustrations.length} inserted
                </span>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress bar */}
            {illustrations.length > 0 && (
              <div className="px-4 pt-3 pb-1 shrink-0">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(done.length / illustrations.length) * 100}%`,
                      background: done.length === illustrations.length
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {illustrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No illustrations in this lesson</p>
                </div>
              ) : (
                <>
                  {/* Pending section */}
                  {pending.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Pending ({pending.length})
                        </h3>
                        {pending.length > 1 && (
                          <button
                            onClick={handleCopyAll}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                              copiedId === '__all__'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200'
                            }`}
                          >
                            {copiedId === '__all__' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedId === '__all__' ? 'Copied all!' : 'Copy all prompts'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {pending.map((item) => renderCard(item))}
                      </div>
                    </div>
                  )}

                  {/* Done section */}
                  {done.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-emerald-400/70 uppercase tracking-wider mb-3">
                        Completed ({done.length})
                      </h3>
                      <div className="space-y-3">
                        {done.map((item) => renderCard(item))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
