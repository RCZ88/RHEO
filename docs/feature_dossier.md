# RHEO Feature Dossier

| Feature | What it does | Real UI vocabulary | Distinctive data/viz | Status |
|---|---|---|---|---|
| **Conductor** | Multi-agent orchestration console. Spawns Claude Code or Opencode agents, assigns missions with autonomy levels (L1–L4), monitors agent nodes in a tree, routes escalations to an approval inbox. | "New Mission", "Autonomy Level", "L1/L2/L3/L4", "Opencode", "Claude Code", "Approval Inbox", "Escalations", "Swarm Log", "Active Nodes", "Pending Children" | Org tree graph (nodes = agents, edges = parent→child), swarm trace waterfall (message flow between agents) | BETA |
| **Trace** | Live activity timeline capturing app usage, browser sessions, and focus blocks. Aggregates raw events into daily/weekly views with tier classification. | "Activity", "Apps", "Websites", "Focus", "Productivity", "External", "Rankings", "LIVE", "Today/Week/Month/All Time", "Smart Fill" | Timeline bars, session blocks, tier breakdown (productive/neutral/distracting) | SHIPPED |
| **Context Brain** | Aggregates context from active sessions, documents, and AI conversations into a searchable knowledge surface. Shows what the AI "knows" about your work. | "Context Brain", "Brain Status", "Context Dashboard", "Session Groups", "Agent Comms" | Context graph (nodes = concepts, edges = co-occurrence), brain status panel (memory usage, active contexts) | BETA |
| **Session Search** | Full-text search across all recorded sessions, AI conversations, and activity logs. Filterable by date, type, and project. | "Session Groups", "Search", "Filter", "Date Range", "Project" | Search results list with highlighted matches, session cards | BETA |
| **Lyceum** | Personal learning library. Organizes lessons into branches (disciplines) and groups (custom categories). Supports spaced repetition and AI-generated quizzes. | "LYCEUM LEARN", "Browse Library", "New Lesson", "Read a sample", "Features", "Branch", "Group", "Computer Science & AI", "Core Fundamentals", "A library that writes itself" | Lesson cards, branch/group hierarchy, progress indicators | SHIPPED |
| **Content Engine / Studio** | 8-stage content production pipeline. Brainstorm ideas → develop episodes → organize series → apply themes → track analytics → extract lessons → build frameworks → document processes → compile playbooks. | "CONTENT ENGINE", "8-stage pipeline", "Ideas", "Episodes", "Series", "Themes", "Analytics", "Lessons", "Frameworks", "Process", "Playbook", "Brainstorm", "Pipeline active" | Pipeline stage navigator (vertical sidebar), stage-specific views with transition animations | SHIPPED |
| **IDE Projects** | Tracks development work across repositories. Monitors AI tool usage (tokens, costs, sessions), git activity, problems, and feature requests per project. | "IDE Projects", "LIVE", "Focus", "Total", "Today/Week/Month/All Time", "Smart Fill", "Token usage by tool", "Spending by tool", "Agent usage distribution", "Active vs completed", "Issue pipeline", "Feature request pipeline", "Languages across projects" | Token/cost bar charts, issue pipeline donut, language distribution list, daily activity trend line | SHIPPED |
| **External Tracking** | Captures time spent outside the desktop app — manual entry, phone sync, and integrations. Bridges gaps in the automatic tracking record. | "External", "Manual Entry", "Phone Sync", "Gap Fill", "Missed Time", "AFK Prompt" | Gap timeline, missed-time heatmap | BETA |
| **Life Phases** | Personal commitment tracker. Define life areas (health, relationships, creative, etc.), set streaks, log daily activities, and visualize momentum over time. | "Life", "Routines", "Deep Focus", "Upcoming Reminders", "Focus Sessions", "Goals", "Streak", "Quick Activities", "Schedule", "Momentum" | Phase river (horizontal streak bars), momentum score (0–100), daily goal completion rings | SHIPPED |
| **Resume** | Build and export resumes from tracked work data. Multiple templates, import from LinkedIn/GitHub, preview, and export to PDF. | "Resume", "Builder", "Preview", "Import", "Export", "Templates", "LinkedIn", "GitHub", "PDF" | Resume preview pane, template selector, import wizard | SHIPPED |
| **Finance** | Personal finance tracker. Log transactions, categorize spending, set budgets, and visualize cash flow. Syncs with bank accounts via Plaid (planned). | "Finance", "Transactions", "Categories", "Budgets", "Cash Flow", "Income", "Expenses", "Net Worth" | Spending by category donut, cash flow line chart, budget progress bars | BETA |
| **Research Digest** | Curated feed of relevant articles, papers, and news based on your projects and interests. AI-summarized with citation links. | "Research Digest", "Sources", "Summaries", "Citations", "Topics", "Refresh" | Article cards with AI summaries, citation badges, topic tags | SOON |
| **Mobile Companion** | iOS/Android app for on-the-go time tracking, quick activity logging, and phone-based focus sessions. Syncs with desktop via relay. | "Pair Phone", "Mobile", "Sync", "Relay", "Quick Log", "Focus Timer" | Phone pairing QR code, sync status indicator, mobile activity feed | BETA |
| **Marketplace** | Template and plugin marketplace. Share and import dashboard layouts, automation rules, and content frameworks. | "Marketplace", "Templates", "Plugins", "Import", "Export", "Share", "Install" | Template cards, install counts, rating stars | VISION |
| **Terminal Workspace** | Integrated terminal emulator. Run shell commands, git operations, and scripts without leaving the app. Supports multiple tabs and custom themes. | "Terminal", "Tab", "Shell", "PowerShell", "bash", "cmd", "New Tab", "Split", "Theme" | Terminal tabs, shell prompt, command history, output buffer | SHIPPED |
| **Agentic System** | Unified dashboard for multi-agent communication, session management, and context visualization. Combines Conductor, Context Brain, and session groups into one view. | "Agentic System", "Multi-agent communication", "Session groups", "Context brain", "Agent Comms", "Session Group", "Brain Status", "Context Dashboard" | 4-panel grid layout (comms, context, sessions, brain status), real-time update indicators | BETA |

---

## Power User Command Strings (Act III Console)

1. `conductor spawn --agent claude --autonomy L3 --objective "Refactor auth module to use JWT rotation" --watch`
2. `trace export --from "2026-08-01" --to "2026-08-31" --format csv --include focus,sessions,tokens`
3. `lyceum import --source obsidian --vault "CZVault" --branch "Computer Science & AI" --group "Core Fundamentals"`

---

## 5 Most Distinctive Nouns

1. **Conductor** — the multi-agent orchestration layer (not "agent manager" or "swarm")
2. **Phase** — a named block of time with single intent (deep work, meetings, rest)
3. **River** — the horizontal streak visualization in Life Phases
4. **Engine** — the 8-stage content pipeline (Content Engine), not "studio" or "creator"
5. **Brain** — the context aggregation surface (Context Brain), not "memory" or "graph"
