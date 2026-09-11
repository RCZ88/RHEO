import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RefreshCw, ExternalLink, Brain, Sparkles, BookOpen, Cpu } from 'lucide-react';
import { GlassCard } from '../components/ai';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';

interface TopicSourceLink {
  title: string;
  url: string;
}

interface TopicDigestItem {
  topic: string;
  summary: string;
  sources?: TopicSourceLink[];
}

interface TopicDigestCardProps {
  topics: TopicDigestItem[];
  loading: boolean;
  error?: string;
  reason?: string;
  onRefresh: () => void;
  onConfigure?: () => void;
  providerBadge?: { label: string; color: string } | null;
}

export function TopicDigestCard({ topics, loading, error, reason, onRefresh, onConfigure, providerBadge }: TopicDigestCardProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  return (
    <GlassCard accent="amber" className="relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Research Digest</h3>
              {providerBadge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${providerBadge.color}`}>
                  {providerBadge.label}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500">AI-curated topic summaries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onConfigure && (
            <Button
              onClick={onConfigure}
              variant="ghost"
              size="icon"
              title="Configure provider"
            >
              <Cpu className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            onClick={onRefresh}
            disabled={loading}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/8 ring-1 ring-red-500/15 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && topics.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/60 ring-1 ring-zinc-700/40 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-zinc-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">No research topics</p>
            <p className="text-xs text-zinc-500 mt-1">{reason || "Add topics in Settings → AI Assistant to get daily digests."}</p>
          </div>
        </div>
      )}

      {!loading && topics.length > 0 && (
        <div className="space-y-2">
          {topics.map((item, i) => {
            const isOpen = expandedTopic === item.topic;
            return (
              <motion.div
                key={item.topic}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-lg p-3 bg-zinc-800/10 ring-1 ring-zinc-800/60 hover:ring-zinc-700 transition-all duration-200"
              >
                <button
                  onClick={() => setExpandedTopic(isOpen ? null : item.topic)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-zinc-800/60 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                    </div>
                    <span className="text-xs font-medium text-zinc-200">{item.topic}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-500 transition-all duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 px-3 pb-3">
                        <p className="text-xs text-zinc-400 leading-relaxed">{item.summary}</p>
                        {item.sources && item.sources.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60 space-y-1">
                            {item.sources.map((src, si) => (
                              <a
                                key={si}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
