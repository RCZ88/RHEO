# CONTEXT BUNDLE: Vault/Layers Animation Improvement

## Problem
The Download/Proof section has two hairline figures (Vault + Exploded) that are currently:
- Side by side (was), now tabbed (VAULT | LAYERS)
- At 0.9 opacity (was 0.4/0.45)
- Pointer-reactive (parallax)
- Connected to `onRead` for semantic hover

But the user wants MORE:
- Actual vault opening animation (not just parallax)
- Exploding animation that transitions into the 4 layers
- The vault and layers should CONNECT — vault opens → explodes → reveals the 4 layers
- "Currently its only the vault and the one weird visualization that doesnt tell shit and doesnt connect to anything"
- "it should also be interactively good"

## User's Verbatim Request
"also, lek the vault and the layers stuff, i thin kwe can improve that visaulziaiton. also, ike sincei ts using like a github repository for making those things and making thos visualiton possible 9 using a skill) , i would wnat you to paln aout and make so that theres the visauazlition animatino of hte vault opening and like exploding aimation that cna turn int oteh acutal 4 layers. currently its only the vault and hte one wierd visauslition that doesnt tell shit naddoesnt connect ot anyhting. it should also be intereatibly good."

## What the figures depict
- **Vault**: Privacy/local-first. Your data is locked by default. The combination (encryption key) is yours. No server holds it.
- **Exploded (4 layers)**: The local stack — Renderer (React UI) → Main (Electron) → SQLite file (deskflow-data.db) → Disk (local storage). No server.

## Current Implementation

### Download.tsx FigureInstrument component
- Tabbed: VAULT | LAYERS
- Single figure at a time, opacity 0.9
- onRead connected to semantic hover readout
- Keyboard fallback facts below
- Tablist pattern from ActUnderstand (roving tabindex, arrow keys)

### Hairline library (@lucasmarkes/hairline)
- `Vault` and `Exploded` are React components from the library
- API: `make(name, mount)` where mount takes `(el, options)` and returns `{ set, destroy }`
- Props: `intensity`, `theme`, `label`, `onRead`, `play`, `style`
- **No data binding**: figures are purely pointer-driven
- `onRead` fires text descriptions of what's under the pointer
- Pointer-reactive (parallax on hover)
- Themes via CSS variables (`--hairline-plate`, `--hairline-hi`, etc.)
- The library is minified in node_modules — source is not easily accessible

### Key constraint
The hairline library's figures are NOT animated in the traditional sense. They respond to pointer position (parallax). There's no "vault opening" animation built in. To create a vault-opening animation, we'd need to either:
1. Build a custom figure using the hairline kernel (not exported)
2. Build a custom SVG/React component that mimics the hairline style but adds animation
3. Use framer-motion to animate the hairline figure container

## What GLM needs to decide
1. Can the vault-opening animation be done with framer-motion wrapping the hairline figure?
2. Should we build a custom animated vault SVG instead of using the hairline library?
3. How should the transition from vault → exploded work? (vault cracks open → layers separate)
4. What interactive elements are "missing"? (the user says "there are view elements that are missing from the visual interactables")
5. Should the figure be larger? Currently maxWidth 480px.

## Files to Modify
- landing/src/components/rheo/Download.tsx (FigureInstrument component)
- landing/src/components/rheo/Hero.tsx (Dayfield figure)
- Possibly new component for animated vault

## Design System (LAMINAR)
- Monochrome zinc, radii 6/10/16, single easing [0.16,1,0.3,1]
- No spring overshoot, no layout-property animation
- reduced-motion: all animations gated
- Opacity + transform only

## What We Want From GLM
1. A concrete animation spec for vault opening → layer explosion
2. Exact CSS/JS values (durations, easings, transforms)
3. Whether to use framer-motion, custom SVG, or hairline's kernel
4. Interactive elements that should be added (hover states, click targets, etc.)
5. How the animation connects to the semantic readout (onRead)