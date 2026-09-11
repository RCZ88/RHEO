import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RefreshCw, ExternalLink, Brain, Sparkles, BookOpen, Cpu } from 'lucide-react';
import { GlassCard, SectionHead, StateShell, IconButton, StatusDot, MOTION } from '../components/ai';
import type { ViewState } from '../components/ai/StateShell';

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

  const viewState: ViewState<TopicDigestItem[]> = loading
    ? { status: 'loading' }
    : error
      ? { status: 'error', message: error, retry: onRefresh }
      : topics.length === 0
        ? { status: 'empty' }
        : { status: 'ready', data: topics };

  return (
    <GlassCard accent="amber" className="relative overflow-hidden">
      <SectionHead
        accent="cyan"
        title="Research Digest"
        desc="AI-curated topic summaries"
        right={
          <div className="flex items-center gap-2">
            {providerBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${providerBadge.color}`}>
                {providerBadge.label}
              </span>
            )}
            {onConfigure && (
              <IconButton icon={Cpu} label="Configure provider" onClick={onConfigure} />
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        }
      />

      <StateShell state={viewState} skeleton={
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-zinc-800/60 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/5 rounded bg-zinc-800/60 animate-pulse" />
                <div className="h-2.5 w-full rounded bg-zinc-800/40 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      } empty={
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/60 ring-1 ring-zinc-700/40 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-zinc-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">No research topics</p>
            <p className="text-xs text-zinc-500 mt-1">{reason || "Add topics in Settings → AI Assistant to get daily digests."}</p>
          </div>
        </div>
      }>
        {() => (
          <div className="space-y-2">
            {topics.map((item, i) => {
              const isOpen = expandedTopic === item.topic;
              return (
                <motion.div
                  key={item.topic}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
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
                        transition={{ duration: MOTION.normal, ease: MOTION.ease }}
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
      </StateShell>
    </GlassCard>
  );
}
