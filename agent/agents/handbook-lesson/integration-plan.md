// 5. Integration Plan — Terminal Handbook Learning Engine

## Location in App
- **Primary**: `/learn` page — new "Terminal Handbook" track in the learning module
- **Secondary**: `/terminal` workspace — quick-reference sidebar panel
- **Route**: `/learn/handbook` (full lesson view) and `/learn/handbook/:sectionId` (single section)

## Data Sources
| Source | Direction | Purpose |
|--------|-----------|---------|
| `agent/docs/terminal-handbook-data.json` | read | Static handbook data (parsed from HTML) |
| `deskflowAPI.sendCommand({ prompt })` | write | Send lesson generation request to AI |
| `deskflowAPI.getLearnerProfile()` | read | User experience level for personalization |

## IPC Calls Used
| Call | Direction | Purpose |
|------|-----------|---------|
| `learn.lessons.list({ track: 'handbook' })` | read | List available handbook lessons |
| `learn.lessons.get({ sectionId })` | read | Get generated lesson content |
| `learn.lessons.generate({ sectionId, userContext })` | write | Trigger agent to generate lesson |
| `learn.progress.get({ userId, sectionId })` | read | User progress per section |
| `learn.progress.update({ userId, sectionId, status })` | write | Mark section complete/in-progress |

## Trigger
- **Manual**: User clicks "Generate Lesson" button on handbook section card
- **On-demand**: User navigates to `/learn/handbook/:sectionId` — if lesson not yet generated, trigger generation
- **Event**: `learn:track-unlocked` when user unlocks handbook track

## Dependencies
- Learn module (`src/components/learn/LearnPage.tsx`) — must exist
- AI gateway (`deskflowAPI.sendCommand`) — must be functional
- Content engine agent registry — must register `handbook-lesson` agent

## Fallback Behavior
- If AI gateway unavailable: show raw handbook data (command cards from JSON, no narrative)
- If generation fails: show error card with retry button, preserve section data
- If user profile unavailable: default to `experience: "beginner"`, `os: "fedora"`

## File Structure
```
agent/agents/handbook-lesson/
├── prompt.md              # System prompt (created)
├── schema.ts              # TypeScript interfaces (created)
├── factory.ts             # Generate lesson from section data (this file's implementation)
└── references/
    └── handbook-data.json # Parsed handbook (already at agent/docs/terminal-handbook-data.json)

src/components/learn/
├── HandbookTrack.tsx      # Track overview page (18 sections as cards)
├── HandbookLesson.tsx     # Single lesson view (renders generated content)
├── CommandCard.tsx        # Interactive command card component
├── ExerciseCard.tsx       # Practice exercise component
└── QuickRefTable.tsx      # Quick reference table

src/main/
└── handbook-ipc.ts        # IPC handlers for handbook lesson CRUD
```

## Implementation Steps

### Phase A: Data Layer (Day 1)
1. [x] Parse handbook HTML → JSON (`agent/docs/terminal-handbook-data.json`)
2. [ ] Create `agent/agents/handbook-lesson/factory.ts` — pure function that takes section data + user context, returns lesson content
3. [ ] Register agent in `agent/manifest.json`
4. [ ] Add IPC handlers in `src/main/handbook-ipc.ts`

### Phase B: UI Layer (Day 2)
5. [ ] Create `HandbookTrack.tsx` — grid of 18 section cards with progress indicators
6. [ ] Create `HandbookLesson.tsx` — full lesson view with command cards, exercises, quick ref
7. [ ] Create `CommandCard.tsx` — copyable command with param breakdown, depth badge, gotchas
8. [ ] Create `ExerciseCard.tsx` — expandable exercise with solution reveal
9. [ ] Add route to `App.tsx`: `/learn/handbook` and `/learn/handbook/:sectionId`

### Phase C: Integration (Day 2)
10. [ ] Wire "Generate Lesson" button → `deskflowAPI.sendCommand` → agent → render
11. [ ] Add progress tracking — mark section complete when user finishes exercises
12. [ ] Add search/filter on handbook track page
13. [ ] Add "Practice in Terminal" button that opens command in terminal workspace

### Phase D: Polish (Day 3)
14. [ ] Dark theme compliance
15. [ ] Keyboard navigation (arrow keys between sections)
16. [ ] Responsive layout
17. [ ] Loading states for lesson generation
