import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { Button } from "./Button";
import { XIcon } from "lucide-react";

// LAMINAR Dialog — hairline border + backdrop blur, bg-0 canvas, no color hue.
// Built on a minimal controlled pattern (no external dialog dep) so the landing
// kit stays self-contained and monochrome.
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal,30)] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-[calc(100%-2rem)] rounded-[var(--radius-card)] border border-[var(--hairline-strong)]",
          "bg-[var(--bg-0-95)] p-5 text-[var(--text-hi)] backdrop-blur-xl sm:max-w-sm",
          "duration-[var(--dur-normal)] ease-[var(--ease-out-expo)]"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-[15px] font-semibold leading-none text-[var(--text-hi)]", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-[var(--text-mid)]", className)} {...props} />;
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mt-4", className)}>{children}</div>;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
  );
}

export function DialogClose({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label="Close" className="absolute right-2 top-2">
      {children ?? <XIcon />}
    </Button>
  );
}
