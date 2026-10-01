import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, FileUp, Sparkles, BookMarked, LayoutGrid, Rows3, FolderCog, LibraryBig, GitBranch } from 'lucide-react';
import type { LessonSummary, TutorDashboardData } from '../../shared/learn/types';
import { BookCard } from './BookCard';
import { BookSpine } from './BookSpine';
import { BlurFade } from '../ui/blur-fade';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { MasteryStrip } from './MasteryStrip';
import { TutorDashboardSection } from './TutorDashboardSection';
import { CollapsibleAnalytics } from './CollapsibleAnalytics';
import { ProgressDashboard } from './ProgressDashboard';
import type { MasteryStats } from './useMasteryStats';
import { CURRICULUM_BRANCHES, getTopic } from '../../services/learn/curriculum';

export interface LessonLibraryProps {
  lessons: LessonSummary[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onInfo?: (id: string) => void;
  onCompose: () => void;
  onImport: () => void;
  onWelcome?: () => void;
  stats?: MasteryStats;
  onOpenProfile?: () => void;
  getDashboard?: () => Promise<TutorDashboardData>;
  onNavigateToNode?: (nodeId: string) => void;
  onManageGroups?: () => void;
}

function LibrarySkeletons({ spine }: { spine?: boolean }) {
  if (spine) {
    return (
      <div className="flex gap-2 items-end overflow-x-auto pb-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="w-12 rounded-md" style={{ height: 220 }} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-[248px] w-full rounded-r-md rounded-l-sm" />
          <Skeleton className="mx-auto h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

type ViewMode = 'covers' | 'spines';

export function LessonLibrary({ lessons, loading, onOpen, onInfo, onCompose, onImport, onWelcome, stats, onOpenProfile, getDashboard, onNavigateToNode, onManageGroups }: LessonLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('covers');
  const [branchId, setBranchId] = useState<string>('cs-ai');

  const activeBranch = CURRICULUM_BRANCHES.find((b) => b.id === branchId) ?? CURRICULUM_BRANCHES[0];

  // Lessons of the selected branch of study
  const branchLessons = useMemo(
    () => lessons.filter((l) => (l.branch_id || 'cs-ai') === branchId),
    [lessons, branchId]
  );

  // Group lessons into shelves by topic so the library reads like a curriculum.
  const shelves = new Map<number, LessonSummary[]>();
  for (const l of branchLessons) {
    const arr = shelves.get(l.part) ?? [];
    arr.push(l);
    shelves.set(l.part, arr);
  }
  const orderedParts = Array.from(shelves.keys()).sort((a, b) => a - b);

  return (
    <div className="lyceum-library mx-auto w-full max-w-6xl px-6 py-10" data-page="learn">
      <BlurFade inView>
        <header className="mb-9 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-clay-300">Lyceum</p>
            <h1 className="mt-1 font-serif text-4xl font-semibold text-glow">Your Library</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              {branchLessons.length} {branchLessons.length === 1 ? 'volume' : 'volumes'} on the {activeBranch.title} shelf. Every lesson is
              grounded, versioned, and ready to study.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setViewMode('covers')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'covers'
                    ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Cover grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('spines')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'spines'
                    ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Spine view"
              >
                <Rows3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {onWelcome && (
              <button
                onClick={onWelcome}
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 underline-offset-4 transition-colors hover:text-glow hover:underline"
              >
                &larr; Welcome
              </button>
            )}
            <Button variant="secondary" onClick={onImport}>
              <FileUp className="mr-2 h-4 w-4" />
              Import
            </Button>
            {onManageGroups && (
              <button
                onClick={onManageGroups}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700/50 hover:border-zinc-600/60"
                title="Manage groups"
              >
                <FolderCog className="h-4 w-4" />
                Groups
              </button>
            )}
            <button
              onClick={onCompose}
              className="inline-flex items-center gap-2 rounded-xl border border-clay-400/40 bg-clay-500/15 px-5 py-2.5 font-serif text-sm font-semibold text-glow transition-all hover:bg-clay-500/25 hover:shadow-[0_0_20px_rgba(194,85,58,0.25)]"
            >
              <Plus className="h-4 w-4" />
              Compose lesson
            </button>
          </div>
        </header>
      </BlurFade>

      {/* Branch of Study tabs */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {CURRICULUM_BRANCHES.map((branch) => {
          const count = lessons.filter((l) => (l.branch_id || 'cs-ai') === branch.id).length;
          const active = branch.id === branchId;
          return (
            <button
              key={branch.id}
              onClick={() => setBranchId(branch.id)}
              className={`group relative flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-all ${
                active
                  ? 'border-zinc-600/70 bg-zinc-800/70 text-zinc-100'
                  : 'border-white/10 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/60'
              }`}
              title={branch.description}
            >
              <LibraryBig className="h-3.5 w-3.5" style={{ color: branch.color }} />
              <span>{branch.emoji}</span>
              {branch.title}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {stats && <MasteryStrip stats={stats} onOpenNode={onOpen} onOpenProfile={onOpenProfile} />}

      {/* Inline analytics — collapsed by default, expands when user has streak */}
      {branchLessons.length > 0 && (
        <CollapsibleAnalytics streakDays={0}>
          <ProgressDashboard embedded />
        </CollapsibleAnalytics>
      )}

      {getDashboard && branchLessons.length > 0 && (
        <div className="mt-8 mb-8">
          <TutorDashboardSection
            getDashboard={getDashboard}
            onNavigateToNode={onNavigateToNode}
          />
        </div>
      )}

      {loading ? (
        <LibrarySkeletons spine={viewMode === 'spines'} />
      ) : branchLessons.length === 0 ? (
        // ── Empty branch shelf ──
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/60" style={{ color: activeBranch.color }}>
            <LibraryBig className="h-7 w-7" />
          </div>
          <h3 className="font-serif text-xl text-zinc-200">
            {activeBranch.emoji} {activeBranch.title}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-500">
            {activeBranch.description || 'No lessons on this shelf yet.'}
          </p>
          <Button onClick={onCompose} className="mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Compose the first lesson
          </Button>
        </div>
      ) : viewMode === 'spines' ? (
        // ── Spine View ──
        <div className="space-y-12">
          {orderedParts.map((part) => {
            const partLessons = shelves.get(part)!;
            const topic = getTopic(part);
            return (
              <section key={part}>
                <div className="mb-4 flex items-center gap-3">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-400">
                    {topic?.emoji || '📖'} {topic?.title || `Topic ${String(part).padStart(2, '0')}`}
                  </h2>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="flex gap-2 items-end overflow-x-auto pb-4 ws-scroll">
                  {partLessons.map((lesson, i) => (
                    <BookSpine
                      key={lesson.id}
                      lesson={lesson}
                      index={i}
                      onOpen={onOpen}
                      onInfo={onInfo}
                    />
                  ))}
                </div>

                {/* wooden shelf rail */}
                <div className="lyceum-shelf-rail mt-1 h-2 w-full rounded-full" />
              </section>
            );
          })}
        </div>
      ) : (
        // ── Cover Grid View ──
        <div className="space-y-12">
          {orderedParts.map((part) => {
            const partLessons = shelves.get(part)!;
            const topic = getTopic(part);
            const chapters = new Map<string, LessonSummary[]>();
            for (const l of partLessons) {
              const ch = l.chapter || '';
              const arr = chapters.get(ch) || [];
              arr.push(l);
              chapters.set(ch, arr);
            }
            const orderedChapters = Array.from(chapters.keys()).sort((a, b) => {
              if (!a) return 1;
              if (!b) return -1;
              return a.localeCompare(b);
            });

            return (
              <section key={part}>
                <div className="mb-4 flex items-center gap-3">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-400">
                    {topic?.emoji || '📖'} {topic?.title || `Topic ${String(part).padStart(2, '0')}`}
                  </h2>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                {orderedChapters.map((chapter) => {
                  const chapterLessons = chapters.get(chapter)!;
                  // Group by subtopic within the group
                  const subGroups = new Map<string, LessonSummary[]>();
                  for (const l of chapterLessons) {
                    const st = l.subtopic || '';
                    const arr = subGroups.get(st) || [];
                    arr.push(l);
                    subGroups.set(st, arr);
                  }
                  const orderedSubtopics = Array.from(subGroups.keys()).sort((a, b) => {
                    if (!a) return 1;
                    if (!b) return -1;
                    return a.localeCompare(b);
                  });

                  return (
                    <div key={chapter || '__ungrouped__'} className="mb-6 last:mb-0">
                      {chapter && (
                        <div className="mb-3 flex items-center gap-2 ml-1">
                          <BookMarked className="h-3 w-3 text-zinc-500" />
                          <h3 className="text-xs font-medium text-zinc-500">{chapter}</h3>
                          <span className="h-px flex-1 bg-white/5" />
                        </div>
                      )}
                      {orderedSubtopics.map((subtopic) => (
                        <div key={subtopic || '__no_subtopic__'} className={subtopic ? 'mb-4' : 'mb-2'}>
                          {subtopic && (
                            <div className="mb-2 flex items-center gap-2 ml-1">
                              <GitBranch className="h-3 w-3 text-zinc-600" />
                              <h4 className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                                {subtopic}
                              </h4>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
                            {subGroups.get(subtopic)!.map((lesson, i) => (
                              <BookCard key={lesson.id} lesson={lesson} index={i} onOpen={onOpen} onInfo={onInfo} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* wooden shelf rail */}
                <div className="lyceum-shelf-rail mt-3 h-2 w-full rounded-full" />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
