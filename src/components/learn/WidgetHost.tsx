import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Ban, RefreshCw, Maximize2 } from 'lucide-react';
import type { WidgetBlock } from '../../shared/learn/types';

interface WidgetTemplateDef {
  label: string;
  generateHtml: (params: Record<string, unknown>) => string;
  paramsSchema: Record<string, unknown>;
}

const TEMPLATE_WIDGETS: Record<string, WidgetTemplateDef> = {
  'graph-explorer': {
    label: 'Graph Explorer',
    generateHtml: (params) => `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 8px">Graph Explorer</h2>
<div id="viz" style="width:100%;height:200px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#52525b">
  Interactive graph: ${JSON.stringify(params)}
</div>
<p style="font-size:11px;color:#52525b;margin:8px 0 0">Drag nodes to explore</p>
</body></html>`,
    paramsSchema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', items: { type: 'string' }, description: 'Graph node labels' },
        edges: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } }, description: 'Graph edges' },
      },
    },
  },
  'function-plotter': {
    label: 'Function Plotter',
    generateHtml: (params) => `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 8px">Function Plotter</h2>
<canvas id="plot" style="width:100%;height:200px;border:1px solid #3f3f46;border-radius:8px"></canvas>
<script>
  const canvas = document.getElementById('plot');const ctx=canvas.getContext('2d');
  canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;
  const w=canvas.width,h=canvas.height;
  ctx.strokeStyle='#d97706';ctx.lineWidth=2;ctx.beginPath();
  for(let x=0;x<=w;x++){const t=x/w*4-2;const y=h/2-h/4*Math.sin(t*Math.PI);ctx.lineTo(x,y)}
  ctx.stroke();
  ctx.fillStyle='#52525b';ctx.font='11px system-ui';ctx.fillText('y = sin(x)',8,16);
</script>
</body></html>`,
    paramsSchema: {
      type: 'object',
      properties: {
        fn: { type: 'string', description: 'Math expression to plot (e.g. "sin(x)")' },
        xMin: { type: 'number', description: 'X axis min' },
        xMax: { type: 'number', description: 'X axis max' },
      },
    },
  },
  'vector-field': {
    label: 'Vector Field',
    generateHtml: (params) => `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 8px">Vector Field</h2>
<div style="width:100%;height:200px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#52525b">
  Vector field visualization (${(params as any).dimensions || '2D'})
</div>
</body></html>`,
    paramsSchema: {
      type: 'object',
      properties: {
        dimensions: { type: 'string', enum: ['2D', '3D'], description: 'Field dimensionality' },
        fn: { type: 'string', description: 'Vector function expression' },
      },
    },
  },
  'matrix-playground': {
    label: 'Matrix Playground',
    generateHtml: (params) => `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 8px">Matrix Playground</h2>
<div style="display:grid;grid-template-columns:repeat(${(params as any).cols || 3},40px);gap:4px;justify-content:center">
  ${Array.from({length: (params as any).rows || 3 * (params as any).cols || 3}, (_, i) => `<input value="${Math.round(Math.random()*10)}" style="width:40px;height:40px;text-align:center;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#e4e4e7;font-size:12px"/>`).join('')}
</div>
</body></html>`,
    paramsSchema: {
      type: 'object',
      properties: {
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        values: { type: 'array', items: { type: 'number' }, description: 'Initial matrix values (row-major)' },
      },
    },
  },
  'lbo-return-model': {
    label: 'LBO Return Model',
    generateHtml: (params) => {
      const equity = Number(params.equity) || 100;
      const debt = Number(params.debt) || 400;
      const rate = Number(params.rate) || 0.08;
      const years = Number(params.years) || 5;
      const ebitdaGrowth = Number(params.ebitdaGrowth) || 0.10;
      let ebitda = 100;
      const rows: string[] = [];
      for (let y = 0; y <= years; y++) {
        const ev = ebitda * 8;
        const netDebt = debt * Math.pow(1 + rate, y);
        const equityValue = ev - netDebt;
        const moic = equityValue / equity;
        rows.push(`<tr><td style="padding:4px 8px;border-bottom:1px solid #27272a;color:#a1a1aa">${y}</td><td style="padding:4px 8px;border-bottom:1px solid #27272a;color:#e4e4e7">$${ebitda.toFixed(0)}M</td><td style="padding:4px 8px;border-bottom:1px solid #27272a;color:#e4e4e7">$${ev.toFixed(0)}M</td><td style="padding:4px 8px;border-bottom:1px solid #27272a;color:${moic >= 2 ? '#22c55e' : '#d97706'}">${moic.toFixed(1)}x</td></tr>`);
        ebitda *= 1 + ebitdaGrowth;
      }
      return `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 12px;color:#d97706">LBO Return Model</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px">
<thead><tr style="color:#a1a1aa;text-align:left"><th style="padding:4px 8px;border-bottom:1px solid #3f3f46">Year</th><th style="padding:4px 8px;border-bottom:1px solid #3f3f46">EBITDA</th><th style="padding:4px 8px;border-bottom:1px solid #3f3f46">EV (8x)</th><th style="padding:4px 8px;border-bottom:1px solid #3f3f46">MOIC</th></tr></thead>
<tbody>${rows.join('')}</tbody>
</table>
<p style="font-size:11px;color:#52525b;margin:12px 0 0">Equity $${equity}M | Debt $${debt}M @ ${(rate*100).toFixed(0)}% | ${(ebitdaGrowth*100).toFixed(0)}% growth/yr</p>
</body></html>`;
    },
    paramsSchema: {
      type: 'object',
      properties: {
        equity: { type: 'number', description: 'Equity contribution ($M)' },
        debt: { type: 'number', description: 'Debt principal ($M)' },
        rate: { type: 'number', description: 'Interest rate (decimal, e.g. 0.08)' },
        years: { type: 'number', description: 'Holding period (years)' },
        ebitdaGrowth: { type: 'number', description: 'Annual EBITDA growth (decimal, e.g. 0.10)' },
      },
      required: ['equity', 'debt'],
    },
  },
  'break-even': {
    label: 'Break-Even Analysis',
    generateHtml: (params) => {
      const fixed = Number(params.fixedCost) || 50000;
      const price = Number(params.unitPrice) || 25;
      const cost = Number(params.unitCost) || 10;
      const contrib = price - cost;
      const breakEven = contrib > 0 ? Math.ceil(fixed / contrib) : Infinity;
      const maxUnits = breakEven * 1.5;
      const w = 320, h = 180, pad = 40;
      const xScale = (v: number) => pad + (v / maxUnits) * (w - pad * 2);
      const yScale = (v: number) => h - pad - (v / (fixed + maxUnits * price * 0.4)) * (h - pad * 2);
      const points = Array.from({ length: 50 }, (_, i) => {
        const u = (i / 49) * maxUnits;
        const rev = u * price;
        return `${xScale(u)},${yScale(rev)}`;
      }).join(' ');
      const costPoints = Array.from({ length: 50 }, (_, i) => {
        const u = (i / 49) * maxUnits;
        const tc = fixed + u * cost;
        return `${xScale(u)},${yScale(tc)}`;
      }).join(' ');
      const beX = xScale(breakEven);
      return `<!DOCTYPE html><html><body style="margin:0;background:#18181b;color:#e4e4e7;font-family:system-ui;padding:16px">
<h2 style="font-size:14px;margin:0 0 12px;color:#d97706">Break-Even Analysis</h2>
<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px">
  <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#3f3f46" stroke-width="1"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#3f3f46" stroke-width="1"/>
  <polyline points="${points}" fill="none" stroke="#22c55e" stroke-width="2"/>
  <polyline points="${costPoints}" fill="none" stroke="#ef4444" stroke-width="2"/>
  <line x1="${beX}" y1="${pad}" x2="${beX}" y2="${h-pad}" stroke="#d97706" stroke-width="1" stroke-dasharray="4"/>
  <text x="${beX}" y="${pad - 4}" fill="#d97706" font-size="10" text-anchor="middle">${breakEven === Infinity ? 'N/A' : breakEven}</text>
  <text x="${w-pad}" y="${h-pad+14}" fill="#71717a" font-size="9" text-anchor="end">Units</text>
  <text x="${pad+4}" y="${pad}" fill="#71717a" font-size="9">$</text>
</svg>
<div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#a1a1aa">
  <span style="color:#22c55e">Revenue</span>
  <span style="color:#ef4444">Total Cost</span>
  <span style="color:#d97706">Break-Even: ${breakEven === Infinity ? 'N/A' : breakEven} units</span>
</div>
</body></html>`;
    },
    paramsSchema: {
      type: 'object',
      properties: {
        fixedCost: { type: 'number', description: 'Total fixed costs ($)' },
        unitPrice: { type: 'number', description: 'Selling price per unit ($)' },
        unitCost: { type: 'number', description: 'Variable cost per unit ($)' },
      },
      required: ['fixedCost', 'unitPrice', 'unitCost'],
    },
  },
};

export function WidgetHost({ block }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isTemplate = block.kind === 'template' && block.template;

  const widgetDef = isTemplate ? TEMPLATE_WIDGETS[block.template!] : null;
  const hasCustomHtml = block.kind === 'html' && block.html;
  const denied = !widgetDef && !hasCustomHtml;

  const htmlContent = useCallback(() => {
    if (widgetDef) return widgetDef.generateHtml(block.params || {});
    if (hasCustomHtml) return block.html!;
    return '<html><body style="margin:0;background:#18181b;color:#52525b;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:system-ui">Widget not available</body></html>';
  }, [widgetDef, hasCustomHtml, block]);

  useEffect(() => {
    setLoaded(false);
    setError(null);
    if (iframeRef.current && (widgetDef || hasCustomHtml)) {
      const blob = new Blob([htmlContent()], { type: 'text/html' });
      iframeRef.current.src = URL.createObjectURL(blob) + '#widget';
      setLoaded(true);
    }
  }, [block.id, block.template, block.html]);

  // Auto-size iframe to content height via postMessage (Part 3B)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.t === 'h' && iframeRef.current) {
        iframeRef.current.style.height = Math.min(e.data.h, 720) + 'px';
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="my-4">
      <div className={`rounded-xl border border-zinc-700/40 overflow-hidden transition-all ${expanded ? 'fixed inset-4 z-40 bg-zinc-900 light:bg-[var(--ws-surface-raised)]' : 'bg-zinc-800/20'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-800/30">
          <span className="text-xs font-medium text-zinc-400">
            {widgetDef?.label || 'Widget'}
          </span>
          <div className="flex items-center gap-1">
            {error && (
              <button
                onClick={() => { setError(null); setLoaded(false); }}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition"
                aria-label="Reload widget"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition"
              aria-label={expanded ? 'Minimize' : 'Maximize'}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        {denied ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Ban className="w-6 h-6 mb-2 opacity-50" />
            <p className="text-xs font-medium">Widget not available</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              {block.kind === 'template' ? `Unknown template: ${block.template}` : 'No HTML content provided'}
            </p>
          </div>
        ) : (
          <>
            {!loaded && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts"
              title={`Widget: ${widgetDef?.label || block.template || 'custom'}`}
              className={`w-full ${expanded ? 'h-full' : 'h-64'} border-0 bg-zinc-950 light:bg-[var(--ws-surface)]/50 ${loaded ? '' : 'hidden'}`}
              onError={() => setError('Failed to load widget')}
            />
            {error && (
              <div className="flex items-center justify-center py-8 text-zinc-500">
                <p className="text-xs">{error}</p>
              </div>
            )}
          </>
        )}

        {/* Caption */}
        {block.caption && (
          <div className="px-4 py-1.5 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600">{block.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
