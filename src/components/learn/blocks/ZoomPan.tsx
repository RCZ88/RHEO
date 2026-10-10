import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Plus, Minus, Maximize2, Scan, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface ZoomPanProps {
  children: React.ReactNode;
}

/**
 * Zoomable / pannable wrapper for diagrams, figures and charts.
 *
 * behaviour: auto-fits content into the container on mount, arrow buttons +
 * arrow keys to pan, wheel to zoom, toolbar for +/-/fit/fullscreen.
 * No mouse drag — clean, button-only interaction.
 */
export function ZoomPan({ children }: ZoomPanProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [full, setFull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const interactedRef = useRef(false);
  // Last applied fit. A fit that changes nothing by more than this tolerance
  // returns early, which is what terminates the ResizeObserver feedback loop.
  const lastFitRef = useRef({ h: -1, s: -1, tx: -1, ty: -1 });
  const PAN_STEP = 60;
  const clamp = (v: number) => Math.min(4, Math.max(0.1, v));
  const EPS = 0.5;

  const fitToContainer = useCallback(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const cw = el.clientWidth;
    if (!cw) return;

    // Prefer data-nat-w/h set by the parent (e.g. MermaidBlock reads viewBox)
    const child = content.firstElementChild as HTMLElement | null;
    let nw = Number(child?.getAttribute('data-nat-w')) || 0;
    let nh = Number(child?.getAttribute('data-nat-h')) || 0;

    // Fallback: measure rendered content
    if (!nw || !nh) {
      nw = child?.scrollWidth || content.scrollWidth || cw;
      nh = child?.scrollHeight || content.scrollHeight || 200;
    }
    if (!nw || !nh) return;

    // Compute container height from aspect ratio (width is fixed by card layout)
    const aspectH = Math.round((cw / nw) * nh);
    const ch = Math.max(120, aspectH);

    const s = Math.min(1, cw / nw, ch / nh);
    const nextTx = (cw - nw * s) / 2;
    const nextTy = (ch - nh * s) / 2;

    // IDEMPOTENCE GATE. `el.style.height` resizes the container we observe, and
    // scale/translate resize the content — so without this guard the observer
    // re-delivers its own notification forever ("ResizeObserver loop completed
    // with undelivered notifications"), which trips the app error boundary.
    const last = lastFitRef.current;
    if (
      Math.abs(ch - last.h) < EPS &&
      Math.abs(s - last.s) < EPS / 100 &&
      Math.abs(nextTx - last.tx) < EPS &&
      Math.abs(nextTy - last.ty) < EPS
    ) {
      return;
    }
    lastFitRef.current = { h: ch, s, tx: nextTx, ty: nextTy };

    el.style.height = ch + 'px';
    setScale(s);
    setTx(nextTx);
    setTy(nextTy);
  }, []);

  // Fit on mount + whenever the CONTAINER resizes (window resize, layout shift).
  // We deliberately do NOT observe `content`: the callback writes to `content`'s
  // transform, so observing it closes the feedback edge that caused the loop.
  useEffect(() => {
    fitToContainer();
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (!interactedRef.current) fitToContainer();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToContainer]);

  // Wheel zoom with passive:false so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      interactedRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setScale((s) => clamp(s * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const zoomIn = () => { interactedRef.current = true; setScale((s) => clamp(s * 1.2)); };
  const zoomOut = () => { interactedRef.current = true; setScale((s) => clamp(s / 1.2)); };

  const reset = () => {
    interactedRef.current = false;
    // Invalidate the idempotence cache: the user has moved/zoomed since the last
    // fit, so "no change" is no longer true and the fit must actually re-apply.
    lastFitRef.current = { h: -1, s: -1, tx: -1, ty: -1 };
    fitToContainer();
  };

  const panBy = (dx: number, dy: number) => {
    interactedRef.current = true;
    setTx((t) => t + dx);
    setTy((t) => t + dy);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); panBy(0, PAN_STEP); break;
      case 'ArrowDown': e.preventDefault(); panBy(0, -PAN_STEP); break;
      case 'ArrowLeft': e.preventDefault(); panBy(PAN_STEP, 0); break;
      case 'ArrowRight': e.preventDefault(); panBy(-PAN_STEP, 0); break;
      case '+': case '=': e.preventDefault(); zoomIn(); break;
      case '-': e.preventDefault(); zoomOut(); break;
      case '0': case 'f': case 'F': e.preventDefault(); reset(); break;
    }
  };

  const btnCls = 'p-1 rounded bg-zinc-800/80 text-zinc-300 hover:text-white transition';

  return (
    <div className={full ? 'fixed inset-4 z-50 bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded-xl border border-zinc-700 flex flex-col' : 'relative'}>
      {/* Top-right: zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button onClick={zoomIn} className={btnCls} title="Zoom in (+)">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button onClick={zoomOut} className={btnCls} title="Zoom out (−)">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={reset} className={btnCls} title="Fit to container (F / 0)">
          <Scan className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setFull((f) => !f)} className={btnCls} title={full ? 'Exit fullscreen' : 'Fullscreen'}>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom-right: arrow pan buttons */}
      <div className="absolute bottom-2 right-2 z-10 flex flex-col items-center gap-0.5">
        <button onClick={() => panBy(0, -PAN_STEP)} className={btnCls} title="Pan up (↑)">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <div className="flex gap-0.5">
          <button onClick={() => panBy(-PAN_STEP, 0)} className={btnCls} title="Pan left (←)">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => panBy(PAN_STEP, 0)} className={btnCls} title="Pan right (→)">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={() => panBy(0, PAN_STEP)} className={btnCls} title="Pan down (↓)">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content area */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-hidden flex-1 outline-none focus-visible:ring-1 focus-visible:ring-amber-400/40"
        style={full ? undefined : { minHeight: 120 }}
      >
        <div ref={contentRef} style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center top', transition: 'transform 0.08s' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
