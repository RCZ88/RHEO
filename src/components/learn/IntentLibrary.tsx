import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Trash2, ChevronRight, Sparkles, BookOpen, Clock, FileText, Search } from 'lucide-react';
import { BlurFade } from '../ui/blur-fade';

const api = (window as any).deskflowAPI;

interface Intent {
  id: string;
  title: string;
  description: string;
  context: string;
  knowledge_context: string;
  config: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  onGenerateFromIntent: (intent: Intent) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function IntentLibrary({ onGenerateFromIntent }: Props) {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadIntents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.learnListIntents();
      if (result.ok) setIntents(result.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadIntents(); }, [loadIntents]);

  const handleDelete = async (id: string) => {
    try {
      await api.learnDeleteIntent({ id });
      setIntents(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  const filtered = intents.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (intents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Lightbulb className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-200 mb-1">No saved ideas yet</h3>
        <p className="text-sm text-zinc-500 text-center max-w-sm">
          When you type something you want to learn in the Create Lesson dialog, click "Save for later" to keep it here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            Saved Ideas
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {intents.length} {intents.length === 1 ? 'idea' : 'ideas'} saved — click one to generate a lesson
          </p>
        </div>
        {intents.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search ideas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-sm w-48 focus:outline-none focus:border-amber-500/50 placeholder-zinc-600 transition-all"
            />
          </div>
        )}
      </div>

      {/* Intent cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((intent, i) => {
            const isExpanded = expandedId === intent.id;
            return (
              <BlurFade key={intent.id} delay={0.03 * i}>
                <motion.div
                  layout
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden transition-colors hover:border-zinc-700/80"
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-lg">
                        {intent.category === 'curriculum' ? '📚' : '💡'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-100 leading-snug">{intent.title}</h3>
                      {intent.description && intent.description !== intent.title && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {intent.description.slice(0, 160)}
                          {intent.description.length > 160 ? '...' : ''}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(intent.created_at)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500">
                          {intent.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : intent.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all"
                        title="View details"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDelete(intent.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-zinc-800/60">
                          {intent.description && (
                            <div className="mt-3">
                              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Description</p>
                              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{intent.description}</p>
                            </div>
                          )}
                          {intent.context && (
                            <div className="mt-3">
                              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Reference material</p>
                              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-6">{intent.context}</p>
                            </div>
                          )}
                          {intent.knowledge_context && (
                            <div className="mt-3">
                              <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-1">Learner knowledge context</p>
                              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-6">{intent.knowledge_context}</p>
                            </div>
                          )}
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => onGenerateFromIntent(intent)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 text-sm font-medium transition-all border border-clay-500/20"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Generate lesson from this
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </BlurFade>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
