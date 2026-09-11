---
id: motion
name: Motion — Bring the UI Alive
version: 1.0.0
category: design
tags: [motion, animation, micro-interactions, framer-motion, liveliness, ambient, deskflow]
requires: [frontend-design, taste-skill]
---

# Motion Skill — "Bring the UI Alive"

## Philosophy

Frontend Design makes a UI *correct* (tokens, layout, color, type, borders). Taste makes it
*distinctive* (variance, density). This skill makes it *alive*.

A static screen, no matter how well-composed, reads as a picture. Life comes from motion that
*responds* (to the human) and motion that *breathes* (on its own). Done well, motion is invisible —
it tells you what changed, where to look, and that the app is listening. Done badly, it is the #1 tell
of "AI slop": random hovers, bouncing everything, 800ms fades that make the app feel slow.

The rule that separates professional from cringe: **motion must mean something, and there must be a
budget.** This skill gives the agent (1) a budget system — three Liveliness Levels — and (2) a full
taxonomy of motion with recipes, so it never animates from zero.

## How this skill fits the others

- Frontend Design  -> visual tokens (the animation tokens below come from it)
- Taste Skill      -> the MOTION_INTENSITY knob (1-10). This skill *implements* that knob.
- Impeccable       -> reduced-motion + performance hard rules (honored here)
- THIS skill       -> the motion layer: what to animate, how much, with what timing, at which level.

Mapping to the Taste knob:  L1 ~ MOTION_INTENSITY 2-3 | L2 ~ 5-6 | L3 ~ 8-10.

========================================================================
## STEP 0 — ALWAYS pick a Liveliness Level first  (REQUIRED, before animating)
========================================================================

Not every product wants the same amount of motion. A finance dashboard and a product launch page
need opposite budgets. So before writing a single animation, the agent MUST:

1. Infer the product type and propose the level you think fits (with a one-line reason).
2. Ask the user to confirm or change it, using this script:

   "How lively should this feel?
      - L1 — Composed   : calm, professional. Motion only for feedback & orientation.
      - L2 — Responsive : alive but focused. Micro-interactions + smooth transitions + one subtle
                          ambient accent.  <- my suggested default for most apps
      - L3 — Expressive : cinematic. Scroll choreography, ambient backgrounds, springy personality.
    For a <product type> I'd suggest <Lx> because <reason>. Keep it, or go more/less lively?"

3. Lock the chosen level for the whole build and state it: "Building at L2 (Responsive)."
4. If the user already gave a level (or it's obvious from an existing spec), skip the question and
   just confirm in one line.

Never silently default to maximum motion. When unsure, suggest L2.

========================================================================
## The Three Liveliness Levels
========================================================================

LEVEL 1 — COMPOSED  (professional / calm)
   Goal:        Motion you barely notice. Confirms actions, never performs.
   Allowed:     hover/focus/press feedback, fade/slide enter+exit, accordion, tab swap, toast,
                skeleton->content, gentle number count-up.
   Forbidden:   ambient/always-on motion, parallax, particles, spring physics, scroll choreography.
   Timing:      120-200ms, transform + opacity only, ease-out. Reduced-motion = instant.
   Motion knob: 2-3
   Use for:     finance, banking, admin/back-office, healthcare, legal, enterprise data tools,
                anything where trust + speed > delight. (DeskFlow Finance lives here.)

LEVEL 2 — RESPONSIVE  (alive but focused)   <- DEFAULT
   Goal:        The app clearly reacts to you and flows between states. Feels modern and crafted.
   Allowed:     everything in L1, plus list stagger, layout animations (shared element / FLIP),
                AnimatePresence enter/exit, hover lift+glow, drag reordering, ONE restrained
                ambient accent (e.g. a slow gradient drift behind a hero, a breathing status dot),
                gentle spring on playful/secondary elements only.
   Forbidden:   multiple competing ambient layers, heavy particle systems, full-page scroll scenes.
   Timing:      150-300ms, ease cubic-bezier(0.16,1,0.3,1); springs stiffness 300-500 / damping 30+.
   Motion knob: 5-6
   Use for:     SaaS, productivity, dashboards-with-personality, internal tools that want polish.
                (DeskFlow's general app shell lives here.)

LEVEL 3 — EXPRESSIVE  (cinematic / playful)
   Goal:        Motion is part of the brand. The screen performs and rewards exploration.
   Allowed:     everything in L2, plus scroll-reveal & scroll-linked progress, parallax, ambient
                backgrounds (aurora, mesh-gradient drift, floating particles, animated grid),
                magnetic / tilt / cursor-follow, page-route transitions, staggered hero
                choreography, looping hero visuals, rich spring physics.
   Forbidden:   motion that blocks input, anything that fights readability, more than 2-3 ambient
                layers on one screen, infinite motion right next to text the user must read.
   Timing:      200-600ms choreography; springs welcome; ambient loops 8-30s, very low amplitude.
   Motion knob: 8-10
   Use for:     marketing / landing pages, portfolios, product launches, creative & media tools,
                games, data-art visualizations. (DeskFlow's AICityscape city viz lives here.)

========================================================================
## App-type -> suggested level (use this to make the STEP 0 suggestion)
========================================================================

   Finance / banking / trading dashboards ............. L1  (calm; numbers count-up at most)
   Admin / settings / CRUD / data tables ............. L1
   Healthcare / legal / gov / enterprise ............. L1
   General SaaS / productivity / project tools ....... L2  (default)
   AI chat / assistant / agent UIs ................... L2  (typing, streaming, message enter)
   Developer tools / IDE chrome ...................... L2  (snappy, no fluff — see DeskFlow rules)
   Onboarding / empty states / success moments ....... L2-L3 (a moment of delight is allowed)
   Marketing / landing / pricing / hero .............. L3
   Portfolio / agency / brand / launch ............... L3
   Games / creative / media / data-art / 3D viz ...... L3

Rule of thumb: the more *trust and density* a screen needs, the lower the level. The more it needs to
*sell or wow*, the higher. Mixed apps can run the shell at L2 and a single hero/landing at L3.

========================================================================
## The Motion Taxonomy — what actually makes a UI feel alive
========================================================================
Four families. Pull from these instead of inventing. Each entry: what it is | when | min level.

A. REACTIVE motion — triggered by the human (the "it's listening" layer)
   - Hover lift / glow ....... element rises + accent ring/glow on hover. Feedback.          L1
   - Press / tap ............. scale down 0.95-0.97 on press, springs back. Tactility.        L1
   - Focus ring grow ........ animated ring on keyboard focus (accessibility + polish).       L1
   - Toggle / switch ........ thumb slides, track color crossfades.                           L1
   - Ripple / highlight ..... touch-point ripple or row highlight on click.                   L2
   - Magnetic button ........ button eases toward the cursor within a radius.                  L3
   - Tilt / 3D card ......... card rotates slightly toward cursor (perspective).              L3
   - Cursor follower ........ glow/spotlight that trails the pointer.                          L3

B. TRANSITIONAL motion — state & content changes (the "what changed" layer)
   - Enter / exit ........... mount/unmount via AnimatePresence (opacity + small y/scale).     L1
   - Tab / view swap ........ crossfade or slide between panels.                               L1
   - Accordion / disclosure . height auto via layout, not animating raw height.               L1
   - Skeleton -> content .... shimmer placeholder dissolves into real content.                 L1
   - Number count-up ........ values animate to their target (money, stats).                   L1
   - List stagger ........... children enter one-by-one (staggerChildren).                     L2
   - Layout / shared element  element flies between positions/states (FLIP, layout prop).      L2
   - Drag & reorder ......... draggable cards with spring settle.                              L2
   - Page / route transition  whole view animates on navigation.                              L3

C. AMBIENT motion — always-on, no input (the "it breathes" layer; use SPARINGLY)
   - Breathing glow / pulse .. status dot or accent slowly pulses opacity.                     L2
   - Gradient / aurora drift . hero/background gradient slowly shifts position.                L2*
   - Shimmer sweep ........... light sweep across a featured surface or loader.                L2
   - Animated border ........ conic/gradient border slowly rotates on a key card.              L3
   - Floating particles ..... slow drifting dots/orbs behind content.                          L3
   - Mesh-gradient field .... soft moving color field (canvas/shader).                         L3
   - Marquee / ticker ....... continuous horizontal scroll of logos/tags.                      L3
   - Noise / grain .......... subtle animated texture to kill the flat "AI" look.              L3
   (* one restrained ambient accent is allowed at L2; multiple layers are L3 only.)

D. NARRATIVE / SCROLL motion — reveals as you scroll (the "story" layer; L3)
   - Scroll-reveal .......... sections fade/slide in on enter (whileInView, once).             L3
   - Scroll-linked progress . progress bar / element bound to scroll position.                 L3
   - Parallax ............... layers move at different speeds for depth.                        L3
   - Sticky / pinned scenes . a section pins while its content animates.                        L3

========================================================================
## Core principles (research-backed — keeps it professional, not cringe)
========================================================================
1. PURPOSE over decoration. Every animation answers: entrance, state change, feedback, or
   orientation. If it answers none, delete it.
2. SHORTER than you think. UI motion is 120-300ms; most "slow" feels broken. Reserve >400ms for
   deliberate L3 choreography. Perceived speed beats technical duration.
3. ONE motion vocabulary. Same easing + same durations everywhere. Inconsistent curves read amateur.
4. NATURAL easing. Use ease-out (fast start, soft landing) for entrances; springs for things the
   user "throws" (drag). Never linear for UI (except continuous ambient loops & marquees).
5. ANIMATE the cheap properties. transform + opacity only. Never animate width/height/top/left/
   box-shadow/filter geometry — they cause layout jank (worse in Electron).
6. RESPECT the human. Honor prefers-reduced-motion globally; never trap or delay input behind motion;
   never loop motion right next to text someone is reading.
7. STAGGER to show structure, don't carpet-bomb. A 40-60ms stagger implies "these are separate
   items." Animating 200 rows at once is noise.
8. AMBIENT is seasoning. At most one ambient accent at L2; keep amplitude low and periods long
   (8-30s) so it is felt, not watched.
9. FIT the design. Pull motion accent colors from the page's existing --page-accent and token set —
   never introduce a new hue just for an effect. Motion amplifies the design; it doesn't restyle it.

========================================================================
## Implementation tokens (extend Frontend Design's animation tokens)
========================================================================
Durations:  fast 150ms (hover/press/toggle) | normal 250ms (modals, tab/content swap, accordion) |
            slow 400ms (page/L3 choreography) | ambient 8000-30000ms (loops)
Easing:     standard  cubic-bezier(0.16, 1, 0.3, 1)   // ease-out, the default for entrances
            in-out    cubic-bezier(0.4, 0, 0.2, 1)     // symmetric crossfades
            linear    only for ambient loops & marquees
Spring:     L2 "gentle"  -> stiffness 300, damping 30, mass 1
            L3 "lively"  -> stiffness 200, damping 18  (visible overshoot)
            L1           -> no springs (use duration easing)
Stagger:    children 0.04-0.06s; cap total entrance under ~0.4s (slice/virtualize long lists)
Distance:   entrance offsets small: y/x 4-12px, scale 0.96-1.0. Big slides feel cheap.

Library: Motion / framer-motion (motion/react). Import: motion, AnimatePresence, useReducedMotion,
useInView, useScroll, useSpring. Pure-CSS keyframes are fine (and lighter) for ambient loops.

========================================================================
## Recipes (motion/react — note the spaced braces "{ {" to keep JSX valid)
========================================================================

A1 - Hover lift + press  (L1+)
    <motion.button
      whileHover={ { y: -2, scale: 1.02 } }
      whileTap={ { scale: 0.97 } }
      transition={ { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }
      className="... hover:border-[var(--page-accent)]/40"
    />

B1 - Modal / popover enter+exit  (L1+)
    <AnimatePresence>
      {open && (
        <motion.div
          initial={ { opacity: 0, scale: 0.96 } }
          animate={ { opacity: 1, scale: 1 } }
          exit={ { opacity: 0, scale: 0.96 } }
          transition={ { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
        />
      )}
    </AnimatePresence>

B2 - List stagger  (L2)
    const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }
    <motion.ul variants={list} initial="hidden" animate="show">
      {rows.map(r => <motion.li key={r.id} variants={item} />)}
    </motion.ul>

B3 - Shared-element / layout  (L2)
    <motion.div layout transition={ { duration: 0.25, ease: [0.16, 1, 0.3, 1] } } />
    // add layoutId="x" to two elements to make one fly into the other

B4 - Number count-up  (L1)
    const v = useSpring(0, { stiffness: 90, damping: 20 })
    useEffect(() => v.set(target), [target])
    // render <motion.span>{useTransform(v, n => formatMoney(n))}</motion.span>

C1 - Aurora / gradient drift background  (L2 single accent / L3 layered) — pure CSS
    @keyframes aurora { 0%,100%{ background-position:0% 50% } 50%{ background-position:100% 50% } }
    .aurora { background: radial-gradient(125% 125% at 50% 0%, transparent 40%,
              var(--page-accent) 100%); background-size:200% 200%;
              animation: aurora 18s ease-in-out infinite; opacity:.12; }

C2 - Breathing status dot  (L2)
    @keyframes breathe { 0%,100%{ opacity:.45; transform:scale(1) } 50%{ opacity:.9; transform:scale(1.15) } }
    .dot { animation: breathe 2.4s ease-in-out infinite; }

C3 - Shimmer skeleton  (L1 loading)
    @keyframes shimmer { 100% { transform: translateX(100%) } }
    .skeleton::after { content:""; position:absolute; inset:0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent);
      transform: translateX(-100%); animation: shimmer 1.4s infinite; }

C4 - Marquee  (L3)
    @keyframes marquee { to { transform: translateX(-50%) } }
    .marquee { display:flex; gap:2rem; width:max-content; animation: marquee 25s linear infinite; }
    // duplicate the children once so the loop is seamless; pause on hover for usability

D1 - Scroll-reveal  (L3)
    <motion.section
      initial={ { opacity: 0, y: 24 } }
      whileInView={ { opacity: 1, y: 0 } }
      viewport={ { once: true, margin: "-15%" } }
      transition={ { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
    />

A2 - Magnetic button  (L3) — translate toward cursor inside the element, spring back on leave.
A3 - Tilt card  (L3) — map cursor x/y to rotateX/rotateY (±6-8deg) with perspective ~800px.

========================================================================
## Reduced-motion & performance (NON-NEGOTIABLE, all levels)
========================================================================
- Global guard in CSS:
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important;
        transition-duration:.01ms !important; scroll-behavior:auto !important; }
    }
- In components: const reduce = useReducedMotion(); then collapse variants to instant opacity (no
  transform, no count-up, no ambient loops) when reduce === true.
- Performance: animate transform/opacity only; promote heavy ambient layers with will-change sparingly;
  cap concurrent animations; lazy-mount L3 backgrounds (particles/canvas) and pause them when offscreen
  or when the tab/window is hidden; never run infinite canvas loops on battery-critical views.

========================================================================
## Anti-patterns (NEVER — these are the "cringe / AI-slop" tells)
========================================================================
- NEVER animate everything. If the whole page moves, nothing means anything.
- NEVER use long fades (>400ms) for routine UI — it reads as lag.
- NEVER bounce/overshoot serious data, finance, or destructive actions.
- NEVER use spring physics in calm/professional (L1) contexts.
- NEVER run ambient motion behind body text the user must read.
- NEVER animate layout properties (width/height/top/left) or box-shadow geometry.
- NEVER ship motion without a reduced-motion fallback.
- NEVER add a new accent color purely for an effect — reuse the page tokens.
- NEVER stack 3+ ambient layers (gradient + particles + marquee + glow) on one screen.
- NEVER block, delay, or gate user input behind an entrance animation.

========================================================================
## Sourcing real motion (don't hand-roll everything)
========================================================================
See "Anti-Slop Design Sources for Your Coding Agent" for connection setup. Reach for:
- Motion library (motion/react) + the free community Motion MCP -> real, correct animation code.
- Aceternity UI / Magic UI / React Bits -> ready ambient backgrounds, beams, aurora, marquees (L3).
  Always re-skin them to our tokens and demote them to the chosen level before shipping.
Pull a real component, then adapt — never invent a generic effect from zero.

========================================================================
## Agent workflow (every time motion is involved)
========================================================================
1. STEP 0 — infer product type, suggest a level, confirm with the user, lock it.
2. List the screen's motion needs by family (A reactive / B transitional / C ambient / D scroll).
3. Drop anything above the chosen level's budget. (L1: no ambient/scroll. L2: at most 1 ambient.)
4. Map each kept item to the tokens (duration, easing, spring, stagger) and the page accent.
5. Implement with motion/react (or CSS for ambient loops); reuse the recipes above.
6. Add the reduced-motion fallback and verify transform/opacity-only.
7. Self-check against the anti-pattern list before finishing, and state the level you built at.

========================================================================
## When to Activate
========================================================================
Activate this skill when:
- The user wants the UI to feel "alive", "more polished", "less static", "less AI", or "more premium".
- Adding micro-interactions, transitions, page/route animation, or background/ambient effects.
- Building hero/landing/onboarding/empty/success moments, or any data-art / visualization UI.
- Reviewing a build that "looks fine but feels dead", or auditing motion for performance / a11y.
- Any time Frontend Design or Taste is active and the result needs movement to finish it.

Do NOT activate when:
- The user explicitly wants zero motion / a print-static layout.
- A spec already fully defines the motion and just needs literal implementation.
- Working on logic/backend with no UI surface.