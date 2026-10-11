/**
 * probe-landing.mjs — renders the landing page and asserts the contracts that
 * source-reading cannot reach.
 *
 * Per GLM's Round-2 spec. This is NOT a build: it drives the already-running
 * dev server on :3004. Nothing here builds, and nothing touches dist/.
 *
 * Run 1 — reducedMotion: 'no-preference' (forced, then ASSERTED via matchMedia,
 *   because headless Chromium defaults to 'reduce' and would render the wrong
 *   branch while reporting success).
 * Run 2 — reducedMotion: 'reduce'.
 *
 * Geometry is PASTED, not asserted: the CSS is not in front of the reviewer and
 * inventing an expectation for it is how this session produced two wrong claims.
 *
 * Usage: node landing/scripts/probe-landing.mjs [baseUrl]
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:3004";
const results = [];
let failures = 0;

// ALIVENESS CANARY — GLM's rule 1. Every "none found" assert downstream is
// conditional on the page being alive and current. This exact harness PASSED
// "no reveal stuck at opacity 0 — none across 0 sections" and
// "no two headings overlap — 1 headings" while the page was throwing
// "setHydrated is not defined" and had rendered one heading. An absence-of-evidence
// assert on a corpse is a vacuous pass; this turns that class of result into a
// loud failure instead of a green line.
let alive = false;
const setAlive = (ok, why) => { alive = ok; if (!ok) console.log(`  CANARY  page liveness FAILED — ${why}`); };

const check = (name, pass, detail) => {
  // Anything phrased as an absence is only meaningful once the page is proven alive.
  const isAbsence = /none|no |not present|missing/i.test(name);
  const gated = isAbsence && !alive;
  const finalPass = gated ? false : pass;
  results.push({ name, pass: finalPass, detail: gated ? `${detail}  [VOID: page not alive]` : detail });
  if (!finalPass) failures++;
  console.log(`  ${gated ? "FAIL" : finalPass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}${gated ? "  [VOID]" : ""}`);
};
const paste = (name, detail) => {
  results.push({ name, pass: null, detail });
  console.log(`  ----  ${name}\n        ${String(detail).replace(/\n/g, "\n        ")}`);
};

async function run(mode) {
  console.log(`\n${"=".repeat(66)}\nRUN — reducedMotion: '${mode}'\n${"=".repeat(66)}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: mode, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Timestamp taken BEFORE navigation so the clock assert can compare against wall time.
  const navStartedAt = Date.now();

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // 0 — assert the media query actually took. A run that silently rendered the
  // other branch is worse than no run.
  const mq = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  check(`reducedMotion actually '${mode}'`, mq === (mode === "reduce"), `matchMedia=${mq}`);

  // 1 — the only gate that sees hook-placement / render-throw errors
  check("pageerror count === 0", pageErrors.length === 0, pageErrors.join(" | ") || "none");

  // Fire the canary HERE, before any "none found" assert. Liveness = the page
  // rendered its shell, threw nothing, and mounted a plausible amount of content.
  // A page that throws has no elements, so every absence assert downstream would
  // otherwise be reporting a corpse as a clean page.
  const liveness = await page.evaluate(() => {
    const heads = document.querySelectorAll("h1, h2, h3").length;
    const secs = document.querySelectorAll("section[id]").length;
    const rootChildren = document.getElementById("root")?.childElementCount ?? 0;
    const bodyChars = document.body.innerText.trim().length;
    return { heads, secs, rootChildren, bodyChars };
  });
  setAlive(
    pageErrors.length === 0 && liveness.secs >= 5 && liveness.heads >= 5 && liveness.bodyChars > 800,
    `pageerrors=${pageErrors.length} sections=${liveness.secs} headings=${liveness.heads} bodyChars=${liveness.bodyChars}`
  );
  paste(
    "aliveness canary",
    `sections=${liveness.secs} headings=${liveness.heads} rootChildren=${liveness.rootChildren} bodyChars=${liveness.bodyChars} -> ${alive ? "ALIVE" : "DEAD"}`
  );

  // The hero entrance translate audit needs a FRESH load and must run DURING the
  // animation. Sampling the settled DOM — or sampling late in the run — reports 0px
  // whether or not the defect is present, which is how this assert passed with a
  // 12px slide still in the code. Two prior attempts were vacuous for exactly that
  // reason. So: new page, sample every frame from first paint, discard the page.
  const entrancePage = await ctx.newPage();
  await entrancePage.goto(page.url(), { waitUntil: "domcontentloaded" });
  const tySample = await entrancePage.evaluate(async () => {
    let worst = 0;
    let who = "";
    const t0 = performance.now();
    await new Promise((resolve) => {
      const frame = () => {
        const hero = document.getElementById("hero");
        if (hero) {
          // MOVEMENT, not transform — same correction as the section sampler.
          // Static centring (`top:50% + translateY(-50%)`) is layout, not motion.
          const seenH = new Map();
          hero.querySelectorAll("*").forEach((el) => {
            const t = getComputedStyle(el).transform;
            if (!t || t === "none") return;
            const dy = Math.abs(new DOMMatrixReadOnly(t).m42);
            const prev = seenH.get(el);
            if (prev === undefined) seenH.set(el, dy);
            else if (Math.abs(dy - prev) > 0.5 && dy > worst) {
              worst = dy;
              who = `${el.tagName}.${String(el.className || "").slice(0, 24)}`;
            }
          });
        }
        if (performance.now() - t0 < 2500) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    return { worst: Math.round(worst * 10) / 10, who, ms: Math.round(performance.now() - t0) };
  });
  await entrancePage.close();
  const heroMaxTy = tySample.worst;
  const heroMaxTyWho = tySample.who;
  const heroSampleMs = tySample.ms;
  paste("hero entrance translate audit", `sampled ${heroSampleMs}ms from first paint on a fresh load; max |ty| = ${heroMaxTy}px${heroMaxTyWho ? ` on ${heroMaxTyWho}` : ""}`);

  // 2 — video mount budget (§3.5: ≤2)
  const vidsAtRest = await page.locator("video").count();
  check("video mounted at rest ≤ 2", vidsAtRest <= 2, `${vidsAtRest}`);

  // 3 — rail geometry, PASTED not asserted
  const geo = await page.evaluate(() => {
    const rail = document.querySelector(".gallery-rail");
    if (!rail) return { error: "no .gallery-rail" };
    const s1 = rail.firstElementChild;
    const cs = getComputedStyle(rail);
    return {
      slide1Width: +s1.getBoundingClientRect().width.toFixed(1),
      columnGap: cs.columnGap,
      railClientWidth: rail.clientWidth,
      slides: rail.children.length,
      visibleEstimate: +(
        rail.clientWidth /
        (s1.getBoundingClientRect().width + parseFloat(cs.columnGap) || 1)
      ).toFixed(2),
    };
  });
  paste("rail geometry (pasted, not asserted)", JSON.stringify(geo));

  // 4 — position readout, and that it tracks real scrollLeft
  const readoutBefore = (await page.locator(".gallery-progress + div, [aria-live='polite']").first().textContent().catch(() => "")) ?? "";
  const readoutMatch = await page.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((s) => /^\d{2} \/ 17$/.test(s.textContent.trim()));
    return el ? el.textContent.trim() : null;
  });
  paste("position readout at rest", readoutMatch ?? "(not found)");

  const scrolled = await page.evaluate(() => {
    const rail = document.querySelector(".gallery-rail");
    if (!rail) return null;
    const s1 = rail.firstElementChild;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: s1.getBoundingClientRect().width + gap, behavior: "instant" });
    return { scrollLeft: rail.scrollLeft, target: s1.getBoundingClientRect().width + gap };
  });
  await page.waitForTimeout(500);
  const readoutAfter = await page.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((s) => /^\d{2} \/ 17$/.test(s.textContent.trim()));
    return el ? el.textContent.trim() : null;
  });
  check(
    "readout advances 01/17 -> 02/17 after one slide",
    readoutMatch === "01 / 17" && readoutAfter === "02 / 17",
    `${readoutMatch} -> ${readoutAfter}; scrollLeft=${scrolled?.scrollLeft} target=${scrolled?.target}`
  );

  // 5 — REC chips: one per screen carrying recordings
  const chips = await page.locator(".rec-chip").count();
  const expectedChips = await page.evaluate(() => {
    const g = document.querySelector("#gallery");
    return (g?.textContent.match(/IDLE|TERMINAL|REAL WORK|DETAIL|WEEK|SCROLL/g) ?? []).length;
  });
  paste("REC chips in the index", `${chips} chips`);

  // 6 — the auto-reset contract. Never proven before.
  const segCount = await page.locator(".seg-btn").count();
  let resetDetail = "no segmented control on the active screen";
  let resetPass = null;
  if (segCount > 0) {
    await page.locator(".seg-btn").nth(1).click();
    await page.waitForTimeout(400);
    const galleryVids = await page.locator("#gallery video").count();
    const playing = await page.evaluate(() => {
      const v = document.querySelector("#gallery video");
      return v ? { paused: v.paused, src: v.currentSrc?.split("/").pop() } : null;
    });
    // scroll two slides away
    await page.evaluate(() => {
      const rail = document.querySelector(".gallery-rail");
      const s1 = rail.firstElementChild;
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      rail.scrollBy({ left: (s1.getBoundingClientRect().width + gap) * 2, behavior: "instant" });
    });
    await page.waitForTimeout(600);
    const vidsAfterLeave = await page.locator("#gallery video").count();
    resetPass = vidsAfterLeave <= 1;
    resetDetail = `after segment: gallery vids=${galleryVids} paused=${playing?.paused} src=${playing?.src}; after scrolling 2 away: gallery vids=${vidsAfterLeave}`;
    check("segment mounts a playing clip", mode === "reduce" ? playing?.paused === true : playing?.paused === false, `paused=${playing?.paused}`);
    check("clip unmounts on slide change (auto-reset)", resetPass, `gallery vids after leaving=${vidsAfterLeave}`);
  } else {
    paste("segmented control", "not present on the active slide at rest");
  }

  // 7 — ledger, verbatim. Proves the Counter deletion landed.
  const ledger = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".ledger-cell")];
    return cells.map((c) => c.textContent.replace(/\s+/g, " ").trim());
  });
  paste("ledger rows (textContent verbatim)", ledger.length ? ledger.join("\n") : "(no .ledger-cell)");

  // 8 — the ASCII seam
  const ascii = await page.evaluate(() => {
    const surface = document.querySelector(".ascii-surface");
    if (!surface) return { present: false };
    const grid = document.querySelector(".ascii-grid");
    const handle = document.querySelector(".ascii-handle");
    return {
      present: true,
      glyphRows: grid ? grid.textContent.trim().split("\n").length : 0,
      glyphCols: grid ? grid.textContent.trim().split("\n")[0].length : 0,
      hasHandle: !!handle,
      left: handle ? getComputedStyle(handle).left : null,
      readout: [...document.querySelectorAll("span")].map((s) => s.textContent).find((t) => /CELLS ·/.test(t)) ?? null,
    };
  });
  check("ASCII surface present", ascii.present === true, ascii.present ? "yes" : "NO");
  paste("ASCII glyph grid", JSON.stringify(ascii));

  if (ascii.hasHandle) {
    const before = ascii.left;
    await page.focus(".ascii-handle");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector(".ascii-handle")).left);
    check("ArrowRight moves the seam", before !== after, `${before} -> ${after}`);
  }

  // 9 — a reveal that never fired.
  //
  // The first version of this assert was `querySelectorAll("*")` + opacity < 0.05,
  // and it reported 8 offenders that were all CORRECT:
  //   - 5 SectionIndex dot labels: opacity 0 until hover (globals.css, by design)
  //   - 1 CursorGlow: opacity 0 until the pointer enters; a headless probe never
  //     moves the mouse, so it can never fire
  //   - 2 below-fold reveals that had not been scrolled to yet
  // A check with no trigger model reports the design as broken. This version
  // scrolls the whole page FIRST (firing every scroll reveal), then asserts on
  // elements that are on screen and have reveal intent — and it names the
  // pointer-driven ones as a separate, non-failing count so the exclusion stays
  // auditable instead of becoming a blind spot.
  // Visit EVERY section, and while each is on screen audit its own subtree.
  //
  // Two earlier versions of this assert were wrong, both in the same direction:
  //   v1 `querySelectorAll("*")` + opacity<0.05 reported 8 "offenders" that were
  //      all correct — 5 hover-only dot labels, 1 pointer-driven CursorGlow a
  //      headless probe can never trigger, 2 below-fold reveals.
  //   v2 scrolled through and returned to scrollY=0, so only the hero was ever
  //      "in viewport" — and it PASSED against a deliberately broken Ledger.
  // A check with no trigger model reports the design as broken; a check that
  // cannot fail proves nothing. This one audits per section, while on screen.
  const sectionIds = ["hero", "act-record", "gallery", "understand", "download"];
  const opacityAudit = { stuck: [], pointerDriven: 0, audited: [] };
  for (const sid of sectionIds) {
    const found = await page.evaluate(async (sectionId) => {
      const sec = document.getElementById(sectionId);
      if (!sec) return { missing: true };
      sec.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => setTimeout(r, 500)); // let the reveal trigger fire
      const stuck = [];
      let pointerDriven = 0;
      sec.querySelectorAll("*").forEach((el) => {
        const cs = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        if (box.height < 4 || box.width < 4) return;
        if (cs.visibility === "hidden") return;
        if (parseFloat(cs.opacity) >= 0.05) return;
        const style = el.getAttribute("style") || "";
        // pointer/hover-activated: a fixed non-interactive overlay, or an element
        // faded by a :hover rule (no inline reveal state for a script to run).
        if (cs.position === "fixed" && cs.pointerEvents === "none") { pointerDriven++; return; }
        if (!style.includes("opacity")) { pointerDriven++; return; }
        if (!(box.top < innerHeight && box.bottom > 0)) return;
        stuck.push(`${el.tagName}.${String(el.className || "").slice(0, 30)}`);
      });
      return { stuck, pointerDriven };
    }, sid);
    if (found.missing) continue;
    opacityAudit.stuck.push(...found.stuck.map((x) => `#${sid} ${x}`));
    opacityAudit.pointerDriven += found.pointerDriven;
    opacityAudit.audited.push(sid);
  }
  opacityAudit.stuck = opacityAudit.stuck.slice(0, 8);
  check(
    "no reveal stuck at opacity 0 in any section, audited on-screen",
    opacityAudit.stuck.length === 0,
    opacityAudit.stuck.join(" | ") ||
      `none across ${opacityAudit.audited.length} sections (${opacityAudit.pointerDriven} pointer/hover-driven excluded by rule)`
  );


  // 9b — no two headings stacked on top of each other.
  //
  // All 22 structural asserts passed while #act-record rendered TWO 69px
  // .display-h2 elements at y=-4 and y=12, plus 6 further elements overlapping
  // the first. Source presence and computed structure were both "correct"; the
  // section was visibly broken. A screenshot caught what 22 asserts could not,
  // so this assert is the receipt for that lesson.
  const headingOverlap = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("h1, h2, h3")].filter((h) => {
      const b = h.getBoundingClientRect();
      return b.width > 40 && b.height > 12;
    });
    const collisions = [];
    for (let i = 0; i < heads.length; i++) {
      for (let j = i + 1; j < heads.length; j++) {
        const a = heads[i].getBoundingClientRect();
        const b = heads[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 8 && oy > 8) {
          collisions.push(`"${heads[i].textContent.trim().slice(0, 24)}" / "${heads[j].textContent.trim().slice(0, 24)}" (${Math.round(ox)}x${Math.round(oy)}px)`);
        }
      }
    }
    return { total: heads.length, collisions: collisions.slice(0, 5) };
  });
  check(
    "no two headings overlap anywhere on the page",
    headingOverlap.collisions.length === 0,
    headingOverlap.collisions.join(" | ") || `${headingOverlap.total} headings, none overlapping`
  );

  // 9c — media must not sit on top of the copy in #act-record.
  //
  // The animated 300vh layout centres the 438px clip and absolutely positions the
  // heading column; at 1280 they overlapped by 63x31px. The reduced-motion layout
  // separately placed an absolutely-centred clip on top of the phase list. Asserted
  // here in whichever layout is currently rendering.
  const mediaTextClash = await page.evaluate(() => {
    const sec = document.getElementById("act-record");
    const v = sec.querySelector("video");
    if (!v) return { none: true };
    const vb = v.getBoundingClientRect();
    const clashes = [];
    sec.querySelectorAll("p, span, h2").forEach((t) => {
      if ((t.textContent || "").trim().length < 4) return;
      const tb = t.getBoundingClientRect();
      if (tb.height < 6 || tb.width < 6) return;
      const ox = Math.min(vb.right, tb.right) - Math.max(vb.left, tb.left);
      const oy = Math.min(vb.bottom, tb.bottom) - Math.max(vb.top, tb.top);
      if (ox > 12 && oy > 6) {
        clashes.push(`"${t.textContent.trim().slice(0, 24)}" ${Math.round(ox)}x${Math.round(oy)}px`);
      }
    });
    return { none: false, clashes: clashes.slice(0, 5) };
  });
  check(
    "no media-over-text overlap inside #act-record",
    mediaTextClash.none || mediaTextClash.clashes.length === 0,
    mediaTextClash.none ? "no clip in this layout" : mediaTextClash.clashes.join(" | ") || "clear"
  );

  // 9d — TEXT-over-TEXT overlap inside #act-record.
  //
  // The standing overlap assert compares MEDIA against text only, so the 47x5px
  // phase-label/invitation pair fell straight through it: not a tolerance, a SCOPE
  // GAP. This is the generalized text-vs-text check.
  //
  // Honest current state: this is expected to FAIL. It found a SECOND instance of
  // the same root cause inside the 96px right rail — phase labels and the playhead
  // readout are both absolutely positioned at independently computed y positions,
  // so they collide whenever the playhead passes a label. Fixing it needs a design
  // ruling (see round 6): a 96px rail cannot fit a 50px label and a 47px readout in
  // two lanes, so every option changes the rail's width or behaviour.
  const textClash = await page.evaluate(() => {
    const sec = document.getElementById("act-record");
    // LEAVES ONLY. An earlier version matched wrappers too, so one rail container
    // ("0006121824RESTDEEPWORK...") reported as a 443px-tall "text" overlapping the
    // section label. Noise of that kind is how a real pair stays hidden — the same
    // argument as the 8 false offenders in the first opacity assert.
    const els = [...sec.querySelectorAll("*")].filter((t) => {
      if (t.children.length > 0) return false;
      if ((t.textContent || "").trim().length < 3) return false;
      const b = t.getBoundingClientRect();
      return b.height > 6 && b.width > 6;
    });
    const clashes = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        const a = els[i].getBoundingClientRect();
        const b = els[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 10 && oy > 4) {
          clashes.push(
            `"${els[i].textContent.trim().slice(0, 18)}" X "${els[j].textContent.trim().slice(0, 18)}" ${Math.round(ox)}x${Math.round(oy)}`
          );
        }
      }
    }
    return clashes.slice(0, 4);
  });
  check(
    "no text-over-text overlap inside #act-record",
    textClash.length === 0,
    textClash.join(" | ") || "none"
  );

  // 11 — Hero contract (R1/R2/R3). The honest zero IS the check: a clock that
  // reads 00:00 at load cannot be a fabricated number, and "0 bytes sent" is a
  // fact the rest of the page already asserts in the Ledger.
  const heroContract = await page.evaluate(() => {
    const hero = document.getElementById("hero");
    if (!hero) return { missing: true };
    const clock = hero.querySelector('[data-testid="session-clock"]');
    const text = hero.innerText.replace(/\s+/g, " ");
    const links = [...hero.querySelectorAll("a")].map((a) => ({
      href: a.getAttribute("href"),
      solid: getComputedStyle(a).backgroundColor === "rgb(255, 255, 255)",
      label: a.innerText.trim().replace(/\s+/g, " "),
    }));
    return {
      clock: clock ? clock.textContent.trim() : null,
      hasBytes: /0 bytes sent/.test(text),
      links,
      fakeCounter: /1,204,|\b\d{1,3}(,\d{3})+\b\s*s observed/.test(text),
      methodLink: /See the method/.test(text),
    };
  });
  if (!heroContract.missing) {
    // Timing-independent. "Reads 00:00 at load" was the wrong shape: the probe
    // navigates, waits for networkidle, then reads — so a working clock reads
    // 00:06 and the assert failed on correct behaviour. What actually proves the
    // number is real is that it MATCHES wall-clock time since navigation, which
    // a fabricated constant can never do.
    const parseClock = (t) => {
      const p = String(t || "0:0").split(":").map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    };
    const shown = parseClock(heroContract.clock);
    const real = Math.floor((Date.now() - navStartedAt) / 1000);
    // Asymmetric on purpose. The clock starts when its component MOUNTS, which is
    // necessarily AFTER navigation — so it can only ever LAG real time, never lead
    // it. A symmetric +/-2 window false-failed correct code by 4s once the probe
    // began spending 2.5s sampling a second page first. The bound still cannot be
    // faked: a constant has to be within [real-15, real+1] on every load, and
    // 1204032 fails both sides.
    check(
      "hero clock reports REAL elapsed seconds since navigation",
      heroContract.clock !== null && shown <= real + 1 && shown >= real - 15,
      `clock="${heroContract.clock}" (${shown}s) vs real elapsed ${real}s (lag ${real - shown}s)`
    );
    check(
      'hero states "0 bytes sent" (the privacy claim, R1)',
      heroContract.hasBytes && !heroContract.fakeCounter,
      heroContract.hasBytes ? "present" : "ABSENT"
    );
    check(
      "first CTA is #gallery and solid; download is ghost; 'See the method' gone (R2)",
      heroContract.links[0]?.href === "#gallery" &&
        heroContract.links[0]?.solid === true &&
        heroContract.links.some((l) => l.href === "#download" && l.solid === false) &&
        !heroContract.methodLink,
      heroContract.links.map((l) => `${l.href}${l.solid ? "/SOLID" : "/ghost"}`).join("  ")
    );
  }

  // Only meaningful under reduce. In no-preference the 12px entrance is the FEATURE
  // (keyframes translateY(12px) -> none), so asserting zero translate there asserted
  // the entrance was broken — my bug, caught by it failing on correct code.
  check(
    "no hero element is EVER translated on the Y axis under reduced motion (sampled per frame)",
    mode !== "reduce" || heroMaxTy < 0.5,
    heroMaxTy < 0.5 ? `max |ty| = ${heroMaxTy}px over ${heroSampleMs}ms of entrance` : `max |ty| = ${heroMaxTy}px on ${heroMaxTyWho}`
  );

  // 13 — the tail REST POSITION, which is what end-align actually controls.
  //
  // My Round 8 negative test was the right experiment aimed at the wrong assert: it
  // reverted end-align and then checked the READOUT, which sync owns, so it could
  // not discriminate. GLM §1: an assert on a shared outcome cannot attribute cause.
  // The fix ships in two cooperating parts — end-align (mechanism) and the
  // padding-aware sync (compensation) — so each needs its own observable.
  //
  // Input is NEUTRAL on purpose: a raw `scrollTo(maxScroll)`, NOT goTo's computed
  // target, or the test inherits the compensating logic and the attribution is void.
  // Expectation is computed from the live padding at each width, never hardcoded —
  // padding-right is clamp(20px,4vw,64px), so 51.2 / 57.6 / 64 at the three widths.
  // Three widths need three viewports, so each gets its OWN context — resizing the
  // shared page mid-run would invalidate every assert measured before it.
  const restRows = [];
  for (const w of [1280, 1440, 2048]) {
    const restCtx = await browser.newContext({
      reducedMotion: "no-preference",
      viewport: { width: w, height: 900 },
    });
    const restPage = await restCtx.newPage();
    await restPage.goto(page.url(), { waitUntil: "networkidle" });
    await restPage.locator("#gallery").scrollIntoViewIfNeeded();
    await restPage.waitForTimeout(600);
    // eslint-disable-next-line no-await-in-loop
    const row = await restPage.evaluate(async () => {
      const rail = document.querySelector(".gallery-rail");
      const cs = getComputedStyle(rail);
      const padEnd = parseFloat(cs.paddingRight) || 0;
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      // NEUTRAL input: raw maxScroll, NOT goTo's computed target.
      rail.scrollTo({ left: maxScroll, behavior: "instant" });
      let settled = rail.scrollLeft;
      let stable = 0;
      for (let i = 0; i < 40 && stable < 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
        if (rail.scrollLeft === settled) stable++;
        else { settled = rail.scrollLeft; stable = 0; }
      }
      return { padEnd, maxScroll, settled, expected: Math.max(0, maxScroll - padEnd) };
    });
    restRows.push({ width: w, ...row });
    await restCtx.close();
  }
  const restBad = restRows.filter((r) => Math.abs(r.settled - r.expected) > 1);
  check(
    "tail settles at maxScroll - paddingRight at every width (end-align's own observable)",
    restBad.length === 0,
    restRows
      .map((r) => `${r.width}: ${r.settled}==${r.expected.toFixed(1)} pad=${r.padEnd}`)
      .join("  ")
  );

  // 14 — the motion matrix: four rows, three observers each.
  //
  // GLM §2 found the precedence hole: the media query disabled .hero-enter
  // unconditionally, with no html[data-motion="on"] rule to override it. So a user
  // who set MOTION ON while their OS said reduce got framer animating (hook honours
  // the choice) and a hero entrance that never ran (media query wins).
  //
  // | system reduce | stored mode | hook   | CSS must do        |
  // | no            | auto        | animate| keyframes run      |
  // | yes           | auto        | no     | media -> none      |
  // | yes           | on          | animate| data-motion="on"  |
  // | no            | off         | no     | stamp -> none      |
  //
  // Observers: the CONTROL's output (html[data-motion]), one framer-path CONSUMER
  // (MotionChip colour) and one CSS-path CONSUMER (.hero-enter animation-name).
  // Each row gets its own context AND clears rheo-motion, because a persisted "off"
  // makes row 1 read row 4's state — the same order-dependence the clock had.
  const MATRIX = [
    { reduce: false, mode: null, wantAnimate: "hero-enter", label: "auto + no OS reduce" },
    { reduce: true, mode: null, wantAnimate: "none", label: "auto + OS reduce" },
    { reduce: true, mode: "on", wantAnimate: "hero-enter", label: "EXPLICIT on + OS reduce" },
    { reduce: false, mode: "off", wantAnimate: "none", label: "EXPLICIT off + no OS reduce" },
  ];
  const matrixRows = [];
  for (const row of MATRIX) {
    // eslint-disable-next-line no-await-in-loop
    const mCtx = await browser.newContext({
      reducedMotion: row.reduce ? "reduce" : "no-preference",
      viewport: { width: 1440, height: 900 },
    });
    const mPage = await mCtx.newPage();
    // eslint-disable-next-line no-await-in-loop
    await mPage.addInitScript(
      ([mode]) => {
        try {
          if (mode) localStorage.setItem("rheo-motion", mode);
          else localStorage.removeItem("rheo-motion");
        } catch {}
      },
      [row.mode]
    );
    // eslint-disable-next-line no-await-in-loop
    await mPage.goto(page.url(), { waitUntil: "networkidle" });
    // eslint-disable-next-line no-await-in-loop
    await mPage.waitForTimeout(900);
    // eslint-disable-next-line no-await-in-loop
    const observed = await mPage.evaluate(() => {
      const k = document.querySelector(".hero-enter");
      const chip = document.querySelector("button.mono.hidden, [class*='chip']");
      return {
        stamp: document.documentElement.getAttribute("data-motion"),
        animationName: k ? getComputedStyle(k).animationName : "(no .hero-enter)",
        chipColor: chip ? getComputedStyle(chip).color : "(no chip)",
      };
    });
    matrixRows.push({ ...row, ...observed });
    await mCtx.close();
  }
  const matrixBad = matrixRows.filter((r) => r.animationName !== r.wantAnimate);
  check(
    "motion matrix: 4/4 rows route the CSS entrance correctly",
    matrixBad.length === 0,
    matrixRows
      .map(
        (r) =>
          `${r.label}: anim=${r.animationName}${r.stamp === null ? " (no stamp)" : ` stamp=${r.stamp}`} chip=${r.chipColor}`
      )
      .join(" | ")
  );
  // The delete-on-auto behaviour is load-bearing and gets its own check.
  const stampFor = (m) => (m === "on" || m === "off" ? m : null);
  const stampBad = matrixRows.filter((r) => r.stamp !== stampFor(r.mode));
  check(
    "data-motion stamp is explicit-only and DELETED for auto",
    stampBad.length === 0,
    matrixRows.map((r) => `${r.label} -> ${stampFor(r.mode) ?? "ABSENT"} (got ${r.stamp ?? "ABSENT"})`).join(" | ")
  );

  // 15 — five-section sampler, TWO CONDITIONS WITH THE CORRECT PAIRING.
  //
  // GLM §1: the reflex pairing (store-off + OS reduce) is VACUOUS for the hook
  // class — right hook and wrong hook agree there. A wrong-hook component (raw
  // matchMedia instead of the store) is INCORRECTENTLY CORRECT whenever the store
  // is "auto", which is every reduce run in this session's history. That is why
  // DecryptedText shipped with the raw hook and passed every board run.
  //
  //   (auto, reduce)        -> the reduce CONTRACT, per section
  //   (off,  no-preference) -> the DISCRIMINATOR: wrong hook animates here and
  //                            nowhere else; a reveal suppressed only by the media
  //                            query rather than the stamp animates here too.
  //
  // The store is set by ACTIVATING THE PALETTE ROW — the mechanism itself, which
  // makes this run the store's first direct test.
  const SECTION_IDS = ["hero", "act-record", "gallery", "understand", "download"];
  const samplerResults = {};
  for (const cond of [
    { key: "contract(auto,reduce)", reduce: true, viaStore: false },
    { key: "discriminator(off,no-preference)", reduce: false, viaStore: true },
  ]) {
    const sCtx = await browser.newContext({
      reducedMotion: cond.reduce ? "reduce" : "no-preference",
      viewport: { width: 1440, height: 900 },
    });
    const sPage = await sCtx.newPage();
    // eslint-disable-next-line no-await-in-loop
    await sPage.goto(page.url(), { waitUntil: "networkidle" });
    // eslint-disable-next-line no-await-in-loop
    await sPage.waitForTimeout(1200);

    let stampObserved = "n/a";
    if (cond.viaStore) {
      // eslint-disable-next-line no-await-in-loop
      const toggled = await sPage.evaluate(async () => {
        const before = document.documentElement.getAttribute("data-motion");
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
        await new Promise((r) => setTimeout(r, 400));
        const rows = [...document.querySelectorAll(".cmdk-row")];
        const motionRow = rows.find((r) => /^Motion/.test(r.textContent || ""));
        if (!motionRow) {
          return { ok: false, before, reason: "no Motion row in palette", rows: rows.length };
        }
        const label = motionRow.textContent.trim();
        motionRow.click();
        await new Promise((r) => setTimeout(r, 400));
        const after = document.documentElement.getAttribute("data-motion");
        const k = document.querySelector(".hero-enter");
        return {
          ok: true, before, after, label,
          animAfter: k ? getComputedStyle(k).animationName : "(none)",
        };
      });
      stampObserved = toggled.ok
        ? `palette row "${toggled.label}" -> data-motion ${toggled.before} -> ${toggled.after}, hero anim=${toggled.animAfter}`
        : `FAILED: ${toggled.reason} (rows seen: ${toggled.rows})`;
    }

    // eslint-disable-next-line no-await-in-loop
    const perSection = await sPage.evaluate(async (ids) => {
      const out = [];
      for (const id of ids) {
        const sec = document.getElementById(id);
        if (!sec) { out.push({ id, missing: true }); continue; }
        sec.scrollIntoView({ behavior: "instant", block: "start" });
        let worst = 0; let worstWho = ""; let hidden = 0; let subjects = 0;
        const seen = new Map();   // element -> {first, last}
        const moving = new Set(); // elements whose ty actually changed
        const t0 = performance.now();
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          const frame = () => {
            sec.querySelectorAll("*").forEach((el) => {
              const cs = getComputedStyle(el);
              if (cs.display === "none" || cs.visibility === "hidden") return;
              subjects++;
              // MOVEMENT, not transform. An absolute `translateY` reading counted
              // STATIC CENTRING as motion: `top:50% + translateY(-50%)` is how you
              // centre an element, and it is not an animation. That produced two
              // phantom defects — a 15px playhead readout (50% of a 30px box) and a
              // 310px decorative glow (50% of a 620px one). Both frames were FLAT
              // across 1600ms with constant scrollY, which is the tell.
              //
              // So: an element counts only if its ty CHANGES during the window.
              if (cs.transform && cs.transform !== "none") {
                const m = new DOMMatrixReadOnly(cs.transform);
                const ty = Math.abs(m.m42);
                const k = el;
                const prev = seen.get(k);
                if (prev === undefined) { seen.set(k, { first: ty, last: ty, peak: 0 }); }
                else {
                  // DELTA across the window, not the final value. Reporting the
                  // final ty would read a mover that returns to its start as 0.
                  const d = Math.max(Math.abs(ty - prev.first), Math.abs(ty - prev.last), prev.peak);
                  seen.set(k, { first: prev.first, last: ty, peak: d });
                  if (d > 0.5) moving.add(k);
                }
              }
              // SETTLED, not accumulated. Counting opacity<0.05 on every frame
              // of the sampling window conflates "momentarily hidden during its
              // entrance" with "stuck forever". That conflation produced a FALSE
              // REPORT in Round 10 — "27 elements stuck invisible carrying the
              // availability line" — which was really 27 entrance frames. Measured
              // after settle, #download has ZERO elements below 0.05 and all
              // content is visible. `maxTy` is legitimately a max over the window
              // (a translate either happens or it does not); `hidden` is not.
              if (performance.now() - t0 > 900 && parseFloat(cs.opacity) < 0.05) hidden++;
            });
            if (performance.now() - t0 < 1400) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
        // Worst = largest MOVEMENT observed, computed after the window from the
        // elements that actually moved.
        let moved = 0; let moverId = "";
        moving.forEach((el) => {
          const rec = seen.get(el);
          const delta = rec ? Math.max(rec.peak, Math.abs(rec.last - rec.first)) : 0;
          if (delta > moved) {
            moved = delta;
            moverId = `${el.tagName}${el.id ? "#" + el.id : ""}.${String(el.className || "(no class)")}`.slice(0, 80);
          }
        });
        out.push({
          id,
          maxTy: Math.round(moved * 10) / 10,
          worstWho: moverId,
          movers: moving.size,
          staticCentred: seen.size - moving.size,
          hidden, subjects,
        });
      }
      return out;
    }, SECTION_IDS);
    samplerResults[cond.key] = { stampObserved, perSection };
    await sCtx.close();
  }

  // Contract condition: under (auto, reduce) nothing may move on Y.
  const contract = samplerResults["contract(auto,reduce)"].perSection;
  const contractBad = contract.filter((r) => r.missing || r.maxTy >= 0.5);
  check(
    "(auto, reduce): no section translates on Y — the reduce contract",
    contractBad.length === 0,
    contract.map((r) => `${r.id}: move=${r.maxTy ?? "MISSING"} movers=${r.movers ?? "-"}/static=${r.staticCentred ?? "-"} hidden=${r.hidden ?? "-"}`).join("  ")
  );
  // Discriminator: this cell is what makes the hook class visible.
  const disc = samplerResults["discriminator(off,no-preference)"];
  const discBad = disc.perSection.filter((r) => r.missing || r.maxTy >= 0.5);
  check(
    "(off, no-preference): no section translates on Y — the hook-class discriminator",
    discBad.length === 0,
    disc.perSection.map((r) => `${r.id}: move=${r.maxTy ?? "MISSING"} movers=${r.movers ?? "-"}/static=${r.staticCentred ?? "-"} hidden=${r.hidden ?? "-"}`).join("  ")
  );
  check(
    "the store is set by the PALETTE ROW (the mechanism itself, first direct test)",
    /^palette row/.test(disc.stampObserved) && /-> off/.test(disc.stampObserved),
    disc.stampObserved
  );
  paste(
    "sampler: per-section detail (both conditions)",
    Object.entries(samplerResults)
      .map(([k, v]) => {
        const rows = v.perSection
          .map((r) => `      ${r.id.padEnd(12)} max|ty|=${String(r.maxTy ?? "MISSING").padEnd(6)} hidden=${r.hidden}/${r.subjects}${r.worstWho ? `  worst=${r.worstWho}` : ""}`)
          .join("\n");
        return `  ${k}\n      store: ${v.stampObserved}\n${rows}`;
      })
      .join("\n")
  );

  // 10 — section architecture
  const secs = await page.evaluate(() =>
    [...document.querySelectorAll("section[id]")].map((s) => s.id)
  );
  check("5 sections, correct ids", secs.length === 5 && ["hero","act-record","gallery","understand","download"].every((id) => secs.includes(id)), secs.join(" > "));

  const errs = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("console errors (excluding favicon)", errs.length === 0, errs.slice(0, 3).join(" | ") || "none");

  // screenshots — for the HUMAN, not for GLM
  // Resolve relative to THIS file, not CWD. Running the probe from `landing/`
  // wrote to `landing/landing/probe-artifacts/` — the artifacts existed and were
  // 1 MB each, just one directory deeper than every doc claimed.
  const shotDir = fileURLToPath(new URL("../probe-artifacts/", import.meta.url));
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: `${shotDir}/run-${mode}-full.png`, fullPage: true });
  await page.locator("#download").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("#download").screenshot({ path: `${shotDir}/run-${mode}-download.png` });
  await page.locator(".ascii-surface").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator(".ascii-surface").screenshot({ path: `${shotDir}/run-${mode}-ascii.png` });
  paste("screenshots for the human", `${shotDir}/run-${mode}-{full,download,ascii}.png`);

  await browser.close();
}

console.log(`PROBE — ${BASE}`);
await run("no-preference");
await run("reduce");

const asserts = results.filter((r) => r.pass !== null);
console.log(`\n${"=".repeat(66)}`);
console.log(`${asserts.filter((a) => a.pass).length}/${asserts.length} asserts passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
