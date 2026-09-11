import { type FC, useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ChatEmptyState } from './ChatEmptyState';
import { BlockRenderer } from './BlockRenderer';
import { TypewriterText } from './TypewriterText';
import { ThinkingIndicator } from './ThinkingIndicator';
import { AgentProgressBar } from './AgentProgressBar';
import { parseStructuredResponse } from '../../services/parseBlocks';
import type { ParsedResponse } from '../../services/wireFormat';
import { aiAgentService } from '../../services/ai';
import { useNavigate } from 'react-router-dom';
import { navigateTo } from '../../lib/deepNav';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import type { ACCENT } from '../ai/tokens';
import type { ConnectorConfig } from '../../types/connectors';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsed: ParsedResponse;
  timestamp: number;
};

type Props = {
  today?: string;
  onConfigure?: () => void;
  providerBadge?: { label: string; color: string } | null;
};

let idCounter = 0;
function nextId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

const GREETING = `Hello! I'm your AI assistant. I can access your goals, projects, activities, sleep data, and more.

**Try asking me:**
- *What did I work on today?*
- *Show me my active projects*
- *How many goals did I complete this week?*
- *What's my sleep trend?*`;

function greetingMsg(): ChatMessage {
  return { id: nextId(), role: 'assistant', content: GREETING, parsed: parseStructuredResponse(GREETING), timestamp: Date.now() };
}

function badgeToProvider(badge: { label: string; color: string } | null): { label: string; model: string; accent: 'violet' | 'pink' | 'emerald' | 'amber' | 'red' } | null {
  if (!badge) return null;
  const parts = badge.label.split(' · ');
  return { label: parts[0], model: parts[1] ?? '', accent: 'violet' };
}

export const AiChat: FC<Props> = ({ today: todayProp, onConfigure, providerBadge }) => {
  const today = todayProp ?? new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [isThinking, setIsThinking] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ round: number; totalRounds: number; toolName?: string; toolArgs?: Record<string, any>; status: 'thinking' | 'executing' | 'completed' | 'error'; message?: string; streamedContent?: string } | null>(null);
  const [streamedContent, setStreamedContent] = useState('');
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const toolsUsedRef = useRef<string[]>([]);

  const voice = useVoiceInput({
    onTranscript: (t) => {
      // Voice transcript handled by ChatInput via voice prop
    },
  });

  const handleTypingDone = useCallback(() => setTypingId(null), []);

  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (api?.connectors?.list) {
      api.connectors.list().then((list: ConnectorConfig[]) => setConnectors(list)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const api = (window as any).electronAPI;
    if (!api?.aiChatLoad) {
      setIsLoaded(true);
      setMessages([greetingMsg()]);
      return;
    }
    api.aiChatLoad(today).then((result: any) => {
      if (result.success && result.messages?.length > 0) {
        const msgs: ChatMessage[] = result.messages.map((r: any) => ({
          id: `msg_${r.id}`,
          role: r.role,
          content: r.content,
          parsed: r.parsed_json ? JSON.parse(r.parsed_json) : parseStructuredResponse(r.content),
          timestamp: new Date(r.created_at).getTime(),
        }));
        setMessages(msgs);
      } else {
        setMessages([greetingMsg()]);
      }
      setIsLoaded(true);
    }).catch(() => {
      setMessages([greetingMsg()]);
      setIsLoaded(true);
    });
  }, [today]);

  useEffect(() => {
    if (!isLoaded) return;
    const api = (window as any).electronAPI;
    if (!api?.aiChatSave) return;
    const payload = messages.map(m => ({
      role: m.role,
      content: m.content,
      parsed_json: JSON.stringify(m.parsed),
      timestamp: m.timestamp,
    }));
    api.aiChatSave({ threadDate: today, messages: payload }).catch(() => {});
  }, [today, messages, isLoaded]);

  useEffect(() => {
    aiAgentService.setProgressCallback((progressData) => {
      setProgress(progressData);
      if (progressData.streamedContent) {
        setStreamedContent(progressData.streamedContent);
      }
    });

    return () => {
      aiAgentService.clearProgressCallback();
    };
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const parsed = parseStructuredResponse(content);
    const msg: ChatMessage = { id: nextId(), role, content, parsed, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const pendingConfirm = aiAgentService.getPendingConfirm();

    if (pendingConfirm) {
      const confirmed = /^(yes|yeah|confirm|go ahead|do it|sure|ok|okay)$/i.test(trimmed);
      const cancelled = /^(no|nope|cancel|never mind|stop|don't|dont)$/i.test(trimmed);

      if (cancelled) {
        aiAgentService.resolveConfirm(false);
        addMessage('assistant', 'Cancelled.');
        setIsThinking(false);
        setProgress(null);
        setStreamedContent('');
        return;
      }

      if (confirmed) {
        addMessage('user', trimmed);
        aiAgentService.resolveConfirm(true);
        return;
      }
    }

    if (isThinking) return;

    addMessage('user', trimmed);
    setIsThinking(true);
    setProgress({ round: 0, totalRounds: aiAgentService.getConfig().maxRounds, status: 'thinking', message: 'Starting AI response...' });

    try {
      const response = await aiAgentService.processMessage(trimmed);
      setStreamedContent('');
      const msg = addMessage('assistant', response);
      setTypingId(msg.id);
    } catch (err: unknown) {
      setStreamedContent('');
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      addMessage('assistant', `[type: error]\n[message: ${msg}]`);
    }

    setIsThinking(false);
    setProgress(null);
  }, [isThinking, addMessage]);

  const handleReset = useCallback(() => {
    aiAgentService.resetConversation();
    setMessages([greetingMsg()]);
    const api = (window as any).electronAPI;
    if (api?.aiChatReset) {
      api.aiChatReset(today).catch(() => {});
    }
    toolsUsedRef.current = [];
    setStreamedContent('');
  }, [today]);

  const handleSuggestion = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  const status = isThinking ? 'thinking' : 'ready';
  const provider = badgeToProvider(providerBadge);
  const pendingConfirm = aiAgentService.getPendingConfirm();
  const isEmpty = !isThinking && messages.length === 0 && isLoaded;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        status={status}
        provider={provider}
        onReset={handleReset}
        onConfigure={onConfigure ?? (() => {})}
        messageCount={messages.length}
      />

      {isEmpty ? (
        <ChatEmptyState onPick={handleSuggestion} connectors={connectors} />
      ) : (
        <MessageList>
          {messages.map(msg => {
            const isTyping = msg.id === typingId;

            return (
              <MessageBubble key={msg.id} role={msg.role} timestamp={msg.timestamp} content={msg.content}>
                {msg.role === 'assistant' && isTyping ? (
                  <TypewriterText
                    nodes={msg.parsed.nodes}
                    refs={msg.parsed.refs}
                    onDone={handleTypingDone}
                  />
                ) : (
                  <BlockRenderer
                    nodes={msg.parsed.nodes}
                    refs={msg.parsed.refs}
                    onNavigate={(page, section, tab) => navigateTo({ route: page, section, tab }, navigate)}
                  />
                )}
              </MessageBubble>
            );
          })}

          <AnimatePresence>
            {isThinking && (
              <MessageBubble role="assistant" key="thinking">
                {streamedContent ? (
                  <div className="text-sm text-zinc-100 whitespace-pre-wrap">
                    <BlockRenderer
                      nodes={parseStructuredResponse(streamedContent).nodes}
                      refs={{}}
                      onNavigate={(page, section, tab) => navigateTo({ route: page, section, tab }, navigate)}
                    />
                    <span className="inline-block w-[2px] h-[1em] -mb-[2px] bg-pink-400 ml-0.5 align-baseline animate-pulse" />
                  </div>
                ) : (
                  <ThinkingIndicator />
                )}
              </MessageBubble>
            )}
          </AnimatePresence>

          {pendingConfirm && !isThinking && (
            <MessageBubble role="assistant" key="confirm" content={pendingConfirm.toolName}>
              <span className="text-sm text-zinc-200">Do you want to {pendingConfirm.toolName}? Reply "yes" to confirm or "no" to cancel.</span>
            </MessageBubble>
          )}
        </MessageList>
      )}

      <AnimatePresence>
        {progress && (
          <AgentProgressBar
            round={progress.round}
            totalRounds={progress.totalRounds}
            toolName={progress.toolName}
            status={progress.status as 'thinking' | 'executing' | 'completed' | 'error'}
            message={progress.message}
          />
        )}
      </AnimatePresence>

      <ChatInput
        onSend={handleSend}
        disabled={isThinking || typingId !== null}
        placeholder={
          pendingConfirm
            ? 'Reply yes or no\u2026'
            : 'Ask about goals, projects, activities\u2026'
        }
        voice={voice}
      />
    </div>
  );
};

