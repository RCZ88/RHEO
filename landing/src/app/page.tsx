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
import Manifesto from "@/components/rheo/Manifesto";
import ActRecord from "@/components/rheo/ActRecord";
import Capabilities from "@/components/rheo/Capabilities";
import ActUnderstand from "@/components/rheo/ActUnderstand";
import LearnVignette from "@/components/rheo/LearnVignette";
import AtlasSection from "@/components/rheo/AtlasSection";
import ActFlow from "@/components/rheo/ActFlow";
import Gallery from "@/components/rheo/Gallery";
import Instruments from "@/components/rheo/Instruments";
import Download from "@/components/rheo/Download";

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
          <Manifesto />
          <ActRecord />
          <Capabilities />
          <ActUnderstand />
          <LearnVignette />
          <AtlasSection />
          <ActFlow />
          <Gallery />
          <Instruments />
          <Download />
        </main>
        <Footer />
        <CommandPalette />
        <Changelog />
      </div>
    </MotionConfig>
  );
}
