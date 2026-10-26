#!/usr/bin/env python3
# Universal fallback watcher (RESULT.md §7.4) — stdlib only.
# Usage: RHEO_WATCH_DIR=/path/to/folder python3 watcher.py
import hashlib, json, os, sys, time

INGEST = os.environ.get("RHEO_INGEST_FILE") or os.path.expanduser(
    "~/Library/Application Support/RHEO/changes.jsonl" if sys.platform == "darwin"
    else (os.path.join(os.environ.get("APPDATA", ""), "RHEO", "changes.jsonl") if os.name == "nt"
          else "~/.config/RHEO/changes.jsonl")).replace("~", os.path.expanduser("~"))

ROOT = os.environ["RHEO_WATCH_DIR"]
state = {}

def emit(ev):
    with open(INGEST, "a") as f:
        f.write(json.dumps(ev, separators=(",", ":")) + "\n")

# First run: populate state without emitting (mirrors first-scan re-baseline).
for d, _, files in os.walk(ROOT):
    if any(x in d for x in ("/.git/", "/node_modules/")):
        continue
    for f in files:
        p = os.path.join(d, f)
        try:
            b = open(p, "rb").read()
            state[p] = hashlib.sha1(b).hexdigest()
        except OSError:
            pass

while True:
    seen = {}
    for d, _, files in os.walk(ROOT):
        if any(x in d for x in ("/.git/", "/node_modules/")):
            continue
        for f in files:
            p = os.path.join(d, f)
            try:
                b = open(p, "rb").read()
                seen[p] = hashlib.sha1(b).hexdigest()
                if state.get(p) != seen[p] and p in state:
                    emit({"v": 1, "type": "save", "source": "watcher", "projectPath": ROOT,
                          "filePath": p, "contentSha1": seen[p],
                          "totalLines": b.count(b"\n") + (0 if b.endswith(b"\n") or not b else 1),
                          "bytes": len(b),
                          "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
            except OSError:
                pass
    for p in state:
        if p not in seen:
            emit({"v": 1, "type": "delete", "source": "watcher", "projectPath": ROOT,
                  "filePath": p,
                  "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    state, _ = seen, time.sleep(30)
EOF
echo "written"