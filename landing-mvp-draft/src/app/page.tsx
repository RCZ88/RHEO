"use client";

import { MotionConfig } from "framer-motion";
import Grain from "@/components/rheo/Grain";
import Preloader from "@/components/rheo/Preloader";
import Nav from "@/components/rheo/Nav";
import DayRuler from "@/components/rheo/DayRuler";
import SectionIndex from "@/components/rheo/SectionIndex";
import CursorGlow from "@/components/rheo/CursorGlow";
import Footer from "@/components/rheo/Footer";
import BackToTop from "@/components/rheo/BackToTop";
import KeyboardShortcuts from "@/components/rheo/KeyboardShortcuts";
import CommandPalette from "@/components/rheo/CommandPalette";
import Changelog from "@/components/rheo/Changelog";
import Hero from "@/components/rheo/Hero";
import StatsBand from "@/components/rheo/StatsBand";
import Manifesto from "@/components/rheo/Manifesto";
import ActRecord from "@/components/rheo/ActRecord";
import Capabilities from "@/components/rheo/Capabilities";
import InAppGallery from "@/components/rheo/InAppGallery";
import ActUnderstand from "@/components/rheo/ActUnderstand";
import LearnVignette from "@/components/rheo/LearnVignette";
import DesignYourDay from "@/components/rheo/DesignYourDay";
import Principles from "@/components/rheo/Principles";
import Compare from "@/components/rheo/Compare";
import TrustedBy from "@/components/rheo/TrustedBy";
import Testimonials from "@/components/rheo/Testimonials";
import PressBand from "@/components/rheo/PressBand";
import ActFlow from "@/components/rheo/ActFlow";
import Pricing from "@/components/rheo/Pricing";
import FAQ from "@/components/rheo/FAQ";
import Download from "@/components/rheo/Download";
import Coda from "@/components/rheo/Coda";
import SectionDivider from "@/components/rheo/SectionDivider";

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
          <StatsBand />
          <SectionDivider num="I · OBSERVE" />
          <Manifesto />
          <SectionDivider num="II · RECORD" />
          <ActRecord />
          <SectionDivider num="III · INSTRUMENTS" />
          <Capabilities />
          <InAppGallery />
          <ActUnderstand />
          <LearnVignette />
          <DesignYourDay />
          <SectionDivider num="IV · STANDARDS" />
          <Principles />
          <Compare />
          <TrustedBy />
          <Testimonials />
          <PressBand />
          <SectionDivider num="V · FLOW" />
          <ActFlow />
          <SectionDivider num="VI · ACQUIRE" />
          <Pricing />
          <FAQ />
          <Download />
          <Coda />
        </main>
        <Footer />
        <BackToTop />
        <KeyboardShortcuts />
        <CommandPalette />
        <Changelog />
      </div>
    </MotionConfig>
  );
}
