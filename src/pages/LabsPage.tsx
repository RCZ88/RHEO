import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Clapperboard,
  FileText,
  Presentation,
  Cpu,
  AppWindow,
  ArrowLeftRight,
  ArrowRight,
  Gauge,
  Timer,
} from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { LABS, type Lab, type LabAiPath } from '@/components/labs/labRegistry';
import { cn } from '@/lib/utils';

console.log(
  '%c[LabsPage] v1.0 loaded',
  'color: #fbbf24; font-weight: bold',
);
console.log('[LabsPage] registry:', LABS.map((l) => `${l.id} ${l.name}`));

/**
 * The plate's only differentiator between labs. Per LAMINAR §7.2 a surface gets
 * ONE signal hue, so labs are NOT distinguished by colour — they are separated
 * by their mono specimen ID and their round trip. Every lab therefore gets the
 * same chrome, and `--page-accent` is reserved for interaction feedback only
 * (hover, focus ring, the Open affordance). That is why a three-hue registry can
 * live here without becoming a rainbow.
 */

/** Short mono tag. The long form in the registry is the accessible name. */
const AI_PATH_TAG: Record<LabAiPath, string> = {
  'on-device': 'On-device',
  'in-app': 'In-app',
  hybrid: 'Hybrid',
};

const AI_PATH_ICON: Record<LabAiPath, React.ComponentType<{ className?: string }>> = {
  'on-device': Cpu,
  'in-app': AppWindow,
  hybrid: ArrowLeftRight,
};

const LAB_ICON: Record<Lab['icon'], React.ComponentType<{ className?: string }>> = {
  clapperboard: Clapperboard,
  'file-text': FileText,
  presentation: Presentation,
  gauge: Gauge,
  timer: Timer,
};

/**
 * The round trip, rendered as three labelled legs in a fixed-width mono label
 * column. The label column is `w-16 shrink-0` so the three rows form a single
 * readable axis — this is the signature mechanic of the page and the reason the
 * three labs read as one family.
 */
function RoundTrip({ lab }: { lab: Lab }) {
  const legs = [
    { tag: 'IN', value: lab.roundTrip.input },
    { tag: 'FORGE', value: lab.roundTrip.forge },
    { tag: 'OUT', value: lab.roundTrip.output },
  ];

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]">
      {legs.map((leg, i) => (
        <div
          key={leg.tag}
          className={cn(
            'flex items-start gap-3 px-3 py-2',
            i > 0 && 'border-t border-[var(--border-default)]',
          )}
        >
          <span className="w-12 shrink-0 pt-px text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {leg.tag}
          </span>
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--text-primary)]">
            {leg.value}
          </span>
        </div>
      ))}
    </div>
  );
}


/**
 * The card's entry affordance, dressed per lab.entry — the feature's own
 * accent hue and verb, so the hub reads as a family of plates rather than
 * three identical white links. Always rendered as a <span> inside the
 * whole-card <Link>: never nest a real <button> in a link.
 */
function EntryAffordance({ lab }: { lab: Lab }) {
  const { style, label = 'Open', accent } = lab.entry;
  const arrow = (
    <ArrowRight
      className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  );

  if (style === 'solid') {
    return (
      <span
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-zinc-950 transition-transform duration-150 group-active:scale-95"
        style={{ backgroundColor: accent }}
      >
        {label}
        {arrow}
      </span>
    );
  }
  if (style === 'outline') {
    return (
      <span
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors duration-150 group-hover:bg-[color-mix(in_srgb,var(--entry-accent)_12%,transparent)]"
        style={{ borderColor: accent, color: accent, ['--entry-accent' as string]: accent }}
      >
        {label}
        {arrow}
      </span>
    );
  }
  if (style === 'mono') {
    return (
      <span
        className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
        style={{ color: accent }}
      >
        {label}
        {arrow}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors duration-150 group-hover:text-[var(--page-accent)]">
      {label}
      {arrow}
    </span>
  );
}

/**
 * One lab, drawn as a specimen plate. The whole plate is the click target, so
 * it is a single <Link> with no nested interactives — a 44px-plus target that
 * is reachable and activatable from the keyboard for free.
 */
function LabPlate({ lab }: { lab: Lab }) {
  const Icon = LAB_ICON[lab.icon];
  const PathIcon = AI_PATH_ICON[lab.aiPath];

  return (
    <Link
      to={lab.route}
      aria-label={`${lab.name} — ${lab.makes}. AI runs ${lab.aiPathLabel.toLowerCase()}.`}
      className={cn(
        'lab-plate group flex flex-col gap-3 rounded-xl p-4',
        'border border-[var(--border-default)] bg-[var(--bg-elevated)]',
        'transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'hover:border-[var(--page-accent)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-surface)]',
        'active:scale-[0.98]',
      )}
    >
      {/* Plate header — specimen ID and AI path. Not colour-coded: the icon and
          the word carry the meaning, so this survives a monochrome viewport. */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--text-muted)]">
          {lab.id}
        </span>
        <span
          title={lab.aiPathLabel}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
        >
          <PathIcon className="h-3 w-3" aria-hidden="true" />
          <span className="font-mono uppercase tracking-[0.1em]">
            {AI_PATH_TAG[lab.aiPath]}
          </span>
        </span>
      </div>

      {/* Identity */}
      <div className="flex items-start gap-2.5">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-colors duration-150 group-hover:text-[var(--page-accent)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-tight text-[var(--text-primary)] transition-colors duration-150 group-hover:text-[var(--page-accent)]">
            {lab.name}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
            {lab.makes}
          </p>
          {lab.brand && lab.brand !== lab.name && (
            <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
              ships as “{lab.brand}”
            </p>
          )}
        </div>
      </div>

      <RoundTrip lab={lab} />

      {/* Footer — structural facts and the entry affordance. */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-3">
        <ul className="flex min-w-0 flex-col gap-1">
          {lab.facts.slice(0, 2).map((fact) => (
            <li
              key={fact}
              className="truncate font-mono text-[10px] text-[var(--text-muted)]"
            >
              {fact}
            </li>
          ))}
        </ul>
        <EntryAffordance lab={lab} />
      </div>
    </Link>
  );
}

export default function LabsPage() {
  return (
    <PageShell page="labs" variant="default" className="p-6 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Labs · {LABS.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Build surfaces
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Three surfaces that were built outside the app&rsquo;s design system and
          now live together on purpose. Each one runs the same round trip: you
          put in something rough, it builds a prompt, an AI answers, and an
          artifact comes out. They are collected here rather than spread across
          the sidebar so they can be found and, over time, brought back into line.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LABS.map((lab) => (
          <LabPlate key={lab.id} lab={lab} />
        ))}
      </div>


      <footer className="border-t border-[var(--border-default)] pt-4">
        <p className="max-w-2xl text-[12px] leading-relaxed text-[var(--text-muted)]">
          Every count on this page is read from the lab&rsquo;s own source at
          build time, so it cannot drift the way a typed-in number does. Adding
          a lab means adding one entry to the registry — the stage, tool and
          phase totals follow automatically.
        </p>
      </footer>
    </PageShell>
  );
}