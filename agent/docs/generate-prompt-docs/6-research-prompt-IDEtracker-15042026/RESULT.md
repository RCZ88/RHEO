 I'll research all 6 topics thoroughly and create comprehensive markdown outputs for each. Let me start by gathering information across all research areas.
 Now I have gathered extensive research across all 6 topics. Let me compile comprehensive markdown outputs for each research area.

---

# Research Output 1: IDE Integration & Extension Detection

## VS Code Extension Detection

### Storage Locations by OS

| OS | Extensions Directory | User Data Directory |
|----|---------------------|---------------------|
| Windows | `%USERPROFILE%\.vscode\extensions` | `%APPDATA%\Code\User\` |
| macOS | `~/.vscode/extensions` | `~/Library/Application Support/Code/User/` |
| Linux | `~/.vscode/extensions` | `~/.config/Code/User/` |

VS Code stores extensions in a per-user directory that can be customized via the `--extensions-dir` command-line option or the `VSCODE_EXTENSIONS` environment variable .

### Programmatic Access Methods

**1. VS Code Extension API (from within VS Code)**
The `vscode.extensions` namespace provides complete access to installed extensions:

```typescript
// List all installed extensions
const allExtensions = vscode.extensions.all;
console.log(`Total extensions: ${allExtensions.length}`);

// Get specific extension by ID
const gitExtension = vscode.extensions.getExtension('vscode.git');
if (gitExtension) {
  console.log(`Version: ${gitExtension.packageJSON.version}`);
  console.log(`Active: ${gitExtension.isActive}`);
  console.log(`Path: ${gitExtension.extensionPath}`);
}

// Listen for extension changes
vscode.extensions.onDidChange(() => {
  console.log('Extensions changed');
});
```

The Extension object provides: `id`, `extensionUri`, `extensionPath`, `isActive`, `packageJSON`, `extensionKind`, and `exports` .

**2. Command Line Interface**
```bash
# List all installed extensions
code --list-extensions

# List with versions
code --list-extensions --show-versions

# Install extension
code --install-extension <publisher.extension>

# Uninstall extension
code --uninstall-extension <publisher.extension>
```

**3. Direct File System Access**
Extensions are stored as directories named `{publisher.name}-{version}` in the extensions folder. Each contains:
- `package.json` - Extension manifest
- Extension source files
- `CHANGELOG.md`, `README.md` - Documentation

### Key Files for Detection

| File | Purpose |
|------|---------|
| `extensions.json` | Extension manifest/installation info (workspace level) |
| `state.vscdb` | SQLite database storing extension state |
| `workspaceStorage/{uuid}/` | Per-workspace extension state |

---

## Cursor IDE Detection

### Storage Architecture

Cursor is a VS Code fork with modified storage paths:

| Type | macOS Path | Windows/Linux Equivalent |
|------|-----------|------------------------|
| Global State | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` | `%APPDATA%\Cursor\User\globalStorage\` |
| Workspace State | `~/Library/Application Support/Cursor/User/workspaceStorage/{uuid}/state.vscdb` | Similar pattern |
| Config | `~/.cursor/cli-config.json` | `%USERPROFILE%\.cursor\` |
| Project Config | `/.cursor/cli.json` | Same |

### SQLite Schema (state.vscdb)

The `state.vscdb` file contains:

**ItemTable (key-value pairs):**
- `aiService.generations` - AI generation metadata
- `aiService.prompts` - Prompt history
- Extension enablement states

**cursorDiskKV table:**
- Composer metadata
- Usage statistics
- Team configuration

### Programmatic Detection Strategy

```javascript
// Detect Cursor installations
const cursorPaths = {
  darwin: [
    '/Applications/Cursor.app',
    '~/Applications/Cursor.app'
  ],
  win32: [
    '%LOCALAPPDATA%\Programs\cursor\Cursor.exe',
    '%ProgramFiles%\Cursor\Cursor.exe'
  ],
  linux: [
    '/usr/bin/cursor',
    '/usr/share/cursor/cursor',
    '~/.local/bin/cursor'
  ]
};

// Check for Cursor-specific files
const isCursorInstalled = () => {
  return fs.existsSync(getCursorStatePath());
};

// Read extension list from state.vscdb
const getCursorExtensions = async () => {
  const dbPath = path.join(getCursorUserPath(), 'globalStorage/state.vscdb');
  // Use better-sqlite3 or similar to query
  const db = new Database(dbPath);
  const extensions = db.prepare(
    "SELECT key, value FROM ItemTable WHERE key LIKE 'extension.%'"
  ).all();
  return extensions;
};
```

---

## JetBrains IDE Detection

### Plugin Storage Locations

| OS | Configuration Path | Plugins Path |
|----|-------------------|--------------|
| Windows | `%APPDATA%\JetBrains\<product><version>\` | `%LOCALAPPDATA%\JetBrains\<product><version>\plugins\` |
| macOS | `~/Library/Application Support/JetBrains/<product><version>/` | `~/Library/Application Support/JetBrains/<product><version>/plugins/` |
| Linux | `~/.config/JetBrains/<product><version>/` | `~/.local/share/JetBrains/<product><version>/plugins/` |

### Detection Methods

**1. Toolbox App CLI**
The JetBrains Toolbox App provides CLI commands for tool detection :
```bash
# List installed tools
jetbrains-toolbox --list

# Detect externally installed JetBrains tools
```

**2. Plugin Directory Scanning**
JetBrains plugins are stored as:
- Extracted directories in `plugins/` folder
- JAR/ZIP files for manual installations
- `plugin.xml` descriptor in each plugin directory

**3. Command Line Installation**
```bash
# Install plugin by ID
idea.sh installPlugins com.example.myplugin

# List installed plugins via IDE
idea.sh listPlugins
```

### Plugin Structure
Each plugin contains:
- `META-INF/plugin.xml` - Plugin descriptor with ID, version, dependencies
- `lib/` - Plugin classes and resources
- Icon files, resource bundles

---

## Cross-Platform Detection Strategy

### PATH-Based Detection

```javascript
const which = require('which');

const toolsToDetect = [
  // IDEs
  'code', 'cursor', 'idea', 'webstorm', 'pycharm', 'goland',
  // Version control
  'git', 'hg', 'svn',
  // Runtimes
  'node', 'python', 'python3', 'ruby', 'go', 'java',
  // Build tools
  'docker', 'podman', 'kubectl',
  // Package managers
  'npm', 'yarn', 'pnpm', 'pip', 'cargo', 'brew'
];

const detectTool = (command) => {
  try {
    return which.sync(command, { nothrow: true });
  } catch {
    return null;
  }
};
```

### Registry Detection (Windows)
```powershell
# Detect VS Code installation
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | 
  Where-Object { $_.DisplayName -like "*Visual Studio Code*" }

# Detect JetBrains products
Get-ChildItem HKLM:\Software\JetBrains\
```

### macOS Detection
```bash
# Check LaunchServices database
lsregister -dump | grep -i "cursor\|vscode\|jetbrains"

# Check Applications folders
ls /Applications/ | grep -i "visual studio code\|cursor\|intellij"
```

---

## Permission Requirements

| Detection Method | Permission Level | Notes |
|---------------|------------------|-------|
| VS Code CLI | User | Standard user access |
| Extension API | Extension context | Must be running within VS Code |
| File system scan | User | May need permissions for protected directories |
| Registry (Windows) | User/Admin | HKLM requires admin, HKCU does not |
| JetBrains Toolbox | User | Standard installation |

---

## Summary

- **VS Code**: Most accessible via CLI and Extension API; well-documented paths
- **Cursor**: Similar to VS Code but with custom paths; SQLite state database contains rich metadata
- **JetBrains**: Toolbox App provides some CLI capabilities; plugin directories are straightforward to scan
- **Cross-platform**: Use PATH detection as primary method, fall back to OS-specific locations

---

# Research Output 2: AI Coding Assistant Token & Usage Tracking

## GitHub Copilot

### API Migration Notice (2026)
The legacy Copilot Metrics API was sunset on **April 2, 2026**. The new Copilot Usage Metrics API provides significantly more granular data including agent mode usage, model breakdowns, and lines of code metrics .

### New Usage Metrics API (2026)

**Enterprise Endpoints:**
```
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day?day=YYYY-MM-DD
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest
GET /enterprises/{enterprise}/copilot/metrics/reports/users-1-day?day=YYYY-MM-DD
GET /enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest
```

**Organization Endpoints:**
```
GET /orgs/{org}/copilot/metrics/reports/organization-1-day?day=YYYY-MM-DD
GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest
GET /orgs/{org}/copilot/metrics/reports/users-1-day?day=YYYY-MM-DD
GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest
```

### Authentication

| Token Type | Scope Required | Access Level |
|-----------|---------------|--------------|
| Fine-grained PAT | "Enterprise Copilot metrics" (read) | Enterprise/Org metrics |
| OAuth App | `manage_billing:copilot` or `read:enterprise` | Legacy (deprecated) |
| GitHub App | "Organization Copilot metrics" (read) | Organization metrics |

### Available Metrics

The new API provides comprehensive telemetry :

**Code Completions:**
- `copilot_ide_code_completions.total_engaged_users`
- `copilot_ide_code_completions.languages.total_engaged_users`
- `copilot_ide_code_completions.editors.total_engaged_users`
- Lines suggested vs. accepted (by IDE, language, model)

**Chat & Agent Mode:**
- Chat interactions by mode (ask, edit, plan, agent, custom)
- Agent mode edits and lines added/deleted
- Plan mode telemetry across IDEs

**CLI Usage (Enterprise):**
- Session counts
- Request volumes
- Token usage (prompt and output)

**User Engagement:**
- Daily/Weekly Active Users (DAU/WAU)
- Billing seat assignments
- Feature adoption rates

### Data Format
Reports are provided as signed URL downloads containing JSON files with the above metrics, aggregated by day or 28-day periods .

---

## Cursor AI

### API Tiers

| Plan | API Access | Key Features |
|------|-----------|--------------|
| Free/Pro | Basic | Token billing, limited history |
| Team | Admin API | Daily usage, member data, spend limits |
| Enterprise | Analytics API + AI Code Tracking | Per-user breakdown, commit attribution, conversation insights |

### Admin API Endpoints

```
POST /teams/daily-usage-data          # Daily aggregated usage
POST /teams/filtered-usage-events     # Per-request events with pagination
POST /teams/spend                     # Total spending data
GET  /teams/members                   # Team member information
POST /teams/user-spend-limit          # Set spending limits (250 req/min)
```

### Analytics API (Enterprise)

```
GET /analytics/team/agent-edits       # AI-suggested edit metrics
GET /analytics/team/dau                 # Daily active users
GET /analytics/team/conversation-insights  # Conversation patterns
GET /analytics/team/model-usage         # Model breakdown
GET /analytics/team/mcp-usage          # MCP tool adoption
GET /analytics/team/commands           # Command usage analytics
```

### AI Code Tracking API (Enterprise - Alpha)

```
GET /analytics/ai-code/commits          # Per-commit AI attribution
GET /analytics/ai-code/changes          # Granular change tracking
```

**Response Fields:**
```json
{
  "commitHash": "abc123...",
  "userId": "encoded-id",
  "userEmail": "dev@example.com",
  "repoName": "my-repo",
  "tabLinesAdded": 45,
  "tabLinesDeleted": 12,
  "composerLinesAdded": 120,
  "composerLinesDeleted": 30,
  "nonAiLinesAdded": 200,
  "nonAiLinesDeleted": 50,
  "totalLinesAdded": 365,
  "totalLinesDeleted": 92
}
```

AI attribution is calculated by tagging each edit as either AI-generated (via TAB completions or Chat) or manual input at the time of code change .

### Rate Limits

| API | Endpoint Type | Rate Limit |
|-----|--------------|------------|
| Admin API | Most endpoints | 20 req/min |
| Admin API | `/teams/user-spend-limit` | 250 req/min |
| Analytics API | Team-level | 100 req/min |
| Analytics API | `/analytics/team/conversation-insights` | 20 req/min |
| Analytics API | Per-user endpoints | 50 req/min |
| AI Code Tracking | All endpoints | 20 req/min per endpoint |

Rate limits reset per minute per team. 304 Not Modified responses don't count against limits .

### Caching
- ETag-based HTTP caching supported
- Cache duration: 15 minutes (`max-age=900`)
- Returns `304 Not Modified` if data unchanged

---

## Claude Code (Anthropic)

### Local Data Location

Session transcripts are stored in:
```
~/.claude/projects/{project-name}/{timestamp}.jsonl
```

### JSONL Format

Each line is a JSON object:
```json
{"type":"message","role":"user","content":[{"type":"text","text":"..."}]}
{"type":"message","role":"assistant","content":[...],"usage":{"input_tokens":150,"output_tokens":300,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}
```

### Built-in Commands

| Command | Purpose | Limitations |
|---------|---------|-------------|
| `/cost` | Session token usage | Current session only |
| `/stats` | All-time token totals | Human-readable only |
| `/usage` | Plan quota status | No structured output |

### Third-Party Tools

**ccusage** - Community tool for parsing transcripts:
```bash
npx ccusage@latest report daily
npx ccusage@latest report daily --since 20250801
```

**cccost** - Intercepts API calls for accurate tracking:
- Hooks Node.js `fetch()` to capture all requests
- Writes to `~/.claude/projects/{project}/sessionid.usage.json`
- Tracks per-model statistics including cache tokens 

### Limitations
- No official programmatic API for usage aggregation
- No structured JSON output from built-in commands
- Active feature request (#33978) for native usage tracking 
- Transcripts don't contain all requests (some are background/context)

---

## Token Estimation & Cost Calculation

### Token Estimation Formulas

| Content Type | Approximation |
|-------------|---------------|
| English text | ~4 characters = 1 token |
| Python code | ~2.5 characters = 1 token |
| JavaScript | ~3 characters = 1 token |
| JSON/XML | ~3-4 characters = 1 token |

### Cost Models (as of 2026)

| Model | Input Cost | Output Cost | Cache Write | Cache Read |
|-------|-----------|-------------|-------------|------------|
| GPT-4o | $5/1M tokens | $15/1M tokens | - | - |
| Claude 3.5 Sonnet | $3/1M tokens | $15/1M tokens | 1.25x input | 0.1x input |
| Claude 3 Opus | $15/1M tokens | $75/1M tokens | 1.25x input | 0.1x input |

### Claude Code Cost Calculation

```python
def calculate_cost(usage):
    # Example pricing for Claude 3.5 Sonnet
    input_cost = usage['input_tokens'] * 3 / 1_000_000
    output_cost = usage['output_tokens'] * 15 / 1_000_000
    cache_write_cost = usage.get('cache_creation_input_tokens', 0) * 3.75 / 1_000_000
    cache_read_cost = usage.get('cache_read_input_tokens', 0) * 0.3 / 1_000_000
    return input_cost + output_cost + cache_write_cost + cache_read_cost
```

---

## Other AI Tools

| Tool | Tracking Method | API Available |
|------|----------------|---------------|
| Continue.dev | Local logs | Limited |
| Cody (Sourcegraph) | Admin dashboard | Enterprise API |
| Codeium | Local telemetry | No |
| Amazon CodeWhisperer | AWS Console | Yes |
| Tabnine | Admin dashboard | Enterprise API |

---

## Summary

- **Copilot**: Enterprise-focused API with comprehensive metrics; requires GitHub Enterprise/Organization
- **Cursor**: Best-in-class API with granular token tracking and AI code attribution; Enterprise plan required for full features
- **Claude Code**: No official API; relies on local transcript parsing or third-party interceptors
- **Cost tracking**: Cache-aware calculations are essential for accuracy with modern models

---

# Research Output 3: Git & Version Control Metrics

## GitHub REST API

### Core Endpoints

| Endpoint | Purpose | Rate Limit (Authenticated) |
|----------|---------|---------------------------|
| `GET /repos/{owner}/{repo}/commits` | List commits with stats | 5,000/hour |
| `GET /repos/{owner}/{repo}/commits/{ref}` | Single commit with stats | 5,000/hour |
| `GET /repos/{owner}/{repo}/stats/code_frequency` | Weekly additions/deletions | 2,000/hour |
| `GET /repos/{owner}/{repo}/stats/commit_activity` | Last 52 weeks activity | 2,000/hour |
| `GET /repos/{owner}/{repo}/stats/contributors` | Contributor commit counts | 2,000/hour |
| `GET /repos/{owner}/{repo}/stats/participation` | Weekly commit counts | 2,000/hour |
| `GET /repos/{owner}/{repo}/compare/{base}...{head}` | Diff between commits | 5,000/hour |
| `GET /repos/{owner}/{repo}/pulls` | List pull requests | 5,000/hour |

### Commit Response Structure

```json
{
  "sha": "abc123...",
  "commit": {
    "author": {
      "name": "Developer Name",
      "email": "dev@example.com",
      "date": "2026-01-01T00:00:00Z"
    },
    "message": "feat: add new feature\n\nDetailed description",
    "tree": { "sha": "def456..." }
  },
  "stats": {
    "additions": 150,
    "deletions": 50,
    "total": 200
  },
  "files": [
    {
      "filename": "src/index.js",
      "status": "modified",
      "additions": 10,
      "deletions": 5,
      "changes": 15,
      "patch": "@@ -1,5 +1,5 @@..."
    }
  ],
  "author": { "login": "username", "id": 12345 },
  "committer": { "login": "username", "id": 12345 }
}
```

### Pagination Strategy

GitHub uses cursor-based pagination:
- `per_page`: 1-100 (default 30)
- `page`: Page number
- `Link` header contains `rel="next"`, `rel="last"`

Best practice: Use `since` and `until` parameters to fetch commits in date ranges rather than paginating entire history.

---

## Local Git Analysis

### Node.js: simple-git

```javascript
const simpleGit = require('simple-git');

const git = simpleGit(repoPath);

// Get commit log with stats
const log = await git.log({
  from: 'v1.0.0',
  to: 'v1.1.0',
  format: {
    hash: '%H',
    date: '%ai',
    message: '%s',
    author_name: '%an',
    author_email: '%ae',
    stats: '%d'  // Requires custom parsing
  }
});

// Get diff summary
const diff = await git.diffSummary(['HEAD~10..HEAD']);

// Get commit count
const count = await git.raw(['rev-list', '--count', 'HEAD']);
```

### Python: GitPython

```python
import git
from datetime import datetime

repo = git.Repo(path)

# Iterate commits
for commit in repo.iter_commits('HEAD~100..HEAD'):
    print(f"Commit: {commit.hexsha}")
    print(f"Message: {commit.message}")
    print(f"Date: {commit.authored_datetime}")
    print(f"Author: {commit.author.name} <{commit.author.email}>")
    
    # Get stats
    stats = commit.stats
    print(f"Files changed: {stats.total['files']}")
    print(f"Insertions: {stats.total['insertions']}")
    print(f"Deletions: {stats.total['deletions']}")

# Get contributors
contributors = {}
for commit in repo.iter_commits():
    email = commit.author.email
    contributors[email] = contributors.get(email, 0) + 1
```

### Performance Considerations

- **Shallow clones**: Use `--depth` to limit history for large repos
- **Sparse checkout**: Only checkout specific directories
- **Batch operations**: Avoid iterating commit-by-commit for large histories
- **Caching**: Cache commit metadata locally to reduce API calls

---

## DORA Metrics Calculation

### The Four Key Metrics

| Metric | Elite | High | Medium | Low | Calculation |
|--------|-------|------|--------|-----|-------------|
| **Deployment Frequency** | On-demand (multiple/day) | Weekly-Monthly | Monthly-Quarterly | < Monthly | `deploys / time_period` |
| **Lead Time for Changes** | < 1 hour | 1 day - 1 week | 1 week - 1 month | > 6 months | `deploy_time - first_commit_time` |
| **Change Failure Rate** | 0-15% | 16-30% | 16-30% | 46-60% | `failed_deploys / total_deploys` |
| **Mean Time to Recovery** | < 1 hour | < 1 day | 1 day - 1 week | > 1 month | `restore_time - incident_time` |

### Implementation

```python
def calculate_deployment_frequency(deployments, days=30):
    """Calculate deployments per day"""
    recent_deploys = [d for d in deployments 
                      if (now - d['date']).days <= days]
    return len(recent_deploys) / days

def calculate_lead_time(commits, deployments):
    """Calculate median time from commit to deployment"""
    lead_times = []
    for deploy in deployments:
        # Find first commit in this deployment
        deploy_commits = get_commits_in_deploy(commits, deploy)
        if deploy_commits:
            first_commit = min(deploy_commits, key=lambda c: c['date'])
            lead_time = (deploy['date'] - first_commit['date']).total_seconds() / 3600
            lead_times.append(lead_time)
    
    lead_times.sort()
    return lead_times[len(lead_times) // 2]  # Median

def calculate_change_failure_rate(deployments, incidents):
    """Calculate percentage of deployments causing failures"""
    failed_deploys = len([d for d in deployments if d['id'] in incidents])
    return (failed_deploys / len(deployments)) * 100 if deployments else 0
```

---

## AI Attribution in Commits

### Cursor AI Code Tracking

Cursor's AI Code Tracking API provides per-commit attribution :
- `tabLinesAdded` - Lines from TAB completions
- `composerLinesAdded` - Lines from Chat/Composer
- `nonAiLinesAdded` - Manual edits

### Co-Authored-By Detection

```bash
# Find AI-assisted commits
git log --format="%H %ae %s" --grep="Co-Authored-By" --all

# Find specific AI tools
git log --format="%H %s" --grep="Co-Authored-By: Claude" --all
git log --format="%H %s" --grep="Co-Authored-By: GitHub Copilot" --all
```

### Commit Message Patterns

| Pattern | Tool | Reliability |
|---------|------|-------------|
| `Co-Authored-By: Claude <...>` | Claude Code | High (auto-added) |
| `Co-Authored-By: GitHub Copilot <...>` | Copilot | Medium (manual) |
| `[AI]`, `[Cursor]`, `[Copilot]` prefixes | Various | Low (convention-based) |
| `🤖 Generated with Claude Code` | Claude Code | High |
| `Generated-by:`, `Assisted-by:` | Various | Medium |

### Git Trailers for AI Attribution

Emerging best practice uses dedicated trailers :

```
feat: implement user authentication

- Add JWT token validation
- Implement refresh token rotation
- Add middleware for protected routes

Coding-Agent: Claude Code
Model: claude-opus-4-6
AI-Assisted: true
```

---

## Metrics to Extract

| Metric | Source | Use Case |
|--------|--------|----------|
| Commit frequency | GitHub API, local git | Velocity tracking |
| Lines changed (add/del) | commit.stats | Code churn analysis |
| Files touched per commit | commit.files | Change scope |
| Commit size distribution | commit.stats.total | Review complexity |
| Time between commits | commit.author.date | Work patterns |
| Author distribution | commit.author | Contribution equity |
| Branch merge frequency | merge commits | Integration cadence |
| PR cycle time | PR created → merged | Review efficiency |
| Code review turnaround | review submitted → approved | Collaboration |

---

## Rate Limit Handling

```javascript
// Exponential backoff for rate limits
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset') * 1000;
      const waitTime = resetTime - Date.now() + 1000;
      await sleep(waitTime);
      continue;
    }
    
    if (response.status === 200) return response;
    
    // Exponential backoff
    await sleep(Math.pow(2, i) * 1000);
  }
  throw new Error('Max retries exceeded');
}
```

---

## Summary

- **GitHub API**: Comprehensive but rate-limited; best for aggregate metrics
- **Local git**: Fast and unlimited; best for real-time analysis
- **DORA metrics**: Industry standard but require deployment/incident data
- **AI attribution**: Emerging standards; Cursor provides best programmatic access

---

# Research Output 4: Developer Tool Telemetry Standards

## OpenTelemetry DevEx Extension

### Semantic Conventions

While OpenTelemetry doesn't have finalized DevEx semantic conventions as of 2026, emerging practices use the `devex.*` prefix :

```python
from opentelemetry import metrics

meter = metrics.get_meter("devex.metrics", version="1.0.0")

# Build duration histogram
build_duration = meter.create_histogram(
    name="devex.build.duration",
    unit="s",
    description="Build duration in seconds"
)

# Deployment counter
deploy_count = meter.create_counter(
    name="devex.deploy.count",
    unit="1",
    description="Total deployments"
)

# IDE usage gauge
ide_active = meter.create_up_down_counter(
    name="devex.ide.active_sessions",
    unit="1",
    description="Active IDE sessions"
)
```

### Collector Pipeline

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 10s

exporters:
  otlphttp/devex:
    endpoint: https://your-otel-backend.com
```

---

## DORA Metrics Framework

### The Four Keys

| Metric | Elite | High | Medium | Low | Measurement Approach |
|--------|-------|------|--------|-----|-------------------|
| **Deployment Frequency** | On-demand | Weekly-Monthly | Monthly-Quarterly | < Monthly | CI/CD pipeline events |
| **Lead Time for Changes** | < 1 hour | 1 day - 1 week | 1 week - 1 month | > 6 months | Commit → Production |
| **Change Failure Rate** | 0-15% | 16-30% | 16-30% | 46-60% | Incidents / Deployments |
| **Mean Time to Recovery** | < 1 hour | < 1 day | 1 day - 1 week | > 1 month | Incident detection → Resolution |

### Limitations
- Misses ~47% of developer work (meetings, communication, context switching)
- Focuses on deployment pipelines, not local development
- Requires access to production/incident data 

---

## SPACE Framework

### Five Dimensions

| Dimension | Metrics | Measurement Approach |
|-----------|---------|---------------------|
| **S**atisfaction | Survey scores, NPS, flow state | Developer surveys, sentiment analysis |
| **P**erformance | Throughput, cycle time, bug rates | DORA + code quality metrics |
| **A**ctivity | Commits, PRs, files changed | Git + IDE metrics |
| **C**ommunication | Review time, merge speed | PR/CR analytics, collaboration tools |
| **E**fficiency | Build times, test times, deploy freq | CI/CD + local development metrics |

### Measurement Challenges

**Satisfaction**: Requires surveys; can use commit message sentiment analysis as proxy 

**Performance**: 
- CI/CD Success Rate
- Average PR Merge Time
- Bug Fix Commits / Total Commits
- Code Churn

**Activity**:
- Total Commits
- Code Churn (additions + deletions)
- Files Changed
- Pull Requests Created

**Communication**:
- Contributors Experience (% lines by top contributor)
- Commit Interaction Frequency (CIF) - coordinated changes within 24h
- PR Review Turnaround

**Efficiency**:
- Time between commits
- Average daily code churn
- Context switch frequency

---

## DX Core 4 Framework

### Four Balanced Dimensions

| Dimension | Key Metrics | Data Sources |
|-----------|-------------|--------------|
| **Speed** | Lead time, deployment frequency, PR cycle time | DORA metrics, Git |
| **Effectiveness** | Developer Experience Index (14 items), ease of delivery | Surveys, system data |
| **Quality** | Change failure rate, rework rate, incident frequency | DORA, code analysis |
| **Impact** | Business outcome alignment, initiative progress | Project tracking, revenue |

### Developer Experience Index (DXI)

Composite score from 14 standardized experience drivers :
1. Ease of delivery (perceived)
2. Time to 10th PR (onboarding)
3. Regrettable attrition
4. Tool satisfaction
5. Workflow friction
6. Technical debt perception
7. Code review experience
8. Meeting load
9. Context switching
10. Documentation quality
11. Local development environment
12. CI/CD reliability
13. Incident response
14. Psychological safety

---

## Privacy-First Telemetry: Supabase CLI Model

### Key Principles

```typescript
interface TelemetryEvent {
  event_name: string;
  timestamp: string; // ISO8601
  distinct_id: string; // Anonymous UUID

  environment: {
    os: string;
    arch: string;
    app_version: string;
    ci_detected: boolean;
    tty_detected: boolean;
  };

  properties: {
    command?: string;
    exit_code?: number;
    duration_ms?: number;
  };
}
```

### Privacy Features 

| Feature | Implementation |
|---------|---------------|
| Anonymous ID | Random UUID per installation |
| IP Anonymization | Last octet removed |
| Flag Redaction | Sensitive data filtered by default |
| Opt-out | `supabase telemetry disable` or `SUPABASE_TELEMETRY_DISABLED=1` |
| No PII | No usernames, emails, or project names |
| Local Processing | Aggregation happens client-side |

### Opt-out Mechanisms

```bash
# Disable telemetry
supabase telemetry disable

# Check status
supabase telemetry status

# Re-enable
supabase telemetry enable

# Environment variable (also respects DO_NOT_TRACK=1)
export SUPABASE_TELEMETRY_DISABLED=1
```

---

## AI-Specific Metrics (2025-2026)

### Emerging Metrics

| Metric | Definition | Measurement |
|--------|-----------|-------------|
| **AI Adoption Rate** | % of commits/PRs using AI tools | AI attribution in commits |
| **AI vs Non-AI Cycle Time** | Comparison of delivery speed | Track by attribution |
| **Code Survival Rate** | % of AI suggestions remaining | Line-level tracking |
| **AI Technical Debt Signals** | Incident rates for AI-touched code | Correlate incidents with AI attribution |
| **Context Switch Reduction** | IDE exits to external resources | IDE telemetry |

### AI Attribution Standards

Emerging conventions for commit trailers :
- `Coding-Agent: ToolName` (e.g., Claude Code, Cursor)
- `Model: model-id` (e.g., claude-opus-4-6)
- `AI-Assisted: true/false`
- `AI-Generated-Percentage: 0-100`

---

## Implementation Recommendations

### Start Small
1. Instrument one pipeline for one team
2. Get feedback and iterate
3. Roll out gradually

### Use Semantic Conventions
- Prefix DevEx metrics with `devex.`
- Use `cicd.*` for pipeline metrics
- Use `vcs.*` for version control

### Alert on Trends
- Week-over-week regressions vs. fixed thresholds
- p95 build times hitting teams
- Review turnaround increases

### Correlate with Surveys
- Quantitative metrics need qualitative validation
- Periodic developer satisfaction surveys
- Validate that metrics reflect actual pain points 

---

## Summary

- **OpenTelemetry**: Emerging standard for DevEx instrumentation
- **DORA**: Industry standard for delivery performance but incomplete
- **SPACE**: Holistic framework requiring both system data and surveys
- **DX Core 4**: Balanced approach combining DORA with experience metrics
- **Privacy**: Follow Supabase CLI model - anonymous, opt-out, minimal data

---

# Research Output 5: Tool Detection & Project Environment Scanning

## Package Manager Detection

### Cross-Platform Commands

| Manager | Detection Command | Output Format | Cross-Platform |
|---------|------------------|---------------|----------------|
| **npm** | `npm list -g --depth=0 --json` | JSON | Yes |
| **yarn** | `yarn global list --json` | JSON | Yes |
| **pnpm** | `pnpm list -g --json` | JSON | Yes |
| **pip** | `pip list --format=json` or `importlib.metadata` | JSON | Yes |
| **pipx** | `pipx list --json` | JSON | Yes |
| **cargo** | `cargo install --list` | Text | Yes |
| **brew** | `brew list --formulae` | Text | macOS/Linux |
| **cask** | `brew list --casks` | Text | macOS |
| **choco** | `choco list --local-only` | Text | Windows |
| **winget** | `winget list` | Table | Windows |
| **scoop** | `scoop list` | JSON | Windows |
| **gem** | `gem list` | Text | Yes |
| **composer** | `composer global show` | Text | Yes |

### Implementation Examples

**npm Global Packages:**
```javascript
const { execSync } = require('child_process');

function getNpmGlobals() {
  try {
    const output = execSync('npm list -g --depth=0 --json', { encoding: 'utf8' });
    const data = JSON.parse(output);
    return Object.entries(data.dependencies || {}).map(([name, info]) => ({
      name,
      version: info.version,
      path: info.path
    }));
  } catch (e) {
    return [];
  }
}
```

**Python Packages:**
```python
from importlib.metadata import distributions

def get_python_packages():
    return [
        {
            'name': dist.metadata['Name'],
            'version': dist.version,
            'path': dist.locate_file('')
        }
        for dist in distributions()
    ]
```

**Cargo Crates:**
```bash
cargo install --list
# Output format:
# package-name v0.1.0:
#     binary-name
```

---

## PATH-Based Detection

### Core Approach

```javascript
const which = require('which');

const TOOL_CATEGORIES = {
  versionControl: ['git', 'hg', 'svn'],
  runtimes: ['node', 'python', 'python3', 'ruby', 'go', 'java', 'dotnet'],
  editors: ['code', 'cursor', 'vim', 'nano', 'emacs', 'subl', 'idea'],
  containers: ['docker', 'podman', 'kubectl', 'helm'],
  infrastructure: ['terraform', 'ansible', 'puppet', 'chef'],
  cloud: ['aws', 'gcloud', 'az', 'kubectl', 'oc'],
  databases: ['psql', 'mysql', 'mongo', 'redis-cli'],
  buildTools: ['make', 'cmake', 'ninja', 'maven', 'gradle']
};

function detectTool(command) {
  try {
    const path = which.sync(command, { nothrow: true });
    if (path) {
      // Get version
      try {
        const version = execSync(`${command} --version`, { 
          encoding: 'utf8',
          timeout: 5000 
        }).trim().split('\n')[0];
        return { command, path, version };
      } catch {
        return { command, path, version: null };
      }
    }
  } catch {
    return null;
  }
}
```

### Cross-Platform PATH Resolution

| OS | PATH Variable | Common Locations |
|----|--------------|------------------|
| Windows | `Path` | `C:\Windows\System32`, `%LOCALAPPDATA%\Microsoft\WindowsApps` |
| macOS | `PATH` | `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin` |
| Linux | `PATH` | `/usr/bin`, `/usr/local/bin`, `~/.local/bin`, `/snap/bin` |

---

## Project-Specific Tooling Detection

### JavaScript/TypeScript Projects

```javascript
function detectJsTooling(projectPath) {
  const tools = [];
  
  // Check package.json
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };
    
    // Detect tools by dependency presence
    const toolMap = {
      'eslint': 'linter',
      'prettier': 'formatter',
      'typescript': 'compiler',
      'jest': 'test',
      'vitest': 'test',
      'webpack': 'bundler',
      'vite': 'bundler',
      'rollup': 'bundler',
      'esbuild': 'bundler',
      'tailwindcss': 'css-framework',
      '@playwright/test': 'e2e-test'
    };
    
    for (const [dep, type] of Object.entries(toolMap)) {
      if (allDeps[dep]) {
        tools.push({ name: dep, type, version: allDeps[dep] });
      }
    }
  }
  
  // Check config files
  const configFiles = {
    '.eslintrc.js': 'eslint',
    '.eslintrc.json': 'eslint',
    'prettier.config.js': 'prettier',
    '.prettierrc': 'prettier',
    'tsconfig.json': 'typescript',
    'vite.config.ts': 'vite',
    'webpack.config.js': 'webpack',
    'jest.config.js': 'jest',
    'playwright.config.ts': 'playwright'
  };
  
  for (const [file, tool] of Object.entries(configFiles)) {
    if (fs.existsSync(path.join(projectPath, file))) {
      if (!tools.find(t => t.name === tool)) {
        tools.push({ name: tool, type: 'config-detected' });
      }
    }
  }
  
  return tools;
}
```

### Python Projects

```python
import tomllib
from pathlib import Path

def detect_python_tooling(project_path: Path):
    tools = []
    
    # Check pyproject.toml
    pyproject = project_path / "pyproject.toml"
    if pyproject.exists():
        with open(pyproject, "rb") as f:
            config = tomllib.load(f)
            
        # Poetry dependencies
        if "tool" in config and "poetry" in config["tool"]:
            deps = config["tool"]["poetry"].get("dependencies", {})
            dev_deps = config["tool"]["poetry"].get("dev-dependencies", {})
            
        # PEP 621 dependencies
        if "project" in config:
            deps = config["project"].get("dependencies", [])
            optional = config["project"].get("optional-dependencies", {})
    
    # Check for common config files
    config_files = {
        "ruff.toml": ("ruff", "linter"),
        "black.toml": ("black", "formatter"),
        "mypy.ini": ("mypy", "type-checker"),
        "pytest.ini": ("pytest", "test"),
        "tox.ini": ("tox", "test-runner"),
        ".pre-commit-config.yaml": ("pre-commit", "git-hooks")
    }
    
    for filename, (tool, category) in config_files.items():
        if (project_path / filename).exists():
            tools.append({"name": tool, "category": category})
    
    return tools
```

### Universal Project Scanning

```bash
# Find all config files in project (max depth 3)
find . -maxdepth 3 -type f \( \
  -name ".eslintrc*" -o \
  -name ".prettierrc*" -o \
  -name "biome.json" -o \
  -name "ruff.toml" -o \
  -name "pyproject.toml" -o \
  -name "Cargo.toml" -o \
  -name "go.mod" -o \
  -name "Gemfile" -o \
  -name "package.json" -o \
  -name "composer.json" -o \
  -name ".editorconfig" -o \
  -name "Dockerfile" -o \
  -name "docker-compose.yml" -o \
  -name "Makefile" -o \
  -name "*.gemspec" \
\) 2>/dev/null
```

---

## Tool Taxonomy

### Primary Categories

```typescript
interface ToolCategory {
  id: string;
  name: string;
  subcategories: SubCategory[];
}

const TOOL_TAXONOMY: ToolCategory[] = [
  {
    id: "package-managers",
    name: "Package Managers",
    subcategories: [
      { id: "npm", name: "npm", commands: ["npm", "npx"] },
      { id: "yarn", name: "Yarn", commands: ["yarn"] },
      { id: "pnpm", name: "pnpm", commands: ["pnpm"] },
      { id: "pip", name: "pip", commands: ["pip", "pip3"] },
      { id: "poetry", name: "Poetry", commands: ["poetry"] },
      { id: "cargo", name: "Cargo", commands: ["cargo"] },
      { id: "brew", name: "Homebrew", commands: ["brew"] },
      { id: "choco", name: "Chocolatey", commands: ["choco"] },
      { id: "winget", name: "WinGet", commands: ["winget"] }
    ]
  },
  {
    id: "build-tools",
    name: "Build Tools",
    subcategories: [
      { id: "bundlers", tools: ["webpack", "vite", "rollup", "esbuild", "parcel"] },
      { id: "compilers", tools: ["tsc", "babel", "swc", "esbuild"] },
      { id: "task-runners", tools: ["grunt", "gulp", "make", "just"] },
      { id: "containers", tools: ["docker", "podman", "buildah"] }
    ]
  },
  {
    id: "code-quality",
    name: "Code Quality",
    subcategories: [
      { id: "linters", tools: ["eslint", "ruff", "flake8", "pylint", "golangci-lint", "rubocop"] },
      { id: "formatters", tools: ["prettier", "black", "rustfmt", "gofmt", "shfmt"] },
      { id: "type-checkers", tools: ["mypy", "typescript", "flow", "pyright"] },
      { id: "testing", tools: ["jest", "pytest", "vitest", "mocha", "cypress", "playwright"] }
    ]
  },
  {
    id: "ai-assistants",
    name: "AI Assistants",
    subcategories: [
      { id: "copilot", tools: ["copilot", "github-copilot"] },
      { id: "cursor", tools: ["cursor"] },
      { id: "claude-code", tools: ["claude", "claude-code"] },
      { id: "continue", tools: ["continue"] },
      { id: "cody", tools: ["cody"] },
      { id: "codeium", tools: ["codeium"] }
    ]
  },
  {
    id: "ides",
    name: "IDEs & Editors",
    subcategories: [
      { id: "vscode", tools: ["code", "vscode"] },
      { id: "cursor-ide", tools: ["cursor"] },
      { id: "jetbrains", tools: ["idea", "webstorm", "pycharm", "goland"] },
      { id: "vim", tools: ["vim", "nvim"] },
      { id: "emacs", tools: ["emacs"] }
    ]
  }
];
```

---

## Cross-Platform Path Mappings

### Windows
```
%USERPROFILE%          → C:\Users\{username}
%APPDATA%              → C:\Users\{username}\AppData\Roaming
%LOCALAPPDATA%         → C:\Users\{username}\AppData\Local
%PROGRAMFILES%         → C:\Program Files
%PROGRAMDATA%          → C:\ProgramData
```

### macOS
```
~/Library/Application Support/    → App data
~/Library/Preferences/          → Plist configs
~/.config/                      → XDG config (if enabled)
~/.local/share/                 → XDG data (if enabled)
/usr/local/bin/                 → Homebrew (Intel)
/opt/homebrew/bin/              → Homebrew (Apple Silicon)
```

### Linux
```
~/.config/                      → XDG config
~/.local/share/                 → XDG data
~/.local/bin/                   → User binaries
/usr/local/bin/                 → System-wide
/usr/bin/                       → Distribution packages
/var/lib/flatpak/               → Flatpak apps
~/.var/app/                     → Flatpak data
```

---

## Tool Usage Tracking (Privacy-Conscious)

### Shell History Analysis

```bash
# Bash/Zsh - most frequent commands
history | awk '{print $2}' | sort | uniq -c | sort -rn | head -20

# Fish
string split0 --allow-empty < ~/.local/share/fish/fish_history | \
  grep -o 'cmd: [^ ]*' | cut -d' ' -f2 | sort | uniq -c | sort -rn

# PowerShell
Get-History | Group-Object CommandLine | Sort-Object Count -Descending | Select-Object -First 20
```

### Privacy Principles

1. **Opt-in only** - Never track without explicit consent
2. **Local storage** - Store usage data locally, never transmit
3. **Aggregation only** - Track frequency/recency, not specific commands
4. **Anonymization** - Hash sensitive paths/arguments
5. **Transparency** - Show exactly what is tracked

```typescript
interface UsageTrackingPolicy {
  enabled: boolean;           // User opt-in
  trackFrequency: boolean;  // How often tools are used
  trackRecency: boolean;      // Last used timestamp
  trackDuration: boolean;     // Session duration (if detectable)
  anonymizePaths: boolean;    // Hash file paths
  localOnly: boolean;         // Never leave device
  retentionDays: number;      // Auto-delete after N days
}
```

---

## Summary

- **Package Managers**: Use JSON output where available; parse text output as fallback
- **PATH Detection**: Reliable cross-platform method using `which`/`where`
- **Project Scanning**: Detect by config files and lockfiles
- **Taxonomy**: Organize by category for better UX
- **Privacy**: Always opt-in, local-first, transparent

---

# Research Output 6: UI/UX Patterns for Developer Dashboards

## Existing Products Analysis

### Engineering Intelligence Platforms

| Platform | Key Features | AI Capabilities | Dashboard Approach |
|----------|-------------|-----------------|-------------------|
| **LinearB** | DORA/Space metrics, CI insights, Slackbot | AI adoption tracking, process metrics | Role-specific customizable dashboards  |
| **Faros AI** | SDLC-wide, code-level visibility | AI commit/PR detection, multi-tool attribution | Unified timeline view |
| **Swarmia** | User-friendly DORA/Space | Metadata only | Team-focused activity view |
| **Jellyfish** | Business alignment | Copilot dashboard | Executive summary + team drill-down |
| **DX Platform** | Comprehensive measurement | AI utilization tracking | Balanced scorecard approach |

### Built-in Dashboards
- **GitHub Copilot Metrics**: Organization-level usage, language breakdowns, IDE adoption
- **Cursor Analytics** (Enterprise): Token usage, AI code attribution, team comparisons
- **JetBrains Toolbox**: Plugin management, IDE usage statistics

---

## Metric Visualization Patterns

### Time Series Charts

**Best for**: Trends over time, velocity tracking

```
Commit Frequency (Last 90 Days)
│
│    ╭─╮
│   ╭╯ ╰╮      ╭─╮
│  ╭╯   ╰─────╯  ╰────╮
│ ╭╯                   ╰───
│╭╯
└──────────────────────────
  Week 1  Week 4  Week 8  Week 12
```

**Recommended**: Line charts for trends, area charts for cumulative metrics

### Funnel Visualizations

**Best for**: DORA metrics conversion, PR lifecycle

```
PR Lifecycle
┌─────────────────────────────┐  100%  45 PRs opened
│  Opened                     │
├─────────────────────────────┤   80%  36 PRs with review
│  In Review                  │
├─────────────────────────────┤   60%  27 PRs approved
│  Approved                   │
├─────────────────────────────┤   55%  25 PRs merged
│  Merged                     │
└─────────────────────────────┘
```

### Distribution Charts

**Best for**: Tool usage, language breakdowns

**Horizontal Bar Chart** (preferred for readability):
```
Language Distribution
TypeScript  ████████████████████████████████████████  45%
Python      ██████████████████████                  25%
Go          ██████████████                          15%
Rust        ███████                                  8%
Other       ████                                     7%
```

### Heatmaps

**Best for**: Activity patterns, focus time

```
Activity by Hour (Last 30 Days)
     Mon  Tue  Wed  Thu  Fri
00   ░░░  ░░░  ░░░  ░░░  ░░░
08   ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓
12   ▓▓░  ▓▓░  ▓▓░  ▓▓░  ▓▓░
14   ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓
18   ░▓▓  ░▓▓  ░▓▓  ░▓▓  ░░░
22   ░░░  ░░░  ░░░  ░░░  ░░░

Legend: ░ Low  ▓ Medium  █ High
```

---

## Vibe Coding Context UI

### AI Tool Usage Card

```
┌─────────────────────────────────────────┐
│ AI Tool Usage This Month                │
├─────────────────────────────────────────┤
│ Tokens: 1.2M          Cost: $12.47      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 85%    │
│ vs last month: +23%                     │
│                                         │
│ Breakdown:                              │
│ Cursor:     ████████████████  78%       │
│ Copilot:    ████              22%       │
└─────────────────────────────────────────┘
```

### AI vs Human Contribution

```
┌─────────────────────────────────────────┐
│ AI vs Human Contribution                │
├─────────────────────────────────────────┤
│ [████████████░░░░░░] 67% AI            │
│                                         │
│ Cursor:    12,450 lines (Tab: 8,200,   │
│                       Composer: 4,250)  │
│ Copilot:    3,200 lines                 │
│ Claude:       890 lines                 │
│ Human:      8,150 lines                 │
└─────────────────────────────────────────┘
```

### Tool Setup Score

```
┌─────────────────────────────────────────┐
│ Tool Setup Score                        │
├─────────────────────────────────────────┤
│ ● IDE: VS Code + Cursor ✓              │
│ ● Linters: ESLint, Prettier ✓          │
│ ● AI: Copilot ✓, Claude Code ✓        │
│ ● Git: Configured ✓                     │
│ ○ Missing: Docker, CI/CD config        │
│                                         │
│ Score: 85/100  [████████░░]            │
└─────────────────────────────────────────┘
```

---

## Information Architecture

### Dashboard Sections

**1. Overview** - High-level metrics cards
- Total tokens used (with trend indicator)
- Commits this week (vs. average)
- Tool setup score
- Active projects count
- DORA metrics summary (4 cards)

**2. AI Tools** - Detailed AI usage
- Token breakdown by tool (pie chart)
- Cost tracking with budget progress bar
- AI vs human lines (stacked bar)
- Model usage distribution
- Daily/weekly active usage trends

**3. Projects** - Per-project metrics
- Project list with health indicators
- Tools used per project (icon grid)
- Commit activity sparkline
- Code churn indicator
- Last activity timestamp

**4. Tools** - Installed tools inventory
- Categorized tool grid
- Version numbers
- Update available indicators
- Missing tool recommendations

**5. Trends** - Longitudinal analysis
- Week-over-week comparison
- Month-over-month growth
- DORA metrics history
- AI adoption curve

---

## CLI vs GUI Considerations

### CLI Tool Design

```bash
# Quick stats
$ app-tracker stats
AI Usage (7 days):
  Tokens: 450K ($4.50)
  Top tool: Cursor (78%)
  
Git Activity:
  Commits: 23 (↑15%)
  Top project: app-tracker

# Tool inventory
$ app-tracker tools
IDEs: VS Code, Cursor
AI: Copilot, Claude Code
Runtimes: Node 20, Python 3.11
Quality: ESLint, Prettier, Jest

# Sync with IDE data
$ app-tracker sync
✓ Synced VS Code extensions (42)
✓ Synced Cursor usage data
✓ Updated project configurations
```

### GUI Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Logo    Overview  AI Tools  Projects  Tools  Trends    [⚙] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ Tokens     │ │ Commits    │ │ Setup      │ │ Active    │ │
│  │ 1.2M       │ │ 23         │ │ 85/100     │ │ 3         │ │
│  │ ▲ 23%      │ │ ▲ 15%      │ │ ▲ 5pts     │ │ ─         │ │
│  └────────────┘ └────────────┘ └────────────┘ └───────────┘ │
│                                                             │
│  ┌─────────────────────────┐  ┌──────────────────────────┐   │
│  │ AI Usage Over Time      │  │ Tool Distribution      │   │
│  │ [Line chart]            │  │ [Pie/Donut chart]      │   │
│  └─────────────────────────┘  └──────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Recent Activity                                      │   │
│  │ • Project A: 12 commits, 450 tokens (Cursor)        │   │
│  │ • Project B: 8 commits, 120 tokens (Copilot)        │   │
│  │ • Project C: 3 commits, 0 tokens                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Notification & Alerting

### Alert Triggers

| Trigger Type | Condition | Priority |
|-------------|-----------|----------|
| Budget | Token usage exceeds 80% of monthly budget | High |
| New Tool | New AI tool detected in environment | Medium |
| Setup Gap | Critical tool missing for project type | Medium |
| DORA Decline | Deployment frequency drops 20% | High |
| Anomaly | Unusual spike in token usage | Medium |

### Weekly Summary Example

```
📊 Your Week in Code (April 8-14)

AI Usage: 450K tokens ($4.50)
├─ Cursor: 351K tokens (78%)
├─ Copilot: 99K tokens (22%)
└─ Claude Code: 0 tokens

Git Activity: 23 commits (↑15% vs avg)
├─ app-tracker: 12 commits
├─ api-service: 8 commits
└─ docs: 3 commits

Tools: 12 installed, 1 new (Ruff)
Setup Score: 85/100 (+5 from last week)

💡 Tip: Your Cursor usage is up 30%. 
   Consider reviewing your custom instructions 
   for better code quality.
```

### Notification Channels

| Channel | Use Case | Frequency |
|---------|----------|-----------|
| In-app badges | Real-time alerts | Immediate |
| System notifications | Budget warnings | As needed |
| Email summaries | Weekly digest | Weekly |
| Slack/Discord | Team metrics | Daily/Weekly |

---

## Design System Recommendations

### Color Palette

| Usage | Light Mode | Dark Mode |
|-------|-----------|-----------|
| AI metrics | Purple (#7C3AED) | Violet (#A78BFA) |
| Human metrics | Teal (#0D9488) | Emerald (#34D399) |
| Success | Green (#10B981) | Green (#34D399) |
| Warning | Amber (#F59E0B) | Yellow (#FBBF24) |
| Error | Red (#EF4444) | Red (#F87171) |
| Background | Gray 50 (#F9FAFB) | Gray 900 (#111827) |
| Surface | White | Gray 800 (#1F2937) |

### Component Patterns

**Metric Card**:
```
┌────────────────────────────┐
│ Icon  Title           [?]  │
├────────────────────────────┤
│                            │
│      Large Value           │
│      Small trend indicator │
│                            │
│ Sparkline graph            │
└────────────────────────────┘
```

**Progress Bar with Segments**:
```
AI Contribution: 67%
[████████████░░░░░░]
 AI    Human
 67%    33%
```

**Tool Chip**:
```
┌────────────────────┐
│ [icon] Tool Name   │
│ v1.2.3    [status] │
└────────────────────┘
```

### Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Color not sole indicator (use icons + text)
- Keyboard navigation support
- Screen reader labels for charts
- Reduced motion support

---

## Mobile Considerations

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1200px) | Full dashboard, side-by-side charts |
| Tablet (768-1200px) | Stacked sections, 2-column grids |
| Mobile (<768px) | Single column, collapsible sections |

### Mobile-First Metrics

- Quick stats cards (swipeable)
- Simplified trend sparklines
- Focus on alerts and notifications
- Quick actions (log AI usage, view projects)

---

## Summary

- **Layout**: Overview → Detail drill-down pattern
- **Visualizations**: Time series for trends, bars for distribution, heatmaps for patterns
- **AI Context**: Prominent AI vs human attribution, token/cost tracking
- **Notifications**: Proactive budget alerts, weekly summaries
- **Design**: Dark mode first, accessible, responsive
- **Balance**: CLI for power users, GUI for exploration