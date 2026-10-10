import { useState, useEffect, useRef } from 'react';
import { ModalShell, FormField, FORM_INPUT, FORM_SELECT, FORM_TEXTAREA, ModalSection } from './workspace/_ds/modal';

const CATEGORIES = [
  { value: 'bug-fix', label: 'Bug Fix' },
  { value: 'feature', label: 'Feature' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'research', label: 'Research' },
  { value: 'review', label: 'Review' },
  { value: 'other', label: 'Other' },
];

const STATUSES = ['active', 'paused', 'completed', 'archived'];

interface SessionEditData {
  id: string;
  topic: string;
  agent: string;
  resume_id?: string;
  created_at: string;
  total_cost?: number;
  total_tokens?: number;
  category?: string;
  status?: string;
  product_area?: string;
  description?: string;
  auto_tags?: string;
  auto_named?: number;
}

interface SessionEditDialogProps {
  session: SessionEditData | null;
  onClose: () => void;
  onSave: (data: { sessionId: string; topic?: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[] }) => Promise<boolean>;
}

export function SessionEditDialog({ session, onClose, onSave }: SessionEditDialogProps) {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [productArea, setProductArea] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      setTopic(session.topic || '');
      setCategory(session.category || '');
      setStatus(session.status || '');
      setProductArea(session.product_area || '');
      setDescription(session.description || '');
      try { setTags(JSON.parse(session.auto_tags || '[]')); } catch { setTags([]); }
    }
  }, [session]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    const updates: { sessionId: string; topic?: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[] } = {
      sessionId: session.id,
    };
    if (topic !== (session.topic || '')) updates.topic = topic;
    if (category !== (session.category || '')) updates.category = category;
    if (status !== (session.status || '')) updates.status = status;
    if (productArea !== (session.product_area || '')) updates.productArea = productArea;
    if (description !== (session.description || '')) updates.description = description;
    const origTags = (() => { try { return JSON.parse(session.auto_tags || '[]'); } catch { return []; } })();
    if (JSON.stringify(tags) !== JSON.stringify(origTags)) updates.tags = tags;
    await onSave(updates);
    setSaving(false);
    onClose();
  };

  const hasChanges =
    topic !== (session?.topic || '') ||
    category !== (session?.category || '') ||
    status !== (session?.status || '') ||
    productArea !== (session?.product_area || '') ||
    description !== (session?.description || '');

  return (
    <ModalShell
      open={!!session}
      onClose={onClose}
      title="Session Details"
      subtitle={session?.auto_named ? 'auto-named session' : undefined}
      accent="cyan"
      maxWidth="max-w-xl"
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-[0.97]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${
              hasChanges
                ? 'text-zinc-950 bg-[color:var(--page-accent,#2dd4bf)] hover:brightness-110'
                : 'text-zinc-500 bg-zinc-800/50 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Topic + Agent */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <FormField label="Topic">
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)} className={FORM_INPUT} placeholder="Session topic" />
          </FormField>
          <FormField label="Agent">
            <span className="inline-block px-3 py-2 text-[13px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              {session?.agent}
            </span>
          </FormField>
        </div>

        {/* Resume ID */}
        {session?.resume_id && (
          <FormField label="Resume ID">
            <div className="px-3 py-2 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/50 rounded-lg text-[11px] font-mono text-zinc-500 truncate">
              {session.resume_id}
            </div>
          </FormField>
        )}

        <ModalSection title="Metadata">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} className={FORM_SELECT}>
                <option value="">Uncategorized</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className={FORM_SELECT}>
                <option value="">Unknown</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Product Area" className="mt-3">
            <input type="text" value={productArea} onChange={e => setProductArea(e.target.value)} className={FORM_INPUT} placeholder="e.g., Dashboard, Terminal, Settings" />
          </FormField>
        </ModalSection>

        <FormField label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value)} className={FORM_TEXTAREA} rows={3} placeholder="Session description..." />
        </FormField>

        <FormField label="Tags">
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 rounded-md text-[10px] font-medium">
                {t}
                <button onClick={() => removeTag(t)} className="text-zinc-500 hover:text-rose-400 transition-colors text-xs">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className={`flex-1 ${FORM_INPUT} !py-1.5 !text-[11px]`}
              placeholder="Type tag and press Enter..."
            />
            <button onClick={addTag} className="px-2.5 py-1.5 bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700/50 text-[11px] font-medium transition-all duration-150 active:scale-95">
              Add
            </button>
          </div>
        </FormField>

        <ModalSection title="Stats">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Created</div>
              <div className="text-[11px] text-zinc-300 font-medium">{session?.created_at ? new Date(session.created_at).toLocaleDateString() : '-'}</div>
            </div>
            <div className="p-2.5 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Cost</div>
              <div className="text-[11px] text-emerald-400 font-medium font-mono">${session?.total_cost?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="p-2.5 bg-zinc-950 light:bg-[var(--ws-surface)]/50 border border-zinc-800/40 rounded-lg">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Tokens</div>
              <div className="text-[11px] text-zinc-300 font-mono font-medium">{session?.total_tokens?.toLocaleString() || 0}</div>
            </div>
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}
