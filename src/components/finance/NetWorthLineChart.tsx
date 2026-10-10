import { useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { formatCurrency as fmtCurrency } from '../finance/currency-data';
import { chartTokens, chartAxis, chartTooltip, alpha, watchChartTokens } from './_fx/chartTokens';

/**
 * NetWorthLineChart — promoted to the dashboard as the hero chart.
 *
 * WHY IT IS THE HERO: net worth is the one figure that compounds, and the one
 * figure every other number on the page is downstream of. It was previously
 * reachable only by opening the separate Charts tab, above a 120x48 sparkline.
 *
 * WHAT CHANGED ON RE-SKIN
 *  - The old line colour was a FIFTH green — distinct from the page accent and
 *    from the success token — so this chart disagreed with the sticky header's
 *    own net-worth colour about what green means, one scroll apart on the same
 *    screen. It now resolves from the token bridge.
 *  - Tooltip/grid/tick hexes resolve from tokens via `_fx/chartTokens`, so this
 *    stops being one of the 21 finance files with zero light-mode coverage. It
 *    previously painted a near-black tooltip on a light surface.
 *  - Colours are read through the bridge rather than `var()` because canvas has
 *    no cascade; see the probe note at the top of chartTokens.ts.
 *
 * The line is coloured by SIGN: accent normally, danger when the series ends
 * negative. Colour means exactly one thing.
 */

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface NetWorthLineChartProps {
  data: { month: string; value: number }[];
  currency: string;
  /** px. The card owns the row height, so this stays explicit. */
  height?: number;
}

export function NetWorthLineChart({ data, currency, height = 240 }: NetWorthLineChartProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();

  // Re-read tokens when <html> flips theme, so light mode repaints correctly.
  useEffect(() => watchChartTokens(), []);
  const t = chartTokens();

  const formatValue = (val: number) => {
    const formatted = fmtCurrency(val, currency);
    return showNumbers ? formatted : maskNumber(formatted, maskMode, maskFixedValue);
  };

  const options = useMemo(() => {
    const axis = chartAxis(t, formatValue);
    return {
      responsive: true,
      maintainAspectRatio: false as const,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip(t),
          displayColors: false,
          callbacks: { label: (ctx: any) => formatValue(ctx.parsed.y) },
        },
      },
      scales: {
        x: {
          ...axis,
          ticks: { ...axis.ticks, maxRotation: 0, autoSkipPadding: 24 },
          grid: { display: false },
        },
        y: { ...axis, ticks: { ...axis.ticks, maxTicksLimit: 5 } },
      },
      elements: { line: { tension: 0.3 } },
    };
  }, [t, showNumbers, maskMode, maskFixedValue, currency]);

  const last = data.length ? data[data.length - 1].value : 0;
  const lineTone = last < 0 ? t.negative : t.accent;

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.month),
      datasets: [
        {
          label: 'Net worth',
          data: data.map((d) => d.value),
          borderColor: lineTone,
          // Alpha of the SAME hue for the fill: one token, depth from opacity.
          backgroundColor: alpha(lineTone, 0.12),
          borderWidth: 1.75,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: lineTone,
          pointHoverBorderColor: t.surface,
          pointHoverBorderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    }),
    [data, lineTone, t.surface],
  );

  return (
    <div style={{ height }} className="min-w-0">
      <Line data={chartData} options={options} />
    </div>
  );
}
