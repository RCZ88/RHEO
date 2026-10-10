/**
 * THE LEGACY EXPANDED RAIL — the previous top rail, kept intact behind `uiVersion: 'legacy'`.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * The Figma redesign (board `2 / Pages`) replaced a top rail with a bottom one and two tabs with
 * four pages. Deleting the old rail outright was wrong twice over:
 *
 *   1. It removed the user's only escape hatch. A new, unverified layout with no revert is a
 *      rollout risk, and `uiVersion` is now the fix: both ship, one click switches.
 *   2. It ORPHANED THE PIN. `halo:set-pinned`, `togglePin` and the main-process handler were all
 *      still wired — only the button that called `togglePin` was deleted. A control whose IPC
 *      survives but whose UI does not is invisible breakage: nothing errors, the feature is just
 *      gone. That is why the pin is rendered in BOTH layouts.
 *
 * The rail is unchanged from what shipped before, so switching to 'legacy' restores the previous
 * behaviour exactly rather than approximating it.
 */
import type { ReactNode } from 'react';

export interface LegacyRailProps {
  /** the two legacy tabs */
  tab: 'focus' | 'tools';
  onSelect: (tab: 'focus' | 'tools') => void;
  /** the pin — rendered in BOTH layouts because it is not a layout concern */
  pinned: boolean;
  onTogglePin: () => void;
  showPin: boolean;
  focusIcon: ReactNode;
  toolsIcon: ReactNode;
  pinIcon: ReactNode;
}

export function LegacyHaloRail({
  tab,
  onSelect,
  pinned,
  onTogglePin,
  showPin,
  focusIcon,
  toolsIcon,
  pinIcon,
}: LegacyRailProps) {
  return (
    <div className="halo-rail" style={{ marginBottom: 'var(--halo-gap-block)' }}>
      <LegacyRailButton
        active={tab === 'focus'}
        label="Tracked time"
        onClick={() => onSelect('focus')}
        icon={focusIcon}
      />
      <LegacyRailButton
        active={tab === 'tools'}
        label="Dictation"
        onClick={() => onSelect('tools')}
        icon={toolsIcon}
      />
      {/* THE PIN. Restored here after being orphaned by the redesign, and it also renders in
          the Figma layout — pinning is behaviour, not styling, so it must not depend on which
          layout the user picked. */}
      {showPin && (
        <LegacyRailButton
          active={pinned}
          label={pinned ? 'Unpin' : 'Pin open'}
          onClick={onTogglePin}
          icon={pinIcon}
        />
      )}
      <span className="halo-t-micro halo-rail-trailing" style={{ color: 'var(--halo-dim)' }}>
        {pinned ? 'pinned · esc' : 'esc'}
      </span>
    </div>
  );
}

function LegacyRailButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="halo-rail-button"
      data-active={active ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingInline: 10,
        borderRadius: 8,
        cursor: 'pointer',
        background: active ? 'var(--halo-bg-raised)' : 'transparent',
        color: active ? 'var(--halo-text)' : 'var(--halo-muted)',
        fontWeight: active ? 500 : 400,
        border: 'none',
        fontSize: 'var(--halo-t-label)',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}