/**
 * HALO TAB RAIL — the page switcher, measured off Figma board `2 / Pages`.
 *
 * From the frames, not from prose:
 *   • It sits at the BOTTOM of the expanded panel, on its own raised row.
 *   • It is INSET from the panel edges — it does not span the full width.
 *   • Row height 44px, `bg/raised`, radius 8.
 *   • Selected tab = `bg/raised` + primary text at weight 500.
 *   • Unselected = `text/muted`.
 *   • Small preset shows ICONS ONLY (no label). Medium and Large show icon + label.
 *   • Focus-visible is a 2px ring in the signal hue (board `4 / States`).
 *   • Never colour alone — selected is paired with weight, and focus is a ring.
 *
 * Why a component and not markup inline in OverlayRoot: the rail has five interaction states
 * and a keyboard contract. Inline markup made it impossible to keep the 44px target and the
 * focus ring honest in one place, and board `4` exists precisely because those states drift.
 */
import type { CSSProperties, KeyboardEvent } from 'react';
import {
  AlarmClock,
  BriefcaseBusiness,
  CalendarClock,
  Mic,
  type LucideIcon,
} from 'lucide-react';

export type HaloPage = 'focus' | 'now' | 'deadlines' | 'tools';

export const HALO_PAGES: HaloPage[] = ['focus', 'now', 'deadlines', 'tools'];

interface PageMeta {
  label: string;
  icon: LucideIcon;
}

const PAGE_META: Record<HaloPage, PageMeta> = {
  focus: { label: 'Focus', icon: AlarmClock },
  now: { label: 'Now', icon: BriefcaseBusiness },
  deadlines: { label: 'Deadlines', icon: CalendarClock },
  tools: { label: 'Tools', icon: Mic },
};

export interface HaloTabRailProps {
  active: HaloPage;
  onSelect: (page: HaloPage) => void;
  /** Small hides labels (Figma §4: "Tabs: icon only"). */
  iconOnly: boolean;
  /** inset by the panel padding so the rail does not touch the panel edge */
  inset: number;
  disabled?: boolean;
  /**
   * The user's page sequence and hidden set (`prefs.pages`). Both default to the full handoff
   * §5 order so an install that never touched the settings renders exactly as before.
   */
  order?: readonly HaloPage[];
  hidden?: readonly HaloPage[];
}

/** The pages that actually get a tab, in the user's order. */
export function visiblePages(
  order?: readonly HaloPage[],
  hidden?: readonly HaloPage[],
): HaloPage[] {
  const seq = order && order.length ? order : HALO_PAGES;
  const out = seq.filter((p) => !hidden?.includes(p));
  /* Never render an empty rail. `normalizeHaloPages` already refuses to hide every page, so
   * this is belt-and-braces for a caller that passes prefs straight through. */
  return out.length ? out : HALO_PAGES;
}

/**
 * Ctrl+Left / Ctrl+Right switches pages (handoff §5).
 *
 * WHY THE HANDLER LIVES HERE AND NOT IN OverlayRoot: the rail owns the page ORDER, so it must
 * own the wrap-around too. A parent that also handled the key would need its own copy of the
 * order, and the two would drift the first time a page was added or hidden.
 */
export function nextPage(current: HaloPage, delta: number): HaloPage {
  return nextVisiblePage(current, delta, HALO_PAGES);
}

/**
 * `nextPage` over a SUBSET — the user's visible pages. Ctrl+arrows and the wheel must skip a
 * hidden page instead of selecting it and rendering nothing, which is what would happen if they
 * walked the full four.
 */
export function nextVisiblePage(
  current: HaloPage,
  delta: number,
  seq: readonly HaloPage[],
): HaloPage {
  if (!seq.length) return HALO_PAGES[0];
  const i = seq.indexOf(current);
  if (i < 0) return seq[0];
  const n = seq.length;
  return seq[(((i + delta) % n) + n) % n];
}

export function HaloTabRail({
active,
    onSelect,
    iconOnly,
    inset,
    disabled,
    order,
    hidden,
  }: HaloTabRailProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // ctrlKey, not altKey/metaKey: the handoff says Ctrl+Left / Ctrl+Right, and the island
    // never takes keyboard focus, so in practice this fires from the renderer fallback only.
    if (!e.ctrlKey) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSelect(nextPage(active, 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSelect(nextPage(active, -1));
    }
  };

  return (
    <div
      data-halo-tab-rail="true"
      role="tablist"
      aria-label="Halo pages"
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        /* MEASURED from the Figma node tree:
         *   - tabs [FRAME] 534x44 r=8 fill=#18181b   (Medium)
         *   - tabs [FRAME] 646x44 r=8 fill=#18181b   (Large)
         *   - tabs [FRAME] 462x44 r=8 fill=#18181b   (Small)
         * So: 44 tall, radius 8, filled #18181b. There is NO border stroke on the rail in the
         * file — the rail reads as a recessed track, not an outlined box. */
        gap: 4,
        /* INSET, not full-bleed — the frame is 560 wide and the rail 534, so 13px per side. */
        marginInline: inset,
        height: 44,
        /* NO PADDING. The rail is 44 tall and every tab must be a 44x44 touch target; `padding: 4`
         * shrank the buttons to 36, which is why they felt small and hard to hit. The rail is
         * full-bleed inside its own 44px box. */
        padding: 0,
        borderRadius: 'var(--halo-radius-rail)',
        background: 'var(--halo-raised)',
      }}
    >
      {visiblePages(order, hidden).map((page) => {
        const { label, icon: Icon } = PAGE_META[page];
        const isActive = page === active;
        return (
          <button
            key={page}
            type="button"
            role="tab"
            aria-selected={isActive}
            /* DISABLED uses muted colour + is never hidden, and no `opacity` on the text
             * (handoff §9: "Never use opacity on text"). */
            disabled={disabled}
            title={label}
            onClick={() => !disabled && onSelect(page)}
            /* The interactive states live in halo.css as `.halo-tab`, because inline styles
             * cannot express hover, :active or :focus-visible and PAINT Gate D requires all
             * four on every interactive element. */
            className={iconOnly ? 'halo-tab halo-tab--icon-only' : 'halo-tab'}
            data-active={isActive ? 'true' : 'false'}
          >
            <Icon size={14} aria-hidden="true" />
            {!iconOnly && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}