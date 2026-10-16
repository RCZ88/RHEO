import { useRef, useState } from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';

interface MemoryUploaderProps {
  onFiles: (files: FileList | File[]) => void;
}

export function MemoryUploader({ onFiles }: MemoryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors overflow-hidden ${
        dragOver ? 'border-[var(--color-mem-400)]/60 bg-[var(--color-mem-400)]/[0.06]' : 'border-zinc-700/50 hover:border-[var(--color-mem-400)]/40'
      }`}
    >
      <div className="warmth-aurora" />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-[var(--color-mem-400-15)] flex items-center justify-center text-[var(--color-mem-400)]">
          <ImagePlus className="w-5 h-5" />
        </div>
        <p className="text-[13px] text-[var(--text-primary)] font-medium">Add photos or videos</p>
        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Drag in, paste, or click to browse -- stays on this device
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
