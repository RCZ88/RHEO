#!/usr/bin/env bash
# Build + publish RHEO so existing installs can UPDATE themselves.
#
#   ./release.sh              dry run: builds, publishes nothing
#   ./release.sh --publish    build and upload a GitHub Release
#
# Per AGENTS.md §0-0 only CZ builds. This script exists so that when you DO build,
# one command produces every artefact the updater needs and nothing is missed.
#
# WHY THIS IS NOT JUST `npm run build`
# ------------------------------------
# A normal build produces dist/ and dist-electron/ for LOCAL use. The updater needs
# something else entirely: a PACKAGED, SIGNED-FOR-UPDATING app plus the metadata
# files electron-updater reads (latest-linux.yml / latest.yml). A build that skips
# packaging produces an app that can never update itself, and there is no error —
# the update check simply never finds anything. That silence is why this script is
# explicit about which artefact it produced.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PUBLISH=0
[ "${1:-}" = "--publish" ] && PUBLISH=1

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

VERSION="$(node -p "require('./package.json').version")"
say "RHEO $VERSION"

# ── Preconditions ────────────────────────────────────────────────────────────
# Both the app AND the tracker write to the same SQLite database. Packaging opens
# the DB to read resources and the daemon may be mid-write, so build with it closed.
if ss -ltn 2>/dev/null | grep -q "127.0.0.1:54321"; then
  warn "port 54321 is listening — the tracker or the app may be running."
  warn "stop it first:  systemctl --user stop rheo-tracker   (and close RHEO)"
  die "refusing to build with a possible writer active"
fi

if [ "$PUBLISH" = "1" ]; then
  # electron-builder reads GH_TOKEN from the environment. Never from a file in the repo.
  [ -n "${GH_TOKEN:-}" ] || die "GH_TOKEN is not set (needed to create the GitHub Release)"
  say "GH_TOKEN present"
fi

# ── Build ────────────────────────────────────────────────────────────────────
say "building app (this writes dist/ and dist-electron/)"
npm run build

# ── Package ──────────────────────────────────────────────────────────────────
say "packaging linux AppImage + windows installer"
if [ "$PUBLISH" = "1" ]; then
  npx electron-builder --linux AppImage --win nsis --publish always
else
  # No --publish: artefacts are built but uploaded nowhere. This is the safe default
  # so a dry run can never accidentally cut a release.
  npx electron-builder --linux AppImage --win nsis --publish never
fi

# ── Verify the updater can actually work ─────────────────────────────────────
# The single most important check: if these are missing, installed apps will
# silently never see an update, and nothing anywhere will report an error.
say "checking updater metadata was produced"
FEED_OK=1
for f in release/latest-linux.yml release/latest.yml; do
  if [ -f "$f" ]; then
    say "  $f"
  else
    warn "  MISSING $f — installed apps will not find updates"
    FEED_OK=0
  fi
done

for f in release/*.AppImage release/*Setup*.exe; do
  [ -f "$f" ] && say "  $(basename "$f")"
done

if [ "$FEED_OK" != "1" ]; then
  die "updater metadata missing — do NOT publish; installed apps could not update"
fi

if [ "$PUBLISH" = "1" ]; then
  say "published https://github.com/RCZ88/RHEO/releases/tag/v$VERSION"
  say "existing installs will pick this up within ~24h (the in-app check is daily)"
else
  say "dry run — nothing was published."
  say "re-run with --publish when you are ready to cut the release."
fi

# ── Post-release ─────────────────────────────────────────────────────────────
say "after installing the packaged app, remember:"
cat <<'EOF'
  Linux   : the AppImage uses ~/.config/RHEO  (same profile as the daemon)
  Windows : the NSIS installer uses %APPDATA%/RHEO
  Both sides share history via `rheo-sync` on the NTFS partition.
  The dev app (`npm start`) is unaffected — auto-update is disabled there by design.
EOF