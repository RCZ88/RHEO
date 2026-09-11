https://21st.dev/@ruixen.ui/components/three-dwall-calendar 

can you deisng a more polished version of this. like adjust it for the dark mode that we have while maintaing its lglossy cleanness and like proper design according ot our style that has those like metalic like shiny thing.

heres the instruction of the current 21st dev component so u can understand:
"""
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
three-dwall-calendar.tsx
"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { Trash2 } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns"

export type CalendarEvent = {
  id: string
  title: string
  date: string // ISO
}

interface ThreeDWallCalendarProps {
  events: CalendarEvent[]
  onAddEvent?: (e: CalendarEvent) => void
  onRemoveEvent?: (id: string) => void
  panelWidth?: number
  panelHeight?: number
  columns?: number
}

export function ThreeDWallCalendar({
  events,
  onAddEvent,
  onRemoveEvent,
  panelWidth = 160,
  panelHeight = 120,
  columns = 7,
}: ThreeDWallCalendarProps) {
  const [dateRef, setDateRef] = React.useState<Date>(new Date())
  const [title, setTitle] = React.useState("")
  const [newDate, setNewDate] = React.useState("")
  const wallRef = React.useRef<HTMLDivElement | null>(null)

  // 3D tilt state
  const [tiltX, setTiltX] = React.useState(18)
  const [tiltY, setTiltY] = React.useState(0)
  const isDragging = React.useRef(false)
  const dragStart = React.useRef<{ x: number; y: number } | null>(null)

  // month days
  const days = eachDayOfInterval({
    start: startOfMonth(dateRef),
    end: endOfMonth(dateRef),
  })

  const eventsForDay = (d: Date) =>
    events.filter((ev) => format(new Date(ev.date), "yyyy-MM-dd") === format(d, "yyyy-MM-dd"))

  // Add event handler
  const handleAdd = () => {
    if (!title.trim() || !newDate) return
    onAddEvent?.({
      id: uuidv4(),
      title: title.trim(),
      date: new Date(newDate).toISOString(),
    })
    setTitle("")
    setNewDate("")
  }

  // wheel tilt
  const onWheel = (e: React.WheelEvent) => {
    setTiltX((t) => Math.max(0, Math.min(50, t + e.deltaY * 0.02)))
    setTiltY((t) => Math.max(-45, Math.min(45, t + e.deltaX * 0.05)))
  }

  // drag tilt
  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId) // ✅ Correct element
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setTiltY((t) => Math.max(-60, Math.min(60, t + dx * 0.1)))
    setTiltX((t) => Math.max(0, Math.min(60, t - dy * 0.1)))
    dragStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    isDragging.current = false
    dragStart.current = null
  }

  const gap = 12
  const rowCount = Math.ceil(days.length / columns)
  const wallCenterRow = (rowCount - 1) / 2

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Button onClick={() => setDateRef((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          Prev Month
        </Button>
        <div className="font-semibold">{format(dateRef, "MMMM yyyy")}</div>
        <Button onClick={() => setDateRef((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          Next Month
        </Button>
      </div>

      {/* Wall container */}
      <div
        ref={wallRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full overflow-auto"
        style={{ perspective: 1200 }}
      >
        <div
          className="mx-auto"
          style={{
            width: columns * (panelWidth + gap),
            transformStyle: "preserve-3d",
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            transition: "transform 120ms linear",
          }}
        >
          <div
            className="relative"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, ${panelWidth}px)`,
              gridAutoRows: `${panelHeight}px`,
              gap: `${gap}px`,
              transformStyle: "preserve-3d",
              padding: gap,
            }}
          >
            {days.map((day, idx) => {
              const row = Math.floor(idx / columns)
              const rowOffset = row - wallCenterRow
              const z = Math.max(-80, 40 - Math.abs(rowOffset) * 20)
              const dayEvents = eventsForDay(day)

              return (
                <div
                  key={day.toISOString()}
                  className="relative"
                  style={{
                    transform: `translateZ(${z}px)`,
                    zIndex: Math.round(100 - Math.abs(rowOffset)),
                  }}
                >
                  <Card className="h-full overflow-visible">
                    <CardContent className="p-3 h-full flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="text-xs font-medium">{format(day, "d")}</div>
                        <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                      </div>

                      {/* events */}
                      <div className="relative mt-2 flex-1">
                        {dayEvents.map((ev, i) => {
                          const left = 8 + (i * 34) % (panelWidth - 40)
                          const top = 8 + Math.floor((i * 34) / (panelWidth - 40)) * 28
                          return (
                            <Popover key={ev.id}>
                              <PopoverTrigger asChild>
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <div
                                      className="absolute w-7 h-7 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-[10px] cursor-pointer shadow"
                                      style={{ left, top, transform: `translateZ(20px)` }}
                                    >
                                      •
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="text-xs font-medium">
                                    {ev.title}
                                  </HoverCardContent>
                                </HoverCard>
                              </PopoverTrigger>
                              <PopoverContent className="w-48">
                                <Card>
                                  <CardContent className="flex justify-between items-center p-2 text-sm">
                                    <div>
                                      <div className="font-medium">{ev.title}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {format(new Date(ev.date), "PPP p")}
                                      </div>
                                    </div>
                                    {onRemoveEvent && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => onRemoveEvent(ev.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    )}
                                  </CardContent>
                                </Card>
                              </PopoverContent>
                            </Popover>
                          )
                        })}
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        {dayEvents.length} event(s)
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add event form */}
      <div className="flex gap-2 items-center">
        <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        <Button onClick={handleAdd}>Add Event</Button>
      </div>
    </div>
  )
}


demo.tsx
"use client"

import * as React from "react"
import { ThreeDWallCalendar, CalendarEvent } from "@/components/ui/three-dwall-calendar"
import { v4 as uuidv4 } from "uuid"

export default function Demo3DWallCalendar() {
  const [events, setEvents] = React.useState<CalendarEvent[]>([
    { id: uuidv4(), title: "Sprint Planning", date: new Date().toISOString() },
    { id: uuidv4(), title: "Design Handoff", date: new Date(new Date().getTime() + 24*60*60*1000).toISOString() },
    { id: uuidv4(), title: "Demo", date: new Date(new Date().getTime() + 3*24*60*60*1000).toISOString() },
  ])

  const addEvent = (ev: CalendarEvent) => setEvents((p) => [...p, ev])
  const removeEvent = (id: string) => setEvents((p) => p.filter(e => e.id !== id))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">3D Wall Calendar Demo</h1>
      <ThreeDWallCalendar events={events} onAddEvent={addEvent} onRemoveEvent={removeEvent} />
    </div>
  )
}

```

Copy-paste these files for dependencies:
```tsx
originui/input
import { cn } from "@/lib/utils";
import * as React from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
          type === "search" &&
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
          type === "file" &&
            "p-0 pr-3 italic text-muted-foreground/70 file:me-3 file:h-full file:border-0 file:border-r file:border-solid file:border-input file:bg-transparent file:px-3 file:text-sm file:font-medium file:not-italic file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

```
```tsx
originui/button
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-black/5 hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm shadow-black/5 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm shadow-black/5 hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

```
```tsx
shadcn/card
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```
```tsx
originui/popover
"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    showArrow?: boolean;
  }
>(({ className, align = "center", sideOffset = 4, showArrow = false, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-popover-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg shadow-black/5 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      {props.children}
      {showArrow && (
        <PopoverPrimitive.Arrow className="-my-px fill-popover drop-shadow-[0_1px_0_hsl(var(--border))]" />
      )}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };

```
```tsx
shadcn/hover-card
"use client"

import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
))
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }

```
```tsx
shadcn/avatar
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className,
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

```
```tsx
shadcn/button
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

Install NPM dependencies:
```bash
uuid, date-fns, lucide-react, @radix-ui/react-slot, class-variance-authority, @radix-ui/react-popover, @radix-ui/react-hover-card, @radix-ui/react-avatar
```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them
"""

Before the polish: one reframe decides everything here. **"Metallic shiny" in LAMINAR is chrome, not paint.** Painted metal (the liquid-metal button, your old silver wordmark) is a *fill* pretending to be a material — it fails the grayscale test and rots. Real metal reads as metal because of **how light behaves on it**: a specular highlight that *moves when the angle changes*. That's behavior, and behavior is legal. So the redesign bakes in a moving light source — and suddenly the 3D tilt isn't decoration anymore, it's *what makes the gloss work*. Tilt = the light moves = the wall reads as brushed dark chrome. That's the trick, and it's why this component can actually belong in RHEO.

## What's wrong with the original (beyond styling)

| Sin | Why it fails | Fix |
|---|---|---|
| `onWheel` tilts the wall | **Scroll hijack** — page never scrolls over the calendar; worst sin in the genre | Wheel is never touched. Tilt = drag only + hover parallax |
| Starts at 18° tilt | Tilted text = legibility tax on a *data* surface, always | **Flat by default; tilt is earned by interaction** |
| `bg-blue-500` dots, red trash | Hue violations; dots placed by modulo math (overlap content) | Events = phase-encoded ticks from the licensed palette |
| `120ms linear` + React state per pointermove | Linear easing, re-render churn | rAF + refs, transform-only writes, spring 200/25 |
| Shadow-based depth | Depth law = surface steps + hairlines | Depth = brightness falloff (near = brighter) |
| `uuid` dep | Unneeded | `crypto.randomUUID()` |
| No today, no empty state, no RM | — | Below |

## MonthWall — the spec

```
┌──────────────────────────────────────────────┐
│  SEPTEMBER 2026          ‹ ›   [PERSPECTIVE] │  mono header, FLAT/PERSPECTIVE toggle
│                                              │
│        ╭────╮ ╭────╮ ╭────╮ ╭────╮           │
│      ╭────╮ ╭────╮ ╭────╮ ╭────╮ ╭────╮      │  ← center row leans forward (z+48)
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔     │  ← specular highlight lives HERE,
│      ╭────╮ ╭────╮ ╭────╮ ╭────╮ ╭────╮      │     slides as the wall tilts
│        ╰────╯ ╰────╯ ╰────╯ ╰────╯           │
│   14 ▍ deep work     today = white underline │
└──────────────────────────────────────────────┘
```

**Geometry & depth.** Grid 7-col, tiles ~112×96px, r10, gap 10. Center row `z=+48`, each row outward `−16`, clamp `−64`; perspective 1400px. Resting state: `rotateX 4°` — barely-there depth, fully legible. **Depth is rendered as brightness, not shadow**: near tiles = `bg-2` + `hairline-strong` top edge + `text-hi` numbers; far tiles = `bg-1` + faint hairline + `text-mid` → the wall falls off into darkness like a stage. That falloff *is* the monochrome depth cue.

**The gloss system (your "metallic").** One viewport-fixed light: container holds `--lx/--ly` derived from current tilt. Every tile carries `--col/--row` once, and its specular overlay is a white radial ≤6% positioned at `calc()` from those four vars — so when the wall tilts, the highlight **slides across the tiles like a window reflection on dark chrome**. Add the `sheen-top` 1px hairline per tile, and a 300ms sheen sweep on month change (one-shot, small element — legal). No gradients-as-paint anywhere; everything is light *responding to angle*.

**Time as dimension (the RHEO move).** Past days sit at 75% surface opacity — sedimented, already recorded. **Today** = full surface + 2px white underline + `text-hi`. Future days = faint numbers, waiting to be filled. The calendar itself becomes the app's thesis: recorded vs. flowing.

**Events = phases.** Event shape: 2px phase-colored tick bar + 10px mono truncated label, max 2 visible + `+N` chip. Hue **only** from the licensed palette (`deepwork #4E79A7`, `meetings #B07AA1`, `learning #76B7B2`, `health #59A14F`, `rest #9C755F`) — because in RHEO a planned event *is* a scheduled phase. The add-flow: click a day → popover with title input + phase-dot selector + time; save → toast with Undo; delete lives in the event popover, also Undo'd (§9 destructive law).

**Interaction contract.** Hover: ±3° parallax toward cursor, spring 200/25. Drag (grab cursor, 4px threshold so clicks still open days): orbit to `rotateX 0–30° / rotateY ±35°`, release **stays**; when |tilt| > 8° a mono `RESET WALL` chip appears (also Esc / double-click). Wheel untouched. Touch/mobile: flat grid, horizontal swipe = month change, drag disabled. `PERSPECTIVE/FLAT` toggle chip in the header for people who just want the grid. Reduced-motion: flat, no parallax, drag off, everything else works. Keyboard: tiles focusable, arrows move, Enter opens the day popover.

**Perf:** tilt writes go to the container + light vars via refs in rAF — one composited style write per frame, zero React state in the move path (framer-motion springs hold the values; motion is sanctioned, §7 pointer-scrub exemption applies).

## Build prompt (Hermes — app track, after M-1; Life Phases → Schedule)

```
Load Skill Router → DESIGN (8 mandatory). Build MonthWall per the chat spec of
record (component spec: MonthWall). Home: Life Phases → Schedule section.
- deps: date-fns only. NO uuid (crypto.randomUUID), NO new libs. Radix popover ok.
- All colors via tokens; event hues ONLY from CategoryColors (licensed phases).
- Gloss = moving specular: container vars --lx/--ly from tilt; per-tile radial
  ≤6% via --col/--row calc. Depth = surface-step brightness falloff, no shadows.
- Flat default (resting rotateX 4°); drag-orbit capped 30°/±35°, spring 200/25,
  release holds, RESET chip >8°; hover parallax ±3°; wheel NEVER hijacked;
  touch flat; RM flat; FLAT/PERSPECTIVE toggle.
- Past 75% surface, today white underline, future faint. Events: phase tick +
  mono label, max 2 + "+N"; add via day popover (title/phase/time), delete +
  Undo toasts.
- Perf gate: tilt = refs + rAF transform writes only; 60fps while orbiting a
  35-tile month. Playwright: click day opens popover, drag changes transform,
  wheel scrolls PAGE not wall, RM renders flat. Tokens grep clean.
```

Ledger: `ruixen/three-dwall-calendar → ADAPTED as MonthWall (Life/Schedule) — wheel-hijack removed, flat-default, gloss-as-light, phase-encoded events.`

Standing priority check, because I know how this goes: this is a *post-M-1, post-IA-1* app build — it queues behind the landing finish (FINISH-LIFE → media pass) and the foundation work. It's a great widget precisely because it's made of the system's own moves (depth-as-brightness, sheen-as-behavior, phases-as-data) — which is also the test for every shiny thing you'll find next: if it can be rebuilt from the constitution, it's ours; if it needs paint, it's theirs.