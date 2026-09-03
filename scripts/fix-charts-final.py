p = r'C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\ai\AIToolsTab.tsx'
with open(p,'rb') as f:
    data = f.read()

# Model chart replacement
model_start = data.find(b'Model Usage Timeline')
model_bar = data.find(b'<Bar', model_start)
model_end = data.find(b'/>', model_bar) + 2
print('model_bar', model_bar, 'model_end', model_end)

model_repl = b'                    <div className="h-56">\r\n                      <ReavizAreaTimeline\r\n                      series={datasets.map((ds, idx) => ({\r\n                        key: ds.label,\r\n                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n                        color: ds.borderColor || ds.backgroundColor,\r\n                      }))}\r\n                      className="h-56"\r\n                      showLegend={false}\r\n                      xAxisTickFormatter={(_, idx) =>\r\n                        format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\r\n                      }\r\n                    />\r\n                    </div>'
data = data[:model_bar] + model_repl + data[model_end:]

# Tool chart replacement
tool_start = data.find(b'Tool Usage Timeline')
tool_bar = data.find(b'<Bar', tool_start)
tool_end = data.find(b'/>', tool_bar) + 2
print('tool_bar', tool_bar, 'tool_end', tool_end)

tool_repl = b'                    <div className="h-56">\r\n                      <ReavizAreaTimeline\r\n                      series={toolDatasets.map((ds) => ({\r\n                        key: ds.label,\r\n                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n                        color: ds.borderColor || ds.backgroundColor,\r\n                      }))}\r\n                      className="h-56"\r\n                      showLegend={false}\r\n                      xAxisTickFormatter={(_, idx) =>\r\n                        format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\r\n                      }\r\n                    />\r\n                    </div>'
data = data[:tool_bar] + tool_repl + data[tool_end:]

with open(p, 'wb') as f:
    f.write(data)
print('done')
