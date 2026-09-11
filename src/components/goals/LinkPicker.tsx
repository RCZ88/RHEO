import { Link2 } from 'lucide-react';
export type LinkValue = { type: 'none' | 'goal' | 'deadline' | 'schedule' | 'todo'; id?: string };

type Option = { id: string; title?: string; text?: string; name?: string; startTime?: string; endTime?: string; dueDate?: string; due_date?: string };

export function LinkPicker({ value, goals = [], schedules = [], todos = [], deadlines = [], onChange, goalOnly = false }: {
  value: LinkValue;
  goals?: Option[];
  schedules?: Option[];
  todos?: Option[];
  deadlines?: Option[];
  onChange: (value: LinkValue) => void;
  goalOnly?: boolean;
}) {
  const lists: Record<string, Option[]> = { goal: goals, deadline: deadlines, schedule: schedules, todo: todos };
  const label = (item: Option) => item.title || item.text || item.name || item.id;
  const selected = value.type !== 'none' && value.id ? lists[value.type]?.find(item => item.id === value.id) : undefined;
  const types = goalOnly ? [{ value: 'goal', label: 'Goal' }] : [
    { value: 'goal', label: 'Goal (serves)' },
    { value: 'schedule', label: 'Schedule (belongs to)' },
    { value: 'todo', label: 'Todo (subtask)' },
    { value: 'deadline', label: 'Deadline (due by)' },
  ];
  const options = value.type === 'none' ? [] : lists[value.type] || [];
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link2 size={11} className="shrink-0 text-zinc-600" aria-hidden="true" />
      <select
        value={value.type}
        onChange={(event) => onChange({ type: event.target.value as LinkValue['type'] })}
        aria-label="Link type"
        className="h-7 min-w-0 flex-1 rounded-md border border-zinc-700/50 bg-zinc-900/70 px-1.5 text-[10px] text-zinc-400 outline-none focus:border-amber-400/50"
      >
        <option value="none">No link</option>
        {types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
      {value.type !== 'none' && (
        <select
          value={value.id || ''}
          onChange={(event) => onChange({ type: value.type, id: event.target.value || undefined })}
          aria-label={`Choose ${value.type}`}
          className="h-7 min-w-0 flex-[1.4] rounded-md border border-zinc-700/50 bg-zinc-900/70 px-1.5 text-[10px] text-zinc-300 outline-none focus:border-amber-400/50"
        >
          <option value="">Choose {value.type}</option>
          {options.map(item => <option key={item.id} value={item.id}>{label(item)}{item.dueDate || item.due_date ? ` · ${item.dueDate || item.due_date}` : ''}</option>)}
        </select>
      )}
      {selected && <span className="sr-only">Linked to {label(selected)}</span>}
    </div>
  );
}
