import { SearchX, X } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PRESET_COLORS } from '../constants';
import { SETTING_GROUPS, TAB_BY_ID } from '../registry';

/**
 * group id -> every keyword that should make that group findable.
 *
 * Includes the owning TAB's keywords, because a word like "phone" should light up
 * the Devices group even though the group itself never says "phone". A group is
 * only rendered inside its tab, so inheriting the tab's vocabulary cannot cause
 * a false positive somewhere else.
 */
const GROUP_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  SETTING_GROUPS.map((g) => {
    const tab = TAB_BY_ID.get(g.tab)
    return [g.id, [
      g.id.replace(/-/g, ' '),
      g.title ?? '',
      tab?.label ?? '',
      ...(g.keywords ?? []),
      ...(tab?.keywords ?? []),
    ].filter(Boolean)]
  }),
);

export { SortableChip } from './SortableChip';
export { TierContainer } from './TierContainer';

/**
 * Recursively walks a React element tree and collects its static text.
 * Reading the React tree (not the DOM) means the corpus is available on the
 * very first render, with no ref-timing race and no measurement node — so a
 * newly added setting is searchable the moment it is added.
 */
function extractText(node: React.ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  const el = node as React.ReactElement<{ children?: React.ReactNode }>;
  return extractText(el.props?.children);
}

/**
 * Searchable settings section.
 *
 * The searchable corpus is derived from the section's OWN visible text, so
 * nothing has to be registered by hand when a setting is added or renamed.
 * `terms` is now OPTIONAL and additive — use it only for extra synonyms or
 * aliases that do not appear as literal copy (e.g. "stt" for "Voice Input").
 *
 * `group` is preferred over `terms` for NEW call sites: it names an entry in
 * `settings/registry`, which means the synonyms live in one place instead of
 * being copy-pasted into a `terms={[...]}` array at each site. There were 39 such
 * arrays across this page and they had already drifted from the tab keywords and
 * from each other — the same failure mode as the six-registry rot in navigation.
 * `terms` still works, so nothing has to be migrated in one go.
 *
 * Every whitespace-separated token in the query must appear somewhere
 * (AND semantics), so "track rheo" narrows rather than widens the result set.
 */
export function SearchableSection({
  terms,
  group,
  search,
  children,
}: {
  terms?: string[];
  /** Entry id in `settings/registry` supplying synonyms. Preferred over `terms`. */
  group?: string;
  search: string;
  children: React.ReactNode;
}) {
  const ownText = extractText(children);

  const corpus = useMemo(() => {
    // Manifest synonyms first, then any legacy `terms`, then the section's own
    // rendered text. Order does not matter for matching (it is an AND over
    // tokens) but keeping the manifest authoritative means a group id alone is
    // enough to be findable.
    const manifest = group ? (GROUP_KEYWORDS[group] ?? []) : [];
    return `${manifest.join(' ')} ${(terms || []).join(' ')} ${ownText}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownText, group, (terms || []).join(' ')]);

  const q = search.toLowerCase().trim();
  if (!q) return <>{children}</>;

  const tokens = q.split(/\s+/).filter(Boolean);
  const matches = tokens.every((t) => corpus.includes(t));
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
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="p-4 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-xl w-52">
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
