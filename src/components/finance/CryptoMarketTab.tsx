import { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { TabHeader } from './_fx/TabHeader';
import { EmptyState } from './EmptyState';
import { formatCurrency as fmtCurrency, formatAmount as fmtAmount, formatPercent as fmtPct } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type { FinanceWallet, CryptoPrice } from './finance-types';

interface CryptoMarketTabProps {
  wallets: FinanceWallet[];
  displayCurrency: string;
  loading: boolean;
  onWalletClick: (id: number) => void;
}

const walletMeta: Record<string, { icon: any; label: string; color: string }> = {
  crypto: { icon: Wallet, label: 'Crypto', color: '#8B5CF6' },
};

export function CryptoMarketTab({ wallets, displayCurrency, loading, onWalletClick }: CryptoMarketTabProps) {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number, cur?: string) => {
    const s = fmtCurrency(v, cur ?? displayCurrency);
    return showNumbers ? s : maskNumber(s, maskMode, maskFixedValue);
  };

  function parseMeta(raw: any): Record<string, any> {
    if (raw && typeof raw === 'object') return raw;
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }

  const allAssets = useMemo(() => {
    const map = new Map<string, {
      coin_id: string; symbol: string; amount: number; avgCost: number;
      walletIds: number[]; walletNames: string[];
    }>();
    wallets.forEach(w => {
      try {
        const meta = parseMeta(w.metadata);
        const assets = Array.isArray(meta.assets) ? meta.assets : (meta.coin_id ? [meta] : []);
        assets.forEach((a: any) => {
          const cid = a.coin_id || a.asset || '';
          if (!cid) return;
          const sym = (a.symbol || a.asset || '').toUpperCase();
          const amt = Number(a.amount) || 0;
          const abp = Number(a.avg_buy_price || a.avgBuyPrice) || 0;
          const existing = map.get(cid);
          if (existing) {
            existing.amount += amt;
            existing.avgCost += abp * amt;
            if (!existing.walletIds.includes(w.id)) {
              existing.walletIds.push(w.id);
              existing.walletNames.push(w.name);
            }
          } else {
            map.set(cid, { coin_id: cid, symbol: sym, amount: amt, avgCost: abp * amt, walletIds: [w.id], walletNames: [w.name] });
          }
        });
      } catch { /* ignore */ }
    });
    return Array.from(map.values()).map(a => ({
      ...a,
      avgCost: a.amount > 0 ? a.avgCost : 0,
    }));
  }, [wallets]);

  const coinIds = allAssets.map(a => a.coin_id).filter(Boolean);
  const hasAssets = allAssets.length > 0;

  const fetchAllPrices = useCallback(async () => {
    if (coinIds.length === 0) { setPrices([]); return; }
    setLoadingPrices(true); setError(null);
    try {
      const r = await (window as any).deskflowAPI?.financeFetchCryptoPrices(coinIds, displayCurrency) as CryptoPrice[];
      if (r) setPrices(r);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoadingPrices(false); }
  }, [JSON.stringify(coinIds), displayCurrency]);

  useEffect(() => { fetchAllPrices(); }, [fetchAllPrices]);

  const priceMap = new Map(prices.map(p => [p.coin_id, p]));

  const totalValue = useMemo(() => {
    return allAssets.reduce((sum, a) => {
      const p = priceMap.get(a.coin_id);
      return sum + a.amount * (p?.current_price || 0);
    }, 0);
  }, [allAssets, priceMap]);

  const totalCost = useMemo(() => {
    return allAssets.reduce((sum, a) => sum + a.avgCost, 0);
  }, [allAssets]);

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const walletsWithoutAssets = wallets.filter(w => {
    try {
      const meta = parseMeta(w.metadata);
      if (Array.isArray(meta.assets) && meta.assets.length > 0) return false;
      if (meta.coin_id) return false;
      return true;
    } catch { return true; }
  });

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-16" />
        ))}
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="p-5">
        <TabHeader
          title="Your Crypto Portfolio"
          icon={<Wallet className="w-4 h-4" />}
          action={null}
        />
        <EmptyState
          icon={<Wallet className="w-12 h-12" />}
          title="No crypto wallets yet"
          description="Create a crypto wallet, then add the coins you own to track live prices."
        />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <TabHeader
        title="Your Crypto Portfolio"
        icon={<Wallet className="w-4 h-4" />}
        action={
          <button
            onClick={fetchAllPrices}
            disabled={loadingPrices}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? 'animate-spin' : ''}`} />
            Refresh Prices
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Could not load prices: {error}</span>
          <button onClick={fetchAllPrices} className="ml-auto text-[10px] underline hover:no-underline">Retry</button>
        </div>
      )}

      {hasAssets && (
        <>
          {/* Total Portfolio Value Card */}
          <GlassSurface tier={2} className="p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Total Portfolio Value</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-2xl font-bold text-white tabular-nums">
                {prices.length > 0 ? fmtMoney(totalValue, displayCurrency) : '\u2014'}
              </div>
              {prices.length > 0 && totalCost > 0 && (
                <span className={`text-xs font-medium tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtMoney(totalPnl, displayCurrency)} ({fmtPct(totalPnlPct, 1)}%)
                </span>
              )}
            </div>
            <div className="fin-label mt-1.5">
              Cost basis: {fmtMoney(totalCost, displayCurrency)}
            </div>
          </GlassSurface>

          {/* Coin List */}
          <div className="grid grid-cols-1 gap-2">
            {allAssets.map(a => {
              const p = priceMap.get(a.coin_id);
              const currentPrice = p?.current_price ?? 0;
              const pc24h = p?.price_change_percentage_24h ?? null;
              const coinName = p?.name || a.symbol || a.coin_id;
              const coinSym = p?.symbol?.toUpperCase() || a.symbol || '';
              const value = a.amount * currentPrice;
              const coinPnl = value - a.avgCost;
              const coinPnlPct = a.avgCost > 0 ? (coinPnl / a.avgCost) * 100 : 0;
              const isExpanded = expandedCoin === a.coin_id;

              return (
                <GlassSurface
                  key={a.coin_id}
                  interactive
                  onClick={() => a.walletIds.length === 1 ? onWalletClick(a.walletIds[0]) : undefined}
                  className="p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-[#8B5CF6]">{coinSym ? coinSym.slice(0, 2) : '?'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{coinName}</span>
                          {coinSym && <span className="fin-label">{coinSym}</span>}
                        </div>
                        <div className="fin-label truncate">
                          {a.walletNames.length === 1 ? a.walletNames[0] : `${a.walletNames.length} wallets`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs font-semibold text-white tabular-nums">
                        {fmtMoney(value, displayCurrency)}
                      </div>
                      {pc24h !== null && (
                        <div className={`flex items-center gap-0.5 justify-end text-[10px] tabular-nums mt-0.5 ${pc24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pc24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmtPct(pc24h, 2)}%
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedCoin(isExpanded ? null : a.coin_id); }}
                      className="ml-2 p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Bottom row: holding + P&L */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span className="fin-label">
                      {fmtAmount(a.amount)} {coinSym || 'coins'}
                    </span>
                    {a.avgCost > 0 && (
                      <span className={`text-[10px] tabular-nums font-medium ${coinPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtMoney(coinPnl, displayCurrency)} ({fmtPct(coinPnlPct, 1)}%)
                      </span>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Current Price</span>
                        <span className="text-zinc-200 tabular-nums">{fmtMoney(currentPrice, displayCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Amount Held</span>
                        <span className="text-zinc-200 tabular-nums">{fmtAmount(a.amount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Avg Buy Price</span>
                        <span className="text-zinc-200 tabular-nums">{a.avgCost > 0 ? fmtMoney(a.avgCost / a.amount, displayCurrency) : '\u2014'}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Cost Basis</span>
                        <span className="text-zinc-200 tabular-nums">{fmtMoney(a.avgCost, displayCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">P&amp;L</span>
                        <span className={`tabular-nums font-medium ${coinPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {coinPnl >= 0 ? '+' : ''}{fmtMoney(coinPnl, displayCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Return</span>
                        <span className={`tabular-nums font-medium ${coinPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtPct(coinPnlPct, 1)}%
                        </span>
                      </div>
                      {a.walletIds.length > 1 && (
                        <div className="pt-1.5 border-t border-white/5">
                          <span className="fin-label">Across {a.walletIds.length} wallets</span>
                        </div>
                      )}
                    </div>
                  )}
                </GlassSurface>
              );
            })}
          </div>
        </>
      )}

      {!hasAssets && walletsWithoutAssets.length > 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7 text-[#8B5CF6]" />
          </div>
          <p className="text-sm text-zinc-300 font-medium">No coins added yet</p>
          <p className="fin-label mt-1 max-w-[260px] leading-relaxed">
            Open a crypto wallet and add the coins you own to see live prices and portfolio value.
          </p>
        </div>
      )}

      {walletsWithoutAssets.length > 0 && hasAssets && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600 px-1">Wallets with no coins added</div>
          {walletsWithoutAssets.map(w => (
            <GlassSurface
              key={w.id}
              interactive
              onClick={() => onWalletClick(w.id)}
              className="p-3 flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-md bg-zinc-800/50 flex items-center justify-center shrink-0">
                <Wallet className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-400 truncate">{w.name}</div>
                <div className="fin-label">Tap to add coins</div>
              </div>
              <div className="fin-label tabular-nums">{fmtMoney(w.balance, displayCurrency)}</div>
            </GlassSurface>
          ))}
        </div>
      )}

      {!loadingPrices && hasAssets && coinIds.length > 0 && prices.length === 0 && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-zinc-600" />
            <p className="text-xs text-zinc-600">Click Refresh to load prices</p>
          </div>
        </div>
      )}
    </div>
  );
}
