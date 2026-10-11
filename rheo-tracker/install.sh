#!/usr/bin/env bash
# Installs the RHEO always-on background tracker as a systemd USER service.
#
# No sudo, no root, no polkit. `loginctl enable-linger` is what lets a user unit
# start at boot without anyone logging in — this script checks for it and tells
# you the one command to run if it is missing, rather than silently producing a
# service that only runs once you happen to log in.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${RHEO_TRACKER_DEST:-$HOME/.local/share/rheo-tracker}"
UNIT_DIR="$HOME/.config/systemd/user"
NODE_BIN="${RHEO_TRACKER_NODE:-$(command -v node || true)}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

[ -n "$NODE_BIN" ] || die "node not found on PATH — install Node 22+ first"
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || die "node $NODE_MAJOR is too old — node:sqlite requires 22+ (found $("$NODE_BIN" -v))"
"$NODE_BIN" -e 'import("node:sqlite").then(()=>0).catch(()=>{console.error("node:sqlite unavailable");process.exit(1)})' \
  || die "this node build has no node:sqlite"

command -v systemctl >/dev/null || die "systemctl not found — systemd is required"
[ -d /run/systemd/system ] || warn "systemd does not appear to be PID 1; the unit will not auto-start"

say "node        $("$NODE_BIN" -v)  (ABI $("$NODE_BIN" -p 'process.versions.modules'))"
say "destination $DEST"

mkdir -p "$DEST" "$UNIT_DIR"

say "bundling daemon (repo source -> single self-contained .mjs on the Linux partition)"
"$NODE_BIN" "$SCRIPT_DIR/build.mjs" "$DEST"

# The Windows/Linux profile merger runs straight from source, so it stays readable
# and needs no build step of its own.
cp "$SCRIPT_DIR/sync.mjs" "$DEST/sync.mjs"
sed "s#^HERE=.*#HERE=\"$DEST\"#" "$SCRIPT_DIR/sync.sh" > "$DEST/sync.sh"
chmod +x "$DEST/sync.sh"
mkdir -p "$HOME/.local/bin"
ln -sf "$DEST/sync.sh" "$HOME/.local/bin/rheo-sync"

# The unit hardcodes the interpreter so a PATH change cannot silently swap Node
# versions under a running tracker.
sed "s#/usr/bin/node#$NODE_BIN#" "$SCRIPT_DIR/rheo-tracker.service" > "$UNIT_DIR/rheo-tracker.service"
cp "$SCRIPT_DIR/README.md" "$DEST/README.md" 2>/dev/null || true

say "installed unit -> $UNIT_DIR/rheo-tracker.service"

if ! loginctl show-user "$(id -un)" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
  warn "linger is OFF — the tracker will only start after you log in."
  warn "run:  sudo loginctl enable-linger \"$(id -un)\""
else
  say "linger already enabled — tracker will start at boot with no login"
fi

systemctl --user daemon-reload
systemctl --user enable --now rheo-tracker.service

say "status:"
systemctl --user --no-pager --lines=0 status rheo-tracker.service || true
echo
say "follow the journal with:  journalctl --user -u rheo-tracker -f"
say "remove it with:          $SCRIPT_DIR/uninstall.sh"