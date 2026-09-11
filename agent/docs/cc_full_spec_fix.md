MASTERSYSTEMIMPLEMENTATION.md
DeskFlow Unified AI System — Complete Compilation & Application Implementation Specification

This document compiles the full system vision, architecture, modules, data models, UX specifications, integration points, and implementation roadmap for the DeskFlow application.

It includes:

The Overlay Studio video overlay suggestion system.
The Visual Analysis / Visual Evidence Engine extension.
The Unified Context Management System.
The integration of content creation skills and AI prompt workflows.
The practical implementation plan for the Electron + React + Python application.

This is the master reference document for building the system into the application.

System Purpose

The system is a local-first, AI-assisted creative and personal-context environment.

It allows the user to:

Import or reference any local video.
Analyze transcript content.
Optionally analyze visual evidence from frames.
Generate cut plans and overlay scene plans using AI or Manual Bridge workflows.
Preview overlays on a 9:16 canvas.
Export suggestion plans or rendered outputs when available.
Continuously build a unified user context profile.
Feed that context into AI chat, workspace agents, and creative tools.
Visualize personal growth, interests, habits, and communication style.

The system must feel like:

“The application knows me, knows my workflow, and helps me create without forcing me to repeat myself.”

Core Product Principles

2.1 Local-First

The system should primarily operate locally.

Video files are referenced by path, not copied.
Session metadata is stored locally.
AI generation can happen through Manual Bridge if no local model is available.
External AI use is optional and user-driven.

2.2 Topic-Agnostic

The system must work for any video topic.

It must not assume:

SVM,
trading,
tutorials,
gaming,
medical,
finance,
or any specific domain.

The system analyzes structure, timing, visuals, and intent, not a fixed topic.

2.3 Suggestion-Based, Not Destructive

Overlay Studio is not a destructive video editor.

It should use language like:
text
Analyze
Suggest
Review
Approve
Reject
Preview
Export

Not:
text
Cut source video
Destroy original media
Permanently edit file

2.4 Every Feature Must Be Visible

No tool may be hidden.

Every pipeline stage must have:

a visible entry point,
a clear status,
an actionable next step,
an empty/loading/error state.

2.5 Every Button Must Do Something

No button may silently fail.

If a feature is unavailable, the UI must explain why and provide the closest available action.

2.6 Manual Bridge Is the Reliable Core

Because Ollama may be unavailable, the Manual Bridge is the primary reliable AI pathway.

The Manual Bridge must always work:

with no session,
with a session but no transcript,
with a transcript,
with or without visual evidence.

High-Level Application Architecture
text
+---------------------------------------------------------------+
|                        DeskFlow App                            |
+---------------------------------------------------------------+
| Renderer / React UI                                            |
|                                                                |
|  Overlay Studio       Context Profile       AI Chat            |
|  /studio              /life?tab=profile     AI Workspace       |
|                                                                |
+---------------------------------------------------------------+
| Preload / IPC Bridge                                           |
|                                                                |
|  context:       studio:       memory:       lifePhase:      |
|  ai-chat:       goals:        usage:        python:         |
+---------------------------------------------------------------+
| Electron Main Process                                          |
|                                                                |
|  Context Engine      Studio Session Service      Python Runner |
|  Memory Services     Artifact Storage            File Access   |
+---------------------------------------------------------------+
| Local Storage                                                  |
|                                                                |
|  SQLite DB        App Data JSON        Video File Paths        |
|  usercontext*   overlay-studio/      /path/to/video.mp4      |
+---------------------------------------------------------------+
| Python Backend                                                 |
|                                                                |
|  clement/                                                      |
|    contracts/                                                  |
|    extraction/                                                 |
|    animation/                                                  |
|    render/                                                     |
|    registry/                                                   |
|    validators/                                                 |
|    vision/                                                     |
+---------------------------------------------------------------+

Major System Modules

The full system is composed of four major modules:

| Module | Purpose |
|---|---|
| Overlay Studio | Video overlay suggestion pipeline |
| Visual Evidence Engine | Frame sampling, visual notes, shot/object/text awareness |
| Unified Context Management | Persistent user profile and context signals |
| Skills & Prompt Integration | Content creation presets and AI prompt injection |

Module A — Overlay Studio

5.1 Purpose

Overlay Studio is a 3-pane AI video overlay suggestion studio.

It transforms:
text
Video path
  → Transcript
  → Cut Plan
  → Scene Plan
  → Overlay Preview
  → Export

It is accessed at:
text
/studio

Sidebar entry:
text
Icon: Sparkles
Label: Overlay Studio

5.2 Layout

The UI uses a 3-pane Studio IDE layout:
text
+--------------------------------------------------------------+
| Sidebar      | Workspace                         | Inspector |
|              |                                   |           |
| Pipeline     | Active Stage View                 | Context   |
| Sessions     | Dashboard / Transcript / Bridge   | Tools     |
| Tools        | Cut Plan / Scene / Visualizer     | Details   |
+--------------------------------------------------------------+

Pane Rules

All three panes must always be rendered.

Collapsed panes shrink but remain mounted.

| Pane | Expanded Width | Collapsed Width |
|---|---:|---:|
| Sidebar | 280px | 72px |
| Inspector | 360px | 56px |
| Workspace | fluid | fluid |

5.3 Pipeline Stages

The Overlay Studio pipeline contains seven stages:
text
Source
Transcript
Visual Evidence
Cut Plan
Scene Plan
Visualizer
Export

The Manual Bridge is a cross-cutting tool used to generate:
text
Cut Plan JSON
Scene DSL JSON
Visual Analysis JSON

Stage keys:
ts
type StudioStage =
  | 'dashboard'
  | 'source'
  | 'transcript'
  | 'visual-evidence'
  | 'bridge'
  | 'cut-plan'
  | 'scene-plan'
  | 'visualizer'
  | 'export'

5.4 Session Model

Sessions are lightweight references to local video files.

The application does not copy or import the video.

It stores:
text
video path
video name
duration
status
artifact references
missing source flag
timestamps

Session Type
ts
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

  transcript?: any
  cutPlan?: any
  scenePlan?: DirectorCut

  status: SessionStatus
  missingSource: boolean

  createdAt: string
  updatedAt: string
}

Session Status Values
ts
type SessionStatus =
  | 'created'
  | 'transcribing'
  | 'transcript_ready'
  | 'cutplanpending'
  | 'cutplanready'
  | 'cutplanapproved'
  | 'sceneplanpending'
  | 'sceneplanready'
  | 'export_ready'
  | 'error'

5.5 Session Storage

Recommended production storage:
text
SQLite for session metadata
App data folder for large JSON artifacts

Suggested DB Table
sql
CREATE TABLE overlaystudiosessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sourcevideopath TEXT NOT NULL,
  sourcevideoname TEXT NOT NULL,
  duration_sec REAL,
  status TEXT NOT NULL,
  missing_source INTEGER DEFAULT 0,
  transcript_path TEXT,
  cutplanpath TEXT,
  sceneplanpath TEXT,
  exportplanpath TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

Suggested Artifact Storage
text
%APPDATA%/RHEO/overlay-studio/
  artifacts/
    {sessionId}/
      transcript.json
      cut_plan.json
      scene_plan.json
      export_plan.json
      vision/
        frames.json
        visual_analysis.json
        shot_map.json
        object_regions.json
        text_regions.json
        face_regions.json
        style_reference.json

5.6 Overlay Studio Component Tree
tsx

  
    
      
      
      
    
  

Expanded:
tsx

  
    
      
        
        
        
      

      
        
        
          
          
          
          
          
          
          
          
        
      

      
        
          
          
          
          
          
          
        
      
    
  

5.7 Critical Bug-Fix Requirements

These are mandatory and must not regress.

Bug Fix 1 — Manual Bridge Prompt Must Always Render

The Manual Bridge must never show an empty prompt.

It must render when:
text
No session exists
Session exists but has no transcript
Session exists with transcript

Prompt composition:
text
Cut Plan mode:
PROMPTCUTPLANNER + input data

Scene DSL mode:
PROMPTSCENEDSL + input data

If no transcript exists, append a template placeholder:
text
No transcript loaded yet.

Use this template with a transcript JSON object.

Expected transcript shape:
{
  "video_id": "string",
  "duration": 0,
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.5,
      "text": "..."
    }
  ]
}

Bug Fix 2 — Dashboard Buttons Must Always Navigate

Every Dashboard ToolCard must always do something.

Navigation rule:
text
If required data exists:
  navigate to that view

Else if session exists:
  open Manual Bridge

Else:
  navigate to dashboard/source

No tool card may have a click handler that silently does nothing.

Bug Fix 3 — Inspector Must Remain Mounted

StudioShell must always render:
tsx

Do not conditionally unmount the inspector when collapsed.

Collapsed inspector width:
text
56px

Expanded inspector width:
text
360px

The collapsed inspector must show a visible toggle button.

Bug Fix 4 — Sidebar Steps Must Always Be Clickable

Pipeline step buttons must not be disabled.

When no session exists:
text
Clicking any pipeline step navigates to dashboard.

When a session exists:
text
Clicking a pipeline step navigates to that stage.

visual-evidence must be included in stage ordering.

Bug Fix 5 — Required Imports Must Exist

DashboardView must import:
ts
AlertTriangle
FileJson
Film
Layers
Play
Plus
Sparkles
Wand2

ManualBridgePanel must import:
ts
AlertTriangle
Check
Clipboard
ClipboardCheck
FileJson
Loader2

5.8 Dashboard View Specification

Purpose

The Dashboard shows the entire system immediately.

It must expose every major tool.

Layout
text
+------------------------------------------------------+
| Header                                               |
+------------------------------------------------------+
| Active Session Summary                               |
+------------------------------------------------------+
| Pipeline Tool Grid                                   |
+------------------------------------------------------+

Header
text
Overlay Studio
Video Overlay Suggestion Studio

Analyze videos, generate cut plans, preview overlays, and export suggestion plans.

Empty Session Area

When no session exists:
text
No active video session

Import a video to begin analyzing and generating overlays.

[Import Video]
[Load Sample]

Tool Cards

Required cards:
text
Import Video
Transcript
Manual Bridge
Cut Planner
Scene DSL
Scene Visualizer

Optional future card:
text
Visual Evidence

ToolCard Navigation Rules

| Tool | If data exists | If session exists but data missing | If no session |
|---|---|---|---|
| Import Video | Trigger import | Trigger import | Trigger import |
| Transcript | Go to transcript | Open Cut Plan bridge | Go to dashboard/source |
| Manual Bridge | Open bridge | Open bridge | Open bridge |
| Cut Planner | Go to cut-plan | Open Cut Plan bridge | Go to dashboard/source |
| Scene DSL | Go to scene-plan | Open Scene DSL bridge | Go to dashboard/source |
| Scene Visualizer | Go to visualizer | Open Scene DSL bridge | Go to dashboard/source |

5.9 Transcript View Specification

Purpose

Display transcript segments for review.

Layout
text
+------------------------------------------------------+
| Transcript Toolbar                                   |
+------------------------------------------------------+
| Segment List                                         |
+------------------------------------------------------+

Segment Row
text
[00:00.0 - 00:05.2]
Welcome to this tutorial. Today we are going to cover three important concepts.

Status: Pending

Segment States

| State | Visual |
|---|---|
| pending | neutral zinc |
| keep | emerald tint |
| cut | rose tint |
| selected | pink border |
| edited | pink dot |

Empty State
text
No transcript yet

Import a video and run transcription, or load the sample transcript.

5.10 Manual Bridge Specification

The Manual Bridge is the critical path.

Required Behavior

The Manual Bridge must work in all states:
text
No session
Session without transcript
Session with transcript

Modes
text
Cut Plan
Scene DSL

Steps
text
Copy Prompt
Paste Response
Validate

Step 1 — Copy Prompt

The prompt textarea must contain the full prompt.

It must never be empty.

Actions:
text
Copy Prompt
Next: Paste Response

Step 2 — Paste Response

User pastes raw AI response.

The parser must support:
text
Plain JSON
Markdown code fences
Extra surrounding text

Actions:
text
Back
Validate Response

Step 3 — Validate

The system validates the response using:
ts
extractJson()
validateCutPlan()
validateSceneDSL()
allPassed()
passedCount()

Actions:
text
Back
Edit Prompt
Accept Result

Accept Result Behavior

If mode is Cut Plan:
text
SETCUTPLAN
SET_STAGE cut-plan

If mode is Scene DSL:
text
SETSCENEPLAN
SET_STAGE scene-plan

If no session exists, the system may create a Manual Bridge session automatically.

5.11 Cut Plan View Specification

Purpose

Review which transcript segments are kept or cut.

Layout
text
+------------------------------------------------------+
| Cut Plan Summary                                     |
+------------------------------------------------------+
| Segment Review List                                  |
+------------------------------------------------------+
| Approval Bar                                         |
+------------------------------------------------------+

Summary
text
Original duration
Suggested duration
Removed duration
Segments kept
Segments cut

Actions
text
Keep
Cut
Approve Plan
Reject Plan
Open Manual Bridge

5.12 Scene Plan View Specification

Purpose

Show generated overlays as structured cards.

Scene Card

Each overlay card shows:
text
Overlay type
Timestamp
Text
Emphasis words
Animation in/out
Renderer badge

Example:
text
Keyword
00:16.2 - 00:21.0

"Efficiency ratio matters most."

animation: pop / fade_out
emphasis: efficiency, ratio
renderer: card

Overlay Type Colors

Use existing OVERLAYTYPECONFIG:
ts
hook: #fbbf24
body: #e2e8f0
caption: #94a3b8
bullet: #22d3ee
keyword: #22d3ee

5.13 Visualizer View Specification

Purpose

Preview overlays on a 9:16 canvas with a timeline scrubber.

Layout
text
+------------------------------------------------------+
| Visualizer Toolbar                                   |
+------------------------+-----------------------------+
|                        | Overlay List                |
|   9:16 Canvas Preview  +-----------------------------+
|                        | Overlay Inspector           |
+------------------------+-----------------------------+
| Timeline Scrubber                                    |
+------------------------------------------------------+

Toolbar
text
Play/Pause
Current time / duration
Safe Zones toggle
Overlay list toggle
Export button

5.14 Timeline Scrubber Specification

The timeline is a review timeline, not a full non-linear editor.

Layout
text
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

Default Height
text
Default: 240px
Minimum: 180px
Maximum: 360px

Time Mapping
ts
leftPercent = (startTime / duration) * 100
widthPercent = ((endTime - startTime) / duration) * 100

Playhead Interaction
text
Click timeline to seek
Drag playhead to scrub
Space to play/pause
Left arrow: -1s
Right arrow: +1s
Shift + Left: -5s
Shift + Right: +5s
Home: start
End: end

5.15 9:16 Canvas Preview Specification

Canonical Coordinate System

Use the Python profile coordinate system:
text
1080 x 1920

The frontend preview may render at:
text
270 x 480

which is a 0.25 scale of the canonical canvas.

Safe Zones

Safe zones should be togglable.

Use Python profile zones:
text
text_safe
face_cam
captions
platformuiright

Canvas Layers
text
Video layer
Safe zone layer
Overlay layer
Playback HUD

Overlay Placement

Because the current Overlay type does not include explicit x/y coordinates, use type-based preview placement.

| Overlay Type | Preview Position |
|---|---|
| hook | top center |
| body | center |
| caption | bottom caption zone |
| bullet | lower third |
| keyword | center emphasis position |

The Python renderer remains the source of truth for final output.

Active Overlay Rule

An overlay is active when:
ts
currentTime >= overlay.start_time &&
currentTime  element
  → seek to timestamp
  → draw to 
  → export JPEG blob
  → send to main process
  → save artifact

Sampling Tiers

Tier 1 — Fingerprint Pass

Purpose:
text
shot boundaries
brightness
color palette
motion estimation

Recommended defaults:
text
Duration  10 min:  1 frame every 5 seconds

Max frames: 300
Resolution: 160x90 or 256x144
Format: JPEG quality 60

Tier 2 — Evidence Pass

Purpose:
text
visual gist
keywords
scene understanding
object hints
text hints

Recommended defaults:
text
Max frames: 24
Resolution: 640x360
Format: JPEG quality 75
Selection source:
  - first frame
  - last frame
  - transcript segment starts
  - high shot-delta boundaries
  - uniform distribution

Tier 3 — Localization Pass

Purpose:
text
object boxes
face boxes
text regions
safe-zone collisions

Recommended defaults:
text
Max frames: 8–16
Resolution: 1080p or original frame size
Format: JPEG quality 85
Selection source:
  - user-selected frames
  - high-importance transcript segments
  - hook segments
  - detected shot boundaries

6.5 Visual Evidence Contracts

Frame Sample Plan
ts
interface FrameSamplePlan {
  video_id: string
  plan_id: string
  created_at: string

  mode: 'fingerprint' | 'evidence' | 'localization' | 'full'

  target_width: number
  target_height: number
  jpeg_quality: number

  frames: FrameSampleRequest[]
}

Frame Manifest
ts
interface FrameManifest {
  video_id: string
  plan_id: string
  frame_count: number
  frames: FrameManifestItem[]
}

Visual Digest
ts
interface VisualDigest {
  gist: string
  summary: string

  keywords: string[]
  topics: string[]
  entities: string[]

  setting?: string
  actions: string[]

  objects_visible: string[]
  textonscreen: string[]

  visual_complexity: 'low' | 'medium' | 'high'
  motion_level: 'low' | 'medium' | 'high'
  color_palette: string[]

  confidence: number
  source: string
}

Detected Object
ts
interface DetectedObject {
  id: string
  frame_id?: string
  timestamp_sec: number
  endtimestampsec?: number

  label: string
  confidence: number

  box: {
    x: number
    y: number
    w: number
    h: number
  }

  mask_path?: string
  source: string
  properties?: Record
}

Shot Boundary
ts
interface ShotBoundary {
  id: string
  start_sec: number
  end_sec: number
  confidence: number
  reason: string
  source: string
  prevframeid?: string
  nextframeid?: string
}

Style Profile
ts
interface StyleProfile {
  id: string
  name: string

  sourcevideoid?: string
  source_path?: string

  duration_sec?: number

  pacing: 'slow' | 'medium' | 'fast'
  avgshotduration_sec?: number
  cutrateper_min?: number

  motion_level: string
  visual_complexity: string

  color_palette: string[]
  brightness?: number
  contrast?: number

  text_density: 'none' | 'low' | 'medium' | 'high'
  caption_style?: string
  hook_style?: string

  overlay_density?: string
  preferredoverlaytypes: string[]

  notes?: string

  source: string
  confidence: number
}

6.6 Manual Visual Bridge

Because Ollama may not be running, visual analysis should support a Manual Visual Bridge.

Flow
text
Select evidence frames
Generate visual prompt
Export frame packet / contact sheet
User pastes response JSON
Validate response
Accept result

Contact Sheets

Python or frontend tooling may generate contact sheets:
text
contactsheet01.jpg
contactsheet02.jpg

Each contact sheet should include timestamp labels.

6.7 Visual Evidence UI

The Visual Evidence view should contain:
text
Frame filmstrip
Selected frame preview
Manual object markers
Manual text regions
Manual face regions
Shot blocks
Visual digest summary

Actions
text
Mark face region
Mark text region
Mark product/object region
Add visual note
Generate visual bridge prompt

Degraded State

If visual analysis is unavailable:
text
Visual evidence unavailable

Overlay Studio can continue using transcript-only analysis.

6.8 Visual Collision Constraints

Detected objects, faces, and text regions should affect overlay placement.

Protected Region
ts
interface ProtectedRegion {
  id: string
  start_sec: number
  end_sec: number

  label: string
  box: {
    x: number
    y: number
    w: number
    h: number
  }

  strength: number
  source: string
}

Recommended strengths:
text
face: 0.95
existing_text: 0.90
product: 0.85
screen_ui: 0.80
person: 0.65
logo: 0.55

Overlay warnings should appear when an overlay intersects a protected region.

Module C — Unified Context Management System

7.1 Purpose

The Context Management System creates a persistent, continuously updated understanding of the user.

It answers:
text
Who is this person?
What do they care about?
How do they communicate?
What are their habits?
How have they grown?
What should the AI remember?

7.2 Core Components

The Context Management System has four main components:
text
Unified Context Store
Auto-Context Engine
Context Profile Page
Context-Aware AI Integration

7.3 Existing Systems to Integrate

The application already contains several partial context systems:

| System | Purpose | Gap |
|---|---|---|
| Agent Memory System | Tiered hot/warm/cold memories | Terminal-only |
| AI Chat Memory Extractor | Extract memories from chat | Per-thread, limited persistence |
| Learner Profile | Learning behavior | Lyceum-only |
| Life Phases | Long-term personal periods | No unified profile |
| Context Assembly Service | Workspace context | Not connected to AI chat |
| AI Context Bundle | Live AI chat context | No user profile data |

The new system must unify these without replacing them.

7.4 Unified Context Store

The Unified Context Store aggregates all user signals into a single profile.

New Table: usercontextprofile
sql
CREATE TABLE usercontextprofile (
  id TEXT PRIMARY KEY DEFAULT 'main',
  traits JSON DEFAULT '{}',
  habits JSON DEFAULT '{}',
  preferences JSON DEFAULT '{}',
  goals_pattern JSON DEFAULT '{}',
  activity_pattern JSON DEFAULT '{}',
  growth_markers JSON DEFAULT '[]',
  communication_style JSON DEFAULT '{}',
  context_version INTEGER DEFAULT 1,
  lastupdatedat INTEGER,
  created_at INTEGER
);

New Table: usercontextsignals
sql
CREATE TABLE usercontextsignals (
  id TEXT PRIMARY KEY,
  signal_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  firstseenat INTEGER,
  lastseenat INTEGER,
  occurrence_count INTEGER DEFAULT 1,
  superseded_by TEXT
);

Signal Types
text
preference
habit
correction
pattern
milestone
interest
communication_style
goal_pattern

Signal Sources
text
chat
goal
life_phase
app_usage
memory
workspace
overlay_studio

7.5 Auto-Context Engine

The Auto-Context Engine listens to user activity and extracts context signals.

It should process:
text
chat messages
goal completions
life phase updates
app usage patterns
memory corrections
workspace commands
overlay studio actions
content creation preferences

Example Signal Extraction

| Event | Extracted Signal |
|---|---|
| User repeatedly asks for concise answers | communication_style: prefers concise responses |
| User frequently uses Overlay Studio | interest: video editing / AI creative tools |
| User completes multiple learning goals | goal_pattern: strong learning focus |
| User corrects AI: “Don’t use emojis” | preference: no emojis |
| User works mostly at night | habit: nighttime focus pattern |
| User finishes a life phase milestone | growth_marker: phase completion |

Confidence Scoring

Each signal has confidence based on:
text
occurrence count
recency
source reliability
explicitness
conflict history

Suggested formula:
text
confidence =
  base_confidence
  + occurrence_weight
  + recency_weight
  + explicitstatementweight
  - conflict_penalty

Conflict Resolution

Rules:
text
Newer user-stated preference overrides older inferred preference.
Explicit correction overrides inferred behavior.
Higher-confidence repeated pattern overrides one-time event.
Superseded signals are kept for history but not used as primary context.

7.6 Context Profile Page

Route:
text
/life?tab=profile

This page is read-derived.

The user does not manually edit the profile.

Visual Sections
text
Personality Radar
Interest Map
Growth Timeline
Activity Heatmap
Communication Style
Memory Highlights

Personality Radar

Derived traits:
text
analytical vs creative
detail-oriented vs big-picture
self-directed vs guided
technical vs narrative
experimental vs structured

Interest Map

Top interests ranked by engagement.

Example:
text
AI systems
Video editing
Personal growth
Learning
Productivity

Growth Timeline

Shows:
text
milestones
goal completions
life phase transitions
skill progression
major corrections

Activity Heatmap

Grid:
text
hour-of-day × day-of-week

Metrics:
text
app usage
focus sessions
AI chat activity
workspace activity
creative tool usage

Communication Style

Derived from AI interactions:
text
prefers direct answers
prefers detailed specs
prefers code examples
prefers step-by-step collaboration
dislikes vague responses

Memory Highlights

Important stored memories:
text
explicit preferences
corrections
recurring goals
important projects
emotional milestones

7.7 Context-Aware AI Chat

The AI chat system should inject relevant context into its system prompt.

Context Injection Categories
text
user personality traits
communication style
interest areas
recent activity
key memories
explicit preferences
current goals
life phase context

Token Budget

Keep injected profile context under:
text
12,000 characters total

Recommended budget:
text
Personality/style: 1.5K
Interests: 1K
Recent activity: 1.5K
Goals: 1.5K
Memories: 2.5K
Preferences/corrections: 1.5K
Life phase context: 1.5K
Reserved buffer: 1K

7.8 Workspace Context Integration

Terminal/workspace agents should also receive user context.

The existing assemble-context flow should be extended to include:
text
usercontextprofile summary
recent relevant memories
explicit preferences
current project context
communication style

7.9 Context IPC Endpoints

Required new IPC channels:

| Channel | Direction | Purpose |
|---|---|---|
| context:get-profile | renderer → main | Get unified user context profile |
| context:update-profile | renderer → main | Update profile fields |
| context:add-signal | renderer → main | Record a new context signal |
| context:get-signals | renderer → main | Query signals by type/source |
| context:rebuild | renderer → main | Force rebuild profile from sources |
| context:get-growth | renderer → main | Get growth markers timeline |

Module D — Content Creation Skills Integration

8.1 Purpose

Content creation skills provide reusable creative strategies.

They influence:
text
hook style
caption style
overlay density
pacing
animation preference
CTA behavior
visual tone

They must not hardcode topic.

8.2 Skill Preset Shape
ts
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

8.3 Skill Integration Points

Overlay Studio Dashboard

Add optional card:
text
Content Skills
Apply a content creation preset to prompt generation.

Manual Bridge Prompt Step

Add optional selector:
text
Prompt preset:
Default
Short-form Hook
Tutorial Explainer
Product Demo
Lecture Summary

Scene DSL Prompt

Skill presets can influence:
text
overlay density
hook frequency
caption length
animation style
emphasis behavior

Application Data Flow

9.1 Overlay Studio Flow
text
User opens /studio
  → Dashboard loads
  → User imports video or loads sample
  → Session created
  → Transcript loaded/generated
  → Optional visual evidence captured
  → User opens Manual Bridge
  → Prompt generated
  → User copies prompt to AI
  → User pastes AI JSON
  → System validates JSON
  → Cut plan stored
  → Scene DSL generated
  → Scene plan stored
  → Visualizer previews overlays
  → Export outputs JSON/render

9.2 Context Flow
text
User interacts with app
  → Auto-Context Engine extracts signal
  → Signal stored in usercontextsignals
  → Profile rebuilt or incrementally updated
  → AI chat reads profile
  → Workspace agents read profile
  → Profile page visualizes derived data

9.3 Skills Flow
text
User selects content skill
  → Skill variables injected into prompt
  → Manual Bridge uses prompt variables
  → Scene DSL adapts overlay style
  → Visualizer previews styled overlays

File Structure Implementation

10.1 Overlay Studio Frontend
text
src/features/overlay-studio/
├─ OverlayStudioPage.tsx
│
├─ state/
│  ├─ studioTypes.ts
│  ├─ studioReducer.ts
│  └─ StudioProvider.tsx
│
├─ constants/
│  └─ studioConstants.ts
│
├─ components/
│  ├─ shell/
│  │  ├─ StudioShell.tsx
│  │  ├─ StudioSidebar.tsx
│  │  ├─ StudioWorkspace.tsx
│  │  └─ StudioInspector.tsx
│  │
│  ├─ dashboard/
│  │  └─ DashboardView.tsx
│  │
│  ├─ transcript/
│  │  └─ TranscriptView.tsx
│  │
│  ├─ vision/
│  │  └─ VisualEvidenceView.tsx
│  │
│  ├─ bridge/
│  │  └─ ManualBridgePanel.tsx
│  │
│  ├─ cutplan/
│  │  └─ CutPlanView.tsx
│  │
│  ├─ scene/
│  │  └─ ScenePlanView.tsx
│  │
│  ├─ visualizer/
│  │  └─ VisualizerView.tsx
│  │
│  ├─ export/
│  │  └─ ExportView.tsx
│  │
│  └─ states/
│     ├─ StudioEmptyState.tsx
│     ├─ StudioLoadingState.tsx
│     └─ StudioErrorState.tsx
│
├─ hooks/
│  ├─ usePlayback.ts
│  ├─ useCanvasScale.ts
│  ├─ useTimelineInteraction.ts
│  └─ useManualBridge.ts
│
├─ services/
│  ├─ studioSessionService.ts
│  ├─ studioArtifactService.ts
│  ├─ studioPythonService.ts
│  └─ frameCaptureService.ts
│
└─ utils/
   ├─ time.ts
   ├─ canvasScale.ts
   └─ pipeline.ts

10.2 Context Management Frontend
text
src/features/context/
├─ ContextProfilePage.tsx
├─ components/
│  ├─ PersonalityRadar.tsx
│  ├─ InterestMap.tsx
│  ├─ GrowthTimeline.tsx
│  ├─ ActivityHeatmap.tsx
│  ├─ CommunicationStyleCard.tsx
│  └─ MemoryHighlights.tsx
│
├─ hooks/
│  ├─ useContextProfile.ts
│  └─ useContextSignals.ts
│
└─ services/
   └─ contextService.ts

10.3 Main Process Services
text
src/main/
├─ context/
│  ├─ contextProfileService.ts
│  ├─ contextSignalService.ts
│  ├─ autoContextEngine.ts
│  └─ contextIpc.ts
│
├─ overlay-studio/
│  ├─ studioSessionService.ts
│  ├─ studioArtifactService.ts
│  ├─ pythonRunnerService.ts
│  └─ studioIpc.ts
│
└─ ai/
   ├─ memoryStore.ts
   ├─ memoryCapture.ts
   ├─ memoryExtractor.ts
   └─ aiContextInjection.ts

10.4 Python Backend Extension
text
python/clement/
├─ contracts/
├─ extraction/
├─ animation/
├─ render/
├─ registry/
├─ validators/
│
└─ vision/
   ├─ contracts.py
   ├─ sampling.py
   ├─ fingerprints.py
   ├─ shot_detect.py
   ├─ digest.py
   ├─ objects.py
   ├─ faces.py
   ├─ text_regions.py
   ├─ style.py
   ├─ collision.py
   ├─ bridge.py
   │
   └─ providers/
      ├─ base.py
      ├─ manual.py
      ├─ heuristic.py
      ├─ ollama_vlm.py
      └─ sam3.py

IPC and Backend Integration

11.1 Overlay Studio IPC

Recommended channels:

| Channel | Purpose |
|---|---|
| studio:list-sessions | List all studio sessions |
| studio:create-session | Create session from local path |
| studio:get-session | Get one session |
| studio:update-session | Update session metadata/status |
| studio:remove-session | Remove session reference |
| studio:repoint-source | Replace missing video path |
| studio:save-artifact | Save JSON artifact |
| studio:load-artifact | Load JSON artifact |
| studio:run-python | Run Python CLI stage |
| studio:capture-frame-plan | Store frame capture plan |
| studio:save-frame | Save captured frame |

11.2 Context IPC

Required channels:

| Channel | Purpose |
|---|---|
| context:get-profile | Get unified profile |
| context:update-profile | Update profile fields |
| context:add-signal | Add signal |
| context:get-signals | Query signals |
| context:rebuild | Rebuild profile |
| context:get-growth | Get growth timeline |

11.3 Existing Channels to Reuse

| Channel | Purpose |
|---|---|
| memory:get | Read agent memories |
| memory:search | Search agent memories |
| memory:add | Add agent memory |
| ai-chat:get-memories | Read chat memories |
| ai-chat:extract-memories | Extract chat memories |
| lifePhase:get | Read life phases |
| lifePhase:getPeriodContext | Get period context |
| get-goals | Read goals |
| getDashboardAggregates | Read app usage aggregates |

Design System

12.1 Overlay Studio Tokens

Use existing DeskFlow studio tokens:
css
--bg-primary: #09090b;
--bg-glass: rgba(24, 24, 27, 0.80);
--border-glass: rgba(63, 63, 70, 0.50);
--accent-primary: #ec4899;
--accent-secondary: #22d3ee;
--text-primary: #f4f4f5;
--text-secondary: #a1a1aa;
--text-muted: #52525b;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);

12.2 Context Profile Tokens

Use warm dark theme:
css
--dk-bg-deep: #0c0a09;
--dk-bg-base: #1a1614;
--dk-bg-surface: rgba(28, 24, 22, 0.92);
--dk-bg-raised: rgba(38, 32, 28, 0.95);
--dk-accent: #d9a87c;
--dk-accent-dim: rgba(217, 168, 124, 0.12);
--dk-success: #6fb38f;
--dk-warning: #e8a44a;
--dk-danger: #d96846;
--dk-text-primary: #f5f0eb;
--dk-text-secondary: #d6cec6;
--dk-text-muted: #a09589;

12.3 Shared UX Rules

All interactive controls must satisfy:
text
minimum 44px target height
visible focus ring
clear hover state
clear disabled reason

Focus style:
css
focus-visible:ring-2
focus-visible:outline-none

Use motion durations:
text
micro: 120ms
standard: 200ms
panel: 280ms
overlay: 220ms

Empty, Loading, and Error State Matrix

Every major view must implement all three states.

| View | Empty State | Loading State | Error State |
|---|---|---|---|
| Dashboard | No sessions yet | Loading sessions | Retry sessions |
| Source | No source selected | Checking source | Missing source |
| Transcript | No transcript yet | Generating transcript | Transcription failed |
| Visual Evidence | No frames available | Capturing frames | Frame capture failed |
| Manual Bridge | No response pasted | Validating response | Invalid JSON/schema |
| Cut Plan | No cut plan yet | Preparing preview | Invalid cut plan |
| Scene Plan | No scene plan yet | Preparing scene plan | Invalid scene DSL |
| Visualizer | No scene plan | Building preview | Preview failed |
| Export | Nothing to export | Preparing export | Export failed |
| Context Profile | No signals yet | Building profile | Profile rebuild failed |

Implementation Roadmap

Phase 0 — Stabilize Overlay Studio Core

Goal:

Make the existing Overlay Studio functional.

Tasks:
text
Fix Manual Bridge empty prompt
Fix Dashboard navigation
Fix Inspector collapse/reopen
Fix Sidebar disabled steps
Fix missing imports
Verify Load Sample button
Verify bridge validation pipeline
Verify npx vite build passes

Acceptance:
text
Fresh app opens Dashboard.
Load Sample creates session.
Manual Bridge prompt is visible.
Copy/paste validation works.
Inspector can be reopened.
Sidebar steps are clickable.

Phase 1 — Session Persistence and Artifact Storage

Goal:

Make sessions survive app restarts.

Tasks:
text
Create overlaystudiosessions table
Create studio session IPC handlers
Store artifacts under app data
Load sessions on app start
Detect missing source paths
Implement repoint source flow

Acceptance:
text
Sessions persist after restart.
Missing source is detected.
User can repoint file.
Removing session does not delete video.

Phase 2 — Full Overlay Studio Pipeline

Goal:

Make every pipeline stage usable.

Tasks:
text
Build TranscriptView
Build CutPlanView
Build ScenePlanView
Build ExportView
Connect Manual Bridge acceptance to views
Add approval/rejection controls
Add empty/loading/error states

Acceptance:
text
User can move from transcript to cut plan.
User can approve cut plan.
User can generate scene plan.
Scene plan appears in Scene Plan view.
Export JSON works.

Phase 3 — Visualizer and Timeline

Goal:

Provide visual preview.

Tasks:
text
Build VisualizerView
Build CanvasStage
Build OverlayLayer
Build SafeZoneLayer
Build TimelinePanel
Build Playhead
Connect playback state
Add keyboard shortcuts

Acceptance:
text
Scene plan overlays render on 9:16 canvas.
Timeline shows transcript/cut/overlay blocks.
Playhead scrubbing works.
Safe zones can be toggled.

Phase 4 — Visual Evidence Engine MVP

Goal:

Add visual understanding without requiring ffmpeg or Ollama.

Tasks:
text
Add VisualEvidenceView
Build frame capture service
Store frame artifacts
Build frame filmstrip
Allow manual object/text/face marking
Add Manual Visual Bridge prompt
Validate visual digest JSON

Acceptance:
text
User can capture frames if video is playable.
User can view frame filmstrip.
User can mark objects manually.
Manual Visual Bridge validates visual JSON.
Visual evidence degrades gracefully.

Phase 5 — Unified Context Management Core

Goal:

Create the persistent user context store.

Tasks:
text
Create usercontextprofile table
Create usercontextsignals table
Build ContextProfileService
Build ContextSignalService
Add context IPC handlers
Build profile rebuild logic

Acceptance:
text
Signals can be added.
Profile can be rebuilt.
IPC endpoints return profile data.
Signals are deduplicated and confidence-scored.

Phase 6 — Auto-Context Engine

Goal:

Update context automatically from user behavior.

Tasks:
text
Listen to AI chat messages
Listen to goal updates
Listen to life phase updates
Listen to app usage changes
Listen to memory corrections
Extract signals
Merge signals into profile
Trigger context re-injection

Acceptance:
text
Chat interaction creates signals.
Goal completion creates signals.
Preference corrections update profile.
Profile updates without manual editing.

Phase 7 — Context Profile Page

Goal:

Visualize the user’s context profile.

Tasks:
text
Add /life?tab=profile route
Build PersonalityRadar
Build InterestMap
Build GrowthTimeline
Build ActivityHeatmap
Build CommunicationStyleCard
Build MemoryHighlights

Acceptance:
text
Profile page loads derived data.
All sections use read-derived data.
User cannot manually edit core profile fields.
Clicking growth marker shows source.

Phase 8 — Context-Aware AI Chat

Goal:

Make AI chat feel personalized.

Tasks:
text
Extend aiContextBundle.ts
Inject profile summary
Inject preferences
Inject recent activity
Inject relevant memories
Respect 12K token budget

Acceptance:
text
AI chat receives profile context.
Context injection stays under token budget.
AI respects explicit preferences.
Context updates when profile changes.

Phase 9 — Workspace Context Integration

Goal:

Use context in terminal/workspace agents.

Tasks:
text
Extend assemble-context
Add user profile summary
Add communication style
Add relevant project/memory context

Acceptance:
text
Workspace agents receive user context.
Terminal agent responses adapt to preferences.
Context does not exceed token budget.

Phase 10 — Skills and Creative Presets

Goal:

Allow content creation skills to influence prompts.

Tasks:
text
Create ContentSkillPreset model
Add skill selector to Manual Bridge
Inject skill variables into prompts
Connect skill presets to scene DSL generation

Acceptance:
text
User can choose a skill preset.
Prompt changes based on preset.
Scene DSL output reflects style variables.
System remains topic-agnostic.

Testing Plan

15.1 Overlay Studio Tests

Fresh Open
text
Dashboard loads.
No session is required.
All tool cards are visible.
Import Video and Load Sample are visible.

Load Sample
text
Clicking Load Sample creates a session.
Transcript status becomes ready.
Dashboard tool cards update.

Dashboard Navigation
text
Clicking Transcript navigates or opens bridge.
Clicking Manual Bridge opens bridge.
Clicking Cut Planner navigates or opens bridge.
Clicking Scene DSL navigates or opens bridge.
Clicking Scene Visualizer navigates or opens bridge.

Manual Bridge
text
Prompt is visible with no session.
Prompt is visible with session but no transcript.
Prompt is visible with transcript.
Copy button works.
Paste area accepts response.
Validate button produces checklist.
Accept result stores cut plan or scene plan.

Inspector
text
Inspector can be collapsed.
Inspector remains mounted.
Inspector can be reopened.

Sidebar
text
Sidebar steps are clickable.
Sidebar steps are not disabled.
Without session, steps navigate to dashboard.
With session, steps navigate to stage.

15.2 Visual Evidence Tests
text
Frame capture works for playable video.
Frame capture fails gracefully for unplayable video.
Filmstrip displays captured frames.
Manual object marking works.
Manual text marking works.
Manual face marking works.
Manual Visual Bridge validates JSON.
Visual digest appears after acceptance.

15.3 Context Management Tests
text
Signal can be added.
Duplicate signal increases occurrence count.
Conflicting signal can supersede old signal.
Profile rebuild produces JSON profile.
Profile page renders derived sections.
AI chat context injection remains under token budget.

Risks and Mitigations

| Risk | Mitigation |
|---|---|
| ffmpeg missing | Use JSON export, renderer-disabled state, and browser frame capture |
| Ollama missing | Use Manual Bridge |
| Video codec not playable | Show degraded visual evidence state and continue transcript-only |
| AI returns invalid JSON | Use parser, validation checklist, repair prompt |
| Context becomes too large | Token budgeting and ranked context selection |
| Profile inference becomes inaccurate | Confidence scoring, explicit corrections, superseding signals |
| UI becomes overwhelming | 3-pane layout, contextual inspector, clear pipeline states |
| Local paths break | Missing source detection and repoint flow |
| Python backend unavailable | Frontend can still manage sessions, prompts, validation, and JSON export |

Definition of Done

The system is considered implementation-ready when:
text
Overlay Studio opens without errors.
All dashboard tools navigate.
Manual Bridge prompt is always visible.
Manual Bridge validation works.
Sessions persist locally.
Video paths are not copied.
Missing source states are handled.
Cut plan can be generated and reviewed.
Scene plan can be generated and reviewed.
Visualizer previews overlays.
Timeline displays pipeline blocks.
Export produces JSON.
Visual evidence degrades gracefully.
Context profile store exists.
Context signals can be added.
Profile page displays derived data.
AI chat receives context.
Workspace agents receive context.
Build passes.
No critical bug regressions exist.

Final System Summary

The completed system is a unified local-first AI environment.

It gives the user:
text
A video overlay studio.
A visual evidence engine.
A manual AI bridge.
A suggestion-based editing workflow.
A persistent personal context profile.
A context-aware AI chat.
A context-aware workspace.
A visual growth profile.
Content creation skill integration.

The implementation should proceed in this order:
text
Fix Overlay Studio core.
Persist sessions and artifacts.
Complete pipeline views.
Add visualizer and timeline.
Add visual evidence engine.
Build unified context store.
Build auto-context engine.
Build context profile page.
Integrate context into AI chat.
Integrate context into workspace and skills.

This document is the master implementation reference for building the full system into the application.