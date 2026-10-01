import { useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Copy, Check, X, Loader2, AlertTriangle, BookOpen, RotateCcw } from 'lucide-react';
import type { CommandNote } from './CommandNotesPanel';

type Mode = 'generate' | 'import';

interface Props {
  initialCommand: string;
  initialSection: string;
  initialSectionTitle: string;
  onClose: () => void;
  onSave: (note: CommandNote) => void;
  saving: boolean;
  savingLabel: string;
  emptyCommandOkay?: boolean;
}

const BASE_SYSTEM_PROMPT = `You are Penguin Console's command-note tutor. Generate a concise command note as JSON ONLY (no markdown, no prose outside the JSON). Output this exact shape:

{
  "title": "short title (e.g. grep recursive)",
  "summary": "one-line summary",
  "what": "what the command does — 2-4 sentences, plain language",
  "when": "when you'd reach for it — 2-3 sentences",
  "gotcha": "one common mistake or trap with this command",
  "params": [{"name":"param","meaning":"what it does"}],
  "safety": "one safety note if relevant, else 'None'",
  "related": ["related command 1","related command 2"]
}

Rules: keep each field tight. 'params' only if the command takes flags/args worth naming. If no safety concern, write 'None'. Keep 'related' to real commands. NEVER return anything outside the JSON object.`;

function buildSystemPrompt(section: string, command: string): string {
  if (!section || section === 'All') return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\nFocus area: ${section}. The command "${command}" belongs to this section. Explain it in the context of ${section.toLowerCase()}, emphasizing how it fits into that workflow.`;
}

export function AddPromptModal({
  initialCommand,
  initialSection,
  initialSectionTitle,
  onClose,
  onSave,
  saving,
  savingLabel,
}: Props) {
  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState(() => buildSystemPrompt(initialSection, initialCommand));
  const [userMsg, setUserMsg] = useState(() => {
    const topic = initialSection && initialSection !== 'All' ? ` in the context of ${initialSection}` : '';
    return `Explain the command "${initialCommand}"${topic} in detail so a learner can understand when and how to use it.`;
  });
  const [resp, setResp] = useState('');
  const [parsed, setParsed] = useState<CommandNote | null>(null);
  const [parseErr, setParseErr] = useState('');
  const [step, setStep] = useState<'prompt' | 'loading' | 'response' | 'review'>('prompt');
  const [copyDone, setCopyDone] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);

  const run = async () => {
    setStep('loading');
    setResp('');
    setParsed(null);
    setParseErr('');
    try {
      const r = await window.deskflowAPI?.learnAiChat?.({
        systemPrompt: prompt,
        messages: [{ role: 'user', content: userMsg }],
      });
      const text = typeof r === 'string' ? r : (r && typeof r === 'object' && 'data' in r ? String((r as any).data ?? '') : String(r ?? ''));
      setResp(text);
      setStep('response');
    } catch (e) {
      setResp(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setStep('response');
    }
  };

  const parse = () => {
    if (!resp.trim()) { setParseErr('Nothing to parse.'); return; }
    try {
      const json = extractJson(resp);
      if (!json) { setParseErr('No JSON object found in response.'); return; }
      const note: CommandNote = {
        id: 'tmp-' + Date.now(),
        command: initialCommand,
        section: initialSection,
        sectionTitle: initialSectionTitle,
        title: json.title ?? 'Untitled',
        summary: json.summary ?? '',
        what: json.what ?? '',
        when: json.when ?? '',
        gotcha: json.gotcha ?? '',
        params: Array.isArray(json.params) ? json.params : [],
        safety: json.safety ?? 'None',
        related: Array.isArray(json.related) ? json.related : [],
        savedAt: Date.now(),
      };
      setParsed(note);
      setParseErr('');
      setStep('review');
    } catch {
      setParseErr('Invalid JSON shape.');
    }
  };

  const extractJson = (text: string): any => {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgba(3,5,10,.66)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border overflow-hidden shadow-2xl max-h-[86vh] flex flex-col"
        style={{ background: 'var(--t-panel)', borderColor: 'var(--t-border)' }}
      >
        {/* header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 shrink-0">
          <div className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #a78bfa, #22d3ee)' }}>
            <Sparkles size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px]" style={{ color: 'var(--t-fg)' }}>Generate command note</div>
            <div className="text-[11.5px]" style={{ color: 'var(--t-muted)' }}>{initialCommand} · {initialSectionTitle}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/10 shrink-0"
            style={{ color: 'var(--t-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {/* mode */}
          <div className="flex gap-1.5">
            <button
              onClick={() => { setMode('generate'); setStep('prompt'); }}
              className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold border flex items-center gap-1.5 transition ${mode === 'generate' ? 'border-[var(--t-accent)] text-[var(--t-accent)]' : 'border-[var(--t-border)] text-[var(--t-muted)]'}`}
            >
              <Sparkles size={12} /> Generate from prompt
            </button>
            <button
              onClick={() => { setMode('import'); setStep('prompt'); }}
              className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold border flex items-center gap-1.5 transition ${mode === 'import' ? 'border-[var(--t-accent)] text-[var(--t-accent)]' : 'border-[var(--t-border)] text-[var(--t-muted)]'}`}
            >
              <RotateCcw size={12} /> Import pasted response
            </button>
          </div>

          {mode === 'generate' && (
            <>
              {/* prompt preview */}
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-muted)' }}>System prompt</span>
                  <button
                    onClick={copyPrompt}
                    className={`h-7 px-2.5 rounded-lg text-[10.5px] font-semibold flex items-center gap-1.5 transition border ${copyDone ? 'border-transparent text-green-400 bg-green-400/10' : 'border-[var(--t-border)] text-[var(--t-muted)] hover:border-[var(--t-accent)]'}`}
                  >
                    {copyDone ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <textarea
                  value={prompt}
                  readOnly
                  rows={4}
                  className="w-full text-[11px] mono outline-none resize-none rounded-lg"
                  style={{ background: 'var(--t-bg)', color: 'var(--t-fg)', border: '1px solid var(--t-border)' }}
                />
              </div>

              {/* user message */}
              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-muted)' }}>User message</label>
                <textarea
                  value={userMsg}
                  onChange={(e) => setUserMsg(e.target.value)}
                  rows={3}
                  className="w-full mt-1 p-3 rounded-xl border text-[12px] mono outline-none resize-none"
                  style={{ background: 'var(--t-bg)', borderColor: 'var(--t-border)', color: 'var(--t-fg)' }}
                  placeholder="Ask the AI about this command…"
                />
              </div>

              <button
                onClick={run}
                disabled={saving || !userMsg.trim()}
                className="w-full h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--t-accent)' }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> {savingLabel}</> : <><Sparkles size={14} /> Generate note</>}
              </button>
            </>
          )}

          {mode === 'import' && (
            <>
              {/* paste area */}
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg)' }}>
                <label className="text-[10.5px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--t-muted)' }}>
                  Paste the AI's JSON response
                </label>
                <textarea
                  value={resp}
                  onChange={(e) => setResp(e.target.value)}
                  rows={8}
                  className="w-full text-[11.5px] mono outline-none resize-none rounded-lg"
                  style={{ background: 'var(--t-bg)', color: 'var(--t-fg)', border: '1px solid var(--t-border)' }}
                  placeholder='{"title":"...","summary":"...","what":"...","when":"...","gotcha":"...","params":[...],"safety":"...","related":[...]}'
                />
              </div>

              {resp && (
                <div className="flex gap-2">
                  <button
                    onClick={parse}
                    className="flex-1 h-10 rounded-xl text-white text-[12.5px] font-bold flex items-center justify-center gap-2"
                    style={{ background: 'var(--t-accent)' }}
                  >
                    <Sparkles size={14} /> Parse & preview
                  </button>
                </div>
              )}

              {parseErr && (
                <div className="rounded-lg p-3 border-l-2 text-[12px] leading-relaxed" style={{ borderColor: '#f87171', color: 'var(--t-fg)', background: 'color-mix(in srgb, #f87171 8%, transparent)' }}>
                  <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                  {parseErr}
                </div>
              )}
            </>
          )}

          {/* loading */}
          {step === 'loading' && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--t-accent)' }} />
              <span className="ml-3 text-[12.5px]" style={{ color: 'var(--t-muted)' }}>Generating note…</span>
            </div>
          )}

          {/* response */}
          {step === 'response' && resp && (
            <div className="space-y-2">
              <button
                onClick={parse}
                disabled={saving}
                className="w-full h-10 rounded-xl text-white text-[12.5px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--t-accent)' }}
              >
                <Sparkles size={14} /> Parse & preview
              </button>
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-muted)' }}>Raw response</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(resp)}
                    className="h-7 px-2.5 rounded-lg text-[10.5px] font-semibold border flex items-center gap-1.5 transition"
                    style={{ borderColor: 'var(--t-border)', color: 'var(--t-muted)' }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <pre className="text-[11px] mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto" style={{ color: 'var(--t-fg)' }}>{resp}</pre>
              </div>
            </div>
          )}

          {/* review */}
          {step === 'review' && parsed && (
            <div className="space-y-3">
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg)' }}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--t-muted)' }}>Preview</div>
                <div className="space-y-2 text-[12.5px] leading-relaxed">
                  <div><span className="font-semibold text-[13px]" style={{ color: 'var(--t-fg)' }}>{parsed.title}</span><span className="text-[11px] ml-2" style={{ color: 'var(--t-muted)' }}>{parsed.summary}</span></div>
                  <div className="text-[12px]" style={{ color: 'var(--t-fg)' }}><span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--t-muted)' }}>What</span>{parsed.what}</div>
                  <div className="text-[12px]" style={{ color: 'var(--t-fg)' }}><span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--t-muted)' }}>When</span>{parsed.when}</div>
                  <div className="rounded-lg p-2.5 border-l-2 text-[12px] leading-relaxed" style={{ borderColor: '#f87171', color: 'var(--t-fg)', background: 'color-mix(in srgb, #f87171 8%, transparent)' }}><span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--t-muted)' }}>Gotcha</span>{parsed.gotcha}</div>
                  {parsed.params.length > 0 && (
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--t-muted)' }}>Params</span>
                      <div className="space-y-1">
                        {parsed.params.map((p) => (
                          <div key={p.name} className="flex gap-2 text-[12px]">
                            <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--t-accent) 15%, transparent)', color: 'var(--t-accent)' }}>{p.name}</span>
                            <span style={{ color: 'var(--t-fg)' }}>{p.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--t-muted)' }}>Safety</span>
                    <div className="flex gap-2 text-[12px] leading-relaxed items-start"><AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} /><span style={{ color: 'var(--t-fg)' }}>{parsed.safety}</span></div>
                  </div>
                  {parsed.related.length > 0 && (
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--t-muted)' }}>Related</span>
                      <div className="flex flex-wrap gap-1.5">
                        {parsed.related.map((r, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded mono" style={{ background: 'var(--t-panel)', color: 'var(--t-muted)' }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onSave(parsed)}
                disabled={saving}
                className="w-full h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--t-accent)' }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> {savingLabel}</> : <><BookOpen size={14} /> Save note</>}
              </button>
              <button
                onClick={() => { setStep('prompt'); setParsed(null); setResp(''); }}
                className="w-full h-9 rounded-xl border text-[12px] font-semibold text-center"
                style={{ borderColor: 'var(--t-border)', color: 'var(--t-muted)' }}
              >
                Edit prompt
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
