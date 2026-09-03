p = r'C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\ai\AIToolsTab.tsx'
with open(p,'rb') as f:
    data = f.read()
model_start = data.find(b'Model Usage Timeline')
tool_start = data.find(b'Tool Usage Timeline')
print('model_start', model_start, 'tool_start', tool_start)
model_bar = data.find(b'<Bar', model_start)
tool_bar = data.find(b'<Bar', tool_start)
print('model_bar', model_bar, 'tool_bar', tool_bar)

model_replacement = b'                    <ReavizAreaTimeline\r\n                      series={datasets.map((ds, idx) => ({\r\n                        key: ds.label,\r\n                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n                        color: ds.borderColor || ds.backgroundColor,\r\n                      }))}\r\n                      className="h-56"\r\n                      showLegend={false}\r\n                      xAxisTickFormatter={(_, idx) =>\r\n                        format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\r\n                      }\r\n                    />'
tool_replacement = b'                    <ReavizAreaTimeline\r\n                      series={toolDatasets.map((ds) => ({\r\n                        key: ds.label,\r\n                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n                        color: ds.borderColor || ds.backgroundColor,\r\n                      }))}\r\n                      className="h-56"\r\n                      showLegend={false}\r\n                      xAxisTickFormatter={(_, idx) =>\r\n                        format(periodDays[idx], numDays <= 7 ? \'EEE\' : \'MMM dd\')\r\n                      }\r\n                    />'

for name, start, repl in [('model', model_bar, model_replacement), ('tool', tool_bar, tool_replacement)]:
    if start == -1:
        print(name, 'BAR NOT FOUND')
        continue
    end = data.find(b'/>', start) + 2
    print(name, 'replace from', start, 'to', end, 'len', end-start)
    data = data[:start] + repl + data[end:]
with open(p,'wb') as f:
    f.write(data)
print('done')
