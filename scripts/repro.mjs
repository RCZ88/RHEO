import { AreaChart, AreaSeries, Area, LinearXAxis, LinearXAxisTickSeries, LinearXAxisTickLabel, LinearYAxis, LinearYAxisTickSeries, GridlineSeries, Gridline } from 'reaviz';

const series = [
  { key: 'claude', data: [{ key: new Date('2026-08-25'), data: 10 }, { key: new Date('2026-08-26'), data: 20 }, { key: new Date('2026-08-27'), data: 15 }], color: '#8b5cf6' },
  { key: 'cursor', data: [{ key: new Date('2026-08-25'), data: 5 }, { key: new Date('2026-08-26'), data: 12 }, { key: new Date('2026-08-27'), data: 8 }], color: '#22d3ee' },
];

console.log('series ok');
const chart = new AreaChart(document.createElement('div'), {
  width: 800,
  height: 300,
  data: series,
  series: (
    <AreaSeries>
      <Area />
    </AreaSeries>
  ),
  xAxis: <LinearXAxis tickSeries={<LinearXAxisTickSeries label={(props) => <LinearXAxisTickLabel {...props} format={(d) => String(d)} />} />} />,
  yAxis: <LinearYAxis tickSeries={<LinearYAxisTickSeries label={(props) => <LinearYAxisTickLabel {...props} format={(v) => String(v)} />} />} />,
  gridlines: <GridlineSeries><Gridline /></GridlineSeries>,
});
console.log('chart ok');
