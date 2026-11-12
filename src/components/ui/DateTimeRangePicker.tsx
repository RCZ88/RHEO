import { useMemo, useState, useRef } from "react";
import "./DateTimeRangePicker.css";
import { TimeField } from "./TimeField";

type DateTimeRange = {
  startDate: Date;
  endDate: Date;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
};

type Props = {
  initialValue?: DateTimeRange;
  onApply?: (value: DateTimeRange) => void;
  timeFormat?: "24h" | "12h";
};

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const atMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

function parseTime(value: string) {
  const [hour = "09", minute = "00"] = value.split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

function formatTime(value: string, format: "24h" | "12h") {
  const { hour, minute } = parseTime(value);
  if (format === "24h") return `${pad(hour)}:${pad(minute)}`;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${pad(minute)} ${suffix}`;
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={direction === "left" ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function DateTimeRangePicker({
  initialValue,
  onApply,
  timeFormat = "24h",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const today = atMidnight(new Date());
  const initialStart = initialValue?.startDate ?? new Date(2026, 9, 7);
  const initialEnd = initialValue?.endDate ?? new Date(2026, 9, 15);

  const [startDate, setStartDate] = useState(atMidnight(initialStart));
  const [endDate, setEndDate] = useState(atMidnight(initialEnd));
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialStart.getFullYear(), initialStart.getMonth(), 1),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [startTime, setStartTime] = useState(initialValue?.startTime ?? "09:00");

  // (outside-click dismissal removed — was causing the calendar to close on
  //  every mousedown, including the toggle button's, producing open/close flicker)
  const [endTime, setEndTime] = useState(initialValue?.endTime ?? "17:30");

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const monthTitle = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function selectDate(day: Date) {
    const picked = atMidnight(day);
    if (!selectingEnd) {
      setStartDate(picked);
      setEndDate(picked);
      setSelectingEnd(true);
      if (picked.getMonth() !== visibleMonth.getMonth()) {
        setVisibleMonth(new Date(picked.getFullYear(), picked.getMonth(), 1));
      }
      return;
    }

    if (picked < startDate) {
      setStartDate(picked);
      setEndDate(startDate);
    } else {
      setEndDate(picked);
    }
    setSelectingEnd(false);
  }

  function apply() {
    onApply?.({ startDate, endDate, startTime, endTime });
  }


  return (
    <div className="dt-picker" ref={rootRef}>
      <div className="dt-date-section">
        <label className="dt-field-label" htmlFor="dt-range-input">Date range</label>
        <div className="dt-calendar-popover">
            <div className="dt-calendar-header">
              <button
                type="button"
                className="dt-month-nav"
                aria-label="Previous month"
                onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
              >
                <Arrow direction="left" />
              </button>
              <div className="dt-month-title">{monthTitle}</div>
              <button
                type="button"
                className="dt-month-nav"
                aria-label="Next month"
                onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
              >
                <Arrow direction="right" />
              </button>
            </div>

            <div className="dt-calendar-grid dt-weekdays" aria-hidden="true">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <span key={`${day}-${i}`}>{day}</span>
              ))}
            </div>

            <div className="dt-calendar-grid dt-calendar-days">
              {days.map((day) => {
                const inMonth = day.getMonth() === visibleMonth.getMonth();
                const isStart = sameDay(day, startDate);
                const isEnd = sameDay(day, endDate);
                const inRange = day > startDate && day < endDate;
                const isToday = sameDay(day, today);

                return (
                  <button
                    type="button"
                    key={dateKey(day)}
                    className={[
                      "dt-day",
                      !inMonth ? "is-outside" : "",
                      inRange ? "is-in-range" : "",
                      isStart ? "is-start" : "",
                      isEnd ? "is-end" : "",
                      isToday ? "is-today" : "",
                    ].filter(Boolean).join(" ")}
                    aria-label={day.toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric",
                    })}
                    aria-pressed={isStart || isEnd}
                    onClick={() => selectDate(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="dt-calendar-footer">
              <span>{selectingEnd ? "Choose an end date" : "Choose a start date"}</span>
            </div>
          </div>

        <p className="dt-field-note">Choose a start date, then an end date.</p>
      </div>

      {/* Compact time row — the old design spent ~420px of vertical space on a
          digit readout plus two scrollable hour/minute wheel columns. Two
          TimeField dropdowns do the same job in one 36px row and match the
          Schedule form's time controls. */}
      <div className="dt-time-section">
        <div className="dt-section-title-row">
          <div>
            <span className="dt-eyebrow">SCHEDULE</span>
            <h3>Time window</h3>
          </div>
          <span className="dt-duration-chip">
            {formatTime(startTime, timeFormat)} <span>to</span> {formatTime(endTime, timeFormat)}
          </span>
        </div>

        <div className="dt-time-inline" role="group" aria-label="Start and end times">
          <label className="dt-time-inline-field">
            <span className="dt-eyebrow">STARTS</span>
            <TimeField value={startTime} onChange={setStartTime} startAriaLabel="Start hour" endAriaLabel="Start minute" />
          </label>
          <label className="dt-time-inline-field">
            <span className="dt-eyebrow">ENDS</span>
            <TimeField value={endTime} onChange={setEndTime} startAriaLabel="End hour" endAriaLabel="End minute" />
          </label>
        </div>
      </div>

      <div className="dt-actions">
        <span className="dt-selection-summary">
          {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" – "}
          {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button type="button" className="dt-apply-button" onClick={apply}>Apply range <span>↗</span></button>
      </div>
    </div>
  );
}
