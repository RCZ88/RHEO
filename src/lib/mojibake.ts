// Mojibake repair utilities — fix double-encoded UTF-8 (e.g. "â€\"" for —, "Ã©" for é)
// Used by the main process when syncing problems/requests JSON and repairing DB rows.

/**
 * Repairs a double-encoded UTF-8 string.
 * Strategy: if the string contains known mojibake markers, re-interpret its
 * characters as Latin-1 bytes and decode as UTF-8. If that yields U+FFFD
 * (incomplete sequences, e.g. CP1252-origin mojibake like "â€""), fall back to
 * a character-level replacement table that maps the common mojibake pairs.
 */
export function repairDoubleEncodedUtf8(str: string): string {
  if (!str || typeof str !== 'string') return str;

  const hasMojibake =
    str.includes('Ã') ||
    str.includes('Â') ||
    str.includes('â€') ||
    str.includes('Â©') ||
    /[Ã¢Â€£©§«¯´µ¶]/.test(str);

  if (!hasMojibake) return str;

  let repaired = str;

  // Strategy 1: latin1 bytes → utf8 decode
  try {
    const bytes = Buffer.from(str, 'latin1');
    const decoded = bytes.toString('utf8');
    if (decoded && !decoded.includes('\uFFFD')) {
      repaired = decoded;
    }
  } catch {
    // ignore, fall through to strategy 2
  }

  // Strategy 2: character-level replacements (covers CP1252-origin sequences
  // that produce incomplete UTF-8 sequences under latin1 decoding)
  const table: Array<[RegExp, string]> = [
    [/â€œ/g, '\u201c'],
    [/â€\u0093/g, '\u201c'],
    [/â€\u009d/g, '\u201d'],
    [/â€™/g, '\u2019'],
    [/â€˜/g, '\u2018'],
    [/â€¦/g, '\u2026'],
    [/â€"/g, '\u2014'],
    [/â€“/g, '\u2013'],
    [/Â©/g, '\u00a9'],
    [/Â®/g, '\u00ae'],
    [/Â°/g, '\u00b0'],
    [/Â±/g, '\u00b1'],
    [/Â·/g, '\u00b7'],
    [/Â«/g, '\u00ab'],
    [/Â»/g, '\u00bb'],
    [/Ã©/g, '\u00e9'],
    [/Ã¨/g, '\u00e8'],
    [/Ãª/g, '\u00ea'],
    [/Ã«/g, '\u00eb'],
    [/Ã®/g, '\u00ee'],
    [/Ã¯/g, '\u00ef'],
    [/Ã´/g, '\u00f4'],
    [/Ã¶/g, '\u00f6'],
    [/Ã¼/g, '\u00fc'],
    [/Ã§/g, '\u00e7'],
    [/Ã /g, '\u00e0'],
    [/Ã¢/g, '\u00e2'],
    [/Ã¡/g, '\u00e1'],
    [/Ã£/g, '\u00e3'],
    [/Ã¤/g, '\u00e4'],
    [/Ã¥/g, '\u00e5'],
    [/Ã¨/g, '\u00e8'],
    [/Ã©/g, '\u00e9'],
    [/Ã¬/g, '\u00ec'],
    [/Ã­/g, '\u00ed'],
    [/Ã²/g, '\u00f2'],
    [/Ã³/g, '\u00f3'],
    [/Ã¹/g, '\u00f9'],
    [/Ãº/g, '\u00fa'],
    [/ÃŸ/g, '\u00df'],
    [/Ã†/g, '\u00c6'],
    [/Ã†’/g, '\u2019'],
    [/Ã¶/g, '\u00f6'],
  ];

  for (const [re, replacement] of table) {
    repaired = repaired.replace(re, replacement);
  }

  return repaired;
}

/**
 * Recursively walks a parsed JSON object and repairs every string value in place.
 * Returns the same object (mutated) — caller owns persistence.
 */
export function repairMojibakeDeep<T>(value: T): T {
  if (typeof value === 'string') return repairDoubleEncodedUtf8(value) as unknown as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = repairMojibakeDeep(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) obj[key] = repairMojibakeDeep(obj[key]);
  }
  return value;
}
