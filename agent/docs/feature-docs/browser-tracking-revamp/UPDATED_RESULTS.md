I've produced the complete design specification for the DeskFlow Browser Tracking System Revamp. This is a comprehensive document covering all seven engineering areas (A–G) with exact implementation details, component specs, and migration strategies.

**Download the full specification:** [browser-tracking-revamp-design.md](sandbox:///mnt/agents/output/browser-tracking-revamp-design.md)

---

## Architecture at a Glance

### Core Design Decisions

**Multi-Profile Detection** — Chrome MV3 extensions can't read OS profile directories directly, so the system uses a three-tier fallback:
1. **Chrome Identity API** → stable Google account ID (primary)
2. **`chrome.storage.sync` UUID** → persistent across sessions (fallback)
3. **Browser heuristics** → user-agent brand detection (last resort)

**Multi-Browser Registry** — Replaced the single `browserWithExtension` string with an in-memory `Map<string, BrowserProfile>` keyed by `${browser_name}:${profile_id}`. Each browser instance registers independently via POST `/browser-identify` without overwriting others.

**Backward Compatibility** — All existing logs remain valid. New `profile_id` and `browser_name` columns on the `logs` table are nullable. Queries use `COALESCE(profile_id, 'legacy')` for aggregation.

### Schema Changes Summary

| Migration | Change |
|-----------|--------|
| `001` | Extend `browser_profiles` with `browser_version`, `last_seen_at`, `is_connected`, `color_tag` |
| `002` | Add `profile_id` + `browser_name` to `logs` with indexes |
| `003` | Create `browser_profile_stats` aggregate table for fast per-profile analytics |

### Extension Popup Spec

- **Dimensions:** 360px × 540px max
- **States:** Loading (skeleton), Connected (tracking card), Error (disconnected), Empty (no profile)
- **Components:** Profile selector, real-time duration counter, category badge, tracking toggle, today's stats mini-grid
- **Motion:** 150ms/250ms/400ms duration tokens, `cubic-bezier(0.16, 1, 0.3, 1)` easing, `prefers-reduced-motion` respected

### Key UI Components

- **Profile Settings** — `BrowserProfileSettings.tsx` with `spotlight-card` active glow, color tag picker, inline nickname editing, soft-delete with `AlertDialog`
- **Stopwatch Timer** — Profile badge with browser icon + color avatar, `FadeContent` transitions, category-aware progress bar
- **Analytics** — Profile filter `Select`, tabbed views (Overview / By Profile / Trends), per-profile stat cards

### Implementation Order

1. Database migrations (non-destructive)
2. Backend IPC handlers + HTTP server changes
3. Extension background.js (profile detection + registry)
4. Extension popup (HTML/CSS/JS)
5. Frontend profile settings component
6. Stopwatch profile integration
7. Analytics page profile filtering
8. End-to-end testing

The full document includes complete code for every file, exact CSS tokens, animation keyframes, error handling matrices, and the anti-slop verification checklist.