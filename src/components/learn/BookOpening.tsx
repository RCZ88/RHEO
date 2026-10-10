import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface BookOpeningProps {
  onComplete?: () => void;
}

const BOOK_W = 130;
const BOOK_H = 180;
const PAGE_W = 126;
const PAGE_H = 176;

export function BookOpening({ onComplete }: BookOpeningProps) {
  const [isOpen, setIsOpen] = useState(false);
  const reduced = useReducedMotion();

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) setTimeout(() => onComplete?.(), 1200);
      return next;
    });
  }, [onComplete]);

  const t = (d: number) => reduced ? { duration: 0 } : { duration: d };

  return (
    <div
      className="relative w-[320px] h-[220px] select-none cursor-pointer group"
      style={{ perspective: '1500px', perspectiveOrigin: '50% 55%' }}
      onClick={toggle}
      role="button"
      aria-label={isOpen ? 'Close book' : 'Open book'}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
    >
      {/* GROUND SHADOW */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-[14px] pointer-events-none"
        style={{ width: 250, height: 18, background: 'radial-gradient(ellipse, rgba(15,8,5,0.7), transparent 70%)', filter: 'blur(5px)' }}
        animate={{ opacity: isOpen ? 0.65 : 0.3, scaleX: isOpen ? 1 : 0.7 }}
        transition={t(0.8)}
      />

      {/* 3D BOOK */}
      <div className="absolute left-1/2 top-1/2" style={{ width: BOOK_W * 2, height: BOOK_H, transform: 'translate(-50%,-52%) rotateX(6deg)', transformStyle: 'preserve-3d' }}>

        {/* BACK COVER (right side, visible when open) */}
        <div className="absolute" style={{ left: BOOK_W, top: 0, width: BOOK_W, height: BOOK_H, transformOrigin: 'left center', background: 'linear-gradient(to left, #c9b88a, #e2d3a8 6%, #f1e6c8)', borderRadius: '0 5px 5px 0', boxShadow: 'inset 5px 0 10px -3px rgba(80,50,20,0.3), 0 6px 14px -4px rgba(0,0,0,0.4)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '0 5px 5px 0', opacity: 0.4, backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(194,85,58,0.2), transparent 40%), radial-gradient(ellipse at 70% 60%, rgba(143,58,37,0.15), transparent 45%)' }} />
          <div className="absolute left-0 top-0 bottom-0 w-4 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(60,30,10,0.45), transparent)' }} />
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center opacity-40">
            <div className="w-6 h-px mb-1" style={{ background: 'var(--ws-accent-text)' }} />
            <div className="text-[6px] tracking-[0.4em] uppercase" style={{ color: 'var(--ws-accent-text)', fontFamily: 'ui-monospace' }}>Lyceum</div>
          </div>
        </div>

        {/* RIGHT PAGE */}
        <motion.div
          className="absolute"
          style={{ left: BOOK_W + 3, top: 3, width: PAGE_W, height: PAGE_H, transformOrigin: 'left center', background: 'linear-gradient(to right, #ede2c4, #f5edd3 6%, #faf6ee 12%, #faf6ee)', boxShadow: 'inset 4px 0 8px -3px rgba(80,50,20,0.22)', borderRadius: '0 2px 2px 0' }}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={{ duration: 0.4, delay: isOpen ? 0.5 : 0 }}
        >
          <div className="absolute inset-0 p-4">
            <div className="text-[7px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(60,40,20,0.5)', fontFamily: 'ui-monospace' }}>§ I</div>
            <div className="space-y-1.5">
              {[75,100,100,83,100,67].map((w, i) => <div key={i} className="h-px" style={{ width: `${w}%`, background: 'rgba(60,40,20,0.13)' }} />)}
            </div>
          </div>
        </motion.div>

        {/* PAGE EDGES */}
        <motion.div
          className="absolute pointer-events-none"
          style={{ left: BOOK_W * 2 - 1, top: 5, width: 3, height: BOOK_H - 10, background: 'repeating-linear-gradient(0deg, #faf6ee 0 1px, #d4c498 1px 2px)', borderRadius: '0 1px 1px 0' }}
          animate={{ opacity: isOpen ? 0.85 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* LEFT PAGE */}
        <motion.div
          className="absolute"
          style={{ left: 1, top: 3, width: PAGE_W, height: PAGE_H, transformOrigin: 'right center', background: 'linear-gradient(to left, #ede2c4, #f5edd3 6%, #faf6ee 12%, #faf6ee)', boxShadow: 'inset -4px 0 8px -3px rgba(80,50,20,0.22)', borderRadius: '2px 0 0 2px' }}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={{ duration: 0.4, delay: isOpen ? 0.9 : 0 }}
        >
          <div className="absolute inset-0 p-4">
            <div className="text-[7px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(60,40,20,0.5)', fontFamily: 'ui-monospace' }}>Chapter I</div>
            <div className="text-[9px] leading-tight mb-2" style={{ color: 'rgba(60,40,20,0.7)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Of First Principles</div>
            <div className="space-y-1.5">
              {[100,83,100,75].map((w, i) => <div key={i} className="h-px" style={{ width: `${w}%`, background: 'rgba(60,40,20,0.13)' }} />)}
            </div>
          </div>
        </motion.div>

        {/* FLIPPING PAGES */}
        <AnimatePresence>
          {isOpen && [0, 1, 2].map((i) => (
            <motion.div
              key={`flip-${i}`}
              className="absolute"
              style={{ left: BOOK_W + 3, top: 3 + i * 0.8, width: PAGE_W, height: PAGE_H, transformOrigin: 'left center', transformStyle: 'preserve-3d', borderRadius: '0 2px 2px 0' }}
              initial={{ rotateY: 0, opacity: 0 }}
              animate={{ rotateY: -178, opacity: [0, 1, 1, 0] }}
              exit={{ rotateY: 0, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.4 + i * 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', borderRadius: '0 2px 2px 0', background: 'linear-gradient(to right, #ede2c4, #faf6ee 12%)', boxShadow: 'inset 4px 0 6px -3px rgba(80,50,20,0.15)' }}>
                <div className="absolute inset-0 p-3"><div className="space-y-1">{[100,83,100,75].map((w, j) => <div key={j} className="h-px" style={{ width: `${w}%`, background: 'rgba(60,40,20,0.1)' }} />)}</div></div>
              </div>
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: '0 2px 2px 0', background: 'linear-gradient(to left, #ede2c4, #faf6ee 12%)', boxShadow: 'inset -4px 0 6px -3px rgba(80,50,20,0.15)' }}>
                <div className="absolute inset-0 p-3"><div className="space-y-1">{[75,100,83].map((w, j) => <div key={j} className="h-px" style={{ width: `${w}%`, background: 'rgba(60,40,20,0.1)' }} />)}</div></div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* FRONT COVER — two-faced */}
        <motion.div
          className="absolute"
          style={{ left: BOOK_W, top: 0, width: BOOK_W, height: BOOK_H, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isOpen ? -178 : 0 }}
          transition={{ type: 'spring', stiffness: 42, damping: 13, mass: 1.5 }}
        >
          {/* FRONT FACE: cloth + gilt */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', borderRadius: '0 5px 5px 0', background: 'linear-gradient(135deg, #c2553a, #a8442f 45%, #8f3a25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), inset 10px 0 24px -12px rgba(0,0,0,0.55), 0 14px 32px -10px rgba(0,0,0,0.65)' }}>
            {/* Cloth weave */}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '0 5px 5px 0', backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 3px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.08) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(0,0,0,0.04) 0 1px,transparent 1px 4px),repeating-linear-gradient(0deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 5px)', opacity: 0.75, mixBlendMode: 'overlay' }} />
            {/* Depth lighting */}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '0 5px 5px 0', background: 'radial-gradient(ellipse at 35% 25%,rgba(255,220,180,0.14),transparent 55%),radial-gradient(ellipse at 70% 80%,rgba(0,0,0,0.25),transparent 60%)' }} />
            {/* Spine crease */}
            <div className="absolute left-0 top-0 bottom-0 w-5 pointer-events-none" style={{ background: 'linear-gradient(to right,rgba(0,0,0,0.55),rgba(0,0,0,0.15) 50%,transparent)' }} />
            {/* Fore-edge */}
            <div className="absolute right-0 top-0 bottom-0 w-1 pointer-events-none" style={{ background: 'linear-gradient(to left,rgba(0,0,0,0.35),transparent)' }} />
            {/* Top highlight */}
            <div className="absolute left-0 right-0 top-0 h-2 pointer-events-none" style={{ background: 'linear-gradient(to bottom,rgba(255,255,255,0.08),transparent)' }} />
            {/* Bottom shadow */}
            <div className="absolute left-0 right-0 bottom-0 h-2 pointer-events-none" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.25),transparent)' }} />
            {/* Gilt border */}
            <div className="absolute inset-2 pointer-events-none rounded-sm" style={{ border: '0.5px solid rgba(243,217,164,0.35)', boxShadow: 'inset 0 0 0 0.5px rgba(243,217,164,0.15)' }} />
            {/* Title block */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="text-[7px] tracking-[0.45em] uppercase mb-3" style={{ color: '#f3d9a4', fontFamily: 'ui-monospace', textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(243,217,164,0.15)' }}>Lyceum Press</div>
              <div className="w-12 h-px mb-3" style={{ background: '#f3d9a4', opacity: 0.6, boxShadow: '0 1px 1px rgba(0,0,0,0.3)' }} />
              <div className="text-center text-[13px] leading-tight mb-2 px-2" style={{ color: '#f3d9a4', fontFamily: 'Georgia, serif', fontStyle: 'italic', textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 10px rgba(243,217,164,0.15)' }}>The Art of<br />Understanding</div>
              <div className="w-12 h-px mt-2 mb-3" style={{ background: '#f3d9a4', opacity: 0.6, boxShadow: '0 1px 1px rgba(0,0,0,0.3)' }} />
              <div className="text-[7px] tracking-[0.5em] uppercase" style={{ color: '#f3d9a4', fontFamily: 'ui-monospace', textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(243,217,164,0.15)' }}>Volume I</div>
            </div>
            {/* Page edges at bottom */}
            <div className="absolute left-2 right-2 bottom-0 h-[3px] pointer-events-none" style={{ background: 'repeating-linear-gradient(90deg, #faf6ee 0 1px, #d4c498 1px 2px)', opacity: 0.55 }} />
          </div>

          {/* BACK FACE: endpaper */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: '0 5px 5px 0', background: 'linear-gradient(to right, #c9b88a, #e2d3a8 6%, #f1e6c8)', boxShadow: 'inset -5px 0 10px -3px rgba(80,50,20,0.3)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '0 5px 5px 0', opacity: 0.4, backgroundImage: 'radial-gradient(ellipse at 80% 30%, rgba(194,85,58,0.2), transparent 40%), radial-gradient(ellipse at 30% 60%, rgba(143,58,37,0.15), transparent 45%)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-5 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(60,30,10,0.45), transparent)' }} />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-45">
              <div className="text-[7px] tracking-[0.4em] uppercase mb-1" style={{ color: 'var(--ws-accent-text)', fontFamily: 'ui-monospace' }}>Ex Libris</div>
              <div className="w-8 h-px" style={{ background: 'var(--ws-accent-text)' }} />
            </div>
          </div>
        </motion.div>

        {/* SPINE */}
        <div className="absolute pointer-events-none" style={{ left: BOOK_W - 1, top: 0, width: 2, height: BOOK_H, background: 'linear-gradient(to right, rgba(60,30,10,0), rgba(60,30,10,0.5) 40%, rgba(60,30,10,0.7) 50%, rgba(60,30,10,0.5) 60%, rgba(60,30,10,0))', opacity: 0.55 }} />
      </div>

      {/* Hint */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 font-mono whitespace-nowrap"
        animate={{ opacity: isOpen ? 0 : 0.6 }}
        transition={{ delay: isOpen ? 0 : 1, duration: 0.5 }}
      >
        click to open
      </motion.div>
    </div>
  );
}
