# DeskFlow IPC Allowlist

## Read-Only Endpoints (Safe — no approval needed)

### Goals
- `goals.list({status?, priority?, limit?, due_before?, due_after?})` → `Goal[]`
- `goals.get({id})` → `Goal`
- `goals.stats({period?})` → `{total, completed, overdue, completion_rate}`

### Planning
- `planning.items({date_range, type?})` → `PlanItem[]`
- `planning.availability({date, duration?})` → `TimeSlot[]`

### Finance
- `finance.transactions({range, category?, limit?})` → `Transaction[]`
- `finance.budget({period})` → `{allocated, spent, remaining, categories[]}`
- `finance.accounts()` → `Account[]`

### Daily Digest
- `digest.cards({date, types?})` → `DigestCard[]`
- `digest.history({limit?})` → `DigestCard[]`

### Connectors
- `connectors.items({source, filter?, limit?})` → `ConnectorItem[]`
- `connectors.sources()` → `string[]`
- `connectors.unread_count({source?})` → `number`

### Activity Tracking
- `activity.sessions({date_range, category?})` → `Session[]`
- `activity.summary({date_range})` → `{total_time, by_category, productivity_score}`

### Reflection
- `reflection.entries({date_range, mood?, tags?})` → `Entry[]`
- `reflection.insights({period})` → `{themes, trends, suggestions}`

## Write Endpoints (Require explicit approval)

### Goals
- `goals.create({...})`
- `goals.update({id, ...})`
- `goals.delete({id})`

### Planning
- `planning.create({...})`
- `planning.update({id, ...})`
- `planning.delete({id})`

### Finance
- `finance.add_transaction({...})`
- `finance.update_transaction({id, ...})`

### Connectors
- `connectors.mark_read({id})`
- `connectors.send({source, ...})`

## Forbidden Patterns

Any generated system that uses these must be flagged in Security Review:
- `delete*` without user confirmation
- `write*` or `update*` without explicit approval flow
- Dynamic code execution
- File system access outside app sandbox
- Network requests to non-allowlisted domains
