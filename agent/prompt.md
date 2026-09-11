# Prompt for AI

## Task

Fix data consistency issues in the DeskFlow Electron app. The app has multiple views that should show the same data, but currently they show different data.

## Key Files

- `src/App.tsx` - Main component with state management. Contains `allLogs`, `filteredLogs`, `logs`, `computedAppStats`, and the `selectedPeriod` filter.
- `src/components/OrbitSystem.tsx` - Planet visualization that receives `logs` prop
- `src/pages/StatsPage.tsx` - Applications page that receives `appStats` prop

## Current Issues

1. **Planet vs Applications Page**: Planet receives `logs` (which includes ALL activity including browser apps), but Applications page receives `appStats` (which filters out browser apps). They show different data.

2. **Filtering Logic**: The correct filtering should:
   - Filter by period (today/week/month/all)
   - Exclude entries where `is_browser_tracking === true`
   - Exclude browser apps: Chrome, Firefox, Safari, Edge, Brave, Opera, Google Chrome, Microsoft Edge, Comet, Browser

## Solution Approach

The data flow should be:
1. `allLogs` - all data, never changes (for heatmap)
2. `filteredLogs` - allLogs filtered by selectedPeriod only
3. Pass `filteredLogs` to both OrbitSystem (planet) AND use it to compute app stats
4. The Applications page should get stats computed from the SAME filteredLogs that the planet uses

## What to Fix

1. Ensure planet (OrbitSystem) shows the SAME apps as the Applications page (StatsPage)
2. Ensure data filtering is applied consistently everywhere
3. Fix any issues with how period filtering works

## Important Notes

- The heatmap must continue to show last 7 days regardless of timeline filter (it uses allLogs)
- Build with `npm run build` after making changes
- Test by selecting different timeline periods (Today/Week/Month/All) and comparing what shows on the Dashboard (planet) vs Applications page