#!/bin/bash
# RHEO — Cross-platform dev launcher
# Usage: ./start-dev.sh [--no-desktop] [--no-sync] [--build]
# or:   bash start-dev.sh [--no-desktop] [--no-sync] [--build]
#
# Reads env vars: JWT_SECRET, RELAY_TICKET_SECRET, SYNC_PORT, RELAY_PORT,
#                RELAY_HOST, ELECTRON_OZONE_PLATFORM, BROWSER_PATH,
#                ELECTRON_USER_DATA_DIR, WAYLAND_DISPLAY

set -euo pipefail

# ── resolve project root (script's location) ──────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ── CLI flags ──────────────────────────────────────────────────────────
NO_DESKTOP=false
NO_SYNC=false
FORCE_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --no-desktop) NO_DESKTOP=true ;;
    --no-sync)    NO_SYNC=true ;;
    --build)      FORCE_BUILD=true ;;
  esac
done

# ── platform ───────────────────────────────────────────────────────────
PLATFORM=$(uname -s)
case "$PLATFORM" in
  Linux)   PLATFORM_LABEL="Linux" ;;
  Darwin)  PLATFORM_LABEL="macOS" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM_LABEL="Windows" ;;
  *)       PLATFORM_LABEL="$PLATFORM" ;;
esac

IS_LIN=false
case "$PLATFORM" in
  Linux) IS_LIN=true ;;
esac

IS_WIN=false
case "$PLATFORM" in
  MINGW*|MSYS*|CYGWIN*|Windows*) IS_WIN=true ;;
esac

# ── secrets ────────────────────────────────────────────────────────────
generate_secret() {
  if ! $IS_WIN; then
    openssl rand -base64 32 2>/dev/null | tr '+' '_' | tr '/' '_' | sed 's/=*$//' && return
  fi
  node -e 'console.log(require("crypto").randomBytes(32).toString("base64").replace(/\\+/g,"_").replace(/=/g,"").replace(/\\//g,"_"))' 2>/dev/null && return
  echo "dev-secret-fallback"
}

JWT_SECRET="${JWT_SECRET:-}"
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET="$(generate_secret)"
  export JWT_SECRET
fi

RELAY_TICKET_SECRET="${RELAY_TICKET_SECRET:-}"
if [ -z "$RELAY_TICKET_SECRET" ]; then
  RELAY_TICKET_SECRET="$(generate_secret)"
  export RELAY_TICKET_SECRET
fi

# redact for display
jwt_disp="${JWT_SECRET:0:16}..."
relay_disp="${RELAY_TICKET_SECRET:0:16}..."

echo "============================================"
echo "    RHEO - Dev Startup ($PLATFORM_LABEL)"
echo "============================================"
echo "[keys] JWT_SECRET ............ $jwt_disp"
echo "[keys] RELAY_TICKET_SECRET ... $relay_disp"

SYNC_PORT="${SYNC_PORT:-8787}"
RELAY_PORT="${RELAY_PORT:-8788}"

# ── sync server ────────────────────────────────────────────────────────
if ! $NO_SYNC; then
  echo ""
  echo "[server] Starting sync server on 0.0.0.0:$SYNC_PORT ..."

  SYNC_DIR="$PROJECT_DIR/sync-server"
  if [ ! -d "$SYNC_DIR" ]; then
    echo "[server] WARNING: sync-server/ not found at $SYNC_DIR — skipping sync server"
  else
    ENV_FILE="$SYNC_DIR/.env"
    if [ ! -f "$ENV_FILE" ]; then
      cat > "$ENV_FILE" <<EOF
PORT=$SYNC_PORT
HOST=0.0.0.0
DATABASE_URL=file:/tmp/rheo-sync.db
JWT_SECRET=$JWT_SECRET
RELAY_TICKET_SECRET=$RELAY_TICKET_SECRET
CORS_ORIGINS=*
EOF
      echo "[server] Created $ENV_FILE"
    fi

    export PORT="$SYNC_PORT"
    export HOST="0.0.0.0"
    export DATABASE_URL="file:./data/sync.db"
    export JWT_SECRET
    export RELAY_TICKET_SECRET
    export CORS_ORIGINS="*"

    if $IS_WIN; then
      (cd "$SYNC_DIR" && npx.cmd tsx src/index.ts) &
    else
      (cd "$SYNC_DIR" && npx tsx src/index.ts) &
    fi
    SYNC_PID=$!
    echo "[server] Sync server started (PID $SYNC_PID)"
    echo "[server] Waiting for sync server to be ready..."
    sleep 3

    # pair
    PAIR_URL="http://127.0.0.1:$SYNC_PORT/v1/auth/pair"
    PAIR_BODY='{"deviceName":"desktop-dev","platform":"'"$PLATFORM"'"}'
    if $IS_WIN; then
      RESULT=$(powershell -Command "Invoke-RestMethod -Uri '$PAIR_URL' -Method Post -Body '$PAIR_BODY' -ContentType 'application/json'" 2>/dev/null || true)
    else
      RESULT=$(curl -s -X POST "$PAIR_URL" -H "Content-Type: application/json" -d "$PAIR_BODY" 2>/dev/null || true)
    fi
    if [ -n "$RESULT" ]; then
      ACCESS_TOKEN=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).accessToken)}catch(e){}})" 2>/dev/null || true)
      if [ -n "$ACCESS_TOKEN" ]; then
        export SYNC_ACCESS_TOKEN="$ACCESS_TOKEN"
        echo "[sync] Paired desktop device"
      else
        echo "[sync] Warning: Could not parse pair response"
      fi
    else
      echo "[sync] Warning: Could not pair."
    fi
  fi
fi

# ── relay host ─────────────────────────────────────────────────────────
RELAY_HOST="${RELAY_HOST:-}"
if [ -z "$RELAY_HOST" ]; then
  if $IS_LIN; then
    RELAY_HOST=$(tailscale ip -4 2>/dev/null || true)
    if [ -n "$RELAY_HOST" ]; then
      echo "[relay] Detected Tailscale IP: $RELAY_HOST"
    fi
  fi
  if [ -z "$RELAY_HOST" ] && $IS_WIN; then
    RELAY_HOST=$(powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notlike '*Loopback*' } | Select-Object -First 1 | ForEach-Object { \$_.IPAddress }" 2>/dev/null || true)
  fi
  if [ -z "$RELAY_HOST" ]; then
    RELAY_HOST=$(ip -4 addr show scope global 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || true)
  fi
  if [ -z "$RELAY_HOST" ]; then
    RELAY_HOST=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  RELAY_HOST="${RELAY_HOST:-127.0.0.1}"
fi

if [ "$RELAY_HOST" != "127.0.0.1" ]; then
  echo "[relay] Using LAN IP: $RELAY_HOST"
else
  echo "[relay] Using localhost: $RELAY_HOST"
fi

export RELAY_PORT
export SYNC_URL="http://127.0.0.1:$SYNC_PORT"
if [ -z "${SYNC_ENC_KEY:-}" ]; then
  export SYNC_ENC_KEY="$(generate_secret)"
fi

echo "[config] SYNC_URL = $SYNC_URL"
echo "[config] RELAY_PORT = $RELAY_PORT"

# ── desktop app ────────────────────────────────────────────────────────
if ! $NO_DESKTOP; then
  echo ""
  echo "[desktop] Starting RHEO app ..."

  # ── kill stale RHEO instances ────────────────────────────────────────
  if $IS_WIN; then
    stale=$(powershell -Command "Get-CimInstance Win32_Process -Filter 'Name = \"electron.exe\" OR Name = \"RHEO.exe\"' | Where-Object { \$_.CommandLine -like '*'"$PROJECT_DIR"*' } | ForEach-Object { \$_.ProcessId }" 2>/dev/null || true)
    if [ -n "$stale" ]; then
      for pid in $stale; do
        echo "[desktop] Killing stale RHEO instance (PID $pid)..."
        taskkill /F /PID "$pid" 2>/dev/null || true
      done
    fi
  else
    # kill by project-specific electron binary path
    stale=$(pgrep -af "$PROJECT_DIR/node_modules/electron" 2>/dev/null || true)
    if [ -n "$stale" ]; then
      for pid in $stale; do
        # pgrep -af returns "pid cmdline" — extract just the pid
        pid_num=$(echo "$pid" | awk '{print $1}')
        if [ -n "$pid_num" ] && [ "$pid_num" -gt 0 ] 2>/dev/null; then
          echo "[desktop] Killing stale RHEO instance (PID $pid_num)..."
          kill -9 "$pid_num" 2>/dev/null || true
        fi
      done
    fi

    # kill whatever is holding our ports (stale relay / leftover processes)
    for port in "$RELAY_PORT" "$SYNC_PORT"; do
      port_pids=$(lsof -ti :"$port" 2>/dev/null || true)
      if [ -n "$port_pids" ]; then
        for pid in $port_pids; do
          echo "[desktop] Killing process on port $port (PID $pid)..."
          kill -9 "$pid" 2>/dev/null || true
        done
      fi
    done
  fi

  # production mode — not vite dev server
  unset VITE_DEV_SERVER_URL 2>/dev/null || true

  # ── build gating ─────────────────────────────────────────────────────
  echo "[build] Checking staleness... "

  NODE_MODULES="$PROJECT_DIR/node_modules"
  if [ ! -d "$NODE_MODULES" ]; then
    echo "[build] node_modules missing. Running npm install..."
    if $IS_WIN; then npm.cmd install; else npm install; fi
  fi

  PRELOAD_OK=false
  MAIN_OK=false
  HTML_OK=false
  INDEX_JS_OK=false

  [ -f "$PROJECT_DIR/dist-electron/preload.cjs" ] && PRELOAD_OK=true
  [ -f "$PROJECT_DIR/dist-electron/main.cjs" ] && MAIN_OK=true
  [ -f "$PROJECT_DIR/dist/index.html" ] && HTML_OK=true

  if [ -d "$PROJECT_DIR/dist/assets" ]; then
    ls "$PROJECT_DIR/dist/assets" 2>/dev/null | grep -qE '^index\..*\.js$' && INDEX_JS_OK=true
  fi

  NEED_BUILD=$FORCE_BUILD
  BUILD_REASON=""

  if $FORCE_BUILD; then
    BUILD_REASON="Force rebuild (--build flag)"
  elif ! $PRELOAD_OK || ! $MAIN_OK || ! $HTML_OK || ! $INDEX_JS_OK; then
    NEED_BUILD=true
    MISSING=()
    ! $PRELOAD_OK && MISSING+=('preload.cjs')
    ! $MAIN_OK    && MISSING+=('main.cjs')
    ! $HTML_OK    && MISSING+=('dist/index.html')
    ! $INDEX_JS_OK && MISSING+=('dist/assets/index-*.js')
    BUILD_REASON="Missing: (${MISSING[*]})"
  fi

  if $NEED_BUILD; then
    echo "[build] $BUILD_REASON"

    if ! $PRELOAD_OK; then
      echo "[build] Building preload..."
      if ! npx esbuild "src/preload.ts" --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs; then
        echo "[build] Preload failed!"; exit 1
      fi
    else
      echo "[build] Preload OK (skipping)"
    fi

    if ! $MAIN_OK; then
      echo "[build] Building main..."
      node scripts/rebuild-main.mjs
      if [ ${PIPESTATUS[0]} -ne 0 ]; then echo "[build] Main build failed!"; exit 1; fi
    else
      echo "[build] Main OK (skipping)"
    fi

    if ! $HTML_OK || ! $INDEX_JS_OK; then
      echo "[build] Building renderer..."
      if npx vite build; then
        echo "[build] Renderer build OK"
      else
        echo "[build] Renderer build failed!"; exit 1
      fi
    else
      echo "[build] Renderer OK (skipping)"
    fi
  else
    echo "[build] Skipped (use --build to force)"
  fi

  # ── launch electron ──────────────────────────────────────────────────
  echo "[desktop] Launching electron..."

  # find electron binary
  LOCAL_BIN="$PROJECT_DIR/node_modules/.bin/electron"
  if $IS_WIN; then LOCAL_BIN="$PROJECT_DIR/node_modules/.bin/electron.cmd"; fi
  LOCAL_DIST="$PROJECT_DIR/node_modules/electron/dist/electron"
  if $IS_WIN; then LOCAL_DIST="$PROJECT_DIR/node_modules/electron/dist/electron.exe"; fi
  GLOBAL_ELECTRON="electron"

  if [ -f "$LOCAL_BIN" ]; then ELECTRON_CMD="$LOCAL_BIN"
  elif [ -f "$LOCAL_DIST" ]; then ELECTRON_CMD="$LOCAL_DIST"
  elif command -v "$GLOBAL_ELECTRON" >/dev/null 2>&1; then ELECTRON_CMD="$GLOBAL_ELECTRON"
  else ELECTRON_CMD="npx"
  fi

  if [ -z "$ELECTRON_CMD" ] || { [ "$ELECTRON_CMD" = "npx" ] && ! command -v npx >/dev/null 2>&1; }; then
    echo "[desktop] ERROR: electron not found. Install it: npm install electron"
    exit 1
  fi

  # sanity check: Windows PE on Linux?
  if ! $IS_WIN && [ -f "$ELECTRON_CMD" ]; then
    FTYPE=$(file "$ELECTRON_CMD" 2>/dev/null || true)
    if echo "$FTYPE" | grep -q "Windows"; then
      echo "[desktop] WARNING: electron binary is a Windows executable."
      echo "[desktop] npm install was run on Windows. Run npm install on Linux first."
      echo "[desktop] Attempting launch anyway..."
    fi
  fi

  # build electron args (array — handles spaces in paths)
  ELECTRON_ARGS_ARR=()
  if ! $IS_WIN && [ "${ELECTRON_OZONE_PLATFORM:-}" != "wayland" ]; then
    ELECTRON_ARGS_ARR+=(--ozone-platform=x11)
  fi
  # user data dir — override Electron's default so Windows and Linux share the NTFS path
  if [ -z "${ELECTRON_USER_DATA_DIR:-}" ]; then
    if [ -d "/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO" ]; then
      ELECTRON_USER_DATA_DIR="/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO"
    fi
  fi
  if [ -n "${ELECTRON_USER_DATA_DIR:-}" ]; then
    ELECTRON_ARGS_ARR+=(--user-data-dir="$ELECTRON_USER_DATA_DIR" ".")
  else
    ELECTRON_ARGS_ARR+=(".")
  fi

  # set X11 env if on Linux
  if $IS_LIN; then
    export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}"
    export ELECTRON_OZONE_PLATFORM="${ELECTRON_OZONE_PLATFORM:-x11}"
  fi

  echo "[desktop] RHEO starting with user-data-dir=$ELECTRON_USER_DATA_DIR"
  echo "[desktop] Electron args: ${ELECTRON_ARGS_ARR[*]}"

  if $IS_WIN; then
    cmd.exe /c "$ELECTRON_CMD" "${ELECTRON_ARGS_ARR[@]}"
  else
    "$ELECTRON_CMD" "${ELECTRON_ARGS_ARR[@]}" &
    ELECTRON_PID=$!
    echo "[desktop] RHEO started (PID $ELECTRON_PID). Press Ctrl+C to terminate."

    cleanup() {
      kill -TERM "$ELECTRON_PID" 2>/dev/null || true
      if [ -n "${SYNC_PID:-}" ]; then kill -TERM "$SYNC_PID" 2>/dev/null || true; fi
    }
    trap cleanup SIGINT SIGTERM EXIT

    wait "$ELECTRON_PID"
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
      echo "[desktop] Electron exited with code $EXIT_CODE"
    fi
    exit $EXIT_CODE
  fi
else
  echo ""
  echo "=== Quick Reference ==="
  echo "Sync server:     http://127.0.0.1:$SYNC_PORT"
  echo "Desktop relay:  ws://$RELAY_HOST:$RELAY_PORT"
fi
