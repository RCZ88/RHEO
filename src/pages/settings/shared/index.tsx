import { SearchX, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PRESET_COLORS } from '../constants';

export { SortableChip } from './SortableChip';
export { TierContainer } from './TierContainer';

export function SearchableSection({ terms, search, children }: { terms: string[]; search: string; children: React.ReactNode }) {
  if (!search.trim()) return <>{children}</>;
  const q = search.toLowerCase();
  const matches = terms.some(t => t.toLowerCase().includes(q) || q.includes(t.toLowerCase()));
  if (!matches) return null;
  return <>{children}</>;
}

export function ColorPicker({ value, onChange, size = 'md' }: { value: string; onChange: (color: string) => void; size?: 'sm' | 'md' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-color-picker-overlay]')) return;
      if (ref.current && !ref.current.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const sizeClass = size === 'sm' ? 'w-16 h-3' : 'w-20 h-4';

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${sizeClass} rounded cursor-pointer border-2 border-zinc-600 hover:border-zinc-400 transition-colors duration-150 hover:scale-110 shadow-md`}
          style={{ backgroundColor: value, borderRadius: '4px' }}
          title="Click to change color"
        />
      </div>
      {isOpen && createPortal(
        <div data-color-picker-overlay style={{ position: 'fixed', inset: 0, zIndex: 2147483647 }} onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl w-52">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-300">Pick a color</span>
              <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_COLORS.slice(0, 15).map((color) => (
                <button key={color} onClick={() => { onChange(color); setIsOpen(false); }}
                  className={`w-7 h-7 rounded-full hover:scale-110 transition-transform ${value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-700">
              <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
              <span className="text-xs text-zinc-400 font-mono">{value}</span>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
