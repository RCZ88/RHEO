import React, { useEffect, useRef, useState } from 'react';
import type { FinChartBlock as FinChartBlockType } from '../../../shared/learn/types';
import { isDynamicImportFailure, autoHealDynamicImport } from '../../ErrorBoundary';

interface Props {
  block: FinChartBlockType;
  onAsk?: (blockId: string, question: string) => void;
}

type Row = Record<string, unknown>;

/**
 * Extract the data array from a finchart block. The parser passes full
 * vega-lite specs where the data lives at `spec.data.values` (NOT at the
 * top level), so `(parsed.data ?? parsed)` alone throws "No data series
 * found". Also accept plain arrays and OHLC rows.
 */
function extractData(parsed: unknown): Row[] {
  const anyParsed = parsed as any;
  if (Array.isArray(parsed)) return parsed as Row[];
  if (!anyParsed || typeof anyParsed !== 'object') return [];
  if (Array.isArray(anyParsed.data)) return anyParsed.data as Row[];
  const values = anyParsed.data?.values;
  if (Array.isArray(values)) return values as Row[];
  const encValues = anyParsed.encoding?.x?.data;
  if (Array.isArray(encValues)) return encValues as Row[];
  return [];
}

const SERIES_COLORS = ['#d96846', '#22c55e', '#3b82f6', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];

export function FinChartBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    let data: Row[];
    let parsed: any;
    try {
      parsed = block.parsed ?? JSON.parse(block.spec);
      data = extractData(parsed);
      if (!data.length) {
        throw new Error('No data series found — expected a data array or a vega-lite spec with data.values');
      }
    } catch (e: any) {
      if (mounted) {
        setError(`Invalid chart data: ${e.message}`);
        setLoading(false);
      }
      return;
    }

    let chart: any = null;
    let handleResize: () => void = () => {};

    import('lightweight-charts').then((lwc) => {
      if (!mounted || !containerRef.current) return;

      chart = lwc.createChart(containerRef.current, {
        width: Math.max(containerRef.current.clientWidth, 300),
        height: 300,
        layout: {
          background: { color: 'transparent' },
          textColor: '#a1a1aa',
        },
        grid: {
          vertLines: { color: '#27272a' },
          horzLines: { color: '#27272a' },
        },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
        },
        timeScale: {
          borderColor: '#3f3f46',
        },
      });

      const hasOhlc = data[0] && 'open' in data[0] && 'high' in data[0] && 'low' in data[0] && 'close' in data[0];
      if (hasOhlc) {
        chart.addSeries(lwc.CandlestickSeries, {
          data: data as any,
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
      } else {
        // Find the categorical x-field (string values) — everything numeric
        // that isn't the x-field becomes its own series.
        const first = data[0] as Row;
        let xField: string | null = null;
        for (const [k, v] of Object.entries(first)) {
          if (typeof v === 'string' && !xField) xField = k;
        }
        const numericFields = Object.keys(first).filter((k) => k !== xField && typeof first[k] === 'number');
        const fields = numericFields.length ? numericFields : Object.keys(first).filter((k) => k !== xField);

        if (!fields.length) {
          throw new Error('No numeric series found in the data');
        }

        const labels = xField ? data.map((r) => String(r[xField] ?? '')) : null;
        const timeFor = (i: number) => i as any;

        fields.forEach((field, fi) => {
          const color = SERIES_COLORS[fi % SERIES_COLORS.length];
          const points = data.map((r, i) => ({ time: timeFor(i), value: Number(r[field] ?? 0) }));
          const mark = (parsed?.mark as string) || (parsed?.encoding?.x?.mark as string) || 'line';
          if (mark === 'bar' || mark === 'histogram') {
            chart.addSeries(lwc.HistogramSeries, { color, priceFormat: { type: 'price' } }).setData(points as any);
          } else if (mark === 'area') {
            chart.addSeries(lwc.AreaSeries, {
              lineColor: color,
              topColor: `${color}4d`,
              bottomColor: `${color}0d`,
            }).setData(points as any);
          } else {
            chart.addSeries(lwc.LineSeries, { color, lineWidth: 2 }).setData(points as any);
          }
        });

        if (labels) {
          chart.timeScale().applyOptions({
            tickMarkFormatter: (t: any) => labels[Number(t)] ?? '',
          });
        }
      }

      handleResize = () => {
        if (containerRef.current) {
          chart?.applyOptions({ width: Math.max(containerRef.current.clientWidth, 300) });
        }
      };
      window.addEventListener('resize', handleResize);

      setLoading(false);
    }).catch((err: any) => {
      if (mounted) {
        if (isDynamicImportFailure(err)) {
          autoHealDynamicImport();
          return;
        }
        setError(`Chart error: ${err.message}`);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      try { chart?.remove(); } catch { /* already removed */ }
    };
  }, [block.id, block.spec, block.parsed, retry]);

  return (
    <div className="my-6 py-4 px-4 rounded-xl bg-zinc-800/30 border border-zinc-700/40 group relative" data-block-id={block.id}>
      {loading && (
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-clay-400 rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm">
          <div>{error}</div>
          <pre className="mt-2 text-xs bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] p-2 rounded overflow-x-auto">{block.spec}</pre>
          <button
            onClick={() => setRetry((r) => r + 1)}
            className="mt-2 text-xs font-medium text-clay-400 hover:text-clay-300 transition"
          >
            ↻ Retry
          </button>
        </div>
      )}
      <div ref={containerRef} className={error ? 'hidden' : 'w-full'} />
      {block.caption && (
        <div className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Analyze this financial chart`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}
