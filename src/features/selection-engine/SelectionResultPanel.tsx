import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Trash2, ChevronDown, ChevronUp, Layers, Code2, Image, Send, Terminal, Edit3, Check } from 'lucide-react';
import { useSelectionEngine } from './SelectionContext';
import type { SelectionResult } from './types';

function generateSelectionPrompt(selection: SelectionResult): string {
  const lines: string[] = [];
  lines.push(`I selected a screen element. Here are the details:`);
  lines.push('');
  if (selection.element) {
    lines.push(`**Element:** \`<${selection.element.tagName}>\``);
    if (selection.element.id) lines.push(`**ID:** ${selection.element.id}`);
    if (selection.element.className) lines.push(`**Class:** ${selection.element.className}`);
    lines.push(`**CSS Selector:** \`${selection.element.cssSelector}\``);
    if (selection.element.componentStack) lines.push(`**React Component:** ${selection.element.componentStack}`);
    if (selection.element.textContent) lines.push(`**Text Content:** "${selection.element.textContent.slice(0, 200)}"`);
  } else {
    lines.push(`**Tool:** ${selection.path.tool}`);
    lines.push(`**Area:** ${Math.round(selection.path.boundingRect.width)}×${Math.round(selection.path.boundingRect.height)}px`);
  }
  lines.push('');
  lines.push(`What would you like me to do with this element?`);
  return lines.join('\n');
}

function SelectionCard({ selection, onRemove }: { selection: SelectionResult; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [injected, setInjected] = useState(false);

  const handleCopyMetadata = async () => {
    const meta = {
      id: selection.id, tool: selection.path.tool,
      element: selection.element ? {
        tag: selection.element.tagName, id: selection.element.id,
        className: selection.element.className, cssSelector: selection.element.cssSelector,
        text: selection.element.textContent, componentStack: selection.element.componentStack,
      } : null,
    };
    await navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selection.imageDataUrl) return;
    const a = document.createElement('a');
    a.href = selection.imageDataUrl;
    a.download = `selection-${selection.id}.png`;
    a.click();
  };

  const handleGeneratePrompt = useCallback(() => {
    const prompt = generateSelectionPrompt(selection);
    setPromptText(prompt);
    setEditing(true);
    setExpanded(true);
  }, [selection]);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInjectToTerminal = async () => {
    try {
      // Save to selection captures DB
      await (window as any).deskflowAPI?.selectionCapture?.save({
        id: selection.id, tool: selection.path.tool,
        imageDataUrl: selection.imageDataUrl, mimeType: selection.mimeType,
        width: selection.width, height: selection.height,
        element: selection.element ? {
          tagName: selection.element.tagName, id: selection.element.id,
          className: selection.element.className, cssSelector: selection.element.cssSelector,
          xpath: selection.element.xpath, textContent: selection.element.textContent,
          componentStack: selection.element.componentStack,
        } : undefined,
        boundingRect: selection.path.boundingRect,
        note: promptText,
      });
      // Copy prompt to clipboard for manual paste
      await navigator.clipboard.writeText(promptText);
      setInjected(true);
      setEditing(false);
      setTimeout(() => setInjected(false), 3000);
    } catch (e) { console.warn('selection inject failed', e); }
  };

  const toolColors: Record<string, string> = {
    rectangle: 'text-blue-400 bg-blue-500/10',
    freehand: 'text-violet-400 bg-violet-500/10',
    element: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-zinc-800/60 rounded-lg border border-zinc-700/50 overflow-hidden">
      <div className="flex items-center gap-2 p-2.5">
        {selection.imageDataUrl && (
          <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-900 light:bg-[var(--ws-surface-raised)] shrink-0 border border-zinc-700/40">
            <img src={selection.imageDataUrl} alt="Selection" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${toolColors[selection.path.tool]}`}>
              {selection.path.tool}
            </span>
            {selection.element && (
              <span className="text-[9px] text-zinc-500 font-mono truncate">
                &lt;{selection.element.tagName}&gt;{selection.element.id && `#${selection.element.id}`}
              </span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
            {Math.round(selection.width)}×{Math.round(selection.height)}px
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={handleGeneratePrompt} title="Generate AI prompt"
            className="p-1.5 rounded-md text-zinc-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={handleCopyMetadata} title="Copy metadata"
            className={`p-1.5 rounded-md transition-colors ${copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}>
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={handleDownload} title="Download image"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors">
            <Download className="w-3 h-3" />
          </button>
          <button onClick={onRemove} title="Remove"
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-2.5 pb-2.5 space-y-2 border-t border-zinc-700/40 pt-2">
              {/* Element details */}
              {selection.element && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <Code2 className="w-3 h-3" /><span className="font-semibold uppercase tracking-wider">Element</span>
                  </div>
                  <div className="bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded-md p-2 space-y-1 text-[10px] font-mono text-zinc-300">
                    <div><span className="text-zinc-500">Tag:</span> {selection.element.tagName}</div>
                    {selection.element.id && <div><span className="text-zinc-500">ID:</span> {selection.element.id}</div>}
                    {selection.element.className && <div className="truncate"><span className="text-zinc-500">Class:</span> {selection.element.className}</div>}
                    <div className="break-all"><span className="text-zinc-500">Selector:</span> {selection.element.cssSelector}</div>
                    {selection.element.componentStack && <div className="break-all"><span className="text-zinc-500">React:</span> {selection.element.componentStack}</div>}
                    {selection.element.textContent && <div className="text-zinc-400 italic mt-1">"{selection.element.textContent.slice(0, 100)}"</div>}
                  </div>
                </div>
              )}

              {/* AI Prompt Editor */}
              {editing && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <Terminal className="w-3 h-3" /><span className="font-semibold uppercase tracking-wider">AI Prompt</span>
                  </div>
                  <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                    className="w-full h-28 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded-md p-2 text-[10px] font-mono text-zinc-300 border border-zinc-700/40 outline-none focus:border-cyan-500/50 resize-none" />
                  <div className="flex gap-1.5">
                    <button onClick={handleInjectToTerminal}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[9px] hover:bg-cyan-500/20 transition-colors">
                      {injected ? <><Check className="w-2.5 h-2.5" /> Copied</> : <><Send className="w-2.5 h-2.5" /> Copy & Save</>}
                    </button>
                    <button onClick={handleCopyPrompt}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700/40 text-zinc-400 text-[9px] hover:text-zinc-200 transition-colors">
                      <Copy className="w-2.5 h-2.5" /> Copy Only
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="px-2 py-1 rounded-md text-zinc-500 text-[9px] hover:text-zinc-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Image preview */}
              {selection.imageDataUrl && !editing && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <Image className="w-3 h-3" /><span className="font-semibold uppercase tracking-wider">Preview</span>
                  </div>
                  <div className="bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded-md p-1.5 border border-zinc-700/30">
                    <img src={selection.imageDataUrl} alt="Preview" className="w-full rounded max-h-40 object-contain" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SelectionResultPanel() {
  const { selections, removeSelection, clearSelections, isActive, deactivate } = useSelectionEngine();
  const [injectAll, setInjectAll] = useState(false);

  const handleInjectAll = async () => {
    const allPrompts = selections.map(s => generateSelectionPrompt(s)).join('\n\n---\n\n');
    await navigator.clipboard.writeText(allPrompts);
    // Save all to DB
    for (const sel of selections) {
      await (window as any).deskflowAPI?.selectionCapture?.save({
        id: sel.id, tool: sel.path.tool, imageDataUrl: sel.imageDataUrl,
        mimeType: sel.mimeType, width: sel.width, height: sel.height,
        element: sel.element ? {
          tagName: sel.element.tagName, id: sel.element.id,
          className: sel.element.className, cssSelector: sel.element.cssSelector,
          textContent: sel.element.textContent, componentStack: sel.element.componentStack,
        } : undefined,
        boundingRect: sel.path.boundingRect,
        note: generateSelectionPrompt(sel),
      });
    }
    setInjectAll(true);
    setTimeout(() => setInjectAll(false), 3000);
  };

  if (!isActive || selections.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-16 right-4 z-[210] w-72" data-selection-overlay="true">
      <div className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl border border-zinc-700/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-200">Selections</span>
            <span className="text-[9px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full font-mono">{selections.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleInjectAll}
              className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-cyan-500/10 transition-colors">
              {injectAll ? <><Check className="w-2.5 h-2.5" /> Copied</> : <><Send className="w-2.5 h-2.5" /> Send All</>}
            </button>
            <button onClick={clearSelections}
              className="text-[9px] text-zinc-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10">
              Clear all
            </button>
            <button onClick={deactivate} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2 ws-scroll">
          <AnimatePresence>
            {selections.map(sel => (
              <SelectionCard key={sel.id} selection={sel} onRemove={() => removeSelection(sel.id)} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
