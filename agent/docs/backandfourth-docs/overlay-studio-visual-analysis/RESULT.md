Yes — I understand the new scope.

We are now extending Overlay Studio from a **transcript-only suggestion engine** into a **multimodal Visual Analysis Engine**.

The new system must understand not only:

> “What is being said?”

but also:

> “What is happening on screen?”

That means adding support for:

- video frame sampling,
- visual evidence extraction,
- shot decomposition,
- object localization,
- face/text/screen-content awareness,
- asset enrichment,
- style-reference analysis,
- visual collision constraints for overlay placement.

The important constraint is that the current environment has:

```text
Python 3.12 ✅
faster-whisper ✅
ffmpeg ❌
Ollama ❌
SAM-3 not assumed
Node v24 ✅
Electron + React frontend ✅
Manual Bridge ✅
```

So the architecture must be designed to work **without ffmpeg, without Ollama, and without expensive external services**, while still allowing those capabilities to be plugged in later.

---

# 1. Core Design Principle

The Visual Analysis Engine should not replace the existing transcript pipeline.

It should add a parallel **Visual Evidence Layer**.

Current pipeline:

```text
Video
  → Transcript
  → Cut Plan
  → Scene DSL
  → Overlay Preview
  → Export
```

New pipeline:

```text
Video
  → Transcript
  → Visual Frame Sampling
  → Visual Analysis
  → Shot Map
  → Asset Enrichment
  → Object / Face / Text Regions
  → Style Reference
  → Cut Plan
  → Scene DSL
  → Overlay Collision Check
  → Preview
  → Export
```

The transcript remains the primary temporal spine.

Visual analysis enriches it.

---

# 2. High-Level Architecture

I propose a new backend module:

```text
python/clement/vision/
```

and a new frontend capability:

```text
src/features/overlay-studio/vision/
```

The Visual Analysis Engine should be provider-based.

That means every capability can have multiple implementations:

```text
Frame sampling provider
Visual description provider
Object detection provider
Shot boundary provider
Style analysis provider
```

For example:

```text
Visual Description Provider:
  - none
  - heuristic
  - manual-bridge
  - ollama-vlm
  - external-vlm

Object Detection Provider:
  - none
  - manual-user
  - heuristic-saliency
  - vlm-bboxes
  - sam3
```

This allows graceful degradation.

---

# 3. Provider Capability Matrix

The system should always show what is available.

| Capability | Best Provider | Fallback |
|---|---|---|
| Frame extraction | Electron `<video>` + canvas capture | manual user screenshots |
| Shot boundaries | frame fingerprint deltas | transcript segment boundaries |
| Visual gist | VLM | Manual Visual Bridge |
| Keywords | transcript + VLM | transcript-only |
| Object localization | SAM-3 / VLM boxes | manual user boxes |
| Face awareness | face detector / VLM | manual face region |
| On-screen text detection | OCR/VLM | manual text region |
| Style reference analysis | shot stats + VLM | manual style tags |

The UI should never pretend a provider exists when it does not.

Example:

```text
Visual analysis is running in degraded mode.

Available:
- Frame sampling
- Manual visual bridge
- Heuristic shot boundaries

Unavailable:
- Ollama VLM
- SAM-3 object segmentation
- ffmpeg frame extraction
```

---

# 4. No-FFmpeg Frame Extraction Strategy

Since ffmpeg is not installed, the safest primary path is:

> Use Electron/Chromium’s built-in video decoder through a hidden `<video>` element and `<canvas>`.

This avoids requiring ffmpeg for basic frame sampling.

## Frontend Frame Capture Flow

```text
User clicks “Scan Video”
  ↓
Frontend opens hidden <video> using local file path
  ↓
Frontend generates frame timestamp plan
  ↓
For each timestamp:
    seek video
    wait for seeked
    draw frame to canvas
    export JPEG blob
    send frame to main process / Python artifact store
  ↓
Python receives frame manifest
  ↓
Python runs visual analysis
```

This works if the video codec is playable inside Chromium.

If the video is not playable, the UI should show:

```text
Video preview unavailable.

This file cannot be decoded by the built-in player.
Transcript-only analysis can continue, but visual analysis is unavailable.
```

---

# 5. Frame Sampling Strategy

We should use multiple sampling tiers.

Do not capture every frame.

Use a budget-based strategy.

---

## Tier 1 — Fingerprint Pass

Purpose:

- shot boundary detection,
- motion estimation,
- brightness/color palette,
- visual complexity.

Recommended defaults:

```text
Duration < 60s:     1 frame per second
Duration 1–10 min:  1 frame every 2 seconds
Duration > 10 min:  1 frame every 5 seconds

Max frames: 300
Resolution: 160x90 or 256x144
Format: JPEG quality 60
```

These frames are cheap and can be used for histograms, deltas, and shot detection.

---

## Tier 2 — Evidence Pass

Purpose:

- visual gist,
- keywords,
- scene understanding,
- object hints,
- text-on-screen hints.

Recommended defaults:

```text
Max frames: 24
Resolution: 640x360
Format: JPEG quality 75
Selection source:
  - first frame
  - last frame
  - transcript segment starts
  - high shot-delta boundaries
  - uniform distribution
```

These are the frames shown to the user in a filmstrip.

They can also be sent to a VLM or Manual Visual Bridge.

---

## Tier 3 — Localization Pass

Purpose:

- object boxes,
- face boxes,
- text regions,
- safe-zone collisions.

Recommended defaults:

```text
Max frames: 8–16
Resolution: 1080p or original frame size
Format: JPEG quality 85
Selection source:
  - user-selected frames
  - high-importance transcript segments
  - hook segments
  - detected shot boundaries
```

This pass is only used when object localization is requested.

---

# 6. Frame Sampling Contract

Add a new contract:

```python
class FrameSamplePlan(BaseModel):
    video_id: str
    plan_id: str
    created_at: str

    mode: str  # fingerprint | evidence | localization | full

    target_width: int
    target_height: int
    jpeg_quality: int

    frames: list[FrameSampleRequest]
```

```python
class FrameSampleRequest(BaseModel):
    frame_id: str
    timestamp_sec: float
    reason: str
    priority: int
```

Example:

```json
{
  "video_id": "lesson_01",
  "plan_id": "plan_123",
  "mode": "evidence",
  "target_width": 640,
  "target_height": 360,
  "jpeg_quality": 75,
  "frames": [
    {
      "frame_id": "f_00000",
      "timestamp_sec": 0.0,
      "reason": "first_frame",
      "priority": 1
    },
    {
      "frame_id": "f_00012",
      "timestamp_sec": 16.2,
      "reason": "transcript_segment_start",
      "priority": 2
    }
  ]
}
```

---

# 7. Frame Manifest Contract

After the frontend captures frames, Python stores a manifest:

```python
class FrameManifest(BaseModel):
    video_id: str
    plan_id: str
    frame_count: int
    frames: list[FrameManifestItem]
```

```python
class FrameManifestItem(BaseModel):
    frame_id: str
    timestamp_sec: float
    path: str
    width: int
    height: int
    reason: str
```

Example artifact:

```text
artifacts/{sessionId}/vision/frames.json
```

Frames stored under:

```text
artifacts/{sessionId}/vision/frames/
  f_00000.jpg
  f_00012.jpg
  f_00045.jpg
```

This keeps the visual analysis artifacts separate from transcript artifacts.

---

# 8. Visual Analysis Contract

The main output should be:

```python
class VisualAnalysis(BaseModel):
    video_id: str
    status: str
    created_at: str

    providers: list[str]

    frame_manifest_path: str | None
    digest: VisualDigest | None
    shots: list[ShotBoundary]
    objects: list[DetectedObject]
    text_regions: list[TextRegion]
    faces: list[FaceRegion]
    style: StyleProfile | None

    warnings: list[str]
```

Status values:

```text
pending
capturing_frames
analyzing
partial
ready
failed
unavailable
```

Example:

```json
{
  "video_id": "lesson_01",
  "status": "partial",
  "providers": [
    "frontend-frame-capture",
    "heuristic-shot-detector",
    "manual-visual-bridge"
  ],
  "digest": {
    "gist": "A person explains a concept while showing slides.",
    "keywords": ["tutorial", "diagram", "presentation"],
    "topics": ["education"],
    "confidence": 0.62
  },
  "shots": [],
  "objects": [],
  "text_regions": [],
  "faces": [],
  "style": null,
  "warnings": [
    "VLM unavailable. Visual digest was generated through Manual Bridge."
  ]
}
```

---

# 9. Visual Digest / Asset Enrichment

Asset enrichment should produce a structured summary of the video.

## VisualDigest Contract

```python
class VisualDigest(BaseModel):
    gist: str
    summary: str

    keywords: list[str]
    topics: list[str]
    entities: list[str]

    setting: str | None
    actions: list[str]

    objects_visible: list[str]
    text_on_screen: list[str]

    visual_complexity: str  # low | medium | high
    motion_level: str       # low | medium | high
    color_palette: list[str]

    confidence: float
    source: str
```

Example:

```json
{
  "gist": "A presenter explains a workflow using slides and screen recordings.",
  "summary": "The video alternates between a talking head, slide close-ups, and product screenshots.",
  "keywords": [
    "presentation",
    "slides",
    "screen recording",
    "tutorial"
  ],
  "topics": [
    "education",
    "software walkthrough"
  ],
  "entities": [
    "presenter",
    "laptop",
    "dashboard"
  ],
  "setting": "indoor desk environment",
  "actions": [
    "talking to camera",
    "pointing at screen",
    "scrolling through dashboard"
  ],
  "objects_visible": [
    "person",
    "face",
    "laptop",
    "screen"
  ],
  "text_on_screen": [
    "slide headings",
    "menu labels"
  ],
  "visual_complexity": "medium",
  "motion_level": "low",
  "color_palette": [
    "#0f172a",
    "#38bdf8",
    "#f8fafc"
  ],
  "confidence": 0.71,
  "source": "manual-visual-bridge"
}
```

This enrichment can then be injected into:

- cut plan prompts,
- scene DSL prompts,
- style presets,
- dashboard metadata,
- search/library cards.

---

# 10. Manual Visual Bridge

Because Ollama is not running, the most important VLM path is:

> Manual Visual Bridge.

This extends the existing Manual Bridge pattern to support images.

## Flow

```text
1. Select evidence frames
2. Generate visual prompt
3. Export frame packet / contact sheet
4. User pastes response JSON
5. Validate response
6. Accept result
```

## Frame Packet

Since users cannot copy raw image data into a text prompt easily, Python should generate contact sheets.

Example:

```text
artifacts/{sessionId}/vision/contact_sheets/
  contact_sheet_01.jpg
  contact_sheet_02.jpg
```

Each contact sheet is a grid of frames with visible timestamps.

Example layout:

```text
4x4 grid
each cell has timestamp label
filename: contact_sheet_00-15.jpg
```

This allows the user to attach a few images to an external VLM.

## Manual Visual Bridge Prompt

The prompt should ask for strict JSON:

```text
You are a visual analysis engine.

Analyze the attached video frames and transcript metadata.

Return only valid JSON.

Do not include markdown.
Do not include comments.

Use this schema:
{
  "gist": "...",
  "summary": "...",
  "keywords": [],
  "topics": [],
  "entities": [],
  "setting": "...",
  "actions": [],
  "objects_visible": [],
  "text_on_screen": [],
  "visual_complexity": "low | medium | high",
  "motion_level": "low | medium | high",
  "frames": [
    {
      "frame_id": "...",
      "timestamp_sec": 0.0,
      "caption": "...",
      "objects": [],
      "text_visible": [],
      "composition": "...",
      "motion": "..."
    }
  ]
}
```

The frontend should then validate with the same pattern used by `overlayParser.ts`:

```text
extractJson()
validateVisualDigest()
validateFrameEvidence()
generateRepairPrompt()
```

---

# 11. VLM Integration When Available

When Ollama or another VLM becomes available, the same contract should be used.

Provider interface:

```python
class VisualDescriptionProvider(BaseModel):
    provider_id: str

    def available(self) -> bool: ...

    def analyze_frames(
        self,
        frame_manifest: FrameManifest,
        transcript: Transcript | None,
        options: VisualAnalysisOptions,
    ) -> VisualAnalysis: ...
```

Possible providers:

```text
manual-bridge
ollama-llava
ollama-llama3.2-vision
openai-compatible-vlm
local-vlm
```

The output should always be normalized to:

```text
VisualDigest
FrameEvidence
DetectedObject
TextRegion
FaceRegion
```

The frontend should not care which provider produced the result.

---

# 12. Object Localization

Object localization should produce structured object regions.

## DetectedObject Contract

```python
class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float
```

Coordinates should be normalized from `0.0` to `1.0`.

```python
class DetectedObject(BaseModel):
    id: str
    frame_id: str | None
    timestamp_sec: float
    end_timestamp_sec: float | None

    label: str
    confidence: float

    box: BoundingBox
    mask_path: str | None

    source: str
    properties: dict = {}
```

Example:

```json
{
  "id": "obj_001",
  "frame_id": "f_00045",
  "timestamp_sec": 16.2,
  "end_timestamp_sec": 21.0,
  "label": "face",
  "confidence": 0.87,
  "box": {
    "x": 0.62,
    "y": 0.28,
    "w": 0.18,
    "h": 0.22
  },
  "mask_path": null,
  "source": "user",
  "properties": {
    "avoid_overlay": true
  }
}
```

---

# 13. Object Localization Providers

## Provider A — Manual User Boxes

This is the most reliable zero-dependency option.

UI:

```text
Select frame
Draw box
Label object
Set duration
Mark as protected
```

Labels can include:

```text
face
person
hand
product
laptop
screen
whiteboard
text
logo
other
```

This is enough to power overlay collision avoidance.

---

## Provider B — VLM Bounding Boxes

Some VLMs can return bounding boxes.

Prompt example:

```text
Detect important visual objects.

Return normalized bounding boxes from 0 to 1.

Labels:
face, person, product, laptop, screen, text, logo, other
```

Output:

```json
{
  "objects": [
    {
      "frame_id": "f_00045",
      "label": "face",
      "box": {
        "x": 0.62,
        "y": 0.28,
        "w": 0.18,
        "h": 0.22
      },
      "confidence": 0.74
    }
  ]
}
```

This should be treated as low-to-medium confidence unless validated.

---

## Provider C — SAM-3 / Segment Anything Style Model

SAM-3 should be treated as an optional advanced provider.

It can accept prompts such as:

```text
point
box
mask
label
```

For example:

```text
User clicks on face in frame
  → SAM-3 receives point prompt
  → SAM-3 returns mask
  → mask converted to bounding box
  → object stored as protected region
```

SAM-3 should not be required for MVP.

Recommended integration:

```text
python/clement/vision/providers/sam3.py
```

It should only activate if the user has installed and configured it.

UI status:

```text
SAM-3 unavailable
Manual object marking is available.
```

---

# 14. Face Awareness

Face awareness is important for overlay placement.

But we should not block the system if face detection is unavailable.

## FaceRegion Contract

```python
class FaceRegion(BaseModel):
    id: str
    frame_id: str | None
    timestamp_sec: float
    end_timestamp_sec: float | None

    box: BoundingBox
    confidence: float

    source: str
```

Faces should become protected regions.

Example:

```text
Do not place hook text over detected faces.
Do not place caption over face cam region.
```

The existing `face_cam` safe zone can be combined with detected face boxes.

---

# 15. On-Screen Text Detection

On-screen text is also important because overlays should not cover existing text.

## TextRegion Contract

```python
class TextRegion(BaseModel):
    id: str
    frame_id: str | None
    timestamp_sec: float
    end_timestamp_sec: float | None

    box: BoundingBox
    text: str | None

    kind: str  # title | subtitle | slide | ui | label | unknown
    confidence: float
    source: str
```

Sources:

```text
vlm
ocr
manual
heuristic
```

For MVP without OCR, use:

```text
Manual Visual Bridge
User-marked text regions
```

The UI can allow:

```text
Mark existing text
Mark slide title
Mark UI element
```

These become overlay exclusion zones.

---

# 16. Shot Decomposition

Shot decomposition should segment the video into reusable visual shots.

This is different from transcript segments.

Transcript segment:

> based on speech timing.

Shot:

> based on visual continuity.

---

# 17. Shot Boundary Detection Without FFmpeg

Since ffmpeg is unavailable, use sampled frames.

Algorithm:

```text
1. Capture fingerprint frames at regular intervals.
2. Compute frame signature:
   - average brightness
   - RGB histogram
   - color moments
   - edge density if OpenCV available
3. Compare consecutive frames.
4. If delta exceeds threshold, mark boundary.
5. Apply minimum shot duration cooldown.
6. Merge tiny shots.
7. Combine with transcript segment boundaries.
```

---

## ShotBoundary Contract

```python
class ShotBoundary(BaseModel):
    id: str

    start_sec: float
    end_sec: float

    confidence: float
    reason: str

    source: str

    prev_frame_id: str | None
    next_frame_id: str | None
```

Example:

```json
{
  "id": "shot_004",
  "start_sec": 16.2,
  "end_sec": 28.0,
  "confidence": 0.72,
  "reason": "visual_delta",
  "source": "heuristic",
  "prev_frame_id": "f_00016",
  "next_frame_id": "f_00017"
}
```

---

## Shot Detection Output

```python
class ShotMap(BaseModel):
    video_id: str
    duration_sec: float

    shots: list[ShotBoundary]

    avg_shot_duration_sec: float
    cut_rate_per_min: float

    source: str
    warnings: list[str]
```

This can be shown as a new timeline track:

```text
Shots
[shot 1][shot 2][shot 3][shot 4]
```

The user should be able to:

```text
Split shot
Merge shot
Mark shot as hook
Mark shot as b-roll
Mark shot as screen recording
Mark shot as talking head
```

---

# 18. Shot Decomposition Degradation

If frame sampling is sparse, shot detection may miss fast cuts.

The UI should say:

```text
Shot detection is approximate.

Frame sampling density is low because ffmpeg is unavailable.
You can manually split shots in the timeline.
```

If no visual frames are available:

```text
Visual shot detection unavailable.

Using transcript segments as fallback shot boundaries.
```

Fallback shot source:

```text
transcript segment boundaries
```

---

# 19. Style Reference Analysis

Style references should extract editing and visual characteristics from reference videos.

The goal is not to copy content, but to learn pacing and visual language.

## StyleProfile Contract

```python
class StyleProfile(BaseModel):
    id: str
    name: str

    source_video_id: str | None
    source_path: str | None

    duration_sec: float | None

    pacing: str  # slow | medium | fast
    avg_shot_duration_sec: float | None
    cut_rate_per_min: float | None

    shot_duration_histogram: dict

    motion_level: str
    visual_complexity: str

    color_palette: list[str]
    brightness: float | None
    contrast: float | None

    text_density: str  # none | low | medium | high
    caption_style: str | None
    hook_style: str | None

    overlay_density: str | None
    preferred_overlay_types: list[str]

    notes: str | None

    source: str
    confidence: float
```

Example:

```json
{
  "id": "style_001",
  "name": "Fast tutorial style",
  "pacing": "fast",
  "avg_shot_duration_sec": 3.2,
  "cut_rate_per_min": 18.7,
  "motion_level": "medium",
  "visual_complexity": "medium",
  "color_palette": ["#0f172a", "#22d3ee", "#f8fafc"],
  "text_density": "high",
  "caption_style": "short punchy captions",
  "hook_style": "question hook with zoom",
  "overlay_density": "medium",
  "preferred_overlay_types": ["hook", "keyword", "bullet"],
  "notes": "Frequent cuts, strong keyword emphasis, minimal long paragraphs.",
  "source": "manual-visual-bridge",
  "confidence": 0.68
}
```

---

# 20. How Style References Influence the Pipeline

Style profiles should not hardcode topic.

They should influence prompt variables.

Example:

```json
{
  "style_profile": "fast_tutorial",
  "target_aspect": "9:16",
  "hook_density": "high",
  "caption_style": "short_punchy",
  "overlay_density": "medium",
  "animation_preference": ["pop", "slide_up"],
  "cut_pacing": "fast"
}
```

These variables can be injected into:

```ts
PROMPT_CUT_PLANNER
PROMPT_SCENE_DSL
```

The system remains topic-agnostic.

Style affects:

- pacing,
- overlay density,
- animation choices,
- hook frequency,
- caption length,
- emphasis style.

It does not affect:

- topic,
- factual content,
- user’s original video meaning.

---

# 21. Visual Collision Detection

Detected objects, faces, and text regions should affect overlay placement.

## ProtectedRegion Contract

```python
class ProtectedRegion(BaseModel):
    id: str
    start_sec: float
    end_sec: float

    label: str
    box: BoundingBox

    strength: float
    source: str
```

Strength values:

```text
0.0 - 1.0
```

Recommended defaults:

```text
face: 0.95
existing_text: 0.90
product: 0.85
screen_ui: 0.80
person: 0.65
logo: 0.55
```

These regions should be checked against overlay time ranges and boxes.

---

## OverlayCollisionReport

```python
class OverlayCollisionReport(BaseModel):
    overlay_id: str
    collisions: list[Collision]
    safe: bool
    score: float
```

```python
class Collision(BaseModel):
    region_id: str
    label: str
    timestamp_sec: float
    overlap_area: float
    severity: str
```

Severity:

```text
info
warning
error
```

Example UI warning:

```text
Overlay covers detected face from 00:16.2 to 00:18.4.
Consider moving the hook above the text-safe region.
```

This can be integrated into the existing scene validator.

---

# 22. Updated Pipeline Artifacts

For each session, store visual artifacts locally.

Recommended structure:

```text
overlay-studio/
  sessions.json
  artifacts/
    {sessionId}/
      transcript.json
      cut_plan.json
      scene_plan.json
      export_plan.json

      vision/
        analysis.json
        frames.json
        frames/
          f_00000.jpg
          f_00012.jpg
        contact_sheets/
          contact_sheet_01.jpg
        shots.json
        objects.json
        text_regions.json
        faces.json
        style_reference.json
```

This keeps visual analysis optional and non-destructive.

If visual analysis fails, transcript artifacts still remain usable.

---

# 23. Python Module Structure

Add:

```text
python/clement/vision/
  __init__.py
  contracts.py
  sampling.py
  fingerprints.py
  shot_detect.py
  digest.py
  objects.py
  faces.py
  text_regions.py
  style.py
  collision.py
  bridge.py

  providers/
    __init__.py
    base.py
    manual.py
    heuristic.py
    ollama_vlm.py
    sam3.py
```

## Suggested Responsibilities

```text
contracts.py
  Pydantic models for vision artifacts.

sampling.py
  Build FrameSamplePlan from duration + transcript.

fingerprints.py
  Compute frame signatures using PIL/Numpy.

shot_detect.py
  Detect shot boundaries from frame deltas.

digest.py
  Build VisualDigest from VLM/manual/heuristic outputs.

objects.py
  Normalize object boxes and masks.

faces.py
  Face region handling.

text_regions.py
  On-screen text region handling.

style.py
  Style reference extraction and storage.

collision.py
  Overlay collision detection.

bridge.py
  Manual Visual Bridge prompt generation and validation.
```

---

# 24. CLI Extensions

Extend `python/main.py` with vision subcommands.

Recommended commands:

```bash
python main.py vision-plan \
  --session session_id \
  --transcript transcript.json \
  --mode evidence

python main.py vision-import-frames \
  --session session_id \
  --frames frames.json

python main.py vision-analyze \
  --session session_id \
  --provider manual

python main.py vision-shots \
  --session session_id

python main.py vision-style \
  --session session_id

python main.py vision-validate \
  --session session_id
```

Alternatively, use a unified command:

```bash
python main.py vision \
  --action analyze \
  --session session_id
```

But explicit subcommands are cleaner.

---

# 25. Frontend Additions

Add a new feature folder:

```text
src/features/overlay-studio/vision/
```

Recommended components:

```text
vision/
  components/
    VisualAnalysisPanel.tsx
    FrameFilmstrip.tsx
    FrameThumbnail.tsx
    FrameCaptureDialog.tsx
    VisualDigestCard.tsx
    ShotMapPanel.tsx
    ObjectMarkerCanvas.tsx
    ObjectListItem.tsx
    TextRegionListItem.tsx
    FaceRegionListItem.tsx
    StyleReferencePanel.tsx
    VisualBridgePanel.tsx
    VisualValidationChecklist.tsx
    ProviderStatusBadge.tsx
    DegradedModeBanner.tsx

  hooks/
    useFrameCapture.ts
    useVisualAnalysis.ts
    useShotMap.ts
    useObjectMarkers.ts
    useStyleReferences.ts

  services/
    frameCaptureService.ts
    visualAnalysisService.ts
    visualBridgeService.ts
    styleReferenceService.ts

  types/
    vision.ts
```

---

# 26. Frontend Frame Capture Service

This is one of the most important new frontend services.

Conceptual API:

```ts
interface FrameCaptureOptions {
  sessionId: string
  videoPath: string
  mode: 'fingerprint' | 'evidence' | 'localization'
  maxFrames: number
  width: number
  height: number
  jpegQuality: number
  timestamps?: number[]
}

async function captureFrames(
  options: FrameCaptureOptions,
  onProgress: (progress: FrameCaptureProgress) => void
): Promise<FrameManifest>
```

Implementation approach:

```tsx
<video
  src={localFileUrl}
  muted
  playsInline
  preload="auto"
/>
```

For each timestamp:

```ts
video.currentTime = timestamp

await waitForEvent(video, 'seeked')

canvas.width = targetWidth
canvas.height = targetHeight

ctx.drawImage(video, 0, 0, targetWidth, targetHeight)

const blob = await canvasToBlob(canvas, 'image/jpeg', quality)

await ipc.sendFrameToBackend({
  sessionId,
  frameId,
  timestamp,
  blob,
})
```

Concurrency should be `1` because seeking is stateful.

Progress UI:

```text
Capturing frames...
34 / 96
```

Cancel button must be available.

---

# 27. UI Placement Inside the 3-Pane Studio

The Visual Analysis Engine should be visible in the existing 3-pane layout.

## Left Sidebar Pipeline

Update pipeline rail:

```text
Source
Visual Scan
Transcript
Cut Plan
Scene Plan
Preview
Export
```

Or:

```text
Source
Transcript
Visual Evidence
Cut Plan
Scene Plan
Preview
Export
```

I recommend:

```text
Source
Transcript
Visual Evidence
Cut Plan
Scene Plan
Preview
Export
```

This makes visual analysis a first-class stage.

---

## Dashboard Tool Cards

Add new cards:

```text
Visual Scan
Asset Enrichment
Shot Map
Object Locator
Text/Face Regions
Style Reference
Manual Visual Bridge
```

Each card should show provider status.

Example:

```text
Visual Scan
Analyze frames from the local video.
Ready

[Scan]
```

Example degraded:

```text
Object Locator
Detect faces, products, and on-screen text.
Manual mode only

[Mark Objects]
```

---

# 28. Visual Evidence View

Add a new center workspace view:

```text
Visual Evidence
```

Layout:

```text
+------------------------------------------------------+
| Visual Evidence Toolbar                              |
+------------------------------------------------------+
| Frame Filmstrip                                      |
+------------------------------------------------------+
| Selected Frame Preview                               |
+------------------------------------------------------+
| Frame Details / Objects / Text / Notes               |
+------------------------------------------------------+
```

Right inspector:

```text
Frame Inspector
```

## Frame Filmstrip

Shows evidence frames:

```text
[00:00.0] [00:05.5] [00:16.2] [00:28.5]
```

Each thumbnail shows:

- timestamp,
- reason badge,
- detected object count,
- text badge,
- face badge.

## Selected Frame Preview

Shows larger frame.

Overlay markers:

```text
object boxes
face boxes
text regions
safe zones
```

Actions:

```text
Mark object
Mark face
Mark text
Send to Manual Visual Bridge
Use as style reference
```

---

# 29. Timeline Additions

The timeline should gain new tracks.

Current recommended tracks:

```text
Transcript
Cut Plan
Overlays
```

New tracks:

```text
Shots
Visual Events
Faces
Text Regions
Objects
```

Default visible:

```text
Transcript
Cut Plan
Overlays
Shots
```

Advanced tracks can be toggled:

```text
Faces
Text Regions
Objects
```

Visual event blocks can include:

```text
scene change
slide appears
face detected
product visible
text on screen
motion spike
```

---

# 30. Canvas Preview Additions

The 9:16 canvas preview should display visual constraints.

Toggle group:

```text
Safe Zones
Detected Faces
Detected Text
Detected Objects
Protected Regions
```

Visual styles:

```text
Face:
rose border
rose/10 fill

Text:
amber border
amber/10 fill

Object:
cyan border
cyan/10 fill

Protected region:
red dashed border
```

This helps the user understand why an overlay warning appears.

---

# 31. Manual Object Marking UX

Because automatic detection may be unavailable, manual marking must be excellent.

## Object Marker Mode

User clicks:

```text
Mark Object
```

Then:

```text
Select frame
Draw rectangle
Choose label
Set start time
Set end time
Save
```

Default duration suggestion:

```text
From current timestamp to next shot boundary
```

or:

```text
From current transcript segment start to segment end
```

Labels:

```text
face
person
hand
product
laptop
screen
whiteboard
text
logo
ui
other
```

Each object can have flags:

```text
Protect from overlay
Use for style reference
Use for enrichment
```

This gives immediate value without any ML dependency.

---

# 32. Asset Enrichment Flow

Recommended flow:

```text
1. User imports video
2. Transcript generated
3. Frame plan generated
4. Evidence frames captured
5. Visual digest requested
6. Provider chosen:
   - automatic VLM if available
   - Manual Visual Bridge if not
7. Digest validated
8. Digest stored
9. Digest shown in dashboard and prompt builder
```

The enrichment should be displayed as a card:

```text
Asset Enrichment

Gist:
A presenter explains a workflow using slides and screen recordings.

Keywords:
presentation, slides, screen recording, tutorial

Topics:
education, software walkthrough

Confidence:
71%

Source:
Manual Visual Bridge
```

Actions:

```text
Edit
Regenerate
Use in Prompt
```

---

# 33. Transcript + Visual Alignment

Visual evidence should be linked to transcript segments.

Add optional field to transcript segments or separate mapping:

```python
class SegmentVisualEvidence(BaseModel):
    segment_id: int
    frame_ids: list[str]
    shot_ids: list[str]
    objects: list[str]
    text_visible: list[str]
    faces_present: bool
    visual_summary: str | None
```

Example:

```json
{
  "segment_id": 3,
  "frame_ids": ["f_00045", "f_00048"],
  "shot_ids": ["shot_004"],
  "objects": ["person", "laptop"],
  "text_visible": ["slide heading"],
  "faces_present": true,
  "visual_summary": "Presenter points at a dashboard while speaking."
}
```

This allows the cut planner to reason about both speech and visuals.

Example prompt line:

```text
Segment 3 has visible slide text and a detected face.
Prefer overlay placement that avoids the face and existing slide text.
```

---

# 34. Updated Cut Plan Prompt

The cut plan prompt should include visual context when available.

Current prompt is transcript-only.

New optional section:

```text
VISUAL CONTEXT
- Video contains talking head and slides.
- Segment 3 has visible slide text.
- Segment 5 contains a product close-up.
- Faces are present in segments 0, 1, and 3.
- Existing on-screen text is present in segments 2 and 4.
```

This makes the cut plan more aware of what is happening visually.

---

# 35. Updated Scene DSL Prompt

The scene DSL prompt should include visual constraints.

Example:

```text
VISUAL CONSTRAINTS
- Avoid placing overlays over detected face boxes.
- Avoid covering existing slide text.
- Prefer hook placement in top text-safe zone.
- Use caption zone for short captions.
- Do not place content in platform UI right zone.
```

If object boxes are available, include normalized boxes:

```json
{
  "protected_regions": [
    {
      "label": "face",
      "start_sec": 16.2,
      "end_sec": 21.0,
      "box": {
        "x": 0.62,
        "y": 0.28,
        "w": 0.18,
        "h": 0.22
      }
    }
  ]
}
```

The validator can then check generated overlays against those regions.

---

# 36. Validation Additions

Add new validators:

```text
validateVisualDigest()
validateFrameManifest()
validateShotMap()
validateDetectedObjects()
validateTextRegions()
validateFaceRegions()
validateStyleProfile()
```

For frontend:

```ts
src/features/overlay-studio/vision/utils/visualParser.ts
```

Functions:

```ts
extractJson()
validateVisualDigest()
validateFrameEvidence()
validateShotMap()
validateDetectedObjects()
allPassed()
passedCount()
generateRepairPrompt()
```

This keeps the same Manual Bridge repair pattern.

---

# 37. Graceful Degradation Rules

The system must remain useful without advanced models.

## Level 0 — No Visual Analysis

Available:

```text
Transcript
Manual cut plan
Manual scene DSL
```

UI message:

```text
Visual analysis unavailable.
Overlay Studio will use transcript-only analysis.
```

---

## Level 1 — Frame Capture Only

Available:

```text
Frame filmstrip
Manual frame notes
Manual object marking
```

UI message:

```text
Frames captured.
Automatic visual understanding is unavailable.
You can manually mark objects and text regions.
```

---

## Level 2 — Heuristic Analysis

Available:

```text
Shot boundaries from frame deltas
Brightness/color/motion estimates
Basic visual complexity
```

UI message:

```text
Heuristic visual analysis active.
Shot detection is approximate.
```

---

## Level 3 — Manual Visual Bridge

Available:

```text
Visual digest via external VLM
Frame evidence via external VLM
Manual object validation
```

UI message:

```text
Manual Visual Bridge ready.
Attach the contact sheets to your preferred vision model and paste the JSON result.
```

---

## Level 4 — Automatic VLM

Available:

```text
Automatic visual digest
Frame captions
Object hints
Text hints
```

UI message:

```text
Automatic visual analysis available.
```

---

## Level 5 — SAM-3 / Advanced Localization

Available:

```text
Prompt-based masks
Precise object boxes
Face/product tracking
```

UI message:

```text
Advanced object localization active.
```

---

# 38. Recommended MVP

For the first implementable version, I recommend this scope:

## MVP Goals

```text
1. Capture evidence frames without ffmpeg.
2. Show frame filmstrip.
3. Generate Manual Visual Bridge prompt.
4. Accept and validate visual digest JSON.
5. Store enrichment artifact.
6. Allow manual object/text/face marking.
7. Use protected regions in overlay warnings.
8. Add basic heuristic shot boundaries.
```

This gives real visual value without requiring:

- ffmpeg,
- Ollama,
- SAM-3,
- paid APIs,
- heavy ML dependencies.

---

# 39. MVP Data Flow

```text
User selects session
  ↓
Frontend reads transcript duration and segment starts
  ↓
Frontend builds FrameSamplePlan
  ↓
Frontend captures frames using hidden video + canvas
  ↓
Frames saved to session artifacts
  ↓
Python creates FrameManifest
  ↓
Heuristic shot detector runs on fingerprint frames
  ↓
Manual Visual Bridge prompt generated
  ↓
User sends contact sheets to external VLM
  ↓
User pastes JSON result
  ↓
Frontend/Python validate result
  ↓
VisualDigest saved
  ↓
UI shows enrichment
  ↓
Cut plan and scene prompts include visual context
```

---

# 40. Suggested Implementation Phases

## Phase 1 — Vision Contracts

Create:

```text
python/clement/vision/contracts.py
```

Models:

```text
FrameSamplePlan
FrameManifest
VisualDigest
FrameEvidence
DetectedObject
FaceRegion
TextRegion
ShotBoundary
ShotMap
StyleProfile
VisualAnalysis
```

---

## Phase 2 — Frontend Frame Capture

Create:

```text
src/features/overlay-studio/vision/services/frameCaptureService.ts
```

Features:

```text
capture frames from local video
show progress
cancel capture
save frames to session artifacts
load frame manifest
```

---

## Phase 3 — Visual Evidence UI

Create:

```text
VisualEvidenceView
FrameFilmstrip
FramePreview
FrameInspector
```

User can:

```text
view frames
select frame
mark objects
mark text
mark face
```

---

## Phase 4 — Manual Visual Bridge

Create:

```text
VisualBridgePanel
```

Features:

```text
generate prompt
create contact sheets
copy prompt
paste JSON
validate
repair
accept
```

---

## Phase 5 — Heuristic Shot Detection

Create:

```text
python/clement/vision/shot_detect.py
```

Features:

```text
frame histograms
brightness deltas
boundary threshold
minimum shot duration
shot map output
```

---

## Phase 6 — Protected Regions + Collision Warnings

Create:

```text
python/clement/vision/collision.py
```

Features:

```text
protected regions from faces/text/objects
overlay overlap detection
warning generation
scene validator integration
```

---

## Phase 7 — Style References

Create:

```text
python/clement/vision/style.py
```

Features:

```text
style profile contract
shot pacing stats
visual style prompt extraction
style preset injection
```

---

# 41. Key Decisions Needed

Before moving to implementation-level specification, I need your approval or preference on these points.

## Decision 1 — Primary Frame Extraction Path

I recommend:

> Use Electron/React frame capture with `<video>` + `<canvas>` as the primary no-ffmpeg path.

Do you approve this as the default?

---

## Decision 2 — Frame Budget

I recommend starting with:

```text
Fingerprint pass:
max 120 frames
low resolution

Evidence pass:
max 24 frames
640x360

Localization pass:
max 12 frames
high resolution
```

This keeps the MVP responsive.

Do you approve these defaults, or do you want higher frame counts?

---

## Decision 3 — Manual Visual Bridge as Primary VLM Path

Because Ollama is not running, I recommend:

> Manual Visual Bridge is the first-class VLM path.

It should generate contact sheets and prompts for external vision models.

Do you approve this?

---

## Decision 4 — Object Localization MVP

I recommend:

```text
MVP:
manual object boxes
manual face boxes
manual text regions

Later:
VLM boxes
SAM-3 masks
```

Do you approve manual-first object localization for MVP?

---

## Decision 5 — Optional Dependencies

We can keep the MVP dependency-light using only:

```text
PIL
standard library
frontend canvas capture
```

But shot detection and face detection improve if we allow:

```text
opencv-python-headless
```

Do you want to allow OpenCV as an optional dependency, or keep the system strictly PIL-only for now?

---

# 42. My Recommended Default Answer

If you want the fastest safe path, I recommend:

```text
Approve Electron frame capture.
Approve Manual Visual Bridge as primary VLM path.
Approve manual object marking for MVP.
Keep MVP dependency-light with PIL only.
Treat OpenCV, Ollama, and SAM-3 as optional later providers.
```

This gives us a working visual analysis pipeline under the current environment constraints.

---

If you approve these defaults, I will move to the next stage and produce the **implementation-level Visual Analysis Engine specification**, including:

- exact Python contracts,
- exact TypeScript types,
- file-by-file implementation plan,
- CLI commands,
- frontend components,
- state flow,
- validation rules,
- UI states,
- and the Manual Visual Bridge JSON schema.