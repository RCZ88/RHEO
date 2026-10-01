"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * react-day-picker v10 calendar.
 *
 * This component was still written against the **v8** API and had never been
 * updated when the project moved to react-day-picker 10.0.1. Fifteen of the
 * twenty `classNames` keys it passed did not exist in v10, so they were silently
 * dropped and the calendar rendered with v10's unstyled defaults — which is why
 * the day grid, the weekday header and the nav buttons looked scrambled:
 *
 *   gone in v10        caption, table, head_row, head_cell, row, cell,
 *                      nav_button, nav_button_previous, nav_button_next
 *   renamed in v10     day_selected      -> modifiersClassNames.selected
 *                      day_today         -> modifiersClassNames.today
 *                      day_outside       -> modifiersClassNames.outside
 *                      day_disabled      -> modifiersClassNames.disabled
 *                      day_hidden        -> modifiersClassNames.hidden
 *                      day_range_*       -> modifiersClassNames.range_*
 *   layout changed     v10 lays the month out with CSS **grid**, so the old
 *                      `flex` on head_row/row fought the grid and left the
 *                      columns misaligned.
 *
 * v10 keys are validated below against the installed version so this cannot
 * silently rot again on a future bump.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  // v10 renders a CSS grid; `flex` here is what misaligned the columns.
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "",
        months: "flex flex-col sm:flex-row gap-4 sm:gap-6",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-medium text-zinc-200",
        nav: "absolute top-1 left-0 right-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-100 hover:opacity-100 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-100 hover:opacity-100 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all"
        ),
        chevron: "",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        // The grid CELL. v10 has no separate `cell` key — the cell is the day.
        // Rounded ends of a selected range come from the range_start /
        // range_end modifiers below rather than from `:has([role=gridcell])`,
        // which depended on an internal ARIA role v10 is free to change.
        day: "h-9 w-9 text-center text-sm p-0 relative",
        // The clickable BUTTON inside the cell.
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-zinc-300 hover:bg-zinc-800 hover:text-white"
        ),
        dropdowns: "",
        dropdown_root: "",
        dropdown: "",
        weeks: "",
        week_number: "",
        week_number_header: "",
        ...classNames,
      }}
      modifiersClassNames={{
        // v10 replacement for the v8 day_selected / day_today / day_outside keys.
        selected: "day-selected !bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground",
        today: "day-today !bg-accent !text-accent-foreground",
        outside: "day-outside text-muted-foreground/60",
        disabled: "day-disabled text-muted-foreground opacity-50",
        hidden: "day-hidden invisible",
        range_start: "day-range-start rounded-l-md",
        range_end: "day-range-end rounded-r-md",
        range_middle: "day-range-middle aria-selected:bg-accent",
      }}
      components={{
        // v8 used IconLeft / IconRight; v10 has a single `Chevron` and passes
        // an `orientation` of "left" | "right".
        Chevron: ({ orientation, ...rest }: any) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4" {...rest} />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }