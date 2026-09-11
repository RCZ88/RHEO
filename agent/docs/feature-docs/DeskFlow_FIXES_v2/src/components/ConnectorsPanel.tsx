import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CalendarDays, Plus, RefreshCw, Trash2, ChevronDown, Loader2, AlertCircle, Play, Search, Check } from 'lucide-react';
import type { ConnectorConfig } from '../types/connectors';
import { SectionHead, StateShell, IconButton } from './ai';
import type { ViewState } from './ai/StateShell';
import { MOTION } from './ai/tokens';
import { useConnectorItems } from '../hooks/useConnectorItems';

interface ConnectorsPanelProps {
  onSetup?: () => void;
}

function timeAgo(dateStr: string): string {
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

const typeIconMap: Record<string, typeof Mail> = { email: Mail, calendar: CalendarDays };
const typeAccent: Record<string, 'violet' | 'pink'> = { email: 'violet', calendar: 'pink' };

function ConnectorCardSkeleton() {
  return (
    <div className="rounded-xl bg-zinc-900/40 ring-1 ring-zinc-800/60 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/60" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-32 rounded bg-zinc-800/60" />
          <div className="h-3 w-20 rounded bg-zinc-800/40" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-lg bg-zinc-800/60" />)}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSetup }: { onSetup?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="h-12 w-12 rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20 grid place-items-center mb-3">
        <div className="flex -space-x-2">
          <Mail className="h-5 w-5 text-violet-300" />
          <CalendarDays className="h-5 w-5 text-pink-300" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-zinc-100">No connectors yet</h3>
      <p className="mt-1 text-xs text-zinc-500 max-w-[280px]">Connect an inbox or calendar so your assistant can answer questions about your email and meetings.</p>
      {onSetup && (
        <button onClick={onSetup} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 hover:bg-pink-500/20 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add your first connector
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
      <div className="h-10 w-10 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 grid place-items-center mb-3">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <p className="text-sm text-zinc-400 max-w-[280px]">{message}</p>
      <button onClick={retry} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
        Retry
      </button>
    </div>
  );
}

function ConnectorItemRow({ item, index }: { item: any; index: number }) {
  const Icon = typeIconMap[item.itemType] ?? Mail;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.fast, delay: Math.min(index * 0.04, 0.35) }}
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-800/40 transition-colors group/item"
    >
      {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />}
      {item.read && <span className="w-1.5 h-1.5 shrink-0" />}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.read ? 'text-zinc-600' : 'text-zinc-500'}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] truncate ${item.read ? 'text-zinc-400' : 'text-zinc-200'}`}>
          {item.subject}
        </div>
        {item.summary && (
          <div className="text-[11px] text-zinc-600 truncate">{item.summary}</div>
        )}
      </div>
      <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
        {item.date ? timeAgo(item.date) : ''}
      </span>
    </motion.div>
  );
}

export function ConnectorsPanel({ onSetup }: ConnectorsPanelProps) {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [panelState, setPanelState] = useState<ViewState<ConnectorConfig[]>>({ status: 'loading' });
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<'all' | 'email' | 'event'>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [itemUnreadOnly, setItemUnreadOnly] = useState(false);

  const { state: itemsState, load: loadItems, invalidate: invalidateItems } = useConnectorItems(expandedId ?? '');

  const loadConnectors = useCallback(async (showLoader = true) => {
    if (showLoader) setPanelState({ status: 'loading' });
    try {
      const r = await window.deskflowAPI!.connectors.list();
      if (r.success) {
        setConnectors(r.connectors ?? []);
        setPanelState(r.connectors?.length > 0
          ? { status: 'ready', data: r.connectors }
          : { status: 'empty' }
        );
      } else {
        setPanelState({ status: 'error', message: r.error ?? 'Failed to load connectors', retry: () => loadConnectors() });
      }
    } catch (err: unknown) {
      setPanelState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load connectors', retry: () => loadConnectors() });
    }
  }, []);

  useEffect(() => { loadConnectors(); }, [loadConnectors]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await window.deskflowAPI!.connectors.sync(id);
      await loadConnectors(false);
      invalidateItems();
      if (expandedId === id) loadItems({});
    } catch {}
    setSyncingId(null);
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await window.deskflowAPI!.connectors.test(id);
    } catch {}
    setTestingId(null);
  };

  const handleRemove = async (id: string) => {
    try {
      await window.deskflowAPI!.connectors.remove(id);
      setConnectors(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
      await loadConnectors(false);
    } catch {}
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setItemFilter('all');
    setItemSearch('');
    setItemUnreadOnly(false);
    loadItems({});
  };

  useEffect(() => {
    if (!expandedId) return;
    const opts: any = {};
    if (itemFilter !== 'all') opts.itemType = itemFilter;
    if (itemSearch) opts.search = itemSearch;
    if (itemUnreadOnly) opts.unreadOnly = true;
    loadItems(opts);
  }, [itemFilter, itemSearch, itemUnreadOnly, expandedId, loadItems]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const timer = setTimeout(() => setItemSearch(v), 250);
    return () => clearTimeout(timer);
  }, []);

  const countBadge = connectors.length > 0 ? (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-mono bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20 tabular-nums">
      {connectors.length}
    </span>
  ) : null;

  const sections = connectors.reduce((acc, c) => {
    if (c.type === 'email') acc.email.push(c);
    else acc.calendar.push(c);
    return acc;
  }, { email: [] as ConnectorConfig[], calendar: [] as ConnectorConfig[] });

  return (
    <div>
      <SectionHead accent="violet" title="Connectors" desc="Your data sources for AI context" right={
        <div className="flex items-center gap-2">
          {countBadge}
          {onSetup && (
            <button onClick={onSetup} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Connect
            </button>
          )}
        </div>
      } />

      <StateShell state={panelState} skeleton={
        <div className="space-y-2">
          <ConnectorCardSkeleton />
          <ConnectorCardSkeleton />
        </div>
      } empty={<EmptyState onSetup={onSetup} />}>
        {(data) => (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {data.map((conn) => {
                const Icon = typeIconMap[conn.type] ?? Mail;
                const accent = typeAccent[conn.type] ?? 'violet';
                const isExpanded = expandedId === conn.id;
                const isSyncing = syncingId === conn.id;
                const isTesting = testingId === conn.id;
                return (
                  <motion.div
                    key={conn.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                    className="rounded-xl bg-zinc-900/40 ring-1 ring-zinc-800/60 hover:ring-zinc-700 transition overflow-hidden group"
                  >
                    {/* Sync progress bar */}
                    <AnimatePresence>
                      {isSyncing && (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          exit={{ scaleX: 0 }}
                          transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                          className="h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent"
                          style={{ transformOrigin: 'left' }}
                        />
                      )}
                    </AnimatePresence>

                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        {/* TypeIcon */}
                        <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ring-1 ${
                          accent === 'violet'
                            ? 'bg-violet-500/12 ring-violet-500/25 text-violet-300'
                            : 'bg-pink-500/12 ring-pink-500/25 text-pink-300'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Name block */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100 truncate">{conn.displayName}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              conn.status === 'connected' ? 'bg-emerald-400' :
                              conn.status === 'error' ? 'bg-red-400' : 'bg-zinc-500'
                            } ${isSyncing ? 'animate-breathe' : ''}`} />
                            {isSyncing && <span className="text-[11px] text-amber-400">Syncing\u2026</span>}
                            <span className={`text-[10px] capitalize ${
                              conn.status === 'connected' ? 'text-zinc-400' :
                              conn.status === 'error' ? 'text-red-400' : 'text-zinc-500'
                            }`}>
                              {isSyncing ? '' : conn.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 capitalize">{conn.provider}</div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <IconButton
                            icon={isSyncing ? Loader2 : RefreshCw}
                            label="Sync"
                            onClick={(e: any) => { e?.stopPropagation?.(); handleSync(conn.id); }}
                            disabled={isSyncing}
                            className={isSyncing ? 'animate-spin pointer-events-none' : ''}
                          />
                          <IconButton
                            icon={isTesting ? Loader2 : Play}
                            label="Test connection"
                            onClick={(e: any) => { e?.stopPropagation?.(); handleTest(conn.id); }}
                            disabled={isTesting}
                            className={isTesting ? 'animate-spin pointer-events-none' : ''}
                          />
                          <IconButton
                            icon={Trash2}
                            label="Remove connector"
                            onClick={(e: any) => { e?.stopPropagation?.(); handleRemove(conn.id); }}
                            className="hover:text-red-400 hover:bg-red-500/10"
                          />
                          <IconButton
                            icon={ChevronDown}
                            label="Toggle items"
                            onClick={(e: any) => { e?.stopPropagation?.(); toggleExpand(conn.id); }}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                        {conn.status === 'error' && conn.errorMessage ? (
                          <span className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            {conn.errorMessage}
                            <button onClick={() => handleTest(conn.id)} className="underline hover:text-red-300 ml-1">Retry</button>
                          </span>
                        ) : (
                          <>
                            {conn.lastSync && <span>Synced {timeAgo(conn.lastSync)}</span>}
                            {conn.itemCount !== undefined && (
                              <>
                                <span className="text-zinc-700">·</span>
                                <span>{conn.itemCount} items</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* ConnectorItemList */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                          className="border-t border-zinc-800/60 overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {/* ItemFilterBar */}
                            <div className="flex items-center gap-2 pb-2">
                              <div className="flex rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-0.5">
                                {['all', 'email', 'event'].map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setItemFilter(t as any)}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors capitalize ${
                                      itemFilter === t
                                        ? 'bg-zinc-800 text-zinc-200'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                  >
                                    {t === 'event' ? 'Calendar' : t === 'all' ? 'All' : 'Email'}
                                  </button>
                                ))}
                              </div>
                              <div className="relative flex-1 max-w-[160px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                                <input
                                  type="text"
                                  placeholder="Search\u2026"
                                  onChange={handleSearchChange}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-pink-500/40"
                                />
                              </div>
                              <button
                                onClick={() => setItemUnreadOnly(!itemUnreadOnly)}
                                className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                                  itemUnreadOnly
                                    ? 'bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                Unread
                              </button>
                            </div>

                            {/* Items */}
                            <StateShell state={itemsState} skeleton={
                              <div className="space-y-1.5">
                                {[1,2,3].map(i => (
                                  <div key={i} className="h-10 rounded-lg bg-zinc-800/40 animate-pulse" />
                                ))}
                              </div>
                            } empty={
                              <div className="text-center py-4">
                                <p className="text-xs text-zinc-600">No items synced yet — run a sync.</p>
                                <button
                                  onClick={() => handleSync(conn.id)}
                                  disabled={isSyncing}
                                  className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                                >
                                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                  Sync now
                                </button>
                              </div>
                            }>
                              {(items) => (
                                <div className="space-y-0.5">
                                  {items.items.map((item, i) => (
                                    <ConnectorItemRow key={item.id} item={item} index={i} />
                                  ))}
                                  {items.hasMore && (
                                    <button
                                      onClick={() => {
                                        const opts: any = { offset: items.offset };
                                        if (itemFilter !== 'all') opts.itemType = itemFilter;
                                        if (itemSearch) opts.search = itemSearch;
                                        if (itemUnreadOnly) opts.unreadOnly = true;
                                        loadItems(opts);
                                      }}
                                      className="w-full text-center py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                      Load more
                                    </button>
                                  )}
                                </div>
                              )}
                            </StateShell>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </StateShell>
    </div>
  );
}
