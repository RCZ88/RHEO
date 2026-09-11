import { X } from 'lucide-react';
import { ENTITY_COLORS } from '../../lib/CategoryColors';

export type EntityKind = keyof typeof ENTITY_COLORS;

export function EntityChip({ kind, label, onClick, onRemove }: {
  kind: EntityKind;
  label: string;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const color = ENTITY_COLORS[kind];
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] ${color.bg} ${color.border} ${color.text} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
      title={label}
    >
      <span className={`h-3 w-0.5 shrink-0 rounded-full ${color.bar}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {onRemove && <X size={10} onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label={`Remove ${label}`} />}
    </Tag>
  );
}
