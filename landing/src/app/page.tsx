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
import Changelog from "@/components/rheo/Changelog";
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
 * rendered twice at two sizes. Unmounted below, per RESULT.md §6:
 *
 *   Manifesto       27 words, no media — a slogan #hero already carries
 *   Capabilities    4 stills duplicating what #gallery shows properly
 *   LearnVignette   1 still, and its subject matter is #understand's
 *   AtlasSection    180 words, no media — the wall-of-text impression
 *   ActFlow         19 words, no heading — not a section
 *   Instruments     the 1,209-line orbit ring; dragged horizontally on a page
 *                   that scrolls vertically, and duplicated #gallery
 *
 * Those six components are UNMOUNTED, NOT DELETED. Capabilities, AtlasSection
 * and LearnVignette carry another agent's uncommitted work (69 lines, in no
 * branch), so they stay on disk until a human decides otherwise. Same for the
 * `landing/prev-ver-backup` reasoning: unmount achieves the whole visual result
 * with nothing destroyed.
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
        <Changelog />
      </div>
    </MotionConfig>
  );
}