from pathlib import Path
p = Path('src/services/ai/aiAgentService.ts')
text = p.read_text(encoding='utf-8')
old = "    apiKey: *** process !== 'undefined' && process.env?.OPENROUTER_API_KEY) || ''"
new = "    apiKey: (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY) || ''"
print('FOUND', old in text)
if old in text:
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('patched')
else:
    print('not found')
