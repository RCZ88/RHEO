import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, HeartHandshake, Flame, Sparkles } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { EmptyState } from '../../components/EmptyState';
import { useCovenant } from './useCovenant';
import { CommitmentCard, buildRecentDates } from './CommitmentCard';
import { NewCommitmentModal } from './NewCommitmentModal';
import type { Commitment } from './types';
import { GraceResetMoment } from './GraceResetMoment';
import { MilestoneCelebration } from './MilestoneCelebration';
import { ReflectionPromptCard } from './ReflectionPromptCard';
import { ReflectionEcho } from './ReflectionEcho';
import { ConstellationHero } from './ConstellationHero';
import { JournalDrawer } from './JournalDrawer';
import { todayStr } from './storage';

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

interface CovenantPageProps {
  embedded?: boolean;
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function overallStreak(dates: string[]): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  let cursor = todayStr();
  if (!set.has(cursor)) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while (set.has(cursor)) { streak += 1; cursor = shiftDate(cursor, -1); }
  return streak;
}

export default function CovenantPage({ embedded = false }: CovenantPageProps = {}) {
  const {
    commitments, completions, violations, statsById, events, dismissEvent,
    addCommitment, updateCommitment, archiveCommitment, deleteCommitment, markComplete, unmarkComplete, totalPracticeDays, journalFor,
  } = useCovenant();
  const [showNew, setShowNew] = useState(false);
  const [editCommitment, setEditCommitment] = useState<Commitment | null>(null);

  const graceEvents = events.filter(e => e.type === 'grace-reset');
  const milestoneEvent = events.find(e => e.type === 'milestone');

  const uniqueDates = useMemo(() => [...new Set(completions.map(c => c.date))], [completions]);
  const streak = useMemo(() => overallStreak(uniqueDates), [uniqueDates]);

  const body = (
    <div className={embedded ? 'space-y-4' : 'max-w-3xl mx-auto space-y-4'}>
      <ConstellationHero dates={uniqueDates} milestone={milestoneEvent?.milestone ?? null}>
        <div className="flex items-end justify-between h-full p-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-clay-500-20)] flex items-center justify-center text-[var(--color-clay-400)] backdrop-blur-sm">
                <HeartHandshake className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-lg font-semibold text-white drop-shadow">Covenant</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#f0a892]" />
                <span className="text-xl font-bold tabular-nums text-white">{streak}</span>
                <span className="text-[11px] text-white/60">day streak</span>
              </div>
              <div className="w-px h-6 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--color-mem-400)]" />
                <span className="text-xl font-bold tabular-nums text-white">{totalPracticeDays}</span>
                <span className="text-[11px] text-white/60">days of practice, kept forever</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-clay-500)] text-white text-[12px] font-semibold hover:bg-[#d96846] transition-colors shadow-lg shadow-black/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New commitment
          </button>
        </div>
      </ConstellationHero>

      <ReflectionPromptCard onReflect={() => {}} />
      <ReflectionEcho />

      <AnimatePresence>
        {graceEvents.map((e, idx) => {
          const c = commitments.find(cc => cc.id === e.commitmentId);
          if (!c) return null;
          return (
            <GraceResetMoment
              key={`${e.commitmentId}-${idx}`}
              commitmentId={e.commitmentId}
              commitmentName={c.name}
              onDone={() => dismissEvent(events.indexOf(e))}
            />
          );
        })}
      </AnimatePresence>

      {commitments.length === 0 ? (
        <EmptyState
          title="No commitments yet"
          description="Start with one small, meaningful practice. You can always add more."
        />
      ) : (
        <motion.div className="space-y-3" initial="hidden" animate="show" variants={listVariants}>
          {commitments.map(c => {
            const stats = statsById.get(c.id)!;
            const isDoneToday = completions.some(comp => comp.commitmentId === c.id && comp.date === todayStr());
            const hasJournalToday = !!journalFor(c.id, todayStr());
            const handleToggle = (journalSaved: boolean) => {
              if (isDoneToday) {
                unmarkComplete(c.id);
              } else if (journalSaved) {
                markComplete(c.id);
              }
            };
            return (
              <motion.div key={c.id} variants={itemVariants}>
                <CommitmentCard
                  commitment={c}
                  stats={stats}
                  isDoneToday={isDoneToday}
                  hasJournalToday={hasJournalToday}
                  onToggleToday={handleToggle}
                  onEdit={() => setEditCommitment(c)}
                  onDelete={() => {
                    if (c.archivedAt !== null) {
                      deleteCommitment(c.id);
                    } else {
                      archiveCommitment(c.id);
                    }
                  }}
                  recentDates={buildRecentDates(c, completions)}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <div className="pt-2">
        <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
          Today's general reflection
        </p>
        <div className="mt-1.5">
          <JournalDrawer commitmentId={null} date={todayStr()} />
        </div>
      </div>
    </div>
  );

  const modals = (
    <>
      {showNew && <NewCommitmentModal onClose={() => setShowNew(false)} onCreate={addCommitment} />}
      {editCommitment && (
        <NewCommitmentModal
          existing={editCommitment}
          onClose={() => setEditCommitment(null)}
          onCreate={addCommitment}
          onUpdate={(id, patch) => updateCommitment(id, patch)}
        />
      )}
      {milestoneEvent && (() => {
        const c = commitments.find(cc => cc.id === milestoneEvent.commitmentId);
        if (!c) return null;
        return (
          <MilestoneCelebration
            commitmentName={c.name}
            milestone={milestoneEvent.milestone!}
            onClose={() => dismissEvent(events.indexOf(milestoneEvent))}
          />
        );
      })()}
    </>
  );

  if (embedded) {
    return (
      <>
        {body}
        {modals}
      </>
    );
  }

  return (
    <PageShell page="covenant">
      {body}
      {modals}
    </PageShell>
  );
}
