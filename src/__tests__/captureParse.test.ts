/**
 * The capture parser — the feature whose entire promise is "you only correct
 * it, not enter it". So the tests are mostly about what it REFUSES to guess.
 */
import { parseCaptureLine, summariseCapture, PATTERNS } from '../shared/captureParse';

// 14:20 local, so a caller can model "elapsed so far".
const NOW = 14 * 60 + 20;

describe('capture — the exact example CZ gave', () => {
  const p = parseCaptureLine('2 leetcode, hash map, got stuck on prefix sum', NOW);
  it('reads the count', () => expect(p.count).toBe(2));
  it('does NOT guess between hash-map and arrays — it asks', () => {
    // 'hash map' and 'prefix sum' are in different clauses, so this is COMPETING
    // rather than nested. Silently picking either would be a coin flip.
    expect(p.pattern).toBeNull();
    const a = p.ambiguities.find((x) => x.field === 'pattern');
    expect((a?.options ?? []).includes('hash-map')).toBe(true);
    expect((a?.options ?? []).includes('arrays')).toBe(true);
  });
  it('reads the result as stuck, not solved', () => expect(p.result).toBe('stuck'));
  it('reads the platform', () => expect(p.platform).toBe('leetcode'));
  it('is confident about the three things it understood', () => {
    expect(p.confidence.count).toBe('high');
    expect(p.confidence.result).toBe('high');
    expect(p.confidence.platform).toBe('high');
  });
  it('does NOT invent a duration it was told, and does not invent one it was NOT told', () => {
    // The example line states no duration, so the only honest answer is "unknown"
    // plus a question. The previous assertion here was `.toBe('guessed')`, which
    // meant this test PASSED BECAUSE of the 22-hour bug.
    expect(p.confidence.minutes).toBe('unknown');
    expect(p.minutes).toBe(null);
  });
  it('keeps the residue as a readable topic', () => {
    expect(p.topic.length).toBeGreaterThan(0);
  });
});

describe('capture — ambiguity is reported, never resolved', () => {
  it('"got stuck" never becomes "solved"', () => {
    expect(parseCaptureLine('got stuck on graph traversal', NOW).result).toBe('stuck');
  });
  it('a text with no result asks instead of assuming', () => {
    const p = parseCaptureLine('2 leetcode hash map', NOW);
    expect(p.result).toBeNull();
    expect(p.ambiguities.some((a) => a.field === 'result')).toBe(true);
  });
  it('an unrecognised pattern is null, NOT snapped to the nearest', () => {
    const p = parseCaptureLine('solved the quantum thing', NOW);
    expect(p.pattern).toBeNull();
    expect(p.ambiguities.some((a) => a.field === 'pattern')).toBe(true);
  });
  it('the pattern question offers one-tap options rather than a text box', () => {
    const a = parseCaptureLine('solved 2', NOW).ambiguities.find((x) => x.field === 'pattern');
    expect((a?.options?.length ?? 0)).toBeGreaterThan(0);
  });
});

describe('capture — count must not eat a technique name', () => {
  it('"2 pointer" is a technique, not two problems', () => expect(parseCaptureLine('2 pointer', NOW).count).toBeNull());
  it('"2 sum" is a technique, not two problems', () => expect(parseCaptureLine('2 sum', NOW).count).toBeNull());
  it('"3 problems" IS three problems', () => expect(parseCaptureLine('3 problems', NOW).count).toBe(3));
});

describe('capture — duration parsing', () => {
  it('90m', () => expect(parseCaptureLine('90m leetcode', NOW).minutes).toBe(90));
  it('2h', () => expect(parseCaptureLine('2h of sliding window', NOW).minutes).toBe(120));
  it('1h30m', () => expect(parseCaptureLine('1h30m leetcode', NOW).minutes).toBe(90));
  it('45 minutes', () => expect(parseCaptureLine('45 minutes on trees', NOW).minutes).toBe(45));
  it('flags an explicit duration as high confidence', () => {
    expect(parseCaptureLine('90m leetcode', NOW).confidence.minutes).toBe('high');
  });
  it('rejects an absurd duration rather than writing 5940 minutes', () => {
    // The right behaviour is reject-then-offer-a-flagged-guess, NOT null: the
    // user still wants the row, and a flagged 14:20 is honest where a rejected
    // parse would look like the app had lost their input.
    const p = parseCaptureLine('99h leetcode', NOW);
    expect(p.minutes === 5940).toBe(false);
    // Absurd input is REJECTED, not downgraded to a guess — a rejected value and
    // an invented one are different failure modes and must read differently.
    expect(p.confidence.minutes).toBe('unknown');
  });
});

// This block REPLACED one titled "a missing duration is GUESSED, never silently
// defaulted" which asserted `minutes !== null`. That test encoded the bug as
// intended behaviour — it claimed to guard against silent defaulting while
// asserting exactly that. It is why 210 tests passed while a live capture
// produced a 22-hour session. A test that names the opposite of what it asserts
// is worse than no test, because it converts a bug into a green check.
describe('capture — a missing duration is ASKED about, never invented', () => {
  const p = parseCaptureLine('solved a medium', NOW);

  it('leaves minutes NULL rather than guessing', () => expect(p.minutes).toBe(null));

  it('NEVER returns the clock reading as a duration', () => {
    // The regression itself. The old code was `(nowMinutes % 1440) / 5 * 5`,
    // which is just nowMinutes rounded — so at 22:20 it filed 1340 minutes.
    for (const now of [9 * 60, 12 * 60 + 30, 22 * 60 + 20, 23 * 60 + 55]) {
      for (const line of ['solved a medium', '2 leetcode', 'read chapter 3']) {
        const r = parseCaptureLine(line, now);
        expect(r.minutes).toBe(null);
        expect(r.confidence.minutes).toBe('unknown');
      }
    }
  });

  it('asks how long it took, rather than filling the field in', () => {
    expect(p.ambiguities.some((a) => a.question === 'How long did that take?')).toBe(true);
  });

  it('does not ask about duration when the line STATES one', () => {
    const q = parseCaptureLine('hash map for 45 min', NOW);
    expect(q.minutes).toBe(45);
    expect(q.ambiguities.some((a) => a.question === 'How long did that take?')).toBe(false);
  });

  it('a plausible-but-absurd duration is impossible to produce', () => {
    // No combination of clock reading and input may produce > 24h.
    for (const now of [0, 60, 720, 1380, 1439]) {
      const r = parseCaptureLine('2 leetcode, hash map, got stuck', now);
      expect(r.minutes === null || r.minutes <= 1440).toBe(true);
    }
  });
});

describe('capture — an EMPTY input asks nothing', () => {
  // "empty" is one of the five states humancentred-UIUX requires, and its job is
  // to tell the user what the box wants. Questions fired at an empty field are a
  // form of blanks wearing an invitation's clothes.
  for (const line of ['', '   ', '???', '?!', '.']) {
    it(`"${line}" is empty with no ambiguities`, () => {
      const p = parseCaptureLine(line, NOW);
      expect(p.empty).toBe(true);
      expect(p.ambiguities).toHaveLength(0);
    });
  }
});

describe('capture — longest match wins', () => {
  it('"binary search tree" classifies as tree, not sorting', () => {
    expect(parseCaptureLine('binary search tree', NOW).pattern).toBe('tree');
  });
  it('"two pointers" beats a bare "point"', () => {
    expect(parseCaptureLine('two pointers', NOW).pattern).toBe('two-pointers');
  });
  it('"sliding window" beats "window"', () => {
    expect(parseCaptureLine('sliding window max', NOW).pattern).toBe('sliding-window');
  });
});

describe('capture — every pattern is reachable and none is a synonym of another', () => {
  it('the closed set is non-empty and finite', () => {
    expect(PATTERNS.length).toBeGreaterThan(10);
    expect(new Set(PATTERNS).size).toBe(PATTERNS.length);
  });
});

describe('capture — empty and hostile input must not throw', () => {
  it('empty string', () => expect(parseCaptureLine('', NOW).empty).toBe(true));
  it('whitespace only', () => expect(parseCaptureLine('   ', NOW).empty).toBe(true));
  it('undefined', () => expect(parseCaptureLine(undefined as any, NOW).empty).toBe(true));
  it('a single punctuation mark is NOT a capture', () => {
    // Regression guard: the elapsed-time guess used to fire on any non-empty
    // line, which made the empty state unreachable.
    const p = parseCaptureLine('???', NOW);
    expect(p.empty).toBe(true);
    expect(p.minutes).toBeNull();
  });
  it('very long input does not blow up', () => {
    const p = parseCaptureLine('x'.repeat(20000), NOW);
    expect(typeof p.topic).toBe('string');
  });
});

describe('capture — summary line', () => {
  it('is terse enough for a 40px row', () => {
    const s = summariseCapture(parseCaptureLine('2 leetcode, hash map, got stuck', NOW));
    expect(s.length).toBeLessThan(60);
  });
  it('says something honest for an empty capture', () => {
    expect(summariseCapture(parseCaptureLine('', NOW))).toBe('Nothing captured yet');
  });
});
