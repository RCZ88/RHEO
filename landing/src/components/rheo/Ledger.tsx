"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * Ledger — the trust counter row, in #download above the CTA.
 *
 * WHY IT EXISTS. Every other claim on this page is an adjective: local-first,
 * private, open. An adjective cannot be checked. These three rows are the ones
 * that can, and every number below carries the code line it came from.
 *
 * ── WHAT CHANGED, AND WHY IT HAD TO ────────────────────────────────────────
 *
 * The first version said "the old first claim", "0 telemetry events,
 * ever" and "the old third claim". A full grep of the app's main
 * process, preload and renderer found that all three were false. The rule this
 * page runs on is that a number ships only if it can be sourced, so unsourced
 * numbers do not get softened, they get replaced with the sourced ones:
 *
 *   OLD "the old first claim"   -> NEW "2" calls with no setup
 *   OLD "the old second claim"          -> NEW "0" analytics or tracking code
 *   OLD "the old third claim" -> NEW "1" database, three files
 *
 * SOURCES, all verified by grep, not inference:
 *
 *   2  calls that need no setup
 *      - update check. src/main/autoUpdate.ts:147 fires once per 24h, gated only
 *        on app.isPackaged. It GETs the GitHub release feed with an `accept`
 *        header and no key, no account, no install id. See
 *        electron-updater/out/providers/GitHubProvider.js:40-45.
 *      - currency rates. src/components/finance/currency-data.ts:59 fetches
 *        api.exchangerate-api.com when the Finance page opens. No key.
 *      Neither sends activity. That is why the claim is "no setup", not "no bytes".
 *
 *   0  analytics or tracking code
 *      No analytics SDK, beacon, WebSocket or EventSource in src/main.ts,
 *      src/main/**, src/preload.ts, src/pages, src/components, src/hooks,
 *      src/features. "ever" was dropped because it is a word about the future.
 *
 *   1  SQLite database, in three files on disk
 *      src/main.ts:27306 sets db.pragma('journal_mode = WAL'), so the live
 *      folder holds deskflow-data.db, -wal and -shm. One logical database,
 *      three files. The old "entire history in one file" was wrong on the
 *      filesystem, which is the only place anyone can check.
 *
 * NOT on this page: "10,000 happy users", "4.9 rating", "trusted by teams".
 * Those have nothing behind them, and putting them beside three real ones
 * devalues the three.
 */

import { RELEASE_VERSION } from "./release";

type Fact = {
  value: string;
  claim: string;
  how: string;
};

const FACTS: Fact[] = [
  {
    value: "2",
    claim: "calls with no setup: the update check and currency rates",
    how: "neither sends your activity",
  },
  {
    value: "0",
    claim: "analytics or tracking code, in the app or on this page",
    how: "checked in main, preload and renderer",
  },
  {
    value: "1",
    claim: `SQLite database holds your history. Three files, settings beside it. ${RELEASE_VERSION}.`,
    how: "open the data directory",
  },
];

function Cell({ fact, index }: { fact: Fact; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });

  return (
    <motion.div
      ref={ref}
      className="ledger-cell"
      role="listitem"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* explicit separators, not flex gap. flex separated them visually while
          textContent ran them together: "0bytes that leave your machine..." —
          which is exactly the verbatim text a reviewer is asked to audit. */}
      <span className="ledger-value">{fact.value}</span>
      <span className="mono ledger-claim"> {fact.claim}</span>
      <span className="mono ledger-how">{" " + fact.how}</span>
    </motion.div>
  );
}

export default function Ledger() {
  return (
    <div className="ledger" role="list" aria-label="What RHEO sends off your machine">
      {FACTS.map((f, i) => (
        <Cell key={f.claim} fact={f} index={i} />
      ))}

      {/* THE RULE, stated once. The three rows above are the exceptions; this is
          the general truth they are exceptions to. */}
      <p
        className="mono"
        style={{
          marginTop: 18,
          fontSize: 12,
          lineHeight: 1.6,
          color: "#8a8a94",
          maxWidth: 640,
        }}
      >
        Everything else needs your key, your provider, or something you turned
        on. Ask the AI a question and your day&rsquo;s summary goes to the
        provider you picked &mdash; choose a local one and nothing leaves.
      </p>
    </div>
  );
}