'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  AreaSeries,
  Area,
  LinearXAxis,
  LinearXAxisTickSeries,
  LinearXAxisTickLabel,
  LinearYAxis,
  LinearYAxisTickSeries,
  GridlineSeries,
  Gridline,
} from 'reaviz';

export interface ReavizSeries {
  key: string;
  data: { key: Date; data: number }[];
  color: string;
}

export interface ReavizAreaTimelineProps {
  series: ReavizSeries[];
  width?: number;
  height?: number;
  className?: string;
  showLegend?: boolean;
  xAxisTickFormatter?: (value: Date, index: number) => string;
  yAxisTickFormatter?: (value: number) => string;
  valueFormatter?: (value: number | null) => string;
}

const ReavizAreaTimeline: React.FC<ReavizAreaTimelineProps> = ({
  series,
  width = 720,
  height = 260,
  className,
  showLegend = false,
  xAxisTickFormatter,
  yAxisTickFormatter,
  valueFormatter,
}) => {
  const nestedData = useMemo(() => {
    if (!series.length) return [];
    return series.map((s) => ({
      key: s.key,
      data: s.data.map((pt) => ({
        key: pt.key,
        data: Number(pt.data) || 0,
      })),
    }));
  }, [series]);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const s of series) {
      for (const pt of s.data) {
        const v = Number(pt.data) || 0;
        if (v > max) max = v;
      }
    }
    return max || 1;
  }, [series]);

  const xTickFormatter = useMemo(() => {
    if (xAxisTickFormatter) return xAxisTickFormatter;
    return (_value: Date, index: number) => `${index + 1}`;
  }, [xAxisTickFormatter]);

  const yTickFormatter = useMemo(() => {
    if (yAxisTickFormatter) return yAxisTickFormatter;
    return (v: number) => String(v);
  }, [yAxisTickFormatter]);

  const fmtValue = useMemo(() => {
    if (valueFormatter) return valueFormatter;
    return (v: number | null) => (v == null ? '—' : String(v));
  }, [valueFormatter]);

  if (!nestedData.length || !series.length) {
    return <div className={`text-zinc-600 text-[11px] ${className || ''}`}>No data available</div>;
  }

  return (
    <div className={className}>
      <AreaChart data={nestedData} width={width} height={height}>
        <GridlineSeries>
          <Gridline />
        </GridlineSeries>
        <LinearXAxis
          tickSeries={
            <LinearXAxisTickSeries
              tickSize={8}
              label={(props) => (
                <LinearXAxisTickLabel
                  {...props}
                  format={xTickFormatter}
                />
              )}
            />
          }
        />
        <LinearYAxis
          tickSeries={
            <LinearYAxisTickSeries
              tickSize={8}
              label={(props) => (
                <LinearYAxisTickLabel
                  {...props}
                  format={yTickFormatter}
                />
              )}
            />
          }
        />
        {series.map((s) => (
          <AreaSeries
            key={s.key}
            interpolation="smooth"
          >
            <Area color={s.color} />
          </AreaSeries>
        ))}
      </AreaChart>
      <div className="mt-2 text-[10px] text-zinc-500">
        {series.length} series · max {fmtValue(maxValue)}
      </div>
    </div>
  );
};

export default ReavizAreaTimeline;
