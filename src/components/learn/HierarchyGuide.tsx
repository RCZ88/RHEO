import React from 'react';
import { Layers, BookOpen, FileText, Target, Users, Brain, LibraryBig, GitBranch } from 'lucide-react';

/**
 * Visual hierarchy guide for the Learn module.
 * Shows Branch → Group → Topic → Subtopic → Lesson → Node with real examples
 * and connecting lines (per RESULT.md 08082026 hierarchy expansion).
 */

const MASTERY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  L0: { bg: 'bg-zinc-700/50', text: 'text-zinc-400', label: 'Beginner' },
  L1: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Aware' },
  L2: { bg: 'bg-teal-500/15', text: 'text-teal-400', label: 'Apprentice' },
  L3: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Practitioner' },
  L4: { bg: 'bg-violet-500/15', text: 'text-violet-400', label: 'Proficient' },
  L5: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Expert' },
};

function TreeLine({ color = 'border-zinc-700/40' }: { color?: string }) {
  return <div className={`absolute left-5 top-0 bottom-0 w-px ${color}`} />;
}

function TreeDot({ color = 'bg-clay-500' }: { color?: string }) {
  return <div className={`absolute left-[18px] top-3 w-2 h-2 rounded-full ${color} ring-2 ring-zinc-900 z-10`} />;
}

function BranchCard() {
  return (
    <div className="relative">
      <TreeDot color="bg-clay-500" />
      <div className="ml-10 rounded-xl border border-clay-500/20 bg-clay-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <LibraryBig className="w-4 h-4 text-clay-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-clay-400">Branch</span>
          <span className="text-[10px] text-zinc-600">— Predefined discipline</span>
        </div>
        <div className="font-serif text-lg font-semibold text-zinc-100">🤖 Computer Science & AI</div>
        <div className="text-xs text-zinc-500 mt-1">A field of study — mutually exclusive from other branches</div>
      </div>
    </div>
  );
}

function GroupCard() {
  return (
    <div className="relative">
      <TreeDot color="bg-sage-500" />
      <div className="ml-10 rounded-xl border border-sage-500/20 bg-sage-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-sage-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-sage-400">Group</span>
          <span className="text-[10px] text-zinc-600">— Your custom category</span>
        </div>
        <div className="font-serif text-base font-semibold text-zinc-100">Core Fundamentals</div>
        <div className="text-xs text-zinc-500 mt-1">You created this group to hold topics from anywhere in the curriculum</div>
      </div>
    </div>
  );
}

function TopicCard() {
  return (
    <div className="relative">
      <TreeDot color="bg-clay-500" />
      <div className="ml-10 rounded-xl border border-clay-500/20 bg-clay-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-clay-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-clay-400">Topic</span>
          <span className="text-[10px] text-zinc-600">— Predefined subject area</span>
        </div>
        <div className="font-serif text-lg font-semibold text-zinc-100">Software Design & Architecture</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] text-emerald-400 font-medium">
            <Target className="w-2.5 h-2.5" /> Practitioner
          </span>
          <span className="text-[10px] text-zinc-600">You're at practitioner level for this topic</span>
        </div>
      </div>
    </div>
  );
}

function SubtopicCard() {
  return (
    <div className="relative">
      <TreeDot color="bg-zinc-500" />
      <div className="ml-10 rounded-lg border border-zinc-600/20 bg-zinc-800/30 p-3">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Subtopic</span>
          <span className="text-[10px] text-zinc-600">— Optional nesting layer</span>
        </div>
        <div className="text-sm font-medium text-zinc-300">Design Patterns</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">A tag that groups lessons inside a topic</div>
      </div>
    </div>
  );
}

function LessonCard() {
  return (
    <div className="relative">
      <TreeDot color="bg-amber-500" />
      <div className="ml-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400">Lesson</span>
          <span className="text-[10px] text-zinc-600">— One .ldoc file</span>
        </div>
        <div className="font-serif text-base font-semibold text-zinc-100">Observer Pattern</div>
        <div className="text-xs text-zinc-500 mt-1">A self-contained learning unit with multiple sections inside</div>
      </div>
    </div>
  );
}

function NodeCard({ title, mastery, example }: { title: string; mastery: string; example: string }) {
  const mc = MASTERY_COLORS[mastery] || MASTERY_COLORS.L0;
  return (
    <div className="relative">
      <TreeDot color="bg-violet-500" />
      <div className="ml-10 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400">Node</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${mc.bg} ${mc.text}`}>
            {mc.label}
          </span>
        </div>
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{example}</div>
      </div>
    </div>
  );
}

export function HierarchyGuide({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-1">
      {showHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-clay-400" />
          <span className="text-sm font-medium text-zinc-200">How Lyceum is organized</span>
        </div>
      )}

      <div className="relative space-y-4">
        <TreeLine />
        <BranchCard />

        <div className="pl-10 relative">
          <TreeLine />
          <GroupCard />
        </div>

        <div className="pl-20 relative">
          <TreeLine />
          <TopicCard />
        </div>

        <div className="pl-30 relative">
          <TreeLine />
          <SubtopicCard />
        </div>

        <div className="pl-40 relative">
          <TreeLine />
          <LessonCard />
        </div>

        <div className="pl-52 relative space-y-3">
          <NodeCard
            title="What is the Observer Pattern?"
            mastery="L2"
            example="Define the pattern, show when to use it, and compare to pub/sub"
          />
          <NodeCard
            title="Implementing Observer in TypeScript"
            mastery="L3"
            example="Step-by-step code walkthrough with real examples"
          />
          <NodeCard
            title="Observer vs Mediator vs Pub/Sub"
            mastery="L4"
            example="When to use which pattern, trade-offs, and anti-patterns"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3 text-[11px]">
        <div className="flex items-start gap-2">
          <Brain className="w-3.5 h-3.5 text-clay-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-zinc-300 font-medium">Mastery</span>
            <span className="text-zinc-600"> — Your level per Topic updates based on quiz results and tutor interactions</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Users className="w-3.5 h-3.5 text-sage-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-zinc-300 font-medium">Groups</span>
            <span className="text-zinc-600"> — You create these to hold topics. Branches and topics are predefined.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
