import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"

function Select({
  className,
  children,
  valueLabel,
  ...props
}: SelectPrimitive.Root.Props & { className?: string; children?: ReactNode; valueLabel?: Record<string, string> }) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-sm text-zinc-200 shadow-none transition-colors hover:border-zinc-600 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20 outline-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 light:border-zinc-300 light:bg-white light:text-zinc-900 light:hover:border-zinc-400 light:focus-visible:ring-indigo-400/30",
          className
        )}
      >
        <SelectPrimitive.Value placeholder="Select...">
          {valueLabel ? (val: any) => valueLabel[val] || val || 'Select...' : undefined}
        </SelectPrimitive.Value>
        <ChevronDownIcon className="size-4 shrink-0 text-zinc-400 light:text-zinc-500" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50">
          <SelectPrimitive.Popup
            data-slot="select-popup"
            className="min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900 p-1 text-sm shadow-xl shadow-black/50 backdrop-blur-xl light:border-zinc-200 light:bg-white light:text-zinc-900"
          >
            {children}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex cursor-default items-center rounded-md px-2.5 py-1.5 text-sm text-zinc-200 outline-none select-none data-highlighted:bg-zinc-800 data-highlighted:text-white data-disabled:pointer-events-none data-disabled:opacity-50 light:text-zinc-800 light:data-highlighted:bg-zinc-100 light:data-highlighted:text-zinc-900",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { className?: string; children?: ReactNode }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-sm text-zinc-200 shadow-none transition-colors hover:border-zinc-600 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20 outline-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 light:border-zinc-300 light:bg-white light:text-zinc-900 light:hover:border-zinc-400 light:focus-visible:ring-indigo-400/30",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 shrink-0 text-zinc-400 light:text-zinc-500" />
    </SelectPrimitive.Trigger>
  )
}

export { Select, SelectItem, SelectTrigger }
