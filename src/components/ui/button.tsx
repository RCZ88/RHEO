import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 light-focus-visible:ring-ring/30",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80 light:bg-primary light:text-primary-foreground light:hover:bg-primary/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground light:border-zinc-300 light:bg-white light:hover:bg-zinc-50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 light:bg-zinc-100 light:text-zinc-700 light:hover:bg-zinc-200",
        ghost:
          "hover:bg-muted hover:text-foreground light:hover:bg-zinc-100 light:hover:text-zinc-900",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 light:bg-red-50 light:text-red-600 light:hover:bg-red-100",
        link: "text-primary underline-offset-4 hover:underline light:hover:text-primary/80",
      },
      size: {
        default: "h-9 gap-1.5 px-4",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs",
        lg: "h-10 gap-2 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
