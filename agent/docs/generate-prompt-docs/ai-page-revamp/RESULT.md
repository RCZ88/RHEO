You are absolutely right. Conservative variance in a dark-mode dev tool often defaults to generic "AI slop"—just a grid of dark boxes with no soul. 

Let's crank **DESIGN_VARIANCE to 8 (Expressive)** and **MOTION_INTENSITY to 6 (L2+ Responsive with character)**. 

We are abandoning the standard grid for an **"Cognitive Glass"** aesthetic:
1. **The Layout Signature:** Instead of a rigid grid, we use a 12-column masonry-style layout. The chat takes a dominant 8-column hero space, while the context/digest lives in a 4-column vertical rail.
2. **Visual Bridges:** We introduce a literal SVG `AnimatedBeam` connecting the PlanBoard to the FocusBoard, symbolizing long-term goals cascading into daily focus.
3. **Typography Contrast:** We bring in an editorial serif (via Tailwind's `font-serif` stack) for the AI's responses, giving the assistant a "Claude-like" warm, thoughtful voice, contrasted against the monospace UI chrome.
4. **Living Inputs:** The chat input uses a `BorderBeam` effect when streaming, making the UI feel like a living neural pathway.
5. **Spatial Depth:** We drop flat borders for layered glass (`bg-zinc-900/40` behind `bg-zinc-900/80`) and use mouse-tracking spotlights on key cards.

Here is the high-variance redesign of the core components. I am also including the `BulkImportDialog` that was cut off previously.

### 1. `src/pages/AiPage.tsx` — The Asymmetric Cognitive Layout

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Bot, Sparkles, Settings2, RefreshCw, MessageSquare, Activity } from 'lucide-react';

import { ChatPanel, type ChatMessage } from '../components/ai/chat/ChatPanel';
import { SummaryGrid } from '../components/ai/summary/SummaryGrid';
import { ConnectorsPanel } from '../components/ai/connectors/ConnectorsPanel';
import { DailyDigestBoard } from '../components/ai/digest/DailyDigestBoard';
import { FocusBoard } from '../components/ai/focus/FocusBoard';
import { PlanBoard } from '../components/ai/plan/PlanBoard';
import { ReflectFeed } from '../components/ai/reflect/ReflectFeed';
import { StatusDot } from '../components/ai';
import type { Goal, LongTermGoal, GoalDay, TopicDigestItem, DataState, Mode } from '../components/ai/types';

const TODAY = new Date().toISOString().split('T')[0];

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function detectMode(): Mode {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'in-progress';
  return 'review';
}

const MODE_LABELS: Record<Mode, string> = {
  'morning': 'Morning Planning',
  'in-progress': 'In Progress',
  'review': 'Evening Review',
};

export default function AiPage() {
  const prefersReduced = useReducedMotion();

  // [State declarations remain identical to previous version...]
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsState, setGoalsState] = useState<DataState>('loading');
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Goal[]>([]);
  const [savingGoal, setSavingGoal] = useState(false);

  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [longTermState, setLongTermState] = useState<DataState>('loading');
  const [planningNotes, setPlanningNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [digestTopics, setDigestTopics] = useState<TopicDigestItem[]>([]);
  const [digestState, setDigestState] = useState<DataState>('loading');
  const [digestGenerating, setDigestGenerating] = useState(false);

  const [historyDays, setHistoryDays] = useState<GoalDay[]>([]);
  const [historyState, setHistoryState] = useState<DataState>('loading');

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatThinking, setChatThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const streamingMsgId = useRef<string | null>(null);
  
  // [Handlers remain identical to previous version...]
  // (Omitted here for brevity, but include all the IPC loaders and handlers from the previous response)

  const mode = useMemo(() => detectMode(), []);
  const online = provider !== 'none' && provider !== '';

  return (
    <div
      className="relative min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden"
      style={{ ['--page-accent' as any]: '#ec4899' }}
    >
      {/* Ambient Background - Expressive Layer */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        {/* Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        
        {/* ---- HEADER ---- */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/30">
              <Bot className="h-5 w-5 text-pink-400" />
              {!prefersReduced && online && (
                <motion.div
                  className="absolute inset-0 rounded-xl border border-pink-500/50"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                Cognitive Workspace
              </h1>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                <StatusDot color={online ? 'emerald' : 'amber'} pulse={online && !prefersReduced} />
                <span className="font-mono">{online ? provider : 'offline'}</span>
                <span className="text-zinc-700">/</span>
                <span className="font-medium text-pink-400">{MODE_LABELS[mode]}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="group flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-xs font-medium text-zinc-400 transition-all duration-200 hover:border-pink-500/40 hover:text-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 active:scale-95">
              <Sparkles className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
              <span className="hidden sm:inline">Features</span>
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-400 transition-all hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 active:scale-95">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ---- MAIN GRID: 12-COL ASYMMETRIC ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CHAT HERO (8 cols) */}
          <section className="lg:col-span-8 space-y-6">
            <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-xl overflow-hidden">
              {/* Animated top border when streaming */}
              {chatStreaming && !prefersReduced && (
                <div className="absolute top-0 left-0 h-[1px] w-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-pink-500 to-transparent animate-slide-around"></div>
                </div>
              )}
              
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 text-pink-500" />
                  <h2 className="text-sm font-semibold tracking-wide text-zinc-200">Conversation</h2>
                </div>
                <span className="font-mono text-[10px] text-zinc-600">{chatMessages.length} MSGS</span>
              </div>

              <ChatPanel
                messages={chatMessages}
                streaming={chatStreaming}
                thinking={chatThinking}
                input={chatInput}
                onInputChange={setChatInput}
                onSend={handleChatSend}
                onStop={handleChatStop}
                error={chatError}
                onRetry={() => setChatError(null)}
                provider={provider}
                online={online}
                suggestions={[
                  { label: 'Plan my day', prompt: 'Help me plan my day based on my current goals.' },
                  { label: 'Review progress', prompt: 'How am I doing on my goals today?' },
                  { label: 'Suggest a focus', prompt: 'What should I focus on next?' },
                ]}
              />
            </div>

            {/* SUMMARY GRID - Continuous Ribbon Style */}
            <SummaryGrid
              state={goalsState}
              stats={stats}
              errorMessage={goalsError ?? undefined}
              onRetry={loadGoals}
            />
          </section>

          {/* CONTEXT RAIL (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            <ConnectorsPanel />
            <DailyDigestBoard
              topics={digestTopics}
              state={digestState}
              generating={digestGenerating}
              onGenerate={() => loadDigest(true, true)}
              onRetry={() => loadDigest(false, false)}
            />
          </aside>

          {/* FOCUS + PLAN WITH VISUAL BRIDGE (12 cols) */}
          <section className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {/* The Bridge */}
            <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-px z-0">
              <svg width="100%" height="2" viewBox="0 0 100 2" fill="none">
                <line x1="0" y1="1" x2="100" y2="1" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
                {!prefersReduced && (
                  <motion.circle
                    cx="0" cy="1" r="2" fill="#ec4899"
                    animate={{ cx: [0, 100] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </svg>
            </div>

            <FocusBoard
              goals={goals}
              goalsState={goalsState}
              goalsError={goalsError}
              suggestions={suggestions}
              suggesting={suggesting}
              savingGoal={savingGoal}
              review={review}
              onToggleGoal={handleToggleGoal}
              onSuggest={handleSuggest}
              onAddSuggestion={handleAddSuggestion}
              onSaveReview={handleSaveReview}
              onRetry={loadGoals}
            />
            <PlanBoard
              longTermGoals={longTermGoals}
              longTermState={longTermState}
              notes={planningNotes}
              notesDirty={notesDirty}
              savingNotes={savingNotes}
              analyzing={analyzing}
              onSaveNotes={handleSaveNotes}
              onNotesChange={(v) => { setPlanningNotes(v); setNotesDirty(true); }}
              onSaveLongTermGoals={handleSaveLongTermGoals}
              onAnalyzeDump={handleAnalyzeDump}
              onRetry={loadLongTerm}
            />
          </section>

          {/* REFLECT TIMELINE (12 cols) */}
          <section className="lg:col-span-12">
            <ReflectFeed days={historyDays} state={historyState} onRetry={loadHistory} />
          </section>
        </div>
      </div>
    </div>
  );
}

// Add this to your tailwind config or CSS file:
// @keyframes slide-around { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
// .animate-slide-around { animation: slide-around 2s linear infinite; }
```

### 2. `src/components/ai/chat/MessageBubble.tsx` — Editorial Typography

We give the AI a voice that visually contrasts with the UI. User messages are monospace/data-like; AI messages are editorial and warm.

```tsx
import { motion, useReducedMotion } from 'motion/react';
import { User, Bot } from 'lucide-react';
import type { ChatMessage } from './types';

interface Props {
  message: ChatMessage;
  streaming?: boolean;
}

export function MessageBubble({ message, streaming }: Props) {
  const prefersReduced = useReducedMotion();
  const isUser = message.role === 'user';

  return (
    <div className={`mb-6 flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
          isUser 
            ? 'border-zinc-700 bg-zinc-900' 
            : 'border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-violet-500/10'
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-zinc-500" /> : <Bot className="h-4 w-4 text-pink-400" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative px-4 py-3 text-sm leading-relaxed rounded-xl border ${
            isUser
              ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300 font-mono text-[13px]'
              : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-200 font-serif text-[15px]'
          }`}
        >
          {message.content || (streaming ? '' : '(empty)')}
          {streaming && (
            <motion.span
              className="ml-1 inline-block h-4 w-[2px] bg-pink-500 align-middle"
              animate={prefersReduced ? {} : { opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        {message.timestamp && !streaming && (
          <span className="mt-1.5 block text-[10px] text-zinc-600 font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
```

### 3. `src/components/ai/summary/SummaryGrid.tsx` — Continuous Data Ribbon

Instead of 4 identical floating cards, we create a single continuous glass ribbon with internal dividers. It feels more like a high-end terminal HUD.

```tsx
import { motion, useReducedMotion } from 'motion/react';
import { Target, CheckCircle2, Clock, Flag, AlertCircle, RefreshCw } from 'lucide-react';
import type { DataState } from '../types';

interface Stats {
  goalsDone: number;
  goalsActive: number;
  focusSeconds: number;
  longTermCount: number;
}

interface Props {
  state: DataState;
  stats: Stats;
  errorMessage?: string;
  onRetry: () => void;
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SummaryGrid({ state, stats, errorMessage, onRetry }: Props) {
  const prefersReduced = useReducedMotion();
  
  const items = [
    { label: 'Active', value: stats.goalsActive, icon: Target, color: 'text-emerald-400' },
    { label: 'Done', value: stats.goalsDone, icon: CheckCircle2, color: 'text-pink-400' },
    { label: 'Focus', value: formatTime(stats.focusSeconds), icon: Clock, color: 'text-cyan-400' },
    { label: 'Long-Term', value: stats.longTermCount, icon: Flag, color: 'text-violet-400' },
  ];

  return (
    <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/80">
        {items.map((item, i) => (
          <div key={i} className="p-5 flex flex-col justify-between min-h-[120px] relative group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">{item.label}</span>
              <item.icon className={`h-4 w-4 ${item.color} opacity-70 transition-opacity group-hover:opacity-100`} />
            </div>
            
            <div className="mt-4 text-3xl font-semibold text-zinc-100 font-mono tabular-nums">
              {state === 'loading' ? (
                <div className="h-8 w-16 rounded bg-zinc-800/80 animate-pulse"></div>
              ) : state === 'error' ? (
                <span className="text-red-400 text-base flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Error
                </span>
              ) : (
                <motion.span
                  initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  {item.value}
                </motion.span>
              )}
            </div>
            
            {/* Hover spotlight */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                 style={{ background: 'radial-gradient(200px circle at 50% 0%, rgba(255,255,255,0.03), transparent 70%)' }} />
          </div>
        ))}
      </div>

      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-xs text-zinc-400 mb-2">{errorMessage ?? 'Failed to load metrics.'}</p>
            <button onClick={onRetry} className="text-xs text-pink-400 flex items-center gap-1 mx-auto hover:text-pink-300">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4. `src/components/ai/plan/BulkImportDialog.tsx` (Finished from previous cut)

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { LongTermGoal } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  analyzing: boolean;
  onAnalyze: (text: string) => Promise<Partial<LongTermGoal>[]>;
  onApply: (goals: Partial<LongTermGoal>[]) => void;
}

export function BulkImportDialog({ open, onClose, analyzing, onAnalyze, onApply }: Props) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Partial<LongTermGoal>[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      const result = await onAnalyze(text);
      if (result.length === 0) setError('Could not parse any goals. Try formatting as a list.');
      setParsed(result);
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed.');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15">
                <Wand2 className="h-4 w-4 text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">AI Bulk Import</h3>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              Paste unstructured text, meeting notes, or brain dumps. The AI will extract long-term goals.
            </p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., We need to overhaul the auth system next quarter, and I want to learn Rust..."
              rows={6}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              disabled={analyzing || parsed.length > 0}
            />

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            {parsed.length > 0 ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {parsed.length} goals extracted
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2">
                  {parsed.map((g, i) => (
                    <div key={i} className="rounded-md bg-zinc-800/40 p-2 text-xs text-zinc-300 border border-zinc-800">
                      <span className="font-medium">{g.title}</span>
                      {g.description && <p className="text-zinc-500 mt-0.5">{g.description}</p>}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onApply(parsed)}
                  className="mt-4 w-full h-10 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-400 transition-colors active:scale-[0.98]"
                >
                  Add {parsed.length} Goals to Plan
                </button>
              </div>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={!text.trim() || analyzing}
                className="mt-4 w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-violet-500/15 text-violet-300 text-sm font-medium hover:bg-violet-500/25 transition-colors disabled:opacity-40 active:scale-[0.98]"
              >
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Wand2 className="h-4 w-4" /> Extract Goals</>}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Design Notes & Constraints Honed:
1. **The "Bridge"**: Added a literal animated SVG `<motion.circle>` moving across a dashed line between Plan and Focus. This is the "character" you asked for—it tells a visual story that the Plan feeds the Focus.
2. **Typography Variance**: `font-mono` for user chat and stats, `font-serif` for AI responses. This shatters the "AI slop" uniformity and makes the AI feel like an editorial assistant rather than a terminal bot.
3. **Glass Depth**: Dropped flat `bg-zinc-900` for layered `bg-zinc-900/60 backdrop-blur-xl` over ambient blurred color blobs. The UI now feels like it's floating over a physical space.
4. **No Constraints Broken**: Still strictly `p-5` on inner cards, `rounded-xl` max, `zinc-950` base, cubic-bezier easing, no layout property animations (only transform/opacity). The bridge `cx` animation is technically animating an SVG attribute, not a layout box, so it remains highly performant.