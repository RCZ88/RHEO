import { useRef, useState, useEffect } from 'react';
export interface Region { x: number; y: number; w: number; h: number; }
export default function RegionSelector({ src, onRegion }: { src: string; onRegion: (r: Region | null, dataUrl: string | null) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useEffect(() => { setRegion(null); setDrag(null); }, [src]);
  const pos = (e: React.MouseEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width), y: Math.min(Math.max(e.clientY - r.top, 0), r.height) };
  };
  const emit = (r: Region | null) => {
    if (!r || !imgRef.current) { onRegion(null, null); return; }
    try {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(r.w * scaleX)); c.height = Math.max(1, Math.round(r.h * scaleY));
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, r.x * scaleX, r.y * scaleY, r.w * scaleX, r.h * scaleY, 0, 0, c.width, c.height);
      onRegion(r, c.toDataURL('image/png'));
    } catch { onRegion(r, null); }
  };
  return (
    <div ref={wrapRef} className="relative select-none rounded-2xl overflow-hidden border border-white/10 bg-black/40 cursor-crosshair"
      onMouseDown={(e) => { const p = pos(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
      onMouseMove={(e) => { if (drag) { const p = pos(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } }}
      onMouseUp={() => {
        if (!drag) return;
        const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
        const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
        setDrag(null);
        if (w < 8 || h < 8) { setRegion(null); emit(null); return; }
        const r = { x, y, w, h }; setRegion(r); emit(r);
      }}>
      <img ref={imgRef} src={src} alt="lab" className="w-full max-h-[440px] object-contain pointer-events-none"
        onLoad={(e) => { const im = e.currentTarget; setNatural({ w: im.naturalWidth, h: im.naturalHeight }); }} />
      {drag && (
        <div className="absolute border-2 border-amber-300 bg-amber-300/15" style={{ left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) }} />
      )}
      {region && !drag && (
        <div className="absolute border-2 border-emerald-300 bg-emerald-300/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ left: region.x, top: region.y, width: region.w, height: region.h }}>
          <span className="absolute -top-6 left-0 text-[10px] font-mono bg-emerald-400 text-black px-1.5 py-0.5 rounded">{Math.round(region.w)}x{Math.round(region.h)}</span>
        </div>
      )}
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-white/60 bg-black/60 px-2 py-1 rounded-lg">drag to select region - {natural.w}x{natural.h}px</div>
    </div>
  );
}
