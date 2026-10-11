#!/usr/bin/env bash
# procmon verification suite. Run from the repo root: bash scripts/procmon/run-all.sh
# Exits non-zero if any suite fails. Linux-only: spawns real PTYs and reads /proc.
set -uo pipefail
fail=0
run() {
  echo
  echo "############### $1 ###############"
  if node "$2" 2>&1 | tail -"${3:-6}"; then :; else fail=1; fi
}
run "procmon integration (real PTYs, /proc, orphan, CLI-exit, benchmark)" scripts/procmon/test-integration.cjs 12
run "procmon database (migration, rollups, restart seeding, growth)" scripts/procmon/test-db.cjs 8
run "integration guards (fabrication, placeholders, migrations, UI, wiring)" scripts/procmon/test-integration-guards.cjs 8
run "terminal workspace load + visualization collapse/perf" scripts/procmon/test-visualization-perf.cjs 8
run "scale benchmark 0/1/5/10 workspaces" scripts/procmon/bench-scale.cjs 12
echo
if [ "$fail" -eq 0 ]; then echo "ALL SUITES PASSED"; else echo "SOME SUITES FAILED"; fi
exit "$fail"
