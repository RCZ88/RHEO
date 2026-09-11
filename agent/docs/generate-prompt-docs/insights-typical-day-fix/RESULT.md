<aside>
ℹ️

Verified against the actual `src/pages/InsightsPage.tsx` in your `src.zip` (1624 lines). All line numbers below are real. This is a single-file frontend change — no backend, no new packages.

</aside>

## 0. Diagnosis — why it's broken (plain answer)

1. **The two modes are wired to the wrong data + the wrong markup.** The complex 7×24 grid (gradient composition cells, rich tooltip, consistency bars) currently lives in the `typicalMode === 'smooth'` branch (lines **732–969**), and the simple single-day heatmap lives in `typicalMode === 'original'` (lines **564–729**). They are swapped.
2. **"Original only shows Today / one square lit up."** The current Original branch renders `originalDayData` — a *single day* aggregated from raw `logs`/`browserLogs` (computed at lines **281–333**), and hardcodes a single **"Today"** row (line **632**). Today's raw data is sparse, so you see one row with one bright cell.
3. **"Data not loading."** Original was never reading the backend `getTypicalDay` 7×24 grid (`patchedTypicalDay`, lines **255–271**) — that grid was being consumed by Smooth instead. So the rich multi-day data never appeared under the Original toggle.
4. **Hover tooltip / activity overlays / consistency** are all in the Smooth branch (lines **777–941**) because the complex grid is there. They belong in Original.

**Fix = move the complex grid to Original (fed by `patchedTypicalDay`), move the single-day view to Smooth (fed by `originalDayData`), keep `typicalMode` default `'smooth'`, then do a UI pass + add empty/loading/error states.**

<aside>
⚠️

**Constraint reality check.** Your mandate asks for shadcn / Magic UI / 21st.dev / MCP components, but Constraint #1 (single file, no new files) and #5 (no new npm packages) forbid installing them. I honor the constraints: the spec applies the *design principles* (4 states, purposeful motion, pink accent, Lucide-only icons, a11y) using the already-installed stack (`framer-motion`, `lucide-react`, `date-fns`, Tailwind). If you actually want the component libraries, that's a separate decision that breaks the single-file constraint — tell me and I'll re-scope.

</aside>

---

## 1. State + data changes (component body, near lines 160–190 / 335)

**1a. Add an error state and a reusable fetcher.** Replace the existing fetch effect (lines **186–195**) with a `useCallback` fetcher so the error UI can retry. Add `useCallback` to the React import.

```tsx
const [typicalError, setTypicalError] = useState<string | null>(null);

const fetchTypicalDay = useCallback(() => {
  const days = periodToDays(parentPeriod);
  setTypicalError(null);
  window.deskflowAPI?.getTypicalDay(days, dateOffset)
    .then((result: any) => {
      if (result?.grid) setTypicalDayData(result as TypicalDayData);
      else setTypicalError('empty');
    })
    .catch((e: any) => setTypicalError(e?.message || 'failed'));
}, [parentPeriod, dateOffset]);

useEffect(() => {
  fetchTypicalDay();
  const id = setInterval(fetchTypicalDay, 60000);
  return () => clearInterval(id);
}, [fetchTypicalDay]);
```

**1b. Shared helpers** — place once near the other `useMemo`s (~line 335), so both branches use them:

```tsx
const INSIGHTS_ACCENT = '#ec4899'; // --page-accent (pink)

const tdFmt = (s: number) =>
  s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`;

// Smooth: single-color emerald intensity
const smoothHeat = (seconds: number, max: number) => {
  if (seconds <= 0) return 'rgba(39,39,42,0.5)';
  const r = seconds / max;
  if (r > 0.75) return 'rgba(16,185,129,0.92)';
  if (r > 0.5)  return 'rgba(16,185,129,0.66)';
  if (r > 0.25) return 'rgba(16,185,129,0.42)';
  return 'rgba(16,185,129,0.20)';
};

// Original: multi-activity composition gradient (preserves existing logic)
const compositionBg = (cell: HourCell) => {
  if (!cell || cell.activities.length === 0) return 'rgba(39,39,42,0.5)';
  if (cell.activities.length === 1) {
    const s = cell.totalSeconds;
    if (s >= 2700) return 'rgba(16,185,129,0.9)';
    if (s >= 1200) return 'rgba(16,185,129,0.6)';
    if (s >= 300)  return 'rgba(16,185,129,0.35)';
    return 'rgba(16,185,129,0.15)';
  }
  const segs = cell.activities.map((a, i) => {
    const start = cell.activities.slice(0, i).reduce((acc, x) => acc + x.percentage, 0);
    return `${a.color} ${start}% ${start + a.percentage}%`;
  });
  return `linear-gradient(90deg, ${segs.join(', ')})`;
};

// Animation variants (purposeful, ease-out)
const tdEase = [0.16, 1, 0.3, 1] as const;
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.03, duration: 0.28, ease: tdEase } }),
};
const panelVariants = {
  hidden: { opacity: 0, x: 12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: tdEase } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.12 } },
};
```

**Lucide icons used below** — add any missing ones to the existing `lucide-react` import (line 6): `Clock`, `CalendarDays`, `Flame`, `Layers`, `Activity`, `AlertCircle`, `RefreshCw`, `Sparkles`, `Sun`.

---

## 2. Full replacement for lines 515–977

Replace the entire `{activeTab === 'typical' && ( … )}` block with the following. Preserve CRLF.

```tsx
{activeTab === 'typical' && (
  <motion.div data-section="insights.day" initial= opacity: 0, y: 8  animate= opacity: 1, y: 0  transition= duration: 0.3, ease: [0.16,1,0.3,1] >
    <GlassCard>
      {/* ===== Header + mode toggle ===== */}
      <div className="flex items-center justify-between mb-1">
        <SectionHeader
          title="Typical Day"
          icon={<Clock className="w-4 h-4" style= color: INSIGHTS_ACCENT  />}
          action={typicalMode === 'original' && typicalDayData && (
            <div className="text-[11px] text-zinc-600 font-mono">Updated {new Date(typicalDayData.generatedAt).toLocaleTimeString()}</div>
          )}
        />
        <div role="tablist" aria-label="Typical day view mode" className="flex bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/50 ml-4">
          {(['original','smooth'] as const).map(mode => {
            const active = typicalMode === mode;
            return (
              <button
                key={mode}
                role="tab"
                aria-selected={active}
                onClick={() => setTypicalMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 ${active ? 'text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                style={active ? { background: 'rgba(236,72,153,0.16)', borderColor: 'rgba(236,72,153,0.35)', boxShadow: 'inset 0 0 0 1px rgba(236,72,153,0.35)', color: '#f9a8d4' } : undefined}
              >
                {mode === 'original' ? 'Original' : 'Smooth'}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        {typicalMode === 'original'
          ? <>Your real weekly rhythm — averaged across {typicalDayData?.daysCovered ?? '…'} days. Each cell splits by activity; hover for the breakdown.</>
          : <>A clean look at how today is shaping up, hour by hour.</>}
      </p>

      {/* ============================================================= */}
      {/* ORIGINAL = backend 7×24 composition grid (patchedTypicalDay)  */}
      {/* ============================================================= */}
      {typicalMode === 'original' && (() => {
        // --- error state ---
        if (typicalError) {
          return (
            <div className="h-44 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm text-zinc-400">Couldn't load your weekly pattern.</p>
              <button onClick={fetchTypicalDay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-300 bg-zinc-800/70 hover:bg-zinc-700/70 transition focus-visible:ring-2 focus-visible:ring-pink-500/40">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          );
        }
        // --- loading skeleton (grid-shaped) ---
        if (!patchedTypicalDay) {
          return (
            <div className="animate-pulse">
              <div className="grid grid-cols-3 gap-3 mb-4">{[0,1,2].map(i => <div key={i} className="h-16 bg-zinc-800/60 rounded-xl" />)}</div>
              <div className="space-y-1">{Array.from({length:7}).map((_,i)=>(
                <div key={i} className="flex items-center gap-2"><div className="w-7 h-5 bg-zinc-800/40 rounded" /><div className="flex-1 h-7 bg-zinc-800/60 rounded" /></div>
              ))}</div>
            </div>
          );
        }
        const data = patchedTypicalDay;

        // consistency map (dominant-activity share per cell)
        const consistencyMap: { day: number; hour: number; score: number }[] = [];
        let totalC = 0, countC = 0;
        for (let d = 0; d < data.grid.length; d++) for (let h = 0; h < data.grid[d].length; h++) {
          const c = data.grid[d][h];
          const score = c.activities[0]?.percentage ?? 0;
          consistencyMap.push({ day: d, hour: h, score });
          if (c.totalSeconds > 0) { totalC += score; countC++; }
        }
        const avgConsistency = countC > 0 ? Math.round(totalC / countC) : 0;
        const consColor = (s: number) => s>=80?'bg-emerald-400':s>=60?'bg-emerald-500':s>=40?'bg-amber-500':s>=20?'bg-orange-500':'bg-red-500';
        const ringColor = avgConsistency>=70?'#34d399':avgConsistency>=40?'#f59e0b':'#f87171';

        const statCards = [
          { icon: Clock, label: 'Total Hours', value: `${data.stats.totalHours}h`, sub: 'avg / day' },
          { icon: CalendarDays, label: 'Most Active', value: DAY_LABELS[data.stats.mostActiveDay], sub: 'day of week' },
          { icon: Flame, label: 'Peak Hour', value: hourLabels[data.stats.mostActiveHour.hour], sub: DAY_LABELS[data.stats.mostActiveHour.day] },
        ];

        return (
          <>
            {/* stat cards with pink accent rail */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {statCards.map((s, i) => (
                <div key={i} className="relative bg-zinc-900/50 rounded-xl p-3 pl-4 overflow-hidden">
                  <span className="absolute left-0 top-0 bottom-0 w-[3px]" style= background: INSIGHTS_ACCENT  />
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wide"><s.icon className="w-3 h-3" />{s.label}</div>
                  <div className="text-xl font-bold text-zinc-100 mt-0.5 font-mono">{s.value}</div>
                  <div className="text-[10px] text-zinc-600">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* consistency summary: ring gauge + legend */}
            <div className="flex items-center gap-4 mb-3 px-1">
              <div className="relative w-9 h-9 shrink-0">
                <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(63,63,70,0.5)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(avgConsistency/100)*94.2} 94.2`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-zinc-200">{avgConsistency}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-300 font-medium">Schedule consistency</span>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-sm bg-red-500" />low
                  <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 ml-1" />med
                  <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400 ml-1" />high
                </div>
              </div>
            </div>

            {/* 7×24 composition grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="flex ml-7 mb-0.5">
                  {hourLabels.map((l, i) => (
                    <div key={i} className="flex-1 text-[9px] text-zinc-600 text-center leading-none pb-0.5" style= visibility: i % 3 === 0 ? 'visible' : 'hidden' >{l}</div>
                  ))}
                </div>
                <div className="space-y-[2px]">
                  {data.grid.map((dayData, dayIdx) => (
                    <motion.div key={dayIdx} custom={dayIdx} variants={rowVariants} initial="hidden" animate="show" className="flex items-center">
                      <div className="w-7 text-[10px] text-zinc-500 text-right pr-1 shrink-0 leading-none">{DAY_LABELS[dayIdx]}</div>
                      <div className="flex flex-1 gap-[2px]">
                        {dayData.map((cell, hourIdx) => {
                          const consScore = consistencyMap.find(c => c.day===dayIdx && c.hour===hourIdx)?.score ?? 0;
                          const dominant = cell.activities[0]?.activity || '';
                          const isHot = tooltip?.day===dayIdx && tooltip?.hour===hourIdx;
                          return (
                            <div
                              key={hourIdx}
                              role="button"
                              tabIndex={0}
                              aria-label={`${DAY_LABELS[dayIdx]} ${hourLabels[hourIdx]}: ${dominant || 'no activity'}, ${tdFmt(cell.totalSeconds)}`}
                              onMouseEnter={(e) => {
                                const tipW=210, tipH=170, gap=6, pad=8;
                                const rect = e.currentTarget.getBoundingClientRect();
                                let tx = rect.left, ty = rect.bottom + gap;
                                if (ty + tipH > window.innerHeight - pad) ty = rect.top - tipH - gap;
                                if (tx + tipW > window.innerWidth - pad) tx = rect.right - tipW;
                                tx = Math.max(pad, Math.min(tx, window.innerWidth - tipW - pad));
                                ty = Math.max(pad, Math.min(ty, window.innerHeight - tipH - pad));
                                setTooltip({ day: dayIdx, hour: hourIdx, x: tx, y: ty, side: 'bottom' });
                              }}
                              onFocus={(e) => { const r=e.currentTarget.getBoundingClientRect(); setTooltip({ day: dayIdx, hour: hourIdx, x: Math.min(r.left, window.innerWidth-218), y: r.bottom+6, side:'bottom' }); }}
                              onMouseLeave={() => setTooltip(null)}
                              onBlur={() => setTooltip(null)}
                              className={`flex-1 min-h-[30px] rounded-[3px] cursor-pointer relative flex items-center justify-center transition-all duration-150 focus-visible:outline-none ${isHot ? 'ring-2 ring-pink-400/70 scale-[1.18] z-10 brightness-110' : 'hover:brightness-125'}`}
                              style= background: compositionBg(cell) 
                            >
                              {dominant && cell.totalSeconds > 0 && (
                                <span className="text-[8px] font-medium text-white/85 truncate px-0.5 leading-none" title={dominant}>
                                  {dominant.length > 8 ? dominant.slice(0,8)+'…' : dominant}
                                </span>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-[3px]">
                                <div className={`h-full ${consColor(consScore)}`} style={{ width: `${consScore}%`, opacity: 0.85 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* rich tooltip (fixed, glass) */}
            <AnimatePresence>
              {tooltip && data.grid[tooltip.day]?.[tooltip.hour] && (() => {
                const cell = data.grid[tooltip.day][tooltip.hour];
                const cons = consistencyMap.find(c => c.day===tooltip.day && c.hour===tooltip.hour)?.score ?? 0;
                return (
                  <motion.div
                    initial= opacity: 0, scale: 0.96  animate= opacity: 1, scale: 1  exit= opacity: 0, scale: 0.96  transition= duration: 0.15, ease: [0.16,1,0.3,1] 
                    className="fixed z-50 rounded-xl p-3 min-w-[190px] border border-zinc-700/60 backdrop-blur-xl"
                    style= left: tooltip.x, top: tooltip.y, background: 'rgba(24,24,27,0.92)' 
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-200">{DAY_LABELS[tooltip.day]} {hourLabels[tooltip.hour]}</span>
                      <span className={`text-[10px] font-medium ${cons>=60?'text-emerald-400':cons>=40?'text-amber-400':'text-red-400'}`}>{cons}% consistent</span>
                    </div>
                    {cell.activities.length > 0 ? (
                      <div className="space-y-1">
                        {cell.activities.map((a, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-sm shrink-0" style= background: a.color  /><span className="text-[11px] text-zinc-300 truncate">{a.activity}</span></div>
                            <span className="text-[11px] text-zinc-400 shrink-0 font-mono">{tdFmt(a.seconds)} ({a.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-[11px] text-zinc-600">Quiet hour — nothing tracked.</div>}
                    <div className="mt-1.5 pt-1.5 border-t border-zinc-800 flex justify-between"><span className="text-[10px] text-zinc-500">Total</span><span className="text-[10px] text-zinc-400 font-mono">{tdFmt(cell.totalSeconds)}</span></div>
                    {(cell.hasExternal || cell.hasDevice) && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {cell.hasExternal && <span className="text-[9px] px-1 py-0.5 rounded" style= background:'rgba(236,72,153,0.18)', color:'#f9a8d4' >External</span>}
                        {cell.hasDevice && <span className="text-[9px] px-1 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">Device</span>}
                      </div>
                    )}
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* legend + intensity scale */}
            {data.legend.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-zinc-800/40">
                {data.legend.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style= background: item.color  /><span className="text-[11px] text-zinc-400">{item.activity}</span><span className="text-[10px] text-zinc-600 font-mono">{tdFmt(item.totalSeconds)}</span></div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-zinc-600">Less</span>
              {['rgba(16,185,129,0.15)','rgba(16,185,129,0.35)','rgba(16,185,129,0.6)','rgba(16,185,129,0.9)'].map((c,i)=>(<div key={i} className="w-3.5 h-3.5 rounded-sm" style= background: c  />))}
              <span className="text-[10px] text-zinc-600">More</span>
            </div>
          </>
        );
      })()}

      {/* ============================================================= */}
      {/* SMOOTH = single-day clean heatmap (originalDayData)           */}
      {/* ============================================================= */}
      {typicalMode === 'smooth' && (() => {
        const { slots, maxSeconds, legend, stats: dayStats } = originalDayData;
        const hasData = dayStats.totalHours > 0;

        // empty state (contextual, no "no data")
        if (!hasData) {
          return (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center"><Sun className="w-5 h-5" style= color: INSIGHTS_ACCENT  /></div>
              <p className="text-sm text-zinc-300">Today's still warming up.</p>
              <p className="text-xs text-zinc-500 max-w-[260px]">As you work through the day, your hours will fill in here. Check the <button onClick={()=>setTypicalMode('original')} className="text-pink-400 hover:underline">weekly pattern</button> for the bigger picture.</p>
            </div>
          );
        }

        const statCards = [
          { icon: Clock, label: 'Total Hours', value: `${dayStats.totalHours}h`, sub: 'today' },
          { icon: Flame, label: 'Peak Hour', value: hourLabels[dayStats.mostActiveHour.hour], sub: tdFmt(slots[dayStats.mostActiveHour.hour]?.totalSeconds || 0) },
          { icon: Layers, label: 'Activities', value: String(Object.keys(dayStats.activityBreakdown).length), sub: 'unique' },
        ];

        return (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {statCards.map((s,i)=>(
                <div key={i} className="relative bg-zinc-900/50 rounded-xl p-3 pl-4 overflow-hidden">
                  <span className="absolute left-0 top-0 bottom-0 w-[3px]" style= background: INSIGHTS_ACCENT  />
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wide"><s.icon className="w-3 h-3" />{s.label}</div>
                  <div className="text-xl font-bold text-zinc-100 mt-0.5 font-mono">{s.value}</div>
                  <div className="text-[10px] text-zinc-600">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex ml-7 mb-1">
                  {hourLabels.map((l,i)=>(<div key={i} className="flex-1 text-[9px] text-zinc-600 text-center leading-none" style= visibility: i%3===0?'visible':'hidden' >{l}</div>))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 text-[10px] text-zinc-500 text-right pr-1 shrink-0">Today</div>
                  <div className="flex flex-1 gap-[3px]">
                    {slots.map(slot => {
                      const hot = hoveredHour === slot.hour;
                      return (
                        <div
                          key={slot.hour}
                          role="button" tabIndex={0}
                          aria-label={`${hourLabels[slot.hour]}: ${slot.totalSeconds>0?tdFmt(slot.totalSeconds):'no activity'}`}
                          onMouseEnter={()=>setHoveredHour(slot.hour)} onFocus={()=>setHoveredHour(slot.hour)}
                          onMouseLeave={()=>setHoveredHour(null)} onBlur={()=>setHoveredHour(null)}
                          className={`flex-1 h-7 rounded-[4px] cursor-pointer transition-all duration-150 focus-visible:outline-none ${hot?'ring-2 ring-pink-400/70 scale-110 z-10 relative':''}`}
                          style= background: smoothHeat(slot.totalSeconds, maxSeconds) 
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* polished detail panel */}
              <AnimatePresence>
                {selectedHourData && (
                  <motion.div variants={panelVariants} initial="hidden" animate="show" exit="exit" className="w-52 shrink-0 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/40">
                    <div className="text-xs text-zinc-400 mb-1">{hourLabels[selectedHourData.hour]} – {hourLabels[(selectedHourData.hour+1)%24]}</div>
                    <div className="text-lg font-bold text-zinc-200 font-mono">{tdFmt(selectedHourData.totalSeconds)}</div>
                    {selectedHourData.activities.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {selectedHourData.activities.slice(0,5).map((a,i)=>(
                          <div key={i} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-sm shrink-0" style= background: a.color  /><span className="text-[11px] text-zinc-300 truncate">{a.name}</span></div>
                            <span className="text-[10px] text-zinc-500 shrink-0 font-mono">{tdFmt(a.seconds)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-xs text-zinc-600 mt-1">Quiet hour.</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* activity chips timeline */}
            <div className="mt-5 pt-4 border-t border-zinc-800/50">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Hourly breakdown</div>
              <div className="flex flex-wrap gap-2">
                {slots.filter(s => s.primaryActivity !== 'none' && s.totalSeconds > 0).map(slot => (
                  <div key={slot.hour}
                    onMouseEnter={()=>setHoveredHour(slot.hour)} onMouseLeave={()=>setHoveredHour(null)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${hoveredHour===slot.hour?'bg-zinc-700/60 ring-1 ring-pink-400/30':'bg-zinc-800/40 hover:bg-zinc-700/30'}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style= background: resolveActivityColor(slot.primaryActivity)  />
                    <span className="text-zinc-300 font-medium font-mono">{hourLabels[slot.hour]}</span>
                    <span className="text-zinc-400">{slot.primaryActivity.length>14?slot.primaryActivity.slice(0,14)+'…':slot.primaryActivity}</span>
                    <span className="text-zinc-600 ml-1 font-mono">{tdFmt(slot.totalSeconds)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* legend + intensity */}
            {legend.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-zinc-800/30">
                {legend.map((item,i)=>(<div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style= background: item.color  /><span className="text-[11px] text-zinc-400">{item.activity}</span><span className="text-[10px] text-zinc-600 font-mono">{tdFmt(item.totalSeconds)}</span></div>))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-zinc-600">Less</span>
              {['rgba(16,185,129,0.20)','rgba(16,185,129,0.42)','rgba(16,185,129,0.66)','rgba(16,185,129,0.92)'].map((c,i)=>(<div key={i} className="w-3.5 h-3.5 rounded-sm" style= background: c  />))}
              <span className="text-[10px] text-zinc-600">More</span>
            </div>
          </>
        );
      })()}
    </GlassCard>
  </motion.div>
)}
```

---

## 3. Required import touch-ups

- **React:** add `useCallback` (line ~1).
- **framer-motion:** ensure `AnimatePresence` is imported alongside `motion`.
- **lucide-react (line 6):** add `Clock, CalendarDays, Flame, Layers, AlertCircle, RefreshCw, Sun` (keep existing). No inline SVG except the consistency ring gauge (a data viz, not an icon — acceptable).
- **`HourCell` type** is already in scope (used by current Smooth block). No change.

---

## 4. Behavior after the change (maps 1:1 to your checklist)

- **A1 swap** → Original reads `patchedTypicalDay`, Smooth reads `originalDayData`; `typicalMode` default stays `'smooth'`. ✅
- **A2** → Original renders all 7 rows from `data.grid`; the hardcoded "Today" row is gone. ✅
- **A3/A4** → rich tooltip + per-cell consistency bar + avg consistency (now a ring gauge) live in Original. ✅
- **A5** → Smooth is a single 24-cell row, single-color emerald intensity, no splits/overlays/consistency, with a polished slide-in detail panel. ✅
- **B/C/D** → pink (`#ec4899`) accent on toggle + stat rails + hover rings; Lucide icons; `rounded-xl`; `font-mono` for numeric data; staggered row entrance; tooltip fade/scale (150ms); a11y (`role`, `tabIndex`, `aria-label`, focus-visible rings, keyboard focus drives tooltip/panel). ✅
- **4 states** → Original: skeleton (grid-shaped) + error+retry + populated; Smooth: contextual empty ("Today's still warming up") + populated. ✅

---

## 5. Verification

1. Toggle defaults to **Smooth**; shows today's single row + 3 single-day stat cards.
2. Switch to **Original** → full 7×24 grid, gradient composition cells, dominant-activity labels, consistency bars, ring gauge. Hover/focus a cell → glass tooltip with per-activity %, total, External/Device badges, consistency %, repositioning near edges.
3. With `parentPeriod = today` (so backend has <7 days) → Original still renders whatever the grid returns; if `patchedTypicalDay` is null you see the **skeleton**, and a thrown/empty fetch shows the **error + Retry**.
4. A day with no logs → Smooth shows the **contextual empty state**, not a broken grid.
5. Numbers render in JetBrains Mono; accent is pink everywhere; no purple toggle; keyboard Tab reaches cells and shows tooltip/panel.
6. `git diff` touches only `InsightsPage.tsx`; CRLF preserved; no other section reformatted.

---

## 6. If you really want shadcn / Magic UI / MCP components

That requires lifting Constraints #1 and #5 (installing packages + adding files for the component primitives). It's a meaningfully larger change (design-system setup, Tailwind config, re-skinning to DeskFlow tokens). Say the word and I'll produce a separate packet scoped for that path — but the spec above delivers the same *visual outcome* within your stated constraints.