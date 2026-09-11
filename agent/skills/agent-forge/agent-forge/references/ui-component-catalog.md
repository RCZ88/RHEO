# DeskFlow UI Component Catalog

## Card Types

| Card Type | Use Case | Existing Renderer |
|-----------|----------|-------------------|
| `digest` | Daily summaries, briefings | `DigestCardRenderer` |
| `goal` | Goal tracking, progress | `GoalCardRenderer` |
| `finance` | Transactions, budgets | `FinanceCardRenderer` |
| `activity` | Time tracking, sessions | `ActivityCardRenderer` |
| `reflection` | Journal entries, insights | `ReflectionCardRenderer` |
| `table` | Structured data, lists | `TableCardRenderer` |
| `chart` | Visualizations | `ChartCardRenderer` |
| `custom` | Novel layouts | Must create new renderer |

## Layout Primitives

| Primitive | Description |
|-----------|-------------|
| `vertical_stack` | Sections stacked top-to-bottom |
| `grid` | 2-column or 3-column grid |
| `timeline` | Left-aligned time markers |
| `kanban` | Column-based status boards |
| `table` | Row/column data display |
| `hero` | Large top section + details below |

## Component Atoms

| Component | Props | Notes |
|-----------|-------|-------|
| `Badge` | `text, variant, size` | Variants: default, success, warning, error, info |
| `ProgressBar` | `value, max, color?` | Cyan accent by default |
| `TimelineItem` | `time, title, description, status?` | Left border indicates status |
| `ChecklistItem` | `text, checked, priority?` | Animated check on toggle |
| `QuoteBlock` | `text, author, source?` | Italic, muted color |
| `StatCard` | `label, value, change?, trend?` | Compact metric display |
| `EmailPreview` | `sender, subject, snippet, unread?` | Truncated with expand |
| `CalendarEvent` | `time, title, duration, location?` | Color-coded by calendar |

## Theme Tokens

```
bg-surface:      #0f172a  (main background)
bg-glass:        rgba(15, 23, 42, 0.7)  (card background)
bg-elevated:     #1e293b  (hover state)
text-primary:    #f8fafc  (headings, body)
text-secondary:  #94a3b8  (labels, metadata)
text-muted:      #64748b  (timestamps, hints)
accent-cyan:     #22d3ee  (active, interactive)
accent-green:    #4ade80  (success, complete)
accent-amber:    #fbbf24  (warning, pending)
accent-rose:     #fb7185  (error, overdue)
border-default:  rgba(255, 255, 255, 0.1)
```

## Responsive Rules

- Mobile (<640px): single column, full-width cards
- Tablet (640-1024px): 2-column grid where applicable
- Desktop (>1024px): up to 3-column grid, sidebar support
- All cards: `min-width: 320px`, `max-width: 720px`
