# RESULT — Halo Island Widget Curation

## 1. Slot Model

### 1.1 Decision

Use a **3-slot compositing model with 2 logical lanes**:

```yaml
slot_model:
  max_logical_activities_visible: 3
  max_full_primary_activity: 1
  max_micro_activities: 2
  lanes:
    resident:
      purpose: persistent background context
      cardinality: 1
      owns: primary_center_slot
      examples: [stopwatch, focus, now, nextDeadline, aiUsage]
      eviction: never_by_interrupt_priority
    interrupt:
      purpose: transient user/system feedback
      cardinality: 1
      owns: micro_slot_by_default
      can_promote_to_primary: true
      eviction: lane_local_only

  principle: >
    Priority chooses what leads visually; it never deletes the resident activity.
    Resident and interrupt state are retained independently.
```

This explicitly fixes the existing structural problem where `PRIORITY` sorts activities and the router takes one head. The new model must stop treating a single priority queue as the whole visual system.

### 1.2 Compact geometry: hard 232×40

The compact island is **not a card**. It is a tiny status surface. The available width is divided according to concurrency.

```yaml
compact:
  canvas: { width: 232, height: 40 }
  concurrency:
    1:
      composition: "one primary slot"
      primary: { width: 232, height: 40 }
      side_slots: 0
    2:
      composition: "primary + one micro wing"
      primary: { width: 168, height: 40 }
      gap: 4
      micro: { width: 60, height: 32, vertical_alignment: center }
      total: 232
    3:
      composition: "primary + left micro wing + right micro wing"
      primary: { width: 126, height: 40 }
      left_micro: { width: 49, height: 32, vertical_alignment: center }
      gap_1: 4
      right_micro: { width: 49, height: 32, vertical_alignment: center }
      gap_2: 4
      total: 232
```

### 1.3 Compact slot content limits

```yaml
compact_content_budget:
  primary_single:
    may_show:
      - icon
      - short_label
      - primary_value
    max_lines: 1
    no_scroll: true
  primary_two:
    may_show:
      - icon
      - abbreviated_label_or_value
    max_text_chars_target: 12
  primary_three:
    may_show:
      - icon
      - very_short_value
    max_text_chars_target: 7
  micro_wing:
    may_show:
      - icon
      - number_or_short_value
    preferred: "icon + 1-4 character value"
    forbidden:
      - sentences
      - secondary_metadata
      - multi-line_content
      - progress_card
```

A third concurrent activity is therefore **not** three cards. It is one readable primary plus two micro-status pips. If an activity cannot survive the micro slot, it cannot enter a wing and must wait in its lane queue.

### 1.4 Expanded geometry: hard 520×300 canvas

Use one shape that morphs between these exact slot templates:

```yaml
expanded:
  canvas: { width: 520, height: 300 }
  concurrency:
    1:
      primary: { width: 520, height: 300 }
    2:
      primary: { width: 400, height: 300 }
      gap: 8
      secondary_rail: { width: 112, height: 300 }
      total: 520
    3:
      primary: { width: 336, height: 300 }
      gap_1: 8
      left_rail: { width: 88, height: 300 }
      gap_2: 8
      right_rail: { width: 88, height: 300 }
      total: 520
```

The rails are **micro panels**, not miniature dashboards. A rail may contain one active micro activity, a short status stack when explicitly designed for it, or remain empty.

### 1.5 Zone assignment

`OverlayEdge = 'top' | 'left' | 'right'` currently means **screen placement**, not three implemented desktop placements. Only `'top'` is shipped. Do not implement left/right screen-edge placement in this curation change.

Within the implemented top surface:

```yaml
zones:
  center:
    role: resident_primary_or_lead_interrupt
    default_activities:
      - stopwatch
      - focus
      - dictation
      - critical
  left_wing:
    role: micro_activity_slot
  right_wing:
    role: micro_activity_slot
  side_slot_eligibility:
    - now
    - nextDeadline
    - aiUsage
    - hud
  side_slot_ineligible:
    - stopwatch
    - focus
    - dictation
    - critical
```

Left/right side slots are symmetric. Do not semantically bind “left = AI” or “right = deadline”. Assignment is determined by current lane priority and stable slot ordering. The highest-priority micro activity gets the first side slot; the second gets the other.

### 1.6 Expanded compositing rules

```yaml
expanded_compositing:
  one_activity:
    use: full_primary
  two_activities:
    use: primary_plus_secondary_rail
  three_activities:
    use: primary_plus_two_micro_rails

  primary_selection:
    rule: "lead visual activity"
    resident_protected: true

  interrupt_behavior:
    micro_compatible:
      remain_in_rail
    non_micro_compatible:
      become_visual_lead
      resident_moves_to_rail_if_micro_compatible
      resident_is_not_removed

  never:
    - drop_resident_just_because_interrupt_priority_is_higher
    - render_three_full_cards
    - exceed_520px_canvas
```

### 1.7 Resident lane

The resident lane contains at most one **logical visual resident** at a time. It is not a destructive queue. Persistent activities remain represented in the resident set even when another resident wins the temporary compact presentation.

```yaml
resident_set:
  eligible:
    - stopwatch
    - focus
    - now
    - nextDeadline
    - aiUsage
  always_eligible:
    - stopwatch
  conditional:
    focus: "only when a real focus session exists"
    now: "only when populated data exists"
    nextDeadline: "only when populated deadline data exists"
    aiUsage: "only when populated AI usage data exists"
```

`stopwatch` stays the `HERO_KIND`, but that identity is **not** allowed to hijack interruption semantics. It is the persistent fallback and default hero when no louder event is leading.

### 1.8 Interrupt lane

```yaml
interrupt_lane:
  cardinality: 1_visible
  queue_max: 3
  replaceGroup:
    behavior: "replace current queued/logical item in-place"
  minimumDisplayMs:
    purpose: "anti-yank guard for transient rotation/feedback"

  precedence:
    1: critical
    2: directUserFeedback
    3: recording
    4: hud
    5: other_transient
```

Do not add arbitrary new numeric values to the existing `PRIORITY` table solely to make this work. Lane precedence is a separate compositing policy. Existing `PRIORITY` values remain the source for the RHEO-native interruption ranking where they already exist.

### 1.9 Eviction / queue policy

```yaml
resident_lane:
  incoming_transient: never_evicted
  incoming_higher_priority_resident: replaces_visual_leader_only
  persistent_source_disappears: remove_from_resident_set
  pinned: never_auto_evicted

interrupt_lane:
  same_replaceGroup: coalesce_and_replace
  higher_precedence: preempt_if_not_protected
  lower_precedence_while_busy: queue
  queue_full: drop_lowest_priority_noncritical
  expired: drop
  pinned_user_interaction: never_drop
  active_direct_interaction: never_interrupt
```

### 1.10 `minimumDisplayMs`

This field is currently unused and must become the carousel/interrupt dwell guard.

```yaml
minimumDisplayMs:
  resident_carousel_default: 3600.0
  interrupt_default: 1200.0
  critical: 1500.0
  directUserFeedback: 1200.0
  recording: 1000.0
  hud: 900.0
```

These are policy values, not IPC data. They control presentation only.

A new activity must not be allowed to replace a noncritical interrupt before its `minimumDisplayMs` unless it has strictly higher interrupt precedence or the user explicitly dismissed the current activity.

### 1.11 `replaceGroup`

Required groups:

```yaml
replaceGroups:
  now: "now"
  nextDeadline: "nextDeadline"
  aiUsage: "aiUsage"
  hud: "hud"
  critical: "critical"
  dictation: "dictation"
  focus: "focus"
  stopwatch: "stopwatch"
```

A progress update must update the existing logical activity ID, not mint a new activity. Every ID derives from `stableId(kind, discriminator)`.

---

## 2. Activity Verdicts

### 2.1 All 17 kinds

| Kind | Verdict | Reason |
|---|---|---|
| `stopwatch` | **promote** | Existing hero, persistent, glanceable, and already honest about absent data. |
| `dictation` | **promote** | Active speech is highly time-sensitive and fits the speech domain; already rendered. |
| `focus` | **promote** | Core productivity state with an obvious ambient countdown. |
| `afkGap` | **reject** | AFK/gap is retrospective behavioral feedback, risks becoming nagging, and should not compete for scarce top-surface attention. |
| `now` | **promote** | Current-context awareness is useful at a glance and naturally fits a micro wing. |
| `tierBreakdown` | **keep** | Useful detail, but belongs inside the expanded stopwatch/status-band view rather than earning a standalone slot. |
| `nextDeadline` | **promote** | A single upcoming deadline is actionable and naturally compact. |
| `pinnedActivity` | **keep** | This is a pinning mechanism/envelope, not user-facing content deserving its own visual card. |
| `clock` | **keep** | Useful fallback utility, but redundant with the desktop clock and therefore excluded from normal rotation. |
| `liveActivity` | **keep** | Keep as a generic event envelope for future integrations; do not give it a dedicated resident slot. |
| `hud` | **promote** | High-value transient feedback lane; compact status fits the island. Ship only through an existing verified producer/action path. |
| `critical` | **promote** | Critical feedback deserves a guaranteed interrupt slot and can temporarily become the visual lead. |
| `download` | **reject** | Desktop-OS concern; not core RHEO value and especially inappropriate as a generic Linux/Wayland activity. |
| `battery` | **reject** | Desktop-OS concern; redundant with the OS shell and explicitly unsuitable as a core Linux/Wayland activity. |
| `aiUsage` | **promote** | Existing dashboard widget has specified IPC channels and this is high-value ambient information. |
| `clipboard` | **reject** | Privacy-sensitive data should not surface automatically at the top of the desktop. |
| `custom` | **reject** | No verified contract; generic escape hatches produce inconsistent UI and bypass the curation system. |

### 2.2 Slot eligibility summary

```yaml
promoted:
  center_first_class:
    - stopwatch
    - dictation
    - focus
    - critical
  micro_or_center:
    - now
    - nextDeadline
    - aiUsage
    - hud

kept_without_standalone_slot:
  - tierBreakdown
  - pinnedActivity
  - clock
  - liveActivity

rejected:
  - afkGap
  - download
  - battery
  - clipboard
  - custom
```

### 2.3 Promoted: `stopwatch`

```yaml
kind: stopwatch
role: resident_hero
persistent: true
priority_source: stopwatchRunning=500
zone: center
compact_232x40:
  icon: stopwatch
  text: "H:MM:SS"
  rule: "seconds visually de-emphasised; hours/minutes primary"
  zero_literal: "0:00:00"
  unknown_literal: "No app detected"
expanded:
  preferred_width: 460
  max_width: 520
  height: 300
  contents:
    - productive_share_ring_svg
    - 28px_tabular_mono_time
    - tier_chips
    - rounded_tier_swatch
    - current_app_label_when_available
    - primary_timer_action
  source_language: "dashboard StatusBand"
click:
  action: "open dashboard / timer context"
  route: "/"
color:
  domain: time
  token: "--halo-signal"
```

4-state:

```yaml
loading:
  visual: "static blocks matching ring + time + tier layout"
  shimmer: false
empty:
  title: "No app detected"
  value: "0:00:00"
error:
  text: "Stopwatch unavailable"
  button: "Retry"
populated:
  render: "full StatusBand-derived specification"
```

The empty state must never fabricate a current app or productivity percentage.

### 2.4 Promoted: `dictation`

```yaml
kind: dictation
role: speech_interrupt
persistent: false
zone: center_or_interrupt_micro
compact_232x40:
  icon: mic
  text: "Dictating" when active
  alternate: "Listening" only if the verified producer actually exposes that state
expanded:
  preferred_width: 360
  max_width: 460
  height: 220
  contents:
    - mic_status
    - short_live_transcript_if_verified
    - elapsed_time_if_verified
    - stop_button
    - dismiss_button_if_required
click:
  action: "toggle/stop dictation only through existing action plumbing"
  route: "none"
color:
  domain: speech
  token: "--halo-focus"
unknown_literal: "No active dictation"
```

4-state:

```yaml
loading:
  visual: "static mic + text skeleton"
  shimmer: false
empty:
  text: "No active dictation"
error:
  text: "Dictation unavailable"
  button: "Retry"
populated:
  render: "mic state + only verified transcript/timing fields"
```

Do not invent a transcript, elapsed time, confidence value, or speech waveform when the existing producer does not expose it.

### 2.5 Promoted: `focus`

```yaml
kind: focus
role: persistent_resident
zone: center
carousel: conditional
compact_232x40:
  icon: focus_indicator
  text: "Focus 24:12" style
  constraint: "one line; compact value replaces descriptive metadata"
  zero_literal: "0:00"
  unknown_literal: "No focus session"
expanded:
  preferred_width: 360
  max_width: 460
  height: 240
  contents:
    - focus_label
    - remaining_time
    - progress
    - pause_resume
    - end_session
    - optional_session_context_only_if_verified
click:
  action: "open/focus control"
  route: "/"
color:
  domain: time
  token: "--halo-signal"
```

4-state:

```yaml
loading:
  visual: "static timer-shaped skeleton"
  shimmer: false
empty:
  text: "No focus session"
error:
  text: "Focus data unavailable"
  button: "Retry"
populated:
  render: "verified countdown + controls"
```

No motivational copy in the compact surface. The island is not a coach.

### 2.6 Promoted: `now`

```yaml
kind: now
role: resident_or_micro
zone: center_or_left_right_micro
compact_232x40:
  full_primary:
    icon: "verified current-app icon"
    text: "short app name"
  micro:
    icon: "verified current-app icon"
    text: "short label, aggressively truncated"
  unknown_literal: "No active app"
expanded:
  preferred_width: 400
  max_width: 460
  height: 220
  contents:
    - current_app
    - current_session_context_only_if_verified
    - open_activity_button
click:
  action: "open activity/session context"
  route: "/activity"
color:
  domain: system_context
  token: "--color-sky-400"
  justification: "existing token; distinct non-time/non-speech context signal"
```

4-state:

```yaml
loading:
  visual: "icon block + one-line text block"
  shimmer: false
empty:
  text: "No active app"
error:
  text: "Current app unavailable"
  button: "Retry"
populated:
  render: "current application/context from verified producer"
```

Do not display window titles, URLs, private document names, or clipboard-derived content unless an existing privacy-approved producer explicitly exposes them for Halo use.

### 2.7 Promoted: `nextDeadline`

```yaml
kind: nextDeadline
role: resident_or_micro
zone: center_or_left_right_micro
compact_232x40:
  full_primary:
    icon: calendar
    text: "2h 14m" or equivalent verified deadline delta
  micro:
    icon: calendar
    text: "2h"
  zero_literal: "0 deadlines"
  unknown_literal: "No deadline data yet"
expanded:
  preferred_width: 360
  max_width: 460
  height: 220
  contents:
    - "next deadline title only if verified"
    - due_time_or_delta
    - source_context_if_verified
    - open_life_button
click:
  action: "open deadline context"
  route: "/life"
color:
  domain: time
  token: "--halo-signal"
```

4-state:

```yaml
loading:
  visual: "calendar icon + two static blocks"
  shimmer: false
empty:
  text: "No deadline data yet"
error:
  text: "Deadline data unavailable"
  button: "Retry"
populated:
  render: "one next deadline only"
```

If the verified source explicitly reports zero upcoming deadlines, render `0 deadlines`; do not substitute the unknown-data sentence.

### 2.8 Promoted: `aiUsage`

```yaml
kind: aiUsage
role: resident_or_micro
zone: center_or_left_right_micro
source_widget: ai-usage
compact_232x40:
  full_primary:
    icon: "verified provider/model icon"
    text: "provider + concise usage"
  micro:
    icon: "provider icon"
    text: "82%" style only if verified metric exists
expanded:
  preferred_width: 460
  max_width: 520
  height: 260
  contents:
    - top_model
    - tokens_today
    - session_count
    - reset/context only if verified elsewhere
click:
  action: "open AI usage"
  route: "/ai"
color:
  domain: ai_system
  token: "--color-sky-400"
  justification: "existing token reserved here for non-time/non-speech system analytics"
unknown_literal: "No AI sessions yet"
```

4-state:

```yaml
loading:
  visual: "provider row + three static blocks"
  shimmer: false
empty:
  text: "No AI sessions yet"
error:
  text: "AI usage unavailable"
  button: "Retry"
populated:
  render: "only verified top-model/tokens/session values"
```

Real contract exists at the channel level, but the source bundle explicitly marks payload shapes as `FILL FROM DUMP`; this activity is blocked from final shipment until the actual payload is verified.

### 2.9 Promoted: `hud`

```yaml
kind: hud
role: transient_interrupt
zone: micro_by_default
compact_232x40:
  template: "icon + short value"
  examples_without_inventing_data: "volume/brightness only if a verified existing producer already exists"
  zero_rule: "a real numeric zero renders 0"
  unknown_literal: "No active HUD"
expanded:
  preferred_width: 360
  max_width: 460
  height: 160
  contents:
    - signal_icon
    - signal_label
    - current_verified_value
    - action_if_verified
click:
  action: "perform existing producer-backed action or dismiss"
  route: "none"
color:
  domain: system_context
  token: "--color-sky-400"
```

4-state:

```yaml
loading:
  visual: "static icon + one value block"
  shimmer: false
empty:
  text: "No active HUD"
error:
  text: "HUD data unavailable"
  button: "Retry"
populated:
  render: "producer-specific value only"
```

**Ship gate:** the bundle does not identify a verified IPC producer for `hud`. Do not invent one.

### 2.10 Promoted: `critical`

```yaml
kind: critical
role: emergency_interrupt
zone: center
compact_232x40:
  icon: "lucide alert icon"
  text: "short critical message"
  max_text_chars_target: 18
  unknown_literal: "No critical alerts"
expanded:
  preferred_width: 420
  max_width: 520
  height: 180
  contents:
    - critical_title
    - one_sentence_message
    - primary_action_if_verified
    - dismiss
click:
  action: "execute verified primary action or dismiss"
  route: "owning route only if existing route is known; otherwise none"
color:
  domain: system_attention
  token: "--color-sky-400"
  justification: "token-set signal reserved for system/attention domain; no new hue"
```

4-state:

```yaml
loading:
  visual: "static alert icon + two blocks"
  shimmer: false
empty:
  text: "No critical alerts"
error:
  text: "Critical alert data unavailable"
  button: "Retry"
populated:
  render: "verified alert only"
```

Critical must bypass ordinary carousel dwell only when there is a verified critical producer. Never fabricate alerts.

---

## 3. Rotation & Dwell

### 3.1 Resident carousel membership

The idle resident carousel contains only populated, eligible activities:

```yaml
carousel:
  members:
    - stopwatch
    - focus_if_active
    - now_if_populated
    - nextDeadline_if_populated
    - aiUsage_if_populated
  excluded:
    - dictation
    - critical
    - hud
    - tierBreakdown
    - clock
    - liveActivity
    - pinnedActivity
```

`stopwatch` is the fallback hero and remains available even when its data is honestly empty.

### 3.2 Dwell

```yaml
resident_dwell_ms:
  stopwatch: 5200.0
  focus: 4600.0
  now: 3600.0
  nextDeadline: 4200.0
  aiUsage: 4600.0
```

All are presentation values. No island number may be derived from a fake data source.

### 3.3 Rotation algorithm

```text
1. Build eligible resident list from populated/valid activities plus stopwatch.
2. Remove the currently displayed item from the next candidate set when another candidate exists.
3. Wait until current item's `minimumDisplayMs` is satisfied.
4. Wait until its dwell deadline is reached.
5. If no interrupt is active and no pointer interaction is in progress, commit next item.
6. Animate content replacement inside the fixed shell.
7. Preserve stable IDs so shared-layout transitions remain continuous.
8. Reset dwell for the new activity.
```

Never rotate empty activities solely to make the carousel look busy.

### 3.4 Interrupt precedence

```yaml
interrupt_precedence:
  critical: 1
  directUserFeedback: 2
  recording: 3
  hud: 4
  other_transient: 5
```

An interrupt pauses resident rotation. The current resident keeps its identity and can return immediately after the interrupt completes.

### 3.5 Dwell interruption

```yaml
while_interrupt_active:
  resident_timer: paused
  resident_activity: retained

on_interrupt_end:
  if_resident_was_mid_dwell:
    resume_remaining_dwell
  else:
    start_new_dwell
```

Do not reset the carousel to index 0 after every interrupt. That makes low-priority activities starve.

### 3.6 Pointer leave during rotation

The existing hover implementation uses 120ms idle polling and 40ms expanded polling. Rotation must never create a half-finished logical state when `stepHover` transitions to collapse.

```yaml
pointer_leave_mid_rotation:
  1: stop_visual_transition_at_current_frame
  2: cancel_uncommitted_destination
  3: restore_last_committed_activity
  4: begin_collapse
  5: preserve_next_rotation_deadline
  6: resume_rotation_only_after_surface_returns_to_stable_idle_state
```

Do not let the visual animation finish toward an item that the logical state never committed to.

### 3.7 Pointer interaction freezes rotation

```yaml
while_expanded_and_interacting:
  carousel: frozen
  activity_swaps_from_external_updates: allowed_only_if_non_destructive
  interrupt_preemption: blocked_unless_critical
```

A user reading or clicking a panel should not have it rotate underneath them.

### 3.8 Rotation animation under LAMINAR

The existing LAMINAR rules override the earlier generic HALO spring guidance:

```yaml
rotation_motion:
  spring: false
  bounce: false
  preferred: "short ease-based opacity/transform transition"
  hover_scale: false
```

Use the existing project's motion tokens/recipes rather than introducing a new spring system.

---

## 4. Click-Through Contract

| Kind | Compact interaction | Expanded interaction | Action | Route |
|---|---|---|---|---|
| `stopwatch` | hover opens; click toggles/pins according to existing shell behavior | timer controls | open timer/dashboard context | `/` |
| `dictation` | hover opens; click enters/stops only if verified producer supports action | stop/dismiss/verified transcript action | toggle/stop dictation | `none` |
| `focus` | hover opens | pause/resume/end | open/focus control | `/` |
| `now` | hover opens | open current activity context | open activity history/context | `/activity` |
| `nextDeadline` | hover opens | open deadline context | open Life/Notes deadline context | `/life` |
| `aiUsage` | hover opens | open AI usage | open AI page | `/ai` |
| `hud` | passive unless cursor enters actual surface | verified action only | producer-backed action or dismiss | `none` |
| `critical` | compact becomes lead only when truly critical | primary action + dismiss | verified critical action | `none` unless owning route already exists |

### 4.1 Click-through rule

```yaml
collapsed:
  native_click_through: true
  renderer_pointer_events:
    canvas: none
    visible_surface: controlled_by_native_hover_state

expanded:
  native_click_through: false
  renderer_pointer_events: active_only_on_real_surface
```

Do not let a transparent 520×300 canvas become a desktop-wide invisible click blocker.

### 4.2 Pinning UX

`pinnedActivity` is a **mode**, not a standalone visual card.

```yaml
pin:
  entry:
    location: "expanded activity header, top-right"
    icon: "lucide Pin, 14px"
    hover_behavior: "hairline/opacity emphasis only"
  result:
    resident_rotation: paused
    pinned_activity: resident_lane_owner
    interrupt_lane: remains_available
    automatic_eviction: false
  exit:
    methods:
      - click_pin_again
      - explicit_close/unpin_control
      - Escape_if_current_surface_is_interactive
    result: "return activity to normal resident eligibility"
```

Do not add a new standalone `pinnedActivity` dashboard card. Persist the pin through the existing preference/state mechanism. If an existing action channel is missing, report the gap; do **not** add a new IPC handler or edit `main.ts` for this curation task.

Pinning priority:

```yaml
pinned_activity:
  semantic_priority: "resident lock"
  does_not_change_existing_numeric_PRIORITY: true
  blocks_resident_rotation: true
  does_not_block_critical_interrupts: true
  does_not_get_automatically_dismissed: true
```

---

## 5. Honest Empty States

### 5.1 Global 4-state matrix

Every promoted activity MUST support exactly these states:

```yaml
loading:
  style: static_skeleton
  shimmer: false
  requirement: "match final geometry; no fake values"

empty:
  style: explicit_data_state
  requirement: "never silently replace unknown with 0"

error:
  style: message_plus_retry_button
  requirement: "never silently render empty"

populated:
  style: normal_activity_view
  requirement: "all displayed values trace to verified producer data"
```

### 5.2 Exact empty/unknown literals

| Kind | Genuine zero | Unknown / absent | Error text | Retry button |
|---|---|---|---|---|
| `stopwatch` | `0:00:00` | `No app detected` | `Stopwatch unavailable` | `Retry` |
| `dictation` | `0:00` only if verified duration is genuinely zero | `No active dictation` | `Dictation unavailable` | `Retry` |
| `focus` | `0:00` | `No focus session` | `Focus data unavailable` | `Retry` |
| `now` | `0 active apps` only if the producer explicitly reports that count | `No active app` | `Current app unavailable` | `Retry` |
| `nextDeadline` | `0 deadlines` | `No deadline data yet` | `Deadline data unavailable` | `Retry` |
| `aiUsage` | `0 sessions` when producer reports true zero | `No AI sessions yet` | `AI usage unavailable` | `Retry` |
| `hud` | `0` only for a genuinely numeric zero payload | `No active HUD` | `HUD data unavailable` | `Retry` |
| `critical` | `0 critical alerts` only if producer reports true zero | `No critical alerts` | `Critical alert data unavailable` | `Retry` |

### 5.3 Honesty rules

```yaml
honesty:
  forbidden:
    - fake_current_app
    - fake_productivity_percent
    - fake_ai_session_count
    - fake_deadline
    - invented_transcript
    - made_up_provider_usage
    - generic_placeholder_numbers

  allowed:
    - literal_empty_sentence
    - literal_zero_when_source_reports_zero
    - static_skeleton_during_loading
    - explicit_error_state
```

The existing stopwatch lesson is binding: the honest state is `No app detected` + `0:00:00`, not a plausible-looking fixture.

---

## 6. Backend Audit

### 6.1 Source rule

The bundle explicitly says the eight dashboard widget payload shapes are `FILL FROM DUMP`, meaning intended but **not verified**. Do not invent handlers, channels, or payload properties. Any activity with a verified channel at the channel level but unverified payload shape remains a ship gate.

### 6.2 Promoted activity audit

| Activity | IPC channel | Status | Notes |
|---|---|---|---|
| `stopwatch` | **not specified; `stopwatchRelay.ts` is marked UNWIRED** | **Stub** | Existing UI/hero exists, but relay contract is explicitly unwired. Verify the actual producer before changing data rendering. |
| `dictation` | **not specified in bundle** | **Real UI / channel not evidenced** | Current renderer has `DictationIsland` and sole `useSttFloat` ownership, so the surface exists. Exact IPC contract is not supplied. Do not invent it. |
| `focus` | **not listed in §4.1** | **Absent / needs confirmation** | Activity kind and persistence policy exist, but no producer channel is supplied by the bundle. Ship only after tracing an existing producer. |
| `now` | **not listed in §4.1** | **Absent / needs confirmation** | `/activity` exists, but no Halo producer channel is provided. Do not infer a channel from the route. |
| `nextDeadline` | **not listed as an IPC channel in §4.1** | **Absent / needs confirmation** | Bundle says it lives in Life/Notes but gives no verified IPC contract. |
| `aiUsage` | `get-ai-stats` + `get-model-usage` | **Real contract / payload unverified** | Highest-confidence new promotion. Payload shapes must be verified from dump before implementation ships. |
| `hud` | **not listed in §4.1** | **Absent / needs confirmation** | Treat as a presentation slot only until an existing producer is traced. No new IPC handler. |
| `critical` | **not listed in §4.1** | **Absent / needs confirmation** | Critical lane is a product policy; actual producer/action channel must already exist. No new channel may be invented. |

### 6.3 Existing dashboard widget inventory and curation impact

```yaml
widgets:
  ai-usage:
    channels: [get-ai-stats, get-model-usage]
    verdict: promote_via_aiUsage
    payload: "verify from dump"

  console-widget:
    channels: [get-terminal-stats, get-handbook-progress]
    verdict: keep_off_halo
    reason: "useful dashboard context but not a strong ambient top-surface signal"

  finance-widget:
    channels: [get-finance-summary, get-wallets]
    verdict: reject
    reason: "sensitive financial information; wrong glance surface"

  learn-widget:
    channels: [get-learn-stats, get-mastery-levels]
    verdict: keep_off_halo
    reason: "due/streak can be useful, but no existing ActivityKind maps cleanly and adding one is outside scope"

  browser-widget:
    channels: [get-browser-stats, get-website-stats]
    verdict: reject
    reason: "privacy + noisy context; not ambient enough"

  brain-widget:
    channels: [get-brain-stats, get-graph-stats]
    verdict: reject
    reason: "abstract metrics require interpretation; poor compact fit"

  covenant-widget:
    channels: [get-covenant-stats, get-commitments]
    verdict: keep_off_halo
    reason: "could be valuable but no clean existing ActivityKind contract; do not invent mapping"

  health-widget:
    channels: [get-sleep-summary, get-health-stats]
    verdict: reject
    reason: "sensitive/personal data and not an ambient top-surface priority"
```

### 6.4 Ship gate

```yaml
implementation_gate:
  may_implement_now:
    - slot_geometry
    - lane_model
    - rotation_rules
    - empty_state_shells
    - existing_verifed_render_fields

  blocked_until_backend_trace:
    - aiUsage_payload_details
    - focus_payload
    - now_payload
    - nextDeadline_payload
    - hud_producer
    - critical_producer
    - exact_dictation_ipc_contract

  explicitly_forbidden:
    - new_ipc_handlers
    - main.ts_edits
    - fabricated_payload_fields
    - fallback_fake_numbers
```

---

## 7. Design Specification

### 7.1 Global design system constraints

LAMINAR overrides generic HALO styling guidance wherever they conflict.

```yaml
design_laws:
  radius:
    allowed: [8px, 12px, pill]
    forbidden: [16px, 20px, 24px, arbitrary_large_card_radii]

  glass:
    backdrop_blur: forbidden
    glassmorphism_chrome: forbidden

  motion:
    spring: forbidden
    bounce: forbidden
    hover_scale: forbidden
    animated_counters: forbidden
    decorative_gradients: forbidden
    decorative_glow: forbidden

  typography:
    max_font_families_per_expanded_view: 2
    allowed_system: [Inter, JetBrains Mono, Space Grotesk]
    time_numerals: tabular_monospace
    seconds: de_emphasized

  iconography:
    source: lucide
    emoji: forbidden

  reduced_motion:
    required: true
```

### 7.2 Colour/domain map

```yaml
color_domains:
  time:
    token: --halo-signal
    value: --color-amber-400
    activities:
      - stopwatch
      - focus
      - nextDeadline

  speech:
    token: --halo-focus
    value: --color-clay-400
    activities:
      - dictation

  system_context:
    token: --color-sky-400
    value: "#5ab0c9"
    activities:
      - now
      - hud
      - critical
      - aiUsage

  rule:
    one_signal_hue_per_surface: true
    rainbow_activity_cards: false
```

Use the existing neutral surface/hairline/track tokens; do not introduce a new visual palette.

### 7.3 Surface

```css
/* semantic values remain bound to existing project tokens */
.halo-surface {
  background: var(--halo-surface);
  box-shadow: var(--halo-shadow);
  border-radius: 12px;
}
```

Compact top-notch wings remain pill/square according to the existing Halo geometry. Expanded panels use 12px max corner radius under LAMINAR.

### 7.4 Compact shell

```yaml
compact_shell:
  outer: "232×40"
  padding_x: 8
  center_alignment: center
  text_vertical_alignment: center
  icon_box: 20-24px
  primary_text_size: 12-14px
  micro_text_size: 10-12px
  primary_numeric_font: JetBrains_Mono
  controls: none_unless_explicitly_primary
  scrollbar: none
```

Compact is a **status pip + label + value**. It cannot hold a card, chart, metadata stack, or button row.

### 7.5 Expanded shell

```yaml
expanded_shell:
  canvas: 520×300
  outer_padding: 12
  content_gap: 8-12
  main_radius: 12
  card_radius: 8
  control_radius: 8
  no_backdrop_blur: true
```

### 7.6 Expanded stopwatch

```yaml
stopwatch:
  preferred_width: 460
  height: 300
  header_height: 40
  primary_timer: 28px_jetbrains_mono_tabular
  ring: "SVG productive-share ring from StatusBand language"
  tier_chips:
    style: rounded_8px
  swatch:
    style: rounded_8px
  controls:
    primary: 36px
    secondary: 32px
```

Do not recreate the dashboard with every chart. Port only the specified StatusBand language: productive-share ring, 28px mono numeral, tier chips, tier swatch.

### 7.7 Expanded dictation

```yaml
dictation:
  preferred_width: 360
  height: 220
  hierarchy:
    1: microphone_state
    2: verified_transcript_only
    3: verified_elapsed_time_only
    4: stop/dismiss
  speech_color: --halo-focus
```

No waveform unless an existing verified producer provides waveform data. No fake transcript. No decorative audio bars.

### 7.8 Expanded focus

```yaml
focus:
  preferred_width: 360
  height: 240
  hierarchy:
    1: Focus
    2: remaining_time
    3: progress
    4: pause/resume
    5: end
  time_color: --halo-signal
```

No motivational slogans, streak badges, or decorative productivity messaging in the Halo.

### 7.9 Expanded now

```yaml
now:
  preferred_width: 400
  height: 220
  hierarchy:
    1: application_identity
    2: short_context
    3: open_activity
  privacy:
    - no_clipboard
    - no_private_document_text
    - no_URL_by_default
```

### 7.10 Expanded next deadline

```yaml
nextDeadline:
  preferred_width: 360
  height: 220
  hierarchy:
    1: deadline_title_if_verified
    2: due_delta_or_time
    3: source_context_if_verified
    4: open
  rule: "one deadline only"
```

### 7.11 Expanded AI usage

```yaml
aiUsage:
  preferred_width: 460
  height: 260
  hierarchy:
    1: top_model
    2: tokens_today
    3: session_count
  no:
    - invented_reset_time
    - inferred_model_name
    - unverified_quota
```

### 7.12 Expanded HUD

```yaml
hud:
  preferred_width: 360
  height: 160
  hierarchy:
    1: signal_icon
    2: signal_name
    3: verified_current_value
    4: verified_action
  no:
    - giant_dashboard
    - charts
    - decorative_animation
```

### 7.13 Expanded critical

```yaml
critical:
  preferred_width: 420
  height: 180
  hierarchy:
    1: alert_title
    2: one_sentence_message
    3: primary_action_if_verified
    4: dismiss
  behavior:
    center_lead: true
    decorative_motion: false
    bounce: false
```

### 7.14 Side rail rules

```yaml
side_rail:
  width_2_activity: 112
  width_3_activity: 88
  allowed:
    - now
    - nextDeadline
    - aiUsage
    - hud
  forbidden:
    - stopwatch
    - focus
    - dictation
    - critical

  layout:
    icon: 20-24px
    value: 11-12px
    no_long_copy: true
    no_scroll: true
```

### 7.15 Compact content examples

These examples describe layouts, not fake data.

```text
ONE:
[ stop icon ]  1:24:03

TWO:
[ stop ] 1:24:03   [ AI 82% ]

THREE:
[ stop ] 1:24:03   [ AI 82 ]   [ cal 2h ]
```

The strings are illustrative only. Real values must come from producers.

### 7.16 Loading treatment

Loading is a **static skeleton**, not shimmer.

```yaml
skeleton:
  animation: none
  blocks_match_final_layout: true
  brightness: "subtle neutral difference from surface"
  no_fake_values: true
```

### 7.17 Error treatment

```yaml
error:
  text: "<Activity> unavailable"
  action: Retry
  style: data_failure_not_empty_state
  retry_must_call: existing_verified_data_path_only
```

If no verified data path exists, the activity is blocked rather than given a fake retry handler.

### 7.18 Hover/press motion

LAMINAR explicitly bans hover scaling.

```yaml
hover:
  scale: 1.0
  allowed_feedback:
    - hairline_brightening
    - opacity_shift_small

press:
  scale: false
  allowed:
    - very_short_opacity_change
```

### 7.19 Activity transition

```yaml
activity_swap:
  outer_shell: stable
  layout_morph: true
  content: short_opacity/position_transition
  spring: false
  bounce: false
  hover_scale: false
```

The island should look like one persistent object changing state, not separate popups replacing each other.

### 7.20 Reduced motion

```yaml
reduced_motion:
  surface_transition: short_fade
  content_transition: fade/minimal_transform
  spring: false
  bounce: false
  continuous_motion: disabled
```

Honor `IslandState.reducedMotion` and the underlying preference.

### 7.21 Performance guardrails for widget implementation

```yaml
performance:
  native_window:
    resize_during_animation: false
  react:
    frame_clock: false
    state_updates_per_animation_frame: false
  high_frequency:
    use:
      - MotionValue
      - CSS_transform
      - local_requestAnimationFrame_for_canvas_only
  forbidden:
    - BrowserWindow.setSize_per_frame
    - BrowserWindow.setBounds_per_frame
    - React_setState_in_rAF
    - forced_layout_loops
    - per_pointermove_IPC_flood
    - animated_box_shadow
    - animated_backdrop_filter
    - decorative_counter_animation
```

The existing 520×300 budget is specifically motivated by transparent-window click-through safety. Do not restore the earlier generic 760×460 canvas recommendation.

### 7.22 No component-library slop

The current tool environment did not expose `shadcn`, `magicui`, `lucide`, `reactbits`, or `iconify` MCP component servers, so **no MCP-sourced component should be claimed as used by this result**. Follow the bundle's binding anti-slop rules regardless.

When icons are needed, use the project's already-approved Lucide icon dependency if present. Do not introduce `BorderBeam`, `NumberTicker`, particle buttons, hover-scale cards, shimmer, animated counters, decorative gradients, or glass chrome.

---

## 8. Rejections

### 8.1 `afkGap`

```yaml
verdict: reject
stands_for: "AFK/idle gap detection"
reason:
  - retrospective_behavioral_feedback
  - risks_interrupting_more_valuable_context
  - can_be_perceived_as_nagging
  - no ambient_action_value
platform_note:
  idle_detection_must_use: tracking-heartbeat
  not: powerMonitor.getSystemIdleTime
```

The bundle explicitly says Linux `powerMonitor.getSystemIdleTime()` returns 0 and is unusable. Even if a producer exists, the Halo is not the right place for this derived metric.

### 8.2 `tierBreakdown`

```yaml
verdict: keep
stands_for: stopwatch productivity/tier detail
reason: "use as expanded secondary detail inside StopwatchHero/StatusBand; standalone compact slot wastes scarce space"
```

### 8.3 `pinnedActivity`

```yaml
verdict: keep
stands_for: user-pinned resident content
reason: "mechanism, not content; implement as mode on an existing promoted activity"
```

### 8.4 `clock`

```yaml
verdict: keep
stands_for: ambient time display
reason: "desktop shell already owns the clock; only expose as fallback if the resident set has no better populated context, never normal-carousel priority"
```

### 8.5 `liveActivity`

```yaml
verdict: keep
stands_for: future generic activity envelope
reason: "retain type for future integrations, but do not give an unbounded generic event class a permanent slot"
```

### 8.6 `download`

```yaml
verdict: reject
stands_for: download progress/completion
reason:
  - desktop-OS concern
  - duplicate system notification semantics
  - not a core RHEO ambient metric
  - explicitly risky under Linux/Wayland portability assumptions
```

### 8.7 `battery`

```yaml
verdict: reject
stands_for: system battery status
reason:
  - desktop-shell responsibility
  - duplicate OS UI
  - low differentiation for a productivity tracker
  - explicitly a Linux/Wayland desktop-OS concern in the bundle
```

### 8.8 `clipboard`

```yaml
verdict: reject
stands_for: copied clipboard content/status
reason:
  - privacy-sensitive
  - accidental disclosure risk
  - top-of-screen ambient surface is the wrong context
```

### 8.9 `custom`

```yaml
verdict: reject
stands_for: arbitrary extension activity
reason:
  - no verified payload contract
  - bypasses curation
  - invites inconsistent visual design
  - would become a generic escape hatch for things that cannot earn a slot
```

### 8.10 Dashboard/top-level route features kept off the Halo

```yaml
routes:
  /:
    verdict: promote
    reason: hero/stopwatch owner
  /activity:
    verdict: promote_via_now_context
    reason: click target/context, not dashboard replica
  /ide:
    verdict: reject
    reason: full-screen work surface
  /ai:
    verdict: promote_via_aiUsage
    reason: existing high-value usage contract
  /reports:
    verdict: reject
    reason: retrospective analytics; too deep for ambient glance
  /life:
    verdict: promote_via_nextDeadline
    reason: one actionable next item is glanceable
  /finance:
    verdict: reject
    reason: sensitive financial information
  /resume:
    verdict: reject
    reason: editing/document surface
  /settings:
    verdict: reject
    reason: configuration surface; Halo preferences already exist separately
  /studio:
    verdict: reject
    reason: deep modal/content pipeline
  /learn:
    verdict: keep_off_halo
    reason: due/streak may be useful but no existing ActivityKind contract cleanly owns it
  /lecture:
    verdict: reject
    reason: deep consumption surface
  /penguin-console:
    verdict: keep_off_halo
    reason: active sessions are context, not a strong top-surface resident
  /terminal:
    verdict: keep_off_halo
    reason: same rationale as penguin-console; no new ActivityKind
```

### 8.11 Dashboard widgets kept/rejected

```yaml
console-widget:
  decision: keep_off
  reason: "command count/handbook percentage require interpretation; active session count can be micro-only in a future activity if a verified contract exists"
finance-widget:
  decision: reject
  reason: "privacy + sensitive monetary values"
learn-widget:
  decision: keep_off
  reason: "useful but no clean existing ActivityKind; do not add an 18th kind for this task"
browser-widget:
  decision: reject
  reason: "privacy + noisy background activity"
brain-widget:
  decision: reject
  reason: "node/density/retrieval counts are abstract and need dashboard context"
covenant-widget:
  decision: keep_off
  reason: "could compete with nextDeadline but no verified direct mapping in supplied bundle"
health-widget:
  decision: reject
  reason: "sensitive personal metric + poor ambient top-surface fit"
```

### 8.12 Already-rejected components/features

Do not re-propose any of these:

```yaml
already_rejected:
  - magic-card
  - particle-button
  - BorderBeam
  - NumberTicker
  - backdrop-blur-xl_glass_chrome
  - whileHover_scale
  - animated_counters
  - spring_easing
  - decorative_gradients
  - localStorage_dashboard_layout
  - new_IPC_handlers
  - main.ts_edits
```

---

## 9. Risks

| Rank | Risk | Impact | Mitigation |
|---|---|---|---|
| P0 | Treating the single priority router as the entire visual model | Multi-activity goal remains impossible | Implement resident + interrupt lanes and explicit slot assignment. |
| P0 | Exceeding 520×300 or restoring 760×460 | Transparent-window failure can enlarge the click-through region on Linux/Wayland | Keep the hard canvas constants exactly as supplied. |
| P0 | Designing around unverified IPC payloads | Fake values or invented handlers enter production | Backend audit is a ship gate; verify actual dump before implementation. |
| P0 | Editing `main.ts` / adding IPC handlers | Breaks ownership boundary and violates scope | Report gaps only; use existing plumbing. |
| P0 | Allowing resident activity to be evicted by interrupts | Hero/state disappears unpredictably | Two-lane model; interrupts change visual lead, not resident existence. |
| P0 | Compact surface becoming a card | Text clipping, noisy UI, unreadable state | 232×40 composition rules; micro-slot eligibility. |
| P0 | Using spring/bounce despite LAMINAR | Conflicts with settled design law | Ease-based transitions; no spring/bounce. |
| P0 | Fake zero/fixture values | User cannot distinguish real state from placeholder | Exact empty strings + zero/unknown separation. |
| P1 | Carousel starvation | One feature dominates and others never surface | Resume remaining dwell rather than resetting carousel after interrupts. |
| P1 | Rotation during user interaction | User loses context/control | Freeze carousel while expanded and interacting. |
| P1 | Pointer leaves during content transition | Half-committed state / visual mismatch | Cancel uncommitted destination and collapse from last committed state. |
| P1 | Wrong micro-slot assignment | Third activity becomes unreadable | Only allow micro-compatible kinds in side rails. |
| P1 | `replaceGroup` not used | Activity floods and animation thrashes | Stable ID + replaceGroup coalescing. |
| P1 | Pinning implemented as a separate card | Wastes scarce slot and creates impossible semantics | `pinnedActivity` is a mode attached to a promoted activity. |
| P1 | `hud` / `critical` given invented producers | UI implies system data that does not exist | Keep generic presentation shell blocked until producer is traced. |
| P1 | AI usage payload assumptions | Wrong token/model/session values | Verify `get-ai-stats` + `get-model-usage` payload dump. |
| P1 | Privacy leakage from `now` | Private app/window context becomes ambient | Only show verified safe current-app identity; no clipboard/document/URL by default. |
| P1 | Overloading rails with full widgets | 88/112px columns become miniature dashboards | Rails are micro-only. |
| P1 | Wayland assumptions | Position/always-on-top/cursor behavior can fail | Existing X11 launch guard and placement diagnostics remain binding. |
| P1 | AFK implementation uses `getSystemIdleTime()` | Linux produces invalid 0 value | Use `tracking-heartbeat` if AFK ever returns in a different surface. |
| P2 | Font metrics vary cross-platform | Labels wrap differently | Explicit line heights, max chars, two-font limit, test on target OSes. |
| P2 | Hover opens too eagerly | Island becomes distracting | Keep existing 120/40ms polling + FSM semantics. |
| P2 | Hover closes too early | User loses interactive panel | Existing leave/hysteresis behavior remains; do not replace with direct pointerleave. |
| P2 | Decorative component creep | Visual slop and GPU cost | Apply anti-slop checklist to every new UI component. |
| P2 | Excessive side-slot rotation | Surface feels nervous | Rotate only after dwell/minimumDisplayMs; no rotation during direct interaction. |
| P2 | Generic `custom` activity becomes a dumping ground | Curation collapses over time | Reject custom; promote new kinds only as last resort with explicit contract. |

### 9.1 Final ship rule

```yaml
ship:
  feature_selection: approved
  slot_model: approved
  visual_system: approved_under_LAMINAR
  backend_requirements: verification_gates

  do_not_ship_until_verified:
    - exact promoted-activity IPC payloads
    - exact dictation action/state contract
    - actual focus producer
    - actual now producer
    - actual nextDeadline producer
    - actual hud producer
    - actual critical producer

  never:
    - invent_data
    - invent_ipc
    - exceed_canvas
    - edit_main.ts_for_this_task
    - reintroduce_spring_or_bounce
```

### 9.2 One-sentence product decision

> **Ship one calm resident context plus one interrupt lane, with up to two tiny micro-wings; promote only activities that can survive a 232×40 glance, keep detailed metrics inside existing expanded surfaces, and reject everything that is OS-owned, privacy-sensitive, retrospective, or contract-less.**
