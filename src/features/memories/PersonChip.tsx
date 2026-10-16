interface PersonChipProps {
  name: string;
  onRemove?: () => void;
}

export function PersonChip({ name, onRemove }: PersonChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-mem-400-15)] text-[var(--color-mem-400)] text-[10px] font-medium">
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-[#f0a892] transition-colors">&times;</button>
      )}
    </span>
  );
}
