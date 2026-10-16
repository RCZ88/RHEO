# Date and time range picker

A self-contained React + TypeScript component with a compact date-range calendar and a more editorial time selector.

## Files
- `DateTimeRangePicker.tsx`
- `DateTimeRangePicker.css`

## Use

```tsx
import DateTimeRangePicker from "./DateTimeRangePicker";

export default function ScheduleSettings() {
  return (
    <DateTimeRangePicker
      timeFormat="24h"
      onApply={(range) => {
        console.log(range);
        // Store the selected range in your app state or persist it through IPC.
      }}
    />
  );
}
```

No UI library is required. The optional font import loads Manrope and DM Mono; remove the `@import` in the CSS if the app must be fully offline, then use your local font stack.

## Behaviour and integration notes
- The date picker opens inline under the date field and supports month navigation.
- Click once for a start date, then click again for the end date. If the second date is earlier, the range is normalized.
- The time editor switches between start and end time. Click the large hour or minute readout to choose which part is active.
- Time options are 5-minute increments. To support arbitrary minute values, replace the minute grid with 60 options or a numeric input.
- `onApply` returns `{ startDate, endDate, startTime, endTime }`. Dates are local JavaScript `Date` objects, not UTC timestamps. Convert them deliberately before sending them through Electron IPC.
- `timeFormat` controls display and hour selection (`24h` by default, or `12h`).
- The initial date range defaults to October 7–15, 2026 to match the supplied reference. Pass `initialValue` to override it.

## Production considerations
- Add Escape-key dismissal and outside-click dismissal if the surrounding app needs popover behaviour.
- Decide whether selecting a start date should immediately move focus to the end date, or whether users should click an explicit end-date field.
- Validate that the end time is after the start time when both dates are the same.
- Consider moving font assets local for a fully offline Electron app.
