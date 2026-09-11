import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cn } from "@/lib/utils"

function Toggle({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md p-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20 data-pressed:bg-accent data-pressed:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 light:text-zinc-500 light:hover:text-zinc-700 light:data-pressed:bg-zinc-100 light:data-pressed:text-zinc-900",
        className
      )}
      {...props}
    />
  )
}

export { Toggle }
