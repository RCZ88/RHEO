Project Specification: AI Session Commander
1. Project Overview
Build a desktop application designed to manage multiple AI coding agents (Claude Code, OpenCode, Gemini CLI, Aider, etc.) and custom terminal workflows. The application consists of two distinct windows belonging to the same process:

The Command Center (Tracker App): The "Brain." A dashboard displaying metadata about active sessions, a visual layout editor, and preset controls.
The Execution Environment (Terminal Window): The "Body." A dedicated window containing a tiling terminal manager where agents actually run.
2. Tech Stack
Framework: Tauri (Rust + Webview) OR Electron (Node.js + Chromium). Tauri is preferred for performance.
Frontend: React + TypeScript + Tailwind CSS.
Terminal Emulator: xterm.js (frontend) + node-pty or portable-pty (backend).
State Management: Zustand (for global state shared across windows).
3. Architecture: Multi-Window State Sync
The application launches with the Command Center as the main window.
The Terminal Window is a secondary window created on startup (or on demand).
Both windows share the same Rust/Node backend and Global State Store. When the user changes a layout in the Command Center, the Terminal Window updates instantly.
4. Core Features
A. The Terminal Window (Execution Environment)
Custom Tiling Engine: Do NOT use standard tabs. Implement a recursive split layout engine.
Splits: Terminals can be split horizontally or vertically recursively.
Layouts: Users can create layouts like "2 columns", "1 large + 2 small rows", etc.
Session Persistence: The state of terminals (cwd, running process, environment variables) must persist across app restarts.
PTY Management: Spawn pseudo-terminals in the backend. Stream data to the frontend via IPC.
B. The Command Center (The Brain)
Visual Layout Mapper:
Display a visual representation (rectangles) mirroring the real Terminal Window layout.
Metadata Overlays: Hovering/clicking a rectangle reveals:
Agent Type (Claude, OpenCode, etc.)
Current Topic/Task (inferred from chat or user-defined)
Session ID (for resuming)
Working Directory
Last Active Time
Layout Control:
Drag & Drop: Users can drag terminal representations in the Command Center to rearrange them in the real Terminal Window.
Snap Points: Implement "Lock Points" during drag operations. When dragging a terminal over an edge/corner of another, show a visual overlay indicating a split (e.g., "Split Left", "Split Bottom"). Upon dropping, the backend executes the split command.
Command Presets:
Allow users to define named commands (Presets).
Example: "Run Tests" -> npm test, "Start Backend" -> python main.py.
Clicking a preset targets a specific terminal in the Terminal Window and executes the command.
C. Agent Intelligence (The Tracker)
Process Monitoring: Track the PID of shell processes running inside PTYs.
Context Extraction (Hybrid Approach):
Wrapper Mode: When the user runs an agent (e.g., claude), intercept it via a shell integration script to capture the Session ID immediately.
File Watcher Mode: Background watchers monitor agent data directories (e.g., ~/.claude/projects, ~/.local/share/opencode). Parse SQLite/JSONL files to extract:
Chat Topic/Title
Usage Stats (Tokens)
Resume Commands
Topic Inference: Analyze the first user prompt of a new chat to generate a short "Topic" label for the Command Center.
5. UI/UX Implementation Details
Terminal Window
Header Bar: Minimalist. Shows current directory and "smart title" (auto-detected).
Split Controls: Subtle buttons on pane borders to split or close.
Active State: Highlight the border of the active terminal pane.
Command Center
Dashboard View: Main grid showing the terminal layout map.
Info Sidebar: Contextual details when a terminal is selected.
Preset Panel: A list of saved commands organized by project or category.
Action Buttons: "Resume Session", "Kill Process", "Clear Terminal".
6. Data Structure (Global Store)
interface AppState {  terminals: {    [id: string]: {      pid: number | null;      cwd: string;      title: string; // "Auto-detected" or "User defined"      agentType: 'claude' | 'opencode' | 'gemini' | 'generic';      agentSessionId: string | null; // Resume ID      layoutRole: 'root' | 'split-horizontal' | 'split-vertical';      parentId: string | null;      size: number; // Percentage of parent    }  },  presets: {    id: string;    name: string;    command: string;    icon: string;  }[],  activeLayoutId: string;}
7. Specific Implementation Steps
Step 1: Scaffold the Tauri/Electron app with multi-window support.
Step 2: Build the PTY backend service capable of spawning terminals and streaming output.
Step 3: Create the xterm.js component and the tiling layout logic (Recursive Tree structure).
Step 4: Build the Command Center UI and implement the Layout Mapper (rectangles).
Step 5: Implement the Drag & Drop logic in the Command Center that sends IPC commands to the Terminal Window to restructure the DOM/layout.
Step 6: Implement the Agent File Watchers to update terminal metadata automatically.