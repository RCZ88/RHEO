# Environment & Freshness — false alarms and stale artifacts

Four defects this session were environmental; each was initially read as an app bug.

## Origin family mismatch (the 45-second non-bug)
Vite bound `[::1]`; Chromium resolved `localhost` to IPv4. Navigation timed out and read as an
application failure. Before debugging the app:
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/
  curl -s -o /dev/null -w "%{http_code}" "http://[::1]:<port>/"
If one answers and the other does not, your failure is addressing, not code. Make the probe and
the page use the same family.

## HMR mid-run (the phantom failure)
Editing a source file while a Playwright run is mid-assertions reloads the page between
assertions; 4 of 17 "failed" against correct code. Rules: never edit while a probe runs; if a
run fails oddly, re-run ONCE before diagnosing.

## Stale artifact (the false FIXED)
The same bundle hash appeared in two consecutive bug reports; the source was fixed and the claim
was still false. Freshness protocol:
1. Marker: a `data-probe="<change-id>"` attribute or dev-only string unique to this change,
   placed IN the changed lines.
2. Served-module check:
   curl -s "http://127.0.0.1:<port>/src/<module>" | grep -c "<marker>"   # must be ≥ 1
3. DOM check: page.reload() → marker present.
4. dist/: CZ builds it. Ask CZ; record the confirmation verbatim. A PROVE verdict on dist
   without CZ's confirmation is BLOCKED-ON-CZ, not PASS.
5. Consecutive reports must show the marker CHANGED (or explicitly state unchanged). Repeating
   a prior hash and calling it fixed IS the defect, not an edge case.

## Process hygiene (AGENTS §0.6 — defer to source on any conflict)
- `probe_open` / `probe_close` paired 1:1; count them in the verdict.
- Backgrounded processes: record the PID at spawn; kill with `kill <pid>` only.
- NEVER `pkill -f "<pattern>"`: the pattern occurs in your own command line and kills your own
  shell (measured cost: one whole tool call). Match PIDs with `awk` over `ps` output instead.
- Never build, never clean `dist/`, never `RHEO_CZ_OVERRIDE`. dist/ IS the running application.
