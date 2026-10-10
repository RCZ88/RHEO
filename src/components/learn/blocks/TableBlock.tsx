import React, { useEffect, useRef, useState } from 'react';
import type { TableBlock as TableBlockType } from '../../../shared/learn/types';
import { isDynamicImportFailure, autoHealDynamicImport } from '../../ErrorBoundary';

// Tabulator v6 themes are CSS-only — without this import every table renders
// as unstyled stacked text inside a bordered panel.
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_site_dark.min.css';

interface Props {
  block: TableBlockType;
  onAsk?: (blockId: string, question: string) => void;
}

export function TableBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    import('tabulator-tables').then((Tabulator) => {
      if (!mounted || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      const Tab = Tabulator.Tabulator || Tabulator.default || (Tabulator as any);
      new Tab(containerRef.current, {
        data: block.rows,
        columns: block.columns.map((c) => ({
          title: c.title,
          field: c.field,
        })),
        layout: 'fitColumns',
        // v6 dropped the `theme` option (CSS classes only) — `theme: 'dark'`
        // was silently ignored; the site-dark CSS import above handles it.
        ...block.options,
      });
      setLoading(false);
    }).catch((err: any) => {
      if (mounted) {
        // If the dynamic import failed with a stale chunk (old hash after a
        // rebuild), self-heal with a reload instead of showing a dead table.
        if (isDynamicImportFailure(err)) {
          autoHealDynamicImport();
          return;
        }
        setError(`Table error: ${err.message}`);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [block.id, block.rows, block.columns, block.options]);

  return (
    <div className="my-6 py-4 px-4 rounded-xl bg-zinc-800/30 border border-zinc-700/40 group relative" data-block-id={block.id}>
      {loading && (
        <div className="h-32 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-clay-400 rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm">
          <div>{error}</div>
          <details className="mt-1 group/details">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition">Show plain table instead</summary>
            <PlainTable block={block} />
          </details>
        </div>
      )}
      <div ref={containerRef} className={loading || error ? 'hidden' : ''} />
      {block.caption && (
        <div className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Look up data in this table`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}

function PlainTable({ block }: { block: TableBlockType }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-700/50">
      <table className="w-full text-xs text-zinc-300">
        <thead>
          <tr className="bg-zinc-800/80 text-left">
            {block.columns.map((c) => (
              <th key={c.field} className="px-3 py-2 font-medium text-zinc-400 border-b border-zinc-700/60 whitespace-nowrap">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="odd:bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
              {block.columns.map((c) => (
                <td key={c.field} className="px-3 py-1.5 border-b border-zinc-800/60 align-top">{String(row[c.field] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
