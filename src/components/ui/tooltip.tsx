import { type ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offsets: Record<string, { x: number; y: number }> = {
      top: { x: rect.left + rect.width / 2, y: rect.top - 4 },
      bottom: { x: rect.left + rect.width / 2, y: rect.bottom + 4 },
      left: { x: rect.left - 4, y: rect.top + rect.height / 2 },
      right: { x: rect.right + 4, y: rect.top + rect.height / 2 },
    };
    setPos(offsets[side]);
  }, [visible, side]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      className="relative inline-flex"
      tabIndex={0}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="fixed z-50 px-2 py-1 text-[11px] font-medium text-zinc-200 bg-zinc-900/95 ring-1 ring-zinc-700 rounded-md pointer-events-none whitespace-nowrap light:text-zinc-800 light:bg-white/95 light:ring-zinc-200"
          style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${side === 'top' ? '-100%' : side === 'bottom' ? '0%' : '-50%'})` }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
