Understood. I’m locking these two decisions:

## Locked Decision 1 — Use the 3-pane “Studio IDE” layout

We will use the 3-pane layout because it makes the system feel complete, exposes all tools, and gives each pipeline stage a clear place to live.

The app should not feel like a heavy destructive video editor. It should feel like an **analysis + suggestion studio**:

> User brings a video → system analyzes it → AI/manual bridge produces suggestions → user reviews/approves suggestions → export uses the approved suggestions.

So the UI language should be:

- “Analyze”
- “Suggest cuts”
- “Review segments”
- “Preview overlays”
- “Approve plan”
- “Export suggestion”

Not:

- “Edit video”
- “Trim timeline”
- “Cut clips”
- “Destructive timeline editing”

That distinction is important.

---

## Locked Decision 2 — Store only local file paths, not the video itself

The Overlay Studio should not import, duplicate, or manage media like a traditional editor.

It should store a lightweight local project/session record such as:

```ts
interface OverlayStudioSession {
  id: string
  name: string

  sourceVideoPath: string
  sourceVideoName: string

  durationSec?: number

  transcriptPath?: string
  cutPlanPath?: string
  scenePlanPath?: string
  exportPlanPath?: string

  status:
    | 'created'
    | 'transcribing'
    | 'transcript_ready'
    | 'cut_plan_pending'
    | 'cut_plan_ready'
    | 'scene_plan_pending'
    | 'scene_plan_ready'
    | 'export_ready'
    | 'error'

  missingSource?: boolean

  createdAt: string
  updatedAt: string
}
```

The important part is:

```ts
sourceVideoPath: string
```

Not a copied video file.

The app should display:

- file name
- file path
- current pipeline status
- last updated time
- whether the source file is still available
- which artifact is currently active: transcript, cut plan, scene plan, export

This keeps the system lightweight and topic-agnostic.

---

# Refined Product Concept

The Overlay Studio is not a video editor.

It is a:

> **Video Overlay Suggestion Studio**

It analyzes a video, produces transcript and timing data, suggests cuts/overlays through AI or Manual Bridge, lets the user preview those suggestions on a 9:16 canvas, and then exports an overlay plan or final composite if rendering is available.

The UI should always make this clear.

---

# Updated 3-Pane Architecture

## Left Pane — Session Library + Pipeline Navigator

This pane answers:

> “Which video am I working on, and what stage am I in?”

### Top: Pipeline Status

A vertical pipeline indicator:

```text
1. Source
2. Transcript
3. Cut Plan
4. Scene Plan
5. Preview
6. Export
```

Each step has a state:

- complete
- active
- pending
- error
- missing dependency

Example:

```text
Source        ✓
Transcript    ✓
Cut Plan      Active
Scene Plan    Pending
Preview       Pending
Export        Pending
```

This makes the full feature set visible immediately.

### Middle: Video Sessions

Each session card shows:

- video file name
- shortened path
- duration if known
- status badge
- last updated
- missing file warning if path is invalid

Example card:

```text
lecture_part_1.mp4
~/Videos/tutorials/lecture_part_1.mp4

Transcript ready
Updated 2 minutes ago
```

Actions on hover:

- Open
- Reveal in Finder/Explorer
- Repoint missing file
- Remove session

Important: “Remove session” should only remove the local session reference, not delete the actual video file.

### Bottom: Utility Tools

Quick tools:

- Manual Bridge
- Validators
- Export Queue
- Settings

This prevents tools from being hidden inside obscure menus.

---

## Center Pane — Active Workspace

This is where the current stage is displayed.

The center pane changes based on the selected stage:

| Stage | Center Workspace |
|---|---|
| Dashboard | Session overview + tool cards |
| Source | File path, media info, missing source state |
| Transcript | Transcript editor |
| Cut Plan | Keep/cut review view |
| Scene Plan | Scene cards and overlay suggestions |
| Preview | 9:16 canvas + timeline scrubber |
| Export | Export options and output path |

This is the main “studio” surface.

---

## Right Pane — Contextual Inspector + Manual Bridge

This pane answers:

> “What can I do with the thing I currently have selected?”

It should be contextual.

When viewing transcript:

- segment details
- start/end time
- text
- keep/cut status
- AI confidence if available
- actions: keep, cut, split, merge, regenerate prompt

When viewing cut plan:

- summary of kept duration
- summary of removed duration
- approval controls
- repair prompt generator
- validation checklist

When viewing scene plan:

- overlay properties
- animation in/out
- emphasis words
- renderer badge
- safe-zone warnings

When using Manual Bridge:

- prompt display
- copy button
- paste area
- validation results
- repair prompt
- accept/reject result

This makes the tools visible and usable without cluttering the center workspace.

---

# Local Path-Based Session Behavior

Since the app only stores paths, we need clear UX for missing or moved files.

## Normal state

```text
Source file available
~/Videos/course/lesson_01.mp4
```

## Missing file state

If the stored path no longer exists:

```text
Source file missing
Expected at: ~/Videos/course/lesson_01.mp4

[Repoint File] [Remove Session]
```

The UI should not silently break.

It should show a dedicated empty/error state:

- title: “Source file missing”
- description: “The video path saved in this session no longer exists.”
- primary action: “Repoint file”
- secondary action: “Remove session reference”

This is important because path-only storage is fragile if files are moved.

---

# Recommended Session Storage Location

I recommend storing the session list in a local app-data JSON file, not inside the video folder.

Example conceptual location:

```text
DeskFlow App Data
  overlay-studio/
    sessions.json
    artifacts/
      session_id/
        transcript.json
        cut_plan.json
        scene_plan.json
        export_plan.json
```

Why:

- user does not need to manage extra files manually
- app can keep lightweight session metadata
- video files remain untouched
- path-only model is preserved
- artifacts can still reference original video path

Alternative: store a sidecar JSON next to the video, like:

```text
lesson_01.mp4
lesson_01.overlay-studio.json
```

But based on your direction, I think app-data storage is cleaner because the system is only tracking “which file is currently being discussed/processed.”

So my recommendation is:

> Store session metadata and suggestion artifacts locally in app data. Store only the source video path, not the video itself.

---

# Updated View Structure

## 1. Dashboard View

Purpose:

> Show the full system, not just “start with transcript.”

Layout:

- top header: “Overlay Studio”
- pipeline summary
- recent sessions
- tool cards
- empty state for first-time users

Tool cards should include:

- Import Video
- Transcript
- Manual Bridge
- Cut Planner
- Scene DSL
- Scene Visualizer
- Timeline Preview
- Export

Each tool card shows:

- icon
- title
- short description
- status badge
- enabled/disabled state

Example:

```text
Manual Bridge
Generate prompts and paste AI responses manually.
Ready
```

```text
Scene Visualizer
Preview overlays on a 9:16 canvas.
Needs scene plan
```

This solves the “where are all the tools?” problem.

---

## 2. Source View

Purpose:

> Show which video path is active and whether it is available.

Content:

- file name
- full path
- duration if known
- transcript status
- cut plan status
- scene plan status
- open/reveal/repoint actions

This view should be simple. It should not pretend to be a full editor.

Primary actions:

```text
Open Transcript
Generate Cut Plan
Repoint Source
```

If missing:

```text
Source missing
[Repoint File]
```

---

## 3. Transcript View

Purpose:

> Review transcript segments and prepare them for AI/manual cut planning.

Layout:

Center:

- transcript segment list
- timestamp chips
- segment text
- keep/cut indicators

Right Inspector:

- selected segment details
- actions
- Manual Bridge prompt generation

Segment row structure:

```text
[00:00.0 - 00:05.2]
Welcome to this tutorial. Today we are going to cover three important concepts.

Status: Pending
```

States:

- pending
- keep
- cut
- warning
- error

Visual language:

- keep: cyan/emerald tint
- cut: muted/red tint
- selected: pink border/focus ring
- hover: zinc glass surface

Interaction:

- click segment to select
- double-click to edit text if allowed
- toggle keep/cut
- select multiple segments
- scroll sync with timeline later

Important: transcript is still suggestion-based. The user can approve or override AI suggestions.

---

## 4. Manual Bridge Wizard

This needs to be one of the clearest parts of the app because Ollama is not available.

The wizard should have 3 steps:

```text
1. Prompt
2. Paste Response
3. Validate
```

But it should not feel hidden. It should appear in the right inspector or as a focused center workspace depending on screen size.

### Step 1 — Prompt

Show:

- prompt type: Cut Plan or Scene DSL
- model instructions
- full prompt text
- copy button
- regenerate prompt button

Primary action:

```text
Copy Prompt
```

Secondary:

```text
Open External AI
```

Even if we cannot launch external AI automatically, the button can copy the prompt and explain the next step.

### Step 2 — Paste Response

Show:

- large paste area
- helper text: “Paste the JSON response from your AI model.”
- warning if response contains non-JSON text

Primary action:

```text
Validate Response
```

### Step 3 — Validate

Show validation checklist:

```text
Valid JSON
Required fields present
Timestamps are valid
Segment IDs match transcript
No overlapping overlays
Duration within source duration
```

Each check gets:

- pass icon
- fail icon
- explanation
- repair action if failed

If failed:

```text
Generate Repair Prompt
Copy Repair Prompt
```

If passed:

```text
Accept Result
```

This makes the Manual Bridge feel like a real tool instead of a hidden debug flow.

---

## 5. Cut Plan View

Purpose:

> Review which transcript segments the system suggests keeping or cutting.

This should not be a traditional timeline edit. It should be a suggestion review.

Center layout:

- summary header
- transcript segments with keep/cut state
- optional side-by-side original vs suggested plan

Summary header:

```text
Original duration: 5:20
Suggested duration: 3:42
Removed: 1:38
Segments kept: 18
Segments cut: 7
```

Segment visualization:

- kept segments: normal text, cyan/emerald indicator
- cut segments: dimmed, strikethrough optional, red indicator
- selected segment: pink outline

Actions:

- approve plan
- reject plan
- edit individual segment
- regenerate plan
- open Manual Bridge repair

The user should always be able to override the AI.

---

## 6. Scene Visualizer View

This is the most important “wow” view.

It should show:

- 9:16 canvas preview
- timeline scrubber
- overlay list
- overlay properties
- animation preview controls

Center layout:

```text
+--------------------------------------------+
|             9:16 Canvas Preview            |
|                                            |
|              [overlay cards]               |
|                                            |
+--------------------------------------------+
| Timeline Scrubber + Segment Blocks         |
+--------------------------------------------+
```

Right inspector:

- selected overlay
- overlay type
- text
- start/end
- animation in/out
- emphasis words
- renderer badge
- safe-zone warnings

This is where the system feels like it is actually doing something visual.

---

## 7. Timeline Scrubber

The timeline should not be a full NLE timeline, but it should feel real.

It should show:

- total duration
- playhead
- transcript segment blocks
- keep/cut blocks
- overlay blocks
- current selected segment
- safe density indicator if needed

Suggested tracks:

```text
Track 1: Transcript segments
Track 2: Keep/cut plan
Track 3: Overlay suggestions
```

Not dozens of tracks. Keep it readable.

### Transcript track

Each transcript segment is a block.

Width is based on duration.

Color:

- default: zinc surface
- selected: pink border
- kept: cyan/emerald tint
- cut: muted/red tint

### Overlay track

Overlay suggestions appear as blocks.

Color by overlay type:

| Type | Color |
|---|---|
| hook | amber/yellow |
| body | light slate |
| caption | muted slate |
| bullet | cyan |
| keyword | cyan |

These match the existing overlay type colors.

### Playhead

The playhead should be draggable.

Interaction:

- click timeline to seek
- drag playhead to scrub
- arrow keys to nudge
- space to play/pause
- selected segment scrolls transcript into view

Because the system is suggestion-based, the timeline is mostly for review and preview, not destructive editing.

---

## 8. 9:16 Canvas Preview

The canvas should preview overlays in real time.

Canvas dimensions from current code:

```ts
CANVAS_WIDTH = 270
CANVAS_HEIGHT = 480
```

But visually, it should be displayed as a 9:16 phone-style preview.

It should show:

- video frame or placeholder background
- safe zones
- overlay cards
- text overlays
- emphasis words
- animation preview states

### Safe zones

Show optional safe-zone overlays:

- text safe zone
- caption reserved zone
- face cam discouraged zone
- platform UI forbidden zone

Use translucent colors:

- forbidden: red tint
- discouraged: amber tint
- reserved: cyan tint
- preferred: green tint

Toggle:

```text
Show Safe Zones
```

### Overlay rendering

Overlay cards should be rendered as absolutely positioned React elements inside the canvas container.

Example conceptual structure:

```tsx
<div className="canvas">
  <video />
  <div className="overlay-layer">
    {activeOverlays.map(overlay => (
      <OverlayCard overlay={overlay} />
    ))}
  </div>
  <div className="safe-zone-layer" />
</div>
```

For real-time preview, the frontend can render a simplified version of the overlay using the same overlay type config.

The Python renderer remains the source of truth for final export, but the React preview gives the user immediate visual feedback.

---

# Important UX Principle: Suggestion States

Every AI-produced object should have a clear state:

| Object | States |
|---|---|
| Transcript segment | pending, kept, cut, edited |
| Cut plan | draft, approved, rejected |
| Scene | draft, approved, rejected |
| Overlay | suggested, approved, hidden |
| Export | pending, ready, failed |

This keeps the system honest.

The user should always know:

- what was generated by AI
- what was manually pasted through Manual Bridge
- what has been approved
- what is still pending
- what failed validation

---

# Empty, Loading, and Error States

Every major view needs these.

## Dashboard

### Empty

```text
No video sessions yet
Import a video to generate transcript, cut plan, and overlay suggestions.

[Import Video]
```

### Loading

```text
Loading sessions...
```

### Error

```text
Could not load session library.
[Retry]
```

## Source View

### Empty

```text
No source selected
Choose a session from the library.
```

### Missing source

```text
Source file missing
The saved path no longer exists.

[Repoint File] [Remove Session]
```

## Transcript View

### Empty

```text
No transcript yet
Import a video and run transcription.
```

### Loading

```text
Transcribing audio...
This may take a few minutes depending on video length.
```

### Error

```text
Transcription failed
Check that the source file is available and audio can be extracted.

[Retry] [View Details]
```

## Manual Bridge

### Empty

```text
No response pasted yet
Copy the prompt, paste the AI JSON response, then validate.
```

### Loading

```text
Validating response...
```

### Error

```text
Response failed validation
Review the checklist and generate a repair prompt if needed.
```

## Cut Plan

### Empty

```text
No cut plan yet
Generate a cut plan from the transcript.
```

### Loading

```text
Preparing cut plan preview...
```

### Error

```text
Cut plan invalid
The AI response did not match the transcript.

[Open Manual Bridge] [Generate Repair Prompt]
```

## Scene Visualizer

### Empty

```text
No scene plan yet
Generate a scene plan from the approved cut plan.
```

### Loading

```text
Building scene preview...
```

### Error

```text
Scene plan invalid
Review validation errors before previewing.
```

## Export

### Empty

```text
No export plan available
Approve a scene plan before exporting.
```

### Loading

```text
Preparing export...
```

### Error

```text
Export failed
Renderer dependencies may be missing.

[View Logs] [Retry]
```

---

# What This Solves

This updated direction solves the original complaints:

## “Where are all the tools?”

The left rail, dashboard tool cards, and right inspector expose every pipeline stage.

## “Why is the UI bad?”

The app becomes a structured studio instead of a single scrolling prototype page.

## “Where is video editing?”

We reframe it as suggestion review and preview, not destructive editing.

## “Why is it only for SVM?”

The system becomes topic-agnostic by treating transcript, cut plan, and scene DSL as generic content structures.

## “I need to see and use features.”

Every feature gets a visible place:

- upload
- transcript
- manual bridge
- validation
- cut plan
- scene plan
- canvas preview
- timeline
- export

## “It should not store the video.”

We store only path + session metadata.

---

# Next Step

I recommend we move to **Phase 2: Detailed Component Hierarchy + Screen Specifications**.

For Phase 2, I will specify:

1. exact React component tree
2. file/folder structure
3. state management model
4. session/library data model
5. center workspace view switching
6. right inspector behavior
7. Manual Bridge component flow
8. timeline component structure
9. 9:16 canvas preview component structure
10. empty/loading/error state components

Before I do that, I need one clarification:

## Should the UI allow direct video playback from the local path?

Since you want the user to see which file is being processed and possibly preview it, I recommend yes:

```text
Use a local <video> element with the stored file path.
```

But because this is Electron, we may need a safe local file bridge or allowed protocol.

My recommended default is:

> If the video path is available and playable, show a native video preview. If not playable, show a placeholder card with file path, duration, and transcript/overlay preview.

If you agree, I’ll proceed with Phase 2 assuming local video preview is allowed.