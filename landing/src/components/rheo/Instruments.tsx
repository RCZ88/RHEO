"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import DecryptedText from "./DecryptedText";
import SurfaceOrbit, { type OrbitItem } from "./SurfaceOrbit";
import type { OrbitMode } from "./orbit-layout";

/**
 * Instruments — the whole app as one ring.
 *
 * The Gallery filmstrip above lets you PAGE through captures. This is the other
 * half: all seventeen screens at once, so "the whole app" is something you see
 * rather than something you have to scroll through to believe.
 *
 * It is also where the recordings live. Gallery lists "Dashboard" and
 * "▶ Dashboard" as two separate rows; here they are ONE screen with a
 * STILL ⇄ MOTION control, which is what they actually are. Two screens carry
 * two recordings each (dashboard, console) and the extras stay in the filmstrip,
 * which is a linear list and does not mind the duplication.
 */

type Screen = {
  id: string;
  label: string;
  /** the real screenshot — always present, every screen has one */
  still: string;
  alt: string;
  /** first clip for this screen, if one was captured */
  clip?: string;
  clipNote?: string;
};

/**
 * One entry per SCREEN — 17, not 19 and not 24.
 *
 * The gallery filmstrip above lists 24 rows, seven of which are clips. Those
 * clips are not extra screens: "▶ 24h timeline" IS the dashboard, "▶ Real work"
 * IS the console. Listing them as their own rows is what made the original
 * count look arbitrary and hid that seven screens have motion.
 *
 * Where a screen has TWO recordings (dashboard: idle + 24h filling; console:
 * PTY + git), the ring carries the primary one and the second stays in the
 * filmstrip, which is a linear list and does not mind having both. Inventing
 * 19 ring entries by duplicating a still would have made the headline number a
 * lie.
 */
const SCREENS: Screen[] = [
  { id: "dashboard", label: "Dashboard", still: "/media/app-dashboard.png", alt: "The RHEO dashboard with a real day's tracked time", clip: "/media/app-dashboard-idle.mp4", clipNote: "the dashboard, running live" },
  { id: "console", label: "Penguin Console", still: "/media/app-console.png", alt: "Penguin Console running real commands in a real shell", clip: "/media/app-terminal-real.mp4", clipNote: "a real PTY producing real output" },
  { id: "activity", label: "Activity", still: "/media/app-activity.png", alt: "The raw record behind the timeline" },
  { id: "insights", label: "Insights", still: "/media/app-insights.png", alt: "Insights showing real productive, neutral and distracting totals", clip: "/media/app-insights-detail.mp4", clipNote: "Insights detail" },
  { id: "life", label: "Life", still: "/media/app-life.png", alt: "The Life page with a real week", clip: "/media/app-life-week.mp4", clipNote: "the Life week view" },
  { id: "ai", label: "AI Assistant", still: "/media/app-ai.png", alt: "The AI Assistant querying a real tracked record" },
  { id: "learn", label: "Lyceum", still: "/media/app-learn.png", alt: "A lesson open in Lyceum" },
  { id: "finance", label: "Finance", still: "/media/app-finance.png", alt: "The Finance page with real transactions" },
  { id: "ide", label: "IDE Projects", still: "/media/app-ide.png", alt: "IDE Projects tracking real work" },
  { id: "database", label: "Database", still: "/media/app-database.png", alt: "The local-first database browser", clip: "/media/app-database-scroll.mp4", clipNote: "scrolling the real database" },
  { id: "rankings", label: "Rankings", still: "/media/app-rankings.png", alt: "Rankings computed from the real record" },
  { id: "labs", label: "Labs", still: "/media/app-labs.png", alt: "Labs, the experimental surface" },
  { id: "studio", label: "Content Engine", still: "/media/app-studio.png", alt: "The Overlay Studio content engine" },
  { id: "guide", label: "Guide", still: "/media/app-guide.png", alt: "The in-app Guide" },
  { id: "settings", label: "Settings", still: "/media/app-settings.png", alt: "Settings" },
  { id: "lecture", label: "Lecture", still: "/media/app-lecture.png", alt: "Lecture mode" },
  { id: "profiler", label: "Profiler", still: "/media/app-profiler.png", alt: "The in-app performance profiler" },
];

export default function Instruments() {
  const [mode, setMode] = useState<OrbitMode>("ring");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<OrbitItem[]>(
    () =>
      SCREENS.map((s) => ({
        id: s.id,
        image: s.still,
        alt: s.alt,
        label: s.label,
        // clipNote carries the specific capture so "Dashboard" and "Dashboard · 24h"
        // are distinguishable when both are showing motion
        ...(s.clip ? { clip: s.clip, clipLabel: s.clipNote } : {}),
      })),
    []
  );

  const onActiveChange = useCallback((i: number) => setActiveIndex(i), []);

  return (
    <section id="instruments" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 07 / EVERY SURFACE" speed={28} maxIterations={6} />
          </p>
          <h2 className="display-h2 mt-3">SEVENTEEN SCREENS. ONE RING.</h2>
          <p className="mt-5" style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}>
            Every screen, all at once, so the breadth is visible rather than
            promised. Turn the ring — it moves when you move it, never on its
            own. Five also have a recording; that toggle appears on those five
            and nowhere else.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <SurfaceOrbit
            items={items}
            mode={mode}
            onModeChange={setMode}
            activeIndex={activeIndex}
            onActiveChange={onActiveChange}
          />
        </motion.div>

        <p className="mono mt-6" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.12em" }}>
          {SCREENS.length} SCREENS · {SCREENS.filter((s) => s.clip).length} WITH MOTION · CAPTURED FROM A
          RUNNING INSTANCE
        </p>
      </div>
    </section>
  );
}