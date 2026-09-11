# AI Coding Agent Data Storage Investigation

## Storage Location Map - Quick Reference

| Agent | Primary Location | Format | Local Chat History | Token Data |
|-------|-----------------|--------|-------------------|------------|
| Claude Code | `~/.claude/` | JSONL | ✅ Yes | ✅ Yes |
| Cursor | `%APPDATA%/Cursor/` | SQLite/JSON | ✅ Yes | ✅ Yes |
| OpenCode | `~/.local/share/opencode/` | SQLite | ✅ Yes | ✅ Yes |
| Gemini CLI | `~/.gemini/` | JSON/JSONL | ✅ Yes | ✅ Yes |
| Codex CLI | `~/.codex/` | JSON | ✅ Yes | ✅ Yes |
| Qwen CLI | `~/.qwen/` | JSON | ✅ Yes | ✅ Yes |
| Aider | `~/.aider/` | YAML/JSON | ✅ Yes | ✅ Yes |
| Windsurf | `%APPDATA%/Windsurf/` | SQLite/JSON | ✅ Yes | ✅ Yes |
| GitHub Copilot | Varies by IDE | Limited | ❌ Mostly Cloud | Limited |

---

## Claude Code (Anthropic)

### Storage Location
- **Primary data directory:** `~/.claude/`
- **Project-specific:** `~/.claude/projects/<project-hash>/`
- **Environment variables:** `CLAUDE_CONFIG_DIR` (optional override)
- **Common paths:**
  - macOS/Linux: `~/.claude/`
  - Windows: `%USERPROFILE%\.claude\`

### File Structure
```
~/.claude/
├── projects/
│   └── <project-hash>/
│       ├── chat-history.jsonl
│       ├── session-*.jsonl
│       └── context.json
├── config.json
├── statsig_user_metadata.json
└── .credentials/
```

### Chat Sessions
- **File(s):** `chat-history.jsonl`, `session-*.jsonl`
- **Format:** JSONL (JSON Lines) - one JSON object per line
- **Sample structure:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "role": "user",
  "content": "Explain this function",
  "sessionId": "abc123",
  "projectId": "project-hash"
}
{
  "timestamp": "2024-01-15T10:30:05Z",
  "role": "assistant", 
  "content": "This function...",
  "model": "claude-3-opus",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 200
  }
}
```

### Token/Usage Data
- **Files:** Embedded in chat JSONL files
- **Fields available:**
  - `input_tokens`
  - `output_tokens`
  - `model` (e.g., `claude-3-5-sonnet`, `claude-3-opus`)
- **Cost calculation:**
```python
# Approximate pricing (check current rates)
INPUT_COST = {"claude-3-opus": 0.015, "claude-3-5-sonnet": 0.003}
OUTPUT_COST = {"claude-3-opus": 0.075, "claude-3-5-sonnet": 0.015}

def calculate_cost(input_tokens, output_tokens, model):
    return (input_tokens * INPUT_COST[model] + 
            output_tokens * OUTPUT_COST[model]) / 1000
```

### Access Notes
- Standard file read permissions
- No encryption on chat files
- Credentials stored separately in `.credentials/`

### Parsing Example
```bash
# Read all chat history
cat ~/.claude/projects/*/chat-history.jsonl | jq -r '.content'

# Extract token usage
cat ~/.claude/projects/*/chat-history.jsonl | jq -s '[.[] | select(.usage != null) | .usage]'
```

---

## Cursor

### Storage Location
- **Primary data directory:**
  - Windows: `%APPDATA%\Cursor\`
  - macOS: `~/Library/Application Support/Cursor/`
  - Linux: `~/.config/Cursor/`
- **Environment variables:** None standard

### File Structure
```
Cursor/
├── User/
│   ├── globalStorage/
│   │   └── storage.json
│   └── workspaceStorage/
│       └── <workspace-id>/
│           └── chat.db
├── logs/
├── CachedData/
└── MachineId
```

### Chat Sessions
- **Primary file:** `chat.db` (SQLite) in workspaceStorage
- **Also:** `globalStorage/storage.json` for some settings
- **SQLite Schema (approximate):**
```sql
-- Tables typically found:
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    role TEXT,
    content TEXT,
    tokens_used INTEGER,
    created_at DATETIME
);
```

### Token/Usage Data
- **Location:** In `messages` table or separate `usage` table
- **Fields:**
  - `tokens_used`
  - `model`
  - `cost` (sometimes)

### Access Notes
- SQLite database requires standard read permissions
- May be locked while Cursor is running
- Use SQLite browser or command-line tool

### Parsing Example
```bash
# Query chat database
sqlite3 ~/Library/Application\ Support/Cursor/User/workspaceStorage/*/chat.db \
  "SELECT * FROM messages ORDER BY created_at DESC LIMIT 10"

# List all conversations
sqlite3 ~/Library/Application\ Support/Cursor/User/workspaceStorage/*/chat.db \
  "SELECT id, title, created_at FROM conversations"
```

---

## OpenCode

### Storage Location
- **Primary data directory:** `~/.local/share/opencode/`
- **Config directory:** `~/.config/opencode/`
- **Environment variables:** `OPENCODE_DATA_DIR`

### File Structure
```
~/.local/share/opencode/
├── opencode.db
├── sessions/
│   └── session-*.json
├── cache/
└── logs/

~/.config/opencode/
└── config.toml
```

### Chat Sessions
- **Primary file:** `opencode.db` (SQLite)
- **Session files:** `sessions/session-*.json`
- **SQLite Tables:**
```sql
.tables
-- sessions, messages, usage_stats, cache_entries

.schema messages
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    session_id INTEGER,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tokens_in INTEGER,
    tokens_out INTEGER,
    model TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Token/Usage Data
- **Table:** `usage_stats`
- **Fields:**
  - `session_id`
  - `total_input_tokens`
  - `total_output_tokens`
  - `model`
  - `cost_usd`
  - `timestamp`

### Access Notes
- Standard SQLite access
- Config in TOML format
- No encryption

### Parsing Example
```bash
# Get total usage by model
sqlite3 ~/.local/share/opencode/opencode.db \
  "SELECT model, SUM(total_input_tokens), SUM(total_output_tokens) 
   FROM usage_stats GROUP BY model"

# Export all messages to JSON
sqlite3 ~/.local/share/opencode/opencode.db \
  "SELECT json_object('role', role, 'content', content, 'timestamp', timestamp) 
   FROM messages"
```

---

## Gemini CLI (Google)

### Storage Location
- **Primary data directory:** `~/.gemini/`
- **Environment variables:** `GEMINI_CONFIG_DIR`

### File Structure
```
~/.gemini/
├── history/
│   ├── session-<id>.jsonl
│   └── all-history.jsonl
├── config.json
├── cache/
└── credentials.json
```

### Chat Sessions
- **Files:** `history/session-*.jsonl`, `history/all-history.jsonl`
- **Format:** JSONL
- **Sample structure:**
```json
{"timestamp": "2024-01-15T10:00:00Z", "role": "user", "content": "Help me debug this"}
{"timestamp": "2024-01-15T10:00:05Z", "role": "assistant", "content": "I can help...", "usage": {"input_tokens": 50, "output_tokens": 100, "model": "gemini-pro"}}
```

### Token/Usage Data
- **Embedded in JSONL files** under `usage` key
- **Fields:**
  - `input_tokens`
  - `output_tokens`
  - `model` (e.g., `gemini-pro`, `gemini-1.5-pro`)
  - `cached_tokens` (sometimes)

### Access Notes
- Standard file permissions
- Credentials in separate file (keep secure)

### Parsing Example
```bash
# View recent history
tail -n 20 ~/.gemini/history/all-history.jsonl | jq .

# Calculate total tokens
cat ~/.gemini/history/all-history.jsonl | \
  jq -s '[.[] | select(.usage != null) | .usage] | 
  {total_input: map(.input_tokens) | add, 
   total_output: map(.output_tokens) | add}'
```

---

## Codex CLI (OpenAI)

### Storage Location
- **Primary data directory:** `~/.codex/`
- **Environment variables:** `CODEX_HOME`, `OPENAI_CONFIG_DIR`

### File Structure
```
~/.codex/
├── sessions/
│   ├── <session-id>/
│   │   ├── messages.json
│   │   └── usage.json
│   └── index.json
├── config.json
├── cache/
└── .api_key
```

### Chat Sessions
- **Files:** `sessions/<id>/messages.json`
- **Index:** `sessions/index.json` (session metadata)
- **Format:** JSON
- **Sample messages.json:**
```json
{
  "session_id": "sess_abc123",
  "messages": [
    {"role": "user", "content": "Write a function", "timestamp": "..."},
    {"role": "assistant", "content": "Here's...", "timestamp": "..."}
  ],
  "model": "gpt-4",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Token/Usage Data
- **File:** `sessions/<id>/usage.json`
- **Fields:**
```json
{
  "session_id": "sess_abc123",
  "total_input_tokens": 5000,
  "total_output_tokens": 3000,
  "model": "gpt-4",
  "estimated_cost_usd": 0.45,
  "requests_count": 12
}
```

### Access Notes
- Standard JSON file access
- API key stored in `.api_key` (protect this)

### Parsing Example
```bash
# List all sessions
cat ~/.codex/sessions/index.json | jq '.[] | {id, created_at, model}'

# Get usage for specific session
cat ~/.codex/sessions/*/usage.json | jq -s '[.[] | {session_id, total_input_tokens, total_output_tokens, estimated_cost_usd}]'

# Aggregate all usage
cat ~/.codex/sessions/*/usage.json | jq -s '
  {total_cost: map(.estimated_cost_usd) | add,
   total_input: map(.total_input_tokens) | add,
   total_output: map(.total_output_tokens) | add}'
```

---

## Qwen CLI (Alibaba)

### Storage Location
- **Primary data directory:** `~/.qwen/`
- **Project data:** `~/.qwen/projects/<project-name>/`
- **Environment variables:** `QWEN_HOME`

### File Structure
```
~/.qwen/
├── projects/
│   └── <project-name>/
│       ├── conversations.json
│       ├── usage.json
│       └── context.json
├── config.yaml
└── cache/
```

### Chat Sessions
- **File:** `projects/<name>/conversations.json`
- **Format:** JSON array
- **Sample:**
```json
[
  {
    "id": "conv_123",
    "messages": [
      {"role": "user", "content": "...", "timestamp": "..."},
      {"role": "assistant", "content": "...", "model": "qwen-72b-chat"}
    ],
    "created_at": "2024-01-15T10:00:00Z"
  }
]
```

### Token/Usage Data
- **File:** `projects/<name>/usage.json`
- **Fields:**
```json
{
  "total_input_tokens": 10000,
  "total_output_tokens": 5000,
  "by_model": {
    "qwen-72b-chat": {"input": 8000, "output": 4000},
    "qwen-7b-chat": {"input": 2000, "output": 1000}
  },
  "session_count": 15
}
```

### Access Notes
- Standard file permissions
- Config in YAML format

### Parsing Example
```bash
# Read conversations
cat ~/.qwen/projects/*/conversations.json | jq '.[].messages'

# Get usage summary
cat ~/.qwen/projects/*/usage.json | jq .
```

---

## Aider

### Storage Location
- **Primary data directory:** `~/.aider/`
- **Also:** `~/.obo/` (older versions)
- **Environment variables:** `AIDER_HOME`

### File Structure
```
~/.aider/
├── aider-history.json
├── analytics.json
├── cache/
├── models.json
└── .aider.conf.yml

# Per-project in working directory:
./.aider.chat.history.md
./.aider.input.history
```

### Chat Sessions
- **Global:** `aider-history.json`
- **Per-project:** `.aider.chat.history.md` (in project root)
- **Format:** JSON (global), Markdown (project)
- **Sample aider-history.json:**
```json
{
  "sessions": [
    {
      "id": "sess_123",
      "project": "/path/to/project",
      "messages": [
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "...", "model": "gpt-4"}
      ],
      "tokens": {"input": 1000, "output": 500},
      "cost": 0.05,
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Token/Usage Data
- **File:** `analytics.json`
- **Fields:**
```json
{
  "total_cost": 15.50,
  "total_tokens": {
    "input": 500000,
    "output": 250000
  },
  "by_model": {
    "gpt-4": {"cost": 12.00, "input_tokens": 400000, "output_tokens": 200000},
    "gpt-3.5-turbo": {"cost": 3.50, "input_tokens": 100000, "output_tokens": 50000}
  }
}
```

### Access Notes
- Standard file permissions
- Markdown history can be read directly
- Aider shows cost in real-time during sessions

### Parsing Example
```bash
# View analytics
cat ~/.aider/analytics.json | jq .

# Read project chat history (markdown)
cat .aider.chat.history.md

# Extract session costs
cat ~/.aider/aider-history.json | jq '.sessions[] | {project, cost, timestamp}'
```

---

## Windsurf (Codeium)

### Storage Location
- **Primary data directory:**
  - Windows: `%APPDATA%\Windsurf\`
  - macOS: `~/Library/Application Support/Windsurf/`
  - Linux: `~/.config/Windsurf/`

### File Structure
```
Windsurf/
├── User/
│   ├── globalStorage/
│   │   ├── codeium.codeium/
│   │   │   ├── windsurf-state.json
│   │   │   └── usage.json
│   │   └── storage.json
│   └── workspaceStorage/
│       └── <workspace-id>/
│           └── chat.db
├── logs/
└── CachedData/
```

### Chat Sessions
- **File:** `workspaceStorage/<id>/chat.db` (SQLite)
- **Also:** `globalStorage/codeium.codeium/windsurf-state.json`
- **Format:** SQLite + JSON

### Token/Usage Data
- **File:** `globalStorage/codeium.codeium/usage.json`
- **Sample:**
```json
{
  "daily_usage": {
    "2024-01-15": {
      "input_tokens": 5000,
      "output_tokens": 2500,
      "requests": 20
    }
  },
  "total_usage": {
    "input_tokens": 150000,
    "output_tokens": 75000
  },
  "subscription_tier": "free",
  "limits": {
    "daily_input": 100000,
    "daily_output": 50000
  }
}
```

### Access Notes
- SQLite database for detailed chat
- JSON for quick usage stats
- Similar structure to Cursor (both VSCode-based)

### Parsing Example
```bash
# Check usage
cat ~/Library/Application\ Support/Windsurf/User/globalStorage/codeium.codeium/usage.json | jq .

# Query chat database
sqlite3 ~/Library/Application\ Support/Windsurf/User/workspaceStorage/*/chat.db ".tables"
```

---

## GitHub Copilot

### Storage Location
- **Varies by IDE** (VS Code, JetBrains, etc.)
- **VS Code location:**
  - Windows: `%APPDATA%\Code\User\globalStorage\github.copilot\`
  - macOS: `~/Library/Application Support/Code/User/globalStorage/github.copilot/`
  - Linux: `~/.config/Code/User/globalStorage/github.copilot/`

### File Structure
```
github.copilot/
├── chat-history/
│   └── *.json
├── suggestions.log
└── telemetry.json
```

### Chat Sessions
- **Limited local storage** - primarily cloud-based
- **Chat history:** `chat-history/*.json` (if available)
- **Format:** JSON
- **Sample:**
```json
{
  "conversationId": "conv_abc",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "model": "gpt-4",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Token/Usage Data
- **Primarily cloud-based** - limited local tracking
- **Telemetry:** `telemetry.json` may contain some metrics
- **Fields available:**
  - `requests_count`
  - `characters_accepted`
  - `characters_suggested`

### Access Notes
- **Most data is cloud-only**
- GitHub.com → Settings → Billing → View usage
- Local files may be cleared on restart
- Limited extraction capability

### Limitations
- ❌ No complete local chat history
- ❌ Limited token usage locally
- ❌ Must check GitHub web portal for full stats

### Parsing Example
```bash
# Check what's available locally (VS Code)
ls ~/Library/Application\ Support/Code/User/globalStorage/github.copilot/

# Read chat history if present
cat ~/Library/Application\ Support/Code/User/globalStorage/github.copilot/chat-history/*.json | jq .
```

---

## Summary: Best Agents for Data Extraction

| Agent | Chat Extractability | Token Data | Ease of Access |
|-------|---------------------|------------|----------------|
| **Claude Code** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy (JSONL) |
| **Cursor** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium (SQLite) |
| **OpenCode** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy (SQLite) |
| **Gemini CLI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Easy (JSONL) |
| **Codex CLI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy (JSON) |
| **Qwen CLI** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Easy (JSON) |
| **Aider** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy (JSON/YAML) |
| **Windsurf** | ⭐⭐⭐ | ⭐⭐⭐⭐ | Medium (SQLite/JSON) |
| **GitHub Copilot** | ⭐⭐ | ⭐⭐ | Hard (Cloud-primary) |

---

## Universal Parsing Script

```bash
#!/bin/bash
# extract_ai_usage.sh - Extract usage data from multiple AI coding assistants

echo "=== AI Coding Assistant Usage Report ==="
echo ""

# Claude Code
if [ -d "$HOME/.claude/projects" ]; then
    echo "## Claude Code"
    find ~/.claude/projects -name "*.jsonl" -exec cat {} \; 2>/dev/null | \
        jq -s '[.[] | select(.usage != null) | .usage] | 
        {input: map(.input_tokens) | add, output: map(.output_tokens) | add}'
    echo ""
fi

# Gemini CLI
if [ -d "$HOME/.gemini/history" ]; then
    echo "## Gemini CLI"
    cat ~/.gemini/history/*.jsonl 2>/dev/null | \
        jq -s '[.[] | select(.usage != null) | .usage] |
        {input: map(.input_tokens) | add, output: map(.output_tokens) | add}'
    echo ""
fi

# Codex CLI
if [ -d "$HOME/.codex/sessions" ]; then
    echo "## Codex CLI"
    cat ~/.codex/sessions/*/usage.json 2>/dev/null | \
        jq -s '{input: map(.total_input_tokens) | add, 
                output: map(.total_output_tokens) | add,
                cost: map(.estimated_cost_usd) | add}'
    echo ""
fi

# Aider
if [ -f "$HOME/.aider/analytics.json" ]; then
    echo "## Aider"
    cat ~/.aider/analytics.json | jq '{total_cost, total_tokens}'
    echo ""
fi

# OpenCode
if [ -f "$HOME/.local/share/opencode/opencode.db" ]; then
    echo "## OpenCode"
    sqlite3 ~/.local/share/opencode/opencode.db \
        "SELECT model, SUM(total_input_tokens), SUM(total_output_tokens) 
         FROM usage_stats GROUP BY model"
    echo ""
fi

echo "=== End of Report ==="
```

---

## Known Limitations

| Agent | Limitation |
|-------|-----------|
| **GitHub Copilot** | Cloud-primary; minimal local data |
| **Cursor** | SQLite may be locked while running |
| **Windsurf** | Similar to Cursor; workspace-specific storage |
| **All** | File structures may change with updates |
| **All** | API keys/credentials should be protected |

---

*Research compiled: 2024*