import { BlurFade } from "motion";
import {
  StatusBand,
  MomentumSummary,
  ProductivityChart,
  GoalsCard,
  StreakCard,
  DeadlinesCard,
  LongestFocusCard,
} from "../components/widgets";

function CardWrapper({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <BlurFade
      in
      delay={0.05 * index}
      duration={0.25}
      ease={[0.16, 1, 0.3, 1]}
    >
      {children}
    </BlurFade>
  );
}

export function WidgetGrid() {
  // Demo data — replace with real data wiring
  const goals = [
    { title: "Finish signal panels spec", done: true, due: "Sep 25" },
    { title: "Wire up stopwatch state", done: false, due: "Sep 26" },
    { title: "Build chart period switching", done: false, due: "Sep 27" },
    { title: "Add empty/loading/error states", done: false, due: "Sep 28" },
    { title: "Build and verify", done: false, due: "Sep 29" },
  ];

  const streakDays = Array.from({ length: 7 }, (_, i) => ({
    done: i < 4,
    isToday: i === 6,
  }));

  const deadlines = [
    { title: "Signal Panels prototype review", daysLeft: 2, dueDate: "Sep 27" },
    { title: "Dashboard redesign handoff", daysLeft: 5, dueDate: "Oct 01" },
    { title: "Q4 planning session", daysLeft: 12, dueDate: "Oct 08" },
  ];

  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: `${10 + i}`,
    productive: Math.floor(Math.random() * 120 + 30),
    distracting: Math.floor(Math.random() * 40 + 5),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <CardWrapper index={0}>
        <StatusBand />
      </CardWrapper>

      <CardWrapper index={1}>
        <MomentumSummary score={64} trend={8} />
      </CardWrapper>

      <CardWrapper index={2}>
        <ProductivityChart data={chartData} />
      </CardWrapper>

      <CardWrapper index={3}>
        <GoalsCard goals={goals} />
      </CardWrapper>

      <CardWrapper index={4}>
        <StreakCard streak={4} days={streakDays} />
      </CardWrapper>

      <CardWrapper index={5}>
        <DeadlinesCard deadlines={deadlines} />
      </CardWrapper>

      <CardWrapper index={6}>
        <LongestFocusCard
          valueMs={3120000}
          sessionName="VS Code — Feature work"
          date="Sep 24, 2026"
        />
      </CardWrapper>
    </div>
  );
}
