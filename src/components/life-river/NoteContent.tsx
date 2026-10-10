/**
 * NoteContent — a note body with INLINE attachments.
 *
 * WHY THIS EXISTS INSTEAD OF A CHANGE TO `MarkdownPreview`.
 * `MarkdownPreview` is imported by the note reader and the note editor, and its
 * job is the shared markdown subset: headings, bullets, checkboxes, bold. It has
 * no concept of an attachment and no concept of a link. Adding both there would
 * put note vocabulary inside a component whose other job is "render markdown
 * generically", and the next caller would inherit a `[[goal:...]]` chip
 * vocabulary it never asked for. So the note body gets its own renderer, and the
 * syntax it supports is a strict SUPERSET — a note that contains no attachment
 * renders identically to before.
 *
 * ── WHY CHIPS DON'T CLOSE THE POPUP ──
 * A chip click is an INSPECTION, not a navigation. Dimensional reasoning: the
 * reader opened a note because they want to read it; yanking them to another
 * route to show them a goal title is a bigger interruption than the thing they
 * asked for, and it loses their place in the note. So `onInspect` is a callback
 * and the popup stays exactly where it is. Navigating is offered as an explicit
 * second step inside the peek, never as the click itself.
 *
 * ── IMAGE SAFETY ──
 * Images are referenced by absolute path, never embedded — a note stays small
 * and the file stays in one place. A broken path renders a labelled placeholder
 * with the path visible, because "image did not load" with no path is the single
 * most useless state in this whole feature.
 */

import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, FileText, Image as ImageIcon, Layers, Link2, ListTodo, Pencil, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultLabel, inlineParts, type Attachment, type InlinePart } from '@/features/notes/attachments';

export type InspectTarget =
  | { kind: 'goal' | 'phase' | 'todo' | 'note'; id: string; label: string }
  | { kind: 'file' | 'image'; path: string; label: string }
  | { kind: 'link'; url: string; label: string };

const KIND_ICON = {
  goal: Target,
  phase: Layers,
  todo: ListTodo,
  note: Pencil,
  file: FileText,
  link: Link2,
} as const;

function InlineImage({ path, label }: { path: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--error-muted)] px-2 py-1 align-middle text-[12px] text-zinc-400"
        title={path}
      >
        <AlertTriangle className="w-3 h-3 shrink-0 text-[color:var(--error)]" aria-hidden />
        <span className="truncate">Image not found — {label}</span>
      </span>
    );
  }
  return (
    <span className="inline-block align-middle my-1">
      <img
        src={`file://${path}`}
        alt={label}
        onError={() => setFailed(true)}
        className="max-h-72 rounded-lg border border-zinc-800 light:border-zinc-200"
      />
    </span>
  );
}

function AttachmentChip({ a, onInspect }: { a: Extract<InlinePart, { type: 'attachment' }>; onInspect?: (t: InspectTarget) => void }) {
  const [copied, setCopied] = useState(false);
  const att = a.attachment;
  const label = att.label || defaultLabel(att);

  // An attachment that FAILED validation is shown, not rendered as a control.
  // Dropping it silently would make a note containing a hostile token look
  // identical to a clean one — which is exactly what you do not want.
  if (!a.valid) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--error-muted)] px-1.5 py-0.5 align-middle text-[11px] text-zinc-400 line-through"
        title={`Refused: ${a.reason}`}
      >
        <AlertTriangle className="w-3 h-3 text-[color:var(--error)]" aria-hidden />
        {label}
      </span>
    );
  }

  if (att.kind === 'image') return <InlineImage path={att.value} label={label} />;

  const Icon = KIND_ICON[att.kind] ?? Link2;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(att.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard can be denied; the chip still works */ }
  };

  return (
    <span className="inline-flex items-stretch align-middle my-0.5">
      <button
        type="button"
        onClick={() => onInspect?.({ kind: att.kind, value: att.value, label } as InspectTarget)}
        className={cn(
          'inline-flex items-center gap-1 rounded-l-lg border border-r-0 border-zinc-700 px-1.5 py-0.5 align-middle text-[12px] transition-colors',
          'hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--page-accent)]',
          'light:border-zinc-300 light:hover:bg-zinc-100',
        )}
        title={att.value}
      >
        <Icon className="w-3 h-3 shrink-0 text-[color:var(--page-accent)]" aria-hidden />
        <span className="max-w-[22ch] truncate">{label}</span>
      </button>
      {/* Copy is a SECOND, explicit affordance — the primary action stays open.
          Clicking copy must never also trigger the chip, hence stopPropagation. */}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        title="Copy"
        className="inline-flex items-center rounded-r-lg border border-zinc-700 px-1 align-middle text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--page-accent)] light:border-zinc-300"
      >
        {copied ? <Check className="w-3 h-3" aria-hidden /> : <Copy className="w-3 h-3" aria-hidden />}
      </button>
    </span>
  );
}

function renderInline(line: string, onInspect?: (t: InspectTarget) => void): React.ReactNode {
  return inlineParts(line).map((p, i) => {
    switch (p.type) {
      case 'bold':
        return <strong key={i} className="font-semibold text-zinc-100 light:text-zinc-900">{p.value}</strong>;
      case 'attachment':
        return <AttachmentChip key={i} a={p} onInspect={onInspect} />;
      case 'link':
        return (
          <a
            key={i}
            href={p.url}
            onClick={(e) => {
              // The DEFAULT behaviour is the system browser, opened by the main
              // process — which is what makes a link in a note behave like a link
              // everywhere else on the desktop. preventDefault stops the Electron
              // window navigating out from under the reader.
              e.preventDefault();
              (window as any).deskflowAPI?.openUrlInBrowser?.(p.url);
            }}
            className="inline-flex items-baseline gap-0.5 text-sky-600 hover:underline dark:text-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="break-all">{p.label}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 translate-y-px" aria-hidden />
          </a>
        );
      default:
        return <span key={i}>{p.value}</span>;
    }
  });
}

export function NoteContent({ content, onInspect, className }: {
  content: string
  onInspect?: (t: InspectTarget) => void
  className?: string
}) {
  const lines = String(content ?? '').split('\n');

  return (
    <div className={cn('space-y-0.5', className)}>
      {lines.map((line, i) => {
        const t = line.trim();

        if (t.startsWith('- [x] ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-zinc-400 light:text-zinc-600">
              <span className="mt-0.5 text-emerald-500 shrink-0" aria-hidden>✓</span>
              <span className="line-through">{renderInline(t.replace('- [x] ', ''), onInspect)}</span>
            </div>
          );
        }
        if (t.startsWith('- [ ] ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-zinc-300 light:text-zinc-800">
              <span className="mt-0.5 w-3.5 h-3.5 rounded border border-zinc-600 shrink-0" aria-hidden />
              <span>{renderInline(t.replace('- [ ] ', ''), onInspect)}</span>
            </div>
          );
        }
        if (t.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-zinc-300 light:text-zinc-800">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" aria-hidden />
              <span>{renderInline(t.replace('- ', ''), onInspect)}</span>
            </div>
          );
        }
        if (t.startsWith('## ')) {
          return <h2 key={i} className="text-sm font-semibold text-zinc-100 light:text-zinc-900 mt-3 mb-1.5">{renderInline(t.replace('## ', ''), onInspect)}</h2>;
        }
        if (t.startsWith('# ')) {
          return <h1 key={i} className="text-base font-bold text-zinc-100 light:text-zinc-900 mt-3 mb-1.5">{renderInline(t.replace('# ', ''), onInspect)}</h1>;
        }
        if (t === '') return <div key={i} className="h-1.5" />;

        return <div key={i} className="text-sm text-zinc-300 light:text-zinc-800">{renderInline(t, onInspect)}</div>;
      })}
    </div>
  );
}

export type { Attachment };
