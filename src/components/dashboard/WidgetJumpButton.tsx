import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { navigateTo } from '@/lib/deepNav';
import { WIDGET_NAV, type WidgetNavTarget } from './widgetNav';

export interface WidgetJumpButtonProps {
  /** Key into WIDGET_NAV. Used for the data attribute + as the default target. */
  widgetId: string;
  /** Optional explicit target — overrides the WIDGET_NAV lookup. */
  target?: WidgetNavTarget;
  /** Visible text. Defaults to the target's `short` label. */
  children?: string;
  className?: string;
  /** Bare icon, no text pill — for tight card headers. */
  iconOnly?: boolean;
}

/**
 * THE button. Every dashboard widget has one.
 *
 * Clicking it navigates to that widget's origin page and then scrolls to the
 * feature's own section on that page.
 *
 * Rules baked in (Human-Centric UX — clarity, feedback, forgiveness):
 *  - ALWAYS visible. Never `opacity-0 group-hover:opacity-100`. The existence
 *    of a destination must not require hovering to discover.
 *  - A real <button>, so it is keyboard-reachable and announced to screen
 *    readers. Not a div with onClick, not a bare icon with a title attribute.
 *  - stopPropagation: the parent card row owns a click handler (bringToFront)
 *    and would otherwise swallow the navigation intent.
 *  - Renders null when there is no destination, rather than a dead control
 *    that does nothing when clicked.
 */
export function WidgetJumpButton({
  widgetId,
  target,
  children,
  className = '',
  iconOnly = false,
}: WidgetJumpButtonProps) {
  const navigate = useNavigate();

  const dest = target ?? (WIDGET_NAV as Record<string, WidgetNavTarget | undefined>)[widgetId];
  if (!dest?.route) return null;

  const label = dest.label;
  const text = children ?? dest.short;

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigateTo(
        { route: dest.route, section: dest.section, tab: dest.tab },
        navigate,
      );
    },
    [navigate, dest],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      data-widget-jump={widgetId}
      aria-label={`Open ${label}`}
      title={`Open ${label}`}
      className={[
        'group/jump inline-flex items-center gap-1 shrink-0 rounded-lg',
        'border border-[var(--ws-border)] bg-[var(--bg-elevated)]',
        'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        'hover:border-[var(--page-accent)]/40 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60',
        iconOnly ? 'h-6 w-6 justify-center' : 'h-6 px-2 text-[11px] font-medium',
        className,
      ].join(' ')}
    >
      {text ? <span className="truncate max-w-[9rem]">{text}</span> : null}
      <ArrowUpRight
        size={12}
        strokeWidth={2}
        className="shrink-0 transition-transform duration-150 group-hover/jump:-translate-y-px group-hover/jump:translate-x-px"
      />
    </button>
  );
}

export default WidgetJumpButton;
