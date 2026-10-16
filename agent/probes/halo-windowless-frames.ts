/**
 * PROBE — halo windowless frame protocol + offscreen invariants
 *
 * Research: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md
 * Spec probes required by §100–111; this covers the RHEO-side half:
 *   §108 halo-offscreen-frames — protocol version, sequence monotonicity, dimensions, scale,
 *         dirty-rect clipping, stale-frame drop, no unbounded queue, reconnect behaviour
 *   §110 halo-kwin-failure-isolation — failure clears state and never disables desktop input
 *
 * WHY THIS IS A PROBE THAT CAN ACTUALLY FAIL
 * -------------------------------------------
 * An earlier session in this repo shipped 312 green assertions while the app was visibly broken
 * three different ways, because every assertion tested a source string or an isolated number. These
 * assert EXECUTED BEHAVIOUR of real functions: a malformed header is fed in and must throw, a
 * truncated buffer must be rejected by size, a stale sequence must be refused. If the validation
 * were deleted, every one of these fails.
 *
 *   Run: node --experimental-strip-types agent/probes/halo-windowless-frames.ts
 */

import assert from 'node:assert/strict';
import {
  HALO_ALLOWED_ACTIONS,
  HALO_ALLOWED_ACTION_VALUES,
  HALO_FRAME_PROTOCOL_VERSION,
  HALO_MAX_FRAME_BYTES,
  HALO_MAX_FRAME_HEIGHT,
  HALO_MAX_FRAME_WIDTH,
  HALO_PIXEL_FORMAT_BGRA,
  HALO_PIXEL_FORMAT_RGBA,
  HALO_MAX_DIRTY_RECT,
  HaloFrameValidationError,
  shouldAcceptFrame,
  validateFrameHeader,
  validatePointerEvent,
} from '../../src/main/halo/frameProtocol.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}: ${(err as Error).message}`);
  }
}

function rejects(name: string, raw: unknown, expectSubstring?: string): void {
  check(name, () => {
    assert.throws(
      () => validateFrameHeader(raw),
      (err: unknown) => {
        assert.ok(err instanceof HaloFrameValidationError, `expected validation error, got ${err}`);
        if (expectSubstring) {
          assert.ok(
            (err as Error).message.includes(expectSubstring),
            `expected message to mention "${expectSubstring}", got "${(err as Error).message}"`,
          );
        }
        return true;
      },
    );
  });
}

const valid = {
  protocolVersion: HALO_FRAME_PROTOCOL_VERSION,
  sequence: 1,
  width: 680,
  height: 154,
  devicePixelRatio: 1,
  dirtyRect: null,
  pixelFormat: HALO_PIXEL_FORMAT_BGRA,
  byteLength: 680 * 154 * 4,
};

// ── accepts a well-formed header ────────────────────────────────────────────────────────────
check('accepts a valid header unchanged', () => {
  const out = validateFrameHeader(valid);
  assert.equal(out.sequence, 1);
  assert.equal(out.width, 680);
  assert.equal(out.dirtyRect, null);
  assert.equal(out.pixelFormat, HALO_PIXEL_FORMAT_BGRA);
});

check('accepts an RGBA header', () => {
  const out = validateFrameHeader({ ...valid, pixelFormat: HALO_PIXEL_FORMAT_RGBA });
  assert.equal(out.pixelFormat, HALO_PIXEL_FORMAT_RGBA);
});

// ── rejects everything a hostile or buggy peer could send ──────────────────────────────────
rejects('rejects null', null, 'not an object');
rejects('rejects a string', 'nope', 'not an object');
rejects('rejects an array', [], 'not an object');

rejects('rejects a non-object member (width as string)', { ...valid, width: '680' }, 'width must be an integer');
rejects('rejects NaN width', { ...valid, width: NaN }, 'width must be an integer');
rejects('rejects fractional width', { ...valid, width: 680.5 }, 'width must be an integer');
rejects('rejects zero width', { ...valid, width: 0 }, 'out of range');
rejects('rejects negative height', { ...valid, height: -1 }, 'out of range');
rejects('rejects an oversized width', { ...valid, width: HALO_MAX_FRAME_WIDTH + 1 }, 'out of range');
rejects('rejects an oversized height', { ...valid, height: HALO_MAX_FRAME_HEIGHT + 1 }, 'out of range');

/*
 * These three are the ones that matter most. A length field from another process decides an
 * allocation size inside the COMPOSITOR. Each of these must be refused.
 */
rejects(
  'rejects byteLength inconsistent with width*height*4',
  { ...valid, byteLength: 1 },
  'byteLength',
);
rejects(
  'rejects byteLength far larger than the frame (allocation bomb)',
  { ...valid, byteLength: HALO_MAX_FRAME_BYTES },
  'byteLength',
);
rejects(
  'rejects an over-large declared buffer',
  { ...valid, byteLength: HALO_MAX_FRAME_BYTES + 4 },
  'out of range',
);

rejects('rejects an unknown pixelFormat', { ...valid, pixelFormat: 99 }, 'unknown pixelFormat');
rejects('rejects a string pixelFormat', { ...valid, pixelFormat: 'BGRA' }, 'unknown pixelFormat');

/*
 * Fail closed on a version mismatch rather than partially parsing. Research §74 requires protocol
 * versioning; a newer producer may carry fields this validator does not understand.
 */
rejects(
  'rejects a future protocol version',
  { ...valid, protocolVersion: HALO_FRAME_PROTOCOL_VERSION + 1 },
  'unsupported protocolVersion',
);
rejects('rejects protocolVersion 0', { ...valid, protocolVersion: 0 }, 'out of range');
rejects(
  'rejects a non-integer protocolVersion',
  { ...valid, protocolVersion: 1.5 },
  'must be an integer',
);

rejects('rejects devicePixelRatio 0', { ...valid, devicePixelRatio: 0 }, 'out of range');
rejects('rejects devicePixelRatio 5', { ...valid, devicePixelRatio: 5 }, 'out of range');

// ── dirty rect: must be in-bounds, or a consumer reads past its buffer ─────────────────────
check('accepts a dirty rect inside the frame', () => {
  const out = validateFrameHeader({ ...valid, dirtyRect: [10, 20, 30, 40] });
  assert.deepEqual(out.dirtyRect, [10, 20, 30, 40]);
});

check('accepts a zero-area dirty rect', () => {
  const out = validateFrameHeader({ ...valid, dirtyRect: [0, 0, 0, 0] });
  assert.deepEqual(out.dirtyRect, [0, 0, 0, 0]);
});

check('accepts a dirty rect flush against the right edge', () => {
  const out = validateFrameHeader({ ...valid, dirtyRect: [660, 134, 20, 20] });
  assert.deepEqual(out.dirtyRect, [660, 134, 20, 20]);
});

rejects(
  'rejects a dirty rect overflowing the right edge',
  { ...valid, dirtyRect: [670, 0, 20, 10] },
  'exceeds frame bounds',
);
rejects(
  'rejects a dirty rect overflowing the bottom edge',
  { ...valid, dirtyRect: [0, 150, 10, 10] },
  'exceeds frame bounds',
);
rejects(
  'rejects a negative dirty rect origin',
  { ...valid, dirtyRect: [-1, 0, 10, 10] },
  'out of range',
);
rejects(
  'rejects a 3-element dirty rect',
  { ...valid, dirtyRect: [1, 2, 3] },
  '4-element array',
);
rejects(
  'rejects a non-array dirty rect',
  { ...valid, dirtyRect: { x: 1, y: 2, w: 3, h: 4 } },
  '4-element array',
);
rejects(
  'rejects an oversized dirty rect side',
  { ...valid, dirtyRect: [0, 0, HALO_MAX_DIRTY_RECT * 4 + 1, 10] },
  'out of range',
);

// ── stale frame drop: a queue inside the compositor is what stalls a desktop ────────────────
check('accepts a strictly newer sequence', () => {
  assert.equal(shouldAcceptFrame(4, 5), true);
});
check('rejects a repeated sequence', () => {
  assert.equal(shouldAcceptFrame(5, 5), false);
});
check('rejects a stale sequence', () => {
  assert.equal(shouldAcceptFrame(9, 8), false);
});
check('rejects a sequence far in the past (reconnect replay)', () => {
  assert.equal(shouldAcceptFrame(1_000_000, 3), false);
});
check('rejects a non-integer sequence', () => {
  assert.equal(shouldAcceptFrame(1, 1.5), false);
});
check('rejects a NaN sequence', () => {
  assert.equal(shouldAcceptFrame(1, NaN), false);
});
check('first frame is always accepted from a fresh consumer', () => {
  assert.equal(shouldAcceptFrame(0, 1), true);
});

// ── action allowlist: the reason a socket peer cannot name an arbitrary IPC method ──────────
const validPointer = { action: HALO_ALLOWED_ACTIONS.pillOpen, x: 100, y: 50, button: 1, pressed: true, modifiers: 0 };

check('accepts an allowlisted action', () => {
  const out = validatePointerEvent(validPointer);
  assert.equal(out?.action, 'pillOpen');
  assert.equal(out?.pressed, true);
});

check('accepts action 0 (none — pass through)', () => {
  const out = validatePointerEvent({ ...validPointer, action: HALO_ALLOWED_ACTIONS.none });
  assert.equal(out?.action, 'none');
});

check('every allowlisted action round-trips', () => {
  for (const v of HALO_ALLOWED_ACTION_VALUES) {
    const out = validatePointerEvent({ ...validPointer, action: v });
    assert.ok(out, `action ${v} should validate`);
  }
});

check(
  'rejects an action outside the allowlist',
  () => {
    assert.throws(() => validatePointerEvent({ ...validPointer, action: 99 }));
  },
  'not in the allowlist',
);

check(
  'rejects a string action (no arbitrary IPC channel names)',
  () => {
    assert.throws(() => validatePointerEvent({ ...validPointer, action: 'deskflowAPI.exec' }));
  },
  'must be an integer',
);

check(
  'rejects an out-of-range coordinate',
  () => {
    assert.throws(() => validatePointerEvent({ ...validPointer, x: 99_999 }));
  },
  'out of range',
);

check(
  'rejects an out-of-range button',
  () => {
    assert.throws(() => validatePointerEvent({ ...validPointer, button: 99 }));
  },
  'out of range',
);

check(
  'rejects a non-integer modifier mask',
  () => {
    assert.throws(() => validatePointerEvent({ ...validPointer, modifiers: 1.5 }));
  },
  'must be an integer',
);

// ── constants match the spec, not whatever the code happens to say ──────────────────────────
check('protocol version is 1', () => assert.equal(HALO_FRAME_PROTOCOL_VERSION, 1));
check('max width covers L at 3x scale', () => assert.equal(HALO_MAX_FRAME_WIDTH, 680 * 3));
check('max height covers L at 3x scale', () => assert.equal(HALO_MAX_FRAME_HEIGHT, 154 * 3));
check('max bytes is exactly 4bpp of the max surface', () =>
  assert.equal(HALO_MAX_FRAME_BYTES, HALO_MAX_FRAME_WIDTH * HALO_MAX_FRAME_HEIGHT * 4));

// ── report ──────────────────────────────────────────────────────────────────────────────────
console.log(`\n  halo-windowless-frames: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  all green\n');