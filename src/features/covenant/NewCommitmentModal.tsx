import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Commitment, CommitmentCadence, DetectionMode, WarmColorKey } from './types';
import { WARM_COLORS, WARM_COLOR_KEYS } from './covenantColors';

interface NewCommitmentModalProps {
  existing?: Commitment;
  onClose: () => void;
  onCreate: (input: Omit<Commitment, 'id' | 'createdAt' | 'archivedAt'>) => void;
  onUpdate?: (id: string, patch: Partial<Omit<Commitment, 'id' | 'createdAt' | 'archivedAt'>>) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 } };
const cardMotion = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
};

export function NewCommitmentModal({ existing, onClose, onCreate, onUpdate }: NewCommitmentModalProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [cadence, setCadence] = useState<CommitmentCadence>(existing?.cadence ?? 'daily');
  const [weeklyTargetDays, setWeeklyTargetDays] = useState<number[]>(existing?.weeklyTargetDays ?? [1, 3, 5]);
  const [color, setColor] = useState<WarmColorKey>(existing?.color ?? 'clay');
  const [targetDays, setTargetDays] = useState(existing?.targetDays ?? 0);
  const [detectEnabled, setDetectEnabled] = useState(existing?.detection.enabled ?? false);
  const [detectMode, setDetectMode] = useState<DetectionMode>(existing?.detection.mode ?? 'positive');
  const [keywords, setKeywords] = useState(existing?.detection.keywords.join(', ') ?? '');
  const [minMinutes, setMinMinutes] = useState(existing?.detection.minMinutes ?? 10);
  const [requireJournal, setRequireJournal] = useState(existing?.requireJournal ?? false);
  const [autoConfirm, setAutoConfirm] = useState(existing?.autoConfirmWhenClean ?? false);
  const isEditing = !!existing;

  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: 'Flame',
      color,
      cadence,
      weeklyTargetDays,
      targetDays: targetDays > 0 ? targetDays : undefined,
      detection: {
        enabled: detectEnabled,
        mode: detectMode,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        minMinutes,
      },
      requireJournal,
      autoConfirmWhenClean: detectMode === 'avoidance' ? autoConfirm : false,
    };
    if (isEditing && onUpdate && existing) {
      onUpdate(existing.id, payload);
    } else {
      onCreate(payload);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        initial={overlayMotion.initial}
        animate={overlayMotion.animate}
        exit={overlayMotion.initial}
        onClick={onClose}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={cardMotion.initial}
          animate={cardMotion.animate}
          exit={cardMotion.initial}
          transition={cardMotion.transition}
          className="w-full max-w-md rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 p-5 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{isEditing ? 'Edit commitment' : 'New commitment'}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
          </div>

          <label className="block text-[11px] text-[var(--text-muted)] mb-1">What are you committing to?</label>
          <input
            autoFocus={!isEditing}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Morning stillness, Read scripture, Call a friend"
            className="w-full mb-3 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[13px] text-[var(--text-primary)] placeholder:text-zinc-600 focus:outline-none focus:border-[#e8866b]/50"
          />

          <label className="block text-[11px] text-[var(--text-muted)] mb-1">A short note to yourself (optional)</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Why this matters to you"
            className="w-full mb-3 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[13px] text-[var(--text-primary)] placeholder:text-zinc-600 focus:outline-none focus:border-[#e8866b]/50"
          />

          <label className="block text-[11px] text-[var(--text-muted)] mb-1.5">Color</label>
          <div className="flex gap-2 mb-3">
            {WARM_COLOR_KEYS.map(k => {
              const swatchStyle = { background: WARM_COLORS[k].hex };
              return (
                <button
                  key={k}
                  onClick={() => setColor(k)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === k ? 'scale-110 border-white/70' : 'border-transparent'}`}
                  style={swatchStyle}
                />
              );
            })}
          </div>

          <label className="block text-[11px] text-[var(--text-muted)] mb-1.5">Cadence</label>
          <div className="flex gap-2 mb-3">
            {(['daily', 'weekly'] as CommitmentCadence[]).map(c => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                  cadence === c ? 'bg-[#e8866b]/15 text-[#e8866b] border-[#e8866b]/30' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                }`}
              >
                {c === 'daily' ? 'Every day' : 'Specific days'}
              </button>
            ))}
          </div>

          {cadence === 'weekly' && (
            <div className="flex gap-1.5 mb-3">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setWeeklyTargetDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                  className={`w-8 h-8 rounded-full text-[11px] font-medium transition-colors ${
                    weeklyTargetDays.includes(i) ? 'bg-[#e8866b]/20 text-[#e8866b]' : 'bg-zinc-800/50 text-zinc-500'
                  }`}
                >
                  {d[0]}
                </button>
              ))}
            </div>
          )}

          <label className="block text-[11px] text-[var(--text-muted)] mb-1">Target (optional)</label>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              min={0}
              value={targetDays}
              onChange={e => setTargetDays(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[13px] text-[var(--text-primary)] text-center focus:outline-none focus:border-[#e8866b]/50"
            />
            <span className="text-[12px] text-zinc-400">days</span>
            {targetDays > 0 && (
              <span className="text-[11px] text-zinc-500">e.g. 30-day challenge, 100-day streak</span>
            )}
          </div>

          <div className="rounded-lg bg-zinc-800/40 p-3 mb-4">
            <label className="flex items-center gap-2 text-[12px] text-zinc-300 mb-2 cursor-pointer select-none">
              <input type="checkbox" checked={detectEnabled} onChange={e => setDetectEnabled(e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-[#e8866b]" />
              Auto-detect from activity (optional)
            </label>
            {detectEnabled && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['positive', 'avoidance'] as DetectionMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setDetectMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        detectMode === m
                          ? m === 'positive'
                            ? 'bg-[#6fb38f]/15 text-[#6fb38f] border-[#6fb38f]/30'
                            : 'bg-[#e8866b]/15 text-[#e8866b] border-[#e8866b]/30'
                          : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50'
                      }`}
                    >
                      {m === 'positive' ? 'Positive (count as done)' : 'Avoidance (cancel streak)'}
                    </button>
                  ))}
                </div>
                <input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="App or site keywords, comma-separated (e.g. Duolingo, reddit.com)"
                  className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-700/50 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                />
                {detectMode === 'positive' && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    Count as done after
                    <input
                      type="number"
                      min={1}
                      value={minMinutes}
                      onChange={e => setMinMinutes(Number(e.target.value) || 1)}
                      className="w-14 px-1.5 py-1 rounded bg-zinc-900/60 border border-zinc-700/50 text-center"
                    />
                    minutes
                  </div>
                )}
                {detectMode === 'avoidance' && (
                  <p className="text-[11px] text-[#e8866b]/80">Detecting any of these keywords will cancel today&apos;s streak</p>
                )}
                <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer select-none">
                  <input type="checkbox" checked={requireJournal} onChange={e => setRequireJournal(e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-[#e8866b]" />
                  Require journal entry before confirming
                </label>
                {detectMode === 'avoidance' && (
                  <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer select-none">
                    <input type="checkbox" checked={autoConfirm} onChange={e => setAutoConfirm(e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-[#e8866b]" />
                    Auto-confirm when no violations detected
                  </label>
                )}
              </div>
            )}
          </div>

          <button
            disabled={!canSave}
            onClick={submit}
            className="w-full py-2.5 rounded-lg bg-[#e8866b] text-white text-[13px] font-semibold hover:bg-[#d96846] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing ? 'Save changes' : 'Begin this practice'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
