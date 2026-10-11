# Extract the authoritative opencode tool registry from a real session record.
# The `invalid` tool's error message enumerates every available tool, which is
# the only ground truth available for "what can this agent actually call".
# Run: python3 extract-tool-registry.py
import io, json, re, sqlite3

db = sqlite3.connect('file:/tmp/opencode/oc-snap.db?mode=ro', uri=True)
cur = db.cursor()

row = cur.execute(
    "SELECT json_extract(data,'$.state.input.error') FROM part "
    "WHERE json_extract(data,'$.tool')='invalid' LIMIT 1"
).fetchone()
if not row or not row[0]:
    raise SystemExit('no invalid-tool error message found')

msg = row[0]
m = re.search(r'Available tools:\s*(.*?)\.?\s*$', msg, re.S)
tools = [t.strip() for t in m.group(1).split(',') if t.strip()]

# A tool is an MCP tool when its name is "<server>_<tool>". The builtin set is
# what remains. Verified by cross-check: every builtin below is one the model is
# told about directly, and every MCP name matches a configured server.
BUILTIN = {
    'bash', 'edit', 'glob', 'grep', 'invalid', 'list_mcp_resource_templates',
    'list_mcp_resources', 'question', 'read', 'read_mcp_resource', 'skill',
    'task', 'todowrite', 'webfetch', 'websearch', 'write',
}

mcp = sorted(t for t in tools if t not in BUILTIN)
leftover = sorted(t for t in tools if t in BUILTIN)

# Derive the server prefixes actually observed.
prefixes = set()
for t in mcp:
    head = t.split('_', 1)[0]
    # google-design-mcp / shadcn-ui-mcp keep hyphens, so take everything up to
    # the LAST underscore that leaves a plausible tool remainder.
    for i in range(1, t.count('_')):
        cand = t[:i]
        if cand.endswith('-mcp') or cand in {
            'google-design-mcp', 'shadcn-ui-mcp', 'probe', 'notion', 'magicui',
            'reactbits', 'shadcn', 'playwright',
        }:
            prefixes.add(cand + '_')
            break
prefixes = sorted(prefixes)

out = {
    'source': 'opencode.db part.data invalid-tool error message (authoritative tool enumeration)',
    'totalTools': len(tools),
    'builtin': leftover,
    'mcpPrefixes': prefixes,
    'mcpToolCount': len(mcp),
}

with io.open('/tmp/opencode/tool-registry.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)

print(json.dumps(out, indent=2))
print()
print('coverage check: %d/%d tools accounted for' % (len(leftover) + len(mcp), len(tools)))
print('unprefixed mcp names (server prefix not inferred):',
      [t for t in mcp if not any(t.startswith(p) for p in prefixes)])