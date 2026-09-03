p = r'C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\ai\AIToolsTab.tsx'
with open(p,'rb') as f:
    data = f.read()

# Use stable markers around each chart's Bar block.
model_pre = b'                      )\n                    })()}\n                    <div className="h-56">\n                      <Bar\n                        data={{\n                          labels: periodDays.map((d) =>\n                            format(\n                              d,\n                              numDays <= 7 ? \'EEE\' : \'MMM dd\'\n                            )\n                          ),\n                          datasets,'
tool_pre = b'                      )\n                    })()}\n                    <div className="h-56">\n                      <Bar\n                        data={{\n                          labels: periodDays.map((d) =>\n                            format(\n                              d,\n                              numDays <= 7 ? \'EEE\' : \'MMM dd\'\n                            )\n                          ),\n                          datasets: toolDatasets,'

model_start = data.find(model_pre)
tool_start = data.find(tool_pre)
print('model_start', model_start, 'tool_start', tool_start)

# End marker: /> followed by </div>
model_end = data.find(b'/>\n                    </div>', data.find(b'/>', model_start)) + 2
tool_end = data.find(b'/>\n                    </div>', data.find(b'/>', tool_start)) + 2
print('model_end', model_end, 'tool_end', tool_end)

model_repl = b'                      <ReavizAreaTimeline\n                        series={datasets.map((ds, idx) => ({\n                          key: ds.label,\n                          data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\n                          color: ds.borderColor || ds.backgroundColor,\n                        }))}\n                        className="h-56"\n                        showLegend={false}\n                        xAxisTickFormatter={(_, idx) =>\n                          format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\n                        }\n                      />'
tool_repl = b'                      <ReavizAreaTimeline\n                        series={toolDatasets.map((ds) => ({\n                          key: ds.label,\n                          data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\n                          color: ds.borderColor || ds.backgroundColor,\n                        }))}\n                        className="h-56"\n                        showLegend={false}\n                        xAxisTickFormatter={(_, idx) =>\n                          format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\n                        }\n                      />'

for name, start, end, repl in [('model', model_start, model_end, model_repl), ('tool', tool_start, tool_end, tool_repl)]:
    if start == -1 or end == -1:
        print(name, 'BOUNDARIES NOT FOUND')
        continue
    # Replace from start of <Bar ... data={{ to just before </div>
    # We keep the surrounding <div className="h-56"> and </div>
    div_start = data.rfind(b'<div className="h-56">\n', 0, start) + len(b'<div className="h-56">\n')
    div_end = end + len(b'\n                    </div>')
    print(name, 'div_start', div_start, 'div_end', div_end, 'len', div_end-div_start)
    data = data[:div_start] + repl + data[div_end:]

with open(p,'wb') as f:
    f.write(data)
print('done')
