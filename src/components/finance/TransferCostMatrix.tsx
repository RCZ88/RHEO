// ============================================================================
// TransferCostMatrix.tsx
// src/components/finance/TransferCostMatrix.tsx
// ============================================================================
// Heatmap showing fees between every wallet pair + optimal routing.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, Zap, AlertCircle, Route } from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface MatrixCell {
  fromWalletId: number;
  fromWalletName: string;
  toWalletId: number;
  toWalletName: string;
  estimatedFee: number;
  historicalAvgFee: number;
  historicalAvgAmount: number;
  transferCount: number;
  efficiencyScore: number;
  feeType: string;
  feeValue: number;
}

interface OptimalRoute {
  from: string;
  to: string;
  path: string[];
  totalFee: number;
  efficiencyScore: number;
}

interface MatrixData {
  matrix: MatrixCell[];
  optimalRoutes: OptimalRoute[];
  walletCount: number;
}

export default function TransferCostMatrix() {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const [selectedTo, setSelectedTo] = useState<number | null>(null);

  const fmtMoney = (v: number) =>
    showNumbers ? formatCurrency(v) : maskNumber(formatCurrency(v), maskMode, maskFixedValue);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await (window as any).deskflowAPI?.financeGetTransferCostMatrix();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load transfer data');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getHeatColor = (score: number) => {
    // score 0-100, where 100 = best (low fee)
    if (score >= 90) return '#10b981'; // green
    if (score >= 70) return '#34d399';
    if (score >= 50) return '#fbbf24'; // yellow
    if (score >= 30) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getHeatBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-950/40';
    if (score >= 70) return 'bg-emerald-950/20';
    if (score >= 50) return 'bg-amber-950/20';
    if (score >= 30) return 'bg-orange-950/20';
    return 'bg-red-950/20';
  };

  // Build unique wallet list
  const wallets = useMemo(() => {
    if (!data) return [];
    const seen = new Set<number>();
    const list: { id: number; name: string }[] = [];
    for (const cell of data.matrix) {
      if (!seen.has(cell.fromWalletId)) {
        seen.add(cell.fromWalletId);
        list.push({ id: cell.fromWalletId, name: cell.fromWalletName });
      }
    }
    return list;
  }, [data]);

  // Build matrix lookup
  const matrixMap = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    if (!data) return map;
    for (const cell of data.matrix) {
      map.set(`${cell.fromWalletId}-${cell.toWalletId}`, cell);
    }
    return map;
  }, [data]);

  // Selected route details
  const selectedRoute = useMemo(() => {
    if (!selectedFrom || !selectedTo || !data) return null;
    return data.optimalRoutes.find(
      r => r.from === wallets.find(w => w.id === selectedFrom)?.name &&
           r.to === wallets.find(w => w.id === selectedTo)?.name
    );
  }, [selectedFrom, selectedTo, data, wallets]);

  if (loading) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800 animate-pulse">
        <div className="h-6 w-48 bg-zinc-800 rounded mb-4"></div>
        <div className="h-64 bg-zinc-800/50 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
        <div className="text-center py-8">
          <Route size={32} className="text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No transfer history yet</p>
          <p className="text-xs text-zinc-600 mt-1">Make your first transfer to see fee analysis</p>
        </div>
      </div>
    );
  }

  if (!data || wallets.length === 0) return null;

  return (
    <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Transfer Cost Matrix</h3>
        </div>
        <div className="text-xs text-zinc-500">{wallets.length} wallets</div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-zinc-500">
        <span>Fee efficiency:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }}></div>
          <span>Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#fbbf24' }}></div>
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Expensive</span>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto mb-4">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div className="w-24 flex-shrink-0"></div>
            {wallets.map((w) => (
              <div
                key={w.id}
                className={`w-20 flex-shrink-0 text-center py-2 text-[10px] font-medium truncate px-1 cursor-pointer transition-colors ${
                  selectedTo === w.id ? 'bg-violet-950/30 text-violet-300' : 'text-zinc-400'
                }`}
                onClick={() => setSelectedTo(selectedTo === w.id ? null : w.id)}
              >
                {w.name}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {wallets.map((fromW) => (
            <div key={fromW.id} className="flex">
              <div
                className={`w-24 flex-shrink-0 text-right py-2 pr-2 text-[10px] font-medium truncate cursor-pointer transition-colors ${
                  selectedFrom === fromW.id ? 'bg-violet-950/30 text-violet-300' : 'text-zinc-400'
                }`}
                onClick={() => setSelectedFrom(selectedFrom === fromW.id ? null : fromW.id)}
              >
                {fromW.name}
              </div>
              {wallets.map((toW) => {
                if (fromW.id === toW.id) {
                  return (
                    <div key={`${fromW.id}-${toW.id}`} className="w-20 flex-shrink-0 bg-zinc-950 light:bg-[var(--ws-surface)]/30 border border-zinc-800/30 rounded-sm m-0.5"></div>
                  );
                }
                const cell = matrixMap.get(`${fromW.id}-${toW.id}`);
                if (!cell) return null;

                const isSelected = selectedFrom === fromW.id && selectedTo === toW.id;
                const isHighlighted = selectedFrom === fromW.id || selectedTo === toW.id;

                return (
                  <div
                    key={`${fromW.id}-${toW.id}`}
                    className={`w-20 flex-shrink-0 h-10 rounded-sm m-0.5 flex items-center justify-center cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-zinc-900'
                        : isHighlighted
                          ? 'opacity-100'
                          : 'opacity-70 hover:opacity-100'
                    } ${getHeatBg(cell.efficiencyScore)}`}
                    style={{
                      borderLeft: `3px solid ${getHeatColor(cell.efficiencyScore)}`,
                    }}
                    onClick={() => {
                      setSelectedFrom(fromW.id);
                      setSelectedTo(toW.id);
                    }}
                    title={`${fromW.name} → ${toW.name}: ${fmtMoney(cell.estimatedFee)} fee (${cell.efficiencyScore.toFixed(0)}% efficient)`}
                  >
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-zinc-200">
                        {cell.estimatedFee > 0 ? fmtMoney(cell.estimatedFee) : 'Free'}
                      </div>
                      {cell.transferCount > 0 && (
                        <div className="text-[8px] text-zinc-500">{cell.transferCount} txs</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Route Details */}
      {selectedFrom && selectedTo && selectedRoute && (
        <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
          <div className="text-xs font-medium text-zinc-300 mb-2 flex items-center gap-1">
            <Route size={12} className="text-violet-400" />
            Optimal Route
          </div>
          <div className="flex items-center gap-2 text-sm">
            {selectedRoute.path.map((node, idx) => (
              <React.Fragment key={idx}>
                <span className="text-zinc-200 font-medium">{node}</span>
                {idx < selectedRoute.path.length - 1 && (
                  <ArrowRight size={14} className="text-zinc-600" />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="text-zinc-500">
              Fee: <span className="text-zinc-300 font-mono">{fmtMoney(selectedRoute.totalFee)}</span>
            </span>
            <span className="text-zinc-500">
              Efficiency: <span className="text-emerald-400 font-mono">{selectedRoute.efficiencyScore.toFixed(0)}%</span>
            </span>
          </div>
        </div>
      )}

      {/* Top Optimal Routes */}
      <div className="border-t border-zinc-800 pt-3 mt-3">
        <div className="text-xs font-medium text-zinc-400 mb-2">Top Efficient Routes</div>
        <div className="space-y-1.5">
          {data.optimalRoutes.slice(0, 5).map((route, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-zinc-800/30">
              <span className="text-zinc-400">
                {route.from} <ArrowRight size={10} className="inline text-zinc-600 mx-1" /> {route.to}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">{fmtMoney(route.totalFee)}</span>
                <span className={`font-mono ${route.efficiencyScore >= 70 ? 'text-emerald-400' : route.efficiencyScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {route.efficiencyScore.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
