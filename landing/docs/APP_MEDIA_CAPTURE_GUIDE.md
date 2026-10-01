# APP MEDIA CAPTURE GUIDE — RHEO landing page

**Purpose:** the landing page (`landing/`) currently has ZERO footage of the real app.
Everything in `landing/design/media/` is a recording of the landing page itself. This
file is the complete checklist of what to record and screenshot, and exactly why each
piece is needed.

**Status:** 0 of 16 items captured.

---

## 0. TL;DR

- **16 items total:** 7 still screenshots + 6 video clips + 3 extra stills.
- Put everything in `landing/public/media/`.
- When done, tell the agent the filenames and it will wire them into the page.
- Full app route reference: `agent/SURFACES.md`.

---

## 1. Why the agent could not capture this automatically

Worth knowing, because it tells you why a human is faster here.

Playwright's `page.screenshot()` **waits for the page to become "stable"** (fonts loaded,
no animation frame in flight). RHEO has permanent `requestAnimationFrame` loops:

- the flow-field canvas in the hero
- the cursor-glow follower
- the live-updating stopwatch (`1m 24s` → `1m 25s` → …)
- the 3D calendar / ridgeline visualisations

The page is therefore **never** in a stable state, so the wait never resolves and the
screenshot dies at a 30s timeout. After several timeouts the renderer wedged entirely
and the debug port stopped responding.

**The automated fix, for the record** (if the agent retries): raw CDP
`Page.captureScreenshot` over a direct connection, which skips the stability wait,
plus temporarily pausing the rAF loops before each capture.

### 1.1 Two gotchas that will bite you

1. **The "Were you sleeping?" modal covers the whole Dashboard on launch.**
   It auto-detects inactivity (4h 39m on last run) and appears on top of everything.
   **Dismiss it with the ✕ at the top-right of the modal before you record anything.**
   The dismissal persists, so this is a one-time action.

2. **Let the app settle for ~5 seconds before you start recording.**
   Otherwise you film the boot loader, not the app. The first paint is a startup
   animation; the dashboard takes a moment to populate.

---

## 2. Recording setup (do this once)

| Setting | Value |
|---|---|
| Resolution | **1440 × 900** (desktop capture) |
| Frame rate | 30 fps |
| Format | `.mp4` or `.mov` (H.264) |
| Window | Record the **whole app window**, do not crop to a single card |
| Cursor | Leave visible — it shows interaction |
| Motion | If the app exposes a motion toggle, set it **ON** |
| App state | Launch, dismiss the sleep modal, wait 5s, then record |

Mobile stills: **390 × 844** (one required, see item 16).

---

## 3. THE CHECKLIST

### 3.1 Video clips (6) — these carry the page

Each maps to a landing-page section that is currently a *simulation*. Real footage
replaces the fake. These are the highest-value items.

---

#### ☐ V1 — `app-dashboard-idle`
**Feeds:** Hero (above the fold) — the first thing anyone sees

- Record the **Dashboard**, do nothing, 8–10 seconds.
- Let the stopwatch tick (`1m 24s` → `1m 25s`). The ticking is what proves it's alive.
- Let the activity cards populate.

**Why:** the hero must look alive, not a static mock. If a visitor sees a still image
in the first 2 seconds they leave.

---

#### ☐ V2 — `app-timeline-24h`
**Feeds:** ActRecord — "how it records your day"

- On the Dashboard, the 24h timeline / day-ruler across the top.
- **Slowly scroll down** so the day fills in and the hour labels resolve.
- Focus on the timeline, not the whole page.

**Why:** this section currently *simulates* a timeline. Real footage is the swap.

---

#### ☐ V3 — `app-terminal-real`
**Feeds:** Capabilities → the terminal pane

- Go to **Penguin Console**.
- Run a real command. Good candidates that produce visible output:
  - `ls`
  - `git log --oneline -20`
  - `htop` (or `top`)
  - `ps aux | head -20`
- **Let the output actually stream.** Do not retype a fake result.

**Why:** the landing page claims terminal capability. A CSS-animated fake terminal is
obvious to anyone who uses a terminal. A real PTY with real output is the proof.

---

#### ☐ V4 — `app-agent-working`
**Feeds:** Capabilities → the agent pane

- A real agent session **actually working**.
- Submit a prompt, watch it think/edit files, show it making a change.
- Best done in the Terminal Workspace or via a Coding agent session.

**Why:** claims "agents work in this room." Needs a genuine run, not a mockup.

---

#### ☐ V5 — `app-ai-knows-your-time`
**Feeds:** ActUnderstand — "an AI that knows your time"

- Ask the AI something real about your tracked time. Good prompts:
  - "Where did my afternoon go?"
  - "What did I work on this week?"
  - "When am I most productive?"
- **Let the answer stream**, with your real tracked data behind it.

**Why:** currently a **fake** AI console mock. This is the single most damaging thing
on the site — a marketing claim rendered as a hardcoded animation.

---

#### ☐ V6 — `app-lesson-redraw`
**Feeds:** LearnVignette — lesson redraw

- Open a lesson in **Lyceum**.
- Watch a node actually get redrawn / edited.
- Show the before → edit → after.

**Why:** currently a simulated lesson redraw.

---

### 3.2 Primary stills (7) — these load on page load, and they're cheap

---

#### ☐ S1 — `app-dashboard.png` (1440×900)
The Dashboard, fully settled, no modals. The canonical app image.

#### ☐ S2 — `app-console.png` (1440×900)
Penguin Console mid-command with real output visible.

#### ☐ S3 — `app-learn.png` (1440×900)
Lyceum, a lesson open.

#### ☐ S4 — `app-insights.png` (1440×900)
Insights / reports.

#### ☐ S5 — `app-life.png` (1440×900)
Life page, week view, real schedule.

#### ☐ S6 — `app-ai.png` (1440×900)
AI Assistant with a real answer to a real time question.

#### ☐ S7 — `app-finance.png` (1440×900)
Finance page with real numbers.

---

### 3.3 Secondary stills (3) — the "it's all real" proof

---

#### ☐ S8 — `app-activity.png` (1440×900)
Activity / the raw record. This is the *proof* the timeline isn't fabricated —
it shows the underlying events.

#### ☐ S9 — `app-atlas-modal.png` (1440×900)
**Atlas section, one modal open** showing a real dashboard/calendar/finance view
behind it.

- The landing page's Atlas section advertises a catalogue of 16 instruments.
- Show 2–3 modals if you have time, or just one good one.

#### ☐ S10 — `app-mobile.png` (390×844)
One mobile capture. Proves it isn't a desktop-only app.

---

## 4. Sidebar route map (for clicking around)

From `agent/SURFACES.md`, in sidebar order:

| Sidebar label | What it is |
|---|---|
| Dashboard | `/` — main dashboard, status band, timeline |
| Activity | `/activity` — the raw record |
| IDE Projects | `/ide` |
| AI Assistant | `/ai` |
| Insights | `/reports` |
| Lyceum | `/learn` — lessons |
| Lecture | `/lecture` |
| Content Engine | `/studio` |
| Resume | `/resume` |
| Life | `/life` |
| Finance | `/finance` |
| Guide | `/guide` |
| Settings | `/settings` |
| Penguin Console | `/penguin-console` — the terminal |

---

## 5. Where to put the files

```
landing/public/media/
├── app-dashboard-idle.mp4
├── app-timeline-24h.mp4
├── app-terminal-real.mp4
├── app-agent-working.mp4
├── app-ai-knows-your-time.mp4
├── app-lesson-redraw.mp4
├── app-dashboard.png
├── app-console.png
├── app-learn.png
├── app-insights.png
├── app-life.png
├── app-ai.png
├── app-finance.png
├── app-activity.png
├── app-atlas-modal.png
└── app-mobile.png
```

All 16 files. Then tell the agent the filenames and it will wire them into the hero
and the Act sections, replacing the simulated panels.

---

## 6. Quality bar

A capture is **done** only if all of these hold:

- [ ] Real data, not seed/demo data (check numbers are plausible for you)
- [ ] No error boundary, no "Something went wrong", no blank panes
- [ ] No "SIMULATED RECORD SHOWN" placeholder text on screen
- [ ] The sleep-detection modal is dismissed
- [ ] Text is legible at 100% (no unreadably small fonts)
- [ ] No other app's windows visible in a video
- [ ] Monochrome LAMINAR contract holds (the app is dark, don't add colour)

---

## 7. Progress log

Tick as you go:

- [ ] V1 dashboard idle
- [ ] V2 24h timeline
- [ ] V3 terminal
- [ ] V4 agent working
- [ ] V5 AI knows your time
- [ ] V6 lesson redraw
- [ ] S1 dashboard
- [ ] S2 console
- [ ] S3 learn
- [ ] S4 insights
- [ ] S5 life
- [ ] S6 ai
- [ ] S7 finance
- [ ] S8 activity
- [ ] S9 atlas modal
- [ ] S10 mobile

**0 / 16 complete.**
