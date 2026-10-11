"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * Ledger — the trust counter row, in #download above the CTA.
 *
 * WHY IT EXISTS. Every other claim on this page is an adjective: local-first,
 * private, open. An adjective cannot be checked. "0 bytes leave your machine"
 * can. This row converts three of them into countable facts, which is the whole
 * argument of a local-first app stated as arithmetic.
 *
 * THE NUMBERS, AND WHERE THEY COME FROM — the rule is that a number ships only
 * if it can be sourced:
 *
 *   0  bytes that leave your machine   <- there is no network call in the renderer
 *   0  telemetry events                <- same
 *   1  SQLite file is your history     <- open the data directory
 *
 * NOT on this page: "10,000 happy users", "4.9 rating", "trusted by teams".
 * Those have nothing behind them, and putting them beside three real ones
 * devalues the three.
 *
 * ── THE COUNTER WAS DELETED ────────────────────────────────────────────────
 *
 * The first version ported `@react-bits/Counter-TS-TW` and rolled the digits up
 * from 0. GLM killed it and the reasoning is right, so it is recorded here
 * rather than quietly removed:
 *
 *   **A count-up encodes "this number was counted." There is nothing to count
 *   on the way to 0, 0, 1.** Every digit in this row travels upward from zero,
 *   which is the one direction that implies accumulation. It is the least
 *   informative part of three lines whose entire payload is words.
 *
 * A static zero is also a stronger claim: it is a constant, not a journey. The
 * animation was adding a narrative that isn't true — that the app accumulated
 * something. These numbers are the absence of accumulation.
 *
 * What remains is a plain scroll-reveal, opacity only, house curve, once.
 */

type Fact = {
  value: string;
  claim: string;
  how: string;
};

const FACTS: Fact[] = [
  { value: "0", claim: "bytes that leave your machine", how: "no network call in the renderer" },
  { value: "0", claim: "telemetry events, ever", how: "there is nothing to send them to" },
  { value: "1", claim: "SQLite file is your entire history", how: "open the data directory" },
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
    </div>
  );
}