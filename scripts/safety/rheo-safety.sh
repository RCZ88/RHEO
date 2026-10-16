#!/usr/bin/env bash
# rheo-safety.sh: protects uncommitted work. Never touches your files, your index or your stash.
#
#   autosave   save everything (tracked + NEW untracked, not ignored) as a commit on a hidden ref.
#              Each save links to the previous one, so you get a timeline. Skips if nothing changed.
#   backup     autosave + git bundle of ALL refs + a tar of the project files. Keeps the last 3 of each.
#   status     show how much work is unsaved and when the last saves happened
#   list       show the autosave timeline (index 0 = newest)
#   restore N  extract autosave number N (from "list") into ~/restore-autosave/. Repo is not touched.
#   install    create systemd user timers: autosave every 15 min, backup every 4 hours
#
# Env: RHEO_REPO (default ~/dev/rheo)  RHEO_BACKUP_DIR (default ~/backups/rheo)
#      RHEO_KEEP (default 3)           RHEO_COPY_TO (optional: a USB or other drive folder to mirror backups to)
set -u
REPO="${RHEO_REPO:-$HOME/dev/rheo}"
BK="${RHEO_BACKUP_DIR:-$HOME/backups/rheo}"
KEEP="${RHEO_KEEP:-3}"
cd "$REPO" 2>/dev/null || { echo "no repo at $REPO"; exit 1; }
BR=$(git symbolic-ref --short -q HEAD || echo detached)
REF="refs/autosave/${BR//\//_}"
log() { mkdir -p "$BK"; echo "$(date '+%F %T') $*" >> "$BK/safety.log"; }
lock() { mkdir -p "$BK"; exec 9>"$BK/.lock"; flock -n 9 || exit 0; }

autosave() {
  local n idx tree prev c
  n=$(git ls-files --others --exclude-standard | wc -l)
  if [ "$n" -gt 5000 ]; then log "SKIP autosave: $n untracked files (check .gitignore)"; return 1; fi
  idx=$(mktemp -u)                       # a private index, so your real index is never touched
  export GIT_INDEX_FILE="$idx"
  git read-tree HEAD 2>/dev/null || git read-tree --empty
  git add -A >/dev/null 2>&1             # respects .gitignore, includes new files, records deletions
  tree=$(git write-tree) || { rm -f "$idx"; unset GIT_INDEX_FILE; return 1; }
  prev=$(git rev-parse -q --verify "$REF" 2>/dev/null || true)
  if [ -n "$prev" ] && [ "$(git rev-parse "$prev^{tree}")" = "$tree" ]; then
    rm -f "$idx"; unset GIT_INDEX_FILE; return 0
  fi
  if [ -n "$prev" ]; then c=$(git commit-tree "$tree" -p "$prev" -m "autosave $(date '+%F %H:%M') on $BR")
  else c=$(git commit-tree "$tree" -m "autosave $(date '+%F %H:%M') on $BR"); fi
  git update-ref "$REF" "$c" && log "autosave $c ($(git status --short | wc -l) uncommitted files)"
  rm -f "$idx"; unset GIT_INDEX_FILE
}

backup() {
  local ts d f
  ts=$(date +%Y%m%d-%H%M)
  mkdir -p "$BK/bundles" "$BK/src"
  git bundle create "$BK/bundles/rheo-$ts.bundle" --all >/dev/null 2>&1 && log "bundle $ts"
  nice -n 19 ionice -c3 tar --exclude=node_modules --exclude=dist --exclude=dist-electron --exclude=dist-tmp \
    --exclude=.next --exclude=release --exclude=agent/backups --exclude=.git \
    -czf "$BK/src/rheo-src-$ts.tar.gz" -C "$(dirname "$REPO")" "$(basename "$REPO")" && log "src tar $ts"
  for d in bundles src; do
    ls -1t "$BK/$d" 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do rm -f "$BK/$d/$f"; done
  done
  if [ -n "${RHEO_COPY_TO:-}" ] && [ -d "$RHEO_COPY_TO" ]; then rsync -a --delete "$BK/" "$RHEO_COPY_TO/rheo-backups/"; fi
}

status() {
  local u
  u=$(git status --short | wc -l)
  echo "repo: $REPO   branch: $BR"
  echo "uncommitted files: $u"
  echo "last commit:   $(git log -1 --format='%cr (%h)')"
  echo "autosaves:     $(git rev-list --count "$REF" 2>/dev/null || echo 0), latest $(git log -1 --format='%cr' "$REF" 2>/dev/null || echo never)"
  echo "bundles:       $(ls -1t "$BK/bundles" 2>/dev/null | head -3 | tr '\n' ' ')"
  echo "src backups:   $(ls -1t "$BK/src" 2>/dev/null | head -3 | tr '\n' ' ')"
  if [ "$u" -gt 50 ]; then echo "WARNING: $u uncommitted files. Commit to a wip branch now."; fi
}

list()    { git log --format='%h %ci  %s' -30 "$REF" | nl -v0; }
restore() {
  local n="${1:-0}" out
  out="$HOME/restore-autosave/$(date +%H%M%S)-$n"
  mkdir -p "$out" && git archive "$REF~$n" | tar -x -C "$out" && echo "restored to $out (your repo was not touched)"
}

install_timers() {
  local me d n every
  me=$(readlink -f "$0"); d="$HOME/.config/systemd/user"; mkdir -p "$d"
  for spec in "autosave:15min" "backup:4h"; do
    n=${spec%%:*}; every=${spec#*:}
    cat > "$d/rheo-$n.service" <<EOF
[Unit]
Description=RHEO safety $n
[Service]
Type=oneshot
Environment=RHEO_REPO=$REPO
Environment=RHEO_BACKUP_DIR=$BK
ExecStart=$me $n
EOF
    cat > "$d/rheo-$n.timer" <<EOF
[Unit]
Description=RHEO safety $n timer
[Timer]
OnBootSec=2min
OnUnitActiveSec=$every
[Install]
WantedBy=timers.target
EOF
  done
  systemctl --user daemon-reload
  systemctl --user enable --now rheo-autosave.timer rheo-backup.timer
  systemctl --user list-timers 'rheo-*' --no-pager
}

case "${1:-status}" in
  autosave) lock; autosave ;;
  backup)   lock; autosave; backup ;;
  status)   status ;;
  list)     list ;;
  restore)  restore "${2:-0}" ;;
  install)  install_timers ;;
  *) echo "usage: $0 autosave|backup|status|list|restore N|install"; exit 2 ;;
esac
