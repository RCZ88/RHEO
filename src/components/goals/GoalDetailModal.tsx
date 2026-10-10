import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Target, Flag, Link2, Save, MapPin, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { cn } from '../../lib/utils';
import type { Goal, GoalCategory, GoalPeriod, GoalStatus, GoalTarget } from '@/components/dashboard/types';

interface GoalDetailModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<Goal>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  longTermGoals: { id: string; title: string }[];
  loading?: boolean;
}

const CATEGORIES: GoalCategory[] = ['work', 'personal', 'health', 'learning', 'finance', 'relationships', 'reflection'];
const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly', 'longterm'];
const STATUSES: GoalStatus[] = ['active', 'done', 'archived', 'failed', 'missed'];
const TARGET_TYPES = ['time', 'completion', 'external', 'app', 'habit', 'cross_feature'];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c, c.charAt(0).toUpperCase() + c.slice(1)]));
const PERIOD_LABELS = Object.fromEntries(PERIODS.map(p => [p, p.charAt(0).toUpperCase() + p.slice(1)]));
const STATUS_LABELS = Object.fromEntries(STATUSES.map(s => [s, s.charAt(0).toUpperCase() + s.slice(1)]));
const TARGET_LABELS = Object.fromEntries(TARGET_TYPES.map(t => [t, t.replace('_', ' ')]));

export function GoalDetailModal({
  goal,
  onClose,
  onSave,
  onDelete,
  longTermGoals,
  loading = false,
}: GoalDetailModalProps) {
  const [form, setForm] = useState<Partial<Goal>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title,
        description: goal.description,
        category: goal.category,
        period: goal.period,
        status: goal.status,
        target: goal.target,
        links: goal.links,
        location: goal.location,
        priority: goal.priority,
        deadline: goal.deadline,
      });
      setError(null);
    }
  }, [goal]);

  const handleSave = async () => {
    if (!goal) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(goal.id, form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!goal || !onDelete) return;
    if (!confirm('Delete this goal?')) return;
    setDeleting(true);
    try {
      await onDelete(goal.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (!goal) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 light:bg-[var(--ws-surface-raised)] light:border-zinc-300 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 light:border-zinc-200">
            <h2 id="goal-modal-title" className="text-lg font-semibold text-zinc-100 light:text-zinc-900">
              Goal Details
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 light:hover:bg-zinc-200 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Title */}
            <div>
              <Label className="text-xs font-medium text-zinc-400">Title</Label>
              <Input
                value={form.title || ''}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="mt-1"
                placeholder="Goal title"
              />
            </div>

            {/* Category, Period, Status */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-zinc-400">Category</Label>
                <Select value={form.category || 'work'} onValueChange={v => setForm({ ...form, category: v as GoalCategory })} valueLabel={CATEGORY_LABELS} className="mt-1">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-400">Period</Label>
                <Select value={form.period || 'daily'} onValueChange={v => setForm({ ...form, period: v as GoalPeriod })} valueLabel={PERIOD_LABELS} className="mt-1">
                  {PERIODS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-400">Status</Label>
                <Select value={form.status || 'active'} onValueChange={v => setForm({ ...form, status: v as GoalStatus })} valueLabel={STATUS_LABELS} className="mt-1">
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </Select>
              </div>
            </div>

            {/* Target */}
            <div>
              <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <Target size={11} /> Target
              </Label>
              <div className="mt-1 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-zinc-400">Type</Label>
                    <Select value={form.target?.type || 'time'} onValueChange={v => setForm({ ...form, target: { ...form.target, type: v as any } })} valueLabel={TARGET_LABELS} className="mt-1">
                      {TARGET_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-zinc-400">Target Seconds</Label>
                    <Input
                      type="number"
                      value={form.target?.targetSeconds?.toString() || ''}
                      onChange={e => setForm({ ...form, target: { ...form.target, targetSeconds: Number(e.target.value) || undefined } })}
                      className="mt-1"
                      placeholder="e.g. 3600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <MapPin size={11} /> Location
              </Label>
              <LocationAutocomplete
                value={form.location || ''}
                onChange={v => setForm({ ...form, location: v })}
                placeholder="Search or add location..."
                className="mt-1"
              />
            </div>

            {/* Long-term goal link */}
            {longTermGoals.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                  <Flag size={11} /> Linked Long-term Goal
                </Label>
                <Select value={form.parent_id || ''} onValueChange={v => setForm({ ...form, parent_id: v || undefined })} className="mt-1">
                  <SelectItem value="">None</SelectItem>
                  {longTermGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </Select>
              </div>
            )}

            {/* Description */}
            <div>
              <Label className="text-xs font-medium text-zinc-400">Description</Label>
              <Textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="mt-1 min-h-[80px]"
                placeholder="Goal description..."
              />
            </div>

            {/* Links */}
            <div>
              <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <Link2 size={11} /> Links
              </Label>
              <Textarea
                value={JSON.stringify(form.links || [], null, 2)}
                onChange={e => {
                  try { setForm({ ...form, links: JSON.parse(e.target.value) }); } catch { setForm({ ...form, links: [] }); }
                }}
                className="mt-1 min-h-[60px] font-mono text-xs"
                placeholder='[{"label": "Website", "url": "https://..."}]'
              />
              <p className="text-[10px] text-zinc-500 mt-1">JSON array of {label, url} objects</p>
            </div>

            {error && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-1">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 light:border-zinc-200">
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
                <Trash2 size={13} /> Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title?.trim()} className="gap-1.5">
              <Save size={13} /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
