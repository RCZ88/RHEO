import { SearchX, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PRESET_COLORS } from './constants';
export { SortableChip } from './SortableChip';
export { TierContainer } from './TierContainer';

interface SearchableSectionProps {
  terms: string[];
  search: string;
  children: React.ReactNode;
}

export function SearchableSection({ terms, search, children }: SearchableSectionProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!search) { setVisible(true); return; }
    const q = search.toLowerCase();
    const match = terms.some(t => t.toLowerCase().includes(q));
    setVisible(match);
  }, [search, terms]);
  if (!visible) return null;
  return <div className="space-y-4">{children}</div>;
}
