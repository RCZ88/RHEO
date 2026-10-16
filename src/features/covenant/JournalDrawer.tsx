import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Pause, Lock, Trash2 } from 'lucide-react';
import { useCovenantJournalEntry } from './useJournalEntry';

interface JournalDrawerProps {
  commitmentId: string | null;
  date: string;
  initialText?: string;
  onSave?: () => void;
}

export function JournalDrawer({ commitmentId, date, initialText, onSave }: JournalDrawerProps) {
  const {
    text, setText, save,
    isRecording, startRecording, stopRecording,
    voiceUrl, voiceDurationSec, deleteVoice,
  } = useCovenantJournalEntry(commitmentId, date, initialText, onSave);

  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!playing) return;
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlaying(false);
    el.addEventListener('ended', onEnd);
    return () => el.removeEventListener('ended', onEnd);
  }, [playing]);

  return (
    <div className="rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 p-3">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={save}
        placeholder="What's on your mind today? Only you can see this."
        rows={3}
        className="w-full bg-transparent text-[13px] warmth-serif text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/40">
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <Lock className="w-3 h-3" />
          Stored only on this device
        </div>
        <div className="flex items-center gap-2">
          {voiceUrl ? (
            <>
              <audio ref={audioRef} src={voiceUrl} className="hidden" />
              <button
                onClick={() => {
                  if (playing) { audioRef.current?.pause(); setPlaying(false); }
                  else { audioRef.current?.play(); setPlaying(true); }
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-mem-400-15)] text-[var(--color-mem-400)] text-[10px]"
              >
                {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {voiceDurationSec ? `${Math.round(voiceDurationSec)}s` : 'voice note'}
              </button>
              <button onClick={deleteVoice} className="text-[var(--text-muted)] hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                isRecording ? 'bg-rose-500/15 text-rose-300' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isRecording ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {isRecording ? 'Stop' : 'Record a voice note'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
