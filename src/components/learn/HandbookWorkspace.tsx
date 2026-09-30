// HandbookWorkspace.tsx — Terminal Handbook workspace with AI explain feature
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, ChevronRight, ChevronLeft, Sparkles, AlertTriangle, ArrowUp, Play, Terminal, BookOpen, RefreshCw, ExternalLink } from 'lucide-react';
import { getHandbookData } from '../../services/learn/handbook-data';
import { explainCommand } from '../../agents/handbookPromptAgent';
import { extractJsonBlock } from '@/components/ai-bridge/parse';
import type { HandbookData, HandbookSection, HandbookCommand } from '../../services/learn/handbook-data';
import type { HandbookCommandResponse } from '../../agents/handbookPromptAgent';

const api = (window as any).deskflowAPI;

// ── Depth colors from HTML ──
const DEPTH_STYLES: Record<string, { color: string; bg: string; border: string; dot: string; label: string }> = {
core:   { color: 'text-cyan-400', bg: 'bg-cyan-400/8', border: 'border-cyan-400/35', dot: 'bg-cyan-400', label: 'core' },
  daily:  { color: 'text-[var(--hb-green)]', bg: 'bg-[color-mix(in_srgb,var(--hb-green)_12,transparent)]', border: 'border-[color-mix(in_srgb,var(--hb-green)_35,transparent)]', dot: 'bg-[var(--hb-green)]', label: 'daily' },
  power:  { color: 'text-[var(--hb-violet)]', bg: 'bg-[color-mix(in_srgb,var(--hb-violet)_12,transparent)]', border: 'border-[color-mix(in_srgb,var(--hb-violet)_35,transparent)]', dot: 'bg-[var(--hb-violet)]', label: 'power' },
  rescue: { color: 'text-[var(--hb-rose)]', bg: 'bg-[color-mix(in_srgb,var(--hb-rose)_10,transparent)]', border: 'border-[color-mix(in_srgb,var(--hb-rose)_35,transparent)]', dot: 'bg-[var(--hb-rose)]', label: 'rescue' },
  sudo:   { color: 'text-[var(--hb-amber)]', bg: 'bg-[color-mix(in_srgb,var(--hb-amber)_12,transparent)]', border: 'border-[color-mix(in_srgb,var(--hb-amber)_35,transparent)]', dot: 'bg-[var(--hb-amber)]', label: 'sudo' },
};

function Badge({ type, label }: { type: string; label: string }) {
  const s = DEPTH_STYLES[type] || DEPTH_STYLES.core;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[9.5px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded border ${s.bg} ${s.color} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

// ── Typing Terminal Animation ──
const TERMINAL_SCRIPT = [
  { in: 'man fear', out: ['No manual entry for fear'] },
  { in: 'grep -rn "answer" ~/life', out: ['Binary file /dev/brain matches'] },
  { in: 'sudo dnf install confidence', out: ['Already installed.', 'Nothing to do.', 'Complete!'] },
  { in: 'ls -lah ~/handbook', out: ['drwxr-xr-x  cleme  18 sections  readable'] },
];

function TypingTerminal() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    let timers: NodeJS.Timeout[] = [];

    function typeLine() {
      if (!bodyRef.current) return;
      const body = bodyRef.current;
      body.innerHTML = '';
      const s = TERMINAL_SCRIPT[idxRef.current % TERMINAL_SCRIPT.length];
      idxRef.current++;

      const line = document.createElement('div');
      line.className = 'mb-1 whitespace-pre-wrap break-all';
      line.innerHTML = '<span class="text-[var(--hb-green)] select-none">$ </span><span class="text-[var(--hb-txt)]"></span><span class="inline-block w-2 h-[15px] bg-[var(--hb-green)] align-[-2px] animate-pulse"></span>';
      body.appendChild(line);

      const inp = line.querySelector('span:nth-child(2)') as HTMLSpanElement;
      let i = 0;
      const tid = setInterval(() => {
        if (inp) inp.textContent = s.in.slice(0, ++i);
        if (i >= s.in.length) {
          clearInterval(tid);
          const cursor = line.querySelector('span:nth-child(3)');
          if (cursor) cursor.remove();
          setTimeout(() => {
            s.out.forEach((o, k) => {
              const t2 = setTimeout(() => {
                const d = document.createElement('div');
                d.className = `mb-1 ${o.includes('Complete') ? 'text-[var(--hb-green)]' : 'text-[var(--hb-dim)]'}`;
                d.textContent = o;
                body.appendChild(d);
                if (k === s.out.length - 1) {
                  const t3 = setTimeout(typeLine, 1600);
                  timers.push(t3);
                }
              }, 250 * (k + 1));
              timers.push(t2);
            });
          }, 350);
        }
      }, 55);
      timers.push(tid);
    }

    typeLine();
    return () => timers.forEach(clearInterval);
  }, []);

  return (
    <div className="bg-[var(--hb-bg)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl shadow-none overflow-hidden mb-7">
      <div className="flex items-center gap-[7px] px-3.5 py-2.5 bg-[var(--hb-bg2)] border-b border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
        <span className="w-[11px] h-[11px] rounded-full bg-[var(--hb-rose)]" />
        <span className="w-[11px] h-[11px] rounded-full bg-[var(--hb-amber)]" />
        <span className="w-[11px] h-[11px] rounded-full bg-green-500" />
        <span className="ml-2 font-mono text-[11px] text-[var(--hb-dim)]">~/handbook</span>
      </div>
      <div ref={bodyRef} className="px-5 py-4 font-mono text-[13.5px] min-h-[88px]" />
    </div>
  );
}

// ── AI Response Types ──
interface ParamBreakdown {
  flag?: string;
  arg?: string;
  meaning: string;
  type: 'boolean' | 'path' | 'pattern' | 'value' | 'placeholder';
}

interface Exercise {
  title: string;
  command: string;
  explanation: string;
}

interface RelatedCommand {
  command: string;
  relation: string;
}

interface SafetyInfo {
  level: 'safe' | 'careful' | 'destructive';
  note: string;
}

interface CommandExplanation {
  what: string;
  when: string;
  gotcha?: string;
}

interface HandbookCommandResponse {
  type: 'handbook_command_response';
  version: string;
  command: string;
  title: string;
  estimatedMinutes: number;
  explanation: CommandExplanation;
  params: ParamBreakdown[];
  safety: SafetyInfo;
  exercises: Exercise[];
  related: RelatedCommand[];
  contextUsed: {
    chatHistoryLength: number;
    sectionId: string;
    userLevel: string;
  };
}

export function HandbookWorkspace() {
  const [data, setData] = useState<HandbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

// AI feature state
    const [aiLoadingCmd, setAiLoadingCmd] = useState<string | null>(null);
    const [aiResponse, setAiResponse] = useState<HandbookCommandResponse | null>(null);
    const [aiErrorCmd, setAiErrorCmd] = useState<string | null>(null);
    const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
    const [aiNotes, setAiNotes] = useState<{ command: string; explanation: string; category: string }[]>([]);

    // Practice mode state
   const [activeTab, setActiveTab] = useState<'sections' | 'practice'>('sections');
   const [practiceInput, setPracticeInput] = useState('');
   const [practiceOutput, setPracticeOutput] = useState<string | null>(null);
   const [practiceLoading, setPracticeLoading] = useState(false);
   const [practiceError, setPracticeError] = useState<string | null>(null);
   const [practiceCmdMeta, setPracticeCmdMeta] = useState<{ command: string; depth: string } | null>(null);
   const [featureIntegrating, setFeatureIntegrating] = useState(false);
   const [streakData, setStreakData] = useState<number | null>(null);
   const [achievementsData, setAchievementsData] = useState<any[] | null>(null);

    // Flashcard study state
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [flashcardDeck, setFlashcardDeck] = useState<any[]>([]);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [flashcardReviewing, setFlashcardReviewing] = useState(false);
    const [flashcardRating, setFlashcardRating] = useState<number | null>(null);

    // Command usage tracking state
    const [commandUsage, setCommandUsage] = useState<any[]>([]);

  // Scroll state
  const [scrollPct, setScrollPct] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getHandbookData().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  // Scroll progress + top button
  const handleScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    setScrollPct(Math.min(pct * 100, 100));
    setShowTop(el.scrollTop > 600);
  }, []);

  // / keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Fetch command usage stats when practice tab is active
  useEffect(() => {
    if (activeTab === 'practice' && api?.learnGetCommandUsage) {
      api.learnGetCommandUsage({ limit: 10 }).then((r: any) => {
        if (r?.data) setCommandUsage(r.data);
      }).catch(() => {});
    }
  }, [activeTab]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.sections;
    const q = query.toLowerCase();
    return data.sections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.commands.some(c => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
  }, [query, data]);

  const totalCmds = data?.commands?.length ?? 0;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(text);
      setTimeout(() => setCopiedCmd(null), 1500);
    } catch (e) {
      console.error('[Handbook] Copy failed:', e);
    }
  };

  const handleExplain = async (cmd: HandbookCommand, section: HandbookSection) => {
    setAiLoadingCmd(cmd.command);
    setAiErrorCmd(null);
    setExpandedCmd(cmd.command);

    const result = await explainCommand({
      command: cmd.command,
      section: { id: section.id, title: section.title, why: section.why },
      commandData: {
        depth: cmd.depth,
        description: cmd.description,
        gotchas: cmd.gotchas,
        params: cmd.params,
        badges: cmd.badges,
      },
      chatHistory: [],
      userLevel: 'beginner',
    });

    if (result.success && result.data) {
      setAiResponse(result.data);
    } else {
      setAiErrorCmd(cmd.command);
    }
    setAiLoadingCmd(null);
  };

  // ── Practice: execute command via learn:runCode ──
  const handleRunCode = async (cmd: string, depth: string) => {
    if (!api?.learnRunCode) { setPracticeError('No execution endpoint available.'); return; }
    setPracticeLoading(true);
    setPracticeOutput(null);
    setPracticeError(null);
    setPracticeCmdMeta({ command: cmd, depth });
    try {
      const lang = cmd.match(/^(python|py|node|nodejs|bash|sh|curl|wget)\s/)?.[1] || 'shell';
      const result = await api.learnRunCode({ lang, code: cmd });
      const commandName = cmd.split(/\s+/)[0] || 'shell';
      const category = depth === 'core' ? 'core' : depth === 'power' ? 'power' : depth === 'rescue' ? 'rescue' : depth === 'sudo' ? 'sudo' : 'daily';
      if (api.learnTrackCommandUsage) {
        try { await api.learnTrackCommandUsage({ command: commandName, category }); } catch { /* non-critical */ }
      }
      if (result?.ok) {
        setPracticeOutput(result.stdout || '(no output)');
      } else {
        setPracticeError(result?.stderr || result?.error || 'Execution failed.');
      }
    } catch (e: any) {
      setPracticeError(e.message || 'Run failed.');
    }
    setPracticeLoading(false);
  };

  // ── Feature integration: persist practice to learner profile ──
  const persistPractice = async (command: string, success: boolean) => {
    if (!api) return;
    setFeatureIntegrating(true);
    try {
      await api.learnSetProfile({ key: 'handbook.lastPracticed', value: command });
      await api.learnSetProfile({ key: 'handbook.practiceCount', value: String((parseInt(localStorage.getItem('handbook-practiceCount') || '0') + 1)) });
      localStorage.setItem('handbook-practiceCount', String((parseInt(localStorage.getItem('handbook-practiceCount') || '0') + 1)));
      await api.learnAddNote({ nodeId: 'handbook', text: `Practiced: ${command} — ${success ? 'success' : 'failed'}`, tags: ['handbook-practice'] });
      const streak = await api.learnGetStreak();
      if (streak?.data) setStreakData(streak.data);
      const achievements = await api.learnGetAchievements();
      if (achievements?.data) setAchievementsData(achievements.data);
    } catch (e) { /* non-critical */ }
    setFeatureIntegrating(false);
  };

  // ── Flashcard study: generate and load deck ──
  const loadFlashcards = async (cmd: string) => {
    if (!api?.learnGenerateCards) return;
    try {
      const gen = await api.learnGenerateCards({ deckId: 'handbook', nodeContent: cmd });
      const deck = gen?.data?.cards || [];
      setFlashcardDeck(deck);
      setFlashcardIndex(0);
      setShowFlashcards(true);
    } catch (e) { /* no cards generated */ }
  };

  const reviewCard = async (rating: number) => {
    if (!api?.learnSubmitCardReview || flashcardDeck.length === 0) return;
    try {
      await api.learnSubmitCardReview({ cardId: flashcardDeck[flashcardIndex].id, rating });
    } catch (e) { /* non-critical */ }
    const next = flashcardIndex + 1;
    if (next >= flashcardDeck.length) { setShowFlashcards(false); setFlashcardDeck([]); }
    else setFlashcardIndex(next);
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--hb-bg)]">
        <p className="text-[var(--hb-dim)] text-sm font-mono">Loading handbook...</p>
      </div>
    );
  }

  return (
    <div className="hb-scope flex-1 flex min-h-0 overflow-hidden bg-[var(--hb-bg)] relative">
      <div className="hb-substrate" aria-hidden="true" />
      {/* Scroll progress bar */}
      <div
        className="hb-progress fixed top-0 left-0 h-[2px] z-[99] transition-[width] duration-100 linear"
        style={{ width: `${scrollPct}%` }}
      />

      {/* Tab bar */}
      <div className="fixed top-[2px] left-64 z-50 flex gap-0 h-10">
        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center gap-2 px-4 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'sections' ? 'text-[var(--hb-green)] border-[var(--hb-green)] bg-[var(--hb-bg2)]' : 'text-[var(--hb-dim)] border-transparent hover:text-[var(--hb-txt)]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Sections
        </button>
        <button
          onClick={() => setActiveTab('ai-notes')}
          className={`flex items-center gap-2 px-4 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'ai-notes' ? 'text-[var(--hb-violet)] border-[var(--hb-violet)] bg-[var(--hb-bg2)]' : 'text-[var(--hb-dim)] border-transparent hover:text-[var(--hb-txt)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> AI Notes
        </button>
        <button
          onClick={() => setActiveTab('practice')}
          className={`flex items-center gap-2 px-4 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'practice' ? 'text-[var(--hb-green)] border-[var(--hb-green)] bg-[var(--hb-bg2)]' : 'text-[var(--hb-dim)] border-transparent hover:text-[var(--hb-txt)]'
          }`}
        >
          <Play className="w-3.5 h-3.5" /> Practice
        </button>
      </div>

      {/* Sidebar */}
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] bg-gradient-to-b from-[var(--hb-bg2)] to-[var(--hb-bg)] p-5">
        <div className="pb-5 mb-4 border-b border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
          <div className="font-mono text-[15px] text-[var(--hb-green)]"><b className="text-[var(--hb-txt)] font-semibold">~/handbook</b> $</div>
          <div className="text-[11px] text-[var(--hb-dim)] mt-1.5 tracking-wider uppercase">THE TERMINAL, HUMAN-READABLE</div>
        </div>

        {activeTab === 'sections' && (
          <nav className="space-y-1">
            {data.sections.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id);
                  mainRef.current?.scrollTo({ top: 0 });
                }}
                className={`flex items-baseline gap-2.5 w-full text-left px-3 py-1.5 text-[13px] rounded transition-colors ${
                  activeSection === s.id
                    ? 'text-[var(--hb-green)] bg-gradient-to-r from-[color-mix(in_srgb,var(--hb-green)_12,transparent)] to-transparent border-l-2 border-[var(--hb-green)]'
                    : 'text-[var(--hb-dim)] hover:text-[var(--hb-txt)] border-l-2 border-transparent'
                }`}
              >
                <span className="font-mono text-[10.5px] text-[var(--hb-dim)] w-5 shrink-0">{s.number}</span>
                {s.title}
              </button>
            ))}
          </nav>
        )}

        {activeTab === 'practice' && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hb-dim)] mb-2">Streak</div>
            <div className="font-mono text-[var(--hb-green)] text-lg font-bold">{streakData ?? '—'}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hb-dim)] mt-4 mb-2">Achievements</div>
            <div className="text-[var(--hb-txt)] text-xs space-y-1">
              {(achievementsData || []).slice(0, 5).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[var(--hb-amber)]">●</span> {a.key || a.badgeKey || 'Achievement'}
                </div>
              ))}
              {(achievementsData || []).length === 0 && <div className="text-[var(--hb-dim)]">None yet</div>}
            </div>
            <div className="mt-6 pt-4 border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hb-dim)] mb-2">Practice Count</div>
              <div className="font-mono text-[var(--hb-green)]">{localStorage.getItem('handbook-practiceCount') || '0'}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hb-dim)] mb-2">Command Usage</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {commandUsage.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-400">{c.command}</span>
                    <span className="text-[var(--hb-dim)]">{c.total}×</span>
                  </div>
                ))}
                {commandUsage.length === 0 && <div className="text-[var(--hb-dim)]">No commands yet</div>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hb-dim)] mb-3">Depth</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DEPTH_STYLES).map(([key, s]) => (
              <span key={key} className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded-full border ${s.bg} ${s.color} ${s.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-12 py-10 min-w-0 max-w-[880px] relative">
        {activeTab === 'practice' ? (
          <div>
            {/* Practice hero */}
            <header className="pt-8 pb-8">
              <div className="font-mono text-[12px] text-[var(--hb-dim)] tracking-[2px] uppercase mb-3.5">interactive practice</div>
              <h1 className="text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.5px] leading-[1.15] mb-4 text-[var(--hb-txt)]">
                Type a command. <em className="text-[var(--hb-green)] not-italic">Run it.</em> Learn it.
              </h1>
              <p className="text-[var(--hb-dim)] max-w-[600px] text-[15.5px] mb-7">
                Execute real terminal commands via <code className="text-cyan-400">learn:runCode</code>, then review flashcards and track your streak.
              </p>
            </header>

            {/* Practice terminal */}
            <div className="bg-[var(--hb-bg)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl overflow-hidden mb-7 shadow-none">
              <div className="flex items-center gap-[7px] px-3.5 py-2.5 bg-[var(--hb-bg2)] border-b border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)]">
                <span className="w-[11px] h-[11px] rounded-full bg-[var(--hb-rose)]" />
                <span className="w-[11px] h-[11px] rounded-full bg-[var(--hb-amber)]" />
                <span className="w-[11px] h-[11px] rounded-full bg-green-500" />
                <span className="ml-2 font-mono text-[11px] text-[var(--hb-dim)]">~/handbook/practice</span>
              </div>
              <div className="px-5 py-4 font-mono text-[13.5px] min-h-[120px]">
                <div className="mb-4">
                  <span className="text-[var(--hb-green)] select-none">$ </span>
                  <input
                    type="text"
                    value={practiceInput}
                    onChange={e => setPracticeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { handleRunCode(practiceInput, 'daily'); setPracticeInput(''); } }}
                    placeholder="type a command and press Enter"
                    className="flex-1 bg-transparent border-none outline-none text-[var(--hb-txt)] font-mono text-[13.5px] placeholder:text-[var(--hb-dim)] w-full"
                    autoFocus
                  />
                </div>
                {practiceLoading && <div className="text-[var(--hb-dim)] text-xs mb-2"><span className="inline-block w-2 h-[15px] bg-[var(--hb-green)] animate-pulse"></span> executing...</div>}
                {practiceOutput && <div className="text-[var(--hb-green)] whitespace-pre-wrap mb-2">{practiceOutput}</div>}
                {practiceError && <div className="text-[var(--hb-rose)] whitespace-pre-wrap mb-2">{practiceError}</div>}
                {featureIntegrating && <div className="text-[var(--hb-dim)] text-[11px]">persisting to learner profile...</div>}
              </div>
              <div className="px-3.5 py-2.5 border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] flex gap-2 flex-wrap">
                <button
                  onClick={() => { handleRunCode(practiceInput, 'daily'); setPracticeInput(''); }}
                  disabled={practiceLoading || !practiceInput.trim()}
                  className="flex items-center gap-1 font-mono text-[11px] px-5 py-4 rounded-xl bg-[var(--hb-green)] text-[var(--hb-dim)] font-semibold hover:bg-[var(--hb-green)] transition-colors disabled:opacity-40"
                >
                  <Play className="w-3 h-3" /> Run
                </button>
                {practiceCmdMeta && (
                  <>
                    <button
                      onClick={() => { persistPractice(practiceCmdMeta.command, !practiceError); setPracticeInput(''); }}
                      className="flex items-center gap-1 font-mono text-[11px] px-3 py-1.5 rounded-xl border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] text-[var(--hb-green)] hover:border-[var(--hb-green)] transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" /> Persist
                    </button>
                    <button
                      onClick={() => { loadFlashcards(practiceCmdMeta.command); setPracticeInput(''); }}
                      className="flex items-center gap-1 font-mono text-[11px] px-3 py-1.5 rounded-xl border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] text-[var(--hb-violet)] hover:border-[var(--hb-violet)] transition-colors"
                    >
                      <BookOpen className="w-3 h-3" /> Flashcards
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Flashcard study overlay */}
            <AnimatePresence>
              {showFlashcards && flashcardDeck.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-[var(--hb-bg2)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl px-5 py-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hb-dim)]">Flashcard {flashcardIndex + 1}/{flashcardDeck.length}</span>
                    <button onClick={() => setShowFlashcards(false)} className="text-[var(--hb-dim)] hover:text-[var(--hb-txt)] text-xs">✕ close</button>
                  </div>
                  <div className="text-[var(--hb-txt)] text-sm mb-4 font-mono">{flashcardDeck[flashcardIndex]?.question || flashcardDeck[flashcardIndex]?.front || 'No question'}</div>
                  <div className="flex gap-2">
                    <button onClick={() => reviewCard(1)} className="flex-1 font-mono text-[11px] px-3 py-2 rounded-xl border border-[var(--hb-green)] text-[var(--hb-green)] hover:bg-[color-mix(in_srgb,var(--hb-green)_10,transparent)]">Again</button>
                    <button onClick={() => reviewCard(2)} className="flex-1 font-mono text-[11px] px-3 py-2 rounded-xl border border-[var(--hb-amber)] text-[var(--hb-amber)] hover:bg-[color-mix(in_srgb,var(--hb-amber)_10,transparent)]">Hard</button>
                    <button onClick={() => reviewCard(3)} className="flex-1 font-mono text-[11px] px-3 py-2 rounded-xl border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10">Good</button>
                    <button onClick={() => reviewCard(4)} className="flex-1 font-mono text-[11px] px-3 py-2 rounded-xl border border-[var(--hb-violet)] text-[var(--hb-violet)] hover:bg-[color-mix(in_srgb,var(--hb-violet)_10,transparent)]">Easy</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : activeSection ? (
          <SectionDetail
            section={data.sections.find(s => s.id === activeSection)!}
            onBack={() => setActiveSection(null)}
            copiedCmd={copiedCmd}
            onCopy={handleCopy}
            onExplain={handleExplain}
            aiLoadingCmd={aiLoadingCmd}
            aiResponse={aiResponse}
            aiErrorCmd={aiErrorCmd}
            expandedCmd={expandedCmd}
            onToggleExpand={(cmd) => setExpandedCmd(expandedCmd === cmd ? null : cmd)}
          />
        ) : (
          <>
            {/* Hero */}
            <header className="pt-16 pb-11">
              <div className="font-mono text-[12px] text-[var(--hb-dim)] tracking-[2px] uppercase mb-3.5">a field guide, not a textbook</div>
              <h1 className="text-[clamp(30px,4.5vw,44px)] font-bold tracking-[-0.5px] leading-[1.15] mb-4 text-[var(--hb-txt)]">
                You don't need to <em className="text-[var(--hb-green)] not-italic">memorize</em> the terminal.<br/>
                You need to <em className="text-[var(--hb-green)] not-italic">read</em> it.
              </h1>
              <p className="text-[var(--hb-dim)] max-w-[600px] text-[15.5px] mb-7">
                Every command below says what it does, when to reach for it, and the gotcha that bites beginners.
              </p>

              {/* Typing terminal */}
              <TypingTerminal />

              {/* Depth legend */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="font-mono text-[11px] text-[var(--hb-dim)] mr-1">depth:</span>
                {Object.entries(DEPTH_STYLES).map(([key, s]) => (
                  <span key={key} className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-[11px] py-1 rounded-full border ${s.bg} ${s.color} ${s.border}`}>
                    <span className={`w-[7px] h-[7px] rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                ))}
              </div>
            </header>

            {/* Search */}
            <div className="sticky top-0 z-20 py-4 mb-4" style={{ background: 'linear-gradient(180deg, #0a0e14 78%, transparent)' }}>
              <div className="flex items-center gap-2.5 bg-[var(--hb-bg2)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl px-5 py-4 transition-[border-color,box-shadow] focus-within:border-[var(--page-accent)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--hb-green)_30,transparent)]">
                <span className="font-mono text-[var(--hb-green)] text-sm select-none">$</span>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="grep the handbook..."
                  className="flex-1 bg-transparent border-none outline-none text-[var(--hb-txt)] font-mono text-[13.5px] placeholder:text-[var(--hb-dim)]"
                />
                <kbd className="font-mono text-[10px] text-[var(--hb-dim)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded px-1.5 py-0.5">/</kbd>
              </div>
              <div className="font-mono text-[11px] text-[var(--hb-dim)] mt-1.5 pl-1">
                {query ? `${filtered.reduce((n, s) => n + s.commands.length, 0)} matches` : `${totalCmds} commands · press / to search`}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-16">
              {filtered.map(s => (
                <section key={s.id} id={s.id} className="scroll-mt-6 mb-16">
                  <div className="flex items-baseline gap-4 mb-1.5 pt-3">
                    <span className="font-mono text-[13px] text-[var(--hb-dim)]">{s.number}</span>
                    <h2 className="text-[21px] font-semibold tracking-[-0.3px] text-[var(--hb-txt)]">{s.title}</h2>
                  </div>
                  <div className="font-mono text-[11px] text-[var(--hb-dim)] mb-3.5">
                    <b className="text-[var(--hb-green)] font-normal">~/handbook</b>/{s.crumb}
                  </div>
                  {s.why && <p className="text-[var(--hb-dim)] text-[14px] mb-5 max-w-[620px]">{s.why}</p>}

                  <div className="space-y-2.5">
                    {s.commands.map((cmd, idx) => (
                      <CommandCard
                        key={idx}
                        cmd={cmd}
                        section={s}
                        copiedCmd={copiedCmd}
                        onCopy={handleCopy}
                        onExplain={handleExplain}
                        aiLoadingCmd={aiLoadingCmd}
                        aiResponse={aiResponse}
                        aiErrorCmd={aiErrorCmd}
                        expandedCmd={expandedCmd}
                        onToggleExpand={(c) => setExpandedCmd(expandedCmd === c ? null : c)}
                      />
                    ))}
                  </div>

                  {s.callouts.map((c, i) => (
                    <Callout key={i} callout={c} />
                  ))}

                  {s.tables.map((t, i) => (
                    <Table key={i} table={t} />
                  ))}
                </section>
              ))}
            </div>

            {/* Footer */}
            <p className="text-[var(--hb-dim)] font-mono text-xs mt-10 mb-4">
              ~/handbook $ <span className="text-[var(--hb-green)]">exit</span> <span className="text-[var(--hb-dim)]"># now go break something fixable</span>
            </p>
          </>
        )}

        {/* Scroll to top */}
        <AnimatePresence>
          {showTop && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-8 right-8 z-50 w-10 h-10 rounded-full bg-[var(--hb-bg2)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] text-[var(--hb-green)] flex items-center justify-center hover:bg-[var(--hb-panel)] hover:border-[var(--hb-green)] transition-colors shadow-none"
              title="back to top"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Command Card with AI Explain ──

function CommandCard({ cmd, section, copiedCmd, onCopy, onExplain, aiLoadingCmd, aiResponse, aiErrorCmd, expandedCmd, onToggleExpand }: {
  cmd: HandbookCommand;
  section: HandbookSection;
  copiedCmd: string | null;
  onCopy: (text: string) => void;
  onExplain: (cmd: HandbookCommand, section: HandbookSection) => void;
  aiLoadingCmd: string | null;
  aiResponse: HandbookCommandResponse | null;
  aiErrorCmd: string | null;
  expandedCmd: string | null;
  onToggleExpand: (cmd: string) => void;
}) {
  const style = DEPTH_STYLES[cmd.depth] || DEPTH_STYLES.core;
  const isExpanded = expandedCmd === cmd.command;
  const [bridgeActive, setBridgeActive] = useState(false);
  const [bridgePaste, setBridgePaste] = useState('');
  const [bridgeResponse, setBridgeResponse] = useState<HandbookCommandResponse | null>(null);

  const handleBridgeSend = () => {
    const prompt = `Based on our conversation above, generate the learning aid for this terminal command. Return ONLY this JSON:\n\n{\n  "type": "handbook_command_response",\n  "version": "1.0.0",\n  "command": "${cmd.command}",\n  "title": "...",\n  "estimatedMinutes": 5,\n  "explanation": { "what": "...", "when": "...", "gotcha": "..." },\n  "params": [{ "flag": "...", "arg": "...", "meaning": "...", "type": "boolean|path|pattern|value|placeholder" }],\n  "safety": { "level": "safe|careful|destructive", "note": "..." },\n  "exercises": [{ "title": "...", "command": "...", "explanation": "..." }],\n  "related": [{ "command": "...", "relation": "..." }]\n}\n\nReturn ONLY this JSON (no explanation, no markdown).`;
    setBridgeResponse(null);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(prompt).then(() => {
        window.open('https://chat.openai.com', '_blank');
        setBridgeActive(true);
      }).catch(() => { setBridgeActive(true); });
    } else {
      setBridgeActive(true);
    }
  };

  const handleBridgeParse = () => {
    const block = extractJsonBlock(bridgePaste);
    if (!block) { setBridgeResponse(null); return; }
    try {
      const parsed = JSON.parse(block) as HandbookCommandResponse;
      setBridgeResponse(parsed);
    } catch { setBridgeResponse(null); }
  };

  const rows = cmd.rows || [];
  const doesRow = rows.find(r => r.tag.toLowerCase() === 'does');
  const whenRow = rows.find(r => r.tag.toLowerCase() === 'when');
  const gotchaRow = rows.find(r => r.tag.toLowerCase() === 'gotcha');

  return (
    <div className={`hb-cmd`}>
      {/* Bar */}
      <div className="hb-cmd-bar">
        <span className={`hb-dollar ${cmd.isRoot ? 'text-[var(--hb-amber)]' : 'text-[var(--hb-accent)]'}`}>{cmd.isRoot ? '#' : '$'}</span>
        <code className="text-[var(--hb-txt)] text-[13.5px] font-medium flex-1">{cmd.command}</code>
        {cmd.badges.map((b, i) => (
          <Badge key={i} type={b.type} label={b.label} />
        ))}
        <button
          onClick={() => onCopy(cmd.command)}
          className={`hb-copy ${copiedCmd === cmd.command ? 'text-[var(--hb-green)] border-[var(--hb-green)]' : ''}`}
        >
          {copiedCmd === cmd.command ? '✓ copied' : '⧉ copy'}
        </button>
        <button
          onClick={() => { onToggleExpand(cmd.command); onExplain(cmd, section); }}
          disabled={aiLoadingCmd === cmd.command}
          className={`flex items-center gap-1 font-mono text-[10.5px] px-2 py-1 rounded border transition-colors ${aiLoadingCmd === cmd.command ? 'text-[var(--hb-amber)] border-[var(--hb-amber)] animate-pulse' : 'text-[var(--hb-dim)] border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] hover:text-[var(--hb-green)]'}`}
        >
          <Sparkles className="w-3 h-3" />
          {aiLoadingCmd === cmd.command ? '...' : 'explain'}
        </button>
        <button
          onClick={handleBridgeSend}
          className="flex items-center gap-1 font-mono text-[10.5px] px-2 py-1 rounded border text-[var(--hb-dim)] border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] hover:text-[var(--hb-violet)] hover:border-[var(--hb-violet)] transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> external AI
        </button>
      </div>

      {/* Body */}
      <div className="px-3.5 py-2.5">
        {doesRow && (
          <div className="hb-row">
            <span className="hb-tag">does</span>
            <span className="hb-val">{doesRow.value}</span>
          </div>
        )}
        {whenRow && (
          <div className="hb-row">
            <span className="hb-tag">when</span>
            <span className="hb-val">{whenRow.value}</span>
          </div>
        )}
        {gotchaRow && (
          <div className="hb-row hb-row-warn">
            <span className="hb-tag">gotcha</span>
            <span className="hb-val">{gotchaRow.value}</span>
          </div>
        )}
      </div>

      {/* AI Response */}
      <AnimatePresence>
        {isExpanded && aiResponse && aiResponse.command === cmd.command && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Explanation */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[var(--hb-green)]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hb-green)]">AI Explanation</span>
                  <span className="font-mono text-[9px] text-[var(--hb-dim)]">{aiResponse.estimatedMinutes} min read</span>
                </div>
                <p className="text-[var(--hb-txt)] text-sm mb-2">{aiResponse.explanation.what}</p>
                <p className="text-[var(--hb-dim)] text-xs mb-2"><b className="text-[var(--hb-txt)]">When:</b> {aiResponse.explanation.when}</p>
                {aiResponse.explanation.gotcha && (
                  <div className="flex items-start gap-2 text-xs text-[var(--hb-amber)]">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{aiResponse.explanation.gotcha}</span>
                  </div>
                )}
              </div>

              {/* Params */}
              {aiResponse.params.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Parameters</div>
                  {aiResponse.params.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {p.flag && <code className="text-cyan-400 font-mono bg-cyan-400/10 px-1.5 py-0.5 rounded">-{p.flag}</code>}
                      {p.arg && <code className="text-[var(--hb-green)] font-mono bg-[color-mix(in_srgb,var(--hb-green)_10,transparent)] px-1.5 py-0.5 rounded">{p.arg}</code>}
                      <span className="text-[var(--hb-dim)]">{p.meaning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Safety */}
              {aiResponse.safety && aiResponse.safety.level !== 'safe' && (
                <div className={`flex items-start gap-2 p-2 rounded-xl ${
                  aiResponse.safety.level === 'destructive'
                    ? 'bg-[color-mix(in_srgb,var(--hb-rose)_10,transparent)] text-[var(--hb-rose)]'
                    : 'bg-[color-mix(in_srgb,var(--hb-amber)_10,transparent)] text-[var(--hb-amber)]'
                }`}>
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="text-xs">{aiResponse.safety.note}</span>
                </div>
              )}

              {/* Exercises */}
              {aiResponse.exercises.length > 0 && (
                <div className="space-y-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Practice</div>
                  {aiResponse.exercises.map((ex, i) => (
                    <div key={i} className="bg-[var(--hb-bg)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl p-3">
                      <div className="text-[var(--hb-txt)] text-xs font-medium mb-1">{ex.title}</div>
                      <code className="text-[var(--hb-green)] font-mono text-[11px] block mb-1">{ex.command}</code>
                      <p className="text-[var(--hb-dim)] text-[11px]">{ex.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Related */}
              {aiResponse.related.length > 0 && (
                <div className="space-y-1">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Related</div>
                  {aiResponse.related.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <code className="text-cyan-400 font-mono text-[10px]">{r.command}</code>
                      <span className="text-[var(--hb-dim)]">{r.relation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Error */}
      {isExpanded && aiErrorCmd === cmd.command && (
        <div className="border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] p-4 text-xs text-[var(--hb-rose)]">
          Failed to get AI explanation. Try again.
        </div>
      )}

      {/* External AI Bridge — paste-back */}
      {bridgeActive && (
        <div className="border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-violet)]">External AI Bridge</div>
          <p className="text-[var(--hb-dim)] text-[11px]">Prompt copied to clipboard. Paste ChatGPT/Claude JSON output here:</p>
          <textarea
            value={bridgePaste}
            onChange={e => setBridgePaste(e.target.value)}
            placeholder="Paste JSON here..."
            rows={4}
            className="w-full bg-[var(--hb-bg)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl px-3 py-2 font-mono text-[12px] text-[var(--hb-txt)] placeholder:text-[var(--hb-dim)] resize-none outline-none focus:border-[var(--hb-violet)]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleBridgeParse}
              className="font-mono text-[11px] px-5 py-4 rounded-xl bg-[var(--hb-violet)] text-[var(--hb-dim)] font-semibold hover:bg-[var(--hb-violet)] transition-colors"
            >
              Parse & Render
            </button>
            <button
              onClick={() => { setBridgeActive(false); setBridgePaste(''); setBridgeResponse(null); }}
              className="font-mono text-[11px] px-3 py-1.5 rounded-xl border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] text-[var(--hb-dim)] hover:text-[var(--hb-txt)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bridge Response — rendered from external AI JSON */}
      {bridgeResponse && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] overflow-hidden"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-4 h-4 text-[var(--hb-violet)]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hb-violet)]">External AI Output</span>
              <span className="font-mono text-[9px] text-[var(--hb-dim)]">{bridgeResponse.estimatedMinutes} min read</span>
            </div>
            <p className="text-[var(--hb-txt)] text-sm mb-2">{bridgeResponse.explanation?.what}</p>
            <p className="text-[var(--hb-dim)] text-xs mb-2"><b className="text-[var(--hb-txt)]">When:</b> {bridgeResponse.explanation?.when}</p>
            {bridgeResponse.explanation?.gotcha && (
              <div className="flex items-start gap-2 text-xs text-[var(--hb-amber)]">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{bridgeResponse.explanation.gotcha}</span>
              </div>
            )}
            {bridgeResponse.params && bridgeResponse.params.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Parameters</div>
                {bridgeResponse.params.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {p.flag && <code className="text-cyan-400 font-mono bg-cyan-400/10 px-1.5 py-0.5 rounded">-{p.flag}</code>}
                    {p.arg && <code className="text-[var(--hb-green)] font-mono bg-[color-mix(in_srgb,var(--hb-green)_10,transparent)] px-1.5 py-0.5 rounded">{p.arg}</code>}
                    <span className="text-[var(--hb-dim)]">{p.meaning}</span>
                  </div>
                ))}
              </div>
            )}
            {bridgeResponse.safety && bridgeResponse.safety.level !== 'safe' && (
              <div className={`flex items-start gap-2 p-2 rounded-xl ${bridgeResponse.safety.level === 'destructive' ? 'bg-[color-mix(in_srgb,var(--hb-rose)_10,transparent)] text-[var(--hb-rose)]' : 'bg-[color-mix(in_srgb,var(--hb-amber)_10,transparent)] text-[var(--hb-amber)]'}`}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="text-xs">{bridgeResponse.safety.note}</span>
              </div>
            )}
            {bridgeResponse.exercises && bridgeResponse.exercises.length > 0 && (
              <div className="space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Practice</div>
                {bridgeResponse.exercises.map((ex, i) => (
                  <div key={i} className="bg-[var(--hb-bg)] border border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] rounded-xl p-3">
                    <div className="text-[var(--hb-txt)] text-xs font-medium mb-1">{ex.title}</div>
                    <code className="text-[var(--hb-green)] font-mono text-[11px] block mb-1">{ex.command}</code>
                    <p className="text-[var(--hb-dim)] text-[11px]">{ex.explanation}</p>
                  </div>
                ))}
              </div>
            )}
            {bridgeResponse.related && bridgeResponse.related.length > 0 && (
              <div className="space-y-1">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hb-dim)]">Related</div>
                {bridgeResponse.related.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <code className="text-cyan-400 font-mono text-[10px]">{r.command}</code>
                    <span className="text-[var(--hb-dim)]">{r.relation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Helpers ──

function Callout({ callout }: { callout: { type: string; title: string; body: string } }) {
  return (
    <div className={`mt-4 p-5 rounded-r-xl border-l-[3px] ${callout.type === 'danger' ? 'border-l-[var(--hb-rose)] bg-gradient-to-r from-[color-mix(in_srgb,var(--hb-rose)_10,transparent)] to-[var(--hb-bg2)]' : 'border-l-[var(--hb-amber)] bg-[var(--hb-bg2)]'}`}>
      <div className={`font-mono text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${callout.type === 'danger' ? 'text-[var(--hb-rose)]' : 'text-[var(--hb-amber)]'}`}>
        {callout.title}
      </div>
      <p className="text-sm text-[var(--hb-dim)]">{callout.body}</p>
    </div>
  );
}

function Table({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {table.headers.length > 0 && (
          <thead>
            <tr>
              {table.headers.map((h, hi) => (
                <th key={hi} className="font-mono text-[10px] uppercase tracking-wider text-[var(--hb-dim)] text-left px-3 py-2 border-b border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-[color-mix(in_srgb,var(--hb-panel)_50,transparent)] transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 border-b border-[color-mix(in_srgb,var(--hb-panel)_60,transparent)] ${ci === 0 ? 'text-[var(--hb-txt)] font-medium' : 'text-[var(--hb-dim)]'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionDetail({ section, onBack, copiedCmd, onCopy, onExplain, aiLoadingCmd, aiResponse, aiErrorCmd, expandedCmd, onToggleExpand }: {
  section: HandbookSection;
  onBack: () => void;
  copiedCmd: string | null;
  onCopy: (text: string) => void;
  onExplain: (cmd: HandbookCommand, section: HandbookSection) => void;
  aiLoadingCmd: string | null;
  aiResponse: HandbookCommandResponse | null;
  aiErrorCmd: string | null;
  expandedCmd: string | null;
  onToggleExpand: (cmd: string) => void;
}) {
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-[var(--hb-dim)] hover:text-[var(--hb-txt)] text-sm mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="text-[21px] font-semibold text-[var(--hb-txt)] mb-6">{section.title}</h2>

      <div className="space-y-2.5">
        {section.commands.map((cmd, idx) => (
          <CommandCard
            key={idx}
            cmd={cmd}
            section={section}
            copiedCmd={copiedCmd}
            onCopy={onCopy}
            onExplain={onExplain}
            aiLoadingCmd={aiLoadingCmd}
            aiResponse={aiResponse}
            aiErrorCmd={aiErrorCmd}
            expandedCmd={expandedCmd}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>

      {section.callouts.map((c, i) => <Callout key={i} callout={c} />)}
      {section.tables.map((t, i) => <Table key={i} table={t} />)}
    </div>
  );
}
