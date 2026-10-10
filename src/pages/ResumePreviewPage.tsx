import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useResumeStore } from '../stores/resumeStore';
import { ResumePreview } from '../features/resume/components/ResumePreview';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import type { PreviewMode } from '../types/resume';

export default function ResumePreviewPage() {
  const navigate = useNavigate();
  const { resumeContent, previewMode, previewZoom, setPreviewMode, setPreviewZoom } = useResumeStore();

  return (
    <div className="h-full flex flex-col" style={{ '--page-accent': 'rgb(99, 102, 241)' } as any}>
      {/* Toolbar */}
      <div className="shrink-0 border-b border-zinc-800/60 px-5 py-3 bg-gradient-to-r from-zinc-900/90 to-zinc-800/70 backdrop-blur-xl flex items-center justify-between">
        <button onClick={() => navigate('/resume')} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3">
          <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as PreviewMode)}>
            <TabsList>
              <TabsTrigger value="styled">Styled</TabsTrigger>
              <TabsTrigger value="ats_raw">ATS Raw</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1 ring-1 ring-zinc-700/50 rounded-lg p-0.5">
            <Button variant="ghost" size="icon-xs" onClick={() => setPreviewZoom(Math.max(30, previewZoom - 10))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-zinc-500 w-10 text-center font-mono tabular-nums">{previewZoom}%</span>
            <Button variant="ghost" size="icon-xs" onClick={() => setPreviewZoom(Math.min(150, previewZoom + 10))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setPreviewZoom(65)}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-5 flex justify-center bg-zinc-950 light:bg-[var(--ws-surface)]/50">
        <motion.div
          key={previewMode}
          initial={{ opacity: 0.8, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ResumePreview content={resumeContent} mode={previewMode} scale={previewZoom} />
        </motion.div>
      </div>
    </div>
  );
}
