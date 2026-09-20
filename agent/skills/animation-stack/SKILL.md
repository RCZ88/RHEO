---
name: animation-stack
description: Use when animating anything - motion, transitions, hover effects, scroll-triggered animation, hero section reveals, timelines, staggered lists, SVG morphing. Covers GSAP and Anime.js and when to use which.
---

# Animation Stack

## Before anything else
Same check every time: look for `design.md`, `DESIGN.md`, `.cursor/rules`, etc, and match its
animation timing/easing conventions if it sets any. No file found, match whatever's already
running in the codebase before introducing a new feel.

## Which engine
- **GSAP** = real choreography. Scroll-triggered sequences, multi-step timelines, SVG morphing,
  character-by-character text reveals, drag/physics, anything spanning multiple elements with
  precise sequencing. Use it for hero sections, landing pages, narrative scroll experiences.
- **Anime.js** = small, self-contained animation. A single element's entrance, a hover flourish,
  a simple list stagger. If it's one thing moving once, this is probably enough, don't reach
  for GSAP.
- If a KokonutUI component's built-in Motion animation already covers what's being asked, don't
  add either engine on top of it. One engine per interaction, never two on the same element.

## Setup
```bash
npm install gsap
```
```js
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
```
All GSAP plugins are free now (ScrollTrigger, SplitText, MorphSVG, Draggable, etc), no club
license needed anymore.

```bash
npm install animejs
```
```js
import { animate, stagger, createTimeline } from 'animejs';
```
Note the v4 import style. A lot of examples still online are v3 syntax and will not work as-is.

## MCP / docs
Neither library ships an official MCP server. Point at a docs-lookup MCP (e.g. Context7) for
current API reference instead of trusting an unofficial third-party code generator, both
libraries change their API enough that stale training data produces broken code.

## Feel
- Interactive UI feedback (buttons, toggles, menus): quick eases, power2/power3 out, 150 to
  300ms.
- Hero and landing moments: slower, more expressive eases (expo, back, elastic), 500ms and up.
- Don't put an elastic bounce on a settings toggle.
