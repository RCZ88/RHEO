// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE B: "TERMINAL CHIC"
// Flat gunmetal panels. All mono. Tight spacing. Terminal aesthetic.
// Category signal = border color, not top-edge bar.
// ============================================================

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { GripVertical, X, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { HIT, tBase, FOCUS_B } from './protoColor';

const MotionBtn = motion(Button);

// ── Card primitives (TERMINAL CHIC: flat, 8px, no shadows) ──
// The accent is set as a local --page-accent so children can reference it with
// static classes. It is never interpolated into a className (bug 3/6).
const Card = ({ className = '', children, accent, ...props }: React.HTMLAttributes<HTMLDivElement> & { accent?: string }) => (
  <div
    style={{ '--page-accent': accent } as React.CSSProperties}
    className={`group relative rounded-lg bg-[var(--dk-bg-base)] text-[var(--dk-text-primary)] font-mono
      border border-[color-mix(in_srgb,var(--page-accent)_28%,transparent)]
      hover:border-[color-mix(in_srgb,var(--page-accent)_55%,transparent)]
      transition-colors duration-100 motion-reduce:transition-none leading-[1.6] ${className}`}
    {...props}
  >
    {children}
  </div>
);

const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`relative flex flex-col gap-0.5 px-3 pt-2.5 pb-2 border-b border-dashed border-[var(--dk-border-subtle)] ${className}`} {...props}>
    {children}
  </div>
);

// Terminal label: 11px uppercase mono in the category accent (was muted zinc)
const TerminalLabel = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-[11px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--page-accent)] ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-3 py-3 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center px-3 py-2 border-t border-dashed border-[var(--dk-border-subtle)] ${className}`} {...props}>
    {children}
  </div>
);

// ── Widget Card Props ──
export interface WidgetCardProps {
  widgetId: string;
  title: string;           // Used as terminal label (uppercase mono)
  icon: any;
  accent?: string;         // border color when active/hover
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
  footer?: ReactNode;
  className?: string;
}

/**
 * TERMINAL CHIC prototype: flat gunmetal panel.
 * All numbers in mono (JetBrains Mono). Labels in 11px uppercase mono.
 * Category signal = border color. No top-edge bars.
 */
export function WidgetCardB({
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
  footer,
  className = '',
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const reduce = useReducedMotion();
  const danger = 'var(--dk-danger)';

  // ── Loading ──
  if (loading) {
    return (
      <Card accent={accent} className={`h-full relative ${className}`} data-widget-id={widgetId} data-state="loading">
        <CardHeader>
          <TerminalLabel>
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20 ml-2" />
          </TerminalLabel>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-2/3 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error (spec §6: dashed danger border, danger accent) ──
  if (error) {
    return (
      <Card
        accent={danger}
        className={`h-full relative border-[color-mix(in_srgb,var(--dk-danger)_35%,transparent)] ${className}`}
        data-widget-id={widgetId}
        data-state="error"
      >
        <CardContent>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: danger }}>
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty (spec §6: dashed inner box) ──
  if (empty) {
    return (
      <Card accent={accent} className={`h-full relative ${className}`} data-widget-id={widgetId} data-state="empty">
        <CardHeader>
          <TerminalLabel>{title}</TerminalLabel>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-full gap-2 rounded-lg border border-dashed border-[var(--dk-border-default)] p-4">
            {emptyIcon && <div className="text-[var(--dk-text-muted)] opacity-70">{emptyIcon}</div>}
            <span className="text-[13px] text-[var(--dk-text-secondary)]">
              {emptyMessage}
              <span className="text-[var(--dk-text-muted)]">_</span>
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Populated ──
  return (
    <Card
      accent={accent}
      className={`h-full relative ${
        draggable
          ? 'cursor-grab active:cursor-grabbing active:border-[color-mix(in_srgb,var(--page-accent)_70%,transparent)]'
          : ''
      } ${className}`}
      data-widget-id={widgetId}
      data-state="populated"
    >
      <CardHeader>
        <TerminalLabel>
          {Icon && <span className="mr-2 text-[var(--page-accent)]"><Icon size={12} strokeWidth={1.5} /></span>}
          {title.toUpperCase()}
          {kicker && <span className="ml-2 font-normal normal-case tracking-normal text-[var(--dk-text-muted)]">// {kicker}</span>}
        </TerminalLabel>
        {description && (
          <div className="text-[12px] font-normal text-[var(--dk-text-muted)]">{description}</div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-0.5">
          {removable && (
            <MotionBtn
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className={`${HIT} h-7 w-7 rounded-lg text-[var(--dk-text-muted)] hover:text-[var(--dk-text-primary)] hover:bg-[var(--dk-bg-raised)] transition-colors duration-100 ${FOCUS_B}`}
              aria-label="Remove widget"
              title="Remove widget"
            >
              <X size={12} />
            </MotionBtn>
          )}
          {collapsible && (
            <MotionBtn
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={`${HIT} h-7 w-7 rounded-lg text-[var(--dk-text-muted)] hover:text-[var(--dk-text-primary)] hover:bg-[var(--dk-bg-raised)] transition-colors duration-100 ${FOCUS_B}`}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </MotionBtn>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Spec 3.13 / bug 5: no height animation (layout property). Content unmounts
            and AnimatePresence fades it out. */}
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="expanded"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tBase(reduce, 0.1)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}

      {draggable && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[var(--dk-text-muted)]">
          <GripVertical size={12} />
        </div>
      )}
    </Card>
  );
}
