Project Specification: AI Session Commander (Electron Edition)
1. Role & Objective
You are a Senior Full-Stack Developer specializing in Electron + React + TypeScript. Your task is to build a desktop application called "AI Session Commander."

This app manages multiple AI coding agents (Claude, OpenCode, Gemini, etc.) and project workflows through a split-screen terminal interface. It features a "Project Workspace" page that acts as the central hub for usage analytics, session history, and terminal layouts.

2. Tech Stack (Strict)
Framework: Electron (Main Process) + React (Renderer Process).
Language: TypeScript.
Styling: Tailwind CSS + ShadcnUI (or Ant Design) for clean UI components.
Terminal Core: node-pty (backend) + xterm.js (frontend).
State Management: Zustand (shared between Main/Renderer via IPC).
Database: SQLite (local, for app state) + Raw File Reading (for agent data).
3. Implementation Checklist
Phase 1: The Terminal Engine (Recursive Splits)
Requirement: Implement a recursive tiling engine. Do not use simple tabs.

 Data Structure: Create a recursive tree structure to manage layouts.
A node can be a TerminalPane (leaf) or a SplitContainer (branch).
SplitContainer must track direction (horizontal | vertical) and child ratios (e.g., 0.5/0.5).
 Recursive Component: Build a React component <LayoutNode node={node} />.
If node.type === 'split': Render a flex div (row or column) and map children recursively.
If node.type === 'pane': Render the TerminalView component.
 Splitting Logic:
Implement actions: splitHorizontal(id) and splitVertical(id).
Logic: Find the target node in the tree, wrap it in a new SplitContainer, insert a new sibling TerminalPane.
UI Control: Add hover buttons on panes (Split H, Split V, Close).
 Persistence: Save the layout tree to LocalStorage/SQLite on every change so it restores on restart.
Phase 2: The "Project Workspace" Page (Main Hub)
Requirement: When a user selects a Project, this page serves as the "Biggest Menu" containing all features.

 Layout: Create a dashboard split into clear sections:
Top: Project Header (Name, Path, Git Branch).
Left Column: "Live Terminals" (Visual Map) & "Presets".
Right Column: "Analytics" & "Session History".
 Visual Terminal Map:
 Display a miniaturized visual representation of the terminal split layout using rectangles.
 Hover Interaction: Hovering a rectangle shows a tooltip with details:
Agent Name (e.g., Claude, OpenCode).
Session Topic (if detected).
PID.
Working Directory.
 Drag & Drop: Allow dragging these rectangles to reorder splits visually. Update the live terminal window instantly.
 Command Presets:
 UI to Create/Edit/Delete presets (e.g., "Run Tests": npm test).
 "Run" button next to preset -> Opens a new split or targets an existing terminal and executes the command.
Phase 3: Usage Analytics & History (The Brain)
Requirement: Accurate tracking of daily and historical token usage.

 Scanner Service (Backend): Create a background service that runs every 60 seconds (or on file change) to scan agent directories.
 Claude Code Parser:
 Location: ~/.claude/projects/<project-hash>/
 Files: *.jsonl files.
 Logic:
Stream the JSONL files.
Sum usage.input_tokens and usage.output_tokens from message objects.
Extract timestamp to group by Day.
Calculate Cost: Input * (Price/1M) + Output * (Price/1M).
 OpenCode Parser:
 Location: ~/.local/share/opencode/opencode.db
 Logic:
Connect to SQLite.
Query usage_stats table.
Sum tokens by model and date.
 Cursor/Windsurf Parser:
 Location: ~/Library/Application Support/Cursor/User/workspaceStorage/*/chat.db (macOS) or %APPDATA%/Cursor/... (Windows).
 Logic: Query SQLite messages table for token counts or usage metadata.
 History View UI:
 Create a "History Tab" in the Project Workspace.
 List View: Show past sessions (Date, Agent, Topic, Cost).
 Agent Filter: Allow user to filter history by Agent type.
 Project Compilation:
 Logic: The backend must match cwd (Current Working Directory) of the session to the Project Path to attribute usage to the correct project.
 Aggregation: Display "Total Project Cost" and "Total Tokens" in the header.
 Daily Overview:
 A specific card/widget showing "Today's Usage".
 Pie chart or Bar chart breaking down usage by Agent (Claude vs OpenCode vs Gemini).
Phase 4: Session Management & Resume
 Resume Logic:
 Read the specific "Resume ID" from the agent's data files.
 In the UI, show a "Resume" button next to history items.
 Clicking "Resume" opens a new terminal pane and injects the specific command (e.g., claude --resume <id> or opencode resume <id>).
Phase 5: Project Management (Root Level)
 Project List Page:
 Allow users to define "Projects" (Point to a folder path).
 Calculate total usage across all agents for that project folder.
 Display a "Health Score" or "Activity Level" based on recent usage.
4. UX/UI Guidelines
Clean & Dense: Use data grids and compact cards. Do not waste vertical space.
Responsive Layouts: The "Project Workspace" should handle resizing gracefully.
Feedback: When parsing files in the background, show a subtle "Scanning..." indicator.
Error Handling: If a directory doesn't exist (e.g., user is on Windows but code looks for Mac path), log gracefully and skip.
5. Immediate Execution
Scaffold the Electron app with React/TypeScript.
Implement the Recursive Terminal Layout Engine first (Phase 1).
Build the UI for the Project Workspace (Phase 2).
Implement the File Scanners (Phase 3) to populate the data.
Please proceed with setting up the project structure and implementing Phase 1.