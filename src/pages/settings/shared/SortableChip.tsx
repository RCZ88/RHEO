import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableChip({ id, color, onRemove }: { id: string; color: string; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1000 : 1 };
  return (
    <div ref={setNodeRef} style={{ ...style, backgroundColor: `${color}15`, borderColor: `${color}50`, color: color }}
      {...attributes} {...listeners}
      className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border cursor-grab active:cursor-grabbing hover:scale-105 transition-transform select-none">
      <GripVertical className="w-3 h-3 opacity-50" />
      <span>{id}</span>
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 hover:opacity-70 transition-opacity"><X className="w-3 h-3" /></button>}
    </div>
  );
}
