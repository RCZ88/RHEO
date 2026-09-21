import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

function Accordion({
  className,
  ...props
}: AccordionPrimitive.Root.Props & { className?: string }) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("w-full", className)}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: AccordionPrimitive.Item.Props & { className?: string }) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Header.Props & { className?: string; children?: React.ReactNode }) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-trigger"
      className={cn("flex", className)}
      {...props}
    >
      <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-3 text-sm font-medium text-foreground transition-all hover:text-foreground/80 [&[data-open]>svg]:rotate-180">
        {children}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props & { className?: string; children?: React.ReactNode }) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm text-muted-foreground transition-all data-open:animate-in data-open:slide-in-from-top-1 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-top-1 data-closed:fade-out-0",
        className
      )}
      {...props}
    >
      <div className="pb-3 pt-0">{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
