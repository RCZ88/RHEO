p = r'C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\src\components\ai\AIToolsTab.tsx'
with open(p,'rb') as f:
    data = f.read()

# Find the Tool Usage Timeline Bar block more precisely
tool_marker = b'Tool Usage Timeline'
model_marker = b'Multi-Agent Comparison Chart'

tool_pos = data.find(tool_marker)
model_pos = data.find(model_marker)

print('tool_pos', tool_pos, 'model_pos', model_pos)

# The Tool chart Bar block starts after tool_pos and ends before model_pos
# Find the <Bar that appears after tool_pos
bar_pos = data.find(b'<Bar', tool_pos)
print('bar_pos', bar_pos)

# Find the closing </div> followed by </GlassCard> followed by })()}
# that appears before model_pos
end_search_start = bar_pos
end_marker = b'</div>\r\n                  </GlassCard>\r\n                )\r\n              })()}\r\n'
end_pos = data.find(end_marker, end_search_start)
print('end_pos', end_pos)
if end_pos == -1:
    # try without trailing newline
    end_marker2 = b'</div>\n                  </GlassCard>\n                )\n              })()}\n'
    end_pos = data.find(end_marker2, end_search_start)
    print('end_pos2', end_pos)

if bar_pos != -1 and end_pos != -1:
    replacement = (
        b'                    <ReavizAreaTimeline\r\n'
        b"                      series={toolDatasets.map((ds) => ({\r\n"
        b'                        key: ds.label,\r\n'
        b'                        data: ds.data.map((v, i) => ({ key: periodDays[i], data: v })),\r\n'
        b'                        color: ds.borderColor || ds.backgroundColor,\r\n'
        b'                      }))}\r\n'
        b'                      className="h-56"\r\n'
        b'                      showLegend={false}\r\n'
        b'                      xAxisTickFormatter={(_, idx) =>\r\n'
        b"                        format(periodDays[idx], numDays <= 7 ? 'EEE' : 'MMM dd')\r\n"
        b'                      }\r\n'
        b'                    />\r\n'
        b'                    </div>\r\n'
        b'                  </GlassCard>\r\n'
        b'                )\r\n'
        b'              })()}\r\n'
    )
    new_data = data[:bar_pos] + replacement + data[end_pos:]
    with open(p, 'wb') as f:
        f.write(new_data)
    print('FIXED_TOOL_CHART')
else:
    print('FAILED_TO_FIND_BOUNDARIES')
