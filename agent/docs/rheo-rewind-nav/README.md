# RHEO Rewind Navigation — prompt & prototype versions

Four files, two generations. They were scattered across two places
(`agent/docs/` and `~/Downloads/`) and are grouped here so the progression reads
in order. Everything is byte-identical to before the move; only the names changed.

| # | File | What it is |
|---|------|-----------|
| 01 | `01-prototype-v1.html` | The original working prototype. The animation was correct here. |
| 02 | `02-prompt-v1.md` | The build prompt that produced v1. |
| 03 | `03-prototype-v2.html` | The revised prototype — this is the **reference for the idle look**. |
| 04 | `04-fix-prompt-v2.md` | The fix prompt, written from a screenshot of the live build. |

## Read these in this order

**04 is the one that matters.** It is a critique of the real build, not a
design document, and it says explicitly:

> Open the HTML in a browser, take a screenshot of it with the overlay open, and
> match that layout and contrast first. Do not add polish until the idle state
> matches.

So: `03-prototype-v2.html` is the target, `04-fix-prompt-v2.md` is the list of
ways the implementation missed it. Do not open `02`/`01` for visual guidance —
those are superseded, and v1's animation working is what made v1 look wrong in
the first place.

## The six complaints in 04, and where each stands

| # | Complaint | Status |
|---|-----------|--------|
| 1 | Overlay is see-through, Settings shows behind it | fixed — near-opaque |
| 2 | Too dark / low contrast, tiny faint labels | fixed |
| 3 | Reels all the same size, cut off at both edges | fixed — fisheye falloff |
| 4 | Film strip edge-to-edge, not centred, left half empty | fixed — `px-[38vw]` centring |
| 5 | Every frame shows the same orbit icon | fixed — per-page previews |
| 6 | Empty state says "Type to search", should show Recent | fixed |

Two additions landed after that list was written: the film-strip **sprocket
holes** and quiet **edge print** (reel name + `frame NN / total`).

## Still unverified

Every item above is verified in code and shipped in the lazy chunk
(`RewindNav.*.js` + `.css`), but **no display was available, so the overlay has
never been rendered**. To check it:

1. Settings → Keyboard shortcuts → Navigation → "Rewind film" (or "classic")
2. Press `Ctrl K`

Watch the idle state first — that is what 04 is entirely about. Opening
(`Shift+Enter` for instant travel) only matters after the idle look matches.

## Implementation

`src/features/rewind-nav/` — 13 files. Reels and frames are projected from
`src/pages/registry/`, which is the single navigation source; `nav-tree.ts`
holds no independent tree, so a new page shows up in Rewind automatically.