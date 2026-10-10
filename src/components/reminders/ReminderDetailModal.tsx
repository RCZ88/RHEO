import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, Clock, MapPin, Link2, Save, AlertCircle,
  Bell, Trash2, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { cn } from '../../lib/utils';
import type { Reminder } from '@/components/dashboard/types';

interface ReminderDetailModalProps {
  reminder: Reminder | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<Reminder>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  goals: { id: string; title: string }[];
  loading?: boolean;
}

const LEAD_TIME_OPTIONS = [
  { value: 0, label: 'At event time' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 360, label: '6 hours before' },
  { value: 720, label: '12 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

function formatLeadTime(min: number): string {
  if (min === 0) return 'At event time';
  if (min < 60) return `${min} min before`;
  const hours = min / 60;
  if (hours < 24) return `${hours}h before`;
  const days = min / 1440;
  return `${days}d before`;
}

function formatDateTime(date?: string | null, time?: string | null): string {
  if (!date) return 'No date';
  const d = new Date(date + 'T00:00:00');
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (time) return `${dateStr} at ${time}`;
  return dateStr;
}

export function ReminderDetailModal({
  reminder,
  onClose,
  onSave,
  onDelete,
  goals,
  loading = false,
}: ReminderDetailModalProps) {
  const [form, setForm] = useState<Partial<Reminder>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reminder) {
      setForm({
        text: reminder.text,
        due_date: reminder.due_date,
        due_time: reminder.due_time,
        reminder_lead_min: reminder.reminder_lead_min ?? 0,
        description: reminder.description,
        location: reminder.location,
        goal_id: reminder.goal_id,
        links: reminder.links,
      });
      setError(null);
    }
  }, [reminder]);

  const handleSave = async () => {
    if (!reminder) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(reminder.id, form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!reminder || !onDelete) return;
    if (!confirm('Delete this reminder?')) return;
    setDeleting(true);
    try {
      await onDelete(reminder.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (!reminder) return null;

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
        aria-labelledby="reminder-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 light:bg-[var(--ws-surface-raised)] light:border-zinc-300 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 light:border-zinc-200">
            <h2 id="reminder-modal-title" className="text-lg font-semibold text-zinc-100 light:text-zinc-900">
              Reminder Details
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
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Title */}
            <div>
              <Label className="text-xs font-medium text-zinc-400">Title</Label>
              <Input
                value={form.text || ''}
                onChange={e => setForm({ ...form, text: e.target.value })}
                className="mt-1"
                placeholder="Reminder title"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                  <Calendar size={11} /> Date
                </Label>
                <Input
                  type="date"
                  value={form.due_date || ''}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                  <Clock size={11} /> Time
                </Label>
                <Input
                  type="time"
                  value={form.due_time || ''}
                  onChange={e => setForm({ ...form, due_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Remind me */}
            <div>
              <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <Bell size={11} /> Remind me
              </Label>
              <Select
                value={String(form.reminder_lead_min ?? 0)}
                onValueChange={v => setForm({ ...form, reminder_lead_min: Number(v) })}
                valueLabel={Object.fromEntries(LEAD_TIME_OPTIONS.map(o => [String(o.value), o.label]))}
                className="mt-1"
              >
                {LEAD_TIME_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* Goal Link */}
            {goals.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-zinc-400">Linked Goal</Label>
                <Select
                  value={form.goal_id || ''}
                  onValueChange={v => setForm({ ...form, goal_id: v || null })}
                  className="mt-1"
                >
                  <SelectItem value="">No goal</SelectItem>
                  {goals.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </Select>
              </div>
            )}

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

            {/* Description */}
            <div>
              <Label className="text-xs font-medium text-zinc-400">Description / Notes</Label>
              <Textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="mt-1 min-h-[80px]"
                placeholder="Add description, notes, or details..."
              />
            </div>

            {/* Links */}
            <div>
              <Label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <Link2 size={11} /> Links
              </Label>
              <Textarea
                value={form.links || '[]'}
                onChange={e => setForm({ ...form, links: e.target.value })}
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
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-1.5"
              >
                <Trash2 size={13} /> Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.text?.trim()}
              className="gap-1.5"
            >
              <Save size={13} /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
