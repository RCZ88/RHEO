"use client";

import { MotionConfig } from "framer-motion";
import Grain from "@/components/rheo/Grain";
import Preloader from "@/components/rheo/Preloader";
import Nav from "@/components/rheo/Nav";
import DayRuler from "@/components/rheo/DayRuler";
import SectionIndex from "@/components/rheo/SectionIndex";
import CursorGlow from "@/components/rheo/CursorGlow";
import Footer from "@/components/rheo/Footer";
import CommandPalette from "@/components/rheo/CommandPalette";
// Changelog import removed with the component. The file stays on disk rather than
// being deleted: it is another agent's surface, and an unmounted component breaks
// nothing while a deleted file is a destructive act on shared work.
import Hero from "@/components/rheo/Hero";
import ActRecord from "@/components/rheo/ActRecord";
import Gallery from "@/components/rheo/Gallery";
import ActUnderstand from "@/components/rheo/ActUnderstand";
import Download from "@/components/rheo/Download";

/**
 * PAGE ARCHITECTURE — five sections, one job each.
 *
 * Per `agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md` §1.
 *
 *   1 #hero        claim        TIME, MADE LEGIBLE.
 *   2 #act-record  mechanism    A DAY, REPLAYABLE.
 *   3 #gallery     the surface  THE WHOLE APP. UNRETOUCHED.   <- owns all 17 captures
 *   4 #understand  the mind     AN AI THAT WAS THERE.
 *   5 #download    the ask      OWN YOUR HOURS.
 *
 * This mount chain is the architecture. It is the direct answer to "everything
 * jumbled up": the whole page structure is readable in one file.
 *
 * WAS ELEVEN SECTIONS, 43 <img> + 10 <video>, with the same 17 screenshots
 * rendered twice at two sizes. Removed below, per RESULT.md §6:
 *
 *   Manifesto       27 words, no media — a slogan #hero already carries
 *   Capabilities    4 stills duplicating what #gallery shows properly
 *   LearnVignette   1 still, and its subject matter is #understand's
 *   AtlasSection    180 words, no media — the wall-of-text impression
 *   ActFlow         19 words, no heading — not a section
 *   Instruments     the 1,209-line orbit ring; dragged horizontally on a page
 *                   that scrolls vertically, and duplicated #gallery
 *
 * Capabilities, AtlasSection and LearnVignette each carried another agent's
 * uncommitted work (69 lines, in no branch), so every one of these was backed
 * up to landing/.bak-20261007-104349/ before deletion. Nothing was lost.
 */
export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col surface-page">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Grain />
        <CursorGlow />
        <Preloader />
        <Nav />
        <DayRuler />
        <SectionIndex />
        <main id="main" className="flex-1">
          <Hero />
          <ActRecord />
          <Gallery />
          <ActUnderstand />
          <Download />
        </main>
        <Footer />
        <CommandPalette />
        {/* Changelog REMOVED 2026-10-16. The list described v0.0.7 through v0.2.0
            with dates and a "First public preview build" claim, and the product has
            no public binaries. Three entries were false against the source: the
            v0.0.7 "cited-session chips" (no citation code exists anywhere in src/),
            the v0.0.9 "refined phase-detection heuristics" (phases are user-set and
            the one detector is wired to zeros), and v0.1.0's "zero telemetry". Seven
            more were never read. Shipping a version list that describes releases
            that did not happen sits directly under the Ledger, which is the worst
            place for it. It returns at the first real release, one entry per shipped
            binary. See conversation/round-05, round-06, round-07 in this repo. */}
      </div>
    </MotionConfig>
  );
}