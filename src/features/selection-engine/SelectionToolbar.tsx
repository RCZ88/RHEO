import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Pencil, MousePointer2, X, Trash2, CornerDownLeft, Scissors } from 'lucide-react';
import { useSelectionEngine } from './SelectionContext';
import type { SelectionTool } from './types';

const tools: { id: SelectionTool; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'rectangle', label: 'Rectangle', icon: <Square className="w-4 h-4" />, shortcut: 'R' },
  { id: 'freehand', label: 'Freehand', icon: <Pencil className="w-4 h-4" />, shortcut: 'F' },
  { id: 'element', label: 'Element', icon: <MousePointer2 className="w-4 h-4" />, shortcut: 'E' },
];

export function SelectionToolbar() {
  const { isActive, activeTool, isDrawing, setTool, deactivate, cancelDrawing, selections, clearSelections } = useSelectionEngine();

  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'r') setTool('rectangle');
      else if (key === 'f') setTool('freehand');
      else if (key === 'e') setTool('element');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, setTool]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[210]"
        data-selection-overlay="true"
      >
        <div className="flex items-center gap-1 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl border border-zinc-700/80 shadow-2xl px-2 py-1.5">
          <div className="flex items-center gap-0.5 pr-2 border-r border-zinc-700/60">
            {tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                title={`${tool.label} (${tool.shortcut})`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  activeTool === tool.id
                    ? 'bg-amber-500/20 text-amber-400 shadow-sm shadow-amber-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tool.icon}
                <span className="hidden sm:inline">{tool.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] text-zinc-500 font-mono mr-1">
              {isDrawing ? 'Drawing…' : activeTool === 'element' ? 'Click to capture' : 'Click & drag'}
            </span>
          </div>

          <div className="flex items-center gap-0.5 pl-2 border-l border-zinc-700/60">
            {selections.length > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono px-1.5">
                {selections.length} captured
              </span>
            )}
            {isDrawing && (
              <button
                onClick={cancelDrawing}
                title="Cancel (Esc)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {selections.length > 0 && (
              <button
                onClick={clearSelections}
                title="Clear all"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={deactivate}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
