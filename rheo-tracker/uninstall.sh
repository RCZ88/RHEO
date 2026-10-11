#!/usr/bin/env bash
# Removes the always-on tracker. Flushes first so the open session is not lost.
set -euo pipefail

UNIT="rheo-tracker.service"
UNIT_FILE="$HOME/.config/systemd/user/$UNIT"
DEST="${RHEO_TRACKER_DEST:-$HOME/.local/share/rheo-tracker}"

if systemctl --user is-active --quiet "$UNIT"; then
  echo "==> stopping $UNIT (flushes the open session)"
  # SIGTERM triggers the shutdown handler, which writes the pending row.
  systemctl --user stop "$UNIT"
fi

systemctl --user disable "$UNIT" 2>/dev/null || true
rm -f "$UNIT_FILE"
systemctl --user daemon-reload
systemctl --user reset-failed "$UNIT" 2>/dev/null || true

echo "==> removing $DEST"
rm -rf "$DEST"
rm -f "$HOME/.config/RHEO/tracker-daemon.lock"

echo "==> done. Tracking now only runs while the RHEO app is open."