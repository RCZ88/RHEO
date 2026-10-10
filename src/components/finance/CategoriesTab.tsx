import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Tag, TrendingUp, TrendingDown, ArrowLeftRight, Search,
  ShoppingCart, Home, Car, Heart, Book, Coffee, Zap, Gift,
  Plane, Smartphone, Shirt, Utensils, Music, Gamepad, Monitor,
  Dumbbell, Droplets, Leaf, Wifi, Film, Train, Briefcase,
  DollarSign, PiggyBank, CreditCard, Banknote, Landmark, Gem,
  Receipt, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { TabHeader } from './_fx/TabHeader';
import { EmptyState } from './EmptyState';
import { convertAmount, formatCurrency as fmtCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type { FinanceCategory } from './finance-types';

const defaultColors = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CATEGORY_ICONS = [
  'ShoppingCart', 'Home', 'Car', 'Heart', 'Book', 'Coffee', 'Zap', 'Gift',
  'Plane', 'Smartphone', 'Shirt', 'Utensils', 'Music', 'Gamepad', 'Monitor',
  'Dumbbell', 'Droplets', 'Leaf', 'Wifi', 'Film', 'Train', 'Briefcase',
  'DollarSign', 'PiggyBank', 'CreditCard', 'Banknote', 'Landmark', 'Gem',
  'Receipt', 'Wallet', 'TrendingUp', 'TrendingDown',
];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  ShoppingCart, Home, Car, Heart, Book, Coffee, Zap, Gift,
  Plane, Smartphone, Shirt, Utensils, Music, Gamepad, Monitor,
  Dumbbell, Droplets, Leaf, Wifi, Film, Train, Briefcase,
  DollarSign, PiggyBank, CreditCard, Banknote, Landmark, Gem,
  Receipt, Wallet, TrendingUp, TrendingDown,
};

interface CategoriesTabProps {
  categories: FinanceCategory[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  displayCurrency: string;
  baseCurrency: string;
  onCreateCategory: (data: { name: string; type: FinanceCategory['type']; icon?: string; color?: string }) => Promise<boolean>;
  onUpdateCategory?: (data: { id: number; name: string; type: string; icon: string; color: string }) => Promise<boolean>;
}

export function CategoriesTab({ categories, loading, error, onRetry, displayCurrency, baseCurrency, onCreateCategory, onUpdateCategory }: CategoriesTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [showCreate, setShowCreate] = useState(false);
  const [colorPicker, setColorPicker] = useState<{ show: boolean; categoryId: number | null }>({ show: false, categoryId: null });
  const [editing, setEditing] = useState<{ id: number; name: string; icon: string; color: string } | null>(null);

  const incomeCats = categories.filter(c => c.type === 'income' && !c.is_archived);
  const expenseCats = categories.filter(c => c.type === 'expense' && !c.is_archived);
  const transferCats = categories.filter(c => c.type === 'transfer' && !c.is_archived);

  const fc = (amount: number) => showNumbers ? fmtCurrency(convertAmount(amount, baseCurrency, displayCurrency), displayCurrency) : maskNumber(fmtCurrency(convertAmount(amount, baseCurrency, displayCurrency), displayCurrency), maskMode, maskFixedValue);

  const openColorPicker = (categoryId: number) => {
    setColorPicker({ show: true, categoryId });
  };

  const closeColorPicker = () => {
    setColorPicker({ show: false, categoryId: null });
  };

  const selectColor = async (color: string) => {
    if (colorPicker.categoryId && onUpdateCategory) {
      const cat = categories.find(c => c.id === colorPicker.categoryId);
      if (cat) {
        await onUpdateCategory({ id: cat.id, name: cat.name, type: cat.type, icon: cat.icon || 'CircleDollarSign', color });
      }
    }
    closeColorPicker();
  };

  const handleSaveEdit = async () => {
    if (!editing || !onUpdateCategory) return;
    await onUpdateCategory(editing);
    setEditing(null);
  };

  const renderCategoryCard = (cat: FinanceCategory, accent: string, Icon: typeof TrendingUp) => (
    <GlassSurface
      key={cat.id}
      className={`!p-3 transition-all group border ${
        colorPicker.categoryId === cat.id ? 'ring-2 ring-emerald-500/50' : ''
      }`}
      style={{ borderColor: `${cat.color}20` }}
    >
      {editing?.id === cat.id ? (
        <div className="space-y-2">
          <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
            className="w-full rounded-lg bg-zinc-800/80 border border-zinc-700/50 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50" autoFocus />
          <div className="flex flex-wrap gap-1">
            {CATEGORY_ICONS.map(iconName => {
              const Ic = ICON_MAP[iconName];
              return Ic ? (
                <button key={iconName} onClick={() => setEditing({ ...editing, icon: iconName })}
                  className={`w-6 h-6 rounded flex items-center justify-center ${editing.icon === iconName ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'hover:bg-zinc-700/50'}`}>
                  <Ic className="w-3 h-3 text-zinc-400" />
                </button>
              ) : null;
            })}
          </div>
          <div className="flex gap-1">
            <button onClick={handleSaveEdit} className="flex-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Save</button>
            <button onClick={() => setEditing(null)} className="flex-1 px-2 py-1 rounded fin-label hover:text-zinc-300">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                <Icon className="w-3 h-3" style={{ color: cat.color }} />
              </div>
              <span className="text-xs font-medium text-zinc-200 truncate max-w-[120px]">{cat.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing({ id: cat.id, name: cat.name, icon: cat.icon || 'CircleDollarSign', color: cat.color }); }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openColorPicker(cat.id); }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Tag className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="fin-label">Spent this period</span>
            <span className="text-xs font-medium tabular-nums" style={{ color: cat.color }}>
              {fc(Number((cat as any).amount) || 0)}
            </span>
          </div>
        </>
      )}
    </GlassSurface>
  );

  if (error) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="animate-pulse bg-zinc-800/60 rounded-xl h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <TabHeader
        title="Categories"
        icon={<Tag className="w-4 h-4" />}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          >
            <Plus className="w-3.5 h-3.5" />
            New Category
          </button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-12 h-12" />}
          title="No categories"
          description="Create categories to organize your transactions"
          action={{ label: 'Create Category', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-6">
          {incomeCats.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-emerald-400 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Income
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {incomeCats.map(cat => renderCategoryCard(cat, 'emerald', TrendingUp))}
              </div>
            </div>
          )}

          {expenseCats.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-red-400 mb-2 flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3" /> Expense
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {expenseCats.map(cat => renderCategoryCard(cat, 'red', TrendingDown))}
              </div>
            </div>
          )}

          {transferCats.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                <ArrowLeftRight className="w-3 h-3" /> Transfer
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {transferCats.map(cat => renderCategoryCard(cat, 'amber', ArrowLeftRight))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateCategoryModal
            onClose={() => setShowCreate(false)}
            onSave={onCreateCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {colorPicker.show && colorPicker.categoryId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-overlay)] flex items-center justify-center p-5"
            onClick={closeColorPicker}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xs bg-popover border border-border rounded-xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Pick a Color</h3>
                <button onClick={closeColorPicker} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {defaultColors.map(color => (
                  <button
                    key={color}
                    onClick={() => selectColor(color)}
                    className="w-full aspect-square rounded-lg border-2 border-transparent hover:scale-110 transition-transform focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateCategoryModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: { name: string; type: FinanceCategory['type']; icon?: string; color?: string }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinanceCategory['type']>('expense');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#10b981');
  const [saving, setSaving] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!iconSearch) return CATEGORY_ICONS;
    const q = iconSearch.toLowerCase();
    return CATEGORY_ICONS.filter(name => name.toLowerCase().includes(q));
  }, [iconSearch]);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await onSave({ name, type, icon, color });
    setSaving(false);
    onClose();
  };

  const SelectedIcon = ICON_MAP[icon];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-popover border border-border rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">New Category</h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            autoFocus
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />

          <div className="flex gap-1.5">
            {(['income', 'expense', 'transfer'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                  type === t
                    ? t === 'income' ? 'bg-emerald-500/15 text-emerald-400' :
                      t === 'transfer' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <p className="fin-label mb-1.5">Icon</p>
            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 -mx-1">
              {filteredIcons.map(iconName => {
                const IconComp = ICON_MAP[iconName];
                return (
                  <button
                    key={iconName}
                    onClick={() => { setIcon(iconName); setIconSearch(''); }}
                    className={`p-1.5 rounded-lg transition-all focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                      icon === iconName
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                    title={iconName}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="fin-label mb-1.5">Color</p>
            <div className="grid grid-cols-4 gap-2">
              {defaultColors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                    color === c ? 'ring-2 ring-emerald-500 scale-110 border-transparent' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              {SelectedIcon && <SelectedIcon className="w-4 h-4" style={{ color }} />}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-200">{name || 'Category Name'}</p>
              <p className="fin-label capitalize">{type}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
