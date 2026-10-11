#!/usr/bin/env bash
# Merge the Windows (Ntfs) and Linux RHEO tracking profiles.
#
#   rheo-sync            merge both ways
#   rheo-sync --status   report only, change nothing
#
# Safe to run repeatedly: the merge is idempotent, and it REFUSES to run while
# the app or the tracker may be writing (you will be told to close them).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.local/share/rheo-tracker"
SCRIPT="$DEST/sync.mjs"

if [ ! -f "$SCRIPT" ]; then
  echo "==> syncer not installed at $SCRIPT — reinstalling"
  "$HERE/install.sh" >/dev/null
fi

# The app must be closed. The script re-checks this itself, but failing here
# gives a clearer message than a refusal from the merge itself.
if command -v pgrep >/dev/null; then
  if ps -eo pid=,args= | awk '{ for (i=2;i<=NF;i++) if ($i ~ /\/electron$/ || $i ~ /electron\.exe$/) { print $1; exit } }' \
       | grep -q . ; then
    echo "RHEO appears to be running. Close it (and stop the tracker with" >&2
    echo "'systemctl --user stop rheo-tracker'), then run this again." >&2
    exit 1
  fi
fi

NODE_BIN="${RHEO_TRACKER_NODE:-$(command -v node || true)}"
[ -n "$NODE_BIN" ] || { echo "node not found on PATH" >&2; exit 1; }

exec "$NODE_BIN" "$SCRIPT" "$@"
