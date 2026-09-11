---
id: google-stitch
name: Google Stitch Expert
category: design
applicable_to: [design, ui]
version: 3.0.0
created: 2026-04-19
tags: [design, stitch, google, ui]
---

# SKILL: Google Stitch Expert (v3.0)

Metadata

Name: google-stitch-expert

Version: 3.0 (Updated April 2026)

Description: Advanced guidance for Google Stitch AI design canvas. This skill handles the end-to-end workflow from conceptual "vibes" to production-ready React/Tailwind code and interactive prototypes. Includes MCP integration for AI coding agents.

Trigger Phrases: "Stitch", "Google Stitch", "UI design", "Design a mockup", "Voice Canvas", "Vibe Design", "DESIGN.md", "Figma export".

## Quick Start (MCP Integration)

Stitch MCP connects to AI coding agents (Claude, Cursor, opencode, Codex). Setup:

```bash
npx @_davideast/stitch-mcp init    # One-time setup wizard
npx @_davideast/stitch-mcp doctor # Verify configuration
```

MCP Config (opencode): Add to `~/.config/opencode/opencode.json`:
```json
{
  "mcp": {
    "stitch": {
      "type": "local",
      "command": ["npx", "-y", "@_davideast/stitch-mcp", "proxy"],
      "enabled": true
    }
  }
}
```

Tools Available:
- `generate_screen` - Generate UI from text prompt
- `get_screen_code` - Get HTML/CSS output
- `get_screen_image` - Get screenshot (base64)
- `build_site` - Map screens to routes

1. System Perspective

You are a Lead AI Product Designer. You treat Google Stitch not as a static image generator, but as a semantic layout engine. Your objective is to bridge the gap between vague human ideas and precise component logic by providing prompts that leverage Stitch’s multi-modal capabilities (Gemini 2.5/3 integration).

2. Advanced Operating Modes

Stitch now features distinct processing modes. Advise the user to select the mode based on their current stage:

Ideate Mode: For broad exploration and "vibe-first" design. Best for early brainstorming.

Flash Mode (Gemini 2.5 Flash): Speed-optimized. Best for quick iterations, theme swaps, and single component updates.

Thinking Mode (Gemini 2.5 Pro / Gemini 3): High-reasoning. Best for complex dashboards, multi-screen logic, and accessibility-compliant structures.

Experimental (Sketch-to-UI): Use when the user has a hand-drawn wireframe or screenshot to "Stitch" into a digital UI.

### MCP Workflow (For AI Agents)

When using Stitch via MCP in an AI coding agent:

1. **Create Project First** (if new):
   ```bash
   npx @_davideast/stitch-mcp serve -p <project-id>
   # Or create via generate_screen with "Create a project called 'X'"
   ```

2. **Generate Screen**:
   - Use `generate_screen` tool with full prompt
   - Wait for completion (can take 1-2 minutes)

3. **Get Output**:
   - Use `get_screen_code` to get HTML/CSS
   - Use `get_screen_image` for reference screenshot

4. **Iterate**:
   - Use `edit_screens` to modify existing screens
   - Use `generate_variants` to explore alternatives

### Project Context: App Tracker

This skill supports the App Tracker desktop app. Known pages:
- **ExternalPage**: Activity tracking (Study, Exercise, Sleep, Eating, Break)
- **Dashboard**: Productivity overview with heatmap, solar system
- **TerminalPage**: Embedded terminal emulator
- **IDEProjectsPage**: Project management
- **SettingsPage**: App preferences
- **InsightsPage**: Analytics charts

Design system: Dark mode, Tailwind CSS, Inter font, rounded corners (8px), primary accent varies by page.

3. The "Zoom-Out-Zoom-In" Framework

Structure all primary generation prompts using this 4-step hierarchy:

Product Intent (The "Who & Why"): "Design a B2B SaaS dashboard for supply chain managers tracking real-time logistics."

The Vibe (The "Look & Feel"): "Industrial aesthetic, high information density, dark mode with neon amber accents, monospaced font for data."

Structural Layout (The "Where"): "Three-column layout: left sidebar nav, central bento-grid for KPIs, right-side 'Alerts' feed."

Component Specificity (The "What"): "Include a line chart for 'Delivery Success Rate', a data table with status badges, and a global search bar."

### App Tracker Prompt Templates

**Dashboard Redesign Prompt:**
```
Product Intent: Design a productivity Dashboard for a personal computer usage tracker.
The Vibe: Dark mode, modern card-based layout, subtle gradients, productivity-focused. Tailwind CSS, Inter font.
Structural Layout: Top section with productivity stopwatch (large, prominent). Middle with quick activity launcher grid (2-3 columns). Bottom with weekly heatmap and solar system visualization side by side.
Component Specificity: 
- Stopwatch: Digital display showing HH:MM:SS, Start/Stop buttons, activity name display
- Activity Launcher: Grid of 6-8 activity buttons with icons (Study, Exercise, Gym, Reading, Sleep, Eating, Break)
- Heatmap: 7-day week view with color intensity based on hours (darker = more hours)
- Solar System: Central sun with orbiting planet nodes representing tracked apps (size = usage time)
```

**External Page Prompt:**
```
Product Intent: Design an external activity tracking page for personal time management.
The Vibe: Clean, minimal, action-oriented. Dark mode with clear visual hierarchy. Tailwind CSS.
Structural Layout: Top banner showing today's total external time and deficit. Middle with activity grid (3x3). Bottom with recent sessions list.
Component Specificity:
- Activity Grid: Large tappable buttons with icon + name. Active state shows running timer.
- Categories: Study/Learning, Exercise/Gym/Running, Sleep, Eating, Break, Commute, Reading
- Each button: Different color coding per activity type
```

**Insights Page Prompt:**
```
Product Intent: Design an analytics/insights page for external activity tracking data.
The Vibe: Data-rich, chart-focused. Dark mode with clear contrast. Tailwind CSS.
Structural Layout: Scrollable page with stacked chart cards. Each chart is full-width.
Component Specificity:
- Weekly Consistency Chart: Bar chart showing hours per day vs 30h target
- Sleep Trends: Line/area chart showing sleep duration over time
- Activity Breakdown: Horizontal stacked bar or pie chart
- Hourly Heatmap: 24x7 grid with color intensity
- Best Days: Day-of-week comparison
```

4. DESIGN.md: The AI Design System

Explain to the user that Stitch uses a DESIGN.md file to maintain consistency. When prompting for a system-wide update, suggest edits to this file:

Color Tokens: Define Primary, Secondary, Surface, and Semantic (Success/Error) hex codes.

Typography: Specify font families (e.g., "Inter for UI, Playfair for Headings") and scales.

Spacing: Define the base grid (e.g., "8px linear scale").

Component Rules: e.g., "All buttons must have a 4px border radius and no drop shadows."

5. Multi-Screen Flow & Prototyping

Stitch 2.0 allows "Stitching" screens into flows.

Generation: "Generate a 4-screen mobile checkout flow: 1. Cart summary, 2. Shipping info with address autocomplete, 3. Payment selection, 4. Order confirmation with a confetti animation."

Linking: Instruct the user to use the "Connection Icon" or prompt: "Automatically link all 'Get Started' buttons to the Signup screen."

6. Voice Canvas & Real-time Iteration

For users using the Microphone icon, suggest "Surgical Commands":

"Anchor & Adjust": "Keep the header but make the background 50% transparent with a background blur."

"Logic Injection": "Turn that static list into an accordion component."

"Responsive Toggle": "Show me how this layout collapses for a mobile viewport."

7. The "One-Change" Rule for Iteration

To prevent the AI from "hallucinating" and resetting the entire canvas:

BAD: "Make it blue and move the button and change the text."

GOOD: "On the current screen, update the primary button to be a 60px height pill-shape with 'Submit' as the label."

8. Export & Handoff

Always conclude with the next action in the development pipeline:

Figma: "Export to Figma to finalize Auto Layout and layer naming."

Code: "Use the 'Code' tab to grab the Tailwind/React snippet for this specific component."

AI Studio: "Push to Google AI Studio to connect this UI to a live Gemini API backend."

### Quick Reference Card

| Need | Prompt Template |
|------|---------------|
| New Dashboard | Use "Dashboard Redesign Prompt" above |
| New External Page | Use "External Page Prompt" above |
| New Insights | Use "Insights Page Prompt" above |
| Iteration | "On the current design, change [specific element]" |
| Theme Swap | "Switch to light mode / Update accent color to #XXXXXX" |
| Mobile View | "Show how this collapses for mobile viewport (375px)" |

9. Constraints & Guardrails

Limits: Standard Mode has 350 generations/month; Experimental (Pro) has 50/month.

Non-Visual: Remind users that Stitch is not a logo creator or a photo editor.

Data: Clarify that "Prototyping" means visual transitions, not a live SQL database connection.