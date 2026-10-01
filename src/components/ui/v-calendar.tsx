// DeskFlow Dashboard — VCalendar
// Styled calendar (react-day-picker v10) matching the 21st.dev v-calendar-5
// aesthetic with month/year dropdown selects and chevron nav buttons.
// Used as the date selector for the DeadlinesCard "add upcoming" form.

import { useState, useMemo } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Select, SelectItem, SelectTrigger } from '../ui/select';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function MonthSelectDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (month: number) => void;
}) {
  const items = MONTHS_SHORT.map((m, i) => ({ value: i, label: m }));
  const labelMap: Record<string, string> = {};
  MONTHS_SHORT.forEach((m, i) => { labelMap[String(i)] = m; });
  return (
    <Select
      value={String(value)}
      onValueChange={v => onChange(Number(v))}
      valueLabel={labelMap}
    >
      <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-600 focus:ring-indigo-500/20 px-2 py-1 text-xs sm:text-sm h-7 w-[90px]">
        <span className="truncate">{MONTHS_SHORT[value]}</span>
        <ChevronsUpDown className="ml-1 h-3 w-3 text-zinc-400" />
      </SelectTrigger>
      {items.map(item => (
        <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>
      ))}
    </Select>
  );
}

function YearSelectDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (year: number) => void;
}) {
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const arr: { value: number; label: string }[] = [];
    for (let y = current - 10; y <= current + 10; y++) {
      arr.push({ value: y, label: String(y) });
    }
    return arr;
  }, []);

  const labelMap: Record<string, string> = {};
  yearOptions.forEach(y => { labelMap[String(y.value)] = y.label; });

  return (
    <Select
      value={String(value)}
      onValueChange={v => onChange(Number(v))}
      valueLabel={labelMap}
    >
      <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-600 focus:ring-indigo-500/20 px-2 py-1 text-xs sm:text-sm h-7 w-[70px]">
        <span className="truncate">{value}</span>
        <ChevronsUpDown className="ml-1 h-3 w-3 text-zinc-400" />
      </SelectTrigger>
      {yearOptions.map(y => (
        <SelectItem key={y.value} value={String(y.value)}>{y.label}</SelectItem>
      ))}
    </Select>
  );
}

interface VCalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | undefined;
  onSelect?: (date: Date | Date[] | undefined) => void;
  defaultMonth?: Date;
  minDate?: Date;
  maxDate?: Date;
  disabled?: Matcher | Matcher[];
  locale?: Locale;
  initialFocus?: boolean;
  className?: string;
}

export function VCalendar({
  mode = 'single',
  selected,
  onSelect,
  defaultMonth,
  minDate,
  maxDate,
  disabled,
  locale = enUS,
  initialFocus = false,
  className,
}: VCalendarProps) {
  const [month, setMonth] = useState<Date>(
    defaultMonth ?? (selected as Date) ?? new Date()
  );

  const selectedArray: Date[] = useMemo(() => {
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  }, [selected]);

  const handleMonthChange = (m: Date | undefined) => {
    setMonth(m ?? month);
  };

  const handleYearChange = (year: number) => {
    const newMonth = new Date(month);
    newMonth.setFullYear(year);
    setMonth(newMonth);
  };

  const handleMonthSelect = (m: number) => {
    const newMonth = new Date(month);
    newMonth.setMonth(m);
    setMonth(newMonth);
  };

  return (
    <DayPicker
      mode={mode as any}
      month={month}
      onMonthChange={handleMonthChange}
      selected={selectedArray.length > 0 ? selectedArray : undefined}
      onSelect={onSelect as any}
      defaultMonth={defaultMonth}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled as any}
      locale={locale}
      initialFocus={initialFocus}
      showOutsideDays
      className={cn(
        'rdp-root w-fit [--cell-size:theme(spacing.10)] sm:[--cell-size:theme(spacing.9)]',
        className
      )}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        // ── react-day-picker v10 keys ──────────────────────────────────
        // This block was still the v8 API: `caption`, `nav_button`,
        // `nav_button_previous/next`, `table`, `head_row`, `head_cell`, `row`
        // and `cell` were all removed in v10, and the v8 `selected` / `today` /
        // `outside` / `disabled` / `hidden` keys moved to `modifiersClassNames`.
        // Every one of them was silently dropped, leaving the month grid
        // unstyled — which is what misaligned the day columns.
        month_caption: 'flex justify-center pt-1 relative items-center mb-2',
        caption_label: 'text-sm font-medium text-zinc-300',
        nav: 'absolute top-0 flex w-full justify-between z-1 pointer-events-none',
        button_previous: cn(
          'pointer-events-auto relative flex size-(--cell-size) text-base sm:text-sm items-center justify-center rounded-lg text-foreground hover:bg-zinc-800 hover:text-white disabled:pointer-events-none disabled:opacity-64'
        ),
        button_next: cn(
          'pointer-events-auto relative flex size-(--cell-size) text-base sm:text-sm items-center justify-center rounded-lg text-foreground hover:bg-zinc-800 hover:text-white disabled:pointer-events-none disabled:opacity-64'
        ),
        chevron: '',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'size-(--cell-size) text-[10px] font-medium text-zinc-500 uppercase',
        week: 'flex w-full mt-2 items-stretch',
        // v10 has no `cell` key: the cell IS the day.
        day: 'size-(--cell-size) text-center text-sm relative p-0 m-0.5',
        day_button: cn(
          'relative flex size-(--cell-size) text-base sm:text-sm items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:pointer-events-none disabled:opacity-64 focus:z-10 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors'
        ),
        root: '',
        dropdowns: '',
        dropdown_root: '',
        dropdown: '',
        weeks: '',
        week_number: '',
        week_number_header: '',
      }}
      modifiersClassNames={{
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground/50',
        disabled: 'text-zinc-500 opacity-50',
        hidden: 'invisible',
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        range_middle: 'aria-selected:bg-accent',
      }}
      components={{
        // v8 used IconLeft / IconRight; v10 has a single `Chevron` component
        // that receives an `orientation` of "left" | "right".
        Chevron: ({ orientation, ...rest }: any) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" {...rest} />
          ),
        MonthCaption: ({ calendarMonth }) => {
          const d = calendarMonth.date;
          return (
            <div className="flex items-center justify-center gap-1">
              <MonthSelectDropdown
                value={d.getMonth()}
                onChange={handleMonthSelect}
              />
              <YearSelectDropdown
                value={d.getFullYear()}
                onChange={handleYearChange}
              />
            </div>
          );
        },
      }}
    />
  );
}
