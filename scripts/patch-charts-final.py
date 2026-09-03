p = r'C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\ai\AIToolsTab.tsx'
with open(p,'r',encoding='utf-8',newline='') as f:
    data=f.read()

model_old = '''                    <div className="h-56">
                      <Bar
                        data={{
                          labels: periodDays.map((d) =>
                            format(
                              d,
                              numDays <= 7 ? 'EEE' : 'MMM dd'
                            )
                          ),
                          datasets,
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: 'rgba(20, 22, 30, 0.85)',
                              titleColor: '#FFFFFF',
                              bodyColor: '#8E95A5',
                              borderColor: 'rgba(255,255,255,0.12)',
                              borderWidth: 1,
                              cornerRadius: 10,
                              padding: { top: 12, bottom: 12, left: 16, right: 16 },
                              usePointStyle: true,
                              callbacks: {
                                label: (ctx) => {
                                  const val = ctx.parsed.y || 0
                                  if (aiChartMode === 'tokens') {
                                    const mode =
                                      tokenDisplayMode === 'input'
                                        ? ' input'
                                        : tokenDisplayMode === 'output'
                                          ? ' output'
                                          : ''
                                    return ` ${formatTokens(val)}${mode} tokens`
                                  }
                                  if (aiChartMode === 'cost')
                                    return ` ${formatCurrency(val)}`
                                  if (aiChartMode === 'messages')
                                    return ` ${val} messages`
                                  return ` ${val} sessions`
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                maxTicksLimit: numDays <= 7 ? 7 : 12,
                                font: { size: 10, weight: '500' as const },
                                maxRotation: 0,
                              },
                              grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                              border: { display: false },
                            },
                            y: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                font: { size: 10 },
                                callback: (v) => formatY(Number(v)),
                              },
                              grid: { color: 'rgba(39,39,42,0.5)', drawTicks: false },
                              border: { display: false },
                              beginAtZero: true,
                            },
                          },
                        }}
                      />
                    </div>'''

model_new = '''                    <div className="h-56">
                      <ReavizAreaTimeline
                        series={datasets.map((ds, idx) => ({
                          key: ds.label,
                          data: periodDays.map((d, i) => ({
                            key: d,
                            data: (ds.data[i] ?? 0),
                          })),
                          color: ds.borderColor || ds.backgroundColor || '#8b5cf6',
                        }))}
                        xAxisTickFormatter={(_, idx) =>
                          format(periodDays[idx], numDays <= 7 ? 'EEE' : 'MMM dd')
                        }
                        formatY={(v) => {
                          if (aiChartMode === 'tokens') return formatTokens(v)
                          if (aiChartMode === 'cost') return formatCurrency(v)
                          if (aiChartMode === 'messages') return String(v)
                          return String(v)
                        }}
                      />
                    </div>'''

tool_old = '''                    <div className="h-56">
                      <Bar
                        data={{
                          labels: periodDays.map((d) =>
                            format(
                              d,
                              numDays <= 7 ? 'EEE' : 'MMM dd'
                            )
                          ),
                          datasets: toolDatasets,
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: true,
                              position: 'bottom',
                              labels: {
                                color: '#71717a',
                                font: { size: 10 },
                                boxWidth: 12,
                                padding: 12,
                                usePointStyle: true,
                              },
                            },
                            tooltip: {
                              backgroundColor: 'rgba(20, 22, 30, 0.85)',
                              titleColor: '#FFFFFF',
                              bodyColor: '#8E95A5',
                              borderColor: 'rgba(255,255,255,0.12)',
                              borderWidth: 1,
                              cornerRadius: 10,
                              padding: {
                                top: 12,
                                bottom: 12,
                                left: 16,
                                right: 16,
                              },
                              usePointStyle: true,
                              callbacks: {
                                label: (ctx) => {
                                  const val = ctx.parsed.y || 0
                                  if (aiChartMode === 'tokens') {
                                    const mode =
                                      tokenDisplayMode === 'input'
                                        ? ' input'
                                        : tokenDisplayMode === 'output'
                                          ? ' output'
                                          : ''
                                    return ` ${formatTokens(
                                      val
                                    )}${mode} tokens`
                                  }
                                  if (aiChartMode === 'cost')
                                    return ` ${formatCurrency(val)}`
                                  if (aiChartMode === 'messages')
                                    return ` ${val} messages`
                                  return ` ${val} sessions`
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                maxTicksLimit: numDays <= 7 ? 7 : 12,
                                font: {
                                  size: 10,
                                  weight: '500' as const,
                                },
                                maxRotation: 0,
                              },
                              grid: { display: false },
                              border: { display: false },
                            },
                            y: {
                              stacked: true,
                              ticks: {
                                color: '#71717a',
                                font: { size: 10 },
                                padding: 8,
                                callback: (v) => {
                                  if (aiChartMode === 'tokens')
                                    return formatTokens(v as number)
                                  if (aiChartMode === 'cost')
                                    return `$${(v as number).toFixed(2)}`
                                  return String(v)
                                },
                              },
                              grid: {
                                color: 'rgba(39,39,42,0.5)',
                                drawTicks: false,
                              },
                              border: { display: false },
                              beginAtZero: true,
                            },
                          },
                          barPercentage: 0.82,
                          categoryPercentage: 0.85,
                        }}
                      />
                    </div>'''

tool_new = '''                    <div className="h-56">
                      <ReavizAreaTimeline
                        series={toolDatasets.map((ds) => ({
                          key: ds.label,
                          data: periodDays.map((d, i) => ({
                            key: d,
                            data: (ds.data[i] ?? 0),
                          })),
                          color: ds.borderColor || ds.backgroundColor || '#8b5cf6',
                        }))}
                        xAxisTickFormatter={(_, idx) =>
                          format(periodDays[idx], numDays <= 7 ? 'EEE' : 'MMM dd')
                        }
                        formatY={(v) => {
                          if (aiChartMode === 'tokens') return formatTokens(v)
                          if (aiChartMode === 'cost') return formatCurrency(v)
                          if (aiChartMode === 'messages') return String(v)
                          return String(v)
                        }}
                      />
                    </div>'''

if model_old not in data:
    raise SystemExit('MODEL_OLD not found')
if tool_old not in data:
    raise SystemExit('TOOL_OLD not found')
data = data.replace(model_old, model_new, 1)
data = data.replace(tool_old, tool_new, 1)
with open(p,'w',encoding='utf-8',newline='') as f:
    f.write(data)
print('patched', data.count('<ReavizAreaTimeline'), data.count('<Bar'))
