Good first pass — I have live leads on Raycast's logo animation (Dribbble), Nothing's dot-matrix boot, TE OP-1 instrument screens, and several line-draw pens. Now let me verify specifics and pull choreography details.


Good first pass — I have live leads on Raycast's logo animation (Dribbble), Nothing's dot-matrix boot, TE OP-1 instrument screens, and several line-draw pens. Now let me verify specifics and pull choreography details.


# R-10 Research Pack — boot/splash reference harvest

Swept all six lanes (21st.dev, CodePen, Codrops, LottieFiles, Behance/Vimeo/Tumblr, product boots). Most of what's published under "preloader/splash" is auto-REJECT slop (looping spinners, glow, glass, gradient fields) — the keepers are below. GIFs/live previews live at each link; three frames embedded where I could capture them.

## (1) Ranked reference table

Scoring: **M** monochrome+single-accent · **H** hairline/precision vocab · **O** one-shot ≤1.6s ends-at-rest · **R** reproducible in HTML/CSS/SVG · **D** distinctiveness. /25.

| # | Reference | What it is | M | H | O | R | D | Σ | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | [Raycast Logo Animation — Lepisov Branding (Dribbble)](https://dribbble.com/shots/14688359-Raycast-Logo-Animation) | The actual desktop-app brand moment: near-black `#030404` field, monochrome mark, one red `#FD1F1F` event, then rest [[29]] | 5 | 4 | 4 | 4 | 5 | **22** | ADOPT |
| 2 | Automotive "dial staging" needle sweep (Audi Virtual Cockpit / Porsche Taycan cluster) — clips: [IG reel hub](https://www.instagram.com/popular/audi-virtual-cockpit-needle-sweep-startup/), function described [here](https://www.audizine.com/threads/tach-speedo-needles-cycle-upon-startup-possible-on-rs4.438511/) [[73]] | Ignition one-shot: needles sweep full-scale and return to rest; tick rings brighten in sequence [[116]] | 4 | 5 | 5 | 4 | 3 | **21** | ADOPT |
| 3 | [Nothing OS boot animation](https://nothing.community/en/d/54505-i-redesigned-the-nothing-boot-animation-the-one-you-see-every-time-your-phone-restarts) (dot-matrix wordmark assembly; see also [Android Authority on the OS 3.0 animation pass](https://www.androidauthority.com/nothing-os-3-leaked-features-3478320/)) [[113]] | Pure-monochrome dot-grid ignites into the wordmark, plays once, ends at rest [[114]] | 5 | 3 | 5 | 4 | 4 | **21** | ADOPT |
| 4 | [CodePen — HUD Animation Test (slcn)](https://codepen.io/slcn/pen/gvaWQO) | Axis-ordered draw: hairline stretches on X, then the frame grows on Y; text via line-mask wipe; 1500ms, one-shot `forwards` | 3 | 4 | 5 | 5 | 3 | **20** | PARK |
| 5 | [Teenage Engineering OP-1 screen language](https://www.tumblr.com/sciencefictioninterfaces/164641327196/teenage-engineerings-op-1-synthesizer-modules-via) + [OP-1 Screen Graphics (Figma rebuild)](https://www.figma.com/community/file/1107218520343060211/op-1-screen-graphics) [[64]] | The vocabulary rosetta: black field, gauge arcs, ticks, mono numerals, one color per screen [[68]] | 3 | 5 | 2 | 4 | 5 | **19** | PARK (vocab, not choreo) |
| 6 | [CodePen — Logo Reveal Animation (mikepro4)](https://codepen.io/mikepro4/pen/GXoXXW) | Mark assembles from 4 masked "blades", then wordmark width-wipes; one-shot (refresh to replay) | 3 | 2 | 5 | 5 | 4 | **19** | PARK |
| 7 | [LottieFiles — Minimalistic Logo Loader](https://lottiefiles.com/free-animation/minimalistic-logo-loader-animation-Tg4IbAqLyz) | Single-stroke path-reveal trace of a mark; 2.1 KB dotLottie — proof the trace is cheap to ship [[59]] | 5 | 4 | 2 | 5 | 3 | **19** | PARK (loops as loader — adopt trace as one-shot only) |
| 8 | [CodePen — SVG Logo Line Animation, self-drawing text (pure CSS)](https://codepen.io/adiadila123/full/wBMEGvr) | Stroke-dash wordmark self-draw, no JS [[1]] | 4 | 3 | 3 | 5 | 3 | **18** | PARK |
| 9 | [Codrops — Creative Loading Effects (archive)](https://tympanus.net/codrops/2013/09/18/creative-loading-effects/) | Historical set of full-surface loading concepts; mine for structure, not style [[90]] | 3 | 3 | 2 | 5 | 3 | **16** | PARK |

Frames for the vocabulary wall:

TE OP-1 screens — gauge arcs, ticks, mono numerals, one accent per screen:
![](https://image.qwenlm.ai/public_source/2b3f50f8-e231-4254-a521-6d857833891f/16cd07943-11bd-4eec-9cbc-4acb3b40e22c6563.png)

Porsche Taycan cluster — dark field, white needles, hairline tick rings, single accent telltale:
![](https://image.qwenlm.ai/public_source/2b3f50f8-e231-4254-a521-6d857833891f/46cd07943-11bd-4eec-9cbc-4acb3b40e22c5416.png)

Nothing glyph/dot-matrix — monochrome dot grid as type and as motion:
![](https://image.qwenlm.ai/public_source/2b3f50f8-e231-4254-a521-6d857833891f/46cd07943-11bd-4eec-9cbc-4acb3b40e22c1329.png)

**Product-boot sweep, honestly:** Raycast is the only shipped desktop boot worth harvesting [[29]]. Linear's splash is a quiet opacity fade with no extractable choreography; Arc's is a gradient field (REJECT on sight); Vercel's dashboard triangle *pulses* — a looping idle, REJECT as-is, though the black/white triangle discipline of the brand is worth a glance ([Geist](https://vercel.com/geist/introduction)). The car cluster and Nothing boot out-score all of them for your brief because they are one-shot instruments, not logos breathing.

## (2) Top-3 deep notes (by-eye from clips/GIFs, ±100 ms; single easing family throughout each)

**① Raycast logo animation — accent discipline.** 0–120 ms: hard black hold (`#030404`), nothing moves — confidence. 120–520 ms: mark reveals through a diagonal mask, white-on-black, transform+opacity only. 520–760 ms: the **single** red event (`#FD1F1F`) crosses the mark once — a pass, not a state; the palette on the shot confirms red exists only as one flash plus two dark-red depth shades [[29]]. 760–1150 ms: wordmark wipes in by width (mask, not fade). Ends at full rest. Imitation law: the accent is a *verb* (one pass), never a *surface*.

**② Cluster needle sweep — the one-shot instrument.** 0–150 ms: black field, tick ring at ~8% white. 150–700 ms: needle rotates 0→full-scale at near-constant velocity (ease-in-out quad); tick marks brighten sequentially *behind the tip* — the sweep is the stagger clock, no separate stagger needed. 700–1100 ms: needle returns to rest position on ease-out with ≤2% micro-settle, no overshoot. 1100–1400 ms: mono numerals + one accent telltale fade to final opacity; rest. ~1.4 s total. Reproduces as one SVG `rotate` on a needle group + opacity ramp on a tick group — trivially within your renderer, and it is exactly Meridian's ruler/now-tick metaphor rotated 90°.

**③ Nothing OS boot — monochrome without apology.** 0–200 ms: black. 200–800 ms: dot-matrix cells ignite in a column-then-row wave (per-dot stagger ≈15–25 ms, opacity only) assembling the wordmark [[113]]. 800–1100 ms: the wave completes, dots settle to baseline grid, wordmark holds at rest; **zero accent color** — the discipline lesson is that "one accent, used once" may legally be *zero* accents in the first beat, which makes your single now-tick ignition land harder. Note the OS 3.0 pass kept dot-matrix motion but pulled the dot font from some surfaces — dot grid as *motion*, type as Inter/Grotesk, is the surviving pattern [[114]].

**Spec appendix — exact harvested numbers (no eye-balling):** HUD test: 1500 ms, `cubic-bezier(0.24,0.86,0.59,0.99)`, phase 1 = X-stretch from 1 px hairline (0–50%), phase 2 = Y-grow (50–100%), text = pseudo-element width full→0 line-mask, `fill-mode: forwards` (the ends-at-rest law in one property). mikepro4: blade masks 1.7 s `cubic-bezier(.35,.9,.05,1)` @ 1.0 s delay, word width-wipe same curve @ 1.3 s — a ready-made two-beat stagger ratio (1.0 : 1.3). Your own motion-lab 03-icon (900 ms, cubic ease-out, tracer dot on path) already matches the Lottie trace ref; the tracer dot is your now-tick ignition candidate — but drop its white `drop-shadow` halo, §7 item 6 eats it.

## (3) The cliché line

The current splash cliché is the AI-app boot: aurora/mesh gradient field + glassmorphic card + skeleton shimmer + a glow-breathing logo that loops forever — atmosphere instead of a statement, and every ingredient is on your exclusion list for exactly that reason.

**Auto-REJECTs sighted during harvest (RESOURCES.md convention, REJECTED list stands):** [CodePen "Animated Preloader" (yami1)](https://codepen.io/yami1/details/YwEQgX) — box-shadow glow + gradients; [CodePen "Circular Loaders – 10"](https://codepen.io/haroon-brokha/pen/vEYJLVj) — pulsing orbs/3D balls; 21st.dev preloader gallery glass cards — glassmorphism chrome; Uppbeat/Vecteezy logo-reveal reels — blue neon halo + smoke particles; Arc splash — gradient field; Vercel dashboard triangle — looping idle; all LottieFiles loaders *as-looped* (trace choreography only, played once).

## Context I need before imitation starts (your open rulings)

1. **Canonical logomark** — wordmark-only or mark+wordmark, and from which file (styleframes I-10 vs TitleBar asset)? The end-frame composition can't be locked without it; shipping wordmark-first per your note is fine.
2. **The one accent** — brand pink `--accent-primary #ec4899` or time-domain amber `#fbbf24`? §2 assigns pink to brand and amber to time surfaces; the boot is a brand moment performing a time metaphor, so this is your call, not mine.
3. **Window geometry** — transparent frameless vs the solid `#09090b` fallback (R-10d): does the hairline sweep run edge-to-edge, or must it live inside an inner safe frame that survives the Linux/xvfb fallback unchanged?
4. **Handoff contract** — must the splash end-frame pixel-match the Meridian sidebar composition (Concept A continuity), or is it a discrete surface with a 150 ms crossfade? Decides whether ticks persist or dissolve at rest.
5. **Warm-start trim order (R-10c)** — when shortening, cut front-to-back (drop the ruler draw, keep ignition+wordmark) or jump straight to the end-frame? I'd rule front-to-back, but it's your splash.

Reply with the concept letter + these five and the executor prompt fires with imitable numbers, not vibes.