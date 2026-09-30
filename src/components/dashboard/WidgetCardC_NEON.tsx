// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE C: "NEON GLASS"
// Dark glass panels with neon edge accents.
// Glass surface on dark page bg (LAMINAR-compliant: glass on chrome is banned,
// glass on page bg is fine). Neon glow on hover. Premium feel.
// ============================================================

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { GripVertical, EyeOff, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { resolveColor, withAlpha } from './protoColor';

const MotionBtn = motion(Button);

// ── Card primitives (NEON GLASS: glass surface + neon border + hover glow) ──
const Card = ({ className = '', children, neonColor, ...props }: React.HTMLAttributes<HTMLDivElement> & { neonColor?: string }) => {
  return (
    <div
      // R3: hover was `hover:border-[${neon}]/40` — a runtime-built class Tailwind never
      // compiles, so it silently did nothing. The className below is a STATIC literal and
      // the color comes from the --neon-hover-border custom property set in style.
      className={`rounded-xl bg-zinc-900/40 backdrop-blur-sm text-zinc-100 border border-zinc-800/50 hover:border-[var(--neon-hover-border)] hover:shadow-[0_0_24px_-8px_var(--neon-hover-glow)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
      style={{
        ['--neon-hover-border' as string]: withAlpha(neonColor, 0.4),
        ['--neon-hover-glow' as string]: withAlpha(neonColor, 0.07),
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
};

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
  <div className={`text-[12px] text-zinc-500 ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pt-3 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center p-5 pt-0 border-t border-zinc-800/30 ${className}`} {...props}>
    {children}
  </div>
);

// ── Neon top edge (2px line, category color, subtle) ──
function NeonEdge({ color = 'var(--page-accent)' }: { color?: string }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-px rounded-none"
      style={{
        background: `linear-gradient(to right, ${withAlpha(color, 0.375)}, ${withAlpha(color, 0.19)}, transparent)`,
      }}
    />
  );
}

// ── Icon box (glass-like, tinted bg + accent border) ──
function NeonIconBox({ icon: Icon, color = 'var(--page-accent)', size = 30 }: {
  icon: any; color?: string; size?: number;
}) {
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: withAlpha(color, 0.063),
        border: `1px solid ${withAlpha(color, 0.145)}`,
        boxShadow: `0 0 12px -4px ${withAlpha(color, 0.125)}`,
      }}
    >
      {Icon && <Icon size={size * 0.5} style={{ color: resolveColor(color) }} strokeWidth={2} />}
    </div>
  );
}

// ── Widget Card Props ──
export interface WidgetCardProps {
  widgetId: string;
  title: string;
  icon: any;
  neonColor?: string;      // neon accent color (hex or CSS var)
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
 * NEON GLASS prototype: dark glass panel with neon edge accent.
 * Hover brightens neon border + reveals subtle glow shadow.
 * Premium, polished, alive. LAMINAR-compliant: glass on page bg only.
 */
export function WidgetCardC({
  widgetId,
  title,
  icon: Icon,
  neonColor = 'var(--page-accent)',
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
  const reduceMotion = useReducedMotion();

  // ── Loading ──
  if (loading) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} neonColor={neonColor} data-widget-id={widgetId} data-state="loading">
        <NeonEdge color={neonColor} />
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Card className={`h-full border-rose-500/20 relative overflow-hidden ${className}`} neonColor="rose-400" data-widget-id={widgetId} data-state="error">
        <NeonEdge color="rose-400" />
        <CardContent>
          <div className="flex items-center gap-2 text-rose-400 text-[13px]">
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ──
  if (empty) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} neonColor={neonColor} data-widget-id={widgetId} data-state="empty">
        <NeonEdge color={neonColor} />
        <CardHeader>
          <CardTitle>
            <NeonIconBox icon={emptyIcon || Icon} color={neonColor} size={28} />
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 text-[13px]">
            {emptyIcon && <div className="opacity-30">{emptyIcon}</div>}
            <span>{emptyMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Populated ──
  return (
    <Card
      className={`h-full relative overflow-hidden ${className} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      neonColor={neonColor}
      data-widget-id={widgetId}
      data-state="populated"
    >
      {/* Neon top edge — category identity */}
      <NeonEdge color={neonColor} />

      {/* Ambient glow behind content (subtle breathing) */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 right-0 w-40 h-40 rounded-full"
          style={{
            // R3: `${neonColor}20` was invalid when neonColor = "rose-400" or "var(--page-accent)"
            background: `radial-gradient(circle, ${withAlpha(neonColor, 0.125)} 0%, transparent 70%)`,
            filter: 'blur(24px)',
          }}
          animate={reduceMotion ? { opacity: 0.2 } : { opacity: [0.2, 0.4, 0.2] }}
          transition={reduceMotion ? {} : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <CardHeader>
        <CardTitle>
          <NeonIconBox icon={Icon} color={neonColor} size={28} />
          <span className="flex flex-col">
            <span>{kicker && <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 -mt-0.5">{kicker}</span>}</span>
            <span>{title}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            {removable && (
              <MotionBtn
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-lg"
                aria-label="Remove widget"
              >
                <X size={14} />
              </MotionBtn>
            )}
            {collapsible && (
              <MotionBtn
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-lg"
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? <EyeOff size={14} /> : <AlertTriangle size={14} />}
              </MotionBtn>
            )}
          </div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.div
              key="collapsed"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 0, opacity: 0 }}
              exit={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}

      {/* Drag handle */}
      {draggable && (
        <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={12} className="text-zinc-600" />
        </div>
      )}
    </Card>
  );
}
