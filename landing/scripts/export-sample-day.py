#!/usr/bin/env python3
# landing/scripts/export-sample-day.py
#
# Read-only export of one real day from the developer's RHEO database into a
# 1,440-element array of per-minute samples { minute, intensity, category }.
#
# PRIVACY CONTRACT — structural, not scrub-list:
#   This script selects ONLY (minute, category, intensity). It never reads
#   `app`, `title`, `url`, `domain`, `project`, or any column that could
#   identify what the user was doing.
#
# USAGE:
#   python3 landing/scripts/export-sample-day.py [YYYY-MM-DD]
#   DB path defaults to ~/.config/RHEO/deskflow-data.db (override with RHEO_DB).
#
# OUTPUT: landing/data/sample-day.json (committed, not generated at build time).

import json, os, sqlite3, sys
from datetime import datetime, timedelta

DB_PATH = os.environ.get('RHEO_DB', os.path.expanduser('~/.config/RHEO/deskflow-data.db'))
TARGET_DATE = sys.argv[1] if len(sys.argv) > 1 else None

conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
cur = conn.cursor()

# 1. Find the target day: most minutes logged in the last 30 days.
if TARGET_DATE:
    day = TARGET_DATE
else:
    row = cur.execute("""
        SELECT substr(timestamp,1,10) AS d, SUM(duration_ms) AS ms
        FROM logs
        WHERE timestamp >= date('now','-30 days')
        GROUP BY d
        ORDER BY ms DESC
        LIMIT 1
    """).fetchone()
    day = row[0]
    print(f"selected day: {day} ({round(row[1] / 60000)} minutes logged)")

# 2. Build a per-minute map. Only (minute, category, duration_ms) are read.
rows = cur.execute("""
    SELECT substr(timestamp,12,2) AS hh, substr(timestamp,15,2) AS mm,
           category, duration_ms
    FROM logs
    WHERE substr(timestamp,1,10) = ?
    ORDER BY timestamp ASC
""", (day,)).fetchall()

by_minute = {}
max_dur = 1
for r in rows:
    minute = int(r[0]) * 60 + int(r[1])
    if minute < 0 or minute > 1439:
        continue
    dur = r[3] or 0
    if dur > max_dur:
        max_dur = dur
    if minute not in by_minute:
        by_minute[minute] = {'category': r[2] or 'Uncategorized', 'dur': dur}

samples = []
for m in range(1440):
    hit = by_minute.get(m)
    if hit:
        samples.append({
            'minute': m,
            'intensity': round(hit['dur'] / max_dur, 2),
            'category': hit['category'],
        })
    else:
        samples.append({'minute': m, 'intensity': 0, 'category': None})

# 3. Summary stats
cat_minutes = {}
for r in rows:
    cat = r[2] or 'Uncategorized'
    cat_minutes[cat] = cat_minutes.get(cat, 0) + (r[3] or 0)
top_cat = max(cat_minutes.items(), key=lambda x: x[1])

# deep-work window: longest contiguous run of IDE / AI Tools / Development minutes
best_start, best_len, cur_start, cur_len = 0, 0, -1, 0
for m in range(1440):
    s = samples[m]
    is_work = s['category'] in ('IDE', 'AI Tools', 'Development')
    if is_work:
        if cur_start == -1:
            cur_start = m
        cur_len += 1
        if cur_len > best_len:
            best_len = cur_len
            best_start = cur_start
    else:
        cur_start = -1
        cur_len = 0

out = {
    'provenance': {
        'source': 'RHEO SQLite database (read-only)',
        'date': day,
        'selection_rule': 'most minutes logged in the last 30 days',
        'sample_count': 1440,
        'fields': ['minute', 'intensity', 'category'],
        'scrub_statement': 'No app names, window titles, URLs, domains, keystrokes, or clicks are included. The export is structurally incapable of emitting them: only three columns are selected.',
        'generated_by': 'landing/scripts/export-sample-day.py',
        'generated_at': datetime.now().isoformat(),
    },
    'summary': {
        'top_category': top_cat[0],
        'top_category_minutes': round(top_cat[1] / 60000),
        'deep_work_window': {
            'start_minute': best_start,
            'end_minute': best_start + best_len,
            'minutes': best_len,
        },
        'minutes_with_activity': sum(1 for s in samples if s['intensity'] > 0),
    },
    'samples': samples,
}

os.makedirs('data', exist_ok=True)
out_path = 'data/sample-day.json'
with open(out_path, 'w') as f:
    json.dump(out, f, indent=2)
print(f"wrote {out_path}")
print(f"  samples: {len(samples)}")
print(f"  top category: {top_cat[0]} ({round(top_cat[1] / 60000)} min)")
print(f"  deep work: {best_start}..{best_start + best_len} ({best_len} min)")
print(f"  active minutes: {sum(1 for s in samples if s['intensity'] > 0)}")
conn.close()