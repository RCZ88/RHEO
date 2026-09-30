// ============================================================
// RHEO Dashboard — Prototype Preview Page
// Standalone page that renders all 3 prototype designs side-by-side
// with mock data. No changes to existing dashboard files.
// Access at: /prototype-preview
// ============================================================

import { useState } from 'react';
import { Target, Zap, BarChart3, Flame, TrendingUp } from 'lucide-react';
import { WidgetCardA, StopwatchPanelA, TrackingScorePanelA, ProductivityChartA } from './prototypeA';
import { WidgetCardB, StopwatchPanelB, TrackingScorePanelB, ProductivityChartB } from './prototypeB';
import { WidgetCardC, StopwatchPanelC, TrackingScorePanelC, ProductivityChartC } from './prototypeC';
import type { WidgetCategory } from './WidgetCardA_SIGNAL';

// ── Mock data ──
const MOCK_GOALS = [];
const MOCK_DEADLINES = [];
const MOCK_SCHEDULE = [];

const MOCK_PRODUCTIVE_MS = 5432000; // 1h 30m 32s
const MOCK_DISTRACTING_MS = 720000;  // 12m
const MOCK_IS_PAUSED = false;
const MOCK_LAST_TIER: 'productive' | 'neutral' | 'distracting' = 'productive';
const MOCK_STREAK = 7;
const MOCK_SCORE = 72;

const MOCK_MOMENTUM = {
  score: 72,
  streak: 7,
  completionRate: 72,
  focusHours: 2.3,
  trend: 'up' as const,
};

const MOCK_CHART_DATA = [
  { day: 'Mon', productive: 2.5, neutral: 1.0, distracting: 0.5 },
  { day: 'Tue', productive: 3.0, neutral: 0.5, distracting: 1.0 },
  { day: 'Wed', productive: 4.2, neutral: 1.5, distracting: 0.3 },
  { day: 'Thu', productive: 2.0, neutral: 2.0, distracting: 1.5 },
  { day: 'Fri', productive: 3.5, neutral: 1.0, distracting: 0.8 },
  { day: 'Sat', productive: 1.5, neutral: 3.0, distracting: 2.0 },
  { day: 'Sun', productive: 0.8, neutral: 2.5, distracting: 1.2 },
];

// ── Preview card wrapper ──
function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 flex items-center gap-2">
        <div className="h-px flex-1 bg-zinc-800" />
        {title}
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ── Main preview page ──
export function PrototypePreview() {
  const [activeTab, setActiveTab] = useState<'all' | 'A' | 'B' | 'C'>('all');

  const showAll = activeTab === 'all';
  const showA = activeTab === 'all' || activeTab === 'A';
  const showB = activeTab === 'all' || activeTab === 'B';
  const showC = activeTab === 'all' || activeTab === 'C';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
          Dashboard Prototype Preview
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          3 design directions — pick one to implement. Mock data only.
        </p>
      </div>

      {/* Tab filter */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'A', 'B', 'C'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {tab === 'all' ? 'ALL' : `P${tab}`}
          </button>
        ))}
      </div>

      {/* ── PROTOTYPE A: SIGNAL ── */}
      {showA && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-pink-500" />
            PROTOTYPE A — SIGNAL
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Solid signal panels. Each widget has a distinct top-edge accent bar. Clean, purposeful.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelA
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelA data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartA data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
<WidgetCardA category="productivity">
                  <div className="text-zinc-400 text-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
                      <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                      <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
                      <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                      <span className="text-zinc-300 text-xs">Write 500 words</span>
                    </div>
                  </div>
                </WidgetCardA>
            </div>
            <div className="w-[240px]">
              <WidgetCardA category="productivity">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-500 text-xs mt-1">day streak</div>
                </div>
              </WidgetCardA>
            </div>
            <div className="w-[240px]">
<WidgetCardA category="productivity">
                  <div className="text-zinc-400 text-sm">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 mb-1">
                      <span className="text-xs text-zinc-300">Project submission</span>
                      <span className="text-xs font-mono text-rose-400">2d left</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
                      <span className="text-xs text-zinc-300">Review draft</span>
                      <span className="text-xs font-mono text-amber-400">5d left</span>
                    </div>
                  </div>
                </WidgetCardA>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* ── PROTOTYPE B: TERMINAL CHIC ── */}
      {showB && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            PROTOTYPE B — TERMINAL CHIC
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Flat gunmetal panels. All mono. Dense, technical, snappy.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelB
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelB data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartB data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-goals-b" title="Goals" icon={Target} accent="#8b5cf6">
                <div className="text-zinc-400 text-sm font-mono flex flex-col gap-1">
                  <div className="flex items-center gap-2 py-1 border-b border-zinc-800/30">
                    <div className="w-3 h-3 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                  </div>
                  <div className="flex items-center gap-2 py-1 border-b border-zinc-800/30">
                    <div className="w-3 h-3 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Write 500 words</span>
                  </div>
                </div>
              </WidgetCardB>
            </div>
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-streak-b" title="Streak" icon={Flame} accent="#f97316">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-600 text-xs mt-1 uppercase tracking-wider">DAYS</div>
                </div>
              </WidgetCardB>
            </div>
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-deadlines-b" title="Deadlines" icon={Target} accent="#f43f5e">
                <div className="text-zinc-400 text-sm font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Project submission</span>
                    <span className="text-xs font-mono text-rose-400">2d</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Review draft</span>
                    <span className="text-xs font-mono text-amber-400">5d</span>
                  </div>
                </div>
              </WidgetCardB>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* ── PROTOTYPE C: NEON GLASS ── */}
      {showC && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            PROTOTYPE C — NEON GLASS
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Dark glass panels with neon edge accents. Premium, polished, alive.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelC
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelC data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartC data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-goals-c" title="Goals" icon={Target} neonColor="#8b5cf6" kicker="TODAY">
                <div className="text-zinc-400 text-sm flex flex-col gap-1">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Write 500 words</span>
                  </div>
                </div>
              </WidgetCardC>
            </div>
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-streak-c" title="Streak" icon={Flame} neonColor="#f97316" kicker="CURRENT">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-500 text-xs mt-1">day streak</div>
                </div>
              </WidgetCardC>
            </div>
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-deadlines-c" title="Deadlines" icon={Target} neonColor="#f43f5e" kicker="UPCOMING">
                <div className="text-zinc-400 text-sm">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 mb-1">
                    <span className="text-xs text-zinc-300">Project submission</span>
                    <span className="text-xs font-mono text-rose-400">2d left</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Review draft</span>
                    <span className="text-xs font-mono text-amber-400">5d left</span>
                  </div>
                </div>
              </WidgetCardC>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-800/50">
        <p className="text-zinc-600 text-xs font-mono">
          Preview page — mock data. Not connected to live state.
          Component sources: prototypeA.ts, prototypeB.ts, prototypeC.ts
        </p>
      </div>
    </div>
  );
}

export default PrototypePreview;
