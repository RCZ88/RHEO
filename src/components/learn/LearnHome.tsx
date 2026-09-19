import { BookOpen, Wand2, FileUp, ClipboardPaste, Compass, BookMarked } from 'lucide-react';
import { useState, useCallback } from 'react';
import { BlurFade } from '../ui/blur-fade';
import { FeatureShowcase } from '../showcase/FeatureShowcase';
import { BookOpening } from './BookOpening';
import { HierarchyGuide } from './HierarchyGuide';

const api = (window as any).deskflowAPI;

export interface LearnHomeProps {
  onCompose: () => void;
  onTryExample: () => void;
  onImport: () => void;
  onPaste: () => void;
  onBrowse?: () => void;
  onOpenSavedIdeas?: () => void;
}

export function LearnHome(props: LearnHomeProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      const result = await api.learnGetLessonSystemPrompt();
      if (result.ok && result.data) {
        await navigator.clipboard.writeText(result.data);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2500);
      }
    } catch (e) {
      console.error('[LearnHome] Failed to copy prompt:', e);
    }
  }, []);

  const scrollToFeatures = () => {
    document.getElementById('learn-features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lyceum-welcome relative min-h-full w-full overflow-y-auto" data-page="learn">
      {/* warm ambient wash */}
      <div className="lyceum-welcome-glow pointer-events-none absolute inset-0" aria-hidden />

      {/* Hero — optical center at ~40% */}
      <section className="relative flex min-h-[55vh] items-center px-6 py-16">
        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: the invitation */}
          <div>
            <BlurFade inView>
              <span className="inline-flex items-center gap-2 rounded-full border border-clay-400/30 bg-clay-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-clay-300 light:bg-clay-500/5 light:text-clay-600">
                <BookOpen className="h-3 w-3" />
                Lyceum Learn
              </span>
            </BlurFade>

            <BlurFade delay={0.08} inView>
              <h1 className="mt-5 font-serif text-5xl font-semibold leading-[1.05] text-glow light:text-stone-900">
                A library that
                <br />
                writes itself.
              </h1>
            </BlurFade>

            <BlurFade delay={0.16} inView>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400 light:text-stone-500">
                A personal library of grounded, citation-backed lessons.
                Study what you've already built, or compose something new.
              </p>
            </BlurFade>

            <BlurFade delay={0.24} inView>
              <div className="mt-8 flex flex-col gap-4 max-w-sm">
                {/* Primary: Browse Library */}
                {props.onBrowse && (
                  <button
                    onClick={props.onBrowse}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-clay-400/40 bg-clay-500/15 px-6 py-3 font-serif text-sm font-semibold text-glow transition-all hover:bg-clay-500/25 hover:shadow-[0_0_20px_rgba(194,85,58,0.25)] light:border-clay-400/20 light:bg-clay-500/5 light:text-clay-700 light:hover:bg-clay-500/15"
                  >
                    <BookMarked className="h-4 w-4" />
                    Browse Library
                  </button>
                )}
                {/* Secondary row */}
                <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.15em]">
                  <button
                    onClick={props.onCompose}
                    className="text-zinc-500 hover:text-clay-300 transition-colors light:text-stone-500 light:hover:text-clay-600"
                  >
                    <Wand2 className="w-3 h-3 inline mr-1" />
                    New lesson
                  </button>
                  <button
                    onClick={props.onTryExample}
                    className="text-zinc-500 hover:text-clay-300 transition-colors light:text-stone-500 light:hover:text-clay-600"
                  >
                    Read a sample
                  </button>
                  <button
                    onClick={scrollToFeatures}
                    className="text-zinc-600 hover:text-amber-300 transition-colors light:text-stone-500 light:hover:text-amber-600"
                  >
                    Features
                  </button>
                </div>
              </div>
            </BlurFade>
          </div>

          {/* Right: animated book opening */}
          <BlurFade delay={0.2} direction="up" inView>
            <div className="relative mx-auto w-fit">
              <BookOpening />
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Quick actions — natural document flow */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <BlurFade delay={0.32} inView>
          {/* Hierarchy guide — real visual tree */}
          <div className="mb-6">
            <HierarchyGuide />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={props.onTryExample}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-clay-400/40 hover:bg-clay-500/[0.06] light:border-stone-300/50 light:bg-stone-100/60 light:hover:border-clay-400/30 light:hover:bg-stone-200/80"
            >
              <Compass className="h-4 w-4 text-clay-300 transition-transform group-hover:scale-110 light:text-clay-500" />
              <p className="mt-2 font-serif text-[15px] font-semibold text-glow light:text-stone-900">Open a sample</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 light:text-stone-500">Study a finished, grounded lesson to see the format in action.</p>
            </button>
            <button
              onClick={props.onImport}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-clay-400/40 hover:bg-clay-500/[0.06] light:border-stone-300/50 light:bg-stone-100/60 light:hover:border-clay-400/30 light:hover:bg-stone-200/80"
            >
              <FileUp className="h-4 w-4 text-clay-300 transition-transform group-hover:scale-110 light:text-clay-500" />
              <p className="mt-2 font-serif text-[15px] font-semibold text-glow light:text-stone-900">Import a file</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 light:text-stone-500">Bring in a .lmd or .ldoc you already have on disk.</p>
            </button>
            <button
              onClick={props.onPaste}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-clay-400/40 hover:bg-clay-500/[0.06] light:border-stone-300/50 light:bg-stone-100/60 light:hover:border-clay-400/30 light:hover:bg-stone-200/80"
            >
              <ClipboardPaste className="h-4 w-4 text-clay-300 transition-transform group-hover:scale-110 light:text-clay-500" />
              <p className="mt-2 font-serif text-[15px] font-semibold text-glow light:text-stone-900">Paste a draft</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 light:text-stone-500">Drop in Lesson Markdown and we compile it for you.</p>
            </button>
          </div>
        </BlurFade>
      </section>

      {/* Features showcase — embedded section */}
      <section id="learn-features" className="relative border-t border-white/10 px-6 py-16 light:border-stone-300/50">
        <div className="mx-auto max-w-6xl">
          <BlurFade inView>
            <div className="mb-8 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-clay-300 light:text-stone-500">Capabilities</span>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-glow light:text-stone-900">Everything you need to learn</h2>
              <p className="mt-2 text-sm text-zinc-500 light:text-stone-500">Every block type the AI can generate and the system can parse.</p>
            </div>
          </BlurFade>
          <FeatureShowcase embedded />
        </div>
      </section>
    </div>
  );
}
