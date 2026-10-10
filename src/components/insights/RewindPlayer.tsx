import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Share2, Palette, CalendarDays } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { ShareCard } from './ShareCard';
import { REWIND_THEMES, REWIND_THEME_MAP, loadRewindTheme, saveRewindTheme, resolveRewindThemeById, isLightTheme } from './rewind-themes';
import type { RewindTheme } from './rewind-themes';
import type { InsightAtom } from '../../shared/insights';
import {
  defaultRewindMonthKey,
  monthKeyOf,
  shiftMonth,
  monthLabelShort,
  isMonthComplete,
  daysInMonth,
} from '../../lib/rewindPeriod';

interface RewindPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RewindPlayer({ isOpen, onClose }: RewindPlayerProps) {
  const [rewind, setRewind] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [themeId, setThemeId] = useState<string>(loadRewindTheme);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const api = window.deskflowAPI;

  // A rewind is a RETROSPECTIVE, so it opens on the last month that actually
  // happened. It used to open on the current month, which on the 1st meant a
  // recap of one mostly-empty day — the thing you open a rewind to avoid.
  const [periodKey, setPeriodKey] = useState<string>(defaultRewindMonthKey);

  /* Is light mode on RIGHT NOW? It is read from <html> rather than assumed,
     and it is state, because the palette has to re-resolve when the theme flips
     while the modal is open - otherwise the player keeps the colours it was
     built with and goes white-on-white the moment the user toggles. */
  const [isLight, setIsLight] = useState<boolean>(isLightTheme);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || !document.documentElement) return;
    const mo = new MutationObserver(() => setIsLight(isLightTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsLight(isLightTheme());
    return () => mo.disconnect();
  }, []);

  const theme: RewindTheme = resolveRewindThemeById(themeId, REWIND_THEME_MAP, isLight);

  const currentMonth = monthKeyOf();
  const isComplete = isMonthComplete(periodKey);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setCurrentIdx(0);
    setShowShare(false);
    setShowThemePicker(false);
    // Reset to the default period each time it is opened, so a session that
    // browsed back five months doesn't re-open on a half-remembered one.
    setPeriodKey(defaultRewindMonthKey());

    if (api?.getRewind) {
      api.getRewind(periodKey).then((data: any) => {
        setRewind(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isOpen, periodKey]);

  const insights: InsightAtom[] = rewind?.insights || [];
  const current: InsightAtom | undefined = insights[currentIdx];

  const goNext = useCallback(() => {
    if (currentIdx < insights.length - 1) {
      setCurrentIdx(i => i + 1);
      setShowShare(false);
    }
  }, [currentIdx, insights.length]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(i => i - 1);
      setShowShare(false);
    }
  }, [currentIdx]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, goNext, goPrev, onClose]);

  const handleThemeChange = (id: string) => {
    setThemeId(id);
    saveRewindTheme(id);
    setShowThemePicker(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-[9999]" onClick={(e) => e.stopPropagation()}>
      <div className={`relative w-full h-full flex flex-col overflow-hidden transition-colors duration-500 ${theme.headerBg}`} style={{ background: theme.bgHex }}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 transition-colors duration-300`} style={{ borderColor: theme.borderHex }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-sm font-semibold flex-shrink-0 ${theme.headline}`}>Your Rewind</span>

            {/* Month navigator. Prev is always available; next stops at the
                current month, because there is no future to rewind to. */}
            <div className={`flex items-center gap-0.5 rounded-lg ${theme.accentBg}`}>
              <button
                onClick={() => setPeriodKey(k => shiftMonth(k, -1))}
                className={`p-1.5 rounded-l-lg ${theme.subtext} hover:opacity-80`}
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span
                className={`px-2 py-1 text-xs font-medium tabular-nums whitespace-nowrap ${theme.label}`}
                title={isComplete
                  ? `${daysInMonth(periodKey)} days`
                  : `${daysInMonth(periodKey)} days — still in progress`}
              >
                {monthLabelShort(periodKey)}
              </span>
              <button
                onClick={() => setPeriodKey(k => shiftMonth(k, 1))}
                disabled={periodKey >= currentMonth}
                className={`p-1.5 rounded-r-lg ${theme.subtext} hover:opacity-80 disabled:opacity-25 disabled:cursor-not-allowed`}
                title={periodKey >= currentMonth ? 'No future months to rewind' : 'Next month'}
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isComplete && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme.muted} flex-shrink-0`}>
                in progress
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Theme picker */}
            <div className="relative">
              <button
                onClick={() => setShowThemePicker(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${theme.accentBg} ${theme.label} hover:opacity-80`}
                title="Change theme"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{theme.name}</span>
              </button>
              <AnimatePresence>
                {showThemePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 z-50 rounded-xl border p-2 min-w-[200px] shadow-2xl"
                    style={{ background: theme.bgHex, borderColor: theme.borderHex }}
                  >
                    <div className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1.5 mb-1 ${theme.muted}`}>
                      Card Theme
                    </div>
                    {REWIND_THEMES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                          t.id === themeId
                            ? `${t.accentBg} ${t.accent}`
                            : `hover:bg-white/5 ${theme.subtext}`
                        }`}
                      >
                        <span className="text-base">{t.icon}</span>
                        <span className="text-xs font-medium">{t.name}</span>
                        {t.id === themeId && (
                          <div className={`ml-auto w-1.5 h-1.5 rounded-full ${t.accent.replace('text-', 'bg-')}`} />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {current && current.shareable && (
              <button
                onClick={() => setShowShare(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${theme.accentBg} ${theme.label} hover:opacity-80`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme.muted} hover:opacity-80`}
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 flex-shrink-0">
          <div className="flex gap-1 h-0.5">
            {insights.map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  i <= currentIdx ? theme.progressFill : theme.progressBg
                }`}
              />
            ))}
          </div>
        </div>

        {/* Period summary. The archetype was computed by the engine and shipped
            in the payload, but nothing ever rendered it — so the one sentence
            that tells you what the month was ABOUT was invisible. */}
        {!loading && rewind?.archetype && insights.length > 0 && (
          <div className={`flex items-center gap-2 px-6 py-2.5 flex-shrink-0 text-xs ${theme.muted}`}>
            <span className={`font-medium flex-shrink-0 ${theme.label}`}>{rewind.archetype.name}</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span className="truncate">{rewind.archetype.description}</span>
            <span className="ml-auto flex-shrink-0 flex items-center gap-1 tabular-nums whitespace-nowrap">
              <CalendarDays className="w-3.5 h-3.5 opacity-60" />
              {rewind.daysTracked ?? 0}/{rewind.summary?.totalDays ?? 0} days tracked
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className={`w-8 h-8 border-2 rounded-full animate-spin ${theme.spinner}`} />
              <span className={`text-sm ${theme.muted}`}>Building your rewind...</span>
            </div>
          ) : !current ? (
            /* Distinguish a month that was never tracked from a tracked month
               that happened to produce nothing interesting — "no insights" and
               "no data" are different facts and both used to render as the
               same sentence. */
            <div className="text-center max-w-sm">
              <p className={`text-lg ${theme.subtext}`}>
                {rewind?.daysTracked === 0
                  ? `Nothing tracked in ${monthLabelShort(periodKey)}`
                  : `No standout moments in ${monthLabelShort(periodKey)}`}
              </p>
              <p className={`text-sm mt-1.5 ${theme.muted}`}>
                {rewind?.daysTracked === 0
                  ? 'Rewinds are built from your tracked activity. Use the arrows above to try an earlier month.'
                  : `You were active on ${rewind?.daysTracked ?? 0} ${rewind?.daysTracked === 1 ? 'day' : 'days'} — just nothing unusual enough to flag. Use the arrows above for an earlier month.`}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-lg"
              >
                {showShare ? (
                  <ShareCard atom={current} width={400} themeId={themeId} />
                ) : (
                  <InsightCard atom={current} themeId={themeId} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Navigation */}
        {!loading && insights.length > 0 && (
          <div className={`flex items-center justify-between px-6 py-4 border-t flex-shrink-0 transition-colors duration-300`} style={{ borderColor: theme.borderHex }}>
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${theme.subtext} hover:opacity-80`}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <div className="flex items-center gap-2">
              <span className={`text-xs ${theme.muted}`}>
                {currentIdx + 1} / {insights.length}
              </span>
            </div>

            <button
              onClick={goNext}
              disabled={currentIdx === insights.length - 1}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${theme.subtext} hover:opacity-80`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
