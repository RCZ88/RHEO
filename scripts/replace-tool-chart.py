from pathlib import Path
p = str(Path(__file__).resolve().parent.parent / 'src' / 'components' / 'ai' / 'AIToolsTab.tsx')
with open(p,'r',encoding='utf-8',newline='') as f:
    text = f.read()
old = (
    '                    <div className="h-56">\r\n'
    '                      <Bar\r\n'
    '                        data={{\r\n'
    "                          labels: periodDays.map((d) =>\r\n"
    '                            format(\r\n'
    "                              d,\r\n"
    "                              numDays <= 7 ? 'EEE' : 'MMM dd'\r\n"
    '                            )\r\n'
    '                          ),\r\n'
    '                          datasets: toolDatasets,\r\n'
    '                        }}\r\n'
    '                        options={{\r\n'
    '                          responsive: true,\r\n'
    '                          maintainAspectRatio: false,\r\n'
    '                          plugins: {\r\n'
    '                            legend: {\r\n'
    '                              display: true,\r\n'
    "                              position: 'bottom',\r\n"
    '                              labels: {\r\n'
    "                                color: '#71717a',\r\n"
    '                                font: { size: 10 },\r\n'
    '                                boxWidth: 12,\r\n'
    '                                padding: 12,\r\n'
    '                                usePointStyle: true,\r\n'
    '                              },\r\n'
    '                            },\r\n'
    '                            tooltip: {\r\n'
    "                              backgroundColor: 'rgba(20, 22, 30, 0.85)',\r\n"
    "                              titleColor: '#FFFFFF',\r\n"
    "                              bodyColor: '#8E95A5',\r\n"
    "                              borderColor: 'rgba(255,255,255,0.12)',\r\n"
    '                              borderWidth: 1,\r\n'
    '                              cornerRadius: 10,\r\n'
    '                              padding: {\r\n'
    '                                top: 12,\r\n'
    '                                bottom: 12,\r\n'
    '                                left: 16,\r\n'
    '                                right: 16,\r\n'
    '                              },\r\n'
    '                              usePointStyle: true,\r\n'
    '                              callbacks: {\r\n'
    '                                label: (ctx) => {\r\n'
    '                                  const val = ctx.parsed.y || 0\r\n'
    "                                  if (aiChartMode === 'tokens') {\r\n"
    '                                    const mode =\r\n'
    "                                      tokenDisplayMode === 'input'\r\n"
    "                                        ? ' input'\r\n"
    "                                        : tokenDisplayMode === 'output'\r\n"
    "                                          ? ' output'\r\n"
    "                                          : ''\r\n"
    "                                    return ` ${formatTokens(val)}${mode} tokens`\r\n"
    '                                  }\r\n'
    "                                  if (aiChartMode === 'cost')\r\n"
    "                                    return ` ${formatCurrency(val)}`\r\n"
    "                                  if (aiChartMode === 'messages')\r\n"
    "                                    return ` ${val} messages`\r\n"
    "                                  return ` ${val} sessions`\r\n"
    '                                },\r\n'
    '                              },\r\n'
    '                            },\r\n'
    '                          },\r\n'
    '                          scales: {\r\n'
    '                            x: {\r\n'
    '                              stacked: true,\r\n'
    '                              ticks: {\r\n'
    "                                color: '#71717a',\r\n"
    '                                maxTicksLimit: numDays <= 7 ? 7 : 12,\r\n'
    '                                font: {\r\n'
    '                                  size: 10,\r\n'
    "                                  weight: '500' as const,\r\n"
    '                                },\r\n'
    '                                maxRotation: 0,\r\n'
    '                              },\r\n'
    "                              grid: { display: false },\r\n"
    "                              border: { display: false },\r\n"
    '                            },\r\n'
    '                            y: {\r\n'
    '                              stacked: true,\r\n'
    '                              ticks: {\r\n'
    "                                color: '#71717a',\r\n"
    '                                font: { size: 10 },\r\n'
    '                                padding: 8,\r\n'
    '                                callback: (v) => {\r\n'
    "                                  if (aiChartMode === 'tokens')\r\n"
    '                                    return formatTokens(v as number)\r\n'
    "                                  if (aiChartMode === 'cost')\r\n"
    "                                    return `$${(v as number).toFixed(2)}`\r\n"
    '                                  return String(v)\r\n'
    '                                },\r\n'
    '                              },\r\n'
    '                              grid: {\r\n'
    "                                color: 'rgba(39,39,42,0.5)',\r\n"
    '                                drawTicks: false,\r\n'
    '                              },\r\n'
    "                              border: { display: false },\r\n"
    '                              beginAtZero: true,\r\n'
    '                            },\r\n'
    '                          },\r\n'
    '                          barPercentage: 0.82,\r\n'
    '                          categoryPercentage: 0.85,\r\n'
    '                        }}\r\n'
    '                      />\r\n'
    '                    </div>'
)
new = (
    '                    <ReavizAreaTimeline\r\n'
    "                      series={toolDatasets.map((ds) => ({\r\n"
    '                        key: ds.label,\r\n'
    '                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n'
    '                        color: ds.borderColor || ds.backgroundColor,\r\n'
    '                      }))}\r\n'
    '                      className="h-56"\r\n'
    '                      showLegend={false}\r\n'
    '                      xAxisTickFormatter={(_, idx) =>\r\n'
    "                        format(periodDays[idx], numDays <= 7 ? 'EEE' : 'MMM dd')\r\n"
    '                      }\r\n'
    '                    />'
)
print('COUNT', text.count(old))
if old in text:
    text = text.replace(old, new, 1)
    with open(p,'w',encoding='utf-8',newline='') as f:
        f.write(text)
    print('REPLACED_TOOL')
else:
    print('NOT_FOUND_TOOL')
