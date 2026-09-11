import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Highlighter, StickyNote, Trash2, Palette, Lightbulb, MessageSquare, Search, ArrowRight, ImageIcon, Edit3 } from 'lucide-react';
import type { Highlight } from '../../services/learn/highlightAnchor';

const HIGHLIGHT_COLORS: { value: Highlight['color']; label: string; css: string }[] = [
  { value: 'yellow', label: 'Yellow', css: '#eab308' },
  { value: 'green', label: 'Green', css: '#22c55e' },
  { value: 'blue', label: 'Blue', css: '#3b82f6' },
  { value: 'pink', label: 'Pink', css: '#ec4899' },
  { value: 'orange', label: 'Orange', css: '#f97316' },
];

const TUTOR_MODES = [
  { key: 'explain' as const, label: 'Explain', icon: Lightbulb },
  { key: 'ask' as const, label: 'Ask...', icon: MessageSquare },
  { key: 'simpler' as const, label: 'Simpler', icon: Search },
  { key: 'deeper' as const, label: 'Deeper', icon: ArrowRight },
  { key: 'edit' as const, label: 'Edit', icon: Edit3 },
];

interface SelectionActionsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onCreateHighlight: (text: string, startOffset: number, endOffset: number, color: Highlight['color']) => void;
  onCreateNote: (text: string, startOffset: number, endOffset: number) => void;
  onDeleteHighlight?: (id: string) => void;
  selectedHighlightId?: string | null;
  onAskTutor?: (text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper' | 'edit') => void;
  onExplainWithImage?: (text: string, contextText: string) => void;
  isSelecting?: boolean;
}

export function SelectionActions({
  containerRef,
  onCreateHighlight,
  onCreateNote,
  onDeleteHighlight,
  selectedHighlightId,
  onAskTutor,
  onExplainWithImage,
}: SelectionActionsProps) {
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  // Helper: total text length of a node tree
  const getTextLength = useCallback((node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').length;
    }
    let len = 0;
    for (let i = 0; i < node.childNodes.length; i++) {
      len += getTextLength(node.childNodes[i]);
    }
    return len;
  }, []);

  const getTextOffset = useCallback(
    (node: Node, offset: number): number => {
      if (!containerRef.current) return 0;

      if (node === containerRef.current) {
        let sum = 0;
        for (let i = 0; i < offset && i < node.childNodes.length; i++) {
          sum += getTextLength(node.childNodes[i]);
        }
        return sum;
      }

      let total = 0;
      const walk = (n: Node): boolean => {
        if (n === node) {
          if (node.nodeType === Node.TEXT_NODE) {
            total += offset;
          } else {
            for (let i = 0; i < offset && i < node.childNodes.length; i++) {
              total += getTextLength(node.childNodes[i]);
            }
          }
          return true;
        }

        if (n.nodeType === Node.TEXT_NODE) {
          total += (n.textContent ?? '').length;
          return false;
        }

        for (let i = 0; i < n.childNodes.length; i++) {
          if (walk(n.childNodes[i])) return true;
        }
        return false;
      };

      walk(containerRef.current);
      return total;
    },
    [containerRef, getTextLength],
  );

  useEffect(() => {
    const handleMouseDown = () => {
      isSelectingRef.current = true;
    };

    const handleMouseUp = () => {
      isSelectingRef.current = false;
      // Defer to next frame so browser finishes selection update
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount || !containerRef.current) {
          setSelection(null);
          setShowColorPicker(false);
          return;
        }

        const range = sel.getRangeAt(0);
        const text = sel.toString().trim();
        if (!text || text.length > 500) {
          setSelection(null);
          return;
        }

        // Verify selection is inside our reader
        const ancestor = range.commonAncestorContainer;
        if (!containerRef.current.contains(ancestor)) {
          setSelection(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        const startOffset = getTextOffset(range.startContainer, range.startOffset);
        const endOffset = getTextOffset(range.endContainer, range.endOffset);

        const [finalStart, finalEnd] = startOffset <= endOffset
          ? [startOffset, endOffset]
          : [endOffset, startOffset];

        setSelection({ text, rect, startOffset: finalStart, endOffset: finalEnd });
      });
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, getTextOffset]);

  // Dismiss on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!selection) return;
      if (toolbarRef.current?.contains(e.target as Node)) return;
      if (!containerRef.current?.contains(e.target as Node)) {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selection, containerRef]);

  const handleHighlight = useCallback(
    (color: Highlight['color']) => {
      if (!selection) return;
      onCreateHighlight(selection.text, selection.startOffset, selection.endOffset, color);
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setShowColorPicker(false);
    },
    [selection, onCreateHighlight],
  );

  const handleNote = useCallback(() => {
    if (!selection) return;
    onCreateNote(selection.text, selection.startOffset, selection.endOffset);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, onCreateNote]);

  const handleDeleteHighlight = useCallback(() => {
    if (!selectedHighlightId || !onDeleteHighlight) return;
    onDeleteHighlight(selectedHighlightId);
  }, [selectedHighlightId, onDeleteHighlight]);

  const handleTutorMode = useCallback((mode: 'explain' | 'ask' | 'simpler' | 'deeper' | 'edit') => {
    if (!selection || !onAskTutor) return;
    onAskTutor(selection.text, mode);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, onAskTutor]);

  const handleExplainWithImage = useCallback(() => {
    if (!selection || !onExplainWithImage) return;
    // Get surrounding context (parent paragraph text)
    const container = containerRef.current;
    let contextText = '';
    if (container) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let parent = range.startContainer.parentElement;
        // Walk up to find a paragraph or block element
        while (parent && parent !== container) {
          if (parent.tagName === 'P' || parent.tagName === 'DIV' || parent.classList?.contains('prose')) {
            contextText = parent.textContent || '';
            break;
          }
          parent = parent.parentElement;
        }
      }
    }
    onExplainWithImage(selection.text, contextText || selection.text);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, onExplainWithImage, containerRef]);

  const toolbarStyle = useMemo(() => {
    if (!selection) return {};
    const { rect } = selection;
    const toolbarW = 220;
    const toolbarH = 44;
    const gap = 12;
    let left = rect.left + rect.width / 2 - toolbarW / 2;
    let top = rect.top - toolbarH - gap;
    left = Math.max(12, Math.min(left, window.innerWidth - toolbarW - 12));
    top = Math.max(12, top);
    return { position: 'fixed' as const, left, top, zIndex: 9999 };
  }, [selection, onAskTutor]);

  if (!selection && !selectedHighlightId) return null;

  // Portal: toolbar lives on document.body, completely outside the block tree
  const toolbar = selection ? (
    <div
      ref={toolbarRef}
      className="lyceum-selection-toolbar"
      style={toolbarStyle}
    >
      {showColorPicker ? (
        <div className="lyceum-selection-colors">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              className="lyceum-selection-color-btn"
              onClick={() => handleHighlight(c.value)}
              title={c.label}
              style={{ backgroundColor: c.css }}
              aria-label={`Highlight ${c.label}`}
            />
          ))}
          <button
            className="lyceum-selection-color-btn lyceum-selection-color-back"
            onClick={() => setShowColorPicker(false)}
            title="Back"
          >
            <Palette size={12} />
          </button>
        </div>
      ) : (
        <>
          {onAskTutor && TUTOR_MODES.map((mode) => (
            <button
              key={mode.key}
              className="lyceum-selection-action"
              onClick={() => handleTutorMode(mode.key)}
              title={mode.label}
            >
              <mode.icon size={14} />
            </button>
          ))}
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <button
            className="lyceum-selection-action"
            onClick={() => setShowColorPicker(true)}
            title="Highlight"
          >
            <Highlighter size={14} />
          </button>
          <button
            className="lyceum-selection-action"
            onClick={handleNote}
            title="Add note"
          >
            <StickyNote size={14} />
          </button>
          {onExplainWithImage && (
            <button
              className="lyceum-selection-action"
              onClick={handleExplainWithImage}
              title="Explain with Image"
              style={{ color: '#fbbf24' }}
            >
              <ImageIcon size={14} />
            </button>
          )}
        </>
      )}
    </div>
  ) : selectedHighlightId && onDeleteHighlight ? (
    <div className="lyceum-selection-toolbar lyceum-selection-toolbar-existing">
      <button
        className="lyceum-selection-action lyceum-selection-action-delete"
        onClick={handleDeleteHighlight}
        title="Remove highlight"
      >
        <Trash2 size={14} />
      </button>
    </div>
  ) : null;

  return toolbar ? createPortal(toolbar, document.body) : null;
}
