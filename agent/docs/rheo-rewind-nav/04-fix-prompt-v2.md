# Fix the Rewind overlay. It looks wrong.

I am attaching a screenshot of your current build and `rheo-rewind-nav.html`. The animation works. The idle look is bad. Open the HTML in a browser, take a screenshot of it with the overlay open, and match that layout and contrast first. Do not add polish until the idle state matches.

## What is wrong (from the screenshot)

1. The overlay is see-through. The Settings page shows behind it. It must be nearly solid.
2. Everything is too dark and low contrast. Reels are dark grey on near black. Labels are tiny and faint.
3. The reels are huge and all the same size. They run across the full window and get cut off at both edges. The sizes should fall off like a fisheye.
4. The film strip runs edge to edge and is not centered. The left half is empty and the frames are pushed to the right.
5. Every frame shows the same orbit icon. Each page needs its own preview.
6. The empty state says "Type to search / Try a page name" in the middle. Remove it. Show the Recent list instead.

If this screenshot was taken while the overlay was fading in, then your open animation starts too low in opacity or never reaches 1. Check that the final state is fully opaque.

## Exact values (use these first, tune later)

**Backdrop**
- `background: rgba(10, 16, 22, 0.97)`. Optional `backdrop-filter: blur(18px)`.
- No app content may be readable behind it.
- All overlay content is at opacity 1. Only non matching items dim.

**Search input**
- Max width 640px, centered, top padding 28px. Font 26 to 28px, weight 600, color `#efe6d2`.
- Bottom border 2px `#3a4b58`, turns amber `#d9962b` on focus.

**Reel rail**
- Max width 720px, centered. Not full window.
- Show 5 reels. Selected is 120px wide. Neighbors 84px. Outer ones 56px.
- Opacity: selected 1, neighbors 0.7, outer 0.4.
- Reel color: metal `#8ea1ad` for the body. Hub cutouts use the backdrop color. Hairline rim only. The reel must look light on the dark backdrop.
- Selected reel gets a 2px amber ring.
- Label under each reel: 14px, color `#c9d3da`. Selected label amber `#d9962b`, weight 600.
- Selected reel spins slowly (6s per turn). Others are still.

**Film strip**
- Max width 760px, centered. Soft fade on both edges (mask gradient 15% each side).
- Frame size 170 x 128. Sprocket holes top and bottom, color `#2a3946`, strip base `#0b1218`.
- Frame preview area `#1f3340`. Frame label 15px, weight 600, color `#efe6d2`.
- Selected frame: `#5a4120` fill with a 2px amber outline.
- The strip must slide so the selected frame (or the middle frame if none) sits exactly at the horizontal center. Use `translateX(wrapWidth / 2 - (frame.offsetLeft + frame.offsetWidth / 2))`.

**Previews**
- One unique small SVG per node id. No shared fallback icon. If a page has no preview yet, show a plain abstract bar pattern in the accent color, and list which pages are missing one.

**Layout**
- Top to bottom: input, 36px gap, reel rail, 40px gap, strip, 20px gap, status line (`Tracking / Coding` plus the Enter hint), then Recent.
- Must fit in the window height with no scrolling at 1440x900 and 1920x1080.

## How to check your work

1. Screenshot your overlay at 1440x900 and 1920x1080.
2. Put it next to a screenshot of the HTML prototype.
3. List every difference in size, color, and position. Fix them.
4. Show me the final screenshots. If you cannot take screenshots, tell me, and I will.

Do not change the animation timing. It already works.
