import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper';
import type { Question } from '../../../types/resume';

interface AnswerInputProps {
  inputType: Question['inputType'];
  value: any;
  onChange: (value: any) => void;
  validation?: Question['validation'];
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const LINE_HEIGHT_PX = 22;

export function AnswerInput({
  inputType,
  value,
  onChange,
  validation,
  placeholder,
  disabled,
  onKeyDown,
}: AnswerInputProps) {
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (inputType !== 'text' && inputType !== 'textarea') return;
    const maxRows = inputType === 'textarea' ? 12 : 8;
    const maxHeight = LINE_HEIGHT_PX * maxRows;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [inputType]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  if (inputType === 'tags') {
    const tags: string[] = Array.isArray(value) ? value : [];
    const addTag = () => {
      const t = tagInput.trim();
      if (t && !tags.includes(t)) onChange([...tags, t]);
      setTagInput('');
    };
    return (
      <div className="space-y-2.5">
        <div className="w-full min-h-[56px] p-3 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 ring-1 ring-zinc-700/50 focus-within:ring-2 focus-within:ring-[var(--page-accent)]/50 transition-all duration-150 flex flex-wrap gap-2 items-center">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-[var(--page-accent-15)] ring-1 ring-[var(--page-accent)]/25 text-[11px] text-[var(--page-accent)]"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="w-4 h-4 inline-flex items-center justify-center rounded hover:bg-[var(--page-accent-25)]"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <VoiceInputWrapper>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                  onChange(tags.slice(0, -1));
                }
              }}
              placeholder={placeholder || 'Type and press Enter…'}
              disabled={disabled}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            />
          </VoiceInputWrapper>
        </div>
      </div>
    );
  }

  if (inputType === 'metric') {
    return (
      <div className="relative">
        <VoiceInputWrapper>
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder || 'e.g., 42%, 3 months, $50k'}
            disabled={disabled}
            className="h-10 text-sm rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 ring-1 ring-zinc-700/50 focus:ring-2 focus:ring-[var(--page-accent)]/50"
          />
        </VoiceInputWrapper>
        {validation?.metricTypes && (
          <div className="flex gap-1.5 items-center mt-2.5">
            {validation.metricTypes.map((t) => (
              <span key={t} className="px-2 py-1 rounded-lg bg-zinc-800/60 text-[10px] text-zinc-400 font-mono ring-1 ring-zinc-700/30">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isTextarea = inputType === 'textarea';
  const minRows = isTextarea ? 4 : 2;
  const minHeightClass = isTextarea ? 'min-h-[120px]' : 'min-h-[56px]';
  const charCount = value ? String(value).length : 0;

  return (
    <div className="relative">
      <VoiceInputWrapper>
        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Type your answer here…'}
          disabled={disabled}
          rows={minRows}
          className={`w-full p-5 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 ring-1 ring-zinc-700/50 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[var(--page-accent)]/50 transition-all duration-150 resize-none ${minHeightClass} disabled:opacity-50 disabled:cursor-wait leading-relaxed scrollbar-thin`}
        />
      </VoiceInputWrapper>
      {charCount > 0 && (
        <div className="absolute -bottom-5 right-1 text-[10px] text-zinc-600 tabular-nums">
          {charCount} chars
          {isTextarea && ' · Ctrl+Enter to submit'}
          {!isTextarea && ' · Enter to submit'}
        </div>
      )}
    </div>
  );
}
