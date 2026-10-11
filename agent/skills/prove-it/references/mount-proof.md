# Mount Proof — proving a component is reachable

## Why this exists
Compile-clean, type-clean, probe-green code with zero importers is the exact shape of dead code
this repo keeps producing. `SURFACES.md` records `WorkforcePanel` and `STTFloatingOverlay` as
"right code, zero effect". An activity router with two components and no publisher shipped the
same way this session. Nothing in the toolchain notices. This file is the check that notices.

## The importer-chain method
1. Name the export you changed or created (component, hook, provider, route, reducer).
2. Hop 1 — find who imports it:
   grep -rn "<ExportName>" src/ --include="*.tsx" --include="*.ts" | grep -v "<its own file>"
   Follow re-exports as hops too.
3. For each importer, repeat. You are building a chain:
   <your-file> → <importer1> → <importer2> → … → ROOT
4. Mount roots (the chain may terminate here, nowhere else):
   - the Vite entry — the module the HTML loads;
   - the router / route registration table;
   - any page verified by `npm run validate:pages` (a resolving data-section is machine-proof
     the page renders);
   - for Electron main-process code: the main boot path, before `app.ready`;
   - for context/providers: the provider's mount site in the entry tree.
5. Dead end = a chain link with zero importers that is not itself a root. STOP. Mount it or
   withdraw the claim. Never ship and "wire it later."

## Recording — the chain is evidence, quote it in the verdict
MOUNT: HaloIsland.tsx → StatusBandRegion.tsx → PageShell.tsx → [entry]        ✔
MOUNT: ActivityRouter.tsx → (no importers)                                   ✘ DEAD

## Negative proofs (removal / unmounting)
Proving absence is different from proving presence:
- `locator.count() === 0` after the change, AND
- `npm run validate:pages` still exits 0 for unrelated sections.
A removed component something still imports fails Step 4's typecheck — that is the cheap half;
the count() check is the half that proves the user-visible absence.

## Common shapes and their roots
| What you built            | Root it must reach                  | Machine check                     |
|---------------------------|-------------------------------------|-----------------------------------|
| page / route              | router registration                  | validate:pages                    |
| component                 | a mounted parent                    | Playwright locator count          |
| context / provider        | entry-tree mount site                | probe imports the entry module    |
| hook                      | a mounted component's body           | runtime probe / pageerror capture  |
| Electron main handler     | main boot before app.ready           | observed effect at the renderer   |
| settings toggle           | settings UI **and** the consumer     | both-state assertion (runtime-proof §3) |

## When validate:pages is the whole gate
If your change adds or moves a `data-section`, `npm run validate:pages` is the strongest single
check available: it fails when a declared section has no matching element. It proves mount for
page-level surfaces and nothing else — do not stretch it to panels or overlays; those need
locator counts.
