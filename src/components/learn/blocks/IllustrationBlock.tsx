import React, { useState, useEffect } from 'react';
import { Loader2, ImageIcon, RefreshCw, AlertCircle, Copy, Check, Upload, ExternalLink, Settings2 } from 'lucide-react';

const api = (window as any).deskflowAPI;

interface Props {
  meta: {
    prompt: string;
    concept?: string;
    image_path?: string;
    generated: boolean;
    annotations?: string[];
    error?: string;
  };
  nodeId?: string;
  onGenerated?: (imagePath: string) => void;
}

export function IllustrationBlock({ meta, nodeId, onGenerated }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(meta.error || null);
  const [imagePath, setImagePath] = useState<string | null>(meta.image_path || null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    api.learnGetImageGenSettings?.()
      .then((res: any) => { if (mounted && res?.ok) setAiEnabled(!!res.data?.enabled); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleGenerate = async () => {
    if (aiEnabled === false) {
      setError('Image generation is off. Enable it in your profile → AI Illustrations, or generate externally and upload.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await api.learnGenerateIllustration({
        prompt: meta.prompt,
        nodeId,
      });
      if (result.ok && result.data?.imagePath) {
        setImagePath(result.data.imagePath);
        onGenerated?.(result.data.imagePath);
      } else {
        setError(result.error || 'Generation failed');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate illustration');
    }
    setGenerating(false);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(meta.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text from a temporary textarea
      const ta = document.createElement('textarea');
      ta.value = meta.prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setError(null);
    try {
      const result = await api.learnUploadIllustration({
        lessonId: nodeId?.split('-')[0] || 'general',
        filename: `illustration-${Date.now()}.png`,
      });
      if (result.ok && result.data?.imagePath) {
        setImagePath(result.data.imagePath);
        onGenerated?.(result.data.imagePath);
      } else if (result.error !== 'Cancelled') {
        setError(result.error || 'Upload failed');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to upload image');
    }
    setUploading(false);
  };

  const hasImage = !!imagePath;

  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1917]/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-zinc-200">Illustration</span>
          {meta.concept && (
            <span className="text-[10px] text-zinc-500 ml-1">— {meta.concept}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasImage && !generating && (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {generating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <p className="text-xs text-zinc-500">Generating illustration...</p>
            <p className="text-[10px] text-zinc-600 max-w-xs text-center">{meta.prompt}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-xs text-red-400">{error}</p>
            <div className="flex gap-2 mt-1">
              <button onClick={handleGenerate} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition">
                Try again
              </button>
              <span className="text-zinc-700">|</span>
              <button onClick={handleUpload} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition">
                Upload instead
              </button>
            </div>
          </div>
        ) : hasImage ? (
          <div className="relative">
            <img
              src={`file://${imagePath}`}
              alt={meta.concept || 'Illustration'}
              className="w-full rounded-lg"
              style={{ background: '#FFFFFF' }}
            />
            {meta.annotations && meta.annotations.length > 0 && (
              <div className="flex gap-2 mt-2 justify-center">
                {meta.annotations.map((ann, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {ann}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* No image — show external workflow UI */
          <div className="space-y-4">
            {/* Concept callout */}
            {meta.concept && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <p className="text-[10px] uppercase tracking-wider text-amber-500/70 mb-0.5">This illustration explains</p>
                <p className="text-xs text-zinc-300">{meta.concept}</p>
              </div>
            )}

            {/* Upload zone — PROMINENT, first thing after concept */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploading ? 'Uploading...' : 'Upload your image'}
              </button>
              <span className="text-zinc-600 text-xs">or paste/drop after generating</span>
            </div>

            {/* Prompt box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Illustration prompt</span>
                <button
                  onClick={handleCopyPrompt}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                    copied
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy prompt'}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50 text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                {meta.prompt}
              </pre>
            </div>

            {/* External tool hint */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-zinc-800/30 border border-zinc-800/40">
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Copy the prompt above, paste it into any image generator (ChatGPT, Midjourney, DALL-E, etc.), then upload the result above.
              </p>
            </div>

            {/* Generate with AI (secondary) */}
            {aiEnabled !== false && (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium bg-zinc-800/40 text-zinc-500 border border-zinc-700/40 hover:text-zinc-300 hover:bg-zinc-700/40 transition-all"
              >
                <ImageIcon className="w-3 h-3" />
                Or generate with AI
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
