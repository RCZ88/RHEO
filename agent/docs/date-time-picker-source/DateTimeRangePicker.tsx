import { useMemo, useState } from "react";
import "./DateTimeRangePicker.css";

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

function formatDate(date: Date) {
  return `${date.getMonth() + 1} / ${date.getDate()} / ${date.getFullYear()}`;
}

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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function TimeColumn({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  onChange: (value: number) => void;
}) {
  return (
    <div className="dt-time-column">
      <span className="dt-time-column-label">{label}</span>
      <div className="dt-time-wheel" role="listbox" aria-label={label}>
        {values.map((number) => (
          <button
            type="button"
            role="option"
            aria-selected={number === value}
            className={`dt-time-option ${number === value ? "is-selected" : ""}`}
            key={number}
            onClick={() => onChange(number)}
          >
            {pad(number)}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeEditor({
  label,
  value,
  onChange,
  format,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  format: "24h" | "12h";
}) {
  const parsed = parseTime(value);
  const [activePart, setActivePart] = useState<"hour" | "minute">("hour");
  const hours = format === "24h"
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i + 1);
  const displayHour = format === "24h" ? parsed.hour : parsed.hour % 12 || 12;

  const setHour = (next: number) => {
    const hour24 = format === "24h"
      ? next
      : (next % 12) + (parsed.hour >= 12 ? 12 : 0);
    onChange(`${pad(hour24)}:${pad(parsed.minute)}`);
  };

  const setMinute = (next: number) => {
    onChange(`${pad(parsed.hour)}:${pad(next)}`);
  };

  const setPeriod = (period: "AM" | "PM") => {
    let hour = parsed.hour % 12;
    if (period === "PM") hour += 12;
    onChange(`${pad(hour)}:${pad(parsed.minute)}`);
  };

  return (
    <section className="dt-time-editor" aria-label={label}>
      <div className="dt-time-editor-heading">
        <span className="dt-eyebrow">{label}</span>
        <span className="dt-time-zone">LOCAL TIME</span>
      </div>

      <div className="dt-time-readout">
        <button
          type="button"
          aria-label="Edit hour"
          aria-pressed={activePart === "hour"}
          className={`dt-time-digit ${activePart === "hour" ? "is-active" : ""}`}
          onClick={() => setActivePart("hour")}
        >
          {pad(displayHour)}
        </button>
        <span className="dt-time-colon">:</span>
        <button
          type="button"
          aria-label="Edit minute"
          aria-pressed={activePart === "minute"}
          className={`dt-time-digit ${activePart === "minute" ? "is-active" : ""}`}
          onClick={() => setActivePart("minute")}
        >
          {pad(parsed.minute)}
        </button>
        {format === "12h" && (
          <div className="dt-period-toggle" aria-label="AM or PM">
            {(["AM", "PM"] as const).map((period) => (
              <button
                type="button"
                key={period}
                aria-pressed={(parsed.hour >= 12 ? "PM" : "AM") === period}
                className={(parsed.hour >= 12 ? "PM" : "AM") === period ? "is-active" : ""}
                onClick={() => setPeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dt-time-selector">
        <TimeColumn
          label={activePart === "hour" ? "HOUR" : "HOUR"}
          value={displayHour}
          values={hours}
          onChange={setHour}
        />
        <div className="dt-time-selector-divider" />
        <TimeColumn
          label="MINUTE"
          value={parsed.minute}
          values={Array.from({ length: 12 }, (_, i) => i * 5)}
          onChange={setMinute}
        />
      </div>
      <p className="dt-time-hint">
        Select an hour or minute above. Minute steps are 5 minutes.
      </p>
    </section>
  );
}

export default function DateTimeRangePicker({
  initialValue,
  onApply,
  timeFormat = "24h",
}: Props) {
  const today = atMidnight(new Date());
  const initialStart = initialValue?.startDate ?? new Date(2026, 9, 7);
  const initialEnd = initialValue?.endDate ?? new Date(2026, 9, 15);

  const [startDate, setStartDate] = useState(atMidnight(initialStart));
  const [endDate, setEndDate] = useState(atMidnight(initialEnd));
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialStart.getFullYear(), initialStart.getMonth(), 1),
  );
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [startTime, setStartTime] = useState(initialValue?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initialValue?.endTime ?? "17:30");
  const [activeTime, setActiveTime] = useState<"start" | "end">("start");

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
    setCalendarOpen(false);
  }

  const activeTimeValue = activeTime === "start" ? startTime : endTime;
  const setActiveTimeValue = activeTime === "start" ? setStartTime : setEndTime;

  return (
    <div className="dt-picker">
      <div className="dt-date-section">
        <label className="dt-field-label" htmlFor="dt-range-input">Date range</label>
        <button
          id="dt-range-input"
          type="button"
          className="dt-range-input"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((open) => !open)}
        >
          <span>{formatDate(startDate)} <span className="dt-range-dash">·</span> {formatDate(endDate)}</span>
          <CalendarIcon />
        </button>

        {calendarOpen && (
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
              <button type="button" onClick={() => setCalendarOpen(false)}>Done</button>
            </div>
          </div>
        )}

        <p className="dt-field-note">Choose a start date, then an end date.</p>
      </div>

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

        <div className="dt-time-tabs" role="tablist" aria-label="Choose which time to edit">
          <button
            type="button"
            role="tab"
            aria-selected={activeTime === "start"}
            className={activeTime === "start" ? "is-active" : ""}
            onClick={() => setActiveTime("start")}
          >
            <span className="dt-tab-dot dt-tab-dot-start" />
            <span><small>STARTS</small><strong>{formatTime(startTime, timeFormat)}</strong></span>
          </button>
          <span className="dt-time-tab-connector" />
          <button
            type="button"
            role="tab"
            aria-selected={activeTime === "end"}
            className={activeTime === "end" ? "is-active" : ""}
            onClick={() => setActiveTime("end")}
          >
            <span className="dt-tab-dot dt-tab-dot-end" />
            <span><small>ENDS</small><strong>{formatTime(endTime, timeFormat)}</strong></span>
          </button>
        </div>

        <TimeEditor
          label={activeTime === "start" ? "START TIME" : "END TIME"}
          value={activeTimeValue}
          onChange={setActiveTimeValue}
          format={timeFormat}
        />
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
