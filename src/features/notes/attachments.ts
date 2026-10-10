/**
 * notes/attachments — inline attachments in note TEXT.
 *
 * WHY A TOKEN AND NOT A RICH-TEXT OBJECT. The note body stays plain text. That
 * is a deliberate constraint, not a limitation: a note is something you grep,
 * export, sync, paste into a search box, and read with `cat`. Swapping the
 * textarea for a contenteditable surface to make an attachment "inline" would
 * trade all of that for a nicer-looking chip, and the chip is the part you
 * already get from a token.
 *
 * So the STORAGE is `[[goal:abc123]]` sitting in the sentence where it belongs,
 * and the PREVIEW turns it into a real clickable chip at exactly that position.
 * One source of truth (the text), two renderings (raw in the editor, chips in
 * the reader). Round-tripping is exact: strip nothing, store nothing extra.
 *
 * THE PARSER IS PURE. No React, no IPC, no DOM. That is what makes it testable
 * under the repo's vitest-API shim, and it is why `validateUrl` can be
 * exercised directly rather than trusted.
 *
 * ── SECURITY: URLs ARE VALIDATED, NOT DISPLAYED ──
 * Note content is user-authored but it is also the thing a shared/imported note
 * would carry. `[[link:javascript:...]]` and a bare `javascript:` href are both
 * rejected outright rather than escaped-and-rendered: an attachment chip is a
 * button, and a button whose action string is attacker-controlled is a footgun
 * with a nicer font. Only http/https/mailto pass.
 */

export type AttachmentKind = 'goal' | 'phase' | 'todo' | 'note' | 'image' | 'file' | 'link';

export interface Attachment {
  kind: AttachmentKind;
  /** An id for goal/phase/todo/note, a filesystem path for image/file, a URL for link. */
  value: string;
  /** Optional display override, written after a pipe: [[link:url|Label]]. */
  label?: string;
  /** The exact source text, so a removal is a precise splice rather than a regex. */
  raw: string;
  /** Index of `raw[0]` in the content string. */
  start: number;
  /** Index one past the last character of `raw`. */
  end: number;
}

const KINDS: readonly AttachmentKind[] = ['goal', 'phase', 'todo', 'note', 'image', 'file', 'link'];

/** `[[kind:value]]` or `[[kind:value|Label]]`. Value may contain `:` (paths, URLs). */
const TOKEN_RE = /\[\[([a-z]+):([^\][|]+)(?:\|([^\][]*))?\]\]/g;

/**
 * Build the token text. Exported so the editor and any importer produce byte-
 * identical tokens instead of two hand-rolled string templates that drift.
 */
export function buildToken(kind: AttachmentKind, value: string, label?: string): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  return label ? `[[${kind}:${v}|${label}]]` : `[[${kind}:${v}]]`;
}

/**
 * Only these schemes may become a navigable link. Everything else is refused
 * rather than neutralised, so a bad token is VISIBLE to the author instead of
 * silently becoming inert text.
 */
export function validateUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') {
    return { ok: false, reason: `the ${scheme}: scheme is not allowed` };
  }
  return { ok: true, url: parsed.toString() };
}

/** A filesystem path must be absolute — a relative one resolves against whatever cwd the app has. */
export function validatePath(kind: AttachmentKind, raw: string): { ok: true; path: string } | { ok: false; reason: string } {
  const p = String(raw ?? '').trim();
  if (!p) return { ok: false, reason: 'empty' };
  if (kind === 'image' || kind === 'file') {
    if (!p.startsWith('/')) return { ok: false, reason: 'path must be absolute' };
  }
  return { ok: true, path: p };
}

/** Parse one token's INNER text (no brackets). Returns null when the kind is unknown. */
function parseInner(inner: string): { kind: AttachmentKind; value: string; label?: string } | null {
  const colon = inner.indexOf(':');
  if (colon <= 0) return null;
  const kind = inner.slice(0, colon).trim().toLowerCase() as AttachmentKind;
  if (!KINDS.includes(kind)) return null;
  const rest = inner.slice(colon + 1);
  const bar = rest.indexOf('|');
  const value = (bar === -1 ? rest : rest.slice(0, bar)).trim();
  const label = bar === -1 ? undefined : rest.slice(bar + 1).trim() || undefined;
  if (!value) return null;
  return { kind, value, label };
}

/** Every attachment in `content`, in document order. Unknown kinds are skipped, not guessed at. */
export function extractAttachments(content: string): Attachment[] {
  const out: Attachment[] = [];
  const text = String(content ?? '');
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const parsed = parseInner(m[1] + ':' + m[2] + (m[3] !== undefined ? '|' + m[3] : ''));
    if (!parsed) continue;
    out.push({ ...parsed, raw: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Does `content` contain at least one attachment? Cheap pre-check before rendering chips. */
export function hasAttachments(content: string): boolean {
  return extractAttachments(content).length > 0;
}

/**
 * Remove one attachment by identity (its raw text + start offset), used when the
 * author deletes a chip. Splicing by OFFSET rather than by string-replace matters:
 * two attachments can legitimately carry the same raw text (the same goal linked
 * twice in one note), and a global replace would delete both.
 */
export function removeAttachment(content: string, target: Pick<Attachment, 'raw' | 'start'>): string {
  const text = String(content ?? '');
  if (text.slice(target.start, target.start + target.raw.length) !== target.raw) {
    // Offsets are stale (the note was edited underneath us) — fall back to the
    // FIRST exact occurrence rather than corrupting text by guessing.
    const idx = text.indexOf(target.raw);
    if (idx === -1) return text;
    return text.slice(0, idx) + text.slice(idx + target.raw.length);
  }
  return text.slice(0, target.start) + text.slice(target.start + target.raw.length);
}

/* ── INLINE PART SPLITTING ───────────────────────────────────────────────── */

export type InlinePart =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'attachment'; attachment: Attachment; valid: boolean; reason?: string }
  | { type: 'link'; url: string; label: string };

/** A bare URL. Stops at whitespace and at the characters that end a sentence. */
const BARE_URL_RE = /https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"]/g;

/**
 * Split one LINE into renderable parts: tokens, bare links, bold, and text.
 *
 * Deliberately line-scoped, matching how the note renderer already works, so a
 * token cannot swallow a newline and a list marker cannot be eaten by a URL that
 * started on the line above.
 */
export function inlineParts(line: string): InlinePart[] {
  const text = String(line ?? '');
  const parts: InlinePart[] = [];
  let cursor = 0;

  const pushText = (s: string) => {
    if (!s) return;
    const last = parts[parts.length - 1];
    if (last && last.type === 'text') last.value += s;
    else parts.push({ type: 'text', value: s });
  };

  while (cursor < text.length) {
    const tokenStart = text.indexOf('[[', cursor);
    const urlMatch = (() => { BARE_URL_RE.lastIndex = cursor; return BARE_URL_RE.exec(text); })();

    const tokenIdx = tokenStart === -1 ? Infinity : tokenStart;
    const urlIdx = urlMatch ? urlMatch.index : Infinity;

    if (tokenIdx === Infinity && urlIdx === Infinity) {
      pushText(text.slice(cursor));
      break;
    }

    if (urlIdx < tokenIdx) {
      // URL first — it may contain a `[` that would look like a token start.
      pushText(text.slice(cursor, urlMatch!.index));
      const label = urlMatch![0];
      const checked = validateUrl(label);
      if (checked.ok) parts.push({ type: 'link', url: checked.url, label });
      else pushText(label); // refused: shown, not silently dropped
      cursor = urlMatch!.index + label.length;
      continue;
    }

    pushText(text.slice(cursor, tokenIdx));
    const close = text.indexOf(']]', tokenIdx);
    if (close === -1) {
      // Unclosed `[[` is ordinary prose (e.g. "[[1]]" in maths). Not a token.
      pushText(text.slice(tokenIdx));
      break;
    }
    const raw = text.slice(tokenIdx, close + 2);
    const parsed = parseInner(raw.slice(2, -2));
    if (!parsed) {
      pushText(raw);
    } else {
      const att: Attachment = { ...parsed, raw, start: tokenIdx, end: close + 2 };
      let valid = true, reason: string | undefined;
      if (att.kind === 'link') {
        const v = validateUrl(att.value);
        valid = v.ok;
        reason = v.ok ? undefined : (v as { reason: string }).reason;
        if (v.ok) att.value = v.url;
      } else if (att.kind === 'image' || att.kind === 'file') {
        const v = validatePath(att.kind, att.value);
        valid = v.ok;
        reason = v.ok ? undefined : (v as { reason: string }).reason;
      }
      parts.push({ type: 'attachment', attachment: att, valid, reason });
    }
    cursor = close + 2;
  }

  // Bold LAST, and only over text runs that survived tokenising, so a chip is
  // never rendered half-bold.
  return parts.flatMap((p) =>
    p.type === 'text' ? splitBold(p.value) : [p],
  );
}

function splitBold(value: string): InlinePart[] {
  const out: InlinePart[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
    out.push({ type: 'bold', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

/* ── EDITING ─────────────────────────────────────────────────────────────── */

/**
 * Insert `token` at the caret, and return the caret position AFTER it so the
 * author keeps typing where they were. Returns the original text untouched when
 * the token is empty — inserting nothing and moving the caret would silently
 * swallow a keystroke.
 */
export function insertTokenAtCursor(
  content: string,
  cursor: number,
  token: string,
): { content: string; cursor: number; inserted: boolean } {
  const text = String(content ?? '');
  if (!token) return { content: text, cursor, inserted: false };

  const pos = Math.max(0, Math.min(cursor ?? 0, text.length));

  // Pad so a token on its own line is readable in the raw textarea, but never
  // pad when it is landing mid-sentence — that would insert stray whitespace.
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const needsLead = before.length > 0 && !/\s$/.test(before);
  const needsTrail = after.length > 0 && !/^\s/.test(after);
  const pad = `${needsLead ? ' ' : ''}${token}${needsTrail ? ' ' : ''}`;

  return {
    content: before + pad + after,
    cursor: pos + pad.length,
    inserted: true,
  };
}

/** A short human label for an attachment when the author gave none. */
export function defaultLabel(a: Pick<Attachment, 'kind' | 'value'>): string {
  switch (a.kind) {
    case 'goal': return 'Goal';
    case 'phase': return 'Phase';
    case 'todo': return 'Todo';
    case 'note': return 'Note';
    case 'image': {
      const name = a.value.split(/[\\/]/).pop() || a.value;
      return name.length > 28 ? name.slice(0, 27) + '…' : name;
    }
    case 'file': {
      const name = a.value.split(/[\\/]/).pop() || a.value;
      return name.length > 28 ? name.slice(0, 27) + '…' : name;
    }
    case 'link': {
      try {
        const u = new URL(a.value);
        return u.hostname.replace(/^www\./, '');
      } catch { return a.value; }
    }
    default: return a.value;
  }
}
