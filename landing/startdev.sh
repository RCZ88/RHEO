#!/usr/bin/env bash
# startdev.sh — launch Next.js dev server for the RHEO landing page
# Run from the landing/ directory (or any sibling — this script resolves its own location).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "▶ landing/ → npm run dev (port 3000)"
exec npm run dev
