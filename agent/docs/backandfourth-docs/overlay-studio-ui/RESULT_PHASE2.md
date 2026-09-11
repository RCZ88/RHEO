# Stage 2 — Detailed Component Hierarchy + Screen Specification

We are now moving from the high-level 3-pane studio concept into an implementable frontend specification.

This stage defines:

1. the exact React component hierarchy,
2. the recommended file/folder structure,
3. the state model,
4. the session/library model using local paths only,
5. the center workspace view system,
6. the right inspector behavior,
7. the Manual Bridge UX,
8. the timeline scrubber structure,
9. the 9:16 canvas preview structure,
10. empty/loading/error state handling,
11. visual specs using the existing DeskFlow tokens.

---

# 1. Core Product Positioning

The Overlay Studio should be presented as:

> **An AI-assisted video overlay suggestion studio, not a destructive video editor.**

The UI should make it obvious that the system:

- reads a local video file,
- generates transcript data,
- proposes cut plans,
- proposes overlay scenes,
- previews suggestions on a 9:16 canvas,
- lets the user approve/reject suggestions,
- exports the final plan or rendered output when available.

The app should not pretend to be Premiere/CapCut.

It should feel closer to:

- a review studio,
- a suggestion workspace,
- a pipeline inspector,
- a preview canvas.

---

# 2. Route and Page Entry

Keep the existing route:

```text
/studio
```

Sidebar entry:

```text
Icon: Sparkles
Label: Overlay Studio
```

Replace the current monolithic `FeatureStudioPage.tsx` with a feature-scoped page:

```text
src/features/overlay-studio/OverlayStudioPage.tsx
```

The old file can be deprecated or refactored into this feature folder.

---

# 3. Recommended File/Folder Structure

```text
src/features/overlay-studio/
│
├─ OverlayStudioPage.tsx
│
├─ components/
│  ├─ shell/
│  │  ├─ StudioShell.tsx
│  │  ├─ StudioSidebar.tsx
│  │  ├─ StudioWorkspace.tsx
│  │  ├─ StudioInspector.tsx
│  │  ├─ StudioTopbar.tsx
│  │  └─ StudioStageSwitcher.tsx
│  │
│  ├─ library/
│  │  ├─ SessionLibrary.tsx
│  │  ├─ SessionCard.tsx
│  │  ├─ SessionStatusBadge.tsx
│  │  ├─ PipelineStatusRail.tsx
│  │  └─ MissingSourceWarning.tsx
│  │
│  ├─ dashboard/
│  │  ├─ DashboardView.tsx
│  │  ├─ ToolCardGrid.tsx
│  │  ├─ ToolCard.tsx
│  │  ├─ RecentSessionsPanel.tsx
│  │  └─ FirstRunGuide.tsx
│  │
│  ├─ source/
│  │  ├─ SourceView.tsx
│  │  ├─ SourcePathCard.tsx
│  │  ├─ SourceAvailabilityBanner.tsx
│  │  ├─ MediaPreviewCard.tsx
│  │  └─ RepointSourceDialog.tsx
│  │
│  ├─ transcript/
│  │  ├─ TranscriptView.tsx
│  │  ├─ TranscriptToolbar.tsx
│  │  ├─ TranscriptSegmentList.tsx
│  │  ├─ TranscriptSegmentRow.tsx
│  │  ├─ TimestampChip.tsx
│  │  ├─ SegmentStatusPill.tsx
│  │  └─ TranscriptEmptyState.tsx
│  │
│  ├─ bridge/
│  │  ├─ ManualBridgePanel.tsx
│  │  ├─ BridgeStepHeader.tsx
│  │  ├─ BridgePromptStep.tsx
│  │  ├─ BridgePasteStep.tsx
│  │  ├─ BridgeValidateStep.tsx
│  │  ├─ ValidationChecklist.tsx
│  │  ├─ ValidationCheckItem.tsx
│  │  ├─ RepairPromptCard.tsx
│  │  └─ BridgeResultActions.tsx
│  │
│  ├─ cutplan/
│  │  ├─ CutPlanView.tsx
│  │  ├─ CutPlanSummaryBar.tsx
│  │  ├─ CutPlanSegmentList.tsx
│  │  ├─ CutPlanSegmentRow.tsx
│  │  ├─ KeepCutToggle.tsx
│  │  ├─ CutPlanApprovalBar.tsx
│  │  └─ CutPlanInspector.tsx
│  │
│  ├─ scene/
│  │  ├─ ScenePlanView.tsx
│  │  ├─ SceneCardGrid.tsx
│  │  ├─ SceneCard.tsx
│  │  ├─ OverlayBadge.tsx
│  │  ├─ RendererBadge.tsx
│  │  └─ ScenePlanInspector.tsx
│  │
│  ├─ visualizer/
│  │  ├─ VisualizerView.tsx
│  │  ├─ VisualizerToolbar.tsx
│  │  ├─ CanvasPreviewDock.tsx
│  │  ├─ CanvasStage.tsx
│  │  ├─ VideoLayer.tsx
│  │  ├─ OverlayLayer.tsx
│  │  ├─ OverlayCardPreview.tsx
│  │  ├─ SafeZoneLayer.tsx
│  │  ├─ PlaybackControls.tsx
│  │  ├─ OverlayListPanel.tsx
│  │  ├─ OverlayListItem.tsx
│  │  └─ OverlayInspector.tsx
│  │
│  ├─ timeline/
│  │  ├─ TimelinePanel.tsx
│  │  ├─ TimelineHeader.tsx
│  │  ├─ TimelineRuler.tsx
│  │  ├─ TimelineTrackList.tsx
│  │  ├─ TimelineTrack.tsx
│  │  ├─ TranscriptTrack.tsx
│  │  ├─ CutPlanTrack.tsx
│  │  ├─ OverlayTrack.tsx
│  │  ├─ TimelineBlock.tsx
│  │  ├─ Playhead.tsx
│  │  └─ TimecodeLabel.tsx
│  │
│  ├─ export/
│  │  ├─ ExportView.tsx
│  │  ├─ ExportReadinessChecklist.tsx
│  │  ├─ ExportOptionsPanel.tsx
│  │  ├─ OutputPathCard.tsx
│  │  ├─ RenderQueuePanel.tsx
│  │  └─ ExportActionsBar.tsx
│  │
│  ├─ inspector/
│  │  ├─ InspectorPanel.tsx
│  │  ├─ InspectorHeader.tsx
│  │  ├─ InspectorSection.tsx
│  │  ├─ InspectorEmptyState.tsx
│  │  └─ InspectorSwitcher.tsx
│  │
│  └─ states/
│     ├─ StudioEmptyState.tsx
│     ├─ StudioLoadingState.tsx
│     ├─ StudioErrorState.tsx
│     ├─ MissingSourceState.tsx
│     └─ BlockedFeatureState.tsx
│
├─ hooks/
│  ├─ useStudioState.ts
│  ├─ useActiveSession.ts
│  ├─ usePlayback.ts
│  ├─ useTimelineInteraction.ts
│  ├─ useCanvasScale.ts
│  ├─ useOverlayPreview.ts
│  ├─ useManualBridge.ts
│  └─ usePipelineReadiness.ts
│
├─ state/
│  ├─ studioReducer.ts
│  ├─ studioSelectors.ts
│  ├─ studioActions.ts
│  └─ studioTypes.ts
│
├─ services/
│  ├─ studioSessionService.ts
│  ├─ localMediaService.ts
│  ├─ pythonCliService.ts
│  ├─ bridgeService.ts
│  ├─ validationService.ts
│  └─ exportService.ts
│
├─ utils/
│  ├─ time.ts
│  ├─ path.ts
│  ├─ overlay.ts
│  ├─ safeZones.ts
│  ├─ canvasScale.ts
│  └─ pipeline.ts
│
└─ constants/
   ├─ stages.ts
   ├─ overlayTokens.ts
   ├─ pipelineSteps.ts
   └─ storageKeys.ts
```

This structure keeps the page maintainable and avoids another 599-line monolith.

---

# 4. Page-Level Component Tree

```tsx
<OverlayStudioPage>
  <StudioProvider>
    <StudioShell>
      <StudioSidebar />
      <StudioWorkspace />
      <StudioInspector />
    </StudioShell>
  </StudioProvider>
</OverlayStudioPage>
```

Expanded:

```tsx
<OverlayStudioPage>
  <StudioProvider>
    <StudioShell>
      <StudioSidebar>
        <PipelineStatusRail />
        <SessionLibrary />
        <StudioUtilityNav />
      </StudioSidebar>

      <StudioWorkspace>
        <StudioTopbar />
        <StudioStageSwitcher>
          <DashboardView />
          <SourceView />
          <TranscriptView />
          <ManualBridgePanel />
          <CutPlanView />
          <ScenePlanView />
          <VisualizerView />
          <ExportView />
        </StudioStageSwitcher>
      </StudioWorkspace>

      <StudioInspector>
        <InspectorSwitcher>
          <DashboardInspector />
          <SourceInspector />
          <TranscriptInspector />
          <BridgeInspector />
          <CutPlanInspector />
          <ScenePlanInspector />
          <OverlayInspector />
          <ExportInspector />
        </InspectorSwitcher>
      </StudioInspector>
    </StudioShell>
  </StudioProvider>
</OverlayStudioPage>
```

---

# 5. Stage System

The studio should use explicit stages.

```ts
export type StudioStage =
  | 'dashboard'
  | 'source'
  | 'transcript'
  | 'bridge'
  | 'cut-plan'
  | 'scene-plan'
  | 'visualizer'
  | 'export'
```

The left rail shows the pipeline in a simplified form:

```text
Source
Transcript
Cut Plan
Scene Plan
Preview
Export
```

The center workspace can include more detailed stages:

```text
Dashboard
Source
Transcript
Manual Bridge
Cut Plan
Scene Plan
Visualizer
Export
```

This is fine. The pipeline rail should remain simple, while the workspace can expose the full toolset.

---

# 6. State Model

Use a reducer-based local state model. If the app already has Zustand or another store, this can be adapted later, but for the spec, a feature-level reducer is clean.

## Core State Shape

```ts
interface StudioState {
  sessions: StudioSession[]
  activeSessionId: string | null

  activeStage: StudioStage

  selection: StudioSelection | null

  playback: PlaybackState

  bridge: ManualBridgeState

  async: {
    sessions: AsyncStatus
    transcript: AsyncStatus
    cutPlan: AsyncStatus
    scenePlan: AsyncStatus
    export: AsyncStatus
  }

  ui: {
    sidebarCollapsed: boolean
    inspectorCollapsed: boolean
    showSafeZones: boolean
    showOverlayList: boolean
    timelineHeight: number
  }
}
```

## Session Type

```ts
interface StudioSession {
  id: string
  name: string

  sourceVideoPath: string
  sourceVideoName: string

  durationSec?: number

  transcriptPath?: string
  cutPlanPath?: string
  scenePlanPath?: string
  exportPlanPath?: string

  transcript?: TranscriptData
  cutPlan?: CutPlanData
  scenePlan?: DirectorCut

  status: SessionStatus
  missingSource: boolean

  createdAt: string
  updatedAt: string
}
```

## Session Status

```ts
type SessionStatus =
  | 'created'
  | 'transcribing'
  | 'transcript_ready'
  | 'cut_plan_pending'
  | 'cut_plan_ready'
  | 'cut_plan_approved'
  | 'scene_plan_pending'
  | 'scene_plan_ready'
  | 'export_ready'
  | 'error'
```

## Selection Type

```ts
interface StudioSelection {
  type:
    | 'session'
    | 'transcript-segment'
    | 'cut-segment'
    | 'overlay'
    | 'scene'
    | 'export-job'

  id: string
}
```

## Playback State

```ts
interface PlaybackState {
  currentTime: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  muted: boolean
}
```

## Manual Bridge State

```ts
interface ManualBridgeState {
  mode: 'cut-plan' | 'scene-dsl'
  step: 'prompt' | 'paste' | 'validate'

  prompt: string
  rawResponse: string

  parsedJson: unknown | null
  validationErrors: ValidationError[]
  validationChecks: ValidationCheck[]

  isParsing: boolean
  lastError: string | null
}
```

---

# 7. Reducer Actions

```ts
type StudioAction =
  | { type: 'LOAD_SESSIONS_START' }
  | { type: 'LOAD_SESSIONS_SUCCESS'; sessions: StudioSession[] }
  | { type: 'LOAD_SESSIONS_ERROR'; error: string }

  | { type: 'CREATE_SESSION'; session: StudioSession }
  | { type: 'SET_ACTIVE_SESSION'; sessionId: string }
  | { type: 'REMOVE_SESSION'; sessionId: string }
  | { type: 'REPOINT_SOURCE'; sessionId: string; newPath: string }

  | { type: 'SET_STAGE'; stage: StudioStage }

  | { type: 'SET_TRANSCRIPT'; sessionId: string; transcript: TranscriptData }
  | { type: 'SET_CUT_PLAN'; sessionId: string; cutPlan: CutPlanData }
  | { type: 'SET_SCENE_PLAN'; sessionId: string; scenePlan: DirectorCut }

  | { type: 'SELECT_SEGMENT'; segmentId: string }
  | { type: 'SELECT_OVERLAY'; overlayId: string }
  | { type: 'CLEAR_SELECTION' }

  | { type: 'TOGGLE_SEGMENT_KEEP_CUT'; segmentId: string; state: 'keep' | 'cut' }
  | { type: 'APPROVE_CUT_PLAN' }
  | { type: 'REJECT_CUT_PLAN' }

  | { type: 'OPEN_BRIDGE'; mode: 'cut-plan' | 'scene-dsl' }
  | { type: 'SET_BRIDGE_STEP'; step: ManualBridgeState['step'] }
  | { type: 'SET_BRIDGE_PROMPT'; prompt: string }
  | { type: 'SET_BRIDGE_RESPONSE'; rawResponse: string }
  | { type: 'VALIDATE_BRIDGE_RESPONSE_START' }
  | { type: 'VALIDATE_BRIDGE_RESPONSE_SUCCESS'; checks: ValidationCheck[] }
  | { type: 'VALIDATE_BRIDGE_RESPONSE_ERROR'; errors: ValidationError[] }
  | { type: 'ACCEPT_BRIDGE_RESULT' }

  | { type: 'SET_PLAYHEAD'; time: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_DURATION'; duration: number }

  | { type: 'TOGGLE_SAFE_ZONES' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_INSPECTOR' }
```

---

# 8. Session Storage Model

Sessions are stored locally as path references.

Recommended storage location:

```text
DeskFlow app data
  overlay-studio/
    sessions.json
    artifacts/
      {sessionId}/
        transcript.json
        cut_plan.json
        scene_plan.json
        export_plan.json
```

The session list itself should be lightweight:

```json
{
  "sessions": [
    {
      "id": "session_123",
      "name": "lesson_01.mp4",
      "sourceVideoPath": "/Users/name/Videos/lesson_01.mp4",
      "status": "transcript_ready",
      "updatedAt": "2026-06-15T09:00:00Z"
    }
  ]
}
```

Do not copy the video.

Do not store the media binary.

Do not require the user to import media into a managed library.

The session is just a pointer to the local file plus generated suggestion artifacts.

---

# 9. Missing Source Handling

Every session card and source view must handle missing source files.

## Session Card Missing State

```text
lesson_01.mp4
~/Videos/lesson_01.mp4

Source missing
[Repoint] [Remove]
```

## Source View Missing State

```text
Source file missing

The saved video path no longer exists.

Expected path:
/Users/name/Videos/lesson_01.mp4

[Repoint File] [Remove Session Reference]
```

Important:

- “Remove Session Reference” removes the session metadata.
- It must never delete the actual video file.

---

# 10. Studio Shell Layout

## Desktop Layout

```text
+--------------------------------------------------------------+
| Sidebar      | Workspace                         | Inspector |
| 280px        | fluid                             | 360px     |
+--------------------------------------------------------------+
```

Recommended widths:

```text
Sidebar:
  default: 280px
  collapsed: 72px

Inspector:
  default: 360px
  collapsed: 56px

Workspace:
  min-width: 640px
```

Use existing DeskFlow glass surfaces:

```css
background: var(--bg-glass);
border: 1px solid var(--border-glass);
border-radius: 16px;
backdrop-filter: blur(16px);
```

Equivalent Tailwind style:

```tsx
bg-zinc-900/80
border border-zinc-700/50
rounded-2xl
backdrop-blur-xl
```

Primary accent:

```text
pink-500 #ec4899
```

Secondary/info accent:

```text
cyan-400 #22d3ee
```

---

# 11. Left Sidebar Specification

## Structure

```tsx
<StudioSidebar>
  <PipelineStatusRail />
  <SessionLibrary />
  <StudioUtilityNav />
</StudioSidebar>
```

## Pipeline Status Rail

Shows the active session pipeline.

```text
Source
Transcript
Cut Plan
Scene Plan
Preview
Export
```

Each item has:

- icon
- label
- state color
- click navigation if enabled

States:

| State | Visual |
|---|---|
| complete | cyan check icon |
| active | pink border/text |
| pending | zinc muted |
| blocked | zinc muted with lock |
| error | red icon |

Example:

```text
✓ Source
✓ Transcript
● Cut Plan
○ Scene Plan
○ Preview
○ Export
```

Disabled steps should show tooltip reason:

```text
Cut Plan requires a transcript.
Scene Plan requires an approved cut plan.
Export requires a scene plan.
```

## Session Library

Each session card:

```text
[Video icon]
lesson_01.mp4
~/Videos/lesson_01.mp4

Status: Transcript ready
Updated: 2m ago
```

Card height:

```text
minimum 72px
```

Click target:

```text
minimum 44px
```

Hover actions:

```text
Open
Reveal
Repoint
Remove
```

Status badge colors:

| Status | Color |
|---|---|
| Ready | cyan |
| Active | pink |
| Pending | zinc |
| Error | red |
| Missing source | amber |

## Utility Nav

Bottom items:

```text
Manual Bridge
Validation Tools
Export Queue
Settings
```

These should always be visible so tools do not feel hidden.

---

# 12. Center Workspace Specification

The workspace contains:

```tsx
<StudioWorkspace>
  <StudioTopbar />
  <StudioStageSwitcher />
</StudioWorkspace>
```

## Topbar

The topbar should always show:

- current session name
- current source path
- current stage
- pipeline status badge
- quick actions

Example:

```text
lesson_01.mp4
~/Videos/lesson_01.mp4

Stage: Cut Plan
Status: Waiting for approval

[Manual Bridge] [Preview] [Export]
```

The topbar solves the user’s concern:

> “Which file is currently being discussed and processed?”

It should remain visible at all times.

---

# 13. Dashboard View

## Purpose

Show the full system immediately.

This view must not only say:

```text
Start a video with a transcript
```

It should show every major tool.

## Layout

```text
+------------------------------------------------------+
| Header                                               |
+------------------------------------------------------+
| Active Session Summary                               |
+------------------------------------------------------+
| Pipeline Tool Grid                                   |
+------------------------------------------------------+
| Recent Sessions                                      |
+------------------------------------------------------+
```

## Header

```text
Overlay Studio

Analyze videos, generate cut plans, preview overlays, and export suggestion plans.
```

Primary button:

```text
Import Video
```

Secondary button:

```text
Open Manual Bridge
```

## Active Session Summary

If a session is active:

```text
lesson_01.mp4
~/Videos/lesson_01.mp4

Transcript ready
Cut plan pending
Scene plan pending

[Continue]
```

If no session is active:

```text
No active video session
Import a video to begin.
```

## Tool Grid

Each tool card must be visible even if disabled.

Tool cards:

```text
Import Video
Transcript
Manual Bridge
Cut Planner
Scene DSL
Scene Visualizer
Timeline Preview
Export
```

Card content:

```text
Icon
Title
Short description
Status badge
Primary action
```

Example:

```text
Manual Bridge
Generate prompts and paste AI responses manually.
Ready

Open
```

Example disabled state:

```text
Scene Visualizer
Preview overlays on a 9:16 canvas.
Blocked: needs scene plan

Generate Scene Plan
```

Important: disabled cards should not disappear. They should explain what is missing.

## Empty State

```text
No video sessions yet

Overlay Studio works with local video files. Import a video path to generate transcript, cut plan, and overlay suggestions.

[Import Video]
```

## Loading State

```text
Loading studio sessions...
```

## Error State

```text
Could not load Overlay Studio sessions.

[Retry]
```

---

# 14. Import/Source Flow

Because we are using local paths only, the import flow should not be called “Upload” if possible.

Better labels:

```text
Add Video
Import Local Video
Select Video File
```

## Import Dialog

```text
Select a local video file

[Browse File]

Selected:
/Users/name/Videos/lesson_01.mp4

[Create Session]
```

The app then creates:

```ts
{
  id: uuid(),
  name: 'lesson_01.mp4',
  sourceVideoPath: '/Users/name/Videos/lesson_01.mp4',
  status: 'created'
}
```

Then it should immediately show the Source View.

---

# 15. Source View

## Purpose

Show the selected local file and its availability.

## Layout

```text
+------------------------------------------------------+
| Source File                                          |
+------------------------------------------------------+
| Path Card                                            |
+------------------------------------------------------+
| Media Preview                                        |
+------------------------------------------------------+
| Pipeline Readiness                                   |
+------------------------------------------------------+
```

## Path Card

```text
File name
lesson_01.mp4

Full path
/Users/name/Videos/lesson_01.mp4

Duration
5:20

Status
Source available
```

Actions:

```text
Open Transcript
Generate Cut Plan
Repoint File
Reveal File
```

## Media Preview

If local playback is available:

```tsx
<video src={localFileUrl} controls={false} muted />
```

The source view can show a small preview player.

If playback is unavailable:

```text
Video preview unavailable

The file path is stored, but this format may not be playable inside the app.
Transcript and overlay suggestions can still be processed if the backend supports the file.
```

## Pipeline Readiness

```text
Source       Ready
Transcript   Not generated
Cut Plan     Blocked
Scene Plan   Blocked
Export       Blocked
```

## Missing Source State

```text
Source file missing

The saved path no longer exists.

Expected path:
/Users/name/Videos/lesson_01.mp4

[Repoint File] [Remove Session Reference]
```

---

# 16. Transcript View

## Purpose

Display transcript segments and allow the user to prepare them for cut planning.

## Layout

```text
+------------------------------------------------------+
| Transcript Toolbar                                   |
+------------------------------------------------------+
| Segment List                                         |
+------------------------------------------------------+
```

Right inspector shows selected segment details.

## Transcript Toolbar

Contains:

```text
Search segments
Filter: All / Keep / Cut / Pending
Sort: Time order
Generate Cut Plan
Open Manual Bridge
```

Also show transcript summary:

```text
42 segments
5:20 total duration
18 kept
7 cut
17 pending
```

## Segment Row

Each segment row should be a large readable card.

```text
+------------------------------------------------------+
| [00:00.0 - 00:05.2]                 [Keep] [Cut]     |
|                                                      |
| Welcome to this tutorial. Today we are going to      |
| cover three important concepts.                      |
+------------------------------------------------------+
```

Minimum row height:

```text
64px
```

Timestamp chip:

```text
rounded-md
bg-zinc-800/80
border border-zinc-700/50
text-cyan-300
px-2 py-1
text-xs
```

Text:

```text
text-sm
leading-6
text-zinc-100
```

Selected state:

```text
border-pink-500/70
bg-zinc-900/90
ring-1 ring-pink-500/30
```

Keep state:

```text
border-emerald-500/30
bg-emerald-500/5
```

Cut state:

```text
opacity-60
border-rose-500/20
bg-rose-500/5
```

## Segment Actions

For each segment:

```text
Keep
Cut
Reset
Inspect
```

Bulk actions:

```text
Keep selected
Cut selected
Reset selected
```

## Transcript Empty State

```text
No transcript yet

Import a video and run transcription to generate segments.

[Go to Source]
```

## Transcript Loading State

```text
Generating transcript...

This may take time depending on audio length and local model performance.
```

## Transcript Error State

```text
Transcription failed

The transcript could not be generated from this source file.

[Retry] [View Details]
```

---

# 17. Manual Bridge Specification

The Manual Bridge must feel like a first-class tool.

It should be accessible from:

- Dashboard tool card,
- Transcript inspector,
- Cut Plan inspector,
- Scene Plan inspector,
- topbar quick action.

## Manual Bridge Modes

```ts
type BridgeMode = 'cut-plan' | 'scene-dsl'
```

## Bridge Layout

On narrow screens, the bridge can occupy the center workspace.

On wide screens, it can appear in the right inspector if the user is editing a specific stage.

However, for first-time clarity, the initial Manual Bridge should be a full center workspace view.

## Bridge Header

```text
Manual Bridge

Mode: Cut Plan
Step 1 of 3: Prompt
```

Steps:

```text
1. Prompt
2. Paste Response
3. Validate
```

Use a step header:

```tsx
<BridgeStepHeader step={bridge.step} />
```

---

## Step 1 — Prompt

Purpose:

> Give the user the exact prompt to copy into an external AI model.

Layout:

```text
+------------------------------------------------------+
| Prompt Type: Cut Plan                                |
+------------------------------------------------------+
| Prompt Preview                                       |
+------------------------------------------------------+
| [Copy Prompt] [Regenerate Prompt]                    |
+------------------------------------------------------+
```

Prompt preview should be scrollable:

```text
max-h-[360px]
overflow-auto
font-mono
text-xs
bg-zinc-950/80
border border-zinc-800
rounded-xl
p-4
```

Primary action:

```text
Copy Prompt
```

Secondary action:

```text
Copy as JSON Instruction
```

Helper text:

```text
Copy this prompt into your preferred AI model, then paste the JSON response in the next step.
```

---

## Step 2 — Paste Response

Layout:

```text
+------------------------------------------------------+
| Paste AI Response                                    |
+------------------------------------------------------+
| Textarea                                             |
+------------------------------------------------------+
| [Back] [Validate Response]                           |
+------------------------------------------------------+
```

Textarea:

```text
min-h-[280px]
font-mono
text-xs
bg-zinc-950/80
border border-zinc-800
rounded-xl
p-4
```

Placeholder:

```text
Paste the raw JSON response from your AI model here.
```

Validation should not require perfectly clean JSON. Use the existing `extractJson()` helper from `overlayParser.ts` to recover JSON from markdown or extra text.

---

## Step 3 — Validate

Layout:

```text
+------------------------------------------------------+
| Validation Checklist                                 |
+------------------------------------------------------+
| Passed 5/7                                           |
+------------------------------------------------------+
| Checklist items                                      |
+------------------------------------------------------+
| [Generate Repair Prompt] [Back] [Accept Result]      |
+------------------------------------------------------+
```

Validation checklist uses existing parser helpers:

```ts
validateCutPlan()
validateSceneDSL()
allPassed()
passedCount()
generateRepairPrompt()
```

Checklist item states:

```text
pass: cyan/emerald check
fail: red alert
warning: amber alert
```

Example cut plan checks:

```text
Valid JSON
Root object exists
Metadata exists
Segments exist
Segment IDs match transcript
Start/end times are valid
Keep/cut states are valid
No overlapping segments
```

Example scene DSL checks:

```text
Valid JSON
Overlays array exists
Overlay IDs are unique
Start time is before end time
Overlay type is valid
Animation values are valid
Emphasis words are strings
Duration fits source transcript
```

If validation fails:

```text
Generate Repair Prompt
Copy Repair Prompt
Return to Paste Step
```

If validation passes:

```text
Accept Result
```

## Bridge Empty State

```text
No AI response pasted yet.

Copy the prompt, generate a response from your AI model, then paste the JSON here.
```

## Bridge Loading State

```text
Validating response...
```

## Bridge Error State

```text
The response could not be validated.

Review the checklist or generate a repair prompt.
```

---

# 18. Cut Plan View

## Purpose

Review the AI/manual cut plan and approve or override it.

This is a suggestion review screen, not a destructive editor.

## Layout

```text
+------------------------------------------------------+
| Cut Plan Summary Bar                                 |
+------------------------------------------------------+
| Segment Review List                                  |
+------------------------------------------------------+
| Approval Bar                                         |
+------------------------------------------------------+
```

Right inspector:

```text
Cut Plan Inspector
```

## Summary Bar

```text
Original duration: 5:20
Suggested duration: 3:42
Removed: 1:38
Segments kept: 18
Segments cut: 7
```

Visual chips:

```text
Original: zinc
Suggested: cyan
Removed: rose
Kept: emerald
Cut: rose
```

## Segment Review List

Each row shows:

```text
Timestamp
Text
AI suggestion
User override
```

Example:

```text
[00:00.0 - 00:05.2]
Welcome to this tutorial. Today we are going to cover three important concepts.

AI: Keep
You: Keep
```

If user overrides:

```text
AI: Cut
You: Keep
```

Show override badge:

```text
pink outline
text-xs
```

## Keep/Cut Toggle

Each row should have two large buttons:

```text
Keep
Cut
```

Minimum touch target:

```text
44px height
```

Visual states:

```text
Keep active:
bg-emerald-500/10
border-emerald-400/40
text-emerald-300

Cut active:
bg-rose-500/10
border-rose-400/40
text-rose-300
```

## Approval Bar

Sticky bottom bar:

```text
+------------------------------------------------------+
| Cut plan has 7 cuts.                   [Approve Plan]|
| [Reject] [Open Manual Bridge] [Regenerate]           |
+------------------------------------------------------+
```

Primary action:

```text
Approve Plan
```

Secondary:

```text
Reject
```

Tertiary:

```text
Open Manual Bridge
```

## Cut Plan Empty State

```text
No cut plan available.

Generate a cut plan using the transcript and Manual Bridge.

[Open Manual Bridge]
```

## Cut Plan Loading State

```text
Preparing cut plan preview...
```

## Cut Plan Error State

```text
The cut plan is invalid.

Fix validation errors before approving.

[Open Validation] [Generate Repair Prompt]
```

---

# 19. Scene Plan View

## Purpose

Show the generated overlay scene plan before visual preview.

This is useful because the timeline/canvas can be heavy. The Scene Plan view gives a structured overview.

## Layout

```text
+------------------------------------------------------+
| Scene Plan Header                                    |
+------------------------------------------------------+
| Scene Card Grid                                      |
+------------------------------------------------------+
```

Right inspector:

```text
Scene Plan Inspector
```

## Scene Card

Each overlay becomes a card.

```text
+------------------------------------------------------+
| Overlay #4                         [keyword]          |
| 00:16.2 - 00:21.0                                    |
|                                                      |
| "Efficiency ratio matters most."                     |
|                                                      |
| animation: pop / fade_out                            |
| emphasis: efficiency, ratio                          |
| renderer: card                                       |
+------------------------------------------------------+
```

Card visual:

```text
rounded-xl
border border-zinc-700/50
bg-zinc-900/70
p-4
```

Overlay type badge colors:

Use existing `OVERLAY_TYPE_CONFIG`:

```ts
hook: #fbbf24
body: #e2e8f0
caption: #94a3b8
bullet: #22d3ee
keyword: #22d3ee
```

Badge style:

```text
text-xs
px-2 py-1
rounded-full
border
```

For light text colors, use dark text on badge if needed.

## Scene Card Actions

```text
Preview
Edit
Hide
Approve
Reject
```

## Scene Plan Empty State

```text
No scene plan yet.

Generate a scene DSL from the approved cut plan.

[Open Manual Bridge]
```

## Scene Plan Loading State

```text
Preparing scene plan...
```

## Scene Plan Error State

```text
Scene plan validation failed.

[Open Validation] [Generate Repair Prompt]
```

---

# 20. Visualizer View

This is the most important visual feature.

## Purpose

Preview overlays on a 9:16 canvas with a timeline scrubber.

## Layout

```text
+------------------------------------------------------+
| Visualizer Toolbar                                   |
+------------------------+-----------------------------+
|                        | Overlay List                |
|   9:16 Canvas Preview  |                             |
|                        +-----------------------------+
|                        | Overlay Inspector           |
+------------------------+-----------------------------+
| Timeline Scrubber                                    |
+------------------------------------------------------+
```

On smaller screens, the right overlay panel can collapse.

---

## Visualizer Toolbar

Contains:

```text
Play/Pause
Current time / duration
Safe zones toggle
Overlay list toggle
Animation preview toggle
Export button
```

Example:

```text
[Play] 00:12.4 / 05:20
[Safe Zones] [Overlays] [Animation]
[Export]
```

---

# 21. 9:16 Canvas Preview Specification

## Canvas Coordinate System

The Python profile uses a `1080x1920` safe zone coordinate system:

```yaml
text_safe: x: 40, y: 40, w: 1000, h: 1280
face_cam: x: 760, y: 1120, w: 320, h: 400
captions: x: 80, y: 1420, w: 920, h: 300
platform_ui_right: x: 930, y: 250, w: 150, h: 1370
```

The React preview should also use `1080x1920` as the logical coordinate space.

Then scale it to fit the available container.

```ts
const logicalCanvas = {
  width: 1080,
  height: 1920,
}
```

Use a `useCanvasScale()` hook:

```ts
function useCanvasScale(containerWidth: number, containerHeight: number) {
  const scale = Math.min(
    containerWidth / 1080,
    containerHeight / 1920
  )

  return {
    scale,
    width: 1080 * scale,
    height: 1920 * scale,
  }
}
```

The canvas stage can then be rendered as:

```tsx
<div
  style={{
    width: scaledWidth,
    height: scaledHeight,
  }}
>
  <div
    style={{
      width: 1080,
      height: 1920,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}
  >
    <VideoLayer />
    <OverlayLayer />
    <SafeZoneLayer />
  </div>
</div>
```

This allows overlay positions to match the Python safe zone coordinates.

---

## Canvas Layers

```tsx
<CanvasStage>
  <VideoLayer />
  <SafeZoneLayer />
  <OverlayLayer />
  <PlaybackHUD />
</CanvasStage>
```

Layer order:

```text
1. Video layer
2. Safe zone layer
3. Overlay layer
4. Playback HUD
```

---

## Video Layer

If local playback is available:

```tsx
<video
  ref={videoRef}
  src={localFileUrl}
  className="absolute inset-0 h-full w-full object-cover"
  muted
  playsInline
/>
```

If no video is available:

```tsx
<div className="absolute inset-0 bg-zinc-950">
  <div className="text-zinc-500">
    Video preview unavailable
  </div>
</div>
```

The overlay preview should still work even if the video cannot play.

---

## Safe Zone Layer

Safe zones should be togglable.

Use Python profile safe zones.

Visual mapping:

| Mode | Color |
|---|---|
| forbidden | red |
| discouraged | amber |
| reserved | cyan |
| preferred | emerald |

Styles:

```text
forbidden:
bg-red-500/10
border border-red-500/30

discouraged:
bg-amber-500/10
border border-amber-500/30

reserved:
bg-cyan-500/10
border border-cyan-500/30

preferred:
bg-emerald-500/10
border border-emerald-500/20
```

Each safe zone label:

```text
text-[10px]
uppercase
tracking-wide
```

---

## Overlay Layer

The overlay layer renders active overlays at the current playhead time.

```ts
const activeOverlays = scenePlan.overlays.filter(
  overlay =>
    currentTime >= overlay.start_time &&
    currentTime <= overlay.end_time
)
```

Then:

```tsx
<OverlayLayer>
  {activeOverlays.map(overlay => (
    <OverlayCardPreview
      key={overlay.id}
      overlay={overlay}
      currentTime={currentTime}
    />
  ))}
</OverlayLayer>
```

---

## Overlay Placement Strategy

The current frontend `Overlay` type does not include explicit x/y coordinates:

```ts
interface Overlay {
  id: string
  start_time: number
  end_time: number
  type: OverlayType
  text: string
  emphasis_words: string[]
  animation: {
    in: AnimationIn
    out: AnimationOut
  }
}
```

Therefore, the React preview should use type-based default placement.

Recommended default placement in `1080x1920` space:

| Overlay Type | Position |
|---|---|
| hook | top center, inside text safe zone |
| body | center |
| caption | bottom caption reserved zone |
| bullet | lower third |
| keyword | center emphasis position |

Approximate logical boxes:

```ts
const OVERLAY_PREVIEW_PLACEMENT = {
  hook: {
    x: 90,
    y: 160,
    w: 900,
    h: 300,
    align: 'center',
  },
  body: {
    x: 90,
    y: 700,
    w: 900,
    h: 420,
    align: 'center',
  },
  caption: {
    x: 100,
    y: 1460,
    w: 880,
    h: 240,
    align: 'center',
  },
  bullet: {
    x: 100,
    y: 1100,
    w: 880,
    h: 300,
    align: 'left',
  },
  keyword: {
    x: 140,
    y: 800,
    w: 800,
    h: 280,
    align: 'center',
  },
}
```

These are preview approximations, not final renderer truth.

The Python renderer remains the source of truth for final output.

---

## Overlay Card Preview Styling

Use existing overlay type colors:

```ts
OVERLAY_TYPE_CONFIG[overlay.type].color
```

Base card:

```tsx
<motion.div
  className="absolute rounded-2xl border px-6 py-4 backdrop-blur-md"
  style={{
    left: placement.x,
    top: placement.y,
    width: placement.w,
    borderColor: `${overlayColor}55`,
    backgroundColor: 'rgba(13, 17, 23, 0.82)',
  }}
>
  <OverlayTextWithEmphasis overlay={overlay} />
</motion.div>
```

Text colors:

```ts
hook: #FACC15
caption: #22D3EE
keyword: #22D3EE
bullet: #22D3EE
body: #e2e8f0
```

Emphasis words:

```tsx
<span className="text-cyan-300 font-semibold">
  {word}
</span>
```

Or for hook emphasis:

```text
text-yellow-300
```

---

## Animation Preview

Use Framer Motion to approximate the Python animation presets.

Map:

```ts
fade_in -> opacity 0 to 1
fade_out -> opacity 1 to 0
slide_up -> y 40 to 0
slide_down -> y 0 to 40
pop -> scale 0.92 to 1
```

Example:

```tsx
const variants = {
  initial: {
    opacity: 0,
    y: overlay.animation.in === 'slide_up' ? 40 : 0,
    scale: overlay.animation.in === 'pop' ? 0.92 : 1,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: overlay.animation.out === 'slide_down' ? 40 : 0,
  },
}
```

Duration:

```text
in: 220ms
out: 180ms
ease: var(--ease-out)
```

Equivalent:

```ts
ease: [0.16, 1, 0.3, 1]
```

---

# 22. Timeline Scrubber Specification

The timeline is not a full video editor timeline.

It is a review timeline.

## Timeline Layout

```text
+------------------------------------------------------+
| Timeline Header                                      |
+------------------------------------------------------+
| Ruler                                                |
+------------------------------------------------------+
| Transcript Track                                     |
+------------------------------------------------------+
| Cut Plan Track                                       |
+------------------------------------------------------+
| Overlay Track                                        |
+------------------------------------------------------+
```

Recommended default height:

```text
240px
```

Resizable range:

```text
180px - 360px
```

---

## Timeline Header

Shows:

```text
Current time
Duration
Zoom controls
Track visibility toggles
```

Example:

```text
00:12.4 / 05:20

Tracks:
[x] Transcript
[x] Cut Plan
[x] Overlays
```

Zoom can be optional for MVP.

If included:

```text
Fit
1x
2x
4x
```

Default:

```text
Fit to session duration
```

---

## Time Mapping

Use percentage-based layout:

```ts
const leftPercent = (startTime / duration) * 100
const widthPercent = ((endTime - startTime) / duration) * 100
```

Block style:

```tsx
<div
  className="absolute h-full rounded-md"
  style={{
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
  }}
/>
```

---

## Transcript Track

Each transcript segment is a block.

Color:

```text
default: bg-zinc-800/70
selected: border-pink-500/70
keep: bg-emerald-500/15
cut: bg-rose-500/10
```

Clicking a transcript block:

- selects the segment,
- scrolls Transcript View if open,
- updates inspector,
- moves playhead to segment start if user clicks near block start.

Hover tooltip:

```text
Segment 4
00:28.5 - 00:42.0
Now let me explain how this works in practice...
```

---

## Cut Plan Track

This track shows the result of the cut plan.

Visual:

```text
kept segments: emerald blocks
cut segments: rose blocks
```

If a user override differs from AI suggestion, show a small pink dot.

```text
AI suggestion: cut
User override: keep
Indicator: pink dot
```

---

## Overlay Track

Each overlay is a block.

Color by overlay type:

```ts
hook: #FACC15
body: #e2e8f0
caption: #22D3EE
bullet: #22D3EE
keyword: #22D3EE
```

Because cyan appears multiple times, differentiate using opacity and label:

```text
hook: amber
body: slate
caption: cyan
bullet: cyan with bullet icon
keyword: cyan with keyword icon
```

Overlay block click:

- selects overlay,
- opens overlay inspector,
- moves playhead to overlay start,
- highlights overlay on canvas.

Hover tooltip:

```text
Keyword Overlay
00:16.2 - 00:21.0
Efficiency ratio
```

---

## Playhead

The playhead is a vertical line:

```text
width: 2px
color: pink-500
```

Playhead handle:

```text
12px circular handle
44px invisible hit area
```

Style:

```tsx
<div className="absolute top-0 bottom-0 w-0.5 bg-pink-500" />
```

Draggable handle:

```tsx
<div className="absolute -top-2 -translate-x-1/2">
  <div className="h-3 w-3 rounded-full bg-pink-500" />
</div>
```

Interaction:

- click ruler to seek,
- drag playhead to scrub,
- arrow keys nudge,
- shift+arrow keys larger nudge.

Keyboard:

```text
Space: play/pause
Left: -1s
Right: +1s
Shift+Left: -5s
Shift+Right: +5s
Home: start
End: end
```

---

## Timeline Empty State

```text
Timeline unavailable

Generate a transcript or scene plan to populate timeline blocks.
```

## Timeline Loading State

```text
Building timeline...
```

## Timeline Error State

```text
Timeline data invalid

Check transcript and scene plan validation.
```

---

# 23. Right Inspector Specification

The inspector is contextual.

It should not be a dumping ground. It should show the tools relevant to the current selection.

## Inspector Switcher

```tsx
<InspectorSwitcher>
  {stage === 'dashboard' && <DashboardInspector />}
  {stage === 'source' && <SourceInspector />}
  {stage === 'transcript' && <TranscriptInspector />}
  {stage === 'bridge' && <BridgeInspector />}
  {stage === 'cut-plan' && <CutPlanInspector />}
  {stage === 'scene-plan' && <ScenePlanInspector />}
  {stage === 'visualizer' && <OverlayInspector />}
  {stage === 'export' && <ExportInspector />}
</InspectorSwitcher>
```

---

## Transcript Inspector

Shown when a transcript segment is selected.

Sections:

```text
Segment Details
Timing
Status
AI Suggestion
Manual Override
Actions
```

Fields:

```text
Segment ID
Start
End
Duration
Text
Status
```

Actions:

```text
Keep
Cut
Reset
Generate Cut Prompt
Open Manual Bridge
```

---

## Cut Plan Inspector

Shown in Cut Plan view.

Sections:

```text
Plan Summary
Validation
Approval
Manual Bridge
```

Actions:

```text
Approve
Reject
Regenerate Prompt
Open Manual Bridge
View Validation Checklist
```

---

## Overlay Inspector

Shown when an overlay is selected in visualizer.

Sections:

```text
Overlay Details
Timing
Content
Animation
Renderer
Warnings
```

Fields:

```text
Overlay ID
Type
Start
End
Duration
Text
Emphasis words
Animation in
Animation out
```

Warnings:

```text
Overlaps another overlay
Exceeds recommended max words
Enters forbidden safe zone
Duration too short
```

Actions:

```text
Preview
Hide
Approve
Reject
Open Scene Plan
```

For MVP, editing can be limited to approve/hide/reject. Later, text and timing can become editable.

---

## Export Inspector

Sections:

```text
Readiness
Output
Renderer
Actions
```

Readiness checklist:

```text
Source available
Transcript ready
Cut plan approved
Scene plan valid
Preview generated
Renderer available
```

Actions:

```text
Export Plan JSON
Render Preview
Export Final
```

If renderer dependencies are missing:

```text
Export Final unavailable

ffmpeg or renderer dependencies are missing.
You can still export the scene plan JSON.
```

---

# 24. Export View

## Purpose

Allow the user to export either:

1. suggestion plan JSON,
2. preview render if possible,
3. final composite if renderer dependencies exist.

Because ffmpeg is currently missing, the UI must not promise final rendering unconditionally.

## Export Options

```text
Export Scene Plan JSON
Export Cut Plan JSON
Export Transcript JSON
Render Preview Frames
Render Final Composite
```

Default safe option:

```text
Export Scene Plan JSON
```

## Layout

```text
+------------------------------------------------------+
| Export Readiness                                     |
+------------------------------------------------------+
| Export Options                                       |
+------------------------------------------------------+
| Output Path                                          |
+------------------------------------------------------+
| Export Actions                                       |
+------------------------------------------------------+
```

## Readiness Checklist

```text
Source available
Transcript ready
Cut plan approved
Scene plan valid
Output path selected
Renderer available
```

If renderer unavailable:

```text
Renderer unavailable
Final render disabled. JSON export is still available.
```

## Export Empty State

```text
Nothing to export yet.

Generate and approve a scene plan before exporting.
```

## Export Loading State

```text
Preparing export...
```

## Export Error State

```text
Export failed.

Check renderer dependencies and output path.

[View Details] [Retry]
```

---

# 25. Empty/Loading/Error State System

Create reusable components:

```tsx
<StudioEmptyState
  icon={Film}
  title="No video sessions yet"
  description="Import a local video to begin."
  action={{ label: 'Import Video', onClick: handleImport }}
/>
```

```tsx
<StudioLoadingState
  title="Generating transcript..."
  description="This may take a few minutes."
/>
```

```tsx
<StudioErrorState
  title="Transcription failed"
  description="The source file could not be processed."
  actions={[
    { label: 'Retry', onClick: handleRetry },
    { label: 'View Details', onClick: handleDetails },
  ]}
/>
```

## Visual Rules

Empty states:

```text
min-h-[280px]
rounded-2xl
border border-dashed border-zinc-700/60
bg-zinc-900/40
```

Loading spinner:

```text
pink-500
```

Error icon:

```text
rose-400
```

Warning icon:

```text
amber-400
```

Success icon:

```text
emerald-400
```

---

# 26. Visual Design Rules

Use existing DeskFlow tokens.

## Backgrounds

```css
--bg-primary: #09090b
--bg-glass: rgba(24, 24, 27, 0.80)
--border-glass: rgba(63, 63, 70, 0.50)
```

## Accent Colors

```css
--accent-primary: #ec4899
--accent-secondary: #22d3ee
```

## Text

```css
--text-primary: #f4f4f5
--text-secondary: #a1a1aa
--text-muted: #52525b
```

## Spacing

Use an 8px grid:

```text
4px only for tiny internal adjustments
8px standard padding
12px compact controls
16px card padding
24px section spacing
32px major view spacing
```

## Radius

```text
rounded-xl for controls
rounded-2xl for cards
rounded-full for badges
```

## Motion

Use existing easing:

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
```

Standard durations:

```text
micro: 120ms
standard: 200ms
panel: 280ms
canvas overlay: 220ms
```

Use Framer Motion for:

- stage transitions,
- inspector panel expansion,
- overlay entrance/exit,
- playhead hover states,
- validation checklist reveal.

Do not over-animate the timeline. Timeline interactions should feel immediate.

---

# 27. Human-Centric UX Requirements

Every interactive control must satisfy:

```text
minimum 44px target height
visible focus ring
clear hover state
clear disabled reason
```

Focus ring:

```tsx
focus-visible:ring-2
focus-visible:ring-pink-500/70
focus-visible:outline-none
```

Disabled buttons should not just be gray. They should explain why:

```text
Generate Scene Plan
Blocked: approved cut plan required
```

Tooltips should be used for:

- pipeline blocked reasons,
- validation failures,
- safe zone warnings,
- renderer unavailable warnings.

---

# 28. Integration With Existing Python Backend

The frontend should not duplicate Python logic. It should call backend stages through a service layer.

## Python CLI Mapping

Existing CLI:

```text
python main.py ingest
python main.py extract
python main.py plan
python main.py validate
python main.py render
python main.py composite
python main.py export
```

Frontend service:

```ts
pythonCliService.ts
```

Example methods:

```ts
async ingest(session: StudioSession): Promise<TranscriptData>
async extract(session: StudioSession): Promise<ExtractionResult>
async plan(session: StudioSession): Promise<PlanResult>
async validate(session: StudioSession): Promise<ValidationResult>
async render(session: StudioSession): Promise<RenderResult>
async composite(session: StudioSession): Promise<CompositeResult>
async export(session: StudioSession): Promise<ExportResult>
```

For now, because Ollama is missing, Manual Bridge handles AI generation.

So the actual flow is:

```text
Frontend generates prompt
User copies prompt
User pastes AI JSON
Frontend validates with overlayParser.ts
Accepted JSON becomes session artifact
Python backend validates/renders when available
```

---

# 29. Integration With Content Creation Skills

The UI should support skill-based prompt injection without making the system topic-specific.

Add a concept:

```ts
interface ContentSkillPreset {
  id: string
  name: string
  description: string

  promptVariables: {
    style_profile?: string
    target_aspect?: string
    hook_style?: string
    caption_style?: string
    density?: 'low' | 'medium' | 'high'
    cta_policy?: string
  }

  overlayPreferences?: {
    preferredTypes?: OverlayType[]
    maxOverlaysPerMinute?: number
    avoidZones?: string[]
  }
}
```

Skill integration points:

## Dashboard

Add optional card:

```text
Content Skills
Apply a content creation preset to prompt generation.
```

## Manual Bridge Prompt Step

Add optional selector:

```text
Prompt preset:
Default
Short-form Hook
Tutorial Explainer
Product Demo
Lecture Summary
```

The preset modifies prompt variables only.

It must not hardcode SVM or any topic.

## Scene Plan

Skill presets can influence:

- overlay density,
- hook frequency,
- caption style,
- CTA placement,
- safe zone weighting.

But final validation still uses the same generic validators.

---

# 30. Component Responsibilities Summary

## `StudioShell`

Owns the 3-pane layout.

Handles:

- sidebar collapse,
- inspector collapse,
- responsive behavior,
- global keyboard shortcuts.

## `SessionLibrary`

Handles:

- session list,
- active session selection,
- missing source warnings,
- session actions.

## `PipelineStatusRail`

Handles:

- stage readiness,
- stage navigation,
- blocked reason tooltips.

## `StudioStageSwitcher`

Renders the active center workspace view.

## `ManualBridgePanel`

Handles:

- prompt generation,
- response paste,
- JSON extraction,
- validation,
- repair prompt,
- acceptance.

## `TimelinePanel`

Handles:

- time-to-pixel mapping,
- track rendering,
- playhead dragging,
- block selection,
- hover tooltips.

## `CanvasStage`

Handles:

- scaled 1080x1920 coordinate space,
- video layer,
- overlay layer,
- safe zone layer,
- playback sync.

## `InspectorSwitcher`

Renders contextual right-panel tools.

---

# 31. MVP Implementation Order

To avoid rebuilding everything at once, implement in this order:

## Slice 1 — Studio Shell + Session Library

Build:

- `StudioShell`
- `StudioSidebar`
- `StudioWorkspace`
- `StudioInspector`
- `SessionLibrary`
- `SessionCard`
- local session state
- path-only session model

Result:

> User can see multiple sessions and know which file is active.

## Slice 2 — Dashboard + Source View

Build:

- `DashboardView`
- `ToolCardGrid`
- `SourceView`
- `SourcePathCard`
- missing source state

Result:

> All tools are visible, and the active file path is clear.

## Slice 3 — Transcript View

Build:

- `TranscriptView`
- `TranscriptSegmentList`
- `TranscriptSegmentRow`
- segment selection
- keep/cut states

Result:

> User can review transcript segments.

## Slice 4 — Manual Bridge

Build:

- `ManualBridgePanel`
- prompt step
- paste step
- validate step
- validation checklist
- repair prompt

Result:

> User can manually generate and validate AI outputs.

## Slice 5 — Cut Plan Review

Build:

- `CutPlanView`
- summary bar
- keep/cut review list
- approval bar

Result:

> User can approve or override cut suggestions.

## Slice 6 — Scene Plan + Visualizer

Build:

- `ScenePlanView`
- `VisualizerView`
- `CanvasStage`
- `OverlayLayer`
- `TimelinePanel`

Result:

> User can see overlays on a 9:16 canvas and timeline.

## Slice 7 — Export

Build:

- `ExportView`
- readiness checklist
- JSON export
- render actions when backend available

Result:

> User can export the final suggestion plan or render if dependencies exist.

---

# 32. Stage 2 Completion Summary

At the end of Stage 2, the Overlay Studio has:

- a 3-pane Studio IDE layout,
- a local path-based session library,
- clear pipeline navigation,
- visible tool cards for every feature,
- transcript review UI,
- first-class Manual Bridge wizard,
- cut plan approval UI,
- scene plan cards,
- 9:16 canvas preview,
- timeline scrubber,
- contextual inspector,
- empty/loading/error states for every major view,
- integration points for the Python backend,
- integration points for content creation skills,
- no requirement to store or copy video files.

This is now ready to move into **Stage 3: End-to-End Data Flow Specification**, where we define exactly how data moves through:

```text
local video path
→ session creation
→ transcript generation
→ cut plan prompt
→ manual AI response
→ validation
→ timeline
→ scene DSL
→ canvas preview
→ export
```