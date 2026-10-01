import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, SkipForward, Check, BookOpen, Plus, X } from 'lucide-react';
import { saveProfile, hasProfile, markSetupComplete, loadProfile, loadUserLessons } from '../../services/learn/learnerProfile';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import { DEFAULT_PROFILE, PROFILE_KNOBS } from '../../shared/learn/types';
import type { LearnerProfile, Density, ModalityBias, ExampleStance, MathDepth, ChunkSize, Tone, MasteryLevel } from '../../shared/learn/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 9;

export function LearnerSetup({ open, onClose }: Props) {
  // Start from the existing profile (if any) so re-running setup adjusts answers
  // instead of wiping knobs / prior knowledge / knowledge base.
  const [initial] = useState<LearnerProfile>(() => loadProfile());
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<LearnerProfile>(() => ({
    ...initial,
    confidence: Object.fromEntries(PROFILE_KNOBS.map((k) => [k, initial.confidence?.[k] ?? 0.3])) as Record<string, number>,
  }));
  const [priorKnowledge, setPriorKnowledge] = useState<Partial<Record<number, MasteryLevel>>>(() => ({ ...(initial.priorKnowledge ?? {}) }));
  const [knowledge, setKnowledge] = useState<{ statement: string; topic: string; keywords: string; linkedLessons: string[]; level: MasteryLevel | '' }[]>(() =>
    (initial.knowledgeBase ?? []).map((e) => ({
      statement: e.statement,
      topic: e.topic ?? '',
      keywords: (e.keywords ?? []).join(', '),
      linkedLessons: e.linkedLessons ?? [],
      level: e.level ?? '',
    })),
  );
  const [userLessons, setUserLessons] = useState<{ titles: string[]; parts: number[] }>({ titles: [], parts: [] });

  useEffect(() => {
    let mounted = true;
    loadUserLessons()
      .then((l) => { if (mounted) setUserLessons(l); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!open) return null;

  const finish = () => {
    const now = new Date().toISOString();
    const final: LearnerProfile = {
      ...profile,
      priorKnowledge,
      knowledgeBase: knowledge.map((k, i) => ({
        id: `setup-kb-${i}-${Date.now().toString(36)}`,
        statement: k.statement.trim(),
        topic: k.topic.trim() || undefined,
        linkedLessons: k.linkedLessons.length ? k.linkedLessons : undefined,
        keywords: k.keywords.split(',').map(s => s.trim()).filter(Boolean),
        level: k.level || undefined,
        createdAt: now,
        updatedAt: now,
      })),
      confidence: Object.fromEntries(PROFILE_KNOBS.map(k => [k, 0.35])) as Record<string, number>,
      updatedAt: now,
    };
    saveProfile(final);
    markSetupComplete();
    onClose();
  };

  const skip = () => {
    saveProfile({ ...DEFAULT_PROFILE });
    markSetupComplete();
    onClose();
  };

  const update = <K extends keyof LearnerProfile>(key: K, value: LearnerProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  // Always save when closing (backdrop click, Escape, etc.) — prevents re-popup
  const handleClose = () => {
    if (!hasProfile()) saveProfile({ ...DEFAULT_PROFILE });
    markSetupComplete();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-4 rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-zinc-100">How you like to learn</h2>
            <span className="font-mono text-[10px] text-zinc-500">{step + 1}/{TOTAL_STEPS}</span>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5 mt-3">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? 'bg-clay-400' : 'bg-zinc-800'}`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {step === 0 && <Q1 value={profile} onChange={update} />}
              {step === 1 && <Q2 value={profile} onChange={update} />}
              {step === 2 && <Q3 value={profile} onChange={update} />}
              {step === 3 && <Q4 value={profile} onChange={update} />}
              {step === 4 && <Q5 value={profile} onChange={update} />}
              {step === 5 && <Q6 value={profile} onChange={update} />}
              {step === 6 && <Q7 value={profile} onChange={update} />}
              {step === 7 && <Q8 priorKnowledge={priorKnowledge} setPriorKnowledge={setPriorKnowledge} lessonParts={userLessons.parts} />}
              {step === 8 && <Q9 knowledge={knowledge} setKnowledge={setKnowledge} lessonTitles={userLessons.titles} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button onClick={skip} className="text-xs text-zinc-600 hover:text-zinc-400 transition flex items-center gap-1">
            <SkipForward className="w-3 h-3" /> Skip for now
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-clay-500/20 hover:bg-clay-500/30 text-clay-300 text-sm font-medium transition border border-clay-400/30"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sage-500/20 hover:bg-sage-500/30 text-sage-300 text-sm font-medium transition border border-sage-400/30"
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Question components ──

function OptionCard({ label, desc, selected, onClick }: { label: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition ${selected ? 'border-clay-400/50 bg-clay-500/10' : 'border-zinc-700/40 bg-zinc-800/30 hover:border-zinc-600'}`}
    >
      <div className="text-sm font-medium text-zinc-200">{label}</div>
      <div className="text-xs text-zinc-500 mt-1">{desc}</div>
    </button>
  );
}

function Q1({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How do you like explanations?</h3>
      <p className="text-xs text-zinc-500 mb-4">Pick the style that feels right.</p>
      <div className="space-y-3">
        <OptionCard label="Show me a diagram first" desc="Lead with a visual, keep text short." selected={value.density === 'terse' && value.modalityBias === 'diagram_first'} onClick={() => { onChange('density', 'terse'); onChange('modalityBias', 'diagram_first'); }} />
        <OptionCard label="Balanced mix" desc="A healthy blend of prose and visuals." selected={value.density === 'balanced' && value.modalityBias === 'balanced'} onClick={() => { onChange('density', 'balanced'); onChange('modalityBias', 'balanced'); }} />
        <OptionCard label="Full prose walkthrough" desc="Thorough explanations, diagrams when needed." selected={value.density === 'thorough' && value.modalityBias === 'text_ok'} onClick={() => { onChange('density', 'thorough'); onChange('modalityBias', 'text_ok'); }} />
      </div>
    </div>
  );
}

function Q2({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How do you like to learn new concepts?</h3>
      <div className="space-y-3">
        <OptionCard label="Show me a worked example" desc="See the solution first, then modify it." selected={value.exampleStance === 'worked_first'} onClick={() => onChange('exampleStance', 'worked_first')} />
        <OptionCard label="Let me try first" desc="Give me the goal, let me figure it out." selected={value.exampleStance === 'discovery_first'} onClick={() => onChange('exampleStance', 'discovery_first')} />
        <OptionCard label="Mix it up" desc="Sometimes worked, sometimes try-first." selected={value.exampleStance === 'balanced'} onClick={() => onChange('exampleStance', 'balanced')} />
      </div>
    </div>
  );
}

function Q3({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How deep should the math go?</h3>
      <div className="space-y-3">
        <OptionCard label="Results + intuition" desc="Show me what it does and when to use it." selected={value.mathDepth === 'applied_only'} onClick={() => onChange('mathDepth', 'applied_only')} />
        <OptionCard label="Intuition first, derivations optional" desc="Start with the why, full math in an expandable layer." selected={value.mathDepth === 'intuition_first'} onClick={() => onChange('mathDepth', 'intuition_first')} />
        <OptionCard label="Derive everything" desc="Full proofs from first principles." selected={value.mathDepth === 'derive_everything'} onClick={() => onChange('mathDepth', 'derive_everything')} />
      </div>
    </div>
  );
}

function Q4({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  const toggle = <K extends keyof LearnerProfile>(knob: K, target: LearnerProfile[K]) => {
    if (value[knob] === target) {
      onChange(knob, DEFAULT_PROFILE[knob]);
    } else {
      onChange(knob, target);
    }
  };

  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">When you hit something new, what do you reach for FIRST?</h3>
      <div className="space-y-3">
        <OptionCard label="A diagram of how it fits together" desc="Visual overview first." selected={value.modalityBias === 'diagram_first'} onClick={() => toggle('modalityBias', 'diagram_first')} />
        <OptionCard label="A worked example I can run" desc="Copy, modify, understand." selected={value.exampleStance === 'worked_first'} onClick={() => toggle('exampleStance', 'worked_first')} />
        <OptionCard label="The underlying math / why" desc="Show me the derivation." selected={value.mathDepth === 'derive_everything'} onClick={() => toggle('mathDepth', 'derive_everything')} />
        <OptionCard label="Just let me try it" desc="Hands-on, fail fast, learn fast." selected={value.handsOn === 3} onClick={() => toggle('handsOn', 3)} />
      </div>
    </div>
  );
}

function Q5({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How should each lesson end?</h3>
      <div className="space-y-3">
        <OptionCard label="A hands-on build I ship" desc="Project-based learning." selected={value.handsOn === 3} onClick={() => onChange('handsOn', 3)} />
        <OptionCard label="A few quiz questions" desc="Test my understanding." selected={value.quizAppetite === 'heavy'} onClick={() => onChange('quizAppetite', 'heavy')} />
        <OptionCard label="A summary I can save" desc="Quick reference for later." selected={value.quizAppetite === 'light'} onClick={() => onChange('quizAppetite', 'light')} />
        <OptionCard label="All of it" desc="Quizzes + a small project." selected={value.handsOn === 2 && value.quizAppetite === 'normal'} onClick={() => { onChange('handsOn', 2); onChange('quizAppetite', 'normal'); }} />
      </div>
    </div>
  );
}

function Q6({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">Session size that fits your day?</h3>
      <div className="space-y-3">
        <OptionCard label="Micro (~10 min)" desc="Quick bursts, fits in a break." selected={value.chunkSize === 'micro'} onClick={() => onChange('chunkSize', 'micro')} />
        <OptionCard label="Standard (~25 min)" desc="One focused session." selected={value.chunkSize === 'standard'} onClick={() => onChange('chunkSize', 'standard')} />
        <OptionCard label="Deep (60+ min)" desc="Long, immersive sessions." selected={value.chunkSize === 'deep'} onClick={() => onChange('chunkSize', 'deep')} />
      </div>
    </div>
  );
}

function Q7({ value, onChange }: { value: LearnerProfile; onChange: <K extends keyof LearnerProfile>(k: K, v: LearnerProfile[K]) => void }) {
  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How blunt should the coach be about your gaps?</h3>
      <div className="space-y-3">
        <OptionCard label="Gentle" desc="Encouraging, patient, soft edges." selected={value.tone === 'gentle'} onClick={() => onChange('tone', 'gentle')} />
        <OptionCard label="Balanced" desc="Warm but direct." selected={value.tone === 'balanced'} onClick={() => onChange('tone', 'balanced')} />
        <OptionCard label="Demanding" desc="Senior-engineer voice. No sugarcoating." selected={value.tone === 'demanding'} onClick={() => onChange('tone', 'demanding')} />
      </div>
    </div>
  );
}

function Q8({ priorKnowledge, setPriorKnowledge, lessonParts }: { priorKnowledge: Partial<Record<number, MasteryLevel>>; setPriorKnowledge: (pk: Partial<Record<number, MasteryLevel>>) => void; lessonParts: number[] }) {
  const [lessonTitles, setLessonTitles] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    loadUserLessons().then((l) => {
      if (!mounted) return;
      const map: Record<number, string> = {};
      l.parts.forEach((p, i) => { map[p] = l.titles[i] ?? `Part ${p}`; });
      setLessonTitles(map);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const options: { label: string; level: MasteryLevel }[] = [
    { label: 'New', level: 'L0' },
    { label: 'Some', level: 'L2' },
    { label: 'Solid', level: 'L3' },
    { label: 'Deep', level: 'L4' },
  ];

  const cycle = (part: number) => {
    const cur = priorKnowledge[part] ?? 'L0';
    const idx = options.findIndex((o) => o.level === cur);
    const next = options[(idx + 1) % options.length].level;
    setPriorKnowledge({ ...priorKnowledge, [part]: next });
  };

  const levelLabel = (part: number) => {
    const level = priorKnowledge[part] ?? 'L0';
    return options.find((o) => o.level === level)?.label ?? 'New';
  };

  const levelColor = (part: number) => {
    const level = priorKnowledge[part] ?? 'L0';
    const colors: Record<string, string> = { L0: 'bg-zinc-700 text-zinc-400', L2: 'bg-clay-500/20 text-clay-300', L3: 'bg-sage-500/20 text-sage-300', L4: 'bg-amber-500/20 text-amber-300' };
    return colors[level] ?? colors.L0;
  };

  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2">How well do you know each topic?</h3>
      <p className="text-xs text-zinc-500 mb-4">Tap to cycle: New → Some → Solid → Teach it</p>
      {lessonParts.length === 0 ? (
        <p className="text-xs text-zinc-500 bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-3 py-2.5">
          You haven't created any lessons yet — topics appear here as you add lessons in the library. Skip this for now, or add lessons first.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lessonParts.map((part) => (
            <button
              key={part}
              onClick={() => cycle(part)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${levelColor(part)} border border-white/5`}
            >
              <span className="truncate max-w-[120px]">{lessonTitles[part] ?? `Part ${part}`}</span>
              <span className="font-mono text-[9px] opacity-60">{levelLabel(part)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SetupKnowledge {
  statement: string;
  topic: string;
  keywords: string;
  linkedLessons: string[];
  level: MasteryLevel | '';
}

function Q9({ knowledge, setKnowledge, lessonTitles }: { knowledge: SetupKnowledge[]; setKnowledge: (k: SetupKnowledge[]) => void; lessonTitles: string[] }) {
  const [draft, setDraft] = useState<SetupKnowledge>({ statement: '', topic: '', keywords: '', linkedLessons: [], level: '' });
  const [showForm, setShowForm] = useState(false);

  const toggleLesson = (title: string) => {
    setDraft((d) => ({ ...d, linkedLessons: d.linkedLessons.includes(title) ? d.linkedLessons.filter((t) => t !== title) : [...d.linkedLessons, title] }));
  };

  const add = () => {
    const statement = draft.statement.trim();
    if (!statement) return;
    setKnowledge([...knowledge, { ...draft, statement }]);
    setDraft({ statement: '', topic: '', keywords: '', linkedLessons: [], level: '' });
    setShowForm(false);
  };

  return (
    <div>
      <h3 className="font-serif text-lg text-zinc-100 mb-2 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-clay-400" />
        What do you already know?
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Add things you can already do, in your own words. Lessons will only use the entries that relate to the topic — skip or add a few now, edit anytime in your profile.
      </p>

      {knowledge.length > 0 && (
        <div className="space-y-1.5 mb-4 max-h-32 overflow-y-auto pr-1">
          {knowledge.map((k, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-800/20 px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[11px] text-zinc-300 leading-relaxed">{k.statement}</p>
                {(k.topic || k.level || k.linkedLessons.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {k.topic && <span className="px-1.5 py-0.5 rounded bg-zinc-700/40 text-[9px] text-zinc-400">{k.topic}</span>}
                    {k.level && <span className="px-1.5 py-0.5 rounded bg-sage-500/10 text-[9px] text-sage-400 font-mono">{k.level}</span>}
                    {k.linkedLessons.map((t) => <span key={t} className="px-1.5 py-0.5 rounded bg-clay-500/10 text-[9px] text-clay-400">{t}</span>)}
                  </div>
                )}
              </div>
              <button
                onClick={() => setKnowledge(knowledge.filter((_, j) => j !== i))}
                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-clay-300 bg-clay-500/10 border border-clay-500/20 hover:bg-clay-500/20 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add something you know
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-3.5">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">What do you know? <span className="text-clay-400">*</span>
              <FieldAIButton
                fieldName="statement"
                label="Knowledge Statement"
                value={draft.statement}
                onUpdate={(v) => setDraft((d) => ({ ...d, statement: v }))}
                allFields={{ statement: draft.statement, topic: draft.topic, level: draft.level, keywords: draft.keywords }}
                category="learn"
                context="Help articulate what the user knows about a topic"
              />
            </label>
            <textarea
              value={draft.statement}
              onChange={(e) => setDraft((d) => ({ ...d, statement: e.target.value }))}
              placeholder="e.g. I can implement gradient descent in NumPy and understand backpropagation end-to-end."
              className="w-full px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] leading-relaxed focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600 min-h-[56px] resize-y"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Topic (optional)
                <FieldAIButton
                  fieldName="topic"
                  label="Topic"
                  value={draft.topic}
                  onUpdate={(v) => setDraft((d) => ({ ...d, topic: v }))}
                  allFields={{ statement: draft.statement, topic: draft.topic, level: draft.level, keywords: draft.keywords }}
                  category="learn"
                  context="Categorize this knowledge entry"
                />
              </label>
              <input
                value={draft.topic}
                onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                placeholder="e.g. Deep Learning"
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Level</label>
              <select
                value={draft.level}
                onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value as MasteryLevel | '' }))}
                className="px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-300 text-[11px] focus:outline-none focus:border-clay-500/40"
              >
                <option value="">—</option>
                {(['L1', 'L2', 'L3', 'L4', 'L5'] as MasteryLevel[]).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Keywords (comma-separated, for relevance)
              <FieldAIButton
                fieldName="keywords"
                label="Keywords"
                value={draft.keywords}
                onUpdate={(v) => setDraft((d) => ({ ...d, keywords: v }))}
                allFields={{ statement: draft.statement, topic: draft.topic, level: draft.level, keywords: draft.keywords }}
                category="learn"
                context="Extract relevant keywords from this knowledge statement"
              />
            </label>
            <input
              value={draft.keywords}
              onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
              placeholder="gradient descent, backprop, neural nets"
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Your lessons</label>
            {lessonTitles.length === 0 ? (
              <p className="text-[10px] text-zinc-600 bg-zinc-900/40 border border-zinc-700/30 rounded-lg px-2.5 py-2">
                No lessons yet — this entry will relate to every topic until you create lessons and tag them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {lessonTitles.map((title) => (
                  <button
                    key={title}
                    onClick={() => toggleLesson(title)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition border ${
                      draft.linkedLessons.includes(title)
                        ? 'bg-clay-500/15 text-clay-300 border-clay-500/30'
                        : 'bg-zinc-900/40 text-zinc-500 border-zinc-700/30 hover:text-zinc-300'
                    }`}
                  >
                    {title.slice(0, 22)}{title.length > 22 ? '…' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setShowForm(false)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition">
              Cancel
            </button>
            <button
              onClick={add}
              disabled={!draft.statement.trim()}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-clay-300 bg-clay-500/15 border border-clay-500/25 hover:bg-clay-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to knowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
