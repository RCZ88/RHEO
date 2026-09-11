#!/bin/bash
set -e
cd "$(dirname "$0")/.."
rm -f .build-lock 2>/dev/null
rm -f dist-electron/main.cjs 2>/dev/null
echo "Starting esbuild at $(date)..."
npx esbuild src/main.ts \
  --outfile=dist-electron/main.cjs \
  --format=cjs \
  --platform=node \
  --target=node22 \
  --bundle \
  --external:electron \
  --external:better-sqlite3 \
  --external:active-win \
  --external:node-pty \
  --external:dotenv \
  --external:ws \
  --external:crypto \
  --external:os \
  --external:path \
  --external:fs \
  --external:child_process \
  --external:util \
  --external:url \
  --external:stream \
  --external:events \
  --external:net \
  --external:http \
  --external:https \
  --external:tls \
  --external:zlib \
  --external:assert \
  --external:querystring \
  --external:buffer \
  2>&1
echo "esbuild exited with code $?"
echo "Output file exists: $(ls -la dist-electron/main.cjs 2>&1 || echo 'NO FILE')"
