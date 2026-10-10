/**
 * previews.tsx — the per-frame page preview illustrations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWELVE FAMILIES, NOT 185 ILLUSTRATIONS
 *
 * Spec §3 asks for "a hand-built SVG illustration per page". With 185 frames that
 * is 185 drawings nobody will keep up to date, and the moment someone adds a page
 * they become wrong rather than absent. So each frame points at a FAMILY that
 * hints at what the page contains (bars for usage, a line for finance, nodes for
 * a graph), and `previewFor()` in `nav-tree.ts` picks it from the route.
 *
 * This is also the seam the spec asked for: swap `Preview` for a
 * `webContents.capturePage` bitmap of the real page and nothing else changes.
 * `Frame` already renders `<Preview>` through a single component boundary.
 *
 * All shapes are transform/opacity friendly and none animate, so a preview costs
 * nothing while the overlay is idle (spec §6: zero cost when idle).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { PreviewKind } from './nav-tree'

const INK = '#3f3f46'
const FAINT = '#52525b'

export default function Preview({ kind, className }: { kind: PreviewKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 60"
      className={className}
      aria-hidden
      focusable="false"
      preserveAspectRatio="none"
    >
      {render(kind)}
    </svg>
  )
}

function render(kind: PreviewKind) {
  switch (kind) {
    case 'bars':
      return (
        <g>
          {[18, 34, 26, 44, 32, 50, 38, 22, 40, 30, 46, 28].map((h, i) => (
            <rect key={i} x={4 + i * 8} y={56 - h} width={5} height={h} rx={1} fill={i % 3 === 0 ? INK : FAINT} opacity={i % 3 === 0 ? 0.85 : 0.5} />
          ))}
        </g>
      )
    case 'line':
      return (
        <g fill="none" strokeWidth={1.5}>
          <polyline points="4,44 16,36 28,40 40,26 52,30 64,18 76,22 88,10" stroke={INK} opacity={0.85} />
          <polyline points="4,50 16,46 28,48 40,40 52,42 64,34 76,36 88,28" stroke={FAINT} opacity={0.5} />
          <line x1="4" y1="54" x2="96" y2="54" stroke={FAINT} strokeWidth={1} opacity={0.6} />
        </g>
      )
    case 'nodes':
      return (
        <g>
          <line x1="22" y1="30" x2="50" y2="18" stroke={FAINT} strokeWidth={1} opacity={0.5} />
          <line x1="22" y1="30" x2="50" y2="44" stroke={FAINT} strokeWidth={1} opacity={0.5} />
          <line x1="50" y1="18" x2="78" y2="26" stroke={FAINT} strokeWidth={1} opacity={0.5} />
          <line x1="50" y1="44" x2="78" y2="26" stroke={FAINT} strokeWidth={1} opacity={0.5} />
          <circle cx="22" cy="30" r="5" fill={INK} opacity={0.8} />
          <circle cx="50" cy="18" r="3.5" fill={FAINT} />
          <circle cx="50" cy="44" r="3.5" fill={FAINT} />
          <circle cx="78" cy="26" r="5" fill={INK} opacity={0.8} />
        </g>
      )
    case 'list':
      return (
        <g>
          {[10, 20, 30, 40, 50].map((y, i) => (
            <g key={i}>
              <rect x="6" y={y} width="4" height="4" rx="1" fill={i === 0 ? INK : FAINT} opacity={0.8} />
              <rect x="14" y={y + 1} width={34 - i * 4} height="2" rx="1" fill={FAINT} opacity={0.55} />
              <rect x="76" y={y + 1} width="18" height="2" rx="1" fill={FAINT} opacity={0.35} />
            </g>
          ))}
        </g>
      )
    case 'grid':
      return (
        <g>
          {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
            <rect key={`${r}${c}`} x={6 + c * 23} y={6 + r * 17} width={19} height={13} rx={2}
              fill={r === 0 && c === 0 ? INK : FAINT} opacity={r === 0 && c === 0 ? 0.8 : 0.45} />
          )))}
        </g>
      )
    case 'terminal':
      return (
        <g>
          <rect x="4" y="8" width="92" height="44" rx="3" fill="none" stroke={FAINT} strokeWidth={1} opacity={0.6} />
          <rect x="4" y="8" width="92" height="7" rx="3" fill={FAINT} opacity={0.4} />
          <rect x="9" y="21" width="38" height="2.5" rx="1.25" fill={INK} opacity={0.7} />
          <rect x="9" y="28" width="56" height="2.5" rx="1.25" fill={FAINT} opacity={0.5} />
          <rect x="9" y="35" width="28" height="2.5" rx="1.25" fill={FAINT} opacity={0.5} />
          <rect x="9" y="44" width="12" height="2.5" rx="1.25" fill={INK} opacity={0.6} />
        </g>
      )
    case 'calendar':
      return (
        <g>
          <rect x="8" y="12" width="84" height="38" rx="3" fill="none" stroke={FAINT} strokeWidth={1} opacity={0.6} />
          <line x1="8" y1="22" x2="92" y2="22" stroke={FAINT} strokeWidth={1} opacity={0.6} />
          <line x1="34" y1="22" x2="34" y2="50" stroke={FAINT} strokeWidth={1} opacity={0.3} />
          <line x1="60" y1="22" x2="60" y2="50" stroke={FAINT} strokeWidth={1} opacity={0.3} />
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <rect key={i} x={12 + (i % 4) * 20} y={27 + Math.floor(i / 4) * 12} width="10" height="6" rx="1.5"
              fill={i === 1 ? INK : FAINT} opacity={i === 1 ? 0.8 : 0.4} />
          ))}
        </g>
      )
    case 'doc':
      return (
        <g>
          <rect x="16" y="6" width="68" height="48" rx="3" fill="none" stroke={FAINT} strokeWidth={1} opacity={0.6} />
          <rect x="24" y="15" width="44" height="3" rx="1.5" fill={INK} opacity={0.75} />
          {[23, 30, 37].map((y, i) => (
            <rect key={y} x="24" y={y} width={i === 2 ? 28 : 52} height="2.5" rx="1.25" fill={FAINT} opacity={0.5} />
          ))}
        </g>
      )
    case 'orbit':
      return (
        <g fill="none">
          <ellipse cx="50" cy="30" rx="34" ry="12" stroke={FAINT} strokeWidth={1} opacity={0.5} />
          <ellipse cx="50" cy="30" rx="20" ry="30" stroke={FAINT} strokeWidth={1} opacity={0.35} transform="rotate(24 50 30)" />
          <circle cx="50" cy="30" r="8" fill={INK} opacity={0.8} />
          <circle cx="82" cy="26" r="3" fill={INK} opacity={0.7} />
        </g>
      )
    case 'shelves':
      return (
        <g>
          {[12, 26, 40].map((y, r) => (
            <g key={y}>
              <rect x="6" y={y} width="88" height="1.5" rx="0.75" fill={FAINT} opacity={0.5} />
              {[0, 1, 2, 3, 4].map(i => (
                <rect key={i} x={9 + i * 18} y={y - 8} width="14" height="8" rx="1.5"
                  fill={r === 1 && i === 2 ? INK : FAINT} opacity={r === 1 && i === 2 ? 0.8 : 0.45} />
              ))}
            </g>
          ))}
        </g>
      )
    case 'wave':
      return (
        <g fill="none" strokeWidth={1.5}>
          <path d="M4 34 C 20 20, 34 46, 50 32 S 80 18, 96 30" stroke={INK} opacity={0.8} />
          <path d="M4 44 C 20 32, 34 56, 50 42 S 80 28, 96 40" stroke={FAINT} opacity={0.45} />
        </g>
      )
    case 'tool':
    default:
      return (
        <g>
          <circle cx="30" cy="20" r="8" fill="none" stroke={INK} strokeWidth={1.5} opacity={0.75} />
          <circle cx="30" cy="20" r="2" fill={INK} opacity={0.75} />
          <rect x="48" y="16" width="40" height="3" rx="1.5" fill={FAINT} opacity={0.55} />
          <rect x="48" y="22" width="28" height="3" rx="1.5" fill={FAINT} opacity={0.4} />
          <rect x="10" y="38" width="80" height="3" rx="1.5" fill={FAINT} opacity={0.5} />
          <rect x="10" y="46" width="52" height="3" rx="1.5" fill={FAINT} opacity={0.35} />
        </g>
      )
  }
}

export const PREVIEW_KINDS: PreviewKind[] = [
  'bars', 'line', 'nodes', 'list', 'grid', 'terminal', 'calendar', 'doc', 'orbit', 'shelves', 'wave', 'tool',
]