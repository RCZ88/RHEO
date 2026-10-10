import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, FileText, Filter, Loader2, Check, AlertCircle, Plus, Brain, Send, RotateCcw, ChevronDown, ChevronUp, Copy, Sparkles, Lightbulb, ClipboardPaste,
} from 'lucide-react';
import { addKnowledgeEntry } from '../../services/learn/learnerProfile';
import { KNOWLEDGE_INTAKE_RECIPES } from '../../services/learn/knowledgeIntakePrompts';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import type { LearnerProfile } from '../../shared/learn/types';

console.log('%c[KnowledgeIntakePanel] v3.0 loaded', 'color: #fbbf24; font-weight: bold');

interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface ExtractedEntry { statement: string; topic: string; keywords: string[]; level: string }
type Mode = 'survey' | 'extract' | 'topic';
interface Props { profile: LearnerProfile; onProfileUpdate: (profile: LearnerProfile) => void }

const MODE_CONFIG: {
  key: Mode; label: string; icon: React.ReactNode; shortDesc: string;
  emptyTitle: string; emptyBody: string; emptyIcon: React.ReactNode;
  inputPlaceholder: string; submitLabel: string; loadingLabel: string; copyLabel: string;
}[] = [
  {
    key: 'survey', label: 'Survey', icon: <MessageCircle size={15} />,
    shortDesc: 'AI interviews you with questions to discover what you already know',
    emptyTitle: 'No conversation yet',
    emptyBody: 'Tell the AI what topic you want to learn about. It will ask you targeted questions to discover what you already know \u2014 no chat transcript needed.',
    emptyIcon: <Lightbulb size={28} className="text-amber-400/40" />,
    inputPlaceholder: 'Type your answer, or describe what you know about the topic\u2026',
    submitLabel: 'Send', loadingLabel: 'Thinking\u2026', copyLabel: 'Copy Survey Prompt',
  },
  {
    key: 'extract', label: 'Extract', icon: <FileText size={15} />,
    shortDesc: 'Paste a chat transcript and AI pulls out the knowledge',
    emptyTitle: 'No transcript pasted yet',
    emptyBody: 'Paste a chat transcript from any AI conversation (ChatGPT, Claude, or any discussion). The AI will find and extract the knowledge from it.',
    emptyIcon: <ClipboardPaste size={28} className="text-blue-400/40" />,
    inputPlaceholder: 'Paste your chat transcript here\u2026',
    submitLabel: 'Extract Knowledge', loadingLabel: 'Extracting\u2026', copyLabel: 'Copy Extract Prompt',
  },
  {
    key: 'topic', label: 'Topic Focus', icon: <Filter size={15} />,
    shortDesc: 'Paste a long chat + pick a topic \u2014 AI extracts only that topic',
    emptyTitle: 'No transcript pasted yet',
    emptyBody: 'Paste a long chat transcript AND enter a topic above. The AI will only pull out knowledge related to that specific topic.',
    emptyIcon: <Sparkles size={28} className="text-violet-400/40" />,
    inputPlaceholder: 'Paste your chat transcript here\u2026',
    submitLabel: 'Extract for Topic', loadingLabel: 'Extracting\u2026', copyLabel: 'Copy Topic Prompt',
  },
];

const levelColor = (level: string) => {
  switch (level) {
    case 'beginner': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'intermediate': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'advanced': return 'bg-violet-500/20 text-violet-400 border border-violet-500/30';
    case 'expert': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    default: return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
  }
};

export function KnowledgeIntakePanel({ profile, onProfileUpdate }: Props) {
  const api = (window as any).deskflowAPI;
  const [mode, setMode] = useState<Mode>('survey');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<ExtractedEntry[]>([]);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const activeConfig = MODE_CONFIG.find(m => m.key === mode)!;

  const handleCopyPrompt = useCallback(async () => {
    const recipe = KNOWLEDGE_INTAKE_RECIPES.find(r =>
      r.slug === (mode === 'topic' ? 'knowledge-topic-extract' : mode === 'extract' ? 'knowledge-extract' : 'knowledge-survey')
    );
    if (!recipe) return;
    const { system, user } = recipe.build(topic || undefined, undefined);
    const full = `## SYSTEM PROMPT\n${system}\n\n## USER PROMPT\n${user}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch { /* ignore */ }
  }, [mode, topic]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const callAI = useCallback(
    async (systemPrompt: string, chatMessages: ChatMessage[]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.learnAiChat({ systemPrompt, messages: chatMessages });
        if (!res?.ok) throw new Error(res?.error || 'AI call failed');
        return res.data as string;
      } catch (e: any) {
        setError(e.message || 'Unexpected error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  const parseEntries = useCallback((raw: string): ExtractedEntry[] => {
    try {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter((e: any) => e.statement && typeof e.statement === 'string');
      }
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return parsed.entries.filter((e: any) => e.statement && typeof e.statement === 'string');
      }
    } catch { /* line-based fallback */ }
    const lines = raw.split(/\n{2,}/).filter((l) => l.trim().length > 10);
    return lines.map((l) => ({
      statement: l.trim().replace(/^[-*]\s*/, ''),
      topic: 'general',
      keywords: [] as string[],
      level: 'intermediate',
    }));
  }, []);

  const detectWrongMode = useCallback(
    (text: string): Mode | null => {
      const lower = text.toLowerCase();
      if (mode === 'survey' && (lower.includes('paste your transcript') || lower.includes('paste a conversation') || lower.includes('provide a transcript'))) return 'extract';
      if (mode === 'extract' && (lower.includes('tell me about') || lower.includes('let me ask') || lower.includes('what do you know'))) return 'survey';
      return null;
    },
    [mode]
  );

  const handleSurveySend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputValue('');
    const systemPrompt =
      KNOWLEDGE_INTAKE_RECIPES?.survey ||
      'You are a knowledge-survey expert. Interview the user to discover what they know. Ask targeted follow-up questions. When you have enough information, output a JSON array of extracted knowledge entries: [{"statement":"...","topic":"...","keywords":["..."],"level":"beginner|intermediate|advanced|expert"}]. If you need more info, continue the conversation as normal text. If the user should use transcript-extract mode, start with [SWITCH_MODE:extract].';
    const response = await callAI(systemPrompt, updated);
    if (!response) return;
    const redirectMode = detectWrongMode(response);
    if (redirectMode) {
      setMode(redirectMode);
      setError(redirectMode === 'extract' ? 'AI suggests Extract mode. Switched automatically.' : 'AI suggests Survey mode. Switched automatically.');
      return;
    }
    const entries = parseEntries(response);
    if (entries.length > 0) {
      setResults(entries);
      setMessages([...updated, { role: 'assistant', content: `Found ${entries.length} knowledge ${entries.length === 1 ? 'entry' : 'entries'}. Review them below.` }]);
    } else {
      setMessages([...updated, { role: 'assistant', content: response }]);
    }
  }, [inputValue, messages, loading, callAI, detectWrongMode, parseEntries]);

  const handleExtractSubmit = useCallback(async () => {
    const text = transcript.trim();
    if (!text || loading) return;
    const systemPrompt =
      KNOWLEDGE_INTAKE_RECIPES?.extract ||
      'Extract factual knowledge from this transcript. Output ONLY a JSON array: [{"statement":"...","topic":"...","keywords":["..."],"level":"beginner|intermediate|advanced|expert"}]';
    const response = await callAI(systemPrompt, [{ role: 'user', content: text }]);
    if (!response) return;
    setResults(parseEntries(response));
  }, [transcript, loading, callAI, parseEntries]);

  const handleTopicSubmit = useCallback(async () => {
    const text = transcript.trim();
    const topicText = topic.trim();
    if (!text || !topicText || loading) return;
    const systemPrompt =
      KNOWLEDGE_INTAKE_RECIPES?.topic ||
      'Extract knowledge ONLY relevant to the specified topic from this transcript. Output ONLY a JSON array: [{"statement":"...","topic":"...","keywords":["..."],"level":"beginner|intermediate|advanced|expert"}]';
    const response = await callAI(systemPrompt, [
      { role: 'user', content: `Topic: ${topicText}\n\nTranscript:\n${text}` },
    ]);
    if (!response) return;
    setResults(parseEntries(response));
  }, [transcript, topic, loading, callAI, parseEntries]);

  const handleAddEntry = useCallback(
    async (index: number) => {
      const entry = results[index];
      if (!entry) return;
      try {
        const updated = await addKnowledgeEntry({
          statement: entry.statement, topic: entry.topic, keywords: entry.keywords, level: entry.level,
        });
        onProfileUpdate(updated);
        setAddedIndices((prev) => new Set(prev).add(index));
      } catch (e: any) {
        setError('Failed to add entry: ' + e.message);
      }
    },
    [results, onProfileUpdate]
  );

  const handleAddAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let current = profile;
      for (let i = 0; i < results.length; i++) {
        if (addedIndices.has(i)) continue;
        const entry = results[i];
        current = await addKnowledgeEntry({
          statement: entry.statement, topic: entry.topic, keywords: entry.keywords, level: entry.level,
        });
        setAddedIndices((prev) => new Set(prev).add(i));
      }
      onProfileUpdate(current);
    } catch (e: any) {
      setError('Failed to add entries: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [results, addedIndices, profile, onProfileUpdate]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setTranscript('');
    setResults([]);
    setAddedIndices(new Set());
    setError(null);
    setExpandedIndex(null);
  }, []);

  const handleModeSwitch = useCallback((newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setResults([]);
    setAddedIndices(new Set());
    setExpandedIndex(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-zinc-800/50">
        <Brain size={18} className="text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-zinc-100">Knowledge Intake</span>
        <div className="flex-1" />
        <button
          onClick={handleCopyPrompt}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            copiedPrompt
              ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
          }`}
          title={`Copy the ${activeConfig.label.toLowerCase()} prompt for ChatGPT or Claude`}
        >
          {copiedPrompt ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span>Copied! Paste into ChatGPT/Claude</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>{activeConfig.copyLabel}</span>
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 rounded-md transition-colors duration-200"
          title="Reset \u2014 clear all inputs and results"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800/30">
        <div className="flex gap-1 p-0.5 bg-zinc-800/40 rounded-lg">
          {MODE_CONFIG.map((tab) => {
            const isActive = mode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleModeSwitch(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 flex-1 justify-center ${
                  isActive
                    ? 'bg-zinc-700/80 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-xs text-zinc-500 leading-relaxed"
          >
            {activeConfig.shortDesc}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Topic input \u2014 always visible */}
      <div className="px-4 py-2.5 border-b border-zinc-800/30">
        <label className="block text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-1.5">
          What topic are you learning?
          <FieldAIButton
            fieldName="topic"
            label="Topic"
            value={topic}
            onUpdate={setTopic}
            allFields={{ topic, mode }}
            category="learn"
            context="Knowledge intake for a learning session"
          />
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={mode === 'topic' ? 'Required \u2014 enter the topic to focus on\u2026' : 'Optional \u2014 narrow down to a specific topic'}
          className="w-full bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors duration-200"
        />
        {mode === 'topic' && !topic.trim() && (
          <p className="mt-1.5 text-[11px] text-amber-400/70 flex items-center gap-1">
            <AlertCircle size={11} />
            A topic is required for Topic Focus mode
          </p>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-200 underline transition-colors">Dismiss</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading bar */}
      {loading && (
        <div className="h-0.5 bg-zinc-800 overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-amber-500/0 via-amber-500/60 to-amber-500/0" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ======== SURVEY MODE ======== */}
        {mode === 'survey' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  {activeConfig.emptyIcon}
                  <p className="text-sm font-medium text-zinc-300 mt-3 mb-1">{activeConfig.emptyTitle}</p>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">{activeConfig.emptyBody}</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-500/15 text-amber-100 border border-amber-500/20'
                      : 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/50'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3.5 py-2.5">
                    <Loader2 size={16} className="animate-spin text-zinc-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-800/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSurveySend(); } }}
                  placeholder={activeConfig.inputPlaceholder}
                  disabled={loading}
                  className="flex-1 bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors duration-200 disabled:opacity-50"
                />
                <button
                  onClick={handleSurveySend}
                  disabled={!inputValue.trim() || loading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  <span className="text-xs font-medium hidden sm:inline">{activeConfig.submitLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======== EXTRACT MODE ======== */}
        {mode === 'extract' && (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Paste a chat transcript to extract knowledge from
                <FieldAIButton
                  fieldName="transcript"
                  label="Chat Transcript"
                  value={transcript}
                  onUpdate={setTranscript}
                  allFields={{ topic, transcript, mode }}
                  category="learn"
                  context="Extract knowledge from this AI chat conversation"
                />
              </label>
              <p className="text-[11px] text-zinc-600 mb-2">
                Any AI chat, conversation, or discussion works \u2014 the more detailed, the better.
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={activeConfig.inputPlaceholder}
                disabled={loading}
                className="w-full h-48 bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-y transition-colors duration-200 disabled:opacity-50 font-mono"
              />
            </div>
            <button
              onClick={handleExtractSubmit}
              disabled={!transcript.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {loading ? activeConfig.loadingLabel : activeConfig.submitLabel}
            </button>
          </div>
        )}

        {/* ======== TOPIC FOCUS MODE ======== */}
        {mode === 'topic' && (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Paste a long transcript \u2014 the AI will extract knowledge only for your chosen topic
                <FieldAIButton
                  fieldName="transcript"
                  label="Topic-Focused Transcript"
                  value={transcript}
                  onUpdate={setTranscript}
                  allFields={{ topic, transcript, mode }}
                  category="learn"
                  context={`Extract knowledge about "${topic}" from this conversation`}
                />
              </label>
              <p className="text-[11px] text-zinc-600 mb-2">
                Works best with multi-turn conversations. The AI will filter everything through your topic.
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={activeConfig.inputPlaceholder}
                disabled={loading}
                className="w-full h-48 bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-y transition-colors duration-200 disabled:opacity-50 font-mono"
              />
            </div>
            <button
              onClick={handleTopicSubmit}
              disabled={!transcript.trim() || !topic.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
              {loading ? activeConfig.loadingLabel : activeConfig.submitLabel}
            </button>
          </div>
        )}
      </div>

      {/* Results preview */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-800/50"
          >
            <div className="max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/30 border-b border-zinc-800/30 sticky top-0 z-10">
                <span className="text-xs font-medium text-zinc-300">
                  {results.length} extracted {results.length === 1 ? 'entry' : 'entries'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">
                    {addedIndices.size}/{results.length} added
                  </span>
                  <button
                    onClick={handleAddAll}
                    disabled={loading || addedIndices.size === results.length}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium rounded-md transition-all duration-200 disabled:opacity-40"
                  >
                    <Plus size={12} />
                    Add All to Knowledge Base
                  </button>
                </div>
              </div>

              <div className="divide-y divide-zinc-800/30">
                {results.map((entry, i) => {
                  const added = addedIndices.has(i);
                  const expanded = expandedIndex === i;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`px-4 py-2.5 transition-colors duration-200 ${added ? 'bg-emerald-500/5' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => setExpandedIndex(expanded ? null : i)}
                          className="mt-0.5 text-zinc-500 hover:text-zinc-300 transition-colors duration-200 shrink-0"
                          title={expanded ? 'Collapse' : 'Expand'}
                        >
                          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${levelColor(entry.level)}`}>
                              {entry.level}
                            </span>
                            {entry.topic && (
                              <span className="text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                                {entry.topic}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {expanded
                              ? entry.statement
                              : entry.statement.slice(0, 120) + (entry.statement.length > 120 ? '\u2026' : '')}
                          </p>
                          {expanded && entry.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.keywords.map((kw, j) => (
                                <span key={j} className="text-[10px] text-zinc-400 bg-zinc-800/40 px-1.5 py-0.5 rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleAddEntry(i)}
                          disabled={added || loading}
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-all duration-200 ${
                            added
                              ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                              : 'bg-zinc-800/50 text-zinc-400 hover:bg-amber-500/20 hover:text-amber-300 border border-zinc-700/30 hover:border-amber-500/30'
                          } disabled:opacity-40`}
                        >
                          {added ? <Check size={12} /> : <Plus size={12} />}
                          {added ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
