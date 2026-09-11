import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "flex h-8 w-full rounded-lg border border-border bg-background px-2.5 py-1 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 outline-none disabled:cursor-not-allowed disabled:opacity-50 light:bg-white light:border-zinc-200 light:placeholder:text-zinc-400 light:focus-visible:ring-ring/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
