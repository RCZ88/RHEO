// ============================================================
// RHEO Dashboard — WidgetCard (Proper shadcn-based card)
// Uses: shadcn Card, CardHeader, CardTitle, CardContent, Skeleton
// LAMINAR: design.md wins over all skill defaults
// ============================================================

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, EyeOff, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';

const MotionBtn = motion(Button);

// ── shadcn-style Card primitives (re-skin to RHEO tokens) ──
const Card = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
      className={`rounded-lg bg-[var(--color-card)] text-[var(--text-primary)] ${className}`}
      {...props}
    >
    {children}
  </div>
);

const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 p-5 pb-0 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center gap-2.5 text-[13px] font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </div>
);

const CardDescription = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-[12px] text-[var(--text-muted)] ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pt-3 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center p-5 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

// ── Widget Card Props ──
export interface WidgetCardProps {
  widgetId: string;
  title: string;
  icon: any;
  accent?: string;
  /** Eyebrow label above the title (e.g. "TODAY", "SCHEDULE") */
  kicker?: string;
  description?: string;
  collapsible?: boolean;
  removable?: boolean;
  draggable?: boolean;
  hidden?: boolean;
  onToggleVisibility?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** Primary call-to-action rendered inside the empty state. An empty widget
   *  with no way to create its first item is a dead end — every card that owns
   *  an "add" flow must pass this. */
  emptyAction?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Reusable widget card with all 4 states per Human-Centric UX.
 * LAMINAR compliant: no backdrop-blur, no box-shadow, token-only colors.
 */
export function WidgetCard({
  widgetId,
  title,
  icon: Icon,
  accent = 'var(--page-accent)',
  kicker,
  description,
  collapsible = false,
  removable = false,
  draggable = false,
  hidden = false,
  onToggleVisibility,
  onRemove,
  children,
  loading = false,
  error = false,
  errorMessage = 'Failed to load widget data',
  empty = false,
  emptyMessage = 'No data available',
  emptyIcon,
  emptyAction,
  footer,
  className = '',
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // ── Loading State ──
  if (loading) {
    return (
      <Card className={`h-full ${className}`} data-widget-id={widgetId} data-state="loading">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-4 rounded light:bg-stone-200/70" />
            <Skeleton className="h-4 w-24 light:bg-stone-200/70" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full light:bg-stone-200/70" />
            <Skeleton className="h-10 w-full light:bg-stone-200/70" />
            <Skeleton className="h-10 w-3/4 light:bg-stone-200/70" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <Card className={`h-full border-[var(--error)]/20 ${className}`} data-widget-id={widgetId} data-state="error">
        <CardContent>
          <div className="flex items-center gap-2 text-[var(--error)] text-[13px]">
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty State ──
  if (empty) {
    return (
      <Card className={`h-full ${className}`} data-widget-id={widgetId} data-state="empty">
        <CardHeader>
          <CardTitle>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Icon size={14} strokeWidth={2} />
            </div>
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {emptyIcon ? (
              <div className="text-[var(--text-muted)] mb-3">{emptyIcon}</div>
            ) : (
              <div className="text-[var(--text-muted)] mb-3">
                <Icon size={24} className="opacity-30" />
              </div>
            )}
            <p className="text-[13px] text-[var(--text-secondary)]">{emptyMessage}</p>
            {emptyAction ? (
              <div className="mt-4">{emptyAction}</div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Data will appear here when available</p>
            )}
          </div>
        </CardContent>
        {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
      </Card>
    );
  }

  // ── Populated State ──
  return (
    <motion.div
      layout
      layoutId={widgetId}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`h-full ${className}`}
      data-widget-id={widgetId}
      data-state="populated"
    >
      <Card className="h-full flex flex-col border-t border-[var(--ws-border)]">

        <CardHeader className="pb-2">
          {kicker && !collapsed && (
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {kicker}
            </div>
          )}
          <CardTitle className="flex-1">
            {draggable && (
              <div className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                <GripVertical size={14} />
              </div>
            )}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Icon size={14} strokeWidth={2} />
            </div>
            <span className="flex-1">{title}</span>

            {/* Edit mode controls */}
            <AnimatePresence>
              {hidden && (
                <MotionBtn
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onToggleVisibility}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label="Show widget"
                >
                  <EyeOff size={14} />
                </MotionBtn>
              )}
            </AnimatePresence>
            {collapsible && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? '▶' : '▼'}
              </button>
            )}
            {removable && (
              <button
                onClick={onRemove}
                className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                aria-label="Remove widget"
              >
                <X size={14} />
              </button>
            )}
          </CardTitle>
          {description && !collapsed && <CardDescription>{description}</CardDescription>}
        </CardHeader>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 1, 1] }}
              className="flex-1 flex flex-col"
            >
              <CardContent className="flex-1 pt-0">
                {children}
              </CardContent>
              {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
