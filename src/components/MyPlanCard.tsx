import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Edit3, Eye, Sparkles, BookOpen } from 'lucide-react';
import { GlassCard, SectionHead, StateShell, IconButton, MOTION } from '../components/ai';
import type { ViewState } from '../components/ai/StateShell';

interface MyPlanCardProps {
  onPlanningSaved?: () => void;
}

const DEFAULT_TEMPLATE = `# My Plan

## Today's Focus
- [ ] Plan your day

## Notes

`;

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved';

export function MyPlanCard({ onPlanningSaved }: MyPlanCardProps) {
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<ViewState<string>>({ status: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      setState({ status: 'loading' });
      try {
        const r = await window.deskflowAPI!.readPlanningMd();
        const c = r.content || DEFAULT_TEMPLATE;
        setContent(c);
        setDraft(c);
        setState({ status: 'ready', data: c });
      } catch (err: any) {
        setState({ status: 'error', message: err.message, retry: () => window.location.reload() });
      }
    })();
  }, []);

  const save = useCallback(async (text: string) => {
    setSaveState('saving');
    try {
      await window.deskflowAPI!.writePlanningMd(text);
      setContent(text);
      setSaveState('saved');
      flashRef.current = setTimeout(() => setSaveState('idle'), 600);
      onPlanningSaved?.();
    } catch {
      setSaveState('unsaved');
    }
  }, [onPlanningSaved]);

  function handleEdit(text: string) {
    setDraft(text);
    setSaveState('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(text), 1000);
  }

  function toggleEdit() {
    if (editing) {
      save(draft);
    }
    setEditing(!editing);
  }

  const saveLabel = saveState === 'saving' ? 'Saving\u2026' : saveState === 'saved' ? 'Saved' : saveState === 'unsaved' ? 'Unsaved' : '';

  return (
    <GlassCard accent="emerald">
      <SectionHead
        accent="emerald"
        title="My Plan"
        desc={editing ? 'Editing' : 'Preview'}
        right={
          <div className="flex items-center gap-2">
            {saveLabel && (
              <span className={`text-[10px] transition-all duration-300 ${
                saveState === 'saved' ? 'text-emerald-400' : saveState === 'saving' ? 'text-amber-400' : 'text-zinc-500'
              }`}>{saveLabel}</span>
            )}
            <IconButton
              icon={editing ? Eye : Edit3}
              label={editing ? 'Preview' : 'Edit'}
              onClick={toggleEdit}
            />
          </div>
        }
      />

      <StateShell state={state} skeleton={
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-zinc-800/40 animate-pulse" />
        </div>
      } empty={null}>
        {() => editing ? (
          <textarea
            value={draft}
            onChange={e => handleEdit(e.target.value)}
            className="w-full h-44 bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-lg p-3 text-xs text-zinc-100 font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 resize-y"
            placeholder="Write your plan in markdown..."
          />
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/60 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
            {content}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setAddingItem(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Add item
              </button>
            </div>
            {addingItem && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  className="flex-1 bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-lg px-2 py-1.5 text-xs text-zinc-100"
                  placeholder="New plan item"
                />
                <button
                  onClick={() => {
                    const updated = content.endsWith('\n') ? content : content + '\n';
                    const newContent = updated + `- [ ] ${newItemText}\n`;
                    handleEdit(newContent);
                    setNewItemText('');
                    setAddingItem(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setAddingItem(false); setNewItemText(''); }}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </StateShell>
    </GlassCard>
  );
}
