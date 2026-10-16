#!/usr/bin/env bash
# git-guard.sh: blocks git commands that can destroy uncommitted work, and LOGS every attempt
# with the parent process, so you can see who ran it.
# Install:  cp git-guard.sh ~/.local/bin/git && chmod +x ~/.local/bin/git && hash -r
# Remove:   rm ~/.local/bin/git
# To run a blocked command yourself:  RHEO_GIT_UNLOCK=1 git stash
# Limits: this stops accidents. A tool that calls /usr/bin/git directly, or sets the variable, gets through.
REAL=/usr/bin/git
[ "${RHEO_GIT_UNLOCK:-}" = 1 ] && exec "$REAL" "$@"

args=("$@"); i=0; sub=""
while [ $i -lt ${#args[@]} ]; do
  a="${args[$i]}"
  case "$a" in
    -C|-c|--git-dir|--work-tree|--namespace) i=$((i + 2)); continue ;;
    -*) i=$((i + 1)); continue ;;
    *) sub="$a"; break ;;
  esac
done
rest=" ${args[*]:$((i + 1))} "

block=0
case "$sub" in
  stash)    case "$rest" in *" list"*|*" show"*|*" create"*) ;; *) block=1 ;; esac ;;
  reset)    case "$rest" in *" --hard"*|*" --merge"*|*" --keep"*) block=1 ;; esac ;;
  checkout) case "$rest" in *" -- "*|*" . "*|*" -f"*|*" --force"*) block=1 ;; esac ;;
  restore)  case "$rest" in *" --staged "*) ;; *) block=1 ;; esac ;;
  clean)    case "$rest" in *" -f"*|*" -d"*|*" -x"*) block=1 ;; esac ;;
  push)     case "$rest" in *" --force"*|*" -f "*) block=1 ;; esac ;;
  branch)   case "$rest" in *" -D "*) block=1 ;; esac ;;
esac

if [ $block = 1 ]; then
  mkdir -p "$HOME/.local/share"
  echo "$(date -Is) BLOCKED cwd=$PWD git $* | parent: $(ps -o args= -p $PPID 2>/dev/null | cut -c1-200)" >> "$HOME/.local/share/rheo-git-guard.log"
  echo "BLOCKED by git-guard: 'git $*' can destroy uncommitted work." >&2
  echo "Do not retry or work around it. Commit to a wip branch instead, or ask the user." >&2
  exit 126
fi
exec "$REAL" "$@"
