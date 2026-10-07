/**
 * probe-orbit.mjs — is the ring geometry actually sane?
 *
 * An agent may not run a build (AGENTS.md §0-0), and I have never seen this page
 * render. So this prints the NUMBERS and asserts the properties that decide
 * whether the ring is usable. Reading the code cannot tell you that 17 cards
 * land 1,276px off-screen — the first version of this probe proved that.
 *
 * WHAT THIS CAUGHT (all real, all invisible to tsc and esbuild):
 *   1. 17 cards at 560x350 overflow a 1280px stage by 1,276px. The orbit cannot
 *      hold full-size screenshots; the RING must carry thumbnails.
 *   2. A fixed thumbnail size overflows on mobile (489-645px at 390x460), so
 *      the size has to be solved per stage.
 *   3. Two scratch scripts I wrote to debug #2 reported NaN and a false
 *      "it fits" — the module was fine, my throwaway probes were wrong. Hence
 *      these checks live HERE, in the file that ships, not in /tmp scratch.
 *
 * Run: node --experimental-strip-types landing/scripts/probe-orbit.mjs
 */
import {
  CARD_ASPECT,
  buildLayout,
  fitCard,
  frontIndex,
  snapOffset,
  stepFor,
} from "../src/components/rheo/orbit-layout.ts";

const COUNT = 17; // the real number of screenshots
const STAGES = [
  { label: "desktop", w: 1280, h: 620 },
  { label: "wide", w: 1600, h: 620 },
  { label: "mobile", w: 390, h: 460 },
];
const MODES = ["flat", "tilt", "ring", "gallery"];

let failures = 0;
const fail = (m) => {
  console.log("    FAIL " + m);
  failures++;
};
const num = (n) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(1));

/**
 * How far the ring's bounding box sticks out past the stage, PER AXIS.
 *
 * Subtracting the stage size from an absolute coordinate is meaningless — the
 * two `bounds` bugs I made while building this probe both came from doing it
 * that way. Correct form: the left edge overflows when minX < 0, the right
 * edge when maxX > stageW, and likewise for y.
 */
function edgeOverflow(boxes, stageW, stageH) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    left: -minX,
    right: maxX - stageW,
    top: -minY,
    bottom: maxY - stageH,
    worst: Math.max(-minX, maxX - stageW, -minY, maxY - stageH),
  };
}

console.log(
  `aspect ${CARD_ASPECT.toFixed(3)} (captures are 2880x1800 = 1.600) · ${COUNT} cards\n`
);

for (const s of STAGES) {
  console.log(`--- ${s.label} ${s.w}x${s.h} ---`);
  for (const mode of MODES) {
    const fit = fitCard(mode, COUNT, s.w, s.h, 200, 8);
    const boxes = buildLayout(mode, COUNT, s.w, s.h, 0, fit.size, fit.height);

    // 1. every box is finite — a NaN reads as "fits" in any comparison
    const nonFinite = boxes.filter(
      (b) => ![b.x, b.y, b.width, b.height, b.zIndex].every(Number.isFinite)
    );
    if (nonFinite.length) {
      fail(`${mode}@${s.label}: ${nonFinite.length} boxes are non-finite (NaN compares false against every threshold)`);
      continue;
    }

    // 2. no degenerate cards
    const tiny = boxes.filter((b) => b.width < 24 || b.height < 24);
    if (tiny.length) fail(`${mode}@${s.label}: ${tiny.length} cards under 24px`);

    // 3. overflow, and it must be reported honestly
    const box = edgeOverflow(boxes, s.w, s.h);
    if (box.worst > 8 && !fit.overflows) {
      fail(
        `${mode}@${s.label}: clips by ${num(box.worst)}px (L${num(box.left)} R${num(box.right)} T${num(box.top)} B${num(box.bottom)}) but fitCard reported no overflow`
      );
    }

    // 4. aspect preserved
    const aspErr = Math.abs(fit.size / fit.height - CARD_ASPECT);
    if (aspErr > 0.02) fail(`${mode}@${s.label}: aspect drifted ${aspErr.toFixed(3)}`);

    // 5. front card is the widest (coverflow modes); flat defines front by centre
    const front = frontIndex(mode, boxes, s.w, s.h);
    const widest = boxes.reduce((a, b, i) => (b.width > boxes[a].width ? i : a), 0);
    if (mode !== "flat" && front !== widest) {
      fail(`${mode}@${s.label}: frontIndex()=${front} but widest=${widest}`);
    }

    console.log(
      `  ${mode.padEnd(8)} thumb ${String(fit.size).padStart(3)}x${String(fit.height).padStart(3)}` +
        `  aspect ${(fit.size / fit.height).toFixed(3)}` +
        `  clip ${num(box.worst).padStart(6)}` +
        `  reported ${String(fit.overflows).padEnd(5)}` +
        `  front #${String(front).padStart(2)}` +
        `  ${box.worst <= 8 || fit.overflows ? "ok" : "*** CLIPPED ***"}`
    );
  }
  console.log("");
}

// snapping
console.log("--- snapping ---");
const step = stepFor(COUNT);
console.log(`  step for ${COUNT} cards = ${step.toFixed(2)}deg`);
for (const [input, why] of [
  [17, "small throw"],
  [193, "large throw"],
  [-187, "negative throw"],
]) {
  const snapped = snapOffset(input, COUNT);
  const onNotch = Math.abs(snapped / step - Math.round(snapped / step)) < 1e-9;
  const travel = Math.abs(snapped - input);
  console.log(
    `  ${String(input).padStart(5)}deg -> ${num(snapped).padStart(7)}deg  onNotch=${onNotch}  moved ${num(travel)}deg  (${why})`
  );
  if (!onNotch) fail(`snapOffset(${input}) is not on a notch`);
  if (travel > step + 1e-9) {
    fail(`snapOffset(${input}) moved ${num(travel)}deg, more than one ${num(step)}deg step`);
  }
}

console.log(
  "\n" +
    (failures === 0
      ? `GEOMETRY SOUND — ${MODES.length} modes x ${STAGES.length} stages`
      : `${failures} FAILURES`)
);
process.exit(failures === 0 ? 0 : 1);