import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, X, Pin, PinOff, FolderPlus, Trash2, Loader2,
  MessageSquare, ChevronRight, Folder, Layers, AlertTriangle,
} from "lucide-react";

interface Hit {
  threadDate: string;
  title: string | null;
  autoTitle: string | null;
  source: string;
  provider: string | null;
  groupId: string | null;
  pinned: number;
  lastMessageAt: number | null;
  messageCount: number;
  snippet: string | null;
}

interface Group {
  id: string;
  name: string;
  color: string;
  threadCount: number;
}

interface Msg {
  role: string;
  content: string;
  createdAt: number;
}

const SOURCE_LABEL: Record<string, string> = {
  deskflow_chat: "DeskFlow",
  external_ai: "External",
  aigateway: "Gateway",
  imported_file: "Imported",
};

const REDUCED = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function relTime(ts: number | null): string {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60_000) return "now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  if (d < 2_592_000_000) return `${Math.floor(d / 86_400_000)}d`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenThread: (threadDate: string) => void;
}

export function ChatLibrary({ open, onClose, onOpenThread }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = REDUCED();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const api = () => (window as any).deskflowAPI;

  const loadGroups = useCallback(async () => {
    try {
      const r = await api()?.chatLibraryGroups?.();
      if (r?.success) setGroups(r.groups || []);
    } catch {
      /* non-fatal: sidebar degrades to an empty group rail */
    }
  }, []);

  const loadHits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api()?.chatLibrarySearch?.({
        query: debounced || undefined,
        groupId: activeGroup,
        limit: 200,
      });
      if (r?.success) setHits(r.hits || []);
      else setError(r?.error || "Could not load conversations.");
    } catch (e: any) {
      setError(e?.message || "Could not reach the chat library.");
    } finally {
      setLoading(false);
    }
  }, [debounced, activeGroup]);

  useEffect(() => {
    if (!open) return;
    void loadGroups();
  }, [open, loadGroups]);

  useEffect(() => {
    if (!open) return;
    void loadHits();
  }, [open, loadHits]);

  const openThread = useCallback(async (threadDate: string) => {
    setSelected(threadDate);
    setLoadingThread(true);
    setError(null);
    try {
      const r = await api()?.chatLibraryThreadMessages?.(threadDate);
      if (r?.success) setMessages(r.messages || []);
      else setError(r?.error || "Could not open that conversation.");
    } catch (e: any) {
      setError(e?.message || "Could not open that conversation.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const togglePin = useCallback(
    async (hit: Hit) => {
      const next = !hit.pinned;
      setHits((prev) =>
        prev.map((h) => (h.threadDate === hit.threadDate ? { ...h, pinned: next ? 1 : 0 } : h))
      );
      try {
        await api()?.chatLibrarySetThreadPin?.(hit.threadDate, next);
      } catch {
        setError("Could not update the pin.");
        void loadHits();
      }
    },
    [loadHits]
  );

  const moveToGroup = useCallback(
    async (threadDate: string, groupId: string | null) => {
      try {
        await api()?.chatLibrarySetThreadGroup?.(threadDate, groupId);
        setHits((prev) =>
          prev.map((h) => (h.threadDate === threadDate ? { ...h, groupId } : h))
        );
        void loadGroups();
      } catch {
        setError("Could not move that conversation.");
      }
    },
    [loadGroups]
  );

  const addGroup = useCallback(async () => {
    const name = newGroup.trim();
    if (!name) return;
    setGroupBusy(true);
    try {
      const r = await api()?.chatLibrarySaveGroup?.({ name });
      if (!r?.success) setError(r?.error || "Could not create the group.");
      setNewGroup("");
      await loadGroups();
    } finally {
      setGroupBusy(false);
    }
  }, [newGroup, loadGroups]);

  const removeGroup = useCallback(
    async (id: string) => {
      try {
        const r = await api()?.chatLibraryDeleteGroup?.(id);
        if (!r?.ok) {
          setError("Unsorted cannot be deleted.");
          return;
        }
        if (activeGroup === id) setActiveGroup(null);
        await loadGroups();
        void loadHits();
      } catch {
        setError("Could not delete the group.");
      }
    },
    [activeGroup, loadGroups, loadHits]
  );

  const pinnedHits = useMemo(() => hits.filter((h) => !!h.pinned), [hits]);

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of hits) {
      if (h.pinned) continue;
      const key = h.groupId || "unsorted";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    if (activeGroup) return map;
    const order = ["work", "learning", "creative", "life", "reference", "unsorted"];
    return new Map(
      [...map.entries()].sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
    );
  }, [hits, activeGroup]);

  if (!open) return null;

  const renderRow = (h: Hit) => (
    <div
      key={h.threadDate}
      role="button"
      tabIndex={0}
      onClick={() => void openThread(h.threadDate)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void openThread(h.threadDate);
      }}
      className="group px-2.5 py-2 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2"
      style={{
        background: selected === h.threadDate ? "rgba(251,191,36,0.08)" : "transparent",
        border: "1px solid",
        borderColor: selected === h.threadDate ? "rgba(251,191,36,0.28)" : "transparent",
        borderRadius: 8,
        transitionDuration: reduced ? "0ms" : "120ms",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {!!h.pinned && (
              <Pin size={9} style={{ color: "var(--color-amber-400)" }} className="shrink-0" />
            )}
            <span className="text-[11px] font-medium truncate" style={{ color: "var(--color-foreground)" }}>
              {h.title || h.autoTitle || "Untitled"}
            </span>
          </div>
          {h.snippet && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-muted-foreground)" }}>
              {h.snippet}
            </p>
          )}
          <div
            className="flex items-center gap-1.5 mt-1"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted-foreground)" }}
          >
            <span style={{ padding: "1px 4px", borderRadius: 999, border: "1px solid var(--ws-border)" }}>
              {SOURCE_LABEL[h.source] || h.source}
            </span>
            <span>{h.messageCount} msg</span>
            {h.lastMessageAt && <span>{relTime(h.lastMessageAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void togglePin(h);
            }}
            aria-label={h.pinned ? "Unpin" : "Pin"}
            className="rounded p-1 transition-colors focus:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {h.pinned ? <PinOff size={10} /> : <Pin size={10} />}
          </button>
          <select
            value={h.groupId || "unsorted"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              void moveToGroup(h.threadDate, e.target.value === "unsorted" ? null : e.target.value)
            }
            aria-label="Move to group"
            className="rounded text-[9px] outline-none"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--ws-border)",
              color: "var(--color-muted-foreground)",
              padding: "2px 4px",
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const totalPinned = hits.filter((h) => h.pinned).length;
  const isEmpty = !loading && hits.length === 0;

  return (
    <div
      role="dialog"
      aria-label="Chat library"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(9,9,11,0.72)" }}
    >
      <div
        className="w-full max-w-6xl flex flex-col overflow-hidden"
        style={{
          height: "min(84vh, 820px)",
          background: "var(--color-card)",
          border: "1px solid var(--ws-border-strong)",
          borderRadius: 12,
        }}
      >
        {/* Header — flat surface + hairline, no blur (LAMINAR §7.3) */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--ws-border)" }}
        >
          <Layers size={14} style={{ color: "var(--color-amber-400)" }} />
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            Chat Library
          </span>
          <span
            className="text-[10px]"
            style={{
              color: "var(--color-muted-foreground)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {hits.length}
            {totalPinned ? ` · ${totalPinned} pinned` : ""}
          </span>
          <button
            onClick={onClose}
            aria-label="Close chat library"
            className="ml-auto rounded p-1 transition-colors focus:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search — first focusable, full width. Finding beats browsing. */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--ws-border)" }}>
          <div
            className="flex items-center gap-2 px-3"
            style={{
              background: "var(--color-background)",
              border: "1px solid var(--ws-border)",
              borderRadius: 8,
            }}
          >
            <Search size={13} style={{ color: "var(--color-muted-foreground)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (query) setQuery("");
                  else onClose();
                }
                if (e.key === "Enter" && hits[0]) void openThread(hits[0].threadDate);
              }}
              placeholder="Search every conversation you have with any AI…"
              aria-label="Search conversations"
              className="flex-1 bg-transparent py-2.5 text-[12px] outline-none"
              style={{ color: "var(--color-foreground)" }}
            />
            {loading && <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-amber-400)" }} />}
            {query && !loading && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="rounded p-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Group rail */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <button
              onClick={() => setActiveGroup(null)}
              className="px-2 py-1 rounded-md text-[10px] transition-colors"
              style={
                activeGroup === null
                  ? { background: "rgba(251,191,36,0.14)", color: "var(--color-amber-400)", border: "1px solid rgba(251,191,36,0.3)" }
                  : { border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }
              }
            >
              All
            </button>
            {groups.map((g) => (
              <div key={g.id} className="flex items-center">
                <button
                  onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
                  className="px-2 py-1 rounded-md text-[10px] transition-colors"
                  style={
                    activeGroup === g.id
                      ? { background: "rgba(251,191,36,0.14)", color: "var(--color-amber-400)", border: "1px solid rgba(251,191,36,0.3)" }
                      : { border: "1px solid var(--ws-border)", color: "var(--color-muted-foreground)" }
                  }
                >
                  {g.name}
                  <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}> {g.threadCount}</span>
                </button>
                {g.id !== "unsorted" && (
                  <button
                    onClick={() => void removeGroup(g.id)}
                    aria-label={`Delete ${g.name} group`}
                    title={`Delete ${g.name}`}
                    className="ml-1 rounded p-0.5 transition-colors"
                    style={{ color: "var(--color-muted-foreground)", opacity: 0.5 }}
                  >
                    <Trash2 size={9} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addGroup();
                }}
                placeholder="New group"
                aria-label="New group name"
                className="px-2 py-1 rounded-md text-[10px] outline-none focus-visible:ring-2"
                style={{
                  width: 90,
                  background: "var(--color-background)",
                  border: "1px solid var(--ws-border)",
                  color: "var(--color-foreground)",
                }}
              />
              <button
                onClick={() => void addGroup()}
                disabled={!newGroup.trim() || groupBusy}
                aria-label="Create group"
                className="rounded p-1 transition-colors disabled:opacity-40"
                style={{ color: "var(--color-amber-400)" }}
              >
                {groupBusy ? <Loader2 size={11} className="animate-spin" /> : <FolderPlus size={11} />}
              </button>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="flex items-start gap-2 px-4 py-2.5 shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid var(--ws-border)" }}
          >
            <AlertTriangle size={13} style={{ color: "var(--color-destructive)" }} className="shrink-0 mt-0.5" />
            <span className="text-[11px]" style={{ color: "var(--color-destructive)" }}>
              {error}
            </span>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="ml-auto rounded p-0.5" style={{ color: "var(--color-destructive)" }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Two columns: index | preview */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ borderRight: "1px solid var(--ws-border)" }}>
            {loading && hits.length === 0 ? (
              <div className="flex items-center justify-center gap-2 h-full text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                <Loader2 size={13} className="animate-spin" /> Loading conversations…
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center justify-center gap-2 h-full px-8 text-center">
                <MessageSquare size={22} style={{ color: "var(--color-muted-foreground)", opacity: 0.35 }} />
                <p className="text-[12px]" style={{ color: "var(--color-muted-foreground)" }}>
                  {query
                    ? `No conversations match “${query}”.`
                    : activeGroup
                      ? "This group is empty."
                      : "No conversations yet."}
                </p>
                {!query && !activeGroup && (
                  <p className="text-[10px] max-w-xs" style={{ color: "var(--color-muted-foreground)", opacity: 0.75 }}>
                    Chats you have in DeskFlow, plus anything the browser extension captures,
                    all land here automatically.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-2">
                {pinnedHits.length > 0 && (
                  <div className="mb-3">
                    <div
                      className="flex items-center gap-1.5 px-1.5 py-1 mb-1"
                      style={{ color: "var(--color-amber-400)" }}
                    >
                      <Pin size={10} />
                      <span
                        className="text-[9px] uppercase tracking-wider"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Pinned
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>
                        {pinnedHits.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">{pinnedHits.map(renderRow)}</div>
                  </div>
                )}
                {[...grouped.entries()].map(([gid, list]) => {
                  const label =
                    groups.find((g) => g.id === gid)?.name ||
                    (gid === "unsorted" ? "Unsorted" : gid);
                  return (
                    <div key={gid} className="mb-3">
                      {!activeGroup && (
                        <div
                          className="flex items-center gap-1.5 px-1.5 py-1 mb-1"
                          style={{ color: "var(--color-muted-foreground)" }}
                        >
                          <Folder size={10} />
                          <span
                            className="text-[9px] uppercase tracking-wider"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {label}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", opacity: 0.6 }}>{list.length}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">{list.map(renderRow)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="w-[42%] min-w-0 overflow-y-auto flex flex-col">
            {loadingThread ? (
              <div className="flex items-center justify-center gap-2 h-full text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                <Loader2 size={13} className="animate-spin" /> Opening…
              </div>
            ) : !selected ? (
              <div
                className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                <ChevronRight size={20} style={{ opacity: 0.3 }} />
                <p className="text-[11px]">Pick a conversation to read it here.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                This conversation has no stored messages.
              </div>
            ) : (
              <div className="p-4 flex-1 space-y-3">
                <button
                  onClick={() => onOpenThread(selected)}
                  className="w-full px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors"
                  style={{
                    background: "rgba(251,191,36,0.14)",
                    color: "var(--color-amber-400)",
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}
                >
                  Continue this conversation
                </button>
                {messages.map((m, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span
                      className="text-[9px] uppercase tracking-wider"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color:
                          m.role === "user"
                            ? "var(--color-amber-400)"
                            : "var(--color-muted-foreground)",
                      }}
                    >
                      {m.role}
                    </span>
                    <p
                      className="text-[11px] whitespace-pre-wrap break-words"
                      style={{ color: "var(--color-foreground)", opacity: 0.88 }}
                    >
                      {m.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatLibrary;
