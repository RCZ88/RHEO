import {
  buildToken, defaultLabel, extractAttachments, hasAttachments, inlineParts,
  insertTokenAtCursor, removeAttachment, validatePath, validateUrl,
} from '../features/notes/attachments';

describe('notes attachments — parsing a token', () => {
  it('reads a goal', () => {
    const a = extractAttachments('see [[goal:abc123]] today');
    expect(a).toHaveLength(1);
    expect(a[0].kind).toBe('goal');
    expect(a[0].value).toBe('abc123');
  });

  it('reads a label after a pipe', () => {
    const a = extractAttachments('[[goal:g1|Learn C]]');
    expect(a[0].label).toBe('Learn C');
  });

  it('keeps a colon inside the value (paths and URLs both have them)', () => {
    expect(extractAttachments('[[file:/home/c/a.pdf]]')[0].value).toBe('/home/c/a.pdf');
    expect(extractAttachments('[[link:https://x.com/a]]')[0].value).toBe('https://x.com/a');
  });

  it('records exact offsets so a removal is a splice, not a guess', () => {
    const c = 'a [[goal:g1]] b';
    const a = extractAttachments(c);
    expect(c.slice(a[0].start, a[0].end)).toBe(a[0].raw);
  });

  it('refuses an unknown kind instead of guessing', () => {
    expect(extractAttachments('[[banana:x]]')).toHaveLength(0);
  });

  it('refuses an empty value', () => {
    expect(extractAttachments('[[goal:]]')).toHaveLength(0);
  });

  it('handles several in one note, in document order', () => {
    const a = extractAttachments('[[goal:g1]] then [[phase:p1]] then [[file:/a/b]]');
    expect(a.map((x) => x.kind)).toEqual(['goal', 'phase', 'file']);
  });

  it('an empty note has none', () => {
    expect(hasAttachments('')).toBe(false);
    expect(hasAttachments('plain prose')).toBe(false);
  });
});

describe('notes attachments — buildToken round-trips', () => {
  it('round-trips exactly through the parser', () => {
    const t = buildToken('goal', 'abc');
    expect(extractAttachments(t)[0].value).toBe('abc');
  });
  it('round-trips a label', () => {
    const t = buildToken('link', 'https://x.com', 'Docs');
    expect(extractAttachments(t)[0].label).toBe('Docs');
  });
  it('an empty value produces NO token, not a broken one', () => {
    expect(buildToken('goal', '')).toBe('');
    expect(buildToken('goal', '   ')).toBe('');
  });
});

describe('notes attachments — URL SAFETY (the reason this module validates)', () => {
  it('accepts http, https, mailto', () => {
    expect(validateUrl('https://x.com').ok).toBe(true);
    expect(validateUrl('http://x.com').ok).toBe(true);
    expect(validateUrl('mailto:a@b.com').ok).toBe(true);
  });

  it('REFUSES javascript: — a chip is a button, and a button runs its action string', () => {
    const r: any = validateUrl('javascript:alert(1)');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('javascript');
  });

  it('refuses data:, vbscript:, file:', () => {
    for (const u of ['data:text/html,<script>', 'vbscript:msgbox', 'file:///etc/passwd']) {
      expect(validateUrl(u).ok).toBe(false);
    }
  });

  it('refuses something that is not a URL at all', () => {
    expect(validateUrl('not a url').ok).toBe(false);
    expect(validateUrl('').ok).toBe(false);
  });

  it('a malicious TOKEN is flagged invalid but STILL VISIBLE to the author', () => {
    // Silently dropping it would make the note look clean while carrying a
    // payload; rendering it inert would hide the problem. It must be shown.
    const parts = inlineParts('[[link:javascript:alert(1)]]');
    const att = parts.find((p) => p.type === 'attachment') as any;
    expect(att.valid).toBe(false);
    expect(att.reason).toContain('javascript');
  });

  it('a malicious BARE url is refused and left as text, not linkified', () => {
    expect(inlineParts('javascript:alert(1)').every((p) => p.type !== 'link')).toBe(true);
  });
});

describe('notes attachments — paths', () => {
  it('requires absolute paths', () => {
    expect(validatePath('image', 'pics/a.png').ok).toBe(false);
    expect(validatePath('image', '/pics/a.png').ok).toBe(true);
  });
  it('normalises a file:// prefix off rather than rejecting it', () => {
    // Links attached by the OLD path stored file:// URLs; those notes must keep working.
    expect(extractAttachments('[[file:file:///home/c/a.pdf]]')[0].value).toBe('file:///home/c/a.pdf');
  });
});

describe('notes attachments — inline splitting', () => {
  it('splits text + token', () => {
    const p = inlineParts('read [[goal:g1]] later');
    expect(p.map((x) => x.type)).toEqual(['text', 'attachment', 'text']);
  });

  it('renders bold ONLY around text, never half-applied to a chip', () => {
    const p = inlineParts('**bold** then [[goal:g1]]');
    const bold = p.filter((x) => x.type === 'bold') as any[];
    expect(bold).toHaveLength(1);
    expect(p.find((x) => x.type === 'attachment')).toBeTruthy();
  });

  it('treats unclosed [[ as prose, not a broken token', () => {
    // "[[1]]" in a maths note must survive intact.
    const p = inlineParts('the matrix A[[1]]');
    expect(p.some((x) => x.type === 'attachment')).toBe(false);
    expect(p.map((x) => ('value' in x ? x.value : '')).join('')).toContain('[[1]]');
  });

  it('does not swallow a newline — it is line scoped', () => {
    expect(inlineParts('[[goal:g1').some((x) => x.type === 'attachment')).toBe(false);
  });

  it('linkifies a bare URL', () => {
    const p = inlineParts('see https://example.com/a');
    const link = p.find((x) => x.type === 'link') as any;
    expect(link).toBeTruthy();
    expect(link.url).toContain('example.com');
  });

  it('does not include a trailing full stop in a bare URL', () => {
    const link = inlineParts('go to https://example.com.').find((x) => x.type === 'link') as any;
    expect(link.label).toBe('https://example.com');
  });

  it('coalesces adjacent text so bold splitting does not emit empty spans', () => {
    const p = inlineParts('plain words here');
    expect(p).toHaveLength(1);
  });

  it('an empty line yields no parts', () => {
    expect(inlineParts('')).toHaveLength(0);
  });

  it('an image token is a token, not a markdown image that a renderer might fetch', () => {
    // A markdown `![...](url)` would be fetched by whatever renders it. Ours is
    // inert text until the reader deliberately opens it. The leading `!` stays
    // as prose — it is not part of the token.
    const p = inlineParts('![[image:/home/c/a.png]]');
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ type: 'text', value: '!' });
    const att = p[1] as any;
    expect(att.type).toBe('attachment');
    expect(att.attachment.kind).toBe('image');
  });
});

describe('notes attachments — editing', () => {
  it('inserts at the caret and leaves the caret AFTER the token', () => {
    const r = insertTokenAtCursor('ab', 1, '[[goal:g1]]');
    expect(r.content).toBe('a [[goal:g1]] b');
    // The caret sits past the END of the token, so the next keystroke continues
    // after it rather than landing inside the brackets.
    const tokenEnd = r.content.indexOf(']]') + 2;
    expect(r.cursor).toBeGreaterThanOrEqual(tokenEnd);
    expect(r.content.slice(tokenEnd, r.cursor).trim()).toBe('');
  });

  it('inserting an empty token changes NOTHING and does not move the caret', () => {
    // Otherwise a keystroke is silently swallowed.
    const r = insertTokenAtCursor('abc', 2, '');
    expect(r.content).toBe('abc');
    expect(r.cursor).toBe(2);
    expect(r.inserted).toBe(false);
  });

  it('still separates a token inserted at position 0', () => {
    // `[[goal:g1]]x` would read as one run of prose; a trailing space keeps the
    // token delimited without adding a leading one.
    expect(insertTokenAtCursor('x', 0, '[[goal:g1]]').content).toBe('[[goal:g1]] x');
  });

  it('adds no LEADING pad when inserting at position 0', () => {
    expect(insertTokenAtCursor('x', 0, '[[goal:g1]]').content.startsWith('[[')).toBe(true);
  });

  it('clamps an out-of-range caret instead of corrupting the string', () => {
    expect(insertTokenAtCursor('ab', 999, '[[goal:g1]]').content).toContain('[[goal:g1]]');
    expect(insertTokenAtCursor('ab', -5, '[[goal:g1]]').content).toContain('[[goal:g1]]');
  });

  it('removes by offset', () => {
    const c = 'a [[goal:g1]] b';
    const a = extractAttachments(c)[0];
    expect(removeAttachment(c, a)).toBe('a  b');
  });

  it('removing ONE of two identical tokens leaves the other alone', () => {
    // A global string-replace would delete both. This is the whole reason the
    // removal is offset-based.
    const c = '[[goal:g1]] and [[goal:g1]]';
    const a = extractAttachments(c)[0];
    const out = removeAttachment(c, a);
    expect(extractAttachments(out)).toHaveLength(1);
  });

  it('falls back to the first match when offsets went stale', () => {
    const out = removeAttachment('x [[goal:g1]] y', { raw: '[[goal:g1]]', start: 999 });
    expect(extractAttachments(out)).toHaveLength(0);
  });
});

describe('notes attachments — default labels', () => {
  it('names an image by its filename, truncated', () => {
    const l = defaultLabel({ kind: 'image', value: '/a/b/' + 'x'.repeat(50) + '.png' });
    expect(l.length).toBeLessThanOrEqual(28);
    expect(l.endsWith('…')).toBe(true);
  });
  it('names a link by hostname without www', () => {
    expect(defaultLabel({ kind: 'link', value: 'https://www.example.com/a' })).toBe('example.com');
  });
  it('names a goal by kind when there is nothing better', () => {
    expect(defaultLabel({ kind: 'goal', value: 'g1' })).toBe('Goal');
  });
  it('does not throw on an unparseable link', () => {
    expect(typeof defaultLabel({ kind: 'link', value: 'garbage' })).toBe('string');
  });
});
