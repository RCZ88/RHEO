# Gold Page 3D Calendar Layout Revamp — Design Prompt

## Raw Request
> look at ht previosu version of the gold pagei diot WHERE IT HAS THE SCHEDULE AND EVERYTHING ELSEEE

> MAKE HTE TODOLIST PROPERLY

> ALSO, IT SHOULAD BE ONE CALENDAR> CURRENTLY WE HAVE TWO. FIXI T. REDEIGN AND MEK SO THAT THE CLENDAR IS PROMINENT TAKING AT LEAST 1/3  of hte the WIDHT O THE WSCREEN ON THESIDE

> IT SHOULD NOT HAVE A SLOPY DEISGN WOTH THAT TOP SCENT OF YELLOW COLOR WHICH IS SLOPPY AS NIGGE. THE FONTS ARE ABSOLOUTELY HOEREDOUS AND MAKES HTEDEISGN EVEN FUCKIGN WORSE

> jut follow this: @url:`https://21st.dev/@ruixen.ui/components/three-dwall-calendar`

> can you deisng a more polished version of this. like adjust it for the dark mode that we have while maintaing its lglossy cleanness and like proper design according ot our style that has those like metalic like shiny thing.

> the layout adjustmenets revmap and proper 3d calendar shoiwng THE 3D ASPECT OF THINGSSS??

> what about hte gold page with the schedules hte dealines the pcomings and all of the goals and stuff???

> the features such as the schedule and the everything on th dashbaord related to deadlines and upcomings adn stuff isnt made properly. ur not using the /frontend-design /skill-router for the frontend skills. like i would like the design of the calendar to be default on a like on a certain angle to show the 3d ness and like it should be nto in a grid. ti should stand out. it should be that the page IS UTILIZIGN THE WIDTH OF THE PAGE MORE. SO THAT YOU CAN FIND HTE SCHEDULES THE DEADLINES, THE GOALS, UPCOMINGS,  PROPERLY. using all /human-centric-ux /ui-ux-pro-max/motion-bring-the-ui-alive  /signature-design  make usre to PLAN FIRST. generate prompt using /generate-prompt to discuss about the ui design and how to fit them proeprly and hte layout and everything

## Problem Statement

The Life/Gold page currently lacks a prominent, single, 3D calendar centerpiece. The user sees:
- A flat or grid-embedded calendar that does not read as 3D
- Amber/yellow dominance that looks “sloppy”
- Deadlines/reminders/schedule/goals not surfaced in a unified, scannable layout
- Width not utilized — the calendar should occupy at least 1/3 of the screen on the right side

## Design Task

Act as Lead Designer + Engineer for the Gold Page Life Phases → Schedule area. Deliver a **single** high-fidelity redesign spec and implementation plan for:
1. A single prominent 3D calendar wall (`MonthWall`) as the right-column centerpiece, ≥1/3 screen width, not confined to a small card grid
2. Real data wiring: Goals, Deadlines, Reminders, Schedule, Long-Term Goals — all surfaced properly
3. Dark metallic / glossy chrome aesthetic adapted from 21st.dev `three-dwall-calendar`, tuned to DeskFlow tokens
4. Clear left/right column layout that uses page width, with calendar standing out via persistent 3D tilt, specular sheen, depth-as-brightness
5. Proper typography hierarchy, reduced amber dominance, motion that serves comprehension
6. Todo list section properly integrated

## Engineering Task

- Trace existing data sources in `src/features/warmth/gold/GoldPage.tsx`: `goals`, `deadlines`, `reminders`, `schedule`, `longTermGoals`, `weekGoals`, `radarMarks`
- Map current ScheduleCard, DeadlineRadar, BellBoard, TheVault, TodoList into the new layout
- Propose exact file changes with line numbers for:
  - `src/features/warmth/gold/GoldPage.tsx` — layout, data flow, new sections
  - `src/components/MonthWall/MonthWall.tsx` — 3D behavior, real-data rendering, empty/loading/error states
- Include data processing logic: how raw API items become calendar tiles, upcoming lists, todo groups

## UX Task

- Define empty/loading/error states for every data-driven panel
- Establish one primary focal point per view (the 3D calendar)
- Progressive disclosure: hide advanced filters until needed
- Motion budget: L2 Responsive unless cinematic moment justifies L3
- Reduced-motion fallback
- Keyboard/focus behavior

## Constraints

- DeskFlow dark design system: `zinc-950` base, glass cards, `backdrop-blur-xl`, `rounded-xl`, `p-5`
- No pure-black backgrounds
- Max 2 accent colors in view; primary accent `pink-500` unless page-specific override
- Typography: Geist/Inter + JetBrains Mono, 13-14px base, tabular nums for data
- Animate only `transform`/`opacity`; never layout properties
- No more than 1 ambient accent at L2
- 8px spacing grid

## Output Format

Return a single comprehensive design+implementation document with:
1. Concept essence + chosen metaphor for the calendar centerpiece
2. Research summary with reference images/links if needed
3. Candidate list + fit-rubric with selected hero justified
4. Integration plan: placement, hierarchy, states, micro-detail layer
5. Confirmed guardrail checklist
6. Implementation plan mapped to exact files and line numbers in THIS codebase
