/**
 * captureParse — one line of text in, a structured interpretation out.
 *
 * ── WHY THIS SHAPE ──
 * CZ's requirement: "2 leetcode, hash map, got stuck on prefix sum" should log
 * time, topic and result. And: "you only correct it, not enter it".
 *
 * That second clause is the whole design. So this function NEVER WRITES and
 * never guesses silently. It returns:
 *   · what it is confident about,
 *   · what it had to assume (so the UI can show the assumption as editable),
 *   · what it could not read (so the UI can ASK rather than invent).
 *
 * THE DESIGN DECISION THAT MATTERS: ambiguity is reported, not resolved.
 * A parser that confidently writes `result: 'solved'` from the word "stuck"
 * would be worse than one that says "I think you got stuck — confirm". The user
 * is logging mid-session with one hand; a wrong confident write costs more trust
 * than an extra keystroke to correct.
 *
 * ── WHY THE CONFIDENCE MODEL ──
 * Three tiers, and the UI treats them differently:
 *   high    → shown as a filled field, `Enter` commits it
 *   guessed → shown in amber, editable, commits but is visibly an assumption
 *   unknown → shown as an empty field with a prompt, never pre-filled
 *
 * ── WHY PATTERNS ARE A CLOSED SET ──
 * `PATTERNS` is closed rather than free-text because the spaced-repetition queue
 * groups by pattern. A free-text pattern would produce "hash map", "hashmap" and
 * "Hash Map" as three queues and quietly destroy the feature's value. Anything
 * unrecognised falls through to `null` + an ambiguity, and the UI offers the
 * closest known patterns as one-tap choices instead of a keyboard.
 *
 * Pure and dependency-free so it is unit-testable without a DOM, a DB, or the
 * 1.4 MB `main.ts` — the repo's own `pollForeground.test.ts` rule.
 */

/** Closed vocabulary. Anything outside it becomes an ambiguity, never a guess. */
export const PATTERNS = [
  'arrays', 'hash-map', 'two-pointers', 'sliding-window', 'binary-search',
  'strings', 'linked-list', 'stack', 'queue', 'heap', 'tree', 'graph',
  'trie', 'dynamic-programming', 'backtracking', 'greedy', 'math',
  'bit-manipulation', 'segment-tree', 'union-find', 'sorting', 'recursion',
] as const;
export type Pattern = typeof PATTERNS[number];

/** Aliases people actually type. Longest-first matching so "hash map" wins over "map". */
const PATTERN_ALIASES: ReadonlyArray<[RegExp, Pattern]> = [
  [/\bprefix\s*sums?\b|\bcumulative\s+sum\b/, 'arrays'],
  [/\btwo\s*pointers?\b|\btwo-pointer\b/, 'two-pointers'],
  [/\bsliding\s*window\b/, 'sliding-window'],
  [/\bbinary\s*search\b|\bbisect\b/, 'binary-search'],
  [/\bhash\s*map(s)?\b|\bhashmap(s)?\b|\bhashing\b/, 'hash-map'],
  [/\bdynamic\s*prog(ramming)?\b|\bdp\b/, 'dynamic-programming'],
  [/\bbacktrack(ing)?\b/, 'backtracking'],
  [/\btwo\s*d\b|\bbfs\b|\bdfs\b/, 'graph'],
  [/\bbinary\s*(tree|search\s*tree)\b|\bbst\b/, 'tree'],
  [/\blinked\s*list\b/, 'linked-list'],
  [/\bbinary\s*heap\b|\bpriority\s*queue\b|\bpq\b/, 'heap'],
  [/\bbit(s|wise)?\b|\bbitmask\b/, 'bit-manipulation'],
  [/\bsegment\s*tree\b/, 'segment-tree'],
  [/\bunion[\s-]?find\b|\bdsu\b/, 'union-find'],
  [/\btrie\b|\bprefix\s*tree\b/, 'trie'],
  [/\bsliding\b/, 'sliding-window'],
  [/\bstrings?\b/, 'strings'],
  [/\barrays?\b|\blists?\b/, 'arrays'],
  [/\bstacks?\b/, 'stack'],
  [/\bqueues?\b/, 'queue'],
  [/\bgraphs?\b/, 'graph'],
  [/\btrees?\b/, 'tree'],
  [/\bgreedy\b/, 'greedy'],
  [/\bsort(ing)?\b/, 'sorting'],
  [/\bmath\b|\bnumber\s*theory\b/, 'math'],
  [/\brecursi(on|ve)\b/, 'recursion'],
];

export type Result_ = 'solved' | 'stuck' | 'partial' | 'read';
export type Platform = 'leetcode' | 'codeforces' | 'unknown';
export type Confidence = 'high' | 'guessed' | 'unknown';

export interface Ambiguity {
  /** Which field the user needs to settle. */
  field: 'count' | 'minutes' | 'pattern' | 'result' | 'platform' | 'topic';
  /** A plain-language question. Never "invalid input" — humancentred-UIUX Gate F. */
  question: string;
  /** One-tap options when we can offer them. Empty means free text. */
  options?: string[];
}

export interface CaptureParse {
  /** Problems solved in this session. null = not stated, do not assume 1. */
  count: number | null;
  /** Minutes of work. null = not stated and not inferable. */
  minutes: number | null;
  pattern: Pattern | null;
  /** Did they get it? Only set when the text says so. */
  result: Result_ | null;
  platform: Platform;
  /** Free text after the known parts are stripped. Kept as the topic. */
  topic: string;
  /** How confident each field is, so the UI can style the assumption. */
  // `topic` was missing from this union, so the one place that assigns a
  // confidence to it (`if (out.topic) out.confidence.topic = 'high'`) did not
  // typecheck — which is the union doing its job. The field has always been
  // inferred, so it has a confidence like any other field.
  confidence: Record<'count' | 'minutes' | 'pattern' | 'result' | 'platform' | 'topic', Confidence>;
  ambiguities: Ambiguity[];
  /** True when nothing at all was understood — the UI then just asks. */
  empty: boolean;
}

/** "2h", "90m", "1h30m", "45 minutes", "1.5h" → minutes. */
function parseDuration(text: string): number | null {
  const hm = /(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(\d+)?\s*m?/.exec(text);
  if (hm) {
    const mins = Math.round(Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0));
    return mins > 0 && mins < 24 * 60 ? mins : null;
  }
  const m = /(\d+)\s*(?:m(?:in(?:ute)?s?)?|min)\b/.exec(text);
  if (m) {
    const mins = Number(m[1]);
    return mins > 0 && mins < 24 * 60 ? mins : null;
  }
  return null;
}

/**
 * A leading count, but ONLY when it is unambiguous. "2 leetcode" is a count of
 * problems; "3 pointer questions" is too, but "2 pointer" is a TECHNIQUE, not a
 * count. So a bare small integer is accepted only when the word right after it
 * is a plural noun that is not also a technique name.
 */
function parseCount(text: string): number | null {
  const m = /^\s*(\d{1,2})\s+(?=\S)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 99) return null;
  // Reject "2 pointer", "2 pointer", "2 sum" — technique names that start with a
  // number-ish word. Anything else followed by a word is taken as a count.
  const after = text.slice(m[0].length);
  if (/^(pointer|sum|sums|set|array|arrays|point)\b/i.test(after)) return null;
  return n;
}

function parseResult(text: string): Result_ | null {
  if (/\b(got\s*stuck|stuck|blocked|no\s*idea|failed|failed\s*to|couldn'?t\s*(?:solve|figure))\b/i.test(text)) return 'stuck';
  if (/\b(partial|half|almost|got\s*most|close)\b/i.test(text)) return 'partial';
  if (/\b(solved|done|finished|got\s*it|passed|accepted|clean|nailed)\b/i.test(text)) return 'solved';
  if (/\b(read|reading|studied|re-?read|reviewing|skimmed)\b/i.test(text)) return 'read';
  return null;
}

function parsePlatform(text: string): Platform {
  if (/\b(leetcode|leetcode\.com)\b/i.test(text)) return 'leetcode';
  if (/\b(codeforces|cf)\b/i.test(text)) return 'codeforces';
  return 'unknown';
}

/** The three questions that matter most for a competitive programmer. */
function parsePattern(text: string): { pattern: Pattern | null; candidates: Pattern[] } {
  const lower = text.toLowerCase();
  const hits: Array<{ p: Pattern; at: number; len: number }> = [];
  for (const [re, p] of PATTERN_ALIASES) {
    const m = re.exec(lower);
    if (m) hits.push({ p, at: m.index, len: m[0].length });
  }
  if (hits.length === 0) return { pattern: null, candidates: [] };

  hits.sort((a, b) => b.len - a.len);
  const best = hits[0];

  // NESTED vs COMPETING — the distinction that makes this correct.
  //
  //   "binary search tree" contains BOTH `binary-search` and `tree`. Those are
  //   NESTED: a BST *is* a tree, and the longer match ("binary search tree",
  //   17 chars) is the one that means what the writer meant. Longest wins.
  //
  //   CZ's own example — "2 leetcode, hash map, got stuck on prefix sum" —
  //   contains BOTH `hash-map` and `arrays` (via "prefix sum"). Those are
  //   COMPETING: hash map is the technique being practised, prefix sum is the
  //   specific problem, and they sit in different clauses. Picking the longer
  //   one silently picks `arrays`, which is wrong, and picking either silently
  //   guesses when the honest answer is "which did you mean?".
  //
  // So: overlapping matches are nested and the longest wins; separated matches
  // are competing and become an AMBIGUITY with both offered. This is the same
  // rule the whole module follows — report what you cannot decide, do not coin
  // flip.
  const competing = hits.filter((h) => h.p !== best.p && (h.at > best.at + best.len + 3 || h.at + h.len + 3 < best.at));
  if (competing.length > 0) {
    return { pattern: null, candidates: [best.p, ...competing.map((c) => c.p)].slice(0, 4) };
  }
  return { pattern: best.p, candidates: [best.p] };
}

const STRIP_RE = new RegExp(
  [
    '^\\s*\\d{1,2}\\s+(?=\\S)',                     // leading count
    '\\b\\d+(?:\\.\\d+)?\\s*h(?:ours?|rs?)?\\s*\\d*\\s*m?(?:in(?:ute)?s?)?\\b', // durations
    '\\b\\d+\\s*m(?:in(?:ute)?s?)?\\b',
    '\\b(got\\s*stuck|stuck|blocked|no\\s*idea|failed\\s*to|couldn\'?t\\s*(?:solve|figure))\\b',
    '\\b(solved|done|finished|got\\s*it|passed|accepted|clean|nailed)\\b',
    '\\b(partial|half|almost|got\\s*most|close)\\b',
    '\\b(read|reading|studied|re-?read|reviewing|skimmed)\\b',
    '\\b(leetcode|codeforces|cf)\\b',
    '\\bon\\s+leetcode\\b',
  ].join('|'),
  'gi',
);


/**
 * Does the line contain anything that could BE a capture?
 *
 * Requires at least one alphanumeric character of real length. `"???"`, `"---"`
 * and `"."` are keystrokes, not intent — and a tracker that files them as
 * sessions trains the user to distrust the list.
 */
function hasAnySignal(text: string): boolean {
  return /[a-z0-9]{2,}/i.test(text);
}

/**
 * Parse one line of typed text into a CaptureParse. NEVER throws.
 *
 * `nowMinutes` is the only clock input, and it is a REQUIRED argument on
 * purpose: this function used to be allowed to read the ambient time, which made
 * "when was this?" unanswerable and untestable. Making it explicit is the same
 * discipline as making `selectedDate` an explicit argument elsewhere in this
 * repo — a helper that secretly captures `now()` cannot report on the past.
 */
export function parseCaptureLine(raw: string, nowMinutes: number): CaptureParse {
  const text = String(raw ?? '').trim();

  const out: CaptureParse = {
    count: null, minutes: null, pattern: null, result: null, platform: 'unknown',
    topic: '', empty: true,
    confidence: { count: 'unknown', minutes: 'unknown', pattern: 'unknown', result: 'unknown', platform: 'unknown', topic: 'unknown' },
    ambiguities: [],
  };
  if (!text) return out;

  out.count = parseCount(text);
  if (out.count !== null) out.confidence.count = 'high';

  out.minutes = parseDuration(text);
  if (out.minutes !== null) {
    out.confidence.minutes = 'high';
  }
  // DELIBERATELY NO ELAPSED-TIME GUESS HERE.
  //
  // An earlier version did `Math.round((nowMinutes % 1440) / 5) * 5`. Modulo a
  // day is a no-op, so that returned the CURRENT TIME OF DAY rounded to five
  // minutes and filed it as a DURATION: at 22:20 a capture with no stated
  // duration became a 1340-minute, 22-hour session. Runtime caught it; the 210
  // unit tests could not, because every assertion used an explicitly-stated
  // duration ("45 min" -> 45) and none covered the absent case.
  //
  // The mistake was not the arithmetic, it was the PREMISE. This function
  // receives a clock reading, not a start time, so it has no way to know how
  // long anything lasted — it can only invent a number, and an invented duration
  // is the one field that silently corrupts every downstream total. Real
  // foreground-app elapsed time belongs to the main process, which already has
  // it, and `capture:parse` passes it in separately.
  //
  // What the parser owes the user instead is the QUESTION. An unstated duration
  // is genuine ambiguity, so it is surfaced rather than filled in.
  if (out.minutes === null && hasAnySignal(text)) {
    out.ambiguities.push({
      field: 'minutes',
      question: 'How long did that take?',
      confidence: 'unknown',
    });
  }

  const pat = parsePattern(text);
  out.pattern = pat.pattern;
  out.confidence.pattern = pat.pattern ? 'high' : 'unknown';
  if (!out.pattern) {
    // Two cases land here, and they get DIFFERENT questions because they are
    // different problems:
    //  · `candidates` non-empty → the text named two techniques ("hash map" and
    //    "prefix sum"). The question is "which one?", and both are offered, so
    //    it is one tap rather than a retype.
    //  · `candidates` empty → nothing recognisable. The question is an open one.
    out.ambiguities.push({
      field: 'pattern',
      question: pat.candidates.length > 1
        ? 'Two patterns in that line — which one?'
        : 'Which pattern was this?',
      options: (pat.candidates.length > 1 ? pat.candidates : PATTERNS.slice(0, 8)) as unknown as string[],
    });
  }

  out.result = parseResult(text);
  out.confidence.result = out.result ? 'high' : 'unknown';
  if (!out.result) {
    out.ambiguities.push({
      field: 'result',
      question: 'Did you solve it?',
      options: ['solved', 'partial', 'stuck', 'read'],
    });
  }

  out.platform = parsePlatform(text);
  out.confidence.platform = out.platform === 'unknown' ? 'unknown' : 'high';

  out.topic = text.replace(STRIP_RE, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').trim();

  // "Nothing understood at all" is a distinct state from "understood a little":
  // the UI shows a plain prompt in the first case rather than a form of blanks.
  // Punctuation-only input ("???") leaves residue after stripping, which would
  // otherwise read as a topic and suppress the empty state. A capture needs at
  // least one alphanumeric character to be worth a row.
  const hasContent = /[a-z0-9]/i.test(out.topic);
  out.empty = out.count === null && out.minutes === null && !out.pattern && !out.result && !hasContent;
  // An EMPTY input asks nothing. "empty" is one of the five states
  // humancentred-UIUX requires, and its job is to tell the user what the box
  // wants — "Which pattern was this? Did you solve it?" against an empty field
  // is a form of blanks wearing an invitation's clothes.
  if (out.empty) out.ambiguities.length = 0;
  if (out.topic) out.confidence.topic = 'high';

  // A count with no result is the most common ambiguity worth surfacing first,
  // because "2 leetcode" almost always means "I did 2 of them" and the reader
  // needs to know how many landed.
  if (out.count !== null && out.minutes === null && out.confidence.minutes === 'unknown') {
    out.ambiguities.unshift({
      field: 'minutes',
      question: 'How long did this take?',
    });
  }

  return out;
}

/**
 * One-line human summary for the capture list. Deliberately terse: it sits in a
 * 40px row and anything longer wraps and destroys scannability.
 */
export function summariseCapture(p: CaptureParse): string {
  if (p.empty) return 'Nothing captured yet';
  const bits: string[] = [];
  if (p.count !== null) bits.push(`${p.count} problem${p.count === 1 ? '' : 's'}`);
  if (p.minutes !== null) bits.push(`${p.minutes}m`);
  if (p.pattern) bits.push(p.pattern);
  if (p.result) bits.push(p.result);
  const topic = /[a-z0-9]/i.test(p.topic) ? p.topic : '';
  return bits.length ? bits.join(' · ') : (topic || 'Captured');
}