# PROMPT — Visual Automation Builder: Replace Raw DSL with Human-Friendly UI

## Raw Request

"I think you're missing a lot of the points with the compositions or whatever feature that you've just added. The purpose of this thing is to make so that the AI is the one doing everything, right? Currently with this current UI and everything is not following any of the human centric thing because it's just an empty UI with a new rule button, in which there's a DSL source in which there is no sort of any actual something that the human can learn from, right? Because it isn't language, it is a syntax that there's no guide on and it should be that the AI agent is the one that is able to make those. The human should just be able to instruct what are the automations that they want and the AI should be the one that actually creates the rule. The query is the rule alongside the category and the lifecycle and the priority and stuff like that. Like the DSL source, if you want the humans to be doing it, I need you to make sure that we have a proper UI and not just write it as a code because that means it's too complicated. Can you make a UI system out of it? I would like you to use the generate prompt skills to make sure that there is the UI for it. There's a UI that represents the code, so it's a UI based coding system where you can have, for example, if you want to customize something and something like that, or just basically rely on AI systems to be able to do so. You can have the two options of just yapping your request or you can have the UI that can represent any of the types, any of the sorts of events. Basically creating UI for creating any of those sequence and how we can make it so that it's more user-friendly. I would like you to generate prompt skills. Just give a context on what has currently been implemented because the AI has already know what are the things that we're talking about about this automation thing. The AI is the one that is creating the automation system for you to implement. Just give the context so forth and things that are included in the UI. During prompts that is able to design how do we create UI to make it so that it's more user-friendly and is actually UI based and not just a raw code DSL because there's no instructions. There's no guidelines. There's no guidebook for me to know how to write in the proper syntax. And again, those two modes being the user-interactive UI properly and the gapping just basically having it inside of the feature of the AI system canvas or whatever deck mode it is so that the AI is natively able to create it for us. And it's able to show on the deck. And I feel like it's not. I feel like we need to be able to show it on the canvas mode as well. You need to be able to show where the automation is so measured, how the UI for the canvas and the deck mode as well. So the console is just a way for us to view it in more details and customize it in more details. But as in like showing the process of AI making it and showing the list of automations that we have you should be on the deck both in the deck canvas mode and the canvas mode as well."

## Context Bundle

Read `CONTEXT_BUNDLE.md` in this folder. It contains the existing composition system, DSL syntax, data sources, actions, conditions, and current UI code. The target AI must read it first.

## Problem Statement

The RHEO Compositions system has a powerful DSL engine but a terrible user experience:

1. **Raw DSL editor** — Users must write `on finance.transaction.created if amount > 100 do notify:message 'Large transaction'` by hand. No syntax guide, no autocomplete, no validation feedback beyond "error at line 1."

2. **No AI integration** — The AI assistant can't create automations from natural language. The user must manually translate "remind me when I get an email from my boss" into DSL syntax.

3. **Hidden from main view** — Automations are buried in a separate compositions panel. They should be visible as cards in both Deck and Canvas modes alongside other AI-generated content.

4. **No visual representation** — There's no way to see what an automation does at a glance. No trigger icon, no action indicator, no status badge, no "last fired" timestamp.

## The Mandate

Design a **Visual Automation Builder** with two modes:

### Mode 1: AI-Native (Conversational)
- User describes automation in natural language in the AI chat
- AI generates the rule and spawns an automation card on the Canvas/Deck
- Card shows: name, trigger, conditions, action, status, last fired
- User can click to edit, toggle enable/disable, or dismiss

### Mode 2: Visual Builder (Interactive UI)
- User clicks "Create Automation" → opens a step-by-step visual wizard
- **Step 1 — Pick Trigger:** Visual grid of available triggers grouped by data source
  - Each trigger: icon + name + description + data source badge
  - Examples: "📧 New Email Received", "✅ Goal Completed", "💰 Transaction Over $100", "🎯 Session Ended"
- **Step 2 — Set Conditions:** Visual condition builder (NO raw code)
  - Each condition row: [Field dropdown] [Operator dropdown] [Value input]
  - Add/remove rows with + button
  - AND/OR toggle between conditions
  - Visual preview: "When [trigger], if [condition 1] AND [condition 2]"
- **Step 3 — Pick Action:** Visual grid of available actions
  - Each action: icon + name + description + required params badge
  - Examples: "🔔 Send Notification", "📅 Add to Schedule", "⏰ Create Deadline", "📧 Send Email"
- **Step 4 — Configure Action:** Form fields based on action type
  - notify: message textarea
  - schedule:add: title, day picker, start/end time
  - deadline:add: title, datetime picker, priority selector
  - goal:create: title, category dropdown
- **Step 5 — Review & Save:** Human-readable summary, name, category, priority, enable toggle
  - Shows: "When I receive an email from boss@company.com → Send notification: 'Email from boss'"
  - DSL is generated in the background — user never sees it

### Visibility in Deck + Canvas
- New card type: `automation` (added to CardType union)
- Automation card visual:
  - Header: trigger icon (colored by data source) + rule name
  - Body: "When [trigger] → [action]" summary line
  - Footer: status badge (active/paused), last fired time, enable/disable switch
  - Actions: Edit, Test Run, Delete
- Appears in Deck mode as a slot (like connectors, schedule, deadlines)
- Appears in Canvas mode as a draggable card (like focus, plan, digest)
- Automation cards use the glass card pattern with accent color from their trigger source

## Design Specifications

### Visual Builder Layout
- Full-screen modal (like CompositionEditorModal but visual)
- Left panel: trigger/condition/action configuration (60% width)
- Right panel: live preview of the rule in human-readable format (40% width)
- Bottom bar: Cancel, Save, Save & Enable buttons
- Stepper indicator at top: 1→2→3→4→5 with current step highlighted

### Trigger Grid
- 3-column grid of trigger cards
- Each card: icon (32px, colored), name (bold), description (muted), data source badge
- Selected state: border accent color, subtle glow
- Grouped by data source with section headers

### Condition Builder
- Vertical stack of condition rows
- Each row: flex layout with 3 fields
- Field dropdown: populated from trigger's available fields
- Operator dropdown: eq, neq, gt, lt, contains, starts with, ends with
- Value input: text/number/date based on field type
- Add row button: dashed border, + icon
- Remove row: X button on each row
- Logic toggle: AND/OR pill toggle between rows

### Action Grid
- 2-column grid of action cards
- Each card: icon (32px, colored), name (bold), description (muted), param count badge
- Selected state: border accent color

### Action Configurator
- Dynamic form based on selected action type
- Each field: label + input/select/textarea with placeholder
- Required fields marked with asterisk
- Validation on save

### Automation Card (Canvas/Deck)
```
┌─────────────────────────────────────────┐
│ 📧 Email from Boss                    ⋮  │
│ ─────────────────────────────────────── │
│ When email received from boss@company  │
│ → Send notification                    │
│ ─────────────────────────────────────── │
│ ● Active    Last fired: 2h ago    [⚡]  │
└─────────────────────────────────────────┘
```
- Trigger icon colored by source (email=cyan, goals=emerald, finance=amber, etc.)
- Status dot: green=active, gray=paused
- Last fired: relative time
- Quick action: test run button

### AI Integration
- AI detects automation intent from chat message
- Parses: trigger, conditions, action from natural language
- Spawns automation card on canvas
- Card appears with entrance animation (cardEnterVariants)
- User sees: "I've created an automation for you: [card]"

## MCP Component Inventory

### shadcn (available via MCP)
| Component | Source | Use for |
|-----------|--------|---------|
| select | shadcn | Trigger/action/field/operator dropdowns |
| input | shadcn | Value inputs, rule name |
| textarea | shadcn | Notification message, AI description |
| switch | shadcn | Enable/disable toggle on cards |
| slider | shadcn | Priority slider |
| checkbox | shadcn | Multi-select conditions |
| radio-group | shadcn | Single-select options |
| form | shadcn | Action configurator form |
| dialog | shadcn | Visual builder modal |
| card | shadcn | Automation card base |
| badge | shadcn | Data source badges, status badges |
| tabs | shadcn | Builder step tabs |
| collapsible | shadcn | Expandable condition groups |
| toggle | shadcn | AND/OR logic toggle |
| toggle-group | shadcn | Trigger/action type selector |
| tooltip | shadcn | Icon tooltips on cards |
| separator | shadcn | Visual dividers in cards |
| scroll-area | shadcn | Scrollable trigger/action grids |
| popover | shadcn | Quick-edit popovers |
| command | shadcn | Search triggers/actions |

### Magic UI (available via MCP)
| Component | Source | Use for |
|-----------|--------|---------|
| animated-beam | Magic UI | Connect trigger→condition→action flow lines |
| border-beam | Magic UI | Active automation card glow |
| animated-list | Magic UI | Automation list entrance animation |
| bento-grid | Magic UI | Trigger/action card grid layout |
| confetti | Magic UI | Automation created celebration |
| blur-fade | Magic UI | Card entrance transition |

### Lucide Icons (installed, 1500+)
| Icon | Use for |
|------|---------|
| Zap | Automation trigger |
| GitBranch | Condition branch |
| Play | Test run |
| Pause | Pause automation |
| Bell | Notification action |
| Mail | Email trigger/action |
| Calendar | Schedule action |
| Clock | Deadline action |
| Target | Goal trigger/action |
| CheckCircle | Completion |
| AlertTriangle | Warning |
| Plus | Add condition/row |
| Pencil | Edit |
| Trash2 | Delete |
| ChevronDown | Expand/collapse |
| ArrowRight | Flow direction |
| Filter | Condition |
| Settings | Configuration |
| ToggleLeft/Right | Enable/disable |
| Workflow | Automation |
| Split | Condition branch |
| Merge | Combine conditions |
| GitCommit | Action step |

## Anti-Slop Checklist
1. Re-skin to DeskFlow tokens (ACCENT colors from tokens.ts)
2. Max rounded-xl, p-5 padding
3. Dark mode only
4. Geist Sans + JetBrains Mono fonts
5. Glass layer: bg-[rgba(24,24,27,0.60)] backdrop-blur-xl
6. Motion: use existing motion.ts variants (sectionVariants, itemVariants, dialogVariants)
7. Icons: all from lucide-react, no emoji
8. Empty states: "No automations yet" with Zap icon
9. Loading states: skeleton cards
10. Error states: validation messages inline

## Constraints
- Must use existing DSL engine (CompositionEngine, lex, parse, scopeCheck)
- Must use existing IPC handlers (compositions:create, compositions:update, compositions:delete, compositions:evaluate)
- Must work in both Deck and Canvas modes
- DSL generation must happen in the background (user never sees raw code)
- Automation cards must persist via canvas state (localStorage)
- Must respect prefers-reduced-motion
- No new npm packages — use existing framer-motion, lucide-react, shadcn components

## Output Format

Provide:
1. **Component architecture** — all new files with exact paths, all modified files with exact changes
2. **Visual Builder UI spec** — exact layout, every dropdown's options, every form field
3. **AutomationCard component** — full React component spec with props, states, rendering
4. **DSL generation logic** — function that converts visual inputs to DSL strings
5. **AI integration** — how AI parses natural language into automation rules
6. **Canvas/Deck visibility** — how automation cards appear in both modes
7. **Animation specs** — entrance, execution, completion for automation cards
8. **Trigger/Action data** — complete lists of available triggers (with fields) and actions (with params)
