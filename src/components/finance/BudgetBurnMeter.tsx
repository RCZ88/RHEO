import { useEffect, useMemo, useState } from 'react';
import { Gauge, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type { BudgetStatus } from './finance-types';

/**
 * BudgetBurnMeter — NEW. Answers the one question a budget exists to answer:
 * "am I going to run out?"
 *
 * WHY IT IS NEW RATHER THAN PROMOTED: `budgetsGetStatus` already ships
 * `{ limit, spent, remaining, percentage, status }` per budget and
 * `FinancePage` already fetches it into state — and NOTHING on the Overview
 * rendered it. The data was loaded and thrown away. That is the opposite of
 * "needs a new chart": it needed a reader.
 *
 * THE MEANING: a burn meter is a FUEL GAUGE, not a bar chart — the question is
 * "how much is left", so the fill is the remaining headroom and the danger zone
 * is the part you have burned. `role="meter"` with aria-valuenow because the
 * whole number is carried by a filled rect, which is invisible to a screen
 * reader otherwise (Gate D).
 *
 * COLOUR: the threshold state is the ONLY colour here, and it pairs an icon +
 * a word with the hue so meaning is never colour-alone.
 */

type Status = 'ok' | 'warning' | 'over';

const STATUS_META: Record<Status, { label: string; icon: typeof Gauge }> = {
  ok: { label: 'On track', icon: CheckCircle2 },
  warning: { label: 'Close to limit', icon: AlertTriangle },
  over: { label: 'Over limit', icon: AlertTriangle },
};

/** Bar fill as a share of the LIMIT. Clamped so >100% can't overflow the track. */
function fillPct(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, (spent / limit) * 100));
}

interface BudgetBurnMeterProps {
  /** Pre-resolved from FinancePage state; the component does not fetch. */
  data: BudgetStatus | null;
  displayCurrency: string;
  baseCurrency: string;
  convertAmount: (amount: number, from: string, to: string) => number;
  loading?: boolean;
}

export function BudgetBurnMeter({ data, displayCurrency, baseCurrency, convertAmount }: BudgetBurnMeterProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();

  const fmt = (v: number) =>
    showNumbers
      ? formatCurrency(v, displayCurrency)
      : maskNumber(formatCurrency(v, displayCurrency), maskMode, maskFixedValue);

  /** Convert once, here, so no child has to remember to. */
  const rows = useMemo(() => {
    const list = data?.budgets ?? [];
    return list.map((b) => {
      const limit = convertAmount(b.limit, baseCurrency, displayCurrency);
      const spent = convertAmount(b.spent, baseCurrency, displayCurrency);
      const remaining = convertAmount(b.remaining, baseCurrency, displayCurrency);
      return {
        key: b.id,
        name: b.name,
        status: b.status as Status,
        limit,
        spent,
        remaining,
        pct: fillPct(spent, limit),
      };
    });
  }, [data, baseCurrency, displayCurrency, convertAmount]);

  const totals = useMemo(() => {
    const limit = convertAmount(data?.totalBudget ?? 0, baseCurrency, displayCurrency);
    const spent = convertAmount(data?.totalSpent ?? 0, baseCurrency, displayCurrency);
    return { limit, spent, remaining: limit - spent, pct: fillPct(spent, limit) };
  }, [data, baseCurrency, displayCurrency, convertAmount]);

  if (rows.length === 0) {
    return (
      <GlassSurface className="p-5 flex flex-col gap-3">
        <MeterHeader />
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <Gauge className="w-8 h-8 text-[var(--text-disabled)]" aria-hidden="true" />
          {/* Gate F: an empty state explains what WOULD be here, not "No data". */}
          <p className="fin-body max-w-[34ch]">
            Set a monthly limit and this becomes the gauge for how much of it is
            left — before you run out, not after.
          </p>
        </div>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface className="p-5 flex flex-col gap-4">
      <MeterHeader
        right={
          <div className="text-right">
            <p className="fin-eyebrow">Left</p>
            <p
              className={`fin-figure text-[20px] ${totals.remaining >= 0 ? 'fin-pos' : 'fin-neg'}`}
            >
              {fmt(totals.remaining)}
            </p>
          </div>
        }
      />

      {/* The headline gauge: total burn across every budget. */}
      <div
        role="meter"
        aria-valuenow={Math.round(totals.pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget burn: ${Math.round(totals.pct)} percent of total budget spent`}
        className="flex flex-col gap-2"
      >
        <div className="flex items-baseline justify-between">
          <span className="fin-label">Total burn</span>
          <span className="fin-figure text-[13px] fin-flat">
            {fmt(totals.spent)} <span className="fin-flat">/ {fmt(totals.limit)}</span>
          </span>
        </div>
        <div className="fin-track h-2 w-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-400 ease-out"
            style={{
              width: `${totals.pct}%`,
              background: totals.pct > 100 ? 'var(--danger)' : totals.pct > 80 ? 'var(--ws-accent-text)' : 'var(--success)',
            }}
          />
        </div>
      </div>

      <span className="fin-hairline" aria-hidden="true" />

      {/* Per-budget rows. `overflow-y-auto` + max-height is the PARTIAL state:
          a user with 20 budgets gets a scroll well, not a 4000px column. */}
      <ul className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1 -mr-1">
        {rows.map((r) => {
          const meta = STATUS_META[r.status] ?? STATUS_META.ok;
          const Icon = meta.icon;
          return (
            <li key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="fin-body-strong truncate">{r.name}</span>
                <span
                  className={`fin-figure text-[13px] shrink-0 ${r.remaining >= 0 ? 'fin-flat' : 'fin-neg'}`}
                >
                  {fmt(r.remaining)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="fin-track h-1.5 flex-1 overflow-hidden"
                  role="meter"
                  aria-valuenow={Math.round(r.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${r.name}: ${Math.round(r.pct)} percent of limit spent`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-400 ease-out"
                    style={{
                      width: `${r.pct}%`,
                      background: r.pct > 100 ? 'var(--danger)' : r.pct > 80 ? 'var(--ws-accent-text)' : 'var(--success)',
                    }}
                  />
                </div>
                {/* Icon + word, so state never rides on colour alone. */}
                <span
                  className={`fin-label flex items-center gap-1 shrink-0 ${r.status === 'over' ? 'fin-neg' : ''}`}
                >
                  <Icon className="w-3 h-3" aria-hidden="true" />
                  {meta.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </GlassSurface>
  );
}

function MeterHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Gauge className="w-3.5 h-3.5 text-[var(--page-accent)] shrink-0" aria-hidden="true" />
        <span className="fin-eyebrow truncate">Budget burn</span>
      </div>
      {right}
    </div>
  );
}
