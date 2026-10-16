import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { DocumentUpload } from '../../../types/resume';

interface DocumentUploaderProps {
  uploads: DocumentUpload[];
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}

const statusConfig = {
  uploading: { icon: Loader2, color: 'text-amber-400', label: 'Uploading...', spin: true },
  processing: { icon: Loader2, color: 'text-blue-400', label: 'Processing...', spin: true },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Completed', spin: false },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed', spin: false },
};

export function DocumentUploader({ uploads, onUpload, onRemove }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-[var(--page-accent)]/50 bg-[var(--page-accent-5)] ring-1 ring-[var(--page-accent)]/20'
            : 'border-zinc-700/50 hover:border-zinc-600/50 hover:bg-zinc-800/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          className="hidden"
        />
        <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${isDragging ? 'text-[var(--page-accent)]' : 'text-zinc-500'}`} />
        <p className="text-sm text-zinc-400">
          {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[10px] text-zinc-600 mt-1">PDF, DOC, DOCX, TXT, MD, PNG, JPG</p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => {
            const status = statusConfig[upload.status];
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-zinc-900/60 to-zinc-800/30 ring-1 ring-zinc-700/20"
              >
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{upload.fileName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {(upload.fileSize / 1024).toFixed(1)} KB
                    {upload.takeawayCount > 0 && ` · ${upload.takeawayCount} takeaways`}
                  </p>
                </div>
                <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.spin ? 'animate-spin' : ''}`} />
                <Button variant="ghost" size="icon-xs" onClick={() => onRemove(upload.id)} className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
                  <X className="w-3 h-3" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
