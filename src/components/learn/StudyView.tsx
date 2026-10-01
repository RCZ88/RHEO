import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Loader2, BookOpen, Flame, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { BlurFade } from '../ui/blur-fade';

const api = (window as any).deskflowAPI;

interface Card {
  id: string;
  deck_id: string;
  card_type: string;
  front: string;
  back: string;
  front_media?: { image?: string };
  back_media?: { image?: string };
  tags?: string;
}

type CardRating = 1 | 2 | 3 | 4;

const RATING_CONFIG: Record<CardRating, { label: string; interval: string; bg: string; text: string; border: string }> = {
  1: { label: 'Again', interval: '1m', bg: 'bg-clay-500/20', text: 'text-clay-300', border: 'border-clay-500/30' },
  2: { label: 'Hard', interval: '6d', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/25' },
  3: { label: 'Good', interval: '10d', bg: 'bg-sage-400/15', text: 'text-sage-300', border: 'border-sage-400/25' },
  4: { label: 'Easy', interval: '24d', bg: 'bg-sky-400/15', text: 'text-sky-300', border: 'border-sky-400/25' },
};

interface Props {
  onBack?: () => void;
}

export function StudyView({ onBack }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [totalSession, setTotalSession] = useState(0);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.learnGetDueCards({ limit: 20 });
      if (result.ok) setCards(result.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped(f => !f); setRevealed(true); }
      if (revealed) {
        if (e.key === '1') handleRate(1);
        if (e.key === '2') handleRate(2);
        if (e.key === '3') handleRate(3);
        if (e.key === '4') handleRate(4);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [revealed]);

  const handleRate = useCallback(async (rating: CardRating) => {
    const card = cards[currentIndex];
    if (!card) return;
    try {
      await api.learnSubmitCardReview({ cardId: card.id, rating });
    } catch { /* ignore */ }
    setReviewed(r => r + 1);
    setTotalSession(t => t + 1);
    setFlipped(false);
    setRevealed(false);
    setTimeout(() => {
      setCurrentIndex(i => i + 1);
    }, 300);
  }, [cards, currentIndex]);

  const currentCard = cards[currentIndex];
  const isDone = currentIndex >= cards.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BlurFade inView>
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button onClick={onBack} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-clay-300">Active Recall</p>
              <h2 className="font-serif text-2xl font-semibold text-glow">Study Session</h2>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              {cards.length} cards due
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-clay-400" />
              {reviewed} reviewed
            </span>
            {cards.length > 0 && (
              <span>{Math.min(currentIndex + 1, cards.length)}/{cards.length}</span>
            )}
          </div>

          {/* Progress bar */}
          {cards.length > 0 && (
            <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-clay-500 rounded-full"
                animate={{ width: `${(reviewed / cards.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </header>
      </BlurFade>

      {/* Card area */}
      {!isDone && currentCard ? (
        <BlurFade delay={0.08}>
          <div className="perspective-[1000px] w-full max-w-[480px] mx-auto h-[280px] mb-6">
            <motion.div
              className="w-full h-full relative cursor-pointer"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { if (!revealed) { setFlipped(true); setRevealed(true); } }}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden rounded-xl border border-zinc-800 flex items-center justify-center p-6"
                style={{ background: 'rgba(217,119,6,0.06)', backfaceVisibility: 'hidden' }}>
                <div className="text-lg font-medium leading-relaxed text-zinc-100 text-center">
                  {currentCard.front}
                </div>
                {!revealed && <div className="absolute bottom-3 text-xs text-zinc-600">Click or Space to flip</div>}
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rounded-xl border border-zinc-800 flex items-center justify-center p-6"
                style={{ background: 'rgba(34,197,94,0.06)', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <div className="text-base leading-relaxed text-zinc-100 text-center">
                  {currentCard.back}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Grading buttons */}
          {revealed && (
            <div className="flex justify-center gap-3">
              {(Object.entries(RATING_CONFIG) as [string, typeof RATING_CONFIG[1]][]).map(([rating, config]) => (
                <motion.button
                  key={rating}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Number(rating) * 0.05 }}
                  onClick={() => handleRate(Number(rating) as CardRating)}
                  className={`px-5 py-3 rounded-xl border-[1.5px] ${config.border} ${config.bg} ${config.text} text-xs font-medium cursor-pointer transition-all hover:opacity-80 flex flex-col items-center min-w-[72px]`}
                >
                  <span>{config.label}</span>
                  <span className="text-[10px] opacity-60 mt-0.5">{config.interval}</span>
                </motion.button>
              ))}
            </div>
          )}

          {revealed && (
            <p className="text-center mt-4 text-[11px] text-zinc-600">Press 1-4 to rate</p>
          )}
        </BlurFade>
      ) : (
        /* Done state */
        <BlurFade delay={0.1}>
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-xl bg-sage-400/10 border border-sage-400/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-sage-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Session Complete</h3>
            <p className="text-sm text-zinc-500 mb-6">
              You reviewed {totalSession} {totalSession === 1 ? 'card' : 'cards'}.
              {cards.length === 0 && ' No cards were due for review.'}
            </p>
            <button
              onClick={() => { setCurrentIndex(0); setReviewed(0); setTotalSession(0); loadCards(); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 text-sm font-medium transition-all border border-clay-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Study More
            </button>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
