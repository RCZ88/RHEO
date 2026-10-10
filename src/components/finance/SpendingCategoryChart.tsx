import React, { useMemo } from "react";
import { ListOrdered } from "lucide-react";
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency as fmtCurrency } from "./currency-data";
import { useNumberMask } from "../../context/NumberMaskContext";
import { maskNumber } from "../../utils/maskNumber";

/**
 * TopSpendingBars — re-skin of the old doughnut (`SpendingCategoryChart`).
 *
 * WHY A BAR LIST AND NOT A DOUGHNUT: the question a spending breakdown exists to
 * answer is "which category is eating me", and that is a RANKING question. A
 * doughnut makes the reader compare arc lengths and angles to answer it — the
 * one comparison human vision is worst at — and it cannot show the 7th category
 * at all. A sorted horizontal bar set answers it by pre-sorting, and the length
 * is the one encoding the eye reads fastest. Same data, different question
 * answered.
 *
 * LAMINAR §5: the old file carried an eight-entry `PALETTE` of raw hexes —
 * violet/magenta/pink/rose/orange/amber — assigned by ARRAY INDEX, so the same
 * category got a different colour depending on how many categories existed.
 * That is a rainbow palette and a non-deterministic one, and it was the reason
 * the dashboard read as multicoloured noise. Categorical identity now comes from
 * the single source `src/lib/CategoryColors.ts`. Where a category has no
 * assigned colour it inherits the page accent, so a new category can never
 * invent a hue.
 *
 * The doughnut itself is not deleted from the module — `FinanceChartsTab` may
 * still want a share-of-total view — but it is no longer what the dashboard
 * leads with.
 */

interface SpendingByCategory { category?: string; categoryName?: string; amount: number; color?: string; }
interface Transaction { id: number; type: string; amount: number; on_behalf_of?: number; on_behalf_of_label?: string; description?: string; }
interface Props { data: SpendingByCategory[]; baseCurrency: string; displayCurrency: string; convertAmount: (amount: number, from: string, to: string) => number; allTransactions?: Transaction[]; }

/** Categories beyond this are folded into "Other" — the PARTIAL state. */
const TOP_N = 7;

export function TopSpendingBars({ data, baseCurrency, displayCurrency, convertAmount: convert, allTransactions = [] }: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) =>
    showNumbers ? fmtCurrency(v, displayCurrency) : maskNumber(fmtCurrency(v, displayCurrency), maskMode, maskFixedValue);

  const { rows, total } = useMemo(() => {
    const acc = new Map<string, number>();

    for (const item of data ?? []) {
      const name = item.categoryName || item.category || 'Uncategorized';
      acc.set(name, (acc.get(name) ?? 0) + convert(item.amount, baseCurrency, displayCurrency));
    }

    // Follow-through spend is money the user fronted for someone else, so it is
    // a DIFFERENT bucket from their own categories and must not merge into them.
    let ft = 0;
    for (const t of allTransactions) {
      if (t.type === 'expense' && t.on_behalf_of && t.on_behalf_of > 0) {
        ft += convert(Math.abs(t.amount), baseCurrency, displayCurrency);
      }
    }

    const sum = [...acc.values()].reduce((a, b) => a + b, 0) + ft;

    let list = [...acc.entries()].map(([name, amount]) => ({ name, amount, ft: false }));
    if (ft > 0) list.push({ name: 'Follow Through', amount: ft, ft: true });

    list.sort((a, b) => b.amount - a.amount);

    // Fold the tail so the card keeps a bounded height. "Other" keeps the sum
    // honest, so the bars still add up to the displayed total.
    if (list.length > TOP_N) {
      const head = list.slice(0, TOP_N - 1);
      const tail = list.slice(TOP_N - 1);
      head.push({ name: `Other (${tail.length})`, amount: tail.reduce((s, r) => s + r.amount, 0), ft: false });
      list = head;
    }

    return { rows: list.map((r) => ({ ...r, pct: sum > 0 ? (r.amount / sum) * 100 : 0 })), total: sum };
  }, [data, allTransactions, baseCurrency, displayCurrency, convert]);

  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);

  return (
    <GlassSurface className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListOrdered className="w-3.5 h-3.5 text-[var(--page-accent)] shrink-0" aria-hidden="true" />
          <span className="fin-eyebrow truncate">Top spend</span>
        </div>
        <span className="fin-figure text-[15px] fin-flat shrink-0">{fmtMoney(total)}</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <ListOrdered className="w-8 h-8 text-[var(--text-disabled)]" aria-hidden="true" />
          {/* Gate F: says what WOULD be here. */}
          <p className="fin-body max-w-[34ch]">
            Categories you spend through will rank here, biggest first — so you
            can see which one is actually moving.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <li key={r.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="fin-body-strong truncate">
                  <span className="fin-label mr-1.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {r.name}
                </span>
                <span className="shrink-0 flex items-baseline gap-2">
                  <span className="fin-figure text-[13px]">{fmtMoney(r.amount)}</span>
                  <span className="fin-label tabular-nums w-[42px] text-right">{r.pct.toFixed(0)}%</span>
                </span>
              </div>
              {/* Bar length is scaled to the LARGEST category, not the total, so
                  the top bar is always full width — otherwise a flat
                  distribution renders eight identical 12% stubs. */}
              <div
                className="fin-track h-1.5 overflow-hidden"
                role="img"
                aria-label={`${r.name}: ${fmtMoney(r.amount)}, ${r.pct.toFixed(1)} percent of spending`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-400 ease-out"
                  style={{
                    width: `${max > 0 ? (r.amount / max) * 100 : 0}%`,
                    // Follow-through wears the owed accent so it reads as
                    // "someone else's money", not as another category.
                    background: r.ft ? 'var(--ws-accent-text)' : 'var(--page-accent)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassSurface>
  );
}

export default TopSpendingBars;
