/**
 * SttCapturePage.tsx — Speech-to-Text capture page with CONNECTED saves
 * Saves to: Transcript Library, Gold Page Goals, Notes, Lesson Drafts
 * Design: token colors, {6,10,16} radii, no springs/blur/shadows.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Square, Save, Copy, Check, Trash2, Star,
  Sparkles, Clock, Tags, AlertCircle, X, Languages,
  Target, StickyNote, BookOpen, ChevronDown
} from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { getStore, SttCategoryColors } from '../lib/sttStore';

type SttCategory = 'idea' | 'brainstorm' | 'note' | 'prompt' | 'todo' | 'other';

const CATEGORY_ICONS: Record<SttCategory, React.ReactNode> = {
  idea: <Sparkles style={{ width: 12, height: 12 }} />,
  brainstorm: <Languages style={{ width: 12, height: 12 }} />,
  note: <Copy style={{ width: 12, height: 12 }} />,
  prompt: <Tags style={{ width: 12, height: 12 }} />,
  todo: <Clock style={{ width: 12, height: 12 }} />,
  other: <Mic style={{ width: 12, height: 12 }} />,
};

const CATEGORIES: { id: SttCategory; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'note', label: 'Note' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'todo', label: 'Todo' },
  { id: 'other', label: 'Other' },
];

type SaveTarget = 'library' | 'goal' | 'note' | 'lesson';

export function SttCapturePage() {
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [category, setCategory] = useState<SttCategory>('note');
  const [title, setTitle] = useState('');
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const transcriptRef = useRef('');

  const handleTranscript = useCallback((text: string) => {
    const current = transcriptRef.current;
    const next = current ? current + ' ' + text : text;
    transcriptRef.current = next;
    setTranscript(next);
  }, []);

  const voice = useVoiceInput({
    onTranscript: handleTranscript,
    mode: 'replace',
    silenceMs: 8000,
  });

  useEffect(() => { transcriptRef.current = transcript; }, []);

  const getFirstLine = () => transcript.trim().split('\n')[0]?.slice(0, 80) || 'Untitled';

  const handleSaveAs = async (target: SaveTarget) => {
    if (!transcript.trim()) return;
    const api = (window as any).deskflowAPI;

    try {
      switch (target) {
        case 'library': {
          const store = await getStore();
          await store.save({
            text: transcript.trim(),
            createdAt: new Date().toISOString(),
            durationMs: 0,
            category,
            tags: [],
            isFavorite: false,
            source: 'STT Capture',
          });
          setSaved('library');
          break;
        }
        case 'goal': {
          const goalData = {
            title: title || getFirstLine(),
            description: transcript.trim(),
            date: new Date().toISOString().split('T')[0],
            status: 'active',
            priority: 1,
            category: 'work',
          };
          if (api?.createGoal) {
            await api.createGoal(goalData);
          } else if (api?.invoke) {
            await api.invoke('goal:create', goalData);
          }
          setSaved('goal');
          break;
        }
        case 'note': {
          const noteData = {
            content: transcript.trim(),
            title: title || getFirstLine(),
            category,
            tags: [],
          };
          if (api?.notesCreate) {
            await api.notesCreate(noteData);
          } else if (api?.invoke) {
            await api.invoke('notes:create', noteData);
          }
          setSaved('note');
          break;
        }
        case 'lesson': {
          const lessonData = {
            title: title || getFirstLine(),
            content: transcript.trim(),
            status: 'draft',
          };
          if (api?.invoke) {
            await api.invoke('learn:lesson-create', lessonData);
          }
          setSaved('lesson');
          break;
        }
      }
    } catch (e) {
      console.error('Save failed:', e);
    }

    setShowSaveMenu(false);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = () => {
    setTranscript('');
    transcriptRef.current = '';
    setSaved(null);
  };

  const isListening = voice.state === 'listening';
  const isProcessing = voice.state === 'processing';
  const hasError = voice.state === 'error';

  const saveTargetLabels: Record<SaveTarget, { label: string; icon: React.ReactNode }> = {
    library: { label: 'Transcript Library', icon: <Star style={{ width: 14, height: 14 }} /> },
    goal: { label: 'Goal (Gold Page)', icon: <Target style={{ width: 14, height: 14 }} /> },
    note: { label: 'Note', icon: <StickyNote style={{ width: 14, height: 14 }} /> },
    lesson: { label: 'Lesson Draft', icon: <BookOpen style={{ width: 14, height: 14 }} /> },
  };

  return (
    <div data-page="stt" className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ws-border)', background: 'var(--color-card)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--page-accent, #8b5cf6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Mic style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-sans)' }}>
              Speech to Text
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
              Capture with voice — save to Goals, Notes, Lessons, or Library
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Mic control card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '10px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
            <Languages style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
            <select value={voice.lang} onChange={(e) => voice.setLang(e.target.value)}
              style={{ background: 'rgb(0 0 0 / 0.2)', border: '1px solid var(--ws-border)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: 11, padding: '4px 8px', outline: 'none', fontFamily: 'inherit' }}>
              <option value="en-US">English (US)</option>
              <option value="id-ID">Bahasa Indonesia</option>
              <option value="zh-CN">中文 (简体)</option>
              <option value="ja-JP">日本語</option>
            </select>
          </div>

          <button onClick={() => (isListening ? voice.stop() : voice.start())}
            style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
              background: isListening ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, var(--page-accent, #8b5cf6), #7c3aed)',
              boxShadow: isListening ? '0 0 24px rgba(239,68,68,0.4)' : '0 0 24px rgba(139,92,246,0.3)',
              transition: 'all 200ms ease', transform: isListening ? 'scale(1.05)' : 'scale(1)' }}>
            {isListening ? <Square style={{ width: 24, height: 24, color: 'white' }} /> : <Mic style={{ width: 24, height: 24, color: 'white' }} />}
          </button>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
            {isListening ? <span style={{ color: '#ef4444' }}>● Listening… speak naturally</span>
              : isProcessing ? <span style={{ color: 'var(--resume-warning)' }}>Processing…</span>
              : hasError ? <span style={{ color: 'var(--resume-danger)' }}>
                {voice.error === 'no-permission' ? 'Microphone access denied' : voice.error === 'no-speech' ? 'No speech detected' : 'Voice recognition error'}
              </span>
              : 'Tap the mic, or press Ctrl+Shift+V'}
          </div>

          <AnimatePresence>
            {voice.interim && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', maxWidth: 400 }}>
                {voice.interim}
              </motion.div>
            )}
          </AnimatePresence>

          {isListening && voice.countdownMs < 8000 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 40, height: 2, background: 'var(--ws-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(voice.countdownMs / 8000) * 100}%`, background: voice.countdownMs < 2000 ? '#ef4444' : 'var(--page-accent, #8b5cf6)', transition: 'width 100ms linear' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.ceil(voice.countdownMs / 1000)}s</span>
            </div>
          )}
        </div>

        {/* Transcript editor card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '10px', padding: 16, flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Title input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={getFirstLine()}
              style={{ flex: 1, background: 'rgb(0 0 0 / 0.2)', border: '1px solid var(--ws-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px', outline: 'none', fontFamily: 'inherit' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--page-accent, #8b5cf6)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--ws-border)')} />
          </div>

          <textarea value={transcript} onChange={(e) => { setTranscript(e.target.value); transcriptRef.current = e.target.value; }}
            placeholder="Your transcribed text will appear here…"
            style={{ flex: 1, minHeight: 160, background: 'rgb(0 0 0 / 0.2)', border: '1px solid var(--ws-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--page-accent, #8b5cf6)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ws-border)')} />

          {/* Category selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Category</span>
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: category === cat.id ? SttCategoryColors[cat.id].hex + '20' : 'transparent',
                  border: `1px solid ${category === cat.id ? SttCategoryColors[cat.id].hex : 'var(--ws-border)'}`, borderRadius: '4px', cursor: 'pointer', fontSize: 11,
                  fontWeight: category === cat.id ? 600 : 400, color: category === cat.id ? SttCategoryColors[cat.id].hex : 'var(--text-secondary)', fontFamily: 'inherit', minHeight: 24 }}>
                {CATEGORY_ICONS[cat.id]}{cat.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Save As dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSaveMenu(!showSaveMenu)} disabled={!transcript.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: transcript.trim() ? 'var(--page-accent, #8b5cf6)' : 'rgb(0 0 0 / 0.1)',
                  border: 'none', borderRadius: '6px', cursor: transcript.trim() ? 'pointer' : 'not-allowed',
                  color: transcript.trim() ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  opacity: transcript.trim() ? 1 : 0.5, transition: 'opacity 150ms ease' }}>
                {saved ? <Check style={{ width: 14, height: 14 }} /> : <Save style={{ width: 14, height: 14 }} />}
                {saved ? 'Saved!' : 'Save As'} <ChevronDown style={{ width: 12, height: 12 }} />
              </button>

              {showSaveMenu && transcript.trim() && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, background: 'var(--color-card)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: 4, minWidth: 180, zIndex: 50 }}>
                  {(Object.keys(saveTargetLabels) as SaveTarget[]).map((target) => (
                    <button key={target} onClick={() => handleSaveAs(target)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'inherit', textAlign: 'left' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgb(0 0 0 / 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {saveTargetLabels[target].icon}
                      {saveTargetLabels[target].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleCopy} disabled={!transcript}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--ws-border)', borderRadius: '6px',
                cursor: transcript ? 'pointer' : 'not-allowed', color: transcript ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit', opacity: transcript ? 1 : 0.5 }}>
              {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <div style={{ flex: 1 }} />

            {transcript && (
              <button onClick={handleClear}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--ws-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--resume-danger)', fontSize: 12, fontFamily: 'inherit' }}>
                <Trash2 style={{ width: 14, height: 14 }} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
